import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { KeycloakRolesService } from '../services/keycloak-roles.service.js';
import { QueryKeycloakRolesDto } from '../dto/query-keycloak-roles.dto.js';
import {
  CreateKeycloakRoleDto,
  UpdateKeycloakRoleDto,
} from '../dto/manage-keycloak-role.dto.js';

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo rol en Keycloak (realm o client)',
  })
  createRole(@Body() dto: CreateKeycloakRoleDto) {
    return this.rolesService.createRole(dto);
  }

  @Put(':roleName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Actualizar un rol existente en Keycloak',
  })
  @ApiParam({ name: 'roleName', description: 'Nombre actual del rol' })
  updateRole(
    @Param('roleName') roleName: string,
    @Body() dto: UpdateKeycloakRoleDto,
  ) {
    return this.rolesService.updateRole(roleName, dto);
  }

  @Delete(':roleName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Eliminar un rol en Keycloak',
  })
  @ApiParam({ name: 'roleName', description: 'Nombre del rol a eliminar' })
  @ApiQuery({ name: 'source', required: false, enum: ['realm', 'client'] })
  deleteRole(
    @Param('roleName') roleName: string,
    @Query('source') source?: 'realm' | 'client',
  ) {
    return this.rolesService.deleteRole(roleName, source ?? 'realm');
  }
}

