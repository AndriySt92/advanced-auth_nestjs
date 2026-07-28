import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/mail/mail.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { RedisModule } from '@/redis/redis.module';
import { UserModule } from '@/user/user.module';

import { SessionModule } from '../session/session.module';
import { TwoFactorAuthService } from './two-factor-auth.service';
import { TwoFactorRateLimitService } from './two-factor-rate-limits.service';

@Module({
    imports: [MailModule, PrismaModule, RedisModule, SessionModule, UserModule],
    providers: [TwoFactorAuthService, TwoFactorRateLimitService],
    exports: [TwoFactorAuthService, TwoFactorRateLimitService],
})
export class TwoFactorAuthModule {}
