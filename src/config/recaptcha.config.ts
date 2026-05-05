import { ConfigService } from '@nestjs/config';
import { GoogleRecaptchaModuleOptions } from '@nestlab/google-recaptcha';

import { isDev } from '@/common/utils/is-dev.util';

export const getRecaptchaConfig = (
    configService: ConfigService,
): GoogleRecaptchaModuleOptions => ({
    secretKey: configService.getOrThrow<string>('GOOGLE_RECAPTCHA_SECRET_KEY'),
    response: (req: { headers: { recaptcha: string } }) =>
        req.headers.recaptcha,
    skipIf: isDev(configService),
});
