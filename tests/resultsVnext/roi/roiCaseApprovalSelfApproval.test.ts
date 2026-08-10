import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ROI-E003 — `approveRoiCase` self-approval-denial unit coverage (mocked).
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §4.2/§6 (Decision
 * D13 — check BOTH `submitted_by` and `created_by`, both deny; `owner_user_id`
 * deliberately NOT checked). Structural template:
 * `tests/resultsVnext/kpi/approveDefinitionVersion.test.ts`'s own
 * self-approval-denial suite — same `vi.mock('.../PostgresDatabase.js')`
 * stateful fake `query()` pattern.
 *
 * The self-approval check runs as the FIRST statement inside `applyMutation`
 * (design §4.2 step 1), before any of `approveRoiCase`'s other reads (
 * baseline/policy/assumptions/... /calculation run) — so the fake `query()`
 * below only needs to answer the `rvn_roi_cases ... FOR UPDATE` load; every
 * denied scenario never reaches a second SELECT.
 */

let currentRow: Record<string, unknown> | null = null;
const releaseMock = vi.fn();

async function fakeQuery(sql: string, _params: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
  const normalized = sql.trim().toUpperCase();

  if (normalized.startsWith('BEGIN') || normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('FROM rvn_roi_cases') && sql.includes('FOR UPDATE')) {
    return currentRow ? { rows: [currentRow], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // Any other query means the self-approval check did NOT short-circuit as
  // expected — surface loudly instead of silently returning an empty set
  // that would let a bug slip through as a false-negative "denied" result.
  throw new Error(`[roiCaseApprovalSelfApproval.test] unexpected query reached past the self-approval check: ${sql}`);
}

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  acquirePgClient: async () => ({ query: fakeQuery, release: releaseMock }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { approveRoiCase, RoiSelfApprovalDeniedError } = await import(
  '../../../server/src/services/resultsVnext/roi/roiCaseApprovalCommands.js'
);

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    case_id: 'case-1',
    organization_id: 'org-1',
    initiative_id: 'init-1',
    title: 'Case under decision',
    owner_user_id: 'user-owner',
    status: 'submitted_for_approval',
    currency: 'USD',
    granularity: 'monthly',
    analysis_start: '2026-01-01',
    analysis_end: '2026-12-31',
    original_approved_snapshot_id: null,
    latest_approved_snapshot_id: null,
    current_forecast_version_id: null,
    current_actual_snapshot_id: null,
    next_action_type: null,
    next_action_due_at: null,
    next_review_at: null,
    submitted_by: 'user-submitter',
    submitted_at: '2026-01-02T00:00:00.000Z',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    decision_calculation_run_id: 'run-1',
    changes_requested_by: null,
    changes_requested_at: null,
    changes_requested_reason: null,
    archived_at: null,
    archived_by: null,
    row_version: 3,
    created_by: 'user-author',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_by: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    caseId: 'case-1',
    organizationId: 'org-1',
    expectedVersion: 3,
    approverId: 'user-approver',
    actorEffectiveRole: 'admin',
    idempotencyKey: 'idem-approve-1',
    ...overrides,
  };
}

beforeEach(() => {
  currentRow = null;
  releaseMock.mockClear();
});

describe('approveRoiCase — self-approval denial (ROI-E003 Decision D13)', () => {
  it('denies approval when approverId matches submitted_by', async () => {
    currentRow = baseRow({ submitted_by: 'user-approver', created_by: 'user-author' });

    await expect(approveRoiCase(baseInput({ approverId: 'user-approver' }))).rejects.toBeInstanceOf(
      RoiSelfApprovalDeniedError
    );

    // Client always released (finally block in executeAtomicCommand) — also
    // proves the mocked acquirePgClient path was actually exercised.
    expect(releaseMock).toHaveBeenCalledTimes(1);
    // Never reached the UPDATE — status must stay 'submitted_for_approval'.
    expect(currentRow?.status).toBe('submitted_for_approval');
  });

  it('denies approval when approverId matches created_by (even if submitted_by differs)', async () => {
    currentRow = baseRow({ submitted_by: 'user-submitter', created_by: 'user-approver' });

    await expect(approveRoiCase(baseInput({ approverId: 'user-approver' }))).rejects.toBeInstanceOf(
      RoiSelfApprovalDeniedError
    );

    expect(currentRow?.status).toBe('submitted_for_approval');
  });

  it('does NOT deny approval when approverId matches owner_user_id only (Decision D13: owner_user_id deliberately not checked)', async () => {
    // owner_user_id === approverId, but submitted_by/created_by differ — the
    // self-approval check must NOT reject this on identity grounds. It will
    // still throw because this mock's query() throws on the second SELECT
    // (baseline lookup) that the command legitimately proceeds to run next
    // — that failure PROVES the self-approval gate was passed, not that it
    // denied.
    currentRow = baseRow({
      owner_user_id: 'user-approver',
      submitted_by: 'user-submitter',
      created_by: 'user-author',
    });

    await expect(approveRoiCase(baseInput({ approverId: 'user-approver' }))).rejects.not.toBeInstanceOf(
      RoiSelfApprovalDeniedError
    );
  });

  it('error carries the caseId/approverId/reasonField details', async () => {
    currentRow = baseRow({ submitted_by: 'user-approver', created_by: 'user-author' });

    try {
      await approveRoiCase(baseInput({ approverId: 'user-approver' }));
      throw new Error('expected approveRoiCase to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(RoiSelfApprovalDeniedError);
      const typed = err as InstanceType<typeof RoiSelfApprovalDeniedError>;
      expect(typed.code).toBe('SELF_APPROVAL_DENIED');
      expect(typed.details).toMatchObject({ caseId: 'case-1', approverId: 'user-approver', reasonField: 'submitted_by' });
    }
  });
});
