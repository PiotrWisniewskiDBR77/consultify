import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockGetInsightById = vi.fn();
const mockListCandidates = vi.fn();
const mockTriageCandidate = vi.fn();
const mockPromoteCandidateToFinding = vi.fn();
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
  listFindings: vi.fn().mockResolvedValue([]),
  getFinding: vi.fn(),
  addFinding: vi.fn(),
  updateFinding: vi.fn(),
  addEvidencePointer: vi.fn(),
  removeEvidencePointer: vi.fn(),
  buildHandoffPayload: vi.fn(),
  recordHandoff: vi.fn(),
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
  organizationContextService: {},
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
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
  run: vi.fn().mockResolvedValue({ changes: 1 }),
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
});
