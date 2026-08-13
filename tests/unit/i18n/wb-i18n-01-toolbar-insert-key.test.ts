/**
 * WB-I18N-01 (RISK-09, docs/qa/ideas-complete-transformation-2026-08-09/
 * 16_OPEN_RISKS_AND_LIMITATIONS.csv): `myWork.whiteboard.toolbarExtra.insert`
 * used to render RAW — both as the visible label and as the button's
 * accessible name — because the key did not exist in either locale file yet
 * `WhiteboardToolbar.tsx` calls `t('myWork.whiteboard.toolbarExtra.insert')`
 * with no fallback default (see `WhiteboardToolbar.tsx` — the "Insert"
 * dropdown trigger). Under the real i18next instance, a call with no
 * `defaultValue` argument renders the dotted key literally whenever the key
 * is missing from the active locale's JSON.
 *
 * This is a narrow, targeted guard on top of the broader
 * `idea-workspace-required-keys.test.ts` sweep (which already covers every
 * `t()` call under `src/components/MyWork/whiteboard`, including this one):
 * it pins down the EXACT key this program's own risk register named, with an
 * assertion that the value is a real, distinct PL/EN translation — not just
 * "present" — so a future edit that reintroduces the raw-key regression (e.g.
 * copy-pasting the EN string into the PL file, or removing the key) fails
 * loudly and specifically.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KEY_PATH = 'myWork.whiteboard.toolbarExtra.insert';

function readTranslation(locale: 'en' | 'pl'): unknown {
  const p = path.join(process.cwd(), 'public', 'locales', locale, 'translation.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

function getPath(obj: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce((cur: any, part) => (cur == null ? undefined : cur[part]), obj);
}

describe('WB-I18N-01: myWork.whiteboard.toolbarExtra.insert must be a real translation, not a raw key', () => {
  it('resolves to a non-empty string in en/translation.json', () => {
    const value = getPath(readTranslation('en'), KEY_PATH);
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
    // Must not equal the dotted key itself or its last segment — that would
    // mean the JSON literally stores the raw key as its own "translation".
    expect(value).not.toBe(KEY_PATH);
    expect(value).not.toBe('insert');
  });

  it('resolves to a non-empty string in pl/translation.json', () => {
    const value = getPath(readTranslation('pl'), KEY_PATH);
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
    expect(value).not.toBe(KEY_PATH);
    expect(value).not.toBe('insert');
  });

  it('PL and EN carry genuinely different copy (not an English fallback copy-pasted into PL)', () => {
    const en = getPath(readTranslation('en'), KEY_PATH);
    const pl = getPath(readTranslation('pl'), KEY_PATH);
    expect(en).toBe('Insert');
    expect(pl).toBe('Wstaw');
    expect(pl).not.toBe(en);
  });
});
