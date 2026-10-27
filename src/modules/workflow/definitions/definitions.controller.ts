import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import type { Response } from 'express';

import { DefinitionsService } from './services/definitions.service.js';
import { QueryDefinitionsDto } from './dto/query-definitions.dto.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { DeployProcessDto } from './dto/deploy-process.dto.js';
import { BpmnDeploymentService } from './services/bpmn-deployment.service.js';

@ApiTags('Workflow - Definitions')
@Controller('workflow/definitions')
export class DefinitionsController {

  constructor(
    private readonly definitionsService: DefinitionsService,
    private readonly deployment: BpmnDeploymentService,
  ) { }

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


  @Post('deploy')
  @Roles('workflow-admin', 'workflow-designer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publicar una definición BPMN en Flowable',
  })
  deploy(@Body() dto: DeployProcessDto) {
    return this.deployment.deploy(dto);
  }

  @Get('key/:key/versions')
  @ApiOperation({
    summary: 'Consultar versiones publicadas de un proceso',
  })
  versions(@Param('key') key: string) {
    return this.deployment.findVersions(key);
  }

  @Get(':id/xml')
  @Roles('workflow-admin', 'workflow-designer')
  @ApiOperation({
    summary: 'Recuperar el XML de una definición BPMN',
  })
  async xml(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const xml = await this.deployment.getXml(id);

    return res
      .type('application/xml')
      .send(xml);
  }

}
