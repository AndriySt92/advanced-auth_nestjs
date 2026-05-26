import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createUser } from '@test/factories';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { ProviderService } from './provider/provider.service';

jest.mock('./email-confirm/email-confirm.service', () => ({
    EmailConfirmService: class EmailConfirmService {},
}));
jest.mock('./two-factor-auth/two-factor-auth.service', () => ({
    TwoFactorAuthService: class TwoFactorAuthService {},
}));

type ConfigServiceMock = {
    getOrThrow: jest.MockedFunction<(key: string) => string>;
};

describe('AuthController', () => {
    let controller: AuthController;
    let authService: jest.Mocked<
        Pick<
            AuthService,
            'register' | 'login' | 'extractProfileFromCode' | 'logout'
        >
    >;
    let providerService: jest.Mocked<Pick<ProviderService, 'findByService'>>;
    let configService: ConfigServiceMock;

    beforeEach(() => {
        authService = {
            register: jest.fn(),
            login: jest.fn(),
            extractProfileFromCode: jest.fn(),
            logout: jest.fn(),
        };
        providerService = {
            findByService: jest.fn(),
        };
        configService = {
            getOrThrow: jest.fn<(key: string) => string>(),
        };

        controller = new AuthController(
            authService as unknown as AuthService,
            providerService as unknown as ProviderService,
            configService as unknown as ConfigService,
        );
    });

    it('registers a user and returns a success message', async () => {
        const dto: RegisterDto = {
            name: 'User',
            email: 'user@example.com',
            password: 'password123',
            passwordRepeat: 'password123',
        };
        authService.register.mockResolvedValue(undefined);

        await expect(controller.register(dto)).resolves.toEqual({
            message:
                'You have successfully registered. Please confirm your email. A message has been sent to your email address.',
        });
        expect(authService.register).toHaveBeenCalledWith(dto);
    });

    it('delegates login to the auth service', async () => {
        const req = {} as Request;
        const dto: LoginDto = {
            email: 'user@example.com',
            password: 'password123',
        };
        const result = { message: 'Check your email.' };
        authService.login.mockResolvedValue(result);

        await expect(controller.login(req, dto)).resolves.toBe(result);
        expect(authService.login).toHaveBeenCalledWith(req, dto);
    });

    it('throws when oauth callback has no code', async () => {
        await expect(
            controller.callback({} as Request, {} as Response, '', 'google'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('extracts oauth profile and redirects to settings', async () => {
        const req = {} as Request;
        const redirect = jest.fn();
        const res = {
            redirect,
        } as unknown as Response;
        authService.extractProfileFromCode.mockResolvedValue({
            user: createUser(),
        });
        configService.getOrThrow.mockReturnValue('https://app.example.com');

        await controller.callback(req, res, 'oauth-code', 'google');

        expect(authService.extractProfileFromCode).toHaveBeenCalledWith(
            req,
            'google',
            'oauth-code',
        );
        expect(redirect).toHaveBeenCalledWith(
            'https://app.example.com/dashboard/settings',
        );
    });

    it('returns provider auth url', () => {
        const provider = {
            getAuthUrl: jest.fn(() => 'https://provider.example.com/auth'),
        };
        providerService.findByService.mockReturnValue(provider as never);

        expect(controller.connect('google')).toEqual({
            url: 'https://provider.example.com/auth',
        });
        expect(providerService.findByService).toHaveBeenCalledWith('google');
    });

    it('logs out and returns a success message', async () => {
        const req = {} as Request;
        const res = {} as Response;
        authService.logout.mockResolvedValue(undefined);

        await expect(controller.logout(req, res)).resolves.toEqual({
            message: 'Logged out successfully',
        });
        expect(authService.logout).toHaveBeenCalledWith(req, res);
    });
});
