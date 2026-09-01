/** @vitest-environment node */

/**
 * Day 17 instruction §O.2 — `GET /sets/:setId/check-in-summary` HTTP
 * contract, against the REAL `okr.routes.ts` router (only the repository
 * layer and middleware are mocked — same minimal-mock pattern
 * `kpiDay17.routes.test.ts` uses for K.2/K.3, deliberately narrower than
 * the full-router `okr.routes.test.ts` file: this file owns exactly the
 * one new route, not a re-verification of every existing one).
 *
 * Covers: 200 with the summary shape on a visible Set; 404 (never a `200`
 * with an empty aggregate) on an invisible/foreign-tenant Set, proving the
 * route checks visibility via `getOkrSet` BEFORE calling the read-model.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOkrSet = vi.fn();
const getSetCheckInSummary = vi.fn();

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    next();
  },
}));
vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrgRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: () => void) =>
      next(),
}));
vi.mock('../../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../middleware/resultsInternalBetaVisibility.middleware.js', () => ({
  requireResultsInternalBetaVisibility: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: vi.fn(async () => ({ capabilities: ['*'] })),
  hasEffectiveCapability: () => true,
}));
vi.mock('../../../services/resultsVnext/okr/okrSetRepository.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../services/resultsVnext/okr/okrSetRepository.js')>();
  return { ...actual, getOkrSet: (...args: unknown[]) => getOkrSet(...args) };
});
vi.mock('../../../services/resultsVnext/okr/okrCheckInSummaryRepository.js', () => ({
  getSetCheckInSummary: (...args: unknown[]) => getSetCheckInSummary(...args),
}));

const router = (await import('../okr.routes.js')).default;
const SET_ID = '22222222-2222-4222-8222-222222222222';

function app() {
  const value = express();
  value.use(express.json());
  value.use('/api/vnext/results/okr', router);
  return value;
}

describe('Day 17 §O.2 — GET /sets/:setId/check-in-summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the check-in summary contract for a visible Set', async () => {
    getOkrSet.mockResolvedValue({ setId: SET_ID, organizationId: 'org-1' });
    getSetCheckInSummary.mockResolvedValue({
      setId: SET_ID,
      keyResults: [
        {
          keyResultId: 'kr-1',
          objectiveId: 'obj-1',
          lastCheckIn: {
            checkInId: 'chk-1',
            recordedAt: '2026-01-05T00:00:00.000Z',
            confidence: 'high',
          },
          nextExpectedAt: null,
          staleness: 'CURRENT',
          stalenessReason: null,
        },
        {
          keyResultId: 'kr-2',
          objectiveId: 'obj-1',
          lastCheckIn: null,
          nextExpectedAt: null,
          staleness: 'OVERDUE',
          stalenessReason: 'NO_CHECKIN_YET',
        },
      ],
      rollup: {
        total: 2,
        withCheckIn: 1,
        overdue: 1,
        neverCheckedIn: 1,
        oldestCheckInAt: '2026-01-05T00:00:00.000Z',
        newestCheckInAt: '2026-01-05T00:00:00.000Z',
      },
      calculatedAt: '2026-01-06T00:00:00.000Z',
    });

    const response = await request(app()).get(
      `/api/vnext/results/okr/sets/${SET_ID}/check-in-summary`
    );

    expect(response.status).toBe(200);
    expect(response.body.setId).toBe(SET_ID);
    expect(response.body.keyResults).toHaveLength(2);
    expect(response.body.keyResults[0]).toMatchObject({ staleness: 'CURRENT' });
    expect(response.body.keyResults[1]).toMatchObject({
      staleness: 'OVERDUE',
      stalenessReason: 'NO_CHECKIN_YET',
    });
    expect(response.body.rollup).toMatchObject({
      total: 2,
      withCheckIn: 1,
      overdue: 1,
      neverCheckedIn: 1,
    });
    expect(getOkrSet).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', setId: SET_ID })
    );
    expect(getSetCheckInSummary).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', setId: SET_ID })
    );
  });

  it('returns 404 instead of an empty aggregate for an invisible/foreign-tenant Set', async () => {
    getOkrSet.mockResolvedValue(null);

    const response = await request(app()).get(
      `/api/vnext/results/okr/sets/${SET_ID}/check-in-summary`
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    // Visibility is checked BEFORE the aggregate is computed — the
    // read-model must never even be asked for a Set the caller cannot see.
    expect(getSetCheckInSummary).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID setId at the param-validation layer, before touching the repository', async () => {
    const response = await request(app()).get(
      '/api/vnext/results/okr/sets/not-a-uuid/check-in-summary'
    );

    expect(response.status).toBe(400);
    expect(getOkrSet).not.toHaveBeenCalled();
    expect(getSetCheckInSummary).not.toHaveBeenCalled();
  });
});
