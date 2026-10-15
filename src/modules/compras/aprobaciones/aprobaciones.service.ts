import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { FlowableService } from '../../workflow/infrastructure/flowable/flowable.service.js';
import { SolicitudesService } from '../solicitudes/solicitudes.service.js';

import { EstadoSolicitudCompra } from '../solicitudes/entities/solicitud-compra.entity.js';

import { DecidirSolicitudDto } from './dto/decidir-solicitud.dto.js';
import { DecisionCompra } from './enums/decision-compra.enum.js';

interface FlowableTask {
  id: string;
  name: string;
  processInstanceId: string | null;
  taskDefinitionKey: string | null;
}

@Injectable()
export class AprobacionesService {
  constructor(
    private readonly solicitudes: SolicitudesService,
    private readonly flowable: FlowableService,
  ) {}

  async decidir(solicitudId: string, dto: DecidirSolicitudDto) {
    const solicitud = await this.solicitudes.findOne(solicitudId);

    if (!solicitud.processInstanceId) {
      throw new BadRequestException(
        'La solicitud no tiene un proceso iniciado',
      );
    }

    if (
      solicitud.estado === EstadoSolicitudCompra.APROBADO ||
      solicitud.estado === EstadoSolicitudCompra.RECHAZADO
    ) {
      throw new ConflictException('La solicitud ya tiene una decisión final');
    }

    const task = await this.flowable.getTaskById<FlowableTask>(dto.taskId);

    if (task.processInstanceId !== solicitud.processInstanceId) {
      throw new BadRequestException('La tarea no pertenece a esta solicitud');
    }

    if (task.name !== 'Revisar solicitud') {
      throw new ConflictException(
        'La tarea no corresponde a la revisión de compra',
      );
    }

    const estado = this.obtenerEstado(dto.decision);

    await this.flowable.completeTask<void>(dto.taskId, {
      decision: dto.decision,
      observacion: dto.observacion ?? '',
      solicitudCompraId: solicitud.id,
    });

    const actualizada = await this.solicitudes.actualizarEstado(
      solicitud.id,
      estado,
    );

    return {
      solicitudId: actualizada.id,
      numero: actualizada.numero,
      estado: actualizada.estado,
      processInstanceId: actualizada.processInstanceId,
      decision: dto.decision,
    };
  }

  private obtenerEstado(decision: DecisionCompra): EstadoSolicitudCompra {
    switch (decision) {
      case DecisionCompra.APROBADO:
        return EstadoSolicitudCompra.APROBADO;

      case DecisionCompra.RECHAZADO:
        return EstadoSolicitudCompra.RECHAZADO;

      case DecisionCompra.OBSERVADO:
        return EstadoSolicitudCompra.OBSERVADO;
    }
  }
}
