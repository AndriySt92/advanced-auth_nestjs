import { applyDecorators, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@/common/guards/auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { UserRole } from '@/generated/prisma/client';

import { Roles } from './roles.decorator';

export function Authorization(...roles: UserRole[]) {
    if (roles.length > 0) {
        return applyDecorators(
            Roles(...roles),
            UseGuards(AuthGuard, RolesGuard),
        );
    }
    return applyDecorators(UseGuards(AuthGuard));
}
