// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryAllMock = vi.fn();
const generateSectionMock = vi.fn();
const suggestSectionsMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    if (req.get('x-test-auth') === 'none') {
      req.user = undefined;
    } else {
      req.user = { id: 'u-pmo-1', organizationId: 'org-pmo-1', role: 'ADMIN' };
    }
    next();
  },
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/controllers/InitiativeController.js', () => ({
  default: {
    getPortfolioData: (_req: any, res: any) => res.status(200).json({}),
    getPortfolioRollups: (_req: any, res: any) => res.status(200).json({}),
    getPortfolioDependencies: (_req: any, res: any) => res.status(200).json([]),
    createPortfolioDependency: (_req: any, res: any) => res.status(201).json({}),
    deletePortfolioDependency: (_req: any, res: any) => res.status(200).json({}),
    getInitiatives: (_req: any, res: any) => res.status(200).json([]),
    getInitiativesByStatus: (_req: any, res: any) => res.status(200).json([]),
    getInitiativeById: (_req: any, res: any) => res.status(404).json({}),
    deleteInitiative: (_req: any, res: any) => res.status(200).json({}),
    updateInitiative: (_req: any, res: any) => res.status(200).json({}),
    updateInitiativeStatus: (_req: any, res: any) => res.status(200).json({}),
    quickUpdateInitiative: (_req: any, res: any) => res.status(200).json({}),
    checkReadiness: (_req: any, res: any) => res.status(200).json({}),
    submitForReview: (_req: any, res: any) => res.status(200).json({}),
    approveInitiative: (_req: any, res: any) => res.status(200).json({}),
    rejectInitiative: (_req: any, res: any) => res.status(200).json({}),
    startExecution: (_req: any, res: any) => res.status(200).json({}),
    blockInitiative: (_req: any, res: any) => res.status(200).json({}),
    unblockInitiative: (_req: any, res: any) => res.status(200).json({}),
    completeInitiative: (_req: any, res: any) => res.status(200).json({}),
    moveInitiative: (_req: any, res: any) => res.status(200).json({}),
    archiveInitiative: (_req: any, res: any) => res.status(200).json({}),
    getInitiativeKpis: (_req: any, res: any) => res.status(200).json([]),
    createInitiativeKpi: (_req: any, res: any) => res.status(200).json({}),
    updateInitiativeKpi: (_req: any, res: any) => res.status(200).json({}),
    deleteInitiativeKpi: (_req: any, res: any) => res.status(200).json({}),
    getMilestones: (_req: any, res: any) => res.status(200).json([]),
    createMilestone: (_req: any, res: any) => res.status(200).json({}),
    updateMilestone: (_req: any, res: any) => res.status(200).json({}),
    deleteMilestone: (_req: any, res: any) => res.status(200).json({}),
    getScheduleBaselines: (_req: any, res: any) => res.status(200).json([]),
    getScheduleBaseline: (_req: any, res: any) => res.status(200).json({}),
    getResources: (_req: any, res: any) => res.status(200).json([]),
    addResource: (_req: any, res: any) => res.status(200).json({}),
    deleteResource: (_req: any, res: any) => res.status(200).json({}),
    updateResource: (_req: any, res: any) => res.status(200).json({}),
    logResourcesAiApply: (_req: any, res: any) => res.status(200).json({}),
    getBudgetItems: (_req: any, res: any) => res.status(200).json([]),
    addBudgetItem: (_req: any, res: any) => res.status(200).json({}),
    updateBudgetItem: (_req: any, res: any) => res.status(200).json({}),
    deleteBudgetItem: (_req: any, res: any) => res.status(200).json({}),
    getTools: (_req: any, res: any) => res.status(200).json([]),
    addTool: (_req: any, res: any) => res.status(200).json({}),
    updateTool: (_req: any, res: any) => res.status(200).json({}),
    deleteTool: (_req: any, res: any) => res.status(200).json({}),
    getIntangibleAssets: (_req: any, res: any) => res.status(200).json([]),
    addIntangibleAsset: (_req: any, res: any) => res.status(200).json({}),
    updateIntangibleAsset: (_req: any, res: any) => res.status(200).json({}),
    deleteIntangibleAsset: (_req: any, res: any) => res.status(200).json({}),
    getStakeholders: (_req: any, res: any) => res.status(200).json([]),
    addStakeholder: (_req: any, res: any) => res.status(200).json({}),
    deleteStakeholder: (_req: any, res: any) => res.status(200).json({}),
    getWatchers: (_req: any, res: any) => res.status(200).json([]),
    addWatcher: (_req: any, res: any) => res.status(200).json({}),
    deleteWatcher: (_req: any, res: any) => res.status(200).json({}),
    getRaid: (_req: any, res: any) => res.status(200).json([]),
    createRaidItem: (_req: any, res: any) => res.status(200).json({}),
    updateRaidItem: (_req: any, res: any) => res.status(200).json({}),
    deleteRaidItem: (_req: any, res: any) => res.status(200).json({}),
    getHistory: (_req: any, res: any) => res.status(200).json([]),
    getInitiativeComments: (_req: any, res: any) => res.status(200).json([]),
    addInitiativeComment: (_req: any, res: any) => res.status(200).json({}),
    deleteInitiativeComment: (_req: any, res: any) => res.status(200).json({}),
    getInitiativeTaskDependencies: (_req: any, res: any) => res.status(200).json([]),
    getGateRoles: (_req: any, res: any) => res.status(200).json([]),
    updateGateRoles: (_req: any, res: any) => res.status(200).json({}),
    getGateReadinessCheck: (_req: any, res: any) => res.status(200).json({}),
    getStatusHistory: (_req: any, res: any) => res.status(200).json([]),
    createInitiative: (_req: any, res: any) => res.status(201).json({}),
    bulkAssignInitiatives: (_req: any, res: any) => res.status(200).json({}),
    checkSimilarInitiatives: (_req: any, res: any) => res.status(200).json([]),
    validateCard: (_req: any, res: any) => res.status(200).json({}),
    getGateAiCheck: (_req: any, res: any) => res.status(200).json({}),
    getLinkedItems: (_req: any, res: any) => res.status(200).json([]),
    addLinkedItem: (_req: any, res: any) => res.status(200).json({}),
    removeLinkedItem: (_req: any, res: any) => res.status(200).json({}),
  },
}));

