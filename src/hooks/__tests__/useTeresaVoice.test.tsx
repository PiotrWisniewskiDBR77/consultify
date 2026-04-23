import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTeresaVoice } from '../useTeresaVoice';

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
      <button
        type="button"
        onClick={() => {
          void voice.startVoiceConversation();
        }}
      >
        start
      </button>
    </div>
  );
}

describe('useTeresaVoice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    (globalThis as any).AudioContext = class AudioContextMock {} as any;
    (navigator as any).mediaDevices = { getUserMedia: vi.fn() };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: true,
        apiKey: 'server-key',
        voiceName: 'Kore',
      }),
    } as any);
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

  it('enters error state when started without a resolved API key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: false,
        apiKey: null,
      }),
    } as any);

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
});

