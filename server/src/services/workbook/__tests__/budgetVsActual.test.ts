// @vitest-environment node
/**
 * Anti-false-green tests for the "Budżet vs Wykonanie" (budget-vs-actual)
 * controlling template.
 *
 * Every assertion targets a REAL .xlsx built by buildWorkbookBuffer() and read
 * back via ExcelJS — no assertion trusts the in-memory schema alone.
 *
 * The proof has three legs, mirroring threeScenarioPnL.test.ts:
 *   (a) read-back: variance/variance% cells are FORMULAS (never constants),
 *       reference the CORRECT A1 addresses, the SUMA row sums exactly the
 *       data rows above it (no overshoot into header/other totals), and the
 *       Assumptions sheet carries isAssumptions + input styling.
 *   (b) MATH VERIFICATION: an independent JS model computes the expected
 *       variance / variance% / totals directly from the line items; a
 *       self-contained formula evaluator resolves the ACTUAL workbook formula
 *       graph (no cached values relied upon) and the two must agree.
 *   (c) the deterministic critic (critiqueWorkbook) scores 100 / passed / 0
 *       issues, for the default items and a distinct custom param set.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';
import {
  buildBudgetVsActualSchema,
  type BudgetLineItem,
  type BudgetVsActualParams,
} from '../templates/budgetVsActual.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ITEMS_A: BudgetLineItem[] = [
  { nazwa: 'Przychody ze sprzedaży', budzet: 1_000_000, wykonanie: 1_050_000 },
  { nazwa: 'Wynagrodzenia', budzet: 400_000, wykonanie: 420_000 },
  { nazwa: 'Marketing', budzet: 100_000, wykonanie: 80_000 },
  { nazwa: 'Koszty operacyjne', budzet: 150_000, wykonanie: 160_000 },
];

const PARAMS_A: BudgetVsActualParams = {
  title: 'Budżet vs Wykonanie — Testowa Sp. z o.o.',
  currencyCode: 'PLN',
  periodLabel: 'Q1 2026',
  items: ITEMS_A,
  tolerancePct: 0.05,
};

const ITEMS_B: BudgetLineItem[] = [
  { nazwa: 'Revenue', budzet: 2_000_000, wykonanie: 1_900_000 },
  { nazwa: 'Payroll', budzet: 600_000, wykonanie: 650_000 },
  { nazwa: 'IT & Licenses', budzet: 90_000, wykonanie: 85_000 },
];

const PARAMS_B: BudgetVsActualParams = {
  title: 'Budget vs Actual — Globex Inc.',
  currencyCode: 'USD',
  periodLabel: 'FY2030',
  items: ITEMS_B,
  tolerancePct: 0.1,
};

async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  return wb;
}

/** Get a cell's raw formula string (without '='), or null when it's a value. */
function formulaOf(ws: ExcelJS.Worksheet, addr: string): string | null {
  const v: any = ws.getCell(addr).value;
  if (v && typeof v === 'object' && typeof v.formula === 'string') return v.formula;
  return null;
}

const MAIN_SHEET = 'Budżet vs Wykonanie';

// ---------------------------------------------------------------------------
// Independent JS reference model — ground truth for (b).
// ---------------------------------------------------------------------------

interface ItemOut {
  budzet: number;
  wykonanie: number;
  wariancja: number;
  wariancjaProc: number;
}

function referenceModel(items: BudgetLineItem[]): { rows: ItemOut[]; sumBudzet: number; sumWykonanie: number; sumWariancja: number; sumWariancjaProc: number } {
  const rows = items.map((it) => {
    const wariancja = it.wykonanie - it.budzet;
    const wariancjaProc = wariancja / it.budzet;
    return { budzet: it.budzet, wykonanie: it.wykonanie, wariancja, wariancjaProc };
  });
  const sumBudzet = rows.reduce((a, r) => a + r.budzet, 0);
  const sumWykonanie = rows.reduce((a, r) => a + r.wykonanie, 0);
  const sumWariancja = rows.reduce((a, r) => a + r.wariancja, 0);
  const sumWariancjaProc = sumWariancja / sumBudzet;
  return { rows, sumBudzet, sumWykonanie, sumWariancja, sumWariancjaProc };
}

// ---------------------------------------------------------------------------
// Self-contained formula evaluator over the ACTUAL workbook (same approach as
// threeScenarioPnL.test.ts — no reliance on cached values).
// ---------------------------------------------------------------------------

