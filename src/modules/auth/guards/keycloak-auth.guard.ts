
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthService } from '../auth.service.js';
import { OidcService } from '../oidc.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly auth: AuthService,
        private readonly oidc: OidcService,
    ) { }

    async canActivate(
        context: ExecutionContext,
    ): Promise<boolean> {
        const isPublic =
            this.reflector.getAllAndOverride<boolean>(
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
            context.switchToHttp().getRequest<
                Request & { user?: AuthUser }
            >();

        const session = request.session;
        const tokens = session?.tokens;

        if (!tokens || !session.authenticatedAt) {
            throw new UnauthorizedException(
                'Debes iniciar sesión',
            );
        }

        // Duración absoluta: 8 horas desde el login.
        if (
            Date.now() - session.authenticatedAt >
            8 * 60 * 60 * 1000
        ) {
            throw new UnauthorizedException(
                'La sesión ha expirado',
            );
        }

        try {
            if (Date.now() >= tokens.expiresAt - 30_000) {
                if (!tokens.refreshToken) {
                    throw new Error(
                        'No existe refresh token',
                    );
                }

                const refreshed = await this.oidc.refresh(
                    tokens.refreshToken,
                );

                session.tokens = {
                    accessToken: refreshed.access_token,
                    refreshToken:
                        refreshed.refresh_token ??
                        tokens.refreshToken,
                    idToken:
                        refreshed.id_token ?? tokens.idToken,
                    expiresAt:
                        Date.now() +
                        (refreshed.expires_in ?? 60) * 1000,
                };

                await new Promise<void>((resolve, reject) => {
                    session.save((error) =>
                        error ? reject(error) : resolve(),
                    );
                });
            }

            const user = await this.auth.validateToken(
                session.tokens!.accessToken,
            );

            request.user = user;

            return true;
        } catch {
            throw new UnauthorizedException(
                'Sesión expirada o inválida',
            );
        }
    }
}
