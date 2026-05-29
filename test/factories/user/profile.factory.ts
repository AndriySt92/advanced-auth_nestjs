import { TypeUserInfo } from '@/auth/provider/services/types';

export const createProfile = (
    overrides: Partial<TypeUserInfo> = {},
): TypeUserInfo => ({
    id: 'provider-user-id',
    email: 'user@example.com',
    name: 'OAuth User',
    picture: 'https://example.com/avatar.png',
    provider: 'google',
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: 3600,
    ...overrides,
});
