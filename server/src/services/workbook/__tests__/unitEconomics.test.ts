// @vitest-environment node
/**
 * Anti-false-green tests for the `unitEconomics` model template: a parametric
 * SaaS/e-commerce Unit Economics generator (marża / LTV / CAC / payback).
 *
 * Every assertion targets a REAL .xlsx built by buildWorkbookBuffer() and read
 * back via ExcelJS — no assertion trusts the in-memory schema alone.
 *
 * The proof has three legs (mirrors threeScenarioPnL.test.ts):
 *   (a) read-back: metric cells are FORMULAS with the EXACT expected A1
 *       strings (hand-derived constants below) — this is what catches a wrong
 *       cell address or operator, not just "is it a formula".
 *   (b) MATH VERIFICATION: an independent JS model computes the expected
 *       metrics from the drivers; a self-contained formula evaluator resolves
 *       the ACTUAL workbook formula graph and the two must agree.
 *   (c) the deterministic critic (critiqueWorkbook) scores 100 / passed / 0 issues.
 */

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildWorkbookBuffer } from '../WorkbookBuilder.js';
import { critiqueWorkbook } from '../workbookQualityGate.js';
import { WorkbookSchemaValidator } from '../WorkbookSchema.js';
import { buildUnitEconomicsSchema, type UnitEconomicsParams } from '../templates/unitEconomics.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PARAMS_A: Required<UnitEconomicsParams> = {
  companyName: 'Acme SaaS Sp. z o.o.',
  currencyCode: 'PLN',
  arpu: 250,
  kosztZmienny: 60,
  cac: 900,
  churnMiesieczny: 0.03,
  kosztUtrzymania: 20,
};

const PARAMS_B: UnitEconomicsParams = {
  companyName: 'Globex Commerce Inc.',
  currencyCode: 'USD',
  arpu: 80,
  kosztZmienny: 25,
  cac: 150,
  churnMiesieczny: 0.08,
  kosztUtrzymania: 5,
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
// Independent JS reference model — ground truth for (b).
// ---------------------------------------------------------------------------

interface UEOut {
  grossMarginUnit: number;
  grossMarginMonthly: number;
  contributionMarginPct: number;
  lifetime: number;
  ltv: number;
  ltvCac: number;
  payback: number;
}

function referenceModel(p: Required<UnitEconomicsParams>): UEOut {
  const grossMarginUnit = p.arpu - p.kosztZmienny;
  const grossMarginMonthly = p.arpu - p.kosztZmienny - p.kosztUtrzymania;
  const contributionMarginPct = (p.arpu - p.kosztZmienny) / p.arpu;
  const lifetime = p.churnMiesieczny > 0 ? 1 / p.churnMiesieczny : 0;
  const ltv = grossMarginMonthly * lifetime;
  const ltvCac = ltv / p.cac;
  const payback = grossMarginMonthly > 0 ? p.cac / grossMarginMonthly : 0;
  return { grossMarginUnit, grossMarginMonthly, contributionMarginPct, lifetime, ltv, ltvCac, payback };
}

// ---------------------------------------------------------------------------
// Self-contained formula evaluator over the ACTUAL workbook (same grammar as
// threeScenarioPnL.test.ts, extended with IF()).
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

    // Comparison layer (>, <, >=, <=, =) — used inside IF() conditions only.
    function parseComparison(): number {
      const lhs = parseExpression();
      skipWs();
      const two = s.slice(i, i + 2);
      const one = s.slice(i, i + 1);
      let op: string | null = null;
      if (two === '>=' || two === '<=') {
        op = two;
        i += 2;
      } else if (one === '>' || one === '<' || one === '=') {
        op = one;
        i += 1;
      }
      if (!op) return lhs;
      const rhs = parseExpression();
      switch (op) {
        case '>':
          return lhs > rhs ? 1 : 0;
        case '<':
          return lhs < rhs ? 1 : 0;
        case '>=':
          return lhs >= rhs ? 1 : 0;
        case '<=':
          return lhs <= rhs ? 1 : 0;
        case '=':
          return lhs === rhs ? 1 : 0;
        default:
          throw new Error(`bad comparison op ${op}`);
      }
    }

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
          i++; // consume '('
          if (ident === 'MAX') {
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
          if (ident === 'IF') {
            const cond = parseComparison();
            skipWs();
            if (peek() === ',') i++;
            const thenStart = i;
            // Parse the "then" expression up to the next top-level comma.
            const thenVal = parseExpression();
            skipWs();
            let elseVal = 0;
            if (peek() === ',') {
              i++;
              elseVal = parseExpression();
            }
            skipWs();
            if (peek() === ')') i++;
            void thenStart;
            return cond !== 0 ? thenVal : elseVal;
          }
          throw new Error(`unsupported fn ${ident} in ${formula}`);
        }
        // not a function — must be a bare same-sheet ref like B2; back up.
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
        i++; // closing quote
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

  return { cellValue };
}

