import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType, SetOptions } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);

    public readonly client: RedisClientType;

    constructor(config: ConfigService) {
        this.client = createClient({
            url: config.getOrThrow<string>('REDIS_URL'),
        });

        this.client.on('error', (error) => {
            this.logger.error('Redis client error', error);
        });
    }

    async onModuleInit() {
        await this.client.connect();

        this.logger.log('Redis connected successfully');
    }

    public async onModuleDestroy(): Promise<void> {
        if (this.client.isOpen) {
            await this.client.quit();

            this.logger.log('Redis connection closed');
        }
    }

    public async get(key: string) {
        return this.client.get(key);
    }

    public async set(key: string, value: string, options?: SetOptions) {
        return this.client.set(key, value, options);
    }

    public async incr(key: string) {
        return this.client.incr(key);
    }

    public async expire(key: string, seconds: number) {
        return this.client.expire(key, seconds);
    }

    public async exists(key: string) {
        return this.client.exists(key);
    }

    public async del(key: string) {
        return this.client.del(key);
    }

    public async setWithTTL(
        key: string,
        value: string,
        ttlSeconds: number,
    ): Promise<void> {
        await this.client.set(key, value, {
            EX: ttlSeconds,
        });
    }
}
