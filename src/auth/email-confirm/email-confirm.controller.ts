import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { EmailConfirmService } from './email-confirm.service';

@Controller('auth')
export class EmailConfirmController {
    constructor(private readonly emailConfirmService: EmailConfirmService) {}

    @Get('new-verification')
    public async newVerification(
        @Req() req: Request,
        @Query('token') token: string,
    ) {
        await this.emailConfirmService.newVerification(req, token);

        return {
            message:
                'Your email has been successfully verified. You can now log in.',
        };
    }
}
