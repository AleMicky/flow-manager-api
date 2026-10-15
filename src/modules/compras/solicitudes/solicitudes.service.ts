
import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
    SolicitudCompra,
    EstadoSolicitudCompra,
} from './entities/solicitud-compra.entity.js';

import { CreateSolicitudDto } from './dto/create-solicitud.dto.js';

import { FlowableService } from '../../workflow/infrastructure/flowable/flowable.service.js';

interface StartedProcess {
    id: string;
    processDefinitionId: string;
}

@Injectable()
export class SolicitudesService {
    constructor(
        @InjectRepository(SolicitudCompra)
        private readonly repository: Repository<SolicitudCompra>,

        private readonly flowable: FlowableService,
    ) { }

    async create(dto: CreateSolicitudDto) {
        const solicitud = this.repository.create({
            ...dto,
            estado: EstadoSolicitudCompra.BORRADOR,
        });

        return this.repository.save(solicitud);
    }

    findAll() {
        return this.repository.find({
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string) {
        const solicitud = await this.repository.findOneBy({
            id,
        });

        if (!solicitud) {
            throw new NotFoundException(
                'Solicitud de compra no encontrada',
            );
        }

        return solicitud;
    }

    async enviar(id: string) {
        const solicitud = await this.findOne(id);

        if (
            solicitud.estado !== EstadoSolicitudCompra.BORRADOR ||
            solicitud.processInstanceId
        ) {
            throw new ConflictException(
                'La solicitud ya fue enviada',
            );
        }

        const process = await this.flowable.startProcess<StartedProcess>(
            'solicitudCompra',
            {
                solicitudCompraId: solicitud.id,
                numero: solicitud.numero,
                concepto: solicitud.concepto,
                monto: Number(solicitud.monto),
                solicitanteId: solicitud.solicitanteId,
            },
            solicitud.numero,
        );

        solicitud.processInstanceId = process.id;
        solicitud.estado = EstadoSolicitudCompra.SOLICITADO;

        return this.repository.save(solicitud);
    }


    async actualizarEstado(
        id: string,
        estado: EstadoSolicitudCompra,
    ): Promise<SolicitudCompra> {
        const solicitud = await this.findOne(id);

        solicitud.estado = estado;

        return this.repository.save(solicitud);
    }

}
