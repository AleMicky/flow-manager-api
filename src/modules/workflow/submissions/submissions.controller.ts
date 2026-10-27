
import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
} from '@nestjs/common';

import {
    ApiOAuth2,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface.js';

import { StartSubmissionDto } from './dto/start-submission.dto.js';
import { SubmissionsService } from './submissions.service.js';

@ApiTags('Workflow - Submissions')
@ApiOAuth2(['openid'], 'keycloak')
@Controller('workflow/submissions')
export class SubmissionsController {
    constructor(
        private readonly service: SubmissionsService,
    ) { }

    @Post('processes/:processId/start')
    @ApiOperation({
        summary: 'Iniciar un expediente genérico',
    })
    start(
        @Param('processId', ParseUUIDPipe) processId: string,
        @Body() dto: StartSubmissionDto,
        @CurrentUser() user: AuthUser,
    ) {
        return this.service.start(processId, dto, user);
    }

    @Get('mine')
    @ApiOperation({
        summary: 'Consultar mis expedientes',
    })
    findMine(@CurrentUser() user: AuthUser) {
        return this.service.findMine(user);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Consultar un expediente',
    })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.service.findOne(id, user);
    }
}
