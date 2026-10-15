
import {
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';
import type { AuthUser } from '../../../auth/interfaces/auth-user.interface.js';

interface FlowableTask {
    id: string;
    assignee: string | null;
    processInstanceId: string | null;
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

    async assertCanExecute(
        taskId: string,
        user: AuthUser,
    ): Promise<FlowableTask> {
        const task =
            await this.flowable.getTaskById<FlowableTask>(taskId);

        // Identificador que ambos sistemas deben compartir.
        const userId = user.id;

        // Si la tarea está asignada, solo su responsable
        // puede ejecutarla.
        if (task.assignee) {
            if (task.assignee !== userId) {
                throw new ForbiddenException(
                    'La tarea está asignada a otro usuario',
                );
            }

            return task;
        }

        // Consultar candidatos de Flowable.
        const links =
            await this.flowable.getTaskIdentityLinks<
                IdentityLink[]
            >(taskId);

        const candidateUser = links.some(
            (link) =>
                link.type === 'candidate' &&
                link.userId === userId,
        );

        // Requiere que los grupos de Flowable coincidan
        // con los roles de cliente de Keycloak.
        const candidateGroup = links.some(
            (link) =>
                link.type === 'candidate' &&
                link.groupId !== null &&
                user.roles.includes(link.groupId),
        );

        if (!candidateUser && !candidateGroup) {
            throw new ForbiddenException(
                'No estás autorizado para ejecutar esta tarea',
            );
        }

        return task;
    }
}
