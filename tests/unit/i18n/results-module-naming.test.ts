import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B3/RAPORT_B3.md (defekt #2):
 * moduł Wyniki miał dwie różne nazwy na tym samym ekranie — górny pasek/sidebar
 * pokazywał „Resultaty" (słowo nieistniejące w języku polskim, hybryda PL/EN),
 * podczas gdy lokalny breadcrumb wewnątrz strony poprawnie pokazywał „Wyniki".
 * Źródło: public/locales/pl/translation.json (klucze `sidebar.results` i
 * `agentPlan.canvas.moduleTag.results`), używane przez
 * src/components/navigation/Sidebar/menuConfig.ts:112
 * (`t('sidebar.results', 'Results')` — nawet fallback był angielski).
 *
 * Ten test pilnuje DWÓCH rzeczy:
 *  1) żaden klucz w słowniku PL nie ma wartości "Resultaty" (literówka/hybryda),
 *  2) `sidebar.results` w PL = "Wyniki" i w EN = "Results".
 *
 * Mutacja: przywróć "Resultaty" w dowolnym miejscu public/locales/pl/translation.json
 * → test czerwony.
 */

const readLocale = (locale: 'en' | 'pl') =>
  JSON.parse(
    readFileSync(path.join(process.cwd(), 'public', 'locales', locale, 'translation.json'), 'utf8')
  );

const getPath = (obj: unknown, dottedPath: string): unknown =>
  dottedPath.split('.').reduce((current: any, key) => current?.[key], obj);

function collectStringLeaves(obj: unknown, pathAcc: string[], out: Array<{ path: string; value: string }>): void {
  if (typeof obj === 'string') {
    out.push({ path: pathAcc.join('.'), value: obj });
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      collectStringLeaves(value, [...pathAcc, key], out);
    }
  }
}

describe('moduł Wyniki — jedna nazwa wszędzie (nie "Resultaty")', () => {
  it('żaden klucz PL nie zawiera surowego słowa "Resultaty"', () => {
    const pl = readLocale('pl');
    const leaves: Array<{ path: string; value: string }> = [];
    collectStringLeaves(pl, [], leaves);

    const offenders = leaves.filter((leaf) => leaf.value.includes('Resultaty'));

    expect(offenders, JSON.stringify(offenders, null, 2)).toHaveLength(0);
  });

  it('sidebar.results = "Wyniki" (PL) / "Results" (EN)', () => {
    const pl = readLocale('pl');
    const en = readLocale('en');

    expect(getPath(pl, 'sidebar.results')).toBe('Wyniki');
    expect(getPath(en, 'sidebar.results')).toBe('Results');
  });

  it('agentPlan.canvas.moduleTag.results = "Wyniki" (PL)', () => {
    const pl = readLocale('pl');
    expect(getPath(pl, 'agentPlan.canvas.moduleTag.results')).toBe('Wyniki');
  });
});
