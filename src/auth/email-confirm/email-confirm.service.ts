import { randomUUID } from 'node:crypto';

import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

import { MailService } from '@/libs/mail/mail.service';
import { RedisService } from '@/redis/redis.service';
import { UserService } from '@/user/user.service';

import { SessionService } from '../session/session.service';
import { REDIS_KEY_TOKEN, TOKEN_TTL_SECONDS } from './email-confirm.constants';

interface EmailVerificationToken {
    email: string;
}

@Injectable()
export class EmailConfirmService {
    private readonly logger = new Logger(EmailConfirmService.name);

    public constructor(
        private readonly redisService: RedisService,
        private readonly mailService: MailService,
        private readonly userService: UserService,
        private readonly sessionService: SessionService,
    ) {}

    public async newVerification(req: Request, token: string): Promise<void> {
        this.logger.log(
            `Verifying email with token: ${token.substring(0, 8)}...`,
        );

        const tokenKey = this.getTokenKey(token);
        const tokenData = await this.redisService.get(tokenKey);

        if (!tokenData) {
            throw new NotFoundException(
                'Verification token not found or expired. Please make sure you provided a valid token or request a new verification token.',
            );
        }

        const parsedToken: unknown = JSON.parse(tokenData);

        if (!this.isEmailVerificationToken(parsedToken)) {
            this.logger.error(
                'Invalid email verification token data stored in Redis',
            );

            throw new InternalServerErrorException(
                'Invalid email verification token data.',
            );
        }

        const email = parsedToken.email;

        this.logger.log(`Verification token found for email: ${email}`);

        const existingUser = await this.userService.findByEmail(email);

        if (!existingUser) {
            throw new NotFoundException(
                'User with this email address was not found. Please make sure the email is correct.',
            );
        }

        this.logger.log(
            `User found: ${existingUser.id} (${existingUser.email})`,
        );

        await this.userService.markAsVerified(existingUser.id);

        await this.redisService.del(tokenKey);

        this.logger.log(
            `User ${existingUser.id} marked as verified and verification token deleted`,
        );

        await this.sessionService.createAuthenticatedSession(req, existingUser);

        this.logger.log(`Session saved for user ${existingUser.id}`);
    }

    public async sendVerificationToken(email: string): Promise<boolean> {
        const verificationToken = await this.generateVerificationToken(email);

        await this.mailService.sendConfirmEmail(
            verificationToken.email,
            verificationToken.token,
        );

        this.logger.log(`Verification token sent to ${email}`);

        return true;
    }

    private async generateVerificationToken(
        email: string,
    ): Promise<EmailVerificationToken & { token: string }> {
        this.logger.debug(`Generating new verification token for ${email}`);

        const token = randomUUID();

        await this.redisService.setWithTTL(
            this.getTokenKey(token),
            JSON.stringify({ email }),
            TOKEN_TTL_SECONDS,
        );

        this.logger.debug(`New verification token created for ${email}`);

        return {
            email,
            token,
        };
    }

    private getTokenKey(token: string): string {
        return `${REDIS_KEY_TOKEN}:${token}`;
    }

    private isEmailVerificationToken(
        value: unknown,
    ): value is EmailVerificationToken {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const token = value as Record<string, unknown>;

        return typeof token.email === 'string';
    }
}
