import { Module } from '@nestjs/common';
import { SolicitudesController } from './solicitudes.controller.js';
import { SolicitudesService } from './solicitudes.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitudCompra } from './entities/solicitud-compra.entity.js';
import { FlowableModule } from '../../workflow/infrastructure/flowable/flowable.module.js';
import { CompraWorkflowSyncService } from './services/compra-workflow-sync.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitudCompra]), FlowableModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService, CompraWorkflowSyncService],
  exports: [SolicitudesService, CompraWorkflowSyncService],
})
export class SolicitudesModule { }
