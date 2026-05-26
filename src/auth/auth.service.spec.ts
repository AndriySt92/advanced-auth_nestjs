import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    ConflictException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import {
    createUser,
    createUserWithAccounts,
    UserFixture,
} from '@test/factories/user/user.factory';
import { verify } from 'argon2';
import type { Request, Response } from 'express';

import { AuthMethod } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { EmailConfirmService } from './email-confirm/email-confirm.service';
import { ProviderService } from './provider/provider.service';
import { TypeUserInfo } from './provider/services/types';
import { SessionService } from './session/session.service';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service';

jest.mock('argon2', () => ({
    verify: jest.fn(),
}));
jest.mock('./email-confirm/email-confirm.service', () => ({
    EmailConfirmService: class EmailConfirmService {},
}));
jest.mock('./two-factor-auth/two-factor-auth.service', () => ({
    TwoFactorAuthService: class TwoFactorAuthService {},
}));

type User = UserFixture;
type PrismaTransaction = {
    account: {
        findUnique: jest.MockedFunction<
            (
                ...args: unknown[]
            ) => Promise<{ id: string; user: User | null } | null>
        >;
        update: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
        create: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    };
    user: {
        findUnique: jest.MockedFunction<
            (...args: unknown[]) => Promise<User | null>
        >;
        create: jest.MockedFunction<(...args: unknown[]) => Promise<User>>;
    };
};

