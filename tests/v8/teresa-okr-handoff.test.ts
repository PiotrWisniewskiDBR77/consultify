/**
 * OKR-E008 — Teresa OKR advisor handoff, unit tests (5 governed modes).
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §3. Mocking pattern
 * mirrors `tests/v8/teresa-roi-handoff.test.ts`/`teresa-kpi-handoff.test.ts`
 * — `vi.mock` the DB layer + the 6 OKR-domain modules Teresa's whitelist
 * imports from (see `tests/resultsVnext/teresa-okr-forbidden-verbs.test.ts`
 * for the real, grep-able proof of exactly those 6 import lines), drive the
 * public `executeProposal`/`undoProposal` API, assert on receipts/mock call
 * args/thrown errors. The internal `handleResultsOkrHandoff`/`handleOkr*`
 * functions are not exported, same as every other target's handlers in
 * teresaCopilotService.ts.
 *
 * Scenario groups, one per mode plus cross-cutting:
 *   1. objective_draft — happy path + Set-not-visible failure
 *   2. objective_quality_review — happy path (real_entity:false) + leaked
 *      duplicate-risk candidate re-check failure
 *   3. check_in_assist — happy path + KR-not-visible failure
 *   4. manager_brief — happy path (real_entity:false) + leaked cited Set
 *      re-check failure
 *   5. reflection_synthesis — happy path + domain rejection
 *      (DISPOSITION_ALREADY_RECORDED) is a truth-preserving failure, never
 *      swallowed, no receipt written
 *   6. missing okr_handoff_context.advisor_mode -> P08_OKR_INVALID_PAYLOAD
 *   7. undoProposal is explicitly not supported for okr handoffs
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

// The 6 OKR-domain import lines teresaCopilotService.ts actually carries
// (pinned by tests/resultsVnext/teresa-okr-forbidden-verbs.test.ts).
const mockCreateObjective = vi.fn();
vi.mock('../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js', () => ({
  createObjective: (...args: unknown[]) => mockCreateObjective(...args),
}));

const mockGetObjective = vi.fn();
const mockListObjectivesForSet = vi.fn();
const mockGetKeyResult = vi.fn();
vi.mock('../../server/src/services/resultsVnext/okr/okrObjectiveRepository.js', () => ({
  getObjective: (...args: unknown[]) => mockGetObjective(...args),
  listObjectivesForSet: (...args: unknown[]) => mockListObjectivesForSet(...args),
  getKeyResult: (...args: unknown[]) => mockGetKeyResult(...args),
}));

const mockRecordCheckIn = vi.fn();
vi.mock('../../server/src/services/resultsVnext/okr/okrCheckInCommands.js', () => ({
  recordCheckIn: (...args: unknown[]) => mockRecordCheckIn(...args),
}));

const mockListOrganizationOkrAttention = vi.fn();
vi.mock('../../server/src/services/resultsVnext/okr/okrAttentionRepository.js', () => ({
  listOrganizationOkrAttention: (...args: unknown[]) => mockListOrganizationOkrAttention(...args),
}));

const mockRecordOkrReflectionTeresaDraft = vi.fn();
vi.mock('../../server/src/services/resultsVnext/okr/okrReflectionCommands.js', () => ({
  recordOkrReflectionTeresaDraft: (...args: unknown[]) => mockRecordOkrReflectionTeresaDraft(...args),
}));

const mockGetOkrSet = vi.fn();
vi.mock('../../server/src/services/resultsVnext/okr/okrSetRepository.js', () => ({
  getOkrSet: (...args: unknown[]) => mockGetOkrSet(...args),
}));

// KPI/ROI whitelists are imported unconditionally by teresaCopilotService.ts
// — mocked trivially so importing it never touches a real PoolClient/pg pool
// via those domains either (same posture teresa-roi-handoff.test.ts's own
// header documents for the KPI side).
vi.mock('../../server/src/services/resultsVnext/kpi/kpiDefinitionCommands.js', () => ({
  createKpiDraft: vi.fn(),
  editDraft: vi.fn(),
}));
vi.mock('../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js', () => ({
  submitRootCause: vi.fn(),
}));
vi.mock('../../server/src/services/resultsVnext/kpi/kpiRepository.js', () => ({
  getKpi: vi.fn(),
  listKpis: vi.fn(),
}));
vi.mock('../../server/src/services/resultsVnext/kpi/kpiDeviationRepository.js', () => ({
  getDeviationCase: vi.fn(),
}));
vi.mock('../../server/src/services/resultsVnext/roi/roiPirCommands.js', () => ({
  recordRoiPirTeresaLessonsDraft: vi.fn(),
}));
vi.mock('../../server/src/services/resultsVnext/roi/roiPirRepository.js', () => ({
  getRoiPostInvestmentReview: vi.fn(),
}));

const { executeProposal, undoProposal } = await import('../../server/src/services/v8/teresaCopilotService.js');

const ORG = 'org-okr-e008-1';
const USER = 'user-okr-e008-1';
const SESSION = 'session-okr-e008-1';

function buildHandoffContext() {
  return {
    origin: 'teresa',
    user_intent: 'draft an Objective',
    active_surface: 'results/okr',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: [],
    proposed_next_action: { target_module: 'okr', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  } as any;
}

function evidenceBreakdown() {
  return { facts: ['fact'], inference: ['inference'], missing_evidence: [], recommendation: 'do the thing' };
}

async function runExecute(targetPayload: Record<string, unknown>, proposalId = `proposal-okr-${Math.random()}`) {
  mockDbGet.mockResolvedValue({
    id: proposalId,
    organization_id: ORG,
    user_id: USER,
    session_id: SESSION,
    target_module: 'okr',
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

function receiptInserts() {
  return mockDbRun.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO teresa_handoff_results'));
}

// ---------------------------------------------------------------------------
// 1. objective_draft
// ---------------------------------------------------------------------------

describe('OKR-E008 — objective_draft', () => {
  function payload() {
    return {
      okr_handoff_context: {
        advisor_mode: 'objective_draft',
        target_resource: { resource_type: 'okr_set', resource_id: null },
        expected_version: null,
        objective_draft: {
          proposed: {
            setId: 'set-1',
            title: 'Grow enterprise pipeline',
            description: null,
            rationale: null,
            ambitionType: 'aspirational',
            ownerUserId: USER,
          },
          evidence_breakdown: evidenceBreakdown(),
        },
      },
      evidence_pointers: ['okr_set:set-1'],
    };
  }

  it('createObjective called with actorEffectiveRole teresa_initiated and createdBy=userId (never a teresa sentinel), writes one okr receipt', async () => {
    mockGetOkrSet.mockResolvedValue({ setId: 'set-1', status: 'active' });
    mockCreateObjective.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-1',
      resultingVersion: 1,
      result: { objectiveId: 'obj-1', setId: 'set-1', status: 'draft' },
    });

    const result: any = await runExecute(payload());

    expect(result.success).toBe(true);
    expect(mockGetOkrSet).toHaveBeenCalledWith({ userId: USER, organizationId: ORG, setId: 'set-1' });
    expect(mockCreateObjective).toHaveBeenCalledTimes(1);
    const callArgs = mockCreateObjective.mock.calls[0][0];
    expect(callArgs.setId).toBe('set-1');
    expect(callArgs.title).toBe('Grow enterprise pipeline');
    expect(callArgs.createdBy).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');

    expect(result.handoff_result.handoff).toBe('okr');
    expect(result.handoff_result.advisor_mode).toBe('objective_draft');
    expect(result.handoff_result.objective_id).toBe('obj-1');
    expect(result.handoff_result.real_entity).toBe(true);

    expect(receiptInserts()).toHaveLength(1);
    expect(receiptInserts()[0][0]).toContain("'okr'");
  });

  it('Set not found/visible fails with P08_OKR_VISIBILITY_STALE, createObjective never called', async () => {
    mockGetOkrSet.mockResolvedValue(null);
    const result: any = await runExecute(payload(), 'proposal-okr-set-missing');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found or not visible/i);
    expect(mockCreateObjective).not.toHaveBeenCalled();
    expect(receiptInserts()).toHaveLength(0);
  });

  it('expected_version must be null on the create path', async () => {
    const p = payload();
    (p.okr_handoff_context as any).expected_version = 3;
    const result: any = await runExecute(p, 'proposal-okr-bad-version');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expected_version must be null/i);
    expect(mockGetOkrSet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. objective_quality_review — real_entity:false
// ---------------------------------------------------------------------------

describe('OKR-E008 — objective_quality_review', () => {
  function payload(candidateIds: string[] = ['obj-2']) {
    return {
      okr_handoff_context: {
        advisor_mode: 'objective_quality_review',
        target_resource: { resource_type: 'okr_objective', resource_id: 'obj-1' },
        expected_version: null,
        objective_quality_review: {
          objective_id: 'obj-1',
          quality_review: {
            purpose_question: 'What does this Objective unlock?',
            actionability_question: 'What is the first concrete step?',
            ambition_alignment_note: null,
            duplicate_risk: { candidate_objective_ids: candidateIds, note: null },
          },
          evidence_breakdown: evidenceBreakdown(),
        },
      },
      evidence_pointers: ['okr_objective:obj-1'],
    };
  }

  it('reviews an existing Objective, never writes, real_entity:false', async () => {
    mockGetObjective.mockResolvedValue({ objectiveId: 'obj-1', setId: 'set-1' });
    mockListObjectivesForSet.mockResolvedValue([
      { objectiveId: 'obj-1' },
      { objectiveId: 'obj-2' },
    ]);

    const result: any = await runExecute(payload());

    expect(result.success).toBe(true);
    expect(result.handoff_result.advisor_mode).toBe('objective_quality_review');
    expect(result.handoff_result.real_entity).toBe(false);
    expect(result.handoff_result.objective_id).toBe('obj-1');
    expect(receiptInserts()).toHaveLength(1);
  });

  it('a cited duplicate-risk candidate no longer visible fails with P08_OKR_VISIBILITY_STALE (re-checked at execution time)', async () => {
    mockGetObjective.mockResolvedValue({ objectiveId: 'obj-1', setId: 'set-1' });
    mockListObjectivesForSet.mockResolvedValue([{ objectiveId: 'obj-1' }]); // obj-2 no longer visible

    const result: any = await runExecute(payload(['obj-2']), 'proposal-okr-qr-leaked');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer visible/i);
    expect(receiptInserts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. check_in_assist
// ---------------------------------------------------------------------------

describe('OKR-E008 — check_in_assist', () => {
  function payload() {
    return {
      okr_handoff_context: {
        advisor_mode: 'check_in_assist',
        target_resource: { resource_type: 'okr_key_result', resource_id: 'kr-1' },
        expected_version: null,
        check_in_assist: {
          key_result_id: 'kr-1',
          cadence_occurrence_id: 'occ-1',
          proposed_confidence: 'medium',
          proposed_confidence_numeric_value: null,
          proposed_value: 42,
          note: 'On track per last week\'s pipeline review.',
          evidence_breakdown: evidenceBreakdown(),
        },
      },
      evidence_pointers: ['okr_key_result:kr-1'],
    };
  }

  it('recordCheckIn called with submittedBy=userId and actorEffectiveRole teresa_initiated, writes one okr receipt', async () => {
    mockGetKeyResult.mockResolvedValue({ keyResultId: 'kr-1', setId: 'set-1' });
    mockRecordCheckIn.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-2',
      resultingVersion: 2,
      result: { checkIn: { checkInId: 'checkin-1' }, keyResult: { keyResultId: 'kr-1' }, set: { setId: 'set-1' } },
    });

    const result: any = await runExecute(payload());

    expect(result.success).toBe(true);
    expect(mockRecordCheckIn).toHaveBeenCalledTimes(1);
    const callArgs = mockRecordCheckIn.mock.calls[0][0];
    expect(callArgs.keyResultId).toBe('kr-1');
    expect(callArgs.cadenceOccurrenceId).toBe('occ-1');
    expect(callArgs.newValue).toBe(42);
    expect(callArgs.submittedBy).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');
    // No CAS param — recordCheckIn (okrCheckInCommands.ts) has no
    // expectedVersion field at all (documented divergence).
    expect(callArgs.expectedVersion).toBeUndefined();

    expect(result.handoff_result.checkin_id).toBe('checkin-1');
    expect(result.handoff_result.real_entity).toBe(true);
    expect(receiptInserts()).toHaveLength(1);
  });

  it('KeyResult not found/visible fails with P08_OKR_VISIBILITY_STALE, recordCheckIn never called', async () => {
    mockGetKeyResult.mockResolvedValue(null);
    const result: any = await runExecute(payload(), 'proposal-okr-kr-missing');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found or not visible/i);
    expect(mockRecordCheckIn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. manager_brief — real_entity:false, cites listOrganizationOkrAttention only
// ---------------------------------------------------------------------------

describe('OKR-E008 — manager_brief', () => {
  function payload(citedSetIds: string[] = ['set-9']) {
    return {
      okr_handoff_context: {
        advisor_mode: 'manager_brief',
        target_resource: { resource_type: 'okr_set', resource_id: null },
        expected_version: null,
        manager_brief: {
          scope: 'team',
          cited_set_ids: citedSetIds,
          narrative: 'Two Sets are at risk this cycle.',
          evidence_breakdown: evidenceBreakdown(),
        },
      },
      evidence_pointers: ['okr_set:set-9'],
    };
  }

  it('cites the fresh attention read model only, real_entity:false', async () => {
    mockListOrganizationOkrAttention.mockResolvedValue({
      staleCheckins: [{ setId: 'set-9', title: 'Q3 Growth', nextCheckinDueAt: '2026-08-01' }],
      lowConfidenceObjectives: [],
      openSupportRequests: [],
      openBlockers: [],
      escalatedSets: [],
    });

    const result: any = await runExecute(payload());

    expect(result.success).toBe(true);
    expect(mockListOrganizationOkrAttention).toHaveBeenCalledWith({ managerId: USER, organizationId: ORG });
    expect(result.handoff_result.advisor_mode).toBe('manager_brief');
    expect(result.handoff_result.real_entity).toBe(false);
    expect(receiptInserts()).toHaveLength(1);
  });

  it('a cited Set no longer present in the attention read model fails with P08_OKR_VISIBILITY_STALE', async () => {
    mockListOrganizationOkrAttention.mockResolvedValue({
      staleCheckins: [],
      lowConfidenceObjectives: [],
      openSupportRequests: [],
      openBlockers: [],
      escalatedSets: [],
    });

    const result: any = await runExecute(payload(['set-9']), 'proposal-okr-brief-leaked');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no longer present/i);
    expect(receiptInserts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. reflection_synthesis — two-gate structure, mirrors ROI-E008 exactly
// ---------------------------------------------------------------------------

describe('OKR-E008 — reflection_synthesis', () => {
  function payload(overrides: { expectedVersion?: number } = {}) {
    return {
      okr_handoff_context: {
        advisor_mode: 'reflection_synthesis',
        target_resource: { resource_type: 'okr_objective', resource_id: 'obj-1' },
        expected_version: overrides.expectedVersion ?? 0,
        reflection_synthesis: {
          set_id: 'set-1',
          objective_id: 'obj-1',
          draft_reflection_text: 'What worked: focused scope. What did not: late KR check-ins.',
          proposed_disposition_hint: 'carry_forward',
          evidence_breakdown: evidenceBreakdown(),
        },
      },
      evidence_pointers: ['okr_objective:obj-1'],
    };
  }

  it('recordOkrReflectionTeresaDraft called with actorEffectiveRole teresa_initiated and actorUserId=userId, writes one okr receipt', async () => {
    mockRecordOkrReflectionTeresaDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-3',
      resultingVersion: 1,
      result: { reflectionId: 'refl-1', objectiveId: 'obj-1', setId: 'set-1' },
    });

    const result: any = await runExecute(payload({ expectedVersion: 0 }));

    expect(result.success).toBe(true);
    expect(mockRecordOkrReflectionTeresaDraft).toHaveBeenCalledTimes(1);
    const callArgs = mockRecordOkrReflectionTeresaDraft.mock.calls[0][0];
    expect(callArgs.objectiveId).toBe('obj-1');
    expect(callArgs.setId).toBe('set-1');
    expect(callArgs.expectedVersion).toBe(0);
    expect(callArgs.actorUserId).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');
    expect(callArgs.draftPayload.draft_reflection_text).toContain('focused scope');

    expect(result.handoff_result.handoff).toBe('okr');
    expect(result.handoff_result.advisor_mode).toBe('reflection_synthesis');
    expect(result.handoff_result.real_entity).toBe(true);
    expect(receiptInserts()).toHaveLength(1);
  });

  it('missing expected_version fails with P08_OKR_INVALID_PAYLOAD', async () => {
    const p = payload();
    (p.okr_handoff_context as any).expected_version = null;
    const result: any = await runExecute(p, 'proposal-okr-refl-no-version');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/expected_version required/i);
    expect(mockRecordOkrReflectionTeresaDraft).not.toHaveBeenCalled();
  });

  it('domain rejection (DISPOSITION_ALREADY_RECORDED) is a truth-preserving failure, never swallowed, writes no receipt', async () => {
    const domainError: any = new Error(
      'OKR Reflection for Objective obj-1 already has a recorded Teresa draft disposition'
    );
    domainError.code = 'DISPOSITION_ALREADY_RECORDED';
    mockRecordOkrReflectionTeresaDraft.mockRejectedValue(domainError);

    const result: any = await runExecute(payload({ expectedVersion: 2 }), 'proposal-okr-refl-blocked');

    expect(result.success).toBe(false);
    expect(result.state).not.toBe('completed');
    expect(result.error).toMatch(/already has a recorded Teresa draft disposition/i);
    expect(receiptInserts()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. missing advisor_mode
// ---------------------------------------------------------------------------

describe('OKR-E008 — missing advisor_mode', () => {
  it('fails with P08_OKR_INVALID_PAYLOAD, no domain function called', async () => {
    const result: any = await runExecute({ okr_handoff_context: {}, evidence_pointers: [] }, 'proposal-okr-badmode');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/advisor_mode missing/i);
    expect(mockCreateObjective).not.toHaveBeenCalled();
    expect(mockRecordCheckIn).not.toHaveBeenCalled();
    expect(mockRecordOkrReflectionTeresaDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. undoProposal — Decision D-OKR8-9, OKR handoffs get a dedicated code
// ---------------------------------------------------------------------------

describe('OKR-E008 — undoProposal is explicitly not supported for okr handoffs', () => {
  it('throws P08_UNDO_NOT_SUPPORTED, distinct from the generic P08_UNDO_UNSUPPORTED_TARGET other non-excele targets get', async () => {
    mockDbGet.mockResolvedValue({
      id: 'proposal-okr-undo-1',
      organization_id: ORG,
      user_id: USER,
      session_id: SESSION,
      target_module: 'okr',
      state: 'completed',
      handoff_context_json: JSON.stringify(buildHandoffContext()),
      target_payload_json: JSON.stringify({ okr_handoff_context: {}, evidence_pointers: [] }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      undoProposal({ proposalId: 'proposal-okr-undo-1', organizationId: ORG, userId: USER })
    ).rejects.toMatchObject({ code: 'P08_UNDO_NOT_SUPPORTED' });
  });
});
