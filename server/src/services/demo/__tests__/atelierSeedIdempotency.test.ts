/**
 * Atelier Toys canonical seed — idempotency proof.
 *
 * The canonical Atelier demo seed (`seedAtelierToysDemoDataset`) is designed to
 * be safe to re-run against a live tenant WITHOUT deleting anything: every write
 * is an `INSERT ... ON CONFLICT(id) DO UPDATE` keyed on a STABLE id built by
 * `makeId(orgId, entityType, slug)`. Re-running therefore updates rows in place
 * instead of duplicating them.
 *
 * This test proves that contract deterministically, with no live Postgres:
 *   - every DB write is captured in memory,
 *   - the seed is run TWICE with the same org id + fixed anchor date,
 *   - we assert run #2 targets exactly the same set of stable ids as run #1,
 *     per table, with zero net-new ids.
 *
 * If any write ever regresses to a non-idempotent shape (random ids, no
 * ON CONFLICT, org-scoped INSERT without a stable key) this test fails, because
 * run #2 would introduce ids that run #1 never touched.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

interface CapturedWrite {
  run: 1 | 2;
  table: string;
  id: string | null;
  hasOnConflict: boolean;
}

const writes: CapturedWrite[] = [];
let currentRun: 1 | 2 = 1;

function parseWrite(sql: string, params: unknown[]): CapturedWrite | null {
  const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/i);
  if (!match) return null;
  const table = match[1];
  const columns = match[2]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  // The stable key is whatever column(s) the upsert conflicts on — usually a
  // single `id`, but some tables use a domain key (v8_output_artifacts ->
  // artifact_id) or a COMPOSITE key (my_idea_maps -> (user_id, idea_id)).
  // Read it straight from ON CONFLICT(...).
  const conflictMatch = sql.match(/ON\s+CONFLICT\s*\(\s*([a-zA-Z0-9_,\s]+?)\s*\)/i);
  const hasOnConflict = Boolean(conflictMatch);
  const conflictCols = conflictMatch
    ? conflictMatch[1]
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  // Build a stable tracking key from the conflict columns' bound params. For a
  // single-column conflict this is that column's value; for a composite key it
  // is the joined tuple — either way it is the id a re-run would upsert onto.
  let id: string | null = null;
  if (conflictCols.length > 0) {
    const parts: string[] = [];
    let resolved = true;
    for (const col of conflictCols) {
      const idx = columns.findIndex((c) => c.toLowerCase() === col.toLowerCase());
      if (idx < 0) {
        resolved = false;
        break;
      }
      parts.push(String(params[idx]));
    }
    if (resolved) id = parts.join('::');
  } else {
    const idx = columns.findIndex((c) => c.toLowerCase() === 'id');
    if (idx >= 0) id = String(params[idx]);
  }

  return {
    run: currentRun,
    table,
    id,
    hasOnConflict,
  };
}

// Answer "exists" for every schema probe so every guarded write branch runs
// (matches a fully-migrated DB — the widest possible surface to test).
function handleSchemaProbe(sql: string): { handled: boolean; result?: unknown } {
  if (/information_schema\.tables/i.test(sql)) {
    return { handled: true, result: { exists: true } };
  }
  if (/information_schema\.columns/i.test(sql) && /EXISTS/i.test(sql)) {
    return { handled: true, result: { exists: true } };
  }
  return { handled: false };
}

vi.mock('../../../utils/DbPromise.js', () => {
  const get = vi.fn(async (sql: string) => {
    const probe = handleSchemaProbe(sql);
    if (probe.handled) return probe.result;
    return null;
  });
  const all = vi.fn(async () => []);
  const run = vi.fn(async (sql: string, params: unknown[] = []) => {
    const parsed = parseWrite(sql, params as unknown[]);
    if (parsed) writes.push(parsed);
    return { success: true, changes: 1 };
  });
  return {
    get,
    all,
    run,
    transaction: vi.fn(async () => ({ success: true, results: [] })),
    tableExists: vi.fn(async () => true),
    columnExists: vi.fn(async () => true),
    exec: vi.fn(async () => ({ success: true })),
    safeAll: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    DbPromise: {},
    default: {},
  };
});

vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async () => undefined),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import { seedAtelierToysDemoDataset } from '../demoSeedService.js';

const ORG_ID = 'demo-atelier-idempotency-test';
// Fixed anchor so any relative-date materialization is identical across runs.
const ANCHOR = '2026-06-01T00:00:00.000Z';

/**
 * Tables written by process-global, memoized infrastructure rather than by the
 * tenant seed itself.
 *
 * `financial_statement_lines` holds the canonical line registry — org-agnostic
 * system rows (`organization_id = NULL`) shared by every tenant. The Atelier
 * Finance seed calls `ensureCanonicalRegistryInDatabase()` to guarantee the FK
 * target exists, and that helper memoizes per process (`lastVerifiedVersion`),
 * so it writes on the first call and correctly no-ops afterwards. Run #2 of the
 * seed therefore touches this table zero times.
 *
 * That is the desired behaviour, not drift: skipping it here keeps the
 * idempotency contract asserted over the rows the seed actually owns.
 */
