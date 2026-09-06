/**
 * 1.1-T1 (DEC-412) — nagłówki i wartości zakładki Inicjatywy po polsku.
 *
 * Zrzut właściciela 06.09 pokazywał w polskiej aplikacji: INITIATIVE · OŚ ·
 * PRIORITY · STATUS · ROI · TASKS · UPDATED, a w wierszach „Strategic" i
 * „Medium". Powód: kolumny wołały `t(klucz, 'Initiative')` bez klucza w
 * `pl/translation.json` (fallback = angielski default), a wartości szły
 * surowe z API przez `capitalize`.
 *
 * Ten test broni obu warstw naraz i celowo NIE poprzestaje na „klucz
 * istnieje" (kształt 18: klucz w pl trzymający angielskie słowo przechodzi
 * audyt istnienia): wymaga, żeby wartość pl RÓŻNIŁA się od en tam, gdzie
 * polskie słowo faktycznie jest inne.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const load = (lang: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), `public/locales/${lang}/translation.json`), 'utf8'));

const at = (root: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((cur, seg) => {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[seg];
    }
    return undefined;
  }, root);

const pl = load('pl');
const en = load('en');

/** Klucz -> czy polskie tłumaczenie MUSI się różnić od angielskiego. */
const KLUCZE: Array<[string, boolean]> = [
  ['tools.hub.initiatives.columns.initiative', true],
  ['tools.hub.initiatives.columns.axis', true],
  ['tools.hub.initiatives.columns.priority', true],
  ['tools.hub.initiatives.columns.status', false], // „Status" po polsku to „Status"
  ['tools.hub.initiatives.columns.tasks', true],
  ['tools.hub.initiatives.columns.updated', true],
  ['tools.axis.strategic', true],
  ['tools.axis.operational', true],
  ['tools.axis.digital', true],
  ['tools.priority.low', true],
  ['tools.priority.medium', true],
  ['tools.priority.high', true],
  ['tools.priority.urgent', true],
  ['tools.hub.insights.columns.toolType', true],
  ['tools.hub.insights.columns.sourceSession', true],
  ['tools.hub.empty.insights', true],
  ['tools.hub.cta.newSession', true],
  ['tools.hub.cta.newInsight', false], // „insight" to zapożyczenie w użyciu właściciela
  ['tools.hub.cta.newReport', true],
  ['tools.hub.cta.newInitiative', true],
  ['tools.hub.cta.goToSessions', true],
];

describe('1.1-T1 — klucze i18n zakładek Narzędzi (pl + en)', () => {
  it.each(KLUCZE)('%s istnieje w pl i en', (key) => {
    expect(typeof at(pl, key), `brak klucza w pl: ${key}`).toBe('string');
    expect(typeof at(en, key), `brak klucza w en: ${key}`).toBe('string');
  });

  it.each(KLUCZE.filter(([, musiSieRoznic]) => musiSieRoznic))(
    '%s jest faktycznie przetłumaczony (pl != en)',
    (key) => {
      expect(String(at(pl, key)).toLowerCase()).not.toBe(String(at(en, key)).toLowerCase());
    }
  );
});
