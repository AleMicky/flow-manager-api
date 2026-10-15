import { Module } from '@nestjs/common';
import { AprobacionesController } from './aprobaciones.controller.js';
import { AprobacionesService } from './aprobaciones.service.js';

@Module({
  controllers: [AprobacionesController],
  providers: [AprobacionesService],
})
export class AprobacionesModule {}
