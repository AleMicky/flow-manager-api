
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';

import {
    ApiOAuth2,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator.js';

import { ProcessesService } from './processes.service.js';
import { CreateProcessDto } from './dto/create-process.dto.js';

@ApiTags('Workflow - Processes')
@ApiOAuth2(['openid'], 'keycloak')
@Controller('workflow/processes')
export class ProcessesController {
    constructor(
        private readonly service: ProcessesService,
    ) { }

    @Post()
    @Roles('workflow-admin', 'workflow-designer')
    @ApiOperation({ summary: 'Registrar proceso' })
    create(@Body() dto: CreateProcessDto) {
        return this.service.create(dto);
    }

    @Get()
    @Roles('workflow-admin', 'workflow-designer')
    @ApiOperation({ summary: 'Listar todos los procesos' })
    findAll() {
        return this.service.findAll();
    }

    @Get('available')
    @ApiOperation({ summary: 'Procesos disponibles' })
    findAvailable() {
        return this.service.findActive();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Consultar proceso' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.service.findOne(id);
    }
}
