// @vitest-environment node
/**
 * Unit tests — WorkbookStyler + consultant styling wiring in WorkbookBuilder.
 *
 * Vegas Fala 6 / Harvard: XLSX generator "brak formatowania". These tests are
 * evidence-grade — they build a REAL .xlsx and assert the styling landed in the
 * workbook (fills, number formats, alignment, zebra, Info sheet, color scales),
 * and that the styling layer never corrupts formulas or shifts data rows.
 */

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import {
  buildWorkbookBuffer,
} from '../../../server/src/services/workbook/WorkbookBuilder.js';
import type { WorkbookSchema } from '../../../server/src/services/workbook/WorkbookSchema.js';
import {
  alignmentForType,
  colLetter,
  colorScaleColumns,
  computeColumnWidth,
  currencyFormat,
  defaultNumberFormat,
  inferCurrency,
} from '../../../server/src/services/workbook/WorkbookStyler.js';

// ---------------------------------------------------------------------------
// Pure helpers — number formats per type, alignment, widths, letters
// ---------------------------------------------------------------------------

describe('WorkbookStyler — number formats per type', () => {
  it('currencyFormat: pln → zł, eur → €, usd → $, generic fallback', () => {
    expect(currencyFormat('pln')).toBe('# ##0.00" zł"');
    expect(currencyFormat('eur')).toBe('€#,##0.00');
    expect(currencyFormat('usd')).toBe('$#,##0.00');
    expect(currencyFormat('generic')).toBe('#,##0.00');
    expect(currencyFormat(undefined)).toBe('#,##0.00');
  });

  it('defaultNumberFormat: percent/number/date/rating mapped, text → undefined', () => {
    const ctx = { currency: 'pln' as const };
    expect(defaultNumberFormat('currency', ctx)).toBe('# ##0.00" zł"');
    expect(defaultNumberFormat('percent', ctx)).toBe('0.0%');
    expect(defaultNumberFormat('number', ctx)).toBe('#,##0.##');
    expect(defaultNumberFormat('date', ctx)).toBe('yyyy-mm-dd');
    expect(defaultNumberFormat('rating', ctx)).toBe('0');
    expect(defaultNumberFormat('text', ctx)).toBeUndefined();
    expect(defaultNumberFormat(undefined, ctx)).toBeUndefined();
  });
});

describe('WorkbookStyler — alignment per type', () => {
  it('numbers/currency/percent/date/rating right, boolean center, text left', () => {
    expect(alignmentForType('number')).toBe('right');
    expect(alignmentForType('currency')).toBe('right');
    expect(alignmentForType('percent')).toBe('right');
    expect(alignmentForType('date')).toBe('right');
    expect(alignmentForType('rating')).toBe('right');
    expect(alignmentForType('boolean')).toBe('center');
    expect(alignmentForType('text')).toBe('left');
    expect(alignmentForType(undefined)).toBe('left');
  });
});

describe('WorkbookStyler — column letters', () => {
  it('maps 1→A, 26→Z, 27→AA, 52→AZ', () => {
    expect(colLetter(1)).toBe('A');
    expect(colLetter(26)).toBe('Z');
    expect(colLetter(27)).toBe('AA');
    expect(colLetter(52)).toBe('AZ');
  });
});

describe('WorkbookStyler — content-aware column widths (min/max clamp)', () => {
  const sheet: WorkbookSchema['sheets'][number] = {
    name: 'W',
    columns: [
      { key: 'short', header: 'X', type: 'text' },
      { key: 'long', header: 'A very very long column header indeed', type: 'text' },
      { key: 'huge', header: 'h', type: 'text' },
      { key: 'num', header: 'N', type: 'number' },
    ],
    rows: [
      { cells: { short: { value: 'ab' }, long: { value: 'y' }, huge: { value: 'x'.repeat(120) }, num: { value: 3 } } },
    ],
  };

  it('short content is floored to WIDTH_MIN (10)', () => {
    expect(computeColumnWidth(sheet.columns[0], sheet)).toBeGreaterThanOrEqual(10);
  });

  it('header drives width when wider than cells', () => {
    const w = computeColumnWidth(sheet.columns[1], sheet);
    expect(w).toBeGreaterThan(20);
  });

  it('very long content is clamped to WIDTH_MAX (48)', () => {
    expect(computeColumnWidth(sheet.columns[2], sheet)).toBeLessThanOrEqual(48);
  });

  it('numeric column gets a sensible floor (>=12)', () => {
    expect(computeColumnWidth(sheet.columns[3], sheet)).toBeGreaterThanOrEqual(12);
  });
});

describe('WorkbookStyler — currency inference', () => {
  it('detects PL from zł / pln in title/description, EUR/USD from symbols, defaults PL', () => {
    const pl: WorkbookSchema = { title: 'Budżet w zł', sheets: [{ name: 'S', columns: [], rows: [] }] };
    const eur: WorkbookSchema = { title: 'Budget €', sheets: [{ name: 'S', columns: [], rows: [] }] };
    const usd: WorkbookSchema = { title: 'Budget in USD', sheets: [{ name: 'S', columns: [], rows: [] }] };
    const none: WorkbookSchema = { title: 'Plain plan', sheets: [{ name: 'S', columns: [], rows: [] }] };
    expect(inferCurrency(pl)).toBe('pln');
    expect(inferCurrency(eur)).toBe('eur');
    expect(inferCurrency(usd)).toBe('usd');
    expect(inferCurrency(none)).toBe('pln'); // Consultify default market
  });
});

