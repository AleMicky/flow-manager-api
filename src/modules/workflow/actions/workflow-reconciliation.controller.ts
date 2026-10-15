
import {
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';

import {
    ApiOperation,
    ApiTags,
    ApiOAuth2,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator.js';

import { WorkflowReconciliationService } from './services/workflow-reconciliation.service.js';

@ApiTags('Workflow - Reconciliation')
@ApiOAuth2(['openid'], 'keycloak')
@Roles('workflow-admin')
@Controller('workflow/reconciliation')
export class WorkflowReconciliationController {
    constructor(
        private readonly reconciliation: WorkflowReconciliationService,
    ) { }

    @Get('pending')
    @ApiOperation({
        summary: 'Consultar ejecuciones pendientes',
    })
    findPending() {
        return this.reconciliation.findPending();
    }

    @Post(':id/retry')
    @ApiOperation({
        summary: 'Verificar y reconciliar ejecución',
    })
    retry(
        @Param('id', ParseUUIDPipe) id: string,
    ) {
        return this.reconciliation.reconcile(id);
    }
}
