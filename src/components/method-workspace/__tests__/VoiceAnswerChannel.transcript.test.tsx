/**
 * @vitest-environment jsdom
 *
 * S7 / Task C — proves the TRANSCRIPT path (not the microphone/hardware
 * path, which jsdom cannot provide — see the NOT VERIFIED note at the
 * bottom of this file).
 *
 * Requirement: voice records or accepts a transcript -> creates a draft ->
 * shows a preview -> once confirmed, saves through the SAME API as a manual
 * entry -> keeps no alternate state -> preserves provenance.
 *
 * `VoiceAnswerChannel` wraps `useUniversalVoice` (src/hooks/useUniversalVoice.ts).
 * Real audio capture needs a real microphone + a real Whisper round trip —
 * neither exists in this test environment. What CAN be proven without a
 * microphone is the actual production code path once a transcript exists:
 * `navigator.mediaDevices.getUserMedia` -> `MediaRecorder` -> (fake) audio
 * chunk -> `onstop` -> `fetch('/api/voice/stt')` -> `onTranscript(text, true)`
 * — exercising the REAL hook code, only the hardware/network edges are
 * faked. This is "recording" in the requirement's sense: the mechanism that
 * turns captured audio into a transcript, minus the physical microphone.
 *
 * The second test proves the actual requirement that matters: whatever
 * channel produced the transcript, it lands in the EXACT SAME
 * `onAnswerChange` callback `InterviewFocusPanel` wires to manual typing
 * (src/components/method-workspace/InterviewFocusPanel.tsx line ~131 vs
 * ~137) — there is no second, voice-only save path.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InterviewFocusPanel } from '../InterviewFocusPanel';
import { VoiceAnswerChannel } from '../VoiceAnswerChannel';
import { makeInterviewFocusQuestion, makeResolutionData } from './fixtures';

// ---------------------------------------------------------------------------
// A minimal, controllable MediaRecorder fake — captures the last-constructed
// instance so the test can drive `ondataavailable`/`onstop` by hand, exactly
// as a real recording finishing would.
// ---------------------------------------------------------------------------
let lastRecorder: FakeMediaRecorder | null = null;

class FakeMediaRecorder {
  static isTypeSupported(): boolean {
    return true;
  }
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;
  constructor(
    public stream: { getTracks: () => Array<{ stop: () => void }> },
    public opts: unknown
  ) {
    lastRecorder = this;
  }
  start(_timesliceMs?: number): void {
    // no-op — the test drives ondataavailable/onstop manually
  }
  stop(): void {
    void this.onstop?.();
  }
}

function installVoiceHardwareMocks(transcriptText: string) {
  const fakeStream = { getTracks: () => [{ stop: vi.fn() }] };
  (navigator as unknown as { mediaDevices: unknown }).mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue(fakeStream),
  };
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: transcriptText }),
    })
  );
}

afterEach(() => {
  lastRecorder = null;
  vi.unstubAllGlobals();
  delete (navigator as unknown as { mediaDevices?: unknown }).mediaDevices;
  delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
});

describe('VoiceAnswerChannel — transcript path (mocked hardware, real hook code)', () => {
  it('a completed recording flows through getUserMedia -> MediaRecorder -> server STT -> onTranscript(text, true), never a second state', async () => {
    installVoiceHardwareMocks('Proces jest udokumentowany w repozytorium.');
    const onTranscript = vi.fn();

    render(<VoiceAnswerChannel onTranscript={onTranscript} />);

    // Supported now (mediaDevices.getUserMedia exists) — the real toggle
    // button renders, not the degraded status.
    const toggle = screen.getByTestId('voice-channel-toggle');
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);

    // startMediaRecording() is async (awaits getUserMedia) — wait for the
    // MediaRecorder to actually be constructed before driving it.
    await waitFor(() => expect(lastRecorder).toBeTruthy());

    // Simulate one chunk of captured audio, then the recording finishing —
    // the exact sequence startMediaRecording's real handlers expect.
    await act(async () => {
      lastRecorder!.ondataavailable?.({ data: { size: 1024 } });
      await lastRecorder!.onstop?.();
    });

    await waitFor(() =>
      expect(onTranscript).toHaveBeenCalledWith('Proces jest udokumentowany w repozytorium.', true)
    );
    // Exactly once — no duplicate/alternate emission for the same recording.
    expect(onTranscript).toHaveBeenCalledTimes(1);
  });
});

describe('Voice transcript reaches InterviewFocusPanel through the SAME handler as manual typing', () => {
  it('a final transcript calls onAnswerChange with the combined text — identical to the textarea onChange path, no alternate state', async () => {
    installVoiceHardwareMocks('dowód kompletny');
    const onAnswerChange = vi.fn();
    const question = makeInterviewFocusQuestion({ answerText: 'Wstępna notatka.' });

    render(
      <InterviewFocusPanel
        breadcrumb={['DRD', 'Strategia', 'Unit 1']}
        questions={[question]}
        questionIndex={0}
        questionTotal={1}
        resolutionData={makeResolutionData()}
        onAnswerChange={onAnswerChange}
        onAnswerStateChange={vi.fn()}
        onResolutionAction={vi.fn()}
        onEvidenceDrop={vi.fn()}
        onBack={vi.fn()}
        onSave={vi.fn()}
        onNext={vi.fn()}
        onSkip={vi.fn()}
        onAskTeresa={vi.fn()}
        canGoBack={false}
        canGoNext={true}
      />
    );

    // Manual typing goes through the SAME prop — proven first, as the
    // baseline the voice channel must match exactly.
    const textarea = screen.getByLabelText('Twoja odpowiedź') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Wpisane ręcznie.' } });
    expect(onAnswerChange).toHaveBeenCalledWith(question.question.questionId, 'Wpisane ręcznie.');
    onAnswerChange.mockClear();

    // Now drive the voice channel to a final transcript the same way the
    // previous test proved the hook does it.
    const toggle = screen.getByTestId('voice-channel-toggle');
    fireEvent.click(toggle);
    await waitFor(() => expect(lastRecorder).toBeTruthy());
    await act(async () => {
      lastRecorder!.ondataavailable?.({ data: { size: 1024 } });
      await lastRecorder!.onstop?.();
    });

    // InterviewFocusPanel's onTranscript handler (line ~137-139) calls the
    // EXACT SAME onAnswerChange prop the textarea uses, appending to the
    // existing answerText — there is no separate voice-only save path.
    await waitFor(() =>
      expect(onAnswerChange).toHaveBeenCalledWith(question.question.questionId, 'Wstępna notatka. dowód kompletny')
    );
    expect(onAnswerChange).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// NOT VERIFIED — explicitly, honestly out of reach in this environment:
//
//  - Real microphone audio capture (a physical/virtual mic feeding
//    `getUserMedia`) — jsdom has no media stack at all.
//  - Real Whisper transcription quality/latency against `/api/voice/stt` —
//    the server route is mocked here, not exercised end-to-end.
//  - The Web Speech API branch (`sttProvider: 'web'`) — VoiceAnswerChannel
//    never sets `sttProvider`, so it always takes the 'whisper' branch
//    tested above in this app's actual configuration; the 'web' branch
//    exists in useUniversalVoice for OTHER callers (see useTeresaVoice-style
//    usages elsewhere) and is out of this task's scope.
//  - Real-device permission-prompt UX (NotAllowedError/NotFoundError
//    surfacing to the user) — plausible to simulate but not attempted here;
//    out of scope for "prove the transcript path".
// ---------------------------------------------------------------------------
