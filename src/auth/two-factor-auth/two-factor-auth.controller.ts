import {
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
} from '@nestjs/common';
import { Recaptcha } from '@nestlab/google-recaptcha';
import type { Request, Response } from 'express';

import { TwoFactorAuthService } from './two-factor-auth.service';

@Controller('auth/two-factor')
export class TwoFactorAuthController {
    public constructor(
        private readonly twoFactorAuthService: TwoFactorAuthService,
    ) {}

    @Recaptcha()
    @Post('resend-two-factor')
    @HttpCode(HttpStatus.OK)
    public resendTwoFactor(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ message: string }> {
        return this.twoFactorAuthService.resend(req, res);
    }
}
