// @vitest-environment node
/**
 * Anti-false-green tests for the DCF (Discounted Cash Flow) valuation template.
 *
 * Every assertion targets a REAL .xlsx built by buildWorkbookBuffer() and read
 * back via ExcelJS — no assertion trusts the in-memory schema alone. The core
 * leg is MATH VERIFICATION: an independent JS DCF model computes the expected
 * FCF / discount factors / PV / terminal value / enterprise value / equity
 * value straight from the drivers; a self-contained formula evaluator resolves
 * the ACTUAL workbook formula graph (no cached values) and the two must agree to
 * the grosz. This catches a wrong sign / wrong ref / wrong exponent in the
 * discount-factor or Gordon terminal-value formula.
 *
 * Proof legs:
 *   (schema) validates against the canonical validator.
 *   (a) read-back: DCF/Valuation cells are FORMULAS, chained, cross-sheet.
 *   (b) MATH: evaluated workbook == independent JS DCF model (grosz tolerance).
 *   (c) critic: critiqueWorkbook → passed (report score/issues surfaced).
 *   (d) parametrization + anti-false-green: breaking the TV / discount-factor
 *       formula makes the math leg FAIL (proven by a mutated-schema check).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator, type WorkbookSchema } from '../WorkbookSchema.js';
import {
  buildDcfValuationSchema,
  type DcfValuationParams,
} from '../templates/dcfValuation.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PARAMS_A: DcfValuationParams = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  baseRevenue: 1_000,
  revenueGrowthPct: 0.1,
  ebitMarginPct: 0.2,
  taxRatePct: 0.19,
  daPct: 0.05,
  capexPct: 0.06,
  workingCapitalChangePct: 0.02,
  waccPct: 0.1,
  terminalGrowthPct: 0.02,
  netDebt: 200,
  forecastYears: 5,
};

const PARAMS_B: DcfValuationParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  baseRevenue: 8_000_000,
  revenueGrowthPct: 0.07,
  ebitMarginPct: 0.25,
  taxRatePct: 0.21,
  daPct: 0.04,
  capexPct: 0.05,
  workingCapitalChangePct: 0.015,
  waccPct: 0.09,
  terminalGrowthPct: 0.025,
  netDebt: -500_000, // net cash
  forecastYears: 7,
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

// ---------------------------------------------------------------------------
// Independent JS reference DCF model — the ground truth for (b).
//
// Mirrors ONLY the math (no builder involvement). All resolved values are the
// same as the params here (params stay inside the resolver's clamps), so this
// is a genuine independent recomputation.
// ---------------------------------------------------------------------------

interface DcfRef {
  fcf: number[]; // FCF year 1..N
  discountFactor: number[]; // 1/(1+wacc)^t
  pvFcf: number[];
  sumPvFcf: number;
  terminalValue: number;
  pvTerminal: number;
  enterpriseValue: number;
  equityValue: number;
}

function referenceDcf(p: Required<Omit<DcfValuationParams, 'companyName' | 'currencyCode'>>): DcfRef {
  const {
    baseRevenue,
    revenueGrowthPct: g,
    ebitMarginPct,
    taxRatePct,
    daPct,
    capexPct,
    workingCapitalChangePct: wcPct,
    waccPct: wacc,
    terminalGrowthPct: tg,
    netDebt,
    forecastYears: N,
  } = p;

  const fcf: number[] = [];
  const discountFactor: number[] = [];
  const pvFcf: number[] = [];
  let prevRevenue = baseRevenue;

  for (let t = 1; t <= N; t++) {
    const revenue = prevRevenue * (1 + g);
    const ebit = revenue * ebitMarginPct;
    const nopat = ebit * (1 - taxRatePct);
    const da = revenue * daPct;
    const capex = revenue * capexPct;
    const wc = revenue * wcPct;
    const freeCashFlow = nopat + da - capex - wc;
    const df = 1 / (1 + wacc) ** t;
    fcf.push(freeCashFlow);
    discountFactor.push(df);
    pvFcf.push(freeCashFlow * df);
    prevRevenue = revenue;
  }

  const sumPvFcf = pvFcf.reduce((a, b) => a + b, 0);
  const lastFcf = fcf[N - 1];
  const lastDf = discountFactor[N - 1];
  const terminalValue = (lastFcf * (1 + tg)) / (wacc - tg);
  const pvTerminal = terminalValue * lastDf;
  const enterpriseValue = sumPvFcf + pvTerminal;
  const equityValue = enterpriseValue - netDebt;

  return {
    fcf,
    discountFactor,
    pvFcf,
    sumPvFcf,
    terminalValue,
    pvTerminal,
    enterpriseValue,
    equityValue,
  };
}

// ---------------------------------------------------------------------------
// Self-contained formula evaluator over the ACTUAL workbook.
//
// ExcelJS does not recalc, so we evaluate the read-back formula GRAPH ourselves:
// resolve A1 refs (same-sheet + 'Sheet'!A1 cross-sheet) recursively, and handle
// + - * / , ^ (power, right-assoc), parentheses, and SUM(range). This proves
// the emitted formulas actually COMPUTE the reference numbers — not that a
// cached value happened to match.
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

  const colToIdx = (letter: string): number => {
    let idx = 0;
    for (let k = 0; k < letter.length; k++) idx = idx * 26 + (letter.charCodeAt(k) - 64);
    return idx;
  };
  const idxToCol = (idx: number): string => {
    let n = idx;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  /** Sum an A1 rectangular range (single-row OR single-column) on a sheet. */
  function sumRange(sheet: string, from: string, to: string): number {
    const m1 = /^\$?([A-Z]+)\$?(\d+)$/.exec(from);
    const m2 = /^\$?([A-Z]+)\$?(\d+)$/.exec(to);
    if (!m1 || !m2) throw new Error(`bad SUM range ${from}:${to}`);
    const c1 = colToIdx(m1[1]);
    const c2 = colToIdx(m2[1]);
    const r1 = parseInt(m1[2], 10);
    const r2 = parseInt(m2[2], 10);
    let total = 0;
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
        total += cellValue(sheet, `${idxToCol(c)}${r}`);
      }
    }
    return total;
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

    // Power binds tighter than * / and is right-associative (Excel: 2^3^2 = 512).
    function parsePower(): number {
      const base = parseFactor();
      skipWs();
      if (peek() === '^') {
        i++;
        const exp = parsePower(); // right-assoc
        return base ** exp;
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
      // Identifier — a function like MAX / SUM, OR the letters of a bare cell ref.
      if (/[A-Za-z]/.test(ch)) {
        const start = i;
        while (i < s.length && /[A-Za-z]/.test(s[i])) i++;
        // A bare same-sheet ref (B10) has DIGITS right after the letters and NO
        // '(' — in that case back up and let parseRef handle the whole token.
        const afterLetters = s[i];
        skipWs();
        if (peek() === '(') {
          const fn = s.slice(start, i).toUpperCase();
          i++; // consume '('
          const args: string[] = [];
          // Capture raw argument strings split at top-level commas so SUM can see
          // the "A:B" range shape.
          let depth = 0;
          let argStart = i;
          while (i < s.length) {
            const cc = s[i];
            if (cc === '(') depth++;
            else if (cc === ')') {
              if (depth === 0) break;
              depth--;
            } else if (cc === ',' && depth === 0) {
              args.push(s.slice(argStart, i));
              i++;
              argStart = i;
              continue;
            }
            i++;
          }
          args.push(s.slice(argStart, i));
          if (peek() === ')') i++;
          if (fn === 'SUM') {
            let total = 0;
            for (const a of args) {
              const rng = /^\s*(?:'([^']+)'!)?\$?([A-Z]+\$?\d+)\s*:\s*\$?([A-Z]+\$?\d+)\s*$/.exec(a);
              if (rng) {
                const sheet = rng[1] ?? currentSheet;
                total += sumRange(sheet, rng[2], rng[3]);
              } else {
                total += evalExpr(currentSheet, a);
              }
            }
            return total;
          }
          if (fn === 'MAX') return Math.max(...args.map((a) => evalExpr(currentSheet, a)));
          if (fn === 'MIN') return Math.min(...args.map((a) => evalExpr(currentSheet, a)));
          throw new Error(`unsupported fn ${fn} in ${formula}`);
        }
        // Not a function — must be a bare same-sheet ref. Back up.
        void afterLetters;
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
      return cellValue(sheet, `${m[1]}${m[2]}`);
    }

    return parseExpression();
  }

  return { cellValue, evalExpr };
}

