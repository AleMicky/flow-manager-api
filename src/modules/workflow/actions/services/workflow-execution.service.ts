
import {
    ConflictException,
    Injectable,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
    WorkflowActionExecution,
    WorkflowExecutionStatus,
} from '../entities/workflow-action-execution.entity.js';

@Injectable()
export class WorkflowExecutionService {
    constructor(
        @InjectRepository(WorkflowActionExecution)
        private readonly repository: Repository<WorkflowActionExecution>,
    ) { }

    async create(data: {
        taskId: string;
        actionId: string;
        processInstanceId: string;
        executedBy: string;
        businessStatus: string | null;
    }) {
        const existing = await this.repository.findOneBy({
            taskId: data.taskId,
        });

        if (existing) {
            throw new ConflictException(
                'Ya existe un intento de ejecución para esta tarea',
            );
        }

        const execution = this.repository.create({
            ...data,
            status: WorkflowExecutionStatus.PENDING,
        });

        try {
            return await this.repository.save(execution);
        } catch (error) {
            // La restricción UNIQUE(taskId) también evita
            // solicitudes simultáneas.
            if (
                typeof error === 'object' &&
                error !== null &&
                'driverError' in error &&
                (error.driverError as { code?: string })?.code === '23505'
            ) {
                throw new ConflictException(
                    'Esta tarea ya tiene una ejecución registrada',
                );
            }

            throw error;
        }
    }

    async setStatus(
        id: string,
        status: WorkflowExecutionStatus,
        errorMessage?: string,
    ) {
        await this.repository.update(id, {
            status,
            errorMessage: errorMessage ?? null,
        });
    }

    findPending() {
        return this.repository.find({
            where: [
                { status: WorkflowExecutionStatus.PENDING },
                { status: WorkflowExecutionStatus.ENGINE_COMPLETED },
                {
                    status:
                        WorkflowExecutionStatus.RECONCILIATION_REQUIRED,
                },
            ],
            order: {
                createdAt: 'ASC',
            },
        });
    }


    async markSynchronized(id: string) {
        await this.setStatus(
            id,
            WorkflowExecutionStatus.SYNCED,
        );
    }

    async getById(id: string) {
        return this.repository.findOneByOrFail({ id });
    }

}
