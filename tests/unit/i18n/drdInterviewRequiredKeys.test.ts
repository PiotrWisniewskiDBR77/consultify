import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import en from '../../../public/locales/en/translation.json';
import pl from '../../../public/locales/pl/translation.json';

const sourceRoots = [
  'src/components/assessment/drd',
  'src/components/Interview',
];

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [absolute] : [];
  });
}

function hasKey(root: unknown, key: string): boolean {
  let value: unknown = root;
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) return false;
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === 'string' || (value !== null && typeof value === 'object');
}

describe('DRD and Interview i18n contract', () => {
  it('has zero missing literal keys in both supported locale files', () => {
    const literalKey = /\bt\(\s*['"]([^'"]+)['"]/g;
    const keys = new Set<string>();
    for (const file of sourceRoots.flatMap(sourceFiles)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(literalKey)) keys.add(match[1]);
    }

    const missing = [...keys].flatMap((key) => [
      ...(!hasKey(en, key) ? [`en:${key}`] : []),
      ...(!hasKey(pl, key) ? [`pl:${key}`] : []),
    ]);
    expect(missing).toEqual([]);
    expect(keys).toContain('assessment.drd.levelInterview.saveNext');
  });

  it('warns with the namespace and raw key when debug mode reports a missing translation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { warnMissingTranslationKey } = await import('../../../src/i18n');

    warnMissingTranslationKey(['en'], 'translation', 'assessment.drd.missing');

    expect(warn).toHaveBeenCalledWith(
      '[i18n] Missing translation key: translation:assessment.drd.missing (en)'
    );
    warn.mockRestore();
  });
});
