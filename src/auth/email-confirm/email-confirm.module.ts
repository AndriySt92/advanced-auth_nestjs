import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/mail/mail.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { SessionModule } from '../session/session.module';
import { EmailConfirmController } from './email-confirm.controller';
import { EmailConfirmService } from './email-confirm.service';

@Module({
    imports: [MailModule, SessionModule, UserModule, PrismaModule],
    controllers: [EmailConfirmController],
    providers: [EmailConfirmService],
    exports: [EmailConfirmService],
})
export class EmailConfirmModule {}
