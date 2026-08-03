// @vitest-environment node
/**
 * Anti-false-green tests for the TWO NEWEST model templates added to the
 * workbook registry: `breakEven` (break-even / BEP analysis) and
 * `cashflow12m` (12-month cash-flow forecast). Mirrors the proof structure of
 * newTemplates.test.ts (which covers operatingBudget + dcfValuation):
 *
 *   (0) registry     — both ids are listed, reachable via buildFromTemplate /
 *                       buildFromTemplateFlat, and default output validates
 *                       against the canonical WorkbookSchema with ≥1 real
 *                       formula cell.
 *   (a) read-back     — real .xlsx built via buildWorkbookBuffer(); line items
 *                       are FORMULAS (never magic-numbers), chained
 *                       month↔month, cross-referencing the Assumptions sheet.
 *   (b) math verify   — an independent JS model computes the expected values;
 *                       a self-contained formula evaluator resolves the ACTUAL
 *                       workbook formula graph (supports add/sub/mul/div,
 *                       SUM ranges, same-sheet + cross-sheet refs) and the two
 *                       must agree.
 *   (c) quality gate  — critiqueWorkbook → score 100 / passed / 0 issues.
 *
 * NOTE on `=` prefix: per this codebase's convention (see threeScenarioPnL.ts
 * header comment + WorkbookBuilder.ts sanitizeFormula), `Cell.formula` strings
 * carry NO leading `=` — the builder writes them verbatim into the worksheet
 * XML `<f>` element, which must be `=`-free. So "formula presence" here is
 * asserted as "a non-empty formula string", consistent with every other test
 * in this suite.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { type BreakEvenParams, buildBreakEvenSchema } from '../templates/breakEven.js';
import { buildCashflow12mSchema, type Cashflow12mParams } from '../templates/cashflow12m.js';
import {
  buildFromTemplate,
  buildFromTemplateFlat,
  listWorkbookTemplates,
  WORKBOOK_TEMPLATES,
} from '../templates/index.js';
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
  schema: ReturnType<typeof buildBreakEvenSchema>
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
// superset of syntax both new templates emit: +, -, *, /, parentheses,
// SUM(range) (same-row OR same-col, same-sheet OR cross-sheet), bare numeric
// literals (e.g. formula "0"), and same-sheet / cross-sheet A1 refs (with $).
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
      if (ch === undefined) return 0; // empty tail (e.g. bare "0")
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

describe('registry — breakEven + cashflow12m are registered', () => {
  it('listWorkbookTemplates() contains both new templates alongside the earlier three', () => {
    const ids = listWorkbookTemplates().map((t) => t.id);
    expect(ids).toContain('breakEven');
    expect(ids).toContain('cashflow12m');
    expect(ids).toContain('threeScenarioPnL');
    expect(ids).toContain('operatingBudget');
    expect(ids).toContain('dcfValuation');
    // NOTE: length is a lower bound, not an exact count — the registry keeps growing
    // (see newTemplates3.test.ts for the exact-count assertion at the current total).
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it('WORKBOOK_TEMPLATES exposes both entries with id/build wired correctly', () => {
    expect(WORKBOOK_TEMPLATES.breakEven.id).toBe('breakEven');
    expect(WORKBOOK_TEMPLATES.breakEven.build).toBe(buildBreakEvenSchema);
    expect(WORKBOOK_TEMPLATES.cashflow12m.id).toBe('cashflow12m');
    expect(WORKBOOK_TEMPLATES.cashflow12m.build).toBe(buildCashflow12mSchema);
  });

  it('breakEven: buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('breakEven', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('cashflow12m: buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('cashflow12m', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('buildFromTemplate() also reaches both templates with native (non-flat) params', () => {
    expect(buildFromTemplate('breakEven', {})).not.toBeNull();
    expect(buildFromTemplate('cashflow12m', {})).not.toBeNull();
  });

  it('both templates pass the canonical WorkbookSchema validator (default params)', () => {
    const bep = buildBreakEvenSchema();
    const cf = buildCashflow12mSchema();
    expect(WorkbookSchemaValidator.safeParse(bep).success).toBe(true);
    expect(WorkbookSchemaValidator.safeParse(cf).success).toBe(true);
    expect(bep.sheets.map((s) => s.name)).toEqual([
      'Założenia',
      'Próg rentowności',
      'Analiza wrażliwości',
    ]);
    expect(cf.sheets.map((s) => s.name)).toEqual(['Założenia', 'Przepływy', 'Podsumowanie']);
  });
});

// ---------------------------------------------------------------------------
// breakEven — fixtures + reference model
// ---------------------------------------------------------------------------

const BEP_PARAMS_A: Required<BreakEvenParams> = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  unitPrice: 150,
  variableCostPerUnit: 90,
  fixedCosts: 300_000,
  plannedVolume: 7_000,
};

const BEP_PARAMS_B: BreakEvenParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  unitPrice: 40,
  variableCostPerUnit: 25,
  fixedCosts: 120_000,
  plannedVolume: 9_000,
};

function referenceBreakEven(p: Required<BreakEvenParams>) {
  const margin = p.unitPrice - p.variableCostPerUnit;
  const bepVolume = p.fixedCosts / margin;
  const bepRevenue = bepVolume * p.unitPrice;
  const safetyUnits = p.plannedVolume - bepVolume;
  const safetyPct = safetyUnits / p.plannedVolume;
  const levels = [0.5, 0.75, 1, 1.25, 1.5, 2].map((mult) => {
    const volume = bepVolume * mult;
    const revenue = volume * p.unitPrice;
    const varCost = volume * p.variableCostPerUnit;
    const totalCost = varCost + p.fixedCosts;
    const result = revenue - totalCost;
    return { volume, revenue, varCost, totalCost, result };
  });
  return { margin, bepVolume, bepRevenue, safetyUnits, safetyPct, levels };
}

const BEP_ROW = {
  margin: 2,
  volume: 3,
  revenue: 4,
  plannedVolume: 5,
  safetyUnits: 6,
  safetyPct: 7,
};

describe('breakEven — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every "Próg rentowności" metric cell is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildBreakEvenSchema(BEP_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Próg rentowności')!;
    for (let r = 2; r <= 7; r++) {
      expect(formulaOf(ws, `B${r}`), `B${r} should be a formula`).toBeTruthy();
    }
  });

  it('margin, BEP volume, BEP revenue chain correctly and reference Assumptions', async () => {
    const buf = await buildWorkbookBuffer(buildBreakEvenSchema(BEP_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Próg rentowności')!;
    expect(formulaOf(ws, `B${BEP_ROW.margin}`)).toBe("'Założenia'!$B$2-'Założenia'!$B$3");
    expect(formulaOf(ws, `B${BEP_ROW.volume}`)).toBe(`'Założenia'!$B$4/B${BEP_ROW.margin}`);
    expect(formulaOf(ws, `B${BEP_ROW.revenue}`)).toBe(`B${BEP_ROW.volume}*'Założenia'!$B$2`);
  });

  it('margin of safety chains off BEP volume and planned volume', async () => {
    const buf = await buildWorkbookBuffer(buildBreakEvenSchema(BEP_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Próg rentowności')!;
    expect(formulaOf(ws, `B${BEP_ROW.plannedVolume}`)).toBe("'Założenia'!$B$5");
    expect(formulaOf(ws, `B${BEP_ROW.safetyUnits}`)).toBe(
      `B${BEP_ROW.plannedVolume}-B${BEP_ROW.volume}`
    );
    expect(formulaOf(ws, `B${BEP_ROW.safetyPct}`)).toBe(
      `B${BEP_ROW.safetyUnits}/B${BEP_ROW.plannedVolume}`
    );
  });

  it('Analiza wrażliwości sheet: every row is a formula chain off the BEP volume', async () => {
    const buf = await buildWorkbookBuffer(buildBreakEvenSchema(BEP_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Analiza wrażliwości')!;
    for (let r = 2; r <= 7; r++) {
      for (const col of ['B', 'C', 'D', 'E', 'F']) {
        expect(formulaOf(ws, `${col}${r}`), `${col}${r} should be a formula`).toBeTruthy();
      }
    }
    expect(formulaOf(ws, 'B4')).toBe("'Próg rentowności'!$B$3*1"); // 100% BEP row
    expect(formulaOf(ws, 'C4')).toBe("B4*'Założenia'!$B$2");
    expect(formulaOf(ws, 'D4')).toBe("B4*'Założenia'!$B$3");
    expect(formulaOf(ws, 'E4')).toBe("D4+'Założenia'!$B$4");
    expect(formulaOf(ws, 'F4')).toBe('C4-E4');
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildBreakEvenSchema(BEP_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(4);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B2').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

describe('breakEven — (b) math verification — evaluated workbook == independent JS model', () => {
  it('margin / BEP volume / BEP revenue / safety margin match the reference model', async () => {
    for (const params of [BEP_PARAMS_A, BEP_PARAMS_B]) {
      const full: Required<BreakEvenParams> = { ...BEP_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildBreakEvenSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceBreakEven(full);
      expect(ev.cellValue('Próg rentowności', `B${BEP_ROW.margin}`)).toBeCloseTo(ref.margin, 6);
      expect(ev.cellValue('Próg rentowności', `B${BEP_ROW.volume}`)).toBeCloseTo(ref.bepVolume, 6);
      expect(ev.cellValue('Próg rentowności', `B${BEP_ROW.revenue}`)).toBeCloseTo(
        ref.bepRevenue,
        4
      );
      expect(ev.cellValue('Próg rentowności', `B${BEP_ROW.safetyUnits}`)).toBeCloseTo(
        ref.safetyUnits,
        6
      );
      expect(ev.cellValue('Próg rentowności', `B${BEP_ROW.safetyPct}`)).toBeCloseTo(
        ref.safetyPct,
        8
      );
    }
  });

  it('sensitivity table (all 6 levels) matches the reference model', async () => {
    for (const params of [BEP_PARAMS_A, BEP_PARAMS_B]) {
      const full: Required<BreakEvenParams> = { ...BEP_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildBreakEvenSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceBreakEven(full);
      for (let idx = 0; idx < ref.levels.length; idx++) {
        const r = idx + 2;
        const lvl = ref.levels[idx];
        expect(ev.cellValue('Analiza wrażliwości', `B${r}`)).toBeCloseTo(lvl.volume, 4);
        expect(ev.cellValue('Analiza wrażliwości', `C${r}`)).toBeCloseTo(lvl.revenue, 4);
        expect(ev.cellValue('Analiza wrażliwości', `D${r}`)).toBeCloseTo(lvl.varCost, 4);
        expect(ev.cellValue('Analiza wrażliwości', `E${r}`)).toBeCloseTo(lvl.totalCost, 4);
        expect(ev.cellValue('Analiza wrażliwości', `F${r}`)).toBeCloseTo(lvl.result, 4);
      }
      // The "100% BEP" row (idx 2) must have a ~zero result (that's the whole point of BEP).
      expect(ev.cellValue('Analiza wrażliwości', 'F4')).toBeCloseTo(0, 6);
    }
  });

  it('defensive nudge: variableCostPerUnit >= unitPrice never ships a schema with a non-positive margin', () => {
    const degenerate = buildBreakEvenSchema({ unitPrice: 50, variableCostPerUnit: 80 });
    const zws = degenerate.sheets.find((s) => s.name === 'Założenia')!;
    const price = zws.rows[0].cells.wartosc.value as number;
    const varCost = zws.rows[1].cells.wartosc.value as number;
    expect(price).toBeGreaterThan(varCost);
  });
});

describe('breakEven — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + both param sets)', () => {
    for (const p of [undefined, BEP_PARAMS_A, BEP_PARAMS_B]) {
      const report = critiqueWorkbook(buildBreakEvenSchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// cashflow12m — fixtures + reference model
// ---------------------------------------------------------------------------

const CF_PARAMS_A: Required<Cashflow12mParams> = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  startYear: 2026,
  openingBalance: 80_000,
  baseMonthlyRevenue: 180_000,
  monthlyRevenueGrowthPct: 0.025,
  paymentDelayMonths: 1,
  monthlyCosts: 140_000,
  costGrowthPct: 0.01,
};

const CF_PARAMS_B: Cashflow12mParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  startYear: 2028,
  openingBalance: -20_000, // an overdraft is a valid opening balance
  baseMonthlyRevenue: 400_000,
  monthlyRevenueGrowthPct: -0.01,
  paymentDelayMonths: 2,
  monthlyCosts: 350_000,
  costGrowthPct: 0.0,
};

const CF_PARAMS_C: Cashflow12mParams = {
  ...CF_PARAMS_A,
  companyName: 'ZeroDelay sp. z o.o.',
  paymentDelayMonths: 0,
};

interface CfMonth {
  revenue: number;
  inflow: number;
  costs: number;
  net: number;
  balance: number;
}

function referenceCashflow(p: Required<Cashflow12mParams>): CfMonth[] {
  const revenue: number[] = [];
  const costs: number[] = [];
  let prevRevenue = 0;
  let prevCosts = 0;
  for (let m = 0; m < 12; m++) {
    const rev = m === 0 ? p.baseMonthlyRevenue : prevRevenue * (1 + p.monthlyRevenueGrowthPct);
    const cost = m === 0 ? p.monthlyCosts : prevCosts * (1 + p.costGrowthPct);
    revenue.push(rev);
    costs.push(cost);
    prevRevenue = rev;
    prevCosts = cost;
  }

  const out: CfMonth[] = [];
  let balance = 0;
  for (let m = 0; m < 12; m++) {
    const source = m - p.paymentDelayMonths;
    const inflow = source < 0 ? 0 : revenue[source];
    const net = inflow - costs[m];
    balance = m === 0 ? p.openingBalance + net : balance + net;
    out.push({ revenue: revenue[m], inflow, costs: costs[m], net, balance });
  }
  return out;
}

const MONTH_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const CF_ROW = { revenue: 2, inflow: 3, costs: 4, net: 5, balance: 6 };

describe('cashflow12m — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every Przepływy line item cell (12 months + RAZEM) is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    for (const col of [...MONTH_COLS, 'N']) {
      for (let r = 2; r <= 6; r++) {
        const f = formulaOf(ws, `${col}${r}`);
        expect(f, `${col}${r} should be a formula`).toBeTruthy();
      }
    }
  });

  it('revenue chain: m1 references Assumptions, m2 references m1 + growth assumption', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$3");
    expect(formulaOf(ws, 'C2')).toBe("B2*(1+'Założenia'!$B$4)");
  });

  it('wpływy (inflow) row lags revenue by paymentDelayMonths, "0" for months before month 1', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A)); // delay = 1
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, 'B3')).toBe('0'); // month 1, source month 0 doesn't exist
    expect(formulaOf(ws, 'C3')).toBe('B2'); // month 2 collects month-1 revenue
    expect(formulaOf(ws, 'D3')).toBe('C2');
  });

  it("paymentDelayMonths = 0 collects the SAME month's revenue immediately", async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_C));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, 'B3')).toBe('B2');
    expect(formulaOf(ws, 'C3')).toBe('C2');
  });

  it('costs chain + net flow (arithmetic, not SUM) + cumulative balance chain', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, 'B4')).toBe("'Założenia'!$B$6"); // Koszty m1
    expect(formulaOf(ws, 'C4')).toBe("B4*(1+'Założenia'!$B$7)");
    expect(formulaOf(ws, 'B5')).toBe('B3-B4'); // Przepływ netto
    expect(formulaOf(ws, 'B6')).toBe("'Założenia'!$B$2+B5"); // Saldo narastające m1
    expect(formulaOf(ws, 'C6')).toBe('B6+C5');
  });

  it('RAZEM column: horizontal SUM for flow rows, direct ref for cumulative balance', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, 'N2')).toBe('SUM(B2:M2)');
    expect(formulaOf(ws, 'N3')).toBe('SUM(B3:M3)');
    expect(formulaOf(ws, 'N4')).toBe('SUM(B4:M4)');
    expect(formulaOf(ws, 'N5')).toBe('SUM(B5:M5)');
    expect(formulaOf(ws, 'N6')).toBe('M6');
  });

  it('Podsumowanie sheet pulls annual KPIs from the Przepływy RAZEM column via cross-sheet formulas', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A));
    const sum = (await load(buf)).getWorksheet('Podsumowanie')!;
    expect(formulaOf(sum, 'B2')).toBe("'Przepływy'!N3");
    expect(formulaOf(sum, 'B3')).toBe("'Przepływy'!N4");
    expect(formulaOf(sum, 'B4')).toBe("'Przepływy'!N5");
    expect(formulaOf(sum, 'B5')).toBe("'Przepływy'!N6");
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(6);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B4').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

describe('cashflow12m — (b) math verification — evaluated workbook == independent JS model', () => {
  it('Revenue / Wpływy / Koszty / Przepływ netto / Saldo match the reference model, every month', async () => {
    for (const params of [CF_PARAMS_A, CF_PARAMS_B, CF_PARAMS_C]) {
      const full: Required<Cashflow12mParams> = { ...CF_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildCashflow12mSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceCashflow(full);
      for (let m = 0; m < 12; m++) {
        const col = MONTH_COLS[m];
        expect(ev.cellValue('Przepływy', `${col}${CF_ROW.revenue}`)).toBeCloseTo(ref[m].revenue, 4);
        expect(ev.cellValue('Przepływy', `${col}${CF_ROW.inflow}`)).toBeCloseTo(ref[m].inflow, 4);
        expect(ev.cellValue('Przepływy', `${col}${CF_ROW.costs}`)).toBeCloseTo(ref[m].costs, 4);
        expect(ev.cellValue('Przepływy', `${col}${CF_ROW.net}`)).toBeCloseTo(ref[m].net, 4);
        expect(ev.cellValue('Przepływy', `${col}${CF_ROW.balance}`)).toBeCloseTo(ref[m].balance, 4);
      }
    }
  });

  it('RAZEM (annual) column and Podsumowanie sheet match the reference model annual totals', async () => {
    const wb = await load(await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A)));
    const ev = makeEvaluator(wb);
    const ref = referenceCashflow(CF_PARAMS_A);
    const annualInflow = ref.reduce((s, m) => s + m.inflow, 0);
    const annualCosts = ref.reduce((s, m) => s + m.costs, 0);
    const annualNet = ref.reduce((s, m) => s + m.net, 0);
    const finalBalance = ref[11].balance;

    expect(ev.cellValue('Przepływy', 'N3')).toBeCloseTo(annualInflow, 4);
    expect(ev.cellValue('Przepływy', 'N4')).toBeCloseTo(annualCosts, 4);
    expect(ev.cellValue('Przepływy', 'N5')).toBeCloseTo(annualNet, 4);
    expect(ev.cellValue('Przepływy', 'N6')).toBeCloseTo(finalBalance, 4);

    expect(ev.cellValue('Podsumowanie', 'B2')).toBeCloseTo(annualInflow, 4);
    expect(ev.cellValue('Podsumowanie', 'B5')).toBeCloseTo(finalBalance, 4);
  });

  it('paymentDelayMonths is clamped to 0..3 (defensive against out-of-range params)', () => {
    const tooHigh = buildCashflow12mSchema({ paymentDelayMonths: 99 });
    const tooLow = buildCashflow12mSchema({ paymentDelayMonths: -5 });
    expect(tooHigh.metadata?.paymentDelayMonths).toBe(3);
    expect(tooLow.metadata?.paymentDelayMonths).toBe(0);
  });
});

describe('cashflow12m — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + all param sets)', () => {
    for (const p of [undefined, CF_PARAMS_A, CF_PARAMS_B, CF_PARAMS_C]) {
      const report = critiqueWorkbook(buildCashflow12mSchema(p));
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
  it('writes breakEven + cashflow12m examples', async () => {
    const scratch =
      '/private/tmp/claude-501/-Users-piotrwisniewski-Library-Mobile-Documents-com-apple-CloudDocs-Documents-Antygracity-DRD-consultify/56ebe1ab-d00c-4750-9c0b-08e4ca80c7ab/scratchpad';
    const bepBuf = await buildWorkbookBuffer(buildBreakEvenSchema(BEP_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: BEP_PARAMS_A.companyName, source: 'breakEven template' },
    });
    const cfBuf = await buildWorkbookBuffer(buildCashflow12mSchema(CF_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: CF_PARAMS_A.companyName, source: 'cashflow12m template' },
    });
    try {
      await fs.writeFile(path.join(scratch, 'prog_rentownosci_szablon.xlsx'), bepBuf);
      await fs.writeFile(path.join(scratch, 'przeplywy_12m_szablon.xlsx'), cfBuf);
      expect(true).toBe(true);
    } catch {
      // scratchpad may not be writable in CI — the files are a convenience, not a gate.
      expect(bepBuf.length).toBeGreaterThan(3000);
      expect(cfBuf.length).toBeGreaterThan(3000);
    }
  });
});
