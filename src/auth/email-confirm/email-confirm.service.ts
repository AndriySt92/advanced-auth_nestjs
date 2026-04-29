import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { TokenType } from '@/generated/prisma/client';
import { MailService } from '@/libs/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { SessionService } from '../session/session.service';
import { ConfirmDto } from './dto/confirm.dto';

@Injectable()
export class EmailConfirmService {
    public constructor(
        private readonly prismaService: PrismaService,
        private readonly mailService: MailService,
        private readonly userService: UserService,
        private readonly sessionService: SessionService,
    ) {}

    public async newVerification(req: Request, dto: ConfirmDto): Promise<void> {
        const existingToken = await this.prismaService.token.findUnique({
            where: {
                token: dto.token,
                type: TokenType.VERIFICATION,
            },
        });

        if (!existingToken) {
            throw new NotFoundException(
                'Verification token not found. Please make sure you provided a valid token.',
            );
        }

        const hasExpired = new Date(existingToken.expiresIn) < new Date();

        if (hasExpired) {
            throw new BadRequestException(
                'Verification token has expired. Please request a new verification token.',
            );
        }

        const existingUser = await this.userService.findByEmail(
            existingToken.email,
        );

        if (!existingUser) {
            throw new NotFoundException(
                'User with this email address was not found. Please make sure the email is correct.',
            );
        }

        await this.prismaService.$transaction([
            this.prismaService.user.update({
                where: {
                    id: existingUser.id,
                },
                data: {
                    isVerified: true,
                },
            }),
            this.prismaService.token.delete({
                where: {
                    id: existingToken.id,
                    type: TokenType.VERIFICATION,
                },
            }),
        ]);

        await this.sessionService.saveSession(req, existingUser);
    }

    public async sendVerificationToken(email: string): Promise<boolean> {
        const verificationToken = await this.generateVerificationToken(email);

        await this.mailService.sendConfirmEmail(
            verificationToken.email,
            verificationToken.token,
        );

        return true;
    }

    private async generateVerificationToken(email: string) {
        const token = uuidv4();
        const expiresIn = new Date(new Date().getTime() + 3600 * 1000);

        const existingToken = await this.prismaService.token.findFirst({
            where: {
                email,
                type: TokenType.VERIFICATION,
            },
        });

        if (existingToken) {
            await this.prismaService.token.delete({
                where: {
                    id: existingToken.id,
                    type: TokenType.VERIFICATION,
                },
            });
        }

        const verificationToken = await this.prismaService.token.create({
            data: {
                email,
                token,
                expiresIn,
                type: TokenType.VERIFICATION,
            },
        });

        return verificationToken;
    }
}
