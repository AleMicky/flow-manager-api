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
  defaultAssignee?: string | null;
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
      await this.seedDefaultAssignments();
    } catch (error) {
      this.logger.warn(
        `No se pudo verificar/crear tabla workflow_task_assignments automáticamente: ${String(error)}`,
      );
    }

    // Auto-asignar tareas huérfanas/pendientes existentes en Flowable que ya tengan responsable configurado
    await this.autoAssignConfiguredTasks().catch(() => undefined);
  }

  private async seedDefaultAssignments(): Promise<void> {
    const defaults: Array<{
      processDefinitionKey: string;
      taskDefinitionKey: string;
      taskName: string;
      candidateGroups: string[];
    }> = [
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVerificarExistencias',
        taskName: 'Verificación de existencias / activos',
        candidateGroups: ['encargado-almacenes'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVerificarPresupuesto',
        taskName: 'Verificación de presupuesto',
        candidateGroups: ['encargado-presupuestos'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskAjustarSolicitud',
        taskName: 'Subsanación / Ajuste de Solicitud',
        candidateGroups: ['unidad-solicitante'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskAsignarEncargado',
        taskName: 'Asignación Encargado de Adquisiciones',
        candidateGroups: ['jefe-adquisiciones'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskRevisarSolicitud',
        taskName: 'Revisión solicitud de adquisición',
        candidateGroups: [],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskAprobacionSuperior',
        taskName: 'Aprobación Inmediato Superior',
        candidateGroups: ['jefe-inmediato-superior'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskGafCat1',
        taskName: 'Aprobación GAF (Cat I)',
        candidateGroups: ['gerencia-administrativa-financiera'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskDecisionFinalCat1',
        taskName: 'Decisión final (Gerente de Área)',
        candidateGroups: ['gerente-area'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVoboFinanciero',
        taskName: 'Visto bueno financiero',
        candidateGroups: ['jefe-administrativo-financiero'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskVoboLegal',
        taskName: 'Visto bueno legal',
        candidateGroups: ['jefe-legal'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskGafCat2',
        taskName: 'Aprobación y Designación Comités (GAF)',
        candidateGroups: ['gerencia-administrativa-financiera'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskDecisionFinalCat2',
        taskName: 'Decisión final (Gerente General)',
        candidateGroups: ['gerente-general'],
      },
      {
        processDefinitionKey: 'prGaf08Adquisiciones',
        taskDefinitionKey: 'taskInformesCierre',
        taskName: 'Adjuntar Informes Técnico y Legal de Cancelación',
        candidateGroups: ['adquisiciones', 'jefe-adquisiciones'],
      },
    ];

    for (const item of defaults) {
      const exists = await this.findByProcessAndTask(
        item.processDefinitionKey,
        item.taskDefinitionKey,
      );
      if (!exists) {
        await this.repository.save(
          this.repository.create({
            ...item,
            candidateUsers: [],
            active: true,
          }),
        );
      }
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

    const parsedTasks: Array<{
      id: string;
      name: string;
      assignee?: string | null;
      candidateGroups?: string[];
      candidateUsers?: string[];
    }> = [];

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
            const assignee =
              typeof ut['@_flowable:assignee'] === 'string'
                ? ut['@_flowable:assignee']
                : typeof ut['@_assignee'] === 'string'
                  ? ut['@_assignee']
                  : null;
            const rawGroups =
              typeof ut['@_flowable:candidateGroups'] === 'string'
                ? ut['@_flowable:candidateGroups']
                : typeof ut['@_candidateGroups'] === 'string'
                  ? ut['@_candidateGroups']
                  : '';
            const rawUsers =
              typeof ut['@_flowable:candidateUsers'] === 'string'
                ? ut['@_flowable:candidateUsers']
                : typeof ut['@_candidateUsers'] === 'string'
                  ? ut['@_candidateUsers']
                  : '';

            const candidateGroups = rawGroups
              ? rawGroups.split(',').map((s) => s.trim()).filter(Boolean)
              : [];
            const candidateUsers = rawUsers
              ? rawUsers.split(',').map((s) => s.trim()).filter(Boolean)
              : [];

            if (id) {
              parsedTasks.push({ id, name, assignee, candidateGroups, candidateUsers });
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

      const effectiveGroups =
        saved && saved.candidateGroups.length > 0
          ? saved.candidateGroups
          : (task.candidateGroups ?? []);

      let effectiveUsers =
        saved && saved.candidateUsers.length > 0
          ? saved.candidateUsers
          : (task.candidateUsers ?? []);

      // Si no tiene usuarios pero en el BPMN tiene asignado ${initiator} o una variable, incorporarlo
      if (effectiveUsers.length === 0 && task.assignee) {
        effectiveUsers = [task.assignee];
      }

      result.push({
        processDefinitionKey,
        taskDefinitionKey: task.id,
        taskName: saved?.taskName || task.name,
        assignmentId: saved?.id ?? null,
        candidateGroups: effectiveGroups,
        candidateUsers: effectiveUsers,
        active: saved?.active ?? true,
        defaultAssignee: task.assignee ?? null,
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
      const [groups, rolesInfo] = await Promise.all([
        this.keycloakUsers.getUserGroups(user.id).catch(() => []),
        this.keycloakUsers.getUserRoles(user.id).catch(() => null),
      ]);
      for (const group of groups) {
        if (group.name) identifiers.add(group.name);
        if (group.id) identifiers.add(group.id);
        if (group.path) {
          identifiers.add(group.path);
          identifiers.add(group.path.replace(/^\//, ''));
        }
      }
      if (rolesInfo?.effectiveRoles) {
        for (const roleName of rolesInfo.effectiveRoles) {
          if (roleName) identifiers.add(roleName);
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
    const lowerGroups = new Set(groups.map((g) => g.toLowerCase()));
    const userTokens = new Set(
      [user.id, user.username, user.email, user.name]
        .filter((v): v is string => Boolean(v))
        .map((v) => v.toLowerCase()),
    );

    const allActive = await this.repository.find({
      where: { active: true },
    });

    return allActive.filter((assignment) => {
      if (
        assignment.candidateUsers.some((u) =>
          userTokens.has(u.toLowerCase()),
        )
      ) {
        return true;
      }
      return assignment.candidateGroups.some((g) =>
        lowerGroups.has(g.toLowerCase()),
      );
    });
  }

  private async getProcessVariablesMap(
    processInstanceId?: string | null,
  ): Promise<Record<string, unknown>> {
    if (!processInstanceId) return {};
    try {
      const vars = await this.flowable.getInstanceVariables<
        Array<{
          name?: string;
          value?: unknown;
          variable?: { name: string; value: unknown };
        }>
      >(processInstanceId);
      const result: Record<string, unknown> = {};
      if (Array.isArray(vars)) {
        for (const v of vars) {
          const name = v.variable?.name || v.name;
          const value =
            v.variable?.value !== undefined ? v.variable.value : v.value;
          if (name) {
            result[name] = value;
          }
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  private async resolveDesignatedUser(
    rawUser: string | undefined,
    processInstanceId?: string | null,
  ): Promise<string | null> {
    if (!rawUser) return null;
    const trimmed = rawUser.trim();
    if (!trimmed) return null;

    if (trimmed === '${initiator}' || trimmed === 'solicitante') {
      const vars = await this.getProcessVariablesMap(processInstanceId);
      const resolved =
        vars.iniciadorUsername ||
        vars.startUserId ||
        vars.initiator ||
        vars.iniciadorId;
      if (typeof resolved === 'string' && resolved.trim().length > 0) {
        return resolved.trim();
      }
      return null;
    }

    const exprMatch = /^\$\{(.+)\}$/.exec(trimmed);
    if (exprMatch) {
      const varName = exprMatch[1].trim();
      const vars = await this.getProcessVariablesMap(processInstanceId);
      const val = vars[varName];
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
      return null;
    }

    return trimmed;
  }

  private isCorruptedAssignee(assignee?: string | null): boolean {
    if (!assignee) return false;
    const trimmed = assignee.trim();
    return trimmed.startsWith('${') || trimmed === 'solicitante';
  }

  private async assignTaskSafely(
    task: WorkflowTask,
    designatedUser: string,
  ): Promise<void> {
    if (!designatedUser || designatedUser.startsWith('${')) return;
    if (task.assignee === designatedUser) return;

    if (task.assignee) {
      await this.flowable.unclaimTask(task.id).catch(() => undefined);
    }
    await this.flowable
      .claimTask(task.id, designatedUser)
      .catch(() => undefined);
  }

  /**
   * Sincroniza los IdentityLinks y asigna automáticamente al responsable principal
   * para todas las tareas activas de una instancia de proceso recién iniciada o en curso.
   */
  async syncProcessInstanceTasks(
    processInstanceId: string,
    processDefinitionKey: string,
  ): Promise<void> {
    try {
      const page = await this.flowable.getTasks<FlowablePage<WorkflowTask>>({
        processInstanceId,
        size: 50,
      });

      const activeTasks = page.data ?? [];
      if (activeTasks.length === 0) return;

      const rules = await this.findAll(processDefinitionKey);
      const rulesMap = new Map(rules.map((r) => [r.taskDefinitionKey, r]));

      for (const task of activeTasks) {
        if (!task.taskDefinitionKey) continue;

        // Si la tarea quedó con un assignee literal como "${initiator}" o "admin" por el motor, repararla
        if (this.isCorruptedAssignee(task.assignee)) {
          const fallbackInitiator = await this.resolveDesignatedUser(
            '${initiator}',
            processInstanceId,
          );
          await this.flowable.unclaimTask(task.id).catch(() => undefined);
          task.assignee = null;
          if (
            task.taskDefinitionKey === 'taskAjustarSolicitud' &&
            fallbackInitiator
          ) {
            await this.assignTaskSafely(task, fallbackInitiator);
            task.assignee = fallbackInitiator;
          }
        }

        const rule = rulesMap.get(task.taskDefinitionKey);
        if (!rule || !rule.active) continue;

        for (const group of rule.candidateGroups) {
          await this.flowable
            .addTaskCandidateGroup(task.id, group)
            .catch(() => undefined);
        }

        for (const rawUserId of rule.candidateUsers) {
          const resolvedCandidate = await this.resolveDesignatedUser(
            rawUserId,
            processInstanceId,
          );
          if (resolvedCandidate) {
            await this.flowable
              .addTaskCandidateUser(task.id, resolvedCandidate)
              .catch(() => undefined);
          }
        }

        // Si la regla tiene un responsable directo configurado y la tarea no tiene asignado,
        // asignar de inmediato al responsable para que aparezca en "Mis Tareas" / "Mis Aprobaciones"
        if (
          (!task.assignee || this.isCorruptedAssignee(task.assignee)) &&
          rule.candidateUsers &&
          rule.candidateUsers.length > 0
        ) {
          const designatedUser = await this.resolveDesignatedUser(
            rule.candidateUsers[0],
            processInstanceId,
          );

          if (designatedUser) {
            await this.assignTaskSafely(task, designatedUser);
            this.logger.log(
              `Tarea nueva [${task.id} - ${task.taskDefinitionKey}] asignada directamente al responsable [${designatedUser}]`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron sincronizar IdentityLinks para la instancia ${processInstanceId}: ${String(error)}`,
      );
    }
  }

  /**
   * Auto-asigna todas las tareas activas sin asignar que tengan responsables directos
   * configurados en workflow_task_assignments.
   */
  async autoAssignConfiguredTasks(): Promise<void> {
    try {
      const allRules = await this.repository.find({ where: { active: true } });
      const rulesWithUsers = allRules.filter(
        (r) => r.candidateUsers && r.candidateUsers.length > 0,
      );

      for (const rule of rulesWithUsers) {
        const rawDesignated = rule.candidateUsers[0];
        if (!rawDesignated) continue;

        const tasksPage = await this.flowable
          .getTasks<FlowablePage<WorkflowTask>>({
            processDefinitionKey: rule.processDefinitionKey,
            taskDefinitionKey: rule.taskDefinitionKey,
            size: 50,
          })
          .catch(() => null);

        const activeTasks = tasksPage?.data ?? [];
        for (const task of activeTasks) {
          if (task.assignee && !this.isCorruptedAssignee(task.assignee)) {
            continue;
          }

          const designatedUser = await this.resolveDesignatedUser(
            rawDesignated,
            task.processInstanceId,
          );

          if (designatedUser) {
            await this.assignTaskSafely(task, designatedUser);
            this.logger.log(
              `Tarea activa [${task.id} - ${task.name}] auto-asignada al responsable [${designatedUser}] según regla BPMN`,
            );
          } else if (this.isCorruptedAssignee(task.assignee)) {
            await this.flowable.unclaimTask(task.id).catch(() => undefined);
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Error al auto-asignar tareas configuradas: ${String(error)}`,
      );
    }
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
        for (const rawUserId of assignment.candidateUsers) {
          const resolvedCandidate = await this.resolveDesignatedUser(
            rawUserId,
            task.processInstanceId,
          );
          if (resolvedCandidate) {
            await this.flowable
              .addTaskCandidateUser(task.id, resolvedCandidate)
              .catch(() => undefined);
          }
        }

        // Si la regla tiene un usuario responsable directo, asignarlo directamente a la tarea
        if (assignment.candidateUsers && assignment.candidateUsers.length > 0) {
          const designatedUser = await this.resolveDesignatedUser(
            assignment.candidateUsers[0],
            task.processInstanceId,
          );
          if (designatedUser && task.assignee !== designatedUser) {
            await this.assignTaskSafely(task, designatedUser);
            this.logger.log(
              `Tarea activa [${task.id} - ${task.taskDefinitionKey}] reasignada al responsable [${designatedUser}]`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `No se pudieron sincronizar IdentityLinks en Flowable para ${assignment.processDefinitionKey}/${assignment.taskDefinitionKey}: ${String(error)}`,
      );
    }
  }
}

