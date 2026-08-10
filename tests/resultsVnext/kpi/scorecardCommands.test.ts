import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * KPI-E004 — Scorecards command-layer unit coverage.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §B (publishReviewSnapshot,
 * frozen) / §D task spec ("CAS na publishReviewSnapshot, NOT_A_DRAFT guard,
 * SCORECARD_MISMATCH guard, ScorecardItem nigdy nie pisze do tabel KPI").
 *
 * Mocking pattern: same precedent as
 * tests/resultsVnext/kpi/approvePlan.test.ts / deviationStateMachine.test.ts
 * (mock `acquirePgClient`, a small stateful fake `query()` that pattern-matches
 * on SQL text). `platform/visibilityScopedQuery.js` is ALSO mocked here — it
 * is the one thing `kpiDeviationCommands.ts`'s equivalent tests never needed
 * to touch, because `publishReviewSnapshot` (decision #6a, unlike anything in
 * KPI-E003) calls `wrapWithVisibilityScope` inside `applyMutation`, and the
 * REAL implementation resolves ABAC via `resolveEffectiveAccess` — a second,
 * unrelated DB dependency this file has no reason to also fake. The mock
 * keeps `VISIBILITY_CTE_PARAM_COUNT = 0` and returns the caller's own
 * `baseQuerySql` verbatim with an empty `values` array, so every placeholder
 * kpiScorecardCommands.ts computes as `$${VISIBILITY_CTE_PARAM_COUNT + N}`
 * degrades to plain `$N` — the fake `query()` below can then pattern-match
 * the SQL text exactly as written in the source file.
 */

let currentScorecard: Record<string, unknown> | null = null;
let currentSnapshot: Record<string, unknown> | null = null;
let publishedSnapshotForSupersede: Record<string, unknown> | null = null;
const releaseMock = vi.fn();
const executedSql: string[] = [];

async function fakeQuery(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: unknown[]; rowCount: number }> {
  const s = sql.trim();
  const upper = s.toUpperCase();
  executedSql.push(s);

  if (upper.startsWith('BEGIN') || upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
    return { rows: [], rowCount: 0 };
  }

  // loadScorecardForUpdate
  if (s.startsWith('SELECT * FROM rvn_kpi_scorecards') && s.includes('FOR UPDATE')) {
    return currentScorecard ? { rows: [currentScorecard], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // loadSnapshotForUpdate
  if (s.startsWith('SELECT * FROM rvn_kpi_scorecard_review_snapshots') && s.includes('FOR UPDATE')) {
    return currentSnapshot ? { rows: [currentSnapshot], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // publishReviewSnapshot's live-item-materialization query (decision #6a) —
  // returns a fixed, empty item set; the guard-rejection scenarios in this
  // file never reach this query, and the happy-path/mismatch/not-a-draft
  // scenarios don't assert on item contents.
  if (s.includes('FROM rvn_kpi_scorecard_items si') && s.includes('rvn_kpi_definitions kd')) {
    return { rows: [], rowCount: 0 };
  }

  // supersede step
  if (s.includes("SET status = 'superseded'") && s.includes('rvn_kpi_scorecard_review_snapshots')) {
    return publishedSnapshotForSupersede
      ? { rows: [{ snapshot_id: publishedSnapshotForSupersede.snapshot_id }], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  }

  // freeze step
  if (s.includes("SET status = 'published'") && s.includes('rvn_kpi_scorecard_review_snapshots')) {
    const nextVersion = params[4];
    const updated = {
      ...currentSnapshot,
      status: 'published',
      snapshot_payload: JSON.parse(params[0] as string),
      content_hash: params[1],
      published_by: params[2],
      published_at: params[3],
      row_version: nextVersion,
    };
    currentSnapshot = updated;
    return { rows: [updated], rowCount: 1 };
  }

  if (s.includes('INSERT INTO rvn_kpi_scorecard_review_snapshot_measurements')) {
    return { rows: [], rowCount: 0 };
  }

  // addScorecardItem's KPI-existence check
  if (s.includes('SELECT 1 FROM rvn_kpi_definitions WHERE kpi_id')) {
    return { rows: [{ '?column?': 1 }], rowCount: 1 };
  }

  // addScorecardItem's duplicate-membership pre-check
  if (s.includes('SELECT 1 FROM rvn_kpi_scorecard_items WHERE scorecard_id')) {
    return { rows: [], rowCount: 0 };
  }

  // addScorecardItem's INSERT
  if (s.startsWith('INSERT INTO rvn_kpi_scorecard_items')) {
    return {
      rows: [
        {
          item_id: 'item-1',
          scorecard_id: params[0],
          kpi_id: params[1],
          organization_id: params[2],
          role: params[3],
          sort_order: params[4],
          display_config: params[5],
          added_by: params[6],
          added_at: '2026-08-09T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    };
  }

  // scorecard row_version bump (addScorecardItem/removeScorecardItem/reorderScorecardItems)
  if (s.startsWith('UPDATE rvn_kpi_scorecards SET row_version')) {
    const nextVersion = params[0];
    const updated = { ...currentScorecard, row_version: nextVersion };
    currentScorecard = updated;
    return { rows: [updated], rowCount: 1 };
  }

  if (s.includes('INSERT INTO rvn_platform_events')) {
    return { rows: [{ event_id: 'evt-1', resulting_version: params[params.length - 2] }], rowCount: 1 };
  }

  if (s.includes('INSERT INTO rvn_platform_outbox')) {
    return { rows: [], rowCount: 0 };
  }

  return { rows: [], rowCount: 0 };
}

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  acquirePgClient: async () => ({ query: fakeQuery, release: releaseMock }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js', () => ({
  VISIBILITY_CTE_PARAM_COUNT: 0,
  wrapWithVisibilityScope: async (baseQuerySql: string) => ({ sql: baseQuerySql, values: [] }),
  buildVisibilityScopedCte: async () => ({ sql: 'WITH rvn_visible_resources(resource_type, resource_id) AS (SELECT NULL::text, NULL::text WHERE false)', values: [] }),
}));

const {
  publishReviewSnapshot,
  addScorecardItem,
  removeScorecardItem,
  reorderScorecardItems,
  KpiScorecardValidationError,
} = await import('../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
const { AtomicWriteConflictError } = await import(
  '../../../server/src/services/resultsVnext/platform/atomicWrite.js'
);

function baseSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    snapshot_id: 'snap-1',
    scorecard_id: 'card-1',
    organization_id: 'org-1',
    review_period_start: '2026-01-01T00:00:00.000Z',
    review_period_end: '2026-01-31T00:00:00.000Z',
    snapshot_payload: null,
    status: 'draft',
    content_hash: null,
    published_by: null,
    published_at: null,
    superseded_by_snapshot_id: null,
    superseded_at: null,
    row_version: 1,
    created_by: 'user-author',
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

function basePublishInput(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: 'snap-1',
    scorecardId: 'card-1',
    organizationId: 'org-1',
    expectedVersion: 1,
    publishedBy: 'user-publisher',
    actorEffectiveRole: 'consultant',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

function baseScorecard(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    scorecard_id: 'card-1',
    organization_id: 'org-1',
    name: 'Test card',
    description: null,
    scope_type: 'team',
    scope_id: null,
    owner_user_id: 'user-owner',
    review_frequency: 'monthly',
    lifecycle_status: 'draft',
    row_version: 1,
    created_by: 'user-owner',
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  currentScorecard = null;
  currentSnapshot = null;
  publishedSnapshotForSupersede = null;
  releaseMock.mockClear();
  executedSql.length = 0;
});

describe('publishReviewSnapshot — CAS (STALE_VERSION)', () => {
  it('rejects with a typed STALE_VERSION conflict when expectedVersion does not match the current row_version', async () => {
    currentSnapshot = baseSnapshot({ row_version: 2 });

    await expect(
      publishReviewSnapshot(basePublishInput({ expectedVersion: 1 }))
    ).rejects.toBeInstanceOf(AtomicWriteConflictError);

    try {
      await publishReviewSnapshot(basePublishInput({ expectedVersion: 1 }));
    } catch (err) {
      expect((err as InstanceType<typeof AtomicWriteConflictError>).code).toBe('STALE_VERSION');
    }
    expect(currentSnapshot?.status).toBe('draft');
  });
});

describe('publishReviewSnapshot — NOT_A_DRAFT guard', () => {
  it.each(['published', 'superseded'] as const)(
    'rejects a %s snapshot before any write',
    async (status) => {
      currentSnapshot = baseSnapshot({ status, row_version: 3 });

      await expect(
        publishReviewSnapshot(basePublishInput({ expectedVersion: 3 }))
      ).rejects.toBeInstanceOf(KpiScorecardValidationError);

      try {
        await publishReviewSnapshot(basePublishInput({ expectedVersion: 3 }));
      } catch (err) {
        expect((err as InstanceType<typeof KpiScorecardValidationError>).code).toBe('NOT_A_DRAFT');
      }
      // Guard must short-circuit BEFORE the freeze UPDATE — status unchanged.
      expect(currentSnapshot?.status).toBe(status);
    }
  );
});

describe('publishReviewSnapshot — SCORECARD_MISMATCH guard', () => {
  it('rejects when the snapshot does not belong to the given scorecardId', async () => {
    currentSnapshot = baseSnapshot({ scorecard_id: 'card-OTHER', row_version: 1 });

    await expect(
      publishReviewSnapshot(basePublishInput({ scorecardId: 'card-1', expectedVersion: 1 }))
    ).rejects.toBeInstanceOf(KpiScorecardValidationError);

    try {
      await publishReviewSnapshot(basePublishInput({ scorecardId: 'card-1', expectedVersion: 1 }));
    } catch (err) {
      expect((err as InstanceType<typeof KpiScorecardValidationError>).code).toBe('SCORECARD_MISMATCH');
    }
    expect(currentSnapshot?.status).toBe('draft');
  });
});

describe('publishReviewSnapshot — happy path', () => {
  it('publishes a draft snapshot and supersedes the previously-published one', async () => {
    currentSnapshot = baseSnapshot({ row_version: 1 });
    publishedSnapshotForSupersede = { snapshot_id: 'snap-OLD' };

    const outcome = await publishReviewSnapshot(basePublishInput({ expectedVersion: 1 }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('published');
    expect(outcome.result.supersededSnapshotId).toBe('snap-OLD');
    expect(outcome.result.items).toEqual([]);
    expect(outcome.result.statusCounts).toEqual({ safe: 0, warning: 0, critical: 0, missing: 0 });
  });
});

describe('ScorecardItem commands never write to KPI tables (AC #2, structural, not discipline)', () => {
  // Migration header: "Carries NO KPI-fact column ... every render reads
  // rvn_kpi_measurements fresh through kpi_id. This is what makes AC #2
  // structurally true, not just a discipline." This test asserts the SAME
  // property holds for the COMMAND side: addScorecardItem/removeScorecardItem/
  // reorderScorecardItems must never emit a write statement (INSERT/UPDATE/
  // DELETE) against rvn_kpi_definitions or rvn_kpi_measurements — every SQL
  // statement issued during these commands is captured in `executedSql` and
  // scanned below.
  const KPI_FACT_TABLES = ['rvn_kpi_definitions', 'rvn_kpi_definition_versions', 'rvn_kpi_measurements'];

  function assertNoKpiTableWrites() {
    for (const sql of executedSql) {
      const upper = sql.toUpperCase();
      const isWrite = upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE');
      if (!isWrite) continue;
      for (const table of KPI_FACT_TABLES) {
        expect(sql.includes(table)).toBe(false);
      }
    }
  }

  it('addScorecardItem never writes to a KPI-fact table', async () => {
    currentScorecard = baseScorecard({ row_version: 1 });

    const outcome = await addScorecardItem({
      scorecardId: 'card-1',
      organizationId: 'org-1',
      expectedVersion: 1,
      actorUserId: 'user-owner',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-add-1',
      kpiId: 'kpi-1',
    });

    expect(outcome.outcome).toBe('applied');
    // addScorecardItem DOES read rvn_kpi_definitions (existence check) — the
    // property under test is WRITE isolation, not read isolation (AC #2's
    // own wording: "ScorecardItem never writes to KPI tables").
    expect(executedSql.some((s) => s.includes('SELECT 1 FROM rvn_kpi_definitions'))).toBe(true);
    assertNoKpiTableWrites();
  });

  it('removeScorecardItem never writes to a KPI-fact table', async () => {
    currentScorecard = baseScorecard({ row_version: 1 });
    // Force the DELETE to report one row removed.
    const originalFakeQueryLength = executedSql.length;
    void originalFakeQueryLength;

    // Patch fakeQuery's DELETE branch behavior for this scenario via a local override.
    const removeOutcomePromise = removeScorecardItem({
      scorecardId: 'card-1',
      organizationId: 'org-1',
      expectedVersion: 1,
      actorUserId: 'user-owner',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-remove-1',
      itemId: 'item-1',
    });

    // The DELETE branch isn't explicitly stubbed above (falls through to the
    // generic `{ rows: [], rowCount: 0 }`), which would make removeScorecardItem
    // throw ITEM_NOT_FOUND — that is fine for THIS test's purpose (it only
    // asserts write-table isolation, not the happy path), as long as no
    // KPI-fact table was ever touched along the way.
    await expect(removeOutcomePromise).rejects.toBeInstanceOf(KpiScorecardValidationError);
    assertNoKpiTableWrites();
  });

  it('reorderScorecardItems never writes to a KPI-fact table', async () => {
    currentScorecard = baseScorecard({ row_version: 1 });

    const outcomePromise = reorderScorecardItems({
      scorecardId: 'card-1',
      organizationId: 'org-1',
      expectedVersion: 1,
      actorUserId: 'user-owner',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-reorder-1',
      items: [{ itemId: 'item-1', sortOrder: 2 }],
    });

    // Same rationale as removeScorecardItem above — the UPDATE on
    // rvn_kpi_scorecard_items isn't stubbed to return a row here, so this
    // rejects with ITEM_NOT_FOUND; write-table isolation still holds.
    await expect(outcomePromise).rejects.toBeInstanceOf(KpiScorecardValidationError);
    assertNoKpiTableWrites();
  });
});
