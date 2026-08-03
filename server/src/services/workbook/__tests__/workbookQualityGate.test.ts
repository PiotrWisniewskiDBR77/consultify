/**
 * @vitest-environment node
 *
 * Anti-false-green dla deterministycznego krytyka arkusza (workbookQualityGate).
 *
 * Schema CZYSTA → issues=[] + wysoki score. Schema z WSTRZYKNIĘTYMI wadami
 * (magic-number w total, urwany SUM, zduplikowany input, mieszane formaty,
 * percent bez %, złamana referencja) → gate ZWRACA te issues z właściwymi
 * kodami reguł + kodami kanonu P23. Bez pliku krytyka test jest czerwony
 * (moduł nie istnieje); po jego dodaniu — zielony.
 */
import { describe, expect, it } from 'vitest';

import {
  colIndexToLetter,
  critiqueWorkbook,
  parseSumRanges,
  shouldRegenerateWorkbook,
} from '../workbookQualityGate.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** Czysty budżet: 3 wiersze danych + total z poprawnym SUM, formaty spójne. */
function cleanWorkbook(): WorkbookSchema {
  return {
    title: 'Budżet Q1',
    sheets: [
      {
        name: 'Budget',
        columns: [
          { key: 'item', header: 'Pozycja', type: 'text' },
          { key: 'amount', header: 'Kwota', type: 'currency', numberFormat: '#,##0.00 zł' },
        ],
        rows: [
          { cells: { item: { value: 'Marketing' }, amount: { value: 1000 } } },
          { cells: { item: { value: 'Sprzedaż' }, amount: { value: 2000 } } },
          { cells: { item: { value: 'IT' }, amount: { value: 3000 } } },
          {
            isSummary: true,
            cells: { item: { value: 'Razem' }, amount: { formula: '=SUM(B2:B4)' } },
          },
        ],
      },
    ],
  };
}

describe('workbookQualityGate — clean workbook', () => {
  it('czysty arkusz → issues=[] i score=100', () => {
    const report = critiqueWorkbook(cleanWorkbook());
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(100);
    expect(report.passed).toBe(true);
    expect(shouldRegenerateWorkbook(report)).toBe(false);
  });
});

describe('workbookQualityGate — WQ-01 magic-number w total', () => {
  it('stała liczba w wierszu total → validation_failed CRITICAL', () => {
    const wb = cleanWorkbook();
    // Total jako STAŁA 6000 zamiast =SUM.
    wb.sheets[0].rows[3].cells.amount = { value: 6000 };
    const report = critiqueWorkbook(wb);

    const magic = report.issues.find((i) => i.code === 'WQ-01-MAGIC-NUMBER');
    expect(magic).toBeDefined();
    expect(magic!.canonCode).toBe('validation_failed');
    expect(magic!.severity).toBe('CRITICAL');
    expect(magic!.sheet).toBe('Budget');
    expect(magic!.cell).toBe('B5');
    expect(report.passed).toBe(false);
  });
});

describe('workbookQualityGate — WQ-02 urwany SUM', () => {
  it('SUM pomijający wiersz danych → formula_error CRITICAL z listą braków', () => {
    const wb = cleanWorkbook();
    // Urwany zakres: B2:B3 zamiast B2:B4 (pomija B4).
    wb.sheets[0].rows[3].cells.amount = { formula: '=SUM(B2:B3)' };
    const report = critiqueWorkbook(wb);

    const sum = report.issues.find((i) => i.code === 'WQ-02-SUM-COVERAGE');
    expect(sum).toBeDefined();
    expect(sum!.canonCode).toBe('formula_error');
    expect(sum!.severity).toBe('CRITICAL');
    expect(sum!.message).toContain('4'); // pomija wiersz 4
    expect(report.passed).toBe(false);
  });

  it('SUM za szeroki (obejmuje nagłówek) → formula_error MAJOR', () => {
    const wb = cleanWorkbook();
    wb.sheets[0].rows[3].cells.amount = { formula: '=SUM(B1:B4)' }; // B1 = nagłówek
    const report = critiqueWorkbook(wb);

    const sum = report.issues.find((i) => i.code === 'WQ-02-SUM-COVERAGE');
    expect(sum).toBeDefined();
    expect(sum!.canonCode).toBe('formula_error');
    expect(sum!.severity).toBe('MAJOR');
  });
});

