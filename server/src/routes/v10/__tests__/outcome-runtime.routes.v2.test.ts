import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

type MockAuthRequest = {
  userId?: string;
  organizationId?: string;
  userRole?: string;
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
};

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: ((req: MockAuthRequest, _res: unknown, next: () => void) => {
    req.userId = 'route-user';
    req.organizationId = 'route-org';
    req.userRole = 'ADMIN';
    req.user = { id: 'route-user', organizationId: 'route-org', role: 'ADMIN' };
    next();
  }) satisfies RequestHandler,
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

import { createOutcomeRuntimeRouter } from '../outcome-runtime.routes.js';

function createApp(service: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/outcome-runtime', createOutcomeRuntimeRouter(service));
  return app;
}

describe('outcome-runtime.routes (wave b)', () => {
  it('previews KPI acceptance with injected scope', async () => {
    const service = {
      resolve: vi.fn(),
      previewAcceptance: vi.fn((input) => ({
        previewId: 'out-prev-1',
        now: '2026-04-23T10:00:00.000Z',
        metrics: [],
        suggestedSignals: [],
        acceptanceContract: {
          contractId: 'out-ctr-1',
          previewId: 'out-prev-1',
          status: 'draft',
          requiredActions: ['review'],
          linkedMetricIds: ['kpi-1'],
        },
        businessLinkSummary: {
          headline: 'Linked',
          linkedMetricIds: ['kpi-1'],
          confidence: 'high',
        },
        _scopeEcho: input.scope,
      })),
      ingestSignal: vi.fn(),
      resolveAcceptance: vi.fn(),
      linkAnalysisToBusinessOutcome: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/outcome-runtime/acceptance/preview')
      .send({
        analysisSummary: 'Analysis',
        businessGoal: 'Reduce cycle time',
        metrics: [
          {
            id: 'kpi-1',
            label: 'Cycle time',
            domain: 'time',
            unit: 'hours',
            baselineValue: 10,
            targetValue: 6,
          },
        ],
        evidence: { analysisId: 'analysis-1' },
      });

    expect(res.status).toBe(200);
    expect(service.previewAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );
    expect(res.body.data.previewId).toBe('out-prev-1');
  });

  it('resolves acceptance contract', async () => {
    const service = {
      resolve: vi.fn(),
      previewAcceptance: vi.fn(),
      ingestSignal: vi.fn(),
      resolveAcceptance: vi.fn(() => ({
        contractId: 'out-ctr-1',
        previewId: 'out-prev-1',
        status: 'accepted',
        outcomeRecordId: 'out-rec-1',
        acceptedMetricIds: ['kpi-1'],
        now: '2026-04-23T10:00:00.000Z',
      })),
      linkAnalysisToBusinessOutcome: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/outcome-runtime/acceptance/resolve')
      .send({
        contractId: 'out-ctr-1',
        decision: 'accepted',
        acceptedMetricIds: ['kpi-1'],
      });

    expect(res.status).toBe(200);
    expect(service.resolveAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'out-ctr-1',
        decision: 'accepted',
        acceptedMetricIds: ['kpi-1'],
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );
    expect(res.body.data.outcomeRecordId).toBe('out-rec-1');
  });

  it('ingests signals and links analysis with injected scope', async () => {
    const service = {
      resolve: vi.fn(),
      previewAcceptance: vi.fn(),
      ingestSignal: vi.fn((input) => ({
        signalId: 'out-sig-1',
        now: '2026-04-23T10:00:00.000Z',
        status: 'captured',
        _scopeEcho: input.scope,
      })),
      resolveAcceptance: vi.fn(),
      linkAnalysisToBusinessOutcome: vi.fn((input) => ({
        linkId: 'out-link-1',
        now: '2026-04-23T10:00:00.000Z',
        strongestSignalKind: 'time_saved',
        linkedMetricIds: ['kpi-1'],
        summary: 'Linked',
        evidenceCoverage: {
          hasArtifact: true,
          hasResearchMission: false,
          hasReasoningRun: false,
        },
        _scopeEcho: input.scope,
      })),
    };

    const signalRes = await request(createApp(service))
      .post('/api/v10/outcome-runtime/signals/ingest')
      .send({
        source: 'analysis_link',
        kind: 'time_saved',
        magnitude: { value: 3, unit: 'hours' },
        confidence: 'high',
        evidence: { analysisId: 'analysis-1' },
      });

    expect(signalRes.status).toBe(200);
    expect(service.ingestSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );

    const linkRes = await request(createApp(service))
      .post('/api/v10/outcome-runtime/analysis/business-link')
      .send({
        analysisSummary: 'Analysis',
        businessGoal: 'Reduce cycle time',
        hypothesis: 'Automating reviews will shorten cycles',
        metrics: [
          {
            id: 'kpi-1',
            label: 'Cycle time',
            domain: 'time',
            unit: 'hours',
            baselineValue: 10,
            targetValue: 6,
          },
        ],
        evidence: { analysisId: 'analysis-1', artifactId: 'artifact-1' },
      });

    expect(linkRes.status).toBe(200);
    expect(service.linkAnalysisToBusinessOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );
    expect(linkRes.body.data.linkId).toBe('out-link-1');
  });

  it('resolves generic outcomes and exposes the contract', async () => {
    const service = {
      resolve: vi.fn(() => ({
        outcomeId: 'out-1',
        now: '2026-04-23T10:00:00.000Z',
        status: 'resolved',
      })),
      previewAcceptance: vi.fn(),
      ingestSignal: vi.fn(),
      resolveAcceptance: vi.fn(),
      linkAnalysisToBusinessOutcome: vi.fn(),
    };

    const resolveRes = await request(createApp(service))
      .post('/api/v10/outcome-runtime/resolve')
      .send({ kind: 'artifact_delivery', payload: { id: 'artifact-1' } });

    expect(resolveRes.status).toBe(200);
    expect(service.resolve).toHaveBeenCalledWith({
      kind: 'artifact_delivery',
      payload: { id: 'artifact-1' },
    });

    const contractRes = await request(createApp(service)).get('/api/v10/outcome-runtime/contract');

    expect(contractRes.status).toBe(200);
    expect(contractRes.body.data.contract).toBe('outcome_runtime_wave_b_v1');
    expect(contractRes.body.meta.contract).toBe('outcome_runtime_wave_b_v1');
  });
});
