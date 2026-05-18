import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/mail/mail.module';
import { PrismaModule } from '@/prisma/prisma.module';

import { TwoFactorAuthService } from './two-factor-auth.service';

@Module({
    imports: [MailModule, PrismaModule],
    providers: [TwoFactorAuthService],
    exports: [TwoFactorAuthService],
})
export class TwoFactorAuthModule {}
