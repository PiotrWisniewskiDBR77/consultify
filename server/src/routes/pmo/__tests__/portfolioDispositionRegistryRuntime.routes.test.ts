/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const organizationId = 'org-parking';
const actorId = 'actor-parking';

/**
 * A2 (DEC-498 §1): odrzucona inicjatywa ma trafiac na PARKING z powodem i
 * warunkiem ponownej propozycji, a lista parkingu ma byc do obejrzenia.
 * Dyspozycja jest juz utrwalana w `ie_aggregate_state` (agregat decyzji), wiec
 * rejestr czyta istniejacy zapis — bez nowej migracji.
 */
describe('Rejestr dyspozycji portfela (parking / archiwum)', () => {
  const listPortfolioDispositions = vi.fn();
  const authorize = vi.fn();
  const reader = {
    findPortfolioScenario: vi.fn(),
    findById: vi.fn(),
    listPortfolioDispositions,
  };

  const app = () => {
    const api = express();
    api.use(express.json());
    api.use((req, _res, next) => {
      (req as unknown as { user: unknown }).user = { id: actorId, organizationId, role: 'PMO' };
      next();
    });
    api.use(
      '/api/initiatives/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: { transaction: vi.fn() },
        reader,
        authorize,
        resolvePolicy: vi.fn(),
        portfolioAnalysis: {
          buildSnapshot: vi.fn(),
          reader: { find: vi.fn() },
          contextReader: { findGovernedSnapshot: vi.fn() },
          gateway: { analyze: vi.fn() },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    );
    return api;
  };

  const parked = {
    decisionId: 'decision-parked',
    initiativeId: 'initiative-parked',
    kind: 'PARKING' as const,
    reason: 'Overlaps work already running.',
    returnCondition: 'Returns when the running work closes.',
    actorId,
    decidedAt: '2026-09-14T08:00:00.000Z',
    analysisId: 'analysis-1',
    projectId: 'project-a',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS = 'true';
    authorize.mockResolvedValue(true);
    listPortfolioDispositions.mockResolvedValue([parked]);
  });
  afterEach(() => {
    delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
  });

  it('zwraca liste parkingu z powodem i warunkiem ponownej propozycji', async () => {
    const response = await request(app())
      .get('/api/initiatives/runtime-v1/portfolio-dispositions?kind=PARKING')
      .expect(200);
    expect(response.body.dispositions).toEqual([parked]);
    expect(listPortfolioDispositions).toHaveBeenCalledWith(organizationId, ['PARKING']);
  });

  it('domyslnie czyta parking i archiwum razem', async () => {
    await request(app()).get('/api/initiatives/runtime-v1/portfolio-dispositions').expect(200);
    expect(listPortfolioDispositions).toHaveBeenCalledWith(organizationId, ['PARKING', 'ARCHIVE']);
  });

  it('odrzuca nieznana dyspozycje zamiast ja po cichu ignorowac', async () => {
    await request(app())
      .get('/api/initiatives/runtime-v1/portfolio-dispositions?kind=WHATEVER')
      .expect(400);
    expect(listPortfolioDispositions).not.toHaveBeenCalled();
  });

  it('bez flagi serwerowej trasa nie istnieje (parytet z linia przy OFF)', async () => {
    delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
    await request(app()).get('/api/initiatives/runtime-v1/portfolio-dispositions').expect(404);
    expect(listPortfolioDispositions).not.toHaveBeenCalled();
  });

  it('bez aktora zwraca 401 i nic nie czyta', async () => {
    const api = express();
    api.use(express.json());
    api.use(
      '/api/initiatives/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: { transaction: vi.fn() },
        reader,
        authorize,
        resolvePolicy: vi.fn(),
        portfolioAnalysis: {
          buildSnapshot: vi.fn(),
          reader: { find: vi.fn() },
          contextReader: { findGovernedSnapshot: vi.fn() },
          gateway: { analyze: vi.fn() },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    );
    await request(api).get('/api/initiatives/runtime-v1/portfolio-dispositions').expect(401);
    expect(listPortfolioDispositions).not.toHaveBeenCalled();
  });
});
