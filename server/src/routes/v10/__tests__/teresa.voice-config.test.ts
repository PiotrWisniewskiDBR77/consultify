import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mintGeminiLiveEphemeralTokenMock, resolveGeminiLiveServerKeyMock } = vi.hoisted(() => ({
  mintGeminiLiveEphemeralTokenMock: vi.fn(),
  resolveGeminiLiveServerKeyMock: vi.fn(),
}));

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../services/ai/geminiLiveTokenService.js', () => ({
  mintGeminiLiveEphemeralToken: mintGeminiLiveEphemeralTokenMock,
  resolveGeminiLiveServerKey: resolveGeminiLiveServerKeyMock,
}));

// Teresa has no DB worker row; the shared voice runtime resolver falls back to
// env config. Mock the worker lookup so the test stays hermetic (no DB).
vi.mock('../../../services/ai/virtualWorkerService.js', () => ({
  getWorkerWithProfile: vi.fn().mockResolvedValue(null),
}));

const { default: teresaV10Routes } = await import('../teresa.routes.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/teresa', teresaV10Routes);
  return app;
}

describe('V10 Teresa voice config', () => {
  const originalEnabled = process.env.TERESA_VOICE_ENABLED;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.TERESA_VOICE_ENABLED;
    else process.env.TERESA_VOICE_ENABLED = originalEnabled;
    mintGeminiLiveEphemeralTokenMock.mockReset();
    resolveGeminiLiveServerKeyMock.mockReset();
  });

  it('returns an explicit unavailable state when server-side voice key is missing', async () => {
    delete process.env.TERESA_VOICE_ENABLED;
    resolveGeminiLiveServerKeyMock.mockReturnValue('');

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

  it('returns enabled workspace voice config from a freshly minted ephemeral client token only', async () => {
    process.env.TERESA_VOICE_ENABLED = 'true';
    resolveGeminiLiveServerKeyMock.mockReturnValue('server-live-key');
    mintGeminiLiveEphemeralTokenMock.mockResolvedValue({
      clientToken: 'short-lived-client-token',
      tokenType: 'ephemeral',
      expiresAt: '2026-05-28T10:30:00.000Z',
      newSessionExpiresAt: '2026-05-28T10:01:00.000Z',
    });

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
    expect(mintGeminiLiveEphemeralTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assistant: 'teresa',
        subjectKey: 'user-1',
      })
    );
  });

  it('does not expose a long-lived server key when ephemeral minting fails', async () => {
    process.env.TERESA_VOICE_ENABLED = 'true';
    resolveGeminiLiveServerKeyMock.mockReturnValue('server-live-key');
    mintGeminiLiveEphemeralTokenMock.mockResolvedValue(null);

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
