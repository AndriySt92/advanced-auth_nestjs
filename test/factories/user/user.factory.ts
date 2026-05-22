import type { Account, User } from '@/generated/prisma/client';
import { AuthMethod, UserRole } from '@/generated/prisma/client';

export type UserFixture = User;
export type UserWithAccountsFixture = User & { accounts: Account[] };

export const createUser = (
    overrides: Partial<UserFixture> = {},
): UserFixture => ({
    id: 'user-id',
    email: 'user@example.com',
    password: 'hashed-password',
    displayName: 'User',
    picture: null,
    role: UserRole.REGULAR,
    isVerified: true,
    isTwoFactorEnabled: false,
    method: AuthMethod.CREDENTIALS,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
});

export const createUserWithAccounts = (
    overrides: Partial<UserWithAccountsFixture> = {},
): UserWithAccountsFixture => ({
    ...createUser(overrides),
    accounts: [],
    ...overrides,
});