/** Column letter for forecast year t (1-based): t=1 → 'B'. */
function yearCol(t: number): string {
  let n = t + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

// DCF sheet row indexes (Excel rows).
const DCF_ROW = { revenue: 2, ebit: 3, nopat: 4, da: 5, capex: 6, wc: 7, fcf: 8, df: 9, pvFcf: 10 } as const;
// Valuation ("Wycena") sheet rows.
const VAL_ROW = { sumPv: 2, tv: 3, pvTv: 4, ev: 5, netDebt: 6, equity: 7 } as const;

/** Resolve the fully-defaulted numeric params (params here are all in-range). */
function resolvedNumeric(p: DcfValuationParams): Required<Omit<DcfValuationParams, 'companyName' | 'currencyCode'>> {
  return {
    baseRevenue: p.baseRevenue!,
    revenueGrowthPct: p.revenueGrowthPct!,
    ebitMarginPct: p.ebitMarginPct!,
    taxRatePct: p.taxRatePct!,
    daPct: p.daPct!,
    capexPct: p.capexPct!,
    workingCapitalChangePct: p.workingCapitalChangePct!,
    waccPct: p.waccPct!,
    terminalGrowthPct: p.terminalGrowthPct!,
    netDebt: p.netDebt!,
    forecastYears: p.forecastYears!,
  };
}

// ---------------------------------------------------------------------------
// (schema)
// ---------------------------------------------------------------------------

describe('dcfValuation — schema validity', () => {
  it('produces a WorkbookSchema that passes the canonical validator', () => {
    const schema = buildDcfValuationSchema(PARAMS_A);
    const parsed = WorkbookSchemaValidator.safeParse(schema);
    expect(parsed.success).toBe(true);
    expect(schema.sheets.map((s) => s.name)).toEqual(['Założenia', 'DCF', 'Wycena']);
  });

  it('DCF sheet has one column per forecast year', () => {
    const schema = buildDcfValuationSchema(PARAMS_A);
    const dcf = schema.sheets.find((s) => s.name === 'DCF')!;
    // label column + N year columns.
    expect(dcf.columns).toHaveLength(1 + PARAMS_A.forecastYears!);
  });
});

// ---------------------------------------------------------------------------
// (a) read-back — formulas, chain, cross-sheet, Gordon TV, EV/EqV
// ---------------------------------------------------------------------------

describe('(a) read-back — DCF is formulas, chained, cross-sheet', () => {
  it('every DCF forecast cell is a FORMULA (no magic-numbers)', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('DCF')!;
    for (let t = 1; t <= PARAMS_A.forecastYears!; t++) {
      const col = yearCol(t);
      for (let r = 2; r <= 10; r++) {
        const f = formulaOf(ws, `${col}${r}`);
        expect(f, `${col}${r} should be a formula`).toBeTruthy();
      }
    }
  });

  it('Revenue chain: Y1 references base revenue & growth; Yt references Y(t-1)', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('DCF')!;
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2*(1+'Założenia'!$B$3)");
    expect(formulaOf(ws, 'C2')).toBe("B2*(1+'Założenia'!$B$3)");
    expect(formulaOf(ws, 'F2')).toBe("E2*(1+'Założenia'!$B$3)");
  });

  it('EBIT / NOPAT / FCF formulas reference assumptions and prior rows', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('DCF')!;
    expect(formulaOf(ws, 'B3')).toBe("B2*'Założenia'!$B$4"); // EBIT = Rev * marża
    expect(formulaOf(ws, 'B4')).toBe("B3*(1-'Założenia'!$B$5)"); // NOPAT = EBIT*(1-tax)
    expect(formulaOf(ws, 'B8')).toBe('B4+B5-B6-B7'); // FCF = NOPAT + D&A - CAPEX - ΔWC
  });

  it('discount factor is a FORMULA 1/(1+WACC)^t with the year exponent', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('DCF')!;
    expect(formulaOf(ws, 'B9')).toBe("1/(1+'Założenia'!$B$9)^1"); // year 1
    expect(formulaOf(ws, 'C9')).toBe("1/(1+'Założenia'!$B$9)^2"); // year 2
    expect(formulaOf(ws, 'F9')).toBe("1/(1+'Założenia'!$B$9)^5"); // year 5
    // PV(FCF) = FCF * discount factor.
    expect(formulaOf(ws, 'B10')).toBe('B8*B9');
  });

  it('Valuation sheet: Gordon TV, PV(TV), EV, Equity Value are formulas', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Wycena')!;
    // Sum of PV(FCF) over DCF row 10, B..F (5 years).
    expect(formulaOf(ws, 'B2')).toBe("SUM('DCF'!B10:F10)");
    // Terminal value (Gordon): FCF(N) * (1+g) / (WACC - g).
    expect(formulaOf(ws, 'B3')).toBe(
      "'DCF'!F8*(1+'Założenia'!$B$10)/('Założenia'!$B$9-'Założenia'!$B$10)",
    );
    // PV of TV = TV * discount factor of year N.
    expect(formulaOf(ws, 'B4')).toBe("B3*'DCF'!F9");
    // EV = sum PV(FCF) + PV(TV).
    expect(formulaOf(ws, 'B5')).toBe('B2+B4');
    // Net debt pulled from assumptions.
    expect(formulaOf(ws, 'B6')).toBe("'Założenia'!$B$11");
    // Equity Value = EV - net debt.
    expect(formulaOf(ws, 'B7')).toBe('B5-B6');
  });

  it('EV and Equity Value rows are marked isSummary', () => {
    const schema = buildDcfValuationSchema(PARAMS_A);
    const val = schema.sheets.find((s) => s.name === 'Wycena')!;
    expect(val.rows[VAL_ROW.ev - 2].isSummary).toBe(true);
    expect(val.rows[VAL_ROW.equity - 2].isSummary).toBe(true);
  });

  it('assumptions inputs are styled values (not formulas) with data-validation + named ranges', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A));
    const wb = await load(buf);
    const zws = wb.getWorksheet('Założenia')!;
    // Base revenue is an input VALUE, not a formula, and carries the input fill.
    expect(formulaOf(zws, 'B2')).toBeNull();
    expect(typeof (zws.getCell('B2').value as any)).toBe('number');
    // WACC input carries a decimal data-validation.
    const dv: any = zws.getCell('B9').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
    // Named ranges emitted for the input rows (11 drivers).
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(11);
  });

  it('currency + factor number formats are present on the real cells', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('DCF')!;
    const revFmt = ws.getCell('B2').numFmt ?? '';
    expect(revFmt).toContain('zł');
    expect(revFmt).toContain('[Red]');
    // Discount factor row carries a 4-decimal format.
    expect(ws.getCell('B9').numFmt ?? '').toContain('0.0000');
  });
});

