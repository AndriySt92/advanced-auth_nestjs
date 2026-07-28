import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { RedisService } from '@/redis/redis.service';

import {
    TWO_FACTOR_CONFIG,
    TWO_FACTOR_REDIS_KEYS,
} from './two-factor-auth.constants';

@Injectable()
export class TwoFactorRateLimitService {
    private readonly logger = new Logger(TwoFactorRateLimitService.name);

    public constructor(private readonly redisService: RedisService) {}

    public async check(userId: string): Promise<void> {
        const redis = this.redisService;

        const counterKey = this.getCounterKey(userId);
        const cooldownKey = this.getCooldownKey(userId);

        const cooldown = await redis.exists(cooldownKey);

        if (cooldown) {
            this.logger.warn(
                `2FA resend blocked by cooldown for user ${userId}`,
            );

            throw new HttpException(
                'Please wait before requesting another code.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        const count = Number((await redis.get(counterKey)) ?? 0);

        if (count >= TWO_FACTOR_CONFIG.MAX_RESENDS_PER_DAY) {
            this.logger.warn(
                `2FA resend daily limit reached for user ${userId}. Count: ${count}`,
            );

            throw new HttpException(
                'Maximum number of verification codes reached today.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        this.logger.debug(
            `2FA resend allowed for user ${userId}. Current daily count: ${count}`,
        );
    }

    public async recordResend(userId: string): Promise<void> {
        const redis = this.redisService;

        const counterKey = this.getCounterKey(userId);
        const cooldownKey = this.getCooldownKey(userId);

        const count = await redis.incr(counterKey);

        if (count === 1) {
            await redis.expire(
                counterKey,
                TWO_FACTOR_CONFIG.RESEND_DAILY_WINDOW_SECONDS,
            );
        }

        await redis.set(cooldownKey, '1', {
            EX: TWO_FACTOR_CONFIG.RESEND_COOLDOWN_SECONDS,
        });

        this.logger.log(
            `2FA resend recorded for user ${userId}. Daily count: ${count}`,
        );
    }

    private getCounterKey(userId: string): string {
        return `${TWO_FACTOR_REDIS_KEYS.RESEND_COUNT}:${userId}`;
    }

    private getCooldownKey(userId: string): string {
        return `${TWO_FACTOR_REDIS_KEYS.RESEND_COOLDOWN}:${userId}`;
    }
}
