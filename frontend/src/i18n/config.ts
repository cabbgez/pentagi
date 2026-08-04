/**
 * i18n configuration constants.
 *
 * Languages are stored under `locales/<lang>/<namespace>.json`. The default
 * language is Chinese (Simplified) — `zh-CN` — matching the project's primary
 * audience. English (`en`) is the fallback so a missing zh-CN key never shows
 * a raw key string to the user.
 */
export const DEFAULT_LANGUAGE = 'zh-CN' as const;
export const FALLBACK_LANGUAGE = 'en' as const;

export const SUPPORTED_LANGUAGES = [DEFAULT_LANGUAGE, FALLBACK_LANGUAGE] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** localStorage key persisting the user's language choice across sessions. */
export const LANGUAGE_STORAGE_KEY = 'i18n_lang';

/**
 * All namespaces. `common` is always loaded; the rest are loaded together
 * with the bundle (static imports) — the app is small enough that lazy
 * loading per route adds complexity without a meaningful size win.
 */
export const NAMESPACES = [
    'common',
    'auth',
    'flows',
    'settings',
    'knowledges',
    'resources',
    'templates',
    'dashboard',
    'enums',
    'errors',
] as const;
export type AppNamespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE = 'common' satisfies AppNamespace;
