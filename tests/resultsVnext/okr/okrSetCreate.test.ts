import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * OKR-E002 — `createOkrSet` unit coverage.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §4.1 / §7 file list:
 * "SAVEPOINT dedupe race, no-active-policy fail-closed." Covers exactly
 * those two, against a small stateful fake `PoolClient` (SQL-text pattern
 * matching) — same mocking convention `roiCaseCreate.test.ts` established
 * for unit-testing a write built on `executeAtomicCreate` without a real
 * Postgres.
 *
 * The SAVEPOINT dedupe race itself (two GENUINELY concurrent sessions
 * racing a real unique-index violation, real Postgres 23505/25P02
 * semantics) cannot be faithfully reproduced against a fake in-process
 * client — this file drives `createOkrSet` through the CODE PATH that
 * fires on a caught `23505` (forcing the fake INSERT to reject with that
 * error code), proving the ROLLBACK TO SAVEPOINT + retry-SELECT sequence
 * returns the winning Set with `created: false` instead of throwing an
 * unhandled error. The real-Postgres proof that the exact `WHERE status <>
 * 'cancelled'` uniqueness tuple behaves as designed lives in
 * `okrSetLifecycle.realdb.test.ts`.
 */

let visibilityPolicyRow: Record<string, unknown> | null = null;
let existingActiveSetId: string | null = null;
let insertShouldRace = false;
let raceWinnerSetId: string | null = null;
const insertedSetRows = new Map<string, Record<string, unknown>>();
const releaseMock = vi.fn();

const ORG_ID = 'org-1';
const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const CYCLE_ID = '22222222-2222-4222-8222-222222222222';

function setRowFor(setId: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    set_id: setId,
    organization_id: ORG_ID,
    program_id: PROGRAM_ID,
    cycle_id: CYCLE_ID,
    scope_type: 'individual',
    scope_id: 'user-owner',
    owner_user_id: 'user-owner',
    reviewer_user_id: null,
    title: 'Set title',
    status: 'draft',
    submitted_by: null,
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    changes_requested_by: null,
    changes_requested_at: null,
    changes_requested_reason: null,
    current_version: 1,
    approved_version: null,
    latest_approved_snapshot_id: null,
    overall_progress: null,
    overall_confidence: null,
    attention_state: 'none',
    last_checkin_at: null,
    next_checkin_due_at: null,
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
  if (sql.includes('SELECT visibility_mode FROM rvn_platform_visibility_policies')) {
    return { rows: [{ visibility_mode: 'RESTRICTED_ACL' }], rowCount: 1 };
  }

  // D3 pre-check / retry-after-rollback SELECT (identical SQL shape, reused
  // for both — matches createOkrSet's own implementation).
  if (sql.includes('SELECT set_id FROM okr_vnext_sets') && sql.includes('status <>')) {
    if (existingActiveSetId) {
      return { rows: [{ set_id: existingActiveSetId }], rowCount: 1 };
    }
    if (raceWinnerSetId) {
      return { rows: [{ set_id: raceWinnerSetId }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  if (sql.startsWith('INSERT INTO okr_vnext_sets')) {
    if (insertShouldRace) {
      const err = new Error('duplicate key value violates unique constraint') as Error & { code: string };
      err.code = '23505';
      throw err;
    }
    const newSetId = 'new-set-1';
    const row = setRowFor(newSetId);
    insertedSetRows.set(newSetId, row);
    return { rows: [row], rowCount: 1 };
  }

  // loadOkrSetResult's re-SELECT (winning-Set re-read after either the
  // pre-check or the SAVEPOINT-rollback branch).
  if (sql.startsWith('SELECT * FROM okr_vnext_sets WHERE set_id')) {
    const setId = params[0] as string;
    const row = insertedSetRows.get(setId) ?? setRowFor(setId);
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
          reference_type: 'okr_set',
          reference_id: 'new-set-1',
          aggregate_version_at_creation: 1,
          obligation_type: 'draft_okr_set',
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

const { createOkrSet, OkrSetNoActiveVisibilityPolicyError, OkrSetValidationError } = await import(
  '../../../server/src/services/resultsVnext/okr/okrSetCommands.js'
);

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG_ID,
    programId: PROGRAM_ID,
    cycleId: CYCLE_ID,
    scopeType: 'individual' as const,
    scopeId: 'user-owner',
    ownerUserId: 'user-owner',
    title: 'New OKR Set',
    createdBy: 'user-1',
    actorEffectiveRole: 'consultant',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

beforeEach(() => {
  visibilityPolicyRow = { policy_id: 'policy-1', policy_version: 1 };
  existingActiveSetId = null;
  insertShouldRace = false;
  raceWinnerSetId = null;
  insertedSetRows.clear();
  releaseMock.mockClear();
});

describe('createOkrSet — no-active-policy fail-closed', () => {
  it('throws OkrSetNoActiveVisibilityPolicyError when no active domain="okr" policy exists', async () => {
    visibilityPolicyRow = null;

    await expect(createOkrSet(baseInput())).rejects.toBeInstanceOf(OkrSetNoActiveVisibilityPolicyError);

    // The client must always be released, success or failure (finally block
    // in executeAtomicCreate).
    expect(releaseMock).toHaveBeenCalledTimes(1);
    // Never reached any INSERT.
    expect(insertedSetRows.size).toBe(0);
  });
});

describe('createOkrSet — scopeId required for every scopeType', () => {
  it('rejects an empty scopeId even for scopeType="company" (SCOPE_ID_REQUIRED)', async () => {
    await expect(
      createOkrSet(baseInput({ scopeType: 'company', scopeId: '', idempotencyKey: 'idem-scope' }))
    ).rejects.toBeInstanceOf(OkrSetValidationError);
    expect(insertedSetRows.size).toBe(0);
  });

  it('rejects a whitespace-only scopeId', async () => {
    await expect(
      createOkrSet(baseInput({ scopeId: '   ', idempotencyKey: 'idem-scope-ws' }))
    ).rejects.toBeInstanceOf(OkrSetValidationError);
  });
});

describe('createOkrSet — D3 duplicate prevention', () => {
  it('cheap pre-check path: an already-existing non-cancelled Set for the same tuple is returned with created:false, no INSERT attempted', async () => {
    existingActiveSetId = 'existing-set-1';

    const outcome = await createOkrSet(baseInput({ idempotencyKey: 'idem-precheck' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.created).toBe(false);
    expect(outcome.result.set.setId).toBe('existing-set-1');
    expect(insertedSetRows.size).toBe(0);
  });

  it('SAVEPOINT race path: a caught 23505 on the candidate INSERT rolls back to the savepoint and returns the winning row with created:false, without throwing', async () => {
    insertShouldRace = true;
    raceWinnerSetId = 'race-winner-set';

    const outcome = await createOkrSet(baseInput({ idempotencyKey: 'idem-race' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.created).toBe(false);
    expect(outcome.result.set.setId).toBe('race-winner-set');
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it('happy path: no existing Set and no race — creates a new Set with created:true', async () => {
    const outcome = await createOkrSet(baseInput({ idempotencyKey: 'idem-happy' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.created).toBe(true);
    expect(outcome.result.set.setId).toBe('new-set-1');
    expect(outcome.result.set.status).toBe('draft');
    expect(outcome.result.set.currentVersion).toBe(1);
  });
});
