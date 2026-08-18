/**
 * V8 Finance mutation-surface inventory — STATIC guard, no DB required.
 *
 * WHY THIS FILE EXISTS (LANE B-FRESH W2 PHASE 2)
 * `requireActiveMembership` was mounted on exactly 5 handlers across the 4
 * V8 finance route files (finance-intelligence, finance-planning,
 * finance-valuation, finance-value — the last one internally exporting the
 * "/finance/value-tracking" router). The denominator behind that mount was
 * counted by hand once (74 handlers total: 11 READ + 58 CALCULATOR + 5
 * BUSINESS-WRITE) and independently re-verified. A hand count is only as
 * good as the day it was taken — this file makes it a STANDING assertion:
 * it re-parses the four route files on every run and fails loudly the
 * moment either (a) the handler count in any file drifts from the pinned
 * denominator, or (b) the exact set of `requireActiveMembership`-guarded
 * paths in `finance-value.routes.ts` changes, or (c) any write primitive
 * (`dbRun`/`DbPromise.run`/a known writer service function) becomes
 * reachable from finance-intelligence/finance-planning/finance-valuation,
 * which today have ZERO business writers by design.
 *
 * THE EXACT DENOMINATOR THIS FILE PINS:
 *   finance-intelligence.routes.ts : 13 handlers = 2 READ + 11 CALCULATOR + 0 BUSINESS-WRITE
 *   finance-planning.routes.ts     : 17 handlers = 0 READ + 17 CALCULATOR + 0 BUSINESS-WRITE
 *   finance-valuation.routes.ts    : 19 handlers = 0 READ + 19 CALCULATOR + 0 BUSINESS-WRITE
 *   finance-value.routes.ts        : 25 handlers = 9 READ + 11 CALCULATOR + 5 BUSINESS-WRITE
 *   TOTAL                          : 74 handlers = 11 READ + 58 CALCULATOR + 5 BUSINESS-WRITE
 *
 * CLASSIFICATION RULE USED HERE (must match how the denominator above was
 * derived): a `router.get(...)` handler is READ; a `router.post(...)`
 * handler carrying `requireActiveMembership` in its middleware chain is
 * BUSINESS-WRITE; every other `router.post(...)` handler is CALCULATOR.
 * No PUT/PATCH/DELETE handlers exist in any of the four files today — this
 * file also asserts that, so a future PUT/PATCH/DELETE addition cannot
 * silently slip past this inventory uncounted.
 *
 * THIS TEST MUST FAIL THE BUILD IF:
 *   - anyone adds a POST/PUT/PATCH/DELETE handler to any of the four files
 *     without updating BOTH the source AND this file's pinned counts, or
 *   - anyone removes/adds a `requireActiveMembership` guard in
 *     finance-value.routes.ts without updating the 5-path list below, or
 *   - anyone gives finance-intelligence/finance-planning/finance-valuation
 *     a write primitive (a real DB mutation must never land in a file this
 *     inventory certifies as writer-free).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.resolve(__dirname, '..');

const FILES = {
  intelligence: path.join(ROUTES_DIR, 'finance-intelligence.routes.ts'),
  planning: path.join(ROUTES_DIR, 'finance-planning.routes.ts'),
  valuation: path.join(ROUTES_DIR, 'finance-valuation.routes.ts'),
  value: path.join(ROUTES_DIR, 'finance-value.routes.ts'),
} as const;

interface Handler {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  routePath: string;
  guarded: boolean;
}

/**
 * Parses `router.<verb>(\n  '<path>',\n  ...middleware..., asyncHandler(...` blocks.
 * Anchored to start-of-line (`^router.`) so it only picks up top-level route
 * registrations, matching the exact convention every handler in these four
 * files follows (verified by hand against all 74 before pinning this test).
 */
function extractHandlers(source: string): Handler[] {
  const re = /^router\.(get|post|put|patch|delete)\(\s*\n\s*'([^']+)',\s*\n([\s\S]*?)asyncHandler/gm;
  const handlers: Handler[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const method = match[1] as Handler['method'];
    const routePath = match[2];
    const middlewareChunk = match[3];
    handlers.push({
      method,
      routePath,
      guarded: /requireActiveMembership/.test(middlewareChunk),
    });
  }
  return handlers;
}

