import type { Server } from 'node:http';

import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { type RedisClientType } from 'redis';
import request from 'supertest';

import { AuthModule } from '@/auth/auth.module';
import { MailService } from '@/libs/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UserModule } from '@/user/user.module';

import {
    clearDatabase,
    closeE2EApp,
    createE2EApp,
    createUserInDb,
    loginUser,
} from '../helpers';

jest.mock('@/libs/mail/mail.service', () => ({
    MailService: class {
        sendConfirmEmail = jest.fn();
        sendPasswordResetEmail = jest.fn();
        sendTwoFactorTokenEmail = jest.fn();
    },
}));

describe('UserController (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let redis: RedisClientType;
    let getHttpServer: () => Server;

    beforeAll(async () => {
        const moduleBuilder = Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
                UserModule,
                AuthModule,
            ],
        })
            .overrideProvider(MailService)
            .useValue({
                sendConfirmEmail: jest.fn(),
                sendPasswordResetEmail: jest.fn(),
                sendTwoFactorTokenEmail: jest.fn(),
            });

        const result = await createE2EApp(moduleBuilder);
        app = result.app;
        prisma = result.prisma;
        redis = result.redis;
        getHttpServer = () => app.getHttpServer() as Server;
    });

    afterAll(async () => {
        await closeE2EApp(app, prisma, redis);
    });

    afterEach(async () => {
        await clearDatabase(prisma, redis);
    });

    it('rejects unauthenticated profile requests', async () => {
        await request(getHttpServer())
            .get('/users/profile')
            .expect(HttpStatus.UNAUTHORIZED); // 401
    });

    it('returns the authenticated user profile', async () => {
        const user = await createUserInDb(prisma);
        const agent = request.agent(getHttpServer());

        const cookie = await loginUser(agent, user.email, 'testpass123');

        const response = await agent
            .get('/users/profile')
            .set('Cookie', cookie)
            .expect(HttpStatus.OK); // 200

        expect(response.body).toMatchObject({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
        });

        const responseBody = response.body as {
            createdAt: string;
            updatedAt: string;
        };

        expect(responseBody.createdAt).toBeDefined();
        expect(responseBody.updatedAt).toBeDefined();
    });

    it('updates the authenticated user profile', async () => {
        const user = await createUserInDb(prisma);
        const agent = request.agent(getHttpServer());

        const cookie = await loginUser(agent, user.email, 'testpass123');

        const dto = {
            email: 'updated@example.com',
            name: 'Updated User',
            isTwoFactorEnabled: true,
        };

        const response = await agent
            .patch('/users/profile')
            .set('Cookie', cookie)
            .send(dto)
            .expect(HttpStatus.OK); // 200

        expect(response.body).toMatchObject({
            id: user.id,
            email: dto.email,
            displayName: dto.name,
            isTwoFactorEnabled: dto.isTwoFactorEnabled,
        });

        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

        expect(dbUser).toMatchObject({
            email: dto.email,
            displayName: dto.name,
            isTwoFactorEnabled: dto.isTwoFactorEnabled,
        });
    });

    it('rejects invalid profile update payloads (validation)', async () => {
        const user = await createUserInDb(prisma);
        const agent = request.agent(getHttpServer());

        const cookie = await loginUser(agent, user.email, 'testpass123');

        await agent
            .patch('/users/profile')
            .set('Cookie', cookie)
            .send({
                email: 'not-an-email',
                name: '',
                isTwoFactorEnabled: 'yes',
            })
            .expect(HttpStatus.BAD_REQUEST); // 400

        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

        expect(dbUser?.email).toBe(user.email);
        expect(dbUser?.displayName).toBe(user.displayName);
        expect(dbUser?.isTwoFactorEnabled).toBe(user.isTwoFactorEnabled);
    });

    it('forbids regular users from reading another user by id', async () => {
        const regularUser = await createUserInDb(prisma, { role: 'REGULAR' });
        const otherUser = await createUserInDb(prisma, {
            email: 'other@example.com',
        });
        const agent = request.agent(getHttpServer());

        const cookie = await loginUser(agent, regularUser.email, 'testpass123');

        await agent
            .get(`/users/${otherUser.id}`)
            .set('Cookie', cookie)
            .expect(HttpStatus.FORBIDDEN); // 403
    });

    it('allows admins to read a user by id', async () => {
        const admin = await createUserInDb(prisma, {
            role: 'ADMIN',
            email: 'admin@example.com',
        });

        const targetUser = await createUserInDb(prisma, {
            email: 'target@example.com',
        });

        const agent = request.agent(getHttpServer());

        const cookie = await loginUser(agent, admin.email, 'testpass123');

        const response = await agent
            .get(`/users/${targetUser.id}`)
            .set('Cookie', cookie)
            .expect(HttpStatus.OK); // 200

        expect(response.body).toMatchObject({
            id: targetUser.id,
            email: targetUser.email,
            displayName: targetUser.displayName,
        });
    });
});
