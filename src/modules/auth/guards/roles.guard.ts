
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const targets = [
            context.getHandler(),
            context.getClass(),
        ];

        const isPublic =
            this.reflector.getAllAndOverride<boolean>(
                IS_PUBLIC_KEY,
                targets,
            );

        if (isPublic) {
            return true;
        }

        const requiredRoles =
            this.reflector.getAllAndOverride<string[]>(
                ROLES_KEY,
                targets,
            );

        if (!requiredRoles?.length) {
            return true;
        }

        const request =
            context.switchToHttp().getRequest<
                Request & { user?: AuthUser }
            >();

        const roles = request.user?.roles ?? [];

        const authorized = requiredRoles.some(
            (role) => roles.includes(role),
        );

        if (!authorized) {
            throw new ForbiddenException(
                'No tienes permisos para esta operación',
            );
        }

        return true;
    }
}
