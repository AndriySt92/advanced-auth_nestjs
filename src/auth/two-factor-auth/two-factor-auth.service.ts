import { randomInt, randomUUID } from 'node:crypto';

import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    InternalServerErrorException,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { User } from '@/generated/prisma/client';
import { MailService } from '@/libs/mail/mail.service';
import { RedisService } from '@/redis/redis.service';
import { UserService } from '@/user/user.service';

import { SessionService } from '../session/session.service';
import {
    TWO_FACTOR_CONFIG,
    TWO_FACTOR_REDIS_KEYS,
} from './two-factor-auth.constants';
import { TwoFactorRateLimitService } from './two-factor-rate-limits.service';

interface TwoFactorToken {
    email: string;
    code: string;
}

@Injectable()
export class TwoFactorAuthService {
    private readonly logger = new Logger(TwoFactorAuthService.name);

    public constructor(
        private readonly mailService: MailService,
        private readonly redisService: RedisService,
        private readonly sessionService: SessionService,
        private readonly twoFactorRateLimitService: TwoFactorRateLimitService,
        private readonly userService: UserService,
    ) {}

    public async sendTwoFactorToken(
        email: string,
    ): Promise<{ challengeId: string }> {
        const twoFactorToken = await this.generateTwoFactorToken(email);

        await this.mailService.sendTwoFactorTokenEmail(
            email,
            twoFactorToken.code,
        );

        this.logger.log(`2FA token sent to ${email}`);

        return {
            challengeId: twoFactorToken.challengeId,
        };
    }

    public async validateTwoFactorToken(
        challengeId: string,
        code: string,
    ): Promise<void> {
        const tokenKey = this.getTokenKey(challengeId);

        const tokenData = await this.redisService.get(tokenKey);

        this.logger.log(`Validating 2FA challenge ${challengeId}`);

        if (!tokenData) {
            throw new BadRequestException(
                'Invalid or expired verification code.',
            );
        }

        const parsedToken: unknown = JSON.parse(tokenData);

        if (!this.isTwoFactorToken(parsedToken)) {
            this.logger.error(
                `Invalid 2FA token data stored for challenge ${challengeId}`,
            );

            throw new InternalServerErrorException(
                'Invalid two-factor authentication token data.',
            );
        }

        const token = parsedToken;

        if (token.code !== code) {
            const attempts = await this.recordFailedAttempt(challengeId);

            await this.checkAttemptsNumber(attempts, challengeId);

            throw new BadRequestException('Invalid verification code.');
        }
        // The verification code is correct, so delete the used token and attempts.
        await this.deleteTwoFactorToken(challengeId);
        await this.deleteAttempts(challengeId);

        this.logger.log(`2FA validated for ${token.email}`);
    }

    public async authenticate(
        req: Request,
        res: Response,
        user: User,
        code?: string,
    ): Promise<{ message: string } | { user: User }> {
        if (!code) {
            const { challengeId } = await this.sendTwoFactorToken(user.email);

            await this.sessionService.savePendingTwoFactorSession(
                req,
                res,
                user.id,
                challengeId,
            );

            return {
                message:
                    'Check your email. Two-factor authentication code is required.',
            };
        }

        const challengeId = req.session.pendingTwoFactor?.challengeId;

        if (!challengeId) {
            throw new UnauthorizedException(
                'Two-factor authentication session has expired.',
            );
        }

        await this.validateTwoFactorToken(challengeId, code);

        return this.sessionService.completeTwoFactorAuthentication(
            req,
            res,
            user,
        );
    }

