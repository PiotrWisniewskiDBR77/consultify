// @vitest-environment node
/**
 * Anti-false-green unit tests for the 4 "excel builder polish" features.
 * Each assertion targets a REAL .xlsx built by buildWorkbookBuffer():
 *   1. fullCalcOnLoad flag (raw workbook.xml) + cached trivial formula results
 *   2. accounting currency format (negatives in red parens, zero → dash)
 *   3. named ranges (definedNames) from an Assumptions sheet
 *   4. data validation (dropdown / numeric bound) on input cells
 *
 * These are RED on the base branch (none of the features existed) and GREEN
 * after the polish. They also guard the "never guess" contract of the formula
 * cache (cross-sheet / non-constant formulas get NO cached result).
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import type { WorkbookSchema } from '../WorkbookSchema.js';

// A realistic finance model: Assumptions (inputs) + P&L (with negative deltas).
const FIN_SEED: WorkbookSchema = {
  title: 'Model finansowy w zł',
  description: 'P&L + Assumptions, PLN, deltas ujemne',
  author: 'tests',
  sheets: [
    {
      name: 'Assumptions',
      isAssumptions: true,
      columns: [
        { key: 'param', header: 'Parametr', type: 'text' },
        { key: 'value', header: 'Wartość', type: 'number' },
      ],
      rows: [
        {
          cells: {
            param: { value: 'Tax rate' },
            value: {
              value: 0.19,
              validation: { type: 'decimal', operator: 'between', min: 0, max: 1 },
            },
          },
        },
        {
          cells: {
            param: { value: 'Scenario' },
            value: {
              value: 'Base',
              validation: { type: 'list', values: ['Base', 'Bull', 'Bear'] },
            },
          },
        },
      ],
    },
    {
      name: 'P&L',
      columns: [
        { key: 'pozycja', header: 'Pozycja', type: 'text' },
        { key: 'y2025', header: '2025', type: 'currency' },
        { key: 'y2026', header: '2026', type: 'currency' },
        { key: 'delta', header: 'Delta', type: 'currency' },
      ],
      rows: [
        // delta = 2026 - 2025 → 100000 - 120000 = -20000 (negative, same sheet)
        {
          cells: {
            pozycja: { value: 'Przychody' },
            y2025: { value: 120000 },
            y2026: { value: 100000 },
            delta: { formula: '=C2-B2' },
          },
        },
        {
          cells: {
            pozycja: { value: 'COGS' },
            y2025: { value: 30000 },
            y2026: { value: 35000 },
            delta: { formula: '=C3-B3' },
          },
        },
        {
          cells: {
            pozycja: { value: 'TOTAL' },
            y2025: { formula: '=SUM(B2:B3)' },
            y2026: { formula: '=SUM(C2:C3)' },
            delta: { formula: '=SUM(D2:D3)' },
          },
        },
      ],
    },
  ],
};

async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}
async function workbookXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('xl/workbook.xml')!.async('string');
}

describe('printed evidence-table density', () => {
  it('grows wrapped evidence rows and limits print area to meaningful rows', async () => {
    const schema: WorkbookSchema = {
      title: 'Evidence register',
      sheets: [
        {
          name: 'Sources',
          columns: [
            { key: 'claim', header: 'Claim', width: 20 },
            { key: 'excerpt', header: 'Evidence excerpt', width: 40, style: { wrapText: true } },
          ],
          rows: [
            {
              cells: {
                claim: { value: 'Decision mandate' },
                excerpt: {
                  value:
                    'Version v1, snapshot snap-1. Validate the baseline, investment amount and payback before the decision gate.',
                },
              },
            },
          ],
        },
      ],
    };
    const wb = await load(await buildWorkbookBuffer(schema, { applyConsultantStyling: true }));
    const ws = wb.getWorksheet('Sources')!;
    expect(ws.pageSetup.printArea).toBe('A1:B2');
    expect(ws.getRow(2).height).toBeGreaterThan(24);
  });
});
/** Raw XML of the first data worksheet (Info is the leading navigation sheet). */
async function firstSheetXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('xl/worksheets/sheet2.xml')!.async('string');
}

