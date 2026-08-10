import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * KPI-E003 — deviation-case state-machine guard coverage.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §B state-machine
 * table — this file covers the "hard state machine: illegal transitions
 * rejected" and "closeDeviationCase rejects without EffectivenessVerification"
 * items this package's own task spec asks for.
 *
 * Mocking pattern: same precedent as
 * tests/resultsVnext/kpi/approveDefinitionVersion.test.ts (mock
 * `acquirePgClient`, a small stateful fake `query()` that pattern-matches on
 * SQL text). Every scenario below is a GUARD REJECTION — the guard inside
 * `applyMutation` must throw BEFORE any UPDATE/INSERT runs — so the fake
 * deliberately throws if an UPDATE/INSERT is ever reached, which doubles as
 * proof the guard actually short-circuited rather than merely happening to
 * produce the right error after writing anyway.
 */

let currentCase: Record<string, unknown> | null = null;
let latestVerification: Record<string, unknown> | null = null;
let correctiveActionCount = 0;
const releaseMock = vi.fn();

async function fakeQuery(
  sql: string,
  _params: unknown[] = []
): Promise<{ rows: unknown[]; rowCount: number }> {
  const s = sql.trim();
  const upper = s.toUpperCase();

  if (upper.startsWith('BEGIN') || upper.startsWith('COMMIT') || upper.startsWith('ROLLBACK')) {
    return { rows: [], rowCount: 0 };
  }

  // loadDeviationCaseForUpdate (kpiDeviationCommands.ts)
  if (s.startsWith('SELECT * FROM rvn_kpi_deviation_cases') && s.includes('FOR UPDATE')) {
    return currentCase ? { rows: [currentCase], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // submitPlan's "at least one corrective action" guard query
  if (s.includes('SELECT COUNT(*)::text AS count FROM rvn_kpi_corrective_actions')) {
    return { rows: [{ count: String(correctiveActionCount) }], rowCount: 1 };
  }

  // closeDeviationCase's response-policy lookup (accepted_verification_statuses)
  if (s.includes('FROM rvn_kpi_definitions kd') && s.includes('rvn_kpi_response_policies')) {
    return { rows: [{ accepted: null }], rowCount: 1 };
  }

  // closeDeviationCase's latest-EffectivenessVerification lookup
  if (s.includes('FROM rvn_kpi_effectiveness_verifications') && s.includes('FOR UPDATE')) {
    return latestVerification ? { rows: [latestVerification], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // Every scenario in this file expects the guard to reject BEFORE any
  // write — reaching an UPDATE/INSERT means the guard failed to
  // short-circuit, which is itself a test failure, not a fake-client gap.
  if (upper.startsWith('UPDATE') || upper.startsWith('INSERT')) {
    throw new Error(`fakeQuery: unexpected write reached in a guard-rejection scenario: ${s.slice(0, 120)}`);
  }

  return { rows: [], rowCount: 0 };
}

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  acquirePgClient: async () => ({ query: fakeQuery, release: releaseMock }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const {
  acknowledgeDeviationCase,
  submitPlan,
  recordRecoveryObservation,
  closeDeviationCase,
  KpiDeviationValidationError,
} = await import('../../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js');

function baseCase(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    case_id: 'case-1',
    organization_id: 'org-1',
    kpi_id: 'kpi-1',
    trigger_measurement_id: 'meas-1',
    severity: 'critical',
    status: 'open',
    escalated: false,
    escalated_at: null,
    escalated_reason: null,
    escalated_by: null,
    owner_user_id: 'user-owner',
    manager_user_id: null,
    detected_at: '2026-08-09T00:00:00.000Z',
    response_due_at: null,
    root_cause_summary: null,
    root_cause_category: null,
    recurrence_flag: false,
    expected_recovery_date: null,
    expected_recovery_value: null,
    plan_submitted_by: null,
    plan_submitted_at: null,
    plan_approved_by: null,
    plan_approved_at: null,
    recovery_observed_by: null,
    recovery_observed_at: null,
    recovery_observation_measurement_id: null,
    closed_at: null,
    closed_by: null,
    close_effectiveness_verification_id: null,
    reopened_from_case_id: null,
    row_version: 1,
    created_by: 'user-author',
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

function baseCommandInput<T extends Record<string, unknown>>(overrides: T = {} as T) {
  return {
    caseId: 'case-1',
    organizationId: 'org-1',
    expectedVersion: 1,
    actorUserId: 'user-actor',
    actorEffectiveRole: 'consultant',
    idempotencyKey: 'idem-1',
    ...overrides,
  };
}

beforeEach(() => {
  currentCase = null;
  latestVerification = null;
  correctiveActionCount = 0;
  releaseMock.mockClear();
});

describe('acknowledgeDeviationCase — illegal transitions rejected', () => {
  it('rejects when the case is not "open" (e.g. already analysis_required)', async () => {
    currentCase = baseCase({ status: 'analysis_required' });

    await expect(acknowledgeDeviationCase(baseCommandInput())).rejects.toBeInstanceOf(
      KpiDeviationValidationError
    );
    try {
      await acknowledgeDeviationCase(baseCommandInput());
    } catch (err) {
      expect((err as InstanceType<typeof KpiDeviationValidationError>).code).toBe('NOT_OPEN');
    }
    // Never mutated.
    expect(currentCase?.status).toBe('analysis_required');
  });

  it('rejects a "closed" case the same way', async () => {
    currentCase = baseCase({ status: 'closed' });
    await expect(acknowledgeDeviationCase(baseCommandInput())).rejects.toMatchObject({ code: 'NOT_OPEN' });
  });
});

describe('submitPlan — illegal transitions rejected', () => {
  it('rejects when the case is not "plan_required"', async () => {
    currentCase = baseCase({ status: 'open' });

    await expect(submitPlan(baseCommandInput())).rejects.toMatchObject({ code: 'NOT_PLAN_REQUIRED' });
  });

  it('rejects a "plan_required" case with zero corrective actions', async () => {
    currentCase = baseCase({ status: 'plan_required' });
    correctiveActionCount = 0;

    await expect(submitPlan(baseCommandInput())).rejects.toMatchObject({ code: 'NO_CORRECTIVE_ACTIONS' });
  });
});

describe('recordRecoveryObservation — illegal transitions rejected', () => {
  it('rejects when the case is not "executing"', async () => {
    currentCase = baseCase({ status: 'approved' });

    await expect(
      recordRecoveryObservation(
        baseCommandInput({ recoveryObservationMeasurementId: 'meas-2' })
      )
    ).rejects.toMatchObject({ code: 'NOT_EXECUTING' });
  });
});

describe('closeDeviationCase — rejects without an accepted EffectivenessVerification', () => {
  it('rejects when the case is not "verification"', async () => {
    currentCase = baseCase({ status: 'executing' });

    await expect(closeDeviationCase(baseCommandInput())).rejects.toMatchObject({
      code: 'NOT_IN_VERIFICATION',
    });
  });

  it('rejects a "verification" case with no EffectivenessVerification row at all', async () => {
    currentCase = baseCase({ status: 'verification' });
    latestVerification = null;

    await expect(closeDeviationCase(baseCommandInput())).rejects.toMatchObject({
      code: 'EFFECTIVENESS_NOT_VERIFIED',
    });
  });

  it('rejects a "verification" case whose latest verification outcome is "ineffective"', async () => {
    currentCase = baseCase({ status: 'verification' });
    latestVerification = {
      verification_id: 'ver-1',
      deviation_case_id: 'case-1',
      organization_id: 'org-1',
      verification_window_start: '2026-08-01T00:00:00.000Z',
      verification_window_end: '2026-08-08T00:00:00.000Z',
      status: 'ineffective',
      rationale: null,
      verified_by: 'user-verifier',
      verified_at: '2026-08-09T00:00:00.000Z',
      row_version: 1,
      created_by: 'user-verifier',
      created_at: '2026-08-09T00:00:00.000Z',
    };

    await expect(closeDeviationCase(baseCommandInput())).rejects.toMatchObject({
      code: 'EFFECTIVENESS_NOT_VERIFIED',
    });
  });
});
