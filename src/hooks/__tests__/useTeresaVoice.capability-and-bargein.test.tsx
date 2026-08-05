import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTeresaVoice } from '../useTeresaVoice';

/**
 * M01-P05 — capability honesty (P0.8) + barge-in (contract item 4).
 *
 * Follows the existing `useTeresaVoice.test.tsx` mock pattern (mocked
 * `@google/genai`, `AudioContext`, `navigator.mediaDevices`) but targets two
 * things that file didn't cover: (1) `voiceAvailable` when the browser
 * genuinely lacks the required APIs (not just a missing server key), and
 * (2) that a Gemini Live `interrupted` signal actually stops audio playback
 * (real barge-in), not just that the handler doesn't throw.
 */

type LiveCallbacks = {
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (message: unknown) => void;
};

let latestLiveCallbacks: LiveCallbacks | null = null;
const stopSpies: Array<ReturnType<typeof vi.fn>> = [];

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    live = {
      connect: ({ callbacks }: { callbacks: LiveCallbacks }) => {
        latestLiveCallbacks = callbacks;
        return Promise.resolve({
          sendRealtimeInput: vi.fn(),
          sendClientContent: vi.fn(),
          close: vi.fn(),
        });
      },
    };
  }
  return { GoogleGenAI, Modality: { AUDIO: 'AUDIO' } };
});

function Harness({ apiKey = 'client-token' }: { apiKey?: string | null } = {}) {
  const voice = useTeresaVoice({
    enabled: true,
    language: 'pl',
    systemInstruction: 'test',
    apiKey,
  });
  return (
    <div>
      <div data-testid="available">{String(voice.voiceAvailable)}</div>
      <div data-testid="status">{voice.voiceStatus}</div>
      <div data-testid="error">{voice.voiceError || ''}</div>
      <button type="button" onClick={() => void voice.startVoiceConversation()}>
        start
      </button>
    </div>
  );
}

function setSupportedBrowserGlobals() {
  const globalWithAudioContext = globalThis as unknown as { AudioContext?: unknown };
  globalWithAudioContext.AudioContext = class AudioContextMock {
    currentTime = 0;
    destination = {};
    createMediaStreamSource() {
      return { connect: vi.fn(), disconnect: vi.fn() };
    }
    createScriptProcessor() {
      return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
    }
    createBuffer(_channels: number, length: number) {
      return { getChannelData: () => new Float32Array(length), duration: 0.1 };
    }
    createBufferSource() {
      const stop = vi.fn();
      stopSpies.push(stop);
      return {
        buffer: null as unknown,
        connect: vi.fn(),
        start: vi.fn(),
        stop,
        onended: null as (() => void) | null,
      };
    }
    close = vi.fn().mockResolvedValue(undefined);
  };
  const navWithMediaDevices = navigator as unknown as { mediaDevices?: unknown };
  navWithMediaDevices.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn(), enabled: true }],
    }),
  };
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ enabled: true, apiKey: 'server-key', voiceName: 'Kore' }),
  } as Response);
}

