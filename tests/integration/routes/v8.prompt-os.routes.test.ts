import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListPresetsByOrganization = vi.fn();
const mockListBundlesByOrganization = vi.fn();
const mockGetPreset = vi.fn();
const mockCreatePreset = vi.fn();
const mockGetBundle = vi.fn();
const mockCreateReleaseBundle = vi.fn();
const mockActivateBundle = vi.fn();
const mockRollbackBundle = vi.fn();
const mockGetGatesByBundle = vi.fn();
const mockEvaluateGate = vi.fn();
const mockGetCanaryConfig = vi.fn();
const mockSetCanaryConfig = vi.fn();

vi.mock('../../../server/src/services/v8/promptOsRuntimeService.js', () => ({
  listPresetsByOrganization: (...args: unknown[]) => mockListPresetsByOrganization(...args),
  listBundlesByOrganization: (...args: unknown[]) => mockListBundlesByOrganization(...args),
  getPreset: (...args: unknown[]) => mockGetPreset(...args),
  createPreset: (...args: unknown[]) => mockCreatePreset(...args),
  getBundle: (...args: unknown[]) => mockGetBundle(...args),
  createReleaseBundle: (...args: unknown[]) => mockCreateReleaseBundle(...args),
  activateBundle: (...args: unknown[]) => mockActivateBundle(...args),
  rollbackBundle: (...args: unknown[]) => mockRollbackBundle(...args),
  getGatesByBundle: (...args: unknown[]) => mockGetGatesByBundle(...args),
  evaluateGate: (...args: unknown[]) => mockEvaluateGate(...args),
  getCanaryConfig: (...args: unknown[]) => mockGetCanaryConfig(...args),
  setCanaryConfig: (...args: unknown[]) => mockSetCanaryConfig(...args),
}));

import promptOsRoutes from '../../../server/src/routes/v8/prompt-os.routes.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const PRESET_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BUNDLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.v8Context = {
      organizationId: ORG,
      userId: '22222222-2222-4222-8222-222222222222',
      userRole: 'ADMIN',
      isSuperAdmin: false,
    };
    next();
  });
  app.use('/api/v8/prompt-os', promptOsRoutes);
  return app;
}

describe('Prompt OS Routes (/api/v8/prompt-os)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPresetsByOrganization.mockResolvedValue([]);
    mockListBundlesByOrganization.mockResolvedValue([]);
  });

  it('GET /runtime/summary aggregates preset and bundle counts', async () => {
    mockListPresetsByOrganization.mockResolvedValue([{ presetId: PRESET_ID } as any]);
    mockListBundlesByOrganization.mockResolvedValue([
      { status: 'draft' } as any,
      { status: 'active' } as any,
    ]);

    const res = await request(createApp()).get('/api/v8/prompt-os/runtime/summary');

    expect(res.status).toBe(200);
    expect(res.body.meta.version).toBe('v8');
    expect(res.body.data.contract).toBe('prompt-os-runtime-v8');
    expect(res.body.data.presetCount).toBe(1);
    expect(res.body.data.bundleCount).toBe(2);
    expect(res.body.data.activeBundleCount).toBe(1);
    expect(mockListPresetsByOrganization).toHaveBeenCalledWith(ORG);
    expect(mockListBundlesByOrganization).toHaveBeenCalledWith(ORG, 200);
  });

  it('POST /presets injects organizationId from V8 context', async () => {
    mockCreatePreset.mockResolvedValue({ presetId: PRESET_ID, organizationId: ORG });

    const res = await request(createApp())
      .post('/api/v8/prompt-os/presets')
      .send({
        name: 'consultative_chat',
        purposeFamily: 'conversational',
        modelRef: 'gpt-4o',
        promptBlockRefs: ['block:a'],
        gateType: 'hard',
        evalThresholds: {
          qualityMin: 0.8,
          latencyP95MaxMs: 3000,
          costMaxPerInteraction: 0.05,
          trustDegradationMaxPct: 5,
          failureRateMaxPct: 3,
        },
      });

    expect(res.status).toBe(201);
    expect(mockCreatePreset).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        name: 'consultative_chat',
      }),
    );
  });

  it('returns 404 when bundle belongs to another organization', async () => {
    mockGetBundle.mockResolvedValue({
      bundleId: BUNDLE_ID,
      organizationId: '99999999-9999-4999-8999-999999999999',
    });

    const res = await request(createApp()).get(`/api/v8/prompt-os/bundles/${BUNDLE_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BUNDLE_NOT_FOUND');
  });

  it('POST /bundles rejects when preset is missing for org', async () => {
    mockGetPreset.mockResolvedValue(null);

    const res = await request(createApp())
      .post('/api/v8/prompt-os/bundles')
      .send({
        version: '1.0.0',
        presetId: PRESET_ID,
        promptVersion: 'p1',
        modelVersion: 'm1',
        policyVersion: 'pol1',
        runtimeConfigVersion: 'rc1',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PRESET_NOT_FOUND');
  });
});
