import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPORT_MESSAGE_KEYS } from '../reportLocale.js';

type LocaleTree = Record<string, unknown>;

function readLocale(locale: 'en' | 'pl'): LocaleTree {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `public/locales/${locale}/translation.json`), 'utf8')
  ) as LocaleTree;
}

function readKey(tree: LocaleTree, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as LocaleTree)[segment];
  }, tree);
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{\s*([^},\s]+).*?}}/g)].map((match) => match[1]).sort();
}

describe('report locale resources', () => {
  const en = readLocale('en');
  const pl = readLocale('pl');

  it('publishes every server report message key as a non-empty EN and PL string', () => {
    // 43rd key: executionReports.workAnalysis.emptySnapshot, added server-side by
    // 3ca97b51f8 (Codex, "Align execution work task source") without its frontend
    // mirror; D-120 publishes it under executionReports.workAnalysis in both
    // translation.json files. The count is pinned next to the explicit key so the
    // next addition must name its commit here, not just bump the number.
    expect(REPORT_MESSAGE_KEYS).toContain('executionReports.workAnalysis.emptySnapshot');
    expect(REPORT_MESSAGE_KEYS).toHaveLength(43);

    for (const key of REPORT_MESSAGE_KEYS) {
      const enValue = readKey(en, key);
      const plValue = readKey(pl, key);

      expect(enValue, `missing EN resource: ${key}`).toEqual(expect.any(String));
      expect(plValue, `missing PL resource: ${key}`).toEqual(expect.any(String));
      expect((enValue as string).trim(), `empty EN resource: ${key}`).not.toBe('');
      expect((plValue as string).trim(), `empty PL resource: ${key}`).not.toBe('');
      expect(placeholders(enValue as string), `placeholder mismatch: ${key}`).toEqual(
        placeholders(plValue as string)
      );
    }
  });

  it('keeps only natural product terms identical between EN and PL', () => {
    const identical = REPORT_MESSAGE_KEYS.filter((key) => readKey(en, key) === readKey(pl, key));

    expect(identical.sort()).toEqual(
      ['executionReports.kpi', 'executionReports.labels.status', 'executionReports.level.PMO'].sort()
    );
  });
});
