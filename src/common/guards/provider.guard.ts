import {
    CanActivate,
    ExecutionContext,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthMethod } from '@/generated/prisma/enums';

type ProviderRequest = Request<{
    provider: string;
}>;

const SUPPORTED_AUTH_PROVIDERS = new Set(
    Object.values(AuthMethod).map((method) => method.toLowerCase()),
);

@Injectable()
export class ProviderGuard implements CanActivate {
    public canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<ProviderRequest>();
        const provider = request.params.provider?.toLowerCase();

        if (!provider || !SUPPORTED_AUTH_PROVIDERS.has(provider)) {
            throw new NotFoundException(
                `Provider "${request.params.provider}" was not found. Please check the request and try again.`,
            );
        }

        return true;
    }
}

export { ProviderGuard as AuthProviderGuard };
