import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { FormsService } from './forms.service.js';
import { CreateFormDto } from './dto/create-form.dto.js';
import { TaskFormService } from './services/task-form.service.js';
import { ValidateTaskFormDto } from './dto/validate-task-form.dto.js';

@ApiTags('Workflow - Forms')
@Controller('workflow/forms')
export class FormsController {
  constructor(
    private readonly service: FormsService,
    private readonly taskFormService: TaskFormService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Configurar formulario dinámico' })
  create(@Body() dto: CreateFormDto) {
    return this.service.create(dto);
  }

  @Get('process/:processKey')
  @ApiOperation({ summary: 'Consultar formularios configurados para un proceso' })
  findByProcess(@Param('processKey') processKey: string) {
    return this.service.findByProcess(processKey);
  }

  @Get('process/:processKey/task/:taskDefinitionKey')
  @ApiOperation({ summary: 'Consultar formulario de una etapa por proceso y clave de tarea' })
  findByProcessAndTask(
    @Param('processKey') processKey: string,
    @Param('taskDefinitionKey') taskDefinitionKey: string,
  ) {
    return this.service.findByProcessAndTask(processKey, taskDefinitionKey);
  }

  @Put('process/:processKey/task/:taskDefinitionKey')
  @ApiOperation({ summary: 'Guardar o actualizar formulario para una etapa BPMN' })
  upsert(
    @Param('processKey') processKey: string,
    @Param('taskDefinitionKey') taskDefinitionKey: string,
    @Body() dto: CreateFormDto,
  ) {
    return this.service.upsert({
      ...dto,
      processDefinitionKey: processKey,
      taskDefinitionKey,
    });
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Consultar formulario de una tarea' })
  findByTask(@Param('taskId') taskId: string) {
    return this.service.findByTask(taskId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar formulario por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post('task/:taskId/validate')
  @ApiOperation({
    summary: 'Validar datos de un formulario dinámico',
  })
  validate(
    @Param('taskId') taskId: string,
    @Body() dto: ValidateTaskFormDto,
  ) {
    return this.taskFormService.validate(taskId, dto.data);
  }
}
