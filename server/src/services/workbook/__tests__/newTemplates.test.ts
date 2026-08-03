// @vitest-environment node
/**
 * Anti-false-green tests for the two NEW model templates added to the workbook
 * registry alongside the flagship `threeScenarioPnL`: `operatingBudget` (a
 * 12-month operating budget) and `dcfValuation` (a Discounted Cash Flow
 * valuation). Mirrors the proof structure of threeScenarioPnL.test.ts:
 *
 *   (0) registry     — both ids are listed, reachable via buildFromTemplate /
 *                       buildFromTemplateFlat, and default output validates
 *                       against the canonical WorkbookSchema with ≥1 real
 *                       formula cell.
 *   (a) read-back     — real .xlsx built via buildWorkbookBuffer(); line items
 *                       are FORMULAS (never magic-numbers), chained month↔month
 *                       / year↔year, cross-referencing the Assumptions sheet.
 *   (b) math verify   — an independent JS model computes the expected values;
 *                       a self-contained formula evaluator resolves the ACTUAL
 *                       workbook formula graph (supports add/sub/mul/div/pow,
 *                       SUM ranges, same-sheet + cross-sheet refs) and the two
 *                       must agree.
 *   (c) quality gate  — critiqueWorkbook → score 100 / passed / 0 issues.
 *
 * NOTE on `=` prefix: per this codebase's convention (see threeScenarioPnL.ts
 * header comment + WorkbookBuilder.ts sanitizeFormula), `Cell.formula` strings
 * carry NO leading `=` — the builder writes them verbatim into the worksheet
 * XML `<f>` element, which must be `=`-free. So "formula presence" here is
 * asserted as "a non-empty formula string", consistent with every other test
 * in this suite (see threeScenarioPnL.test.ts `formulaOf`).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildDcfValuationSchema, type DcfValuationParams } from '../templates/dcfValuation.js';
import {
  buildFromTemplate,
  buildFromTemplateFlat,
  listWorkbookTemplates,
  WORKBOOK_TEMPLATES,
} from '../templates/index.js';
import {
  buildOperatingBudgetSchema,
  type OperatingBudgetParams,
} from '../templates/operatingBudget.js';
import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';

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

/** Every populated cell (any row) across the whole workbook schema. */
function allCells(
  schema: ReturnType<typeof buildOperatingBudgetSchema>
): Array<{ formula?: string; value?: unknown }> {
  const out: Array<{ formula?: string; value?: unknown }> = [];
  for (const sheet of schema.sheets) {
    for (const row of sheet.rows) {
      for (const key of Object.keys(row.cells)) out.push(row.cells[key]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Self-contained formula evaluator over the ACTUAL workbook — supports the
// superset of syntax both new templates emit: +, -, *, /, ^ (power), unary
// -/+, parentheses, MAX(a,b), SUM(range) (same-row OR same-col, same-sheet OR
// cross-sheet), and same-sheet / cross-sheet A1 refs (with $).
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

  function colLetterToIndex(letter: string): number {
    let idx = 0;
    for (let k = 0; k < letter.length; k++) idx = idx * 26 + (letter.charCodeAt(k) - 64);
    return idx;
  }
  function colIndexToLetter(idx1: number): string {
    let n = idx1;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function sumRange(sheet: string, c1: string, r1: number, c2: string, r2: number): number {
    const ci1 = colLetterToIndex(c1);
    const ci2 = colLetterToIndex(c2);
    const [colFrom, colTo] = ci1 <= ci2 ? [ci1, ci2] : [ci2, ci1];
    const [rowFrom, rowTo] = r1 <= r2 ? [r1, r2] : [r2, r1];
    let sum = 0;
    for (let c = colFrom; c <= colTo; c++) {
      for (let r = rowFrom; r <= rowTo; r++) {
        sum += cellValue(sheet, `${colIndexToLetter(c)}${r}`);
      }
    }
    return sum;
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
      let value = parsePower();
      for (;;) {
        skipWs();
        const op = peek();
        if (op === '*' || op === '/') {
          i++;
          const rhs = parsePower();
          value = op === '*' ? value * rhs : value / rhs;
        } else break;
      }
      return value;
    }

    function parsePower(): number {
      const base = parseFactor();
      skipWs();
      if (peek() === '^') {
        i++;
        const exp = parseFactor();
        return Math.pow(base, exp);
      }
      return base;
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
          i++; // consume '('
          if (ident === 'MAX') {
            const args: number[] = [parseExpression()];
            skipWs();
            while (peek() === ',') {
              i++;
              args.push(parseExpression());
              skipWs();
            }
            if (peek() === ')') i++;
            return Math.max(...args);
          }
          if (ident === 'SUM') {
            let total = 0;
            total += parseSumArg();
            skipWs();
            while (peek() === ',') {
              i++;
              total += parseSumArg();
              skipWs();
            }
            if (peek() === ')') i++;
            return total;
          }
          throw new Error(`unsupported fn ${ident} in ${formula}`);
        }
        // Not a function call — back up and let the ref path handle it.
        i = start;
      }
      return parseRef();
    }

    // A SUM(...) argument: either a plain expression or a RANGE (A1:B1 /
    // A1:A5), optionally cross-sheet-prefixed. Ranges are summed directly
    // (not recursed through parseExpression, since ':' is not a normal op).
    function parseSumArg(): number {
      skipWs();
      let sheet = currentSheet;
      const restoreIdx = i;
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
      const m1 = /^\$?([A-Z]+)\$?(\d+)/.exec(s.slice(i));
      if (!m1) {
        i = restoreIdx;
        return parseExpression();
      }
      i += m1[0].length;
      skipWs();
      if (peek() === ':') {
        i++;
        skipWs();
        const m2 = /^\$?([A-Z]+)\$?(\d+)/.exec(s.slice(i));
        if (!m2) throw new Error(`bad range end in ${formula}`);
        i += m2[0].length;
        return sumRange(sheet, m1[1], parseInt(m1[2], 10), m2[1], parseInt(m2[2], 10));
      }
      // Single-cell "range" (no colon) — just that cell.
      return cellValue(sheet, `${m1[1]}${m1[2]}`);
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
      return cellValue(sheet, `${m[1]}${m[2]}`);
    }

    return parseExpression();
  }

  return { cellValue };
}

// ---------------------------------------------------------------------------
// (0) registry — both templates listed + reachable + default output valid
// ---------------------------------------------------------------------------

describe('registry — operatingBudget + dcfValuation are registered', () => {
  it('listWorkbookTemplates() contains both new templates', () => {
    const ids = listWorkbookTemplates().map((t) => t.id);
    expect(ids).toContain('operatingBudget');
    expect(ids).toContain('dcfValuation');
    // The flagship must still be there too — additive, not a replacement.
    expect(ids).toContain('threeScenarioPnL');
    // Registry grows additively (breakEven + cashflow12m added later) — assert
    // "at least these 3", not an exact count, so this test doesn't need to be
    // touched every time a new template is registered.
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });

  it('WORKBOOK_TEMPLATES exposes both entries with id/build wired correctly', () => {
    expect(WORKBOOK_TEMPLATES.operatingBudget.id).toBe('operatingBudget');
    expect(WORKBOOK_TEMPLATES.operatingBudget.build).toBe(buildOperatingBudgetSchema);
    expect(WORKBOOK_TEMPLATES.dcfValuation.id).toBe('dcfValuation');
    expect(WORKBOOK_TEMPLATES.dcfValuation.build).toBe(buildDcfValuationSchema);
  });

  it('operatingBudget: buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('operatingBudget', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('dcfValuation: buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('dcfValuation', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('buildFromTemplate() also reaches both templates with native (non-flat) params', () => {
    expect(buildFromTemplate('operatingBudget', {})).not.toBeNull();
    expect(buildFromTemplate('dcfValuation', {})).not.toBeNull();
    expect(buildFromTemplate('doesNotExist', {})).toBeNull();
  });

  it('both templates pass the canonical WorkbookSchema validator (default params)', () => {
    const budget = buildOperatingBudgetSchema();
    const dcf = buildDcfValuationSchema();
    expect(WorkbookSchemaValidator.safeParse(budget).success).toBe(true);
    expect(WorkbookSchemaValidator.safeParse(dcf).success).toBe(true);
    expect(budget.sheets.map((s) => s.name)).toEqual(['Założenia', 'Budżet', 'Podsumowanie']);
    expect(dcf.sheets.map((s) => s.name)).toEqual(['Założenia', 'Projekcja FCF', 'Wycena']);
  });
});

// ---------------------------------------------------------------------------
// operatingBudget — fixtures + reference model
// ---------------------------------------------------------------------------

const BUDGET_PARAMS_A: Required<OperatingBudgetParams> = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  startYear: 2026,
  baseMonthlyRevenue: 200_000,
  monthlyRevenueGrowthPct: 0.03,
  variableCostPct: 0.4,
  rentMonthly: 12_000,
  salariesMonthly: 55_000,
  marketingMonthly: 8_000,
  otherFixedMonthly: 4_000,
  fixedCostGrowthPct: 0.01,
};

const BUDGET_PARAMS_B: OperatingBudgetParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  startYear: 2028,
  baseMonthlyRevenue: 500_000,
  monthlyRevenueGrowthPct: -0.01,
  variableCostPct: 0.5,
  rentMonthly: 20_000,
  salariesMonthly: 90_000,
  marketingMonthly: 15_000,
  otherFixedMonthly: 6_000,
  fixedCostGrowthPct: 0.0,
};

interface BudgetMonth {
  revenue: number;
  varCost: number;
  fixedTotal: number;
  totalCost: number;
  result: number;
  cum: number;
  marginPct: number;
}

function referenceBudget(p: Required<OperatingBudgetParams>): BudgetMonth[] {
  const out: BudgetMonth[] = [];
  let prevRevenue = 0;
  let prevRent = 0;
  let prevSalaries = 0;
  let prevMarketing = 0;
  let prevOther = 0;
  let cum = 0;
  for (let m = 0; m < 12; m++) {
    const revenue = m === 0 ? p.baseMonthlyRevenue : prevRevenue * (1 + p.monthlyRevenueGrowthPct);
    const varCost = revenue * p.variableCostPct;
    const rent = m === 0 ? p.rentMonthly : prevRent * (1 + p.fixedCostGrowthPct);
    const salaries = m === 0 ? p.salariesMonthly : prevSalaries * (1 + p.fixedCostGrowthPct);
    const marketing = m === 0 ? p.marketingMonthly : prevMarketing * (1 + p.fixedCostGrowthPct);
    const other = m === 0 ? p.otherFixedMonthly : prevOther * (1 + p.fixedCostGrowthPct);
    const fixedTotal = rent + salaries + marketing + other;
    const totalCost = varCost + fixedTotal;
    const result = revenue - totalCost;
    cum += result;
    out.push({ revenue, varCost, fixedTotal, totalCost, result, cum, marginPct: result / revenue });
    prevRevenue = revenue;
    prevRent = rent;
    prevSalaries = salaries;
    prevMarketing = marketing;
    prevOther = other;
  }
  return out;
}

const MONTH_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const BUDGET_ROW = {
  revenue: 2,
  varCost: 3,
  margin: 4,
  fixedTotal: 9,
  totalCost: 10,
  result: 11,
  cum: 12,
  marginPct: 13,
};

describe('operatingBudget — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every Budżet line item cell (12 months + RAZEM) is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Budżet')!;
    for (const col of [...MONTH_COLS, 'N']) {
      for (let r = 2; r <= 13; r++) {
        const f = formulaOf(ws, `${col}${r}`);
        expect(f, `${col}${r} should be a formula`).toBeTruthy();
      }
    }
  });

  it('revenue chain: m1 references Assumptions, m2 references m1 + growth assumption', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Budżet')!;
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2");
    expect(formulaOf(ws, 'C2')).toBe("B2*(1+'Założenia'!$B$3)");
    expect(formulaOf(ws, 'M2')).toBe("L2*(1+'Założenia'!$B$3)");
  });

  it('fixed cost lines reference Assumptions + chain m/m growth', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Budżet')!;
    expect(formulaOf(ws, 'B5')).toBe("'Założenia'!$B$5"); // Czynsz m1
    expect(formulaOf(ws, 'C5')).toBe("B5*(1+'Założenia'!$B$9)");
  });

  it('subtotal rows use derived arithmetic (not raw SUM) — margin, fixed-total, total-cost, result', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Budżet')!;
    expect(formulaOf(ws, 'B4')).toBe('B2-B3'); // Marża = Revenue - VarCost
    expect(formulaOf(ws, 'B9')).toBe('B5+B6+B7+B8'); // Koszty stałe razem
    expect(formulaOf(ws, 'B10')).toBe('B3+B9'); // Koszty razem
    expect(formulaOf(ws, 'B11')).toBe('B2-B10'); // Wynik operacyjny
  });

  it('cumulative row chains: m1 = result(m1); m2 = cum(m1) + result(m2)', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Budżet')!;
    expect(formulaOf(ws, 'B12')).toBe('B11');
    expect(formulaOf(ws, 'C12')).toBe('B12+C11');
  });

  it('RAZEM column: horizontal SUM for flow rows, direct ref for cumulative, ratio for margin %', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Budżet')!;
    expect(formulaOf(ws, 'N2')).toBe('SUM(B2:M2)');
    expect(formulaOf(ws, 'N12')).toBe('M12');
    expect(formulaOf(ws, 'N13')).toBe('N11/N2');
  });

  it('Podsumowanie sheet pulls annual KPIs from the Budżet RAZEM column via cross-sheet formulas', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const sum = (await load(buf)).getWorksheet('Podsumowanie')!;
    expect(formulaOf(sum, 'B2')).toBe("'Budżet'!N2");
    expect(formulaOf(sum, 'B3')).toBe("'Budżet'!N10");
    expect(formulaOf(sum, 'B4')).toBe("'Budżet'!N11");
    expect(formulaOf(sum, 'B5')).toBe("'Budżet'!N13");
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(8);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B3').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

describe('operatingBudget — (b) math verification — evaluated workbook == independent JS model', () => {
  it('Revenue / Total cost / Result / Cumulative / Margin% match the reference model, every month', async () => {
    for (const params of [BUDGET_PARAMS_A, BUDGET_PARAMS_B]) {
      const full: Required<OperatingBudgetParams> = { ...BUDGET_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildOperatingBudgetSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceBudget(full);
      for (let m = 0; m < 12; m++) {
        const col = MONTH_COLS[m];
        expect(ev.cellValue('Budżet', `${col}${BUDGET_ROW.revenue}`)).toBeCloseTo(
          ref[m].revenue,
          4
        );
        expect(ev.cellValue('Budżet', `${col}${BUDGET_ROW.totalCost}`)).toBeCloseTo(
          ref[m].totalCost,
          4
        );
        expect(ev.cellValue('Budżet', `${col}${BUDGET_ROW.result}`)).toBeCloseTo(ref[m].result, 4);
        expect(ev.cellValue('Budżet', `${col}${BUDGET_ROW.cum}`)).toBeCloseTo(ref[m].cum, 4);
        expect(ev.cellValue('Budżet', `${col}${BUDGET_ROW.marginPct}`)).toBeCloseTo(
          ref[m].marginPct,
          8
        );
      }
    }
  });

  it('RAZEM (annual) column and Podsumowanie sheet match the reference model annual totals', async () => {
    const wb = await load(await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A)));
    const ev = makeEvaluator(wb);
    const ref = referenceBudget(BUDGET_PARAMS_A);
    const annualRevenue = ref.reduce((s, m) => s + m.revenue, 0);
    const annualTotalCost = ref.reduce((s, m) => s + m.totalCost, 0);
    const annualResult = ref.reduce((s, m) => s + m.result, 0);
    const annualMargin = annualResult / annualRevenue;

    expect(ev.cellValue('Budżet', 'N2')).toBeCloseTo(annualRevenue, 4);
    expect(ev.cellValue('Budżet', 'N10')).toBeCloseTo(annualTotalCost, 4);
    expect(ev.cellValue('Budżet', 'N11')).toBeCloseTo(annualResult, 4);
    expect(ev.cellValue('Budżet', 'N13')).toBeCloseTo(annualMargin, 8);

    expect(ev.cellValue('Podsumowanie', 'B2')).toBeCloseTo(annualRevenue, 4);
    expect(ev.cellValue('Podsumowanie', 'B4')).toBeCloseTo(annualResult, 4);
  });
});

