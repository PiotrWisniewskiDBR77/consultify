/**
 * useTTSPlayer — server-routed "talking Teresa" read-aloud (Phase 1A).
 *
 * Replaces the browser `speechSynthesis` polling loop with the Gemini-backed
 * server TTS endpoint (`POST /api/v10/teresa/tts`). Audio is returned as a WAV
 * blob and played through a single managed <audio> element.
 *
 * Design notes:
 * - Honest states: `unavailable` is surfaced (never faked) when the server has no
 *   Gemini key. The caller can hide the control entirely in that case.
 * - One playback at a time: starting a new utterance stops the previous one and
 *   revokes its object URL.
 * - SSR-safe: all browser access is guarded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Api } from '../services/api';

export type TTSPlayerStatus = 'idle' | 'loading' | 'playing' | 'error' | 'unavailable';

export interface UseTTSPlayerOptions {
  language?: string | null;
  voiceName?: string | null;
}

export interface UseTTSPlayerReturn {
  status: TTSPlayerStatus;
  isActive: boolean;
  error: string | null;
  /** Synthesize + play the given text. No-ops on empty input. */
  speak: (text: string) => Promise<void>;
  /** Stop current playback and reset to idle. */
  stop: () => void;
}

export const useTTSPlayer = (options: UseTTSPlayerOptions = {}): UseTTSPlayerReturn => {
  const { language, voiceName } = options;
  const [status, setStatus] = useState<TTSPlayerStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Monotonic token so a stale in-flight request can't override a newer one.
  const requestTokenRef = useRef(0);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        // no-op
      }
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    requestTokenRef.current += 1;
    cleanupAudio();
    setStatus((prev) => (prev === 'unavailable' ? prev : 'idle'));
  }, [cleanupAudio]);

  const speak = useCallback(
    async (text: string) => {
      if (typeof window === 'undefined') return;
      const trimmed = String(text || '').trim();
      if (!trimmed) return;

      // Cancel any prior playback/request.
      const token = ++requestTokenRef.current;
      cleanupAudio();
      setError(null);
      setStatus('loading');

      try {
        const blob = await Api.teresaSynthesizeSpeech({
          text: trimmed,
          language: language ?? undefined,
          voiceName: voiceName ?? undefined,
        });
        if (token !== requestTokenRef.current) return; // superseded

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          if (token !== requestTokenRef.current) return;
          cleanupAudio();
          setStatus('idle');
        };
        audio.onerror = () => {
          if (token !== requestTokenRef.current) return;
          cleanupAudio();
          setStatus('error');
          setError('playback_failed');
        };

        await audio.play();
        if (token !== requestTokenRef.current) return;
        setStatus('playing');
      } catch (err: any) {
        if (token !== requestTokenRef.current) return;
        cleanupAudio();
        const reason = err?.reason || err?.code;
        if (
          err?.status === 503 ||
          reason === 'server_missing_gemini_live_key' ||
          err?.code === 'TERESA_TTS_UNAVAILABLE'
        ) {
          setStatus('unavailable');
          setError('unavailable');
          return;
        }
        setStatus('error');
        setError(err?.message || 'tts_failed');
      }
    },
    [cleanupAudio, language, voiceName]
  );

  // Tear down on unmount.
  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  return {
    status,
    isActive: status === 'loading' || status === 'playing',
    error,
    speak,
    stop,
  };
};

export default useTTSPlayer;