const PROCESS_MEMOIZED_TABLES = new Set(['financial_statement_lines']);

function tenantTables(run: 1 | 2): Set<string> {
  return new Set(
    writes.filter((w) => w.run === run && !PROCESS_MEMOIZED_TABLES.has(w.table)).map((w) => w.table)
  );
}

function idsFor(run: 1 | 2, table: string): Set<string> {
  return new Set(
    writes
      .filter((w) => w.run === run && w.table === table && w.id != null)
      .map((w) => w.id as string)
  );
}

describe('Atelier Toys canonical seed idempotency', () => {
  beforeAll(async () => {
    writes.length = 0;
    currentRun = 1;
    await seedAtelierToysDemoDataset({ organizationId: ORG_ID, anchorDate: ANCHOR, locale: 'en' });
    currentRun = 2;
    await seedAtelierToysDemoDataset({ organizationId: ORG_ID, anchorDate: ANCHOR, locale: 'en' });
  });

  it('run #2 targets exactly the same stable ids as run #1 (no duplicates, no drift)', () => {
    const run1Tables = tenantTables(1);
    const run2Tables = tenantTables(2);
    // Both runs touch the same set of tenant tables.
    expect([...run2Tables].sort()).toEqual([...run1Tables].sort());

    for (const table of run1Tables) {
      const ids1 = idsFor(1, table);
      const ids2 = idsFor(2, table);
      const netNew = [...ids2].filter((id) => !ids1.has(id));
      const dropped = [...ids1].filter((id) => !ids2.has(id));
      expect(netNew, `table ${table} gained new ids on re-run: ${netNew.join(', ')}`).toEqual([]);
      expect(dropped, `table ${table} dropped ids on re-run: ${dropped.join(', ')}`).toEqual([]);
    }
  });

  it('every stable-keyed write is an upsert (ON CONFLICT), so re-runs update in place', () => {
    const idWrites = writes.filter((w) => w.run === 1 && w.id != null);
    expect(idWrites.length).toBeGreaterThan(0);
    // id is only captured when we resolved it from an ON CONFLICT key, so by
    // construction every id-bearing write is an upsert. Assert it explicitly so
    // a future non-upsert INSERT (which would leave id null) is visible as a
    // table that writes rows but never through the idempotent path.
    const nonUpserts = idWrites.filter((w) => !w.hasOnConflict);
    const offendingTables = [...new Set(nonUpserts.map((w) => w.table))];
    expect(
      offendingTables,
      `stable-keyed writes without ON CONFLICT would duplicate on re-run: ${offendingTables.join(', ')}`
    ).toEqual([]);
  });

  it('golden-path spine stages all carry stable, re-runnable ids', () => {
    // The stages the demo walkthrough depends on must each write stable ids on
    // BOTH runs — this is the "2x = same state" guarantee for the full story.
    const spineTables = [
      'assessments', // stage 04 DRD diagnosis
      'assessment_reports',
      'interview_sessions', // stage 03 discovery
      'interview_insights',
      'initiatives', // stage 05 portfolio
      'project_kpis', // stage 07 results
      'v8_output_artifacts', // stage 09 deliverables
    ];
    for (const table of spineTables) {
      const ids1 = idsFor(1, table);
      const ids2 = idsFor(2, table);
      expect(ids1.size, `${table} produced no stable ids on run #1`).toBeGreaterThan(0);
      expect([...ids2].sort(), `${table} drifted between runs`).toEqual([...ids1].sort());
    }
  });
});
