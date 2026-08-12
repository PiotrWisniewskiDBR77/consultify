import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * KPI-E001/E002 — `approveDefinitionVersion` unit coverage.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md, "Files to
 * create" table: "self-approval denial, STALE_VERSION, idempotent retry" —
 * this file covers the first two (self-approval denial for BOTH
 * `submitted_by` and `created_by`, and STALE_VERSION). Idempotent-retry is
 * NOT covered here — see the note at the bottom of this file for why.
 *
 * Mocking pattern: this repo's established way to unit-test a
 * `PoolClient`-based write without a real Postgres is
 * `vi.mock('.../database/PostgresDatabase.js', () => ({ ... }))` with a
 * small stateful fake `query()` — see
 * `tests/unit/canvas/canvasMaterializeChatGraph.test.ts` (mocks
 * `withPgTransaction`) for the precedent this file follows, adapted to mock
 * `acquirePgClient` instead (the function `executeAtomicCommand` —
 * `platform/atomicWrite.ts`, which `approveDefinitionVersion` is built on —
 * actually calls). No deeper mocking framework exists or is introduced here
 * — `fakeClient.query()` pattern-matches on SQL text, same shape as the
 * existing precedent.
 */

let currentRow: Record<string, unknown> | null = null;
const releaseMock = vi.fn();

