import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT,
  V8_INTERVIEW_INSIGHT_READ_CONTRACT,
  V8_INTERVIEW_READ_CONTRACT,
} from '../interview.routes.js';

const mockListSessions = vi.fn();
const mockListAcceptedSessions = vi.fn();
const mockListManagedSessions = vi.fn();
const mockGetSession = vi.fn();
const mockGetMyAssignments = vi.fn();
const mockGetManagedAssignments = vi.fn();
const mockGetOverdueAssignments = vi.fn();
const mockResolveInterviewManagerScope = vi.fn();
const mockStartAssignment = vi.fn();
const mockSubmitAssignment = vi.fn();
const mockSendAssignmentReminder = vi.fn();
const mockSendBackAssignment = vi.fn();
const mockApproveAssignment = vi.fn();
const mockEvaluateSessionAnswers = vi.fn();

const mockInsightList = vi.fn();
const mockInsightGetById = vi.fn();
const mockInsightCreate = vi.fn();
const mockInsightRegenerate = vi.fn();
const mockInsightDelete = vi.fn();
const mockBuildReportPackExportManifest = vi.fn();
const mockBuildReportPackMarkdownExport = vi.fn();
const mockCreateReportPackDraft = vi.fn();
const mockCreateReportPackRevision = vi.fn();
const mockEvaluateReportPackReadiness = vi.fn();
const mockGetReportPackReadiness = vi.fn();
const mockPublishReportPack = vi.fn();
const mockSubmitReportPackForReview = vi.fn();
const mockUpdateReportWorksheet = vi.fn();

vi.mock('../../../controllers/InterviewController.js', () => ({
  InterviewController: {
    startAssignment: (...args: unknown[]) => mockStartAssignment(...args),
    submitAssignment: (...args: unknown[]) => mockSubmitAssignment(...args),
    sendAssignmentReminder: (...args: unknown[]) => mockSendAssignmentReminder(...args),
    sendBackAssignment: (...args: unknown[]) => mockSendBackAssignment(...args),
    approveAssignment: (...args: unknown[]) => mockApproveAssignment(...args),
    evaluateSessionAnswers: (...args: unknown[]) => mockEvaluateSessionAnswers(...args),
  },
  loadInterviewSessionsForOrganization: (...args: unknown[]) => mockListSessions(...args),
  loadAcceptedInterviewSessionsForManager: (...args: unknown[]) =>
    mockListAcceptedSessions(...args),
  loadManagedInterviewSessionsForManager: (...args: unknown[]) => mockListManagedSessions(...args),
  loadInterviewSessionForOrganization: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('../../../services/InterviewAssignmentService.js', () => ({
  getMyAssignments: (...args: unknown[]) => mockGetMyAssignments(...args),
  getManagedAssignments: (...args: unknown[]) => mockGetManagedAssignments(...args),
  getOverdueAssignments: (...args: unknown[]) => mockGetOverdueAssignments(...args),
}));

vi.mock('../../../services/interviewManagerScope.js', () => ({
  resolveInterviewManagerScope: (...args: unknown[]) => mockResolveInterviewManagerScope(...args),
}));

vi.mock('../../../services/InterviewInsightService.js', () => ({
  list: (...args: unknown[]) => mockInsightList(...args),
  getById: (...args: unknown[]) => mockInsightGetById(...args),
  create: (...args: unknown[]) => mockInsightCreate(...args),
  regenerate: (...args: unknown[]) => mockInsightRegenerate(...args),
  deleteInsight: (...args: unknown[]) => mockInsightDelete(...args),
  // SEC status-gate constants used by the PATCH /insights/:id mass-assignment guard.
  INSIGHT_PATCH_SETTABLE_STATUSES: new Set(['draft', 'completed', 'failed']),
  INSIGHT_GATED_STATUSES: new Set(['in_review', 'published', 'approved']),
}));

vi.mock('../../../services/interviewInsightReportPackService.js', () => ({
  buildInterviewReportPackExportManifest: (...args: unknown[]) =>
    mockBuildReportPackExportManifest(...args),
  buildInterviewReportPackMarkdownExport: (...args: unknown[]) =>
    mockBuildReportPackMarkdownExport(...args),
  createInterviewReportPackDraft: (...args: unknown[]) => mockCreateReportPackDraft(...args),
  createInterviewReportPackRevision: (...args: unknown[]) => mockCreateReportPackRevision(...args),
  evaluateInterviewReportPackReadiness: (...args: unknown[]) =>
    mockEvaluateReportPackReadiness(...args),
  getInterviewReportPackReadiness: (...args: unknown[]) => mockGetReportPackReadiness(...args),
  publishInterviewReportPack: (...args: unknown[]) => mockPublishReportPack(...args),
  submitInterviewReportPackForReview: (...args: unknown[]) =>
    mockSubmitReportPackForReview(...args),
  updateInterviewReportWorksheet: (...args: unknown[]) => mockUpdateReportWorksheet(...args),
}));

const mockQueryOne = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(new Set(['id'])),
}));

