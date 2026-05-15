/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateCrdtDocument = vi.fn();
const mockGetCrdtDocument = vi.fn();
const mockSaveCrdtSnapshot = vi.fn();
const mockAppendCrdtUpdate = vi.fn();
const mockGetCrdtUpdates = vi.fn();

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.user = { id: 'user-1', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../services/realtimePlatformService.js', () => ({
  realtimePlatformService: {
    createCrdtDocument: (...args: unknown[]) => mockCreateCrdtDocument(...args),
    getCrdtDocument: (...args: unknown[]) => mockGetCrdtDocument(...args),
    saveCrdtSnapshot: (...args: unknown[]) => mockSaveCrdtSnapshot(...args),
    appendCrdtUpdate: (...args: unknown[]) => mockAppendCrdtUpdate(...args),
    getCrdtUpdates: (...args: unknown[]) => mockGetCrdtUpdates(...args),
  },
}));

import realtimePlatformRoutes from '../realtime-platform.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

describe('Realtime CRDT contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCrdtDocument.mockResolvedValue({ docId: 'doc-1' });
    mockGetCrdtDocument.mockResolvedValue({ docId: 'doc-1' });
    mockSaveCrdtSnapshot.mockResolvedValue({ ok: true });
    mockAppendCrdtUpdate.mockResolvedValue({ sequence: 1 });
    mockGetCrdtUpdates.mockResolvedValue([]);
  });

  it('returns coded 400 for invalid CRDT create payload', async () => {
    const res = await request(createApp()).post('/api/realtime-v4/crdt/documents').send({
      resourceType: 'whiteboard',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_CRDT_DOCUMENT_CREATE_PAYLOAD_INVALID');
    expect(mockCreateCrdtDocument).not.toHaveBeenCalled();
  });

  it('returns coded 400 for invalid CRDT snapshot payload', async () => {
    const res = await request(createApp())
      .put('/api/realtime-v4/crdt/documents/doc-1/snapshot')
      .send({ stateVector: 'sv-1' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_CRDT_SNAPSHOT_PAYLOAD_INVALID');
    expect(mockSaveCrdtSnapshot).not.toHaveBeenCalled();
  });

  it('returns coded 400 for invalid CRDT update payload', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/crdt/documents/doc-1/updates')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_CRDT_UPDATE_PAYLOAD_INVALID');
    expect(mockAppendCrdtUpdate).not.toHaveBeenCalled();
  });

  it('returns coded 503 when CRDT update append fails on substrate', async () => {
    mockAppendCrdtUpdate.mockRejectedValueOnce(new Error('sql timeout'));

    const res = await request(createApp())
      .post('/api/realtime-v4/crdt/documents/doc-1/updates')
      .send({ updateData: 'dGVzdA==', originClientId: 'client-1' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CRDT_SUBSTRATE_UNAVAILABLE');
  });

  it('returns coded 404 when CRDT document is missing', async () => {
    mockGetCrdtDocument.mockResolvedValueOnce(null);

    const res = await request(createApp()).get('/api/realtime-v4/crdt/documents/whiteboard/idea-1');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REALTIME_CRDT_DOCUMENT_NOT_FOUND');
  });
});
