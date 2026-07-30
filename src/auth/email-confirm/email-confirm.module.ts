import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/mail/mail.module';
import { RedisModule } from '@/redis/redis.module';
import { UserModule } from '@/user/user.module';

import { SessionModule } from '../session/session.module';
import { EmailConfirmController } from './email-confirm.controller';
import { EmailConfirmService } from './email-confirm.service';

@Module({
    imports: [MailModule, SessionModule, UserModule, RedisModule],
    controllers: [EmailConfirmController],
    providers: [EmailConfirmService],
    exports: [EmailConfirmService],
})
export class EmailConfirmModule {}
