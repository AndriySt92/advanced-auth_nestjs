import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { hash } from 'argon2';
import { v4 as uuidv4 } from 'uuid';

import { TokenType } from '@/generated/prisma/client';
import { MailService } from '@/libs/mail/mail.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { NewPasswordDto, ResetPasswordDto } from './dto';

@Injectable()
export class PasswordRecoveryService {
    private readonly logger = new Logger(PasswordRecoveryService.name);

    public constructor(
        private readonly prismaService: PrismaService,
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
        const existingToken = await this.prismaService.token.findUnique({
            where: {
                token: dto.token,
                type: TokenType.PASSWORD_RESET,
            },
        });

        if (!existingToken) {
            throw new NotFoundException(
                'Token not found. Please check the entered token or request a new one.',
            );
        }

        const hasExpired = new Date(existingToken.expiresIn) < new Date();

        if (hasExpired) {
            throw new BadRequestException(
                'Token has expired. Please request a new token to confirm the password reset.',
            );
        }

        const existingUser = await this.userService.findByEmail(
            existingToken.email,
        );

        if (!existingUser) {
            throw new NotFoundException(
                'User with the provided email does not exist. Please check the email address and try again.',
            );
        }

        await this.prismaService.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: existingUser.id },
                data: { password: await hash(dto.password) },
            });
            await tx.token.delete({
                where: { id: existingToken.id, type: TokenType.PASSWORD_RESET },
            });
        });

        this.logger.log(
            `Password successfully reset for user ${existingUser.id}`,
        );
    }

    private async generatePasswordResetToken(email: string): Promise<{
        token: string;
        id: string;
        email: string;
        type: TokenType;
        expiresIn: Date;
        createdAt: Date;
    }> {
        const token = uuidv4();
        const expiresIn = new Date(Date.now() + 3600 * 1000); // 1 hour

        const result = await this.prismaService.$transaction(async (tx) => {
            await tx.token.deleteMany({
                where: { email, type: TokenType.PASSWORD_RESET },
            });
            return tx.token.create({
                data: {
                    email,
                    token,
                    expiresIn,
                    type: TokenType.PASSWORD_RESET,
                },
            });
        });

        this.logger.debug(
            `Generated password reset token for ${email} (expires at ${expiresIn.toISOString()})`,
        );

        return result;
    }
}
