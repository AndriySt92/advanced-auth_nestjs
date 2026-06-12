import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { User } from '@/generated/prisma/client';
import { UserService } from '@/user/user.service';

type RequestWithUser = Request & {
    user?: User;
};

@Injectable()
export class AuthGuard implements CanActivate {
    public constructor(private readonly userService: UserService) {}

    public async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const userId = request.session.userId;

        if (!userId) {
            throw new UnauthorizedException(
                'User is not authenticated. Please sign in to continue.',
            );
        }

        request.user = await this.userService.findById(userId);

        return true;
    }
}
