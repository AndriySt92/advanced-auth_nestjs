import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createUserWithAccounts } from '@test/factories/user/user.factory';
import { hash } from 'argon2';

import { TokenType } from '@/generated/prisma/enums';
import type { MailService } from '@/libs/mail/mail.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { UserService } from '@/user/user.service';

import { NewPasswordDto, ResetPasswordDto } from './dto';
import { PasswordRecoveryService } from './password-recovery.service';

jest.mock('@/libs/mail/mail.service', () => ({
    MailService: class MailService {},
}));
jest.mock('argon2', () => ({
    hash: jest.fn(),
}));
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'generated-token'),
}));

type PasswordResetToken = {
    id: string;
    email: string;
    token: string;
    type: TokenType;
    expiresIn: Date;
    createdAt: Date;
};
type PrismaTransaction = {
    token: {
        deleteMany: jest.MockedFunction<
            (...args: unknown[]) => Promise<unknown>
        >;
        create: jest.MockedFunction<
            (...args: unknown[]) => Promise<PasswordResetToken>
        >;
        delete: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    };
    user: {
        update: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    };
};

describe('PasswordRecoveryService', () => {
    let service: PasswordRecoveryService;
    let prismaService: {
        token: {
            findUnique: jest.MockedFunction<
                (...args: unknown[]) => Promise<PasswordResetToken | null>
            >;
        };
        $transaction: jest.MockedFunction<
            (
                callback: (tx: PrismaTransaction) => Promise<unknown>,
            ) => Promise<unknown>
        >;
    };
    let userService: jest.Mocked<Pick<UserService, 'findByEmail'>>;
    let mailService: jest.Mocked<Pick<MailService, 'sendPasswordResetEmail'>>;
    let tx: PrismaTransaction;

    beforeEach(() => {
        jest.clearAllMocks();

        tx = {
            token: {
                deleteMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
                create: jest.fn<
                    (...args: unknown[]) => Promise<PasswordResetToken>
                >(),
                delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
            },
            user: {
                update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
            },
        };
        prismaService = {
            token: {
                findUnique:
                    jest.fn<
                        (
                            ...args: unknown[]
                        ) => Promise<PasswordResetToken | null>
                    >(),
            },
            $transaction: jest.fn(
                (
                    callback: (
                        transaction: PrismaTransaction,
                    ) => Promise<unknown>,
                ) => callback(tx),
            ),
        };
        userService = {
            findByEmail: jest.fn(),
        };
        mailService = {
            sendPasswordResetEmail: jest.fn(),
        };

        service = new PasswordRecoveryService(
            prismaService as unknown as PrismaService,
            userService as unknown as UserService,
            mailService as unknown as MailService,
        );
    });

    it('generates a reset token and sends reset email', async () => {
        const dto: ResetPasswordDto = {
            email: 'user@example.com',
        };
        const token = createToken({ email: dto.email });
        userService.findByEmail.mockResolvedValue(
            createUserWithAccounts({ email: dto.email }),
        );
        tx.token.create.mockResolvedValue(token);
        mailService.sendPasswordResetEmail.mockResolvedValue(undefined);

        await expect(service.resetPassword(dto)).resolves.toBeUndefined();

        expect(tx.token.deleteMany).toHaveBeenCalledWith({
            where: { email: dto.email, type: TokenType.PASSWORD_RESET },
        });
        expect(tx.token.create).toHaveBeenCalledWith({
            data: {
                email: dto.email,
                token: 'generated-token',
                expiresIn: expect.any(Date),
                type: TokenType.PASSWORD_RESET,
            },
        });
        expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
            dto.email,
            token.token,
        );
    });

    it('throws when requesting reset for an unknown user', async () => {
        userService.findByEmail.mockResolvedValue(null as never);

        await expect(
            service.resetPassword({ email: 'missing@example.com' }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when reset token is missing', async () => {
        prismaService.token.findUnique.mockResolvedValue(null);

        await expect(
            service.newPassword({
                password: 'new-password',
                token: 'missing-token',
            }),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when reset token is expired', async () => {
        prismaService.token.findUnique.mockResolvedValue(
            createToken({ expiresIn: new Date('2020-01-01T00:00:00.000Z') }),
        );

        await expect(
            service.newPassword({
                password: 'new-password',
                token: 'expired-token',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('hashes password, updates user, and deletes used token', async () => {
        const dto: NewPasswordDto = {
            password: 'new-password',
            token: 'valid-token',
        };
        const token = createToken({
            token: dto.token,
            expiresIn: new Date('2099-01-01T00:00:00.000Z'),
        });
        const user = createUserWithAccounts({ email: token.email });
        prismaService.token.findUnique.mockResolvedValue(token);
        userService.findByEmail.mockResolvedValue(user);
        jest.mocked(hash).mockResolvedValue('hashed-new-password');

        await expect(service.newPassword(dto)).resolves.toBeUndefined();

        expect(prismaService.token.findUnique).toHaveBeenCalledWith({
            where: {
                token: dto.token,
                type: TokenType.PASSWORD_RESET,
            },
        });
        expect(tx.user.update).toHaveBeenCalledWith({
            where: { id: user.id },
            data: { password: 'hashed-new-password' },
        });
        expect(tx.token.delete).toHaveBeenCalledWith({
            where: { id: token.id, type: TokenType.PASSWORD_RESET },
        });
    });
});

const createToken = (
    overrides: Partial<PasswordResetToken> = {},
): PasswordResetToken => ({
    id: 'token-id',
    email: 'user@example.com',
    token: 'generated-token',
    type: TokenType.PASSWORD_RESET,
    expiresIn: new Date('2099-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
});
