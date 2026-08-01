import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  V8_ASSESSMENT_MUTATION_CONTRACT,
  V8_ASSESSMENT_READ_CONTRACT,
} from '../assessment.routes.js';
import { DRD_STRUCTURE } from '../../../data/drdStructure.js';
import { computeDrdCompletion } from '../../../services/assessment/drdCompletion.js';

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

  // --- ASM-001A: create-path definition validation (Luka 1) ---

  it('POST /api/v8/assessment rejects a definitionId that does not exist', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // AssessmentDefinitionService.getDefinitionById

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({
        assessmentType: 'DRD',
        name: 'Factory DRD',
        definitionId: 'asdef-missing',
        definitionVersion: '1.0',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DEFINITION_NOT_FOUND');
    const insertAssessmentCalls = mockQueryRun.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO assessments')
    );
    expect(insertAssessmentCalls).toHaveLength(0);
  });

  it('POST /api/v8/assessment rejects a definitionId that exists but is not published', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'asdef-drd-draft',
      methodology_id: 'DRD',
      version: '2.0',
      title: 'DRD draft definition',
      status: 'draft',
      is_read_only: 0,
      definition_json: '{}',
      created_by: UID,
      created_at: '2026-04-11T00:00:00.000Z',
      updated_at: '2026-04-11T00:00:00.000Z',
      published_at: null,
    });

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({
        assessmentType: 'DRD',
        name: 'Factory DRD',
        definitionId: 'asdef-drd-draft',
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DEFINITION_NOT_PUBLISHED');
    const insertAssessmentCalls = mockQueryRun.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO assessments')
    );
    expect(insertAssessmentCalls).toHaveLength(0);
  });

  it('POST /api/v8/assessment rejects a definitionVersion that does not match the referenced definition', async () => {
    mockQueryOne.mockResolvedValueOnce({
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
    });

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({
        assessmentType: 'DRD',
        name: 'Factory DRD',
        definitionId: 'asdef-drd-1',
        definitionVersion: '9.9',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DEFINITION_NOT_FOUND');
  });

  it('POST /api/v8/assessment binds assessment_definition_id/version on the row when the definition is published', async () => {
    mockQueryOne.mockResolvedValueOnce({
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
    });

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({
        assessmentType: 'DRD',
        name: 'Factory DRD',
        definitionId: 'asdef-drd-1',
        definitionVersion: '1.0',
      });

    expect(res.status).toBe(201);
    expect(res.body.data?.assessment?.assessmentDefinitionId).toBe('asdef-drd-1');
    expect(res.body.data?.assessment?.assessmentDefinitionVersion).toBe('1.0');
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO assessments'),
      expect.arrayContaining(['asdef-drd-1', '1.0'])
    );
  });

  it('POST /api/v8/assessment stays backwards-compatible: no definitionId means null-bound (unchanged today)', async () => {
    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({
        assessmentType: 'DRD',
        name: 'Factory DRD',
      });

    expect(res.status).toBe(201);
    expect(res.body.data?.assessment?.assessmentDefinitionId).toBeNull();
    expect(res.body.data?.assessment?.assessmentDefinitionVersion).toBeNull();
    // No definitionId/definitionVersion in the body -> the validation branch
    // never runs, so getDefinitionById (queryOne) is never called for it.
    expect(mockQueryOne).not.toHaveBeenCalled();
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

  // --- ASM-001A: server-derived DRD completion (Luka 2) ---

  it('GET /api/v8/assessment/:id derives completion_percent server-side for DRD, ignoring the stale stored value', async () => {
    const firstAreaId = DRD_STRUCTURE[0].areas[0].id;
    const drdAnswers = { drd: { areas: { [firstAreaId]: { achievedLevel: 2 } } } };
    const expectedPercent = computeDrdCompletion(drdAnswers.drd.areas);

    mockQueryOne.mockResolvedValue({
      id: 'a-drd-1',
      organization_id: ORG,
      name: 'DRD live',
      status: 'DRAFT',
      assessment_type: 'DRD',
      answers_json: JSON.stringify(drdAnswers),
      completion_percent: 999, // deliberately stale/wrong — must NOT be trusted
    });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-drd-1')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.assessment?.completion_percent).toBe(expectedPercent);
    expect(res.body.data?.assessment?.completion_percent).not.toBe(999);
  });

  it('GET /api/v8/assessment/:id keeps the persisted completion_percent for DRD with no drd.areas yet', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'a-drd-empty',
      organization_id: ORG,
      name: 'DRD empty',
      status: 'DRAFT',
      assessment_type: 'DRD',
      answers_json: '{}',
      completion_percent: 0,
    });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-drd-empty')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.assessment?.completion_percent).toBe(0);
  });

  it('GET /api/v8/assessment/:id leaves completion_percent untouched for non-DRD frameworks (regression guard)', async () => {
    mockQueryOne.mockResolvedValue({
      id: 'a-siri-2',
      organization_id: ORG,
      name: 'SIRI Gamma',
      status: 'DRAFT',
      assessment_type: 'SIRI',
      answers_json: '{}',
      completion_percent: 33,
    });

    const res = await request(createApp())
      .get('/api/v8/assessment/a-siri-2')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.assessment?.completion_percent).toBe(33);
  });

  it('PUT /api/v8/assessment/:id derives completion_percent server-side for DRD, ignoring client completionPercent', async () => {
    const [axis0, axis1] = DRD_STRUCTURE;
    const firstAreaId = axis0.areas[0].id;
    const secondAreaId = axis0.areas[1]?.id || axis1.areas[0].id;
    const areas = {
      [firstAreaId]: { achievedLevel: 3 },
      [secondAreaId]: { targetLevel: 2 },
    };
    const expectedPercent = computeDrdCompletion(areas);

    mockQueryOne.mockResolvedValue({
      answers_json: '{}',
      context_snapshot: '{}',
      score_summary: '{}',
      completion_percent: 10,
      confidence_avg: 1,
      current_section_id: null,
      navigation_json: '{}',
      assessment_type: 'DRD',
    });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-drd-2')
      .set('Authorization', 'Bearer x')
      .send({
        answers: { drd: { areas } },
        completionPercent: 1, // bogus client value — must be ignored for DRD
      });

    expect(res.status).toBe(200);
    expect(expectedPercent).not.toBe(1);
    expect(res.body.data?.completionPercent).toBe(expectedPercent);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE assessments'),
      expect.arrayContaining([expectedPercent])
    );
  });

  it('PUT /api/v8/assessment/:id keeps trusting the client completionPercent for non-DRD frameworks (regression guard)', async () => {
    mockQueryOne.mockResolvedValue({
      answers_json: '{}',
      context_snapshot: '{}',
      score_summary: '{}',
      completion_percent: 10,
      confidence_avg: 1,
      current_section_id: null,
      navigation_json: '{}',
      assessment_type: 'SIRI',
    });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-siri-1')
      .set('Authorization', 'Bearer x')
      .send({ completionPercent: 42 });

    expect(res.status).toBe(200);
    expect(res.body.data?.completionPercent).toBe(42);
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE assessments'),
      expect.arrayContaining([42])
    );
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

  // --- ASM-001A Codex fix #2: capability enforcement on create/edit ---

  it('POST /api/v8/assessment rejects a viewer/read-only role with 403, zero insert', async () => {
    mockUser = { id: UID, role: 'VIEWER', organizationId: ORG, isSuperAdmin: false };

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({ assessmentType: 'DRD', name: 'Should be denied' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/assessment rejects a GUEST role with 403, zero insert', async () => {
    mockUser = { id: UID, role: 'GUEST', organizationId: ORG, isSuperAdmin: false };

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({ assessmentType: 'DRD', name: 'Should be denied' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/assessment rejects a blank/missing role with 403 (fail-closed)', async () => {
    mockUser = { id: UID, role: '', organizationId: ORG, isSuperAdmin: false };

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({ assessmentType: 'DRD', name: 'Should be denied' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('POST /api/v8/assessment allows an OWNER role (regression guard for asm-001a-*.mjs, which use OWNER)', async () => {
    mockUser = { id: UID, role: 'OWNER', organizationId: ORG, isSuperAdmin: false };

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({ assessmentType: 'DRD', name: 'Allowed for OWNER' });

    expect(res.status).toBe(201);
  });

  it('POST /api/v8/assessment allows a PROJECT_MANAGER role', async () => {
    mockUser = { id: UID, role: 'PROJECT_MANAGER', organizationId: ORG, isSuperAdmin: false };

    const res = await request(createApp())
      .post('/api/v8/assessment')
      .set('Authorization', 'Bearer x')
      .send({ assessmentType: 'DRD', name: 'Allowed for PM' });

    expect(res.status).toBe(201);
  });

  it('PUT /api/v8/assessment/:id rejects a viewer role with 403, zero update', async () => {
    mockUser = { id: UID, role: 'VIEWER', organizationId: ORG, isSuperAdmin: false };
    mockQueryOne.mockResolvedValue({
      answers_json: '{"existing":true}',
      context_snapshot: '{}',
      score_summary: '{}',
      completion_percent: 10,
      confidence_avg: 1,
      current_section_id: null,
      navigation_json: '{}',
    });
    mockGetUserRole.mockResolvedValue({
      role: 'viewer',
      permissions: { canView: true, canEdit: false, canApprove: false },
      assignedAreas: null,
      isOwner: false,
    });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-viewer-edit')
      .set('Authorization', 'Bearer x')
      .send({ name: 'Should not be saved' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P28_PERMISSION_DENIED');
    const updateCalls = mockQueryRun.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('UPDATE assessments')
    );
    expect(updateCalls).toHaveLength(0);
  });

  it('PUT /api/v8/assessment/:id allows a role with canEdit permission (200)', async () => {
    mockUser = { id: UID, role: 'CONSULTANT', organizationId: ORG, isSuperAdmin: false };
    mockQueryOne.mockResolvedValue({
      answers_json: '{"existing":true}',
      context_snapshot: '{}',
      score_summary: '{}',
      completion_percent: 10,
      confidence_avg: 1,
      current_section_id: null,
      navigation_json: '{}',
    });
    mockGetUserRole.mockResolvedValue({
      role: 'editor',
      permissions: { canView: true, canEdit: true, canApprove: false },
      assignedAreas: null,
      isOwner: false,
    });

    const res = await request(createApp())
      .put('/api/v8/assessment/a-consultant-edit')
      .set('Authorization', 'Bearer x')
      .send({ name: 'Consultant can save' });

    expect(res.status).toBe(200);
  });

  it('PUT /api/v8/assessment/:id cross-tenant still returns 404, not 403 (regression guard: capability check must run AFTER org-scope check)', async () => {
    mockUser = { id: UID, role: 'VIEWER', organizationId: ORG, isSuperAdmin: false };
    mockQueryOne.mockResolvedValue(null); // no row for this org -> ASSESSMENT_NOT_FOUND

    const res = await request(createApp())
      .put('/api/v8/assessment/foreign-org-assessment')
      .set('Authorization', 'Bearer x')
      .send({ name: 'Cross-tenant attempt' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ASSESSMENT_NOT_FOUND');
    // getUserRole must never even be consulted for a cross-tenant 404 —
    // proves the permission check did not run before the org-scope check.
    expect(mockGetUserRole).not.toHaveBeenCalled();
  });

  // --- ASM-001A Codex fix #4 (list): server-derived DRD completion on GET / ---

  it('GET /api/v8/assessment (list) derives completion_percent server-side for DRD rows, ignoring the stale stored value', async () => {
    const firstAreaId = DRD_STRUCTURE[0].areas[0].id;
    const drdAnswers = { drd: { areas: { [firstAreaId]: { achievedLevel: 2 } } } };
    const expectedPercent = computeDrdCompletion(drdAnswers.drd.areas);

    mockQueryAll.mockResolvedValue([
      {
        id: 'a-list-drd',
        organization_id: ORG,
        name: 'DRD in list',
        status: 'DRAFT',
        assessment_type: 'DRD',
        answers_json: JSON.stringify(drdAnswers),
        completion_percent: 999, // deliberately stale — must NOT be trusted
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/assessment')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.items?.[0]?.completion_percent).toBe(expectedPercent);
    expect(res.body.data?.items?.[0]?.completion_percent).not.toBe(999);
  });

  it('GET /api/v8/assessment (list) leaves completion_percent untouched for non-DRD frameworks (regression guard)', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'a-list-siri',
        organization_id: ORG,
        name: 'SIRI in list',
        status: 'DRAFT',
        assessment_type: 'SIRI',
        answers_json: '{}',
        completion_percent: 33,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/assessment')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.items?.[0]?.completion_percent).toBe(33);
  });

  it('GET /api/v8/assessment (list) keeps the persisted completion_percent for a DRD row with no drd.areas yet', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'a-list-drd-empty',
        organization_id: ORG,
        name: 'DRD empty in list',
        status: 'DRAFT',
        assessment_type: 'DRD',
        answers_json: '{}',
        completion_percent: 0,
      },
    ]);

    const res = await request(createApp())
      .get('/api/v8/assessment')
      .set('Authorization', 'Bearer x');

    expect(res.status).toBe(200);
    expect(res.body.data?.items?.[0]?.completion_percent).toBe(0);
  });
});

// ASM-001A: unit coverage for the pure completion formula. Kept in this file
// because the allowed edit surface for this slice is scoped to
// assessment.routes.ts + this test file — see server/src/services/assessment/
// drdCompletion.ts for the implementation this exercises.
describe('computeDrdCompletion (ASM-001A)', () => {
  const totalAreas = DRD_STRUCTURE.reduce((acc, axis) => acc + axis.areas.length, 0);
  const allAreaIds = DRD_STRUCTURE.flatMap((axis) => axis.areas.map((area) => area.id));

  it('returns 0 for empty, null, or undefined areas', () => {
    expect(computeDrdCompletion({})).toBe(0);
    expect(computeDrdCompletion(null)).toBe(0);
    expect(computeDrdCompletion(undefined)).toBe(0);
  });

  it('returns 100 when every area has an achievedLevel', () => {
    const areas: Record<string, { achievedLevel: number }> = {};
    for (const id of allAreaIds) areas[id] = { achievedLevel: 3 };
    expect(computeDrdCompletion(areas)).toBe(100);
  });

  it('returns a proportional value for a partial mix', () => {
    const answeredIds = allAreaIds.slice(0, 5);
    const areas: Record<string, { targetLevel: number }> = {};
    for (const id of answeredIds) areas[id] = { targetLevel: 2 };
    expect(computeDrdCompletion(areas)).toBe(Math.round((5 / totalAreas) * 100));
  });

  it('counts an area with only levelNotes (no levels) as answered — matches the client contract', () => {
    const areas = { [allAreaIds[0]]: { levelNotes: { 1: 'some note' } } };
    expect(computeDrdCompletion(areas)).toBe(Math.round((1 / totalAreas) * 100));
  });

  it('counts an area with only levelLinks as answered', () => {
    const areas = { [allAreaIds[0]]: { levelLinks: { 1: ['https://example.com'] } } };
    expect(computeDrdCompletion(areas)).toBe(Math.round((1 / totalAreas) * 100));
  });

  it('counts an area with only levelDecisions as answered', () => {
    const areas = { [allAreaIds[0]]: { levelDecisions: { 1: 'accepted' } } };
    expect(computeDrdCompletion(areas)).toBe(Math.round((1 / totalAreas) * 100));
  });

  it('does NOT count an area whose notes/links are present but empty', () => {
    const areas = {
      [allAreaIds[0]]: {
        levelNotes: { 1: '   ' },
        levelLinks: { 1: [] },
        levelDecisions: {},
      },
    };
    expect(computeDrdCompletion(areas)).toBe(0);
  });

  it('does NOT count achievedLevel/targetLevel of 0 as answered', () => {
    const areas = { [allAreaIds[0]]: { achievedLevel: 0, targetLevel: 0 } };
    expect(computeDrdCompletion(areas)).toBe(0);
  });

  it('ignores unknown area ids that are not part of DRD_STRUCTURE', () => {
    const areas = { 'not-a-real-area': { achievedLevel: 5 } };
    expect(computeDrdCompletion(areas)).toBe(0);
  });
});
