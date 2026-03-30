import { afterEach, describe, expect, it, vi } from 'vitest';

import { postPublicAnnaFunnelEvent } from '../../../src/services/publicAnnaAnalytics';

describe('publicAnnaAnalytics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts bounded public Anna funnel events to the backend seam', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await postPublicAnnaFunnelEvent('landing_anna_message_sent', {
      session_id: 'session-anna',
      sessionId: 'session-anna',
      locale: 'en',
      source: 'typed',
      messageLength: 42,
      historyLength: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/public/anna/funnel-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        eventName: 'landing_anna_message_sent',
        session_id: 'session-anna',
        cta_type: undefined,
        language: undefined,
        channel: undefined,
        turn_id: undefined,
        source_intent: undefined,
        sessionId: 'session-anna',
        locale: 'en',
        source: 'typed',
        messageLength: 42,
        historyLength: 3,
        fallbackReason: undefined,
        target: undefined,
        voiceStatus: undefined,
      }),
    });
  });

  it('skips posting when the session id is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await postPublicAnnaFunnelEvent('landing_anna_widget_opened', {
      session_id: '   ',
      sessionId: '   ',
      locale: 'en',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
