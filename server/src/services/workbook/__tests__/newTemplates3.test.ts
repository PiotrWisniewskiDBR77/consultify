// @vitest-environment node
/**
 * Anti-false-green tests for the TWO NEWEST model templates added to the
 * workbook registry: `unitEconomics` (SaaS unit economics: LTV/CAC/payback/NRR
 * + 12m churn-decay projection) and `loanAmortization` (loan amortization
 * schedule, annuity payment). Mirrors the proof structure of
 * newTemplates2.test.ts (which covers breakEven + cashflow12m):
 *
 *   (0) registry     — both ids are listed, reachable via buildFromTemplate /
 *                       buildFromTemplateFlat, and default output validates
 *                       against the canonical WorkbookSchema with ≥1 real
 *                       formula cell.
 *   (a) read-back     — real .xlsx built via buildWorkbookBuffer(); line items
 *                       are FORMULAS (never magic-numbers), chained
 *                       month↔month / row↔row, cross-referencing the
 *                       Assumptions sheet.
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
 * in this suite.
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
  buildLoanAmortizationSchema,
  type LoanAmortizationParams,
} from '../templates/loanAmortization.js';
import { buildUnitEconomicsSchema, type UnitEconomicsParams } from '../templates/unitEconomics.js';
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
  schema: ReturnType<typeof buildUnitEconomicsSchema>
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
// superset of syntax both new templates emit: +, -, *, /, ^ (power, incl.
// unary-minus exponents like `^-5`), parentheses, SUM(range) (same-row OR
// same-col, same-sheet OR cross-sheet), bare numeric literals (e.g. formula
// "1"), and same-sheet / cross-sheet A1 refs (with $).
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

    // Power binds tighter than * / but looser than a leading unary minus on
    // the BASE (Excel: -2^2 = -4); the EXPONENT itself may carry its own sign
    // (e.g. `(1+r)^-n`), handled by parseFactor's unary-minus branch.
    function parsePower(): number {
      const base = parseFactor();
      skipWs();
      if (peek() === '^') {
        i++;
        const exp = parsePower(); // right-associative
        return Math.pow(base, exp);
      }
      return base;
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

describe('registry — unitEconomics + loanAmortization are registered', () => {
  it('listWorkbookTemplates() contains the complete built-in catalog', () => {
    const ids = listWorkbookTemplates().map((t) => t.id);
    expect(ids).toContain('unitEconomics');
    expect(ids).toContain('loanAmortization');
    expect(ids).toContain('threeScenarioPnL');
    expect(ids).toContain('operatingBudget');
    expect(ids).toContain('dcfValuation');
    expect(ids).toContain('breakEven');
    expect(ids).toContain('cashflow12m');
    expect(ids).toContain('projectViability');
    expect(ids).toContain('benefitsRealization');
    expect(ids).toHaveLength(9);
  });

  it('WORKBOOK_TEMPLATES exposes both entries with id/build wired correctly', () => {
    expect(WORKBOOK_TEMPLATES.unitEconomics.id).toBe('unitEconomics');
    expect(WORKBOOK_TEMPLATES.unitEconomics.build).toBe(buildUnitEconomicsSchema);
    expect(WORKBOOK_TEMPLATES.loanAmortization.id).toBe('loanAmortization');
    expect(WORKBOOK_TEMPLATES.loanAmortization.build).toBe(buildLoanAmortizationSchema);
  });

  it('unitEconomics: buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('unitEconomics', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('loanAmortization: buildFromTemplateFlat() with DEFAULTS produces a schema with ≥1 real formula cell', () => {
    const schema = buildFromTemplateFlat('loanAmortization', {});
    expect(schema).not.toBeNull();
    const cells = allCells(schema!);
    const formulaCells = cells.filter(
      (c) => typeof c.formula === 'string' && c.formula.trim().length > 0
    );
    expect(formulaCells.length).toBeGreaterThan(0);
  });

  it('buildFromTemplate() also reaches both templates with native (non-flat) params', () => {
    expect(buildFromTemplate('unitEconomics', {})).not.toBeNull();
    expect(buildFromTemplate('loanAmortization', {})).not.toBeNull();
  });

  it('both templates pass the canonical WorkbookSchema validator (default params)', () => {
    const ue = buildUnitEconomicsSchema();
    const la = buildLoanAmortizationSchema();
    expect(WorkbookSchemaValidator.safeParse(ue).success).toBe(true);
    expect(WorkbookSchemaValidator.safeParse(la).success).toBe(true);
    expect(ue.sheets.map((s) => s.name)).toEqual(['Założenia', 'Metryki', 'Projekcja 12m']);
    expect(la.sheets.map((s) => s.name)).toEqual(['Założenia', 'Harmonogram']);
  });
});

// ---------------------------------------------------------------------------
// unitEconomics — fixtures + reference model
// ---------------------------------------------------------------------------

const UE_PARAMS_A: Required<UnitEconomicsParams> = {
  companyName: 'Acme SaaS Sp. z o.o.',
  currencyCode: 'PLN',
  startingMrr: 60_000,
  churnPctMonthly: 0.025,
  cac: 1_500,
  grossMarginPct: 0.8,
  arpu: 300,
};

const UE_PARAMS_B: UnitEconomicsParams = {
  companyName: 'Globex Cloud Inc.',
  currencyCode: 'USD',
  startingMrr: 200_000,
  churnPctMonthly: 0.05,
  cac: 2_000,
  grossMarginPct: 0.65,
  arpu: 500,
};

function referenceUnitEconomics(p: Required<UnitEconomicsParams>) {
  const ltv = (p.arpu * p.grossMarginPct) / p.churnPctMonthly;
  const ltvCac = ltv / p.cac;
  const payback = p.cac / (p.arpu * p.grossMarginPct);
  const nrr = 1 - p.churnPctMonthly;

  const customers: number[] = [];
  const mrr: number[] = [];
  let prevCustomers = 0;
  for (let m = 0; m < 12; m++) {
    const cust = m === 0 ? p.startingMrr / p.arpu : prevCustomers * (1 - p.churnPctMonthly);
    customers.push(cust);
    mrr.push(cust * p.arpu);
    prevCustomers = cust;
  }
  return { ltv, ltvCac, payback, nrr, customers, mrr };
}

const MET_ROW = { ltv: 2, ltvCac: 3, payback: 4, nrr: 5 };
const PROJ_ROW = { customers: 2, mrr: 3 };
const MONTH_COLS = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

describe('unitEconomics — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every "Metryki" cell is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Metryki')!;
    for (let r = 2; r <= 5; r++) {
      expect(formulaOf(ws, `B${r}`), `B${r} should be a formula`).toBeTruthy();
    }
  });

  it('LTV / LTV-CAC / payback / NRR reference Assumptions correctly', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Metryki')!;
    expect(formulaOf(ws, `B${MET_ROW.ltv}`)).toBe(
      "'Założenia'!$B$6*'Założenia'!$B$5/'Założenia'!$B$3"
    );
    expect(formulaOf(ws, `B${MET_ROW.ltvCac}`)).toBe(`B${MET_ROW.ltv}/'Założenia'!$B$4`);
    expect(formulaOf(ws, `B${MET_ROW.payback}`)).toBe(
      "'Założenia'!$B$4/('Założenia'!$B$6*'Założenia'!$B$5)"
    );
    expect(formulaOf(ws, `B${MET_ROW.nrr}`)).toBe("1-'Założenia'!$B$3");
  });

  it('Projekcja 12m: every month + RAZEM cell (both rows) is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Projekcja 12m')!;
    for (const col of [...MONTH_COLS, 'N']) {
      for (const r of [PROJ_ROW.customers, PROJ_ROW.mrr]) {
        expect(formulaOf(ws, `${col}${r}`), `${col}${r} should be a formula`).toBeTruthy();
      }
    }
  });

  it('customers chain: m1 = MRR0/ARPU, m2 = m1 * (1-churn); MRR chains off customers', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Projekcja 12m')!;
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2/'Założenia'!$B$6");
    expect(formulaOf(ws, 'C2')).toBe("B2*(1-'Założenia'!$B$3)");
    expect(formulaOf(ws, 'B3')).toBe("B2*'Założenia'!$B$6");
    expect(formulaOf(ws, 'C3')).toBe("C2*'Założenia'!$B$6");
  });

  it('RAZEM column is a direct reference to December (M), not a SUM', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Projekcja 12m')!;
    expect(formulaOf(ws, 'N2')).toBe('M2');
    expect(formulaOf(ws, 'N3')).toBe('M3');
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(5);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B3').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

describe('unitEconomics — (b) math verification — evaluated workbook == independent JS model', () => {
  it('LTV / LTV-CAC / payback / NRR match the reference model', async () => {
    for (const params of [UE_PARAMS_A, UE_PARAMS_B]) {
      const full: Required<UnitEconomicsParams> = { ...UE_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildUnitEconomicsSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceUnitEconomics(full);
      expect(ev.cellValue('Metryki', `B${MET_ROW.ltv}`)).toBeCloseTo(ref.ltv, 4);
      expect(ev.cellValue('Metryki', `B${MET_ROW.ltvCac}`)).toBeCloseTo(ref.ltvCac, 6);
      expect(ev.cellValue('Metryki', `B${MET_ROW.payback}`)).toBeCloseTo(ref.payback, 6);
      expect(ev.cellValue('Metryki', `B${MET_ROW.nrr}`)).toBeCloseTo(ref.nrr, 8);
    }
  });

  it('12-month customers/MRR projection matches the reference model, every month + RAZEM', async () => {
    for (const params of [UE_PARAMS_A, UE_PARAMS_B]) {
      const full: Required<UnitEconomicsParams> = { ...UE_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildUnitEconomicsSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceUnitEconomics(full);
      for (let m = 0; m < 12; m++) {
        const col = MONTH_COLS[m];
        expect(ev.cellValue('Projekcja 12m', `${col}${PROJ_ROW.customers}`)).toBeCloseTo(
          ref.customers[m],
          4
        );
        expect(ev.cellValue('Projekcja 12m', `${col}${PROJ_ROW.mrr}`)).toBeCloseTo(ref.mrr[m], 2);
      }
      expect(ev.cellValue('Projekcja 12m', `N${PROJ_ROW.customers}`)).toBeCloseTo(
        ref.customers[11],
        4
      );
      expect(ev.cellValue('Projekcja 12m', `N${PROJ_ROW.mrr}`)).toBeCloseTo(ref.mrr[11], 2);
    }
  });

  it('defensive nudges: churn/margin/CAC/ARPU are never shipped as 0 (would #DIV/0!)', () => {
    const degenerate = buildUnitEconomicsSchema({
      churnPctMonthly: 0,
      grossMarginPct: 0,
      cac: 0,
      arpu: 0,
    });
    const zws = degenerate.sheets.find((s) => s.name === 'Założenia')!;
    const churn = zws.rows[1].cells.wartosc.value as number;
    const cac = zws.rows[2].cells.wartosc.value as number;
    const margin = zws.rows[3].cells.wartosc.value as number;
    const arpu = zws.rows[4].cells.wartosc.value as number;
    expect(churn).toBeGreaterThan(0);
    expect(cac).toBeGreaterThan(0);
    expect(margin).toBeGreaterThan(0);
    expect(arpu).toBeGreaterThan(0);
  });
});

describe('unitEconomics — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + both param sets)', () => {
    for (const p of [undefined, UE_PARAMS_A, UE_PARAMS_B]) {
      const report = critiqueWorkbook(buildUnitEconomicsSchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// loanAmortization — fixtures + reference model
// ---------------------------------------------------------------------------

const LOAN_PARAMS_A: Required<LoanAmortizationParams> = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  loanAmount: 240_000,
  annualInterestRatePct: 0.06,
  termMonths: 24,
};

const LOAN_PARAMS_B: LoanAmortizationParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  loanAmount: 50_000,
  annualInterestRatePct: 0.12,
  termMonths: 12,
};

const LOAN_PARAMS_C: LoanAmortizationParams = {
  ...LOAN_PARAMS_A,
  companyName: 'LongTerm sp. z o.o.',
  termMonths: 60,
  annualInterestRatePct: 0.045,
};

interface LoanMonth {
  opening: number;
  payment: number;
  interest: number;
  principal: number;
  closing: number;
}

function referenceLoan(p: Required<LoanAmortizationParams>): LoanMonth[] {
  const r = p.annualInterestRatePct / 12;
  const n = p.termMonths;
  const payment = (p.loanAmount * r) / (1 - Math.pow(1 + r, -n));
  const out: LoanMonth[] = [];
  let opening = p.loanAmount;
  for (let m = 0; m < n; m++) {
    const interest = opening * r;
    const principal = payment - interest;
    const closing = opening - principal;
    out.push({ opening, payment, interest, principal, closing });
    opening = closing;
  }
  return out;
}

describe('loanAmortization — (a) read-back — formulas, chained, cross-sheet', () => {
  it('every Harmonogram schedule cell (all months) is a FORMULA', async () => {
    const buf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Harmonogram')!;
    for (let r = 2; r <= 1 + LOAN_PARAMS_A.termMonths; r++) {
      for (const col of ['A', 'B', 'C', 'D', 'E', 'F']) {
        expect(formulaOf(ws, `${col}${r}`), `${col}${r} should be a formula`).toBeTruthy();
      }
    }
  });

  it('Miesiąc index chains as a formula (row1="1", row2="A2+1"), never a bare constant', async () => {
    const buf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Harmonogram')!;
    expect(formulaOf(ws, 'A2')).toBe('1');
    expect(formulaOf(ws, 'A3')).toBe('A2+1');
    expect(formulaOf(ws, 'A4')).toBe('A3+1');
  });

  it('Rata is the SAME arithmetic annuity formula every row, referencing Assumptions', async () => {
    const buf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Harmonogram')!;
    const expected =
      "'Założenia'!$B$2*('Założenia'!$B$3/12)/(1-(1+('Założenia'!$B$3/12))^-'Założenia'!$B$4)";
    expect(formulaOf(ws, 'C2')).toBe(expected);
    expect(formulaOf(ws, 'C3')).toBe(expected);
    expect(formulaOf(ws, 'C24')).toBe(expected);
  });

  it('Saldo/Odsetki/Kapitał chain: opening balance carries from prior Saldo końcowe', async () => {
    const buf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Harmonogram')!;
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2"); // Saldo początkowe m1 = principal
    expect(formulaOf(ws, 'B3')).toBe('F2'); // Saldo początkowe m2 = Saldo końcowe m1
    expect(formulaOf(ws, 'D2')).toBe("B2*('Założenia'!$B$3/12)"); // Odsetki = Saldo * r
    expect(formulaOf(ws, 'E2')).toBe('C2-D2'); // Kapitał = Rata - Odsetki
    expect(formulaOf(ws, 'F2')).toBe('B2-E2'); // Saldo końcowe = Saldo początkowe - Kapitał
  });

  it('RAZEM row sums Rata/Odsetki/Kapitał and pulls the final Saldo końcowe', async () => {
    const buf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Harmonogram')!;
    const totalsRow = LOAN_PARAMS_A.termMonths + 2;
    const lastDataRow = LOAN_PARAMS_A.termMonths + 1;
    expect(formulaOf(ws, `C${totalsRow}`)).toBe(`SUM(C2:C${lastDataRow})`);
    expect(formulaOf(ws, `D${totalsRow}`)).toBe(`SUM(D2:D${lastDataRow})`);
    expect(formulaOf(ws, `E${totalsRow}`)).toBe(`SUM(E2:E${lastDataRow})`);
    expect(formulaOf(ws, `F${totalsRow}`)).toBe(`F${lastDataRow}`);
    expect(ws.getCell(`A${totalsRow}`).value).toBe('RAZEM');
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A));
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(3);
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B3').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

describe('loanAmortization — (b) math verification — evaluated workbook == independent JS model', () => {
  it('opening/payment/interest/principal/closing match the reference model, every month', async () => {
    for (const params of [LOAN_PARAMS_A, LOAN_PARAMS_B, LOAN_PARAMS_C]) {
      const full: Required<LoanAmortizationParams> = { ...LOAN_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildLoanAmortizationSchema(full)));
      const ev = makeEvaluator(wb);
      const ref = referenceLoan(full);
      for (let m = 0; m < full.termMonths; m++) {
        const excelRow = m + 2;
        expect(ev.cellValue('Harmonogram', `B${excelRow}`)).toBeCloseTo(ref[m].opening, 2);
        expect(ev.cellValue('Harmonogram', `C${excelRow}`)).toBeCloseTo(ref[m].payment, 2);
        expect(ev.cellValue('Harmonogram', `D${excelRow}`)).toBeCloseTo(ref[m].interest, 2);
        expect(ev.cellValue('Harmonogram', `E${excelRow}`)).toBeCloseTo(ref[m].principal, 2);
        expect(ev.cellValue('Harmonogram', `F${excelRow}`)).toBeCloseTo(ref[m].closing, 2);
      }
    }
  });

  it('the loan is FULLY amortized: final Saldo końcowe ≈ 0', async () => {
    for (const params of [LOAN_PARAMS_A, LOAN_PARAMS_B, LOAN_PARAMS_C]) {
      const full: Required<LoanAmortizationParams> = { ...LOAN_PARAMS_A, ...params };
      const wb = await load(await buildWorkbookBuffer(buildLoanAmortizationSchema(full)));
      const ev = makeEvaluator(wb);
      const lastDataRow = full.termMonths + 1;
      expect(ev.cellValue('Harmonogram', `F${lastDataRow}`)).toBeCloseTo(0, 4);
    }
  });

  it('RAZEM totals: sum of Kapitał (principal) across all months equals the original loan amount', async () => {
    const full = LOAN_PARAMS_A;
    const wb = await load(await buildWorkbookBuffer(buildLoanAmortizationSchema(full)));
    const ev = makeEvaluator(wb);
    const totalsRow = full.termMonths + 2;
    expect(ev.cellValue('Harmonogram', `E${totalsRow}`)).toBeCloseTo(full.loanAmount, 2);
  });

  it('termMonths is clamped to 1..360 (defensive against out-of-range params)', () => {
    const tooHigh = buildLoanAmortizationSchema({ termMonths: 9999 });
    const tooLow = buildLoanAmortizationSchema({ termMonths: -5 });
    expect(tooHigh.metadata?.termMonths).toBe(360);
    expect(tooLow.metadata?.termMonths).toBe(1);
  });

  it('annualInterestRatePct is nudged away from 0 (would #DIV/0! in the annuity formula)', () => {
    const zeroRate = buildLoanAmortizationSchema({ annualInterestRatePct: 0 });
    expect(zeroRate.metadata?.annualInterestRatePct).toBeGreaterThan(0);
  });
});

describe('loanAmortization — (c) quality gate — critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (default + all param sets)', () => {
    for (const p of [undefined, LOAN_PARAMS_A, LOAN_PARAMS_B, LOAN_PARAMS_C]) {
      const report = critiqueWorkbook(buildLoanAmortizationSchema(p));
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
  it('writes unitEconomics + loanAmortization examples', async () => {
    const scratch =
      '/private/tmp/claude-501/-Users-piotrwisniewski-Library-Mobile-Documents-com-apple-CloudDocs-Documents-Antygracity-DRD-consultify/56ebe1ab-d00c-4750-9c0b-08e4ca80c7ab/scratchpad';
    const ueBuf = await buildWorkbookBuffer(buildUnitEconomicsSchema(UE_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: UE_PARAMS_A.companyName, source: 'unitEconomics template' },
    });
    const loanBuf = await buildWorkbookBuffer(buildLoanAmortizationSchema(LOAN_PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: LOAN_PARAMS_A.companyName, source: 'loanAmortization template' },
    });
    try {
      await fs.writeFile(path.join(scratch, 'ekonomia_jednostkowa_szablon.xlsx'), ueBuf);
      await fs.writeFile(path.join(scratch, 'harmonogram_kredytu_szablon.xlsx'), loanBuf);
      expect(true).toBe(true);
    } catch {
      // scratchpad may not be writable in CI — the files are a convenience, not a gate.
      expect(ueBuf.length).toBeGreaterThan(3000);
      expect(loanBuf.length).toBeGreaterThan(3000);
    }
  });
});
