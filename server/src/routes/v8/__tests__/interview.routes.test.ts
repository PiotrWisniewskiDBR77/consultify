import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8_INTERVIEW_READ_CONTRACT } from '../interview.routes.js';

const mockListSessions = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../../../controllers/InterviewController.js', () => ({
  loadInterviewSessionsForOrganization: (...args: unknown[]) => mockListSessions(...args),
  loadInterviewSessionForOrganization: (...args: unknown[]) => mockGetSession(...args),
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
});
