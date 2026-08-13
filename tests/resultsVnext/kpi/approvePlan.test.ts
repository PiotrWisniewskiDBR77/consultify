import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * KPI-E003 — `approvePlan` unit coverage: self-approval denial and
 * STALE_VERSION, the deviation-case counterpart of
 * tests/resultsVnext/kpi/approveDefinitionVersion.test.ts (same mocking
 * pattern, same precedent file for the fake-client shape — see that file's
 * own header comment for the rationale).
 */

let currentCase: Record<string, unknown> | null = null;
const releaseMock = vi.fn();

async function fakeQuery(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: unknown[]; rowCount: number }> {
  const s = sql.trim();
  const upper = s.toUpperCase();

  if (upper.startsWith('BEGIN') || upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
    return { rows: [], rowCount: 0 };
  }

  if (s.startsWith('SELECT * FROM rvn_kpi_deviation_cases') && s.includes('FOR UPDATE')) {
    return currentCase ? { rows: [currentCase], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  if (s.startsWith('UPDATE rvn_kpi_deviation_cases')) {
    // Only reached when neither the self-approval guard nor the status
    // guard rejected — mirrors approveDefinitionVersion.test.ts's fallback.
    const nextVersion = params[1];
    const updated = {
      ...currentCase,
      status: 'approved',
      plan_approved_by: params[0],
      row_version: nextVersion,
    };
    currentCase = updated;
    return { rows: [updated], rowCount: 1 };
  }

  if (s.includes('INSERT INTO rvn_platform_events')) {
    return { rows: [{ event_id: 'evt-1', resulting_version: params[params.length - 1] }], rowCount: 1 };
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

const { approvePlan, DeviationSelfApprovalDeniedError } = await import(
  '../../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js'
);
const { AtomicWriteConflictError } = await import(
  '../../../server/src/services/resultsVnext/platform/atomicWrite.js'
);

function baseCase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    case_id: 'case-1',
    organization_id: 'org-1',
    kpi_id: 'kpi-1',
    trigger_measurement_id: 'meas-1',
    severity: 'critical',
    status: 'plan_submitted',
    escalated: false,
    escalated_at: null,
    escalated_reason: null,
    escalated_by: null,
    owner_user_id: 'user-owner',
    manager_user_id: null,
    detected_at: '2026-08-09T00:00:00.000Z',
    response_due_at: null,
    root_cause_summary: 'root cause',
    root_cause_category: 'process',
    recurrence_flag: false,
    expected_recovery_date: null,
    expected_recovery_value: null,
    plan_submitted_by: 'user-submitter',
    plan_submitted_at: '2026-08-09T00:00:00.000Z',
    plan_approved_by: null,
    plan_approved_at: null,
    recovery_observed_by: null,
    recovery_observed_at: null,
    recovery_observation_measurement_id: null,
    closed_at: null,
    closed_by: null,
    close_effectiveness_verification_id: null,
    reopened_from_case_id: null,
    row_version: 2,
    created_by: 'user-author',
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

function baseInput<T extends Record<string, unknown>>(overrides: T = {} as T) {
  return {
    caseId: 'case-1',
    organizationId: 'org-1',
    expectedVersion: 2,
    // Required by BaseCaseCommandInput. `approvePlan` records `approverId` as
    // the actor and never reads `actorUserId`, so this is inert at runtime.
    actorUserId: 'user-approver',
    approverId: 'user-approver',
    actorEffectiveRole: 'admin',
    idempotencyKey: 'idem-1',
    // RN-G5: this suite tests approvePlan's SELF-APPROVAL logic, not the
    // command-capability guard (that has its own dedicated coverage in
    // commandCapabilityGuard.test.ts and the RN-G5 security tests) — give
    // every case the wildcard so the RBAC gate always ALLOWs and the tests
    // below keep exercising exactly what they exercised before.
    access: { capabilities: ['*'], platformRole: null },
    ...overrides,
  };
}

beforeEach(() => {
  currentCase = null;
  releaseMock.mockClear();
});

describe('approvePlan — self-approval denial', () => {
  it('denies approval when approverId matches plan_submitted_by', async () => {
    currentCase = baseCase({ plan_submitted_by: 'user-approver', created_by: 'user-author' });

    await expect(
      approvePlan(baseInput({ approverId: 'user-approver' }))
    ).rejects.toBeInstanceOf(DeviationSelfApprovalDeniedError);

    expect(releaseMock).toHaveBeenCalledTimes(1);
    expect(currentCase?.status).toBe('plan_submitted');
  });

  it('denies approval when approverId matches created_by (even if plan_submitted_by differs)', async () => {
    currentCase = baseCase({ plan_submitted_by: 'user-submitter', created_by: 'user-approver' });

    await expect(
      approvePlan(baseInput({ approverId: 'user-approver' }))
    ).rejects.toBeInstanceOf(DeviationSelfApprovalDeniedError);

    expect(currentCase?.status).toBe('plan_submitted');
  });

  it('allows approval when approverId matches neither plan_submitted_by nor created_by', async () => {
    currentCase = baseCase({ plan_submitted_by: 'user-submitter', created_by: 'user-author' });

    const outcome = await approvePlan(baseInput({ approverId: 'user-approver' }));

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('approved');
  });
});

describe('approvePlan — STALE_VERSION', () => {
  it('rejects with a typed STALE_VERSION conflict when expectedVersion does not match the current row_version', async () => {
    currentCase = baseCase({
      row_version: 2,
      plan_submitted_by: 'user-submitter',
      created_by: 'user-author',
    });

    await expect(
      approvePlan(baseInput({ approverId: 'user-approver', expectedVersion: 1 }))
    ).rejects.toBeInstanceOf(AtomicWriteConflictError);

    try {
      await approvePlan(baseInput({ approverId: 'user-approver', expectedVersion: 1 }));
    } catch (err) {
      expect((err as InstanceType<typeof AtomicWriteConflictError>).code).toBe('STALE_VERSION');
    }
    expect(currentCase?.status).toBe('plan_submitted');
  });
});
