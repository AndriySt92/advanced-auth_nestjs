import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { render } from '@react-email/components';
import type { SentMessageInfo } from 'nodemailer';

import { ConfirmTemplate, ResetPasswordTemplate, TwoFactor } from './templates';

type SendMailOptions = {
    to: string;
    subject: string;
    html: string;
};

@Injectable()
export class MailService {
    private readonly SUBJECTS = {
        CONFIRM: 'Email Confirmation',
        RESET: 'Password Reset',
        TWO_FACTOR: 'Two-Factor Authentication',
    } as const;

    public constructor(
        private readonly mailerConfig: MailerService,
        private readonly configService: ConfigService,
    ) {}

    private sendMail(options: SendMailOptions): Promise<SentMessageInfo> {
        return this.mailerConfig.sendMail(options);
    }

    public async sendConfirmEmail(
        email: string,
        token: string,
    ): Promise<SentMessageInfo> {
        const domain = this.configService.getOrThrow<string>('ALLOWED_ORIGIN');
        const html = await render(ConfirmTemplate({ domain, token }));

        return this.sendMail({
            to: email,
            subject: this.SUBJECTS.CONFIRM,
            html,
        });
    }

    public async sendPasswordResetEmail(
        email: string,
        token: string,
    ): Promise<SentMessageInfo> {
        const domain = this.configService.getOrThrow<string>('ALLOWED_ORIGIN');
        const html = await render(ResetPasswordTemplate({ domain, token }));

        return this.sendMail({
            to: email,
            subject: this.SUBJECTS.RESET,
            html,
        });
    }

    public async sendTwoFactorTokenEmail(
        email: string,
        token: string,
    ): Promise<SentMessageInfo> {
        const html = await render(TwoFactor({ token }));

        return this.sendMail({
            to: email,
            subject: this.SUBJECTS.TWO_FACTOR,
            html,
        });
    }
}