describe('WorkbookStyler — color-scale column detection', () => {
  it('flags percent columns and score/rating-like number columns', () => {
    const sheet: WorkbookSchema['sheets'][number] = {
      name: 'S',
      columns: [
        { key: 'name', header: 'Nazwa', type: 'text' },
        { key: 'roi', header: 'ROI', type: 'percent' },
        { key: 'readiness', header: 'AI Readiness Score', type: 'number' },
        { key: 'count', header: 'Sztuk', type: 'number' },
      ],
      rows: [],
    };
    // 1-based indices: roi=2, readiness=3; count(4) not score-like
    expect(colorScaleColumns(sheet)).toEqual([2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Integration — build a real .xlsx and assert the styling landed
// ---------------------------------------------------------------------------

const SEED: WorkbookSchema = {
  title: 'Model finansowy w zł',
  description: 'Seed model for styling tests',
  author: 'tests',
  sheets: [
    {
      name: 'P&L',
      columns: [
        { key: 'pozycja', header: 'Pozycja', type: 'text' },
        { key: 'y2026', header: '2026', type: 'currency' },
        { key: 'marza', header: 'Marża', type: 'percent' },
        { key: 'score', header: 'Priority Score', type: 'number' },
      ],
      rows: [
        { cells: { pozycja: { value: 'Przychody' }, y2026: { value: 100000 }, marza: { value: 0.4 }, score: { value: 10 } } },
        { cells: { pozycja: { value: 'COGS' }, y2026: { value: 35000 }, marza: { value: 0.3 }, score: { value: 50 } } },
        { cells: { pozycja: { value: 'Zysk' }, y2026: { formula: '=B2-B3' }, marza: { value: 0.7 }, score: { value: 90 } }, isSummary: true },
      ],
    },
  ],
};

async function styleXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return (await zip.file('xl/styles.xml')!.async('string')).toUpperCase();
}
async function sheetXml(buf: Buffer, i = 1): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  return await zip.file(`xl/worksheets/sheet${i}.xml`)!.async('string');
}

describe('WorkbookBuilder — consultant styling ON', () => {
  it('header uses brand navy (0C447C), not the generic blue', async () => {
    const buf = await buildWorkbookBuffer(SEED, { applyConsultantStyling: true });
    expect(await styleXml(buf)).toContain('0C447C');
  });

  it('currency column gets locale zł format; zebra fill present', async () => {
    const buf = await buildWorkbookBuffer(SEED, { applyConsultantStyling: true });
    const styles = await styleXml(buf);
    // zł number format is stored as a custom numFmt in styles.xml
    expect(styles).toContain('ZŁ'.toUpperCase());
    // zebra fill color
    expect(styles).toContain('F3F7FB');
  });

  it('appends an "Info" metadata sheet (data sheets keep sheet1..N order)', async () => {
    const buf = await buildWorkbookBuffer(SEED, {
      applyConsultantStyling: true,
      meta: { organizationName: 'Acme', source: 'seed' },
    });
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    // Data sheet stays first (sheet1.xml) so golden tests + formulas are safe.
    expect(wb.worksheets[0].name).toBe('P&L');
    // Info sheet is present (appended last).
    expect(wb.worksheets.map((w) => w.name)).toContain('Info');
    const info = wb.getWorksheet('Info')!;
    expect(String(info.getCell('A1').value)).toContain('Model finansowy');
  });

  it('adds a color scale on %/score columns (marza + score → CF blocks)', async () => {
    const buf = await buildWorkbookBuffer(SEED, { applyConsultantStyling: true });
    const xml = await sheetXml(buf, 1); // sheet1 = P&L (Info appended last)
    expect(xml).toContain('colorScale');
    expect(xml.toUpperCase()).toContain('FF2E9098'); // teal high stop
  });

  it('does NOT shift data rows — header stays on row 1 and formula is preserved', async () => {
    const buf = await buildWorkbookBuffer(SEED, { applyConsultantStyling: true });
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const pl = wb.getWorksheet('P&L')!;
    expect(pl.getRow(1).getCell(1).value).toBe('Pozycja'); // header row 1
    // Column 2 = y2026 (loaded workbook loses key→letter map, use index).
    const zysk = pl.getRow(4).getCell(2).value as { formula?: string };
    // Formula intact and still references B2/B3 (data not shifted down).
    expect(zysk.formula).toContain('B2-B3');
  });

  it('numeric cell is right-aligned, text cell left-aligned', async () => {
    const buf = await buildWorkbookBuffer(SEED, { applyConsultantStyling: true });
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const pl = wb.getWorksheet('P&L')!;
    // Column 1 = pozycja (text), column 2 = y2026 (currency).
    expect(pl.getRow(2).getCell(2).alignment?.horizontal).toBe('right');
    expect(pl.getRow(2).getCell(1).alignment?.horizontal).toBe('left');
  });
});

describe('WorkbookBuilder — consultant styling OFF (raw)', () => {
  it('no Info sheet, generic blue header, no default zebra', async () => {
    const buf = await buildWorkbookBuffer(SEED, { applyConsultantStyling: false });
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).not.toContain('Info');
    const styles = await styleXml(buf);
    expect(styles).toContain('4472C4'); // legacy header blue retained
    expect(styles).not.toContain('F3F7FB'); // no default zebra
  });

  it('default (no options) applies consultant styling (Info present)', async () => {
    const buf = await buildWorkbookBuffer(SEED);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toContain('Info');
  });
});
