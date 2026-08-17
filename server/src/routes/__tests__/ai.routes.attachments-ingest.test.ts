/**
 * M01-006 (Chat citation panel) — verifying the two currently-untested
 * ingest paths a grounded citation depends on: `POST /ai/attachments/ingest`
 * (file) and `POST /ai/attachments/ingest-url` (URL). Neither had ANY test
 * before this packet, despite both routes existing and looking complete on
 * code review (extraction → chunk → embed → `knowledge_docs`/
 * `knowledge_chunks` insert, `organization_id` set in the SAME INSERT per the
 * M01-P04C fix comment on both handlers).
 *
 * Scope: route-level contract (request → DB write shape + response shape),
 * with `DbPromise`/`ragService`/`organizationContextService`/`aiPolicyEngine`
 * mocked out — this repo's existing pattern for route tests on files this
 * size (see `routes/v8/__tests__/public-anna.citations-contract.test.ts`).
 * Not a real-Postgres test: `ai.routes.ts` is a 9500+ line router with a huge
 * transitive import graph; wiring a full DB-backed integration harness for it
 * was judged out of proportion for this packet. The DB-shape assertions below
 * (organization_id present on the INSERT, chunk rows keyed to the right
 * doc_id) are the load-bearing part of "does ingest work", and they don't
 * need a live database to verify.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbRun = vi.fn().mockResolvedValue({ success: true });
const dbAll = vi.fn().mockResolvedValue([]);
const dbGet = vi.fn().mockResolvedValue(undefined);
vi.mock('../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRun(...args),
  all: (...args: unknown[]) => dbAll(...args),
  get: (...args: unknown[]) => dbGet(...args),
}));

const pgQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
const pgRelease = vi.fn();
vi.mock('../../database/PostgresDatabase.js', () => ({
  getPoolClientForPinnedTransaction: vi.fn().mockResolvedValue({
    query: (...args: unknown[]) => pgQuery(...args),
    release: () => pgRelease(),
  }),
}));

const generateEmbedding = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
vi.mock('../../services/ragService.js', () => ({
  default: { generateEmbedding: (...args: unknown[]) => generateEmbedding(...args) },
}));

const extractTextFromBuffer = vi.fn().mockResolvedValue('');
vi.mock('../../services/pdfParserService.js', () => ({
  default: { extractTextFromBuffer: (...args: unknown[]) => extractTextFromBuffer(...args) },
}));

const recordAttachmentExtraction = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/organizationContext/OrganizationContextService.js', () => ({
  default: {
    recordAttachmentExtraction: (...args: unknown[]) => recordAttachmentExtraction(...args),
  },
}));

const requireActiveTenantMembership = vi.fn((req: any, res: any, next: any) => {
  if (req.headers['x-test-membership'] === 'revoked') {
    return res.status(403).json({ code: 'ACTIVE_MEMBERSHIP_REQUIRED' });
  }
  next();
});
vi.mock('../../middleware/auditsStrictMembership.middleware.js', () => ({
  requireActiveTenantMembership: (req: any, res: any, next: any) =>
    requireActiveTenantMembership(req, res, next),
}));

const getEffectivePolicy = vi.fn().mockResolvedValue({ internetEnabled: true });
vi.mock('../../services/aiPolicyEngine.js', () => ({
  default: { getEffectivePolicy: (...args: unknown[]) => getEffectivePolicy(...args) },
}));

// Auth: bypass real JWT verification, inject a fixed org/user like every
// other route-level test in this repo that exercises `verifyToken`-guarded
// routes without a real token.
vi.mock('../../middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.userId = 'user-ingest-1';
      req.organizationId = 'org-ingest-1';
      next();
    },
  };
});

async function createApp(): Promise<Express> {
  const app = express();
  app.use(express.json());
  const mod = await import('../ai.routes.js');
  const router = (mod as any).default || mod;
  app.use('/api/ai', router);
  return app;
}

describe('POST /ai/attachments/ingest (file ingest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true });
    pgQuery.mockResolvedValue({ rows: [], rowCount: 1 });
    generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    requireActiveTenantMembership.mockClear();
  });

  it('runs the active-membership wall after identity and multipart parsing but before durable writes', async () => {
    const app = await createApp();
    const denied = await request(app)
      .post('/api/ai/attachments/ingest')
      .set('x-test-membership', 'revoked')
      .attach('file', Buffer.from('must not be parsed'), {
        filename: 'denied.txt',
        contentType: 'text/plain',
      });

    expect(denied.status).toBe(403);
    expect(requireActiveTenantMembership).toHaveBeenCalledTimes(1);
    expect(requireActiveTenantMembership.mock.calls[0]?.[0]).toMatchObject({
      userId: 'user-ingest-1',
      organizationId: 'org-ingest-1',
    });
    expect(dbRun).not.toHaveBeenCalled();
    expect(recordAttachmentExtraction).not.toHaveBeenCalled();
  });

  it('extracts text, chunks + embeds it, and persists the doc scoped to the caller org', async () => {
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('Five workstreams are governed by one supervisor.'), {
        filename: 'operating-model.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.docId).toBe('string');
    expect(res.body.docId.length).toBeGreaterThan(0);
    expect(res.body.filename).toBe('operating-model.txt');
    expect(res.body.extractionStatus).toBe('extracted');
    expect(res.body.totalChunks).toBeGreaterThanOrEqual(1);

    // The doc row must be born with organization_id already set (M01-P04C —
    // single INSERT, not a follow-up UPDATE that could silently no-op and
    // leave the row ownerless).
    const docInsertCall = pgQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO knowledge_docs'));
    expect(docInsertCall).toBeDefined();
    const [, docParams] = docInsertCall as [string, unknown[]];
    expect(docParams).toContain('org-ingest-1');
    expect(docParams).toContain(res.body.docId);

    // At least one chunk row keyed to the same doc_id.
    const chunkInsertCall = pgQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO knowledge_chunks')
    );
    expect(chunkInsertCall).toBeDefined();
    const [, chunkParams] = chunkInsertCall as [string, unknown[]];
    expect(chunkParams).toContain(res.body.docId);
    expect(generateEmbedding).toHaveBeenCalled();
    expect(pgQuery.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['BEGIN', 'COMMIT'])
    );
    expect(pgRelease).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['document', 'INSERT INTO knowledge_docs'],
    ['chunk', 'INSERT INTO knowledge_chunks'],
  ])('rolls back and returns non-2xx when the %s write fails', async (_label, failingSql) => {
    pgQuery.mockImplementation(async (sql: unknown) => {
      if (String(sql).includes(String(failingSql))) throw new Error('forced write failure');
      return { rows: [], rowCount: 1 };
    });
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('Durable governed source.'), {
        filename: 'failure.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(pgQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(recordAttachmentExtraction).not.toHaveBeenCalled();
    expect(pgQuery.mock.calls.some((call) => call[0] === 'COMMIT')).toBe(false);
    expect(pgRelease).toHaveBeenCalledTimes(1);
  });

  it('rolls back and returns non-2xx when governed claim creation fails', async () => {
    recordAttachmentExtraction.mockRejectedValueOnce(new Error('forced claim failure'));
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('Durable governed source.'), {
        filename: 'claim-failure.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(pgQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(pgQuery.mock.calls.some((call) => call[0] === 'COMMIT')).toBe(false);
    expect(pgRelease).toHaveBeenCalledTimes(1);
  });

  it('rejects with 400 when no readable text can be extracted (empty file)', async () => {
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest')
      .attach('file', Buffer.from('not-readable-as-pdf'), {
        filename: 'empty.pdf',
        contentType: 'application/pdf',
      });

    expect({ status: res.status, body: res.body }).toEqual({
      status: 400,
      body: expect.objectContaining({ code: 'PDF_TEXT_EXTRACTION_FAILED' }),
    });
    expect(extractTextFromBuffer).toHaveBeenCalledTimes(1);
  });
});

describe('POST /ai/attachments/ingest-url (URL ingest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true });
    generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    getEffectivePolicy.mockResolvedValue({ internetEnabled: true });
  });

  it('fetches the URL, extracts + chunks + embeds the page, and persists it scoped to the caller org', async () => {
    const html =
      '<html><head><title>Operating Model Overview</title></head>' +
      '<body><p>Five workstreams are governed by one supervisor.</p></body></html>';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://example.com/operating-model',
        headers: { get: (h: string) => (h === 'content-type' ? 'text/html; charset=utf-8' : null) },
        arrayBuffer: async () => Buffer.from(html, 'utf8'),
      })
    );

    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest-url')
      .send({ url: 'https://example.com/operating-model' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.docId).toBe('string');
    // Title comes from the fetched page's <title>, not the raw URL — proves
    // real extraction happened, not just a passthrough of the input.
    expect(res.body.filename).toBe('Operating Model Overview');
    expect(res.body.totalChunks).toBeGreaterThanOrEqual(1);

    const docInsertCall = dbRun.mock.calls.find((c) => String(c[0]).includes('INSERT INTO knowledge_docs'));
    expect(docInsertCall).toBeDefined();
    const [, docParams] = docInsertCall as [string, unknown[]];
    expect(docParams).toContain('org-ingest-1');

    vi.unstubAllGlobals();
  });

  it('blocks ingestion when org policy has internet access disabled', async () => {
    getEffectivePolicy.mockResolvedValue({ internetEnabled: false });
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest-url')
      .send({ url: 'https://example.com/whatever' });

    expect(res.status).toBe(403);
  });

  it('rejects a non-http(s) URL before attempting any fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/attachments/ingest-url')
      .send({ url: 'ftp://example.com/file' });

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