async function fakeQuery(sql: string, params: unknown[] = []): Promise<{ rows: unknown[]; rowCount: number }> {
  const normalized = sql.trim().toUpperCase();

  if (normalized.startsWith('BEGIN') || normalized.startsWith('COMMIT') || normalized.startsWith('ROLLBACK')) {
    return { rows: [], rowCount: 0 };
  }

  if (sql.includes('FROM rvn_kpi_definition_versions') && sql.includes('FOR UPDATE')) {
    return currentRow ? { rows: [currentRow], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  if (sql.startsWith('UPDATE rvn_kpi_definition_versions')) {
    // Only reached if the self-approval / CAS guards did NOT reject the
    // command — none of this file's scenarios expect to get here, but a
    // reasonable fallback keeps the fake from silently returning "success"
    // with no row if a future scenario does reach it.
    const nextVersion = params[1];
    const updated = { ...currentRow, approval_status: 'approved', row_version: nextVersion };
    currentRow = updated;
    return { rows: [updated], rowCount: 1 };
  }

  if (sql.startsWith('UPDATE rvn_kpi_definitions')) {
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('INSERT INTO rvn_platform_events')) {
    return { rows: [{ event_id: 'evt-1', resulting_version: params[params.length - 1] }], rowCount: 1 };
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

const { approveDefinitionVersion, SelfApprovalDeniedError } = await import(
  '../../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js'
);
const { AtomicWriteConflictError } = await import(
  '../../../server/src/services/resultsVnext/platform/atomicWrite.js'
);

function baseRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    definition_version_id: 'ver-1',
    kpi_id: 'kpi-1',
    organization_id: 'org-1',
    version_number: 1,
    name: 'Customer NPS',
    description: null,
    unit: null,
    target_geometry: 'threshold_min',
    target_value: '80',
    target_min: null,
    target_max: null,
    warning_low: '70',
    warning_high: null,
    critical_low: null,
    critical_high: null,
    formula_text: null,
    approval_status: 'submitted',
    effective_from: null,
    effective_to: null,
    created_by: 'user-author',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    submitted_by: 'user-submitter',
    submitted_at: '2026-01-02T00:00:00.000Z',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    row_version: 2,
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    definitionVersionId: 'ver-1',
    organizationId: 'org-1',
    expectedVersion: 2,
    approverId: 'user-approver',
    actorEffectiveRole: 'admin',
    idempotencyKey: 'idem-1',
    // RN-G5: this suite tests approveDefinitionVersion's SELF-APPROVAL
    // logic, not the command-capability guard — give every case the
    // wildcard so the RBAC gate always ALLOWs (fakeQuery's fallthrough
    // returns no owner row for the new "SELECT owner_user_id ..." lookup,
    // which without the wildcard would DENY every scenario here for the
    // wrong reason).
    access: { capabilities: ['*'], platformRole: null },
    ...overrides,
  };
}

beforeEach(() => {
  currentRow = null;
  releaseMock.mockClear();
});

describe('approveDefinitionVersion — self-approval denial', () => {
  it('denies approval when approverId matches submitted_by', async () => {
    currentRow = baseRow({ submitted_by: 'user-approver', created_by: 'user-author' });

    await expect(
      approveDefinitionVersion(baseInput({ approverId: 'user-approver' }))
    ).rejects.toBeInstanceOf(SelfApprovalDeniedError);

    // The client must always be released, success or failure (finally block
    // in executeAtomicCommand) — this also incidentally proves the mocked
    // acquirePgClient path was actually exercised, not skipped.
    expect(releaseMock).toHaveBeenCalledTimes(1);
    // Never reached the UPDATE — approval_status must stay 'submitted'.
    expect(currentRow?.approval_status).toBe('submitted');
  });

  it('denies approval when approverId matches created_by (even if submitted_by differs)', async () => {
    currentRow = baseRow({ submitted_by: 'user-submitter', created_by: 'user-approver' });

    await expect(
      approveDefinitionVersion(baseInput({ approverId: 'user-approver' }))
    ).rejects.toBeInstanceOf(SelfApprovalDeniedError);

    expect(currentRow?.approval_status).toBe('submitted');
  });

  it('allows approval when approverId matches neither submitted_by nor created_by', async () => {
    currentRow = baseRow({ submitted_by: 'user-submitter', created_by: 'user-author' });

    const outcome = await approveDefinitionVersion(baseInput({ approverId: 'user-approver' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.approvalStatus).toBe('approved');
  });
});

describe('approveDefinitionVersion — STALE_VERSION', () => {
  it('rejects with a typed STALE_VERSION conflict when expectedVersion does not match the current row_version', async () => {
    // row_version is 2 in storage; command claims to have read version 1 —
    // the CAS check in executeAtomicCommand runs BEFORE applyMutation (and
    // therefore before the self-approval check), so this must fail on
    // STALE_VERSION even though this approver is not self-approving.
    currentRow = baseRow({
      row_version: 2,
      submitted_by: 'user-submitter',
      created_by: 'user-author',
    });

    await expect(
      approveDefinitionVersion(baseInput({ approverId: 'user-approver', expectedVersion: 1 }))
    ).rejects.toBeInstanceOf(AtomicWriteConflictError);

    try {
      await approveDefinitionVersion(baseInput({ approverId: 'user-approver', expectedVersion: 1 }));
    } catch (err) {
      expect((err as InstanceType<typeof AtomicWriteConflictError>).code).toBe('STALE_VERSION');
    }
    expect(currentRow?.approval_status).toBe('submitted');
  });
});

// NOTE on the third item the design doc asks for ("idempotent retry"): this
// file's fake `query()` does not implement the real
// `ON CONFLICT (organization_id, idempotency_key) DO NOTHING` semantics
// (it has no persistent idempotency-key index to conflict against — every
// INSERT INTO rvn_platform_events call above unconditionally "succeeds").
// Faithfully exercising the duplicate-idempotency-key branch of
// `executeAtomicCommand` would require the fake to track previously-seen
// `(organization_id, idempotency_key)` pairs and change its
// `INSERT ... RETURNING event_id` response accordingly — genuinely
// straightforward to add, but `executeAtomicCommand`'s idempotent-retry
// path is platform-generic code with zero KPI-specific behavior in it, so a
// KPI-scoped test for it would only be re-proving atomicWrite.ts's own
// logic under a different call site, not this command's own contract. Left
// undone here rather than adding a fragile, low-signal test — flagging
// instead of silently omitting, per this task's own instruction not to
// invent test coverage that does not pull its weight.
