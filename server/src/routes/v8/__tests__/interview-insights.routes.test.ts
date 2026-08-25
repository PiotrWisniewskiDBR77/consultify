import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockGetInsightById = vi.fn();
const mockListCandidates = vi.fn();
const mockTriageCandidate = vi.fn();
const mockPromoteCandidateToFinding = vi.fn();
const mockBuildSourcePack = vi.fn();
const mockUpdateFindingReadback = vi.fn();
const mockListFindings = vi.fn();
const mockGetFinding = vi.fn();
const mockBuildHandoffPayload = vi.fn();
const mockRecordHandoff = vi.fn();
const mockCheckSimilarInitiatives = vi.fn();
const mockCreateInitiative = vi.fn();
const permissionMockState = vi.hoisted(() => ({
  registeredPermissionKeys: [] as string[],
}));

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../middleware/permission.middleware.js', () => ({
  requirePermission: (permissionKey: string) => {
    permissionMockState.registeredPermissionKeys.push(permissionKey);
    return (_req: unknown, _res: unknown, next: () => void) => next();
  },
}));

vi.mock('../../../services/InterviewInsightService.js', () => ({
  getById: (...args: unknown[]) => mockGetInsightById(...args),
}));

vi.mock('../../../services/permissionService.js', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../services/v8/interviewInsightCanon.js', () => ({
  canPublishFinding: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock('../../../services/v8/interviewInsightFindingsService.js', () => ({
  validateLifecycleTransition: vi
    .fn()
    .mockReturnValue({ allowed: true, targetStatus: 'published' }),
  listFindings: (...args: unknown[]) => mockListFindings(...args),
  getFinding: (...args: unknown[]) => mockGetFinding(...args),
  addFinding: vi.fn(),
  updateFinding: vi.fn(),
  updateFindingReadback: (...args: unknown[]) => mockUpdateFindingReadback(...args),
  addEvidencePointer: vi.fn(),
  removeEvidencePointer: vi.fn(),
  buildHandoffPayload: (...args: unknown[]) => mockBuildHandoffPayload(...args),
  buildSourcePack: (...args: unknown[]) => mockBuildSourcePack(...args),
  recordHandoff: (...args: unknown[]) => mockRecordHandoff(...args),
}));

vi.mock('../../../services/v8/interviewInsightCandidateService.js', () => ({
  listCandidates: (...args: unknown[]) => mockListCandidates(...args),
  triageCandidate: (...args: unknown[]) => mockTriageCandidate(...args),
  promoteCandidateToFinding: (...args: unknown[]) => mockPromoteCandidateToFinding(...args),
}));

vi.mock('../../../services/v8/interviewInsightAnalysisService.js', () => ({
  buildInsightAnalysis: vi.fn(),
}));

vi.mock('../../../services/v8/insightSignalBridgeService.js', () => ({
  onInsightPublished: vi.fn(),
}));

vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn().mockResolvedValue(undefined),
  },
  rebuildOrganizationContextSnapshot: vi.fn(),
}));

vi.mock('../../../services/notificationService.js', () => ({
  default: { send: vi.fn() },
}));

vi.mock('../../../utils/fireAndForget.js', () => ({
  fireAndForget: vi.fn(),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
  run: vi.fn().mockResolvedValue({ changes: 1 }),
}));

// #59 — dedup parity for the Insight-handoff "create new initiative" branch.
vi.mock('../../../services/initiativeSimilarityService.js', () => ({
  checkSimilarInitiatives: (...args: unknown[]) => mockCheckSimilarInitiatives(...args),
}));

vi.mock('../../../services/initiativeService.js', () => ({
  default: { createInitiative: (...args: unknown[]) => mockCreateInitiative(...args) },
}));

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(new Set()),
}));

import interviewInsightsRoutes, {
  V8_INTERVIEW_INSIGHTS_CONTRACT,
} from '../interview-insights.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/interview', interviewInsightsRoutes);
  return app;
}

