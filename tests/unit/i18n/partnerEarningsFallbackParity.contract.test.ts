import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * KONTRAKT — POPRAWKA PO ODRZUCENIU DYŻURU 128.
 *
 * PRZYCZYNA ŹRÓDŁOWA, której dyżur 128 nie trafił.
 * `t('klucz', 'fallback')` renderuje `fallback` DOKŁADNIE wtedy, gdy klucza
 * brakuje w katalogu. Klucz obecny w `pl` i nieobecny w `en` znaczy, że polski
 * użytkownik widzi tłumaczenie, a angielski — surowy tekst zastępczy z kodu.
 * Tak wyciekał kod `AMD-PRT-ECONOMICS-002`: nie przez brak poprawki tekstu,
 * tylko przez brak klucza `en`. Dyżur 128 poprawił tekst zastępczy i uznał
 * sprawę za zamkniętą, zostawiając przyczynę nietkniętą.
 *
 * DLACZEGO ASERCJA NIE JEST REGEXEM NA APOSTROFY.
 * Dyżur 128 dostał test w kształcie `not.toMatch(/'[^'\n]*KOD[^'\n]*'/)`.
 * Taki test jest ślepy na ten sam wyciek zapisany jako goły tekst JSX —
 * a taki wyciek realnie istnieje w produkcie. Sprawdzamy cały plik
 * z wyciętymi komentarzami, więc każdy kształt zapisu jest łapany.
 *
 * ZAPADKA PARYTETU (§3).
 * Na tym ekranie brakuje dziś 17 kluczy `en` poza zakresem tej poprawki.
 * NIE osłabiam asercji, żeby to ukryć, i NIE naprawiam ich tutaj: te same
 * pliki katalogów pisze równolegle dyżur 127 (język Czatu i Partnera), a
 * dwa tory na jednym pliku to kolizja. Zamiast tego dług jest WYPISANY
 * IMIENNIE i zamrożony: osiemnasty brak wywala test.
 */

const REPO = process.cwd();
const SOURCE = path.resolve(REPO, 'src/views/partner/sections/EarningsSection.tsx');
const POLICY_CODE = 'AMD-PRT-ECONOMICS-002';

/** Klucze, których brak `en` powodował wyciek kodu polityki. Naprawione tutaj. */
const KEYS_FIXED_HERE = [
  'partner.earnings.policyUnavailableTitle',
  'partner.earnings.payoutOperationsUnavailable',
  'partner.earnings.historicalReadOnlyUnavailable',
];

/**
 * DŁUG ZASTANY — 17 kluczy bez tłumaczenia `en`, zmierzonych 2026-08-29.
 * Do spłaty przez prace językowe, nie przez tę poprawkę. Lista jest zamrożona:
 * skrócenie jej jest mile widziane, wydłużenie oznacza nową regresję.
 */
const KNOWN_EN_GAPS = [
  'partner.earnings.approvedAmount',
  'partner.earnings.heldAmount',
  'partner.earnings.itemsCount',
  'partner.earnings.lastMonthAmount',
  'partner.earnings.paidSuffix',
  'partner.payoutSettings.accountHolder',
  'partner.payoutSettings.bankDetails',
  'partner.payoutSettings.bankName',
  'partner.payoutSettings.historicalOnly',
  'partner.payoutSettings.historicalOnlyDesc',
  'partner.payoutSettings.historicalValue',
  'partner.payoutSettings.method',
  'partner.payoutSettings.minimumThreshold',
  'partner.payoutSettings.minimumThresholdDesc',
  'partner.payoutSettings.operationsUnavailable',
  'partner.payoutSettings.operationsUnavailableDesc',
  'partner.payoutSettings.preferences',
];

const source = fs.readFileSync(SOURCE, 'utf8');

/** Ciało pliku bez komentarzy — kod polityki w komentarzu jest DOZWOLONY. */
const sourceWithoutComments = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

function loadCatalog(locale: string): Record<string, unknown> {
  const file = path.resolve(REPO, `public/locales/${locale}/translation.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasKey(catalog: Record<string, unknown>, dotted: string): boolean {
  let node: unknown = catalog;
  for (const part of dotted.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

/** Wszystkie klucze `partner.*` użyte w tym ekranie, bez obcinania wyniku. */
const usedKeys = Array.from(
  new Set(Array.from(source.matchAll(/'(partner\.[A-Za-z0-9_.]+)'/g), (m) => m[1]))
).sort();

describe('Partner Earnings — przyczyna wycieku kodu polityki', () => {
  it('mierzy niepusty zbiór kluczy (mianownik nie może wyciąć badanego obiektu)', () => {
    expect(usedKeys.length).toBeGreaterThan(0);
    for (const key of KEYS_FIXED_HERE) {
      expect(usedKeys).toContain(key);
    }
  });

  it('klucze niosące komunikat o niedostępności istnieją w pl I w en', () => {
    const pl = loadCatalog('pl');
    const en = loadCatalog('en');

    const missing = KEYS_FIXED_HERE.flatMap((key) => {
      const gaps: string[] = [];
      if (!hasKey(pl, key)) gaps.push(`${key} — BRAK w pl`);
      if (!hasKey(en, key)) gaps.push(`${key} — BRAK w en`);
      return gaps;
    });

    expect(missing).toEqual([]);
  });

  it('nie pokazuje użytkownikowi kodu polityki w ŻADNEJ formie zapisu', () => {
    expect(sourceWithoutComments).not.toContain(POLICY_CODE);
  });

  it('kod polityki wolno zostawić w komentarzu — bez tego asercja byłaby za ostra', () => {
    expect(source).toContain(POLICY_CODE);
  });
});

describe('Partner Earnings — zapadka parytetu pl/en', () => {
  it('nie przybywa nowych kluczy bez tłumaczenia en', () => {
    const en = loadCatalog('en');
    const actualGaps = usedKeys.filter((key) => !hasKey(en, key)).sort();
    const allowed = [...KNOWN_EN_GAPS].sort();

    const brandNew = actualGaps.filter((key) => !allowed.includes(key));
    expect(brandNew).toEqual([]);
  });

  it('dług jest zamrożony na 17 pozycjach i nie rośnie', () => {
    const en = loadCatalog('en');
    const actualGaps = usedKeys.filter((key) => !hasKey(en, key));
    expect(actualGaps.length).toBeLessThanOrEqual(KNOWN_EN_GAPS.length);
  });
});
