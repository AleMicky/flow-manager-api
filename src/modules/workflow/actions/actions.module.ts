import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { WorkflowAction } from './entities/workflow-action.entity.js';
import { ActionsController } from './actions.controller.js';
import { ActionsService } from './actions.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowAction]),
    FlowableModule,
  ],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule { }
