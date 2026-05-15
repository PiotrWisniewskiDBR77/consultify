import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_ASSESSMENT_MUTATION_CONTRACT,
  V8_ASSESSMENT_READ_CONTRACT,
} from '../assessment.routes.js';

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockQueryRun = vi.fn();
const mockEnsureAssessmentSchema = vi.fn();
const mockLogCreation = vi.fn();
const mockLogUpdate = vi.fn();
const mockGetUserRole = vi.fn();
const mockGetDefaultPermissions = vi.fn();

vi.mock('../../../controllers/AssessmentController.js', () => ({
  ensureAssessmentSchema: (...args: unknown[]) => mockEnsureAssessmentSchema(...args),
  normalizeStatus: (status: string | null | undefined) => {
    const value = String(status || 'DRAFT').toUpperCase();
    if (value === 'IN_REVIEW' || value === 'AWAITING_APPROVAL') return 'REVIEW';
    if (value === 'APPROVED') return 'APPROVED';
    return 'DRAFT';
  },
}));

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('../../../utils/AssessmentAuditLogger.js', () => ({
  assessmentAuditLogger: {
    logCreation: (...args: unknown[]) => mockLogCreation(...args),
    logUpdate: (...args: unknown[]) => mockLogUpdate(...args),
  },
}));

