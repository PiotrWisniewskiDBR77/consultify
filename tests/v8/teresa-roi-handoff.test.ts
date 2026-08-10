/**
 * ROI-E008 — Teresa ROI advisor handoff, unit tests (1 governed mode).
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §2/A2. Mocking
 * pattern mirrors `tests/v8/teresa-kpi-handoff.test.ts` (KPI-E006) — `vi.mock`
 * the DB layer + the 2 ROI-domain modules Teresa's whitelist imports from,
 * drive the public `executeProposal`/`undoProposal`/
 * `buildRoiPirLessonsAdvisorContext` API, assert on receipts/mock call
 * args/thrown errors. The internal `handleResultsRoiHandoff`/
 * `handleRoiPirLessonsDraft` functions are not exported, same as every
 * other target's handlers in teresaCopilotService.ts.
 *
 * Three scenario groups:
 *   1. happy path (the one mode)
 *   2. truth-preserving failure: recordRoiPirTeresaLessonsDraft rejecting
 *      (e.g. DISPOSITION_ALREADY_RECORDED) fails the whole proposal, writes
 *      no receipt
 *   3. buildRoiPirLessonsAdvisorContext (called directly, BEFORE proposal
 *      creation, not through performHandoff) — AC-01's literal mechanism
 *   4. undoProposal is explicitly not supported for roi handoffs
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

const mockRecordRoiPirTeresaLessonsDraft = vi.fn();
vi.mock('../../server/src/services/resultsVnext/roi/roiPirCommands.js', () => ({
  recordRoiPirTeresaLessonsDraft: (...args: unknown[]) => mockRecordRoiPirTeresaLessonsDraft(...args),
}));

const mockGetRoiPostInvestmentReview = vi.fn();
vi.mock('../../server/src/services/resultsVnext/roi/roiPirRepository.js', () => ({
  getRoiPostInvestmentReview: (...args: unknown[]) => mockGetRoiPostInvestmentReview(...args),
}));

// Imported by the design's frozen 4-name KPI whitelist but unused by any of
// the ROI handlers (this file only exercises the ROI target) — mocked
// trivially so importing teresaCopilotService.ts never touches a real
// PoolClient/pg pool via the KPI domain either.
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

const { executeProposal, undoProposal, buildRoiPirLessonsAdvisorContext } = await import(
  '../../server/src/services/v8/teresaCopilotService.js'
);

const ORG = 'org-roi-e008-1';
const USER = 'user-roi-e008-1';
const SESSION = 'session-roi-e008-1';

function buildHandoffContext() {
  return {
    origin: 'teresa',
    user_intent: 'draft PIR lessons learned',
    active_surface: 'results/roi',
    org_context_ref: `org:${ORG}`,
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: [],
    proposed_next_action: { target_module: 'roi', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  } as any;
}

function pirLessonsDraftPayload(overrides: { pirId?: string; caseId?: string; expectedVersion?: number } = {}) {
  return {
    roi_handoff_context: {
      advisor_mode: 'pir_lessons_draft',
      target_resource: { resource_type: 'roi_pir', resource_id: overrides.pirId ?? 'pir-1' },
      case_id: overrides.caseId ?? 'case-1',
      expected_version: overrides.expectedVersion ?? 3,
      pir_lessons_draft: {
        draft_lessons_text: 'Automate the manual reconciliation step earlier in the rollout.',
        evidence_breakdown: {
          facts: ['benefits realized below target'],
          inference: ['manual step delayed correction'],
          missing_evidence: ['vendor SLA report'],
          recommendation: 'automate reconciliation',
        },
      },
    },
    evidence_pointers: ['roi_pir:pir-1'],
  };
}

async function runExecute(targetPayload: Record<string, unknown>, proposalId = `proposal-roi-${Math.random()}`) {
  mockDbGet.mockResolvedValue({
    id: proposalId,
    organization_id: ORG,
    user_id: USER,
    session_id: SESSION,
    target_module: 'roi',
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
// 1. Happy path — the one mode
// ---------------------------------------------------------------------------

describe('ROI-E008 — happy path (pir_lessons_draft)', () => {
  it('recordRoiPirTeresaLessonsDraft called with actorEffectiveRole teresa_initiated and actorUserId=userId (never a teresa sentinel), writes one roi receipt', async () => {
    mockRecordRoiPirTeresaLessonsDraft.mockResolvedValue({
      outcome: 'applied',
      eventId: 'event-1',
      resultingVersion: 4,
      result: { pirId: 'pir-1', caseId: 'case-1' },
    });

    const result: any = await runExecute(pirLessonsDraftPayload({ pirId: 'pir-1', caseId: 'case-1', expectedVersion: 3 }));

    expect(result.success).toBe(true);
    expect(result.state).toBe('completed');
    expect(mockRecordRoiPirTeresaLessonsDraft).toHaveBeenCalledTimes(1);
    const callArgs = mockRecordRoiPirTeresaLessonsDraft.mock.calls[0][0];
    expect(callArgs.pirId).toBe('pir-1');
    expect(callArgs.caseId).toBe('case-1');
    expect(callArgs.expectedVersion).toBe(3);
    expect(callArgs.actorUserId).toBe(USER);
    expect(callArgs.actorEffectiveRole).toBe('teresa_initiated');
    expect(callArgs.draftPayload.draft_lessons_text).toContain('Automate the manual reconciliation');

    expect(result.handoff_result.handoff).toBe('roi');
    expect(result.handoff_result.advisor_mode).toBe('pir_lessons_draft');
    expect(result.handoff_result.pir_id).toBe('pir-1');
    expect(result.handoff_result.case_id).toBe('case-1');
    expect(result.handoff_result.row_version).toBe(4);
    expect(result.handoff_result.real_entity).toBe(true);
    expect(result.handoff_result.outcome).toBe('applied');
    expect(result.handoff_result.draft.draft_lessons_text).toContain('Automate the manual reconciliation');

    const receiptInserts = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO teresa_handoff_results')
    );
    expect(receiptInserts).toHaveLength(1);
    expect(receiptInserts[0][1]).toContain('pir-1');
    // target_module is a literal in the SQL text, not a bound param — same
    // pattern every other handle*Handoff function in this file uses.
    expect(receiptInserts[0][0]).toContain("'roi'");
  });

  it('missing roi_handoff_context.advisor_mode fails with P08_ROI_INVALID_PAYLOAD', async () => {
    const result: any = await runExecute({ roi_handoff_context: {}, evidence_pointers: [] }, 'proposal-roi-badmode');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/advisor_mode missing/i);
    expect(mockRecordRoiPirTeresaLessonsDraft).not.toHaveBeenCalled();
  });

  it('missing pir_lessons_draft payload fails with P08_ROI_INVALID_PAYLOAD', async () => {
    const payload = pirLessonsDraftPayload();
    delete (payload.roi_handoff_context as any).pir_lessons_draft;
    const result: any = await runExecute(payload, 'proposal-roi-nodraft');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/pir_lessons_draft payload missing/i);
    expect(mockRecordRoiPirTeresaLessonsDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Truth-preserving failure — DISPOSITION_ALREADY_RECORDED (D6/D13) or any
//    other domain rejection fails the whole proposal, never swallowed.
// ---------------------------------------------------------------------------

describe('ROI-E008 — domain rejection is a truth-preserving failure, never swallowed', () => {
  it('recordRoiPirTeresaLessonsDraft throwing DISPOSITION_ALREADY_RECORDED fails the whole proposal, writes no receipt', async () => {
    const domainError: any = new Error('PIR pir-1 already has a recorded Teresa draft disposition');
    domainError.code = 'DISPOSITION_ALREADY_RECORDED';
    mockRecordRoiPirTeresaLessonsDraft.mockRejectedValue(domainError);

    const result: any = await runExecute(
      pirLessonsDraftPayload({ pirId: 'pir-1', caseId: 'case-1', expectedVersion: 5 }),
      'proposal-roi-disposition-blocked'
    );

    expect(result.success).toBe(false);
    expect(result.state).not.toBe('completed');
    expect(result.error).toMatch(/already has a recorded Teresa draft disposition/i);

    const receiptInserts = mockDbRun.mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO teresa_handoff_results')
    );
    expect(receiptInserts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. buildRoiPirLessonsAdvisorContext — called directly, BEFORE proposal
//    creation, not through performHandoff/executeProposal. AC-01's literal
//    mechanism: reads the frozen review_snapshot_payload/hash, never a live
//    re-query.
// ---------------------------------------------------------------------------

describe('ROI-E008 — buildRoiPirLessonsAdvisorContext (AC-01)', () => {
  it('returns the frozen reviewSnapshotPayload/reviewSnapshotHash when the PIR is a draft', async () => {
    mockGetRoiPostInvestmentReview.mockResolvedValue({
      status: 'draft',
      reviewSnapshotPayload: { caseId: 'case-1', compareView: {}, benefitsRealizationView: {}, variances: [] },
      reviewSnapshotHash: 'hash-abc123',
    });

    const result = await buildRoiPirLessonsAdvisorContext({
      userId: USER,
      organizationId: ORG,
      caseId: 'case-1',
      pirId: 'pir-1',
    });

    expect(result).not.toBeNull();
    expect(result?.reviewSnapshotHash).toBe('hash-abc123');
    expect(result?.reviewSnapshotPayload.caseId).toBe('case-1');
    expect(mockGetRoiPostInvestmentReview).toHaveBeenCalledWith({
      userId: USER,
      organizationId: ORG,
      caseId: 'case-1',
      pirId: 'pir-1',
    });
  });

  it('returns null when the PIR is no longer a draft (already finalized)', async () => {
    mockGetRoiPostInvestmentReview.mockResolvedValue({
      status: 'finalized',
      reviewSnapshotPayload: {},
      reviewSnapshotHash: 'hash-xyz',
    });

    const result = await buildRoiPirLessonsAdvisorContext({
      userId: USER,
      organizationId: ORG,
      caseId: 'case-1',
      pirId: 'pir-1',
    });

    expect(result).toBeNull();
  });

  it('returns null when the PIR does not exist or is not visible', async () => {
    mockGetRoiPostInvestmentReview.mockResolvedValue(null);

    const result = await buildRoiPirLessonsAdvisorContext({
      userId: USER,
      organizationId: ORG,
      caseId: 'case-1',
      pirId: 'pir-missing',
    });

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. undoProposal — Decision D7, ROI handoffs get a dedicated code
// ---------------------------------------------------------------------------

describe('ROI-E008 — undoProposal is explicitly not supported for roi handoffs', () => {
  it('throws P08_UNDO_NOT_SUPPORTED, distinct from the generic P08_UNDO_UNSUPPORTED_TARGET other non-excele targets get', async () => {
    mockDbGet.mockResolvedValue({
      id: 'proposal-roi-undo-1',
      organization_id: ORG,
      user_id: USER,
      session_id: SESSION,
      target_module: 'roi',
      state: 'completed',
      handoff_context_json: JSON.stringify(buildHandoffContext()),
      target_payload_json: JSON.stringify(pirLessonsDraftPayload()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await expect(
      undoProposal({ proposalId: 'proposal-roi-undo-1', organizationId: ORG, userId: USER })
    ).rejects.toMatchObject({ code: 'P08_UNDO_NOT_SUPPORTED' });
  });
});
