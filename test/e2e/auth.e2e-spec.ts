import type { Server } from 'node:http';

import { HttpStatus, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { type RedisClientType } from 'redis';
import request from 'supertest';

import { AuthModule } from '@/auth/auth.module';
import { EmailConfirmService } from '@/auth/email-confirm/email-confirm.service';
import { ProviderService } from '@/auth/provider/provider.service';
import { MailService } from '@/libs/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';

import { createRegisterDto } from '../factories';
import {
    buildCookieHeader,
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

describe('AuthController (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let redis: RedisClientType;
    let getHttpServer: () => Server;

    const providerServiceMock = {
        findByService: jest.fn(),
    };

    beforeAll(async () => {
        const emailConfirmServiceMock = {
            sendVerificationToken: jest.fn().mockResolvedValue(undefined),
        };
        const mailServiceMock = {
            sendConfirmEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendTwoFactorTokenEmail: jest.fn().mockResolvedValue(undefined),
        };
        const moduleBuilder = Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                }),
                AuthModule,
            ],
        })
            .overrideProvider(MailService)
            .useValue(mailServiceMock)
            .overrideProvider(EmailConfirmService)
            .useValue(emailConfirmServiceMock)
            .overrideProvider(ProviderService)
            .useValue(providerServiceMock);

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
        jest.clearAllMocks();
        await clearDatabase(prisma, redis);
    });

    it('registers a new user and sends verification email', async () => {
        const dto = createRegisterDto();

        const response = await request(getHttpServer())
            .post('/auth/register')
            .send(dto)
            .expect(HttpStatus.CREATED); // 201

        expect(response.body).toEqual({
            message:
                'You have successfully registered. Please confirm your email. A message has been sent to your email address.',
        });

        const dbUser = await prisma.user.findUnique({
            where: { email: dto.email },
        });

        expect(dbUser).not.toBeNull();
        expect(dbUser).toMatchObject({
            email: dto.email,
            displayName: dto.name,
            isVerified: false,
            method: 'CREDENTIALS',
        });
    });

    it('rejects registering an existing user', async () => {
        const email = 'existing@example.com';

        await createUserInDb(prisma, {
            email,
            isVerified: false,
        });

        await request(getHttpServer())
            .post('/auth/register')
            .send({
                name: 'New User',
                email,
                password: 'password123',
                passwordRepeat: 'password123',
            })
            .expect(HttpStatus.CONFLICT); // 409
    });

    it('rejects invalid register payloads', async () => {
        await request(getHttpServer())
            .post('/auth/register')
            .send({
                name: '',
                email: 'not-an-email',
                password: '123',
                passwordRepeat: '456',
            })
            .expect(HttpStatus.BAD_REQUEST); // 400
    });

    it('logs in a verified user and returns a session cookiecreateUserInDb', async () => {
        const user = await createUserInDb(prisma, {
            email: 'verified@example.com',
            isVerified: true,
        });

        const response = await request(getHttpServer())
            .post('/auth/login')
            .send({ email: user.email, password: 'testpass123' })
            .expect(HttpStatus.OK); // 200

        expect(buildCookieHeader(response.headers['set-cookie'])).toBeTruthy();
    });

    it('rejects login with an invalid password', async () => {
        const user = await createUserInDb(prisma, {
            email: 'wrong-pass@example.com',
            isVerified: true,
        });

        await request(getHttpServer())
            .post('/auth/login')
            .send({ email: user.email, password: 'badpassword' })
            .expect(HttpStatus.UNAUTHORIZED); // 401
    });

    it('rejects login for an unverified user', async () => {
        const user = await createUserInDb(prisma, {
            email: 'unverified@example.com',
            isVerified: false,
        });

        await request(getHttpServer())
            .post('/auth/login')
            .send({ email: user.email, password: 'testpass123' })
            .expect(HttpStatus.UNAUTHORIZED); // 401
    });

    it('rejects invalid login payloads', async () => {
        await request(getHttpServer())
            .post('/auth/login')
            .send({
                email: 'not-an-email',
                password: '',
            })
            .expect(HttpStatus.BAD_REQUEST); // 400
    });

    it('logs out an authenticated user', async () => {
        const user = await createUserInDb(prisma, {
            email: 'logout@example.com',
            isVerified: true,
        });
        const agent = request.agent(getHttpServer());
        await loginUser(agent, user.email, 'testpass123');

        await agent.post('/auth/logout').expect(200);

        await agent.get('/users/profile').expect(401);
    });

    it('returns provider auth url for oauth connect', async () => {
        providerServiceMock.findByService.mockReturnValue({
            getAuthUrl: jest.fn(() => 'https://provider.example.com/auth'),
        });

        const response = await request(getHttpServer())
            .get('/auth/oauth/connect/google')
            .expect(HttpStatus.OK); // 200

        expect(response.body).toEqual({
            url: 'https://provider.example.com/auth',
        });
    });

    it('rejects oauth callback without code', async () => {
        providerServiceMock.findByService.mockReturnValue({
            findUserByCode: jest.fn(),
        });

        await request(getHttpServer())
            .get('/auth/oauth/callback/google')
            .expect(HttpStatus.BAD_REQUEST); // 400
    });

    it('redirects after successful oauth callback', async () => {
        providerServiceMock.findByService.mockReturnValue({
            findUserByCode: jest.fn(() =>
                Promise.resolve({
                    id: 'provider-user-id',
                    email: 'oauth@example.com',
                    name: 'OAuth User',
                    picture: 'https://example.com/avatar.png',
                    provider: 'google',
                    access_token: 'access-token',
                    refresh_token: 'refresh-token',
                    expires_at: 3600,
                }),
            ),
        });

        const response = await request(getHttpServer())
            .get('/auth/oauth/callback/google')
            .query({ code: 'oauth-code' })
            .expect(HttpStatus.FOUND); // 302

        expect(response.headers.location).toContain('/dashboard/settings');
    });
});
// import type { Server } from 'node:http';

