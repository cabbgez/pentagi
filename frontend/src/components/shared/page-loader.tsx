import { useTranslation } from 'react-i18next';

function PageLoader() {
    const { t } = useTranslation();

    return (
        <div className="grid h-screen w-full place-items-center">
            <p>{t('common:action.loading')}</p>
        </div>
    );
}

export default PageLoader;
