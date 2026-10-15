
import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { CompraWorkflowSyncService } from '../../../compras/solicitudes/services/compra-workflow-sync.service.js';

@Injectable()
export class WorkflowBusinessSyncService {
    constructor(
        private readonly compras: CompraWorkflowSyncService,
    ) { }

    async synchronize(
        processInstanceId: string,
        businessStatus: string | null,
    ): Promise<void> {
        // Acciones que no modifican estado de negocio.
        if (businessStatus === null) {
            return;
        }

        const synchronized = await this.compras.synchronize(
            processInstanceId,
            businessStatus,
        );

        if (!synchronized) {
            throw new NotFoundException(
                'No existe una entidad de negocio vinculada al proceso',
            );
        }
    }
}
