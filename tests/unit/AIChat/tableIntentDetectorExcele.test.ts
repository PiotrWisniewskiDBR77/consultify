/**
 * P0 urodzinowe (2026-07-27): live incydent — Piotr poprosił główny czat o
 * "excela" i dostał płaską tabelę CSV w Table Studio zamiast realnego silnika
 * arkuszy (workbook engine, POST /workbook/generate). Root cause: bare
 * excel-file nouns ("excel", "xlsx", "spreadsheet", "workbook", "skoroszyt",
 * "arkusz kalkulacyjny") nie były łapane ani przez EXCELE_INTENT_PATTERNS
 * (wymagały całej frazy "arkusz excel"/"plik excel"), ani przez
 * TABLE_INTENT_PATTERNS — więc gate w UnifiedChatPanel nigdy się nie
 * uruchamiał i prośba spadała do ogólnej klasyfikacji czatu.
 *
 * Ten test pilnuje: (a) ≥6 fraz PL/EN jednoznacznie excelowych → EXCELE,
 * (b) ≥4 frazy tabelowe/bazodanowe → bez regresji (dalej TABELE),
 * (c) resolveSheetLane nadal domyślnie 'workbook' dla nowych fraz.
 */
import { describe, expect, it } from 'vitest';

import {
  detectExceleIntent,
  detectTableIntent,
  hasWorkbookLaneSignals,
  resolveSheetLane,
} from '@/components/AIChat/tableIntentDetector';

describe('detectExceleIntent — bare excel-file nouns (P0 2026-07-27)', () => {
  const exceleUnambiguous = [
    'zrób mi excela',
    'Potrzebuję excela na jutro',
    'otwórz Excele z ostatniego kwartału',
    'wygeneruj xlsx z listą klientów',
    'make me an excel with the sales numbers',
    'I need a spreadsheet for this',
    'create a workbook for Q3',
    'przygotuj arkusz kalkulacyjny dla zespołu',
    'zbuduj mi skoroszyt z wynikami',
  ];

  it.each(exceleUnambiguous)('classifies %j as EXCELE', (text) => {
    expect(detectExceleIntent(text)).toBe(true);
  });

  it('does not false-positive on "excellent"', () => {
    expect(detectExceleIntent('this report is excellent, thanks')).toBe(false);
  });

  it('defaults new excel phrases to the workbook lane (not gfm)', () => {
    for (const text of exceleUnambiguous) {
      expect(resolveSheetLane(text)).toBe('workbook');
    }
  });
});

describe('detectTableIntent — no regression for plain table/database asks', () => {
  // Note: `stwórz mi tabelę zadań` / `zbuduj bazę klientów` (with Polish
  // diacritics ę right before the JS \b) are a PRE-EXISTING miss in
  // TABLE_INTENT_PATTERNS (JS \b does not treat ę/ł/ą as word chars, so \b
  // never matches right after them) — unrelated to this fix, not touched here.
  // These cases use ASCII-ending forms that already worked before this change.
  const tableUnambiguous = [
    'stwórz mi tabele zadań',
    'zbuduj tracker projektów',
    'potrzebuję tabeli klientów',
    'need a table for tasks',
    'create a database for clients',
  ];

  it.each(tableUnambiguous)('classifies %j as TABLE (not excele)', (text) => {
    expect(detectTableIntent(text)).toBe(true);
    expect(detectExceleIntent(text)).toBe(false);
  });

  it('does not flag plain table asks as workbook-lane signals', () => {
    for (const text of tableUnambiguous) {
      expect(hasWorkbookLaneSignals(text)).toBe(false);
    }
  });
});

describe('ambiguous financial-table phrasing keeps prior (table) behavior', () => {
  it('"tabela z danymi finansowymi" is not hijacked into EXCELE by the new bare-word patterns', () => {
    const text = 'zrób mi tabelę z danymi finansowymi klientów';
    expect(detectExceleIntent(text)).toBe(false);
  });
});
