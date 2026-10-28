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

import { KeycloakAdminService } from './keycloak-admin.service.js';
import { QueryKeycloakUsersDto } from './dto/query-keycloak-users.dto.js';
import { QueryKeycloakRolesDto } from './dto/query-keycloak-roles.dto.js';
import { QueryKeycloakGroupsDto } from './dto/query-keycloak-groups.dto.js';

@ApiTags('Keycloak Admin')
@Controller('keycloak-admin')
export class KeycloakAdminController {
  constructor(private readonly keycloakAdmin: KeycloakAdminService) {}

  // ==========================================
  // USUARIOS
  // ==========================================

  @Get('users')
  @ApiOperation({
    summary: 'Listar y buscar usuarios de Keycloak (para asignación BPMN)',
  })
  findUsers(@Query() query: QueryKeycloakUsersDto) {
    return this.keycloakAdmin.findUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({
    summary: 'Obtener detalle de un usuario en Keycloak por ID',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  findUserById(@Param('id') id: string) {
    return this.keycloakAdmin.findUserById(id);
  }

  @Get('users/:id/roles')
  @ApiOperation({
    summary: 'Consultar los roles asignados a un usuario (realm y cliente)',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  getUserRoles(@Param('id') id: string) {
    return this.keycloakAdmin.getUserRoles(id);
  }

  @Get('users/:id/groups')
  @ApiOperation({
    summary: 'Consultar los grupos a los que pertenece un usuario',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  getUserGroups(@Param('id') id: string) {
    return this.keycloakAdmin.getUserGroups(id);
  }

  // ==========================================
  // ROLES (CANDIDATE GROUPS BPMN)
  // ==========================================

  @Get('roles')
  @ApiOperation({
    summary:
      'Listar todos los roles candidatos (cliente + realm) para tareas BPMN',
  })
  findCandidateRoles(@Query() query: QueryKeycloakRolesDto) {
    return this.keycloakAdmin.findCandidateRoles(query);
  }

  @Get('roles/realm')
  @ApiOperation({
    summary: 'Listar roles del realm en Keycloak',
  })
  findRealmRoles(@Query() query: QueryKeycloakRolesDto) {
    return this.keycloakAdmin.findRealmRoles(query);
  }

  @Get('roles/client')
  @ApiOperation({
    summary: 'Listar roles del cliente configurado en Keycloak',
  })
  findClientRoles(@Query() query: QueryKeycloakRolesDto) {
    return this.keycloakAdmin.findClientRoles(query);
  }

  @Get('roles/:roleName/users')
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
    return this.keycloakAdmin.findUsersByRole(roleName, first, max);
  }

  // ==========================================
  // GRUPOS
  // ==========================================

  @Get('groups')
  @ApiOperation({
    summary: 'Listar grupos de Keycloak',
  })
  findGroups(@Query() query: QueryKeycloakGroupsDto) {
    return this.keycloakAdmin.findGroups(query);
  }

  @Get('groups/:id')
  @ApiOperation({
    summary: 'Obtener detalle de un grupo de Keycloak por ID',
  })
  @ApiParam({ name: 'id', description: 'UUID del grupo en Keycloak' })
  findGroupById(@Param('id') id: string) {
    return this.keycloakAdmin.findGroupById(id);
  }

  @Get('groups/:id/members')
  @ApiOperation({
    summary: 'Listar usuarios miembros de un grupo de Keycloak',
  })
  @ApiParam({ name: 'id', description: 'UUID del grupo en Keycloak' })
  @ApiQuery({ name: 'first', required: false, type: Number })
  @ApiQuery({ name: 'max', required: false, type: Number })
  findGroupMembers(
    @Param('id') id: string,
    @Query('first', new DefaultValuePipe(0), ParseIntPipe) first: number,
    @Query('max', new DefaultValuePipe(50), ParseIntPipe) max: number,
  ) {
    return this.keycloakAdmin.findGroupMembers(id, first, max);
  }
}

