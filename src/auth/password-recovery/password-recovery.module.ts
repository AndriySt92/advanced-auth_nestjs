import { Module } from '@nestjs/common';

import { MailModule } from '@/libs/mail/mail.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';

@Module({
    imports: [UserModule, MailModule, PrismaModule],
    controllers: [PasswordRecoveryController],
    providers: [PasswordRecoveryService],
    exports: [PasswordRecoveryService],
})
export class PasswordRecoveryModule {}
