
import {
    ConflictException,
    Injectable,
} from '@nestjs/common';

import { WorkflowExecutionService } from './workflow-execution.service.js';
import { WorkflowBusinessSyncService } from './workflow-business-sync.service.js';

import { WorkflowExecutionStatus } from '../entities/workflow-action-execution.entity.js';

@Injectable()
export class WorkflowReconciliationService {
    constructor(
        private readonly executions: WorkflowExecutionService,
        private readonly businessSync: WorkflowBusinessSyncService,
    ) { }

    findPending() {
        return this.executions.findPending();
    }

    async retrySynchronizedBusiness(executionId: string) {
        const execution =
            await this.executions.getById(executionId);

        if (
            execution.status !==
            WorkflowExecutionStatus.ENGINE_COMPLETED
        ) {
            throw new ConflictException(
                'Primero debe confirmarse que Flowable completó la tarea',
            );
        }

        await this.businessSync.synchronize(
            execution.processInstanceId,
            execution.businessStatus,
        );

        await this.executions.markSynchronized(
            execution.id,
        );

        return {
            executionId: execution.id,
            synchronized: true,
        };
    }
}
