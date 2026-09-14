/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const NO_RETRY = { retry: 0 } as const;

describe('DEC-497 P2 E1 — default-OFF dependency analysis gate', NO_RETRY, () => {
  beforeEach(() => vi.stubEnv('ENABLE_INITIATIVES_PLAN', 'true'));
  afterEach(() => vi.unstubAllEnvs());
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

  it('rejects a body scenario that differs from the URL before AI', async () => {
    const analyze = vi.fn();
    const app = createPlanAnalysisRouteTestApp({ analyze, enabled: true, foundVersion: 2 });

    const response = await request(app)
      .post('/plan-scenarios/plan-url/analysis-proposals/proposal-flag')
      .send({
        expectedVersion: 0,
        clientRequestId: 'request-mismatched-plan',
        scenarioId: 'plan-body',
        inputAggregateVersion: 2,
        analysisKind: 'AI_DEPENDENCY',
        useCapacity: false,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: { code: 'VALIDATION_FAILED' } });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('rejects a stale Plan aggregate version before AI', async () => {
    const analyze = vi.fn().mockResolvedValue({
      source: 'AI',
      model: 'should-not-run',
      analyzedAt: '2026-09-14T02:00:00.000Z',
      inputScenarioVersion: 2,
      observations: [],
      criticalPaths: [],
    });
    const app = createPlanAnalysisRouteTestApp({ analyze, enabled: true, foundVersion: 2 });

    const response = await request(app)
      .post('/plan-scenarios/plan-url/analysis-proposals/proposal-stale')
      .send({
        expectedVersion: 0,
        clientRequestId: 'request-stale-plan',
        scenarioId: 'plan-url',
        inputAggregateVersion: 1,
        analysisKind: 'AI_DEPENDENCY',
        useCapacity: false,
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: 'VERSION_OR_IDEMPOTENCY_CONFLICT',
        expectedVersion: 1,
        currentVersion: 2,
      },
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('lets a stored receipt win after the source Plan version advances', async () => {
    const analyze = vi.fn();
    const replay = {
      status: 'REPLAYED' as const,
      aggregateVersion: 1,
      response: { proposalId: 'proposal-replay', analysisSource: 'AI' },
      correlationId: 'plan-analysis-request-replay',
      receiptId: 'request-replay',
      readBackState: 'PENDING' as const,
      readBackUrl: '/runtime-v1/command-receipts/request-replay/read-back',
    };
    const app = createPlanAnalysisRouteTestApp({
      analyze,
      enabled: true,
      foundVersion: 4,
      unitOfWork: { transaction: vi.fn().mockResolvedValue(replay) },
    });

    const response = await request(app)
      .post('/plan-scenarios/plan-url/analysis-proposals/proposal-replay')
      .send({
        expectedVersion: 0,
        clientRequestId: 'request-replay',
        scenarioId: 'plan-url',
        inputAggregateVersion: 3,
        analysisKind: 'AI_DEPENDENCY',
        useCapacity: false,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(replay);
    expect(analyze).not.toHaveBeenCalled();
  });
});

function createPlanAnalysisRouteTestApp(input: {
  analyze: ReturnType<typeof vi.fn>;
  enabled: boolean;
  foundVersion: number;
  unitOfWork?: { transaction: ReturnType<typeof vi.fn> };
}) {
  const scenario = {
    scenarioId: 'plan-url',
    scenarioVersion: input.foundVersion,
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
    assumptions: [],
    createdBy: 'owner-1',
    updatedBy: 'owner-1',
    publishedBy: null,
    publishedAt: null,
  };
  const reader = {
    findPlanScenario: vi.fn().mockResolvedValue({
      version: input.foundVersion,
      scenario,
    }),
    findPortfolioScenario: vi.fn().mockResolvedValue({
      scenario: { scope: { portfolioId: 'portfolio-scope' } },
    }),
    listPlanDependencyAnalysisContext: vi.fn().mockResolvedValue([]),
    listCapacityScenarios: vi.fn().mockResolvedValue([]),
  };
  const defaultUnitOfWork = {
    transaction: vi.fn(async (work: (tx: Record<string, unknown>) => Promise<unknown>) =>
      work({
        findReceipt: vi.fn().mockResolvedValue(null),
        getAggregatePayload: vi.fn().mockResolvedValue(null),
        getAggregateVersion: vi.fn().mockResolvedValue(null),
        getRelatedAggregateForUpdate: vi.fn().mockImplementation(async (_org, type) =>
          type === 'plan_scenario' ? { version: input.foundVersion, payload: scenario } : null
        ),
      })
    ),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'owner-1', organizationId: 'org-1', role: 'OWNER' };
    next();
  });
  app.use(
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: (input.unitOfWork ?? defaultUnitOfWork) as any,
      reader: reader as any,
      authorize: async () => true,
      resolvePolicy: async () => ({ policyId: 'policy', version: 1 }) as any,
      analyzePlanDependencies: input.analyze,
      planDependencyAnalysisEnabled: () => input.enabled,
    })
  );
  return app;
}
