import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { createUserWithAccounts } from '@test/factories';
import { createPrismaMock, type PrismaMock } from '@test/mocks';
import { hash } from 'argon2';

import { AuthMethod, UserRole } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';

import { CreateUserDto, UpdateUserDto } from './dto';
import { UserService } from './user.service';

type UpdatedUser = Awaited<ReturnType<UserService['update']>>;

jest.mock('argon2', () => ({
    hash: jest.fn(),
}));

describe('UserService', () => {
    let service: UserService;
    let prismaMock: PrismaMock;

    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock = createPrismaMock();

        service = new UserService(prismaMock as unknown as PrismaService);
    });

    it('finds a user by id with accounts', async () => {
        const user = createUserWithAccounts();
        prismaMock.user.findUnique.mockResolvedValue(user);

        await expect(service.findById('user-id')).resolves.toBe(user);

        expect(prismaMock.user.findUnique.mock.calls[0][0]).toEqual({
            where: { id: 'user-id' },
            include: { accounts: true },
        });
    });

    it('throws NotFoundException when a user id does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        await expect(service.findById('missing-id')).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('finds a user by email with accounts', async () => {
        const user = createUserWithAccounts({
            email: 'user@example.com',
        });
        prismaMock.user.findUnique.mockResolvedValue(user);

        await expect(service.findByEmail('user@example.com')).resolves.toBe(
            user,
        );

        expect(prismaMock.user.findUnique.mock.calls[0][0]).toEqual({
            where: { email: 'user@example.com' },
            include: { accounts: true },
        });
    });

    it('hashes passwords when creating credentials users', async () => {
        const dto: CreateUserDto = {
            email: 'user@example.com',
            password: 'password123',
            displayName: 'User',
            method: AuthMethod.CREDENTIALS,
            isVerified: false,
        };

        const createdUser = createUserWithAccounts({
            email: dto.email,
        });

        jest.mocked(hash).mockResolvedValue('hashed-password');
        prismaMock.user.create.mockResolvedValue(createdUser);

        await expect(service.create(dto)).resolves.toBe(createdUser);

        expect(hash).toHaveBeenCalledWith('password123');
        expect(prismaMock.user.create.mock.calls[0][0]).toEqual({
            data: {
                email: dto.email,
                password: 'hashed-password',
                displayName: dto.displayName,
                picture: undefined,
                method: dto.method,
                isVerified: dto.isVerified,
            },
            include: { accounts: true },
        });
    });

    it('creates oauth users with an empty password', async () => {
        const dto: CreateUserDto = {
            email: 'oauth@example.com',
            displayName: 'OAuth User',
            picture: 'https://example.com/avatar.png',
            method: AuthMethod.GOOGLE,
            isVerified: true,
        };

        const createdUser = createUserWithAccounts({
            email: dto.email,
            displayName: dto.displayName,
            method: dto.method,
            picture: dto.picture,
            isVerified: dto.isVerified,
        });

        prismaMock.user.create.mockResolvedValue(createdUser);

        await expect(service.create(dto)).resolves.toBe(createdUser);

        expect(hash).not.toHaveBeenCalled();
        expect(prismaMock.user.create.mock.calls[0][0]).toEqual({
            data: {
                email: dto.email,
                password: '',
                displayName: dto.displayName,
                picture: dto.picture,
                method: dto.method,
                isVerified: dto.isVerified,
            },
            include: { accounts: true },
        });
    });

    it('updates user profile fields', async () => {
        const dto: UpdateUserDto = {
            email: 'updated@example.com',
            name: 'Updated User',
            isTwoFactorEnabled: true,
        };

        const updatedUser: UpdatedUser = {
            id: 'user-id',
            email: dto.email,
            password: 'hashed-password',
            displayName: dto.name,
            picture: null,
            role: UserRole.REGULAR,
            isVerified: false,
            isTwoFactorEnabled: dto.isTwoFactorEnabled,
            method: AuthMethod.CREDENTIALS,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        };

        prismaMock.user.update.mockResolvedValue(updatedUser);

        await expect(service.update('user-id', dto)).resolves.toBe(updatedUser);

        expect(prismaMock.user.update.mock.calls[0][0]).toEqual({
            where: { id: 'user-id' },
            data: {
                email: dto.email,
                displayName: dto.name,
                isTwoFactorEnabled: dto.isTwoFactorEnabled,
            },
        });
    });
});
