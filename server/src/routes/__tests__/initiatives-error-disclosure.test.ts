/**
 * M13 (Inicjatywy) — Error-response info-disclosure regression.
 *
 * A prior sweep found ~28 handlers in pmo/initiatives.routes.ts that echoed raw
 * `err.message` into 500 bodies (`{ error, message: err.message }`), leaking
 * DB/driver/schema internals to clients. They were routed through the
 * `failInitiative500` helper, which returns a GENERIC message + a STABLE code
 * and logs the real error server-side.
 *
 * This test forces a representative handler (POST /programs) down its error path
 * by making the underlying queryHelper reject with a DB-flavored error, then
 * asserts the 500 body:
 *   - preserves the legacy response SHAPE the FE expects (`{ error, message, code }`),
 *   - carries the generic message + stable code,
 *   - does NOT contain the raw DB/driver/schema text.
 *
 * Same mock harness as initiatives-crud.test.ts (queryHelpers mock, no real DB).
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mockQueryFirst = vi.fn();
const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

const ORG = 'org-err-1';
const UID = 'user-err-1';

const loggerError = vi.fn();

vi.mock('../../utils/Logger.js', () => ({
  default: {
    error: (...a: unknown[]) => loggerError(...a),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryFirst: (...a: unknown[]) => mockQueryFirst(...a),
  queryOne: (...a: unknown[]) => mockQueryFirst(...a),
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
  query: (...a: unknown[]) => mockQueryAll(...a),
  run: (...a: unknown[]) => mockQueryRun(...a),
  getTableColumns: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [] })) }),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

// ── Service mocks (only those imported at module load) ────────────────────────

vi.mock('../../services/AuditEventsService.js', () => ({
  default: { log: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/blueprintService.js', () => ({
  default: { apply: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../services/initiative/initiativeGovernanceGuard.js', () => ({
  requireInitiativeWriteAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/initiative/initiativeWizardService.js', () => ({
  createWizardSession: vi.fn().mockResolvedValue({ id: 'wizard-1' }),
  evaluateShortlistGateForSession: vi.fn().mockResolvedValue(null),
  generateCandidates: vi.fn().mockResolvedValue([]),
  getWizardSession: vi.fn().mockResolvedValue(null),
  listCandidates: vi.fn().mockResolvedValue([]),
  listWizardAuditEvents: vi.fn().mockResolvedValue([]),
  recordShortlistDraftsCreated: vi.fn().mockResolvedValue(undefined),
  recordShortlistGateBlocked: vi.fn().mockResolvedValue(undefined),
  triageCandidate: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/initiativeGenerationService.js', () => ({
  default: { generate: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/initiativeSectionTypeService.js', () => ({
  default: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../services/initiativeSimilarityService.js', () => ({
  checkSimilarInitiatives: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/initiativeTemplateService.js', () => ({
  default: { list: vi.fn().mockResolvedValue([]), get: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../services/workloadCapacityService.js', () => ({
  getCapacityTimeline: vi.fn().mockResolvedValue([]),
  getInitiativeCapacity: vi.fn().mockResolvedValue(null),
}));

// ── App setup ─────────────────────────────────────────────────────────────────

import initiativesRoutes from '../pmo/initiatives.routes.js';

let app: Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { id: UID, organizationId: ORG, role: 'admin' };
    next();
  });
  app.use('/api/initiatives', initiativesRoutes);
});

afterEach(() => {
  vi.clearAllMocks();
});

// The kind of internal text that MUST NOT reach the client.
const RAW_DB_ERROR =
  'error: column "secret_internal_col" of relation "programs" does not exist at line 42';

describe('M13 initiatives — error responses do not leak raw error text', () => {
  it('POST /programs 500 returns generic message + stable code, not raw DB text', async () => {
    // Force the create-program handler down its catch path.
    mockQueryRun.mockRejectedValueOnce(new Error(RAW_DB_ERROR));

    const res = await request(app)
      .post('/api/initiatives/programs')
      .send({ name: 'Valid Program Name' });

    expect(res.status).toBe(500);

    // Shape preserved: the legacy { error, message, code } keys the FE expects.
    expect(res.body).toHaveProperty('error', 'Failed to create program');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('code', 'PROGRAM_CREATE_FAILED');

    // Generic message — NOT the raw error.
    expect(res.body.message).toBe('An internal error occurred. Please try again later.');

    // No raw DB/driver/schema text anywhere in the serialized body.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('secret_internal_col');
    expect(serialized).not.toContain('relation "programs"');
    expect(serialized).not.toContain('does not exist');
    expect(serialized).not.toContain(RAW_DB_ERROR);

    // The real error is still captured server-side (logged), not discarded.
    expect(loggerError).toHaveBeenCalledTimes(1);
    const loggedArgs = loggerError.mock.calls[0];
    expect(JSON.stringify(loggedArgs)).toContain('PROGRAM_CREATE_FAILED');
    // The real Error object is passed to the logger so ops can see the cause.
    expect(loggedArgs.some((a: unknown) => a instanceof Error && a.message === RAW_DB_ERROR)).toBe(
      true
    );
  });
});
