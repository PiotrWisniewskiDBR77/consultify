// @vitest-environment node
/**
 * Anti-false-green tests for the `projectViability` model template (N5,
 * 2026-07-27 night — CTO decision D2: NPV/IRR is the FIRST of the 3 missing
 * archetypes to be filled in, ahead of budget-vs-actual and variant
 * comparison, because "does this PROJECT pay off" is the most common
 * consulting question and the existing `dcfValuation` template values a
 * whole COMPANY, not a project).
 *
 * Mirrors the proof structure of newTemplates3.test.ts:
 *   (0) registry     — id is listed, reachable via buildFromTemplate /
 *                       buildFromTemplateFlat, default output validates
 *                       against the canonical WorkbookSchema.
 *   (a) read-back     — real .xlsx built via buildWorkbookBuffer(); every
 *                       populated engine/result cell is a FORMULA (never a
 *                       magic-number), chained year↔year, cross-referencing
 *                       the Assumptions sheet — including the NPV()/IRR()
 *                       calls themselves.
 *   (b) math verify   — an independent JS model computes the expected cash
 *                       flows/NPV/IRR/PI/payback; a self-contained formula
 *                       evaluator resolves the ACTUAL workbook formula graph
 *                       (extends the newTemplates3.test.ts evaluator with
 *                       MAX/NPV/IRR/COUNTIF) and the two must agree. Also a
 *                       plain-English sanity check: NPV > 0 and IRR > the
 *                       discount rate for the default assumptions (a project
 *                       a consultant would actually recommend).
 *   (c) quality gate  — critiqueWorkbook → score 100 / passed / 0 issues.
 *   (d) font-color    — D3 (WorkbookBuilder convention): blue font on
 *                       Assumptions inputs, black on local (same-sheet)
 *                       formulas, green on cross-sheet formulas. Exercised
 *                       here since this template touches all three cases.
 *
 * NOTE on `=` prefix: per this codebase's convention, `Cell.formula` strings
 * carry NO leading `=` — "formula presence" is asserted as "a non-empty
 * formula string".
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import {
  buildFromTemplate,
  buildFromTemplateFlat,
  listWorkbookTemplates,
  WORKBOOK_TEMPLATES,
} from '../templates/index.js';
import {
  buildProjectViabilitySchema,
  type ProjectViabilityParams,
} from '../templates/projectViability.js';
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

/** Font color ARGB of a cell (e.g. 'FF0000FF' for blue), or null when unset. */
function fontArgbOf(ws: ExcelJS.Worksheet, addr: string): string | null {
  const font: any = ws.getCell(addr).font;
  return font?.color?.argb ?? null;
}

