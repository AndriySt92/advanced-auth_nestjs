import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '@/auth/auth.module';
import { IS_DEV_ENV } from '@/common/utils';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            ignoreEnvFile: !IS_DEV_ENV,
            isGlobal: true,
            expandVariables: true,
        }),
        PrismaModule,
        AuthModule,
        UserModule,
    ],
})
export class AppModule {}
