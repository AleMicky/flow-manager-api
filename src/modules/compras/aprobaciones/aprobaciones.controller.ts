import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AprobacionesService } from './aprobaciones.service.js';
import { DecidirSolicitudDto } from './dto/decidir-solicitud.dto.js';

@ApiTags('Compras - Aprobaciones')
@Controller('compras/aprobaciones')
export class AprobacionesController {
  constructor(private readonly service: AprobacionesService) {}

  @Post(':solicitudId/decidir')
  @ApiOperation({
    summary: 'Aprobar, rechazar u observar una compra',
  })
  decidir(
    @Param('solicitudId', ParseUUIDPipe)
    solicitudId: string,
    @Body() dto: DecidirSolicitudDto,
  ) {
    return this.service.decidir(solicitudId, dto);
  }
}
