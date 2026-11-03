import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowProcess } from './entities/workflow-process.entity.js';
import { WorkflowCorrelative } from './entities/workflow-correlative.entity.js';
import { ProcessesController } from './processes.controller.js';
import { ProcessesService } from './processes.service.js';
import { CorrelativesService } from './correlatives.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowProcess, WorkflowCorrelative]),
  ],
  controllers: [ProcessesController],
  providers: [ProcessesService, CorrelativesService],
  exports: [ProcessesService, CorrelativesService],
})
export class ProcessesModule {}
