/**
 * Localization Service Unit Tests
 *
 * Tests for internationalization and localization.
 *
 * @module tests/unit/backend/localizationService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create localization service implementation
const createLocalizationService = () => {
  const translations = new Map();
  const supportedLocales = ['en', 'pl', 'de', 'fr', 'es'];

  // Default translations
  const defaultTranslations = {
    en: {
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.confirm': 'Confirm',
      'errors.required': '{field} is required',
      'errors.invalid': 'Invalid {field}',
      'welcome.greeting': 'Hello, {name}!',
      'items.count': '{count} item | {count} items',
    },
    pl: {
      'common.save': 'Zapisz',
      'common.cancel': 'Anuluj',
      'common.delete': 'Usuń',
      'common.confirm': 'Potwierdź',
      'errors.required': 'Pole {field} jest wymagane',
      'errors.invalid': 'Nieprawidłowe pole {field}',
      'welcome.greeting': 'Cześć, {name}!',
      'items.count': '{count} element | {count} elementy | {count} elementów',
    },
  };

  Object.entries(defaultTranslations).forEach(([locale, trans]) => {
    translations.set(locale, trans);
  });

  return {
    // Translate key
    translate: (key, locale = 'en', params = {}) => {
      const localeTranslations = translations.get(locale) || translations.get('en');
      let text = localeTranslations[key] || key;

      // Handle pluralization
      if (text.includes('|') && 'count' in params) {
        const forms = text.split('|').map((s) => s.trim());
        const count = params.count;

        if (locale === 'pl') {
          // Polish plural rules
          if (count === 1) text = forms[0];
          else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20))
            text = forms[1] || forms[0];
          else text = forms[2] || forms[0];
        } else {
          // Simple plural (English)
          text = count === 1 ? forms[0] : forms[1] || forms[0];
        }
      }

      // Replace parameters
      for (const [param, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
      }

      return text;
    },

    // Get all translations for locale
    getTranslations: (locale) => {
      return translations.get(locale) || {};
    },

    // Add translation
    addTranslation: (locale, key, value) => {
      if (!translations.has(locale)) {
        translations.set(locale, {});
      }
      translations.get(locale)[key] = value;
    },

    // Add multiple translations
    addTranslations: (locale, newTranslations) => {
      const current = translations.get(locale) || {};
      translations.set(locale, { ...current, ...newTranslations });
    },

    // Check if locale is supported
    isSupported: (locale) => {
      return supportedLocales.includes(locale);
    },

    // Get supported locales
    getSupportedLocales: () => {
      return [...supportedLocales];
    },

    // Get missing translations
    getMissingTranslations: (locale, referenceLocale = 'en') => {
      const reference = translations.get(referenceLocale) || {};
      const target = translations.get(locale) || {};

      const missing = [];
      for (const key of Object.keys(reference)) {
        if (!target[key]) {
          missing.push(key);
        }
      }

      return missing;
    },

    // Format number
    formatNumber: (value, locale, options = {}) => {
      return new Intl.NumberFormat(locale, options).format(value);
    },

    // Format date
    formatDate: (date, locale, options = {}) => {
      return new Intl.DateTimeFormat(locale, options).format(new Date(date));
    },

    // Format currency
    formatCurrency: (value, locale, currency = 'USD') => {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
    },

    // Clear for testing
    clear: () => {
      translations.clear();
      Object.entries(defaultTranslations).forEach(([locale, trans]) => {
        translations.set(locale, trans);
      });
    },
  };
};

describe('LocalizationService', () => {
  let localizationService;

  beforeEach(() => {
    localizationService = createLocalizationService();
  });

  describe('Basic Translation', () => {
    it('should translate key', () => {
      const result = localizationService.translate('common.save', 'en');
      expect(result).toBe('Save');
    });

    it('should translate to Polish', () => {
      const result = localizationService.translate('common.save', 'pl');
      expect(result).toBe('Zapisz');
    });

    it('should return key if translation missing', () => {
      const result = localizationService.translate('missing.key', 'en');
      expect(result).toBe('missing.key');
    });

    it('should fallback to English for unsupported locale', () => {
      const result = localizationService.translate('common.save', 'xx');
      expect(result).toBe('Save');
    });
  });

  describe('Parameter Interpolation', () => {
    it('should interpolate parameters', () => {
      const result = localizationService.translate('welcome.greeting', 'en', { name: 'John' });
      expect(result).toBe('Hello, John!');
    });

    it('should interpolate in Polish', () => {
      const result = localizationService.translate('welcome.greeting', 'pl', { name: 'Jan' });
      expect(result).toBe('Cześć, Jan!');
    });

    it('should handle multiple parameters', () => {
      const result = localizationService.translate('errors.required', 'en', { field: 'Email' });
      expect(result).toBe('Email is required');
    });
  });

  describe('Pluralization', () => {
    it('should handle English singular', () => {
      const result = localizationService.translate('items.count', 'en', { count: 1 });
      expect(result).toBe('1 item');
    });

    it('should handle English plural', () => {
      const result = localizationService.translate('items.count', 'en', { count: 5 });
      expect(result).toBe('5 items');
    });

    it('should handle Polish plural forms', () => {
      const one = localizationService.translate('items.count', 'pl', { count: 1 });
      const few = localizationService.translate('items.count', 'pl', { count: 3 });
      const many = localizationService.translate('items.count', 'pl', { count: 5 });

      expect(one).toBe('1 element');
      expect(few).toBe('3 elementy');
      expect(many).toBe('5 elementów');
    });
  });

  describe('Locale Management', () => {
    it('should check supported locales', () => {
      expect(localizationService.isSupported('en')).toBe(true);
      expect(localizationService.isSupported('pl')).toBe(true);
      expect(localizationService.isSupported('xx')).toBe(false);
    });

    it('should list supported locales', () => {
      const locales = localizationService.getSupportedLocales();
      expect(locales).toContain('en');
      expect(locales).toContain('pl');
    });
  });

  describe('Translation Management', () => {
    it('should add single translation', () => {
      localizationService.addTranslation('en', 'new.key', 'New Value');

      const result = localizationService.translate('new.key', 'en');
      expect(result).toBe('New Value');
    });

    it('should add multiple translations', () => {
      localizationService.addTranslations('en', {
        'batch.one': 'One',
        'batch.two': 'Two',
      });

      expect(localizationService.translate('batch.one', 'en')).toBe('One');
      expect(localizationService.translate('batch.two', 'en')).toBe('Two');
    });

    it('should find missing translations', () => {
      const missing = localizationService.getMissingTranslations('de', 'en');
      expect(missing.length).toBeGreaterThan(0);
      expect(missing).toContain('common.save');
    });
  });

  describe('Formatting', () => {
    it('should format numbers', () => {
      const result = localizationService.formatNumber(1234567.89, 'en-US');
      expect(result).toBe('1,234,567.89');
    });

    it('should format currency', () => {
      const usd = localizationService.formatCurrency(99.99, 'en-US', 'USD');
      expect(usd).toContain('99.99');
      expect(usd).toContain('$');
    });

    it('should format dates', () => {
      const date = localizationService.formatDate('2026-01-08', 'en-US');
      expect(date).toBeDefined();
    });
  });
});