describe('workbookQualityGate — WQ-03 zduplikowany input Assumptions', () => {
  it('stała z Assumptions powtórzona w innym arkuszu → validation_failed', () => {
    const wb: WorkbookSchema = {
      title: 'Model',
      sheets: [
        {
          name: 'Assumptions',
          columns: [
            { key: 'param', header: 'Parametr', type: 'text' },
            { key: 'val', header: 'Wartość', type: 'number' },
          ],
          rows: [{ cells: { param: { value: 'Stawka VAT' }, val: { value: 23 } } }],
        },
        {
          name: 'Calc',
          columns: [
            { key: 'label', header: 'Etykieta', type: 'text' },
            { key: 'rate', header: 'Stawka', type: 'number' },
          ],
          // Duplikat 23 jako stała zamiast referencji do Assumptions.
          rows: [{ cells: { label: { value: 'VAT' }, rate: { value: 23 } } }],
        },
      ],
    };
    const report = critiqueWorkbook(wb);

    const dup = report.issues.find((i) => i.code === 'WQ-03-ASSUMPTIONS-DUP');
    expect(dup).toBeDefined();
    expect(dup!.canonCode).toBe('validation_failed');
    expect(dup!.sheet).toBe('Calc');
    expect(dup!.message).toContain('Assumptions');
  });
});

describe('workbookQualityGate — WQ-04/05 formaty', () => {
  it('kolumna percent bez formatu % → type_coercion_error', () => {
    const wb: WorkbookSchema = {
      title: 'Share',
      sheets: [
        {
          name: 'S',
          columns: [
            { key: 'name', header: 'Nazwa', type: 'text' },
            { key: 'share', header: 'Udział', type: 'percent' }, // brak numberFormat %
          ],
          rows: [{ cells: { name: { value: 'A' }, share: { value: 0.25 } } }],
        },
      ],
    };
    const report = critiqueWorkbook(wb);
    const pct = report.issues.find((i) => i.code === 'WQ-05-PERCENT-FORMAT');
    expect(pct).toBeDefined();
    expect(pct!.canonCode).toBe('type_coercion_error');
  });

  it('kolumna walutowa z mieszanymi formatami → type_coercion_error FORMAT-MIX', () => {
    const wb: WorkbookSchema = {
      title: 'Mix',
      sheets: [
        {
          name: 'S',
          columns: [
            { key: 'name', header: 'Nazwa', type: 'text' },
            { key: 'amt', header: 'Kwota', type: 'currency' },
          ],
          rows: [
            {
              cells: {
                name: { value: 'A' },
                amt: { value: 100, style: { numberFormat: '#,##0.00 zł' } },
              },
            },
            {
              cells: {
                name: { value: 'B' },
                amt: { value: 200, style: { numberFormat: '$#,##0.00' } },
              },
            },
          ],
        },
      ],
    };
    const report = critiqueWorkbook(wb);
    const mix = report.issues.find((i) => i.code === 'WQ-04-FORMAT-MIX');
    expect(mix).toBeDefined();
    expect(mix!.canonCode).toBe('type_coercion_error');
  });
});

describe('workbookQualityGate — WQ-06 złamana referencja', () => {
  it('formuła do nieistniejącego arkusza → formula_error CRITICAL', () => {
    const wb = cleanWorkbook();
    wb.sheets[0].rows[0].cells.amount = { formula: "='Nieistnieje'!A1" };
    const report = critiqueWorkbook(wb);

    const ref = report.issues.find((i) => i.code === 'WQ-06-BROKEN-FORMULA-REF');
    expect(ref).toBeDefined();
    expect(ref!.canonCode).toBe('formula_error');
    expect(ref!.severity).toBe('CRITICAL');
    expect(ref!.message).toContain('Nieistnieje');
    expect(report.passed).toBe(false);
  });
});

