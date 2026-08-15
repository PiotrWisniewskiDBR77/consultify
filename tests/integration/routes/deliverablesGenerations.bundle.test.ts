import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('multer');

/**
 * W13.1 — route integration tests for the unified pipeline:
 *   POST /bundle  and  POST /bundle/export
 * Verifies flag-gate (404), zod-400, capability, happy-path 200, and the
 * /bundle/export zip contract (application/zip + Content-Disposition + PK).
 * Mocks generateBundle + export so no LLM runs.
 */

const flags = { ENABLE_DELIVERABLES_LIGHT: true, ENABLE_DELIVERABLES_PREMIUM: true };
vi.mock('../../../server/src/config/FeatureFlags.js', () => ({ featureFlags: flags }));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'OWNER' };
    req.userId = 'user-1'; req.userRole = 'OWNER';
    next();
  },
}));
vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../../server/src/services/presentationAccessPolicyService.js', () => ({
  hasPresentationCapability: () => true,
}));
vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  default: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));
vi.mock('../../../server/src/services/deliverables/deliverablesGenerationService.js', () => ({
  DeliverablesGenerationError: class extends Error {},
  plan: vi.fn(), start: vi.fn(), status: vi.fn(),
}));
vi.mock('../../../server/src/services/deliverables/deliverablesMetricsService.js', () => ({
  getDeliverableMetrics: vi.fn(),
}));
vi.mock('../../../server/src/services/deliverables/bundleOrchestrator.js', () => ({
  generateBusinessPlan: vi.fn(),
  spineToDeckSlides: vi.fn(),
  spineToDocOutline: vi.fn(),
  spineToTableIntent: vi.fn(),
}));
vi.mock('../../../server/src/services/deliverables/brandIngestion.js', () => ({
  extractBrandTheme: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../server/src/services/deliverables/briefEnrichment.js', () => ({
  enrichBriefWithOrgContext: vi.fn(async (brief: string) => ({ enrichedBrief: brief })),
}));
vi.mock('../../../server/src/services/dataCollection/connectorFramework.js', () => ({
  connectorRegistry: {},
}));
vi.mock('../../../server/src/services/deliverables/materialDataBinding.js', () => ({
  connectorDataset: vi.fn(),
  formDataset: vi.fn(),
}));
vi.mock('../../../server/src/services/deliverables/qualityTelemetry.js', () => ({
  aggregateQualityTelemetry: vi.fn(),
  recordsFromRows: vi.fn(),
}));
vi.mock('../../../server/src/services/deliverables/starterTemplates.js', () => ({
  firstRunSeedPlan: vi.fn(),
}));
vi.mock('../../../server/src/services/deliverables/uploadContextExtract.js', () => ({
  extractUploadContext: vi.fn(),
}));
vi.mock('../../../server/src/services/ai/circuitBreaker.js', () => ({
  STATE: {},
  canExecute: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  reset: vi.fn(),
  getStatus: vi.fn(() => ({})),
  execute: vi.fn(async (_provider: string, operation: () => unknown) => operation()),
  initialize: vi.fn(),
  CircuitBreakerService: {},
  default: {},
}));

const genBundle = vi.fn();
vi.mock('../../../server/src/services/deliverables/bundleGenerationRuntime.js', () => ({
  generateBundle: (...a: any[]) => genBundle(...a),
}));

const exportFiles = vi.fn();
const filesToZip = vi.fn();
vi.mock('../../../server/src/services/deliverables/bundleExportRuntime.js', () => ({
  exportBundleFiles: (...a: any[]) => exportFiles(...a),
  bundleFilesToZip: (...a: any[]) => filesToZip(...a),
  safeBundleBaseName: (c: string) => (c || 'material').replace(/[^a-zA-Z0-9]+/g, '_'),
}));

const { default: router } = await import(
  '../../../server/src/routes/deliverablesGenerations.routes.js'
);

const app = express();
app.use(express.json());
app.use('/api/deliverables/generations', router);

