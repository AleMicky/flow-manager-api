import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { TaskAssignmentsService } from './services/task-assignments.service.js';
import { TaskFormService } from '../forms/services/task-form.service.js';
import { WorkflowNotificationsService } from '../../notifications/workflow-notifications.service.js';

import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { ClaimTaskDto } from './dto/claim-task.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';

import type {
  FlowablePage,
  WorkflowTask,
} from './interfaces/task.interface.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly flowableService: FlowableService,
    private readonly taskAssignments: TaskAssignmentsService,
    private readonly taskFormService: TaskFormService,
    private readonly workflowNotifications: WorkflowNotificationsService,
    private readonly config: ConfigService,
  ) {}

  private emptyPage(): FlowablePage<WorkflowTask> {
    return {
      data: [],
      total: 0,
      start: 0,
      size: 0,
      sort: null,
      order: null,
    };
  }

  private isUserAdmin(user: AuthUser, effectiveGroups: string[] = []): boolean {
    const adminRoles = ['workflow-admin', 'admin', 'realm-admin', 'superadmin'];
    return Boolean(
      user.roles?.some((r) => adminRoles.includes(r.toLowerCase())) ||
        effectiveGroups.some((r) => adminRoles.includes(r.toLowerCase())) ||
        ['admin', 'administrador'].includes(
          (user.username || '').toLowerCase(),
        ),
    );
  }

  async findMine(user: AuthUser, query: QueryTasksDto) {
    const start = query.start ?? 0;
    const size = query.size ?? 20;

    // Sincronizar y auto-asignar tareas huérfanas que tengan responsable configurado
    await this.taskAssignments.autoAssignConfiguredTasks().catch(() => undefined);

    // Incluir tareas donde el usuario es responsable por reglas de asignación (usuarios/grupos/roles)
    const effectiveGroups = await this.taskAssignments
      .getUserEffectiveGroupsAndRoles(user)
      .catch(() => user.roles ?? []);
    const matchingRules = await this.taskAssignments
      .findMatchingAssignmentsForUser(user, effectiveGroups)
      .catch(() => []);

    const isAdmin = this.isUserAdmin(user, effectiveGroups);

    const baseParams: Record<string, unknown> = {
      ...(query.processInstanceId && {
        processInstanceId: query.processInstanceId,
      }),
      ...(query.name && { name: query.name }),
    };

    const queries: Array<Promise<FlowablePage<WorkflowTask>>> = [
      this.flowableService
        .getTasks<FlowablePage<WorkflowTask>>({
          ...baseParams,
          start: 0,
          size: 100,
          assignee: user.id,
        })
        .catch(() => this.emptyPage()),
    ];

    if (user.username && user.username !== user.id) {
      queries.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...baseParams,
            start: 0,
            size: 100,
            assignee: user.username,
          })
          .catch(() => this.emptyPage()),
      );
    }

    for (const rule of matchingRules) {
      queries.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...baseParams,
            start: 0,
            size: 100,
            processDefinitionKey: rule.processDefinitionKey,
            taskDefinitionKey: rule.taskDefinitionKey,
          })
          .catch(() => this.emptyPage()),
      );
    }

    if (effectiveGroups.length > 0) {
      queries.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...baseParams,
            start: 0,
            size: 100,
            candidateGroups: effectiveGroups.join(','),
          })
          .catch(() => this.emptyPage()),
      );
    }

    if (isAdmin) {
      queries.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...baseParams,
            start: 0,
            size: 100,
          })
          .catch(() => this.emptyPage()),
      );
    }

    const results = await Promise.all(queries);
    const uniqueMap = new Map<string, WorkflowTask>();
    for (const res of results) {
      for (const task of res.data ?? []) {
        uniqueMap.set(task.id, task);
      }
    }

    const all = Array.from(uniqueMap.values());
    const paged = all.slice(start, start + size);

    return {
      data: paged,
      total: all.length,
      start,
      size,
      sort: 'createTime',
      order: 'desc',
    };
  }

  async findAvailable(
    user: AuthUser,
    query: QueryTasksDto,
  ): Promise<FlowablePage<WorkflowTask>> {
    const start = query.start ?? 0;
    const size = query.size ?? 20;

    // Asegurar que las tareas con responsable directo configurado se auto-asignen antes de listar las disponibles
    await this.taskAssignments.autoAssignConfiguredTasks().catch(() => undefined);

    const effectiveGroups = await this.taskAssignments
      .getUserEffectiveGroupsAndRoles(user)
      .catch(() => user.roles ?? []);
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';
    const isAdmin = this.isUserAdmin(user, effectiveGroups);

    // En modo administrador, mostrar todas las tareas activas para supervisión global y acción directa
    // (incluyendo las asignadas a otros usuarios como Elvis Cabrera)
    if (isAdmin && !query.candidateGroup) {
      return this.flowableService.getTasks<FlowablePage<WorkflowTask>>({
        start,
        size,
        ...(query.processInstanceId && {
          processInstanceId: query.processInstanceId,
        }),
        ...(query.name && { name: query.name }),
      });
    }

    if (query.candidateGroup) {
      return this.flowableService.getTasks<FlowablePage<WorkflowTask>>({
        start,
        size,
        unassigned: true,
        candidateGroup: query.candidateGroup,
        ...(query.processInstanceId && {
          processInstanceId: query.processInstanceId,
        }),
        ...(query.name && { name: query.name }),
      });
    }

    const matchingRules = await this.taskAssignments
      .findMatchingAssignmentsForUser(user, effectiveGroups)
      .catch(() => []);

    const commonFilters: Record<string, unknown> = {
      ...(query.processInstanceId && {
        processInstanceId: query.processInstanceId,
      }),
      ...(query.name && { name: query.name }),
    };

    const pagePromises: Array<Promise<FlowablePage<WorkflowTask>>> = [];

    if (isDev) {
      pagePromises.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...commonFilters,
            unassigned: true,
            start: 0,
            size: 100,
          })
          .catch(() => this.emptyPage()),
      );
    }

    if (effectiveGroups.length > 0) {
      pagePromises.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...commonFilters,
            start: 0,
            size: 100,
            candidateGroups: effectiveGroups.join(','),
          })
          .catch(() => this.emptyPage()),
      );
    } else {
      pagePromises.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...commonFilters,
            start: 0,
            size: 100,
            candidateUser: user.username || user.id,
          })
          .catch(() => this.emptyPage()),
      );
    }

    for (const rule of matchingRules) {
      pagePromises.push(
        this.flowableService
          .getTasks<FlowablePage<WorkflowTask>>({
            ...commonFilters,
            start: 0,
            size: 100,
            processDefinitionKey: rule.processDefinitionKey,
            taskDefinitionKey: rule.taskDefinitionKey,
          })
          .catch(() => this.emptyPage()),
      );
    }

    const results = await Promise.all(pagePromises);
    const uniqueTasks = new Map<string, WorkflowTask>();

    for (const res of results) {
      for (const task of res.data ?? []) {
        uniqueTasks.set(task.id, task);
      }
    }

    const allTasks = Array.from(uniqueTasks.values());
    const pagedData = allTasks.slice(start, start + size);

    return {
      data: pagedData,
      total: allTasks.length,
      start,
      size,
      sort: 'createTime',
      order: 'desc',
    };
  }

  findAll(query: QueryTasksDto) {
    const params: Record<string, unknown> = {
      start: query.start,
      size: query.size,
    };

    if (query.assignee) {
      params.assignee = query.assignee;
    }

    if (query.candidateGroup) {
      params.candidateGroup = query.candidateGroup;
    }

    if (query.processInstanceId) {
      params.processInstanceId = query.processInstanceId;
    }

    if (query.name) {
      params.name = query.name;
    }

    if (query.unassigned !== undefined) {
      params.unassigned = query.unassigned;
    }

    return this.flowableService.getTasks<FlowablePage<WorkflowTask>>(params);
  }

  findOne(id: string) {
    return this.flowableService.getTaskById<WorkflowTask>(id);
  }

  claim(id: string, dto: ClaimTaskDto) {
    return this.flowableService.claimTask<void>(id, dto.assignee);
  }

  unclaim(id: string) {
    return this.flowableService.unclaimTask<void>(id);
  }

  async complete(id: string, dto: CompleteTaskDto, user?: AuthUser) {
    const variables: Record<string, unknown> = { ...(dto.variables ?? {}) };

    // Obtener datos de la tarea antes de validar y completarla
    const task = await this.findOne(id).catch(() => null);
    const taskDefKey = task?.taskDefinitionKey ?? '';

    const isExplicitRejectOrObserve =
      variables.decision === 'REJECT' ||
      variables.decision === 'OBSERVE' ||
      variables.aprobado === false ||
      variables.estadoDecision === 'RECHAZADO' ||
      variables.estadoDecision === 'OBSERVADO';

    const isExplicitApprove =
      variables.decision === 'APPROVE' ||
      variables.aprobado === true ||
      variables.estadoDecision === 'APROBADO';

    const inferredApprove: boolean | undefined = isExplicitRejectOrObserve
      ? false
      : isExplicitApprove
        ? true
        : undefined;

    const commentFallback =
      typeof variables.comentarios === 'string' && variables.comentarios.trim()
        ? variables.comentarios.trim()
        : undefined;

    if (taskDefKey === 'taskVerificarExistencias') {
      if (variables.aprobadoAlmacenes === undefined && inferredApprove !== undefined) {
        variables.aprobadoAlmacenes = inferredApprove;
      }
      if (!variables.obsAlmacenes && commentFallback) {
        variables.obsAlmacenes = commentFallback;
      }
      if (variables.hayExistencias === undefined) {
        variables.hayExistencias = false;
      }
    } else if (taskDefKey === 'taskVerificarPresupuesto') {
      if (variables.aprobadoPresupuesto === undefined && inferredApprove !== undefined) {
        variables.aprobadoPresupuesto = inferredApprove;
      }
      if (!variables.obsPresupuesto && commentFallback) {
        variables.obsPresupuesto = commentFallback;
      }
    } else if (taskDefKey === 'taskAprobacionSuperior') {
      if (variables.aprobadoSuperior === undefined && inferredApprove !== undefined) {
        variables.aprobadoSuperior = inferredApprove;
      }
      if (!variables.obsSuperior && commentFallback) {
        variables.obsSuperior = commentFallback;
      }
    } else if (taskDefKey === 'taskGafCat1' || taskDefKey === 'taskGafCat2') {
      if (variables.aprobadoGaf === undefined && inferredApprove !== undefined) {
        variables.aprobadoGaf = inferredApprove;
      }
      if (!variables.obsGaf && commentFallback) {
        variables.obsGaf = commentFallback;
      }
    } else if (taskDefKey === 'taskVoboFinanciero') {
      const valFin =
        typeof variables.aprobadoFinanciero === 'boolean'
          ? variables.aprobadoFinanciero
          : typeof variables.voboFinanciero === 'boolean'
            ? variables.voboFinanciero
            : inferredApprove;
      if (valFin !== undefined) {
        variables.voboFinanciero = valFin;
        variables.aprobadoFinanciero = valFin;
      }
      if (!variables.obsFinanciero && commentFallback) {
        variables.obsFinanciero = commentFallback;
      }
    } else if (taskDefKey === 'taskVoboLegal') {
      const valLegal =
        typeof variables.aprobadoLegal === 'boolean'
          ? variables.aprobadoLegal
          : typeof variables.voboLegal === 'boolean'
            ? variables.voboLegal
            : inferredApprove;
      if (valLegal !== undefined) {
        variables.voboLegal = valLegal;
        variables.aprobadoLegal = valLegal;
      }
      if (!variables.obsLegal && commentFallback) {
        variables.obsLegal = commentFallback;
      }
    } else if (
      taskDefKey === 'taskDecisionFinalCat1' ||
      taskDefKey === 'taskDecisionFinalCat2'
    ) {
      if (!variables.decisionFinal) {
        if (variables.decision === 'REJECT' || variables.estadoDecision === 'RECHAZADO') {
          variables.decisionFinal = 'RECHAZADO';
        } else if (
          variables.decision === 'OBSERVE' ||
          variables.estadoDecision === 'OBSERVADO'
        ) {
          variables.decisionFinal = 'OBSERVADO';
        } else if (inferredApprove === true) {
          variables.decisionFinal = 'APROBADO';
        }
      }
      if (!variables.justificacion && commentFallback) {
        variables.justificacion = commentFallback;
      }
    }

    await this.taskFormService.validateIfFormExists(id, variables);

    const result = await this.flowableService.completeTask<void>(id, variables);

    // Sincronizar y auto-asignar inmediatamente las siguientes tareas creadas tras completar esta etapa
    if (task && task.processInstanceId) {
      const procKey =
        task.processDefinitionId?.split(':')[0] || 'prGaf08Adquisiciones';
      await this.taskAssignments
        .syncProcessInstanceTasks(task.processInstanceId, procKey)
        .catch((err) =>
          this.logger.warn(
            `Error al sincronizar asignaciones de siguientes tareas: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );

      // Disparar notificaciones correspondientes según la normativa PR-GAF-08
      this.handleTaskCompletedNotifications(task, variables, user).catch((err) =>
        this.logger.warn(
          `Error en notificación al completar tarea [${task.name}]: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }

    return result;
  }

  private async handleTaskCompletedNotifications(
    task: WorkflowTask,
    completedVars: Record<string, unknown>,
    user?: AuthUser,
  ) {
    if (!task.processInstanceId) return;
    const processInstanceId: string = task.processInstanceId;

    try {
      // Obtener variables acumuladas de la instancia de proceso
      const instVars = await this.flowableService
        .getInstanceVariables<Array<{ name: string; value: unknown }>>(
          processInstanceId,
        )
        .catch(() => []);

      const varsMap: Record<string, unknown> = {};
      if (Array.isArray(instVars)) {
        for (const item of instVars) {
          varsMap[item.name] = item.value;
        }
      }
      // Sobrescribir con las variables recién enviadas
      Object.assign(varsMap, completedVars);

      const correlativo = String(
        varsMap.correlativo || varsMap.codigoTramite || varsMap.businessKey || processInstanceId,
      );
      const objetoContratacion = String(varsMap.objetoContratacion || '');
      const montoEstimadoBs = Number(varsMap.montoEstimadoBs || varsMap.montoTotal || 0);
      const categoria = String(varsMap.categoria || 'CATEGORIA_I');
      const solicitante = String(varsMap.solicitante || varsMap.iniciador || 'Unidad Solicitante');
      const solicitanteEmail = String(varsMap.solicitanteEmail || varsMap.iniciadorEmail || '');
      const encargadoContratacionUserId = String(
        varsMap.encargadoContratacionUserId || '',
      );

      const ctx = {
        processInstanceId,
        processDefinitionKey: 'prGaf08Adquisiciones',
        correlativo,
        objetoContratacion,
        montoEstimadoBs,
        categoria,
        solicitante,
        solicitanteEmail,
        taskDefinitionKey: task.taskDefinitionKey ?? undefined,
        taskName: task.name ?? undefined,
        comentarios: String(
          completedVars.comentarios ||
            completedVars.obsAlmacenes ||
            completedVars.obsPresupuesto ||
            completedVars.obsSuperior ||
            completedVars.obsFinanciero ||
            completedVars.obsLegal ||
            completedVars.obsGaf ||
            completedVars.justificacion ||
            '',
        ),
        decision: String(completedVars.decisionFinal || completedVars.decision || ''),
        comiteEvaluador: String(varsMap.comiteEvaluador || ''),
        responsableRecepcion: String(varsMap.responsableRecepcion || ''),
        encargadoContratacionUserId,
      };

      const taskKey = task.taskDefinitionKey;

      // 1. Verificación de Existencias o Presupuesto
      if (taskKey === 'taskVerificarExistencias' || taskKey === 'taskVerificarPresupuesto') {
        const alm = varsMap.aprobadoAlmacenes;
        const pre = varsMap.aprobadoPresupuesto;

        if (alm === false || pre === false) {
          await this.workflowNotifications.notifyObservacionIntermedia(
            ctx,
            'Verificación de Existencias / Presupuesto',
          );
        } else if (alm === true && pre === true) {
          await this.workflowNotifications.notifyVerificacionesCompletadas(ctx);
        }
      }

      // 2. Asignación de Encargado de Contratación
      else if (taskKey === 'taskAsignarEncargado') {
        await this.workflowNotifications.notifyEncargadoAsignado(ctx);
      }

      // 3. Revisión por Encargado -> Remisión a Superior
      else if (taskKey === 'taskRevisarSolicitud') {
        await this.workflowNotifications.notifyRemisionSuperior(ctx);
      }

      // 4. Aprobación Inmediato Superior
      else if (taskKey === 'taskAprobacionSuperior') {
        if (varsMap.aprobadoSuperior === false) {
          await this.workflowNotifications.notifyObservacionIntermedia(
            ctx,
            'Aprobación Inmediato Superior',
          );
        }
      }

      // 5. Vistos Buenos Financiero / Legal (Cat. II, III y Especial)
      else if (taskKey === 'taskVoboFinanciero' || taskKey === 'taskVoboLegal') {
        const fin = varsMap.aprobadoFinanciero ?? varsMap.voboFinanciero;
        const leg = varsMap.aprobadoLegal ?? varsMap.voboLegal;

        if (fin === false || leg === false) {
          await this.workflowNotifications.notifyObservacionIntermedia(
            ctx,
            'Vistos Buenos Financiero / Legal',
          );
        } else if (fin === true && leg === true) {
          await this.workflowNotifications.notifyVobosCompletados(ctx);
        }
      }

      // 6. Revisión GAF
      else if (taskKey === 'taskGafCat1' || taskKey === 'taskGafCat2') {
        if (varsMap.aprobadoGaf === false) {
          await this.workflowNotifications.notifyObservacionIntermedia(
            ctx,
            'Revisión Gerencia Administrativa Financiera',
          );
        }
      }

      // 7. Decisión Final (Gerente de Área o Gerente General)
      else if (taskKey === 'taskDecisionFinalCat1' || taskKey === 'taskDecisionFinalCat2') {
        await this.workflowNotifications.notifyDecisionFinal(ctx);
      }
    } catch (err) {
      this.logger.warn(
        `Error procesando notificaciones posteriores a la tarea: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getVariables(id: string): Promise<Record<string, unknown>> {
    try {
      const vars = await this.flowableService.getTaskVariables<
        Array<{ name: string; value: unknown }>
      >(id);

      const map: Record<string, unknown> = {};
      if (Array.isArray(vars)) {
        for (const v of vars) {
          map[v.name] = v.value;
        }
      }
      return map;
    } catch {
      return {};
    }
  }
}
