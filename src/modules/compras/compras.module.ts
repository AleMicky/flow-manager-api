import { Module } from '@nestjs/common';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';
import { AprobacionesModule } from './aprobaciones/aprobaciones.module.js';

@Module({
  imports: [SolicitudesModule, AprobacionesModule],
})
export class ComprasModule {}
