import { randomInt } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';

import { TokenType } from '@/generated/prisma/client';
import { MailService } from '@/libs/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class TwoFactorAuthService {
    private readonly logger = new Logger(TwoFactorAuthService.name);

    public constructor(
        private readonly prismaService: PrismaService,
        private readonly mailService: MailService,
    ) {}

    public async sendTwoFactorToken(email: string): Promise<void> {
        const twoFactorToken = await this.generateTwoFactorToken(email);

        await this.mailService.sendTwoFactorTokenEmail(
            twoFactorToken.email,
            twoFactorToken.token,
        );

        this.logger.log(`2FA token sent to ${email}`);
    }

    public async validateTwoFactorToken(
        email: string,
        code: string,
    ): Promise<void> {
        const existingToken = await this.prismaService.token.findFirst({
            where: {
                email,
                type: TokenType.TWO_FACTOR,
            },
        });

        const isValid =
            existingToken?.token === code &&
            new Date(existingToken.expiresIn) > new Date();

        if (!isValid) {
            throw new BadRequestException('Invalid or expired 2FA token');
        }

        await this.prismaService.token.delete({
            where: {
                id: existingToken.id,
                type: TokenType.TWO_FACTOR,
            },
        });

        this.logger.log(`2FA validated for ${email}`);
    }

    private async generateTwoFactorToken(email: string): Promise<{
        token: string;
        id: string;
        email: string;
        type: TokenType;
        expiresIn: Date;
        createdAt: Date;
    }> {
        const token = randomInt(100000, 999999).toString(); // 6-digit code
        const expiresIn = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        return this.prismaService.$transaction(async (tx) => {
            await tx.token.deleteMany({
                where: {
                    email,
                    type: TokenType.TWO_FACTOR,
                },
            });

            return tx.token.create({
                data: {
                    email,
                    token,
                    expiresIn,
                    type: TokenType.TWO_FACTOR,
                },
            });
        });
    }
}
