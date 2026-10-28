import { Module } from '@nestjs/common';

import { KeycloakAdminController } from './keycloak-admin.controller.js';
import { KeycloakAdminService } from './keycloak-admin.service.js';

@Module({
  controllers: [KeycloakAdminController],
  providers: [KeycloakAdminService],
  exports: [KeycloakAdminService],
})
export class KeycloakAdminModule {}

