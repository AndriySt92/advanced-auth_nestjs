import {
    Injectable,
    InternalServerErrorException,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { User } from '@/generated/prisma/client';

import { AUTH_COOKIE_NAMES, TWO_FACTOR_CONFIG } from '../auth.constants';

@Injectable()
export class SessionService {
    private readonly logger = new Logger(SessionService.name);

    public constructor(private readonly configService: ConfigService) {}

    public async saveSession(
        req: Request,
        user: User,
    ): Promise<{ user: User }> {
        req.session.userId = user.id;

        await this.saveRequestSession(
            req,
            `authenticated session for user ${user.id}`,
        );
        this.logger.log(
            `Authenticated session saved successfully for user ${user.id}`,
        );

        return { user };
    }

    public async logout(req: Request, res: Response): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            req.session.destroy((err: Error | null) => {
                if (err) {
                    this.logger.error(
                        'Failed to destroy user session',
                        err.stack,
                    );
                    reject(
                        new InternalServerErrorException(
                            `Failed to destroy session: ${err.message}`,
                        ),
                    );
                    return;
                }
                resolve();
            });
        });
        res.clearCookie(this.configService.getOrThrow<string>('SESSION_NAME'));
        this.logger.log('User session destroyed successfully');
    }

    public async savePendingTwoFactorSession(
        req: Request,
        res: Response,
        userId: string,
        challengeId: string,
    ): Promise<void> {
        await this.setPendingTwoFactorSession(
            req,
            userId,
            challengeId,
            `save pending 2FA session for user ${userId}`,
        );

        this.setPendingTwoFactorCookie(res);

        this.logger.log(`Pending 2FA session saved for user ${userId}`);
    }

    public async updatePendingTwoFactorSession(
        req: Request,
        res: Response,
        challengeId: string,
    ): Promise<void> {
        const pending = req.session.pendingTwoFactor;

        if (!pending || pending.expiresAt < Date.now()) {
            throw new UnauthorizedException(
                'Two-factor authentication session has expired.',
            );
        }

        await this.setPendingTwoFactorSession(
            req,
            pending.userId,
            challengeId,
            `update pending 2FA session for user ${pending.userId}`,
        );

        this.setPendingTwoFactorCookie(res);

        this.logger.log(
            `Pending 2FA session updated for user ${pending.userId}. New challenge: ${challengeId}`,
        );
    }

    public async clearPendingTwoFactorSession(
        req: Request,
        res: Response,
    ): Promise<void> {
        const userId = req.session.pendingTwoFactor?.userId;

        delete req.session.pendingTwoFactor;

        await this.saveRequestSession(
            req,
            `clear pending 2FA session${userId ? ` for user ${userId}` : ''}`,
        );

        res.clearCookie(AUTH_COOKIE_NAMES.PENDING_2FA);

        this.logger.log(
            `Pending 2FA session cleared${userId ? ` for user ${userId}` : ''}`,
        );
    }

    public async completeTwoFactorAuthentication(
        req: Request,
        res: Response,
        user: User,
    ): Promise<{ user: User }> {
        delete req.session.pendingTwoFactor;
        req.session.userId = user.id;

        await this.saveRequestSession(
            req,
            `complete 2FA authentication for user ${user.id}`,
        );

        res.clearCookie(AUTH_COOKIE_NAMES.PENDING_2FA);

        this.logger.log(
            `2FA authentication completed and session saved for user ${user.id}`,
        );

        return { user };
    }

    private async setPendingTwoFactorSession(
        req: Request,
        userId: string,
        challengeId: string,
        operation: string,
    ): Promise<void> {
        req.session.pendingTwoFactor = {
            userId,
            challengeId,
            expiresAt: Date.now() + TWO_FACTOR_CONFIG.TOKEN_TTL_MS,
        };
        await this.saveRequestSession(req, operation);
    }
    private setPendingTwoFactorCookie(res: Response): void {
        res.cookie(AUTH_COOKIE_NAMES.PENDING_2FA, '1', {
            httpOnly: true,
            secure: this.configService.get<string>('NODE_ENV') === 'production',
            sameSite: 'lax',
            maxAge: TWO_FACTOR_CONFIG.TOKEN_TTL_MS,
        });
    }
    private async saveRequestSession(
        req: Request,
        operation: string,
    ): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            req.session.save((err: Error | null) => {
                if (err) {
                    this.logger.error(`Failed to ${operation}`, err.stack);
                    reject(
                        new InternalServerErrorException(
                            `Failed to ${operation}: ${err.message}`,
                        ),
                    );
                    return;
                }
                resolve();
            });
        });
    }
}
