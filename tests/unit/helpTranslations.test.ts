import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type JsonValue = Record<string, unknown>;

function readJson(filePath: string): JsonValue {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonValue;
}

function getNestedValue(value: JsonValue, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
  }, value);
}

function findMissingKeys(source: unknown, target: unknown, basePath = ''): string[] {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return [];
  }

  const missing: string[] = [];

  for (const key of Object.keys(source as Record<string, unknown>)) {
    const currentPath = basePath ? `${basePath}.${key}` : key;
    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue =
      target && typeof target === 'object' && !Array.isArray(target)
        ? (target as Record<string, unknown>)[key]
        : undefined;

    if (targetValue === undefined) {
      missing.push(currentPath);
      continue;
    }

    missing.push(...findMissingKeys(sourceValue, targetValue, currentPath));
  }

  return missing;
}

const testFileDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testFileDir, '../..');
const config = readJson(path.join(rootDir, 'scripts/i18n/i18n-config.json')) as {
  localesDir: string;
  sourceLocale: string;
  helpPaths: string[];
};

const localesDir = path.join(rootDir, config.localesDir);
const source = readJson(path.join(localesDir, config.sourceLocale, 'translation.json'));
const localesToVerify = ['en', 'pl', 'de'] as const;

describe('help translations for core locales', () => {
  it('loads the english, polish, and german translation files', () => {
    for (const locale of localesToVerify) {
      expect(() => readJson(path.join(localesDir, locale, 'translation.json'))).not.toThrow();
    }
  });

  it('keeps polish and german help keys aligned with english', () => {
    for (const locale of localesToVerify.filter((item) => item !== config.sourceLocale)) {
      const target = readJson(path.join(localesDir, locale, 'translation.json'));
      const missing = config.helpPaths.flatMap((helpPath) => {
        const sourceValue = getNestedValue(source, helpPath);
        const targetValue = getNestedValue(target, helpPath);

        if (sourceValue === undefined) {
          return [];
        }

        if (targetValue === undefined) {
          return [helpPath];
        }

        return findMissingKeys(sourceValue, targetValue, helpPath);
      });

      expect(
        missing,
        `${locale.toUpperCase()} is missing help translations:\n${missing.join('\n')}`
      ).toEqual([]);
    }
  });
});
