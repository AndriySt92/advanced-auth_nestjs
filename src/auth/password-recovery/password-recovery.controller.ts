import { Body, Controller, Param, Post } from '@nestjs/common';
import { Recaptcha } from '@nestlab/google-recaptcha';

import { NewPasswordDto, ResetPasswordDto } from './dto';
import { PasswordRecoveryService } from './password-recovery.service';

@Controller('auth/password-recovery')
export class PasswordRecoveryController {
    constructor(
        private readonly passwordRecoveryService: PasswordRecoveryService,
    ) {}

    @Recaptcha()
    @Post('reset')
    public async resetPassword(@Body() dto: ResetPasswordDto) {
        await this.passwordRecoveryService.resetPassword(dto);

        return {
            message:
                'Password reset email has been sent. Please check your inbox.',
        };
    }

    @Recaptcha()
    @Post('new/:token')
    public async newPassword(
        @Body() dto: NewPasswordDto,
        @Param('token') token: string,
    ) {
        await this.passwordRecoveryService.newPassword(dto, token);

        return {
            message:
                'Password has been successfully reset. You can now log in.',
        };
    }
}
