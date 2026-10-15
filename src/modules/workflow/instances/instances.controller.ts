import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

import { InstancesService } from './instances.service.js';
import { StartProcessDto } from './dto/start-process.dto.js';
import { QueryInstancesDto } from './dto/query-instances.dto.js';

@ApiTags('Workflow - Instances')
@Controller('workflow/instances')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar instancias activas' })
  findAll(@Query() query: QueryInstancesDto) {
    return this.instancesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar instancia por ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.instancesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Iniciar proceso BPMN' })
  create(@Body() dto: StartProcessDto) {
    return this.instancesService.start(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar instancia' })
  remove(@Param('id') id: string) {
    return this.instancesService.remove(id);
  }
}