describe('AuthService', () => {
    let service: AuthService;
    let prismaService: {
        $transaction: jest.MockedFunction<
            (
                callback: (tx: PrismaTransaction) => Promise<User>,
            ) => Promise<User>
        >;
    };
    let userService: jest.Mocked<Pick<UserService, 'findByEmail' | 'create'>>;
    let providerService: jest.Mocked<Pick<ProviderService, 'findByService'>>;
    let emailConfirmService: jest.Mocked<
        Pick<EmailConfirmService, 'sendVerificationToken'>
    >;
    let twoFactorAuthService: jest.Mocked<
        Pick<
            TwoFactorAuthService,
            'sendTwoFactorToken' | 'validateTwoFactorToken'
        >
    >;
    let sessionService: jest.Mocked<
        Pick<SessionService, 'saveSession' | 'logout'>
    >;
    let tx: PrismaTransaction;

    beforeEach(() => {
        jest.clearAllMocks();

        tx = {
            account: {
                findUnique: jest.fn<
                    (...args: unknown[]) => Promise<{
                        id: string;
                        user: User | null;
                    } | null>
                >(),
                update: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
                create: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
            },
            user: {
                findUnique:
                    jest.fn<(...args: unknown[]) => Promise<User | null>>(),
                create: jest.fn<(...args: unknown[]) => Promise<User>>(),
            },
        };
        prismaService = {
            $transaction: jest.fn(
                (callback: (transaction: PrismaTransaction) => Promise<User>) =>
                    callback(tx),
            ),
        };
        userService = {
            findByEmail: jest.fn(),
            create: jest.fn(),
        };
        providerService = {
            findByService: jest.fn(),
        };
        emailConfirmService = {
            sendVerificationToken: jest.fn(),
        };
        twoFactorAuthService = {
            sendTwoFactorToken: jest.fn(),
            validateTwoFactorToken: jest.fn(),
        };
        sessionService = {
            saveSession: jest.fn(),
            logout: jest.fn(),
        };

        service = new AuthService(
            prismaService as unknown as PrismaService,
            userService as unknown as UserService,
            providerService as unknown as ProviderService,
            emailConfirmService as unknown as EmailConfirmService,
            twoFactorAuthService as unknown as TwoFactorAuthService,
            sessionService as unknown as SessionService,
        );
    });

    it('registers a credentials user and sends verification email', async () => {
        const dto: RegisterDto = {
            name: 'User',
            email: 'user@example.com',
            password: 'password123',
            passwordRepeat: 'password123',
        };
        const user = createUserWithAccounts({ email: dto.email });
        userService.findByEmail.mockResolvedValue(null as never);
        userService.create.mockResolvedValue(user);
        emailConfirmService.sendVerificationToken.mockResolvedValue(true);

        await expect(service.register(dto)).resolves.toBeUndefined();

        expect(userService.create).toHaveBeenCalledWith({
            email: dto.email,
            password: dto.password,
            displayName: dto.name,
            picture: '',
            method: AuthMethod.CREDENTIALS,
            isVerified: false,
        });
        expect(emailConfirmService.sendVerificationToken).toHaveBeenCalledWith(
            dto.email,
        );
    });

    it('throws when registering an existing user', async () => {
        userService.findByEmail.mockResolvedValue(createUserWithAccounts());

        await expect(
            service.register({
                name: 'User',
                email: 'user@example.com',
                password: 'password123',
                passwordRepeat: 'password123',
            }),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws when login password is invalid', async () => {
        const dto = createLoginDto();
        userService.findByEmail.mockResolvedValue(createUserWithAccounts());
        jest.mocked(verify).mockResolvedValue(false);

        await expect(service.login({} as Request, dto)).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
    });

    it('sends verification token when login email is unverified', async () => {
        const dto = createLoginDto();
        const user = createUserWithAccounts({ isVerified: false });
        userService.findByEmail.mockResolvedValue(user);
        jest.mocked(verify).mockResolvedValue(true);
        emailConfirmService.sendVerificationToken.mockResolvedValue(true);

        await expect(service.login({} as Request, dto)).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
        expect(emailConfirmService.sendVerificationToken).toHaveBeenCalledWith(
            user.email,
        );
    });

    it('requests two-factor code when enabled and code is missing', async () => {
        const dto = createLoginDto();
        const user = createUserWithAccounts({ isTwoFactorEnabled: true });
        userService.findByEmail.mockResolvedValue(user);
        jest.mocked(verify).mockResolvedValue(true);
        twoFactorAuthService.sendTwoFactorToken.mockResolvedValue(undefined);

        await expect(service.login({} as Request, dto)).resolves.toEqual({
            message:
                'Check your email. Two-factor authentication code is required.',
        });
        expect(twoFactorAuthService.sendTwoFactorToken).toHaveBeenCalledWith(
            user.email,
        );
        expect(sessionService.saveSession).not.toHaveBeenCalled();
    });

    it('validates two-factor code and saves session', async () => {
        const dto = createLoginDto({ code: '123456' });
        const user = createUserWithAccounts({ isTwoFactorEnabled: true });
        const req = {} as Request;
        userService.findByEmail.mockResolvedValue(user);
        jest.mocked(verify).mockResolvedValue(true);
        twoFactorAuthService.validateTwoFactorToken.mockResolvedValue(
            undefined,
        );
        sessionService.saveSession.mockResolvedValue({ user });

        await expect(service.login(req, dto)).resolves.toEqual({ user });
        expect(
            twoFactorAuthService.validateTwoFactorToken,
        ).toHaveBeenCalledWith(user.email, '123456');
        expect(sessionService.saveSession).toHaveBeenCalledWith(req, user);
    });

    it('saves session after successful login', async () => {
        const dto = createLoginDto();
        const user = createUserWithAccounts();
        const req = {} as Request;
        userService.findByEmail.mockResolvedValue(user);
        jest.mocked(verify).mockResolvedValue(true);
        sessionService.saveSession.mockResolvedValue({ user });

        await expect(service.login(req, dto)).resolves.toEqual({ user });
        expect(sessionService.saveSession).toHaveBeenCalledWith(req, user);
    });

    it('throws when oauth provider is unknown', async () => {
        providerService.findByService.mockReturnValue(null);

        await expect(
            service.extractProfileFromCode({} as Request, 'unknown', 'code'),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('authenticates existing oauth account and updates tokens', async () => {
        const user = createUser();
        const profile = createProfile();
        const req = {} as Request;
        providerService.findByService.mockReturnValue({
            findUserByCode: jest.fn<() => Promise<TypeUserInfo>>(() =>
                Promise.resolve(profile),
            ),
        } as never);
        tx.account.findUnique.mockResolvedValue({
            id: 'account-id',
            user,
        });
        tx.account.update.mockResolvedValue({});
        sessionService.saveSession.mockResolvedValue({ user });

        await expect(
            service.extractProfileFromCode(req, 'google', 'oauth-code'),
        ).resolves.toEqual({ user });
        expect(tx.account.update).toHaveBeenCalledWith({
            where: { id: 'account-id' },
            data: {
                accessToken: profile.access_token,
                refreshToken: profile.refresh_token,
                expiresAt: profile.expires_at,
            },
        });
        expect(sessionService.saveSession).toHaveBeenCalledWith(req, user);
    });

    it('logs out through session service', async () => {
        const req = { session: { userId: 'user-id' } } as Request;
        const res = {} as Response;
        sessionService.logout.mockResolvedValue(undefined);

        await expect(service.logout(req, res)).resolves.toBeUndefined();
        expect(sessionService.logout).toHaveBeenCalledWith(req, res);
    });
});

const createLoginDto = (overrides: Partial<LoginDto> = {}): LoginDto => ({
    email: 'user@example.com',
    password: 'password123',
    ...overrides,
});

const createProfile = (
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
