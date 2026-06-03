import { beforeEach, describe, expect, it } from '@jest/globals';

import { ProviderService } from './provider.service';
import { BaseOAuthService } from './services/base-oauth.service';
import { TypeBaseProviderOptions } from './services/types';

describe('ProviderService', () => {
    let googleProvider: BaseOAuthService;
    let githubProvider: BaseOAuthService;
    let service: ProviderService;

    beforeEach(() => {
        googleProvider = createProvider('google');
        githubProvider = createProvider('github');
        service = new ProviderService({
            baseUrl: 'https://api.example.com',
            services: [googleProvider, githubProvider],
        });
    });

    it('sets base url for all providers on module init', () => {
        service.onModuleInit();

        expect(googleProvider.getRedirectUrl()).toBe(
            'https://api.example.com/auth/oauth/callback/google',
        );
        expect(githubProvider.getRedirectUrl()).toBe(
            'https://api.example.com/auth/oauth/callback/github',
        );
    });

    it('finds a provider by service name', () => {
        expect(service.findByService('google')).toBe(googleProvider);
    });

    it('returns null when provider is not configured', () => {
        expect(service.findByService('facebook')).toBeNull();
    });
});

const createProvider = (name: string) =>
    new BaseOAuthService(createProviderOptions(name));

const createProviderOptions = (name: string): TypeBaseProviderOptions => ({
    name,
    authorize_url: `https://${name}.example.com/oauth/authorize`,
    access_url: `https://${name}.example.com/oauth/token`,
    profile_url: `https://${name}.example.com/user`,
    scopes: ['email', 'profile'],
    client_id: `${name}-client-id`,
    client_secret: `${name}-client-secret`,
});
