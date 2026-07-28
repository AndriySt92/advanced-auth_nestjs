export const TWO_FACTOR_CONFIG = {
    TOKEN_TTL_MS: 5 * 60 * 1000,
    TOKEN_TTL_SECONDS: 5 * 60,

    RESEND_COOLDOWN_SECONDS: 60,
    MAX_RESENDS_PER_DAY: 5,
    RESEND_DAILY_WINDOW_SECONDS: 24 * 60 * 60,

    MAX_VERIFICATION_ATTEMPTS: 5,
} as const;

export const TWO_FACTOR_REDIS_KEYS = {
    TOKEN: '2fa:token',
    ATTEMPTS: '2fa:attempts:count',
    RESEND_COUNT: '2fa:resend:count',
    RESEND_COOLDOWN: '2fa:resend:cooldown',
} as const;

export const TWO_FACTOR_COOKIE_NAME = 'pending-2fa';
