/**
 * FIN-005 P2 — a second seed run must be a byte-identical NO-OP.
 *
 * The previous implementation was idempotent only in the weak sense: re-running
 * did not create duplicate rows, but every upsert ended with
 * `updated_at=CURRENT_TIMESTAMP`, so run #2 mutated every row even when nothing
 * had changed. On a live demo tenant that means a re-seed rewrites the whole
 * Finance fixture, invalidating "last modified" and any audit trail built on it.
 *
 * The contract proved here:
 *   - every upsert's `DO UPDATE` is guarded by `IS DISTINCT FROM`, so Postgres
 *     performs zero row updates when nothing differs (or is `DO NOTHING`);
 *   - every phase-2 promotion `UPDATE` carries the same guard;
 *   - run #2 issues exactly the same statements with exactly the same bound
 *     parameters as run #1 — an identical payload, not a merely equivalent one;
 *   - the database contents after run #2 are deep-equal to the contents after
 *     run #1, `updated_at` included.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { fakeDb, type FakeCall } from './helpers/fakeFinanceDb.js';

vi.mock('../../../utils/DbPromise.js', async () => {
  const { createDbPromiseMock } = await import('./helpers/fakeFinanceDb.js');
  const { vi: vitest } = await import('vitest');
  return createDbPromiseMock(vitest as never);
});

vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async () => undefined),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import { upsertAtelierFinanceGoldenFlow } from '../atelierFinanceSeed.js';

const ORG_ID = 'demo-atelier-noop-test';

const FINANCE_TABLES = [
  'financial_statement_packs',
  'financial_statements',
  'financial_statement_values',
  'financial_analyses',
  'financial_statement_ingest_runs',
];

type Snapshot = Record<string, Record<string, unknown>[]>;

function snapshot(): Snapshot {
  const result: Snapshot = {};
  for (const table of FINANCE_TABLES) {
    result[table] = fakeDb
      .rows(table)
      .map((row) => ({ ...row }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return result;
}

/** Normalized, comparable form of a write: what SQL, with what bound values. */
function payload(call: FakeCall): string {
  return JSON.stringify({
    kind: call.kind,
    table: call.table,
    sql: call.sql.replace(/\s+/g, ' ').trim(),
    params: call.params,
  });
}

/**
 * Writes the seed OWNS. `financial_statement_lines` (the org-agnostic canonical
 * line registry) is excluded on purpose: `ensureCanonicalRegistryInDatabase()`
 * memoizes per process, so it writes on run #1 and correctly no-ops afterwards —
 * the same exception `atelierSeedIdempotency.test.ts` documents.
 */
function writesFor(run: number): FakeCall[] {
  return fakeDb.calls.filter(
    (call) =>
      call.run === run &&
      (call.kind === 'insert' || call.kind === 'update') &&
      FINANCE_TABLES.includes(call.table)
  );
}

describe('FIN-005 — the second seed run changes nothing', () => {
  let afterRun1: Snapshot;
  let afterRun2: Snapshot;

  beforeAll(async () => {
    fakeDb.reset();

    fakeDb.run = 1;
    const first = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });
    expect(first.status).toBe('complete');
    afterRun1 = snapshot();

    fakeDb.run = 2;
    const second = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });
    expect(second.status).toBe('complete');
    afterRun2 = snapshot();
  });

  it('every upsert guards its DO UPDATE with IS DISTINCT FROM', () => {
    const unguarded = writesFor(2)
      .filter((call) => call.kind === 'insert')
      .filter((call) => FINANCE_TABLES.includes(call.table))
      .filter((call) => !/DO\s+NOTHING/i.test(call.sql))
      .filter((call) => !/IS\s+DISTINCT\s+FROM/i.test(call.sql));

    expect(
      unguarded.map((call) => call.table),
      'these upserts would rewrite updated_at on an unchanged row'
    ).toEqual([]);
  });

  it('every promotion UPDATE guards its WHERE with IS DISTINCT FROM', () => {
    const updates = writesFor(1).filter((call) => call.kind === 'update');
    // 3 statements + 1 analysis + 1 pack.
    expect(updates.length).toBe(5);
    for (const update of updates) {
      expect(update.sql, `unguarded promotion on ${update.table}`).toMatch(/IS\s+DISTINCT\s+FROM/i);
    }
  });

  it('run #2 issues the identical write set with identical bound values', () => {
    const first = writesFor(1).map(payload).sort();
    const second = writesFor(2).map(payload).sort();
    expect(second).toEqual(first);
  });

  it('run #2 targets exactly the same ids, per table, with no net-new rows', () => {
    for (const table of FINANCE_TABLES) {
      const idsRun1 = new Set(afterRun1[table].map((row) => String(row.id)));
      const idsRun2 = new Set(afterRun2[table].map((row) => String(row.id)));
      expect([...idsRun2].sort(), `${table} drifted between runs`).toEqual([...idsRun1].sort());
    }
  });

  it('run #2 leaves every stored row byte-identical, updated_at included', () => {
    expect(afterRun2).toEqual(afterRun1);
  });

  it('the fixture is still fully READY after the second run', () => {
    for (const row of afterRun2.financial_statements) {
      expect(row.status).toBe('confirmed');
      expect(row.validation_status).toBe('pass');
      expect(row.readiness_status).toBe('ready');
      expect(Number(row.readiness_score)).toBe(100);
    }
    const pack = afterRun2.financial_statement_packs[0];
    expect(pack.pack_status).toBe('confirmed');
    expect(pack.pack_readiness_status).toBe('ready');
    expect(afterRun2.financial_analyses[0].status).toBe('APPROVED');
  });

  it('a real change is still applied (the guard does not freeze the fixture)', async () => {
    // Corrupt one persisted value, then re-seed: the guard must let the
    // correction through, and the statement must re-earn READY.
    const target = fakeDb
      .rows('financial_statement_values')
      .find((row) => String(row.id).includes('atelier-fy2014-pl--revenue'));
    expect(target).toBeTruthy();
    (target as Record<string, unknown>).value = 1;

    fakeDb.run = 3;
    const third = await upsertAtelierFinanceGoldenFlow({
      organizationId: ORG_ID,
      createdBy: 'user-cfo',
    });

    expect(third.status).toBe('complete');
    const repaired = fakeDb
      .rows('financial_statement_values')
      .find((row) => String(row.id).includes('atelier-fy2014-pl--revenue'));
    expect(Number(repaired?.value)).toBe(118_400_000);
  });
});