// ---------------------------------------------------------------------------
// TASK 1 — fullCalcOnLoad + cached formula results
// ---------------------------------------------------------------------------
describe('sheet visibility', () => {
  it('preserves hidden sheet state in the exported XLSX', async () => {
    const buffer = await buildWorkbookBuffer({
      title: 'Visibility',
      sheets: [
        { name: 'Visible', columns: [], rows: [] },
        { name: 'Hidden data', hidden: true, columns: [], rows: [] },
      ],
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(workbook.getWorksheet('Visible')?.state).toBe('visible');
    expect(workbook.getWorksheet('Hidden data')?.state).toBe('hidden');
  });
});

describe('polish/1 — fullCalcOnLoad + cached trivial formula results', () => {
  it('writes <calcPr fullCalcOnLoad="1"/> into workbook.xml', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const xml = await workbookXml(buf);
    expect(xml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);
  });

  it('caches result of a same-sheet subtraction (=C2-B2 → -20000)', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const pl = wb.getWorksheet('P&L')!;
    const cell = pl.getRow(2).getCell(4).value as { formula?: string; result?: number };
    expect(cell.formula).toContain('C2-B2');
    expect(cell.result).toBe(-20000);
  });

  it('caches result of a same-sheet SUM over a constant range (=SUM(B2:B3) → 150000)', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const pl = wb.getWorksheet('P&L')!;
    const cell = pl.getRow(4).getCell(2).value as { formula?: string; result?: number };
    expect(cell.result).toBe(150000);
  });

  it('NEVER guesses: a cross-sheet formula gets NO cached result', async () => {
    const seed: WorkbookSchema = {
      title: 't',
      sheets: [
        {
          name: 'Assumptions',
          columns: [
            { key: 'k', header: 'K' },
            { key: 'v', header: 'V', type: 'number' },
          ],
          rows: [{ cells: { k: { value: 'rate' }, v: { value: 5 } } }],
        },
        {
          name: 'Calc',
          columns: [{ key: 'a', header: 'A', type: 'number' }],
          rows: [{ cells: { a: { formula: '=Assumptions!B2*2' } } }],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(seed);
    const wb = await load(buf);
    const cell = wb.getWorksheet('Calc')!.getRow(2).getCell(1).value as {
      formula?: string;
      result?: unknown;
    };
    expect(cell.formula).toContain('Assumptions');
    expect(cell.result).toBeUndefined();
  });

  it('NEVER guesses: a formula whose input is itself a formula gets NO cached result', async () => {
    // D-col references B (a SUM formula), so B is not a literal constant.
    const seed: WorkbookSchema = {
      title: 't',
      sheets: [
        {
          name: 'S',
          columns: [
            { key: 'a', header: 'A', type: 'number' },
            { key: 'b', header: 'B', type: 'number' },
          ],
          rows: [
            { cells: { a: { value: 10 }, b: { formula: '=A2' } } },
            { cells: { a: { formula: '=B2+1' }, b: { value: 3 } } }, // A3 depends on B2 (a formula)
          ],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(seed);
    const wb = await load(buf);
    const a3 = wb.getWorksheet('S')!.getRow(3).getCell(1).value as { result?: unknown };
    expect(a3.result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TASK 2 — accounting currency format
// ---------------------------------------------------------------------------
describe('polish/2 — accounting currency format on currency columns', () => {
  it('currency column uses accounting format: red parens for negatives, dash for zero', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED, { applyConsultantStyling: true });
    const wb = await load(buf);
    const pl = wb.getWorksheet('P&L')!;
    const fmt = pl.getRow(2).getCell(4).numFmt; // Delta column (currency)
    expect(fmt).toContain('[Red]');
    expect(fmt).toContain('('); // negative in parentheses
    expect(fmt).toContain('–'); // zero → en-dash
    expect(fmt).toContain('zł'); // PLN locale retained
  });

  it('the negative delta cell carries a negative cached value (renders red/parens in Excel)', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const pl = wb.getWorksheet('P&L')!;
    const cell = pl.getRow(2).getCell(4).value as { result?: number };
    expect(cell.result).toBeLessThan(0);
  });

  it('raw mode (styling OFF) keeps the plain currency format (no accounting tokens)', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED, { applyConsultantStyling: false });
    const wb = await load(buf);
    const pl = wb.getWorksheet('P&L')!;
    const fmt = pl.getRow(2).getCell(4).numFmt;
    expect(fmt).not.toContain('[Red]');
  });
});

// ---------------------------------------------------------------------------
// TASK 3 — named ranges from Assumptions
// ---------------------------------------------------------------------------
describe('polish/3 — named ranges from Assumptions inputs', () => {
  it('emits a defined name per input row pointing at the value cell', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const model = wb.definedNames.model;
    const byName = Object.fromEntries(model.map((m) => [m.name, m.ranges]));
    // "Tax rate" → Tax_rate → Assumptions!$B$2
    expect(byName['Tax_rate']).toContain('Assumptions!$B$2');
    // "Scenario" → Assumptions!$B$3
    expect(byName['Scenario']).toContain('Assumptions!$B$3');
  });

  it('does NOT create defined names for a non-assumptions sheet', async () => {
    const seed: WorkbookSchema = {
      title: 't',
      sheets: [
        {
          name: 'Data',
          columns: [
            { key: 'k', header: 'K' },
            { key: 'v', header: 'V', type: 'number' },
          ],
          rows: [{ cells: { k: { value: 'foo' }, v: { value: 1 } } }],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(seed);
    const wb = await load(buf);
    expect(wb.definedNames.model.length).toBe(0);
  });

  it('does not rewrite existing formulas — cross-sheet A1 ref stays valid alongside names', async () => {
    const seed: WorkbookSchema = {
      title: 't',
      sheets: [
        {
          name: 'Assumptions',
          isAssumptions: true,
          columns: [
            { key: 'k', header: 'K' },
            { key: 'v', header: 'V', type: 'number' },
          ],
          rows: [{ cells: { k: { value: 'Tax rate' }, v: { value: 0.19 } } }],
        },
        {
          name: 'Calc',
          columns: [{ key: 'a', header: 'A', type: 'number' }],
          rows: [{ cells: { a: { formula: '=Assumptions!B2' } } }],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(seed);
    const wb = await load(buf);
    const cell = wb.getWorksheet('Calc')!.getRow(2).getCell(1).value as { formula?: string };
    expect(cell.formula).toContain('Assumptions!B2'); // untouched (leading '=' preserved)
    expect(wb.definedNames.model.some((m) => m.name === 'Tax_rate')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TASK 4 — data validation on inputs
// ---------------------------------------------------------------------------
describe('polish/4 — data validation on Assumptions inputs', () => {
  it('applies a decimal bound validation to a numeric input cell', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const asm = wb.getWorksheet('Assumptions')!;
    const dv = asm.getRow(2).getCell(2).dataValidation;
    expect(dv?.type).toBe('decimal');
    expect(dv?.operator).toBe('between');
    expect(dv?.formulae).toEqual([0, 1]);
  });

  it('applies a list (dropdown) validation to a select input cell', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const asm = wb.getWorksheet('Assumptions')!;
    const dv = asm.getRow(3).getCell(2).dataValidation;
    expect(dv?.type).toBe('list');
    expect(dv?.formulae?.[0]).toContain('Base');
    expect(dv?.formulae?.[0]).toContain('Bear');
  });

  it('a cell with no validation spec has no dataValidation', async () => {
    const buf = await buildWorkbookBuffer(FIN_SEED);
    const wb = await load(buf);
    const pl = wb.getWorksheet('P&L')!;
    expect(pl.getRow(2).getCell(1).dataValidation).toBeUndefined();
  });

  it('column-level validation applies to every data cell when cell-level is absent', async () => {
    const seed: WorkbookSchema = {
      title: 't',
      sheets: [
        {
          name: 'Assumptions',
          isAssumptions: true,
          columns: [
            { key: 'k', header: 'K' },
            {
              key: 'v',
              header: 'V',
              type: 'number',
              validation: { type: 'whole', operator: 'greaterThan', min: 0 },
            },
          ],
          rows: [
            { cells: { k: { value: 'a' }, v: { value: 5 } } },
            { cells: { k: { value: 'b' }, v: { value: 9 } } },
          ],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(seed);
    const wb = await load(buf);
    const asm = wb.getWorksheet('Assumptions')!;
    expect(asm.getRow(2).getCell(2).dataValidation?.type).toBe('whole');
    expect(asm.getRow(3).getCell(2).dataValidation?.type).toBe('whole');
  });
});

// ---------------------------------------------------------------------------
// TASK 5 (hardening) — formula sanitizer: leading `=` MUST NOT reach XML `<f>`
//
// ExcelJS writes the formula string verbatim into the worksheet XML `<f>`
// element. A valid Excel formula in XML is `SUM(A1:A2)` — a leading `=`
// (`<f>=SUM(A1:A2)</f>`) makes Excel treat the file as corrupt / render #NAME?.
// Our schema+prompt convention emits `=`-prefixed formulas, so the builder MUST
// strip the leading `=` at write time. RED on base (verbatim passthrough left
// `<f>=…</f>`); GREEN after sanitizeFormula().
// ---------------------------------------------------------------------------
describe('hardening — formula sanitizer strips leading "=" before ExcelJS', () => {
  it('decodes HTML-encoded quoted currency formats and keeps values numeric', async () => {
    const schema: WorkbookSchema = {
      title: 'Encoded formats',
      author: 'tests',
      sheets: [
        {
          name: 'Decision Summary',
          columns: [
            { key: 'metric', header: 'Metric', type: 'text' },
            {
              key: 'value',
              header: 'Value',
              type: 'number',
              numberFormat: '#,##0.0&amp;quot; PLN m&amp;quot;',
            },
          ],
          rows: [
            { cells: { metric: { value: 'Target' }, value: { value: 12 } } },
            { cells: { metric: { value: 'Forecast' }, value: { value: 10.8 } } },
            { cells: { metric: { value: 'Gap' }, value: { value: 1.2 } } },
          ],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: true });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('Decision Summary')!;
    for (const address of ['B2', 'B3', 'B4']) {
      expect(typeof ws.getCell(address).value).toBe('number');
      expect(ws.getCell(address).numFmt).toBe('#,##0.0" PLN m"');
    }
  });

  const SEED: WorkbookSchema = {
    title: 'Sanitize',
    sheets: [
      {
        name: 'S',
        columns: [
          { key: 'a', header: 'A', type: 'number' },
          { key: 'b', header: 'B', type: 'number' },
          { key: 'sum', header: 'Sum', type: 'number' },
        ],
        rows: [
          { cells: { a: { value: 1 }, b: { value: 2 }, sum: { formula: '=A1+B1' } } },
          { cells: { a: { value: 3 }, b: { value: 4 }, sum: { formula: '=SUM(A2:B2)' } } },
        ],
      },
    ],
  };

  it('worksheet XML <f> element has NO leading "=" (real file is valid)', async () => {
    const buf = await buildWorkbookBuffer(SEED);
    const xml = await firstSheetXml(buf);
    const formulas = [...xml.matchAll(/<f[^>]*>([^<]*)<\/f>/g)].map((m) => m[1]);
    expect(formulas.length).toBeGreaterThanOrEqual(2);
    // The load-bearing assertion: NO formula in the XML may start with '='.
    for (const f of formulas) {
      expect(f.startsWith('=')).toBe(false);
    }
    // And the bodies are preserved (meaning unchanged).
    expect(formulas.some((f) => f.replace(/\s/g, '') === 'A1+B1')).toBe(true);
    expect(formulas.some((f) => f.replace(/\s/g, '') === 'SUM(A2:B2)')).toBe(true);
  });

  it('ExcelJS read-back formula is free of its leading "=" (row 2 = 1st data row)', async () => {
    const buf = await buildWorkbookBuffer(SEED);
    const wb = await load(buf);
    // Builder emits a header row (Excel row 1), so the 1st data formula is row 2.
    const cell = wb.getWorksheet('S')!.getRow(2).getCell(3).value as { formula?: string };
    expect(cell.formula).toBeDefined();
    expect(cell.formula!.startsWith('=')).toBe(false);
    expect(cell.formula!.replace(/\s/g, '')).toBe('A1+B1');
  });

  it('a double "==" is also collapsed to a valid formula (no leading "=")', async () => {
    const seed: WorkbookSchema = {
      title: 'Double',
      sheets: [
        {
          name: 'S',
          columns: [
            { key: 'a', header: 'A', type: 'number' },
            { key: 'x', header: 'X', type: 'number' },
          ],
          rows: [{ cells: { a: { value: 5 }, x: { formula: '==A1*2' } } }],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(seed);
    const xml = await firstSheetXml(buf);
    const formulas = [...xml.matchAll(/<f[^>]*>([^<]*)<\/f>/g)].map((m) => m[1]);
    expect(formulas.every((f) => !f.startsWith('='))).toBe(true);
    expect(formulas.some((f) => f.replace(/\s/g, '') === 'A1*2')).toBe(true);
  });

  it('decodes sanitizer entities in quoted cross-sheet references exactly once', async () => {
    const schema: WorkbookSchema = {
      title: 'Cross-sheet sanitizer',
      sheets: [
        {
          name: 'Decision Summary',
          columns: [{ key: 'value', header: 'Value', type: 'number' }],
          rows: [{ cells: { value: { value: 12 } } }],
        },
        {
          name: 'Checks',
          columns: [{ key: 'result', header: 'Result', type: 'number' }],
          rows: [
            {
              cells: {
                result: {
                  formula: '&amp;#x27;Decision Summary&amp;#x27;!A2-1',
                },
              },
            },
          ],
        },
      ],
    };
    const buf = await buildWorkbookBuffer(schema);
    const wb = await load(buf);
    const value = wb.getWorksheet('Checks')!.getCell('A2').value as { formula?: string };
    expect(value.formula).toBe("'Decision Summary'!A2-1");
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('xl/worksheets/sheet3.xml')!.async('string');
    expect(xml).toContain('&apos;Decision Summary&apos;!A2-1');
    expect(xml).not.toContain('&amp;#x27;');
  });

  it('keeps an entity-encoded UNKNOWN guard neutral instead of green', async () => {
    const schema: WorkbookSchema = {
      title: 'Evidence state',
      sheets: [
        {
          name: 'Decision Summary',
          columns: [{ key: 'value', header: 'Value', type: 'text' }],
          rows: [{ cells: { value: { value: 'UNKNOWN' } } }],
        },
        {
          name: 'Checks',
          columns: [{ key: 'result', header: 'Status', type: 'text' }],
          rows: [
            {
              cells: {
                result: {
                  formula:
                    'IF(&amp;#x27;Decision Summary&amp;#x27;!A2=&amp;quot;UNKNOWN&amp;quot;,&amp;quot;UNKNOWN&amp;quot;,&amp;quot;REVIEW&amp;quot;)',
                },
              },
            },
          ],
        },
      ],
    };

    const wb = await load(await buildWorkbookBuffer(schema));
    const result = wb.getWorksheet('Checks')!.getCell('A2');
    expect((result.value as { formula?: string }).formula).toContain('"UNKNOWN"');
    expect(result.font.color?.argb).toBe('FF64748B');
    expect(result.font.color?.argb).not.toBe('FF008000');
  });
});
