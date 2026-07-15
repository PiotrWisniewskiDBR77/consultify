import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const process_ = vi.fn();

vi.mock('../../../server/src/services/ai/AIPipeline.js', () => {
  class MockAIPipeline {
    static getInstance() {
      return new MockAIPipeline();
    }
    process(...args: any[]) {
      return process_(...args);
    }
  }
  return { AIPipeline: MockAIPipeline };
});

describe('AI routes: /smart-followup (REAL integration)', () => {
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
    router = (await import('../../../server/src/routes/ai/smart-followup.routes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origBypass === undefined) delete process.env.ENABLE_TEST_AUTH_BYPASS;
    else process.env.ENABLE_TEST_AUTH_BYPASS = origBypass;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/ai/smart-followup', router });

  it('POST / falls back to heuristic suggestions for short responses (no LLM call)', async function () {
    if (!canListen) this.skip();

    const res = await request(makeApp()).post('/api/ai/smart-followup').send({
      question: 'What is the ROI?',
      response: 'Short answer.',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(process_).not.toHaveBeenCalled();
  });

  it('POST / routes long responses through AIPipeline with organizationId/userId forwarded', async function () {
    if (!canListen) this.skip();

    process_.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify([
        { text: 'Dig deeper into the ROI drivers?', type: 'deepDive' },
        { text: 'Compare against last quarter?', type: 'comparison' },
        { text: 'What should we do next?', type: 'action' },
      ]),
    });

    const longResponse =
      'This is a long AI response about ROI, budget and cost that exceeds fifty characters.';

    const res = await request(makeApp()).post('/api/ai/smart-followup').send({
      question: 'What is the ROI?',
      response: longResponse,
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(process_).toHaveBeenCalledTimes(1);
    const [pipelineRequest] = process_.mock.calls[0];
    expect(pipelineRequest.organizationId).toBe('test-org-id');
    expect(pipelineRequest.userId).toBe('test-user-id');
    expect(pipelineRequest.capability).toBe('chat');
    expect(pipelineRequest.options.dedicatedSystemPrompt).toBe(true);
    expect(res.body.suggestions).toHaveLength(3);
    expect(res.body.suggestions[0].text).toBe('Dig deeper into the ROI drivers?');
  });

  it('POST / rejects an empty response body', async function () {
    if (!canListen) this.skip();

    const res = await request(makeApp())
      .post('/api/ai/smart-followup')
      .send({ question: 'Q', response: '' });

    expect(res.status).toBe(400);
  });
});
