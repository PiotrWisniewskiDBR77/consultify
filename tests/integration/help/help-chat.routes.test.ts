import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/services/ai/helpDocsContext.js', () => ({
  buildHelpDocsContext: vi.fn(async () => ({
    systemInstructionAddon: '\nKB: Use these docs.',
    citations: [{ id: 'kb-1', title: 'How to use Dashboard', link: '/kb/dashboard' }],
  })),
  isProductOrHowToQuery: vi.fn(() => true),
}));

const pipelineProcess = vi.fn(async () => ({ text: 'Hello from help AI.' }));

vi.mock('../../../server/src/services/ai/AIPipeline.js', () => ({
  AIPipeline: class AIPipeline {
    async process(...args: any[]) {
      return await pipelineProcess(...args);
    }
  },
}));

describe('Help chat routes (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  });

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/helpChat.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    pipelineProcess.mockImplementation(async () => ({ text: 'Hello from help AI.' }));
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/help', router });

  it('POST /api/help/chat returns AI response and KB sources', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp())
      .post('/api/help/chat')
      .send({
        message: 'How do I use the dashboard?',
        context: 'dashboard',
        history: [{ role: 'user', content: 'Hi' }],
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        message: expect.any(String),
        sources: expect.arrayContaining([expect.objectContaining({ id: 'kb-1', type: 'kb' })]),
      })
    );
  });

  it('POST /api/help/chat validates input', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).post('/api/help/chat').send({});
    expect(res.status).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        details: expect.any(Array),
      })
    );
  });

  it('POST /api/help/chat returns 500 when pipeline fails', async function () {
    if (!canListen) this.skip();
    pipelineProcess.mockImplementationOnce(async () => {
      throw new Error('boom');
    });
    const res = await request(makeApp()).post('/api/help/chat').send({ message: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        message: expect.any(String),
      })
    );
  });
});
