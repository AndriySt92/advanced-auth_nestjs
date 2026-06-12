import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { NewPasswordDto, ResetPasswordDto } from './dto';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';

jest.mock('@/libs/mail/mail.service', () => ({
    MailService: class MailService {},
}));

describe('PasswordRecoveryController', () => {
    let controller: PasswordRecoveryController;
    let passwordRecoveryService: jest.Mocked<
        Pick<PasswordRecoveryService, 'resetPassword' | 'newPassword'>
    >;

    beforeEach(() => {
        passwordRecoveryService = {
            resetPassword: jest.fn(),
            newPassword: jest.fn(),
        };

        controller = new PasswordRecoveryController(
            passwordRecoveryService as unknown as PasswordRecoveryService,
        );
    });

    it('sends password reset email and returns a success message', async () => {
        const dto: ResetPasswordDto = {
            email: 'user@example.com',
        };
        passwordRecoveryService.resetPassword.mockResolvedValue(undefined);

        await expect(controller.resetPassword(dto)).resolves.toEqual({
            message:
                'Password reset email has been sent. Please check your inbox.',
        });
        expect(passwordRecoveryService.resetPassword).toHaveBeenCalledWith(dto);
    });

    it('sets a new password and returns a success message', async () => {
        const dto: NewPasswordDto = {
            password: 'new-password',
            token: 'reset-token',
        };
        passwordRecoveryService.newPassword.mockResolvedValue(undefined);

        await expect(controller.newPassword(dto)).resolves.toEqual({
            message:
                'Password has been successfully reset. You can now log in.',
        });
        expect(passwordRecoveryService.newPassword).toHaveBeenCalledWith(dto);
    });
});
