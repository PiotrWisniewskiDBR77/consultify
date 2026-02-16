import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

// Supported languages in the application
export const SUPPORTED_LANGUAGES = ['en', 'pl', 'de', 'ar', 'jp', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Helper function to check if language is supported
export const isValidLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

// Available namespaces for translations
export const NAMESPACES = ['translation', 'assessment-module', 'discovery'] as const;
export type TranslationNamespace = (typeof NAMESPACES)[number];

// Language display names for UI
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  pl: 'Polski',
  de: 'Deutsch',
  ar: 'العربية',
  jp: '日本語',
  es: 'Español',
};

// ISO country codes for display (language code -> country code)
export const LANGUAGE_DISPLAY_CODES: Record<SupportedLanguage, string> = {
  en: 'EN',
  pl: 'PL',
  de: 'DE',
  ar: 'AR',
  jp: 'JP',
  es: 'ES',
};

// Language direction (for RTL support)
export const LANGUAGE_DIRECTION: Record<SupportedLanguage, 'ltr' | 'rtl'> = {
  en: 'ltr',
  pl: 'ltr',
  de: 'ltr',
  ar: 'rtl',
  jp: 'ltr',
  es: 'ltr',
};

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Supported languages
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'en',
    // Use browser language like "pl-PL" -> "pl"
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,

    // Default namespace
    defaultNS: 'translation',
    ns: NAMESPACES,

    // IMPORTANT: i18next debug logs (especially missingKey) can significantly slow down the app.
    // Keep it OFF by default. Enable explicitly via: VITE_I18N_DEBUG=true
    debug: import.meta.env.VITE_I18N_DEBUG === 'true',

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Backend configuration for loading translation files
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // Language detection configuration
    detection: {
      // Always start from the user's browser settings
      order: ['navigator', 'htmlTag'],
      // Do not persist language choice; keep it in sync with browser language
      caches: [],
      // Map common browser locales to our supported language codes
      // (e.g. browser "ja" should use app locale folder "jp")
      convertDetectedLanguage: (lng: string) => {
        const base = String(lng || '')
          .toLowerCase()
          .split(/[-_]/)[0];
        if (base === 'ja') return 'jp';
        return base || lng;
      },
    },

    // React configuration
    react: {
      useSuspense: false, // Prevent white screen on load errors
    },
  })
  .catch((error) => {
    console.error('[i18n] Failed to initialize:', error);
  });

// Listen for language changes and update document attributes
i18n.on('languageChanged', (lng: string) => {
  const lang = lng as SupportedLanguage;
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGE_DIRECTION[lang] || 'ltr';
});

// Set initial language on document
if (typeof document !== 'undefined') {
  const currentLang = i18n.language as SupportedLanguage;
  document.documentElement.lang = currentLang || 'en';
  document.documentElement.dir = LANGUAGE_DIRECTION[currentLang] || 'ltr';
}

// Helper function to get current language direction
export const getCurrentDirection = (): 'ltr' | 'rtl' => {
  const currentLang = i18n.language as SupportedLanguage;
  return LANGUAGE_DIRECTION[currentLang] || 'ltr';
};

// Helper function to safely change language
export const changeLanguage = async (lang: string): Promise<boolean> => {
  if (!isValidLanguage(lang)) {
    console.warn(`[i18n] Attempted to switch to unsupported language: ${lang}`);
    return false;
  }

  try {
    await i18n.changeLanguage(lang);
    // Update document direction for RTL languages
    document.documentElement.dir = LANGUAGE_DIRECTION[lang];
    document.documentElement.lang = lang;
    return true;
  } catch (error) {
    console.error(`[i18n] Failed to change language to ${lang}:`, error);
    return false;
  }
};

export default i18n;
