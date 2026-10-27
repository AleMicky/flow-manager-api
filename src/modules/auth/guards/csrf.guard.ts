
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
    private readonly expectedOrigin: string;

    constructor(private readonly config: ConfigService) {
        this.expectedOrigin = new URL(
            this.config.getOrThrow<string>('APP_URL'),
        ).origin;
    }

    canActivate(context: ExecutionContext): boolean {
        const request =
            context.switchToHttp().getRequest<Request>();

        const method = request.method.toUpperCase();

        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return true;
        }

        if (request.headers.origin !== this.expectedOrigin) {
            throw new ForbiddenException(
                'Origen no permitido',
            );
        }

        const expected = request.session?.csrfToken;
        const received = request.header('x-csrf-token');

        if (!expected || !received) {
            throw new ForbiddenException(
                'Se requiere token CSRF',
            );
        }

        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(received, 'utf8');

        if (
            a.length !== b.length ||
            !timingSafeEqual(a, b)
        ) {
            throw new ForbiddenException(
                'Token CSRF inválido',
            );
        }

        return true;
    }
}