// ── WQ-07: uszkodzony prefiks `=` ───────────────────────────────────────────
// Ślepa plama: na starym krytyku formuła z `==` / pusta przechodziła jako czysta
// (score=100, issues=[]). ExcelJS zapisuje string verbatim do `<f>` w XML → `==…`
// psuje plik. Pojedyncze `=` jest KONWENCJĄ kodu (builder sanityzuje) → NIE flaga.
describe('workbookQualityGate — WQ-07 uszkodzony prefiks formuły', () => {
  it('podwojone `==` w formule → formula_error CRITICAL', () => {
    const wb = cleanWorkbook();
    wb.sheets[0].rows[3].cells.amount = { formula: '==SUM(B2:B4)' };
    const report = critiqueWorkbook(wb);

    const bad = report.issues.find((i) => i.code === 'WQ-07-BAD-FORMULA-SYNTAX');
    expect(bad).toBeDefined();
    expect(bad!.canonCode).toBe('formula_error');
    expect(bad!.severity).toBe('CRITICAL');
    expect(bad!.cell).toBe('B5');
    expect(report.passed).toBe(false);
  });

  it('pusta formuła / samo `=` → formula_error CRITICAL', () => {
    const wb = cleanWorkbook();
    wb.sheets[0].rows[3].cells.amount = { formula: '=' };
    const report = critiqueWorkbook(wb);
    const bad = report.issues.find((i) => i.code === 'WQ-07-BAD-FORMULA-SYNTAX');
    expect(bad).toBeDefined();
    expect(bad!.severity).toBe('CRITICAL');
    expect(report.passed).toBe(false);
  });

  it('GRANICA: pojedyncze `=SUM(...)` (konwencja) → NIE flaga WQ-07', () => {
    // cleanWorkbook używa `=SUM(B2:B4)` — musi zostać czysty.
    const report = critiqueWorkbook(cleanWorkbook());
    expect(report.issues.find((i) => i.code === 'WQ-07-BAD-FORMULA-SYNTAX')).toBeUndefined();
    expect(report.score).toBe(100);
  });
});

// ── WQ-08: cross-sheet ref do istniejącego arkusza, poza zakresem ────────────
// Ślepa plama: WQ-06 pomija out-of-bounds gdy formuła ma cross-sheet ref
// (`sheetRefs.length === 0` guard). `=Data!Z999` do ISTNIEJĄCEGO 'Data'
// przechodziło jako czyste. WQ-08 domyka lukę (MAJOR).
describe('workbookQualityGate — WQ-08 cross-sheet poza zakresem', () => {
  function crossWb(formula: string): WorkbookSchema {
    return {
      title: 'Model',
      sheets: [
        {
          name: 'Data',
          columns: [{ key: 'a', header: 'A', type: 'number' }],
          rows: [{ cells: { a: { value: 1 } } }], // dane do A2
        },
        {
          name: 'Calc',
          columns: [{ key: 'x', header: 'X', type: 'number' }],
          rows: [{ cells: { x: { formula } } }],
        },
      ],
    };
  }

  it('ref do istniejącego arkusza poza jego zakresem → formula_error MAJOR', () => {
    const report = critiqueWorkbook(crossWb('=Data!Z999'));
    const oob = report.issues.find((i) => i.code === 'WQ-08-CROSS-SHEET-OOB');
    expect(oob).toBeDefined();
    expect(oob!.canonCode).toBe('formula_error');
    expect(oob!.severity).toBe('MAJOR');
    expect(oob!.sheet).toBe('Calc');
    expect(oob!.message).toContain('Data');
  });

  it('GRANICA: ref w zakresie istniejącego arkusza → NIE flaga WQ-08', () => {
    const report = critiqueWorkbook(crossWb('=Data!A2'));
    expect(report.issues.find((i) => i.code === 'WQ-08-CROSS-SHEET-OOB')).toBeUndefined();
  });

  it('GRANICA: ref do NIEISTNIEJĄCEGO arkusza → WQ-06 (nie duplikuje WQ-08)', () => {
    const report = critiqueWorkbook(crossWb("='Ghost'!A1"));
    expect(report.issues.find((i) => i.code === 'WQ-08-CROSS-SHEET-OOB')).toBeUndefined();
    expect(report.issues.find((i) => i.code === 'WQ-06-BROKEN-FORMULA-REF')).toBeDefined();
  });
});

