/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const organizationId = 'org-portfolio-analysis';
const actorId = 'actor-portfolio-analysis';
const scenarioId = 'scenario-portfolio-analysis';
const analysisId = 'analysis-portfolio-analysis';

const snapshot = {
  snapshotVersion: 1,
  organizationId,
  asOf: '2026-09-13T12:00:00.000Z',
  source: {
    system: 'initiativeUnifiedReader' as const,
    version: 'runtime-v1',
    capturedAt: '2026-09-13T12:00:00.000Z',
  },
  portfolio: {
    scenarioId,
    aggregateVersion: 3,
    scenarioVersion: 2,
    facts: { scenarioId, scenarioVersion: 2, scope: { portfolioId: 'portfolio-a' } },
  },
  initiatives: [
    {
      initiativeId: 'initiative-a',
      initiativeVersion: 4,
      projectId: null,
      source: 'CANONICAL' as const,
      facts: { initiativeId: 'initiative-a', projectId: null, lifecycleState: 'ANALYZING' },
      evidenceRefs: ['initiative:initiative-a:v4'] as [string],
    },
  ],
  decisionHistory: [],
  runningWork: [],
  organizationContext: {
    snapshotId: 'context-a',
    version: 7,
    contentHash: 'context-hash-a',
    facts: { organizationId, claims: [] },
  },
};

describe('Portfolio consulting analysis runtime routes', () => {
  const buildSnapshot = vi.fn();
  const analysisReader = { find: vi.fn() };
  const contextReader = { findGovernedSnapshot: vi.fn() };
  const gateway = { analyze: vi.fn() };
  const capture = vi.fn();
  const run = vi.fn();
  const authorize = vi.fn();
  const resolvePolicy = vi.fn();
  const unitOfWork = { transaction: vi.fn() };
  const reader = { findPortfolioScenario: vi.fn() };

  const app = () => {
    const api = express();
    api.use(express.json());
    api.use((req, _res, next) => {
      (req as any).user = { id: actorId, organizationId, role: 'PMO' };
      next();
    });
    api.use(
      '/api/initiatives/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork,
        reader,
        authorize,
        resolvePolicy,
        portfolioAnalysis: {
          buildSnapshot,
          reader: analysisReader,
          contextReader,
          gateway,
          capture,
          run,
        },
      } as any)
    );
    return api;
  };

  beforeEach(() => {
    process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS = 'true';
    vi.clearAllMocks();
    reader.findPortfolioScenario.mockResolvedValue({
      version: 3,
      scenario: { scope: { portfolioId: 'portfolio-a' } },
    });
    authorize.mockResolvedValue(true);
    resolvePolicy.mockResolvedValue({ policyId: 'policy-a', version: 2 });
    buildSnapshot.mockResolvedValue(snapshot);
    analysisReader.find.mockResolvedValue(null);
    capture.mockResolvedValue({ status: 'APPLIED', aggregateVersion: 1, response: {} });
    run.mockResolvedValue({ analysisId, status: 'PENDING_REVIEW', snapshot });
    unitOfWork.transaction.mockImplementation(async (work: (tx: unknown) => unknown) => work({}));
  });

  afterEach(() => {
    delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;
  });

  it('builds the capture payload on the server and returns the finalized persisted analysis', async () => {
    const response = await request(app())
      .post('/api/initiatives/runtime-v1/portfolio-analyses')
      .set('X-Correlation-ID', 'correlation-a')
      .send({
        analysisId,
        scenarioId,
        contextSnapshotId: 'context-a',
        contextVersion: 7,
        expectedVersion: 0,
        clientRequestId: 'capture-request-a',
        rubricVersion: 'portfolio-consulting-v1',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(buildSnapshot).toHaveBeenCalledWith({
      organizationId,
      scenarioId,
      contextSnapshotId: 'context-a',
      contextVersion: 7,
    });
    expect(response.body.analysis).toMatchObject({ analysisId, status: 'PENDING_REVIEW' });
    expect(capture.mock.calls[0][1].payload).toEqual({
      rubricVersion: 'portfolio-consulting-v1',
      snapshot,
    });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        actorId,
        analysisId,
        clientRequestId: 'capture-request-a:finalize',
        gateway,
      })
    );
  });

  it('rejects caller-supplied snapshots and model provenance', async () => {
    const response = await request(app())
      .post('/api/initiatives/runtime-v1/portfolio-analyses')
      .send({
        analysisId,
        scenarioId,
        contextSnapshotId: 'context-a',
        contextVersion: 7,
        expectedVersion: 0,
        clientRequestId: 'capture-request-a',
        rubricVersion: 'portfolio-consulting-v1',
        snapshot: { organizationId: 'attacker-org' },
        model: { provider: 'caller-controlled' },
      });

    expect(response.status, JSON.stringify(response.body)).toBe(400);
    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects reuse of an analysis identity with a different frozen request', async () => {
    analysisReader.find.mockResolvedValue({
      version: 1,
      analysis: {
        analysisId,
        status: 'CAPTURED',
        rubricVersion: 'different-rubric',
        snapshot,
      },
    });

    const response = await request(app())
      .post('/api/initiatives/runtime-v1/portfolio-analyses')
      .send({
        analysisId,
        scenarioId,
        contextSnapshotId: 'context-a',
        contextVersion: 7,
        expectedVersion: 0,
        clientRequestId: 'capture-request-a',
        rubricVersion: 'portfolio-consulting-v1',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(409);
    expect(response.body.error.code).toBe('PORTFOLIO_ANALYSIS_REQUEST_CONFLICT');
    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('reads a persisted analysis only after tenant-scoped portfolio authorization', async () => {
    analysisReader.find.mockResolvedValue({
      version: 2,
      analysis: {
        analysisId,
        status: 'PENDING_REVIEW',
        snapshot,
      },
    });

    const response = await request(app()).get(
      `/api/initiatives/runtime-v1/portfolio-analyses/${analysisId}`
    );

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(analysisReader.find).toHaveBeenCalledWith(organizationId, analysisId);
    expect(authorize).toHaveBeenCalledWith(expect.any(Object), 'portfolio-a', 'initiative.view');
    expect(response.body).toMatchObject({ version: 2, analysis: { analysisId } });
  });

  it('keeps the new API default OFF and does not invoke source readers', async () => {
    delete process.env.ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS;

    const response = await request(app())
      .post('/api/initiatives/runtime-v1/portfolio-analyses')
      .send({
        analysisId,
        scenarioId,
        contextSnapshotId: 'context-a',
        contextVersion: 7,
        expectedVersion: 0,
        clientRequestId: 'capture-request-a',
        rubricVersion: 'portfolio-consulting-v1',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(404);
    expect(reader.findPortfolioScenario).not.toHaveBeenCalled();
    expect(analysisReader.find).not.toHaveBeenCalled();
    expect(buildSnapshot).not.toHaveBeenCalled();
  });
});
