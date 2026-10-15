import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { TaskAuthorizationService } from './services/task-authorization.service.js';

@Module({
  imports: [FlowableModule, AuthModule],
  controllers: [TasksController],
  providers: [TasksService, TaskAuthorizationService],
  exports: [TasksService, TaskAuthorizationService],
})
export class TasksModule { }
