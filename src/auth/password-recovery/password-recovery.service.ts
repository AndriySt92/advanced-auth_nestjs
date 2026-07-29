import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { MailService } from '@/libs/mail/mail.service';
import { RedisService } from '@/redis/redis.service';
import { UserService } from '@/user/user.service';

import { REDIS_KEYS, TOKEN_TTL } from './constants/password-recovery.constants';
import { NewPasswordDto, ResetPasswordDto } from './dto';

type PasswordResetToken = {
    email: string;
    token: string;
};

@Injectable()
export class PasswordRecoveryService {
    private readonly logger = new Logger(PasswordRecoveryService.name);

    public constructor(
        private readonly redisService: RedisService,
        private readonly userService: UserService,
        private readonly mailService: MailService,
    ) {}

    public async resetPassword(dto: ResetPasswordDto): Promise<void> {
        const existingUser = await this.userService.findByEmail(dto.email);

        if (!existingUser) {
            throw new NotFoundException(
                'User with the provided email does not exist. Please check the email address and try again.',
            );
        }

        const passwordResetToken = await this.generatePasswordResetToken(
            existingUser.email,
        );

        await this.mailService.sendPasswordResetEmail(
            passwordResetToken.email,
            passwordResetToken.token,
        );

        this.logger.log(`Password reset email sent to ${existingUser.email}`);
    }

    public async newPassword(dto: NewPasswordDto): Promise<void> {
        this.logger.debug(`Received password reset token`);

        const tokenKey = this.getTokenKey(dto.token);
        const tokenData = await this.redisService.get(tokenKey);

        if (!tokenData) {
            throw new NotFoundException(
                'Token not found or expired. Please check the entered token or request a new one.',
            );
        }
        const parsedToken: unknown = JSON.parse(tokenData);

        if (!this.isPasswordResetToken(parsedToken)) {
            this.logger.error(
                `Invalid password reset token data for password reset`,
            );

            throw new InternalServerErrorException(
                'Invalid password reset token data.',
            );
        }

        const existingUser = await this.userService.findByEmail(
            parsedToken.email,
        );

        if (!existingUser) {
            throw new NotFoundException(
                'User with the provided email does not exist. Please check the email address and try again.',
            );
        }
        const hashedPassword = await hash(dto.password);

        await this.userService.updatePassword(existingUser.id, hashedPassword);

        await this.redisService.del(tokenKey);
        this.logger.log(
            `Password successfully reset for user ${existingUser.id}`,
        );
    }

    private async generatePasswordResetToken(email: string): Promise<{
        email: string;
        token: string;
    }> {
        const token = uuidv4();

        await this.redisService.setWithTTL(
            this.getTokenKey(token),
            JSON.stringify({ email }),
            TOKEN_TTL.SECONDS,
        );

        this.logger.debug(`Generated password reset token for ${email}`);

        return {
            email,
            token,
        };
    }
    private getTokenKey(token: string): string {
        return `${REDIS_KEYS.TOKEN}:${token}`;
    }

    private isPasswordResetToken(value: unknown): value is PasswordResetToken {
        if (typeof value !== 'object' || value === null) {
            return false;
        }
        const token = value as Record<string, unknown>;
        return typeof token.email === 'string';
    }
}
