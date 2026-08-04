import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
    type AppLanguage,
    DEFAULT_LANGUAGE,
    FALLBACK_LANGUAGE,
    LANGUAGE_STORAGE_KEY,
} from './config';
// Static imports — the app is small enough that per-route lazy loading adds
// complexity without a meaningful bundle-size win. New namespaces are added
// here as they are introduced (auth, flows, settings, …).
import authEn from './locales/en/auth.json';
import commonEn from './locales/en/common.json';
import dashboardEn from './locales/en/dashboard.json';
import enumsEn from './locales/en/enums.json';
import flowsEn from './locales/en/flows.json';
import knowledgesEn from './locales/en/knowledges.json';
import resourcesEn from './locales/en/resources.json';
import settingsEn from './locales/en/settings.json';
import templatesEn from './locales/en/templates.json';
import authZhCN from './locales/zh-CN/auth.json';
import commonZhCN from './locales/zh-CN/common.json';
import dashboardZhCN from './locales/zh-CN/dashboard.json';
import enumsZhCN from './locales/zh-CN/enums.json';
import flowsZhCN from './locales/zh-CN/flows.json';
import knowledgesZhCN from './locales/zh-CN/knowledges.json';
import resourcesZhCN from './locales/zh-CN/resources.json';
import settingsZhCN from './locales/zh-CN/settings.json';
import templatesZhCN from './locales/zh-CN/templates.json';

/**
 * Resolve the initial language: a previously chosen value in localStorage
 * wins, otherwise default to Chinese (Simplified). Guarded against invalid
 * values so a hand-edited localStorage entry never breaks boot.
 */
function resolveInitialLanguage(): AppLanguage {
    if (typeof window === 'undefined') {
        return DEFAULT_LANGUAGE;
    }

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (stored === 'zh-CN' || stored === 'en') {
        return stored;
    }

    return DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
    defaultNS: 'common',
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
        // React already escapes interpolated values — disable i18next's own
        // escaping to avoid double-encoding characters like `&`.
        escapeValue: false,
    },
    lng: resolveInitialLanguage(),
    ns: ['common', 'auth', 'enums', 'settings', 'flows', 'knowledges', 'resources', 'templates', 'dashboard'],
    resources: {
        en: {
            auth: authEn,
            common: commonEn,
            dashboard: dashboardEn,
            enums: enumsEn,
            flows: flowsEn,
            knowledges: knowledgesEn,
            resources: resourcesEn,
            settings: settingsEn,
            templates: templatesEn,
        },
        'zh-CN': {
            auth: authZhCN,
            common: commonZhCN,
            dashboard: dashboardZhCN,
            enums: enumsZhCN,
            flows: flowsZhCN,
            knowledges: knowledgesZhCN,
            resources: resourcesZhCN,
            settings: settingsZhCN,
            templates: templatesZhCN,
        },
    },
    returnNull: false,
});

/**
 * Persist language changes so the choice survives reloads. Bound here so the
 * UI's language switcher only needs to call `i18n.changeLanguage(lng)`.
 */
i18n.on('languageChanged', (lng: string) => {
    if (typeof window !== 'undefined' && (lng === 'zh-CN' || lng === 'en')) {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
        // Keep <html lang> in sync for accessibility / SEO.
        window.document.documentElement.lang = lng;
    }
});

export default i18n;
