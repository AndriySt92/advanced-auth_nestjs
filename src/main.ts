import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { createClient, RedisClientType } from 'redis';

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
    const redis: RedisClientType = createClient({
        url: config.getOrThrow<string>('REDIS_URI'),
    });
    await redis.connect();

    app.use(cookieParser(config.getOrThrow<string>('COOKIES_SECRET')));

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
        }),
    );
    app.useGlobalFilters(
        new GlobalExceptionFilter(),
        new HttpExceptionFilter(),
        new PrismaExceptionFilter(),
    );

    const sessionConfig = createSessionConfig(config, redis);
    const corsConfig = createCorsConfig(config);

    app.use(session(sessionConfig));
    app.enableCors(corsConfig);

    await app.listen(config.getOrThrow<number>('APPLICATION_PORT'));
}

void bootstrap();
