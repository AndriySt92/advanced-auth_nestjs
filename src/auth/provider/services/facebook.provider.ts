import { BaseOAuthService } from './base-oauth.service';
import { TypeProviderOptions, TypeUserInfo } from './types';

export class FacebookProvider extends BaseOAuthService {
    constructor(options: TypeProviderOptions) {
        super({
            name: 'facebook',
            authorize_url: 'https://www.facebook.com/v18.0/dialog/oauth',
            access_url: 'https://graph.facebook.com/v18.0/oauth/access_token',
            profile_url:
                'https://graph.facebook.com/v18.0/me?fields=id,name,email,picture',
            scopes: options.scopes,
            client_id: options.client_id,
            client_secret: options.client_secret,
        });
    }

    public extractUserInfo(data: FacebookProfile): TypeUserInfo {
        const pictureUrl = data.picture?.data?.url || '';
        return super.extractUserInfo({
            id: data.id,
            email: data.email,
            name: data.name,
            picture: pictureUrl,
        });
    }
}

interface FacebookProfile extends Record<string, any> {
    id: string;
    name: string;
    email: string;
    picture?: {
        data?: {
            url?: string;
        };
    };
}
