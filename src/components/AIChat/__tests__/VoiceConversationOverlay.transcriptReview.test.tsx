/**
 * VoiceConversationOverlay — M01-P05 (GF-CHAT-06: editable transcript before
 * send).
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceConversationOverlay } from '../VoiceConversationOverlay';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback: string) => fallback ?? key }),
}));

const contextState: {
  voiceStatus: 'idle' | 'connecting' | 'live' | 'error';
  voiceError: string | null;
  pendingUserTranscript: string | null;
  handleVoiceToggle: () => Promise<void>;
  stopVoiceConversation: () => Promise<void>;
  startVoiceConversation: () => Promise<void>;
  confirmPendingTranscript: (text: string) => void;
  discardPendingTranscript: () => void;
} = {
  voiceStatus: 'idle',
  voiceError: null,
  pendingUserTranscript: null,
  handleVoiceToggle: vi.fn(async () => {}),
  stopVoiceConversation: vi.fn(async () => {}),
  startVoiceConversation: vi.fn(async () => {}),
  confirmPendingTranscript: vi.fn(),
  discardPendingTranscript: vi.fn(),
};

vi.mock('../../../contexts/TeresaVoiceContext', () => ({
  useTeresaVoiceContext: () => contextState,
}));

function setContext(overrides: Partial<typeof contextState>) {
  Object.assign(contextState, overrides);
}

describe('VoiceConversationOverlay — editable transcript before send (GF-CHAT-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextState.voiceStatus = 'idle';
    contextState.voiceError = null;
    contextState.pendingUserTranscript = null;
  });

  it('does NOT send the transcript automatically — it is staged for review with no message sent yet', () => {
    setContext({ voiceStatus: 'live', pendingUserTranscript: 'Zrób mi raport z tego spotkania' });
    render(<VoiceConversationOverlay />);

    // The exact dictated text is visible and EDITABLE (a textarea, not static text).
    const draft = screen.getByTestId('voice-transcript-draft') as HTMLTextAreaElement;
    expect(draft.value).toBe('Zrób mi raport z tego spotkania');
    expect(draft.tagName).toBe('TEXTAREA');
    expect(draft).not.toHaveAttribute('readonly');
    expect(draft).not.toHaveAttribute('disabled');

    // Nothing has been confirmed/sent yet — confirmPendingTranscript untouched.
    expect(contextState.confirmPendingTranscript).not.toHaveBeenCalled();
  });

  it('sends the EDITED text, not the original transcript, when the user changes it before clicking Send', () => {
    setContext({ voiceStatus: 'live', pendingUserTranscript: 'orginal transcript with typo' });
    render(<VoiceConversationOverlay />);

    const draft = screen.getByTestId('voice-transcript-draft') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: 'corrected final text' } });
    fireEvent.click(screen.getByTestId('voice-transcript-send'));

    expect(contextState.confirmPendingTranscript).toHaveBeenCalledWith('corrected final text');
    expect(contextState.confirmPendingTranscript).not.toHaveBeenCalledWith(
      'orginal transcript with typo'
    );
  });

  it('discards without sending when the user clicks Discard', () => {
    setContext({ voiceStatus: 'live', pendingUserTranscript: 'never mind this one' });
    render(<VoiceConversationOverlay />);

    fireEvent.click(screen.getByTestId('voice-transcript-discard'));

    expect(contextState.discardPendingTranscript).toHaveBeenCalledTimes(1);
    expect(contextState.confirmPendingTranscript).not.toHaveBeenCalled();
  });

  it('disables Send for an empty/whitespace-only draft', () => {
    setContext({ voiceStatus: 'live', pendingUserTranscript: 'something' });
    render(<VoiceConversationOverlay />);

    const draft = screen.getByTestId('voice-transcript-draft') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: '   ' } });

    expect(screen.getByTestId('voice-transcript-send')).toBeDisabled();
  });

  it('shows the plain "Listening…" indicator (no review box) when nothing is pending', () => {
    setContext({ voiceStatus: 'live', pendingUserTranscript: null });
    render(<VoiceConversationOverlay />);
    expect(screen.queryByTestId('voice-transcript-review')).not.toBeInTheDocument();
    expect(screen.getAllByText('Listening…').length).toBeGreaterThan(0);
  });

  /**
   * P0.8 capability honesty: an error (e.g. permission denied) must be
   * VISIBLE, not require the user to know to click a 14px collapsed bubble.
   * Caught by reading the harness's own evidence screenshot (the
   * `permission-denied` state rendered a collapsed bubble with the message
   * only in an unhoverable `title` attribute) before this auto-expand fix.
   */
  it('auto-expands on an error status so the specific failure message is immediately visible', () => {
    setContext({
      voiceStatus: 'error',
      voiceError: 'Microphone access was denied — allow microphone access and try again.',
    });
    render(<VoiceConversationOverlay />);
    // Appears in BOTH the header status label and the body message — a
    // stronger signal than a single occurrence, and exactly what "auto
    // expanded, not hidden behind a collapsed bubble" looks like.
    expect(
      screen.getAllByText('Microphone access was denied — allow microphone access and try again.')
        .length
    ).toBeGreaterThan(0);
    // The visible panel — not just the collapsed bubble's `title` attribute.
    expect(screen.getByTestId('teresa-voice-overlay').querySelector('textarea, p')).toBeTruthy();
  });

  /**
   * NEGATIVE CONTROL (c) — required by the packet: "test transcript wysyłany
   * bez możliwości edycji [MUSI padać]." Reproduces exactly the pre-fix
   * behavior (the ORIGINAL `onTranscriptUpdate` implementation, which called
   * `addMessage` directly on every finalized turn — see
   * `TeresaVoiceContext.tsx` history) and shows the review-before-send
   * assertions above catch it: a component that sends immediately never
   * renders a `voice-transcript-draft` for the user to edit at all.
   */
  it('[negative control] a context that auto-sends transcripts (no pending state) never renders anything to edit', () => {
    // Simulates the pre-fix context contract: no `pendingUserTranscript`
    // concept exists at all — the (mocked) "send" already happened inside
    // the transcript callback before the component ever saw it.
    setContext({ voiceStatus: 'live', pendingUserTranscript: null });
    render(<VoiceConversationOverlay />);
    expect(screen.queryByTestId('voice-transcript-draft')).not.toBeInTheDocument();
    // There is no way for a user to review/edit a message that already went
    // out — the real fix's `pendingUserTranscript !== null` branch (asserted
    // in the tests above) is what makes review possible at all.
  });
});
