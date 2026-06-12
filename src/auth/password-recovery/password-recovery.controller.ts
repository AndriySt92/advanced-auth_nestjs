import { Body, Controller, Post } from '@nestjs/common';
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
    @Post('new-password')
    public async newPassword(@Body() dto: NewPasswordDto) {
        await this.passwordRecoveryService.newPassword(dto);

        return {
            message:
                'Password has been successfully reset. You can now log in.',
        };
    }
}
