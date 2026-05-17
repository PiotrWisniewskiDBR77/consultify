import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTeresaVoice } from '../useTeresaVoice';

type LiveCallbacks = {
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (message: unknown) => void;
};

let latestLiveCallbacks: LiveCallbacks | null = null;
const { sessionCloseMock } = vi.hoisted(() => ({
  sessionCloseMock: vi.fn(),
}));
let sendClientContentMock = vi.fn();
let sendRealtimeInputMock = vi.fn();
let lastProcessorNode: {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onaudioprocess:
    | ((event: { inputBuffer: { getChannelData: (channel: number) => Float32Array } }) => void)
    | null;
} | null = null;

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    live = {
      connect: ({ callbacks }: { callbacks: LiveCallbacks }) => {
        latestLiveCallbacks = callbacks;
        return Promise.resolve({
          sendRealtimeInput: sendRealtimeInputMock,
          sendClientContent: sendClientContentMock,
          close: () => {
            sessionCloseMock();
            latestLiveCallbacks?.onclose?.();
          },
        });
      },
    };
  }

  return {
    GoogleGenAI,
    Modality: {
      AUDIO: 'AUDIO',
    },
  };
});

function Harness() {
  const voice = useTeresaVoice({
    enabled: true,
    language: 'pl',
    systemInstruction: 'test',
  });

  return (
    <div>
      <div data-testid="available">{String(voice.voiceAvailable)}</div>
      <div data-testid="status">{voice.voiceStatus}</div>
      <div data-testid="error">{voice.voiceError || ''}</div>
      <div data-testid="muted">{String(voice.isMuted)}</div>
      <button
        type="button"
        onClick={() => {
          void voice.startVoiceConversation();
        }}
      >
        start
      </button>
      <button
        type="button"
        onClick={() => {
          void voice.stopVoiceConversation();
        }}
      >
        stop
      </button>
      <button type="button" onClick={voice.toggleMute}>
        mute
      </button>
    </div>
  );
}

function HarnessWithApiKey({ apiKey }: { apiKey?: string | null }) {
  const voice = useTeresaVoice({
    enabled: true,
    language: 'pl',
    systemInstruction: 'test',
    apiKey,
  });

  return <div data-testid="available">{String(voice.voiceAvailable)}</div>;
}

function HarnessWithToggleableEnabled() {
  const [enabled, setEnabled] = React.useState(true);
  const voice = useTeresaVoice({
    enabled,
    language: 'pl',
    systemInstruction: 'test',
    apiKey: 'client-key',
  });

  return (
    <div>
      <div data-testid="status">{voice.voiceStatus}</div>
      <button
        type="button"
        onClick={() => {
          void voice.startVoiceConversation();
        }}
      >
        start
      </button>
      <button type="button" onClick={() => setEnabled(false)}>
        disable
      </button>
    </div>
  );
}

