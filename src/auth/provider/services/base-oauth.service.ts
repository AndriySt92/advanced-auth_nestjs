import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import type { TypeBaseProviderOptions, TypeUserInfo } from './types';

type OAuthTokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
};

@Injectable()
export class BaseOAuthService {
    private BASE_URL: string = '';

    public constructor(private readonly options: TypeBaseProviderOptions) {}

    protected extractUserInfo(data: Record<string, unknown>): TypeUserInfo {
        const id = this.getStringValue(data, 'id');
        const picture = this.getStringValue(data, 'picture');
        const name = this.getStringValue(data, 'name');
        const email = this.getStringValue(data, 'email');

        return {
            id,
            picture,
            name,
            email,
            provider: this.options.name,
        };
    }

    public getAuthUrl(): string {
        const query = new URLSearchParams({
            response_type: 'code',
            client_id: this.options.client_id,
            redirect_uri: this.getRedirectUrl(),
            scope: (this.options.scopes ?? []).join(' '),
            access_type: 'offline',
            prompt: 'select_account',
        });

        return `${this.options.authorize_url}?${query}`;
    }

    public async findUserByCode(code: string): Promise<TypeUserInfo> {
        const clientId = this.options.client_id;
        const clientSecret = this.options.client_secret;

        const tokenQuery = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: this.getRedirectUrl(),
            grant_type: 'authorization_code',
        });

        const tokensRequest = await fetch(this.options.access_url, {
            method: 'POST',
            body: tokenQuery,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
        });

        if (!tokensRequest.ok) {
            throw new BadRequestException(
                `Failed to fetch tokens from ${this.options.access_url}. Please make sure the authorization code is valid.`,
            );
        }

        const tokens = this.parseTokenResponse(await tokensRequest.json());

        const userRequest = await fetch(this.options.profile_url, {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });

        if (!userRequest.ok) {
            throw new UnauthorizedException(
                `Failed to fetch the user profile from ${this.options.profile_url}. Please verify the access token.`,
            );
        }

        const user = this.parseUserInfoResponse(await userRequest.json());
        const userData = this.extractUserInfo(user);

        return {
            ...userData,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at ?? tokens.expires_in,
            provider: this.options.name,
        };
    }

    public getRedirectUrl(): string {
        return `${this.BASE_URL}/auth/oauth/callback/${this.options.name}`;
    }

    public set baseUrl(value: string) {
        this.BASE_URL = value;
    }

    public get name(): string {
        return this.options.name;
    }

    public get access_url(): string {
        return this.options.access_url;
    }

    public get profile_url(): string {
        return this.options.profile_url;
    }

    public get scopes(): string[] {
        return this.options.scopes;
    }

    private parseTokenResponse(data: unknown): OAuthTokenResponse {
        if (!this.isRecord(data)) {
            throw new BadRequestException(
                `Invalid token response received from ${this.options.access_url}.`,
            );
        }

        const accessToken = data.access_token;

        if (typeof accessToken !== 'string' || accessToken.length === 0) {
            throw new BadRequestException(
                `No access token was returned from ${this.options.access_url}. Please make sure the authorization code is valid.`,
            );
        }

        const refreshToken =
            typeof data.refresh_token === 'string'
                ? data.refresh_token
                : undefined;
        const expiresAt =
            typeof data.expires_at === 'number' ? data.expires_at : undefined;
        const expiresIn =
            typeof data.expires_in === 'number' ? data.expires_in : undefined;

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: expiresAt,
            expires_in: expiresIn,
        };
    }

    private parseUserInfoResponse(data: unknown): Record<string, unknown> {
        if (!this.isRecord(data)) {
            throw new UnauthorizedException(
                `Invalid user profile response received from ${this.options.profile_url}.`,
            );
        }

        return data;
    }

    private getStringValue(data: Record<string, unknown>, key: string): string {
        const value = data[key];

        if (typeof value !== 'string' || value.length === 0) {
            throw new UnauthorizedException(
                `The user profile from ${this.options.profile_url} is missing the required "${key}" field.`,
            );
        }

        return value;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }
}