describe('operatingBudget — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + both param sets)', () => {
    for (const p of [undefined, BUDGET_PARAMS_A, BUDGET_PARAMS_B]) {
      const report = critiqueWorkbook(buildOperatingBudgetSchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// dcfValuation — fixtures + reference model
// ---------------------------------------------------------------------------

const DCF_PARAMS_A: Required<DcfValuationParams> = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  valuationYear: 2026,
  fcf0: 2_000_000,
  fcfGrowthPct: 0.07,
  waccPct: 0.11,
  terminalGrowthPct: 0.025,
  horizonYears: 5,
  netDebt: 500_000,
  sharesOutstanding: 2_000_000,
};

const DCF_PARAMS_B: DcfValuationParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  valuationYear: 2028,
  fcf0: 10_000_000,
  fcfGrowthPct: 0.04,
  waccPct: 0.09,
  terminalGrowthPct: 0.02,
  horizonYears: 8,
  netDebt: -1_000_000, // net cash position
  sharesOutstanding: 5_000_000,
};

function referenceDcf(p: Required<DcfValuationParams>) {
  const rows: Array<{ fcf: number; df: number; pv: number }> = [];
  let prevFcf = 0;
  for (let n = 1; n <= p.horizonYears; n++) {
    const fcf = n === 1 ? p.fcf0 * (1 + p.fcfGrowthPct) : prevFcf * (1 + p.fcfGrowthPct);
    const df = 1 / Math.pow(1 + p.waccPct, n);
    rows.push({ fcf, df, pv: fcf * df });
    prevFcf = fcf;
  }
  const sumPv = rows.reduce((s, r) => s + r.pv, 0);
  const lastFcf = rows[rows.length - 1].fcf;
  const tv = (lastFcf * (1 + p.terminalGrowthPct)) / (p.waccPct - p.terminalGrowthPct);
  const pvTv = tv / Math.pow(1 + p.waccPct, p.horizonYears);
  const ev = sumPv + pvTv;
  const equity = ev - p.netDebt;
  const perShare = equity / p.sharesOutstanding;
  return { rows, sumPv, tv, pvTv, ev, equity, perShare };
}

const WR = { sumPv: 2, tv: 3, pvTv: 4, ev: 5, netDebt: 6, equity: 7, shares: 8, perShare: 9 };

describe('dcfValuation — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every Projekcja FCF cell (FCF / discount factor / PV, all years) is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(DCF_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Projekcja FCF')!;
    for (let n = 1; n <= DCF_PARAMS_A.horizonYears; n++) {
      const col = String.fromCharCode(65 + n); // B, C, D, ...
      for (let r = 2; r <= 4; r++) {
        const f = formulaOf(ws, `${col}${r}`);
        expect(f, `${col}${r} should be a formula`).toBeTruthy();
      }
    }
  });

  it('FCF chain: Year1 references FCF0 + growth; Year2 references Year1 + growth', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(DCF_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Projekcja FCF')!;
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2*(1+'Założenia'!$B$3)");
    expect(formulaOf(ws, 'C2')).toBe("B2*(1+'Założenia'!$B$3)");
  });

  it('discount factor uses ^n and PV = FCF * discount factor', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(DCF_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Projekcja FCF')!;
    expect(formulaOf(ws, 'B3')).toBe("1/(1+'Założenia'!$B$4)^1");
    expect(formulaOf(ws, 'C3')).toBe("1/(1+'Założenia'!$B$4)^2");
    expect(formulaOf(ws, 'B4')).toBe('B2*B3');
  });

  it('Wycena sheet: every metric cell is a formula, EV/Equity/perShare chain correctly', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(DCF_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Wycena')!;
    for (let r = 2; r <= 9; r++) {
      expect(formulaOf(ws, `B${r}`), `B${r} should be a formula`).toBeTruthy();
    }
    const lastCol = String.fromCharCode(65 + DCF_PARAMS_A.horizonYears);
    expect(formulaOf(ws, `B${WR.sumPv}`)).toBe(`SUM('Projekcja FCF'!B4:${lastCol}4)`);
    expect(formulaOf(ws, `B${WR.ev}`)).toBe(`B${WR.sumPv}+B${WR.pvTv}`);
    expect(formulaOf(ws, `B${WR.equity}`)).toBe(`B${WR.ev}-B${WR.netDebt}`);
    expect(formulaOf(ws, `B${WR.perShare}`)).toBe(`B${WR.equity}/B${WR.shares}`);
    // Net debt + shares are pure Assumptions refs, never duplicated as raw constants.
    expect(formulaOf(ws, `B${WR.netDebt}`)).toBe("'Założenia'!$B$6");
    expect(formulaOf(ws, `B${WR.shares}`)).toBe("'Założenia'!$B$7");
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(DCF_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(7);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B3').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

describe('dcfValuation — (b) math verification — evaluated workbook == independent JS model', () => {
  it('FCF / PV per year, Sum PV, Terminal Value, EV, Equity Value, Value/share all match', async () => {
    for (const params of [DCF_PARAMS_A, DCF_PARAMS_B]) {
      const full: Required<DcfValuationParams> = { ...DCF_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildDcfValuationSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceDcf(full);

      for (let n = 1; n <= full.horizonYears; n++) {
        const col = String.fromCharCode(65 + n);
        expect(ev.cellValue('Projekcja FCF', `${col}2`)).toBeCloseTo(ref.rows[n - 1].fcf, 2);
        expect(ev.cellValue('Projekcja FCF', `${col}4`)).toBeCloseTo(ref.rows[n - 1].pv, 2);
      }

      expect(ev.cellValue('Wycena', `B${WR.sumPv}`)).toBeCloseTo(ref.sumPv, 2);
      expect(ev.cellValue('Wycena', `B${WR.tv}`)).toBeCloseTo(ref.tv, 2);
      expect(ev.cellValue('Wycena', `B${WR.pvTv}`)).toBeCloseTo(ref.pvTv, 2);
      expect(ev.cellValue('Wycena', `B${WR.ev}`)).toBeCloseTo(ref.ev, 2);
      expect(ev.cellValue('Wycena', `B${WR.equity}`)).toBeCloseTo(ref.equity, 2);
      expect(ev.cellValue('Wycena', `B${WR.perShare}`)).toBeCloseTo(ref.perShare, 4);
    }
  });

  it('different horizonYears produce a differently-shaped, still internally-consistent model', async () => {
    const short = { ...DCF_PARAMS_A, horizonYears: 3 };
    const long = { ...DCF_PARAMS_A, horizonYears: 10 };
    const wbShort = await load(await buildWorkbookBuffer(buildDcfValuationSchema(short)));
    const wbLong = await load(await buildWorkbookBuffer(buildDcfValuationSchema(long)));
    expect(wbShort.getWorksheet('Projekcja FCF')!.columnCount).toBe(4); // pozycja + 3 years
    expect(wbLong.getWorksheet('Projekcja FCF')!.columnCount).toBe(11); // pozycja + 10 years
    const evS = makeEvaluator(wbShort);
    const evL = makeEvaluator(wbLong);
    const refS = referenceDcf(short);
    const refL = referenceDcf(long);
    expect(evS.cellValue('Wycena', `B${WR.ev}`)).toBeCloseTo(refS.ev, 2);
    expect(evL.cellValue('Wycena', `B${WR.ev}`)).toBeCloseTo(refL.ev, 2);
  });

  it('defensive WACC/terminal-growth nudge: WACC ≤ g never ships a schema that divides by ≤0', () => {
    const degenerate = buildDcfValuationSchema({ waccPct: 0.02, terminalGrowthPct: 0.05 });
    const zws = degenerate.sheets.find((s) => s.name === 'Założenia')!;
    const wacc = zws.rows[2].cells.wartosc.value as number; // row idx2 = AR.wacc (Excel row 4)
    const g = zws.rows[3].cells.wartosc.value as number; // row idx3 = AR.terminalGrowth (Excel row 5)
    expect(wacc).toBeGreaterThan(g);
  });
});

describe('dcfValuation — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + both param sets)', () => {
    for (const p of [undefined, DCF_PARAMS_A, DCF_PARAMS_B]) {
      const report = critiqueWorkbook(buildDcfValuationSchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Artifact — write real example .xlsx files to the scratchpad for manual
// inspection. (Non-assertive; guarded so a read-only FS never fails the suite.)
// ---------------------------------------------------------------------------

describe('artifact — example .xlsx to scratchpad', () => {
  it('writes operatingBudget + dcfValuation examples', async () => {
    const scratch =
      '/private/tmp/claude-501/-Users-piotrwisniewski-Library-Mobile-Documents-com-apple-CloudDocs-Documents-Antygracity-DRD-consultify/56ebe1ab-d00c-4750-9c0b-08e4ca80c7ab/scratchpad';
    const budgetBuf = await buildWorkbookBuffer(buildOperatingBudgetSchema(BUDGET_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: BUDGET_PARAMS_A.companyName, source: 'operatingBudget template' },
    });
    const dcfBuf = await buildWorkbookBuffer(buildDcfValuationSchema(DCF_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: DCF_PARAMS_A.companyName, source: 'dcfValuation template' },
    });
    try {
      await fs.writeFile(path.join(scratch, 'budzet_operacyjny_szablon.xlsx'), budgetBuf);
      await fs.writeFile(path.join(scratch, 'wycena_dcf_szablon.xlsx'), dcfBuf);
      expect(true).toBe(true);
    } catch {
      // scratchpad may not be writable in CI — the files are a convenience, not a gate.
      expect(budgetBuf.length).toBeGreaterThan(3000);
      expect(dcfBuf.length).toBeGreaterThan(3000);
    }
  });
});