/** Every populated cell (any row) across the whole workbook schema. */
function allCells(
  schema: ReturnType<typeof buildProjectViabilitySchema>
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
// Self-contained formula evaluator over the ACTUAL workbook. Extends the
// newTemplates3.test.ts evaluator (+, -, *, /, ^, parens, SUM(range), refs)
// with MAX(...), NPV(rate, ...), IRR(range[, guess]) and COUNTIF(range, "op N")
// — the four functions this template's formulas actually use.
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
    let out = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  }

  function collectRange(sheet: string, c1: string, r1: number, c2: string, r2: number): number[] {
    const ci1 = colLetterToIndex(c1);
    const ci2 = colLetterToIndex(c2);
    const [colFrom, colTo] = ci1 <= ci2 ? [ci1, ci2] : [ci2, ci1];
    const [rowFrom, rowTo] = r1 <= r2 ? [r1, r2] : [r2, r1];
    const out: number[] = [];
    for (let c = colFrom; c <= colTo; c++) {
      for (let r = rowFrom; r <= rowTo; r++) {
        out.push(cellValue(sheet, `${colIndexToLetter(c)}${r}`));
      }
    }
    return out;
  }

  function sumRange(sheet: string, c1: string, r1: number, c2: string, r2: number): number {
    return collectRange(sheet, c1, r1, c2, r2).reduce((a, b) => a + b, 0);
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
        const exp = parsePower();
        return Math.pow(base, exp);
      }
      return base;
    }

    function parseFactor(): number {
      skipWs();
      const ch = peek();
      if (ch === undefined) return 0;
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
            total += sumGenericArg();
            skipWs();
            while (peek() === ',') {
              i++;
              total += sumGenericArg();
              skipWs();
            }
            if (peek() === ')') i++;
            return total;
          }
          if (ident === 'MAX') {
            let vals: number[] = [...parseGenericArg()];
            skipWs();
            while (peek() === ',') {
              i++;
              vals = vals.concat(parseGenericArg());
              skipWs();
            }
            if (peek() === ')') i++;
            return Math.max(...vals);
          }
          if (ident === 'NPV') {
            const rate = parseGenericArg()[0];
            skipWs();
            let periods: number[] = [];
            while (peek() === ',') {
              i++;
              periods = periods.concat(parseGenericArg());
              skipWs();
            }
            if (peek() === ')') i++;
            let total = 0;
            periods.forEach((v, idx) => {
              total += v / Math.pow(1 + rate, idx + 1);
            });
            return total;
          }
          if (ident === 'IRR') {
            const series = parseGenericArg();
            skipWs();
            let guess = 0.1;
            if (peek() === ',') {
              i++;
              guess = parseGenericArg()[0];
              skipWs();
            }
            if (peek() === ')') i++;
            const npvAt = (r: number) =>
              series.reduce((acc, v, idx) => acc + v / Math.pow(1 + r, idx), 0);
            const dnpvAt = (r: number) =>
              series.reduce(
                (acc, v, idx) => (idx === 0 ? acc : acc - (idx * v) / Math.pow(1 + r, idx + 1)),
                0
              );
            let rate = guess;
            for (let iter = 0; iter < 200; iter++) {
              const f = npvAt(rate);
              const fp = dnpvAt(rate);
              if (Math.abs(fp) < 1e-12) break;
              const next = rate - f / fp;
              if (!Number.isFinite(next)) break;
              const converged = Math.abs(next - rate) < 1e-10;
              rate = next;
              if (converged) break;
            }
            return rate;
          }
          if (ident === 'COUNTIF') {
            const rangeVals = parseGenericArg();
            skipWs();
            if (peek() !== ',') throw new Error(`COUNTIF missing criteria in ${formula}`);
            i++;
            skipWs();
            if (peek() !== '"') throw new Error(`COUNTIF expects quoted criteria in ${formula}`);
            i++;
            const critStart = i;
            while (i < s.length && s[i] !== '"') i++;
            const criteria = s.slice(critStart, i);
            i++; // closing quote
            skipWs();
            if (peek() === ')') i++;
            const m = /^(<=|>=|<>|<|>|=)?\s*(-?\d+\.?\d*)$/.exec(criteria.trim());
            if (!m) throw new Error(`unsupported COUNTIF criteria "${criteria}" in ${formula}`);
            const op = m[1] || '=';
            const threshold = parseFloat(m[2]);
            const cmp = (v: number) => {
              switch (op) {
                case '<':
                  return v < threshold;
                case '<=':
                  return v <= threshold;
                case '>':
                  return v > threshold;
                case '>=':
                  return v >= threshold;
                case '<>':
                  return v !== threshold;
                default:
                  return v === threshold;
              }
            };
            return rangeVals.filter(cmp).length;
          }
          throw new Error(`unsupported fn ${ident} in ${formula}`);
        }
        i = start; // not a function call — back up, let the ref path handle it
      }
      return parseRef();
    }

    /** A generic SUM(...) argument summed directly: range or scalar expression. */
    function sumGenericArg(): number {
      return parseGenericArg().reduce((a, b) => a + b, 0);
    }

    /** A generic function argument: a range → its ordered values; anything
     *  else → a single-element array from the full expression parser. */
    function parseGenericArg(): number[] {
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
        return [parseExpression()];
      }
      i += m1[0].length;
      skipWs();
      if (peek() === ':') {
        i++;
        skipWs();
        const m2 = /^\$?([A-Z]+)\$?(\d+)/.exec(s.slice(i));
        if (!m2) throw new Error(`bad range end in ${formula}`);
        i += m2[0].length;
        return collectRange(sheet, m1[1], parseInt(m1[2], 10), m2[1], parseInt(m2[2], 10));
      }
      skipWs();
      if (peek() === ',' || peek() === ')') {
        return [cellValue(sheet, `${m1[1]}${m1[2]}`)];
      }
      i = restoreIdx;
      return [parseExpression()];
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
// (0) registry
// ---------------------------------------------------------------------------

