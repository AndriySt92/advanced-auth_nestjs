import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { InternalServerErrorException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import type { User } from '@/generated/prisma/client';
import { AuthMethod, UserRole } from '@/generated/prisma/enums';

import { SessionService } from './session.service';

type SessionMock = {
    userId?: string;
    save: jest.MockedFunction<(callback: (err: Error | null) => void) => void>;
    destroy: jest.MockedFunction<
        (callback: (err: Error | null) => void) => void
    >;
};
type ConfigServiceMock = {
    getOrThrow: jest.MockedFunction<(key: string) => string>;
};

describe('SessionService', () => {
    let service: SessionService;
    let configService: ConfigServiceMock;

    beforeEach(() => {
        configService = {
            getOrThrow: jest.fn<(key: string) => string>(),
        };

        service = new SessionService(configService as unknown as ConfigService);
    });

    it('saves user id to session and resolves with user', async () => {
        const session = createSession();
        const req = createRequest(session);
        const user = createUser();

        await expect(service.saveSession(req, user)).resolves.toEqual({ user });
        expect(session.userId).toBe(user.id);
        expect(session.save).toHaveBeenCalledTimes(1);
    });

    it('rejects when session save fails', async () => {
        const session = createSession({
            save: jest.fn((callback: (err: Error | null) => void) => {
                callback(new Error('save failed'));
            }),
        });

        await expect(
            service.saveSession(createRequest(session), createUser()),
        ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('destroys session and clears session cookie on logout', async () => {
        const session = createSession();
        const req = createRequest(session);
        const clearCookie = jest.fn();
        const res = { clearCookie } as unknown as Response;
        configService.getOrThrow.mockReturnValue('sid');

        await expect(service.logout(req, res)).resolves.toBeUndefined();

        expect(session.destroy).toHaveBeenCalledTimes(1);
        expect(configService.getOrThrow).toHaveBeenCalledWith('SESSION_NAME');
        expect(clearCookie).toHaveBeenCalledWith('sid');
    });

    it('rejects when session destroy fails', async () => {
        const session = createSession({
            destroy: jest.fn((callback: (err: Error | null) => void) => {
                callback(new Error('destroy failed'));
            }),
        });

        await expect(
            service.logout(createRequest(session), {} as Response),
        ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
});

const createSession = (overrides: Partial<SessionMock> = {}): SessionMock => ({
    save: jest.fn((callback: (err: Error | null) => void) => {
        callback(null);
    }),
    destroy: jest.fn((callback: (err: Error | null) => void) => {
        callback(null);
    }),
    ...overrides,
});

const createRequest = (session: SessionMock): Request =>
    ({
        session,
    }) as unknown as Request;

const createUser = (): User => ({
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
});
