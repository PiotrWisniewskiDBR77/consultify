import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

// Supported languages in the application
// NOTE (S23-LOCALE, 2026-08-12): 'jp' was never a valid BCP47 subtag for
// Japanese (the correct subtag is 'ja') — Intl.PluralRules('jp') silently
// resolved to en-US plural rules instead of the real Japanese rule. Migrated
// the canonical code to 'ja'; 'jp' is kept below as a LEGACY alias so any
// already-persisted value (localStorage 'i18nextLng', account/org/conversation
// `language` columns) keeps resolving correctly instead of stranding users.
export const SUPPORTED_LANGUAGES = ['en', 'pl', 'de', 'ar', 'ja', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Helper function to check if language is supported
export const isValidLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

// Normalize language codes (aliases -> supported codes)
// 'jp' is the pre-migration legacy code this app used to store/serve for
// Japanese (see note above) — kept as an alias so old persisted values still
// resolve to the now-canonical 'ja'.
const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  jp: 'ja',
};

export const normalizeLanguageCode = (lng: string | null | undefined): SupportedLanguage | null => {
  const base = String(lng || '')
    .toLowerCase()
    .split(/[-_]/)[0];
  if (!base) return null;
  if (isValidLanguage(base)) return base;
  if (LANGUAGE_ALIASES[base]) return LANGUAGE_ALIASES[base];
  return null;
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
  ja: '日本語',
  es: 'Español',
};

// ISO country codes for display (language code -> country code)
export const LANGUAGE_DISPLAY_CODES: Record<SupportedLanguage, string> = {
  en: 'EN',
  pl: 'PL',
  de: 'DE',
  ar: 'AR',
  ja: 'JP',
  es: 'ES',
};

// Language direction (for RTL support)
export const LANGUAGE_DIRECTION: Record<SupportedLanguage, 'ltr' | 'rtl'> = {
  en: 'ltr',
  pl: 'ltr',
  de: 'ltr',
  ar: 'rtl',
  ja: 'ltr',
  es: 'ltr',
};

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Supported languages
    supportedLngs: SUPPORTED_LANGUAGES,
    // Prefer per-language fallback chains (and always end with EN)
    fallbackLng: {
      en: ['en'],
      pl: ['pl', 'en'],
      de: ['de', 'en'],
      es: ['es', 'en'],
      ar: ['ar', 'en'],
      ja: ['ja', 'en'],
      default: ['en'],
    },
    // Use browser language like "pl-PL" -> "pl"
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,

    // Default namespace
    defaultNS: 'translation',
    ns: NAMESPACES,

    // IMPORTANT: i18next debug logs (especially missingKey) can significantly slow down the app.
    // Keep it OFF by default. Enable explicitly via: VITE_I18N_DEBUG=true
    debug: import.meta.env.VITE_I18N_DEBUG === 'true',
    returnNull: false,
    returnEmptyString: false,

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Backend configuration for loading translation files
    backend: {
      loadPath: `${(import.meta.env.BASE_URL || '/').replace(/\/$/, '') || ''}/locales/{{lng}}/{{ns}}.json`,
      // Locale JSON must always refresh after deploys; otherwise browsers keep stale
      // translation payloads and render raw i18n keys until users clear cache manually.
      requestOptions: { cache: 'no-store' },
    },

    // Language detection configuration
    detection: {
      // Prefer explicit user choice first, then browser settings.
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Persist language choice so switching language is stable across reloads.
      caches: ['localStorage'],
      // Map common browser locales to our supported language codes
      // (e.g. a legacy stored/cached "jp" should resolve to app locale folder "ja")
      convertDetectedLanguage: (lng: string) => {
        const base = String(lng || '')
          .toLowerCase()
          .split(/[-_]/)[0];
        return normalizeLanguageCode(base) || base || lng;
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
  const lang = normalizeLanguageCode(lng) || 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGUAGE_DIRECTION[lang] || 'ltr';
  }
});

// Set initial language on document
if (typeof document !== 'undefined') {
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en';
  document.documentElement.lang = currentLang;
  document.documentElement.dir = LANGUAGE_DIRECTION[currentLang] || 'ltr';
}

// Helper function to get current language direction
export const getCurrentDirection = (): 'ltr' | 'rtl' => {
  const currentLang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || 'en';
  return LANGUAGE_DIRECTION[currentLang] || 'ltr';
};

// Helper function to safely change language
export const changeLanguage = async (lang: string): Promise<boolean> => {
  const normalized = normalizeLanguageCode(lang);
  if (!normalized) {
    console.warn(`[i18n] Attempted to switch to unsupported language: ${lang}`);
    return false;
  }

  try {
    await i18n.changeLanguage(normalized);
    // Ensure persistence even if detector is not available
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('i18nextLng', normalized);
      }
    } catch {
      // ignore
    }
    // Update document direction for RTL languages
    if (typeof document !== 'undefined') {
      document.documentElement.dir = LANGUAGE_DIRECTION[normalized];
      document.documentElement.lang = normalized;
    }
    return true;
  } catch (error) {
    console.error(`[i18n] Failed to change language to ${normalized}:`, error);
    return false;
  }
};

export default i18n;
