/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// H6.4 fail-soft: the two catch blocks in public-outreach.routes must return a
// structured { error, code } 500 instead of a bare `.send('Error')` string.
// We force DbPromise.get to reject so the handlers hit their catch branch.
const mockGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockGet(...a),
  run: vi.fn().mockResolvedValue(undefined),
  all: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({}),
}));

import outreachRoutes from '../public-outreach.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public/outreach', outreachRoutes);
  return app;
}

describe('public-outreach routes fail-soft (H6.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /unsubscribe returns structured { error, code } on DB failure (not bare 500)', async () => {
    mockGet.mockRejectedValueOnce(new Error('db down'));
    const res = await request(createApp()).get('/api/public/outreach/unsubscribe?token=abc');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: 'OUTREACH_UNSUBSCRIBE_FAILED' });
    expect(typeof res.body.error).toBe('string');
    // Prove it is JSON, not the old plain-text 'Error' body.
    expect(res.text).not.toBe('Error');
  });

  it('GET /track/click returns structured { error, code } on DB failure (not bare 500)', async () => {
    mockGet.mockRejectedValueOnce(new Error('db down'));
    const res = await request(createApp()).get(
      '/api/public/outreach/track/click?token=abc&url=https://example.com'
    );
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: 'OUTREACH_CLICK_TRACKING_FAILED' });
    expect(typeof res.body.error).toBe('string');
    expect(res.text).not.toBe('Error');
  });
});
