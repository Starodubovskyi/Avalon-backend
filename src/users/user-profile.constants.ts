/** Interface languages; the choice is stored per user (user.locale). */
export const LOCALES = ['en', 'ru', 'ro'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const USER_HEADLINE_MAX_LENGTH = 120;
export const USER_BIO_MAX_LENGTH = 1000;
export const USER_PHONE_MAX_LENGTH = 40;