describe('V8 interview insights candidate routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMockState.registeredPermissionKeys.length = 0;
    mockGetV8Context.mockReturnValue({
      organizationId: 'org_1',
      userId: 'user_1',
      userRole: 'ADMIN',
    });
    mockGetInsightById.mockResolvedValue({
      id: 'insight_1',
      organizationId: 'org_1',
      title: 'Insight one',
      createdBy: 'user_2',
      status: 'completed',
    });
    mockListFindings.mockResolvedValue([]);
    mockGetFinding.mockResolvedValue(null);
    mockBuildHandoffPayload.mockResolvedValue({ payload: { findingId: 'finding_1' } });
    mockRecordHandoff.mockResolvedValue(undefined);
    mockCheckSimilarInitiatives.mockResolvedValue({
      results: [{ candidateIndex: 0, matches: [], topScore: 0, verdict: 'new' }],
      method: 'token-overlap',
      comparedCount: 0,
      truncated: false,
    });
    mockCreateInitiative.mockResolvedValue({ id: 'init_default' });
  });

  it('GET /candidates returns V8 envelope with candidate list', async () => {
    mockListCandidates.mockResolvedValue([
      {
        id: 'candidate_1',
        insightId: 'insight_1',
        organizationId: 'org_1',
        source_section_type: 'theme',
        source_section_index: 0,
        source_key: 'theme:0',
        candidate_statement: 'Ownership is unclear.',
        rationale: 'Supported by operations and technology.',
        confidence_hint: 'medium',
        triage_status: 'ready_for_review',
        followup_type: 'reinterview',
        followup_recommendation: 'Interview finance for wider coverage.',
        linked_finding_id: 'finding_1',
        created_at: '2026-04-15T10:00:00.000Z',
        updated_at: '2026-04-15T10:00:00.000Z',
      },
    ]);

    const res = await request(createApp()).get('/api/v8/interview/insights/insight_1/candidates');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHTS_CONTRACT);
    expect(res.body.data?.candidates).toHaveLength(1);
    expect(res.body.data?.candidates?.[0]?.triage_status).toBe('ready_for_review');
    expect(mockListCandidates).toHaveBeenCalledWith('insight_1');
  });

  it('POST /candidates/:id/triage updates candidate triage state', async () => {
    mockTriageCandidate.mockResolvedValue({
      candidate: {
        id: 'candidate_1',
        triage_status: 'needs_split',
        followup_recommendation: 'Split by role.',
      },
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/candidates/candidate_1/triage')
      .send({
        action: 'mark_needs_split',
        rationale: 'Ops and tech describe different owners.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.candidate?.triage_status).toBe('needs_split');
    expect(mockTriageCandidate).toHaveBeenCalledWith(
      'insight_1',
      'candidate_1',
      {
        action: 'mark_needs_split',
        candidate_statement: undefined,
        rationale: 'Ops and tech describe different owners.',
        followup_recommendation: undefined,
      },
      'user_1'
    );
  });

  it('POST /candidates/:id/triage promotes candidate into finding workflow', async () => {
    mockPromoteCandidateToFinding.mockResolvedValue({
      candidate: {
        id: 'candidate_1',
        triage_status: 'promoted',
        linked_finding_id: 'finding_1',
      },
      finding: {
        id: 'finding_1',
        finding_statement: 'Ownership is unclear.',
      },
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/candidates/candidate_1/triage')
      .send({
        action: 'promote_to_finding',
        candidate_statement: 'Ownership is unclear.',
        confidence_level: 'medium',
        limits: 'Needs reviewer confirmation.',
        next_action: 'Move to review.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.candidate?.triage_status).toBe('promoted');
    expect(res.body.data?.finding?.id).toBe('finding_1');
    expect(mockPromoteCandidateToFinding).toHaveBeenCalledWith(
      'insight_1',
      'candidate_1',
      {
        finding_statement: 'Ownership is unclear.',
        confidence_level: 'medium',
        limits: 'Needs reviewer confirmation.',
        next_action: 'Move to review.',
      },
      {
        actorUserId: 'user_1',
        organizationId: 'org_1',
      }
    );
  });

  it('returns 404 when insight is outside current organization', async () => {
    mockGetInsightById.mockResolvedValue({
      id: 'insight_1',
      organizationId: 'other_org',
    });

    const res = await request(createApp()).get('/api/v8/interview/insights/insight_1/candidates');

    expect(res.status).toBe(404);
    expect(mockListCandidates).not.toHaveBeenCalled();
  });

  it('returns 400 when triage action is missing', async () => {
    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/candidates/candidate_1/triage')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('P10_CANDIDATE_ACTION_REQUIRED');
  });

  it('GET /source-pack returns explicit evidence package', async () => {
    mockBuildSourcePack.mockResolvedValue({
      insightId: 'insight_1',
      sourceSessionIds: ['sess_1'],
      entries: [
        {
          answerId: 'ans_1',
          questionText: 'What changed?',
          answerSnippet: 'Ownership is clearer.',
          linkedThemes: ['Ownership'],
          linkedIssues: [],
          linkedOpportunities: [],
          capturedPointers: [],
          degradedReason: 'missing_pointer',
        },
      ],
      degraded: true,
      degradedReasons: ['missing_pointer'],
      activePointerCount: 0,
    });

    const res = await request(createApp()).get('/api/v8/interview/insights/insight_1/source-pack');

    expect(res.status).toBe(200);
    expect(res.body.data?.sourcePack?.degraded).toBe(true);
    expect(res.body.data?.sourcePack?.entries?.[0]?.answerId).toBe('ans_1');
    expect(mockBuildSourcePack).toHaveBeenCalledWith('insight_1');
  });

  it('PATCH /findings/:id/readback updates readback workflow state', async () => {
    mockUpdateFindingReadback.mockResolvedValue({
      finding: {
        id: 'finding_1',
        readback_status: 'confirmed_by_client',
        readback_summary: 'Client confirmed.',
      },
    });

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/insight_1/findings/finding_1/readback')
      .send({
        readback_status: 'confirmed_by_client',
        readback_summary: 'Client confirmed.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data?.finding?.readback_status).toBe('confirmed_by_client');
    expect(mockUpdateFindingReadback).toHaveBeenCalledWith(
      'insight_1',
      'finding_1',
      {
        readback_status: 'confirmed_by_client',
        readback_summary: 'Client confirmed.',
      },
      'user_1'
    );
  });

  it('blocks publish when finding has no confirmed readback', async () => {
    mockListFindings.mockResolvedValue([
      {
        id: 'finding_1',
        confidence_level: 'high',
        limits: 'Scoped to the interview sample.',
        next_action: 'Execute bounded initiative.',
        evidence_pointers: [{ isTombstone: false }],
        readback_status: 'shared_for_readback',
      },
    ]);

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/lifecycle')
      .send({ action: 'publish' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('P10_READBACK_REQUIRED');
    expect(res.body.findingId).toBe('finding_1');
  });

  it('blocks handoff when finding has no confirmed readback', async () => {
    mockGetFinding.mockResolvedValue({
      id: 'finding_1',
      finding_statement: 'Ownership is unclear.',
      confidence_level: 'high',
      limits: 'Scoped to interview sample.',
      next_action: 'Review with sponsor.',
      evidence_pointers: [{ isTombstone: false }],
      readback_status: 'shared_for_readback',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('P10_READBACK_REQUIRED');
    expect(mockBuildHandoffPayload).not.toHaveBeenCalled();
    expect(mockRecordHandoff).not.toHaveBeenCalled();
  });

  // #59 — Insight→Initiative generator dedup parity (same
  // checkSimilarInitiatives used by the canonical AI Initiative Wizard and by
  // the Tools→Initiatives generator, #68b). Informational only: it must never
  // block the handoff, only annotate the response.
  it('POST /handoff creates a new initiative and surfaces an informational duplicate warning (#59)', async () => {
    mockGetFinding.mockResolvedValue({
      id: 'finding_1',
      finding_statement: 'Onboarding process lacks a single owner.',
      confidence_level: 'high',
      limits: 'Scoped to interview sample.',
      next_action: 'Assign an owner.',
      evidence_pointers: [{ isTombstone: false, excerpt: 'No owner assigned.' }],
      readback_status: 'confirmed_by_client',
    });
    mockCheckSimilarInitiatives.mockResolvedValue({
      results: [
        {
          candidateIndex: 0,
          matches: [
            { id: 'init_9', title: 'Assign onboarding owner', status: 'ACTIVE', score: 0.86 },
          ],
          topScore: 0.86,
          verdict: 'similar',
        },
      ],
      method: 'embeddings',
      comparedCount: 1,
      truncated: false,
    });
    mockCreateInitiative.mockResolvedValue({ id: 'init_new_1' });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
      .send({});

    expect(res.status).toBe(200);
    // Creation is never blocked by the duplicate warning (same doctrine as #68b).
    expect(mockCreateInitiative).toHaveBeenCalledTimes(1);
    expect(res.body.data?.initiative?.id).toBe('init_new_1');
    expect(res.body.data?.initiative?.type).toBe('created');
    expect(res.body.data?.duplicateWarning?.verdict).toBe('similar');
    expect(res.body.data?.duplicateWarning?.topMatch?.id).toBe('init_9');
    expect(mockCheckSimilarInitiatives).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org_1',
        candidates: [
          expect.objectContaining({ title: 'Onboarding process lacks a single owner.' }),
        ],
      })
    );
    expect(mockRecordHandoff).toHaveBeenCalledTimes(1);
  });

  it('POST /handoff still creates the initiative when the similarity check itself fails (non-blocking)', async () => {
    mockGetFinding.mockResolvedValue({
      id: 'finding_1',
      finding_statement: 'Onboarding process lacks a single owner.',
      confidence_level: 'high',
      limits: 'Scoped to interview sample.',
      next_action: 'Assign an owner.',
      evidence_pointers: [{ isTombstone: false, excerpt: 'No owner assigned.' }],
      readback_status: 'confirmed_by_client',
    });
    mockCheckSimilarInitiatives.mockRejectedValue(new Error('embedding service down'));
    mockCreateInitiative.mockResolvedValue({ id: 'init_new_2' });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
      .send({});

    expect(res.status).toBe(200);
    expect(mockCreateInitiative).toHaveBeenCalledTimes(1);
    expect(res.body.data?.initiative?.id).toBe('init_new_2');
    expect(res.body.data?.duplicateWarning).toBeNull();
  });

  it('POST /handoff with an existing target_initiative_id (link mode) skips the similarity check entirely', async () => {
    mockGetFinding.mockResolvedValue({
      id: 'finding_1',
      finding_statement: 'Onboarding process lacks a single owner.',
      confidence_level: 'high',
      limits: 'Scoped to interview sample.',
      next_action: 'Assign an owner.',
      evidence_pointers: [{ isTombstone: false, excerpt: 'No owner assigned.' }],
      readback_status: 'confirmed_by_client',
    });
    (await import('../../../utils/queryHelpers.js')).queryOne.mockResolvedValueOnce({
      id: 'init_existing',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
      .send({ target_initiative_id: 'init_existing' });

    expect(res.status).toBe(200);
    expect(res.body.data?.initiative?.type).toBe('linked');
    expect(res.body.data?.duplicateWarning).toBeNull();
    expect(mockCheckSimilarInitiatives).not.toHaveBeenCalled();
    expect(mockCreateInitiative).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cross-org tenant fix — M03 Interview V4.
  //
  // `project_id` arrives in the request body and used to be accepted on the
  // strength of a UUID regex alone. A well-formed UUID says nothing about
  // ownership: the value went on to `initiativeService.createInitiative` and
  // `decisionService.createDecision` (which stamp the caller's org but trust
  // projectId as given) and to `TaskService.createTask`, which takes NO
  // organizationId at all — so the task's only tenancy was that projectId. A
  // caller passing another org's project id planted a real entity inside the
  // victim tenant's project. The ownership probe below is the fix; these are
  // its negative controls, driven through the ROUTE, not the service.
  // -------------------------------------------------------------------------
  describe('POST /handoff — project_id must belong to the caller org', () => {
    const FOREIGN_PROJECT = '11111111-2222-4333-8444-555555555555';

    const confirmedFinding = {
      id: 'finding_1',
      finding_statement: 'Onboarding process lacks a single owner.',
      confidence_level: 'high',
      limits: 'Scoped to interview sample.',
      next_action: 'Assign an owner.',
      evidence_pointers: [{ isTombstone: false, excerpt: 'No owner assigned.' }],
      readback_status: 'confirmed_by_client',
    };

    it('refuses a well-formed UUID that names another org’s project — no initiative created', async () => {
      mockGetFinding.mockResolvedValue(confirmedFinding);
      // queryOne default is null → the ownership probe misses.
      const res = await request(createApp())
        .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
        .send({ project_id: FOREIGN_PROJECT });

      // 404, not 403: "not yours" must not be distinguishable from "not there".
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('P10_TARGET_PROJECT_NOT_FOUND');
      expect(mockCreateInitiative).not.toHaveBeenCalled();
      expect(mockRecordHandoff).not.toHaveBeenCalled();
    });

    it('refuses a foreign project on the TASK branch — nothing is planted in the victim project', async () => {
      mockGetFinding.mockResolvedValue(confirmedFinding);
      const res = await request(createApp())
        .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
        .send({ project_id: FOREIGN_PROJECT, target_type: 'task' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('P10_TARGET_PROJECT_NOT_FOUND');
      expect(mockRecordHandoff).not.toHaveBeenCalled();
    });

    it('refuses a foreign project on the DECISION branch', async () => {
      mockGetFinding.mockResolvedValue(confirmedFinding);
      const res = await request(createApp())
        .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
        .send({ project_id: FOREIGN_PROJECT, target_type: 'decision' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('P10_TARGET_PROJECT_NOT_FOUND');
      expect(mockRecordHandoff).not.toHaveBeenCalled();
    });

    it('probes `projects` scoped by BOTH id and organization_id', async () => {
      mockGetFinding.mockResolvedValue(confirmedFinding);
      const { queryOne } = await import('../../../utils/queryHelpers.js');
      await request(createApp())
        .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
        .send({ project_id: FOREIGN_PROJECT });

      const call = (queryOne as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        ([sql]: [string]) => /FROM projects/i.test(String(sql))
      ) as [string, unknown[]] | undefined;
      expect(call).toBeDefined();
      expect(call![0]).toMatch(/organization_id\s*=\s*\?/i);
      expect(call![1]).toEqual([FOREIGN_PROJECT, 'org_1']);
    });

    it('accepts a project the caller org owns and proceeds to create the initiative', async () => {
      mockGetFinding.mockResolvedValue(confirmedFinding);
      mockCheckSimilarInitiatives.mockResolvedValue({
        results: [],
        method: 'embeddings',
        comparedCount: 0,
        truncated: false,
      });
      mockCreateInitiative.mockResolvedValue({ id: 'init_owned_project' });
      (await import('../../../utils/queryHelpers.js')).queryOne.mockResolvedValueOnce({
        id: FOREIGN_PROJECT,
      });

      const res = await request(createApp())
        .post('/api/v8/interview/insights/insight_1/findings/finding_1/handoff')
        .send({ project_id: FOREIGN_PROJECT });

      expect(res.status).toBe(200);
      expect(mockCreateInitiative).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: 'org_1', project_id: FOREIGN_PROJECT })
      );
    });
  });
});