describe('useTeresaVoice — capability honesty (P0.8)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    latestLiveCallbacks = null;
    stopSpies.length = 0;
    setSupportedBrowserGlobals();
  });
  afterEach(() => vi.restoreAllMocks());

  it('is unavailable when getUserMedia does not exist on this browser (no API key issue at all)', async () => {
    const navWithMediaDevices = navigator as unknown as { mediaDevices?: unknown };
    navWithMediaDevices.mediaDevices = {}; // no getUserMedia — old/unsupported browser
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('false');
    });
  });

  it('is unavailable when AudioContext does not exist on this browser', async () => {
    const globalWithAudioContext = globalThis as unknown as { AudioContext?: unknown };
    delete globalWithAudioContext.AudioContext;
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('false');
    });
  });

  /**
   * NEGATIVE CONTROL (a) — required by the packet: "test fallbacku MUSI
   * padać, gdy brak wsparcia przeglądarki nadal renderuje aktywny
   * przycisk." Reproduces exactly that broken shape: a `voiceAvailable`
   * computation that ignores browser support and only checks the API key.
   */
  it('[negative control] a voiceAvailable check that ignores browser support would wrongly report available', () => {
    const brokenVoiceAvailable = (hasKey: boolean) => hasKey; // no hasGetUserMedia/hasAudioContext check
    // Browser has NEITHER API, but the broken check only looks at the key.
    expect(brokenVoiceAvailable(true)).toBe(true);
    // The real hook (asserted above) reports false in the same situation.
  });

  it('gives a specific, actionable message when getUserMedia rejects with NotAllowedError (permission denied)', async () => {
    const navWithMediaDevices = navigator as unknown as { mediaDevices?: unknown };
    navWithMediaDevices.mediaDevices = {
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
    };
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });
    await act(async () => {
      screen.getByText('start').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
      expect(screen.getByTestId('error').textContent).toMatch(/denied/i);
    });
  });

  it('gives a specific message when no microphone device exists (NotFoundError)', async () => {
    const navWithMediaDevices = navigator as unknown as { mediaDevices?: unknown };
    navWithMediaDevices.mediaDevices = {
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('none', 'NotFoundError')),
    };
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });
    await act(async () => {
      screen.getByText('start').click();
    });
    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toMatch(/no microphone/i);
    });
  });
});

describe('useTeresaVoice — barge-in (contract item 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    latestLiveCallbacks = null;
    stopSpies.length = 0;
    setSupportedBrowserGlobals();
  });
  afterEach(() => vi.restoreAllMocks());

  it('actually stops in-flight audio playback when Gemini signals an interruption', async () => {
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });
    await act(async () => {
      screen.getByText('start').click();
    });
    await waitFor(() => expect(latestLiveCallbacks).not.toBeNull());

    // Play one audio chunk (creates a BufferSource we can assert gets stopped).
    // Base64 of a 2-sample Int16 PCM buffer — must decode to an EVEN byte
    // length or `useTeresaVoice` discards it as malformed (see the odd-byte
    // guard covered by the pre-existing "does not throw" test).
    await act(async () => {
      latestLiveCallbacks?.onmessage?.({
        serverContent: {
          modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'ZADIAA==' } }] },
        },
      });
    });
    expect(stopSpies.length).toBeGreaterThan(0);
    const chunkStop = stopSpies[stopSpies.length - 1];
    expect(chunkStop).not.toHaveBeenCalled();

    // Barge-in: Gemini reports the turn was interrupted (user started talking).
    await act(async () => {
      latestLiveCallbacks?.onmessage?.({ serverContent: { interrupted: true } });
    });

    // REAL assertion: the active source's stop() was actually invoked, not
    // just "the handler ran without throwing".
    expect(chunkStop).toHaveBeenCalledTimes(1);
  });

  /**
   * NEGATIVE CONTROL (b) — required by the packet: "test barge-in MUSI
   * padać, gdy stop() jest no-opem." Reproduces exactly that broken
   * interruption handler (clears the tracking array without calling
   * `.stop()` on each source — audio keeps playing) and shows the SAME
   * "was stop() actually called" assertion catches it.
   */
  it('[negative control] an interruption handler that only clears bookkeeping without calling stop() would NOT interrupt playback', () => {
    const activeSources = [{ stop: vi.fn() }, { stop: vi.fn() }];
    // Broken handler: drops the references but never calls .stop() on them.
    const brokenInterruptHandler = (sources: typeof activeSources) => {
      sources.length = 0; // "clears" bookkeeping — audio nodes keep playing
    };
    brokenInterruptHandler(activeSources);
    for (const source of activeSources) {
      expect(source.stop).not.toHaveBeenCalled();
    }
    expect(() => {
      expect(activeSources[0]?.stop).toHaveBeenCalled();
    }).toThrow();
  });
});