describe('useTeresaVoice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    latestLiveCallbacks = null;
    sessionCloseMock.mockReset();
    sendClientContentMock = vi.fn();
    sendRealtimeInputMock = vi.fn();
    lastProcessorNode = null;

    const globalWithAudioContext = globalThis as unknown as { AudioContext?: unknown };
    globalWithAudioContext.AudioContext = class AudioContextMock {
      currentTime = 0;
      destination = {};
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect: vi.fn() };
      }
      createScriptProcessor() {
        const processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
        lastProcessorNode = processor;
        return processor;
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
      json: async () => ({
        enabled: true,
        apiKey: 'server-key',
        voiceName: 'Kore',
      }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches v10 voice-config and marks voice as available when key is present', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v10/teresa/voice-config', {
        credentials: 'include',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });
  });

  it('falls back to server voice-config when provided apiKey is whitespace-only', async () => {
    render(<HarnessWithApiKey apiKey="   " />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v10/teresa/voice-config', {
        credentials: 'include',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });
  });

  it('enters error state when started without a resolved API key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: false,
        apiKey: null,
      }),
    } as Response);

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('false');
    });

    act(() => {
      screen.getByText('start').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
      expect(screen.getByTestId('error').textContent).toMatch(/Voice unavailable/i);
    });
  });

  it('keeps voice unavailable when server config is explicitly disabled', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: false,
        apiKey: 'server-key-should-not-enable-ui',
        voiceName: 'Kore',
      }),
    } as Response);

    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('false');
    });
  });

  it('posts a non-blocking voice-event telemetry call when stop is triggered', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v10/teresa/voice-config', {
        credentials: 'include',
      });
    });

    act(() => {
      screen.getByText('stop').click();
    });

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/v10/teresa/voice-event', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event: 'session_stopped' }),
      });
    });
  });

  it('does not emit session_closed telemetry during unmount cleanup', async () => {
    const view = render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('start').click();
    });

    const beforeUnmountClosedEvents = vi.mocked(globalThis.fetch).mock.calls.filter((call) => {
      return (
        call[0] === '/api/v10/teresa/voice-event' &&
        typeof call[1]?.body === 'string' &&
        call[1].body.includes('session_closed')
      );
    }).length;

    await act(async () => {
      view.unmount();
    });

    const afterUnmountClosedEvents = vi.mocked(globalThis.fetch).mock.calls.filter((call) => {
      return (
        call[0] === '/api/v10/teresa/voice-event' &&
        typeof call[1]?.body === 'string' &&
        call[1].body.includes('session_closed')
      );
    }).length;

    expect(afterUnmountClosedEvents).toBe(beforeUnmountClosedEvents);
  });

  it('does not throw when realtime audio payload is invalid base64', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('start').click();
    });

    await waitFor(() => {
      expect(latestLiveCallbacks).not.toBeNull();
    });

    expect(() =>
      latestLiveCallbacks?.onmessage?.({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { mimeType: 'audio/pcm', data: '!!!not-valid-base64!!!' } }],
          },
        },
      })
    ).not.toThrow();
  });

  it('does not throw when realtime audio payload decodes to odd-byte PCM data', async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('start').click();
    });

    await waitFor(() => {
      expect(latestLiveCallbacks).not.toBeNull();
    });

    expect(() =>
      latestLiveCallbacks?.onmessage?.({
        serverContent: {
          modelTurn: {
            parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'AA==' } }],
          },
        },
      })
    ).not.toThrow();
  });

  it('ignores non-string transcript values in server message', async () => {
    const onTranscriptUpdate = vi.fn((text: string) => {
      text.trim();
    });

    function HarnessWithTranscriptCallback() {
      const voice = useTeresaVoice({
        enabled: true,
        language: 'pl',
        systemInstruction: 'test',
        onTranscriptUpdate,
      });
      return (
        <div>
          <div data-testid="transcript-available">{String(voice.voiceAvailable)}</div>
          <button
            type="button"
            onClick={() => {
              void voice.startVoiceConversation();
            }}
          >
            start-transcript
          </button>
        </div>
      );
    }

    render(<HarnessWithTranscriptCallback />);

    await waitFor(() => {
      expect(screen.getByTestId('transcript-available').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('start-transcript').click();
    });

    await waitFor(() => {
      expect(latestLiveCallbacks).not.toBeNull();
    });

    expect(() =>
      latestLiveCallbacks?.onmessage?.({
        serverContent: {
          inputTranscript: 12345,
        },
      })
    ).not.toThrow();

    expect(onTranscriptUpdate).not.toHaveBeenCalled();
  });

  it('tears down active voice session when hook becomes disabled', async () => {
    render(<HarnessWithToggleableEnabled />);

    await act(async () => {
      screen.getByText('start').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connecting');
    });

    await act(async () => {
      screen.getByText('disable').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('idle');
      expect(sessionCloseMock).toHaveBeenCalled();
    });
  });

  it('keeps mute toggle state consistent on rapid double toggle', async () => {
    render(<Harness />);

    await act(async () => {
      screen.getByText('start').click();
    });

    act(() => {
      screen.getByText('mute').click();
      screen.getByText('mute').click();
    });

    expect(screen.getByTestId('muted').textContent).toBe('false');
  });

  it('swallows sendTextHistory promise rejection without breaking runtime', async () => {
    sendClientContentMock = vi.fn().mockRejectedValue(new Error('send failed'));

    function VoiceHistoryHarness() {
      const voice = useTeresaVoice({
        enabled: true,
        language: 'pl',
        systemInstruction: 'test',
      });
      return (
        <div>
          <div data-testid="history-available">{String(voice.voiceAvailable)}</div>
          <button
            type="button"
            onClick={() => {
              void voice.startVoiceConversation();
            }}
          >
            start-history
          </button>
          <button
            type="button"
            onClick={() => voice.sendTextHistory([{ role: 'user', content: 'hello' }])}
          >
            send-history
          </button>
        </div>
      );
    }

    render(<VoiceHistoryHarness />);

    await waitFor(() => {
      expect(screen.getByTestId('history-available').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('start-history').click();
    });

    await act(async () => {
      screen.getByText('send-history').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendClientContentMock).toHaveBeenCalled();
  });

  it('swallows rejected sendRealtimeInput calls in mic processing loop', async () => {
    sendRealtimeInputMock = vi.fn().mockRejectedValue(new Error('rt failed'));
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId('available').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('start').click();
    });

    await waitFor(() => {
      expect(latestLiveCallbacks).not.toBeNull();
    });

    await act(async () => {
      latestLiveCallbacks?.onopen?.();
    });

    await waitFor(() => {
      expect(lastProcessorNode?.onaudioprocess).toBeTypeOf('function');
    });

    expect(() => {
      lastProcessorNode?.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.1, -0.2, 0.3, -0.4]),
        },
      });
    }).not.toThrow();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendRealtimeInputMock).toHaveBeenCalled();
  });
});
