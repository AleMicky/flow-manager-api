import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TasksController } from './tasks.controller.js';
import { TaskAssignmentsController } from './task-assignments.controller.js';
import { TasksService } from './tasks.service.js';
import { TaskAuthorizationService } from './services/task-authorization.service.js';
import { TaskAssignmentsService } from './services/task-assignments.service.js';
import { WorkflowTaskAssignment } from './entities/workflow-task-assignment.entity.js';
import { FlowableModule } from '../infrastructure/flowable/flowable.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { KeycloakAdminModule } from '../../keycloak-admin/keycloak-admin.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowTaskAssignment]),
    FlowableModule,
    AuthModule,
    KeycloakAdminModule,
  ],
  controllers: [TasksController, TaskAssignmentsController],
  providers: [
    TasksService,
    TaskAuthorizationService,
    TaskAssignmentsService,
  ],
  exports: [
    TasksService,
    TaskAuthorizationService,
    TaskAssignmentsService,
  ],
})
export class TasksModule {}
