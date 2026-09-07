/**
 * [ODMROZENIE 05_INITIATIVES DEC-421] P15-K7 pkt 2 — TRYB „wg obciążenia ról"
 * BEZ CICHEJ DEGRADACJI + P15-K6 przewód podpowiedzi przesunięcia.
 *
 * POMIAR 07.09 (`initiativesExecutionRuntime.routes.ts`, trasa
 * `/plan-scenarios/:id/analysis-proposals`): trasa szukała opublikowanej analizy
 * o `planRef.scenarioVersion === plan.scenarioVersion`, a gdy jej nie było,
 * wołała solver BEZ mocy i zwracała 201. Użytkownik prosił o tryb „wg obciążenia
 * ról", dostawał plan ułożony wyłącznie z zależności i ani jednego słowa o tym.
 *
 * MUTACJE (dowód RED — zakładane ręcznie i cofane, `evidence/p15-k67/mutacje.txt`):
 *  (d) przywrócenie cichej degradacji: usunięcie bloku `if (… && !linkedCapacity)`
 *      z trasy → test „400 z regułą" pada (dostaje 201);
 *  (a) `hints: parsed.data.hints` → `hints: undefined` w ładunku komendy →
 *      test „podpowiedź dociera do komendy" pada.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPlanAnalysisProposalMock } = vi.hoisted(() => ({
  createPlanAnalysisProposalMock: vi.fn(),
}));

vi.mock('../../../server/src/domain/initiatives-execution/planAnalysisProposal.js', () => ({
  createPlanAnalysisProposal: createPlanAnalysisProposalMock,
  reviewPlanAnalysisProposal: vi.fn(),
}));

import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const PLAN_ID = 'plan-k67';
const CAPACITY_ID = 'analiza-k67';

function buildApp(capacityScenarios: unknown[]): Express {
  const reader = {
    findPlanScenario: vi.fn(async () => ({
      version: 4,
      scenario: {
        scenarioId: PLAN_ID,
        scenarioVersion: 3,
        status: 'DRAFT',
        portfolioScenarioId: 'portfolio-1',
      },
    })),
    findPortfolioScenario: vi.fn(async () => ({
      scenario: { scope: { portfolioId: 'portfolio-1' } },
    })),
    listCapacityScenarios: vi.fn(async () => capacityScenarios),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: Record<string, unknown> }).user = {
      id: 'user-1',
      organizationId: 'org-1',
      role: 'ADMIN',
    };
    next();
  });
  app.use(
    '/',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as never,
      reader: reader as never,
      authorize: vi.fn(async () => true),
      resolvePolicy: vi.fn(async () => ({ policyId: 'p', version: 1 })),
    } as never)
  );
  return app;
}

const body = (extra: Record<string, unknown> = {}) => ({
  expectedVersion: 0,
  clientRequestId: 'req-1',
  scenarioId: PLAN_ID,
  inputAggregateVersion: 4,
  useCapacity: true,
  ...extra,
});

/** Analiza opublikowana dla POPRZEDNIEJ wersji planu — tak wygląda świat po K6. */
const publishedForVersion = (scenarioVersion: number) => ({
  id: CAPACITY_ID,
  state: 'PUBLISHED',
  planRef: { scenarioId: PLAN_ID, scenarioVersion },
});

describe('P15-K7 — tryb wg obciążenia ról nie degraduje po cichu', () => {
  beforeEach(() => {
    createPlanAnalysisProposalMock.mockReset();
    createPlanAnalysisProposalMock.mockResolvedValue({ status: 'APPLIED', response: {} });
  });

  it('(d) bez opublikowanej analizy odmawia regułą CAPACITY_SCENARIO_REQUIRED, nie układa planu bez mocy', async () => {
    const response = await request(buildApp([]))
      .post(`/plan-scenarios/${PLAN_ID}/analysis-proposals/prop-1`)
      .send(body())
      .expect(400);

    expect(response.body.error.rule).toBe('CAPACITY_SCENARIO_REQUIRED');
    expect(createPlanAnalysisProposalMock).not.toHaveBeenCalled();
  });

  it('szkic analizy (nieopublikowany) też nie wystarcza — to nadal odmowa, nie degradacja', async () => {
    const draftOnly = [
      { id: CAPACITY_ID, state: 'DRAFT', planRef: { scenarioId: PLAN_ID, scenarioVersion: 3 } },
    ];
    const response = await request(buildApp(draftOnly))
      .post(`/plan-scenarios/${PLAN_ID}/analysis-proposals/prop-2`)
      .send(body())
      .expect(400);

    expect(response.body.error.rule).toBe('CAPACITY_SCENARIO_REQUIRED');
  });

  it('tryb „wg zależności" (useCapacity=false) działa bez analizy — blokada dotyczy tylko mocy', async () => {
    await request(buildApp([]))
      .post(`/plan-scenarios/${PLAN_ID}/analysis-proposals/prop-3`)
      .send(body({ useCapacity: false }))
      .expect(201);

    expect(createPlanAnalysisProposalMock).toHaveBeenCalledTimes(1);
    expect(createPlanAnalysisProposalMock.mock.calls[0][1].payload.capacityScenarioId).toBeUndefined();
  });

  it('(a) wskazana wprost analiza i PODPOWIEDŹ przesunięcia docierają do komendy (przewód K6)', async () => {
    await request(buildApp([publishedForVersion(2)]))
      .post(`/plan-scenarios/${PLAN_ID}/analysis-proposals/prop-4`)
      .send(
        body({
          capacityScenarioId: CAPACITY_ID,
          hints: [{ initiativeId: 'ini-1', shiftPeriods: 2 }],
        })
      )
      .expect(201);

    const payload = createPlanAnalysisProposalMock.mock.calls[0][1].payload;
    expect(payload.capacityScenarioId).toBe(CAPACITY_ID);
    expect(payload.hints).toEqual([{ initiativeId: 'ini-1', shiftPeriods: 2 }]);
  });

  it('analiza wskazana wprost, ale nieistniejąca, to też odmowa — nie cichy powrót do zależności', async () => {
    const response = await request(buildApp([publishedForVersion(3)]))
      .post(`/plan-scenarios/${PLAN_ID}/analysis-proposals/prop-5`)
      .send(body({ capacityScenarioId: 'nie-ma-takiej' }))
      .expect(400);

    expect(response.body.error.rule).toBe('CAPACITY_SCENARIO_REQUIRED');
  });
});
