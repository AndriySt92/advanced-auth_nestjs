import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ConfirmDto } from './dto/confirm.dto';
import { EmailConfirmService } from './email-confirm.service';

@Controller('auth/email-confirm')
export class EmailConfirmController {
    constructor(private readonly emailConfirmService: EmailConfirmService) {}

    @Post()
    public async newVerification(@Req() req: Request, @Body() dto: ConfirmDto) {
        return this.emailConfirmService.newVerification(req, dto);
    }
}
