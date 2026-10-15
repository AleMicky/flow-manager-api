
import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
    EstadoSolicitudCompra,
    SolicitudCompra,
} from '../entities/solicitud-compra.entity.js';

@Injectable()
export class CompraWorkflowSyncService {
    constructor(
        @InjectRepository(SolicitudCompra)
        private readonly repository: Repository<SolicitudCompra>,
    ) { }

    async synchronize(
        processInstanceId: string,
        businessStatus: string,
    ): Promise<boolean> {
        const solicitud = await this.repository.findOneBy({
            processInstanceId,
        });

        // Esta instancia no corresponde a Compras.
        if (!solicitud) {
            return false;
        }

        const validStates =
            Object.values(EstadoSolicitudCompra) as string[];

        if (!validStates.includes(businessStatus)) {
            throw new BadRequestException(
                `Estado de compra no válido: ${businessStatus}`,
            );
        }

        await this.repository.update(
            { id: solicitud.id },
            {
                estado: businessStatus as EstadoSolicitudCompra,
            },
        );

        return true;
    }
}
