import { Controller, Get } from '@nestjs/common';

import {
    ApiOperation,
    ApiTags,
    ApiBearerAuth,
} from '@nestjs/swagger';

import { CurrentUser } from './decorators/current-user.decorator.js';

import type { AuthUser } from './interfaces/auth-user.interface.js';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
    @Get('me')
    @ApiOperation({
        summary: 'Obtener usuario autenticado',
    })
    getMe(
        @CurrentUser() user: AuthUser,
    ) {
        return user;
    }
}