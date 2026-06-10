/**
 * @vitest-environment jsdom
 *
 * TeresaTTSPlayer — server-routed read-aloud (Module 01, P1-1).
 *
 * Verifies the "talking Teresa" control:
 * - Renders a play affordance with the latest reply text.
 * - Calls the server TTS API and plays the returned audio on click.
 * - Hides itself (honest degradation) when the server reports TTS is unavailable.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TeresaTTSPlayer } from '../../../components/AIChat/TeresaTTSPlayer';

const { teresaSynthesizeSpeechMock } = vi.hoisted(() => ({
  teresaSynthesizeSpeechMock: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  Api: { teresaSynthesizeSpeech: teresaSynthesizeSpeechMock },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback || _k }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const playMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  teresaSynthesizeSpeechMock.mockReset();
  playMock.mockClear();
  // Minimal Audio stub.
  class FakeAudio {
    src = '';
    onended: unknown = null;
    onerror: unknown = null;
    play = playMock;
    pause = vi.fn();
  }
  // @ts-expect-error test stub
  global.Audio = FakeAudio;
  global.URL.createObjectURL = vi.fn(() => 'blob:teresa-tts');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TeresaTTSPlayer', () => {
  it('renders a read-aloud control for the latest reply', () => {
    render(<TeresaTTSPlayer text="Here is your summary." language="en" />);
    expect(screen.getByTestId('teresa-tts-player')).toBeTruthy();
    expect(screen.getByText('Read aloud')).toBeTruthy();
  });

  it('synthesizes and plays the text when clicked', async () => {
    teresaSynthesizeSpeechMock.mockResolvedValue(new Blob(['x'], { type: 'audio/wav' }));
    render(<TeresaTTSPlayer text="Read me please." language="en" />);

    await userEvent.click(screen.getByTestId('teresa-tts-player'));

    await waitFor(() => {
      expect(teresaSynthesizeSpeechMock).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Read me please.', language: 'en' })
      );
    });
    await waitFor(() => expect(playMock).toHaveBeenCalled());
  });

  it('hides itself when the server reports TTS is unavailable', async () => {
    const err: any = new Error('not configured');
    err.status = 503;
    err.reason = 'server_missing_gemini_live_key';
    teresaSynthesizeSpeechMock.mockRejectedValue(err);

    render(<TeresaTTSPlayer text="Try to read." language="en" autoPlay />);

    await waitFor(() => {
      expect(screen.queryByTestId('teresa-tts-player')).toBeNull();
    });
  });
});
