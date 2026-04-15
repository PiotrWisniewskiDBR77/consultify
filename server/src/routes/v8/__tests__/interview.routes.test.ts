import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT, V8_INTERVIEW_INSIGHT_READ_CONTRACT, V8_INTERVIEW_READ_CONTRACT } from '../interview.routes.js';

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

const mockInsightList = vi.fn();
const mockInsightGetById = vi.fn();
const mockInsightCreate = vi.fn();
const mockInsightRegenerate = vi.fn();
const mockInsightDelete = vi.fn();

vi.mock('../../../controllers/InterviewController.js', () => ({
  InterviewController: {
    startAssignment: (...args: unknown[]) => mockStartAssignment(...args),
    submitAssignment: (...args: unknown[]) => mockSubmitAssignment(...args),
    sendAssignmentReminder: (...args: unknown[]) => mockSendAssignmentReminder(...args),
    sendBackAssignment: (...args: unknown[]) => mockSendBackAssignment(...args),
    approveAssignment: (...args: unknown[]) => mockApproveAssignment(...args),
  },
  loadInterviewSessionsForOrganization: (...args: unknown[]) => mockListSessions(...args),
  loadAcceptedInterviewSessionsForManager: (...args: unknown[]) =>
    mockListAcceptedSessions(...args),
  loadManagedInterviewSessionsForManager: (...args: unknown[]) =>
    mockListManagedSessions(...args),
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

describe('V8 Interview read-only routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockResolveInterviewManagerScope.mockResolvedValue({ kind: 'organization' });
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
    expect(mockListManagedSessions).toHaveBeenCalledWith(ORG, UID, { scope: { kind: 'organization' } });
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
});

describe('V8 Interview insight routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockQueryRun.mockResolvedValue(undefined);
  });

  it('GET /api/v8/interview/insights returns list in V8 envelope', async () => {
    mockInsightList.mockResolvedValue([{ id: 'ins-1', title: 'Test Insight', status: 'completed' }]);

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
  });

  it('GET /api/v8/interview/insights/:id returns insight in V8 envelope', async () => {
    mockInsightGetById.mockResolvedValue({ id: 'ins-1', organizationId: ORG, title: 'Test', status: 'completed' });

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.insight?.id).toBe('ins-1');
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
    mockInsightCreate.mockResolvedValue({ id: 'ins-new', organizationId: ORG, title: 'New', status: 'generating' });

    const res = await request(createApp())
      .post('/api/v8/interview/insights')
      .set('Authorization', 'Bearer x')
      .send({ sessionIds: ['sess-1'], promptType: 'summary' });

    expect(res.status).toBe(201);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_MUTATION_CONTRACT);
    expect(res.body.data?.insight?.id).toBe('ins-new');
    expect(mockInsightCreate).toHaveBeenCalled();
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
    const res = await request(createApp())
      .patch('/api/v8/interview/insights/ins-1')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INTERVIEW_INSIGHT_NO_FIELDS');
  });

  it('GET /api/v8/interview/insights/:id/activity returns activity in V8 envelope', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockQueryAll
      .mockResolvedValueOnce([{ id: 'act-1', type: 'created', description: 'Created', created_at: '2026-01-01', first_name: 'Jan', last_name: 'Kowalski' }])
      .mockResolvedValueOnce([{ id: 'audit-1', type: 'publish', created_at: '2026-01-02', first_name: 'Anna', last_name: 'Nowak' }]);

    const res = await request(createApp())
      .get('/api/v8/interview/insights/ins-1/activity')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_INTERVIEW_INSIGHT_READ_CONTRACT);
    expect(res.body.data?.activity).toHaveLength(2);
    expect(res.body.data?.activity?.[0]?.description).toBe('P10: publish');
    expect(res.body.data?.activity?.[0]?.userName).toBe('Anna Nowak');
    expect(res.body.data?.activity?.[1]?.userName).toBe('Jan Kowalski');
  });

  it('GET /api/v8/interview/insights/:id/comments returns comments in V8 envelope', async () => {
    mockQueryOne.mockResolvedValue({ organization_id: ORG });
    mockCommentGetContent.mockResolvedValue([{ id: 'c-1', commentText: 'Great', user: { firstName: 'Anna', lastName: 'N' }, createdAt: '2026-01-01', positionRef: '{"priority":"high"}' }]);

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
    mockCommentCreate.mockResolvedValue({ id: 'c-new', commentText: 'Nice', user: { firstName: 'Jan', lastName: 'K' }, createdAt: '2026-01-01' });

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
    mockCommentGetById.mockResolvedValue({ id: 'c-1', contentId: 'ins-1', contentType: 'interview_insight', userId: UID });
    mockCommentDelete.mockResolvedValue(true);

    const res = await request(createApp())
      .delete('/api/v8/interview/insights/ins-1/comments/c-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
  });

  it('POST /api/v8/interview/insights/:id/export returns success for tools target', async () => {
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ins-1', organization_id: ORG, title: 'Test', session_id: 'sess-1' })
      .mockResolvedValueOnce({ id: 'sess-1', status: 'completed', assignment_id: null, project_id: null })
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
