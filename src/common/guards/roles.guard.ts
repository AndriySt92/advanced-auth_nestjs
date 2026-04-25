import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES_KEY } from '@/common/decorators';
import type { User, UserRole } from '@/generated/prisma/client';

type RequestWithUser = Request & {
    user?: User;
};

@Injectable()
export class RolesGuard implements CanActivate {
    public constructor(private readonly reflector: Reflector) {}

    public canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const userRole = request.user?.role;

        if (!roles) return true;

        if (!userRole || !roles.includes(userRole)) {
            throw new ForbiddenException(
                'Insufficient permissions. You do not have access to this resource.',
            );
        }

        return true;
    }
}
