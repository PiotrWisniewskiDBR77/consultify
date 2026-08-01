/**
 * FIN-005 P1-A — the READ POOL is STRUCTURALLY unreachable from the seed.
 *
 * ===========================================================================
 * WHY A SOURCE SCAN, AND NOT ANOTHER BEHAVIOURAL TEST
 * ===========================================================================
 * `atelierFinancePrimaryReads.pg.test.ts` proves the behaviour against a real
 * lagging read seam: the fixture verdict, the heal decision and the schema gate
 * all come from the primary. What a behavioural test cannot prove is that the
 * NEXT read someone adds will too.
 *
 * The defect was not a bug in one call site. It was an AFFORDANCE: `SqlReader`
 * had a default (`dbPromiseReader`), so every function that took `read?:
 * SqlReader` silently acquired the read pool the moment a caller omitted the
 * argument — and `findRowsStillClaimingReady`, the function that decides whether
 * to DEMOTE THE FIXTURE, was exactly such a function. Removing the default is
 * the fix; this file is what stops it coming back.
 *
 * THE RULE, STATED ONCE: `atelierFinanceSeed.ts` may call `DbPromise.run` and
 * nothing else. `run` goes to `PostgresDatabase.getPool()` — the primary.
 * `DbPromise.get` and `DbPromise.all` go to `getReadPool()`, which is the
 * replica pool whenever one is configured. Every read in that module now travels
 * through an injected `SqlReader`, and the only producer of one is
 * `openDecisiveReadSession()`.
 *
 * ===========================================================================
 * HOW THIS WAS PROVED RED
 * ===========================================================================
 * Run against the previous commit's `atelierFinanceSeed.ts` and every assertion
 * fails: that file contains `DbPromise.get(` in `tableExists`, `DbPromise.all(`
 * in `getTableColumns` and in `dbPromiseReader`, and two `?? dbPromiseReader`
 * defaults. Re-adding any one of them to the current file fails this suite —
 * which was checked by temporarily restoring `const dbPromiseReader: SqlReader =
 * (sql, params = []) => DbPromise.all(...)`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = fs.readFileSync(path.join(here, '..', 'atelierFinanceSeed.ts'), 'utf8');
const ADAPTER = fs.readFileSync(
  path.join(here, '..', 'atelierFinancePromotionTransaction.ts'),
  'utf8'
);

/** Source with block and line comments stripped — prose must not satisfy a scan. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('FIN-005 P1-A — the seed cannot reach the read pool', () => {
  const seedCode = code(SEED);

  it('never calls DbPromise.get — that is the read pool', () => {
    const hits = seedCode.match(/DbPromise\.get\s*[<(]/g) ?? [];
    expect(hits, `DbPromise.get routes to getReadPool(); found ${hits.length} call(s)`).toEqual([]);
  });

  it('never calls DbPromise.all — that is the read pool too', () => {
    const hits = seedCode.match(/DbPromise\.all\s*[<(]/g) ?? [];
    expect(hits, `DbPromise.all routes to getReadPool(); found ${hits.length} call(s)`).toEqual([]);
  });

  it('still calls DbPromise.run — the writes go to the primary pool, and must keep doing so', () => {
    // The inverse assertion matters as much: a scan that passes because the
    // module stopped touching the database at all would be worthless.
    expect((seedCode.match(/DbPromise\.run\s*\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('has no default reader — a reader is always injected, never acquired by omission', () => {
    expect(seedCode).not.toMatch(/dbPromiseReader/);
    expect(seedCode).not.toMatch(/\?\?\s*dbPromiseReader/);
    // `read` is a REQUIRED field wherever it appears in a params object.
    const optionalReaders = seedCode.match(/\bread\?\s*:\s*SqlReader/g) ?? [];
    expect(optionalReaders, 'an optional `read` is how the read pool got in last time').toEqual([]);
  });

  it('routes the compensation decision through an injected reader', () => {
    // The three functions that decide to WRITE on the strength of a read.
    for (const fn of [
      'async function findRowsStillClaimingReady(params: {',
      'async function healResidualAtelierPromotion(params: {',
      'async function rollbackAtelierPromotions(params: {',
    ]) {
      const start = seedCode.indexOf(fn);
      expect(start, `${fn} not found — has it been renamed?`).toBeGreaterThan(-1);
      const signature = seedCode.slice(start, seedCode.indexOf('}): Promise<', start));
      expect(signature, `${fn} must take a required \`read\``).toMatch(/\bread:\s*SqlReader/);
    }
  });

  it('opens exactly one decisive read session, and closes it in a finally', () => {
    expect((seedCode.match(/openDecisiveReadSession\(/g) ?? []).length).toBe(1);
    expect(seedCode).toMatch(/finally\s*\{\s*await opened\.session\.close\(\);\s*\}/);
  });
});

describe('FIN-005 P1-A — the decisive session is bound to the write pool', () => {
  const adapterCode = code(ADAPTER);

  it('borrows its client from the same door the pinned transaction uses', () => {
    const start = adapterCode.indexOf('export async function openDecisiveReadSession');
    expect(start).toBeGreaterThan(-1);
    const body = adapterCode.slice(
      start,
      adapterCode.indexOf('\nexport async function proveDecisive')
    );
    // `checkOutPinnedClient` is `getPoolClientForPinnedTransaction()`, i.e.
    // `PostgresDatabase.getPool()` — the WRITE pool.
    expect(body).toMatch(/checkOutPinnedClient\(\)/);
    // And it refuses a standby. This is the one field a replica cannot fake.
    expect(body).toMatch(/identity\.inRecovery/);
    expect(body).toMatch(/pg_is_in_recovery\(\) = true/);
  });

  it('reaches DbPromise.all ONLY on the recognised non-PostgreSQL seam', () => {
    const start = adapterCode.indexOf('export async function openDecisiveReadSession');
    const seamBranch = adapterCode.slice(
      start,
      adapterCode.indexOf('let client: PoolClient;', start)
    );
    expect(seamBranch).toMatch(/decision\.outcome === 'seam'/);
    expect(seamBranch).toMatch(/DbPromise\.all/);
    // ...and nowhere after it: the primary branch never mentions DbPromise.
    const primaryBranch = adapterCode.slice(
      adapterCode.indexOf('let client: PoolClient;', start),
      adapterCode.indexOf('export async function proveDecisiveReadsGoToPrimary')
    );
    expect(primaryBranch).not.toMatch(/DbPromise\./);
  });

  it('asks pg_is_in_recovery() on the pinned client too, and refuses a standby there', () => {
    expect(adapterCode).toMatch(/pinned_probe_in_recovery/);
    expect(adapterCode).toMatch(/pinnedInRecovery/);
    expect(adapterCode).toMatch(/the pinned connection is on a STANDBY/);
  });
});
