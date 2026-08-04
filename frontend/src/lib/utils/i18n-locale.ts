import { enUS } from 'date-fns/locale';
import { zhCN } from 'date-fns/locale';

import { type AppLanguage, DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from '@/i18n/config';

/**
 * Resolve a date-fns locale from the current i18n language.
 * Falls back to English for any language without a bundled date-fns locale.
 */
export function getDateLocale(language: string | undefined) {
    const lng = normalizeLanguage(language);

    switch (lng) {
        case 'zh-CN':
            return zhCN;
        case 'en':
        default:
            return enUS;
    }
}

/** Resolve a BCP-47 tag for Intl APIs (Intl.NumberFormat, etc.). */
export function getIntlLocale(language: string | undefined): string {
    return normalizeLanguage(language);
}

/**
 * Normalize an i18next language string to a known AppLanguage.
 * i18next may report `en-US` or `zh` for partial matches — coerce to the
 * closest supported language so date/number formatting stays consistent.
 */
export function normalizeLanguage(language: string | undefined): AppLanguage {
    if (!language) {
        return DEFAULT_LANGUAGE;
    }

    const lower = language.toLowerCase();

    if (lower.startsWith('zh')) {
        return 'zh-CN';
    }

    if (lower.startsWith('en')) {
        return FALLBACK_LANGUAGE;
    }

    return DEFAULT_LANGUAGE;
}
