import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import IORedis from 'ioredis';

import {
    GlobalExceptionFilter,
    HttpExceptionFilter,
    PrismaExceptionFilter,
} from '@/common/filters';

import { AppModule } from './app.module';
import { createCorsConfig, createSessionConfig } from './config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const config = app.get(ConfigService);

    const redis = new IORedis(config.getOrThrow<string>('REDIS_URI'));

    app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')));

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
        }),
    );
    app.useGlobalFilters(
        new PrismaExceptionFilter(),
        new HttpExceptionFilter(),
        new GlobalExceptionFilter(),
    );

    const sessionConfig = createSessionConfig(config, redis);
    const corsConfig = createCorsConfig(config);

    app.use(session(sessionConfig));
    app.enableCors(corsConfig);

    await app.listen(config.getOrThrow<number>('APPLICATION_PORT'));
}

void bootstrap();
