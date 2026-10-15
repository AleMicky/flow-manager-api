
import {
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
    createRemoteJWKSet,
    jwtVerify,
    type JWTPayload,
} from 'jose';

import type { AuthUser } from './interfaces/auth-user.interface.js';

interface KeycloakPayload extends JWTPayload {
    preferred_username?: string;
    email?: string;
    name?: string;

    resource_access?: Record<
        string,
        {
            roles?: string[];
        }
    >;
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    private readonly issuer: string;
    private readonly audience: string;
    private readonly clientId: string;

    private readonly jwks;

    constructor(
        private readonly config: ConfigService,
    ) {
        this.issuer = this.config.getOrThrow<string>(
            'KEYCLOAK_ISSUER',
        ).replace(/\/$/, '');

        this.audience = this.config.getOrThrow<string>(
            'KEYCLOAK_AUDIENCE',
        );

        this.clientId = this.config.getOrThrow<string>(
            'KEYCLOAK_CLIENT_ID',
        );

        this.jwks = createRemoteJWKSet(
            new URL(
                `${this.issuer}/protocol/openid-connect/certs`,
            ),
        );
    }

    async validateToken(
        token: string,
    ): Promise<AuthUser> {
        try {
            const { payload } =
                await jwtVerify<KeycloakPayload>(
                    token,
                    this.jwks,
                    {
                        issuer: this.issuer,
                        audience: this.audience,
                        algorithms: ['RS256'],
                        clockTolerance: 5,
                    },
                );

            if (!payload.sub) {
                throw new UnauthorizedException(
                    'El token no contiene un usuario',
                );
            }

            const roles =
                payload.resource_access?.[this.clientId]
                    ?.roles ?? [];

            return {
                id: payload.sub,
                username:
                    payload.preferred_username ?? payload.sub,
                email: payload.email,
                name: payload.name,
                roles: [...new Set(roles)],
            };
        } catch (error) {
            this.logger.warn(
                'Se rechazó un access token de Keycloak',
            );

            throw new UnauthorizedException(
                'Token inválido o expirado',
            );
        }
    }
}