vi.mock('../../../services/organizationContext/OrganizationContextService.js', () => ({
  default: { buildResolvedContext: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const mockCommentGetContent = vi.fn();
const mockCommentCreate = vi.fn();
const mockCommentGetById = vi.fn();
const mockCommentDelete = vi.fn();
const permissionMockState = vi.hoisted(() => ({
  registeredPermissionKeys: [] as string[],
}));

vi.mock('../../../services/content/CommentService.js', () => ({
  CommentService: vi.fn(function CommentServiceMock() {
    return {
      getContentComments: (...args: unknown[]) => mockCommentGetContent(...args),
      createComment: (...args: unknown[]) => mockCommentCreate(...args),
      getCommentById: (...args: unknown[]) => mockCommentGetById(...args),
      deleteComment: (...args: unknown[]) => mockCommentDelete(...args),
    };
  }),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../middleware/permission.middleware.js', () => ({
  requirePermission: (permissionKey: string) => {
    permissionMockState.registeredPermissionKeys.push(permissionKey);
    return (_req: unknown, _res: unknown, next: () => void) => next();
  },
  requireAnyPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAllPermissions: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../services/permissionService.js', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
  default: {},
}));

let mockUser: {
  id: string;
  role: string;
  organizationId: string;
  isSuperAdmin: boolean;
} | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  validateOrgMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = 'org-interview-v8';
const UID = 'user-interview-v8';
type ReportPackWorksheetMock = {
  key: string;
  title: string;
  status: string;
  completenessScore?: number;
};

describe('V8 Interview read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockResolveInterviewManagerScope.mockResolvedValue({ kind: 'organization' });
    mockCreateReportPackDraft.mockImplementation(({ insight }) => ({
      id: `irp_${insight.id}`,
      insightId: insight.id,
      title: `Report Pack: ${insight.title}`,
      status: 'draft',
      worksheets: [
        { key: 'executive_summary', title: 'Executive Summary', status: 'generated' },
        { key: 'evidence_register', title: 'Evidence Register', status: 'generated' },
        { key: 'appendix_provenance', title: 'Appendix: Provenance', status: 'generated' },
      ],
      completenessScore: 80,
      degraded: false,
      degradedReasons: [],
    }));
    mockGetReportPackReadiness.mockResolvedValue(null);
    mockEvaluateReportPackReadiness.mockImplementation((reportPack) => ({
      reportPackId: reportPack.id,
      insightId: reportPack.insightId,
      status: 'ready_for_review',
      completenessScore: reportPack.completenessScore,
      blockers: [],
      warnings: [],
      worksheetBreakdown: reportPack.worksheets.map((worksheet: ReportPackWorksheetMock) => ({
        key: worksheet.key,
        title: worksheet.title,
        status: worksheet.status,
        completenessScore: worksheet.completenessScore || 100,
        ready: worksheet.status === 'generated',
      })),
    }));
    mockSubmitReportPackForReview.mockResolvedValue({
      reportPack: {
        id: 'irp_ins-1',
        insightId: 'ins-1',
        title: 'Report Pack: Test',
        status: 'in_review',
        worksheets: [],
        completenessScore: 100,
        degraded: false,
        degradedReasons: [],
      },
      readiness: {
        reportPackId: 'irp_ins-1',
        insightId: 'ins-1',
        status: 'ready_for_review',
        completenessScore: 100,
        blockers: [],
        warnings: [],
        worksheetBreakdown: [],
      },
      submitted: true,
      blocked: false,
      alreadyInReview: false,
    });
    mockPublishReportPack.mockResolvedValue({
      reportPack: {
        id: 'irp_ins-1',
        insightId: 'ins-1',
        title: 'Report Pack: Test',
        status: 'published',
        worksheets: [],
        completenessScore: 100,
        degraded: false,
        degradedReasons: [],
      },
      readiness: {
        reportPackId: 'irp_ins-1',
        insightId: 'ins-1',
        status: 'ready_for_review',
        completenessScore: 100,
        blockers: [],
        warnings: [],
        worksheetBreakdown: [],
      },
      published: true,
      blocked: false,
      alreadyPublished: false,
    });
    mockBuildReportPackExportManifest.mockResolvedValue({
      reportPackId: 'irp_ins-1',
      insightId: 'ins-1',
      title: 'Report Pack: Test',
      status: 'published',
      exportedAt: '2026-05-03T17:00:00.000Z',
      manifestHash: 'abcdef1234567890',
      completenessScore: 100,
      degraded: false,
      degradedReasons: [],
      readiness: {
        reportPackId: 'irp_ins-1',
        insightId: 'ins-1',
        status: 'ready_for_review',
        completenessScore: 100,
        blockers: [],
        warnings: [],
        worksheetBreakdown: [],
      },
      worksheetCount: 1,
      worksheets: [{ key: 'executive_summary', title: 'Executive Summary', status: 'generated' }],
    });
    mockBuildReportPackMarkdownExport.mockResolvedValue({
      reportPackId: 'irp_ins-1',
      insightId: 'ins-1',
      title: 'Report Pack: Test',
      status: 'published',
      exportedAt: '2026-05-03T17:05:00.000Z',
      format: 'markdown',
      filename: 'irp_ins-1-client-report.md',
      markdown: '# Report Pack: Test',
      sourceManifestHash: 'abcdef1234567890',
      exportHash: 'fedcba0987654321',
      worksheetCount: 1,
    });
    mockCreateReportPackRevision.mockResolvedValue({
      reportPack: {
        id: 'irp_ins-1',
        insightId: 'ins-1',
        title: 'Report Pack: Test',
        status: 'draft',
        worksheets: [],
        completenessScore: 100,
        degraded: false,
        degradedReasons: [],
      },
      revision: {
        id: 'rev-1',
        reportPackId: 'irp_ins-1',
        insightId: 'ins-1',
        version: 1,
        manifestHash: 'abcdef1234567890',
        createdAt: '2026-05-03T17:00:00.000Z',
      },
    });
    mockUpdateReportWorksheet.mockResolvedValue({
      id: 'irp_ins-1',
      insightId: 'ins-1',
      title: 'Report Pack: Test',
      status: 'draft',
      worksheets: [
        {
          key: 'executive_summary',
          title: 'Executive Summary',
          status: 'partial',
          completenessScore: 70,
          warnings: ['Edited by operator'],
          rows: [],
        },
      ],
      completenessScore: 70,
      degraded: false,
      degradedReasons: [],
    });
  });

  it('GET /api/v8/interview/sessions returns V8 envelope and forwards org + status to loader', async () => {
    mockListSessions.mockResolvedValue([
      {
        id: 's1',
        name: 'Test',
        status: 'in_progress',
        ownerId: UID,
        totalQuestions: 0,
        answeredQuestions: 0,
        progress: {},
        summaryFacts: [],
        summaryGaps: [],
        summaryConstraints: [],
        summaryPainPoints: [],
        runtimeModeDefault: 'single_question',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/interview/sessions?status=in_progress')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(res.body.data?.sessions).toHaveLength(1);
    expect(mockListSessions).toHaveBeenCalledWith(ORG, 'in_progress');
  });

  it('GET /api/v8/interview/sessions/accepted returns V8 envelope and forwards org + user to loader', async () => {
    mockListAcceptedSessions.mockResolvedValue([
      {
        id: 'accepted-1',
        name: 'Accepted source',
        status: 'completed',
        answeredQuestions: 8,
        totalQuestions: 10,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/interview/sessions/accepted')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(res.body.data?.sessions).toHaveLength(1);
    expect(res.body.data?.sessions?.[0]?.id).toBe('accepted-1');
    expect(mockListAcceptedSessions).toHaveBeenCalledWith(ORG, UID);
  });

  it('GET /api/v8/interview/sessions/managed returns V8 envelope and forwards org + user to loader', async () => {
    mockListManagedSessions.mockResolvedValue([
      {
        id: 'managed-1',
        name: 'Managed workflow session',
        status: 'submitted',
        assignmentStatus: 'submitted',
        answeredQuestions: 6,
        totalQuestions: 10,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/interview/sessions/managed')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(res.body.data?.sessions).toHaveLength(1);
    expect(res.body.data?.sessions?.[0]?.id).toBe('managed-1');
    expect(mockResolveInterviewManagerScope).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: UID,
      role: 'ADMIN',
    });
    expect(mockListManagedSessions).toHaveBeenCalledWith(ORG, UID, {
      scope: { kind: 'organization' },
    });
  });

  it('GET /api/v8/interview/assignments/my returns V8 envelope and forwards user + org to service', async () => {
    mockGetMyAssignments.mockResolvedValue([{ id: 'mine-1', status: 'assigned' }]);

    const res = await request(createApp())
      .get('/api/v8/interview/assignments/my')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(res.body.data?.assignments).toHaveLength(1);
    expect(res.body.data?.assignments?.[0]?.id).toBe('mine-1');
    expect(mockGetMyAssignments).toHaveBeenCalledWith(UID, ORG);
  });

  it('GET /api/v8/interview/assignments/managed returns V8 envelope and forwards user + org to service', async () => {
    mockGetManagedAssignments.mockResolvedValue([{ id: 'managed-1', status: 'submitted' }]);

    const res = await request(createApp())
      .get('/api/v8/interview/assignments/managed')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(res.body.data?.assignments).toHaveLength(1);
    expect(res.body.data?.assignments?.[0]?.id).toBe('managed-1');
    expect(mockGetManagedAssignments).toHaveBeenCalledWith(UID, ORG, {
      scope: { kind: 'organization' },
    });
  });

  it('GET /api/v8/interview/assignments/overdue returns V8 envelope and forwards org to service', async () => {
    mockGetOverdueAssignments.mockResolvedValue([{ id: 'overdue-1', status: 'in_progress' }]);

    const res = await request(createApp())
      .get('/api/v8/interview/assignments/overdue')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(res.body.data?.assignments).toHaveLength(1);
    expect(res.body.data?.assignments?.[0]?.id).toBe('overdue-1');
    expect(mockGetOverdueAssignments).toHaveBeenCalledWith(ORG, {
      scope: { kind: 'organization' },
    });
  });

  it('GET /api/v8/interview/sessions/:id returns 404 when loader returns null', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/v8/interview/sessions/missing-id')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INTERVIEW_SESSION_NOT_FOUND');
  });

  it('GET /api/v8/interview/sessions/:id returns session in V8 envelope', async () => {
    mockGetSession.mockResolvedValue({
      id: 's1',
      name: 'One',
      status: 'completed',
      ownerId: UID,
      totalQuestions: 1,
      answeredQuestions: 1,
      progress: {},
      summaryFacts: [],
      summaryGaps: [],
      summaryConstraints: [],
      summaryPainPoints: [],
      runtimeModeDefault: 'single_question',
    });

    const res = await request(createApp())
      .get('/api/v8/interview/sessions/s1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.session?.id).toBe('s1');
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_READ_CONTRACT);
    expect(mockGetSession).toHaveBeenCalledWith(ORG, 's1');
  });

  it('POST /api/v8/interview/assignments/:id/start wraps response in V8 envelope', async () => {
    mockStartAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({ assignmentId: req.params.id, session: { id: 'sess-1' } });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-1/start')
      .set('Authorization', 'Bearer x')
      .send({ projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.data?.assignmentId).toBe('asg-1');
    expect(res.body.data?.session?.id).toBe('sess-1');
    expect(res.body.meta?.contract).toBe('interview_runtime_read_v1');
    expect(res.body.meta?.version).toBe('v8');
    expect(mockStartAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/submit wraps response in V8 envelope', async () => {
    mockSubmitAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({
        assignment: { id: req.params.id, status: 'submitted' },
        session: { id: 'sess-2' },
        completenessPercent: 50,
      });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-submit/submit')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data?.assignment?.id).toBe('asg-submit');
    expect(res.body.data?.assignment?.status).toBe('submitted');
    expect(res.body.data?.completenessPercent).toBe(50);
    expect(res.body.meta?.contract).toBe('interview_runtime_read_v1');
    expect(mockSubmitAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/remind wraps response in V8 envelope', async () => {
    mockSendAssignmentReminder.mockImplementation(async (_req: any, res: any) => {
      res.json({ success: true });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-2/remind')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.meta?.contract).toBe('interview_runtime_read_v1');
    expect(mockSendAssignmentReminder).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/send-back wraps response in V8 envelope', async () => {
    mockSendBackAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({ id: req.params.id, status: 'sent_back' });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-3/send-back')
      .set('Authorization', 'Bearer x')
      .send({ reason: 'Missing answers' });

    expect(res.status).toBe(200);
    expect(res.body.data?.id).toBe('asg-3');
    expect(res.body.data?.status).toBe('sent_back');
    expect(res.body.meta?.contract).toBe('interview_runtime_read_v1');
    expect(mockSendBackAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/approve wraps response in V8 envelope', async () => {
    mockApproveAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({ assignment: { id: req.params.id, status: 'approved' }, entersContext: true });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-4/approve')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data?.assignment?.id).toBe('asg-4');
    expect(res.body.data?.assignment?.status).toBe('approved');
    expect(res.body.meta?.contract).toBe('interview_runtime_read_v1');
    expect(mockApproveAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/sessions/:id/evaluate-answers wraps AI evaluation in V8 envelope', async () => {
    mockEvaluateSessionAnswers.mockImplementation(async (_req: any, res: any) => {
      res.json({
        overallScore: 3.8,
        overallVerdict: 'ready_for_approval',
        questionEvaluations: [],
        recommendations: ['Add one concrete example'],
        weakAnswerMap: [],
      });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/sessions/sess-5/evaluate-answers')
      .set('Authorization', 'Bearer x')
      .send({ language: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.data?.overallVerdict).toBe('ready_for_approval');
    expect(res.body.meta?.contract).toBe('interview_runtime_read_v1');
    expect(mockEvaluateSessionAnswers).toHaveBeenCalled();
  });
});

describe('V8 Interview insight routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockQueryRun.mockResolvedValue(undefined);
    mockQueryAll.mockResolvedValue([{ id: 'sess-1' }]);
  });

  it('GET /api/v8/interview/insights returns list in V8 envelope', async () => {
    mockInsightList.mockResolvedValue([
      { id: 'ins-1', title: 'Test Insight', status: 'completed' },
    ]);

    const res = await request(createApp())
      .get('/api/v8/interview/insights')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.insights).toHaveLength(1);
    expect(res.body.data?.insights?.[0]?.id).toBe('ins-1');
    expect(mockInsightList).toHaveBeenCalledWith(ORG, { limit: 50, offset: 0 });
  });

  it('registers granular insight permissions on V8 routes', () => {
    expect(permissionMockState.registeredPermissionKeys).toContain('INTERVIEW_INSIGHTS_VIEW');
    expect(permissionMockState.registeredPermissionKeys).toContain('INTERVIEW_INSIGHTS_CREATE');
    expect(permissionMockState.registeredPermissionKeys).toContain('INTERVIEW_INSIGHTS_REVIEW');
    expect(permissionMockState.registeredPermissionKeys).toContain('INTERVIEW_INSIGHTS_HANDOFF');
    expect(permissionMockState.registeredPermissionKeys).toContain('INTERVIEW_INSIGHTS_PUBLISH');
  });

  it('GET /api/v8/interview/insights/:id returns insight in V8 envelope', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.insight?.id).toBe('ins-1');
  });

  it('GET /api/v8/interview/insights/:id/report-pack returns draft report pack worksheets', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
      executiveSummary: 'Summary',
      sourceSessionIds: ['sess-1'],
      analysisScope: { source_session_ids: ['sess-1'] },
      materialQuality: { overall_material_score: 80 },
      themes: [{ title: 'Theme', description: 'Desc', evidence_refs: ['a1'], strength: 'strong' }],
      evidenceMap: [{ answer_id: 'a1', answer_snippet: 'Snippet' }],
      generationContext: { sourceMaterial: { includedSessionIds: ['sess-1'] } },
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/report-pack')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.reportPack?.insightId).toBe('ins-1');
    expect(mockCreateReportPackDraft).toHaveBeenCalledWith({
      organizationId: ORG,
      insight: expect.objectContaining({ id: 'ins-1' }),
      createdBy: UID,
    });
    expect(res.body.data?.reportPack?.worksheets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'executive_summary' }),
        expect.objectContaining({ key: 'evidence_register' }),
        expect.objectContaining({ key: 'appendix_provenance' }),
      ])
    );
  });

  it('GET /api/v8/interview/insights/:id/report-pack forbids cross-org insight access', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-foreign',
      organizationId: 'other-org',
      title: 'Foreign',
      status: 'completed',
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-foreign/report-pack')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_FORBIDDEN');
  });

  it('GET /api/v8/interview/insights/:id/report-pack/readiness returns persisted readiness when available', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });
    mockGetReportPackReadiness.mockResolvedValue({
      reportPackId: 'irp_ins-1',
      insightId: 'ins-1',
      status: 'blocked',
      completenessScore: 72,
      blockers: [
        { severity: 'blocker', message: 'Required worksheet evidence_register is empty.' },
      ],
      warnings: [],
      worksheetBreakdown: [],
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/report-pack/readiness')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.readiness?.status).toBe('blocked');
    expect(mockGetReportPackReadiness).toHaveBeenCalledWith(ORG, 'ins-1');
    expect(mockCreateReportPackDraft).not.toHaveBeenCalled();
  });

  it('GET /api/v8/interview/insights/:id/report-pack/readiness creates a draft before evaluating when missing', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });
    mockGetReportPackReadiness.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/report-pack/readiness')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.readiness?.status).toBe('ready_for_review');
    expect(mockCreateReportPackDraft).toHaveBeenCalledWith({
      organizationId: ORG,
      insight: expect.objectContaining({ id: 'ins-1' }),
      createdBy: UID,
    });
    expect(mockEvaluateReportPackReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ insightId: 'ins-1' })
    );
  });

  it('POST /api/v8/interview/insights/:id/report-pack/submit-review submits a ready pack through the gate', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/report-pack/submit-review')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.result?.submitted).toBe(true);
    expect(res.body.data?.result?.reportPack?.status).toBe('in_review');
    expect(mockCreateReportPackDraft).toHaveBeenCalledWith({
      organizationId: ORG,
      insight: expect.objectContaining({ id: 'ins-1' }),
      createdBy: UID,
    });
    expect(mockSubmitReportPackForReview).toHaveBeenCalledWith({
      organizationId: ORG,
      insightId: 'ins-1',
      actorUserId: UID,
    });
  });

  it('POST /api/v8/interview/insights/:id/report-pack/submit-review returns blocked result without fake success', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });
    mockSubmitReportPackForReview.mockResolvedValue({
      reportPack: {
        id: 'irp_ins-1',
        insightId: 'ins-1',
        title: 'Report Pack: Test',
        status: 'draft',
        worksheets: [],
        completenessScore: 72,
        degraded: true,
        degradedReasons: ['Missing evidence'],
      },
      readiness: {
        reportPackId: 'irp_ins-1',
        insightId: 'ins-1',
        status: 'blocked',
        completenessScore: 72,
        blockers: [
          { severity: 'blocker', message: 'Required worksheet evidence_register is empty.' },
        ],
        warnings: [],
        worksheetBreakdown: [],
      },
      submitted: false,
      blocked: true,
      alreadyInReview: false,
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/report-pack/submit-review')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data?.result?.blocked).toBe(true);
    expect(res.body.data?.result?.submitted).toBe(false);
    expect(res.body.data?.result?.readiness?.status).toBe('blocked');
  });

  it('POST /api/v8/interview/insights/:id/report-pack/publish publishes an in-review ready pack', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/report-pack/publish')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.result?.published).toBe(true);
    expect(res.body.data?.result?.reportPack?.status).toBe('published');
    expect(mockPublishReportPack).toHaveBeenCalledWith({
      organizationId: ORG,
      insightId: 'ins-1',
      actorUserId: UID,
    });
  });

  it('POST /api/v8/interview/insights/:id/report-pack/publish returns blocked result without fake success', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });
    mockPublishReportPack.mockResolvedValue({
      reportPack: {
        id: 'irp_ins-1',
        insightId: 'ins-1',
        title: 'Report Pack: Test',
        status: 'draft',
        worksheets: [],
        completenessScore: 100,
        degraded: false,
        degradedReasons: [],
      },
      readiness: {
        reportPackId: 'irp_ins-1',
        insightId: 'ins-1',
        status: 'blocked',
        completenessScore: 100,
        blockers: [
          {
            severity: 'blocker',
            message: 'Report pack must be submitted for review before publish.',
          },
        ],
        warnings: [],
        worksheetBreakdown: [],
      },
      published: false,
      blocked: true,
      alreadyPublished: false,
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/report-pack/publish')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data?.result?.blocked).toBe(true);
    expect(res.body.data?.result?.published).toBe(false);
    expect(res.body.data?.result?.readiness?.status).toBe('blocked');
  });

  it('GET /api/v8/interview/insights/:id/report-pack/export-manifest returns published worksheet manifest', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/report-pack/export-manifest')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.exportManifest?.status).toBe('published');
    expect(res.body.data?.exportManifest?.manifestHash).toBe('abcdef1234567890');
    expect(res.body.data?.exportManifest?.worksheetCount).toBe(1);
    expect(mockBuildReportPackExportManifest).toHaveBeenCalledWith({
      organizationId: ORG,
      insightId: 'ins-1',
    });
    expect(
      mockQueryRun.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_exported') &&
          values.includes('irp_ins-1') &&
          values.includes(UID)
        );
      })
    ).toBe(true);
  });

  it('GET /api/v8/interview/insights/:id/report-pack/export-manifest blocks unpublished packs', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });
    mockBuildReportPackExportManifest.mockRejectedValueOnce({
      code: 'INTERVIEW_REPORT_PACK_EXPORT_BLOCKED',
      statusCode: 409,
      message: 'Only published report packs can be exported as client-ready material.',
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/report-pack/export-manifest')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INTERVIEW_REPORT_PACK_EXPORT_BLOCKED');
    expect(res.body.error).toBe(
      'Only published report packs can be exported as client-ready material.'
    );
  });

  it('GET /api/v8/interview/insights/:id/report-pack/export-markdown returns client-ready Markdown report', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/report-pack/export-markdown')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.markdownExport?.status).toBe('published');
    expect(res.body.data?.markdownExport?.format).toBe('markdown');
    expect(res.body.data?.markdownExport?.exportHash).toBe('fedcba0987654321');
    expect(mockBuildReportPackMarkdownExport).toHaveBeenCalledWith({
      organizationId: ORG,
      insightId: 'ins-1',
    });
    expect(
      mockQueryRun.mock.calls.some(([sql, params]) => {
        const values = params as unknown[];
        return (
          String(sql).includes('INSERT INTO interview_insight_audit_log') &&
          values.includes('report_pack_client_markdown_exported') &&
          values.includes('irp_ins-1') &&
          values.includes(UID)
        );
      })
    ).toBe(true);
  });

  it('POST /api/v8/interview/insights/:id/report-pack/revisions creates editable draft from published pack', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/report-pack/revisions')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.result?.reportPack?.status).toBe('draft');
    expect(res.body.data?.result?.revision?.manifestHash).toBe('abcdef1234567890');
    expect(mockCreateReportPackRevision).toHaveBeenCalledWith({
      organizationId: ORG,
      insightId: 'ins-1',
      actorUserId: UID,
    });
  });

  it('POST /api/v8/interview/insights/:id/report-pack/revisions blocks non-published packs', async () => {
    mockInsightGetById.mockResolvedValue({
      id: 'ins-1',
      organizationId: ORG,
      title: 'Test',
      status: 'completed',
    });
    mockCreateReportPackRevision.mockRejectedValueOnce({
      code: 'INTERVIEW_REPORT_PACK_REVISION_BLOCKED',
      statusCode: 409,
      message: 'Only published report packs can create a new editable revision.',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/report-pack/revisions')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INTERVIEW_REPORT_PACK_REVISION_BLOCKED');
    expect(res.body.error).toBe('Only published report packs can create a new editable revision.');
  });

  it('PATCH /api/v8/interview/insights/:id/report-pack/worksheets/:worksheetKey updates one worksheet', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1/report-pack/worksheets/executive_summary')
      .set('Authorization', 'Bearer x')
      .send({
        status: 'partial',
        completenessScore: 70,
        warnings: ['Edited by operator'],
        rows: [{ section: 'summary' }],
        markdown: 'Edited summary',
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(mockUpdateReportWorksheet).toHaveBeenCalledWith({
      organizationId: ORG,
      insightId: 'ins-1',
      worksheetKey: 'executive_summary',
      actorUserId: UID,
      updates: {
        status: 'partial',
        completenessScore: 70,
        warnings: ['Edited by operator'],
        rows: [{ section: 'summary' }],
        markdown: 'Edited summary',
      },
    });
    expect(res.body.data?.reportPack?.worksheets?.[0]?.status).toBe('partial');
  });

  it('PATCH /api/v8/interview/insights/:id/report-pack/worksheets/:worksheetKey blocks published report pack edits', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockUpdateReportWorksheet.mockRejectedValueOnce({
      code: 'INTERVIEW_REPORT_PACK_IMMUTABLE',
      statusCode: 409,
      message: 'Published report packs cannot be edited.',
    });

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1/report-pack/worksheets/executive_summary')
      .set('Authorization', 'Bearer x')
      .send({
        status: 'partial',
        completenessScore: 70,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INTERVIEW_REPORT_PACK_IMMUTABLE');
    expect(res.body.error).toBe('Published report packs cannot be edited.');
  });

  it('PATCH /api/v8/interview/insights/:id/report-pack/worksheets/:worksheetKey rejects empty payload', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1/report-pack/worksheets/executive_summary')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERVIEW_REPORT_WORKSHEET_PATCH_EMPTY');
    expect(mockUpdateReportWorksheet).not.toHaveBeenCalled();
  });

  it('GET /api/v8/interview/insights/:id returns 404 when not found', async () => {
    mockInsightGetById.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/v8/interview/insights/missing')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_NOT_FOUND');
  });

  it('POST /api/v8/interview/insights creates insight and returns 201', async () => {
    mockInsightCreate.mockResolvedValue({
      id: 'ins-new',
      organizationId: ORG,
      title: 'New',
      status: 'generating',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights')
      .set('Authorization', 'Bearer x')
      .send({ sessionIds: ['sess-1'], promptType: 'summary' });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.insight?.id).toBe('ins-new');
    expect(mockInsightCreate).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/insights forwards full scope builder payload', async () => {
    mockInsightCreate.mockResolvedValue({
      id: 'ins-scoped',
      organizationId: ORG,
      title: 'Scoped insight',
      status: 'generating',
    });

    const scopePayload = {
      source_session_ids: ['sess-1'],
      source_scope_status: 'approved_only',
      respondent_filters: ['user-respondent'],
      role_filters: ['Operations Lead'],
      department_filters: ['Operations'],
      template_filters: ['tpl-1'],
      date_range: { from: '2026-05-01', to: '2026-05-03' },
      topic_focus: ['handoffs'],
      analysis_mode: 'focused_topic_synthesis',
      context_mode: 'selected_material_plus_approved_org_knowledge',
      consultant_note: 'Look for cross-functional blockers.',
      leading_question: 'Where do handoffs fail?',
    };

    const res = await request(createApp())
      .post('/api/v8/interview/insights')
      .set('Authorization', 'Bearer x')
      .send({
        title: 'Scoped insight',
        sessionIds: ['sess-1'],
        promptType: 'summary',
        filters: {
          templateId: 'tpl-1',
          respondentId: 'user-respondent',
          roles: ['Operations Lead'],
          departments: ['Operations'],
          dateFrom: '2026-05-01',
          dateTo: '2026-05-03',
          topicFocus: ['handoffs'],
        },
        analysisScope: scopePayload,
        analysisMode: 'focused_topic_synthesis',
        contextMode: 'selected_material_plus_approved_org_knowledge',
        topicFocus: ['handoffs'],
        consultantNote: 'Look for cross-functional blockers.',
        leadingQuestion: 'Where do handoffs fail?',
        customPrompt: 'Stay within the selected material.',
      });

    expect(res.status).toBe(201);
    expect(mockInsightCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        title: 'Scoped insight',
        sessionIds: ['sess-1'],
        analysisScope: scopePayload,
        analysisMode: 'focused_topic_synthesis',
        contextMode: 'selected_material_plus_approved_org_knowledge',
        topicFocus: ['handoffs'],
        consultantNote: 'Look for cross-functional blockers.',
        leadingQuestion: 'Where do handoffs fail?',
        customPrompt: 'Stay within the selected material.',
        createdBy: UID,
      })
    );
  });

  it('POST /api/v8/interview/insights blocks unapproved or incomplete source sessions', async () => {
    mockQueryAll.mockResolvedValueOnce([{ id: 'sess-1' }]);

    const res = await request(createApp())
      .post('/api/v8/interview/insights')
      .set('Authorization', 'Bearer x')
      .send({ sessionIds: ['sess-1', 'sess-draft'], promptType: 'summary' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_SOURCE_NOT_APPROVED');
    expect(res.body.rejectedSessionIds).toEqual(['sess-draft']);
    expect(mockInsightCreate).not.toHaveBeenCalled();
  });

  it('POST /api/v8/interview/insights returns 400 without sessionIds', async () => {
    const res = await request(createApp())
      .post('/api/v8/interview/insights')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_SESSION_REQUIRED');
  });

  it('POST /api/v8/interview/insights/:id/regenerate regenerates insight', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockInsightRegenerate.mockResolvedValue({ id: 'ins-1', status: 'generating' });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/regenerate')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(mockInsightRegenerate).toHaveBeenCalledWith('ins-1');
  });

  it('PATCH /api/v8/interview/insights/:id updates fields', async () => {
    mockInsightGetById.mockResolvedValueOnce({ id: 'ins-1', organizationId: ORG });
    mockQueryRun.mockResolvedValue(undefined);

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
  });

  it('PATCH /api/v8/interview/insights/:id returns 400 with no fields', async () => {
    mockInsightGetById.mockResolvedValueOnce({ id: 'ins-1', organizationId: ORG });
    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_NO_FIELDS');
  });

  // ── Mass-assignment / state-machine bypass: forged insight status ────────────
  // The plain PATCH must NOT let the body forge a GATED review status
  // (published / in_review / approved). Those transitions are owned by the
  // lifecycle gate (POST /insights/:insightId/lifecycle), which enforces
  // findings-required + canon + client-readback + INTERVIEW_INSIGHTS_PUBLISH and
  // server-derives reviewed_by / published_at. A forged status='published' here
  // would publish an insight with NONE of those checks. The handler rejects it
  // (409) and never writes status to the DB.
  it('PATCH /api/v8/interview/insights/:id rejects forged status=published (gate bypass)', async () => {
    mockInsightGetById.mockResolvedValueOnce({ id: 'ins-1', organizationId: ORG });
    mockQueryRun.mockClear();

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({ status: 'published' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSIGHT_STATUS_GATED');
    // No UPDATE may touch interview_insights.status
    const wroteStatus = mockQueryRun.mock.calls.some(([sql]) =>
      String(sql).includes('UPDATE interview_insights')
    );
    expect(wroteStatus).toBe(false);
  });

  it('PATCH /api/v8/interview/insights/:id rejects forged status=in_review (gate bypass)', async () => {
    mockInsightGetById.mockResolvedValueOnce({ id: 'ins-1', organizationId: ORG });
    mockQueryRun.mockClear();

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({ status: 'in_review' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSIGHT_STATUS_GATED');
    expect(
      mockQueryRun.mock.calls.some(([sql]) => String(sql).includes('UPDATE interview_insights'))
    ).toBe(false);
  });

  it('PATCH /api/v8/interview/insights/:id rejects an unknown status value', async () => {
    mockInsightGetById.mockResolvedValueOnce({ id: 'ins-1', organizationId: ORG });

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({ status: 'totally-made-up' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INSIGHT_STATUS_INVALID');
  });

  it('PATCH /api/v8/interview/insights/:id still allows an ungated status (draft) to be set', async () => {
    mockInsightGetById.mockResolvedValueOnce({ id: 'ins-1', organizationId: ORG });
    mockQueryRun.mockClear();
    mockQueryRun.mockResolvedValue(undefined);

    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({ status: 'draft' });

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    // The server value 'draft' (not a forged gated state) is persisted.
    const updateCall = mockQueryRun.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE interview_insights')
    );
    expect(updateCall).toBeDefined();
    expect((updateCall![1] as unknown[]).includes('draft')).toBe(true);
  });

  it('GET /api/v8/interview/insights/:id/activity returns activity in V8 envelope', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockQueryAll
      .mockResolvedValueOnce([
        {
          id: 'act-1',
          type: 'created',
          description: 'Created',
          created_at: '2026-01-01',
          first_name: 'Jan',
          last_name: 'Kowalski',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'audit-1',
          type: 'worksheet_updated',
          entity_type: 'interview_report_worksheet',
          entity_id: 'irp_ins-1:executive_summary',
          detail_json: JSON.stringify({
            worksheetKey: 'executive_summary',
            updates: { status: 'partial' },
            nextPack: { completenessScore: 76 },
          }),
          created_at: '2026-01-02',
          first_name: 'Anna',
          last_name: 'Nowak',
        },
        {
          id: 'audit-2',
          type: 'report_pack_exported',
          entity_type: 'interview_report_pack',
          entity_id: 'irp_ins-1',
          detail_json: JSON.stringify({
            readinessStatus: 'ready_for_review',
            worksheetCount: 15,
            manifestHash: 'abcdef1234567890',
          }),
          created_at: '2026-01-03',
          first_name: 'Ewa',
          last_name: 'Export',
        },
        {
          id: 'audit-3',
          type: 'report_pack_revision_created',
          entity_type: 'interview_report_pack',
          entity_id: 'irp_ins-1',
          detail_json: JSON.stringify({
            version: 2,
            manifestHash: 'feedface12345678',
          }),
          created_at: '2026-01-04',
          first_name: 'Rafał',
          last_name: 'Revision',
        },
      ]);

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/activity')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.activity).toHaveLength(4);
    expect(res.body.data?.activity?.[0]?.description).toBe(
      'Report pack revision v2 created from published pack, base hash feedface1234'
    );
    expect(res.body.data?.activity?.[0]?.userName).toBe('Rafał Revision');
    expect(res.body.data?.activity?.[1]?.description).toBe(
      'Report pack export manifest downloaded (ready_for_review, 15 worksheets, hash abcdef123456)'
    );
    expect(res.body.data?.activity?.[1]?.userName).toBe('Ewa Export');
    expect(res.body.data?.activity?.[2]?.description).toBe(
      'Report worksheet executive_summary marked partial, pack completeness 76%'
    );
    expect(res.body.data?.activity?.[2]?.userName).toBe('Anna Nowak');
    expect(res.body.data?.activity?.[3]?.userName).toBe('Jan Kowalski');
  });

  it('GET /api/v8/interview/insights/:id/comments returns comments in V8 envelope', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockCommentGetContent.mockResolvedValue([
      {
        id: 'c-1',
        commentText: 'Great',
        user: { firstName: 'Anna', lastName: 'N' },
        createdAt: '2026-01-01',
        positionRef: '{"priority":"high"}',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/comments')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.comments).toHaveLength(1);
    expect(res.body.data?.comments?.[0]?.priority).toBe('high');
  });

  it('POST /api/v8/interview/insights/:id/comments creates comment and returns 201', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockCommentCreate.mockResolvedValue({
      id: 'c-new',
      commentText: 'Nice',
      user: { firstName: 'Jan', lastName: 'K' },
      createdAt: '2026-01-01',
    });

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/comments')
      .set('Authorization', 'Bearer x')
      .send({ content: 'Nice', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.content).toBe('Nice');
  });

  it('DELETE /api/v8/interview/insights/:id/comments/:commentId deletes comment', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockCommentGetById.mockResolvedValue({
      id: 'c-1',
      contentId: 'ins-1',
      contentType: 'interview_insight',
      userId: UID,
    });
    mockCommentDelete.mockResolvedValue(true);

    const res = await request(createApp())
      .delete('/api/v8/interview/insights/ins-1/comments/c-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
  });

  it('POST /api/v8/interview/insights/:id/export returns success for tools target', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'ins-1',
        organization_id: ORG,
        title: 'Test',
        session_id: 'sess-1',
      })
      .mockResolvedValueOnce({
        id: 'sess-1',
        status: 'completed',
        assignment_id: null,
        project_id: null,
      })
      .mockResolvedValueOnce(null);
    mockQueryRun.mockResolvedValue(undefined);

    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/export')
      .set('Authorization', 'Bearer x')
      .send({ target: 'tools' });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.target).toBe('tools');
  });

  it('POST /api/v8/interview/insights/:id/export returns 400 for invalid target', async () => {
    const res = await request(createApp())
      .post('/api/v8/interview/insights/ins-1/export')
      .set('Authorization', 'Bearer x')
      .send({ target: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_EXPORT_INVALID_TARGET');
  });

  it('DELETE /api/v8/interview/insights/:id deletes insight', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockInsightDelete.mockResolvedValue(true);

    const res = await request(createApp())
      .delete('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(mockInsightDelete).toHaveBeenCalledWith('ins-1');
  });

  it('DELETE /api/v8/interview/insights/:id returns 404 when not found', async () => {
    mockQueryOne.mockResolvedValue(null);

    const res = await request(createApp())
      .delete('/api/v8/interview/insights/missing')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_NOT_FOUND');
  });
});
