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

import { KeycloakGroupsService } from '../services/keycloak-groups.service.js';
import { QueryKeycloakGroupsDto } from '../dto/query-keycloak-groups.dto.js';
import {
  CreateKeycloakGroupDto,
  UpdateKeycloakGroupDto,
} from '../dto/manage-keycloak-group.dto.js';

@ApiTags('Keycloak Admin - Groups')
@Controller('keycloak-admin/groups')
export class KeycloakGroupsController {
  constructor(private readonly groupsService: KeycloakGroupsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar grupos de Keycloak',
  })
  findGroups(@Query() query: QueryKeycloakGroupsDto) {
    return this.groupsService.findGroups(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear un nuevo grupo en Keycloak',
  })
  createGroup(@Body() dto: CreateKeycloakGroupDto) {
    return this.groupsService.createGroup(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un grupo de Keycloak por ID',
  })
  @ApiParam({ name: 'id', description: 'UUID del grupo en Keycloak' })
  findGroupById(@Param('id') id: string) {
    return this.groupsService.findGroupById(id);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar el nombre de un grupo en Keycloak',
  })
  @ApiParam({ name: 'id', description: 'UUID del grupo en Keycloak' })
  updateGroup(@Param('id') id: string, @Body() dto: UpdateKeycloakGroupDto) {
    return this.groupsService.updateGroup(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Eliminar un grupo de Keycloak',
  })
  @ApiParam({ name: 'id', description: 'UUID del grupo en Keycloak' })
  deleteGroup(@Param('id') id: string) {
    return this.groupsService.deleteGroup(id);
  }

  @Get(':id/members')
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
    return this.groupsService.findGroupMembers(id, first, max);
  }

  @Put(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Asignar un usuario como miembro de un grupo',
  })
  @ApiParam({ name: 'groupId', description: 'UUID del grupo en Keycloak' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario en Keycloak' })
  addGroupMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.addGroupMember(groupId, userId);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Quitar un usuario miembro de un grupo',
  })
  @ApiParam({ name: 'groupId', description: 'UUID del grupo en Keycloak' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario en Keycloak' })
  removeGroupMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.removeGroupMember(groupId, userId);
  }
}