describe('registry — projectViability is registered', () => {
  it('listWorkbookTemplates() contains it alongside the earlier seven', () => {
    const ids = listWorkbookTemplates().map((t) => t.id);
    expect(ids).toContain('projectViability');
    expect(ids).toContain('threeScenarioPnL');
    expect(ids).toContain('dcfValuation');
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });

  it('WORKBOOK_TEMPLATES exposes the entry with id/build wired correctly', () => {
    expect(WORKBOOK_TEMPLATES.projectViability.id).toBe('projectViability');
    expect(WORKBOOK_TEMPLATES.projectViability.build).toBe(buildProjectViabilitySchema);
  });

  it('buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('projectViability', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('buildFromTemplate() also reaches the template with native (non-flat) params', () => {
    expect(buildFromTemplate('projectViability', {})).not.toBeNull();
  });

  it('passes the canonical WorkbookSchema validator (default params) with the expected 4 sheets', () => {
    const pv = buildProjectViabilitySchema();
    expect(WorkbookSchemaValidator.safeParse(pv).success).toBe(true);
    expect(pv.sheets.map((s) => s.name)).toEqual([
      'Założenia',
      'Przepływy',
      'Wyniki',
      'Wrażliwość',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Fixtures + independent JS reference model
// ---------------------------------------------------------------------------

const PV_PARAMS_A: Required<Omit<ProjectViabilityParams, 'currencyCode'>> & {
  currencyCode: 'PLN';
} = {
  projectName: 'Projekt Alfa',
  currencyCode: 'PLN',
  startYear: 2027,
  investment: 1_000_000,
  baseCashFlow: 350_000,
  cashFlowGrowthPct: 0.05,
  discountRatePct: 0.1,
  residualValue: 100_000,
  taxRatePct: 0.19,
  horizonYears: 5,
};

const PV_PARAMS_B: ProjectViabilityParams = {
  projectName: 'Globex Expansion Project',
  currencyCode: 'USD',
  startYear: 2028,
  investment: 2_000_000,
  baseCashFlow: 500_000,
  cashFlowGrowthPct: 0.03,
  discountRatePct: 0.12,
  residualValue: 0,
  taxRatePct: 0.21,
  horizonYears: 7,
};

interface ReferenceModel {
  gross: number[];
  tax: number[];
  net: number[];
  discFactor: number[];
  discounted: number[];
  cumUndiscounted: number[];
  cumDiscounted: number[];
  npv: number;
  irr: number;
  sumPvOperating: number;
  pi: number;
  paybackSimple: number;
  paybackDiscounted: number;
}

function referenceProjectViability(
  p: Required<Omit<ProjectViabilityParams, 'currencyCode'>>
): ReferenceModel {
  const N = p.horizonYears;
  const gross = new Array<number>(N + 1).fill(0);
  const tax = new Array<number>(N + 1).fill(0);
  const net = new Array<number>(N + 1).fill(0);
  const discFactor = new Array<number>(N + 1).fill(0);
  const discounted = new Array<number>(N + 1).fill(0);
  const cumUndiscounted = new Array<number>(N + 1).fill(0);
  const cumDiscounted = new Array<number>(N + 1).fill(0);

  net[0] = -p.investment;
  for (let n = 1; n <= N; n++) {
    gross[n] = n === 1 ? p.baseCashFlow : gross[n - 1] * (1 + p.cashFlowGrowthPct);
    tax[n] = Math.max(gross[n], 0) * p.taxRatePct;
    net[n] = gross[n] - tax[n] + (n === N ? p.residualValue : 0);
  }
  for (let n = 0; n <= N; n++) {
    discFactor[n] = 1 / Math.pow(1 + p.discountRatePct, n);
    discounted[n] = net[n] * discFactor[n];
    cumUndiscounted[n] = n === 0 ? net[n] : cumUndiscounted[n - 1] + net[n];
    cumDiscounted[n] = n === 0 ? discounted[n] : cumDiscounted[n - 1] + discounted[n];
  }

  const npv = cumDiscounted[N];

  const npvAt = (r: number) => net.reduce((acc, v, idx) => acc + v / Math.pow(1 + r, idx), 0);
  const dnpvAt = (r: number) =>
    net.reduce((acc, v, idx) => (idx === 0 ? acc : acc - (idx * v) / Math.pow(1 + r, idx + 1)), 0);
  let irr = 0.1;
  for (let iter = 0; iter < 200; iter++) {
    const f = npvAt(irr);
    const fp = dnpvAt(irr);
    if (Math.abs(fp) < 1e-12) break;
    const next = irr - f / fp;
    if (!Number.isFinite(next)) break;
    const converged = Math.abs(next - irr) < 1e-10;
    irr = next;
    if (converged) break;
  }

  const sumPvOperating = discounted.slice(1).reduce((a, b) => a + b, 0);
  const pi = sumPvOperating / p.investment;
  const paybackSimple = cumUndiscounted.slice(1).filter((v) => v < 0).length;
  const paybackDiscounted = cumDiscounted.slice(1).filter((v) => v < 0).length;

  return {
    gross,
    tax,
    net,
    discFactor,
    discounted,
    cumUndiscounted,
    cumDiscounted,
    npv,
    irr,
    sumPvOperating,
    pi,
    paybackSimple,
    paybackDiscounted,
  };
}

const YEAR_COLS_A = ['B', 'C', 'D', 'E', 'F', 'G']; // horizon=5 → years 0..5
const ENGINE_ROW = {
  gross: 2,
  tax: 3,
  net: 4,
  discountFactor: 5,
  discounted: 6,
  cumUndiscounted: 7,
  cumDiscounted: 8,
};
const WR = { npv: 2, irr: 3, sumPvOperating: 4, pi: 5, paybackSimple: 6, paybackDiscounted: 7 };

// ---------------------------------------------------------------------------
// (a) read-back — formulas, chained, cross-sheet
// ---------------------------------------------------------------------------

describe('projectViability — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every populated "Przepływy" cell is a FORMULA (gross/tax omitted at Year 0 by design)', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    for (let r = ENGINE_ROW.gross; r <= ENGINE_ROW.cumDiscounted; r++) {
      for (const col of YEAR_COLS_A) {
        if (col === 'B' && (r === ENGINE_ROW.gross || r === ENGINE_ROW.tax)) continue; // Year 0: no operating flow
        expect(formulaOf(ws, `${col}${r}`), `${col}${r} should be a formula`).toBeTruthy();
      }
    }
    // Year 0 gross/tax cells are genuinely EMPTY (no cell), not a "0" magic number.
    expect(ws.getCell(`B${ENGINE_ROW.gross}`).value).toBeNull();
    expect(ws.getCell(`B${ENGINE_ROW.tax}`).value).toBeNull();
  });

  it('gross cash-flow chain: Year1 = Assumptions CF1; Year(n>1) = prior * (1+growth)', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, `C${ENGINE_ROW.gross}`)).toBe("'Założenia'!$B$3");
    expect(formulaOf(ws, `D${ENGINE_ROW.gross}`)).toBe("C2*(1+'Założenia'!$B$4)");
    expect(formulaOf(ws, `E${ENGINE_ROW.gross}`)).toBe("D2*(1+'Założenia'!$B$4)");
  });

  it('net cash flow: Year0 = -Investment; middle years = gross-tax (no cross-sheet ref); last year adds residual', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, `B${ENGINE_ROW.net}`)).toBe("-'Założenia'!$B$2");
    expect(formulaOf(ws, `D${ENGINE_ROW.net}`)).toBe('D2-D3'); // Year 2 — purely same-sheet
    expect(formulaOf(ws, `G${ENGINE_ROW.net}`)).toBe("G2-G3+'Założenia'!$B$6"); // Year 5 (last) — + residual
  });

  it('discount factor / discounted flow / cumulative rows chain correctly', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    expect(formulaOf(ws, `B${ENGINE_ROW.discountFactor}`)).toBe("1/(1+'Założenia'!$B$5)^0");
    expect(formulaOf(ws, `C${ENGINE_ROW.discountFactor}`)).toBe("1/(1+'Założenia'!$B$5)^1");
    expect(formulaOf(ws, `C${ENGINE_ROW.discounted}`)).toBe('C4*C5');
    expect(formulaOf(ws, `B${ENGINE_ROW.cumUndiscounted}`)).toBe('B4');
    expect(formulaOf(ws, `C${ENGINE_ROW.cumUndiscounted}`)).toBe('B7+C4');
    expect(formulaOf(ws, `B${ENGINE_ROW.cumDiscounted}`)).toBe('B6');
    expect(formulaOf(ws, `C${ENGINE_ROW.cumDiscounted}`)).toBe('B8+C6');
  });

  it('"Wyniki" sheet: NPV/IRR/PI/payback are real formulas referencing "Przepływy" + "Założenia"', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Wyniki')!;
    expect(formulaOf(ws, `B${WR.npv}`)).toBe(
      "NPV('Założenia'!$B$5,'Przepływy'!C4:G4)+'Przepływy'!B4"
    );
    expect(formulaOf(ws, `B${WR.irr}`)).toBe("IRR('Przepływy'!B4:G4)");
    expect(formulaOf(ws, `B${WR.sumPvOperating}`)).toBe("SUM('Przepływy'!C6:G6)");
    expect(formulaOf(ws, `B${WR.pi}`)).toBe(`B${WR.sumPvOperating}/'Założenia'!$B$2`);
    expect(formulaOf(ws, `B${WR.paybackSimple}`)).toBe(`COUNTIF('Przepływy'!C7:G7,"<0")`);
    expect(formulaOf(ws, `B${WR.paybackDiscounted}`)).toBe(`COUNTIF('Przepływy'!C8:G8,"<0")`);
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(7);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B5').dataValidation; // discount rate
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });

  it('"Wrażliwość" sheet carries a real sensitivity grid (NPV formulas, not a static readout)', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Wrażliwość')!;
    // Anchor is B5 → corner at B5; column-input headers run C5.. (row 5);
    // row-input headers run B6.. (col B); first interior cell is C6.
    const interior = formulaOf(ws, 'C6');
    expect(interior).toBeTruthy();
    expect(interior).toContain("'Założenia'!$B$2"); // references the investment assumption
    expect(interior).toContain('C5'); // {col} substituted with the real column-header cell address
    expect(interior).toContain('B6'); // {row} substituted with the real row-header cell address
  });
});

