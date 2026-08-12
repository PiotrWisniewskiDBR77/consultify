import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * KPI-E005 — InitiativeKPIImpact command-layer UNIT coverage (mocked
 * PoolClient — same fake-client shape as
 * tests/resultsVnext/kpi/approvePlan.test.ts /
 * tests/resultsVnext/kpi/approveDefinitionVersion.test.ts). Per
 * EXECUTION_LEDGER.md §24's lesson, these unit tests alone do NOT prove the
 * visibility join or the real trigger behavior — see
 * tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts
 * and tests/resultsVnext/kpi/organizationKpiAttention.realdb.test.ts for the
 * direct-on-Postgres counterparts these unit tests are explicitly NOT a
 * substitute for.
 *
 * RN-G5 (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md): every command
 * called in this file now requires an `access: CommandAccessContext` field.
 * This file's own scenarios are about ACTIVE_IMPACT_EXISTS/NOT_PROPOSED/
 * self-approval guards, not authorization — a WILDCARD_ACCESS fixture
 * (capabilities: ['*']) is passed to every call so none of them are
 * incidentally gated by the NEW RN-G5 check.
 */

const WILDCARD_ACCESS = { capabilities: ['*'], platformRole: null } as const;

let currentImpact: Record<string, unknown> | null = null;
let currentDefinitionVersionId: string | null = 'def-version-current';
let latestMeasurement: Record<string, unknown> | null = null;
let activeImpactPrecheckResult: Record<string, unknown> | null = null;
const insertedImpactRows: Array<Record<string, unknown>> = [];
const linkGraphEdgeInserts: unknown[][] = [];
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

  // proposeInitiativeKpiImpact's ACTIVE_IMPACT_EXISTS pre-check.
  if (
    s.startsWith('SELECT impact_id FROM rvn_kpi_initiative_impacts') &&
    s.includes("status IN ('proposed', 'committed')")
  ) {
    return activeImpactPrecheckResult
      ? { rows: [activeImpactPrecheckResult], rowCount: 1 }
      : { rows: [], rowCount: 0 };
  }

  // proposeInitiativeKpiImpact / supersedeInitiativeKpiImpact's replacement INSERT.
  if (s.startsWith('INSERT INTO rvn_kpi_initiative_impacts')) {
    const row = {
      impact_id: `impact-${insertedImpactRows.length + 1}`,
      organization_id: params[0],
      kpi_id: params[1],
      initiative_id: params[2],
      status: 'proposed',
      definition_version_id_at_commitment: null,
      expected_contribution_value: params[3],
      expected_contribution_direction: params[4],
      target_completion_date: params[5],
      proposed_by: params[6],
      proposed_at: '2026-08-09T00:00:00.000Z',
      baseline_measurement_id: null,
      baseline_value_at_commitment: null,
      baseline_period_end: null,
      committed_by: null,
      committed_at: null,
      reviewed_attribution_value: null,
      reviewed_attribution_measurement_id: null,
      review_rationale: null,
      reviewed_by: null,
      reviewed_at: null,
      superseded_by_impact_id: null,
      superseded_at: null,
      row_version: 1,
      created_by: params[6],
      created_at: '2026-08-09T00:00:00.000Z',
      updated_at: '2026-08-09T00:00:00.000Z',
    };
    insertedImpactRows.push(row);
    return { rows: [row], rowCount: 1 };
  }

  // executeAtomicCommand's loadForUpdate (commit / review / supersede).
  if (s.startsWith('SELECT * FROM rvn_kpi_initiative_impacts') && s.includes('FOR UPDATE')) {
    return currentImpact ? { rows: [currentImpact], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // commitInitiativeKpiImpact: current_definition_version_id lookup.
  if (s.startsWith('SELECT current_definition_version_id FROM rvn_kpi_definitions')) {
    return { rows: [{ current_definition_version_id: currentDefinitionVersionId }], rowCount: 1 };
  }

  // commitInitiativeKpiImpact: latest non-superseded measurement lookup.
  if (s.startsWith('SELECT m.measurement_id, m.actual_value, m.period_end')) {
    return latestMeasurement ? { rows: [latestMeasurement], rowCount: 1 } : { rows: [], rowCount: 0 };
  }

  // commitInitiativeKpiImpact: the committing UPDATE.
  if (s.includes("SET status = 'committed'")) {
    const updated = {
      ...currentImpact,
      status: 'committed',
      baseline_measurement_id: params[0],
      baseline_value_at_commitment: params[1],
      baseline_period_end: params[2],
      definition_version_id_at_commitment: params[3],
      committed_by: params[4],
      committed_at: '2026-08-09T01:00:00.000Z',
      row_version: params[5],
    };
    currentImpact = updated;
    return { rows: [updated], rowCount: 1 };
  }

  // commitInitiativeKpiImpact: link_graph_edges write.
  if (s.startsWith('INSERT INTO link_graph_edges')) {
    linkGraphEdgeInserts.push(params);
    return { rows: [{ id: params[0] }], rowCount: 1 };
  }

  // recordReviewedAttribution's UPDATE.
  if (s.includes('reviewed_attribution_value = $1')) {
    const updated = {
      ...currentImpact,
      status: currentImpact?.status === 'committed' ? 'realized_reviewed' : currentImpact?.status,
      reviewed_attribution_value: params[0],
      reviewed_attribution_measurement_id: params[1],
      review_rationale: params[2],
      reviewed_by: params[3],
      reviewed_at: '2026-08-09T02:00:00.000Z',
      row_version: params[4],
    };
    currentImpact = updated;
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

const {
  proposeInitiativeKpiImpact,
  commitInitiativeKpiImpact,
  recordReviewedAttribution,
  KpiInitiativeImpactValidationError,
  InitiativeKpiImpactSelfApprovalDeniedError,
} = await import('../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js');

function baseImpact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    impact_id: 'impact-1',
    organization_id: 'org-1',
    kpi_id: 'kpi-1',
    initiative_id: 'init-1',
    definition_version_id_at_commitment: null,
    status: 'proposed',
    expected_contribution_value: '10',
    expected_contribution_direction: 'increase',
    target_completion_date: null,
    proposed_by: 'user-owner',
    proposed_at: '2026-08-09T00:00:00.000Z',
    baseline_measurement_id: null,
    baseline_value_at_commitment: null,
    baseline_period_end: null,
    committed_by: null,
    committed_at: null,
    reviewed_attribution_value: null,
    reviewed_attribution_measurement_id: null,
    review_rationale: null,
    reviewed_by: null,
    reviewed_at: null,
    superseded_by_impact_id: null,
    superseded_at: null,
    row_version: 1,
    created_by: 'user-owner',
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  currentImpact = null;
  currentDefinitionVersionId = 'def-version-current';
  latestMeasurement = null;
  activeImpactPrecheckResult = null;
  insertedImpactRows.length = 0;
  linkGraphEdgeInserts.length = 0;
  releaseMock.mockClear();
});

describe('proposeInitiativeKpiImpact — at most one active impact per (kpi, initiative)', () => {
  it('rejects with ACTIVE_IMPACT_EXISTS when an active (proposed/committed) impact already exists', async () => {
    activeImpactPrecheckResult = { impact_id: 'impact-existing' };

    await expect(
      proposeInitiativeKpiImpact({
        organizationId: 'org-1',
        kpiId: 'kpi-1',
        initiativeId: 'init-1',
        expectedContributionValue: 5,
        expectedContributionDirection: 'increase',
        targetCompletionDate: null,
        proposedBy: 'user-1',
        actorEffectiveRole: 'consultant',
        idempotencyKey: 'idem-propose-1',
        access: WILDCARD_ACCESS,
      })
    ).rejects.toBeInstanceOf(KpiInitiativeImpactValidationError);

    expect(insertedImpactRows).toHaveLength(0);
  });

  it('allows the propose when no active impact exists for (kpi, initiative)', async () => {
    activeImpactPrecheckResult = null;

    const outcome = await proposeInitiativeKpiImpact({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      initiativeId: 'init-1',
      expectedContributionValue: 5,
      expectedContributionDirection: 'increase',
      targetCompletionDate: null,
      proposedBy: 'user-1',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-propose-2',
      access: WILDCARD_ACCESS,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.impact.status).toBe('proposed');
    expect(insertedImpactRows).toHaveLength(1);
  });
});

describe('commitInitiativeKpiImpact — freezes baseline from the latest measurement', () => {
  it('pins baseline_measurement_id/value/period_end from the current latest measurement', async () => {
    currentImpact = baseImpact({ status: 'proposed', row_version: 1 });
    latestMeasurement = {
      measurement_id: 'meas-latest',
      actual_value: '77',
      period_end: '2026-08-01T00:00:00.000Z',
    };
    currentDefinitionVersionId = 'def-version-77';

    const outcome = await commitInitiativeKpiImpact({
      organizationId: 'org-1',
      impactId: 'impact-1',
      expectedVersion: 1,
      committedBy: 'user-committer',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-commit-1',
      access: WILDCARD_ACCESS,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.impact.status).toBe('committed');
    expect(outcome.result.impact.baselineMeasurementId).toBe('meas-latest');
    expect(outcome.result.impact.baselineValueAtCommitment).toBe(77);
    expect(outcome.result.impact.baselinePeriodEnd).toBe('2026-08-01T00:00:00.000Z');
    expect(outcome.result.impact.definitionVersionIdAtCommitment).toBe('def-version-77');

    // Same-transaction link_graph_edges write, per design §C.3.
    expect(linkGraphEdgeInserts).toHaveLength(1);
    const [, orgId, createdBy, initiativeId, kpiId] = linkGraphEdgeInserts[0] as string[];
    expect(orgId).toBe('org-1');
    expect(createdBy).toBe('user-committer');
    expect(initiativeId).toBe('init-1');
    expect(kpiId).toBe('kpi-1');
  });

  it('leaves baseline_* NULL (never fabricated) when no measurement exists yet for the KPI', async () => {
    currentImpact = baseImpact({ status: 'proposed', row_version: 1 });
    latestMeasurement = null;

    const outcome = await commitInitiativeKpiImpact({
      organizationId: 'org-1',
      impactId: 'impact-1',
      expectedVersion: 1,
      committedBy: 'user-committer',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-commit-2',
      access: WILDCARD_ACCESS,
    });

    expect(outcome.result.impact.status).toBe('committed');
    expect(outcome.result.impact.baselineMeasurementId).toBeNull();
    expect(outcome.result.impact.baselineValueAtCommitment).toBeNull();
    expect(outcome.result.impact.baselinePeriodEnd).toBeNull();
  });

  it('rejects committing an impact that is not "proposed"', async () => {
    currentImpact = baseImpact({ status: 'committed', row_version: 2 });

    await expect(
      commitInitiativeKpiImpact({
        organizationId: 'org-1',
        impactId: 'impact-1',
        expectedVersion: 2,
        committedBy: 'user-committer',
        actorEffectiveRole: 'consultant',
        idempotencyKey: 'idem-commit-3',
        access: WILDCARD_ACCESS,
      })
    ).rejects.toMatchObject({ code: 'NOT_PROPOSED' });
  });
});

describe('recordReviewedAttribution — self-approval denial', () => {
  it('denies when reviewedBy matches committedBy', async () => {
    currentImpact = baseImpact({ status: 'committed', committed_by: 'user-committer', row_version: 2 });

    await expect(
      recordReviewedAttribution({
        organizationId: 'org-1',
        impactId: 'impact-1',
        expectedVersion: 2,
        reviewedAttributionValue: 5,
        reviewedAttributionMeasurementId: null,
        reviewRationale: 'self review',
        reviewedBy: 'user-committer',
        actorEffectiveRole: 'consultant',
        idempotencyKey: 'idem-review-1',
        access: WILDCARD_ACCESS,
      })
    ).rejects.toBeInstanceOf(InitiativeKpiImpactSelfApprovalDeniedError);

    expect(currentImpact?.status).toBe('committed');
  });

  it('allows when reviewedBy differs from committedBy, transitioning committed -> realized_reviewed', async () => {
    currentImpact = baseImpact({ status: 'committed', committed_by: 'user-committer', row_version: 2 });

    const outcome = await recordReviewedAttribution({
      organizationId: 'org-1',
      impactId: 'impact-1',
      expectedVersion: 2,
      reviewedAttributionValue: 9,
      reviewedAttributionMeasurementId: 'meas-review',
      reviewRationale: 'independent review',
      reviewedBy: 'user-reviewer',
      actorEffectiveRole: 'consultant',
      idempotencyKey: 'idem-review-2',
      access: WILDCARD_ACCESS,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.impact.status).toBe('realized_reviewed');
    expect(outcome.result.impact.reviewedAttributionValue).toBe(9);
    expect(outcome.result.impact.reviewedBy).toBe('user-reviewer');
  });
});
