import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { CreateInitiativeSchema } from '../../../server/src/validators/initiative.validators.js';
import { makeInitiativesApp } from './_helpers/makeInitiativesApp';

const {
  mockGenerateSectionContent,
  mockQueryOne,
  mockQueryAll,
  mockInitiativeController,
  mockTemplateService,
  mockSectionTypeService,
} = vi.hoisted(() => ({
  mockGenerateSectionContent: vi.fn(),
  mockQueryOne: vi.fn(),
  mockQueryAll: vi.fn(),
  mockInitiativeController: new Proxy(
    {},
    {
      get: () => (_req: any, res: any) => res.status(501).json({ error: 'not-mocked' }),
    }
  ),
  mockTemplateService: {
    getTemplates: vi.fn(),
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
  },
  mockSectionTypeService: {
    deleteSectionType: vi.fn(),
    duplicateSectionType: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {
    generateSectionContent: (...args: any[]) => mockGenerateSectionContent(...args),
    suggestSections: vi.fn(),
  },
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: (...args: any[]) => mockQueryOne(...args),
  queryAll: (...args: any[]) => mockQueryAll(...args),
  queryRun: vi.fn(),
}));

vi.mock('../../../../server/src/controllers/InitiativeController.js', () => ({
  default: mockInitiativeController,
}));

vi.mock('../../../../server/src/services/initiativeTemplateService.js', () => ({
  default: mockTemplateService,
}));

vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: mockSectionTypeService,
}));

describe('Initiatives routes: POST /readiness-analysis (REAL integration)', () => {
  void CreateInitiativeSchema;
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  const origMockDb = process.env.MOCK_DB;
  const origTestType = process.env.TEST_TYPE;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
    if (origMockDb === undefined) delete process.env.MOCK_DB;
    else process.env.MOCK_DB = origMockDb;
    if (origTestType === undefined) delete process.env.TEST_TYPE;
    else process.env.TEST_TYPE = origTestType;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when organizationId is missing', async () => {
    const app = await makeInitiativesApp({ user: { organizationId: '' } });
    const res = await request(app).post('/api/initiatives/readiness-analysis').send({
      initiativeId: 'i-1',
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when initiativeId is missing', async () => {
    const app = await makeInitiativesApp();
    const res = await request(app).post('/api/initiatives/readiness-analysis').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: 'initiativeId is required' }));
  });

  it('returns 404 when initiative is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);
    const app = await makeInitiativesApp({ user: { organizationId: 'org-1' } });
    const res = await request(app).post('/api/initiatives/readiness-analysis').send({
      initiativeId: 'i-404',
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(expect.objectContaining({ error: 'Initiative not found' }));
  });

  it('computes metrics and calls generation even when related tables queries throw', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'i-1',
      name: 'N',
      summary: '',
      problem_statement: '',
      status: 'DRAFT',
      owner_business_id: null,
      owner_execution_id: null,
      planned_start_date: null,
      planned_end_date: null,
    });
    mockQueryAll.mockRejectedValueOnce(new Error('no tasks table'));
    mockQueryAll.mockRejectedValueOnce(new Error('no decisions table'));
    mockQueryAll.mockRejectedValueOnce(new Error('no raid table'));
    mockGenerateSectionContent.mockResolvedValueOnce({
      content: 'A',
      parsedContent: undefined,
      model: 'mock',
    });

    const app = await makeInitiativesApp({ user: { organizationId: 'org-1' } });
    const res = await request(app).post('/api/initiatives/readiness-analysis').send({
      initiativeId: 'i-1',
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(mockGenerateSectionContent).toHaveBeenCalledWith(
      'gates',
      expect.objectContaining({
        initiativeId: 'i-1',
        completedTasks: 0,
        totalTasks: 0,
        openRisks: 0,
        openDecisions: 0,
        language: 'en',
      }),
      'org-1'
    );
    expect(res.body.metrics).toEqual(
      expect.objectContaining({
        tasksProgress: 0,
        decisionsApproved: 0,
        decisionsPending: 0,
        criticalRisks: 0,
        hasOwner: false,
        hasTimeline: false,
        hasSummary: false,
        hasProblemStatement: false,
      })
    );
  });

  it('counts DONE tasks, approved decisions, and critical risks', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'i-2',
      title: 'T',
      summary: 'S',
      problem_statement: 'P',
      status: 'PLANNING',
      owner_business_id: 'ob',
      owner_execution_id: null,
      planned_start_date: '2026-01-01',
      planned_end_date: '2026-02-01',
    });
    mockQueryAll
      .mockResolvedValueOnce([{ status: 'DONE' }, { status: 'done' }, { status: 'TODO' }]) // tasks
      .mockResolvedValueOnce([{ status: 'APPROVED' }, { status: 'pending' }]) // decisions
      .mockResolvedValueOnce([{ severity: 'HIGH' }, { severity: 'critical' }, { severity: 'low' }]); // raid

    mockGenerateSectionContent.mockResolvedValueOnce({
      content: 'A',
      parsedContent: {},
      model: 'm',
    });

    const app = await makeInitiativesApp({ user: { organizationId: 'org-9' } });
    const res = await request(app).post('/api/initiatives/readiness-analysis').send({
      initiativeId: 'i-2',
    });

    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual(
      expect.objectContaining({
        tasksProgress: 67,
        decisionsApproved: 1,
        decisionsPending: 1,
        criticalRisks: 2,
        hasOwner: true,
        hasTimeline: true,
        hasSummary: true,
        hasProblemStatement: true,
      })
    );
  });
});