vi.mock('../../../services/assessmentPermissionService.js', () => ({
  default: {
    getUserRole: (...args: unknown[]) => mockGetUserRole(...args),
    getDefaultPermissions: (...args: unknown[]) => mockGetDefaultPermissions(...args),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid-1'),
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

const ORG = 'org-assessment-v8';
const UID = 'user-assessment-v8';

describe('V8 Assessment bounded routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: UID, role: 'ADMIN', organizationId: ORG, isSuperAdmin: false };
    mockEnsureAssessmentSchema.mockResolvedValue(undefined);
    mockLogCreation.mockResolvedValue(undefined);
    mockLogUpdate.mockResolvedValue(undefined);
    mockGetUserRole.mockResolvedValue({
      role: 'editor',
      permissions: { canView: true, canEdit: true },
      assignedAreas: ['1A'],
      isOwner: false,
    });
    mockGetDefaultPermissions.mockReturnValue({
      canView: true,
      canEdit: true,
      canManage: true,
      canManageTeam: true,
      canChangeStatus: true,
      canApprove: true,
      canDelete: true,
      canGenerateReport: true,
      canGenerateInitiatives: true,
      canRequestAccess: false,
    });
  });

  it('GET /api/v8/assessment returns list in V8 envelope', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'a-1',
        organization_id: ORG,
        name: 'DRD Alpha',
        status: 'IN_REVIEW',
        answers_json: '{"processes":{"actual":2}}',
        score_summary: '{"gap":3}',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/assessment?projectId=proj-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockQueryAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE organization_id = ?'),
      [ORG, 'proj-1', 100, 0]
    );
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_READ_CONTRACT);
    expect(res.body.data?.items?.[0]?.status).toBe('REVIEW');
    expect(res.body.data?.items?.[0]?.answers?.processes?.actual).toBe(2);
  });

  it('GET /api/v8/assessment/:id returns 404 when assessment is missing', async () => {
    mockQueryOne.mockResolvedValue(null);

    const res = await request(createApp())
      .get('/api/v8/assessment/missing-id')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ASSESSMENT_NOT_FOUND');
  });

  it('GET /api/v8/assessment/:id returns parsed assessment detail', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'a-2',
      organization_id: ORG,
      name: 'SIRI Beta',
      status: 'APPROVED',
      answers_json: '{"pillar":"ops"}',
      context_snapshot: '{"industry":"mfg"}',
      score_summary: '{"score":4}',
      navigation_json: '{"selectedAxis":"dashboard"}',
    });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-2')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockEnsureAssessmentSchema).toHaveBeenCalled();
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_READ_CONTRACT);
    expect(res.body.data?.assessment?.answers?.pillar).toBe('ops');
    expect(res.body.data?.assessment?.contextSnapshot?.industry).toBe('mfg');
  });

  it('GET /api/v8/assessment/definitions/:methodologyId returns definition versions', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'asdef-drd-1',
        methodology_id: 'DRD',
        version: '1.0',
        title: 'DRD canonical definition',
        status: 'published',
        is_read_only: 1,
        definition_json: '{}',
        created_by: UID,
        created_at: '2026-04-11T00:00:00.000Z',
        updated_at: '2026-04-11T00:00:00.000Z',
        published_at: '2026-04-11T00:00:00.000Z',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/assessment/definitions/DRD')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.methodologyId).toBe('DRD');
    expect(res.body.data?.versions?.[0]?.version).toBe('1.0');
  });

  it('POST /api/v8/assessment creates a draft assessment and session', async () => {
    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({
        assessmentType: 'drd',
        name: 'Factory DRD',
        projectId: 'proj-9',
      });

    expect(res.status).toBe(201);
    expect(mockQueryRun).toHaveBeenCalledTimes(2);
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_MUTATION_CONTRACT);
    expect(res.body.data?.assessment?.assessmentType).toBe('DRD');
    expect(mockLogCreation).toHaveBeenCalled();
  });

  it('PUT /api/v8/assessment/:id updates persisted answers with bounded payload', async () => {
    mockQueryOne.mockResolvedValue({
      answers_json: '{"existing":true}',
      context_snapshot: '{}',
      score_summary: '{}',
      completion_percent: 10,
      confidence_avg: 1,
      current_section_id: null,
      navigation_json: '{}',
    });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-3')
      .set('Authorization', 'Bearer x')
      .send({
        name: 'Updated name',
        answers: { processes: { actual: 3 } },
        completionPercent: 57,
        navigation: { selectedAxis: 'processes' },
      });

    expect(res.status).toBe(200);
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_MUTATION_CONTRACT);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE assessments'),
      expect.arrayContaining(['Updated name', 57, 'a-3', ORG])
    );
    expect(mockLogUpdate).toHaveBeenCalled();
  });

  it('PUT /api/v8/assessment/:id blocks direct scoreSummary writes when P28 workbench exists', async () => {
    mockQueryOne.mockResolvedValue({
      answers_json: '{"existing":true}',
      context_snapshot: '{}',
      score_summary: '{}',
      p28_workbench_v1: '{"runState":"running"}',
      completion_percent: 10,
      confidence_avg: 1,
      current_section_id: null,
      navigation_json: '{}',
    });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-p28')
      .set('Authorization', 'Bearer x')
      .send({
        scoreSummary: { readiness: 4 },
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('P28_NO_SILENT_SCORING');
  });

  it('GET /api/v8/assessment/:id/my-role returns bounded permission payload', async () => {
    mockUser = { id: UID, role: 'EDITOR', organizationId: ORG, isSuperAdmin: false };
    mockQueryOne.mockResolvedValue({ id: 'a-4', created_by: 'owner-1' });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-4/my-role')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockGetUserRole).toHaveBeenCalledWith('a-4', UID, ORG);
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_READ_CONTRACT);
    expect(res.body.data?.role).toBe('editor');
  });

  it('GET /api/v8/assessment/:id/workbench returns permission guidance when access is denied', async () => {
    mockUser = { id: UID, role: 'EDITOR', organizationId: ORG, isSuperAdmin: false };
    mockQueryOne.mockResolvedValue({ assessment_type: 'DRD', created_by: UID });
    mockGetUserRole.mockResolvedValue({
      role: 'viewer',
      permissions: { canView: false, canEdit: false, canApprove: false },
      assignedAreas: null,
      isOwner: false,
    });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-wb/workbench')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P28_PERMISSION_DENIED');
    expect(Array.isArray(res.body.whatNext)).toBe(true);
  });

  it('GET /api/v8/assessment/:id/user-state returns bounded resume state', async () => {
    mockQueryOne.mockResolvedValueOnce({ id: 'a-5', created_by: UID }).mockResolvedValueOnce({
      navigation_json: '{"axisId":1,"areaId":"1A","level":2}',
      updated_at: '2026-03-26T00:00:00.000Z',
    });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-5/user-state')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.navigation?.areaId).toBe('1A');
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_READ_CONTRACT);
  });

  it('PUT /api/v8/assessment/:id/user-state updates bounded resume state', async () => {
    mockQueryOne.mockResolvedValue({ id: 'a-6', created_by: UID });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-6/user-state')
      .set('Authorization', 'Bearer x')
      .send({ navigation: { axisId: 2, areaId: '2B', level: 3 } });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO assessment_user_state'),
      ['a-6', UID, JSON.stringify({ axisId: 2, areaId: '2B', level: 3 }), expect.any(String)]
    );
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_MUTATION_CONTRACT);
  });

  it('GET /api/v8/assessment/:id/assignments returns bounded assignments', async () => {
    mockQueryOne.mockResolvedValue({ id: 'a-7', created_by: UID });
    mockQueryAll.mockResolvedValue([
      {
        id: 'asg-1',
        assessment_id: 'a-7',
        area_id: '1A',
        assigned_user_id: 'user-2',
        status: 'ACTIVE',
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/assessment/a-7/assignments')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.assignments?.[0]?.area_id).toBe('1A');
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_READ_CONTRACT);
  });

  it('PUT /api/v8/assessment/:id/assignments upserts bounded assignment', async () => {
    mockQueryOne.mockResolvedValue({ id: 'a-8', created_by: UID });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-8/assignments')
      .set('Authorization', 'Bearer x')
      .send({ areaId: '3C', assignedUserId: 'user-9', status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO assessment_area_assignments'),
      expect.arrayContaining([
        expect.any(String),
        'a-8',
        '3C',
        'user-9',
        UID,
        expect.any(String),
        null,
        'ACTIVE',
      ])
    );
    expect(res.body.meta?.contract).toBe(V8_ASSESSMENT_MUTATION_CONTRACT);
  });

  it('DELETE /api/v8/assessment/:id/assignments/:assignmentId removes bounded assignment', async () => {
    mockQueryOne.mockResolvedValue({ id: 'a-9', created_by: UID });

    const res = await request(createApp())
      .delete('/api/v8/assessment/a-9/assignments/asg-9')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM assessment_area_assignments'),
      ['asg-9', 'a-9']
    );
    expect(res.body.data?.deleted).toBe(true);
  });
});
