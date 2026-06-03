import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TestingModuleBuilder } from '@nestjs/testing';
import session from 'express-session';
import { createClient, RedisClientType } from 'redis';

import { createSessionConfig } from '@/config/session.config';
import { PrismaService } from '@/prisma/prisma.service';

export async function createE2EApp(
    moduleBuilder: TestingModuleBuilder,
): Promise<{
    app: INestApplication;
    prisma: PrismaService;
    redis: RedisClientType;
}> {
    const moduleFixture = await moduleBuilder.compile();

    const app = moduleFixture.createNestApplication();
    const prisma = app.get(PrismaService);
    const redis: RedisClientType = createClient({ url: process.env.REDIS_URL });
    redis.on('error', (err) => console.error('Redis Client Error', err));
    await redis.connect();

    const configService = app.get(ConfigService);

    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
        }),
    );

    app.use(session(createSessionConfig(configService, redis)));

    await app.init();

    return { app, prisma, redis };
}

export async function closeE2EApp(
    app?: INestApplication,
    prisma?: PrismaService,
    redis?: RedisClientType,
) {
    if (app) {
        await app.close();
    }
    if (redis) {
        await redis.quit();
    }
    if (prisma) {
        await prisma.$disconnect();
    }
}

export async function clearDatabase(
    prisma: PrismaService,
    redis: RedisClientType,
    options: { tables?: string[] } = {},
) {
    const tablesToClear = options.tables ?? ['users', 'accounts'];
    for (const table of tablesToClear) {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
    await redis.flushDb();
}
