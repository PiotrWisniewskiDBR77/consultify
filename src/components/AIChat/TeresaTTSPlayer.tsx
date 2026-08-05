/**
 * TeresaTTSPlayer — server-routed "talking Teresa" read-aloud control.
 *
 * Replaces the legacy TTSIndicator (browser speechSynthesis + 200ms polling)
 * with the Gemini-backed server TTS endpoint via `useTTSPlayer`.
 *
 * - Renders a crimson brand pill while loading/playing, with a stop affordance.
 * - When TTS is not configured on the server it silently renders nothing
 *   (honest degradation — no fake "speaking" state).
 * - `autoPlay` (off by default) reads `text` aloud whenever it changes; otherwise
 *   the consumer can trigger via the play button.
 *
 * @version 2.0.0
 */

import { Loader2, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useTTSPlayer } from '../../hooks/useTTSPlayer';

export interface TeresaTTSPlayerProps {
  /** The text Teresa should read aloud (typically the latest AI reply). */
  text: string;
  /** Conversation/UI language hint passed to the synth. */
  language?: string | null;
  /** Optional voice override; defaults to the server-configured Teresa voice. */
  voiceName?: string | null;
  /** Auto-read `text` whenever it changes. Defaults to false. */
  autoPlay?: boolean;
  className?: string;
  /**
   * LOCAL_HARNESS/dev-render ONLY — never passed by production callers.
   * Lets `dev-render/screens/m01-p05-voice.tsx` render "playing"/"error"
   * states declaratively without a real server TTS round-trip.
   */
  __harnessOverride?: Partial<ReturnType<typeof useTTSPlayer>>;
}

export const TeresaTTSPlayer: React.FC<TeresaTTSPlayerProps> = ({
  text,
  language,
  voiceName,
  autoPlay = false,
  className = '',
  __harnessOverride,
}) => {
  const { t } = useTranslation();
  const realPlayer = useTTSPlayer({ language, voiceName });
  const { status, isActive, speak, stop } = __harnessOverride
    ? { ...realPlayer, ...__harnessOverride }
    : realPlayer;
  const lastSpokenRef = useRef<string | null>(null);

  // Auto-play newly-arrived text exactly once.
  useEffect(() => {
    if (!autoPlay) return;
    const trimmed = String(text || '').trim();
    if (!trimmed || trimmed === lastSpokenRef.current) return;
    lastSpokenRef.current = trimmed;
    void speak(trimmed);
  }, [autoPlay, text, speak]);

  // Honest degradation: hide entirely when the server can't synthesize.
  if (status === 'unavailable') return null;

  const handleClick = () => {
    if (isActive) {
      stop();
      return;
    }
    const trimmed = String(text || '').trim();
    if (trimmed) void speak(trimmed);
  };

  const disabled = !String(text || '').trim();

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={isActive}
      data-testid="teresa-tts-player"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        isActive
          ? 'bg-crimson-600 text-white shadow-sm hover:bg-crimson-700 active:scale-95'
          : 'border border-crimson-200 bg-crimson-50 text-crimson-700 hover:border-crimson-300 hover:bg-crimson-100 dark:border-crimson-900/40 dark:bg-crimson-900/20 dark:text-crimson-300'
      } ${className}`}
      title={
        isActive
          ? t('aiChat.voice.ttsStop', 'Stop reading')
          : t('aiChat.voice.ttsPlay', 'Read aloud')
      }
    >
      {status === 'loading' ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          <span>{t('aiChat.voice.ttsLoading', 'Preparing audio…')}</span>
        </>
      ) : isActive ? (
        <>
          <Volume2 size={14} className="animate-pulse" />
          <span>{t('aiChat.voice.ttsStop', 'Stop reading')}</span>
          <VolumeX size={13} className="opacity-80" />
        </>
      ) : (
        <>
          <Volume2 size={14} />
          <span>{t('aiChat.voice.ttsPlay', 'Read aloud')}</span>
        </>
      )}
    </button>
  );
};

export default TeresaTTSPlayer;
