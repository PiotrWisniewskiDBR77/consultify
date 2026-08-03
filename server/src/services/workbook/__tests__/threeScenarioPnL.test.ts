// @vitest-environment node
/**
 * Anti-false-green tests for the FLAGSHIP model template: a parametric,
 * 3-scenario (Base/Bull/Bear), 3-year P&L generator.
 *
 * Every assertion targets a REAL .xlsx built by buildWorkbookBuffer() and read
 * back via ExcelJS — no assertion trusts the in-memory schema alone.
 *
 * The proof has four legs (task DOWÓD a–d):
 *   (a) read-back: P&L line items are FORMULAS, the Y1→Y2→Y3 chain works, formulas
 *       cross-reference the Assumptions sheet, the 3 scenarios are distinguished,
 *       accounting/% formats exist, named-ranges + data-validation exist.
 *   (b) MATH VERIFICATION: an independent JS model computes the expected values
 *       from the drivers; a self-contained formula evaluator resolves the ACTUAL
 *       workbook formula graph (no cached values relied upon) and the two must
 *       agree (Revenue / EBITDA / Net income, Y3, every scenario).
 *   (c) the deterministic critic (critiqueWorkbook) scores 100 / passed / 0 issues.
 *   (d) parametrization: two different param sets → different but internally
 *       consistent models; scenario monotonicity Bull > Base > Bear holds.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildFromTemplate, WORKBOOK_TEMPLATES } from '../templates/index.js';
import {
  buildThreeScenarioPnLSchema,
  type ScenarioDrivers,
  type ThreeScenarioPnLParams,
} from '../templates/threeScenarioPnL.js';
import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PARAMS_A: Required<
  Pick<ThreeScenarioPnLParams, 'companyName' | 'currencyCode' | 'startYear' | 'baseRevenue'>
> & {
  base: ScenarioDrivers;
  bull: ScenarioDrivers;
  bear: ScenarioDrivers;
} = {
  companyName: 'Acme Sp. z o.o.',
  currencyCode: 'PLN',
  startYear: 2026,
  baseRevenue: 1_000_000,
  base: {
    revenueGrowthPct: 0.08,
    cogsPct: 0.55,
    opexPct: 0.22,
    daPct: 0.05,
    interestPct: 0.02,
    taxRatePct: 0.19,
  },
  bull: {
    revenueGrowthPct: 0.18,
    cogsPct: 0.5,
    opexPct: 0.2,
    daPct: 0.05,
    interestPct: 0.015,
    taxRatePct: 0.19,
  },
  bear: {
    revenueGrowthPct: 0.0,
    cogsPct: 0.62,
    opexPct: 0.26,
    daPct: 0.05,
    interestPct: 0.03,
    taxRatePct: 0.19,
  },
};

const PARAMS_B: ThreeScenarioPnLParams = {
  companyName: 'Globex Inc.',
  currencyCode: 'USD',
  startYear: 2030,
  baseRevenue: 5_000_000,
  base: {
    revenueGrowthPct: 0.06,
    cogsPct: 0.6,
    opexPct: 0.18,
    daPct: 0.04,
    interestPct: 0.025,
    taxRatePct: 0.21,
  },
  bull: {
    revenueGrowthPct: 0.14,
    cogsPct: 0.55,
    opexPct: 0.16,
    daPct: 0.04,
    interestPct: 0.02,
    taxRatePct: 0.21,
  },
  bear: {
    revenueGrowthPct: -0.03,
    cogsPct: 0.66,
    opexPct: 0.22,
    daPct: 0.04,
    interestPct: 0.035,
    taxRatePct: 0.21,
  },
};

type ScenKey = 'base' | 'bull' | 'bear';
const SCENARIOS: ScenKey[] = ['base', 'bull', 'bear'];

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
// Independent JS reference model — computes the numbers the workbook SHOULD
// produce, straight from the drivers. This is the ground truth for (b).
// ---------------------------------------------------------------------------

interface YearOut {
  revenue: number;
  cogs: number;
  gross: number;
  opex: number;
  ebitda: number;
  da: number;
  ebit: number;
  interest: number;
  ebt: number;
  tax: number;
  net: number;
  margin: number;
}

function referenceModel(d: ScenarioDrivers, baseRevenue: number): YearOut[] {
  const out: YearOut[] = [];
  let prevRev = baseRevenue;
  for (let y = 0; y < 3; y++) {
    const revenue = y === 0 ? baseRevenue : prevRev * (1 + d.revenueGrowthPct);
    const cogs = revenue * d.cogsPct;
    const gross = revenue - cogs;
    const opex = revenue * d.opexPct;
    const ebitda = gross - opex;
    const da = revenue * d.daPct;
    const ebit = ebitda - da;
    const interest = revenue * d.interestPct;
    const ebt = ebit - interest;
    const tax = Math.max(0, ebt) * d.taxRatePct;
    const net = ebt - tax;
    const margin = net / revenue;
    out.push({ revenue, cogs, gross, opex, ebitda, da, ebit, interest, ebt, tax, net, margin });
    prevRev = revenue;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Self-contained formula evaluator over the ACTUAL workbook.
//
// ExcelJS does not recalc, so we evaluate the read-back formula GRAPH ourselves:
// resolve A1 refs (same-sheet + 'Sheet'!A1 cross-sheet) recursively, handle
// MAX(a,b), +-*/ and parentheses. This proves the formulas the template emitted
// actually COMPUTE the reference numbers — not that a cached value happened to
// match.
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
    // Tokenize a small grammar: numbers, cell refs (with optional 'Sheet'! and $),
    // + - * / ( ) and the single function MAX(a,b) used by the tax line.
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
      // Numeric literal (e.g. the `1` in `1 + growth`, or `0` in MAX(0, …)).
      if (/[0-9.]/.test(ch)) {
        const start = i;
        while (i < s.length && /[0-9.]/.test(s[i])) i++;
        return parseFloat(s.slice(start, i));
      }
      // MAX( a , b )
      if (/[A-Za-z]/.test(ch)) {
        // read an identifier
        const start = i;
        while (i < s.length && /[A-Za-z]/.test(s[i])) i++;
        const ident = s.slice(start, i).toUpperCase();
        skipWs();
        if (peek() === '(') {
          if (ident !== 'MAX') throw new Error(`unsupported fn ${ident} in ${formula}`);
          i++; // consume '('
          const args: number[] = [];
          args.push(parseExpression());
          skipWs();
          while (peek() === ',') {
            i++;
            args.push(parseExpression());
            skipWs();
          }
          if (peek() === ')') i++;
          return Math.max(...args);
        }
        // not a function — must be a bare same-sheet ref like B2; back up and
        // let the ref path handle it (rare in this template).
        i = start;
      }
      // cell ref: optional 'Sheet'! or Sheet! then $?COL$?ROW
      return parseRef();
    }

    function parseRef(): number {
      skipWs();
      let sheet = currentSheet;
      // Quoted sheet: 'Name'!
      if (peek() === "'") {
        i++;
        const start = i;
        while (i < s.length && s[i] !== "'") i++;
        sheet = s.slice(start, i);
        i++; // closing quote
        if (peek() === '!') i++;
      } else {
        // Maybe an unquoted Sheet! prefix (letters/digits/_). Look ahead for '!'.
        const start = i;
        let j = i;
        while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
        if (s[j] === '!' && j > i && /[A-Za-z_]/.test(s[start])) {
          sheet = s.slice(start, j);
          i = j + 1;
        }
      }
      // Now the A1 ref: $?COL$?ROW
      skipWs();
      const m = /^\$?([A-Z]+)\$?(\d+)/.exec(s.slice(i));
      if (!m) throw new Error(`bad ref at ${i} in ${formula}`);
      i += m[0].length;
      const addr = `${m[1]}${m[2]}`;
      return cellValue(sheet, addr);
    }

    const v = parseExpression();
    return v;
  }

  return { cellValue };
}

