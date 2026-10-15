
import {
    ConflictException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';

import type { AuthUser } from '../../../auth/interfaces/auth-user.interface.js';

export interface FlowableTask {
    id: string;
    name: string;
    assignee: string | null;
    processInstanceId: string | null;
    processDefinitionId: string | null;
    taskDefinitionKey: string | null;
}

interface IdentityLink {
    type: string;
    userId: string | null;
    groupId: string | null;
}

@Injectable()
export class TaskAuthorizationService {
    constructor(
        private readonly flowable: FlowableService,
    ) { }

    private async getTask(
        taskId: string,
    ): Promise<FlowableTask> {
        return this.flowable.getTaskById<FlowableTask>(taskId);
    }

    private async isCandidate(
        taskId: string,
        user: AuthUser,
    ): Promise<boolean> {
        const links =
            await this.flowable.getTaskIdentityLinks<
                IdentityLink[]
            >(taskId);

        return links.some((link) => {
            if (link.type !== 'candidate') {
                return false;
            }

            if (link.userId === user.id) {
                return true;
            }

            return (
                link.groupId !== null &&
                user.roles.includes(link.groupId)
            );
        });
    }

    async claim(
        taskId: string,
        user: AuthUser,
    ): Promise<FlowableTask> {
        const task = await this.getTask(taskId);

        if (task.assignee === user.id) {
            return task;
        }

        if (task.assignee) {
            throw new ConflictException(
                'La tarea ya fue reclamada por otro usuario',
            );
        }

        const allowed = await this.isCandidate(
            taskId,
            user,
        );

        if (!allowed) {
            throw new ForbiddenException(
                'No eres candidato para esta tarea',
            );
        }

        // Flowable realiza la reclamación.
        // Si otro usuario se adelanta, debe devolver 409.
        await this.flowable.claimTask<unknown>(
            taskId,
            user.id,
        );

        return this.getTask(taskId);
    }

    async unclaim(
        taskId: string,
        user: AuthUser,
    ): Promise<void> {
        const task = await this.getTask(taskId);

        if (task.assignee !== user.id) {
            throw new ForbiddenException(
                'Solo el asignado puede liberar la tarea',
            );
        }

        await this.flowable.unclaimTask<unknown>(taskId);
    }

    async assertCanExecute(
        taskId: string,
        user: AuthUser,
    ): Promise<FlowableTask> {
        const task = await this.getTask(taskId);

        if (task.assignee !== user.id) {
            throw new ForbiddenException(
                'Debes reclamar la tarea antes de ejecutarla',
            );
        }

        return task;
    }
}
