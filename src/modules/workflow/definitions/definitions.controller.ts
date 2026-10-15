import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

import { DefinitionsService } from './definitions.service.js';
import { QueryDefinitionsDto } from './dto/query-definitions.dto.js';

@ApiTags('Workflow - Definitions')
@Controller('workflow/definitions')
export class DefinitionsController {
  constructor(private readonly definitionsService: DefinitionsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar procesos BPMN' })
  findAll(@Query() query: QueryDefinitionsDto) {
    return this.definitionsService.findAll(query);
  }

  @Get('key/:key')
  @ApiOperation({ summary: 'Buscar por clave BPMN' })
  findByKey(@Param('key') key: string) {
    return this.definitionsService.findByKey(key);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar definición BPMN por ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.definitionsService.findOne(id);
  }
}
