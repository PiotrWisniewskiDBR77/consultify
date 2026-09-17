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
  const segments = key.split('.');
  const leaf = segments.pop();
  if (!leaf) return false;
  let parent: unknown = root;
  for (const segment of segments) {
    if (!parent || typeof parent !== 'object' || !(segment in parent)) return false;
    parent = (parent as Record<string, unknown>)[segment];
  }
  if (!parent || typeof parent !== 'object') return false;
  const value = (parent as Record<string, unknown>)[leaf];
  if (typeof value === 'string' || (value !== null && typeof value === 'object')) return true;
  return ['one', 'few', 'many', 'other'].some(
    (suffix) =>
      typeof (parent as Record<string, unknown>)[`${leaf}_${suffix}`] === 'string'
  );
}

describe('DRD and Interview i18n contract', () => {
  it('has zero missing literal keys in both supported locale files', () => {
    const literalKey = /\bt\(\s*['"]([^'"]+)['"]/g;
    const keys = new Set<string>();
    for (const file of sourceRoots.flatMap(sourceFiles)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(literalKey)) {
        if (!match[1].includes('…')) keys.add(match[1]);
      }
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
