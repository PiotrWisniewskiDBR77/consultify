/**
 * Safe i18n helpers
 * 
 * These helpers ensure i18n.language is always defined, preventing
 * "Cannot read property 'split' of undefined" errors when i18n
 * hasn't been initialized yet.
 */

import i18n from '../i18n';

/** Default fallback language */
export const DEFAULT_LANGUAGE = 'en';

/**
 * Safely get current language with fallback
 * Use this instead of i18n.language directly
 */
export function getCurrentLanguage(): string {
  return i18n.language || DEFAULT_LANGUAGE;
}

/**
 * Safely get language code (first part before dash)
 * e.g., 'en-US' -> 'en', 'pl' -> 'pl'
 */
export function getLanguageCode(): string {
  const lang = getCurrentLanguage();
  return lang.split('-')[0];
}

/**
 * Check if current language starts with given code
 * Safe version of i18n.language.startsWith()
 */
export function languageStartsWith(code: string): boolean {
  return getCurrentLanguage().startsWith(code);
}

/**
 * Check if current language matches given code exactly
 */
export function languageEquals(code: string): boolean {
  return getCurrentLanguage() === code;
}

/**
 * Check if i18n is fully initialized
 */
export function isI18nReady(): boolean {
  return i18n.isInitialized && !!i18n.language;
}

/**
 * Get language for API calls (normalized)
 */
export function getApiLanguage(): 'en' | 'pl' {
  const code = getLanguageCode();
  return code === 'pl' ? 'pl' : 'en';
}
