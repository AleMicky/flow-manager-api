import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';

import { WorkflowTaskAssignment } from '../entities/workflow-task-assignment.entity.js';
import { UpsertTaskAssignmentDto } from '../dto/upsert-task-assignment.dto.js';
import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';
import { KeycloakUsersService } from '../../../keycloak-admin/services/keycloak-users.service.js';
import type { AuthUser } from '../../../auth/interfaces/auth-user.interface.js';
import type {
  FlowablePage,
  WorkflowTask,
} from '../interfaces/task.interface.js';

export interface BpmnUserTaskAssignmentView {
  taskDefinitionKey: string;
  taskName: string;
  processDefinitionKey: string;
  assignmentId: string | null;
  candidateGroups: string[];
  candidateUsers: string[];
  active: boolean;
}

interface FlowableDefinitionSummary {
  id: string;
  key: string;
  name: string;
  version: number;
}

@Injectable()
export class TaskAssignmentsService implements OnModuleInit {
  private readonly logger = new Logger(TaskAssignmentsService.name);

  constructor(
    @InjectRepository(WorkflowTaskAssignment)
    private readonly repository: Repository<WorkflowTaskAssignment>,
    private readonly flowable: FlowableService,
    private readonly keycloakUsers: KeycloakUsersService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.repository.query(`
        CREATE TABLE IF NOT EXISTS workflow_task_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "processDefinitionKey" VARCHAR(150) NOT NULL,
          "taskDefinitionKey" VARCHAR(150) NOT NULL,
          "taskName" VARCHAR(200),
          "candidateGroups" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "candidateUsers" JSONB NOT NULL DEFAULT '[]'::jsonb,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_workflow_task_assignment_process_task
            UNIQUE ("processDefinitionKey", "taskDefinitionKey")
        );
      `);
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar/crear tabla workflow_task_assignments automáticamente: ${String(error)}`,
      );
    }
  }

  async findAll(processDefinitionKey?: string): Promise<WorkflowTaskAssignment[]> {
    return this.repository.find({
      where: processDefinitionKey ? { processDefinitionKey } : {},
      order: {
        processDefinitionKey: 'ASC',
        taskDefinitionKey: 'ASC',
      },
    });
  }

  async findByProcessAndTask(
    processDefinitionKey: string,
    taskDefinitionKey: string,
  ): Promise<WorkflowTaskAssignment | null> {
    return this.repository.findOneBy({
      processDefinitionKey,
      taskDefinitionKey,
    });
  }

  /**
   * Extrae las <userTask> del BPMN desplegado en Flowable para un processDefinitionKey
   * y las combina con las asignaciones guardadas en PostgreSQL.
   */
  async getProcessTasksWithAssignments(
    processDefinitionKey: string,
  ): Promise<BpmnUserTaskAssignmentView[]> {
    const savedAssignments = await this.findAll(processDefinitionKey);
    const savedMap = new Map(
      savedAssignments.map((item) => [item.taskDefinitionKey, item]),
    );

    const parsedTasks: Array<{ id: string; name: string }> = [];

    try {
      const defsPage = await this.flowable.getDefinitions<
        FlowablePage<FlowableDefinitionSummary>
      >({
        key: processDefinitionKey,
        latest: true,
        size: 1,
      });

      const latestDef = defsPage.data?.[0];

      if (latestDef) {
        const xml = await this.flowable.getDefinitionXml(latestDef.id);
        const parser = new XMLParser({
          ignoreAttributes: false,
          removeNSPrefix: true,
          attributeNamePrefix: '@_',
        });

        const doc = parser.parse(xml) as {
          definitions?: {
            process?: Record<string, unknown> | Array<Record<string, unknown>>;
          };
        };

        const rawProcesses = doc.definitions?.process;
        const processes = Array.isArray(rawProcesses)
          ? rawProcesses
          : rawProcesses
            ? [rawProcesses]
            : [];

        for (const proc of processes) {
          const rawUserTasks = proc.userTask as
            | Record<string, unknown>
            | Array<Record<string, unknown>>
            | undefined;

          const userTasks = Array.isArray(rawUserTasks)
            ? rawUserTasks
            : rawUserTasks
              ? [rawUserTasks]
              : [];

          for (const ut of userTasks) {
            const id = typeof ut['@_id'] === 'string' ? ut['@_id'] : '';
            const name =
              typeof ut['@_name'] === 'string' ? ut['@_name'] : id;
            if (id) {
              parsedTasks.push({ id, name });
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo extraer userTasks desde Flowable para "${processDefinitionKey}": ${String(error)}`,
      );
    }

    const result: BpmnUserTaskAssignmentView[] = [];
    const seenKeys = new Set<string>();

    for (const task of parsedTasks) {
      seenKeys.add(task.id);
      const saved = savedMap.get(task.id);
      result.push({
        processDefinitionKey,
        taskDefinitionKey: task.id,
        taskName: saved?.taskName || task.name,
        assignmentId: saved?.id ?? null,
        candidateGroups: saved?.candidateGroups ?? [],
        candidateUsers: saved?.candidateUsers ?? [],
        active: saved?.active ?? true,
      });
    }

    for (const saved of savedAssignments) {
      if (!seenKeys.has(saved.taskDefinitionKey)) {
        result.push({
          processDefinitionKey,
          taskDefinitionKey: saved.taskDefinitionKey,
          taskName: saved.taskName || saved.taskDefinitionKey,
          assignmentId: saved.id,
          candidateGroups: saved.candidateGroups,
          candidateUsers: saved.candidateUsers,
          active: saved.active,
        });
      }
    }

    return result;
  }

  /**
   * Crea o actualiza la asignación de grupos/usuarios de Keycloak para una tarea BPMN
   * y sincroniza los IdentityLinks de las tareas activas en Flowable.
   */
  async upsert(dto: UpsertTaskAssignmentDto): Promise<WorkflowTaskAssignment> {
    const processDefinitionKey = dto.processDefinitionKey.trim();
    const taskDefinitionKey = dto.taskDefinitionKey.trim();
    const candidateGroups = Array.from(
      new Set((dto.candidateGroups ?? []).map((g) => g.trim()).filter(Boolean)),
    );
    const candidateUsers = Array.from(
      new Set((dto.candidateUsers ?? []).map((u) => u.trim()).filter(Boolean)),
    );

    let entity = await this.findByProcessAndTask(
      processDefinitionKey,
      taskDefinitionKey,
    );

    if (entity) {
      entity.taskName = dto.taskName?.trim() ?? entity.taskName;
      entity.candidateGroups = candidateGroups;
      entity.candidateUsers = candidateUsers;
      if (dto.active !== undefined) {
        entity.active = dto.active;
      }
    } else {
      entity = this.repository.create({
        processDefinitionKey,
        taskDefinitionKey,
        taskName: dto.taskName?.trim() ?? null,
        candidateGroups,
        candidateUsers,
        active: dto.active ?? true,
      });
    }

    const saved = await this.repository.save(entity);

    // Sincronizar con tareas activas actualmente en ejecución en Flowable
    await this.syncActiveTasksInFlowable(saved);

    return saved;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException('Asignación de tarea no encontrada');
    }
    await this.repository.remove(existing);
  }

  /**
   * Obtiene todos los grupos y roles efectivos del usuario autenticado
   * (incluyendo los grupos de Keycloak asignados dinámicamente).
   */
  async getUserEffectiveGroupsAndRoles(user: AuthUser): Promise<string[]> {
    const identifiers = new Set<string>(user.roles ?? []);

    try {
      const groups = await this.keycloakUsers.getUserGroups(user.id);
      for (const group of groups) {
        if (group.name) identifiers.add(group.name);
        if (group.id) identifiers.add(group.id);
        if (group.path) {
          identifiers.add(group.path);
          identifiers.add(group.path.replace(/^\//, ''));
        }
      }
    } catch {
      // Si Keycloak Admin no está disponible momentáneamente, usamos los roles del JWT
    }

    return Array.from(identifiers);
  }

  /**
   * Devuelve las reglas activas de workflow_task_assignments donde el usuario
   * es candidato directo (candidateUsers) o por sus grupos/roles de Keycloak (candidateGroups).
   */
  async findMatchingAssignmentsForUser(
    user: AuthUser,
    effectiveGroups?: string[],
  ): Promise<WorkflowTaskAssignment[]> {
    const groups =
      effectiveGroups ?? (await this.getUserEffectiveGroupsAndRoles(user));

    const allActive = await this.repository.find({
      where: { active: true },
    });

    return allActive.filter((assignment) => {
      if (assignment.candidateUsers.includes(user.id)) {
        return true;
      }
      if (
        assignment.candidateUsers.includes(user.username)
      ) {
        return true;
      }
      return assignment.candidateGroups.some((g) => groups.includes(g));
    });
  }

  private async syncActiveTasksInFlowable(
    assignment: WorkflowTaskAssignment,
  ): Promise<void> {
    if (!assignment.active) return;

    try {
      const page = await this.flowable.getTasks<FlowablePage<WorkflowTask>>({
        processDefinitionKey: assignment.processDefinitionKey,
        taskDefinitionKey: assignment.taskDefinitionKey,
        size: 100,
      });

      const activeTasks = page.data ?? [];

      for (const task of activeTasks) {
        for (const group of assignment.candidateGroups) {
          await this.flowable
            .addTaskCandidateGroup(task.id, group)
            .catch(() => undefined);
        }
        for (const userId of assignment.candidateUsers) {
          await this.flowable
            .addTaskCandidateUser(task.id, userId)
            .catch(() => undefined);
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron sincronizar IdentityLinks en Flowable para ${assignment.processDefinitionKey}/${assignment.taskDefinitionKey}: ${String(error)}`,
      );
    }
  }
}

