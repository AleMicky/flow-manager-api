
import { Injectable } from '@nestjs/common';



@Injectable()
export class WorkflowBusinessSyncService {
    constructor(
        
    ) { }

    async synchronize(
        processInstanceId: string,
        businessStatus: string | null,
    ): Promise<void> {
        // Acciones que no modifican estado de negocio.
        if (businessStatus === null) {
            return;
        }


    }
}
