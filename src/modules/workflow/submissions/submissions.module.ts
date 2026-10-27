
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowSubmission } from './entities/workflow-submission.entity.js';

import { ProcessesModule } from '../processes/processes.module.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';

import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([WorkflowSubmission]),
        ProcessesModule,
        FlowableModule,
    ],
    controllers: [SubmissionsController],
    providers: [SubmissionsService],
    exports: [SubmissionsService],
})
export class SubmissionsModule { }
