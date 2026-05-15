import { BadRequestException } from '@nestjs/common';

import { BaseOAuthService } from './base-oauth.service';
import { TypeProviderOptions, TypeUserInfo } from './types';

export class GithubProvider extends BaseOAuthService {
    constructor(options: TypeProviderOptions) {
        super({
            name: 'github',
            authorize_url: 'https://github.com/login/oauth/authorize',
            access_url: 'https://github.com/login/oauth/access_token',
            profile_url: 'https://api.github.com/user',
            scopes: options.scopes,
            client_id: options.client_id,
            client_secret: options.client_secret,
        });
    }

    private async fetchUserEmails(accessToken: string): Promise<GithubEmail[]> {
        const response = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            throw new BadRequestException('Failed to fetch user emails');
        }

        return response.json() as Promise<GithubEmail[]>;
    }

    public async findUserByCode(code: string): Promise<TypeUserInfo> {
        this.logger.debug(
            `Starting findUserByCode for provider ${this.options.name}`,
        );
        const tokens = await this.exchangeCodeForTokens(code);
        const user = (await this.fetchUserProfile(
            tokens.access_token,
        )) as GithubProfile;

        const emails = await this.fetchUserEmails(tokens.access_token);
        const primaryEmail = emails.find((e) => e.primary)?.email || '';

        const extractedUserData = this.extractUserInfo({
            ...user,
            email: primaryEmail,
        });

        this.logger.log(
            `User authenticated via ${this.options.name}: ${extractedUserData.email}`,
        );

        return {
            ...extractedUserData,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: tokens.expires_at ?? tokens.expires_in,
            provider: this.options.name,
        };
    }

    public extractUserInfo(data: GithubProfile): TypeUserInfo {
        return super.extractUserInfo({
            id: String(data.id),
            email: data.email ?? '',
            name: data.name ?? data.login,
            picture: data.avatar_url,
        });
    }
}

interface GithubEmail {
    email: string;
    primary: boolean;
    verified: boolean;
    visibility: string | null;
}

interface GithubProfile extends Record<string, unknown> {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string;
    html_url: string;
    bio?: string | null;
    company?: string | null;
    location?: string | null;
    followers?: number;
    following?: number;
    public_repos?: number;
    created_at?: string;
    updated_at?: string;
}