// ── WQ-09: kolumna mieszająca formuły ze stałymi ────────────────────────────
// Ślepa plama: kolumna gdzie reszta to formuły, jedna komórka to goła stała
// (LLM zapomniał formuły) — przechodziła czysta. Granica: ≥2 formuły + formuły
// większością + ≥1 goła stała.
describe('workbookQualityGate — WQ-09 niespójna kolumna obliczeniowa', () => {
  function calcColWb(revRows: Array<{ formula?: string; value?: number }>): WorkbookSchema {
    return {
      title: 'Rev',
      sheets: [
        {
          name: 'S',
          columns: [
            { key: 'q', header: 'Qty', type: 'number' },
            { key: 'p', header: 'Price', type: 'number' },
            { key: 'rev', header: 'Revenue', type: 'currency' },
          ],
          rows: revRows.map((r, i) => ({
            cells: {
              q: { value: (i + 1) * 10 },
              p: { value: 5 },
              rev: r.formula ? { formula: r.formula } : { value: r.value },
            },
          })),
        },
      ],
    };
  }

  it('2 formuły + 1 goła stała w kolumnie → validation_failed MAJOR', () => {
    const report = critiqueWorkbook(
      calcColWb([
        { formula: '=A2*B2' },
        { formula: '=A3*B3' },
        { value: 150 }, // zapomniana formuła
      ])
    );
    const inc = report.issues.find((i) => i.code === 'WQ-09-INCONSISTENT-CALC-COL');
    expect(inc).toBeDefined();
    expect(inc!.canonCode).toBe('validation_failed');
    expect(inc!.severity).toBe('MAJOR');
    expect(inc!.cell).toBe('C4'); // 3. wiersz danych, kolumna C (Revenue)
    expect(inc!.message).toContain('Revenue');
  });

  it('GRANICA: kolumna w całości formuł → NIE flaga', () => {
    const report = critiqueWorkbook(
      calcColWb([{ formula: '=A2*B2' }, { formula: '=A3*B3' }, { formula: '=A4*B4' }])
    );
    expect(report.issues.find((i) => i.code === 'WQ-09-INCONSISTENT-CALC-COL')).toBeUndefined();
  });

  it('GRANICA: formuły NIE są większością (1 formuła, 2 stałe) → NIE flaga (legalna kolumna mieszana)', () => {
    const report = critiqueWorkbook(
      calcColWb([{ formula: '=A2*B2' }, { value: 100 }, { value: 200 }])
    );
    expect(report.issues.find((i) => i.code === 'WQ-09-INCONSISTENT-CALC-COL')).toBeUndefined();
  });
});

describe('workbookQualityGate — wiele wad jednocześnie', () => {
  it('kumuluje issues i obniża score; passed=false przy CRITICAL', () => {
    const wb = cleanWorkbook();
    wb.sheets[0].rows[3].cells.amount = { value: 6000 }; // magic-number w total (CRITICAL)
    const report = critiqueWorkbook(wb);
    expect(report.issues.length).toBeGreaterThanOrEqual(1);
    expect(report.score).toBeLessThan(100);
    expect(report.passed).toBe(false);
  });
});

// ── Helpery deterministyczne ─────────────────────────────────────────────────

describe('workbookQualityGate — helpery adresowania', () => {
  it('colIndexToLetter: 0→A, 25→Z, 26→AA', () => {
    expect(colIndexToLetter(0)).toBe('A');
    expect(colIndexToLetter(25)).toBe('Z');
    expect(colIndexToLetter(26)).toBe('AA');
  });

  it('parseSumRanges: prosty jednokolumnowy zakres', () => {
    expect(parseSumRanges('=SUM(B2:B4)')).toEqual([{ col: 'B', fromRow: 2, toRow: 4 }]);
  });

  it('parseSumRanges: zwraca null dla wyrażeń których nie rozumiemy (brak false-positive)', () => {
    expect(parseSumRanges('=B2+B3+B4')).toBeNull();
    expect(parseSumRanges('=SUM(B2:C4)')).toBeNull(); // wielokolumnowy
  });
});
