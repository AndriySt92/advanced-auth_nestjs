import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import { BaseOAuthService } from './base-oauth.service';
import { TypeBaseProviderOptions } from './types';

describe('BaseOAuthService', () => {
    let service: BaseOAuthService;
    let fetchMock: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        fetchMock = jest.fn<typeof fetch>();
        global.fetch = fetchMock;

        service = new BaseOAuthService(createProviderOptions());
        service.baseUrl = 'https://api.example.com';
    });

    it('returns provider metadata from getters', () => {
        expect(service.name).toBe('google');
        expect(service.access_url).toBe('https://google.example.com/token');
        expect(service.profile_url).toBe('https://google.example.com/user');
        expect(service.scopes).toEqual(['email', 'profile']);
    });

    it('builds redirect url from base url and provider name', () => {
        expect(service.getRedirectUrl()).toBe(
            'https://api.example.com/auth/oauth/callback/google',
        );
    });

    it('builds auth url with oauth query params', () => {
        const authUrl = new URL(service.getAuthUrl());

        expect(authUrl.origin + authUrl.pathname).toBe(
            'https://google.example.com/authorize',
        );
        expect(authUrl.searchParams.get('response_type')).toBe('code');
        expect(authUrl.searchParams.get('client_id')).toBe('client-id');
        expect(authUrl.searchParams.get('redirect_uri')).toBe(
            'https://api.example.com/auth/oauth/callback/google',
        );
        expect(authUrl.searchParams.get('scope')).toBe('email profile');
        expect(authUrl.searchParams.get('access_type')).toBe('offline');
        expect(authUrl.searchParams.get('prompt')).toBe('select_account');
    });

    it('exchanges code, fetches profile, and returns normalized user info', async () => {
        fetchMock
            .mockResolvedValueOnce(
                createFetchResponse({
                    access_token: 'access-token',
                    refresh_token: 'refresh-token',
                    expires_in: 3600,
                }),
            )
            .mockResolvedValueOnce(
                createFetchResponse({
                    id: 'provider-user-id',
                    email: 'user@example.com',
                    name: 'OAuth User',
                    picture: 'https://example.com/avatar.png',
                }),
            );

        await expect(service.findUserByCode('oauth-code')).resolves.toEqual({
            id: 'provider-user-id',
            email: 'user@example.com',
            name: 'OAuth User',
            picture: 'https://example.com/avatar.png',
            provider: 'google',
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: 3600,
        });

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://google.example.com/token',
            {
                method: 'POST',
                body: expect.any(URLSearchParams),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json',
                },
            },
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            'https://google.example.com/user',
            {
                headers: { Authorization: 'Bearer access-token' },
            },
        );
    });

    it('throws BadRequestException when token exchange fails', async () => {
        fetchMock.mockResolvedValueOnce(createFetchResponse({}, false));

        await expect(service.findUserByCode('bad-code')).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('throws BadRequestException when token response has no access token', async () => {
        fetchMock.mockResolvedValueOnce(createFetchResponse({}));

        await expect(service.findUserByCode('bad-code')).rejects.toBeInstanceOf(
            BadRequestException,
        );
    });

    it('throws UnauthorizedException when profile request fails', async () => {
        fetchMock
            .mockResolvedValueOnce(
                createFetchResponse({ access_token: 'access-token' }),
            )
            .mockResolvedValueOnce(createFetchResponse({}, false));

        await expect(
            service.findUserByCode('oauth-code'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when profile is missing required fields', async () => {
        fetchMock
            .mockResolvedValueOnce(
                createFetchResponse({ access_token: 'access-token' }),
            )
            .mockResolvedValueOnce(
                createFetchResponse({
                    id: 'provider-user-id',
                    email: 'user@example.com',
                    name: 'OAuth User',
                }),
            );

        await expect(
            service.findUserByCode('oauth-code'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });
});

const createProviderOptions = (): TypeBaseProviderOptions => ({
    name: 'google',
    authorize_url: 'https://google.example.com/authorize',
    access_url: 'https://google.example.com/token',
    profile_url: 'https://google.example.com/user',
    scopes: ['email', 'profile'],
    client_id: 'client-id',
    client_secret: 'client-secret',
});

const createFetchResponse = (body: unknown, ok = true): Response =>
    ({
        ok,
        json: () => Promise.resolve(body),
    }) as Response;
