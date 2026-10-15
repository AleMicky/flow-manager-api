
import {
    BadRequestException,
    ConflictException,
    Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';
import { ActionsService } from '../actions.service.js';
import { ExecuteActionDto } from '../dto/execute-action.dto.js';

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
    ) { }

    async execute(
        taskId: string,
        actionId: string,
        dto: ExecuteActionDto,
    ) {
        const task = await this.flowable.getTaskById<FlowableTask>(
            taskId,
        );

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
                'La acción no corresponde a esta tarea BPMN',
            );
        }

        const variables = {
            ...(dto.variables ?? {}),
            ...action.variables,
        };

        await this.flowable.completeTask<void>(
            task.id,
            variables,
        );

        return {
            taskId: task.id,
            processInstanceId: task.processInstanceId,
            action: action.code,
            completed: true,
        };
    }
}
