import { Module } from '@nestjs/common';

import { KeycloakAdminClient } from './keycloak-admin.client.js';
import { KeycloakUsersService } from './services/keycloak-users.service.js';
import { KeycloakGroupsService } from './services/keycloak-groups.service.js';
import { KeycloakRolesService } from './services/keycloak-roles.service.js';
import { KeycloakUsersController } from './controllers/keycloak-users.controller.js';
import { KeycloakGroupsController } from './controllers/keycloak-groups.controller.js';
import { KeycloakRolesController } from './controllers/keycloak-roles.controller.js';

@Module({
  controllers: [
    KeycloakUsersController,
    KeycloakGroupsController,
    KeycloakRolesController,
  ],
  providers: [
    KeycloakAdminClient,
    KeycloakUsersService,
    KeycloakGroupsService,
    KeycloakRolesService,
  ],
  exports: [
    KeycloakUsersService,
    KeycloakGroupsService,
    KeycloakRolesService,
  ],
})
export class KeycloakAdminModule {}
