import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n.use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'pl', 'de', 'ar', 'ja', 'es'],
        debug: false, // Set to true for debugging

        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },

        backend: {
            loadPath: '/locales/{{lng}}/translation.json',
        },

        react: {
            useSuspense: false, // Changed to false to prevent white screen on load errors
        },
    })
    .catch((error) => {
        console.error('[i18n] Failed to initialize:', error);
    });

export default i18n;
