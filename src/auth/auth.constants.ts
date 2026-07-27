export const AUTH_COOKIE_NAMES = {
    PENDING_2FA: 'pending-2fa',
} as const;

export const TWO_FACTOR_CONFIG = {
    TOKEN_TTL_MS: 5 * 60 * 1000, // 5 minutes
    TOKEN_TTL_SECONDS: 5 * 60, // 5 minutes

    RESEND_COOLDOWN_SECONDS: 60,
    MAX_RESENDS_PER_DAY: 5,
    RESEND_DAILY_WINDOW_SECONDS: 24 * 60 * 60, // 24 hours

    MAX_VERIFICATION_ATTEMPTS: 5,

    TWO_FACTOR_TOKEN: '2fa:token',
    TWO_FACTOR_ATTEMPTS: '2fa:attempts:count',
    TWO_FACTOR_RESEND_COUNT: '2fa:resend:count',
    TWO_FACTOR_RESEND_COOLDOWN: '2fa:resend:cooldown',
} as const;

export const PASSWORD_RESET_CONFIG = {
    TOKEN_TTL_SECONDS: 60 * 60, // 1 hour

    PASSWORD_RESET_TOKEN: 'password-reset:token',
} as const;

export const EMAIL_VERIFICATION_CONFIG = {
    TOKEN_TTL_SECONDS: 60 * 60, // 1 hour

    EMAIL_VERIFICATION_TOKEN: 'email-verification:token',
} as const;
