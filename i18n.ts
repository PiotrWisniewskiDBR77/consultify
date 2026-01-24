/**
 * DEPRECATED: This file is kept for backwards compatibility.
 * The main i18n configuration is in src/i18n.ts
 *
 * Please use the centralized configuration from src/i18n.ts:
 * - SUPPORTED_LANGUAGES - list of supported language codes
 * - LANGUAGE_NAMES - display names for each language
 * - LANGUAGE_DIRECTION - RTL/LTR direction for each language
 * - changeLanguage() - helper function for safe language switching
 */

// Re-export from src/i18n.ts for compatibility
export * from './src/i18n';
export { default } from './src/i18n';