// ---------------------------------------------------------------------------
// (schema) — the template's output validates against the canonical validator
// ---------------------------------------------------------------------------

describe('unitEconomics — schema validity', () => {
  it('produces a WorkbookSchema that passes the canonical validator', () => {
    const schema = buildUnitEconomicsSchema(PARAMS_A);
    const parsed = WorkbookSchemaValidator.safeParse(schema);
    expect(parsed.success).toBe(true);
    expect(schema.sheets.map((s) => s.name)).toEqual(['Założenia', 'Unit Economics']);
  });
});

// ---------------------------------------------------------------------------
// (a) read-back — real .xlsx, EXACT formula strings (hand-derived), formats
// ---------------------------------------------------------------------------

describe('(a) read-back — metrics are formulas with the EXACT expected A1 refs', () => {
  it('every metric cell on Unit Economics is a FORMULA (no magic-numbers)', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Unit Economics')!;
    for (let r = 2; r <= 8; r++) {
      const f = formulaOf(ws, `B${r}`);
      expect(f, `B${r} should be a formula`).toBeTruthy();
    }
  });

  it('formula strings reference the exact expected Założenia cells + operators', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(PARAMS_A));
    const ws = (await load(buf)).getWorksheet('Unit Economics')!;

    // Hand-derived expected formula strings — this is what catches a wrong
    // address or operator that a mere truthy-formula check would miss.
    expect(formulaOf(ws, 'B2')).toBe("'Założenia'!$B$2-'Założenia'!$B$3");
    expect(formulaOf(ws, 'B3')).toBe("'Założenia'!$B$2-'Założenia'!$B$3-'Założenia'!$B$6");
    expect(formulaOf(ws, 'B4')).toBe("('Założenia'!$B$2-'Założenia'!$B$3)/'Założenia'!$B$2");
    expect(formulaOf(ws, 'B5')).toBe("IF('Założenia'!$B$5>0,1/'Założenia'!$B$5,0)");
    expect(formulaOf(ws, 'B6')).toBe('B3*B5');
    expect(formulaOf(ws, 'B7')).toBe("B6/'Założenia'!$B$4");
    expect(formulaOf(ws, 'B8')).toBe("IF(B3>0,'Założenia'!$B$4/B3,0)");
  });

  it('accounting currency and percent formats are present on the real cells', async () => {
    const buf = await buildWorkbookBuffer(buildUnitEconomicsSchema(PARAMS_A), {
      applyConsultantStyling: true,
    });
    const ws = (await load(buf)).getWorksheet('Unit Economics')!;
    const marginFmt = ws.getCell('B2').numFmt ?? '';
    expect(marginFmt).toContain('zł');
    expect(marginFmt).toContain('[Red]');
    expect(ws.getCell('B4').numFmt ?? '').toContain('%');
  });

  it('LTV/CAC row is marked isSummary and named ranges + data-validation exist on Założenia', async () => {
    const schema = buildUnitEconomicsSchema(PARAMS_A);
    const ueSheet = schema.sheets.find((s) => s.name === 'Unit Economics')!;
    expect(ueSheet.rows[5].isSummary).toBe(true); // row index 5 → Excel row 7 → LTV/CAC

    const buf = await buildWorkbookBuffer(schema);
    const wb = await load(buf);
    const model: any[] = (wb as any).definedNames?.model ?? [];
    expect(model.length).toBeGreaterThanOrEqual(5); // 5 driver rows on Założenia

    const zws = wb.getWorksheet('Założenia')!;
    const dv: any = zws.getCell('B5').dataValidation; // churn %
    expect(dv).toBeDefined();
    expect(dv.type).toBe('decimal');
  });
});

// ---------------------------------------------------------------------------
// (b) MATH VERIFICATION — evaluate the real formula graph, compare to JS model
// ---------------------------------------------------------------------------

