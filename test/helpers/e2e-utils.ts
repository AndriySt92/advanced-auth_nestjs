import { HttpStatus } from '@nestjs/common';
import { hash } from 'argon2';
import request from 'supertest';

import { AuthMethod, UserRole } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';

type TestAgent = ReturnType<typeof request.agent>;

export async function createUserInDb(
    prisma: PrismaService,
    overrides?: Partial<{
        id: string;
        email: string;
        password: string;
        displayName: string;
        picture: string | null;
        role: UserRole;
        isVerified: boolean;
        isTwoFactorEnabled: boolean;
    }>,
) {
    const rawPassword = overrides?.password ?? 'testpass123';
    const hashedPassword = await hash(rawPassword);

    return prisma.user.create({
        data: {
            id: overrides?.id,
            email: overrides?.email ?? `user-${Date.now()}@example.com`,
            password: hashedPassword,
            displayName: overrides?.displayName ?? 'Test User',
            picture: overrides?.picture ?? null,
            role: overrides?.role ?? UserRole.REGULAR,
            isVerified: overrides?.isVerified ?? true,
            isTwoFactorEnabled: overrides?.isTwoFactorEnabled ?? false,
            method: AuthMethod.CREDENTIALS,
        },
        include: { accounts: true },
    });
}

export function buildCookieHeader(
    setCookie: string | string[] | undefined,
): string {
    if (!setCookie) return '';
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

export async function loginUser(
    agent: TestAgent,
    email: string,
    password: string,
): Promise<string> {
    const response = await agent
        .post('/auth/login')
        .send({ email, password })
        .expect(HttpStatus.OK); // 200
    const cookie = buildCookieHeader(response.headers['set-cookie']);

    expect(cookie).toBeTruthy();
    return cookie;
}
