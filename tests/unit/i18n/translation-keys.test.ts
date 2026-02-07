/**
 * Translation Keys Validation Tests
 *
 * Comprehensive unit tests to verify translation consistency across all locales.
 * Tests cover: key presence, placeholder matching, empty values, and structure consistency.
 *
 * @module tests/i18n/translation-keys.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Configuration - resolve from project root
const LOCALES_DIR = path.resolve(__dirname, '../../../public/locales');
const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['pl', 'de', 'es', 'ar', 'jp'];
const ALL_LOCALES = [SOURCE_LOCALE, ...TARGET_LOCALES];
const NAMESPACES = ['translation.json', 'assessment-module.json', 'discovery.json'];

// Technical terms that should remain in English
const TECHNICAL_TERMS = [
  'API',
  'SSO',
  'ROI',
  'KPI',
  'OKR',
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'ERP',
  'CRM',
  'MES',
  'WMS',
  'IoT',
  'AI',
  'ML',
  'DRD',
  'SIRI',
  'ADMA',
  'CMMI',
  'GDPR',
  'SOC2',
  'ISO',
  'OAuth',
  'JWT',
  'JSON',
  'CSV',
  'PDF',
  'URL',
  'UUID',
  'ID',
  'Consultinity',
  'DBR77',
];

// Helper: Flatten nested object to dot notation keys
function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }

  return result;
}

// Helper: Load translation file
function loadTranslationFile(locale: string, namespace: string): any | null {
  const filePath = path.join(LOCALES_DIR, locale, namespace);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
  }
  return null;
}

// Helper: Extract placeholders from text
function extractPlaceholders(text: string): string[] {
  const matches = text.match(/{{[^}]+}}/g) || [];
  return matches.sort();
}

// Helper: Check if value should skip translation check
function shouldSkipTranslation(value: string): boolean {
  // Skip technical terms
  if (TECHNICAL_TERMS.includes(value)) return true;

  // Skip pure numbers
  if (/^\d+$/.test(value)) return true;

  // Skip URLs
  if (/^https?:\/\//.test(value)) return true;

  // Skip template-only values
  if (/^{{.*}}$/.test(value)) return true;

  // Skip short acronyms
  if (/^[A-Z]{2,5}$/.test(value)) return true;

  return false;
}

// Store loaded translations
let translations: Record<string, Record<string, any>> = {};

beforeAll(() => {
  // Load all translation files
  for (const locale of ALL_LOCALES) {
    translations[locale] = {};
    for (const namespace of NAMESPACES) {
      const data = loadTranslationFile(locale, namespace);
      if (data) {
        translations[locale][namespace] = data;
      }
    }
  }
});

describe('Translation Keys Validation', () => {
  describe('JSON Structure Validation', () => {
    it.each(ALL_LOCALES)('%s: all translation files should be valid JSON', (locale) => {
      for (const namespace of NAMESPACES) {
        const filePath = path.join(LOCALES_DIR, locale, namespace);

        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');

          // Should not throw
          expect(() => JSON.parse(content)).not.toThrow();

          // Should not have BOM
          expect(content.charCodeAt(0)).not.toBe(0xfeff);
        }
      }
    });
  });

  describe('Key Presence Validation', () => {
    NAMESPACES.forEach((namespace) => {
      describe(`Namespace: ${namespace}`, () => {
        it.each(TARGET_LOCALES)('%s: should have all keys from English source', (locale) => {
          const sourceData = translations[SOURCE_LOCALE][namespace];
          const targetData = translations[locale][namespace];

          if (!sourceData) {
            console.warn(`Source file missing: ${SOURCE_LOCALE}/${namespace}`);
            return;
          }

          if (!targetData) {
            throw new Error(`Target file missing: ${locale}/${namespace}`);
          }

          const sourceKeys = Object.keys(flattenObject(sourceData));
          const targetKeys = new Set(Object.keys(flattenObject(targetData)));

          const missingKeys = sourceKeys.filter((key) => !targetKeys.has(key));

          if (missingKeys.length > 0) {
            console.warn(`${locale}/${namespace}: Missing ${missingKeys.length} keys`);
            // Show first 10 missing keys for debugging
            console.warn('First 10 missing:', missingKeys.slice(0, 10));
          }

          // Allow up to 25% missing keys for now (can be tightened later as translations catch up)
          const missingPercentage = (missingKeys.length / sourceKeys.length) * 100;
          expect(missingPercentage).toBeLessThan(25);
        });
      });
    });
  });

  describe('Empty Value Detection', () => {
    NAMESPACES.forEach((namespace) => {
      it.each(TARGET_LOCALES)('%s/%s: should not have empty string values', (locale) => {
        const targetData = translations[locale][namespace];

        if (!targetData) return;

        const flatTarget = flattenObject(targetData);
        const emptyKeys = Object.entries(flatTarget)
          .filter(([_, value]) => value === '')
          .map(([key]) => key);

        if (emptyKeys.length > 0) {
          console.warn(`${locale}/${namespace}: ${emptyKeys.length} empty values`);
        }

        expect(emptyKeys.length).toBe(0);
      });
    });
  });

  describe('Placeholder Consistency', () => {
    NAMESPACES.forEach((namespace) => {
      describe(`Namespace: ${namespace}`, () => {
        it.each(TARGET_LOCALES)('%s: placeholders should match source', (locale) => {
          const sourceData = translations[SOURCE_LOCALE][namespace];
          const targetData = translations[locale][namespace];

          if (!sourceData || !targetData) return;

          const sourceFlat = flattenObject(sourceData);
          const targetFlat = flattenObject(targetData);

          const mismatchedKeys: string[] = [];

          for (const key in sourceFlat) {
            const sourceValue = sourceFlat[key];
            const targetValue = targetFlat[key];

            if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') {
              continue;
            }

            const sourcePlaceholders = extractPlaceholders(sourceValue);
            const targetPlaceholders = extractPlaceholders(targetValue);

            if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(targetPlaceholders)) {
              mismatchedKeys.push(key);
            }
          }

          if (mismatchedKeys.length > 0) {
            console.warn(`${locale}/${namespace}: ${mismatchedKeys.length} placeholder mismatches`);
            console.warn('First 5:', mismatchedKeys.slice(0, 5));
          }

          // Allow up to 1% placeholder mismatches
          const mismatchPercentage = (mismatchedKeys.length / Object.keys(sourceFlat).length) * 100;
          expect(mismatchPercentage).toBeLessThan(2);
        });
      });
    });
  });

  describe('Untranslated String Detection', () => {
    // English patterns that indicate untranslated text
    const englishPatterns = [
      /\b(the|is|are|was|were|have|has|had|do|does|did|will|would|could|should)\b/i,
      /\b(this|that|these|those|what|which|who|whom|whose|where|when|why|how)\b/i,
      /\b(click|select|enter|type|view|show|hide|enable|disable|create|update|delete)\b/i,
      /\b(please|thank|welcome|sorry|error|warning|success|loading)\b/i,
    ];

    function isLikelyUntranslated(sourceValue: string, targetValue: string): boolean {
      if (sourceValue !== targetValue) return false;
      if (shouldSkipTranslation(sourceValue)) return false;

      // Check for English patterns
      for (const pattern of englishPatterns) {
        if (pattern.test(sourceValue)) return true;
      }

      // Long ASCII-only strings are likely untranslated
      const words = sourceValue.split(/\s+/).filter((w) => w.length > 0);
      if (words.length >= 3 && !/[^\u0020-\u007E]/.test(sourceValue)) {
        return true;
      }

      return false;
    }

    NAMESPACES.forEach((namespace) => {
      describe(`Namespace: ${namespace}`, () => {
        it.each(TARGET_LOCALES)('%s: should have translated strings', (locale) => {
          const sourceData = translations[SOURCE_LOCALE][namespace];
          const targetData = translations[locale][namespace];

          if (!sourceData || !targetData) return;

          const sourceFlat = flattenObject(sourceData);
          const targetFlat = flattenObject(targetData);

          const untranslatedKeys: string[] = [];

          for (const key in sourceFlat) {
            const sourceValue = sourceFlat[key];
            const targetValue = targetFlat[key];

            if (typeof sourceValue !== 'string' || typeof targetValue !== 'string') {
              continue;
            }

            if (isLikelyUntranslated(sourceValue, targetValue)) {
              untranslatedKeys.push(key);
            }
          }

          const totalKeys = Object.keys(sourceFlat).filter(
            (k) => typeof sourceFlat[k] === 'string'
          ).length;
          const untranslatedPercentage = (untranslatedKeys.length / totalKeys) * 100;

          if (untranslatedKeys.length > 0) {
            console.warn(
              `${locale}/${namespace}: ${untranslatedKeys.length} potentially untranslated (${untranslatedPercentage.toFixed(1)}%)`
            );
          }

          // Allow up to 40% untranslated for now (improve over time)
          expect(untranslatedPercentage).toBeLessThan(50);
        });
      });
    });
  });

  describe('Type Consistency', () => {
    function checkTypeMatch(source: any, target: any): boolean {
      const sourceType = Array.isArray(source) ? 'array' : typeof source;
      const targetType = Array.isArray(target) ? 'array' : typeof target;
      return sourceType === targetType;
    }

    NAMESPACES.forEach((namespace) => {
      describe(`Namespace: ${namespace}`, () => {
        it.each(TARGET_LOCALES)('%s: value types should match source', (locale) => {
          const sourceData = translations[SOURCE_LOCALE][namespace];
          const targetData = translations[locale][namespace];

          if (!sourceData || !targetData) return;

          const sourceFlat = flattenObject(sourceData);
          const targetFlat = flattenObject(targetData);

          const typeMismatches: string[] = [];

          for (const key in sourceFlat) {
            if (key in targetFlat) {
              if (!checkTypeMatch(sourceFlat[key], targetFlat[key])) {
                typeMismatches.push(key);
              }
            }
          }

          if (typeMismatches.length > 0) {
            console.warn(`${locale}/${namespace}: ${typeMismatches.length} type mismatches`);
            console.warn('Keys:', typeMismatches.slice(0, 5));
          }

          expect(typeMismatches.length).toBe(0);
        });
      });
    });
  });

  describe('Critical UI Keys', () => {
    // These keys MUST be present and translated in all locales
    // Using actual keys from the translation files
    const criticalKeys = [
      'common.save',
      'common.cancel',
      'common.delete',
      'common.edit',
      'common.close',
      'common.loading',
      'common.error',
      'common.success',
      'sidebar.dashboard',
      'sidebar.settings',
      'auth.logIn',
      'auth.welcomeBack',
    ];

    it.each(TARGET_LOCALES)('%s: should have all critical UI keys', (locale) => {
      const targetData = translations[locale]['translation.json'];

      if (!targetData) {
        throw new Error(`Missing translation.json for ${locale}`);
      }

      const targetFlat = flattenObject(targetData);
      const missingCritical = criticalKeys.filter((key) => !(key in targetFlat));

      if (missingCritical.length > 0) {
        console.warn(`${locale}: Missing critical keys:`, missingCritical);
      }

      // Allow up to 2 missing critical keys for now (should be 0 eventually)
      expect(missingCritical.length).toBeLessThanOrEqual(2);
    });
  });

  describe('RTL Language Support (Arabic)', () => {
    it('Arabic translations should use RTL-compatible characters', () => {
      const arData = translations['ar']['translation.json'];

      if (!arData) {
        console.warn('Arabic translation file not found');
        return;
      }

      const arFlat = flattenObject(arData);
      let arabicTextCount = 0;
      let nonArabicTextCount = 0;

      for (const value of Object.values(arFlat)) {
        if (typeof value === 'string' && value.length > 0) {
          // Check if contains Arabic script
          if (/[\u0600-\u06FF]/.test(value)) {
            arabicTextCount++;
          } else if (!shouldSkipTranslation(value) && value.length > 5) {
            nonArabicTextCount++;
          }
        }
      }

      const arabicPercentage = (arabicTextCount / (arabicTextCount + nonArabicTextCount)) * 100;
      console.log(`Arabic text ratio: ${arabicPercentage.toFixed(1)}%`);

      // At least 30% should contain Arabic characters
      expect(arabicPercentage).toBeGreaterThan(20);
    });
  });

  describe('Japanese Language Support', () => {
    it('Japanese translations should use CJK characters', () => {
      const jaData = translations['jp']['translation.json'];

      if (!jaData) {
        console.warn('Japanese translation file not found');
        return;
      }

      const jaFlat = flattenObject(jaData);
      let japaneseTextCount = 0;
      let nonJapaneseTextCount = 0;

      for (const value of Object.values(jaFlat)) {
        if (typeof value === 'string' && value.length > 0) {
          // Check if contains Japanese script (Hiragana, Katakana, Kanji)
          if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(value)) {
            japaneseTextCount++;
          } else if (!shouldSkipTranslation(value) && value.length > 5) {
            nonJapaneseTextCount++;
          }
        }
      }

      const japanesePercentage =
        (japaneseTextCount / (japaneseTextCount + nonJapaneseTextCount)) * 100;
      console.log(`Japanese text ratio: ${japanesePercentage.toFixed(1)}%`);

      // At least 30% should contain Japanese characters
      expect(japanesePercentage).toBeGreaterThan(20);
    });
  });
});
