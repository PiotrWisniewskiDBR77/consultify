import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ROI-E001 — `createRoiCase` unit coverage.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §4.1 / §8 file list:
 * "unit test for the SAVEPOINT dedupe race and the no-active-policy
 * fail-closed error." Covers exactly those two, against a small stateful
 * fake `PoolClient` (SQL-text pattern matching) — same mocking convention
 * `tests/resultsVnext/kpi/approveDefinitionVersion.test.ts` established for
 * unit-testing a write built on `executeAtomicCommand`/`executeAtomicCreate`
 * without a real Postgres.
 *
 * The SAVEPOINT dedupe race itself (two GENUINELY concurrent sessions
 * racing a real unique-index violation, real Postgres 23505/25P02
 * semantics) cannot be faithfully reproduced against a fake in-process
 * client — this file instead drives `createRoiCase` through the CODE PATH
 * that fires on a caught `23505` (forcing the fake INSERT to reject with
 * that error code), proving the ROLLBACK TO SAVEPOINT + retry-SELECT
 * sequence returns the winning case with `created: false` instead of
 * throwing an unhandled error. The real-Postgres proof that this sequence
 * actually clears Postgres's aborted-transaction state (vs. a naive
 * catch-then-retry-SELECT, which fails with 25P02) lives in
 * `kpiDeviationCommands.openOrEscalateDeviationCase`'s own prior verification
 * (EXECUTION_LEDGER §20) — this package copies that exact SAVEPOINT shape
 * verbatim rather than re-deriving it.
 */

let visibilityPolicyRow: Record<string, unknown> | null = null;
let existingActiveCaseId: string | null = null;
let insertShouldRace = false;
let raceWinnerCaseId: string | null = null;
const insertedCaseRows = new Map<string, Record<string, unknown>>();
const insertedBaselineRows = new Map<string, Record<string, unknown>>();
// ROI-E002 §4.1: createRoiCase now ALSO inserts a calculation-policy shell
// row in the same transaction, immediately after the baseline shell — this
// fake client needs to answer that INSERT (and loadCaseWithBaseline's
// matching re-SELECT for the found-existing branches) the same way it
// already does for rvn_roi_baselines.
const insertedPolicyRows = new Map<string, Record<string, unknown>>();
const releaseMock = vi.fn();

const ORG_ID = 'org-1';
const INITIATIVE_ID = 'initiative-1';

