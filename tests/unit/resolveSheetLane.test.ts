import { describe, expect, it } from 'vitest';

import { resolveSheetLane } from '../../src/components/AIChat/tableIntentDetector';

/**
 * B2 (workstream Excel): resolveSheetLane decyduje o TORZE wewnątrz intencji Excel.
 * - 'workbook' → realny silnik 5-fazowy (żywe formuły .xlsx)
 * - 'gfm'      → płaska tabela prezentacyjna (stary tor plan/startSheet)
 */
describe('resolveSheetLane', () => {
  describe("tor 'workbook' — żądania obliczeniowe (formuły)", () => {
    const workbookCases = [
      'model 3 scenariusze RZiS',
      'zbuduj model finansowy na 3 lata',
      'przygotuj budżet działu na 2026',
      'prognoza przychodów kwartalna',
      'zrób P&L dla nowego produktu',
      'cash flow z formułami miesięczny',
      'financial model with 5 scenarios',
      'build a P&L and balance sheet workbook',
      'oblicz NPV i IRR dla projektu',
      'wycena spółki metodą DCF',
      'multi-sheet forecast with cross-sheet formulas',
      'skoroszyt z rachunkiem zysków i strat',
      'model biznesowy z wariantami finansowymi',
    ];
    workbookCases.forEach((msg) => {
      it(`"${msg}" → workbook`, () => {
        expect(resolveSheetLane(msg)).toBe('workbook');
      });
    });
  });

  describe("tor 'gfm' — zwykła tabela/lista (prezentacja)", () => {
    const gfmCases = [
      'zrób tabelę zadań',
      'tabela kontaktów do śledzenia',
      'lista zadań na tydzień',
      'rejestr klientów w tabeli',
      'a table of tasks for the sprint',
      'task list tracker',
      'inventory list with items',
      'wykaz pozycji magazynowych',
    ];
    gfmCases.forEach((msg) => {
      it(`"${msg}" → gfm`, () => {
        expect(resolveSheetLane(msg)).toBe('gfm');
      });
    });
  });

  describe('default — brak jawnego sygnału → workbook (silnik + fail-soft)', () => {
    it('niejednoznaczne żądanie domyślnie idzie do silnika formuł', () => {
      // Nie ma sygnału ani obliczeniowego, ani czysto prezentacyjnego → domyślnie
      // 'workbook'; caller fail-softuje na GFM przy błędzie silnika.
      expect(resolveSheetLane('przygotuj arkusz na przyszły kwartał')).toBe('workbook');
    });
  });
});

// B2-brama: jawny sygnał obliczeniowy (bez defaultu) — brama zewnętrzna czatu.
import { detectExceleIntent, detectTableIntent, hasWorkbookLaneSignals } from '../../src/components/AIChat/tableIntentDetector';

describe('hasWorkbookLaneSignals (brama zewnętrzna)', () => {
  it('„Zrób arkusz finansowy: model 3 scenariusze RZiS" → brama przepuszcza do excele', () => {
    const text = 'Zrób arkusz finansowy: model 3 scenariusze RZiS';
    expect(detectExceleIntent(text)).toBe(false); // dotychczasowa luka
    expect(detectTableIntent(text)).toBe(true);
    expect(hasWorkbookLaneSignals(text)).toBe(true); // nowa brama łapie
  });
  it('„zrób tabelę zadań" → BEZ sygnału obliczeniowego (zostaje w gałęzi tabeli)', () => {
    const text = 'zrób tabelę zadań';
    expect(hasWorkbookLaneSignals(text)).toBe(false);
  });
  it('zwykły tekst bez tabeli → false (zero połykania)', () => {
    expect(hasWorkbookLaneSignals('opowiedz mi o strategii firmy')).toBe(false);
  });
});
