import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import en from '../../../public/locales/en/translation.json';

const files = [
  'src/components/assessment/drd/DrdLevelInterviewWorkspace.tsx',
  'src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx',
  'dev-render/screens/u19-drd-trzy-kolumny.tsx',
];

function hasKey(root: unknown, key: string): boolean {
  let value: unknown = root;
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object' || !(segment in value)) return false;
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === 'string' || (value !== null && typeof value === 'object');
}

describe('DRD interview i18n contract', () => {
  it('has zero missing English keys on the real DRD interview path and its runtime harness', () => {
    const literalKey = /\bt\(\s*['"]([^'"]+)['"]/g;
    const keys = new Set<string>();
    for (const relativePath of files) {
      const source = fs.readFileSync(path.resolve(relativePath), 'utf8');
      for (const match of source.matchAll(literalKey)) keys.add(match[1]);
    }

    const missing = [...keys].filter((key) => !hasKey(en, key));
    expect(missing).toEqual([]);
    expect(keys).toContain('discoveryToolsMain.toolContextPanel.workWithAi');
  });

  it('warns with the namespace and raw key when development detects a missing translation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { warnMissingTranslationKey } = await import('../../../src/i18n');

    warnMissingTranslationKey(['en'], 'translation', 'assessment.drd.missing');

    expect(warn).toHaveBeenCalledWith(
      '[i18n] Missing translation key: translation:assessment.drd.missing (en)'
    );
    warn.mockRestore();
  });
});
