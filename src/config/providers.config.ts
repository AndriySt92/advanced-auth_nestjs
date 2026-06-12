import { ConfigService } from '@nestjs/config';

import { TypeOptions } from '@/auth/provider/provider.constants';
import { FacebookProvider } from '@/auth/provider/services/facebook.provider';
import { GithubProvider } from '@/auth/provider/services/github.provider';
import { GoogleProvider } from '@/auth/provider/services/google.provider';

export const getProvidersConfig = (
    configService: ConfigService,
): TypeOptions => ({
    baseUrl: configService.getOrThrow<string>('APPLICATION_URL'),
    services: [
        new GoogleProvider({
            client_id: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
            client_secret: configService.getOrThrow<string>(
                'GOOGLE_CLIENT_SECRET',
            ),
            scopes: ['email', 'profile'],
        }),
        new FacebookProvider({
            client_id: configService.getOrThrow<string>('FACEBOOK_CLIENT_ID'),
            client_secret: configService.getOrThrow<string>(
                'FACEBOOK_CLIENT_SECRET',
            ),
            scopes: ['email', 'public_profile'],
        }),
        new GithubProvider({
            client_id: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
            client_secret: configService.getOrThrow<string>(
                'GITHUB_CLIENT_SECRET',
            ),
            scopes: ['read:user', 'user:email'],
        }),
    ],
});
