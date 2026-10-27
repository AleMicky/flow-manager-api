import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiNoContentResponse,
} from '@nestjs/swagger';

import { TasksService } from './tasks.service.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';
import { TaskAuthorizationService } from './services/task-authorization.service.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

@ApiTags('Workflow - Tasks')
@Controller('workflow/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService,
    private readonly authorization: TaskAuthorizationService,
  ) { }

  @Get()
  @ApiOperation({
    summary: 'Listar tareas pendientes',
  })
  findAll(@Query() query: QueryTasksDto) {
    return this.tasksService.findAll(query);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'Listar mis tareas asignadas',
  })
  findMine(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryTasksDto,
  ) {
    return this.tasksService.findMine(user, query);
  }

  @Get('available')
  @ApiOperation({
    summary: 'Listar tareas disponibles para reclamar',
  })
  findAvailable(
    @CurrentUser() user: AuthUser,
    @Query() query: QueryTasksDto,
  ) {
    return this.tasksService.findAvailable(user, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar una tarea',
  })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }


  @Post(':id/claim')
  @ApiOperation({
    summary: 'Reclamar tarea como usuario autenticado',
  })
  claim(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authorization.claim(id, user);
  }

  @Post(':id/unclaim')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Liberar tarea propia',
  })
  unclaim(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authorization.unclaim(id, user);
  }


  @Post(':id/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Completar una tarea',
  })
  @ApiNoContentResponse()
  complete(@Param('id') id: string, @Body() dto: CompleteTaskDto) {
    return this.tasksService.complete(id, dto);
  }


}
