/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateChannel = vi.fn();
const mockListChannels = vi.fn();
const mockGetChannel = vi.fn();
const mockDeleteChannel = vi.fn();
const mockCleanStalePresence = vi.fn();

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
    createChannel: (...args: unknown[]) => mockCreateChannel(...args),
    listChannels: (...args: unknown[]) => mockListChannels(...args),
    getChannel: (...args: unknown[]) => mockGetChannel(...args),
    deleteChannel: (...args: unknown[]) => mockDeleteChannel(...args),
    cleanStalePresence: (...args: unknown[]) => mockCleanStalePresence(...args),
  },
}));

import realtimePlatformRoutes from '../realtime-platform.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

describe('Realtime channel lifecycle contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateChannel.mockResolvedValue({ id: 'ch-1' });
    mockListChannels.mockResolvedValue([]);
    mockGetChannel.mockResolvedValue({ id: 'ch-1' });
    mockDeleteChannel.mockResolvedValue({ deleted: true });
    mockCleanStalePresence.mockResolvedValue({ cleaned: 0 });
  });

  it('returns coded 400 for invalid channel create payload', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/channels')
      .send({ channelType: 'workspace' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_CHANNEL_CREATE_PAYLOAD_INVALID');
    expect(mockCreateChannel).not.toHaveBeenCalled();
  });

  it('returns coded 503 when channel create fails on substrate', async () => {
    mockCreateChannel.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(createApp()).post('/api/realtime-v4/channels').send({
      channelType: 'workspace',
      resourceType: 'workspace',
      resourceId: 'ws-1',
    });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CHANNEL_CREATE_FAILED');
  });

  it('returns coded 503 when channel list fails on substrate', async () => {
    mockListChannels.mockRejectedValueOnce(new Error('sql timeout'));

    const res = await request(createApp()).get('/api/realtime-v4/channels');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CHANNEL_LIST_READ_FAILED');
  });

  it('returns coded 404 when channel lookup has no row', async () => {
    mockGetChannel.mockResolvedValueOnce(null);

    const res = await request(createApp()).get('/api/realtime-v4/channels/workspace/ws-1');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REALTIME_CHANNEL_NOT_FOUND');
  });

  it('returns coded 503 when channel lookup fails on substrate', async () => {
    mockGetChannel.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(createApp()).get('/api/realtime-v4/channels/workspace/ws-1');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CHANNEL_READ_FAILED');
  });

  it('returns coded 503 when channel delete fails on substrate', async () => {
    mockDeleteChannel.mockRejectedValueOnce(new Error('db is down'));

    const res = await request(createApp()).delete('/api/realtime-v4/channels/ch-1');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CHANNEL_DELETE_FAILED');
  });

  it('returns coded 503 when stale cleanup fails on substrate', async () => {
    mockCleanStalePresence.mockRejectedValueOnce(new Error('database timeout'));

    const res = await request(createApp()).post('/api/realtime-v4/presence/clean-stale');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CHANNEL_CLEAN_STALE_FAILED');
  });
});