    public async resend(req: Request, res: Response) {
        const pending = req.session.pendingTwoFactor;

        if (!pending) {
            this.logger.warn(
                '2FA resend rejected: pending 2FA session not found',
            );

            throw new UnauthorizedException(
                'Two-factor authentication session has expired.',
            );
        }

        if (pending.expiresAt < Date.now()) {
            this.logger.warn(
                `2FA resend rejected: pending 2FA session expired for user ${pending.userId}`,
            );

            await this.sessionService.clearPendingTwoFactorSession(req, res);

            throw new UnauthorizedException(
                'Two-factor authentication session expired.',
            );
        }

        const user = await this.userService.findById(pending.userId);

        this.logger.debug(`Processing 2FA resend request for user ${user.id}`);

        await this.twoFactorRateLimitService.check(pending.userId);

        // Invalidate the old 2FA token and attempts, generate a new challengeId, and send a new code to the user's email.
        const { challengeId } = await this.replaceTwoFactorToken(
            pending.challengeId,
            user.email,
        );

        // Associate the new challengeId with the current pending session so the next verification uses the latest code
        await this.sessionService.updatePendingTwoFactorSession(
            req,
            res,
            challengeId,
        );

        await this.twoFactorRateLimitService.recordResend(pending.userId);

        this.logger.log(
            `2FA verification code resent successfully for user ${user.id}`,
        );

        return {
            message:
                'A new verification code has been sent on your email. Please check your email.',
        };
    }

    private async checkAttemptsNumber(
        attempts: number,
        challengeId: string,
    ): Promise<void> {
        if (attempts >= TWO_FACTOR_CONFIG.MAX_VERIFICATION_ATTEMPTS) {
            await this.deleteTwoFactorToken(challengeId);
            await this.deleteAttempts(challengeId);

            this.logger.warn(
                `2FA verification attempts exceeded for challenge ${challengeId}`,
            );

            throw new HttpException(
                'You have exceeded the maximum number of verification attempts. Please request a new verification code.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    private async recordFailedAttempt(challengeId: string): Promise<number> {
        const attemptsKey = this.getAttemptKey(challengeId);
        const attempts = await this.redisService.incr(attemptsKey);

        if (attempts === 1) {
            await this.redisService.expire(
                attemptsKey,
                TWO_FACTOR_CONFIG.TOKEN_TTL_SECONDS,
            );
        }

        this.logger.warn(
            `Failed 2FA verification attempt for challenge ${challengeId}. Attempts: ${attempts}/${TWO_FACTOR_CONFIG.MAX_VERIFICATION_ATTEMPTS}`,
        );

        return attempts;
    }

    private async replaceTwoFactorToken(
        oldChallengeId: string,
        email: string,
    ): Promise<{ challengeId: string }> {
        await this.deleteTwoFactorToken(oldChallengeId);
        await this.deleteAttempts(oldChallengeId);

        const { challengeId, code } = await this.generateTwoFactorToken(email);

        await this.mailService.sendTwoFactorTokenEmail(email, code);

        this.logger.log(`2FA token resent to ${email}`);

        return {
            challengeId,
        };
    }

    private async deleteTwoFactorToken(challengeId: string): Promise<void> {
        const tokenKey = this.getTokenKey(challengeId);
        await this.redisService.del(tokenKey);
    }

    private async deleteAttempts(challengeId: string): Promise<void> {
        const attemptKey = this.getAttemptKey(challengeId);
        await this.redisService.del(attemptKey);
    }

    private async generateTwoFactorToken(email: string): Promise<{
        challengeId: string;
        code: string;
    }> {
        const challengeId = randomUUID();
        const code = randomInt(100000, 1000000).toString();
        const tokenKey = this.getTokenKey(challengeId);
        const tokenData: TwoFactorToken = {
            email,
            code,
        };

        await this.redisService.setWithTTL(
            tokenKey,
            JSON.stringify(tokenData),
            TWO_FACTOR_CONFIG.TOKEN_TTL_SECONDS,
        );

        return {
            challengeId,
            code,
        };
    }

    private getTokenKey(challengeId: string): string {
        return `${TWO_FACTOR_REDIS_KEYS.TOKEN}:${challengeId}`;
    }

    private getAttemptKey(challengeId: string): string {
        return `${TWO_FACTOR_REDIS_KEYS.ATTEMPTS}:${challengeId}`;
    }

    private isTwoFactorToken(value: unknown): value is TwoFactorToken {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const token = value as Record<string, unknown>;

        return (
            typeof token.email === 'string' && typeof token.code === 'string'
        );
    }
}
