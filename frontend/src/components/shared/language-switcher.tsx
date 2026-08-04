import { useTranslation } from 'react-i18next';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type AppLanguage, SUPPORTED_LANGUAGES } from '@/i18n/config';

interface LanguageSwitcherProps {
    className?: string;
}

/**
 * Language switcher shown in the user dropdown menu. Mirrors the theme
 * switcher's Tabs pattern. Changing language re-renders the whole tree via
 * react-i18next; persistence is handled in the i18n init module.
 */
function LanguageSwitcher({ className }: LanguageSwitcherProps) {
    const { i18n, t } = useTranslation();

    const current = (i18n.language === 'zh-CN' || i18n.language === 'en' ? i18n.language : 'zh-CN') as AppLanguage;

    return (
        <Tabs
            className={className}
            onValueChange={(value) => {
                if (value === 'zh-CN' || value === 'en') {
                    void i18n.changeLanguage(value);
                }
            }}
            value={current}
        >
            <TabsList className="dark:bg-background h-7 p-0.5">
                {SUPPORTED_LANGUAGES.map((lang) => (
                    <TabsTrigger
                        aria-label={t(`common:language.${lang}`)}
                        className="dark:data-[state=active]:bg-card h-6 px-2"
                        key={lang}
                        value={lang}
                    >
                        {t(`common:language.${lang}`)}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

export default LanguageSwitcher;
