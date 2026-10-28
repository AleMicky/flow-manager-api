import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { KeycloakRolesService } from '../services/keycloak-roles.service.js';
import { QueryKeycloakRolesDto } from '../dto/query-keycloak-roles.dto.js';

@ApiTags('Keycloak Admin - Roles')
@Controller('keycloak-admin/roles')
export class KeycloakRolesController {
  constructor(private readonly rolesService: KeycloakRolesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar todos los roles candidatos (cliente + realm) para tareas BPMN',
  })
  findCandidateRoles(@Query() query: QueryKeycloakRolesDto) {
    return this.rolesService.findCandidateRoles(query);
  }

  @Get('realm')
  @ApiOperation({
    summary: 'Listar roles del realm en Keycloak',
  })
  findRealmRoles(@Query() query: QueryKeycloakRolesDto) {
    return this.rolesService.findRealmRoles(query);
  }

  @Get('client')
  @ApiOperation({
    summary: 'Listar roles del cliente configurado en Keycloak',
  })
  findClientRoles(@Query() query: QueryKeycloakRolesDto) {
    return this.rolesService.findClientRoles(query);
  }

  @Get(':roleName/users')
  @ApiOperation({
    summary: 'Listar usuarios que poseen un rol específico',
  })
  @ApiParam({ name: 'roleName', description: 'Nombre del rol' })
  @ApiQuery({ name: 'first', required: false, type: Number })
  @ApiQuery({ name: 'max', required: false, type: Number })
  findUsersByRole(
    @Param('roleName') roleName: string,
    @Query('first', new DefaultValuePipe(0), ParseIntPipe) first: number,
    @Query('max', new DefaultValuePipe(50), ParseIntPipe) max: number,
  ) {
    return this.rolesService.findUsersByRole(roleName, first, max);
  }
}

