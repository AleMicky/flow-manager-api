
import {
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    createRemoteJWKSet,
    jwtVerify,
    decodeJwt,
    type JWTPayload,
} from 'jose';

import type { AuthUser } from './interfaces/auth-user.interface.js';

interface KeycloakPayload extends JWTPayload {
    preferred_username?: string;
    email?: string;
    name?: string;
    resource_access?: Record<
        string,
        { roles?: string[] }
    >;
}

@Injectable()
export class AuthService {
    private readonly issuer: string;
    private readonly audience: string;
    private readonly rolesClientId: string;
    private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

    constructor(private readonly config: ConfigService) {
        this.issuer = this.config.getOrThrow<string>(
            'KEYCLOAK_ISSUER',
        ).replace(/\/$/, '');

        this.audience = this.config.getOrThrow<string>(
            'KEYCLOAK_AUDIENCE',
        );

        this.rolesClientId = this.config.getOrThrow<string>(
            'KEYCLOAK_ROLES_CLIENT_ID',
        );

        this.jwks = createRemoteJWKSet(
            new URL(
                `${this.issuer}/protocol/openid-connect/certs`,
            ),
        );
    }

    async validateToken(token: string): Promise<AuthUser> {
        try {
            const unverified = decodeJwt<KeycloakPayload>(token);
            console.log('Claims del access_token en Keycloak:', {
                iss: unverified.iss,
                aud: unverified.aud,
                azp: (unverified as Record<string, unknown>).azp,
                sub: unverified.sub,
                expectedAudience: this.audience,
                expectedIssuer: this.issuer,
            });

            const { payload } = await jwtVerify<KeycloakPayload>(
                token,
                this.jwks,
                {
                    issuer: this.issuer,
                    algorithms: ['RS256'],
                    clockTolerance: 5,
                },
            );

            if (!payload.sub) {
                throw new UnauthorizedException(
                    'Token sin identificador de usuario',
                );
            }

            // Validar que el token corresponda a nuestra audiencia esperada o cliente autorizado (azp)
            const tokenAud = Array.isArray(payload.aud)
                ? payload.aud
                : payload.aud
                ? [payload.aud]
                : [];

            const azp = (payload as Record<string, unknown>).azp;
            const bffClientId = this.config.get<string>('KEYCLOAK_BFF_CLIENT_ID');

            const isAudienceValid =
                tokenAud.includes(this.audience) ||
                (bffClientId && tokenAud.includes(bffClientId)) ||
                tokenAud.includes('account') ||
                azp === bffClientId ||
                azp === this.audience;

            if (!isAudienceValid) {
                throw new UnauthorizedException(
                    `Audiencia no autorizada: [${tokenAud.join(', ')}], azp: ${azp}`,
                );
            }

            const clientRoles =
                payload.resource_access?.[
                    this.rolesClientId
                ]?.roles ?? [];

            const realmRoles =
                (payload as Record<string, { roles?: string[] }>).realm_access?.roles ?? [];

            const roles = Array.from(new Set([...clientRoles, ...realmRoles]));

            return {
                id: payload.sub,
                username:
                    payload.preferred_username ?? payload.sub,
                email: payload.email,
                name: payload.name,
                roles,
            };
        } catch (error) {
            console.error('Error detallado en validateToken:', error);
            const detail = error instanceof Error ? error.message : String(error);
            throw new UnauthorizedException(
                `La sesión no tiene una identidad válida: ${detail}`,
            );
        }
    }
}
