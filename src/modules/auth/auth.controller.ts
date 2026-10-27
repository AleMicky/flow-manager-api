
import {
    Controller,
    Get,
    Post,
    Req,
    Res,
    UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthUser } from './interfaces/auth-user.interface.js';

import { AuthService } from './auth.service.js';
import { OidcService } from './oidc.service.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly oidc: OidcService,
        private readonly auth: AuthService,
        private readonly config: ConfigService,
    ) { }

    private saveSession(req: Request): Promise<void> {
        return new Promise((resolve, reject) => {
            req.session.save((error) =>
                error ? reject(error) : resolve(),
            );
        });
    }

    private regenerateSession(req: Request): Promise<void> {
        return new Promise((resolve, reject) => {
            req.session.regenerate((error) =>
                error ? reject(error) : resolve(),
            );
        });
    }

    private destroySession(req: Request): Promise<void> {
        return new Promise((resolve, reject) => {
            req.session.destroy((error) =>
                error ? reject(error) : resolve(),
            );
        });
    }

    @Public()
    @Get('login')
    async login(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        // Crear un nuevo intento de autenticación.
        const login = await this.oidc.createLogin();

        req.session.oidc = {
            state: login.state,
            verifier: login.verifier,
            createdAt: Date.now(),
        };

        await this.saveSession(req);

        return res.redirect(login.url);
    }

    @Public()
    @Get('callback')
    async callback(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const attempt = req.session.oidc;

        if (
            !attempt ||
            Date.now() - attempt.createdAt > 5 * 60 * 1000
        ) {
            throw new UnauthorizedException(
                'Intento de autenticación inválido',
            );
        }

        // Invalidar el intento y persistir el cambio
        // antes de intercambiar el código OIDC.
        delete req.session.oidc;
        await this.saveSession(req);

        // Evitar depender del Host enviado por el cliente.
        const callbackUrl = new URL(this.config.getOrThrow<string>('AUTH_CALLBACK_URL'));
        const received = new URL(req.originalUrl, 'http://internal.invalid');

        callbackUrl.search = received.search;

        let tokens;

        try {
            tokens = await this.oidc.exchangeCode(
                callbackUrl,
                attempt.state,
                attempt.verifier,
            );

            // Validar la identidad y audiencia antes de
            // considerar autenticada la sesión.
            await this.auth.validateToken(
                tokens.access_token,
            );
        } catch (error) {
            console.error('Error en callback OIDC:', error);
            const detail = error instanceof Error ? error.message : String(error);
            throw new UnauthorizedException(
                `Falló la autenticación con Keycloak: ${detail}`,
            );
        }

        // Nuevo ID de sesión después del login.
        await this.regenerateSession(req);

        req.session.tokens = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            idToken: tokens.id_token,
            expiresAt:
                Date.now() +
                (tokens.expires_in ?? 60) * 1000,
        };

        req.session.authenticatedAt = Date.now();

        req.session.csrfToken =
            randomBytes(32).toString('hex');

        await this.saveSession(req);

        return res.redirect(
            this.config.getOrThrow<string>(
                'AUTH_SUCCESS_URL',
            ),
        );
    }

    @Get('me')
    me(@CurrentUser() user: AuthUser) {
        return user;
    }

    @Get('session')
    session(@CurrentUser() user: AuthUser) {
        return {
            authenticated: true,
            user,
        };
    }

    @Get('csrf')
    csrf(@Req() req: Request) {
        return {
            csrfToken: req.session.csrfToken,
        };
    }

    @Post('logout')
    async logout(
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const idToken = req.session.tokens?.idToken;

        // Obtener primero la URL de cierre OIDC.
        const logoutUrl =
            await this.oidc.logoutUrl(idToken);

        await this.destroySession(req);

        res.clearCookie(
            process.env.NODE_ENV === 'production'
                ? '__Host-flow.sid'
                : 'flow.sid',
            { path: '/' },
        );

        return res.json({
            logoutUrl,
        });
    }
}
