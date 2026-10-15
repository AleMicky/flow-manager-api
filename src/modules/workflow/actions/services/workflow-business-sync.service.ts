
import { Injectable } from '@nestjs/common';

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
        if (!businessStatus) {
            return;
        }

        const synchronized =
            await this.compras.synchronize(
                processInstanceId,
                businessStatus,
            );

        if (!synchronized) {
            // No se encontró una solicitud de compra.
            // Por ahora no hay otro adaptador registrado.
            return;
        }
    }
}
