/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const NO_RETRY = { retry: 0 } as const;

describe('DEC-497 P2 E1 — default-OFF dependency analysis gate', NO_RETRY, () => {
  it('does not call AI or write a proposal when the flag is OFF', async () => {
    const analyze = vi.fn();
    const reader = {
      findPlanScenario: vi.fn().mockResolvedValue({
        version: 2,
        scenario: {
          scenarioId: 'plan-flag',
          scenarioVersion: 2,
          status: 'DRAFT',
          portfolioScenarioId: 'portfolio-flag',
          portfolioScenarioVersion: 1,
          timezone: 'Europe/Warsaw',
          periods: [
            {
              periodId: 'W1',
              start: '2026-09-14T00:00:00.000Z',
              end: '2026-09-21T00:00:00.000Z',
            },
          ],
          windows: [],
        },
      }),
      findPortfolioScenario: vi.fn().mockResolvedValue({
        scenario: { scope: { portfolioId: 'portfolio-scope' } },
      }),
    };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = {
        id: 'owner-1',
        organizationId: 'org-1',
        role: 'OWNER',
      };
      next();
    });
    app.use(
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: {} as any,
        reader: reader as any,
        authorize: async () => true,
        resolvePolicy: async () => ({ policyId: 'policy', version: 1 }) as any,
        analyzePlanDependencies: analyze,
        planDependencyAnalysisEnabled: () => false,
      })
    );

    const response = await request(app)
      .post('/plan-scenarios/plan-flag/analysis-proposals/proposal-flag')
      .send({
        expectedVersion: 0,
        clientRequestId: 'request-flag',
        scenarioId: 'plan-flag',
        inputAggregateVersion: 2,
        analysisKind: 'AI_DEPENDENCY',
        useCapacity: false,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
    expect(analyze).not.toHaveBeenCalled();
  });
});
