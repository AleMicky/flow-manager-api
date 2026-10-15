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

import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ActionsService } from './actions.service.js';
import { CreateActionDto } from './dto/create-action.dto.js';
import { TaskActionExecutor } from './executors/task-action.executor.js';
import { ExecuteActionDto } from './dto/execute-action.dto.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

@ApiTags('Workflow - Actions')
@Controller('workflow/actions')
export class ActionsController {
  constructor(
    private readonly service: ActionsService,
    private readonly executor: TaskActionExecutor,
  ) { }

  @Post()
  @ApiOperation({
    summary: 'Configurar una acción BPMN',
  })
  create(@Body() dto: CreateActionDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar acciones de una tarea BPMN',
  })
  @ApiQuery({ name: 'processDefinitionId' })
  @ApiQuery({ name: 'taskDefinitionKey' })
  findByTask(
    @Query('processDefinitionId')
    processDefinitionId: string,
    @Query('taskDefinitionKey')
    taskDefinitionKey: string,
  ) {
    return this.service.findByTask(processDefinitionId, taskDefinitionKey);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar una acción configurada',
  })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('tasks/:taskId/actions/:actionId/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar acción BPMN autorizada',
  })
  execute(
    @Param('taskId') taskId: string,
    @Param('actionId') actionId: string,
    @Body() dto: ExecuteActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.executor.execute(
      taskId,
      actionId,
      dto,
      user,
    );
  }


}