// import { INestApplication, ValidationPipe } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { Test, TestingModule } from '@nestjs/testing';
// import { GoogleRecaptchaGuard } from '@nestlab/google-recaptcha';
// import { createUser } from '@test/factories';
// import session from 'express-session';
// import request from 'supertest';

// import { AuthController } from '@/auth/auth.controller';
// import { AuthService } from '@/auth/auth.service';
// import { ProviderService } from '@/auth/provider/provider.service';
// import { AuthProviderGuard } from '@/common/guards/provider.guard';

// type AuthServiceMock = {
//     register: jest.MockedFunction<AuthService['register']>;
//     login: jest.MockedFunction<AuthService['login']>;
//     extractProfileFromCode: jest.MockedFunction<
//         AuthService['extractProfileFromCode']
//     >;
//     logout: jest.MockedFunction<AuthService['logout']>;
// };

// type ProviderServiceMock = {
//     findByService: jest.MockedFunction<ProviderService['findByService']>;
// };

// type ConfigServiceMock = {
//     getOrThrow: jest.MockedFunction<ConfigService['getOrThrow']>;
// };

// const createAuthServiceMock = (): AuthServiceMock => ({
//     register: jest.fn(),
//     login: jest.fn(),
//     extractProfileFromCode: jest.fn(),
//     logout: jest.fn(),
// });

// const createProviderServiceMock = (): ProviderServiceMock => ({
//     findByService: jest.fn(),
// });

// const createConfigServiceMock = (): ConfigServiceMock => ({
//     getOrThrow: jest.fn((key: string) => {
//         const values: Record<string, string> = {
//             ALLOWED_ORIGIN: 'http://localhost:3000',
//             SESSION_NAME: 'sid',
//         };

//         return values[key] ?? '';
//     }) as ConfigServiceMock['getOrThrow'],
// });

// describe('AuthController (e2e)', () => {
//     let app: INestApplication;
//     let authService: AuthServiceMock;
//     let providerService: ProviderServiceMock;
//     const getHttpServer = () => app.getHttpServer() as Server;

//     beforeEach(async () => {
//         authService = createAuthServiceMock();
//         providerService = createProviderServiceMock();

//         const moduleFixture: TestingModule = await Test.createTestingModule({
//             controllers: [AuthController],
//             providers: [
//                 AuthProviderGuard,
//                 {
//                     provide: AuthService,
//                     useValue: authService,
//                 },
//                 {
//                     provide: ProviderService,
//                     useValue: providerService,
//                 },
//                 {
//                     provide: ConfigService,
//                     useValue: createConfigServiceMock(),
//                 },
//             ],
//         })
//             .overrideGuard(GoogleRecaptchaGuard)
//             .useValue({ canActivate: () => true })
//             .compile();

