
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import {
    ROLES_KEY,
} from '../decorators/roles.decorator.js';

import type {
    AuthUser,
} from '../interfaces/auth-user.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ) { }

    canActivate(
        context: ExecutionContext,
    ): boolean {
        const requiredRoles =
            this.reflector.getAllAndOverride<string[]>(
                ROLES_KEY,
                [
                    context.getHandler(),
                    context.getClass(),
                ],
            );

        if (!requiredRoles?.length) {
            return true;
        }

        const request =
            context.switchToHttp().getRequest<{
                user?: AuthUser;
            }>();

        const user = request.user;

        if (
            !user ||
            !requiredRoles.some((role) =>
                user.roles.includes(role),
            )
        ) {
            throw new ForbiddenException(
                'No tienes permisos para realizar esta operación',
            );
        }

        return true;
    }
}
