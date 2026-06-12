import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { User } from '@/generated/prisma/client';

@Injectable()
export class SessionService {
    public constructor(private readonly configService: ConfigService) {}

    public async saveSession(
        req: Request,
        user: User,
    ): Promise<{ user: User }> {
        return new Promise((resolve, reject) => {
            req.session.userId = user.id;

            req.session.save((err: Error | null) => {
                if (err) {
                    reject(
                        new InternalServerErrorException(
                            `Failed to save session: ${err.message}`,
                        ),
                    );
                } else {
                    resolve({ user });
                }
            });
        });
    }

    public async logout(req: Request, res: Response): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            req.session.destroy((err: Error | null) => {
                if (err) {
                    reject(
                        new InternalServerErrorException(
                            `Failed to destroy session: ${err.message}`,
                        ),
                    );
                    return;
                }

                res.clearCookie(
                    this.configService.getOrThrow<string>('SESSION_NAME'),
                );
                resolve();
            });
        });
    }
}
