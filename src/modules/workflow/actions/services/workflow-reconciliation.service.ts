
import {
    ConflictException,
    Injectable,
    Logger,
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
    private readonly logger = new Logger(WorkflowReconciliationService.name);

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
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.logger.error(
                    `Error consultando historial en Flowable para tarea ${execution.taskId}: ${errorMsg}`,
                    error instanceof Error ? error.stack : undefined,
                );
                throw new ConflictException(
                    `No se pudo confirmar el historial de Flowable: ${errorMsg}`,
                );
            }

            if (historic.id !== execution.taskId || historic.processInstanceId !== execution.processInstanceId) {
                throw new ConflictException(
                    'Los identificadores de la tarea o proceso no coinciden con la ejecución',
                );
            }

            if (historic.assignee !== execution.executedBy) {
                throw new ConflictException(
                    'El usuario asignado en Flowable no coincide con quien ejecutó la acción',
                );
            }

            if (historic.deleteReason) {
                throw new ConflictException(
                    `La tarea fue cancelada o eliminada en Flowable (motivo: ${historic.deleteReason})`,
                );
            }

            if (!historic.endTime) {
                throw new ConflictException(
                    'La tarea aún no ha finalizado en el motor Flowable',
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
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Error al sincronizar negocio en reconciliación para ejecución ${id}: ${errorMsg}`,
                error instanceof Error ? error.stack : undefined,
            );

            await this.executions.setStatus(
                id,
                Status.RECONCILIATION_REQUIRED,
                `La sincronización de negocio requiere revisión: ${errorMsg}`,
            );

            throw new ConflictException(
                `No se pudo sincronizar el negocio: ${errorMsg}`,
            );
        }
    }
}
