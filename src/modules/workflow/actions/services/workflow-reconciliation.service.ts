
import {
    ConflictException,
    Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../infrastructure/flowable/flowable.service.js';

import { WorkflowExecutionService } from './workflow-execution.service.js';
import { WorkflowBusinessSyncService } from './workflow-business-sync.service.js';

import { WorkflowExecutionStatus as Status } from '../entities/workflow-action-execution.entity.js';

interface HistoricTask {
    id: string;
    processInstanceId: string | null;
    assignee: string | null;
    endTime: string | null;
    deleteReason: string | null;
}

@Injectable()
export class WorkflowReconciliationService {
    constructor(
        private readonly executions: WorkflowExecutionService,
        private readonly businessSync: WorkflowBusinessSyncService,
        private readonly flowable: FlowableService,
    ) { }

    findPending() {
        return this.executions.findPending();
    }

    async reconcile(id: string) {
        const execution = await this.executions.findOne(id);

        if (execution.status === Status.SYNCED) {
            return {
                executionId: id,
                status: Status.SYNCED,
            };
        }

        if (
            execution.status === Status.PENDING ||
            execution.status === Status.RECONCILIATION_REQUIRED
        ) {
            let historic: HistoricTask;

            try {
                historic =
                    await this.flowable.getHistoricTaskById<HistoricTask>(
                        execution.taskId,
                    );
            } catch {
                throw new ConflictException(
                    'No se pudo confirmar el historial de Flowable',
                );
            }

            if (
                historic.id !== execution.taskId ||
                historic.processInstanceId !==
                execution.processInstanceId ||
                historic.assignee !== execution.executedBy ||
                !historic.endTime ||
                historic.deleteReason
            ) {
                throw new ConflictException(
                    'No se ha confirmado una finalización normal de la tarea',
                );
            }

            // Esta verificación confirma que la tarea terminó,
            // pero no demuestra por sí sola qué acción la completó.
            // Solo puede promoverse automáticamente cuando todas
            // las ejecuciones pasan por nuestro ejecutor protegido.
            await this.executions.setStatus(
                id,
                Status.ENGINE_COMPLETED,
            );
        }

        const current = await this.executions.findOne(id);

        if (current.status !== Status.ENGINE_COMPLETED) {
            throw new ConflictException(
                'La ejecución no está lista para sincronizar',
            );
        }

        try {
            await this.businessSync.synchronize(
                current.processInstanceId,
                current.businessStatus,
            );

            await this.executions.setStatus(
                id,
                Status.SYNCED,
            );

            return {
                executionId: id,
                status: Status.SYNCED,
                synchronized: true,
            };
        } catch {
            await this.executions.setStatus(
                id,
                Status.RECONCILIATION_REQUIRED,
                'La sincronización de negocio requiere revisión',
            );

            throw new ConflictException(
                'No se pudo sincronizar el negocio',
            );
        }
    }
}
