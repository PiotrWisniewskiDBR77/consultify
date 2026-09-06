/**
 * BLOKER audytu evidence/audyt-mvp-20260906/B3/RAPORT_B3.md (defekt #5 z
 * instrukcji "mvp/naprawy-noc-6"): nagłówek "AKTUALIZACJA" na liście
 * Sprawozdań (`/finance?tab=statements`) był ucięty do "AKTUA" na 1440px,
 * MIMO że `baseUpdatedCol` już ma `width:'200px'` + `dataType:'date'`
 * (naprawa fali 4, commit 0d2892ef30, pilnowana przez
 * tests/unit/ui/naglowkiKolumnFala4.test.ts).
 *
 * PRZYCZYNA (zmierzona żywo, nie zgadnięta): zakładka "statements" ma 8 kolumn
 * (Typ/Nazwa/Kompletność/Okres/Waluta/Dok./Status/Aktualizacja). Suma ich
 * naturalnych szerokości przekracza dostępny obszar na 1440px, więc
 * `FilterableTable`'s `columnFit` ściska WSZYSTKIE kolumny do ich "podłóg"
 * (`getColumnFitFloor` w src/components/shared/ModuleHub/FilterableTable.tsx).
 * Kolumny 'currency' i 'sourceStatementCount' nie miały `dataType` ustawionego
 * → domyślna podłoga 'text' = 140px, mimo że ich treść jest krótka ("PLN",
 * "6") i realnie potrzebuje ~90px. Te dwie kolumny kradły łącznie ~90-100px
 * budżetu, który powinien iść do kolumny "Aktualizacja" — zmierzone na żywo
 * (własny vite :3096 + backend NOC 127.0.0.1:4100, sesja audyt@dbr77.local,
 * `th[data-column-id="updatedAt"]`): PRZED naprawą 140px (ucięte, ellipsis
 * "AKTU…"), PO naprawie 168px (pełny tekst "AKTUALIZACJA" + strzałka sortu).
 * Dowód: evidence/mvp-naprawy-noc-6/finance-statements-{przed,po}.png(.json).
 *
 * NAPRAWA: `dataType: 'number'` na 'currency' i 'sourceStatementCount' w
 * zakładce statements (podłoga 90px zamiast domyślnych 140px dla 'text') —
 * ZERO zmian w FilterableTable.tsx, zero zmian w baseUpdatedCol (ten wciąż ma
 * width 200 + dataType date z fali 4).
 *
 * Ten test jest strażnikiem ŹRÓDŁOWYM (canvas measureText nie działa w
 * jsdom — patrz komentarz w naglowkiKolumnFala4.test.ts): pilnuje, żeby ktoś
 * po cichu nie usunął `dataType: 'number'` z tych dwóch kolumn i nie zrobił
 * regresji budżetu kolumn na zakładce Sprawozdania.
 *
 * Mutacja: usunięcie `dataType: 'number'` z bloku 'currency' albo
 * 'sourceStatementCount' → test czerwony.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const FILE = 'src/components/Economics/FinanceHub.tsx';

function readSource(): string {
  return readFileSync(path.join(process.cwd(), FILE), 'utf8');
}

/** Pierwszy blok `id: '<columnId>',` po znaczniku (okno znaków), tak jak w naglowkiKolumnFala4.test.ts. */
function firstColumnBlock(source: string, columnId: string, windowSize = 800): string {
  const marker = `id: '${columnId}',`;
  const start = source.indexOf(marker);
  expect(start, `nie znaleziono "${marker}" w ${FILE}`).toBeGreaterThanOrEqual(0);
  return source.slice(start, start + windowSize);
}

describe('FinanceHub — zakładka Sprawozdania: budżet szerokości kolumn nie kradnie miejsca "Aktualizacji"', () => {
  it("kolumna 'currency' (Waluta) ma dataType:'number' — krótka wartość, niska podłoga", () => {
    const block = firstColumnBlock(readSource(), 'currency');
    expect(block).toMatch(/dataType:\s*'number'/);
  });

  it("kolumna 'sourceStatementCount' (Dok.) ma dataType:'number' — krótka wartość, niska podłoga", () => {
    const block = firstColumnBlock(readSource(), 'sourceStatementCount');
    expect(block).toMatch(/dataType:\s*'number'/);
  });

  it("baseUpdatedCol ('Aktualizacja') zachowuje naprawę fali 4 (width>=180px + dataType:'date')", () => {
    const source = readSource();
    const marker = "id: 'updatedAt',";
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThanOrEqual(0);
    const block = source.slice(start, start + 260);
    expect(block).toMatch(/width:\s*'2\d\dpx'/);
    expect(block).toMatch(/dataType:\s*'date'/);
  });
});
