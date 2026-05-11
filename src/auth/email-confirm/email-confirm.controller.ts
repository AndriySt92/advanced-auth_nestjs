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
        return this.emailConfirmService.newVerification(req, token);
    }
}
