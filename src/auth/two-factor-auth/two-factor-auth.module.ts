import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/mail/mail.module';

import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
    imports: [MailModule],
    providers: [TwoFactorAuthService],
    exports: [TwoFactorAuthService],
})
export class TwoFactorAuthModule {}
