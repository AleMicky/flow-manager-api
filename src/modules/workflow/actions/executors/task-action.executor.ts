
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';

import { TaskAuthorizationService } from '../../tasks/services/task-authorization.service.js';

import { TaskFormService } from '../../forms/services/task-form.service.js';

import { ActionsService } from '../actions.service.js';
import { ExecuteActionDto } from '../dto/execute-action.dto.js';

import type { AuthUser } from '../../../auth/interfaces/auth-user.interface.js';

import { WorkflowExecutionService } from '../services/workflow-execution.service.js';

import { WorkflowBusinessSyncService } from '../services/workflow-business-sync.service.js';

import { WorkflowExecutionStatus } from '../entities/workflow-action-execution.entity.js';

@Injectable()
export class TaskActionExecutor {
  private readonly logger = new Logger(TaskActionExecutor.name);

  constructor(
    private readonly flowable: FlowableService,
    private readonly actions: ActionsService,
    private readonly authorization: TaskAuthorizationService,
    private readonly taskForm: TaskFormService,
    private readonly executions: WorkflowExecutionService,
    private readonly businessSync: WorkflowBusinessSyncService,
  ) { }

  async execute(
    taskId: string,
    actionId: string,
    dto: ExecuteActionDto,
    user: AuthUser,
  ) {
    // 1. Verificar que el usuario pueda ejecutar la tarea.
    const task = await this.authorization.assertCanExecute(
      taskId,
      user,
    );

    if (
      !task.processDefinitionId ||
      !task.taskDefinitionKey ||
      !task.processInstanceId
    ) {
      throw new BadRequestException(
        'La tarea no pertenece a un proceso BPMN válido',
      );
    }

    // 2. Obtener la acción configurada.
    const action = await this.actions.findOne(actionId);

    if (!action.active) {
      throw new ConflictException(
        'La acción está deshabilitada',
      );
    }

    // 3. Comprobar que la acción corresponda a esta tarea.
    if (
      action.processDefinitionId !== task.processDefinitionId ||
      action.taskDefinitionKey !== task.taskDefinitionKey
    ) {
      throw new BadRequestException(
        'La acción no corresponde a esta tarea BPMN',
      );
    }

    // 4. Validar datos del formulario mediante Ajv.
    const formData = dto.variables ?? {};

    await this.taskForm.validateOrThrow(
      taskId,
      formData,
    );

    // 5. Combinar datos del formulario con variables
    // configuradas para la acción.
    // Las variables de la acción tienen prioridad.
    const variables: Record<string, unknown> = {
      ...formData,
      ...action.variables,
    };

    // 6. Registrar la intención de ejecutar la tarea.
    const execution = await this.executions.create({
      taskId,
      actionId: action.id,
      processInstanceId: task.processInstanceId,
      executedBy: user.id,
      businessStatus: action.businessStatus ?? null,
    });

    // 7. Ejecutar la tarea en Flowable.
    try {
      await this.flowable.completeTask<unknown>(
        taskId,
        variables,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al completar tarea ${taskId} en Flowable: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Puede que Flowable haya completado la tarea
      // pero NestJS no recibiera la respuesta.
      await this.executions.setStatus(
        execution.id,
        WorkflowExecutionStatus.RECONCILIATION_REQUIRED,
        `Fallo al completar en Flowable: ${errorMsg}`,
      );

      throw error;
    }

    // 8. Registrar que Flowable completó la tarea.
    await this.executions.setStatus(
      execution.id,
      WorkflowExecutionStatus.ENGINE_COMPLETED,
    );

    // 9. Sincronizar estado con PostgreSQL.
    try {
      await this.businessSync.synchronize(
        task.processInstanceId,
        action.businessStatus ?? null,
      );

      await this.executions.setStatus(
        execution.id,
        WorkflowExecutionStatus.SYNCED,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al sincronizar estado de negocio para proceso ${task.processInstanceId}: ${errorMsg}`,
        error instanceof Error ? error.stack : undefined,
      );

      // La tarea terminó en Flowable, pero falló
      // la actualización del negocio.
      await this.executions.setStatus(
        execution.id,
        WorkflowExecutionStatus.RECONCILIATION_REQUIRED,
        `Fallo al sincronizar negocio: ${errorMsg}`,
      );

      return {
        executionId: execution.id,
        taskId,
        processInstanceId: task.processInstanceId,
        action: action.code,
        completed: true,
        synchronized: false,
        reconciliationRequired: true,
      };
    }

    // 10. Resultado de ejecución exitosa.
    return {
      executionId: execution.id,
      taskId,
      processInstanceId: task.processInstanceId,
      actionId: action.id,
      action: action.code,
      completed: true,
      synchronized: true,
      reconciliationRequired: false,
    };
  }
}