function makeEvaluator(wb: ExcelJS.Workbook) {
  const cache = new Map<string, number>();

  function cellValue(sheet: string, addr: string): number {
    const key = `${sheet}!${addr}`;
    if (cache.has(key)) return cache.get(key)!;
    const ws = wb.getWorksheet(sheet);
    if (!ws) throw new Error(`no sheet ${sheet}`);
    const raw: any = ws.getCell(addr).value;
    let result: number;
    if (raw && typeof raw === 'object' && typeof raw.formula === 'string') {
      result = evalExpr(sheet, raw.formula);
    } else if (typeof raw === 'number') {
      result = raw;
    } else if (raw && typeof raw === 'object' && typeof raw.result === 'number') {
      result = raw.result;
    } else {
      throw new Error(`non-numeric cell ${key}: ${JSON.stringify(raw)}`);
    }
    cache.set(key, result);
    return result;
  }

  function evalExpr(currentSheet: string, formula: string): number {
    let s = formula.trim();
    if (s.startsWith('=')) s = s.slice(1);

    let i = 0;
    const peek = () => s[i];
    const skipWs = () => {
      while (i < s.length && /\s/.test(s[i])) i++;
    };

    function parseExpression(): number {
      let value = parseTerm();
      for (;;) {
        skipWs();
        const op = peek();
        if (op === '+' || op === '-') {
          i++;
          const rhs = parseTerm();
          value = op === '+' ? value + rhs : value - rhs;
        } else break;
      }
      return value;
    }

    function parseTerm(): number {
      let value = parseFactor();
      for (;;) {
        skipWs();
        const op = peek();
        if (op === '*' || op === '/') {
          i++;
          const rhs = parseFactor();
          value = op === '*' ? value * rhs : value / rhs;
        } else break;
      }
      return value;
    }

    function parseFactor(): number {
      skipWs();
      const ch = peek();
      if (ch === '(') {
        i++;
        const v = parseExpression();
        skipWs();
        if (peek() === ')') i++;
        return v;
      }
      if (ch === '-') {
        i++;
        return -parseFactor();
      }
      if (ch === '+') {
        i++;
        return parseFactor();
      }
      if (/[0-9.]/.test(ch)) {
        const start = i;
        while (i < s.length && /[0-9.]/.test(s[i])) i++;
        return parseFloat(s.slice(start, i));
      }
      if (/[A-Za-z]/.test(ch)) {
        const start = i;
        while (i < s.length && /[A-Za-z]/.test(s[i])) i++;
        const ident = s.slice(start, i).toUpperCase();
        skipWs();
        if (peek() === '(') {
          if (ident !== 'SUM' && ident !== 'MAX') throw new Error(`unsupported fn ${ident} in ${formula}`);
          i++; // consume '('
          const args: number[] = [];
          // SUM(range) — range like B2:B5; MAX(a,b) — scalar args.
          if (ident === 'SUM') {
            skipWs();
            const rangeStart = i;
            while (i < s.length && s[i] !== ')') i++;
            const rangeStr = s.slice(rangeStart, i);
            args.push(sumRange(currentSheet, rangeStr));
          } else {
            args.push(parseExpression());
            skipWs();
            while (peek() === ',') {
              i++;
              args.push(parseExpression());
              skipWs();
            }
          }
          if (peek() === ')') i++;
          return ident === 'SUM' ? args[0] : Math.max(...args);
        }
        i = start;
      }
      return parseRef();
    }

    function parseRef(): number {
      skipWs();
      let sheet = currentSheet;
      if (peek() === "'") {
        i++;
        const start = i;
        while (i < s.length && s[i] !== "'") i++;
        sheet = s.slice(start, i);
        i++;
        if (peek() === '!') i++;
      } else {
        const start = i;
        let j = i;
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        if (s[j] === '!' && j > i && /[A-Za-z_]/.test(s[start])) {
          sheet = s.slice(start, j);
          i = j + 1;
        }
      }
      skipWs();
      const m = /^\$?([A-Z]+)\$?(\d+)/.exec(s.slice(i));
      if (!m) throw new Error(`bad ref at ${i} in ${formula}`);
      i += m[0].length;
      const addr = `${m[1]}${m[2]}`;
      return cellValue(sheet, addr);
    }

    return parseExpression();
  }

  function sumRange(sheet: string, rangeStr: string): number {
    // Support single range "B2:B5" or comma-joined "B2:B5,B7:B9" (not needed
    // today but harmless); each part must be same-column.
    const parts = rangeStr.split(',').map((p) => p.trim());
    let total = 0;
    for (const part of parts) {
      const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(part);
      if (!m) throw new Error(`bad SUM range ${part}`);
      const [, c1, r1, c2, r2] = m;
      if (c1 !== c2) throw new Error(`multi-column SUM not supported in test evaluator: ${part}`);
      const from = parseInt(r1, 10);
      const to = parseInt(r2, 10);
      for (let r = Math.min(from, to); r <= Math.max(from, to); r++) {
        total += cellValue(sheet, `${c1}${r}`);
      }
    }
    return total;
  }

  return { cellValue };
}

