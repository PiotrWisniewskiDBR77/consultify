/**
 * i18n parity test: every TABELE_CONSULTING_TEMPLATES seed_id must have a
 * matching `tabele.template.<seed_id>.{title,description}` key in BOTH
 * `locales/en/tabele-templates.json` and `locales/pl/tabele-templates.json`.
 *
 * This guards against drift: adding a new template without translating it,
 * or adding stray translations that no longer point at a real seed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TABELE_CONSULTING_TEMPLATES } from '../tabele_consulting_templates.js';

interface I18nFile {
  tabele?: {
    template?: Record<string, { title?: string; description?: string }>;
  };
}

function loadLocale(lang: 'en' | 'pl'): I18nFile {
  const path = resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    '..',
    'public',
    'locales',
    lang,
    'tabele-templates.json'
  );
  return JSON.parse(readFileSync(path, 'utf8')) as I18nFile;
}

describe('tabele-templates i18n parity', () => {
  const en = loadLocale('en');
  const pl = loadLocale('pl');

  it('every seed_id has an EN title + description', () => {
    const enTemplates = en.tabele?.template ?? {};
    const missing: string[] = [];
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      const entry = enTemplates[tpl.seed_id];
      if (!entry?.title || !entry?.description) missing.push(tpl.seed_id);
    }
    expect(missing).toEqual([]);
  });

  it('every seed_id has a PL title + description', () => {
    const plTemplates = pl.tabele?.template ?? {};
    const missing: string[] = [];
    for (const tpl of TABELE_CONSULTING_TEMPLATES) {
      const entry = plTemplates[tpl.seed_id];
      if (!entry?.title || !entry?.description) missing.push(tpl.seed_id);
    }
    expect(missing).toEqual([]);
  });

  it('EN and PL translation key sets are identical (no orphaned keys)', () => {
    const enKeys = new Set(Object.keys(en.tabele?.template ?? {}));
    const plKeys = new Set(Object.keys(pl.tabele?.template ?? {}));
    const onlyInEn: string[] = [];
    const onlyInPl: string[] = [];
    for (const k of enKeys) if (!plKeys.has(k)) onlyInEn.push(k);
    for (const k of plKeys) if (!enKeys.has(k)) onlyInPl.push(k);
    expect({ onlyInEn, onlyInPl }).toEqual({ onlyInEn: [], onlyInPl: [] });
  });

  it('EN and PL files contain exactly 30 template keys (matches seed pack size)', () => {
    expect(Object.keys(en.tabele?.template ?? {})).toHaveLength(30);
    expect(Object.keys(pl.tabele?.template ?? {})).toHaveLength(30);
  });

  it('no translation key references a seed_id that no longer exists in the seed pack', () => {
    const validSeedIds = new Set(TABELE_CONSULTING_TEMPLATES.map((t) => t.seed_id));
    const enKeys = Object.keys(en.tabele?.template ?? {});
    const plKeys = Object.keys(pl.tabele?.template ?? {});
    const stale = [...new Set([...enKeys, ...plKeys])].filter((k) => !validSeedIds.has(k));
    expect(stale).toEqual([]);
  });
});
