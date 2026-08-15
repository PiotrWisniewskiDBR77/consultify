import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { unavailableSynthesize } = vi.hoisted(() => ({
  unavailableSynthesize: vi.fn().mockRejectedValue(new Error('API key not configured')),
}));

vi.mock('../../../server/src/services/ai/VoiceService.js', () => ({
  voiceService: {
    synthesize: unavailableSynthesize,
    transcribe: vi.fn(),
  },
  detectSttProviderFromEnv: vi.fn(() => ({ available: false, provider: null })),
  STT_ENV_KEYS: ['OPENAI_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY'],
}));

describe('Voice routes (unavailable is explicit)', () => {
  const basePath = '/api/voice';
  let router: any;

  const makeApp = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/voice.routes.ts')).default;
  });

  it('POST /api/voice/tts returns 503 when TTS is not configured (no 500)', async () => {
    const res = await request(makeApp())
      .post(`${basePath}/tts`)
      .send({ text: 'hello', voice: 'alloy' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