// ---------------------------------------------------------------------------
// (b) MATH VERIFICATION — evaluate the real formula graph, compare to JS model
// ---------------------------------------------------------------------------

describe('(b) math verification — evaluated workbook == independent JS DCF model', () => {
  it('FCF / discount factors / PV / EV / Equity match the reference model to the grosz (PARAMS_A)', async () => {
    const schema = buildDcfValuationSchema(PARAMS_A);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);
    const ref = referenceDcf(resolvedNumeric(PARAMS_A));
    const N = PARAMS_A.forecastYears!;

    for (let t = 1; t <= N; t++) {
      const col = yearCol(t);
      expect(ev.cellValue('DCF', `${col}${DCF_ROW.fcf}`)).toBeCloseTo(ref.fcf[t - 1], 6);
      expect(ev.cellValue('DCF', `${col}${DCF_ROW.df}`)).toBeCloseTo(ref.discountFactor[t - 1], 10);
      expect(ev.cellValue('DCF', `${col}${DCF_ROW.pvFcf}`)).toBeCloseTo(ref.pvFcf[t - 1], 6);
    }

    // Valuation summary.
    expect(ev.cellValue('Wycena', `B${VAL_ROW.sumPv}`)).toBeCloseTo(ref.sumPvFcf, 6);
    expect(ev.cellValue('Wycena', `B${VAL_ROW.tv}`)).toBeCloseTo(ref.terminalValue, 6);
    expect(ev.cellValue('Wycena', `B${VAL_ROW.pvTv}`)).toBeCloseTo(ref.pvTerminal, 6);
    expect(ev.cellValue('Wycena', `B${VAL_ROW.ev}`)).toBeCloseTo(ref.enterpriseValue, 6);
    expect(ev.cellValue('Wycena', `B${VAL_ROW.equity}`)).toBeCloseTo(ref.equityValue, 6);
  });

  it('matches the reference model for a second, larger param set (PARAMS_B, 7 years, net cash)', async () => {
    const schema = buildDcfValuationSchema(PARAMS_B);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);
    const ref = referenceDcf(resolvedNumeric(PARAMS_B));

    expect(ev.cellValue('Wycena', `B${VAL_ROW.ev}`)).toBeCloseTo(ref.enterpriseValue, 4);
    // Net debt is negative → Equity Value > Enterprise Value.
    expect(ev.cellValue('Wycena', `B${VAL_ROW.equity}`)).toBeCloseTo(ref.equityValue, 4);
    expect(ref.equityValue).toBeGreaterThan(ref.enterpriseValue);
  });

  it('sanity: the hand-computed EV/EqV for PARAMS_A are the documented numbers', () => {
    // Independent closed-form check of the reference model itself (guards the
    // guard): revenue grows 10%/yr off 1000; margins per PARAMS_A.
    const ref = referenceDcf(resolvedNumeric(PARAMS_A));
    // Year-1 FCF = Rev*(NOPAT ratio + D&A - CAPEX - WC)
    //   Rev1 = 1100 ; NOPAT ratio = 0.2*(1-0.19)=0.162 ; +0.05 -0.06 -0.02 = 0.132
    //   FCF1 = 1100 * 0.132 = 145.2
    expect(ref.fcf[0]).toBeCloseTo(145.2, 6);
    // df1 = 1/1.1 = 0.909090…
    expect(ref.discountFactor[0]).toBeCloseTo(1 / 1.1, 10);
    // EV and EqV are positive and EqV = EV - 200.
    expect(ref.enterpriseValue).toBeGreaterThan(0);
    expect(ref.equityValue).toBeCloseTo(ref.enterpriseValue - 200, 6);
  });
});