// ---------------------------------------------------------------------------
// (b) math verification
// ---------------------------------------------------------------------------

describe('projectViability — (b) math verification — evaluated workbook == independent JS model', () => {
  it('engine rows (gross/tax/net/discount/discounted/cumulative) match the reference model, every year', async () => {
    for (const params of [PV_PARAMS_A, PV_PARAMS_B]) {
      const full: Required<Omit<ProjectViabilityParams, 'currencyCode'>> = {
        ...PV_PARAMS_A,
        ...params,
      } as any;
      const wb = await load(await buildWorkbookBuffer(buildProjectViabilitySchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceProjectViability(full);
      const cols = Array.from({ length: full.horizonYears + 1 }, (_, n) =>
        String.fromCharCode(66 + n)
      );
      for (let n = 0; n <= full.horizonYears; n++) {
        const col = cols[n];
        if (n >= 1) {
          expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.gross}`)).toBeCloseTo(
            ref.gross[n],
            4
          );
          expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.tax}`)).toBeCloseTo(ref.tax[n], 4);
        }
        expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.net}`)).toBeCloseTo(ref.net[n], 4);
        expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.discountFactor}`)).toBeCloseTo(
          ref.discFactor[n],
          8
        );
        expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.discounted}`)).toBeCloseTo(
          ref.discounted[n],
          4
        );
        expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.cumUndiscounted}`)).toBeCloseTo(
          ref.cumUndiscounted[n],
          4
        );
        expect(ev.cellValue('Przepływy', `${col}${ENGINE_ROW.cumDiscounted}`)).toBeCloseTo(
          ref.cumDiscounted[n],
          4
        );
      }
    }
  });

  it('NPV / IRR / PI / payback (simple + discounted) match the reference model', async () => {
    for (const params of [PV_PARAMS_A, PV_PARAMS_B]) {
      const full: Required<Omit<ProjectViabilityParams, 'currencyCode'>> = {
        ...PV_PARAMS_A,
        ...params,
      } as any;
      const wb = await load(await buildWorkbookBuffer(buildProjectViabilitySchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceProjectViability(full);
      expect(ev.cellValue('Wyniki', `B${WR.npv}`)).toBeCloseTo(ref.npv, 2);
      expect(ev.cellValue('Wyniki', `B${WR.irr}`)).toBeCloseTo(ref.irr, 6);
      expect(ev.cellValue('Wyniki', `B${WR.sumPvOperating}`)).toBeCloseTo(ref.sumPvOperating, 2);
      expect(ev.cellValue('Wyniki', `B${WR.pi}`)).toBeCloseTo(ref.pi, 6);
      expect(ev.cellValue('Wyniki', `B${WR.paybackSimple}`)).toBe(ref.paybackSimple);
      expect(ev.cellValue('Wyniki', `B${WR.paybackDiscounted}`)).toBe(ref.paybackDiscounted);
    }
  });

  it('changing the discount rate changes NPV (proof the model COMPUTES, not hardcodes)', async () => {
    const low = await load(
      await buildWorkbookBuffer(
        buildProjectViabilitySchema({ ...PV_PARAMS_A, discountRatePct: 0.05 })
      )
    );
    const high = await load(
      await buildWorkbookBuffer(
        buildProjectViabilitySchema({ ...PV_PARAMS_A, discountRatePct: 0.25 })
      )
    );
    const npvLow = makeEvaluator(low).cellValue('Wyniki', `B${WR.npv}`);
    const npvHigh = makeEvaluator(high).cellValue('Wyniki', `B${WR.npv}`);
    // Higher discount rate on the SAME cash flows must produce a LOWER NPV.
    expect(npvHigh).toBeLessThan(npvLow);
    expect(npvLow).not.toBeCloseTo(npvHigh, 0);
  });

  it('sanity check — default assumptions describe a project a consultant would recommend: NPV > 0 and IRR > discount rate', async () => {
    const wb = await load(await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A)));
    const ev = makeEvaluator(wb);
    const npv = ev.cellValue('Wyniki', `B${WR.npv}`);
    const irr = ev.cellValue('Wyniki', `B${WR.irr}`);
    const pi = ev.cellValue('Wyniki', `B${WR.pi}`);
    expect(npv).toBeGreaterThan(0);
    expect(irr).toBeGreaterThan(PV_PARAMS_A.discountRatePct);
    expect(pi).toBeGreaterThan(1);
    // Reference values for the documented default assumptions (1M zł CAPEX,
    // 350k zł Year-1 CF @ 5% growth, 10% discount, 19% tax, 100k residual,
    // 5-year horizon) — recorded so a future change to the math is visible.
    expect(npv).toBeCloseTo(238_866, -3);
    expect(irr).toBeGreaterThan(0.17);
    expect(irr).toBeLessThan(0.2);
  });

  it('horizonYears is clamped to 3..15 (defensive against out-of-range params)', () => {
    const tooHigh = buildProjectViabilitySchema({ horizonYears: 999 });
    const tooLow = buildProjectViabilitySchema({ horizonYears: 1 });
    expect(tooHigh.metadata?.horizonYears).toBe(15);
    expect(tooLow.metadata?.horizonYears).toBe(3);
  });

  it('discountRatePct is nudged away from 0 (would #DIV/0!-adjacent in the discount factor)', () => {
    const zeroRate = buildProjectViabilitySchema({ discountRatePct: -5 });
    expect(zeroRate.metadata?.discountRatePct).toBeGreaterThan(0);
  });

  it('investment falls back to a safe positive default when given 0/negative', () => {
    const zero = buildProjectViabilitySchema({ investment: 0 });
    const negative = buildProjectViabilitySchema({ investment: -100 });
    expect(zero.metadata?.investment).toBeGreaterThan(0);
    expect(negative.metadata?.investment).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// (c) quality gate
// ---------------------------------------------------------------------------

describe('projectViability — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + both param sets)', () => {
    for (const p of [undefined, PV_PARAMS_A, PV_PARAMS_B]) {
      const report = critiqueWorkbook(buildProjectViabilitySchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// (d) D3 — financial-model font-color convention (WorkbookBuilder-level,
// exercised here since this template has all 3 cases side by side).
// ---------------------------------------------------------------------------

describe('projectViability — (d) font-color convention — blue input / black formula / green cross-sheet', () => {
  it('an Assumptions input cell (literal value) gets the BLUE font', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Założenia')!;
    expect(fontArgbOf(ws, 'B2')).toBe('FF0000FF'); // investment input
  });

  it('a LOCAL (same-sheet) formula cell gets the BLACK font', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    // D4 = net cash flow, Year 2 = "D2-D3" — no cross-sheet reference at all.
    expect(formulaOf(ws, `D${ENGINE_ROW.net}`)).toBe('D2-D3');
    expect(fontArgbOf(ws, `D${ENGINE_ROW.net}`)).toBe('FF000000');
  });

  it('a CROSS-SHEET formula cell gets the GREEN font', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Przepływy')!;
    // B4 = net cash flow, Year 0 = "-'Założenia'!$B$2" — reaches into Założenia.
    expect(formulaOf(ws, `B${ENGINE_ROW.net}`)).toBe("-'Założenia'!$B$2");
    expect(fontArgbOf(ws, `B${ENGINE_ROW.net}`)).toBe('FF008000');
  });

  it('the NPV cell (cross-sheet) also gets the GREEN font on the Wyniki sheet', async () => {
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Wyniki')!;
    expect(fontArgbOf(ws, `B${WR.npv}`)).toBe('FF008000');
  });

  it('an explicit schema fontColor always wins over the automatic convention', async () => {
    const schema = buildProjectViabilitySchema(PV_PARAMS_A);
    const zSheet = schema.sheets.find((s) => s.name === 'Założenia')!;
    zSheet.rows[0].cells.wartosc.style = {
      ...zSheet.rows[0].cells.wartosc.style,
      fontColor: 'FF00FF',
    };
    const buf = await buildWorkbookBuffer(schema, { applyConsultantStyling: true });
    const ws = (await load(buf)).getWorksheet('Założenia')!;
    expect(fontArgbOf(ws, 'B2')).toBe('FFFF00FF'); // explicit magenta, NOT the automatic blue
  });
});

// ---------------------------------------------------------------------------
// Artifact — write a real example .xlsx to the scratchpad for manual
// inspection. (Non-assertive; guarded so a read-only FS never fails the suite.)
// ---------------------------------------------------------------------------

describe('artifact — example .xlsx to scratchpad', () => {
  it('writes a projectViability example', async () => {
    const scratch =
      '/private/tmp/claude-501/-Users-piotrwisniewski-Library-Mobile-Documents-com-apple-CloudDocs-Documents-Antygracity-DRD-consultify/d18b5af2-28b1-4570-8d6b-a46f6580adff/scratchpad';
    const buf = await buildWorkbookBuffer(buildProjectViabilitySchema(PV_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: PV_PARAMS_A.projectName, source: 'projectViability template' },
    });
    try {
      await fs.writeFile(path.join(scratch, 'ocena_oplacalnosci_projektu_szablon.xlsx'), buf);
      expect(true).toBe(true);
    } catch {
      expect(buf.length).toBeGreaterThan(3000);
    }
  });
});
