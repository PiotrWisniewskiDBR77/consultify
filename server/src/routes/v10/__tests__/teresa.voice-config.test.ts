import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

const { default: teresaV10Routes } = await import('../teresa.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/teresa', teresaV10Routes);
  return app;
}

describe('V10 Teresa voice config', () => {
  const originalGeminiLive = process.env.GEMINI_LIVE_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalGoogle = process.env.GOOGLE_AI_API_KEY;
  const originalEnabled = process.env.TERESA_VOICE_ENABLED;
  const originalEphemeral = process.env.GEMINI_LIVE_EPHEMERAL_TOKEN;

  afterEach(() => {
    if (originalGeminiLive === undefined) delete process.env.GEMINI_LIVE_API_KEY;
    else process.env.GEMINI_LIVE_API_KEY = originalGeminiLive;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
    if (originalGoogle === undefined) delete process.env.GOOGLE_AI_API_KEY;
    else process.env.GOOGLE_AI_API_KEY = originalGoogle;
    if (originalEnabled === undefined) delete process.env.TERESA_VOICE_ENABLED;
    else process.env.TERESA_VOICE_ENABLED = originalEnabled;
    if (originalEphemeral === undefined) delete process.env.GEMINI_LIVE_EPHEMERAL_TOKEN;
    else process.env.GEMINI_LIVE_EPHEMERAL_TOKEN = originalEphemeral;
  });

  it('returns an explicit unavailable state when server-side voice key is missing', async () => {
    delete process.env.GEMINI_LIVE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.TERESA_VOICE_ENABLED;
    delete process.env.GEMINI_LIVE_EPHEMERAL_TOKEN;

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        assistant: 'teresa',
        surface: 'workspace_copilot',
        enabled: false,
        session: null,
        unavailableReason: 'server_missing_gemini_live_key',
      })
    );
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body.boundaries).toEqual(
      expect.objectContaining({
        silentActions: false,
        approvalRequiredForWrites: true,
      })
    );
  });

  it('returns enabled workspace voice config from an ephemeral client token only', async () => {
    process.env.GEMINI_LIVE_API_KEY = 'server-live-key';
    process.env.GEMINI_LIVE_EPHEMERAL_TOKEN = 'short-lived-client-token';
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    process.env.TERESA_VOICE_ENABLED = 'true';

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        assistant: 'teresa',
        surface: 'workspace_copilot',
        capability: 'voice',
        enabled: true,
        unavailableReason: null,
      })
    );
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body.session).toEqual(
      expect.objectContaining({
        clientToken: 'short-lived-client-token',
        tokenType: 'ephemeral',
      })
    );
  });

  it('does not expose a long-lived server key when only server Gemini config exists', async () => {
    process.env.GEMINI_LIVE_API_KEY = 'server-live-key';
    delete process.env.GEMINI_LIVE_EPHEMERAL_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
    process.env.TERESA_VOICE_ENABLED = 'true';

    const res = await request(createApp()).get('/api/v10/teresa/voice-config');

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('apiKey');
    expect(res.body).toEqual(
      expect.objectContaining({
        enabled: false,
        session: null,
        unavailableReason: 'server_voice_proxy_required',
      })
    );
  });

  it('accepts bounded Teresa voice telemetry events', async () => {
    const res = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      eventName: 'voice_unavailable',
      status: 'error',
      unavailableReason: 'server_missing_gemini_live_key',
    });

    expect(res.status).toBe(202);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        assistant: 'teresa',
        surface: 'workspace_copilot',
        capability: 'voice',
      })
    );
  });

  it('rejects invalid Teresa voice telemetry events', async () => {
    const invalidName = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      eventName: 'voice_secret_leak',
      status: 'error',
    });
    expect(invalidName.status).toBe(400);
    expect(invalidName.body.code).toBe('TERESA_VOICE_EVENT_INVALID');

    const invalidDuration = await request(createApp()).post('/api/v10/teresa/voice-event').send({
      eventName: 'voice_stopped',
      durationSeconds: -1,
    });
    expect(invalidDuration.status).toBe(400);
    expect(invalidDuration.body.code).toBe('TERESA_VOICE_EVENT_INVALID');
  });
});