describe('(b) math verification — evaluated workbook == independent JS model', () => {
  it('all 7 metrics match the reference model (PARAMS_A)', async () => {
    const wb = await load(await buildWorkbookBuffer(buildUnitEconomicsSchema(PARAMS_A)));
    const ev = makeEvaluator(wb);
    const ref = referenceModel(PARAMS_A);

    expect(ev.cellValue('Unit Economics', 'B2')).toBeCloseTo(ref.grossMarginUnit, 6);
    expect(ev.cellValue('Unit Economics', 'B3')).toBeCloseTo(ref.grossMarginMonthly, 6);
    expect(ev.cellValue('Unit Economics', 'B4')).toBeCloseTo(ref.contributionMarginPct, 8);
    expect(ev.cellValue('Unit Economics', 'B5')).toBeCloseTo(ref.lifetime, 6);
    expect(ev.cellValue('Unit Economics', 'B6')).toBeCloseTo(ref.ltv, 4);
    expect(ev.cellValue('Unit Economics', 'B7')).toBeCloseTo(ref.ltvCac, 6);
    expect(ev.cellValue('Unit Economics', 'B8')).toBeCloseTo(ref.payback, 6);

    // Sanity on the concrete numbers (guards against a reference-model bug too):
    // grossMarginUnit = 250-60 = 190; grossMarginMonthly = 190-20 = 170
    expect(ref.grossMarginUnit).toBeCloseTo(190, 6);
    expect(ref.grossMarginMonthly).toBeCloseTo(170, 6);
    // lifetime = 1/0.03 = 33.333...; ltv = 170 * 33.333 = 5666.667
    expect(ref.lifetime).toBeCloseTo(33.3333333, 4);
    expect(ref.ltv).toBeCloseTo(5666.6667, 2);
    // ltvCac = 5666.667/900 = 6.2963; payback = 900/170 = 5.2941
    expect(ref.ltvCac).toBeCloseTo(6.2962963, 4);
    expect(ref.payback).toBeCloseTo(5.2941176, 4);
  });

  it('all 7 metrics match the reference model (PARAMS_B, different currency/drivers)', async () => {
    const paramsB: Required<UnitEconomicsParams> = { ...PARAMS_A, ...PARAMS_B } as Required<UnitEconomicsParams>;
    const wb = await load(await buildWorkbookBuffer(buildUnitEconomicsSchema(PARAMS_B)));
    const ev = makeEvaluator(wb);
    const ref = referenceModel(paramsB);

    expect(ev.cellValue('Unit Economics', 'B2')).toBeCloseTo(ref.grossMarginUnit, 6);
    expect(ev.cellValue('Unit Economics', 'B3')).toBeCloseTo(ref.grossMarginMonthly, 6);
    expect(ev.cellValue('Unit Economics', 'B4')).toBeCloseTo(ref.contributionMarginPct, 8);
    expect(ev.cellValue('Unit Economics', 'B5')).toBeCloseTo(ref.lifetime, 6);
    expect(ev.cellValue('Unit Economics', 'B6')).toBeCloseTo(ref.ltv, 4);
    expect(ev.cellValue('Unit Economics', 'B7')).toBeCloseTo(ref.ltvCac, 6);
    expect(ev.cellValue('Unit Economics', 'B8')).toBeCloseTo(ref.payback, 6);
  });

  it('churn=0 edge case: lifetime/LTV/payback formulas resolve to 0 via IF (no div/0)', async () => {
    const zeroChurn: UnitEconomicsParams = { ...PARAMS_A, churnMiesieczny: 0 };
    const wb = await load(await buildWorkbookBuffer(buildUnitEconomicsSchema(zeroChurn)));
    const ev = makeEvaluator(wb);
    expect(ev.cellValue('Unit Economics', 'B5')).toBe(0); // lifetime
    expect(ev.cellValue('Unit Economics', 'B6')).toBe(0); // ltv = grossMarginMonthly * 0
  });
});

// ---------------------------------------------------------------------------
// (c) critic — score 100, passed, 0 issues
// ---------------------------------------------------------------------------

describe('(c) quality gate — template is critic-clean', () => {
  it('critiqueWorkbook → score 100 across default + both param sets', () => {
    for (const p of [undefined, PARAMS_A, PARAMS_B]) {
      const report = critiqueWorkbook(buildUnitEconomicsSchema(p));
      expect(report.issues, `params=${JSON.stringify(p)}`).toEqual([]);
      expect(report.score, `params=${JSON.stringify(p)}`).toBe(100);
      expect(report.passed).toBe(true);
    }
  });
});
