import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        debug: false,

        // Standard react-i18next structure
        interpolation: {
            escapeValue: false, // React escapes by default
        },

        // Path to load resources
        backend: {
            loadPath: '/locales/{{lng}}/translation.json',
        },

        // Detection options
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'app-language', // Align with app store if possible
            caches: ['localStorage'],
        }
    });

export default i18n;
