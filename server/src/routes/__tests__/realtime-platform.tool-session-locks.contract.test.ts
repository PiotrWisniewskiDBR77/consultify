/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAcquireEditLock = vi.fn();
const mockReleaseEditLock = vi.fn();
const mockListEditLocks = vi.fn();

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
    acquireEditLock: (...args: unknown[]) => mockAcquireEditLock(...args),
    releaseEditLock: (...args: unknown[]) => mockReleaseEditLock(...args),
    listEditLocks: (...args: unknown[]) => mockListEditLocks(...args),
  },
}));

import realtimePlatformRoutes from '../realtime-platform.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/realtime-v4', realtimePlatformRoutes);
  return app;
}

describe('Realtime tool-session locks contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAcquireEditLock.mockResolvedValue({ acquired: true });
    mockReleaseEditLock.mockResolvedValue({ released: true });
    mockListEditLocks.mockResolvedValue([]);
  });

  it('returns coded 400 for invalid lock payload', async () => {
    const res = await request(createApp())
      .post('/api/realtime-v4/tool-sessions/sess-1/locks')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_LOCK_PAYLOAD_INVALID');
    expect(mockAcquireEditLock).not.toHaveBeenCalled();
  });

  it('returns coded 409 when lock is already held', async () => {
    mockAcquireEditLock.mockResolvedValueOnce({ acquired: false, lockedBy: 'user-2' });

    const res = await request(createApp())
      .post('/api/realtime-v4/tool-sessions/sess-1/locks')
      .send({ blockId: 'block-1' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_LOCK_HELD');
    expect(res.body.lockedBy).toBe('user-2');
  });

  it('returns coded 503 when lock listing fails due to db outage', async () => {
    mockListEditLocks.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(createApp()).get('/api/realtime-v4/tool-sessions/sess-1/locks');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE');
  });

  it('returns coded 503 when lock release fails due to db outage', async () => {
    mockReleaseEditLock.mockRejectedValueOnce(new Error('db timeout'));

    const res = await request(createApp()).delete(
      '/api/realtime-v4/tool-sessions/sess-1/locks/block-1'
    );

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('REALTIME_TOOL_SESSION_LOCKS_UNAVAILABLE');
  });
});
