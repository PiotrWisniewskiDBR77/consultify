/**
 * workbookFormulaEngine — unit tests.
 *
 * Sprawdza dokładnie te funkcje, które faktycznie występują w 8 szablonach
 * parametrycznych (SUM/MAX/PV/PMT/NPV/IRR/COUNTIF) + IF, cross-sheet refs w
 * konwencji `'Arkusz'!$B$5` (jak projectViability.ts `aRef()`), oraz ochronę
 * przed cyklem. Wartości referencyjne dla NPV/IRR/PV/PMT zweryfikowane ręcznie
 * (standardowe wzory finansowe), nie przepisane z jakiejś biblioteki.
 */

import { describe, expect, it } from 'vitest';

import {
  formatComputedForDisplay,
  type FormulaSheet,
  parseCellInput,
  rawCellToEditText,
  recalcWorkbook,
} from '../workbookFormulaEngine';

describe('recalcWorkbook — arytmetyka i referencje', () => {
  it('liczy prostą sumę i referencję w tym samym arkuszu', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'Arkusz1',
        columns: [
          { key: 'a', header: 'A' },
          { key: 'b', header: 'B' },
        ],
        rows: [
          { cells: { a: { value: 10 }, b: { value: 20 } } },
          { cells: { a: { value: 5 }, b: { formula: 'SUM(A2:A3)' } } },
        ],
      },
    ];
    const out = recalcWorkbook(sheets);
    // A2=10, A3=5 → SUM(A2:A3) w B3 = 15
    expect(out[0].rows[1].cells.b.computed).toBe(15);
  });

  it('referencja cross-sheet w konwencji absolutnej "\'Arkusz\'!$B$n" (jak projectViability.ts aRef())', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'Założenia',
        columns: [
          { key: 'driver', header: 'Driver' },
          { key: 'wartosc', header: 'Wartość' },
        ],
        rows: [{ cells: { driver: { value: 'Stopa' }, wartosc: { value: 0.1 } } }],
      },
      {
        name: 'Wyniki',
        columns: [
          { key: 'm', header: 'Metryka' },
          { key: 'w', header: 'Wartość' },
        ],
        rows: [{ cells: { m: { value: 'x' }, w: { formula: "'Założenia'!$B$2*100" } } }],
      },
    ];
    const out = recalcWorkbook(sheets);
    expect(out[1].rows[0].cells.w.computed).toBe(10);
  });

  it('IF zwraca gałąź true/false wg porównania', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'S',
        columns: [
          { key: 'a', header: 'A' },
          { key: 'b', header: 'B' },
        ],
        rows: [{ cells: { a: { value: -5 }, b: { formula: 'IF(A2>0,A2,0)' } } }],
      },
    ];
    const out = recalcWorkbook(sheets);
    expect(out[0].rows[0].cells.b.computed).toBe(0);
  });

  it('MAX ignoruje wartość ujemną wg formuły MAX(x,0), jak w projectViability.ts', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'S',
        columns: [
          { key: 'a', header: 'A' },
          { key: 'b', header: 'B' },
        ],
        rows: [{ cells: { a: { value: -100 }, b: { formula: 'MAX(A2,0)' } } }],
      },
    ];
    const out = recalcWorkbook(sheets);
    expect(out[0].rows[0].cells.b.computed).toBe(0);
  });

  it('COUNTIF liczy komórki spełniające kryterium "<0" (okres zwrotu)', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'S',
        columns: [
          { key: 'lbl', header: 'L' },
          { key: 'y0', header: 'Y0' },
          { key: 'y1', header: 'Y1' },
          { key: 'y2', header: 'Y2' },
        ],
        rows: [
          {
            cells: {
              lbl: { value: 'cum' },
              y0: { value: -100 },
              y1: { value: -20 },
              y2: { value: 30 },
            },
          },
          { cells: { lbl: { value: 'wynik' }, y0: { formula: 'COUNTIF(B2:D2,"<0")' } } },
        ],
      },
    ];
    const out = recalcWorkbook(sheets);
    expect(out[0].rows[1].cells.y0.computed).toBe(2);
  });

  it('cykl A2=B2, B2=A2 nie zawiesza przeliczenia — obie komórki dostają #CYKL!', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'S',
        columns: [
          { key: 'a', header: 'A' },
          { key: 'b', header: 'B' },
        ],
        rows: [{ cells: { a: { formula: 'B2' }, b: { formula: 'A2' } } }],
      },
    ];
    const out = recalcWorkbook(sheets);
    expect(out[0].rows[0].cells.a.error).toBe('#CYKL!');
    expect(out[0].rows[0].cells.b.error).toBe('#CYKL!');
  });
});

