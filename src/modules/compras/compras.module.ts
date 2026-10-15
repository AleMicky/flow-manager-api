import { Module } from '@nestjs/common';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';
import { AprobacionesModule } from './aprobaciones/aprobaciones.module.js';

@Module({
  imports: [SolicitudesModule, AprobacionesModule],
  exports: [SolicitudesModule, AprobacionesModule],
})
export class ComprasModule { }