/** P&L column letters per scenario (Base B/C/D, Bull E/F/G, Bear H/I/J). */
const PL_COL: Record<ScenKey, [string, string, string]> = {
  base: ['B', 'C', 'D'],
  bull: ['E', 'F', 'G'],
  bear: ['H', 'I', 'J'],
};

// P&L line rows.
const ROW = { revenue: 2, ebitda: 6, net: 12, margin: 13 } as const;

// ---------------------------------------------------------------------------
// (schema) — the template's output validates against the canonical schema
// ---------------------------------------------------------------------------

describe('threeScenarioPnL — schema validity', () => {
  it('produces a WorkbookSchema that passes the canonical validator', () => {
    const schema = buildThreeScenarioPnLSchema(PARAMS_A);
    const parsed = WorkbookSchemaValidator.safeParse(schema);
    expect(parsed.success).toBe(true);
    expect(schema.sheets.map((s) => s.name)).toEqual(['Założenia', 'P&L', 'Porównanie']);
  });

  it('is registered in the template registry and reachable via buildFromTemplate', () => {
    expect(WORKBOOK_TEMPLATES.threeScenarioPnL).toBeDefined();
    expect(WORKBOOK_TEMPLATES.threeScenarioPnL.id).toBe('threeScenarioPnL');
    const viaRegistry = buildFromTemplate('threeScenarioPnL', PARAMS_A);
    expect(viaRegistry).not.toBeNull();
    expect(viaRegistry!.sheets).toHaveLength(3);
    expect(buildFromTemplate('doesNotExist', {})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (a) read-back — real .xlsx, formulas + chain + cross-sheet + formats
// ---------------------------------------------------------------------------

describe('(a) read-back — P&L is formulas, chained, cross-sheet, 3 scenarios', () => {
  it('every P&L line item cell is a FORMULA (no magic-numbers)', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('P&L')!;
    // rows 2..13, every scenario column, must be a formula (never a bare number).
    for (const scen of SCENARIOS) {
      for (const col of PL_COL[scen]) {
        for (let r = 2; r <= 13; r++) {
          const f = formulaOf(ws, `${col}${r}`);
          expect(f, `${col}${r} should be a formula`).toBeTruthy();
        }
      }
    }
  });

  it('Y1→Y2→Y3 chain: Yn references Y(n-1) and the growth assumption', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('P&L')!;
    // Base: Y1 references Assumptions revenue; Y2 references Y1 (B2) and growth.
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2");
    expect(formulaOf(ws, 'C2')).toBe("B2*(1+'Założenia'!$B$3)");
    expect(formulaOf(ws, 'D2')).toBe("C2*(1+'Założenia'!$B$3)");
    // Bull Y2 chains off Bull Y1 (E2) and Bull growth ($C$3); Bear off $D$3.
    expect(formulaOf(ws, 'F2')).toBe("E2*(1+'Założenia'!$C$3)");
    expect(formulaOf(ws, 'I2')).toBe("H2*(1+'Założenia'!$D$3)");
  });

  it('cross-sheet cost/tax formulas reference the correct scenario column of Założenia', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('P&L')!;
    // COGS(Base Y1) = Revenue * cogs% (Base col B in Założenia, row 4)
    expect(formulaOf(ws, 'B3')).toBe("B2*'Założenia'!$B$4");
    // COGS(Bear Y1) uses Bear col D
    expect(formulaOf(ws, 'H3')).toBe("H2*'Założenia'!$D$4");
    // Tax(Base Y1) = MAX(0, EBT) * taxRate
    expect(formulaOf(ws, 'B11')).toBe("MAX(0,B10)*'Założenia'!$B$8");
    // Net margin = Net / Revenue
    expect(formulaOf(ws, 'B13')).toBe('B12/B2');
  });

  it('subtotal chain uses derived lines (gross, EBITDA, EBIT, EBT, net)', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('P&L')!;
    expect(formulaOf(ws, 'B4')).toBe('B2-B3'); // Gross = Rev - COGS
    expect(formulaOf(ws, 'B6')).toBe('B4-B5'); // EBITDA = Gross - OPEX
    expect(formulaOf(ws, 'B8')).toBe('B6-B7'); // EBIT = EBITDA - D&A
    expect(formulaOf(ws, 'B10')).toBe('B8-B9'); // EBT = EBIT - Interest
    expect(formulaOf(ws, 'B12')).toBe('B10-B11'); // Net = EBT - Tax
  });

  it('Comparison sheet pulls Y3 Revenue/EBITDA/Net for all 3 scenarios via cross-sheet formulas', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A));
    const cmp = (await load(buf)).getWorksheet('Porównanie')!;
    // Revenue Y3: Base D2, Bull G2, Bear J2 on P&L.
    expect(formulaOf(cmp, 'B2')).toBe("'P&L'!D2");
    expect(formulaOf(cmp, 'C2')).toBe("'P&L'!G2");
    expect(formulaOf(cmp, 'D2')).toBe("'P&L'!J2");
    // EBITDA Y3 (row 6) + Net Y3 (row 12).
    expect(formulaOf(cmp, 'B3')).toBe("'P&L'!D6");
    expect(formulaOf(cmp, 'B4')).toBe("'P&L'!D12");
  });

  it('accounting currency format and % format are present on the real cells', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('P&L')!;
    // Revenue cell carries an accounting currency format (zł + red-negatives).
    const revFmt = ws.getCell('B2').numFmt ?? '';
    expect(revFmt).toContain('zł');
    expect(revFmt).toContain('[Red]');
    // Margin row carries a percent format.
    expect(ws.getCell('B13').numFmt ?? '').toContain('%');
  });

  it('named ranges + data-validation exist on the Assumptions sheet', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A));
    const wb = await load(buf);
    // Named ranges: isAssumptions emits one per input row (7 driver rows).
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(7);
    // Data validation: revenue + percent inputs carry a `decimal` bound.
    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B3').dataValidation;
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

