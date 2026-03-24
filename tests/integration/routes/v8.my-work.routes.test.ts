import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetHomeBlockMaturity = vi.fn();
const mockGetInboxMaterializationStats = vi.fn();
const mockGetCalendarPhases = vi.fn();

vi.mock('../../../server/src/services/v8/myWorkRoofService.js', () => ({
  getHomeBlockMaturity: (...args: unknown[]) => mockGetHomeBlockMaturity(...args),
  getInboxMaterializationStats: (...args: unknown[]) => mockGetInboxMaterializationStats(...args),
  getCalendarPhases: (...args: unknown[]) => mockGetCalendarPhases(...args),
}));

import myWorkRoutes from '../../../server/src/routes/v8/my-work.routes.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

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
    mockGetHomeBlockMaturity.mockResolvedValue([]);
    mockGetInboxMaterializationStats.mockResolvedValue({
      avgLatencyMs: 0,
      latencyBandDistribution: {
        near_realtime: 0,
        operational: 0,
        degraded: 0,
      },
    });
    mockGetCalendarPhases.mockResolvedValue([]);
  });

  it('returns an explicit mixed-truth roof summary even when no persisted audit rows exist', async () => {
    const res = await request(createApp()).get('/api/v8/my-work/roof/summary');

    expect(res.status).toBe(200);
    expect(mockGetHomeBlockMaturity).toHaveBeenCalledWith(ORG);
    expect(mockGetInboxMaterializationStats).toHaveBeenCalledWith(USER_ID, ORG);
    expect(mockGetCalendarPhases).toHaveBeenCalledWith(ORG);

    expect(res.body.data.overallStatus).toBe('mixed_truth');
    expect(res.body.data.surfaceMode).toBe('radar_overlay_with_outputs_bridge');
    expect(res.body.data.contracts.homeViewUsesAggregatedContract).toBe(false);
    expect(res.body.data.counts).toEqual({
      backed_by_real_service: 2,
      partial_stitched: 2,
      placeholder_non_canonical: 4,
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
});
