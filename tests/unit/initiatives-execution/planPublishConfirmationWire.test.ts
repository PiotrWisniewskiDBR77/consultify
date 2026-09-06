/**
 * P11 runda 2 — bramka „Publikuję mimo N konfliktów”.
 *
 * POMIAR (2026-09-06, gałąź mvp/p12int-typy-serwera): potwierdzenie publikacji
 * NIE docierało z HTTP do silnika planu. Linia
 * `publishConfirmation: parsed.data.publishConfirmation` siedziała w treści
 * POST /portfolio-scenarios (gdzie `ScenarioSchema` w ogóle nie zna tego pola —
 * stąd błąd typu TS2353), a POST /plan-scenarios — jedyna trasa, której schema
 * to pole deklaruje i której silnik `mutatePlanScenario` go wymaga
 * (planScenario.ts: „Explicit conflict publication confirmation is required”) —
 * gubiła je po drodze. Skutek dla użytkownika: front wysyłał potwierdzenie,
 * HTTP je zjadało, publikacja planu z konfliktami padała ZAWSZE.
 *
 * Ten test pilnuje samego przewodu: co przyszło w ciele żądania, ma trafić do
 * koperty komendy. Bez niego defekt jest niewidoczny — testy domenowe
 * (planPublish.konflikt.realdb.test.ts) wołają silnik z pominięciem trasy.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { mutatePlanScenarioMock } = vi.hoisted(() => ({
  mutatePlanScenarioMock: vi.fn(),
}));

vi.mock('../../../server/src/domain/initiatives-execution/planScenario.js', () => ({
  mutatePlanScenario: mutatePlanScenarioMock,
}));

import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const PLAN_ID = 'plan-1';

function planBody(publishConfirmation?: { conflictCount: number; statement: string }) {
  return {
    expectedVersion: 1,
    clientRequestId: 'req-1',
    operation: 'PUBLISH' as const,
    ...(publishConfirmation ? { publishConfirmation } : {}),
    scenario: {
      scenarioId: PLAN_ID,
      scenarioVersion: 1,
      status: 'DRAFT' as const,
      portfolioScenarioId: 'portfolio-1',
      portfolioScenarioVersion: 1,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: [
        { periodId: 'T1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
      ],
      windows: [],
      assumptions: [],
      createdBy: 'user-1',
      updatedBy: 'user-1',
      publishedBy: null,
      publishedAt: null,
    },
  };
}

function buildApp(): Express {
  const reader = {
    findPortfolioScenario: vi.fn(async () => ({
      scenario: { scope: { portfolioId: 'portfolio-1' } },
    })),
  };
  const deps = {
    unitOfWork: {} as never,
    reader: reader as never,
    authorize: vi.fn(async () => true),
    resolvePolicy: vi.fn(async () => ({ policyId: 'p', version: 1 }) as never),
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
  app.use('/', createInitiativesExecutionRuntimeRouter(deps as never));
  return app;
}

describe('POST /plan-scenarios/:scenarioId — przewód potwierdzenia publikacji (P11)', () => {
  it('przekazuje publishConfirmation do koperty komendy planu', async () => {
    mutatePlanScenarioMock.mockReset();
    mutatePlanScenarioMock.mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });

    await request(buildApp())
      .post(`/plan-scenarios/${PLAN_ID}`)
      .send(planBody({ conflictCount: 3, statement: 'Publikuję mimo 3 konfliktów' }))
      .expect(201);

    expect(mutatePlanScenarioMock).toHaveBeenCalledTimes(1);
    const envelope = mutatePlanScenarioMock.mock.calls[0][1];
    expect(envelope.commandType).toBe('plan.scenario.mutate');
    expect(envelope.payload.publishConfirmation).toEqual({
      conflictCount: 3,
      statement: 'Publikuję mimo 3 konfliktów',
    });
  });

  it('nie dokłada pola, gdy żądanie go nie niosło', async () => {
    mutatePlanScenarioMock.mockReset();
    mutatePlanScenarioMock.mockResolvedValue({ status: 'APPLIED', aggregateVersion: 2 });

    await request(buildApp()).post(`/plan-scenarios/${PLAN_ID}`).send(planBody()).expect(201);

    expect(mutatePlanScenarioMock).toHaveBeenCalledTimes(1);
    expect(mutatePlanScenarioMock.mock.calls[0][1].payload).not.toHaveProperty(
      'publishConfirmation'
    );
  });
});
