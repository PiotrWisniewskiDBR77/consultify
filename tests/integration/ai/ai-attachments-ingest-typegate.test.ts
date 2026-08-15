import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// The repository-wide lightweight multer stand-in intentionally bypasses
// fileFilter. This suite verifies the real MIME boundary, so it must use the
// production package (same convention as the route-level ingest suite).
vi.unmock('multer');

/**
 * M01 / L-03 (S3 ingest) — multer fileFilter accept/reject gate.
 *
 * The sibling test `ai-attachments-ingest.test.ts` exercises the handler body
 * (text / PDF / DOCX extraction, missing-file 400) but every upload it sends is
 * an ALLOWED type — it never drives the `fileFilter` at
 * `server/src/routes/ai.routes.ts:281-292`, which is the real boundary deciding
 * which MIME types may reach extraction/persistence at all.
 *
 * This locks two contracts:
 *   1. Rejection — disallowed binary types are refused with "Unsupported file
 *      type: <mime>" BEFORE the handler runs, so the gate fails closed (no
 *      knowledge_docs write, no org-context attachment record).
 *   2. Whitelist — the structured allow-list (application/json, text/csv,
 *      text/markdown) and the `text/*` prefix path are accepted and ingested.
 */

vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as any;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = { id: 'e2e-user-id', organizationId: 'e2e-org-id', role: 'ADMIN' };
      req.userId = 'e2e-user-id';
      req.organizationId = 'e2e-org-id';
      next();
    },
  };
});

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    aiRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

const mockDbRun = vi.fn().mockResolvedValue(undefined);
const recordAttachmentExtraction = vi.fn().mockResolvedValue({ itemId: 'ctx-doc-1' });
vi.mock('../../../server/src/utils/DbPromise.js', async () => {
  const actual = (await vi.importActual('../../../server/src/utils/DbPromise.js')) as any;
  return {
    ...actual,
    run: (...args: any[]) => mockDbRun(...args),
  };
});

vi.mock('../../../server/src/services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    recordAttachmentExtraction: (...args: any[]) => recordAttachmentExtraction(...args),
  },
}));

vi.mock('../../../server/src/services/ragService.js', () => ({
  default: {
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  },
}));

const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.ts');

// Terminal JSON error handler — mirrors the app's real errorHandlerMiddleware so
// a multer fileFilter rejection surfaces as JSON instead of Express's HTML 500.
const makeApp = () => {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/ai', aiRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(400).json({ error: err?.message || 'error' });
  });
  return app;
};

describe('AI attachments ingest — fileFilter type gate (M01/L-03 · S3)', () => {
  beforeEach(() => {
    mockDbRun.mockClear();
    recordAttachmentExtraction.mockClear();
  });

  it.each([
    ['image/png', 'shot.png'],
    ['application/zip', 'bundle.zip'],
    ['application/octet-stream', 'firmware.bin'],
  ])('rejects disallowed type %s before any persistence (fails closed)', async (mime, filename) => {
    const res = await request(makeApp())
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('binary-ish payload'), { filename, contentType: mime });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/i);
    // Gate is BEFORE the handler — nothing is extracted, embedded, or recorded.
    expect(mockDbRun).not.toHaveBeenCalled();
    expect(recordAttachmentExtraction).not.toHaveBeenCalled();
  });

  it.each([
    ['application/json', 'data.json', '{"a":1,"b":2}'],
    ['text/csv', 'rows.csv', 'a,b\n1,2\n3,4'],
    ['text/markdown', 'doc.md', '# Title\n\nBody paragraph with content.'],
  ])('accepts whitelisted type %s and ingests it', async (mime, filename, body) => {
    const res = await request(makeApp())
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from(body, 'utf8'), { filename, contentType: mime });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        docId: expect.any(String),
        filename,
        mimeType: mime,
        totalChunks: expect.any(Number),
      })
    );
    expect(res.body.totalChunks).toBeGreaterThan(0);
    expect(recordAttachmentExtraction).toHaveBeenCalled();
  });
});
