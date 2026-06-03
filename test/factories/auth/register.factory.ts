import { RegisterDto } from '@/auth/dto';

export const createRegisterDto = (
    overrides: Partial<RegisterDto> = {},
): RegisterDto => ({
    name: 'New User',
    email: 'new-user2131@example.com',
    password: 'password123',
    passwordRepeat: 'password123',
    ...overrides,
});
