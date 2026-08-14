/**
 * @vitest-environment jsdom
 *
 * Voice is a third, equal input channel. When the browser has no speech
 * support (true for jsdom — no `navigator.mediaDevices`), the control must
 * show an explicit, controlled degradation message instead of silently
 * disappearing (test 13).
 *
 * CEL 6 / test 12: a FINAL transcript becomes a draft, shown as a preview,
 * and only reaches the caller's `onTranscript` — the SAME callback prop
 * `InterviewFocusPanel` wires into its manual `onAnswerChange` — after an
 * explicit human confirmation. Real microphone/speech-recognition audio is
 * NOT available in this environment (jsdom has no Web Speech API, and no
 * physical mic) — see the S4 report's "voice: NOT VERIFIED" note for the
 * exact boundary: everything from "a final transcript string exists" onward
 * (draft → preview → confirm → same callback) IS verified here; capturing
 * real audio into a transcript string is not.
 *
 * `useUniversalVoice` is mocked at the module boundary — same pattern
 * `drdHttpSessionRuntime.test.ts` uses for `methodCoreApi` — so these tests
 * exercise the REAL `VoiceAnswerChannel` component logic (the draft/preview
 * state machine) against a scripted hook, not a stand-in component.
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UseUniversalVoiceReturn } from '@/hooks/useUniversalVoice';

import { VoiceAnswerChannel } from '../VoiceAnswerChannel';

const hoisted = vi.hoisted(() => ({
  useUniversalVoice: vi.fn(),
}));

vi.mock('@/hooks/useUniversalVoice', () => ({
  useUniversalVoice: hoisted.useUniversalVoice,
}));

function makeHookReturn(overrides: Partial<UseUniversalVoiceReturn> = {}): UseUniversalVoiceReturn {
  return {
    state: {
      mode: 'idle',
      isListening: false,
      isSpeaking: false,
      isProcessing: false,
      transcript: '',
      interimTranscript: '',
      error: null,
      audioLevel: 0,
      recordingDuration: 0,
    },
    settings: {
      inputMode: 'click-to-talk',
      autoSendDelay: 1.5,
      ttsVoice: 'nova',
      ttsSpeed: 1,
      ttsProvider: 'openai',
      sttProvider: 'whisper',
      autoSpeakResponses: true,
      language: 'pl',
      showLiveTranscript: true,
    },
    isSupported: true,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    toggleListening: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    startConversation: vi.fn(),
    endConversation: vi.fn(),
    updateSettings: vi.fn(),
    getAvailableVoices: vi.fn(),
    testConnection: vi.fn(),
    ...overrides,
  };
}

describe('VoiceAnswerChannel', () => {
  beforeEach(() => {
    hoisted.useUniversalVoice.mockReset();
  });

  it('shows an explicit degradation message when speech APIs are unsupported (test 13)', () => {
    hoisted.useUniversalVoice.mockReturnValue(makeHookReturn({ isSupported: false }));
    render(<VoiceAnswerChannel onTranscript={vi.fn()} />);
    const degraded = screen.getByTestId('voice-channel-degraded');
    expect(degraded).toBeInTheDocument();
    expect(degraded).toHaveTextContent('Mowa niedostępna w tej przeglądarce');
    // The control is not silently gone — the toggle button is absent, replaced
    // by an explanatory status, never an empty gap.
    expect(screen.queryByTestId('voice-channel-toggle')).not.toBeInTheDocument();
  });

  it('shows the live interim transcript while listening, without writing it anywhere yet', () => {
    hoisted.useUniversalVoice.mockReturnValue(
      makeHookReturn({ state: { ...makeHookReturn().state, isListening: true, interimTranscript: 'w trakcie mówienia' } })
    );
    const onTranscript = vi.fn();
    render(<VoiceAnswerChannel onTranscript={onTranscript} />);
    expect(screen.getByTestId('voice-channel-interim')).toHaveTextContent('w trakcie mówienia');
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('a final transcript becomes a draft PREVIEW, not an immediate write (test 12, step 1)', () => {
    let capturedOnTranscript: ((text: string, isFinal: boolean) => void) | undefined;
    hoisted.useUniversalVoice.mockImplementation((opts: { onTranscript?: (t: string, f: boolean) => void }) => {
      capturedOnTranscript = opts.onTranscript;
      return makeHookReturn();
    });
    const onTranscript = vi.fn();
    render(<VoiceAnswerChannel onTranscript={onTranscript} />);

    expect(screen.queryByTestId('voice-channel-draft-preview')).not.toBeInTheDocument();
    act(() => {
      capturedOnTranscript?.('Proces jest opisany w dwóch dokumentach.', true);
    });

    expect(screen.getByTestId('voice-channel-draft-preview')).toBeInTheDocument();
    expect(screen.getByTestId('voice-channel-draft-text')).toHaveTextContent(
      'Proces jest opisany w dwóch dokumentach.'
    );
    // Preview shown — but NOT yet forwarded to the caller's answer state.
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it('confirming the draft calls onTranscript with isFinal=true and voice provenance — the SAME callback manual typing uses (test 12, step 2 + provenance)', async () => {
    const user = userEvent.setup();
    let capturedOnTranscript: ((text: string, isFinal: boolean) => void) | undefined;
    hoisted.useUniversalVoice.mockImplementation((opts: { onTranscript?: (t: string, f: boolean) => void }) => {
      capturedOnTranscript = opts.onTranscript;
      return makeHookReturn();
    });
    const onTranscript = vi.fn();
    render(<VoiceAnswerChannel onTranscript={onTranscript} />);

    act(() => {
      capturedOnTranscript?.('Dowód jest w repozytorium.', true);
    });
    const preview = screen.getByTestId('voice-channel-draft-preview');
    await user.click(within(preview).getByTestId('voice-channel-confirm'));

    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('Dowód jest w repozytorium.', true, { source: 'voice' });
    // Commit consumed the draft — the preview cannot be re-submitted twice.
    expect(screen.queryByTestId('voice-channel-draft-preview')).not.toBeInTheDocument();
  });

  it('discarding the draft never calls onTranscript — voice keeps no alternate state once discarded', async () => {
    const user = userEvent.setup();
    let capturedOnTranscript: ((text: string, isFinal: boolean) => void) | undefined;
    hoisted.useUniversalVoice.mockImplementation((opts: { onTranscript?: (t: string, f: boolean) => void }) => {
      capturedOnTranscript = opts.onTranscript;
      return makeHookReturn();
    });
    const onTranscript = vi.fn();
    render(<VoiceAnswerChannel onTranscript={onTranscript} />);

    act(() => {
      capturedOnTranscript?.('Coś niepewnego.', true);
    });
    const preview = screen.getByTestId('voice-channel-draft-preview');
    await user.click(within(preview).getByTestId('voice-channel-discard'));

    expect(onTranscript).not.toHaveBeenCalled();
    expect(screen.queryByTestId('voice-channel-draft-preview')).not.toBeInTheDocument();
  });
});
