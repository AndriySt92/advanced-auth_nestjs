import { randomInt } from 'node:crypto';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';

import { TokenType } from '@/generated/prisma/enums';
import type { MailService } from '@/libs/mail/mail.service';
import type { PrismaService } from '@/prisma/prisma.service';

import { TwoFactorAuthService } from './two-factor-auth.service';

jest.mock('@/libs/mail/mail.service', () => ({
    MailService: class MailService {},
}));
jest.mock('node:crypto', () => ({
    randomInt: jest.fn(),
}));

type TwoFactorToken = {
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
            (...args: unknown[]) => Promise<TwoFactorToken>
        >;
    };
};

describe('TwoFactorAuthService', () => {
    let service: TwoFactorAuthService;
    let prismaService: {
        token: {
            findFirst: jest.MockedFunction<
                (...args: unknown[]) => Promise<TwoFactorToken | null>
            >;
            delete: jest.MockedFunction<
                (...args: unknown[]) => Promise<unknown>
            >;
        };
        $transaction: jest.MockedFunction<
            (
                callback: (tx: PrismaTransaction) => Promise<TwoFactorToken>,
            ) => Promise<TwoFactorToken>
        >;
    };
    let mailService: jest.Mocked<Pick<MailService, 'sendTwoFactorTokenEmail'>>;
    let tx: PrismaTransaction;

    beforeEach(() => {
        jest.clearAllMocks();

        tx = {
            token: {
                deleteMany: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
                create: jest.fn<
                    (...args: unknown[]) => Promise<TwoFactorToken>
                >(),
            },
        };
        prismaService = {
            token: {
                findFirst:
                    jest.fn<
                        (...args: unknown[]) => Promise<TwoFactorToken | null>
                    >(),
                delete: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
            },
            $transaction: jest.fn(
                (
                    callback: (
                        transaction: PrismaTransaction,
                    ) => Promise<TwoFactorToken>,
                ) => callback(tx),
            ),
        };
        mailService = {
            sendTwoFactorTokenEmail: jest.fn(),
        };

        service = new TwoFactorAuthService(
            prismaService as unknown as PrismaService,
            mailService as unknown as MailService,
        );
    });

    it('generates a 2FA token, clears old tokens, and sends email', async () => {
        const email = 'user@example.com';
        const token = createToken({ email, token: '123456' });
        mockRandomInt.mockReturnValue(123456);
        tx.token.create.mockResolvedValue(token);
        mailService.sendTwoFactorTokenEmail.mockResolvedValue(undefined);

        await expect(
            service.sendTwoFactorToken(email),
        ).resolves.toBeUndefined();

        expect(tx.token.deleteMany).toHaveBeenCalledWith({
            where: {
                email,
                type: TokenType.TWO_FACTOR,
            },
        });
        expect(tx.token.create).toHaveBeenCalledWith({
            data: {
                email,
                token: '123456',
                expiresIn: expect.any(Date),
                type: TokenType.TWO_FACTOR,
            },
        });
        expect(mailService.sendTwoFactorTokenEmail).toHaveBeenCalledWith(
            email,
            token.token,
        );
    });

    it('validates a matching non-expired 2FA token and deletes it', async () => {
        const token = createToken({
            token: '123456',
            expiresIn: new Date('2099-01-01T00:00:00.000Z'),
        });
        prismaService.token.findFirst.mockResolvedValue(token);
        prismaService.token.delete.mockResolvedValue({});

        await expect(
            service.validateTwoFactorToken(token.email, token.token),
        ).resolves.toBeUndefined();

        expect(prismaService.token.findFirst).toHaveBeenCalledWith({
            where: {
                email: token.email,
                type: TokenType.TWO_FACTOR,
            },
        });
        expect(prismaService.token.delete).toHaveBeenCalledWith({
            where: {
                id: token.id,
                type: TokenType.TWO_FACTOR,
            },
        });
    });

    it('throws when 2FA token is missing', async () => {
        prismaService.token.findFirst.mockResolvedValue(null);

        await expect(
            service.validateTwoFactorToken('user@example.com', '123456'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when 2FA token does not match', async () => {
        prismaService.token.findFirst.mockResolvedValue(
            createToken({
                token: '123456',
                expiresIn: new Date('2099-01-01T00:00:00.000Z'),
            }),
        );

        await expect(
            service.validateTwoFactorToken('user@example.com', '654321'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when 2FA token is expired', async () => {
        prismaService.token.findFirst.mockResolvedValue(
            createToken({
                token: '123456',
                expiresIn: new Date('2020-01-01T00:00:00.000Z'),
            }),
        );

        await expect(
            service.validateTwoFactorToken('user@example.com', '123456'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});

const mockRandomInt = randomInt as unknown as jest.MockedFunction<
    (min: number, max: number) => number
>;

const createToken = (
    overrides: Partial<TwoFactorToken> = {},
): TwoFactorToken => ({
    id: 'token-id',
    email: 'user@example.com',
    token: '123456',
    type: TokenType.TWO_FACTOR,
    expiresIn: new Date('2099-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
});
