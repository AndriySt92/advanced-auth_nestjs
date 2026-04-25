import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { User } from '@/generated/prisma/client';

type RequestWithUser = Request & {
    user?: User;
};

type CurrentUserData = 'id' | undefined;
type CurrentUserReturn = User['id'] | User | undefined;

export const CurrentUser = createParamDecorator<
    CurrentUserData,
    CurrentUserReturn
>((data, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (data === 'id' && user) {
        return user.id;
    }
    return user;
});
