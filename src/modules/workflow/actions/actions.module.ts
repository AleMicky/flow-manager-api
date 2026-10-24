import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { WorkflowAction } from './entities/workflow-action.entity.js';
import { ActionsController } from './actions.controller.js';
import { ActionsService } from './actions.service.js';
import { TaskActionExecutor } from './executors/task-action.executor.js';
import { FormsModule } from '../forms/forms.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { WorkflowActionExecution } from './entities/workflow-action-execution.entity.js';

import { WorkflowExecutionService } from './services/workflow-execution.service.js';
import { WorkflowBusinessSyncService } from './services/workflow-business-sync.service.js';
import { WorkflowReconciliationService } from './services/workflow-reconciliation.service.js';
import { WorkflowReconciliationController } from './workflow-reconciliation.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowAction, WorkflowActionExecution]),
    FlowableModule,
    FormsModule,
    TasksModule,
  ],
  controllers: [
    ActionsController,
    WorkflowReconciliationController
  ],
  providers: [
    ActionsService,
    TaskActionExecutor,
    WorkflowExecutionService,
    WorkflowBusinessSyncService,
    WorkflowReconciliationService
  ],
  exports: [
    ActionsService,
    TaskActionExecutor,
    WorkflowExecutionService,
  ],
})
export class ActionsModule { }
