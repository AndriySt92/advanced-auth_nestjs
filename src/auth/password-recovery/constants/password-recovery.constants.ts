export const TOKEN_TTL = {
    SECONDS: 60 * 60,
} as const;

export const REDIS_KEYS = {
    TOKEN: 'password-reset:token',
} as const;
