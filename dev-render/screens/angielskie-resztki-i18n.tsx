/**
 * Dev-render host — DOWÓD naprawy angielskich resztek w dwóch REALNYCH
 * komponentach (CLAUDE.md #7: właściciel nigdy nie jest pierwszym testerem
 * wizualnym; złota reguła #1: weryfikuj realny runtime, nie grep).
 *
 * Co tu widać i dlaczego to jest tu razem — oba defekty to ten sam kształt:
 * klucz i18n istnieje w kodzie, ale w locale PL siedzi angielskie słowo (albo
 * klucza w ogóle nie ma i leci angielski default z kodu).
 *
 * GÓRA — REALNY <MonteCarloNpvPanel> (M16, za flagą m16ValuationSuite).
 *   `finance.m16.monteCarlo.driverLabel` BYŁ w pl/translation.json, ale z
 *   wartością "Driver", więc panel renderował polskiemu użytkownikowi angielskie
 *   słowo. Teraz "Czynnik" — spójnie z `ideas.financial.col.label` i
 *   `valuation.advisory.driver`. Przy okazji: "+ driver" -> "+ czynnik" oraz
 *   ziarna wierszy Revenue/Cost -> Przychody/Koszty (były wpisane na sztywno
 *   w kodzie, pod polskim napisem "Czynnik").
 *   `fetcher` podstawiony deterministycznie — zero ruchu do API.
 *
 * DÓŁ — REALNY <EditableSpreadsheetGrid> z 250 wierszami (rowCap=100).
 *   Stopka pokazuje się DOPIERO gdy `rows.length > rowCap`, dlatego na małych
 *   zbiorach mock-owych nikt tego nie widział. `kimi.showingAllRows` i
 *   `kimi.showAllRows` NIE ISTNIAŁY w żadnym locale (leciały angielskie defaulty
 *   z kodu), a `kimi.showingRows` miał wpisane na sztywno "25", choć kod podaje
 *   {{cap}} = 100 — czyli stopka kłamała o tym, ile wierszy jest na ekranie.
 *
 * URL: ?screen=angielskie-resztki-i18n&theme=light|dark&lang=pl
 *      &rows=<n>   liczba wierszy w siatce (domyślnie 250)
 *      &cap=<n>    rowCap (domyślnie 100 — jak w produkcji; niższy = stopka
 *                  widoczna na zrzucie pełnostronicowym bez scrollowania)
 */
import React from 'react';

import { EditableSpreadsheetGrid } from '@/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid';
import { MonteCarloNpvPanel } from '@/components/Economics/panels/MonteCarloNpvPanel';
import type { FormulaSheet } from '@/utils/workbookFormulaEngine';

const params = new URLSearchParams(window.location.search);
const ROW_COUNT = Math.max(1, Number(params.get('rows') ?? '250') || 250);
/** rowCap podkręcany z URL — przy niskim capie stopka mieści się na jednym
 *  zrzucie pełnostronicowym (przy produkcyjnych 100 trzeba by scrollować). */
const ROW_CAP = Math.max(1, Number(params.get('cap') ?? '100') || 100);

/** Deterministyczna atrapa symulacji — kształt 1:1 z `MonteCarloNpvResponse`. */
const fetcher = async () => ({
  simulation: {
    samples: [],
    mean: 412_000,
    p10: 118_000,
    p50: 405_000,
    p90: 726_000,
    probPositive: 0.87,
    valueAtRisk5: -64_000,
  },
  histogram: Array.from({ length: 12 }, (_, i) => ({
    binStart: -200_000 + i * 100_000,
    binEnd: -100_000 + i * 100_000,
    count: Math.round(240 * Math.exp(-(((i - 5.5) / 3) ** 2))),
  })),
});

/** Arkusz "Przepływy" — dość wierszy, żeby stopka rowCap w ogóle się pojawiła. */
const SHEET: FormulaSheet = {
  name: 'Przepływy',
  columns: [
    { key: 'lp', header: 'Lp.' },
    { key: 'pozycja', header: 'Pozycja' },
    { key: 'kwota', header: 'Kwota netto' },
    { key: 'vat', header: 'VAT (23%)' },
    { key: 'brutto', header: 'Kwota brutto' },
  ],
  rows: Array.from({ length: ROW_COUNT }, (_, i) => ({
    cells: {
      lp: { value: i + 1 },
      pozycja: { value: `Faktura kosztowa ${String(i + 1).padStart(3, '0')}` },
      kwota: { value: 1200 + ((i * 137) % 8800) },
      vat: { formula: `C${i + 2}*0.23` },
      brutto: { formula: `C${i + 2}+D${i + 2}` },
    },
  })),
};

export default function AngielskieResztkiI18nScreen(): React.ReactElement {
  return (
    <div className="h-screen w-full overflow-auto bg-c-bg p-6 space-y-6">
      {/* Produkcja: FinanceValuePanelsSurface.tsx:39 — `mb-3 rounded-xl border
          border-c-border bg-c-surface p-3`, pełna szerokość kontenera (bez
          max-w-3xl, którego produkt nie ma). */}
      <section className="w-full rounded-xl border border-c-border bg-c-surface p-4">
        <MonteCarloNpvPanel fetcher={fetcher} />
      </section>

      <section className="rounded-xl border border-c-border bg-c-surface overflow-hidden">
        <div className="max-h-[560px] overflow-auto">
          <EditableSpreadsheetGrid
            workbookId="wb-dev-render-angielskie-resztki"
            sheets={[SHEET]}
            activeSheetIndex={0}
            rowCap={ROW_CAP}
          />
        </div>
      </section>
    </div>
  );
}
