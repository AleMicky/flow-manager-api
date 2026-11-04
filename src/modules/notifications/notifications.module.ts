import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { WorkflowNotificationsService } from './workflow-notifications.service.js';
import { KeycloakAdminModule } from '../keycloak-admin/keycloak-admin.module.js';

@Module({
  imports: [ConfigModule, KeycloakAdminModule],
  providers: [EmailService, WorkflowNotificationsService],
  exports: [EmailService, WorkflowNotificationsService],
})
export class NotificationsModule {}

