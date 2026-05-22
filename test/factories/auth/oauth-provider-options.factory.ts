import { TypeBaseProviderOptions } from '@/auth/provider/services/types';

export const createProviderOptions = (
    name: string = 'google',
    overrides: Partial<TypeBaseProviderOptions> = {},
): TypeBaseProviderOptions => ({
    name,
    authorize_url: `https://${name}.example.com/oauth/authorize`,
    access_url: `https://${name}.example.com/oauth/token`,
    profile_url: `https://${name}.example.com/user`,
    scopes: ['email', 'profile'],
    client_id: `${name}-client-id`,
    client_secret: `${name}-client-secret`,
    ...overrides,
});
