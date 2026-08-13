/**
 * VoiceAnswerChannel — voice as a THIRD, equal input channel into the same
 * answer-text state as manual typing and Teresa's proposals (A5 spec §9).
 *
 * Wraps the existing `useUniversalVoice` hook (src/hooks/useUniversalVoice.ts)
 * instead of re-implementing STT — the shell only adds the honest-degradation
 * UI the kanon requires: when the browser has no speech API, the mic control
 * stays visible but explains why it is disabled, instead of silently vanishing.
 */
import { Mic, MicOff } from 'lucide-react';
import React from 'react';

import { useUniversalVoice } from '@/hooks/useUniversalVoice';

export interface VoiceAnswerChannelProps {
  /** Appends (or replaces) the interim/final transcript into the shared answer text. */
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceAnswerChannel: React.FC<VoiceAnswerChannelProps> = ({
  onTranscript,
  disabled = false,
  className = '',
}) => {
  const { state, isSupported, toggleListening } = useUniversalVoice({
    onTranscript,
    settings: { inputMode: 'click-to-talk' },
  });

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
      } ${className}`}
    >
      <Mic size={13} />
      {state.isListening ? 'Słucham…' : 'Podyktuj'}
    </button>
  );
};

export default VoiceAnswerChannel;
