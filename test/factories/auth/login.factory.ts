import { LoginDto } from '@/auth/dto';

export const createLoginDto = (
    overrides: Partial<LoginDto> = {},
): LoginDto => ({
    email: 'user@example.com',
    password: 'password123',
    ...overrides,
});
