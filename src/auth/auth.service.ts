import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { verify } from 'argon2';
import { Request, Response } from 'express';

import { AuthMethod } from '@/generated/prisma/enums';
import { PrismaService } from '@/prisma/prisma.service';
import { UserService } from '@/user/user.service';

import { LoginDto, RegisterDto } from './dto';
import { EmailConfirmService } from './email-confirm/email-confirm.service';
import { ProviderService } from './provider/provider.service';
import { TypeUserInfo } from './provider/services/types';
import { SessionService } from './session/session.service';
import { TwoFactorAuthService } from './two-factor-auth/two-factor-auth.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    public constructor(
        private readonly prismaService: PrismaService,
        private readonly userService: UserService,
        private readonly providerService: ProviderService,
        private readonly emailConfirmationService: EmailConfirmService,
        private readonly twoFactorAuthService: TwoFactorAuthService,
        private readonly sessionService: SessionService,
    ) {}

    public async register(dto: RegisterDto) {
        this.logger.debug(`Starting registration for: ${dto.email}`);

        const isExists = await this.userService.findByEmail(dto.email);

        if (isExists) {
            throw new ConflictException(
                'Registration failed. A user with this email already exists. Please use a different email address or log in to your existing account.',
            );
        }

        const newUser = await this.userService.create({
            email: dto.email,
            password: dto.password,
            displayName: dto.name,
            picture: '',
            method: AuthMethod.CREDENTIALS,
            isVerified: false,
        });

        await this.emailConfirmationService.sendVerificationToken(
            newUser.email,
        );
        this.logger.log(
            `User registered successfully: ${newUser.email} (ID: ${newUser.id})`,
        );
    }

    public async login(req: Request, dto: LoginDto) {
        this.logger.debug(`Starting login for: ${dto.email}`);

        const user = await this.userService.findByEmail(dto.email);

        if (!user || !user.password) {
            throw new NotFoundException(
                'User not found. Please check your credentials.',
            );
        }

        const isValidPassword = await verify(user.password, dto.password);

        if (!isValidPassword) {
            throw new UnauthorizedException(
                'Invalid password. Please try again or reset your password if you forgot it.',
            );
        }
        this.logger.debug(`Password verified for ${user.email}`);

        if (!user.isVerified) {
            await this.emailConfirmationService.sendVerificationToken(
                user.email,
            );
            throw new UnauthorizedException(
                'Your email is not verified. Please check your inbox and verify your address.',
            );
        }
        this.logger.debug(`Email verified for ${user.email}`);

        if (user.isTwoFactorEnabled) {
            if (!dto.code) {
                await this.twoFactorAuthService.sendTwoFactorToken(user.email);

                this.logger.log(`2FA token sent to ${user.email}`);

                return {
                    message:
                        'Check your email. Two-factor authentication code is required.',
                };
            }

            await this.twoFactorAuthService.validateTwoFactorToken(
                user.email,
                dto.code,
            );
            this.logger.log(`2FA validated for ${user.email}`);
        }
        this.logger.log(`User logged in: ${user.email} (ID: ${user.id})`);

        return this.sessionService.saveSession(req, user);
    }

    public async extractProfileFromCode(
        req: Request,
        provider: string,
        code: string,
    ) {
        this.logger.debug(
            `Starting extraction of profile from code for provider: ${provider}`,
        );

        const providerInstance = this.getProviderOrThrow(provider);
        const profile = await providerInstance.findUserByCode(code);

        this.logger.debug(
            `Extracted profile for ${profile.email} from ${provider}`,
        );

        // find or create user & account using transaction to ensure data consistency
        const user = await this.findOrCreateUserFromOAuth(profile);

        this.logger.log(
            `User authenticated via ${provider}: ${user.email} (ID: ${user.id})`,
        );

        return this.sessionService.saveSession(req, user);
    }

    public async logout(req: Request, res: Response): Promise<void> {
        const userId = req.session.userId;
        await this.sessionService.logout(req, res);
        this.logger.log(`User logged out: ID ${userId || 'unknown'}`);
    }

    private getProviderOrThrow(provider: string) {
        const providerInstance = this.providerService.findByService(provider);

        if (!providerInstance) {
            throw new NotFoundException(`Provider ${provider} not found`);
        }

        return providerInstance;
    }

    private async findOrCreateUserFromOAuth(profile: TypeUserInfo) {
        return this.prismaService.$transaction(async (tx) => {
            const account = await tx.account.findUnique({
                where: {
                    provider_providerId: {
                        provider: profile.provider,
                        providerId: profile.id,
                    },
                },
                include: {
                    user: true,
                },
            });

            // if account and user exist update tokens and return user
            if (account?.user) {
                await tx.account.update({
                    where: { id: account.id },
                    data: {
                        accessToken: profile.access_token,
                        refreshToken: profile.refresh_token,
                        expiresAt: profile.expires_at ?? 0,
                    },
                });

                this.logger.log(
                    `Account tokens updated via OAuth: ${account.user.email} (ID: ${account.user.id})`,
                );

                return account.user;
            }

            // find user by email from oauth provider
            let user = await tx.user.findUnique({
                where: { email: profile.email },
            });

            // if user not found create new user with email from oauth provider and mark as verified
            if (!user) {
                const authMethod =
                    AuthMethod[
                        profile.provider.toUpperCase() as keyof typeof AuthMethod
                    ];

                if (!authMethod) {
                    throw new BadRequestException(
                        `Unsupported provider: ${profile.provider}`,
                    );
                }

                user = await tx.user.create({
                    data: {
                        email: profile.email,
                        password: '',
                        displayName: profile.name,
                        picture: profile.picture,
                        method: authMethod,
                        isVerified: true,
                    },
                });

                this.logger.log(
                    `New user created via OAuth: ${user.email} (ID: ${user.id})`,
                );
            }

            // if orphan account exists, link it with the user and return the user
            if (account) {
                await tx.account.update({
                    where: { id: account.id },
                    data: {
                        userId: user.id,
                        accessToken: profile.access_token,
                        refreshToken: profile.refresh_token,
                        expiresAt: profile.expires_at ?? 0,
                    },
                });

                this.logger.log(
                    `Orphan OAuth account repaired for user ${user.email} (ID: ${user.id})`,
                );

                return user;
            }

            // if no account exists for this provider, create one
            await tx.account.create({
                data: {
                    userId: user.id,
                    type: 'oauth',
                    provider: profile.provider,
                    providerId: profile.id,
                    accessToken: profile.access_token,
                    refreshToken: profile.refresh_token,
                    expiresAt: profile.expires_at ?? 0,
                },
            });

            this.logger.log(
                `Account created via OAuth: ${user.email} (ID: ${user.id})`,
            );

            return user;
        });
    }
}