vi.mock('../../../server/src/validators/initiative.validators.js', () => ({
  CreateInitiativeSchema: {},
  QuickUpdateInitiativeSchema: {},
  UpdateInitiativeSchema: {},
  UpdateInitiativeStatusSchema: {},
  UpdateInitiativeTemplateSchema: {},
}));

vi.mock('../../../server/src/controllers/StaffingPlanController.js', () => ({
  StaffingPlanController: {
    listPlans: (_req: any, res: any) => res.status(200).json([]),
    createPlan: (_req: any, res: any) => res.status(201).json({}),
    getPlan: (_req: any, res: any) => res.status(200).json({}),
    updatePlan: (_req: any, res: any) => res.status(200).json({}),
    deletePlan: (_req: any, res: any) => res.status(200).json({}),
    addRole: (_req: any, res: any) => res.status(200).json({}),
    updateRole: (_req: any, res: any) => res.status(200).json({}),
    deleteRole: (_req: any, res: any) => res.status(200).json({}),
    getGaps: (_req: any, res: any) => res.status(200).json([]),
    syncCapacity: (_req: any, res: any) => res.status(200).json({}),
  },
}));

vi.mock('../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {
    generateSectionContent: (...args: unknown[]) => generateSectionMock(...args),
    suggestSections: (...args: unknown[]) => suggestSectionsMock(...args),
  },
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => queryAllMock(...args),
  queryOne: vi.fn(async () => null),
  queryRun: vi.fn(async () => ({ changes: 1 })),
}));

vi.mock('../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {
    getAllSectionTypes: vi.fn(async () => []),
    getSectionTypeById: vi.fn(async () => null),
    createSectionType: vi.fn(async () => ({})),
    updateSectionType: vi.fn(async () => ({})),
    deleteSectionType: vi.fn(async () => undefined),
    duplicateSectionType: vi.fn(async () => ({})),
  },
}));