function baselineRowFor(caseId: string): Record<string, unknown> {
  return {
    baseline_id: `baseline-${caseId}`,
    case_id: caseId,
    organization_id: ORG_ID,
    baseline_period_start: null,
    baseline_period_end: null,
    current_measured_value: null,
    current_measured_unit: null,
    current_measured_as_of: null,
    bau_projection_method: 'flat',
    bau_growth_rate_pct: null,
    bau_reference_value: null,
    intervention_comparison_notes: null,
    source: null,
    confidence: null,
    owner_user_id: null,
    frozen_at: null,
    frozen_by: null,
    row_version: 1,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function policyRowFor(caseId: string): Record<string, unknown> {
  return {
    policy_row_id: `policy-${caseId}`,
    case_id: caseId,
    organization_id: ORG_ID,
    discount_rate_pct: null,
    tax_treatment: null,
    inflation_rate_pct: null,
    rounding_policy: 'half_up_2dp',
    required_metrics: null,
    notes: null,
    confidence: null,
    owner_user_id: null,
    frozen_at: null,
    frozen_by: null,
    row_version: 1,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function caseRowFor(caseId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    case_id: caseId,
    organization_id: ORG_ID,
    initiative_id: INITIATIVE_ID,
    title: 'Case title',
    owner_user_id: 'user-owner',
    status: 'draft',
    currency: 'USD',
    granularity: 'monthly',
    analysis_start: null,
    analysis_end: null,
    original_approved_snapshot_id: null,
    latest_approved_snapshot_id: null,
    current_forecast_version_id: null,
    current_actual_snapshot_id: null,
    next_action_type: null,
    next_action_due_at: null,
    next_review_at: null,
    submitted_by: null,
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    archived_at: null,
    archived_by: null,
    row_version: 1,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_by: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

async function fakeQuery(sql: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
  const trimmed = sql.trim();
  const normalized = trimmed.toUpperCase();

  if (
    normalized.startsWith('BEGIN') ||
    normalized.startsWith('COMMIT') ||
    normalized.startsWith('ROLLBACK') ||
    normalized.startsWith('SAVEPOINT') ||
    normalized.startsWith('RELEASE SAVEPOINT')
  ) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('FROM rvn_platform_visibility_policies') && sql.includes('is_active')) {
    return visibilityPolicyRow ? { rows: [visibilityPolicyRow], rowCount: 1 } : { rows: [], rowCount: 0 };
  }
  if (sql.includes('SELECT visibility_mode, default_scope_type')) {
    return { rows: [{ visibility_mode: 'RESTRICTED_ACL', default_scope_type: null }], rowCount: 1 };
  }

  // AC-02 pre-check / retry-after-rollback SELECT (identical SQL shape,
  // reused for both — matches createRoiCase's own implementation).
  if (
    sql.includes('SELECT case_id FROM rvn_roi_cases') &&
    sql.includes('status NOT IN')
  ) {
    if (existingActiveCaseId) {
      return { rows: [{ case_id: existingActiveCaseId }], rowCount: 1 };
    }
    if (raceWinnerCaseId) {
      return { rows: [{ case_id: raceWinnerCaseId }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (sql.startsWith('INSERT INTO rvn_roi_cases')) {
    if (insertShouldRace) {
      const err = new Error('duplicate key value violates unique constraint') as Error & { code: string };
      err.code = '23505';
      throw err;
    }
    const newCaseId = 'new-case-1';
    const row = caseRowFor(newCaseId);
    insertedCaseRows.set(newCaseId, row);
    return { rows: [row], rowCount: 1 };
  }

  if (sql.startsWith('INSERT INTO rvn_roi_baselines')) {
    const caseId = params[0] as string;
    const row = baselineRowFor(caseId);
    insertedBaselineRows.set(caseId, row);
    return { rows: [row], rowCount: 1 };
  }

  // ROI-E002 §4.1: calculation-policy shell insert, same transaction,
  // immediately after the baseline shell.
  if (sql.startsWith('INSERT INTO rvn_roi_calculation_policy')) {
    const caseId = params[0] as string;
    const row = policyRowFor(caseId);
    insertedPolicyRows.set(caseId, row);
    return { rows: [row], rowCount: 1 };
  }

  // loadCaseWithBaseline's three SELECTs (winning-case re-read after either
  // the pre-check or the SAVEPOINT-rollback branch).
  if (sql.startsWith('SELECT * FROM rvn_roi_cases WHERE case_id')) {
    const caseId = params[0] as string;
    const row = insertedCaseRows.get(caseId) ?? caseRowFor(caseId);
    return { rows: [row], rowCount: 1 };
  }
  if (sql.startsWith('SELECT * FROM rvn_roi_baselines WHERE case_id')) {
    const caseId = params[0] as string;
    const row = insertedBaselineRows.get(caseId) ?? baselineRowFor(caseId);
    return { rows: [row], rowCount: 1 };
  }
  if (sql.startsWith('SELECT * FROM rvn_roi_calculation_policy WHERE case_id')) {
    const caseId = params[0] as string;
    const row = insertedPolicyRows.get(caseId) ?? policyRowFor(caseId);
    return { rows: [row], rowCount: 1 };
  }

  if (sql.includes('INSERT INTO rvn_platform_resource_visibility')) {
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes('INSERT INTO rvn_platform_resource_acl')) {
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes('INSERT INTO rvn_platform_obligations')) {
    return {
      rows: [
        {
          obligation_id: 'obl-1',
          organization_id: ORG_ID,
          assignee_user_id: 'user-owner',
          reference_type: 'roi_case',
          reference_id: 'new-case-1',
          aggregate_version_at_creation: 1,
          obligation_type: 'start_roi_study',
          status: 'open',
          due_at: null,
          policy_version_id: null,
          cadence_occurrence_id: null,
          deduplication_key: 'dedup-1',
          source_event_id: null,
          completed_at: null,
          completed_via_command: null,
          row_version: 1,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      rowCount: 1,
    };
  }

  if (sql.includes('INSERT INTO rvn_platform_events')) {
    return { rows: [{ event_id: 'evt-1', resulting_version: 1 }], rowCount: 1 };
  }
  if (sql.includes('INSERT INTO rvn_platform_outbox')) {
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

const { createRoiCase, RoiCaseNoActiveVisibilityPolicyError } = await import(
  '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
);

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_ID,
    initiativeId: INITIATIVE_ID,
    title: 'New ROI case',
    ownerUserId: 'user-owner',
    currency: 'USD',
    createdBy: 'user-1',
    actorEffectiveRole: 'consultant',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

beforeEach(() => {
  visibilityPolicyRow = { policy_id: 'policy-1', policy_version: 1 };
  existingActiveCaseId = null;
  insertShouldRace = false;
  raceWinnerCaseId = null;
  insertedCaseRows.clear();
  insertedBaselineRows.clear();
  insertedPolicyRows.clear();
  releaseMock.mockClear();
});

describe('createRoiCase — no-active-policy fail-closed', () => {
  it('throws RoiCaseNoActiveVisibilityPolicyError when no active domain="roi" policy exists', async () => {
    visibilityPolicyRow = null;

    await expect(createRoiCase(baseInput())).rejects.toBeInstanceOf(RoiCaseNoActiveVisibilityPolicyError);

    // The client must always be released, success or failure (finally
    // block in executeAtomicCreate).
    expect(releaseMock).toHaveBeenCalledTimes(1);
    // Never reached any INSERT.
    expect(insertedCaseRows.size).toBe(0);
  });
});

describe('createRoiCase — AC-02 duplicate prevention', () => {
  it('cheap pre-check path: an already-existing active case for the same initiative is returned with created:false, no INSERT attempted', async () => {
    existingActiveCaseId = 'existing-case-1';

    const outcome = await createRoiCase(baseInput({ idempotencyKey: 'idem-precheck' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.created).toBe(false);
    expect(outcome.result.case.caseId).toBe('existing-case-1');
    expect(insertedCaseRows.size).toBe(0);
  });

  it('SAVEPOINT race path: a caught 23505 on the candidate INSERT rolls back to the savepoint and returns the winning row with created:false, without throwing', async () => {
    insertShouldRace = true;
    raceWinnerCaseId = 'race-winner-case';

    const outcome = await createRoiCase(baseInput({ idempotencyKey: 'idem-race' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.created).toBe(false);
    expect(outcome.result.case.caseId).toBe('race-winner-case');
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('happy path: no existing case and no race — creates a new case and baseline shell with created:true', async () => {
    const outcome = await createRoiCase(baseInput({ idempotencyKey: 'idem-happy' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.created).toBe(true);
    expect(outcome.result.case.caseId).toBe('new-case-1');
    expect(outcome.result.baseline.caseId).toBe('new-case-1');
    expect(outcome.result.baseline.currentMeasuredValue).toBeNull();
    // ROI-E002 §4.1: CreateRoiCaseResult gains a calculationPolicy field,
    // always present (1:1 shell), rounding_policy on its DDL default.
    expect(outcome.result.calculationPolicy.caseId).toBe('new-case-1');
    expect(outcome.result.calculationPolicy.roundingPolicy).toBe('half_up_2dp');
    expect(outcome.result.calculationPolicy.discountRatePct).toBeNull();
  });
});
