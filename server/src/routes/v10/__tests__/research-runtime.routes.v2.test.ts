import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import {
  ResearchRuntimeInputError,
  ResearchRuntimeMissionNotFoundError,
} from '../../../services/v10/research/researchRuntimeService.js';

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
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) => next()) satisfies RequestHandler,
}));

import { createResearchRuntimeRouter } from '../research-runtime.routes.js';

function createApp(service: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/research-runtime', createResearchRuntimeRouter(service));
  return app;
}

describe('research-runtime.routes (wave b)', () => {
  it('plans missions', async () => {
    const service = {
      planMission: vi.fn(() => ({
        missionId: 'm-1',
        now: '2026-04-21T10:00:00.000Z',
        plan: [{ kind: 'scope', label: 'Scope' }],
        missionSummary: 'planned',
      })),
      startMission: vi.fn(),
      watchMission: vi.fn(),
      getMissionSummary: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/research-runtime/missions/plan')
      .send({ query: 'q1', depth: 'standard', maxSources: 8 });

    expect(res.status).toBe(200);
    expect(service.planMission).toHaveBeenCalledWith({
      query: 'q1',
      depth: 'standard',
      maxSources: 8,
      scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
    });
    expect(res.body.data.missionId).toBe('m-1');
  });

  it('watches mission delta', async () => {
    const service = {
      planMission: vi.fn(),
      startMission: vi.fn(),
      watchMission: vi.fn(() => ({
        missionId: 'm-1',
        now: '2026-04-21T10:00:00.000Z',
        nextCursor: 1,
        events: [{ seq: 0, at: '2026-04-21T10:00:00.000Z', kind: 'delta', message: 'hello' }],
        completed: false,
      })),
      getMissionSummary: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/research-runtime/missions/watch')
      .send({ missionId: 'm-1', cursor: 0 });

    expect(res.status).toBe(200);
    expect(service.watchMission).toHaveBeenCalledWith({
      missionId: 'm-1',
      cursor: 0,
      scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
    });
    expect(res.body.data.events).toHaveLength(1);
    expect(res.body.data.nextCursor).toBe(1);
  });

  it('starts missions with injected auth scope', async () => {
    const service = {
      planMission: vi.fn(),
      startMission: vi.fn(() => ({
        missionId: 'm-1',
        now: '2026-04-21T10:00:00.000Z',
        summary: 'started',
      })),
      watchMission: vi.fn(),
      getMissionSummary: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/research-runtime/missions/start')
      .send({ missionId: 'm-1', query: 'q1' });

    expect(res.status).toBe(200);
    expect(service.startMission).toHaveBeenCalledWith({
      missionId: 'm-1',
      query: 'q1',
      scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
    });
    expect(res.body.data.summary).toBe('started');
  });

  it('loads mission summary with injected auth scope', async () => {
    const service = {
      planMission: vi.fn(),
      startMission: vi.fn(),
      watchMission: vi.fn(),
      getMissionSummary: vi.fn(() => ({
        missionId: 'm-1',
        now: '2026-04-21T10:00:00.000Z',
        summary: 'ready',
        status: 'completed',
      })),
    };

    const res = await request(createApp(service))
      .post('/api/v10/research-runtime/missions/summary')
      .send({ missionId: 'm-1' });

    expect(res.status).toBe(200);
    expect(service.getMissionSummary).toHaveBeenCalledWith({
      missionId: 'm-1',
      scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
    });
    expect(res.body.data.status).toBe('completed');
  });

  it('maps missing missions to 404 responses', async () => {
    const service = {
      planMission: vi.fn(),
      startMission: vi.fn(() => {
        throw new ResearchRuntimeMissionNotFoundError('m-missing');
      }),
      watchMission: vi.fn(),
      getMissionSummary: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/research-runtime/missions/start')
      .send({ missionId: 'm-missing', query: 'q1' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('RESEARCH_RUNTIME_MISSION_NOT_FOUND');
  });

  it('maps input errors to typed 422 responses', async () => {
    const service = {
      planMission: vi.fn(() => {
        throw new ResearchRuntimeInputError('RESEARCH_RUNTIME_SCOPE_REQUIRED', 'scope missing');
      }),
      startMission: vi.fn(),
      watchMission: vi.fn(),
      getMissionSummary: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/research-runtime/missions/plan')
      .send({ query: 'q1', depth: 'standard', maxSources: 8 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('RESEARCH_RUNTIME_SCOPE_REQUIRED');
  });

  it('exposes the research runtime contract', async () => {
    const service = {
      planMission: vi.fn(),
      startMission: vi.fn(),
      watchMission: vi.fn(),
      getMissionSummary: vi.fn(),
    };

    const res = await request(createApp(service)).get('/api/v10/research-runtime/contract');

    expect(res.status).toBe(200);
    expect(res.body.data.contract).toBe('research_runtime_wave_a_v1');
    expect(res.body.meta.contract).toBe('research_runtime_wave_a_v1');
  });
});