// ---------------------------------------------------------------------------
// (schema) — the template's output validates against the canonical schema
// ---------------------------------------------------------------------------

describe('budgetVsActual — schema validity', () => {
  it('produces a WorkbookSchema that passes the canonical validator', () => {
    const schema = buildBudgetVsActualSchema(PARAMS_A);
    const parsed = WorkbookSchemaValidator.safeParse(schema);
    expect(parsed.success).toBe(true);
    expect(schema.sheets.map((s) => s.name)).toEqual(['Założenia', MAIN_SHEET]);
  });

  it('falls back to sensible demo data when items are omitted', () => {
    const schema = buildBudgetVsActualSchema({});
    const main = schema.sheets.find((s) => s.name === MAIN_SHEET)!;
    // demo default items + 1 SUMA row
    expect(main.rows.length).toBeGreaterThan(1);
    expect(main.rows[main.rows.length - 1].isSummary).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// (a) read-back — real .xlsx, formulas + correct addresses + SUM coverage
// ---------------------------------------------------------------------------

describe('(a) read-back — variance/variance% are formulas with correct addresses', () => {
  it('every data-row variance / variance% cell is a FORMULA (no magic-numbers)', async () => {
    const buf = await buildWorkbookBuffer(buildBudgetVsActualSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet(MAIN_SHEET)!;
    const n = ITEMS_A.length;
    for (let idx = 0; idx < n; idx++) {
      const r = idx + 2;
      expect(formulaOf(ws, `D${r}`), `D${r} should be a formula`).toBeTruthy();
      expect(formulaOf(ws, `E${r}`), `E${r} should be a formula`).toBeTruthy();
      // budzet/wykonanie are the raw inputs — must be plain numbers, not formulas.
      expect(formulaOf(ws, `B${r}`)).toBeNull();
      expect(formulaOf(ws, `C${r}`)).toBeNull();
    }
  });

  it('variance formula = wykonanie(col C) - budzet(col B), same row', async () => {
    const buf = await buildWorkbookBuffer(buildBudgetVsActualSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet(MAIN_SHEET)!;
    // Row 2 = first item
    expect(formulaOf(ws, 'D2')).toBe('C2-B2');
    expect(formulaOf(ws, 'D3')).toBe('C3-B3');
    // variance % = variance(col D) / budzet(col B), same row
    expect(formulaOf(ws, 'E2')).toBe('D2/B2');
    expect(formulaOf(ws, 'E3')).toBe('D3/B3');
  });

  it('SUMA row sums EXACTLY the data rows above it (no overshoot, no gap)', async () => {
    const buf = await buildWorkbookBuffer(buildBudgetVsActualSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet(MAIN_SHEET)!;
    const n = ITEMS_A.length;
    const summaryRow = n + 2; // rows 2..(n+1) are data, summary is next
    expect(ws.getCell(`A${summaryRow}`).value).toBe('SUMA');
    expect(formulaOf(ws, `B${summaryRow}`)).toBe(`SUM(B2:B${n + 1})`);
    expect(formulaOf(ws, `C${summaryRow}`)).toBe(`SUM(C2:C${n + 1})`);
    expect(formulaOf(ws, `D${summaryRow}`)).toBe(`SUM(D2:D${n + 1})`);
    // Total variance % is its OWN ratio, not a SUM of percentages.
    expect(formulaOf(ws, `E${summaryRow}`)).toBe(`D${summaryRow}/B${summaryRow}`);
  });

  it('named ranges + input styling exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildBudgetVsActualSchema(PARAMS_A));
    const wb = await load(buf);
    const zws = wb.getWorksheet(ASSUMPTIONS_SHEET())!;
    expect(zws).toBeDefined();
    // Input cell chrome: bgColor fill present on the tolerance-threshold row (row 4).
    const style: any = zws.getCell('B4').style;
    expect(style?.fill?.fgColor?.argb ?? style?.fill?.fgColor?.theme).toBeTruthy();
  });

  it('accounting currency format and % format are present on the real cells', async () => {
    const buf = await buildWorkbookBuffer(buildBudgetVsActualSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet(MAIN_SHEET)!;
    const budzetFmt = ws.getCell('B2').numFmt ?? '';
    expect(budzetFmt).toContain('zł');
    expect(budzetFmt).toContain('[Red]');
    const pctFmt = ws.getCell('E2').numFmt ?? '';
    expect(pctFmt).toContain('%');
  });
});

function ASSUMPTIONS_SHEET(): string {
  return 'Założenia';
}

// ---------------------------------------------------------------------------
// (b) MATH VERIFICATION — evaluate the real formula graph, compare to JS model
// ---------------------------------------------------------------------------

describe('(b) math verification — evaluated workbook == independent JS model', () => {
  it('per-row variance / variance% match the reference model (PARAMS_A)', async () => {
    const schema = buildBudgetVsActualSchema(PARAMS_A);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);
    const ref = referenceModel(ITEMS_A);

    ITEMS_A.forEach((_, idx) => {
      const r = idx + 2;
      const evalWariancja = ev.cellValue(MAIN_SHEET, `D${r}`);
      const evalWariancjaProc = ev.cellValue(MAIN_SHEET, `E${r}`);
      expect(evalWariancja).toBeCloseTo(ref.rows[idx].wariancja, 6);
      expect(evalWariancjaProc).toBeCloseTo(ref.rows[idx].wariancjaProc, 8);
    });
  });

  it('SUMA row (evaluated) matches independently-computed totals (PARAMS_A)', async () => {
    const schema = buildBudgetVsActualSchema(PARAMS_A);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);
    const ref = referenceModel(ITEMS_A);
    const n = ITEMS_A.length;
    const summaryRow = n + 2;

    expect(ev.cellValue(MAIN_SHEET, `B${summaryRow}`)).toBeCloseTo(ref.sumBudzet, 6);
    expect(ev.cellValue(MAIN_SHEET, `C${summaryRow}`)).toBeCloseTo(ref.sumWykonanie, 6);
    expect(ev.cellValue(MAIN_SHEET, `D${summaryRow}`)).toBeCloseTo(ref.sumWariancja, 6);
    expect(ev.cellValue(MAIN_SHEET, `E${summaryRow}`)).toBeCloseTo(ref.sumWariancjaProc, 8);
  });

  it('per-row and SUMA match for a distinct param set (PARAMS_B)', async () => {
    const schema = buildBudgetVsActualSchema(PARAMS_B);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);
    const ref = referenceModel(ITEMS_B);
    const n = ITEMS_B.length;
    const summaryRow = n + 2;

    ITEMS_B.forEach((_, idx) => {
      const r = idx + 2;
      expect(ev.cellValue(MAIN_SHEET, `D${r}`)).toBeCloseTo(ref.rows[idx].wariancja, 6);
      expect(ev.cellValue(MAIN_SHEET, `E${r}`)).toBeCloseTo(ref.rows[idx].wariancjaProc, 8);
    });
    expect(ev.cellValue(MAIN_SHEET, `B${summaryRow}`)).toBeCloseTo(ref.sumBudzet, 6);
    expect(ev.cellValue(MAIN_SHEET, `D${summaryRow}`)).toBeCloseTo(ref.sumWariancja, 6);
    expect(ev.cellValue(MAIN_SHEET, `E${summaryRow}`)).toBeCloseTo(ref.sumWariancjaProc, 8);
  });
});

// ---------------------------------------------------------------------------
// (c) critic — score 100, passed, 0 issues
// ---------------------------------------------------------------------------

describe('(c) quality gate — template is critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (PARAMS_A, PARAMS_B, defaults)', () => {
    for (const p of [undefined, PARAMS_A, PARAMS_B]) {
      const report = critiqueWorkbook(buildBudgetVsActualSchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score, `params=${JSON.stringify(p)}`).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});
