import { ConfigService } from '@nestjs/config';
import { MailerOptions } from '@nestjs-modules/mailer';

import { isDev } from '@/common/utils/is-dev.util';

export const getMailerConfig = (
    configService: ConfigService,
): MailerOptions => ({
    transport: {
        host: configService.getOrThrow<string>('MAIL_HOST'),
        port: configService.getOrThrow<number>('MAIL_PORT'),
        secure: !isDev(configService),
        auth: {
            user: configService.getOrThrow<string>('MAIL_USER'),
            pass: configService.getOrThrow<string>('MAIL_PASSWORD'),
        },
        tls: {
            rejectUnauthorized: false,
        },
    },
    defaults: {
        from: `"Max Team" ${configService.getOrThrow<string>('MAIL_USER')}`,
    },
});
