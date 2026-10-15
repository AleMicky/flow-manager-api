import { Module } from '@nestjs/common';
import { AprobacionesController } from './aprobaciones.controller.js';
import { AprobacionesService } from './aprobaciones.service.js';
import { FlowableModule } from '../../workflow/infrastructure/flowable/flowable.module.js';
import { SolicitudesModule } from '../solicitudes/solicitudes.module.js';

@Module({
  imports: [FlowableModule, SolicitudesModule],
  controllers: [AprobacionesController],
  providers: [AprobacionesService],
  exports: [AprobacionesService],
})
export class AprobacionesModule {}
