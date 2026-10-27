
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthController } from './auth.controller.js';

import { AuthService } from './auth.service.js';
import { OidcService } from './oidc.service.js';

import { KeycloakAuthGuard } from './guards/keycloak-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';

@Module({
  controllers: [AuthController],

  providers: [
    AuthService,
    OidcService,

    {
      provide: APP_GUARD,
      useClass: KeycloakAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],

  exports: [
    AuthService,
    OidcService,
  ],
})
export class AuthModule { }
