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
    req.user = {
      id: 'route-user',
      organizationId: 'route-org',
      role: 'ADMIN',
    };
    next();
  }) satisfies RequestHandler,
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

import { createOnboardingRuntimeRouter } from '../onboarding-runtime.routes.js';

function createApp(service: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/onboarding-runtime', createOnboardingRuntimeRouter(service));
  return app;
}

function createServiceStub() {
  return {
    capturePersona: vi.fn(async (input: unknown) => input),
    saveSnapshot: vi.fn(async (input: unknown) => input),
    resume: vi.fn(async (input: unknown) => input),
    recordEvent: vi.fn(async (input: unknown) => input),
    summarizeKpis: vi.fn(async () => ({
      generatedAt: '2026-04-23T12:00:00.000Z',
      totals: {
        persona: 'overall',
        startedSessions: 1,
        activatedSessions: 1,
        resumedSessions: 0,
        abandonedSessions: 0,
        metrics: {
          activation_rate: { actual: 100, target: 40, status: 'green' },
          median_time_to_first_artifact: { actual: 120, target: 240, status: 'green' },
          connector_attach_rate_at_aha: { actual: 100, target: 50, status: 'green' },
          first_artifact_approved_rate: { actual: 100, target: 35, status: 'green' },
        },
      },
      personas: [],
      last24hEventCount: 3,
    })),
  };
}

describe('onboarding-runtime.routes', () => {
  it('injects auth scope into persona requests', async () => {
    const service = createServiceStub();

    const res = await request(createApp(service)).post('/api/v10/onboarding-runtime/persona').send({
      persona: 'CFO',
      personaConfidence: 'high',
    });

    expect(res.status).toBe(200);
    expect(service.capturePersona).toHaveBeenCalledWith(
      expect.objectContaining({
        persona: 'CFO',
        scope: {
          tenantId: 'route-org',
          userId: 'route-user',
          userRole: 'ADMIN',
        },
      })
    );
  });

  it('exposes onboarding KPI summary', async () => {
    const service = createServiceStub();

    const res = await request(createApp(service)).get('/api/v10/onboarding-runtime/kpis/summary');

    expect(res.status).toBe(200);
    expect(service.summarizeKpis).toHaveBeenCalledWith({
      tenantId: 'route-org',
      userId: 'route-user',
      userRole: 'ADMIN',
    });
    expect(res.body.data.totals.metrics.activation_rate.actual).toBe(100);
  });

  it('injects auth scope into snapshot, resume and event requests', async () => {
    const service = createServiceStub();

    const snapshotRes = await request(createApp(service)).post('/api/v10/onboarding-runtime/snapshot').send({
      onboardingId: 'onb-1',
      snapshot: {
        persona: 'CFO',
        personaConfidence: 'high',
        overrideHistory: [],
        connectorTarget: null,
        connectorScopes: [],
        uploadedFiles: [],
        currentDraft: null,
        approvalHistory: [],
        trustBanner: {
          viewedAt: null,
          acknowledged: false,
        },
        unresolvedValidationBlockers: [],
        currentStep: 'persona',
      },
    });
    expect(snapshotRes.status).toBe(200);
    expect(service.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingId: 'onb-1',
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );

    const resumeRes = await request(createApp(service)).post('/api/v10/onboarding-runtime/resume').send({
      onboardingId: 'onb-1',
    });
    expect(resumeRes.status).toBe(200);
    expect(service.resume).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingId: 'onb-1',
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );

    const eventRes = await request(createApp(service)).post('/api/v10/onboarding-runtime/events').send({
      onboardingId: 'onb-1',
      eventName: 'onboard.started',
      props: {
        persona: 'CFO',
        sourceType: 'workspace',
        dataClassification: 'internal',
        trustMode: 'guarded',
        residencyRegion: 'eu',
        secondsSinceStart: 0,
        artifactType: 'brief',
        citationCount: 0,
        validationStatus: 'pending',
        approvalRequired: true,
        ahaReached: false,
      },
    });
    expect(eventRes.status).toBe(200);
    expect(service.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        onboardingId: 'onb-1',
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );
  });

  it('exposes onboarding runtime contract', async () => {
    const service = createServiceStub();

    const res = await request(createApp(service)).get('/api/v10/onboarding-runtime/contract');

    expect(res.status).toBe(200);
    expect(res.body.data.contract).toBe('onboarding_runtime_wave_a_v1');
    expect(res.body.meta.contract).toBe('onboarding_runtime_wave_a_v1');
  });
});
