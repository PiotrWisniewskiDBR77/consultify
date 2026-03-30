import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../middleware/rateLimiting.middleware.js', () => ({
  defaultRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

const run = vi.fn().mockResolvedValue({ changes: 1, lastID: 'x' });
vi.mock('../../../utils/DbPromise.js', () => ({
  run,
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('uuid', () => ({
  v4: () => 'uuid-1',
}));

async function importRouter() {
  const mod = await import('../../public-contact.routes.js');
  return mod.default;
}

async function createApp(): Promise<Express> {
  const app = express();
  app.use(express.json());
  const router = await importRouter();
  app.use('/api/public/contact', router);
  return app;
}

describe('Public contact intake route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/public/contact accepts a valid request and records it', async () => {
    const app = await createApp();

    const res = await request(app).post('/api/public/contact').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines Inc.',
      type: 'sales',
      message: 'Please contact me about a demo.',
      locale: 'en',
      annaCta: {
        session_id: 'sess-1',
        cta_type: 'contact',
        language: 'en',
        channel: 'text',
        turn_id: 'turn-9',
        source_intent: 'talk_to_human',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'uuid-1' });
    expect(run).toHaveBeenCalled();
  });

  it('POST /api/public/contact rejects invalid payloads', async () => {
    const app = await createApp();

    const res = await request(app).post('/api/public/contact').send({
      name: '',
      email: 'not-an-email',
      type: 'sales',
      message: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid contact request');
  });
});

