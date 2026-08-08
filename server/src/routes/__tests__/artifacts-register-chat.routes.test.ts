/**
 * DEC-1 (Harvard R1 #8) — Chat deliverable registry round-trip.
 *
 * Regression that closes the "split-brain" where a chat-generated deck/doc/sheet
 * never reached the M17 Outputs library. Verifies end-to-end via the router:
 *   1. POST /api/artifacts/register-chat writes an artifact with a back-reference
 *      (originRuntime + originRecordId=generationId, originSummary.sourceType=chat,
 *      sourceId=conversationId) mapped to the correct registry taxonomy per kind.
 *   2. GET /api/artifacts (the M17 list) returns that record, back-reference intact.
 *   3. Re-registering the same generationId is idempotent (no duplicate).
 *   4. Bad input (invalid kind / missing generationId) → 400.
 *
 * Strategy: middlewares are mocked pass-through with a deterministic user, and
 * artifactRegistryService is backed by a tiny in-memory store so registerArtifactOrigin
 * / listArtifactsForUser round-trip like the real service without a DB.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUser = { id: 'user-rc-1', organizationId: 'org-rc-A', role: 'CONSULTANT' };

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

vi.mock('../../middleware/v8Auth.middleware.js', () => ({
  requireV8OrgContext: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/v8FeatureGate.middleware.js', () => ({
  v8OutputsGate: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));

// In-memory registry store mirroring the real service's origin-link idempotency
// (unique per org + originRuntime + originRecordId).
interface StoredArtifact {
  artifactId: string;
  organizationId: string;
  outputType: string;
  artifactFamily: string;
  titleSnapshot: string | null;
  ownerUserId: string | null;
  originRuntime: string;
  originRecordId: string;
  originSummary: Record<string, unknown> | null;
  createdAt: string;
}

const store: StoredArtifact[] = [];
let seq = 0;

vi.mock('../../services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn(async (params: any) => {
    const existing = store.find(
      (a) =>
        a.organizationId === params.organizationId &&
        a.originRuntime === params.originRuntime &&
        a.originRecordId === params.originRecordId
    );
    if (existing) {
      existing.titleSnapshot = params.titleSnapshot ?? existing.titleSnapshot;
      existing.originSummary = params.originSummary ?? existing.originSummary;
      return existing;
    }
    const record: StoredArtifact = {
      artifactId: `artifact-${++seq}`,
      organizationId: params.organizationId,
      outputType: params.outputType,
      artifactFamily: params.artifactFamily,
      titleSnapshot: params.titleSnapshot ?? null,
      ownerUserId: params.ownerUserId ?? null,
      originRuntime: params.originRuntime,
      originRecordId: params.originRecordId,
      originSummary: params.originSummary ?? null,
      createdAt: new Date().toISOString(),
    };
    store.push(record);
    return record;
  }),
  listArtifactsForUser: vi.fn(async (params: any) => {
    return store
      .filter((a) => a.organizationId === params.organizationId)
      .filter((a) =>
        params?.filters?.outputType ? a.outputType === params.filters.outputType : true
      )
      .map((a) => ({
        ...a,
        resolvedTitle: a.titleSnapshot || 'Untitled',
      }));
  }),
  listMyWorkArtifacts: vi.fn(async () => ({ mine: [], review: [], recent: [] })),
  getArtifactByOrigin: vi.fn(async () => null),
}));

// Wave5 runtime is imported by the router but unused here.
vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  WAVE5_ARTIFACT_TYPES: [],
  WAVE5_ARTIFACT_LIFECYCLE: [],
  approveAndCommitWave5Mutation: vi.fn(),
  approveWave5Mutation: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  commitWave5Mutation: vi.fn(),
  createWave5Artifact: vi.fn(),
  fillWave5DocumentTemplate: vi.fn(),
  generateWave5StructuredArtifact: vi.fn(),
  getWave5Artifact: vi.fn(),
  listWave5Artifacts: vi.fn(),
  listWave5ArtifactVersions: vi.fn(),
  listWave5Mutations: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
  proposeWave5Mutation: vi.fn(),
  rejectWave5Mutation: vi.fn(),
}));

import artifactRoutes from '../artifacts.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/artifacts', artifactRoutes);
  return app;
}

beforeEach(() => {
  store.length = 0;
  seq = 0;
  vi.clearAllMocks();
});

describe('POST /api/artifacts/register-chat (DEC-1 chat deliverable back-reference)', () => {
  it('serves the authenticated Materials collection contract', async () => {
    const response = await request(createApp())
      .get('/api/artifacts?outputType=report&limit=200')
      .set('Authorization', 'Bearer authenticated-user');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [],
      total: 0,
      canonicalHome: 'outputs_library',
    });
  });

  it('registers a chat deck and it comes back from GET / with the back-reference', async () => {
    const app = createApp();

    const reg = await request(app).post('/api/artifacts/register-chat').send({
      kind: 'deck',
      generationId: 'gen-deck-1',
      title: 'Strategia wzrostu',
      conversationId: 'conv-42',
    });

    expect(reg.status).toBe(200);
    expect(reg.body.readBack.status).toBe('registered');
    expect(reg.body.readBack.sourceType).toBe('chat');
    expect(reg.body.readBack.sourceId).toBe('conv-42');
    expect(reg.body.data.outputType).toBe('presentation');
    expect(reg.body.data.artifactFamily).toBe('presentation');
    expect(reg.body.data.originRecordId).toBe('gen-deck-1');
    expect(reg.body.data.originSummary).toMatchObject({
      sourceType: 'chat',
      sourceId: 'conv-42',
      kind: 'deck',
    });

    const list = await request(app).get('/api/artifacts');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const item = list.body.data[0];
    expect(item.titleSnapshot).toBe('Strategia wzrostu');
    expect(item.originRecordId).toBe('gen-deck-1');
    expect(item.originSummary.sourceType).toBe('chat');
    expect(item.originSummary.sourceId).toBe('conv-42');
  });

  it('maps each chat kind to the right registry taxonomy', async () => {
    const app = createApp();
    const cases = [
      {
        kind: 'deck',
        outputType: 'presentation',
        artifactFamily: 'presentation',
        originRuntime: 'presentation',
      },
      {
        kind: 'doc',
        outputType: 'report',
        artifactFamily: 'document',
        originRuntime: 'native_artifact',
      },
      { kind: 'sheet', outputType: 'sheet', artifactFamily: 'sheet', originRuntime: 'sheet' },
    ];
    for (const [i, c] of cases.entries()) {
      const res = await request(app)
        .post('/api/artifacts/register-chat')
        .send({ kind: c.kind, generationId: `gen-${i}`, title: `T${i}`, conversationId: 'conv-1' });
      expect(res.status).toBe(200);
      expect(res.body.data.outputType).toBe(c.outputType);
      expect(res.body.data.artifactFamily).toBe(c.artifactFamily);
      expect(res.body.data.originRuntime).toBe(c.originRuntime);
    }
  });

  it('is idempotent for the same generationId (one deliverable, zero duplicates)', async () => {
    const app = createApp();
    const payload = { kind: 'doc', generationId: 'gen-dup', title: 'v1', conversationId: 'c' };

    await request(app).post('/api/artifacts/register-chat').send(payload);
    const second = await request(app)
      .post('/api/artifacts/register-chat')
      .send({ ...payload, title: 'v2' });

    expect(second.status).toBe(200);
    const list = await request(app).get('/api/artifacts');
    expect(list.body.data).toHaveLength(1);
    // Re-register updated the title in place.
    expect(list.body.data[0].titleSnapshot).toBe('v2');
  });

  it('rejects an invalid kind with 400', async () => {
    const res = await request(createApp())
      .post('/api/artifacts/register-chat')
      .send({ kind: 'poster', generationId: 'g', title: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects a missing generationId with 400', async () => {
    const res = await request(createApp())
      .post('/api/artifacts/register-chat')
      .send({ kind: 'deck', title: 'x' });
    expect(res.status).toBe(400);
  });
});
