import { TokenType } from '@/generated/prisma/enums';

export type TokenFixture = {
    id: string;
    email: string;
    token: string;
    type: TokenType;
    expiresIn: Date;
    createdAt: Date;
};

export const createToken = (
    overrides: Partial<TokenFixture> = {},
): TokenFixture => ({
    id: 'token-id',
    email: 'user@example.com',
    token: 'generated-token',
    type: TokenType.TWO_FACTOR,
    expiresIn: new Date('2099-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
});
