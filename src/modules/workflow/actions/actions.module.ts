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
import { SolicitudesModule } from '../../compras/solicitudes/solicitudes.module.js';
import { WorkflowExecutionService } from './services/workflow-execution.service.js';
import { WorkflowBusinessSyncService } from './services/workflow-business-sync.service.js';
import { WorkflowReconciliationService } from './services/workflow-reconciliation.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowAction, WorkflowActionExecution]),
    FlowableModule, FormsModule, TasksModule, SolicitudesModule],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    TaskActionExecutor,
    WorkflowExecutionService,
    WorkflowBusinessSyncService,
    WorkflowExecutionService,
    WorkflowReconciliationService
  ],
  exports: [
    ActionsService,
    TaskActionExecutor,
    WorkflowExecutionService,
  ],
})
export class ActionsModule { }