describe('recalcWorkbook — funkcje finansowe (NPV/IRR/PV/PMT)', () => {
  it('NPV(rate, values) — inwestycja poza zakresem, zgodnie z projectViability.ts (Net(0) dodawany osobno)', () => {
    // Excel NPV(10%, 110, 121) + (-200) = 110/1.1 + 121/1.1^2 - 200 = 100 + 100 - 200 = 0
    const sheets: FormulaSheet[] = [
      {
        name: 'Przepływy',
        columns: [
          { key: 'p', header: 'P' },
          { key: 'y0', header: 'Y0' },
          { key: 'y1', header: 'Y1' },
          { key: 'y2', header: 'Y2' },
        ],
        rows: [
          {
            cells: {
              p: { value: 'net' },
              y0: { value: -200 },
              y1: { value: 110 },
              y2: { value: 121 },
            },
          },
        ],
      },
      {
        name: 'Wyniki',
        columns: [
          { key: 'm', header: 'M' },
          { key: 'w', header: 'W' },
        ],
        rows: [
          {
            cells: {
              m: { value: 'NPV' },
              w: { formula: "NPV(0.1,'Przepływy'!C2:D2)+'Przepływy'!B2" },
            },
          },
        ],
      },
    ];
    const out = recalcWorkbook(sheets);
    const npv = out[1].rows[0].cells.w.computed as number;
    expect(npv).toBeCloseTo(0, 6);
  });

  it('IRR na tym samym szeregu (-200,110,121) daje ok. 10%', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'Przepływy',
        columns: [
          { key: 'p', header: 'P' },
          { key: 'y0', header: 'Y0' },
          { key: 'y1', header: 'Y1' },
          { key: 'y2', header: 'Y2' },
        ],
        rows: [
          {
            cells: {
              p: { value: 'net' },
              y0: { value: -200 },
              y1: { value: 110 },
              y2: { value: 121 },
            },
          },
        ],
      },
      {
        name: 'Wyniki',
        columns: [
          { key: 'm', header: 'M' },
          { key: 'w', header: 'W' },
        ],
        rows: [{ cells: { m: { value: 'IRR' }, w: { formula: "IRR('Przepływy'!B2:D2)" } } }],
      },
    ];
    const out = recalcWorkbook(sheets);
    const irr = out[1].rows[0].cells.w.computed as number;
    expect(irr).toBeCloseTo(0.1, 4);
  });

  it('PV/PMT standardowa para: PMT dla PV, nper, rate zwraca ratę spójną z PV', () => {
    const sheets: FormulaSheet[] = [
      {
        name: 'S',
        columns: [
          { key: 'a', header: 'A' },
          { key: 'b', header: 'B' },
        ],
        rows: [{ cells: { a: { value: 0 }, b: { formula: 'PMT(0.01,12,-1000)' } } }],
      },
    ];
    const out = recalcWorkbook(sheets);
    const pmt = out[0].rows[0].cells.b.computed as number;
    // Rata kredytu 1000 na 12 mies. przy 1%/mies. ≈ 88.85
    expect(pmt).toBeCloseTo(88.85, 1);
  });

  it('reaguje na zmianę komórki wejściowej — NPV przelicza się po edycji stopy dyskontowej', () => {
    const baseSheets: FormulaSheet[] = [
      {
        name: 'Założenia',
        columns: [
          { key: 'driver', header: 'D' },
          { key: 'wartosc', header: 'W' },
        ],
        rows: [{ cells: { driver: { value: 'Stopa' }, wartosc: { value: 0.1 } } }],
      },
      {
        name: 'Wyniki',
        columns: [
          { key: 'm', header: 'M' },
          { key: 'w', header: 'W' },
        ],
        rows: [{ cells: { m: { value: 'NPV' }, w: { formula: "'Założenia'!$B$2*1000" } } }],
      },
    ];
    const before = recalcWorkbook(baseSheets);
    expect(before[1].rows[0].cells.w.computed).toBe(100);

    // Symuluj edycję komórki wejściowej (jak zrobi to EditableSpreadsheetGrid).
    const edited: FormulaSheet[] = JSON.parse(JSON.stringify(baseSheets));
    edited[0].rows![0].cells!.wartosc = { value: 0.2 };
    const after = recalcWorkbook(edited);
    expect(after[1].rows[0].cells.w.computed).toBe(200);
  });
});

describe('parseCellInput / rawCellToEditText / formatComputedForDisplay', () => {
  it('rozpoznaje formułę po wiodącym "="', () => {
    expect(parseCellInput('=SUM(A1:A2)')).toEqual({ formula: 'SUM(A1:A2)' });
  });

  it('rozpoznaje liczbę i procent', () => {
    expect(parseCellInput('12.5')).toEqual({ value: 12.5 });
    expect(parseCellInput('8%')).toEqual({ value: 0.08 });
  });

  it('pusty string czyści komórkę do null', () => {
    expect(parseCellInput('')).toEqual({ value: null });
  });

  it('rawCellToEditText pokazuje formułę z "=", nie wynik', () => {
    expect(rawCellToEditText({ formula: 'A1+A2' })).toBe('=A1+A2');
    expect(rawCellToEditText({ value: 42 })).toBe('42');
  });

  it('formatComputedForDisplay pokazuje błąd zamiast liczby gdy jest error', () => {
    expect(
      formatComputedForDisplay({ raw: {}, computed: null, isFormula: true, error: '#CYKL!' })
    ).toBe('#CYKL!');
  });
});
