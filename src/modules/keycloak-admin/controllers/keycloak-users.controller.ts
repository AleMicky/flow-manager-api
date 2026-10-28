import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { KeycloakUsersService } from '../services/keycloak-users.service.js';
import { QueryKeycloakUsersDto } from '../dto/query-keycloak-users.dto.js';

@ApiTags('Keycloak Admin - Users')
@Controller('keycloak-admin/users')
export class KeycloakUsersController {
  constructor(private readonly usersService: KeycloakUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar y buscar usuarios de Keycloak (para asignación BPMN)',
  })
  findUsers(@Query() query: QueryKeycloakUsersDto) {
    return this.usersService.findUsers(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un usuario en Keycloak por ID',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  findUserById(@Param('id') id: string) {
    return this.usersService.findUserById(id);
  }

  @Get(':id/roles')
  @ApiOperation({
    summary: 'Consultar los roles asignados a un usuario (realm y cliente)',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  getUserRoles(@Param('id') id: string) {
    return this.usersService.getUserRoles(id);
  }

  @Get(':id/groups')
  @ApiOperation({
    summary: 'Consultar los grupos a los que pertenece un usuario',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  getUserGroups(@Param('id') id: string) {
    return this.usersService.getUserGroups(id);
  }

  @Put(':id/groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Asignar un grupo a un usuario en Keycloak',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  @ApiParam({ name: 'groupId', description: 'UUID del grupo en Keycloak' })
  assignUserToGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.usersService.assignUserToGroup(id, groupId);
  }

  @Delete(':id/groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Quitar un grupo a un usuario en Keycloak',
  })
  @ApiParam({ name: 'id', description: 'UUID del usuario en Keycloak' })
  @ApiParam({ name: 'groupId', description: 'UUID del grupo en Keycloak' })
  removeUserFromGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.usersService.removeUserFromGroup(id, groupId);
  }
}

