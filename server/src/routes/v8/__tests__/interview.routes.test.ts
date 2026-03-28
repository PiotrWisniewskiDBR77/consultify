import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_INTERVIEW_READ_CONTRACT } from '../interview.routes.js';

const mockListSessions = vi.fn();
const mockListAcceptedSessions = vi.fn();
const mockGetSession = vi.fn();
const mockGetMyAssignments = vi.fn();
const mockGetManagedAssignments = vi.fn();
const mockGetOverdueAssignments = vi.fn();
const mockStartAssignment = vi.fn();
const mockSubmitAssignment = vi.fn();
const mockSendAssignmentReminder = vi.fn();
const mockSendBackAssignment = vi.fn();
const mockApproveAssignment = vi.fn();

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
  loadInterviewSessionForOrganization: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('../../../services/InterviewAssignmentService.js', () => ({
  getMyAssignments: (...args: unknown[]) => mockGetMyAssignments(...args),
  getManagedAssignments: (...args: unknown[]) => mockGetManagedAssignments(...args),
  getOverdueAssignments: (...args: unknown[]) => mockGetOverdueAssignments(...args),
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
    expect(mockGetManagedAssignments).toHaveBeenCalledWith(UID, ORG);
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
    expect(mockGetOverdueAssignments).toHaveBeenCalledWith(ORG);
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

  it('POST /api/v8/interview/assignments/:id/start delegates to the legacy workflow handler', async () => {
    mockStartAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({ assignmentId: req.params.id, session: { id: 'sess-1' } });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-1/start')
      .set('Authorization', 'Bearer x')
      .send({ projectId: 'proj-1' });

    expect(res.status).toBe(200);
    expect(res.body.assignmentId).toBe('asg-1');
    expect(res.body.session.id).toBe('sess-1');
    expect(mockStartAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/submit delegates to the legacy workflow handler', async () => {
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
    expect(res.body.assignment.id).toBe('asg-submit');
    expect(res.body.assignment.status).toBe('submitted');
    expect(res.body.completenessPercent).toBe(50);
    expect(mockSubmitAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/remind delegates to the legacy workflow handler', async () => {
    mockSendAssignmentReminder.mockImplementation(async (_req: any, res: any) => {
      res.json({ success: true });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-2/remind')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSendAssignmentReminder).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/send-back delegates to the legacy workflow handler', async () => {
    mockSendBackAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({ id: req.params.id, status: 'sent_back' });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-3/send-back')
      .set('Authorization', 'Bearer x')
      .send({ reason: 'Missing answers' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('asg-3');
    expect(res.body.status).toBe('sent_back');
    expect(mockSendBackAssignment).toHaveBeenCalled();
  });

  it('POST /api/v8/interview/assignments/:id/approve delegates to the legacy workflow handler', async () => {
    mockApproveAssignment.mockImplementation(async (req: any, res: any) => {
      res.json({ assignment: { id: req.params.id, status: 'approved' }, entersContext: true });
    });

    const res = await request(createApp())
      .post('/api/v8/interview/assignments/asg-4/approve')
      .set('Authorization', 'Bearer x')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.assignment.id).toBe('asg-4');
    expect(res.body.assignment.status).toBe('approved');
    expect(mockApproveAssignment).toHaveBeenCalled();
  });
});