const BUNDLE_STUB = {
  spine: { meta: { company: 'Acme', language: 'PL' } },
  table: {}, doc: {}, deck: {}, produced: { table: true, doc: true, deck: true },
  quality: { passed: true, beauty: { overall: 0.8 }, content: { passed: true } },
};
const validBrief = { brief: 'To jest wystarczająco długi brief testowy do wygenerowania wiązki materiałów.' };

describe('W13.1 — POST /bundle', () => {
  beforeEach(() => {
    flags.ENABLE_DELIVERABLES_LIGHT = true; flags.ENABLE_DELIVERABLES_PREMIUM = true;
    genBundle.mockReset(); genBundle.mockResolvedValue(BUNDLE_STUB);
  });
  afterEach(() => vi.clearAllMocks());

  it('flag PREMIUM OFF → 404', async () => {
    flags.ENABLE_DELIVERABLES_PREMIUM = false;
    await request(app).post('/api/deliverables/generations/bundle').send(validBrief).expect(404);
    expect(genBundle).not.toHaveBeenCalled();
  });

  it('brief za krótki → 400 (zod)', async () => {
    await request(app).post('/api/deliverables/generations/bundle').send({ brief: 'krótki' }).expect(400);
  });

  it('happy path → 200 + bundle z quality', async () => {
    const res = await request(app).post('/api/deliverables/generations/bundle').send(validBrief).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.bundle.quality.passed).toBe(true);
    expect(genBundle).toHaveBeenCalledWith(validBrief.brief, expect.objectContaining({ preferPremium: true }));
  });

  it('spine null → 502', async () => {
    genBundle.mockResolvedValue(null);
    await request(app).post('/api/deliverables/generations/bundle').send(validBrief).expect(502);
  });
});

describe('W13.1 — POST /bundle/export (zip teczka)', () => {
  beforeEach(() => {
    flags.ENABLE_DELIVERABLES_LIGHT = true; flags.ENABLE_DELIVERABLES_PREMIUM = true;
    genBundle.mockReset(); genBundle.mockResolvedValue(BUNDLE_STUB);
    exportFiles.mockReset(); exportFiles.mockResolvedValue({
      docx: Buffer.from('PK docx'), xlsx: Buffer.from('PK xlsx'), pptx: Buffer.from('PK pptx'),
    });
    filesToZip.mockReset(); filesToZip.mockResolvedValue(Buffer.from('PK\x03\x04 zip payload here'));
  });
  afterEach(() => vi.clearAllMocks());

  it('flag PREMIUM OFF → 404', async () => {
    flags.ENABLE_DELIVERABLES_PREMIUM = false;
    await request(app).post('/api/deliverables/generations/bundle/export').send(validBrief).expect(404);
  });

  it('happy path → 200 application/zip + Content-Disposition; themeId przekazany', async () => {
    const res = await request(app)
      .post('/api/deliverables/generations/bundle/export')
      .send({ ...validBrief, themeId: 'modern' })
      .buffer(true)
      .parse((r: any, cb: any) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toMatch(/application\/zip/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    // body to realny bufor zip (PK magic) z naszego zamockowanego zip-payloadu
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(exportFiles).toHaveBeenCalledWith(BUNDLE_STUB, 'modern', undefined);
  });

  it('multipart fields use the same export contract', async () => {
    const res = await request(app)
      .post('/api/deliverables/generations/bundle/export')
      .field('brief', validBrief.brief)
      .field('themeId', 'modern')
      .expect(200);
    expect(res.headers['content-type']).toMatch(/application\/zip/);
    expect(exportFiles).toHaveBeenCalledWith(BUNDLE_STUB, 'modern', undefined);
  });

  it('malformed multipart fails closed instead of hanging', async () => {
    const res = await request(app)
      .post('/api/deliverables/generations/bundle/export')
      .set('Content-Type', 'multipart/form-data; boundary=broken-boundary')
      .send('--broken-boundary\r\nContent-Disposition: form-data; name="brief"\r\n');
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ success: false, code: 'invalid_upload' }));
    expect(genBundle).not.toHaveBeenCalled();
  });

  it('zero plików → 502', async () => {
    filesToZip.mockResolvedValue(null);
    await request(app).post('/api/deliverables/generations/bundle/export').send(validBrief).expect(502);
  });
});
