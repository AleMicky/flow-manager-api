
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';

import { TaskAuthorizationService } from '../../tasks/services/task-authorization.service.js';

import { TaskFormService } from '../../forms/services/task-form.service.js';

import { ActionsService } from '../actions.service.js';
import { ExecuteActionDto } from '../dto/execute-action.dto.js';

import type { AuthUser } from '../../../auth/interfaces/auth-user.interface.js';

@Injectable()
export class TaskActionExecutor {
  constructor(
    private readonly flowable: FlowableService,
    private readonly actions: ActionsService,
    private readonly authorization: TaskAuthorizationService,
    private readonly taskForm: TaskFormService,
  ) { }

  async execute(
    taskId: string,
    actionId: string,
    dto: ExecuteActionDto,
    user: AuthUser,
  ) {
    const task =
      await this.authorization.assertCanExecute(
        taskId,
        user,
      );

    if (
      !task.processDefinitionId ||
      !task.taskDefinitionKey
    ) {
      throw new BadRequestException(
        'La tarea no corresponde a una definición BPMN',
      );
    }

    const action = await this.actions.findOne(actionId);

    if (!action.active) {
      throw new ConflictException(
        'La acción está deshabilitada',
      );
    }

    if (
      action.processDefinitionId !==
      task.processDefinitionId ||
      action.taskDefinitionKey !==
      task.taskDefinitionKey
    ) {
      throw new BadRequestException(
        'La acción no pertenece a esta tarea',
      );
    }

    const formData = dto.variables ?? {};

    await this.taskForm.validateOrThrow(
      taskId,
      formData,
    );

    const variables: Record<string, unknown> = {
      ...formData,
      ...action.variables,
    };

    // Segunda comprobación antes de completar.
    await this.authorization.assertCanExecute(
      taskId,
      user,
    );

    await this.flowable.completeTask<unknown>(
      taskId,
      variables,
    );

    return {
      taskId,
      processInstanceId: task.processInstanceId,
      actionId: action.id,
      action: action.code,
      completed: true,
    };
  }
}