function readSource(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function classify(handlers: Handler[]): { read: number; calculator: number; businessWrite: number } {
  let read = 0;
  let calculator = 0;
  let businessWrite = 0;
  for (const h of handlers) {
    if (h.guarded) {
      businessWrite++;
    } else if (h.method === 'get') {
      read++;
    } else {
      calculator++;
    }
  }
  return { read, calculator, businessWrite };
}

/**
 * Known write-primitive symbols behind the two services files 1-3 import
 * from (financialAnalysisService.ts, financialStatementPackService.ts) —
 * the ONLY two services confirmed (by direct inspection of every `dbRun(`
 * call site) to contain any DB write primitive among everything files 1-3
 * transitively touch. Files 1-3 must import ONLY the read-side names
 * (`getAnalysisRatios`, `listAnalyses`, `getStatementPackDetail`,
 * `loadPackValueMaps`) — never any of these.
 */
const KNOWN_WRITER_SYMBOLS = [
  // financialAnalysisService.ts — each confirmed via a `dbRun(` call inside its body.
  'createAnalysis',
  'updateAnalysis',
  'archiveAnalysis',
  'approveAnalysis',
  'runFullAnalysis',
  // financialStatementPackService.ts — each confirmed via a `dbRun(` call inside its body.
  'recomputeStatementPack',
  'syncStatementToPack',
  'detachStatementFromPack',
  'recomputeStatementPackForOrganization',
  'assignStatementToExistingPack',
] as const;

describe('V8 Finance mutation-surface inventory (static, no DB)', () => {
  const sources = {
    intelligence: readSource(FILES.intelligence),
    planning: readSource(FILES.planning),
    valuation: readSource(FILES.valuation),
    value: readSource(FILES.value),
  };
  const handlers = {
    intelligence: extractHandlers(sources.intelligence),
    planning: extractHandlers(sources.planning),
    valuation: extractHandlers(sources.valuation),
    value: extractHandlers(sources.value),
  };

  it('finance-intelligence.routes.ts: exactly 13 handlers = 2 READ + 11 CALCULATOR + 0 BUSINESS-WRITE', () => {
    expect(handlers.intelligence.length, 'finance-intelligence.routes.ts handler count drifted from the pinned denominator of 13').toBe(13);
    expect(classify(handlers.intelligence)).toEqual({ read: 2, calculator: 11, businessWrite: 0 });
  });

  it('finance-planning.routes.ts: exactly 17 handlers = 0 READ + 17 CALCULATOR + 0 BUSINESS-WRITE', () => {
    expect(handlers.planning.length, 'finance-planning.routes.ts handler count drifted from the pinned denominator of 17').toBe(17);
    expect(classify(handlers.planning)).toEqual({ read: 0, calculator: 17, businessWrite: 0 });
  });

  it('finance-valuation.routes.ts: exactly 19 handlers = 0 READ + 19 CALCULATOR + 0 BUSINESS-WRITE', () => {
    expect(handlers.valuation.length, 'finance-valuation.routes.ts handler count drifted from the pinned denominator of 19').toBe(19);
    expect(classify(handlers.valuation)).toEqual({ read: 0, calculator: 19, businessWrite: 0 });
  });

  it('finance-value.routes.ts: exactly 25 handlers = 9 READ + 11 CALCULATOR + 5 BUSINESS-WRITE', () => {
    expect(handlers.value.length, 'finance-value.routes.ts handler count drifted from the pinned denominator of 25').toBe(25);
    expect(classify(handlers.value)).toEqual({ read: 9, calculator: 11, businessWrite: 5 });
  });

  it('TOTAL across all four V8 finance route files is exactly 74 handlers = 11 READ + 58 CALCULATOR + 5 BUSINESS-WRITE', () => {
    const all = [...handlers.intelligence, ...handlers.planning, ...handlers.valuation, ...handlers.value];
    expect(
      all.length,
      'Total V8 finance handler count drifted from the pinned denominator of 74. A handler was ' +
        'added to (or removed from) one of finance-intelligence/finance-planning/finance-valuation/' +
        'finance-value.routes.ts without updating this inventory.'
    ).toBe(74);
    const totals = classify(all);
    expect(totals).toEqual({ read: 11, calculator: 58, businessWrite: 5 });
  });

  it('finance-value.routes.ts: exactly 5 handlers carry requireActiveMembership, and they are exactly the 5 known BUSINESS-WRITE paths', () => {
    const guardedPaths = handlers.value
      .filter((h) => h.guarded)
      .map((h) => `${h.method.toUpperCase()} ${h.routePath}`)
      .sort();
    expect(guardedPaths).toEqual(
      [
        'POST /capture/gates',
        'POST /capture/gates/:id/advance',
        'POST /ledger/baselines',
        'POST /ledger/entries',
        'POST /post-investment-reviews',
      ].sort()
    );
  });

  it('no file in this quartet has grown a PUT/PATCH/DELETE handler (none exist today; a future one must update this inventory)', () => {
    const all = [...handlers.intelligence, ...handlers.planning, ...handlers.valuation, ...handlers.value];
    const disallowed = all.filter((h) => h.method === 'put' || h.method === 'patch' || h.method === 'delete');
    expect(disallowed, `unexpected PUT/PATCH/DELETE handlers found: ${JSON.stringify(disallowed)}`).toEqual([]);
  });

  it.each([
    ['finance-intelligence.routes.ts', 'intelligence'] as const,
    ['finance-planning.routes.ts', 'planning'] as const,
    ['finance-valuation.routes.ts', 'valuation'] as const,
  ])('%s: zero write primitives reachable from its handlers (no dbRun/DbPromise.run, no known writer import)', (_label, key) => {
    const source = sources[key];

    // Structural check: these 3 files must never import the app's DB-write
    // wrapper at all — every read they need (getAnalysisRatios, listAnalyses,
    // getStatementPackDetail, loadPackValueMaps) comes through service-layer
    // functions, not a direct DbPromise handle.
    expect(source, `${key} must not import DbPromise directly`).not.toMatch(/from ['"].*utils\/DbPromise\.js['"]/);
    expect(source, `${key} must not call dbRun(...)`).not.toMatch(/\bdbRun\(/);
    expect(source, `${key} must not call DbPromise\\.run(...)`).not.toMatch(/DbPromise\.run\(/);
    expect(source, `${key} must not contain a raw INSERT/UPDATE/DELETE statement`).not.toMatch(
      /\b(INSERT INTO|DELETE FROM)\b/
    );
    // UPDATE alone is too common a word to bare-match safely (e.g. prose in
    // comments); scope it to the SQL shape actually used elsewhere in this
    // codebase's writers.
    expect(source, `${key} must not contain a raw UPDATE ... SET statement`).not.toMatch(/UPDATE\s+\w+\s+SET\b/);

    // Explicit known-writer-symbol check, per the mandate: list the writer
    // names and assert none of them appear as an imported/called identifier.
    for (const writer of KNOWN_WRITER_SYMBOLS) {
      const re = new RegExp(`\\b${writer}\\b`);
      expect(source, `${key} must not reference the known writer symbol "${writer}"`).not.toMatch(re);
    }
  });

  it('finance-intelligence.routes.ts imports ONLY the confirmed read-side names from the two writer-capable services', () => {
    const source = sources.intelligence;
    const financialAnalysisImport = source.match(
      /import\s*{([^}]*)}\s*from\s*['"]\.\.\/\.\.\/services\/financialAnalysisService\.js['"]/
    );
    expect(financialAnalysisImport, 'expected an import from financialAnalysisService.js').not.toBeNull();
    const analysisNames = (financialAnalysisImport?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(analysisNames.sort()).toEqual(['getAnalysisRatios', 'listAnalyses'].sort());

    const packImport = source.match(
      /import\s*{([^}]*)}\s*from\s*['"]\.\.\/\.\.\/services\/financialStatementPackService\.js['"]/
    );
    expect(packImport, 'expected an import from financialStatementPackService.js').not.toBeNull();
    const packNames = (packImport?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(packNames.sort()).toEqual(['getStatementPackDetail', 'loadPackValueMaps'].sort());
  });
});
