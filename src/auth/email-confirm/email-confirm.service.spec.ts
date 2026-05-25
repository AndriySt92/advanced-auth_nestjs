import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createUserWithAccounts } from '@test/factories/user/user.factory';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { TokenType } from '@/generated/prisma/enums';
import type { MailService } from '@/libs/mail/mail.service';
import type { PrismaService } from '@/prisma/prisma.service';
import type { UserService } from '@/user/user.service';

import { SessionService } from '../session/session.service';
import { EmailConfirmService } from './email-confirm.service';

jest.mock('@/libs/mail/mail.service', () => ({
    MailService: class MailService {},
}));
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'generated-verification-token'),
}));

type VerificationToken = {
    id: string;
    email: string;
    token: string;
    type: TokenType;
    expiresIn: Date;
    createdAt: Date;
};
type PrismaPromiseMock = { __prismaPromise: true };
type PrismaServiceMock = {
    token: {
        findUnique: jest.MockedFunction<
            (...args: unknown[]) => Promise<VerificationToken | null>
        >;
        findFirst: jest.MockedFunction<
            (...args: unknown[]) => Promise<VerificationToken | null>
        >;
        create: jest.MockedFunction<
            (...args: unknown[]) => Promise<VerificationToken>
        >;
        delete: jest.MockedFunction<(...args: unknown[]) => PrismaPromiseMock>;
    };
    user: {
        update: jest.MockedFunction<(...args: unknown[]) => PrismaPromiseMock>;
    };
    $transaction: jest.MockedFunction<
        (queries: PrismaPromiseMock[]) => Promise<unknown[]>
    >;
};

describe('EmailConfirmService', () => {
    let service: EmailConfirmService;
    let prismaService: PrismaServiceMock;
    let mailService: jest.Mocked<Pick<MailService, 'sendConfirmEmail'>>;
    let userService: jest.Mocked<Pick<UserService, 'findByEmail'>>;
    let sessionService: jest.Mocked<Pick<SessionService, 'saveSession'>>;

    beforeEach(() => {
        jest.clearAllMocks();

        prismaService = {
            token: {
                findUnique:
                    jest.fn<
                        (
                            ...args: unknown[]
                        ) => Promise<VerificationToken | null>
                    >(),
                findFirst:
                    jest.fn<
                        (
                            ...args: unknown[]
                        ) => Promise<VerificationToken | null>
                    >(),
                create: jest.fn<
                    (...args: unknown[]) => Promise<VerificationToken>
                >(),
                delete: jest.fn<(...args: unknown[]) => PrismaPromiseMock>(),
            },
            user: {
                update: jest.fn<(...args: unknown[]) => PrismaPromiseMock>(),
            },
            $transaction: jest.fn((queries: PrismaPromiseMock[]) =>
                Promise.resolve(queries),
            ),
        };
        mailService = {
            sendConfirmEmail: jest.fn(),
        };
        userService = {
            findByEmail: jest.fn(),
        };
        sessionService = {
            saveSession: jest.fn(),
        };

        service = new EmailConfirmService(
            prismaService as unknown as PrismaService,
            mailService as unknown as MailService,
            userService as unknown as UserService,
            sessionService as unknown as SessionService,
        );
    });

    it('creates a verification token and sends confirmation email', async () => {
        const email = 'user@example.com';
        const token = createToken({ email });
        prismaService.token.findFirst.mockResolvedValue(null);
        prismaService.token.create.mockResolvedValue(token);
        mailService.sendConfirmEmail.mockResolvedValue(undefined);

        await expect(service.sendVerificationToken(email)).resolves.toBe(true);

        expect(uuidv4).toHaveBeenCalledTimes(1);
        expect(prismaService.token.findFirst).toHaveBeenCalledWith({
            where: {
                email,
                type: TokenType.VERIFICATION,
            },
        });
        expect(prismaService.token.create).toHaveBeenCalledWith({
            data: {
                email,
                token: 'generated-verification-token',
                expiresIn: expect.any(Date),
                type: TokenType.VERIFICATION,
            },
        });
        expect(mailService.sendConfirmEmail).toHaveBeenCalledWith(
            email,
            token.token,
        );
    });

    it('deletes an existing verification token before creating a new one', async () => {
        const email = 'user@example.com';
        const existingToken = createToken({ id: 'old-token-id', email });
        const newToken = createToken({ id: 'new-token-id', email });
        const deleteQuery = createPrismaPromise();
        prismaService.token.findFirst.mockResolvedValue(existingToken);
        prismaService.token.delete.mockReturnValue(deleteQuery);
        prismaService.token.create.mockResolvedValue(newToken);
        mailService.sendConfirmEmail.mockResolvedValue(undefined);

        await expect(service.sendVerificationToken(email)).resolves.toBe(true);

        expect(prismaService.token.delete).toHaveBeenCalledWith({
            where: {
                id: existingToken.id,
                type: TokenType.VERIFICATION,
            },
        });
    });

    it('throws when verification token is missing', async () => {
        prismaService.token.findUnique.mockResolvedValue(null);

        await expect(
            service.newVerification({} as Request, 'missing-token'),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when verification token is expired', async () => {
        prismaService.token.findUnique.mockResolvedValue(
            createToken({ expiresIn: new Date('2020-01-01T00:00:00.000Z') }),
        );

        await expect(
            service.newVerification({} as Request, 'expired-token'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks user as verified, deletes token, and saves session', async () => {
        const req = {} as Request;
        const token = createToken({
            token: 'valid-token',
            expiresIn: new Date('2099-01-01T00:00:00.000Z'),
        });
        const user = createUserWithAccounts({ email: token.email });
        const userUpdateQuery = createPrismaPromise();
        const tokenDeleteQuery = createPrismaPromise();
        prismaService.token.findUnique.mockResolvedValue(token);
        userService.findByEmail.mockResolvedValue(user);
        prismaService.user.update.mockReturnValue(userUpdateQuery);
        prismaService.token.delete.mockReturnValue(tokenDeleteQuery);
        sessionService.saveSession.mockResolvedValue({ user });

        await expect(
            service.newVerification(req, token.token),
        ).resolves.toBeUndefined();

        expect(prismaService.token.findUnique).toHaveBeenCalledWith({
            where: {
                token: token.token,
                type: TokenType.VERIFICATION,
            },
        });
        expect(prismaService.user.update).toHaveBeenCalledWith({
            where: {
                id: user.id,
            },
            data: {
                isVerified: true,
            },
        });
        expect(prismaService.token.delete).toHaveBeenCalledWith({
            where: {
                id: token.id,
                type: TokenType.VERIFICATION,
            },
        });
        expect(prismaService.$transaction).toHaveBeenCalledWith([
            userUpdateQuery,
            tokenDeleteQuery,
        ]);
        expect(sessionService.saveSession).toHaveBeenCalledWith(req, user);
    });
});

const createPrismaPromise = (): PrismaPromiseMock => ({
    __prismaPromise: true,
});

const createToken = (
    overrides: Partial<VerificationToken> = {},
): VerificationToken => ({
    id: 'token-id',
    email: 'user@example.com',
    token: 'generated-verification-token',
    type: TokenType.VERIFICATION,
    expiresIn: new Date('2099-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
});
