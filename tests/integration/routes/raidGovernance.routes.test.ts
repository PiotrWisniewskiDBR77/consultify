/**
 * raidGovernance.routes — integration tests (M14/F8 + F6).
 *
 * Verifies the HTTP layer wires each endpoint to the right service with the
 * caller's org id, and enforces the org gate (401 when no org is attached).
 *
 * Strategy mirrors document-studio-error-envelope.routes.test.ts:
 *   - mock the auth middleware as a pass-through that attaches a configurable
 *     `req.user` (so we can simulate "no org" by clearing it), and
 *   - mock all three services so we assert on the org-scoped call args, not DB.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable user the mocked auth middleware attaches. `null` => no auth/org.
let currentUser: { id: string; organizationId: string | null; role: string } | null = {
  id: 'user-rg-1',
  organizationId: 'org-rg-A',
  role: 'CONSULTANT',
};

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (currentUser) req.user = currentUser;
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

// validateBody passthrough (we are not testing validation here).
vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

// vi.mock factories are hoisted above module-level consts, so the mock fns must
// be created inside vi.hoisted to be available when the factory runs.
const { raidMocks, pirMocks, championMocks, dbMocks } = vi.hoisted(() => ({
  raidMocks: {
    linkIssueToRisk: vi.fn(),
    materializeRiskToIssue: vi.fn(),
    assumptionSignals: vi.fn(() => [
      { raidId: 'a1', type: 'UNVALIDATED_ASSUMPTION_OVERDUE', title: 'A' },
    ]),
    issueSignals: vi.fn(() => [
      { raidId: 'i1', type: 'UNRESOLVED_ISSUE_OVERDUE', severity: 'HIGH' },
    ]),
  },
  pirMocks: {
    getPir: vi.fn(),
    createPir: vi.fn(),
    finalizePir: vi.fn(),
  },
  championMocks: {
    listChampions: vi.fn(),
    addChampion: vi.fn(),
    removeChampion: vi.fn(),
    coalitionCoverage: vi.fn((championCount: number, affectedPopulation: number) => ({
      coveragePct: affectedPopulation > 0 ? Math.round((championCount / affectedPopulation) * 1000) / 10 : 0,
      adequate: affectedPopulation > 0 && championCount / affectedPopulation >= 0.15,
    })),
  },
  dbMocks: {
    get: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/raidGovernanceService.js', () => raidMocks);
vi.mock('../../../server/src/services/pirService.js', () => pirMocks);
vi.mock('../../../server/src/services/changeChampionsService.js', () => championMocks);
vi.mock('../../../server/src/utils/DbPromise.js', () => dbMocks);

import raidGovernanceRoutes from '../../../server/src/routes/raidGovernance.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api', raidGovernanceRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: 'user-rg-1', organizationId: 'org-rg-A', role: 'CONSULTANT' };
});

describe('raidGovernance.routes — org-scoped wiring', () => {
  describe('F8 — RAID governance', () => {
    it('POST /raid/issues/:issueId/link/:riskId calls linkIssueToRisk with org + ids', async () => {
      raidMocks.linkIssueToRisk.mockResolvedValue({ success: true, linkedItems: ['risk-9'] });
      const res = await request(createApp()).post('/api/raid/issues/issue-7/link/risk-9');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, linkedItems: ['risk-9'] });
      expect(raidMocks.linkIssueToRisk).toHaveBeenCalledWith('org-rg-A', 'issue-7', 'risk-9');
    });

    it('POST link returns 404 when the service reports issue_not_found', async () => {
      raidMocks.linkIssueToRisk.mockResolvedValue({
        success: false,
        linkedItems: [],
        error: 'issue_not_found',
      });
      const res = await request(createApp()).post('/api/raid/issues/missing/link/risk-9');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('issue_not_found');
    });

    it('POST /raid/risks/:riskId/materialize calls materializeRiskToIssue org-scoped (201)', async () => {
      raidMocks.materializeRiskToIssue.mockResolvedValue({ success: true, issueId: 'new-issue-1' });
      const res = await request(createApp()).post('/api/raid/risks/risk-3/materialize');
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true, issueId: 'new-issue-1' });
      expect(raidMocks.materializeRiskToIssue).toHaveBeenCalledWith('org-rg-A', 'risk-3');
    });

    it('POST /raid/governance/signals runs pure analyzers and returns both signal sets', async () => {
      const res = await request(createApp())
        .post('/api/raid/governance/signals')
        .send({ assumptions: [{ id: 'a1' }], issues: [{ id: 'i1' }] });
      expect(res.status).toBe(200);
      expect(res.body.assumptionSignals).toHaveLength(1);
      expect(res.body.issueSignals).toHaveLength(1);
      expect(raidMocks.assumptionSignals).toHaveBeenCalledWith([{ id: 'a1' }], expect.any(Number));
      expect(raidMocks.issueSignals).toHaveBeenCalledWith([{ id: 'i1' }], expect.any(Number));
    });
  });

  describe('F8 — PIR', () => {
    it('GET /pir/:initiativeId lists reviews org-scoped', async () => {
      pirMocks.getPir.mockResolvedValue([{ id: 'pir-1' }]);
      const res = await request(createApp()).get('/api/pir/init-2');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(pirMocks.getPir).toHaveBeenCalledWith('org-rg-A', 'init-2');
    });

    it('POST /pir/:initiativeId creates a DRAFT review (201)', async () => {
      pirMocks.createPir.mockResolvedValue({ id: 'pir-new', status: 'DRAFT' });
      const res = await request(createApp())
        .post('/api/pir/init-2')
        .send({ title: 'Retro' });
      expect(res.status).toBe(201);
      expect(res.body.review.id).toBe('pir-new');
      expect(pirMocks.createPir).toHaveBeenCalledWith('org-rg-A', 'init-2', { title: 'Retro' });
    });

    it('POST /pir/:id/finalize stamps the reviewer and is org-scoped', async () => {
      pirMocks.finalizePir.mockResolvedValue({ id: 'pir-1', status: 'FINALIZED' });
      const res = await request(createApp()).post('/api/pir/pir-1/finalize');
      expect(res.status).toBe(200);
      expect(res.body.review.status).toBe('FINALIZED');
      expect(pirMocks.finalizePir).toHaveBeenCalledWith('org-rg-A', 'pir-1', 'user-rg-1');
    });

    it('POST /pir/:id/finalize returns 404 when nothing matched', async () => {
      pirMocks.finalizePir.mockResolvedValue(null);
      const res = await request(createApp()).post('/api/pir/missing/finalize');
      expect(res.status).toBe(404);
    });
  });

  describe('F6 — Change Champions', () => {
    it('GET /champions lists org-wide champions (no initiative filter)', async () => {
      championMocks.listChampions.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]);
      const res = await request(createApp()).get('/api/champions');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
      expect(championMocks.listChampions).toHaveBeenCalledWith('org-rg-A', undefined);
    });

    it('GET /champions?initiativeId= forwards the filter org-scoped', async () => {
      championMocks.listChampions.mockResolvedValue([{ id: 'c1' }]);
      const res = await request(createApp()).get('/api/champions?initiativeId=init-9');
      expect(res.status).toBe(200);
      expect(championMocks.listChampions).toHaveBeenCalledWith('org-rg-A', 'init-9');
    });

    it('GET /champions/coverage uses the caller-supplied affectedPopulation (no DB fallback)', async () => {
      championMocks.listChampions.mockResolvedValue([
        { id: 'c1', status: 'active' },
        { id: 'c2', status: 'active' },
        { id: 'c3', status: 'inactive' },
      ]);
      const res = await request(createApp()).get('/api/champions/coverage?affectedPopulation=20');
      expect(res.status).toBe(200);
      // only the 2 active champions count
      expect(res.body.championCount).toBe(2);
      expect(res.body.affectedPopulation).toBe(20);
      expect(championMocks.coalitionCoverage).toHaveBeenCalledWith(2, 20);
      expect(dbMocks.get).not.toHaveBeenCalled();
    });

    it('GET /champions/coverage falls back to active org user count when affectedPopulation omitted', async () => {
      championMocks.listChampions.mockResolvedValue([{ id: 'c1', status: 'active' }]);
      dbMocks.get.mockResolvedValue({ cnt: 12 });
      const res = await request(createApp()).get('/api/champions/coverage');
      expect(res.status).toBe(200);
      expect(res.body.affectedPopulation).toBe(12);
      expect(dbMocks.get).toHaveBeenCalledWith(expect.stringContaining('FROM users'), ['org-rg-A']);
      expect(championMocks.coalitionCoverage).toHaveBeenCalledWith(1, 12);
    });

    it('GET /champions/:initiativeId lists champions org-scoped', async () => {
      championMocks.listChampions.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      const res = await request(createApp()).get('/api/champions/init-5');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(championMocks.listChampions).toHaveBeenCalledWith('org-rg-A', 'init-5');
    });

    it('POST /champions adds a champion org-scoped (201)', async () => {
      championMocks.addChampion.mockResolvedValue('champ-id-1');
      const res = await request(createApp())
        .post('/api/champions')
        .send({ initiativeId: 'init-5', role: 'sponsor' });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe('champ-id-1');
      expect(championMocks.addChampion).toHaveBeenCalledWith('org-rg-A', {
        initiativeId: 'init-5',
        role: 'sponsor',
      });
    });

    it('DELETE /champions/:id removes a champion org-scoped', async () => {
      championMocks.removeChampion.mockResolvedValue(undefined);
      const res = await request(createApp()).delete('/api/champions/champ-9');
      expect(res.status).toBe(200);
      expect(championMocks.removeChampion).toHaveBeenCalledWith('org-rg-A', 'champ-9');
    });
  });

  describe('org gate', () => {
    it('401s every mutation when no org is attached', async () => {
      currentUser = { id: 'u', organizationId: null, role: 'CONSULTANT' };
      const app = createApp();

      const link = await request(app).post('/api/raid/issues/i/link/r');
      expect(link.status).toBe(401);
      expect(raidMocks.linkIssueToRisk).not.toHaveBeenCalled();

      const champions = await request(app).get('/api/champions/init-5');
      expect(champions.status).toBe(401);
      expect(championMocks.listChampions).not.toHaveBeenCalled();

      const championsOrgWide = await request(app).get('/api/champions');
      expect(championsOrgWide.status).toBe(401);

      const coverage = await request(app).get('/api/champions/coverage');
      expect(coverage.status).toBe(401);
      expect(championMocks.coalitionCoverage).not.toHaveBeenCalled();

      const pir = await request(app).post('/api/pir/init-2').send({});
      expect(pir.status).toBe(401);
      expect(pirMocks.createPir).not.toHaveBeenCalled();
    });
  });
});
