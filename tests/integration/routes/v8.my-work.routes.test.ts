import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const mockSetCanonicalObjectState = vi.fn();
const mockGetCanonicalObjectState = vi.fn();
const mockGetSurfaceProjection = vi.fn();
const mockUpdateSurfaceProjection = vi.fn();
const mockGetHomeBlockMaturity = vi.fn();
const mockRecordInboxMaterialization = vi.fn();
const mockGetInboxMaterializationStats = vi.fn();
const mockSetCalendarPhase = vi.fn();
const mockGetCalendarPhases = vi.fn();
const mockRunInboxAiAssist = vi.fn();

vi.mock('../../../server/src/services/v8/myWorkRoofService.js', () => ({
  setCanonicalObjectState: (...args: unknown[]) => mockSetCanonicalObjectState(...args),
  getCanonicalObjectState: (...args: unknown[]) => mockGetCanonicalObjectState(...args),
  getSurfaceProjection: (...args: unknown[]) => mockGetSurfaceProjection(...args),
  updateSurfaceProjection: (...args: unknown[]) => mockUpdateSurfaceProjection(...args),
  getHomeBlockMaturity: (...args: unknown[]) => mockGetHomeBlockMaturity(...args),
  recordInboxMaterialization: (...args: unknown[]) => mockRecordInboxMaterialization(...args),
  getInboxMaterializationStats: (...args: unknown[]) => mockGetInboxMaterializationStats(...args),
  setCalendarPhase: (...args: unknown[]) => mockSetCalendarPhase(...args),
  getCalendarPhases: (...args: unknown[]) => mockGetCalendarPhases(...args),
}));

vi.mock('../../../server/src/services/inboxAiAssistService.js', () => ({
  InboxAiAssistItemSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  runInboxAiAssist: (...args: unknown[]) => mockRunInboxAiAssist(...args),
}));

import myWorkRoutes from '../../../server/src/routes/v8/my-work.routes.js';

const ORG = 'dbr77';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const OBJECT_ID = '33333333-3333-4333-8333-333333333333';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: USER_ID,
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/my-work', myWorkRoutes);
  return app;
}

