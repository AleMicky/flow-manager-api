import {
  Body,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { TaskAssignmentsService } from './services/task-assignments.service.js';
import { UpsertTaskAssignmentDto } from './dto/upsert-task-assignment.dto.js';

@ApiTags('Workflow - Task Assignments')
@Controller('workflow/task-assignments')
export class TaskAssignmentsController {
  constructor(private readonly assignmentsService: TaskAssignmentsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar reglas de asignación de grupos/usuarios de Keycloak a tareas BPMN',
  })
  @ApiQuery({ name: 'processDefinitionKey', required: false })
  findAll(@Query('processDefinitionKey') processDefinitionKey?: string) {
    return this.assignmentsService.findAll(processDefinitionKey);
  }

  @Get('process/:processDefinitionKey')
  @ApiOperation({
    summary:
      'Obtener todas las userTask de un proceso BPMN con sus grupos/usuarios asignados',
  })
  @ApiParam({
    name: 'processDefinitionKey',
    description: 'Clave del proceso BPMN (ej. aprobacionSimple)',
  })
  getProcessTasks(
    @Param('processDefinitionKey') processDefinitionKey: string,
  ) {
    return this.assignmentsService.getProcessTasksWithAssignments(
      processDefinitionKey,
    );
  }

  @Put()
  @ApiOperation({
    summary:
      'Guardar o actualizar qué grupos y usuarios de Keycloak atienden una tarea BPMN',
  })
  upsert(@Body() dto: UpsertTaskAssignmentDto) {
    return this.assignmentsService.upsert(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Eliminar una regla de asignación de tarea BPMN',
  })
  @ApiParam({ name: 'id', description: 'UUID de la regla de asignación' })
  remove(@Param('id') id: string) {
    return this.assignmentsService.remove(id);
  }
}

