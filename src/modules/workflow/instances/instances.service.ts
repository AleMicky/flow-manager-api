import { Injectable, Logger } from '@nestjs/common';
import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { CorrelativesService } from '../processes/correlatives.service.js';
import { TaskAssignmentsService } from '../tasks/services/task-assignments.service.js';
import { WorkflowNotificationsService } from '../../notifications/workflow-notifications.service.js';
import { StartProcessDto } from './dto/start-process.dto.js';
import { QueryInstancesDto } from './dto/query-instances.dto.js';

import type {
  FlowablePage,
  ProcessInstance,
} from './interfaces/process-instance.interface.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

@Injectable()
export class InstancesService {
  private readonly logger = new Logger(InstancesService.name);

  constructor(
    private readonly flowable: FlowableService,
    private readonly correlativesService: CorrelativesService,
    private readonly taskAssignments: TaskAssignmentsService,
    private readonly workflowNotifications: WorkflowNotificationsService,
  ) {}

  async findAll(query: QueryInstancesDto, user?: AuthUser) {
    const isAdmin = user?.roles?.some((r: string) =>
      ['workflow-admin', 'admin', 'realm-admin', 'superadmin'].includes(r),
    );

    // Si NO es admin, filtrar estrictamente por su usuario
    let effectiveStartedBy = query.startedBy;
    if (!isAdmin && user) {
      effectiveStartedBy = user.username || user.id;
    }

    const flowableParams: Record<string, unknown> = {
      start: query.start,
      size: query.size,
      ...(query.processDefinitionKey && {
        processDefinitionKey: query.processDefinitionKey,
      }),
      ...(query.businessKey && {
        businessKey: query.businessKey,
      }),
      ...(effectiveStartedBy && {
        startedBy: effectiveStartedBy,
      }),
    };

    return this.flowable.getInstancesFiltered<FlowablePage<ProcessInstance>>(flowableParams);
  }

  findOne(id: string) {
    return this.flowable.getInstanceById<ProcessInstance>(id);
  }

  async start(dto: StartProcessDto, user?: AuthUser) {
    // Generación 100% automática del correlativo oficial secuencial (ej: ADQ-001/2026)
    const correlativo = await this.correlativesService.generateNextCorrelative(
      dto.processDefinitionKey,
    );

    const variables = { ...(dto.variables ?? {}) };
    variables.correlativo = correlativo;
    variables.codigoTramite = correlativo;
    variables.businessKey = correlativo;

    const startUserName = user?.name || user?.username || 'Usuario';
    const startUserId = user?.username || user?.id;

    if (startUserId) {
      variables.startUserId = startUserId;
      variables.iniciador = startUserName;
      variables.iniciadorUsername = user?.username;
      variables.iniciadorId = user?.id;
      variables.registradoPor = startUserName;
      variables.solicitante = startUserName;
    }

    if (dto.processDefinitionKey === 'prGaf08Adquisiciones') {
      if (variables.montoEstimadoBs === undefined) {
        variables.montoEstimadoBs = Number(variables.montoTotal || variables.monto || 0);
      }
      if (!variables.categoria) {
        const monto = Number(variables.montoEstimadoBs) || 0;
        variables.categoria = monto <= 150000 ? 'CATEGORIA_I' : 'CATEGORIA_II';
      }
      if (variables.aprobadoAlmacenes === undefined) {
        variables.aprobadoAlmacenes = false;
      }
      if (variables.aprobadoPresupuesto === undefined) {
        variables.aprobadoPresupuesto = false;
      }
      if (variables.aprobadoSuperior === undefined) {
        variables.aprobadoSuperior = false;
      }
    }

    this.logger.log(
      `Iniciando proceso [${dto.processDefinitionKey}] iniciado por [${startUserName}] con correlativo automático asignado: ${correlativo}`,
    );

    const instance = await this.flowable.startProcess<ProcessInstance>(
      dto.processDefinitionKey,
      variables,
      correlativo,
      startUserId,
    );

    // Sincronizar inmediatamente los IdentityLinks de las tareas iniciales (ej. Verificación existencias y presupuesto en paralelo)
    if (instance?.id) {
      await this.taskAssignments.syncProcessInstanceTasks(
        instance.id,
        dto.processDefinitionKey,
      );

      // Notificación institucional por correo electrónico según normativa PR-GAF-08
      if (dto.processDefinitionKey === 'prGaf08Adquisiciones') {
        this.workflowNotifications
          .notifyProcessStarted({
            processInstanceId: instance.id,
            processDefinitionKey: dto.processDefinitionKey,
            correlativo,
            objetoContratacion: String(variables.objetoContratacion || ''),
            montoEstimadoBs: Number(variables.montoEstimadoBs || 0),
            categoria: String(variables.categoria || ''),
            solicitante: startUserName,
            solicitanteEmail: user?.email,
          })
          .catch((err) =>
            this.logger.warn(
              `Error al disparar notificación de inicio: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
    }

    return instance;
  }

  remove(id: string) {
    return this.flowable.deleteInstance(id, 'Cancelado desde Flow Manager');
  }

  async getDiagram(id: string): Promise<{ data: Buffer; contentType: string }> {
    try {
      return await this.flowable.getInstanceDiagram(id);
    } catch (err) {
      this.logger.debug(
        `No se pudo obtener diagrama en runtime para instancia ${id}, intentando imagen de definición: ${err instanceof Error ? err.message : String(err)}`,
      );
      const instance = await this.findOne(id).catch(() => null);
      if (instance?.processDefinitionId) {
        return await this.flowable.getDefinitionImage(
          instance.processDefinitionId,
        );
      }
      throw err;
    }
  }

  async getVariables(instanceId: string): Promise<Record<string, unknown>> {
    let vars: Array<{
      name?: string;
      value?: unknown;
      variable?: { name: string; value: unknown };
    }> = [];

    try {
      vars = await this.flowable.getInstanceVariables(instanceId);
    } catch {
      try {
        const hist = (await this.flowable.getHistoricVariables(instanceId)) as
          | { data?: typeof vars }
          | typeof vars;
        if (hist && Array.isArray((hist as { data?: typeof vars }).data)) {
          vars = (hist as { data: typeof vars }).data;
        } else if (Array.isArray(hist)) {
          vars = hist;
        } else {
          vars = [];
        }
      } catch {
        vars = [];
      }
    }

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
  }
}
