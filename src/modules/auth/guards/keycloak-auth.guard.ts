
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

import type { AuthUser } from '../interfaces/auth-user.interface.js';

interface AuthenticatedRequest {
    headers: {
        authorization?: string;
    };
    user?: AuthUser;
}

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [
                context.getHandler(),
                context.getClass(),
            ],
        );

        if (isPublic) {
            return true;
        }

        const request =
            context.switchToHttp().getRequest<AuthenticatedRequest>();

        const authorization =
            request.headers.authorization;

        const match = authorization?.match(
            /^Bearer\s+(.+)$/i,
        );

        if (!match) {
            throw new UnauthorizedException(
                'Se requiere un Bearer token',
            );
        }

        request.user = await this.authService.validateToken(
            match[1].trim(),
        );

        return true;
    }
}
