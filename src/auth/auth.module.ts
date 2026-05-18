import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoogleRecaptchaModule } from '@nestlab/google-recaptcha';

import { getProvidersConfig } from '@/config/providers.config';
import { getRecaptchaConfig } from '@/config/recaptcha.config';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailConfirmModule } from './email-confirm/email-confirm.module';
import { PasswordRecoveryModule } from './password-recovery/password-recovery.module';
import { ProviderModule } from './provider/provider.module';
import { SessionModule } from './session/session.module';
import { TwoFactorAuthModule } from './two-factor-auth/two-factor-auth.module';

@Module({
    imports: [
        PrismaModule,
        UserModule,
        ProviderModule.registerAsync({
            imports: [ConfigModule],
            useFactory: getProvidersConfig,
            inject: [ConfigService],
        }),
        GoogleRecaptchaModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: getRecaptchaConfig,
            inject: [ConfigService],
        }),

        EmailConfirmModule,
        TwoFactorAuthModule,
        SessionModule,
        PasswordRecoveryModule,
    ],
    controllers: [AuthController],
    providers: [AuthService],
})
export class AuthModule {}
