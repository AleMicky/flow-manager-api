import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { WorkflowAction } from './entities/workflow-action.entity.js';
import { ActionsController } from './actions.controller.js';
import { ActionsService } from './actions.service.js';
import { TaskActionExecutor } from './executors/task-action.executor.js';
import { FormsModule } from '../forms/forms.module.js';
import { TasksModule } from '../tasks/tasks.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowAction]),
    FlowableModule, FormsModule, TasksModule],
  controllers: [ActionsController],
  providers: [ActionsService, TaskActionExecutor],
  exports: [ActionsService, TaskActionExecutor],
})
export class ActionsModule { }
