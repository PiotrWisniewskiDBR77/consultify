/**
 * KPI-E006 — Teresa KPI advisor handoff, unit tests (3 governed modes).
 *
 * Design: docs/product/results-vnext/KPI_E006_TERESA_DESIGN.md §B. Mocking
 * pattern mirrors `server/src/services/v8/__tests__/teresaHandoffTargets.
 * failClosed.test.ts` (`vi.mock` the DB layer + the domain module(s) a
 * handler calls, drive the public `executeProposal` API, assert on receipts
 * / mock call args / thrown errors) — the internal `handle*Handoff`
 * functions are not exported, same as every other target's handlers in
 * teresaCopilotService.ts.
 *
 * -- DEVIATION FROM DESIGN (infra gap, not a design change): the design's
 * §E file list pins this exact path (`tests/v8/teresa-kpi-handoff.test.ts`),
 * but no `tests/v8/**` glob existed in vitest.config.ts's `include` list —
 * verified: the only prior Teresa unit tests live colocated under
 * `server/src/services/v8/__tests__/` / `server/src/routes/v8/__tests__/`,
 * both already covered by existing globs. Without adding the glob, this
 * file (and any future file under `tests/v8/`) would be silently
 * uncollectable by `npx vitest run tests/v8/...` even with the exact path
 * passed explicitly (positional paths are intersected with `include`, per
 * the comment already in vitest.config.ts next to the `tests/resultsVnext`
 * glob — a documented precedent for exactly this same class of gap). Fixed
 * by adding `'tests/v8/**' ...` to `include` in the same commit as this
 * file, mirroring the resultsVnext precedent.
 *
 * Four scenario groups, matching the task brief precisely:
 *   1. happy path (all 3 modes)
 *   2. STALE_VERSION (draft_quality_review edit path -> AtomicWriteConflictError
 *      re-thrown as-is, truth-preserving failure)
 *   3. no visibility in mode 2 (check_in_manager_brief re-resolves visibility
 *      at execution time and denies a cited KPI that is no longer visible)
 *   4. duplicate-risk in mode 1 (buildKpiDraftAdvisorContext, called directly
 *      — it runs BEFORE proposal creation per the design, not through
 *      performHandoff)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AtomicWriteConflictError } from '../../server/src/services/resultsVnext/platform/atomicWrite.js';

const mockDbRun = vi.fn().mockResolvedValue({ changes: 1 });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// RN-G5: teresaCopilotService.ts's KPI handoff handlers now resolve a real
// access context (resolveTeresaKpiAccess -> resolveEffectiveAccess) before
// calling createKpiDraft/editDraft/submitRootCause (all three now RN-G5-
// gated commands). That function reads through queryHelpers.js's
// getDatabase() singleton — a different DB access path than the DbPromise
// mock above — so it needs its own mock here. Wildcard: this suite tests
// the handoff plumbing (actor identity, receipts, error propagation), not
// authorization — the guard's own ALLOW/DENY logic has its own dedicated
// coverage (commandCapabilityGuard.test.ts, the RN-G5 real-Postgres
// security suite).
vi.mock('../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: ['*'], platformRole: null })),
  hasEffectiveCapability: (access: { capabilities: string[] }, capability: string) =>
    access.capabilities.includes('*') || access.capabilities.includes(capability),
}));

const mockCreateKpiDraft = vi.fn();
const mockEditDraft = vi.fn();
vi.mock('../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js', () => ({
  createKpiDraft: (...args: unknown[]) => mockCreateKpiDraft(...args),
  editDraft: (...args: unknown[]) => mockEditDraft(...args),
}));

const mockSubmitRootCause = vi.fn();
vi.mock('../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js', () => ({
  submitRootCause: (...args: unknown[]) => mockSubmitRootCause(...args),
}));

const mockGetKpi = vi.fn();
const mockListKpis = vi.fn();
vi.mock('../../server/src/services/resultsVnext/kpi/kpiRepository.js', () => ({
  getKpi: (...args: unknown[]) => mockGetKpi(...args),
  listKpis: (...args: unknown[]) => mockListKpis(...args),
}));

// Imported by the design's frozen 6-name whitelist but unused by any of the
// 3 handlers (see teresa-kpi-forbidden-verbs.test.ts) — mocked trivially so
// importing teresaCopilotService.ts never touches a real PoolClient/pg pool.
vi.mock('../../server/src/services/resultsVnext/kpi/kpiDeviationRepository.js', () => ({
  getDeviationCase: vi.fn(),
}));

const { executeProposal, buildKpiDraftAdvisorContext } = await import(
  '../../server/src/services/v8/teresaCopilotService.js'
);

const ORG = 'org-kpi-e006-1';
const USER = 'user-kpi-e006-1';
const SESSION = 'session-kpi-e006-1';

function buildHandoffContext() {
  return {
    origin: 'teresa',
    user_intent: 'draft a new KPI',
    active_surface: 'results/kpi',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: [],
    proposed_next_action: { target_module: 'kpi', handoff_intent: 'create', requires_approval: true },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  } as any;
}

function draftQualityReviewPayload(overrides: {
  resourceId?: string | null;
  expectedVersion?: number | null;
} = {}) {
  return {
    kpi_handoff_context: {
      advisor_mode: 'draft_quality_review',
      target_resource: {
        resource_type: 'kpi',
        resource_id: overrides.resourceId ?? null,
      },
      expected_version: overrides.expectedVersion ?? null,
      draft_quality_review: {
        proposed: {
          kpiCode: 'REV-001',
          name: 'Revenue growth',
          description: null,
          unit: '%',
          targetGeometry: 'threshold_min',
          targetValue: null,
          targetMin: 10,
          targetMax: null,
          warningLow: null,
          warningHigh: null,
          criticalLow: null,
          criticalHigh: null,
          binarySuccessValue: null,
          formulaText: null,
          ownerUserId: USER,
        },
        quality_review: {
          purpose_question: 'Why does this KPI matter?',
          actionability_question: 'What will change if it moves?',
          owner_load_note: null,
          target_evidence_note: null,
          duplicate_risk: { candidate_kpi_ids: [], note: null },
        },
        evidence_breakdown: {
          facts: [],
          inference: [],
          missing_evidence: [],
          recommendation: 'draft as proposed',
        },
      },
    },
    evidence_pointers: ['note:kpi-draft'],
  };
}

function checkInManagerBriefPayload(citedKpiIds: string[]) {
  return {
    kpi_handoff_context: {
      advisor_mode: 'check_in_manager_brief',
      target_resource: { resource_type: 'kpi', resource_id: null },
      expected_version: null,
      check_in_manager_brief: {
        scope: 'my_kpis',
        cited_kpi_ids: citedKpiIds,
        cited_deviation_case_ids: [],
        narrative: 'Revenue is trending on target this quarter.',
        evidence_breakdown: {
          facts: ['3 of 4 KPIs on target'],
          inference: [],
          missing_evidence: [],
          recommendation: 'no action needed',
        },
      },
    },
    evidence_pointers: ['kpi:kpi-1'],
  };
}

function reflectionRcaPayload(caseId: string, expectedVersion: number | null = 1) {
  return {
    kpi_handoff_context: {
      advisor_mode: 'reflection_rca',
      target_resource: { resource_type: 'deviation_case', resource_id: caseId },
      expected_version: expectedVersion,
      reflection_rca: {
        case_id: caseId,
        proposed_root_cause_summary: 'Vendor SLA breach',
        proposed_root_cause_category: 'external_dependency',
        recurrence_flag: false,
        evidence_breakdown: {
          facts: ['measurement below critical threshold'],
          inference: ['vendor SLA breach likely cause'],
          missing_evidence: ['vendor incident report'],
          recommendation: 'confirm with vendor before closing',
        },
      },
    },
    evidence_pointers: [`deviation_case:${caseId}`],
  };
}

async function runExecute(targetPayload: Record<string, unknown>, proposalId = `proposal-kpi-${Math.random()}`) {
  mockDbGet.mockResolvedValue({
    id: proposalId,
    organization_id: ORG,
    user_id: USER,
    session_id: SESSION,
    target_module: 'kpi',
    state: 'approved',
    handoff_context_json: JSON.stringify(buildHandoffContext()),
    target_payload_json: JSON.stringify(targetPayload),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return executeProposal({ proposalId, organizationId: ORG, userId: USER });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbRun.mockResolvedValue({ changes: 1 });
  mockDbGet.mockResolvedValue(null);
  mockDbAll.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// 1. Happy path — all 3 modes
// ---------------------------------------------------------------------------

describe('KPI-E006 — happy path', () => {
  it('draft_quality_review CREATE path: createKpiDraft called with actorEffectiveRole teresa_initiated and createdBy=userId, writes one kpi receipt', async () => {
    mockCreateKpiDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-1',
      resultingVersion: 1,
      result: {
        kpi: { kpiId: 'kpi-new-1', rowVersion: 1, status: 'draft' },
        definitionVersion: { definitionVersionId: 'defver-1' },
      },
    });

    const result: any = await runExecute(draftQualityReviewPayload());

    expect(result.success).toBe(true);
    expect(result.state).toBe('completed');
    expect(mockCreateKpiDraft).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateKpiDraft.mock.calls[0][0];
    expect(callArgs.createdBy).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');
    expect(callArgs.kpiCode).toBe('REV-001');

    expect(result.handoff_result.kpi_id).toBe('kpi-new-1');
    expect(result.handoff_result.definition_version_id).toBe('defver-1');
    expect(result.handoff_result.status).toBe('draft');
    expect(result.handoff_result.real_entity).toBe(true);

    const receiptInserts = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO teresa_handoff_results')
    );
    expect(receiptInserts).toHaveLength(1);
    expect(receiptInserts[0][1]).toContain('kpi-new-1');
    // target_module is a literal in the SQL text (matches the pattern every
    // other handle*Handoff function uses, e.g. handleRadarHandoff's
    // `VALUES (?, ?, ?, 'radar', ?, ?)`), not a bound param.
    expect(receiptInserts[0][0]).toContain("'kpi'");
  });

  it('draft_quality_review EDIT path: resolves definitionVersionId via getKpi() first, calls editDraft with actorUserId (not editedBy)', async () => {
    mockGetKpi.mockResolvedValue({
      kpiId: 'kpi-existing-1',
      currentDefinitionVersionId: 'defver-existing-1',
      rowVersion: 3,
    });
    mockEditDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-2',
      resultingVersion: 2,
      result: { definitionVersionId: 'defver-existing-1', kpiId: 'kpi-existing-1' },
    });

    const result: any = await runExecute(
      draftQualityReviewPayload({ resourceId: 'kpi-existing-1', expectedVersion: 1 })
    );

    expect(result.success).toBe(true);
    expect(mockGetKpi).toHaveBeenCalledWith({ userId: USER, organizationId: ORG, kpiId: 'kpi-existing-1' });
    expect(mockEditDraft).toHaveBeenCalledTimes(1);
    const callArgs = mockEditDraft.mock.calls[0][0];
    expect(callArgs.definitionVersionId).toBe('defver-existing-1');
    expect(callArgs.actorUserId).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');
    // Decision #1: the real EditDraftInput field is `actorUserId`, not
    // `editedBy` (the design draft's original, wrong field name) — assert
    // the wrong key was never sent.
    expect(callArgs.editedBy).toBeUndefined();
    expect(result.handoff_result.kpi_id).toBe('kpi-existing-1');
  });

  it('check_in_manager_brief: re-checks visibility at execution time, writes a synthetic "brief:" receipt, calls no KPI command', async () => {
    mockListKpis.mockResolvedValue([{ kpiId: 'kpi-1' }, { kpiId: 'kpi-2' }]);

    const result: any = await runExecute(checkInManagerBriefPayload(['kpi-1', 'kpi-2']), 'proposal-brief-1');

    expect(result.success).toBe(true);
    expect(result.handoff_result.real_entity).toBe(false);
    expect(result.handoff_result.narrative).toContain('Revenue');
    expect(mockCreateKpiDraft).not.toHaveBeenCalled();
    expect(mockEditDraft).not.toHaveBeenCalled();
    expect(mockSubmitRootCause).not.toHaveBeenCalled();

    const receiptInserts = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO teresa_handoff_results')
    );
    expect(receiptInserts).toHaveLength(1);
    expect(receiptInserts[0][1]).toContain('brief:proposal-brief-1');
  });

  it('reflection_rca: submitRootCause called with actorUserId=userId (never a teresa sentinel)', async () => {
    mockSubmitRootCause.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-3',
      resultingVersion: 2,
      result: { caseId: 'case-1', status: 'plan_required' },
    });

    const result: any = await runExecute(reflectionRcaPayload('case-1'), 'proposal-rca-1');

    expect(result.success).toBe(true);
    expect(mockSubmitRootCause).toHaveBeenCalledTimes(1);
    const callArgs = mockSubmitRootCause.mock.calls[0][0];
    expect(callArgs.actorUserId).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');
    expect(callArgs.caseId).toBe('case-1');
    expect(result.handoff_result.case_id).toBe('case-1');
    expect(result.handoff_result.case_status).toBe('plan_required');
  });
});

// ---------------------------------------------------------------------------
// 2. STALE_VERSION — draft_quality_review edit path
// ---------------------------------------------------------------------------

describe('KPI-E006 — STALE_VERSION is a truth-preserving failure, never swallowed', () => {
  it('editDraft throwing AtomicWriteConflictError fails the whole proposal, writes no receipt', async () => {
    mockGetKpi.mockResolvedValue({
      kpiId: 'kpi-existing-2',
      currentDefinitionVersionId: 'defver-existing-2',
      rowVersion: 5,
    });
    mockEditDraft.mockRejectedValue(
      new AtomicWriteConflictError('Aggregate was modified since it was last read', 'STALE_VERSION', {
        currentVersion: 5,
        expectedVersion: 1,
      })
    );

    const result: any = await runExecute(
      draftQualityReviewPayload({ resourceId: 'kpi-existing-2', expectedVersion: 1 }),
      'proposal-stale-1'
    );

    expect(result.success).toBe(false);
    expect(result.state).not.toBe('completed');
    expect(result.error).toMatch(/modified since it was last read/i);

    const receiptInserts = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO teresa_handoff_results')
    );
    expect(receiptInserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. No visibility in mode 2 (check_in_manager_brief)
// ---------------------------------------------------------------------------

describe('KPI-E006 — check_in_manager_brief denies a cited KPI that is no longer visible', () => {
  it('a cited kpi_id absent from the re-resolved listKpis() result fails the proposal with P08_KPI_VISIBILITY_STALE, no receipt written', async () => {
    // Payload was assembled minutes earlier in chat citing kpi-1/kpi-2, but
    // AT EXECUTION TIME kpi-2 is no longer visible (e.g. ownership/ACL
    // changed) — listKpis() now only returns kpi-1.
    mockListKpis.mockResolvedValue([{ kpiId: 'kpi-1' }]);

    const result: any = await runExecute(checkInManagerBriefPayload(['kpi-1', 'kpi-2']), 'proposal-brief-stale-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer visible/i);
    expect(result.error).toContain('kpi-2');

    const receiptInserts = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO teresa_handoff_results')
    );
    expect(receiptInserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Duplicate-risk in mode 1 — buildKpiDraftAdvisorContext (called directly,
//    BEFORE proposal creation, not through performHandoff/executeProposal)
// ---------------------------------------------------------------------------

describe('KPI-E006 — buildKpiDraftAdvisorContext duplicate-risk lookup', () => {
  it('flags candidates matching on kpiCode (case-insensitive, exact)', async () => {
    mockListKpis.mockResolvedValue([
      { kpiId: 'kpi-a', kpiCode: 'rev-001' },
      { kpiId: 'kpi-b', kpiCode: 'other' },
    ]);

    const result = await buildKpiDraftAdvisorContext({
      userId: USER,
      organizationId: ORG,
      candidateName: 'Revenue growth',
      candidateCode: 'REV-001',
    });

    expect(result.candidateKpiIds).toEqual(['kpi-a']);
    expect(result.note).toContain('1 visible KPI');
  });

  it('flags candidates matching on a name substring longer than 3 chars', async () => {
    // needle = candidateName.trim().toLowerCase() is matched via
    // kpiCode.includes(needle) — the candidate NAME is matched against the
    // existing KPI's CODE (buildKpiDraftAdvisorContext's own contract, see
    // teresaCopilotService.ts), so the fixture code must literally contain
    // the (lowercased) candidate name as a substring, not just be
    // semantically similar.
    mockListKpis.mockResolvedValue([{ kpiId: 'kpi-c', kpiCode: 'monthlychurnratev2' }]);

    const result = await buildKpiDraftAdvisorContext({
      userId: USER,
      organizationId: ORG,
      candidateName: 'churnrate',
      candidateCode: 'CR-999',
    });

    expect(result.candidateKpiIds).toEqual(['kpi-c']);
    expect(result.note).not.toBeNull();
  });

  it('returns no candidates and a null note when nothing matches', async () => {
    mockListKpis.mockResolvedValue([{ kpiId: 'kpi-d', kpiCode: 'unrelated-metric' }]);

    const result = await buildKpiDraftAdvisorContext({
      userId: USER,
      organizationId: ORG,
      candidateName: 'Brand new KPI',
      candidateCode: 'BNK-777',
    });

    expect(result.candidateKpiIds).toEqual([]);
    expect(result.note).toBeNull();
  });

  it('is visibility-scoped: calls listKpis() with the caller userId/organizationId, never a raw query', async () => {
    mockListKpis.mockResolvedValue([]);

    await buildKpiDraftAdvisorContext({
      userId: USER,
      organizationId: ORG,
      candidateName: 'Anything',
      candidateCode: 'ANY-001',
    });

    expect(mockListKpis).toHaveBeenCalledWith({ userId: USER, organizationId: ORG, limit: 500 });
  });
});

// ---------------------------------------------------------------------------
// undoProposal — decision #3, KPI handoffs get a dedicated code
// ---------------------------------------------------------------------------

describe('KPI-E006 — undoProposal is explicitly not supported for kpi handoffs', () => {
  it('throws P08_UNDO_NOT_SUPPORTED, distinct from the generic P08_UNDO_UNSUPPORTED_TARGET other non-excele targets get', async () => {
    const { undoProposal } = await import('../../server/src/services/v8/teresaCopilotService.js');
    mockDbGet.mockResolvedValue({
      id: 'proposal-kpi-undo-1',
      organization_id: ORG,
      user_id: USER,
      session_id: SESSION,
      target_module: 'kpi',
      state: 'completed',
      handoff_context_json: JSON.stringify(buildHandoffContext()),
      target_payload_json: JSON.stringify(draftQualityReviewPayload()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      undoProposal({ proposalId: 'proposal-kpi-undo-1', organizationId: ORG, userId: USER })
    ).rejects.toMatchObject({ code: 'P08_UNDO_NOT_SUPPORTED' });
  });
});
