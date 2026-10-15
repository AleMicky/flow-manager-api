import { Module } from '@nestjs/common';
import { InstancesModule } from './instances/instances.module.js';
import { DefinitionsModule } from './definitions/definitions.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { HistoryModule } from './history/history.module.js';
import { FlowableModule } from './infrastructure/flowable/flowable.module.js';
import { ActionsModule } from './actions/actions.module.js';

@Module({
  imports: [
    InstancesModule,
    DefinitionsModule,
    TasksModule,
    HistoryModule,
    FlowableModule,
    ActionsModule,
  ],
  exports: [
    DefinitionsModule,
    InstancesModule,
    TasksModule,
    HistoryModule,
  ],
})
export class WorkflowModule { }