// ---------------------------------------------------------------------------
// (c) quality gate — critic report
// ---------------------------------------------------------------------------

describe('(c) quality gate — critic', () => {
  it('critiqueWorkbook passes (no CRITICAL) for default + both param sets', () => {
    for (const p of [undefined, PARAMS_A, PARAMS_B]) {
      const report = critiqueWorkbook(buildDcfValuationSchema(p));
      // Surface any issues for debugging if this ever regresses.
      expect(report.passed, `params=${JSON.stringify(p)} issues=${JSON.stringify(report.issues)}`).toBe(true);
      expect(report.score).toBe(100);
    }
  });
});

// ---------------------------------------------------------------------------
// (d) parametrization + ANTI-FALSE-GREEN
// ---------------------------------------------------------------------------

describe('(d) parametrization + anti-false-green', () => {
  it('two param sets produce different Enterprise Values (parametrization is real)', async () => {
    const wbA = await load(await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A)));
    const wbB = await load(await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_B)));
    const evA = makeEvaluator(wbA).cellValue('Wycena', `B${VAL_ROW.ev}`);
    const evB = makeEvaluator(wbB).cellValue('Wycena', `B${VAL_ROW.ev}`);
    expect(evA).not.toBeCloseTo(evB, 0);
  });

  it('the resolver keeps terminal g strictly below WACC (Gordon denominator > 0)', () => {
    // Caller pushes g ABOVE WACC — the model must cap g so (WACC - g) > 0.
    const schema = buildDcfValuationSchema({ ...PARAMS_A, waccPct: 0.08, terminalGrowthPct: 0.2 });
    const zws = schema.sheets.find((s) => s.name === 'Założenia')!;
    const wacc = zws.rows[9 - 2].cells.wartosc.value as number; // row 9
    const g = zws.rows[10 - 2].cells.wartosc.value as number; // row 10
    expect(wacc - g).toBeGreaterThan(0);
  });

  it('ANTI-FALSE-GREEN: a wrong SIGN in the Gordon TV formula makes the math leg FAIL', async () => {
    // Build the correct schema, then deliberately corrupt the TV formula's
    // denominator sign (WACC + g instead of WACC - g). The evaluated EV must then
    // diverge from the reference — proving the math leg is not vacuous.
    const good: WorkbookSchema = buildDcfValuationSchema(PARAMS_A);
    const bad: WorkbookSchema = JSON.parse(JSON.stringify(good));
    const badVal = bad.sheets.find((s) => s.name === 'Wycena')!;
    const tvCell = badVal.rows[VAL_ROW.tv - 2].cells.wartosc;
    // Corrupt: '-' → '+' in the denominator.
    tvCell.formula = tvCell.formula!.replace(
      "('Założenia'!$B$9-'Założenia'!$B$10)",
      "('Założenia'!$B$9+'Założenia'!$B$10)",
    );
    expect(tvCell.formula).toContain("$B$9+'Założenia'!$B$10"); // ensure the swap took

    const wb = await load(await buildWorkbookBuffer(bad));
    const ev = makeEvaluator(wb);
    const ref = referenceDcf(resolvedNumeric(PARAMS_A));
    const evaluatedEv = ev.cellValue('Wycena', `B${VAL_ROW.ev}`);
    // The corrupted model must NOT match the reference EV.
    expect(Math.abs(evaluatedEv - ref.enterpriseValue)).toBeGreaterThan(1);
  });

  it('ANTI-FALSE-GREEN: a wrong EXPONENT in the discount factor makes the math leg FAIL', async () => {
    const good: WorkbookSchema = buildDcfValuationSchema(PARAMS_A);
    const bad: WorkbookSchema = JSON.parse(JSON.stringify(good));
    const badDcf = bad.sheets.find((s) => s.name === 'DCF')!;
    // Force every discount factor to exponent ^1 (a classic DCF bug).
    const dfRow = badDcf.rows[DCF_ROW.df - 2];
    for (const key of Object.keys(dfRow.cells)) {
      const c = dfRow.cells[key];
      if (c.formula) c.formula = c.formula.replace(/\^\d+$/, '^1');
    }
    const wb = await load(await buildWorkbookBuffer(bad));
    const ev = makeEvaluator(wb);
    const ref = referenceDcf(resolvedNumeric(PARAMS_A));
    // Year-5 discount factor would be wildly off (0.9091 vs 0.6209).
    const df5 = ev.cellValue('DCF', `${yearCol(5)}${DCF_ROW.df}`);
    expect(Math.abs(df5 - ref.discountFactor[4])).toBeGreaterThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Artifact — write a real example file for manual inspection (non-assertive).
// ---------------------------------------------------------------------------

describe('artifact — example .xlsx to scratchpad', () => {
  it('writes model_dcf_szablon.xlsx', async () => {
    const buf = await buildWorkbookBuffer(buildDcfValuationSchema(PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: PARAMS_A.companyName, source: 'dcfValuation template' },
    });
    const out = path.join(
      '/private/tmp/claude-501/-Users-piotrwisniewski-Documents-Antygracity-DRD-consultify/0b91efa1-5cf4-4a06-b1a8-0c3c30e2efc6/scratchpad',
      'model_dcf_szablon.xlsx',
    );
    try {
      await fs.writeFile(out, buf);
      const stat = await fs.stat(out);
      expect(stat.size).toBeGreaterThan(3000);
    } catch {
      expect(buf.length).toBeGreaterThan(3000);
    }
  });
});
