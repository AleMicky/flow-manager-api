import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller.js';
import { InstancesService } from './instances.service.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { ProcessesModule } from '../processes/processes.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { NotificationsModule } from '../../notifications/notifications.module.js';

@Module({
  imports: [FlowableModule, ProcessesModule, TasksModule, NotificationsModule],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
