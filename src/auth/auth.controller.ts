import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Recaptcha } from '@nestlab/google-recaptcha';
import type { Request, Response } from 'express';

import { AuthProviderGuard } from '@/common/guards/provider.guard';
import { User } from '@/generated/prisma/client';

import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { ProviderService } from './provider/provider.service';

@Controller('auth')
export class AuthController {
    public constructor(
        private readonly authService: AuthService,
        private readonly providerService: ProviderService,
        private readonly configService: ConfigService,
    ) {}

    @Recaptcha()
    @Post('register')
    public async register(
        @Body() dto: RegisterDto,
    ): Promise<{ message: string }> {
        await this.authService.register(dto);
        return {
            message:
                'You have successfully registered. Please confirm your email. A message has been sent to your email address.',
        };
    }

    @Recaptcha()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    public login(
        @Req() req: Request,
        @Body() dto: LoginDto,
    ): Promise<{ user: User } | { message: string }> {
        return this.authService.login(req, dto);
    }

    @UseGuards(AuthProviderGuard)
    @Get('/oauth/callback/:provider')
    public async callback(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Query('code') code: string,
        @Param('provider') provider: string,
    ): Promise<void | { message: string }> {
        if (!code) {
            throw new BadRequestException('Authorization code is required.');
        }

        await this.authService.extractProfileFromCode(req, provider, code);

        return res.redirect(
            `${this.configService.getOrThrow<string>('ALLOWED_ORIGIN')}/dashboard/settings`,
        );
    }

    @UseGuards(AuthProviderGuard)
    @Get('/oauth/connect/:provider')
    public connect(@Param('provider') provider: string): {
        url: string | { message: string } | undefined;
    } {
        const providerInstance = this.providerService.findByService(provider);
        return {
            url: providerInstance?.getAuthUrl(),
        };
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    public async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ message: string }> {
        await this.authService.logout(req, res);
        return { message: 'Logged out successfully' };
    }
}