//         app = moduleFixture.createNestApplication();
//         app.useGlobalPipes(
//             new ValidationPipe({
//                 transform: true,
//             }),
//         );
//         app.use(
//             session({
//                 secret: 'test-session-secret',
//                 resave: false,
//                 saveUninitialized: false,
//             }),
//         );

//         await app.init();
//     });

//     afterEach(async () => {
//         if (app) {
//             await app.close();
//         }
//     });

//     it('registers a user and returns the confirmation message', async () => {
//         const dto = {
//             name: 'User',
//             email: 'user@example.com',
//             password: 'password123',
//             passwordRepeat: 'password123',
//         };

//         await request(getHttpServer())
//             .post('/auth/register')
//             .send(dto)
//             .expect(201)
//             .expect({
//                 message:
//                     'You have successfully registered. Please confirm your email. A message has been sent to your email address.',
//             });

//         expect(authService.register.mock.calls).toEqual([[dto]]);
//     });

//     it('rejects invalid register payloads', async () => {
//         await request(getHttpServer())
//             .post('/auth/register')
//             .send({
//                 name: '',
//                 email: 'not-an-email',
//                 password: 'short',
//                 passwordRepeat: 'different',
//             })
//             .expect(400);

//         expect(authService.register.mock.calls).toHaveLength(0);
//     });

//     it('logs in a user with status 200', async () => {
//         const dto = {
//             email: 'user@example.com',
//             password: 'password123',
//         };
//         const user = createUser({ email: dto.email });

//         authService.login.mockResolvedValue({ user });

//         const response = await request(getHttpServer())
//             .post('/auth/login')
//             .send(dto)
//             .expect(200);

//         expect(response.body).toEqual({
//             user: {
//                 ...user,
//                 createdAt: user.createdAt.toISOString(),
//                 updatedAt: user.updatedAt.toISOString(),
//             },
//         });
//         expect(authService.login.mock.calls[0]?.[1]).toEqual(dto);
//     });

//     it('returns the two-factor message when login requires a code', async () => {
//         const message =
//             'Check your email. Two-factor authentication code is required.';

//         authService.login.mockResolvedValue({ message });

//         await request(getHttpServer())
//             .post('/auth/login')
//             .send({
//                 email: 'user@example.com',
//                 password: 'password123',
//             })
//             .expect(200)
//             .expect({ message });
//     });

//     it('returns an OAuth provider connect URL', async () => {
//         const url = 'https://accounts.example.com/oauth';
//         providerService.findByService.mockReturnValue({
//             getAuthUrl: () => url,
//         } as ReturnType<ProviderService['findByService']>);

//         await request(getHttpServer())
//             .get('/auth/oauth/connect/google')
//             .expect(200)
//             .expect({ url });

//         expect(providerService.findByService.mock.calls).toEqual([['google']]);
//     });

//     it('rejects unsupported OAuth providers', async () => {
//         await request(getHttpServer())
//             .get('/auth/oauth/connect/unknown')
//             .expect(404);

//         expect(providerService.findByService.mock.calls).toHaveLength(0);
//     });

//     it('redirects after a successful OAuth callback', async () => {
//         await request(getHttpServer())
//             .get('/auth/oauth/callback/google')
//             .query({ code: 'oauth-code' })
//             .expect(302)
//             .expect('Location', 'http://localhost:3000/dashboard/settings');

//         expect(authService.extractProfileFromCode.mock.calls[0]?.[1]).toBe(
//             'google',
//         );
//         expect(authService.extractProfileFromCode.mock.calls[0]?.[2]).toBe(
//             'oauth-code',
//         );
//     });

//     it('rejects OAuth callbacks without a code', async () => {
//         await request(getHttpServer())
//             .get('/auth/oauth/callback/google')
//             .expect(400);

//         expect(authService.extractProfileFromCode.mock.calls).toHaveLength(0);
//     });

//     it('logs out with status 200', async () => {
//         await request(getHttpServer())
//             .post('/auth/logout')
//             .expect(200)
//             .expect({ message: 'Logged out successfully' });

//         expect(authService.logout.mock.calls).toHaveLength(1);
//     });
// });
