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

const { loggerInfoMock, mintGeminiLiveEphemeralTokenMock, resolveGeminiLiveServerKeyMock } =
  vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  mintGeminiLiveEphemeralTokenMock: vi.fn(),
  resolveGeminiLiveServerKeyMock: vi.fn(),
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

vi.mock('../../../services/ai/geminiLiveTokenService.js', () => ({
  mintGeminiLiveEphemeralToken: mintGeminiLiveEphemeralTokenMock,
  resolveGeminiLiveServerKey: resolveGeminiLiveServerKeyMock,
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
    mintGeminiLiveEphemeralTokenMock.mockReset();
    resolveGeminiLiveServerKeyMock.mockReset();
  });

  it('returns disabled voice config when GEMINI_API_KEY is missing', async () => {
    vi.stubEnv('TERESA_VOICE_NAME', '');
    resolveGeminiLiveServerKeyMock.mockReturnValue('');

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body.session).toBeNull();
    expect(res.body.voiceName).toBeNull();
  });

  it('returns enabled voice config when a server-minted ephemeral token is present', async () => {
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');
    resolveGeminiLiveServerKeyMock.mockReturnValue('server-key');
    mintGeminiLiveEphemeralTokenMock.mockResolvedValue({
      clientToken: 'short-lived-client-token',
      tokenType: 'ephemeral',
      expiresAt: '2026-05-28T10:30:00.000Z',
      newSessionExpiresAt: '2026-05-28T10:01:00.000Z',
    });

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body.session).toEqual(
      expect.objectContaining({
        clientToken: 'short-lived-client-token',
        tokenType: 'ephemeral',
      })
    );
    expect(res.body.voiceName).toBe('Kore');
  });

  it('strips leading zero-width characters from TERESA_VOICE_NAME', async () => {
    vi.stubEnv('TERESA_VOICE_NAME', '\u200bKore');
    resolveGeminiLiveServerKeyMock.mockReturnValue('server-key');
    mintGeminiLiveEphemeralTokenMock.mockResolvedValue({
      clientToken: 'short-lived-client-token',
      tokenType: 'ephemeral',
      expiresAt: '2026-05-28T10:30:00.000Z',
      newSessionExpiresAt: '2026-05-28T10:01:00.000Z',
    });

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.voiceName).toBe('Kore');
  });

  it('sets no-store cache headers for voice-config response', async () => {
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');
    resolveGeminiLiveServerKeyMock.mockReturnValue('server-key');
    mintGeminiLiveEphemeralTokenMock.mockResolvedValue({
      clientToken: 'short-lived-client-token',
      tokenType: 'ephemeral',
      expiresAt: '2026-05-28T10:30:00.000Z',
      newSessionExpiresAt: '2026-05-28T10:01:00.000Z',
    });

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/i);
    expect(res.headers.pragma).toBe('no-cache');
  });

  it('does not expose a long-lived server key when ephemeral minting fails', async () => {
    vi.stubEnv('TERESA_VOICE_NAME', 'Kore');
    resolveGeminiLiveServerKeyMock.mockReturnValue('server-key');
    mintGeminiLiveEphemeralTokenMock.mockResolvedValue(null);

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body.session).toBeNull();
    expect(res.body.voiceName).toBe('Kore');
    expect(res.body.unavailableReason).toBe('server_voice_proxy_required');
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
