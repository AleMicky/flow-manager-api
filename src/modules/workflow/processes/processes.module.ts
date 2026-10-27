
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowProcess } from './entities/workflow-process.entity.js';
import { ProcessesController } from './processes.controller.js';
import { ProcessesService } from './processes.service.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([WorkflowProcess]),
    ],
    controllers: [ProcessesController],
    providers: [ProcessesService],
    exports: [ProcessesService],
})
export class ProcessesModule { }
