/**
 * VoiceAnswerChannel — voice as a THIRD, equal input channel into the same
 * answer-text state as manual typing and Teresa's proposals (A5 spec §9).
 *
 * Wraps the existing `useUniversalVoice` hook (src/hooks/useUniversalVoice.ts)
 * instead of re-implementing STT — the shell only adds the honest-degradation
 * UI the kanon requires: when the browser has no speech API, the mic control
 * stays visible but explains why it is disabled, instead of silently vanishing.
 *
 * CEL 6 (2026-08-13): voice is draft → preview → commit, same as everything
 * else Teresa touches — a FINAL transcript from the hook is held locally as
 * a draft and shown for human confirmation; only `onTranscript(text, true, …)`
 * — the SAME callback prop the caller already wires into its manual answer
 * state (`InterviewFocusPanel`'s `onAnswerChange`) — writes it into the
 * shared answer text, and only after an explicit "Zatwierdź". Interim results
 * are shown live but never written anywhere. This component holds no other
 * state than that one pending draft string — there is no second, parallel
 * "voice answer" store to go stale against the real one.
 */
import { AlertTriangle, Check, Mic, MicOff, X } from 'lucide-react';
import React from 'react';

import { useUniversalVoice, type VoiceSettings } from '@/hooks/useUniversalVoice';

/** Provenance tag carried on the FINAL call only — lets a caller that wants
 * to record "this answer came in by voice" do so without a second channel;
 * a caller that ignores the third argument (e.g. today's `InterviewFocusPanel`)
 * behaves exactly as before. */
export type TranscriptSource = 'voice';

export interface VoiceAnswerChannelProps {
  /** Appends (or replaces) the interim/final transcript into the shared answer text.
   * Called with `isFinal: true` ONLY after the human confirms the draft preview below. */
  onTranscript: (text: string, isFinal: boolean, meta?: { source: TranscriptSource }) => void;
  disabled?: boolean;
  className?: string;
  /** Escape hatch for callers that need a specific STT provider (e.g. a
   * dev-render harness stubbing the Web Speech API instead of a real mic —
   * see `dev-render/screens/s4-teresa-panel.tsx`). Not used by
   * `InterviewFocusPanel` today, so production behaviour (default
   * `sttProvider: 'whisper'`) is unchanged. */
  voiceSettingsOverride?: Partial<VoiceSettings>;
}

export const VoiceAnswerChannel: React.FC<VoiceAnswerChannelProps> = ({
  onTranscript,
  disabled = false,
  className = '',
  voiceSettingsOverride,
}) => {
  // The ONLY state this component owns: a pending draft awaiting human
  // confirmation. Nothing else — no shadow copy of the answer text.
  const [draft, setDraft] = React.useState<string | null>(null);

  const handleHookResult = React.useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      // Draft → Preview, never straight into shared state.
      setDraft(text);
    }
    // Interim results are rendered live (below) but deliberately NOT
    // forwarded to `onTranscript` — they are not yet a draft, only a
    // work-in-progress the human hasn't finished saying.
  }, []);

  const { state, isSupported, toggleListening } = useUniversalVoice({
    onTranscript: handleHookResult,
    settings: { inputMode: 'click-to-talk', ...voiceSettingsOverride },
  });

  const confirmDraft = () => {
    if (draft == null) return;
    // Same event, same shape the caller already wires for manual typing —
    // voice never gets its own save path.
    onTranscript(draft, true, { source: 'voice' });
    setDraft(null);
  };

  const discardDraft = () => setDraft(null);

  if (!isSupported) {
    return (
      <div
        data-testid="voice-channel-degraded"
        role="status"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-xs text-c-text-muted ${className}`}
        title="Ta przeglądarka nie udostępnia rozpoznawania mowy — użyj klawiatury lub Teresy."
      >
        <MicOff size={13} />
        Mowa niedostępna w tej przeglądarce
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`}>
      <button
        type="button"
        data-testid="voice-channel-toggle"
        onClick={toggleListening}
        disabled={disabled}
        aria-pressed={state.isListening}
        aria-label={state.isListening ? 'Zatrzymaj dyktowanie odpowiedzi' : 'Podyktuj odpowiedź'}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50 disabled:cursor-not-allowed ${
          state.isListening
            ? 'border-c-info bg-c-info/10 text-c-info'
            : 'border-c-border text-c-text-secondary hover:bg-c-surface-raised'
        }`}
      >
        <Mic size={13} />
        {state.isListening ? 'Słucham…' : 'Podyktuj'}
      </button>

      {state.isListening && state.interimTranscript && (
        <p data-testid="voice-channel-interim" className="text-[11px] italic text-c-text-muted">
          Słyszę: „{state.interimTranscript}”
        </p>
      )}

      {state.error && (
        <p data-testid="voice-channel-error" className="flex items-center gap-1 text-[11px] text-c-danger">
          <AlertTriangle size={11} /> {state.error}
        </p>
      )}

      {draft != null && (
        <div
          data-testid="voice-channel-draft-preview"
          role="group"
          aria-label="Podyktowany tekst — podgląd przed zapisem"
          className="flex w-full flex-col gap-1.5 rounded-lg border border-c-info/40 bg-c-info/5 p-2 text-xs"
        >
          <p className="flex items-center gap-1 font-semibold text-c-info">
            <Mic size={11} /> Podyktowany tekst — do zatwierdzenia
          </p>
          <p className="text-c-text" data-testid="voice-channel-draft-text">
            {draft}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              data-testid="voice-channel-confirm"
              onClick={confirmDraft}
              className="inline-flex items-center gap-1 rounded-md border border-c-success/40 bg-c-success/10 px-2 py-1 text-[11px] font-medium text-c-success hover:bg-c-success/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <Check size={11} /> Zatwierdź
            </button>
            <button
              type="button"
              data-testid="voice-channel-discard"
              onClick={discardDraft}
              className="inline-flex items-center gap-1 rounded-md border border-c-border px-2 py-1 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <X size={11} /> Odrzuć
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAnswerChannel;
