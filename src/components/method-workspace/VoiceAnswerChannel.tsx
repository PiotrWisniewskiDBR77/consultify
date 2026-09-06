/**
 * VoiceAnswerChannel — voice as a THIRD, equal input channel into the same
 * answer-text state as manual typing and Teresa's proposals (A5 spec §9).
 *
 * Wraps the existing `useUniversalVoice` hook (src/hooks/useUniversalVoice.ts)
 * instead of re-implementing STT — the shell only adds the honest-degradation
 * UI the kanon requires: when the browser has no speech API, the mic control
 * stays visible but explains why it is disabled, instead of silently vanishing.
 *
 * ★ NAPRAWA 06.09 (uwaga właściciela 15:10: „jest mikrofon, ale on w ogóle nie
 * słucha i nie tworzy tej notatki"). ZMIERZONA PRZYCZYNA: komponent nie
 * ustawiał `sttProvider`, więc `useUniversalVoice` brał SWÓJ domyślny
 * `'whisper'` — czyli MediaRecorder → POST `/api/voice/stt`. Ta droga (a) nic
 * nie pokazuje, dopóki nagranie się nie skończy, i (b) kończy się cicho
 * niczym, gdy serwer nie ma klucza STT (`voice.routes.ts` GET /health raportuje
 * wtedy `unavailable`) — błąd lądował tylko w `console.error`.
 *
 * Teraz: gdy przeglądarka ma Web Speech API (Chrome/Safari:
 * `webkitSpeechRecognition`), używamy JEJ — rozpoznaje na żywo, po polsku
 * (`lang` z i18n), bez klucza serwerowego. Whisper zostaje jako zapas dla
 * przeglądarek bez Web Speech. Błąd rozpoznawania jest POKAZYWANY, nie
 * chowany.
 */
import { Mic, MicOff } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useUniversalVoice } from '@/hooks/useUniversalVoice';

export interface VoiceAnswerChannelProps {
  /** Appends (or replaces) the interim/final transcript into the shared answer text. */
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Czy przeglądarka udostępnia rozpoznawanie mowy po stronie klienta. */
export function hasBrowserSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export const VoiceAnswerChannel: React.FC<VoiceAnswerChannelProps> = ({
  onTranscript,
  disabled = false,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const browserStt = hasBrowserSpeechRecognition();

  // `useUniversalVoice` cache'uje instancję `SpeechRecognition` w refie, więc
  // jej `onresult` trzyma domknięcie z pierwszego renderu. Przekazujemy więc
  // STABILNY callback, który czyta najświeższy props z refu — inaczej drugi
  // i każdy kolejny fragment dyktowania trafiałby do starego dopisywacza.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    onTranscriptRef.current(text, isFinal);
  }, []);

  const { state, isSupported, toggleListening } = useUniversalVoice({
    onTranscript: handleTranscript,
    settings: {
      inputMode: 'click-to-talk',
      sttProvider: browserStt ? 'web' : 'whisper',
      language: (i18n.language || 'pl').split('-')[0],
    },
  });

  const supported = browserStt || isSupported;

  if (!supported) {
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        data-testid="voice-channel-toggle"
        data-stt-provider={browserStt ? 'web' : 'whisper'}
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
        {state.isListening ? 'Słucham…' : state.isProcessing ? 'Przetwarzam…' : 'Podyktuj'}
      </button>
      {state.error && !state.isListening && (
        <span
          data-testid="voice-channel-error"
          role="status"
          className="max-w-[10rem] text-right text-[10px] leading-tight text-c-warning"
        >
          {state.error}
        </span>
      )}
    </div>
  );
};

export default VoiceAnswerChannel;
