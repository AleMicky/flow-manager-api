
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';

import {
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';

import { SolicitudesService } from './solicitudes.service.js';
import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';

@ApiTags('Compras - Solicitudes')
@Controller('compras/solicitudes')
export class SolicitudesController {
    constructor(
        private readonly service: SolicitudesService,
    ) { }

    @Get()
    @ApiOperation({
        summary: 'Listar solicitudes de compra',
    })
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Consultar solicitud de compra',
    })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.service.findOne(id);
    }

    @Post()
    @ApiOperation({
        summary: 'Registrar solicitud de compra',
    })
    create(@Body() dto: CreateSolicitudDto) {
        return this.service.create(dto);
    }

    @Post(':id/enviar')
    @ApiOperation({
        summary: 'Iniciar workflow de compra',
    })
    enviar(
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.service.enviar(id);
    }
}