// ---------------------------------------------------------------------------
// (b) MATH VERIFICATION — evaluate the real formula graph, compare to JS model
// ---------------------------------------------------------------------------

describe('(b) math verification — evaluated workbook == independent JS model', () => {
  it('Revenue / EBITDA / Net income (Y3, every scenario) match the reference model', async () => {
    const schema = buildThreeScenarioPnLSchema(PARAMS_A);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);

    const ref = {
      base: referenceModel(PARAMS_A.base, PARAMS_A.baseRevenue),
      bull: referenceModel(PARAMS_A.bull, PARAMS_A.baseRevenue),
      bear: referenceModel(PARAMS_A.bear, PARAMS_A.baseRevenue),
    };

    for (const scen of SCENARIOS) {
      const y3Col = PL_COL[scen][2]; // Year-3 column
      const evalRevenue = ev.cellValue('P&L', `${y3Col}${ROW.revenue}`);
      const evalEbitda = ev.cellValue('P&L', `${y3Col}${ROW.ebitda}`);
      const evalNet = ev.cellValue('P&L', `${y3Col}${ROW.net}`);
      const evalMargin = ev.cellValue('P&L', `${y3Col}${ROW.margin}`);

      const expected = ref[scen][2];
      expect(evalRevenue).toBeCloseTo(expected.revenue, 4);
      expect(evalEbitda).toBeCloseTo(expected.ebitda, 4);
      expect(evalNet).toBeCloseTo(expected.net, 4);
      expect(evalMargin).toBeCloseTo(expected.margin, 8);
    }
  });

  it('the Comparison sheet (evaluated) equals the P&L Y3 numbers', async () => {
    const schema = buildThreeScenarioPnLSchema(PARAMS_A);
    const wb = await load(await buildWorkbookBuffer(schema));
    const ev = makeEvaluator(wb);
    const ref = {
      base: referenceModel(PARAMS_A.base, PARAMS_A.baseRevenue),
      bull: referenceModel(PARAMS_A.bull, PARAMS_A.baseRevenue),
      bear: referenceModel(PARAMS_A.bear, PARAMS_A.baseRevenue),
    };
    const cmpCol: Record<ScenKey, string> = { base: 'B', bull: 'C', bear: 'D' };
    for (const scen of SCENARIOS) {
      expect(ev.cellValue('Porównanie', `${cmpCol[scen]}2`)).toBeCloseTo(ref[scen][2].revenue, 4);
      expect(ev.cellValue('Porównanie', `${cmpCol[scen]}3`)).toBeCloseTo(ref[scen][2].ebitda, 4);
      expect(ev.cellValue('Porównanie', `${cmpCol[scen]}4`)).toBeCloseTo(ref[scen][2].net, 4);
    }
  });
});