vi.mock('../../../server/src/services/initiativeTemplateService.js', () => ({
  default: {
    getTemplates: vi.fn(async () => []),
    getTemplateById: vi.fn(async () => null),
    createTemplate: vi.fn(async () => ({})),
    updateTemplate: vi.fn(async () => ({})),
    deleteTemplate: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../server/src/services/blueprintService.js', () => ({
  default: {
    getWbsTree: vi.fn(async () => []),
    addWbsItem: vi.fn(async () => ({})),
    updateWbsItem: vi.fn(async () => ({})),
    deleteWbsItem: vi.fn(async () => true),
    reorderWbsItems: vi.fn(async () => undefined),
    validateBlueprint: vi.fn(async () => ({})),
    cloneBlueprint: vi.fn(async () => ({})),
    applyWbs: vi.fn(async () => ({ tasksCreated: 0 })),
    applyMilestoneDependencies: vi.fn(async () => ({ milestonesCreated: 0 })),
    applyRoleTemplates: vi.fn(async () => ({ rolesCreated: 0 })),
    applyDoDPerLevel: vi.fn(async () => ({ levelsApplied: 0 })),
  },
}));

vi.mock('../../../server/src/services/workloadCapacityService.js', () => ({
  getInitiativeCapacity: vi.fn(async () => ({})),
  getCapacityTimeline: vi.fn(async () => []),
}));

vi.mock('../../../server/src/services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn(async () => ({})),
}));

import initiativesRoutes from '../../../server/src/routes/pmo/initiatives.routes.ts';
import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';
import { errorHandlerMiddleware } from '../../../server/src/utils/ErrorHandler.js';

describe('pmo initiatives fail-closed contract', () => {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json());
  app.use('/api/pmo/initiatives', initiativesRoutes);
  app.use(errorHandlerMiddleware);

  beforeEach(() => {
    vi.clearAllMocks();
    queryAllMock.mockResolvedValue([]);
    generateSectionMock.mockResolvedValue({ content: 'ok' });
    suggestSectionsMock.mockResolvedValue([]);
  });

  it('returns coded 401 when pmo programs auth context is missing', async () => {
    const res = await request(app)
      .get('/api/pmo/initiatives/programs')
      .set('x-test-auth', 'none')
      .set('X-Correlation-ID', 'pack10s4-pmo-programs-unauthorized-1');

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('fail');
    expect(res.body.error.code).toBe('PMO_INITIATIVES_UNAUTHORIZED');
    expect(res.body.error.message).toBe('Authentication is required to access PMO initiatives.');
    expect(res.body.correlationId).toBe('pack10s4-pmo-programs-unauthorized-1');
  });

  it('returns coded 500 for pmo programs read failure without raw message leak', async () => {
    queryAllMock.mockRejectedValueOnce(new Error('PG_INTERNAL_SECRET_MESSAGE'));
    const res = await request(app)
      .get('/api/pmo/initiatives/programs')
      .set('X-Correlation-ID', 'pack10s4-pmo-programs-read-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('PMO_INITIATIVES_PROGRAMS_READ_FAILED');
    expect(res.body.error.message).toBe('Failed to fetch PMO programs.');
    expect(res.body.correlationId).toBe('pack10s4-pmo-programs-read-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('PG_INTERNAL_SECRET_MESSAGE');
  });

  it('returns coded 503 not-configured envelope for section generation service outage', async () => {
    const error = Object.assign(new Error('FEATURE_UNAVAILABLE_INTERNAL_SECRET'), {
      statusCode: 503,
      code: 'FEATURE_UNAVAILABLE',
    });
    generateSectionMock.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/pmo/initiatives/generate-section')
      .send({ sectionKey: 'context', initiativeName: 'Test' })
      .set('X-Correlation-ID', 'pack10s4-pmo-generate-not-configured-1');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('PMO_INITIATIVES_SERVICE_NOT_CONFIGURED');
    expect(res.body.error.message).toBe('PMO initiatives service is temporarily unavailable.');
    expect(res.body.correlationId).toBe('pack10s4-pmo-generate-not-configured-1');
    expect(JSON.stringify(res.body)).not.toContain('FEATURE_UNAVAILABLE_INTERNAL_SECRET');
  });

  it('returns coded 500 for suggest-sections failures with correlation parity', async () => {
    suggestSectionsMock.mockRejectedValueOnce(new Error('OPENAI_INTERNAL_RESPONSE_BODY'));

    const res = await request(app)
      .post('/api/pmo/initiatives/suggest-sections')
      .send({ initiativeName: 'Test Initiative' })
      .set('X-Correlation-ID', 'pack10s4-pmo-suggest-fail-1');

    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
    expect(res.body.error.code).toBe('PMO_INITIATIVES_SUGGEST_SECTIONS_FAILED');
    expect(res.body.error.message).toBe('Failed to suggest sections.');
    expect(res.body.correlationId).toBe('pack10s4-pmo-suggest-fail-1');
    expect(JSON.stringify(res.body)).not.toContain('OPENAI_INTERNAL_RESPONSE_BODY');
  });
});
