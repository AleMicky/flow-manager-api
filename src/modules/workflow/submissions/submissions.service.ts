
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ajv } from 'ajv';
import ajvFormats from 'ajv-formats';

// ajv-formats is CommonJS and only has a default export; under NodeNext ESM
// the default import is the whole module.exports, so the plugin lives on `.default`.
const addFormats = ajvFormats.default;
type AjvInstance = Ajv;

import { FlowableService } from '../infrastructure/flowable/flowable.service.js';
import { ProcessesService } from '../processes/processes.service.js';

import {
    WorkflowSubmission,
    WorkflowSubmissionStatus,
} from './entities/workflow-submission.entity.js';

import { StartSubmissionDto } from './dto/start-submission.dto.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

interface StartedProcess {
    id: string;
    processDefinitionId?: string;
}

@Injectable()
export class SubmissionsService {
    private readonly ajv: AjvInstance;

    constructor(
        @InjectRepository(WorkflowSubmission)
        private readonly repository: Repository<WorkflowSubmission>,
        private readonly processes: ProcessesService,
        private readonly flowable: FlowableService,
    ) {
        this.ajv = new Ajv({
            allErrors: true,
            strict: true,
            coerceTypes: false,
        });

        addFormats(this.ajv);
    }

    async start(
        processId: string,
        dto: StartSubmissionDto,
        user: AuthUser,
    ) {
        const process = await this.processes.findOne(
            processId,
        );

        if (!process.active) {
            throw new BadRequestException(
                'El proceso no está habilitado',
            );
        }

        const validate = this.ajv.compile(
            process.startFormSchema,
        );

        if (!validate(dto.data)) {
            throw new BadRequestException({
                message: 'Formulario de inicio inválido',
                errors: validate.errors,
            });
        }

        // Primero creamos el expediente local.
        const submission = await this.repository.save(
            this.repository.create({
                processId: process.id,
                title: dto.title,
                data: dto.data,
                startedBy: user.id,
                processInstanceId: null,
                processDefinitionId: null,
                status: WorkflowSubmissionStatus.PENDING_START,
            }),
        );

        try {
            // El identificador del expediente sirve
            // como businessKey para correlacionar sistemas.
            const instance =
                await this.flowable.startProcess<StartedProcess>(
                    process.processDefinitionKey,
                    {
                        ...dto.data,
                        submissionId: submission.id,
                        startedBy: user.id,
                    },
                    submission.id,
                );

            if (!instance.id) {
                throw new Error(
                    'Flowable no devolvió el identificador de instancia',
                );
            }

            submission.processInstanceId = instance.id;
            submission.processDefinitionId =
                instance.processDefinitionId ?? null;
            submission.status =
                WorkflowSubmissionStatus.IN_PROGRESS;

            await this.repository.save(submission);

            return submission;
        } catch {
            // Una interrupción de red puede ocurrir después
            // de que Flowable haya creado la instancia.
            // No arrancamos otro proceso automáticamente.
            submission.status =
                WorkflowSubmissionStatus.START_FAILED;
            submission.errorMessage =
                'No se pudo confirmar el inicio en Flowable';

            await this.repository.save(submission);

            return submission;
        }
    }

    findMine(user: AuthUser) {
        return this.repository.find({
            where: { startedBy: user.id },
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string, user: AuthUser) {
        const submission = await this.repository.findOneBy({
            id,
        });

        if (!submission) {
            throw new NotFoundException(
                'Expediente no encontrado',
            );
        }

        if (
            submission.startedBy !== user.id &&
            !user.roles.includes('workflow-admin')
        ) {
            throw new ForbiddenException(
                'No tienes acceso a este expediente',
            );
        }

        return submission;
    }
}