// ---------------------------------------------------------------------------
// (c) critic — score 100, passed, 0 issues
// ---------------------------------------------------------------------------

describe('(c) quality gate — template is critic-clean', () => {
  it('critiqueWorkbook → score 100, passed, 0 issues (PARAMS_A)', () => {
    const report = critiqueWorkbook(buildThreeScenarioPnLSchema(PARAMS_A));
    expect(report.issues).toEqual([]);
    expect(report.score).toBe(100);
    expect(report.passed).toBe(true);
  });

  it('critiqueWorkbook → score 100 across default + both param sets', () => {
    for (const p of [undefined, PARAMS_A, PARAMS_B]) {
      const report = critiqueWorkbook(buildThreeScenarioPnLSchema(p));
      expect(report.score, `params=${JSON.stringify(p)}`).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// (d) parametrization — different params → different but consistent models;
//     scenario monotonicity Bull > Base > Bear
// ---------------------------------------------------------------------------

describe('(d) parametrization — distinct params, internal consistency, monotonicity', () => {
  it('two param sets produce different Y3 revenue (parametrization is real)', async () => {
    const wbA = await load(await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A)));
    const wbB = await load(await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_B)));
    const evA = makeEvaluator(wbA);
    const evB = makeEvaluator(wbB);
    const revA = evA.cellValue('P&L', 'D2'); // Base Y3
    const revB = evB.cellValue('P&L', 'D2');
    expect(revA).not.toBeCloseTo(revB, 0);
    // A: 1,000,000 * 1.08^2 = 1,166,400 ; B: 5,000,000 * 1.06^2 = 5,618,000
    expect(revA).toBeCloseTo(1_000_000 * 1.08 ** 2, 4);
    expect(revB).toBeCloseTo(5_000_000 * 1.06 ** 2, 4);
  });

  it('monotonicity: Bull > Base > Bear for Revenue, EBITDA and Net (Y3), both param sets', async () => {
    for (const params of [PARAMS_A, PARAMS_B]) {
      const wb = await load(await buildWorkbookBuffer(buildThreeScenarioPnLSchema(params)));
      const ev = makeEvaluator(wb);
      for (const metricRow of [ROW.revenue, ROW.ebitda, ROW.net] as const) {
        const base = ev.cellValue('P&L', `D${metricRow}`); // Base Y3
        const bull = ev.cellValue('P&L', `G${metricRow}`); // Bull Y3
        const bear = ev.cellValue('P&L', `J${metricRow}`); // Bear Y3
        expect(bull, `row ${metricRow} bull>base`).toBeGreaterThan(base);
        expect(base, `row ${metricRow} base>bear`).toBeGreaterThan(bear);
      }
    }
  });

  it('overriding a single driver changes only that scenario (isolation)', async () => {
    const boostedBull: ThreeScenarioPnLParams = {
      ...PARAMS_A,
      bull: { ...PARAMS_A.bull, revenueGrowthPct: 0.35 },
    };
    const wb0 = await load(await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A)));
    const wb1 = await load(await buildWorkbookBuffer(buildThreeScenarioPnLSchema(boostedBull)));
    const e0 = makeEvaluator(wb0);
    const e1 = makeEvaluator(wb1);
    // Base Y3 unchanged, Bull Y3 higher.
    expect(e1.cellValue('P&L', 'D2')).toBeCloseTo(e0.cellValue('P&L', 'D2'), 4);
    expect(e1.cellValue('P&L', 'G2')).toBeGreaterThan(e0.cellValue('P&L', 'G2'));
  });
});

// ---------------------------------------------------------------------------
// Artifact — write a real example file to the scratchpad for manual inspection.
// (Non-assertive; guarded so a read-only FS never fails the suite.)
// ---------------------------------------------------------------------------

describe('artifact — example .xlsx to scratchpad', () => {
  it('writes model_pl_szablon.xlsx', async () => {
    const buf = await buildWorkbookBuffer(buildThreeScenarioPnLSchema(PARAMS_A), {
      applyConsultantStyling: true,
      meta: { organizationName: PARAMS_A.companyName, source: 'threeScenarioPnL template' },
    });
    const out = path.join(
      '/private/tmp/claude-501/-Users-piotrwisniewski-Documents-Antygracity-DRD-consultify/d674029b-b42b-42e4-88ac-c9e561d8f4b0/scratchpad',
      'model_pl_szablon.xlsx'
    );
    try {
      await fs.writeFile(out, buf);
      const stat = await fs.stat(out);
      expect(stat.size).toBeGreaterThan(3000);
    } catch {
      // scratchpad may not be writable in CI — the file is a convenience, not a gate.
      expect(buf.length).toBeGreaterThan(3000);
    }
  });
});
