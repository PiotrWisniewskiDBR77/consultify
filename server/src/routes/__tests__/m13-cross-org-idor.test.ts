/**
 * M13 (Inicjatywy) — adversarial cross-org IDOR contract tests.
 *
 * Covers the cross-org holes found in the M13 security sweep:
 *   - section-types GET/PUT/DELETE/duplicate → foreign-org private type 404,
 *     system type immutable (403); the service never org-checks by itself.
 *   - blueprint WBS sub-routes (read tree, add/update/delete/reorder, validate,
 *     clone) → foreign-org template 404, system template write 403. The
 *     blueprint_wbs_items table is keyed only by template_id (no org column), so
 *     the route MUST verify the parent template's ownership.
 *   - initiativeGovernanceService.linkDecisionToInitiative → 404 when the linked
 *     decision belongs to a different org.
 *
 * DB, auth and validation are mocked — no real network/DB.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns ───────────────────────────────────────────────────────
const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

const getTemplateById = vi.fn();
const updateSectionType = vi.fn();
const deleteSectionType = vi.fn();
const getSectionTypeById = vi.fn();
const duplicateSectionType = vi.fn();
const getWbsTree = vi.fn();
const addWbsItem = vi.fn();
const updateWbsItem = vi.fn();
const deleteWbsItem = vi.fn();
const reorderWbsItems = vi.fn();
const validateBlueprint = vi.fn();
const cloneBlueprint = vi.fn();

const ORG_A = 'aaa00000-0000-4000-8000-000000000001';
const ORG_B = 'bbb00000-0000-4000-8000-000000000002';
const USER_A = 'user-a-111';

let mockUser: { id: string; role: string; organizationId: string } | null = null;

// ── Middleware mocks ─────────────────────────────────────────────────────────
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/effectiveCapability.middleware.js', () => ({
  requireInitiativeCapability: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (req: any, res: any, next: () => void) => {
    if (!req.user) return res.status(401).json({ error: 'No token' });
    next();
  },
  requireOrgRole: () => (req: any, res: any, next: () => void) => {
    if (!req.user) return res.status(401).json({ error: 'No token' });
    next();
  },
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryFirst: (...a: unknown[]) => mockQueryFirst(...a),
  queryOne: (...a: unknown[]) => mockQueryFirst(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  query: (...a: unknown[]) => mockQueryAll(...a),
  run: (...a: unknown[]) => mockQueryRun(...a),
}));

// ── Leaf service mocks the M13 routes call ───────────────────────────────────
vi.mock('../../services/initiativeTemplateService.js', () => ({
  default: { getTemplateById: (...a: unknown[]) => getTemplateById(...a) },
}));

vi.mock('../../services/initiativeSectionTypeService.js', () => ({
  default: {
    getSectionTypeById: (...a: unknown[]) => getSectionTypeById(...a),
    updateSectionType: (...a: unknown[]) => updateSectionType(...a),
    deleteSectionType: (...a: unknown[]) => deleteSectionType(...a),
    duplicateSectionType: (...a: unknown[]) => duplicateSectionType(...a),
    getAllSectionTypes: vi.fn().mockResolvedValue([]),
    createSectionType: vi.fn(),
  },
}));

vi.mock('../../services/blueprintService.js', () => ({
  default: {
    getWbsTree: (...a: unknown[]) => getWbsTree(...a),
    addWbsItem: (...a: unknown[]) => addWbsItem(...a),
    updateWbsItem: (...a: unknown[]) => updateWbsItem(...a),
    deleteWbsItem: (...a: unknown[]) => deleteWbsItem(...a),
    reorderWbsItems: (...a: unknown[]) => reorderWbsItems(...a),
    validateBlueprint: (...a: unknown[]) => validateBlueprint(...a),
    cloneBlueprint: (...a: unknown[]) => cloneBlueprint(...a),
  },
}));

// ── Heavy collaborators we never exercise (import-time satisfaction only) ─────
vi.mock('../../controllers/InitiativeController.js', () => ({
  default: new Proxy({}, { get: () => (_req: any, _res: any) => {} }),
}));
vi.mock('../../controllers/StaffingPlanController.js', () => ({
  StaffingPlanController: new Proxy({}, { get: () => (_req: any, _res: any) => {} }),
  default: {},
}));
vi.mock('../../services/AuditEventsService.js', () => ({ default: { log: vi.fn() } }));
vi.mock('../../services/initiative/initiativeGovernanceGuard.js', () => ({
  requireInitiativeWriteAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn(),
}));
vi.mock('../../services/initiative/initiativeWizardService.js', () => ({
  createWizardSession: vi.fn(),
  evaluateShortlistGateForSession: vi.fn(),
  generateCandidates: vi.fn(),
  getWizardSession: vi.fn(),
  listCandidates: vi.fn(),
  listWizardAuditEvents: vi.fn(),
  recordShortlistDraftsCreated: vi.fn(),
  recordShortlistGateBlocked: vi.fn(),
  triageCandidate: vi.fn(),
}));
vi.mock('../../services/initiativeGenerationService.js', () => ({ default: {} }));
vi.mock('../../services/initiativeSimilarityService.js', () => ({
  checkSimilarInitiatives: vi.fn(),
}));
vi.mock('../../services/workloadCapacityService.js', () => ({
  getCapacityTimeline: vi.fn(),
  getInitiativeCapacity: vi.fn(),
}));

async function buildPmoApp(): Promise<Express> {
  const mod = await import('../pmo/initiatives.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', mod.default);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A };
  mockQueryFirst.mockResolvedValue(null);
  mockQueryAll.mockResolvedValue([]);
  mockQueryRun.mockResolvedValue({ rowCount: 0, changes: 0 });
});

// ═══════════════════════════════════════════════════════════════════════════
// M13 — section-types are org-scoped (service does not check org itself)
// ═══════════════════════════════════════════════════════════════════════════

describe('M13 — initiative section-types reject cross-org access', () => {
  it('GET /section-types/:id → 404 for a foreign-org private type (no leak)', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-b', isSystem: false, organizationId: ORG_B });
    const app = await buildPmoApp();
    const res = await request(app).get('/api/initiatives/section-types/s-b');
    expect(res.status).toBe(404);
  });

  it('GET /section-types/:id → 200 for a system (public) type', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-sys', isSystem: true, organizationId: null });
    const app = await buildPmoApp();
    const res = await request(app).get('/api/initiatives/section-types/s-sys');
    expect(res.status).toBe(200);
  });

  it('PUT /section-types/:id → 404 for a foreign-org type, never updates', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-b', isSystem: false, organizationId: ORG_B });
    const app = await buildPmoApp();
    const res = await request(app).put('/api/initiatives/section-types/s-b').send({ name: 'pwn' });
    expect(res.status).toBe(404);
    expect(updateSectionType).not.toHaveBeenCalled();
  });

  it('PUT /section-types/:id → 403 for a system type (immutable)', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-sys', isSystem: true, organizationId: null });
    const app = await buildPmoApp();
    const res = await request(app).put('/api/initiatives/section-types/s-sys').send({ name: 'x' });
    expect(res.status).toBe(403);
    expect(updateSectionType).not.toHaveBeenCalled();
  });

  it('PUT /section-types/:id → 200 for own-org type', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-a', isSystem: false, organizationId: ORG_A });
    updateSectionType.mockResolvedValue({ id: 's-a', name: 'ok' });
    const app = await buildPmoApp();
    const res = await request(app).put('/api/initiatives/section-types/s-a').send({ name: 'ok' });
    expect(res.status).toBe(200);
    expect(updateSectionType).toHaveBeenCalledWith('s-a', { name: 'ok' });
  });

  it('DELETE /section-types/:id → 404 for a foreign-org type, never deletes', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-b', isSystem: false, organizationId: ORG_B });
    const app = await buildPmoApp();
    const res = await request(app).delete('/api/initiatives/section-types/s-b');
    expect(res.status).toBe(404);
    expect(deleteSectionType).not.toHaveBeenCalled();
  });

  it('POST /section-types/:id/duplicate → 404 for a foreign-org source', async () => {
    getSectionTypeById.mockResolvedValue({ id: 's-b', isSystem: false, organizationId: ORG_B });
    const app = await buildPmoApp();
    const res = await request(app).post('/api/initiatives/section-types/s-b/duplicate').send({});
    expect(res.status).toBe(404);
    expect(duplicateSectionType).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M13 — blueprint WBS sub-routes verify parent template ownership
// (blueprint_wbs_items has no organization_id; org boundary is the template)
// ═══════════════════════════════════════════════════════════════════════════

describe('M13 — blueprint WBS rejects cross-org template access', () => {
  const FOREIGN = { id: 't-b', isPublic: false, organizationId: ORG_B };
  const SYSTEM = { id: 't-sys', isPublic: true, organizationId: null };
  const OWN = { id: 't-a', isPublic: false, organizationId: ORG_A };

  it('GET /templates/:id/wbs → 404 for a foreign-org template, never reads WBS', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app).get('/api/initiatives/templates/t-b/wbs');
    expect(res.status).toBe(404);
    expect(getWbsTree).not.toHaveBeenCalled();
  });

  it('POST /templates/:id/wbs → 404 for a foreign-org template, never adds', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app)
      .post('/api/initiatives/templates/t-b/wbs')
      .send({ title: 'cross-org item' });
    expect(res.status).toBe(404);
    expect(addWbsItem).not.toHaveBeenCalled();
  });

  it('POST /templates/:id/wbs → 403 on a system template (immutable), never adds', async () => {
    getTemplateById.mockResolvedValue(SYSTEM);
    const app = await buildPmoApp();
    const res = await request(app)
      .post('/api/initiatives/templates/t-sys/wbs')
      .send({ title: 'x' });
    expect(res.status).toBe(403);
    expect(addWbsItem).not.toHaveBeenCalled();
  });

  it('PUT /templates/:id/wbs/:itemId → 404 for a foreign-org template', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app)
      .put('/api/initiatives/templates/t-b/wbs/item-1')
      .send({ title: 'x' });
    expect(res.status).toBe(404);
    expect(updateWbsItem).not.toHaveBeenCalled();
  });

  it('DELETE /templates/:id/wbs/:itemId → 404 for a foreign-org template', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app).delete('/api/initiatives/templates/t-b/wbs/item-1');
    expect(res.status).toBe(404);
    expect(deleteWbsItem).not.toHaveBeenCalled();
  });

  it('POST /templates/:id/wbs/reorder → 404 for a foreign-org template', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app)
      .post('/api/initiatives/templates/t-b/wbs/reorder')
      .send({ items: [] });
    expect(res.status).toBe(404);
    expect(reorderWbsItems).not.toHaveBeenCalled();
  });

  it('GET /templates/:id/validate → 404 for a foreign-org template', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app).get('/api/initiatives/templates/t-b/validate');
    expect(res.status).toBe(404);
    expect(validateBlueprint).not.toHaveBeenCalled();
  });

  it('POST /templates/:id/clone → 404 for a foreign-org private source', async () => {
    getTemplateById.mockResolvedValue(FOREIGN);
    const app = await buildPmoApp();
    const res = await request(app).post('/api/initiatives/templates/t-b/clone').send({});
    expect(res.status).toBe(404);
    expect(cloneBlueprint).not.toHaveBeenCalled();
  });

  it('GET /templates/:id/wbs → 200 for own-org template', async () => {
    getTemplateById.mockResolvedValue(OWN);
    getWbsTree.mockResolvedValue([]);
    const app = await buildPmoApp();
    const res = await request(app).get('/api/initiatives/templates/t-a/wbs');
    expect(res.status).toBe(200);
    expect(getWbsTree).toHaveBeenCalledWith('t-a');
  });

  it('POST /templates/:id/clone → 201 cloning a SYSTEM template into own org', async () => {
    getTemplateById.mockResolvedValue(SYSTEM);
    cloneBlueprint.mockResolvedValue({ id: 't-new' });
    const app = await buildPmoApp();
    const res = await request(app).post('/api/initiatives/templates/t-sys/clone').send({});
    expect(res.status).toBe(201);
    expect(cloneBlueprint).toHaveBeenCalledWith('t-sys', ORG_A, USER_A);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// M13 — governance service: a linked decision must belong to the caller's org
// ═══════════════════════════════════════════════════════════════════════════

describe('M13 — linkDecisionToInitiative rejects a foreign-org decision', () => {
  it('throws 404 when the decision is not in the caller org', async () => {
    // initiative lookup (org-scoped) succeeds, decision lookup (org-scoped) fails.
    mockQueryFirst.mockResolvedValueOnce({ id: 'init-a' }).mockResolvedValueOnce(null);
    const { initiativeGovernanceService } =
      await import('../../services/initiativeGovernanceService.js');
    await expect(
      initiativeGovernanceService.linkDecisionToInitiative(ORG_A, 'init-a', 'dec-from-org-b')
    ).rejects.toMatchObject({ status: 404 });
    // The decision lookup that ran was org-scoped.
    const decLookup = mockQueryFirst.mock.calls.find((c) =>
      /FROM decisions WHERE id=\$1 AND organization_id=\$2/i.test(String(c?.[0]))
    );
    expect(decLookup).toBeTruthy();
    expect(decLookup?.[1]).toEqual(['dec-from-org-b', ORG_A]);
    // No link row was inserted.
    expect(mockQueryRun).not.toHaveBeenCalled();
  });
});
