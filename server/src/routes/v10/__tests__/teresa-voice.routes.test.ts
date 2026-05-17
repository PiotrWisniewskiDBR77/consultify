import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import inputSanitizationMiddleware from '../../../middleware/inputSanitization.middleware.js';

type MockAuthRequest = {
  userId?: string;
  organizationId?: string;
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
};

const { loggerInfoMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
}));

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: ((req: MockAuthRequest, _res: unknown, next: () => void) => {
    req.userId = 'voice-user';
    req.organizationId = 'voice-org';
    req.user = {
      id: 'voice-user',
      organizationId: 'voice-org',
      role: 'ADMIN',
    };
    next();
  }) satisfies RequestHandler,
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: loggerInfoMock,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
  },
}));

import router from '../teresa-voice.routes.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(inputSanitizationMiddleware);
  app.use('/api/v10/teresa', router);
  return app;
}

describe('v10 teresa voice routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    loggerInfoMock.mockReset();
  });

  it('returns disabled voice config when GEMINI_API_KEY is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('TERESA_VOICE_NAME', '');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.apiKey).toBeNull();
    expect(res.body.voiceName).toBeNull();
  });

  it('returns enabled voice config when GEMINI_API_KEY is present', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gem-key-123');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('gem-key-123');
    expect(res.body.voiceName).toBe('Kore');
  });

  it('strips leading zero-width characters from GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', '\u200bgem-key-123');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('gem-key-123');
  });

  it('strips leading zero-width characters from TERESA_VOICE_NAME', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gem-key-123');
    vi.stubEnv('TERESA_VOICE_NAME', '\u200bKore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.voiceName).toBe('Kore');
  });

  it('sets no-store cache headers for voice-config response', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gem-key-123');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/i);
    expect(res.headers.pragma).toBe('no-cache');
  });

  it('returns disabled voice config when GEMINI_API_KEY is placeholder', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY_HERE');
    vi.stubEnv('TERESA_VOICE_NAME', '');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.apiKey).toBeNull();
  });

  it('treats placeholder markers case-insensitively in GEMINI_API_KEY', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'MY-PLACEHOLDER-KEY');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.apiKey).toBeNull();
  });

  it('returns enabled voice config when only GOOGLE_AI_API_KEY is present', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-ai-only-key');
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('google-ai-only-key');
    expect(res.body.voiceName).toBe('Kore');
  });

  it('falls back to GOOGLE_AI_API_KEY when GEMINI_API_KEY is whitespace-only', async () => {
    vi.stubEnv('GEMINI_API_KEY', '   \n');
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-ai-fallback-key');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('google-ai-fallback-key');
  });

  it('falls back to GOOGLE_AI_API_KEY when GEMINI_API_KEY is placeholder', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'YOUR_GEMINI_API_KEY_HERE');
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-ai-fallback-key');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('google-ai-fallback-key');
  });

  it('returns disabled voice config when only GOOGLE_API_KEY is present', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_AI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', 'google-api-only-key');
    vi.stubEnv('TERESA_VOICE_NAME', '');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.apiKey).toBeNull();
    expect(res.body.voiceName).toBeNull();
  });

  it('prefers GEMINI_API_KEY when both Gemini env vars are set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'gemini-wins');
    vi.stubEnv('GOOGLE_AI_API_KEY', 'google-ai-loses');
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.apiKey).toBe('gemini-wins');
  });

  it('accepts voice-event telemetry payloads', async () => {
    const res = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      event: 'session_closed',
      sessionId: 'sess-1',
      durationMs: 1234,
    });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      accepted: true,
      event: 'session_closed',
    });
  });

  it('normalizes numeric event values', async () => {
    const res = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      event: 42,
    });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      accepted: true,
      event: '42',
    });
  });

  it('sanitizes telemetry event strings via global input middleware', async () => {
    const res = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      event: 'ok&pause',
    });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      accepted: true,
      event: 'ok&amp;pause',
    });
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '[V10 Teresa Voice] Event received',
      expect.objectContaining({
        event: 'ok&amp;pause',
      })
    );
  });

  it('truncates oversized telemetry event payloads', async () => {
    const res = await request(createApp())
      .post('/api/v10/teresa/voice-event')
      .send({
        event: 'a'.repeat(400),
      });

    expect(res.status).toBe(202);
    expect(res.body.accepted).toBe(true);
    expect(res.body.event).toHaveLength(256);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '[V10 Teresa Voice] Event received',
      expect.objectContaining({
        event: 'a'.repeat(256),
      })
    );
  });

  it('treats numeric sessionId as present in telemetry logs', async () => {
    const res = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      event: 'session_closed',
      sessionId: 12345,
    });

    expect(res.status).toBe(202);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '[V10 Teresa Voice] Event received',
      expect.objectContaining({
        event: 'session_closed',
        hasSessionId: true,
      })
    );
  });
});
