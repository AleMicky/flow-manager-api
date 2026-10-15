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
import { ClaimTaskDto } from './dto/claim-task.dto.js';
import { CompleteTaskDto } from './dto/complete-task.dto.js';

@ApiTags('Workflow - Tasks')
@Controller('workflow/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar tareas pendientes',
  })
  findAll(@Query() query: QueryTasksDto) {
    return this.tasksService.findAll(query);
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Reclamar una tarea',
  })
  @ApiNoContentResponse()
  claim(@Param('id') id: string, @Body() dto: ClaimTaskDto) {
    return this.tasksService.claim(id, dto);
  }

  @Post(':id/unclaim')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Liberar una tarea',
  })
  @ApiNoContentResponse()
  unclaim(@Param('id') id: string) {
    return this.tasksService.unclaim(id);
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
