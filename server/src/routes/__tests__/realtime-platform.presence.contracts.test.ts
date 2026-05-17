/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpsertPresence = vi.fn();
const mockListChannels = vi.fn();
const mockListPresence = vi.fn();
const mockHeartbeatPresence = vi.fn();
const mockUpsertToolPresence = vi.fn();
const mockListToolPresence = vi.fn();
const mockHeartbeatToolPresence = vi.fn();
const mockDisconnectToolPresence = vi.fn();

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
    upsertPresence: (...args: unknown[]) => mockUpsertPresence(...args),
    listChannels: (...args: unknown[]) => mockListChannels(...args),
    listPresence: (...args: unknown[]) => mockListPresence(...args),
    heartbeatPresence: (...args: unknown[]) => mockHeartbeatPresence(...args),
    upsertToolPresence: (...args: unknown[]) => mockUpsertToolPresence(...args),
    listToolPresence: (...args: unknown[]) => mockListToolPresence(...args),
    heartbeatToolPresence: (...args: unknown[]) => mockHeartbeatToolPresence(...args),
    disconnectToolPresence: (...args: unknown[]) => mockDisconnectToolPresence(...args),
  },
}));

import realtimePlatformRoutes from '../realtime-platform.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

describe('Realtime presence contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertPresence.mockResolvedValue({ ok: true });
    mockListChannels.mockResolvedValue([]);
    mockListPresence.mockResolvedValue([]);
    mockHeartbeatPresence.mockResolvedValue({ ok: true });
    mockUpsertToolPresence.mockResolvedValue({ ok: true });
    mockListToolPresence.mockResolvedValue([]);
    mockHeartbeatToolPresence.mockResolvedValue({ ok: true });
    mockDisconnectToolPresence.mockResolvedValue({ ok: true });
  });

  it('returns coded 400 for invalid channel presence payload', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/channels/ch-1/presence')
      .send({ cursorState: 'not-an-object' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_CHANNEL_PRESENCE_PAYLOAD_INVALID');
    expect(mockUpsertPresence).not.toHaveBeenCalled();
  });

  it('returns coded 503 when channel presence read fails', async () => {
    mockListPresence.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(createApp()).get('/api/realtime-v4/channels/ch-1/presence');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_CHANNEL_PRESENCE_READ_FAILED');
  });

  it('returns coded 400 for invalid tool-session presence payload', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/tool-sessions/sess-1/presence')
      .send({ cursorState: 123 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_PRESENCE_PAYLOAD_INVALID');
    expect(mockUpsertToolPresence).not.toHaveBeenCalled();
  });

  it('returns coded 503 when tool-session presence read fails', async () => {
    mockListToolPresence.mockRejectedValueOnce(new Error('db timeout'));

    const res = await request(createApp()).get('/api/realtime-v4/tool-sessions/sess-1/presence');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_PRESENCE_READ_FAILED');
  });

  it('returns coded 503 when tool-session heartbeat write fails', async () => {
    mockHeartbeatToolPresence.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(createApp())
      .post('/api/realtime-v4/tool-sessions/sess-1/heartbeat')
      .send({});

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_PRESENCE_WRITE_FAILED');
  });
});
