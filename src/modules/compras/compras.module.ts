import { Module } from '@nestjs/common';
import { SolicitudesModule } from './solicitudes/solicitudes.module.js';

@Module({
  imports: [SolicitudesModule],
  exports: [SolicitudesModule],
})
export class ComprasModule { }
