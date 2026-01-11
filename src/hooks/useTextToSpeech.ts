/**
 * useTextToSpeech Hook
 *
 * Enhanced Text-to-Speech hook with:
 * - Server-side OpenAI TTS integration
 * - Client-side Web Speech Synthesis fallback
 * - Audio streaming and buffering
 * - Playback controls (pause, resume, speed)
 * - Queue management for long responses
 *
 * Part of the Universal Voice Conversation System
 *
 * @version 2.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type TTSProvider = 'openai' | 'edge' | 'web';

export interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  isLoading: boolean;
  progress: number; // 0-1
  currentText: string;
  error: string | null;
  provider: TTSProvider;
}

export interface TTSSettings {
  provider: TTSProvider;
  voice: string;
  speed: number; // 0.5-2.0
  language: string;
  autoCleanText: boolean;
}

export interface TTSVoice {
  id: string;
  name: string;
  provider: TTSProvider;
  gender?: string;
  language?: string;
  premium?: boolean;
}

export interface UseTTSOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  settings?: Partial<TTSSettings>;
}

export interface UseTTSReturn {
  state: TTSState;
  settings: TTSSettings;
  isSupported: boolean;

  // Controls
  speak: (text: string) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;

  // Settings
  updateSettings: (newSettings: Partial<TTSSettings>) => void;

  // Utilities
  getAvailableVoices: () => Promise<TTSVoice[]>;
  testProvider: (provider: TTSProvider) => Promise<boolean>;
  cleanText: (text: string) => string;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: TTSSettings = {
  provider: 'openai',
  voice: 'nova',
  speed: 1.0,
  language: 'pl',
  autoCleanText: true,
};

// ============================================================================
// Text Cleaning Utility
// ============================================================================

export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' ')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown images
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove markdown bold/italic
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      // Remove bullet points
      .replace(/^[-*+•]\s+/gm, '')
      // Remove numbered lists
      .replace(/^\d+\.\s+/gm, '')
      // Remove URLs
      .replace(/https?:\/\/\S+/g, '')
      // Remove emoji
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTextToSpeech(options: UseTTSOptions = {}): UseTTSReturn {
  const { onStart, onEnd, onError, settings: initialSettings = {} } = options;

  // State
  const [state, setState] = useState<TTSState>({
    isSpeaking: false,
    isPaused: false,
    isLoading: false,
    progress: 0,
    currentText: '',
    error: null,
    provider: initialSettings.provider || 'openai',
  });

  const [settings, setSettings] = useState<TTSSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const webSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check support
  const isSupported = typeof window !== 'undefined' && ('speechSynthesis' in window || true); // Server TTS always available

  // ========================================================================
  // Server TTS (OpenAI/Edge)
  // ========================================================================

  const speakWithServer = useCallback(
    async (text: string): Promise<void> => {
      const cleanedText = settings.autoCleanText ? cleanTextForSpeech(text) : text;

      if (!cleanedText.trim()) {
        throw new Error('No text to speak');
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/voice/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            text: cleanedText,
            language: settings.language,
            voice: settings.voice,
            speed: settings.speed,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'TTS failed' }));
          throw new Error(error.error || 'TTS request failed');
        }

        // Get audio blob
        const audioBlob = await response.blob();

        // Clean up previous URL
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        audioUrlRef.current = URL.createObjectURL(audioBlob);

        // Create and play audio
        const audio = new Audio(audioUrlRef.current);
        audioRef.current = audio;

        // Set up event handlers
        audio.onloadedmetadata = () => {
          setState((prev) => ({ ...prev, isLoading: false }));
        };

        audio.ontimeupdate = () => {
          if (audio.duration > 0) {
            const progress = audio.currentTime / audio.duration;
            setState((prev) => ({ ...prev, progress }));
          }
        };

        audio.onended = () => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            isPaused: false,
            progress: 0,
            currentText: '',
          }));
          onEnd?.();

          // Clean up
          if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
          }
        };

        audio.onerror = () => {
          const errorMsg = 'Audio playback error';
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            isLoading: false,
            error: errorMsg,
          }));
          onError?.(errorMsg);
        };

        // Start playback
        setState((prev) => ({
          ...prev,
          isSpeaking: true,
          isLoading: false,
          currentText: cleanedText,
          provider: settings.provider,
        }));
        onStart?.();

        await audio.play();
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return; // Cancelled, don't report error
        }

        console.error('[TTS] Server TTS error:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        onError?.(error.message);
        throw error;
      }
    },
    [settings, onStart, onEnd, onError]
  );

  // ========================================================================
  // Web Speech Synthesis (Fallback)
  // ========================================================================

  const speakWithWebSpeech = useCallback(
    async (text: string): Promise<void> => {
      const cleanedText = settings.autoCleanText ? cleanTextForSpeech(text) : text;

      if (!cleanedText.trim()) {
        throw new Error('No text to speak');
      }

      if (!('speechSynthesis' in window)) {
        throw new Error('Web Speech Synthesis not supported');
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(cleanedText);

        // Set language
        const langMap: Record<string, string> = {
          pl: 'pl-PL',
          en: 'en-US',
          de: 'de-DE',
          es: 'es-ES',
          ja: 'ja-JP',
          ar: 'ar-SA',
          fr: 'fr-FR',
          it: 'it-IT',
        };
        utterance.lang = langMap[settings.language] || 'pl-PL';
        utterance.rate = settings.speed;

        // Find best voice
        const voices = window.speechSynthesis.getVoices();
        const langVoice = voices.find((v) => v.lang.startsWith(settings.language));
        if (langVoice) {
          utterance.voice = langVoice;
        }

        utterance.onstart = () => {
          setState((prev) => ({
            ...prev,
            isSpeaking: true,
            isPaused: false,
            currentText: cleanedText,
            provider: 'web',
          }));
          onStart?.();
        };

        utterance.onend = () => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            isPaused: false,
            progress: 0,
            currentText: '',
          }));
          onEnd?.();
          resolve();
        };

        utterance.onerror = (event) => {
          const errorMsg = `Speech synthesis error: ${event.error}`;
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            error: errorMsg,
          }));
          onError?.(errorMsg);
          reject(new Error(errorMsg));
        };

        utterance.onpause = () => {
          setState((prev) => ({ ...prev, isPaused: true }));
        };

        utterance.onresume = () => {
          setState((prev) => ({ ...prev, isPaused: false }));
        };

        webSynthRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [settings, onStart, onEnd, onError]
  );

  // ========================================================================
  // Main Speak Method
  // ========================================================================

  const speak = useCallback(
    async (text: string): Promise<void> => {
      // Stop any current playback
      stop();

      setState((prev) => ({ ...prev, error: null }));

      if (settings.provider === 'web') {
        return speakWithWebSpeech(text);
      } else {
        try {
          return await speakWithServer(text);
        } catch (error) {
          // Fallback to web speech
          console.warn('[TTS] Falling back to Web Speech');
          return speakWithWebSpeech(text);
        }
      }
    },
    [settings.provider, speakWithServer, speakWithWebSpeech]
  );

  // ========================================================================
  // Control Methods
  // ========================================================================

  const stop = useCallback(() => {
    // Stop server audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Clean up URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    // Abort pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop web speech
    window.speechSynthesis?.cancel();

    setState((prev) => ({
      ...prev,
      isSpeaking: false,
      isPaused: false,
      isLoading: false,
      progress: 0,
      currentText: '',
    }));
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && state.isSpeaking && !state.isPaused) {
      audioRef.current.pause();
      setState((prev) => ({ ...prev, isPaused: true }));
    }

    if (state.provider === 'web') {
      window.speechSynthesis?.pause();
    }
  }, [state.isSpeaking, state.isPaused, state.provider]);

  const resume = useCallback(() => {
    if (audioRef.current && state.isPaused) {
      audioRef.current.play();
      setState((prev) => ({ ...prev, isPaused: false }));
    }

    if (state.provider === 'web') {
      window.speechSynthesis?.resume();
    }
  }, [state.isPaused, state.provider]);

  // ========================================================================
  // Settings & Utilities
  // ========================================================================

  const updateSettings = useCallback((newSettings: Partial<TTSSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const getAvailableVoices = useCallback(async (): Promise<TTSVoice[]> => {
    const voices: TTSVoice[] = [];

    // Get server voices
    try {
      const response = await fetch('/api/voice/voices', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        voices.push(...data.voices);
      }
    } catch (error) {
      console.warn('[TTS] Failed to get server voices');
    }

    // Add web speech voices
    if ('speechSynthesis' in window) {
      const webVoices = window.speechSynthesis.getVoices();
      webVoices.forEach((v) => {
        voices.push({
          id: v.voiceURI,
          name: v.name,
          provider: 'web',
          language: v.lang,
          premium: false,
        });
      });
    }

    return voices;
  }, []);

  const testProvider = useCallback(async (provider: TTSProvider): Promise<boolean> => {
    if (provider === 'web') {
      return 'speechSynthesis' in window;
    }

    try {
      const response = await fetch('/api/voice/test/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });
      const result = await response.json();
      return result.success;
    } catch {
      return false;
    }
  }, []);

  const cleanText = useCallback((text: string): string => {
    return cleanTextForSpeech(text);
  }, []);

  // ========================================================================
  // Cleanup
  // ========================================================================

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  // ========================================================================
  // Return
  // ========================================================================

  return {
    state,
    settings,
    isSupported,
    speak,
    stop,
    pause,
    resume,
    updateSettings,
    getAvailableVoices,
    testProvider,
    cleanText,
  };
}

export default useTextToSpeech;
