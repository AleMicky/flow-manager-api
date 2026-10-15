import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';
import { ActionsService } from '../actions.service.js';
import { ExecuteActionDto } from '../dto/execute-action.dto.js';
import { TaskFormService } from '../../forms/services/task-form.service.js';

interface FlowableTask {
  id: string;
  name: string;
  assignee: string | null;
  processDefinitionId: string;
  processInstanceId: string;
  taskDefinitionKey: string;
}

@Injectable()
export class TaskActionExecutor {
  constructor(
    private readonly flowable: FlowableService,
    private readonly actions: ActionsService,
    private readonly taskFormService: TaskFormService,

  ) { }


  async execute(
    taskId: string,
    actionId: string,
    dto: ExecuteActionDto,
  ) {
    const task =
      await this.flowable.getTaskById<FlowableTask>(taskId);

    if (!task.processDefinitionId || !task.taskDefinitionKey) {
      throw new BadRequestException(
        'La tarea no pertenece a un proceso BPMN válido',
      );
    }

    const action = await this.actions.findOne(actionId);

    if (!action.active) {
      throw new ConflictException(
        'La acción está deshabilitada',
      );
    }

    if (
      action.processDefinitionId !== task.processDefinitionId ||
      action.taskDefinitionKey !== task.taskDefinitionKey
    ) {
      throw new BadRequestException(
        'La acción no corresponde a esta tarea',
      );
    }

    const formData = dto.variables ?? {};

    // Validar los datos del usuario, sin incluir
    // las variables de decisión configuradas.
    await this.taskFormService.validateOrThrow(
      taskId,
      formData,
    );

    // La configuración de la acción tiene prioridad.
    const variables = {
      ...formData,
      ...action.variables,
    };

    await this.flowable.completeTask<void>(
      taskId,
      variables,
    );

    return {
      taskId,
      processInstanceId: task.processInstanceId,
      action: action.code,
      completed: true,
    };
  }

}