describe('MyWork Roof Routes (/api/v8/my-work)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetCanonicalObjectState.mockResolvedValue({
      objectId: OBJECT_ID,
      objectType: 'task',
      organizationId: ORG,
      canonicalState: 'active',
      lastUpdatedAt: '2026-03-24T12:00:00.000Z',
      surfaceProjections: {},
    });
    mockGetCanonicalObjectState.mockResolvedValue(null);
    mockGetSurfaceProjection.mockResolvedValue(null);
    mockUpdateSurfaceProjection.mockResolvedValue(null);
    mockGetHomeBlockMaturity.mockResolvedValue([]);
    mockRecordInboxMaterialization.mockResolvedValue({
      materializationId: '44444444-4444-4444-8444-444444444444',
      eventSourceRef: 'signal:test',
      inboxItemId: 'inbox-item-1',
      userId: USER_ID,
      organizationId: ORG,
      materializedAt: '2026-03-24T12:00:00.000Z',
      latencyMs: 1200,
      latencyBand: 'near_realtime',
    });
    mockGetInboxMaterializationStats.mockResolvedValue({
      avgLatencyMs: 0,
      latencyBandDistribution: {
        near_realtime: 0,
        operational: 0,
        degraded: 0,
      },
    });
    mockSetCalendarPhase.mockResolvedValue({
      phaseId: '55555555-5555-4555-8555-555555555555',
      phaseName: 'phase_a_internal',
      organizationId: ORG,
      status: 'active',
      blockedBy: null,
    });
    mockGetCalendarPhases.mockResolvedValue([]);
    mockRunInboxAiAssist.mockResolvedValue({
      brief: 'Triage this today.',
      bullets: ['Confirm owner', 'Assess deadline'],
      recommendedAction: 'accept_today',
      recommendedReason: 'Actionable and time-sensitive',
    });
  });

  it('sets and reads canonical object state with org injected from v8 context', async () => {
    mockGetCanonicalObjectState.mockResolvedValue({
      objectId: OBJECT_ID,
      objectType: 'task',
      organizationId: ORG,
      canonicalState: 'active',
      lastUpdatedAt: '2026-03-24T12:00:00.000Z',
      surfaceProjections: {},
    });

    const putRes = await request(createApp()).put(`/api/v8/my-work/objects/${OBJECT_ID}`).send({
      objectType: 'task',
      canonicalState: 'active',
    });
    const getRes = await request(createApp()).get(`/api/v8/my-work/objects/${OBJECT_ID}`);

    expect(putRes.status).toBe(200);
    expect(mockSetCanonicalObjectState).toHaveBeenCalledWith({
      objectId: OBJECT_ID,
      objectType: 'task',
      canonicalState: 'active',
      organizationId: ORG,
    });
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.objectId).toBe(OBJECT_ID);
  });

  it('returns 404 when canonical object state does not exist', async () => {
    const res = await request(createApp()).get(`/api/v8/my-work/objects/${OBJECT_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('OBJECT_NOT_FOUND');
  });

  it('updates and reads a surface projection for an existing canonical object', async () => {
    mockUpdateSurfaceProjection.mockResolvedValue({
      objectId: OBJECT_ID,
      objectType: 'task',
      organizationId: ORG,
      canonicalState: 'active',
      lastUpdatedAt: '2026-03-24T12:05:00.000Z',
      surfaceProjections: {
        inbox: {
          surface: 'inbox',
          displayState: 'needs_review',
          isStale: false,
          lastRefreshedAt: '2026-03-24T12:05:00.000Z',
        },
      },
    });
    mockGetSurfaceProjection.mockResolvedValue({
      surface: 'inbox',
      displayState: 'needs_review',
      isStale: false,
      lastRefreshedAt: '2026-03-24T12:05:00.000Z',
    });

    const putRes = await request(createApp())
      .put(`/api/v8/my-work/objects/${OBJECT_ID}/projections/inbox`)
      .send({
        displayState: 'needs_review',
        isStale: false,
      });
    const getRes = await request(createApp()).get(
      `/api/v8/my-work/objects/${OBJECT_ID}/projections/inbox`,
    );

    expect(putRes.status).toBe(200);
    expect(mockUpdateSurfaceProjection).toHaveBeenCalledWith({
      objectId: OBJECT_ID,
      organizationId: ORG,
      surface: 'inbox',
      displayState: 'needs_review',
      isStale: false,
    });
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.displayState).toBe('needs_review');
  });

  it('rejects invalid projection params through zod-backed validation', async () => {
    mockUpdateSurfaceProjection.mockRejectedValue(
      new ZodError([
        {
          code: 'invalid_value',
          values: ['home', 'calendar', 'inbox', 'radar'],
          path: ['surface'],
          message: 'Invalid surface',
          input: 'bad-surface',
          inst: undefined as any,
        },
      ]),
    );

    const res = await request(createApp())
      .put(`/api/v8/my-work/objects/${OBJECT_ID}/projections/bad-surface`)
      .send({
        displayState: 'needs_review',
        isStale: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('records inbox materialization with user and org injected from v8 context', async () => {
    const res = await request(createApp()).post('/api/v8/my-work/inbox/materializations').send({
      eventSourceRef: 'signal:test',
      inboxItemId: 'inbox-item-1',
      latencyMs: 1200,
    });

    expect(res.status).toBe(201);
    expect(mockRecordInboxMaterialization).toHaveBeenCalledWith({
      eventSourceRef: 'signal:test',
      inboxItemId: 'inbox-item-1',
      latencyMs: 1200,
      organizationId: ORG,
      userId: USER_ID,
    });
  });

  it('returns user-scoped inbox materialization stats', async () => {
    mockGetInboxMaterializationStats.mockResolvedValue({
      avgLatencyMs: 1200,
      latencyBandDistribution: {
        near_realtime: 1,
        operational: 0,
        degraded: 0,
      },
    });

    const res = await request(createApp()).get('/api/v8/my-work/inbox/materializations/stats');

    expect(res.status).toBe(200);
    expect(mockGetInboxMaterializationStats).toHaveBeenCalledWith(USER_ID, ORG);
    expect(res.body.data.avgLatencyMs).toBe(1200);
  });

  it('sets and lists calendar phases through the governed route layer', async () => {
    mockGetCalendarPhases.mockResolvedValue([
      {
        phaseId: '55555555-5555-4555-8555-555555555555',
        phaseName: 'phase_a_internal',
        organizationId: ORG,
        status: 'active',
        blockedBy: null,
      },
    ]);

    const putRes = await request(createApp())
      .put('/api/v8/my-work/calendar/phases/phase_a_internal')
      .send({ status: 'active' });
    const getRes = await request(createApp()).get('/api/v8/my-work/calendar/phases');

    expect(putRes.status).toBe(200);
    expect(mockSetCalendarPhase).toHaveBeenCalledWith({
      phaseName: 'phase_a_internal',
      status: 'active',
      organizationId: ORG,
    });
    expect(getRes.status).toBe(200);
    expect(getRes.body.data[0].phaseName).toBe('phase_a_internal');
  });

  it('returns a partially coherent roof summary when derived defaults have no placeholder blocks', async () => {
    const res = await request(createApp()).get('/api/v8/my-work/roof/summary');

    expect(res.status).toBe(200);
    expect(mockGetHomeBlockMaturity).toHaveBeenCalledWith(ORG);
    expect(mockGetInboxMaterializationStats).toHaveBeenCalledWith(USER_ID, ORG);
    expect(mockGetCalendarPhases).toHaveBeenCalledWith(ORG);

    expect(res.body.data.overallStatus).toBe('coherent');
    expect(res.body.data.surfaceMode).toBe('home_v2_aggregated_with_outputs_bridge');
    expect(res.body.data.contracts.homeViewUsesAggregatedContract).toBe(true);
    expect(res.body.data.counts).toEqual({
      backed_by_real_service: 8,
      partial_stitched: 0,
      placeholder_non_canonical: 0,
    });
    expect(res.body.data.homeBlocks).toHaveLength(8);
    expect(res.body.data.inboxMaterialization.status).toBe('not_proven_yet');
    expect(res.body.data.calendar).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phaseName: 'phase_a_internal', status: 'active' }),
        expect.objectContaining({
          phaseName: 'phase_b_external_sync',
          status: 'blocked',
          blockedBy: 'wave5_connector_platform',
        }),
      ]),
    );
  });

  it('prefers persisted block and calendar truth when audit rows exist', async () => {
    mockGetHomeBlockMaturity.mockResolvedValue([
      {
        blockId: '33333333-3333-4333-8333-333333333333',
        blockName: 'commandDock',
        organizationId: ORG,
        maturityLevel: 'backed_by_real_service',
        serviceRef: 'commandDockRuntime',
        lastAuditedAt: '2026-03-24T12:00:00.000Z',
      },
    ]);
    mockGetCalendarPhases.mockResolvedValue([
      {
        phaseId: '44444444-4444-4444-8444-444444444444',
        phaseName: 'phase_b_external_sync',
        organizationId: ORG,
        status: 'active',
        blockedBy: null,
      },
    ]);

    const res = await request(createApp()).get('/api/v8/my-work/roof/summary');

    expect(res.status).toBe(200);
    expect(res.body.data.homeBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockName: 'commandDock',
          maturityLevel: 'backed_by_real_service',
          serviceRef: 'commandDockRuntime',
          source: 'persisted',
        }),
      ]),
    );
    expect(res.body.data.calendar).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          phaseName: 'phase_b_external_sync',
          status: 'active',
          source: 'persisted',
        }),
      ]),
    );
  });

  it('serves inbox ai assist through the v8 envelope', async () => {
    const res = await request(createApp()).post('/api/v8/my-work/inbox/ai-assist').send({
      language: 'en',
      item: {
        title: 'Client escalation',
        description: 'Need follow-up today',
        type: 'escalation',
        section: 'blocked_escalations',
        urgency: 'high',
        receivedAt: '2026-03-25T10:00:00.000Z',
        reason: 'Escalated due to SLA risk',
      },
    });

    expect(res.status).toBe(200);
    expect(mockRunInboxAiAssist).toHaveBeenCalledWith({
      organizationId: ORG,
      language: 'en',
      item: {
        title: 'Client escalation',
        description: 'Need follow-up today',
        type: 'escalation',
        section: 'blocked_escalations',
        urgency: 'high',
        receivedAt: '2026-03-25T10:00:00.000Z',
        reason: 'Escalated due to SLA risk',
      },
    });
    expect(res.body.data.result.recommendedAction).toBe('accept_today');
    expect(res.body.meta.contract).toBe('my_work_inbox_ai_assist_v1');
  });
});
