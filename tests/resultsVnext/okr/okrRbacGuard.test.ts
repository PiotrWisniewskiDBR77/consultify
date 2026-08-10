/** @vitest-environment node */

/**
 * OKR-E001 — RBAC guard coverage: a non-admin org member gets 403 on
 * EVERY write route.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §7: "this epic's
 * negative-path test is 'a non-admin org member gets 403 on every write
 * route' — not a visibility-leak test. Do not spend realDB-testing budget
 * on an ABAC-join test that doesn't apply here" (Decision P2/P4 — RBAC,
 * not ABAC, a genuine departure from every prior resultsVnext epic).
 *
 * Uses the REAL `requireOrgRole`/`requireOrgAccess` middleware (unlike
 * `okr.routes.test.ts`, which mocks RBAC to a passthrough so it can focus
 * on error->HTTP mapping) — only `verifyToken`/`demoContextMiddleware`/
 * `apiAuthRateLimiter` are mocked, plus the domain command layer (so a bug
 * that let a request through would be caught by "mock not called"
 * assertions rather than silently succeeding against nothing).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateProgram = vi.fn();
const mockEditProgramDraft = vi.fn();
const mockPublishProgram = vi.fn();
const mockCreateCycle = vi.fn();
const mockRunOkrCycleLifecycleTransition = vi.fn();
const mockGetProgram = vi.fn();
const mockGetCycle = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    // Canonical non-admin role — `toCanonicalRole('member')` maps to
    // 'user' in rbac.middleware.ts, which `roleSatisfies` ranks below
    // 'admin'/'superadmin'.
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'member' };
    next();
  },
}));
vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js')>();
  return {
    ...actual,
    createProgram: (...args: unknown[]) => mockCreateProgram(...args),
    editProgramDraft: (...args: unknown[]) => mockEditProgramDraft(...args),
    publishProgram: (...args: unknown[]) => mockPublishProgram(...args),
  };
});

vi.mock('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js')>();
  return {
    ...actual,
    createCycle: (...args: unknown[]) => mockCreateCycle(...args),
    runOkrCycleLifecycleTransition: (...args: unknown[]) => mockRunOkrCycleLifecycleTransition(...args),
  };
});

vi.mock('../../../server/src/services/resultsVnext/okr/okrRepository.js', () => ({
  getProgram: (...args: unknown[]) => mockGetProgram(...args),
  getCycle: (...args: unknown[]) => mockGetCycle(...args),
  listPrograms: vi.fn(),
  listCycles: vi.fn(),
}));

const okrRoutes = (await import('../../../server/src/routes/resultsVnext/okr.routes.js')).default;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/vnext/results/okr', okrRoutes);
  return app;
}

const PROGRAM_ID = '11111111-1111-4111-8111-111111111111';
const CYCLE_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  // A found program/cycle so a bug that skipped RBAC would proceed far
  // enough to reach the mocked command (and get caught by the "not
  // called" assertion) instead of masking the bug behind an early 404.
  mockGetProgram.mockResolvedValue({ programId: PROGRAM_ID, rowVersion: 1 });
  mockGetCycle.mockResolvedValue({ cycleId: CYCLE_ID, rowVersion: 1 });
});

interface WriteRouteCase {
  label: string;
  method: 'post' | 'patch';
  path: string;
  body: Record<string, unknown>;
  mock: ReturnType<typeof vi.fn>;
}

const WRITE_ROUTES: WriteRouteCase[] = [
  { label: 'createProgram', method: 'post', path: '/api/vnext/results/okr/programs', body: { name: 'x' }, mock: mockCreateProgram },
  {
    label: 'editProgramDraft',
    method: 'patch',
    path: `/api/vnext/results/okr/programs/${PROGRAM_ID}/draft`,
    body: { expectedVersion: 1, name: 'x' },
    mock: mockEditProgramDraft,
  },
  {
    label: 'publishProgram',
    method: 'post',
    path: `/api/vnext/results/okr/programs/${PROGRAM_ID}/publish`,
    body: { expectedVersion: 1 },
    mock: mockPublishProgram,
  },
  {
    label: 'createCycle',
    method: 'post',
    path: '/api/vnext/results/okr/cycles',
    body: {
      programId: PROGRAM_ID,
      name: 'x',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      draftOpenAt: '2025-12-15T00:00:00.000Z',
      submissionDueAt: '2025-12-28T00:00:00.000Z',
      activeStartAt: '2026-01-01T00:00:00.000Z',
      finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
      reviewOpenAt: '2026-03-21T00:00:00.000Z',
      reflectionDueAt: '2026-03-25T00:00:00.000Z',
      closeAt: '2026-03-31T00:00:00.000Z',
    },
    mock: mockCreateCycle,
  },
  {
    label: 'open-drafting',
    method: 'post',
    path: `/api/vnext/results/okr/cycles/${CYCLE_ID}/open-drafting`,
    body: { expectedVersion: 1 },
    mock: mockRunOkrCycleLifecycleTransition,
  },
  {
    label: 'activate',
    method: 'post',
    path: `/api/vnext/results/okr/cycles/${CYCLE_ID}/activate`,
    body: { expectedVersion: 1 },
    mock: mockRunOkrCycleLifecycleTransition,
  },
  {
    label: 'open-review',
    method: 'post',
    path: `/api/vnext/results/okr/cycles/${CYCLE_ID}/open-review`,
    body: { expectedVersion: 1 },
    mock: mockRunOkrCycleLifecycleTransition,
  },
  {
    label: 'close',
    method: 'post',
    path: `/api/vnext/results/okr/cycles/${CYCLE_ID}/close`,
    body: { expectedVersion: 1 },
    mock: mockRunOkrCycleLifecycleTransition,
  },
  {
    label: 'cancel',
    method: 'post',
    path: `/api/vnext/results/okr/cycles/${CYCLE_ID}/cancel`,
    body: { expectedVersion: 1 },
    mock: mockRunOkrCycleLifecycleTransition,
  },
];

describe('OKR-E001 RBAC guard — non-admin (role: member) gets 403 on every write route', () => {
  it(`covers exactly the epic's 9 write routes`, () => {
    // Sanity check on the test's own completeness — 9 writes per design
    // §8's table (createProgram/editProgramDraft/publishProgram/
    // createCycle/5 transitions).
    expect(WRITE_ROUTES).toHaveLength(9);
  });

  for (const routeCase of WRITE_ROUTES) {
    it(`${routeCase.label}: 403s for a non-admin org member, command never called`, async () => {
      const response = await request(createApp())[routeCase.method](routeCase.path).send(routeCase.body);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('RBAC_INSUFFICIENT_ROLE');
      expect(routeCase.mock).not.toHaveBeenCalled();
    });
  }

  it('GET routes remain accessible to a non-admin org member (requireOrgAccess only, no requireOrgRole)', async () => {
    mockGetProgram.mockResolvedValue({ programId: PROGRAM_ID, rowVersion: 1 });
    const response = await request(createApp()).get(`/api/vnext/results/okr/programs/${PROGRAM_ID}`);
    expect(response.status).toBe(200);
  });
});
