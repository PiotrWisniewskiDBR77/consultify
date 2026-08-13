/**
 * useUniversalVoice Hook
 *
 * Main orchestration hook for the Universal Voice Conversation System.
 * Manages both Speech-to-Text and Text-to-Speech with:
 * - Server-side processing (Whisper, OpenAI TTS)
 * - Client-side fallback (Web Speech API)
 * - Voice Activity Detection (VAD)
 * - Continuous conversation mode
 * - Interrupt handling
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  bucketTranscriptLength,
  emitTtsOn,
  emitVoiceStart,
  emitVoiceSttFail,
  emitVoiceSttSuccess,
} from '../utils/voiceFunnelTelemetry';

// ============================================================================
// Language → BCP-47 mapping for all 6 supported app languages
// ============================================================================

const LANG_TO_BCP47: Record<string, string> = {
  pl: 'pl-PL',
  en: 'en-US',
  de: 'de-DE',
  ar: 'ar-SA',
  ja: 'ja-JP',
  es: 'es-ES',
};

/**
 * Preferred voice names per language (ordered by priority, best first).
 * These are the more natural-sounding voices available on macOS / Chrome.
 * The selector tries each name in order and falls back to any voice for the locale.
 */
const PREFERRED_VOICES: Record<string, string[]> = {
  'pl-PL': ['Zosia', 'Paulina', 'Google polski'],
  'en-US': ['Samantha', 'Karen', 'Google US English', 'Alex', 'Moira'],
  'de-DE': ['Anna', 'Petra', 'Google Deutsch', 'Helena'],
  'ar-SA': ['Maged', 'Google العربية'],
  'ja-JP': ['Kyoko', 'O-Ren', 'Google 日本語', 'Otoya'],
  'es-ES': ['Monica', 'Paulina', 'Google español', 'Jorge'],
};

/**
 * Find the best available SpeechSynthesis voice for a given BCP-47 locale.
 * Prefers natural/premium voices listed in PREFERRED_VOICES.
 */
function pickBestVoice(locale: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const langPrefix = locale.split('-')[0]; // e.g. "pl"

  // 1. Try preferred names (case-insensitive partial match)
  const preferred = PREFERRED_VOICES[locale] ?? [];
  for (const name of preferred) {
    const lowerName = name.toLowerCase();
    const match = voices.find(
      (v) =>
        v.name.toLowerCase().includes(lowerName) &&
        (v.lang.startsWith(locale) || v.lang.startsWith(langPrefix))
    );
    if (match) return match;
  }

  // 2. Prefer voices with "premium", "enhanced", "natural" in name
  const naturalKeywords = ['premium', 'enhanced', 'natural', 'neural'];
  const naturalMatch = voices.find(
    (v) =>
      (v.lang.startsWith(locale) || v.lang.startsWith(langPrefix)) &&
      naturalKeywords.some((kw) => v.name.toLowerCase().includes(kw))
  );
  if (naturalMatch) return naturalMatch;

  // 3. Any voice matching the full locale
  const localeMatch = voices.find((v) => v.lang.startsWith(locale));
  if (localeMatch) return localeMatch;

  // 4. Any voice matching just the language prefix
  const prefixMatch = voices.find((v) => v.lang.startsWith(langPrefix));
  if (prefixMatch) return prefixMatch;

  return null;
}

// ============================================================================
// Types
// ============================================================================

export type VoiceMode = 'idle' | 'listening' | 'processing' | 'speaking';
export type InputMode = 'push-to-talk' | 'click-to-talk' | 'always-listening';

export interface VoiceState {
  mode: VoiceMode;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  audioLevel: number;
  recordingDuration: number;
}

export interface VoiceSettings {
  inputMode: InputMode;
  autoSendDelay: number; // seconds
  ttsVoice: string;
  ttsSpeed: number;
  ttsProvider: 'openai' | 'edge' | 'web';
  sttProvider: 'whisper' | 'web';
  autoSpeakResponses: boolean;
  language: string;
  showLiveTranscript: boolean;
}

export interface UseUniversalVoiceOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSendMessage?: (message: string) => Promise<void>;
  onAudioResponse?: (audioUrl: string) => void;
  settings?: Partial<VoiceSettings>;
}

export interface UseUniversalVoiceReturn {
  state: VoiceState;
  settings: VoiceSettings;
  isSupported: boolean;

  // STT Controls
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;

  // TTS Controls
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;

  // Conversation Mode
  startConversation: () => void;
  endConversation: () => void;

  // Settings
  updateSettings: (newSettings: Partial<VoiceSettings>) => void;

  // Utilities
  getAvailableVoices: () => Promise<any[]>;
  testConnection: () => Promise<{ stt: boolean; tts: boolean }>;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: VoiceSettings = {
  inputMode: 'click-to-talk',
  autoSendDelay: 1.5,
  ttsVoice: 'nova',
  ttsSpeed: 1.0,
  ttsProvider: 'openai',
  sttProvider: 'whisper',
  autoSpeakResponses: true,
  language: 'pl',
  showLiveTranscript: true,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUniversalVoice(options: UseUniversalVoiceOptions = {}): UseUniversalVoiceReturn {
  const { onTranscript, onSendMessage, onAudioResponse, settings: initialSettings = {} } = options;

  // State
  const [state, setState] = useState<VoiceState>({
    mode: 'idle',
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    audioLevel: 0,
    recordingDuration: 0,
  });

  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const webRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const continuousModeRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sync settings when initialSettings change
  const initialSettingsKey = [
    initialSettings.inputMode ?? '',
    initialSettings.autoSendDelay ?? '',
    initialSettings.ttsVoice ?? '',
    initialSettings.ttsSpeed ?? '',
    initialSettings.ttsProvider ?? '',
    initialSettings.sttProvider ?? '',
    initialSettings.autoSpeakResponses ?? '',
    initialSettings.language ?? '',
    initialSettings.showLiveTranscript ?? '',
  ].join('|');

  useEffect(() => {
    // `initialSettings` is often passed as an inline object from components.
    // In React, that means a new reference on each render, which would make this effect
    // fire continuously and can cause "Maximum update depth exceeded".
    // We only update state if any value actually changed.
    setSettings((prev) => {
      let changed = false;
      const next: VoiceSettings = { ...prev };
      for (const [key, value] of Object.entries(initialSettings) as Array<
        [keyof VoiceSettings, VoiceSettings[keyof VoiceSettings]]
      >) {
        if (value === undefined) continue;
        if (prev[key] !== value) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (next as any)[key] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [initialSettingsKey]);

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined &&
    ('speechSynthesis' in window || true); // TTS via API always available

  // Preload Web Speech voices (Chrome loads them asynchronously)
  // We just need to trigger getVoices() early so they are ready when speak() is called.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const onVoicesChanged = () => {
      // Voices are now loaded — pickBestVoice() will find them on next speak() call
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    };
  }, []);

  // ========================================================================
  // Audio Level Monitoring (VAD)
  // ========================================================================

  const startAudioLevelMonitoring = useCallback(
    (stream: MediaStream) => {
      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        const checkLevel = () => {
          if (!analyserRef.current || !state.isListening) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalizedLevel = Math.min(1, average / 128);

          setState((prev) => ({ ...prev, audioLevel: normalizedLevel }));

          if (state.isListening) {
            requestAnimationFrame(checkLevel);
          }
        };

        checkLevel();
      } catch (error) {
        console.warn('[Voice] Audio level monitoring not available:', error);
      }
    },
    [state.isListening]
  );

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // ========================================================================
  // Server-side STT (Whisper)
  // ========================================================================

  const transcribeWithServer = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      formData.append('language', settings.language);

      const response = await fetch('/api/voice/stt', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'STT failed');
      }

      const result = await response.json();
      return result.text;
    },
    [settings.language]
  );

  // ========================================================================
  // Client-side STT (Web Speech API)
  // ========================================================================

  const initWebSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      settings.language === 'pl'
        ? 'pl-PL'
        : settings.language === 'en'
          ? 'en-US'
          : settings.language === 'de'
            ? 'de-DE'
            : 'pl-PL';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setState((prev) => ({
        ...prev,
        transcript: finalTranscript || prev.transcript,
        interimTranscript,
      }));

      if (finalTranscript) {
        onTranscript?.(finalTranscript.trim(), true);
        // VM10 · `voice_stt_success` — web-speech path. Fires once per
        // final result; interim transcripts don't count because they
        // are not actionable by the user yet.
        emitVoiceSttSuccess({
          sttProvider: 'web',
          trigger: continuousModeRef.current ? 'conversation' : 'single',
          language: settings.language,
          transcriptLengthBucket: bucketTranscriptLength(finalTranscript),
        });
      } else if (interimTranscript) {
        onTranscript?.(interimTranscript, false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[Voice] Web Speech error:', event.error);
      // VM10 · `voice_stt_fail` — web-speech path. The event's `error`
      // field is a closed enum defined by the Web Speech spec, so we
      // can map it directly without leaking server strings.
      const webReason: 'no_speech' | 'permission_denied' | 'network' | 'aborted' | 'unknown' =
        event.error === 'no-speech'
          ? 'no_speech'
          : event.error === 'not-allowed' || event.error === 'service-not-allowed'
            ? 'permission_denied'
            : event.error === 'network'
              ? 'network'
              : event.error === 'aborted'
                ? 'aborted'
                : 'unknown';
      emitVoiceSttFail({
        sttProvider: 'web',
        trigger: continuousModeRef.current ? 'conversation' : 'single',
        language: settings.language,
        reason: webReason,
      });
      if (event.error !== 'no-speech') {
        setState((prev) => ({
          ...prev,
          error: `Speech recognition error: ${event.error}`,
          isListening: false,
          mode: 'idle',
        }));
      }
    };

    recognition.onend = () => {
      if (continuousModeRef.current && state.isListening) {
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      }
    };

    return recognition;
  }, [settings.language, onTranscript, state.isListening]);

  // ========================================================================
  // Recording with MediaRecorder (for server STT)
  // ========================================================================

  const startMediaRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        stopAudioLevelMonitoring();

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          setState((prev) => ({ ...prev, mode: 'processing', isProcessing: true }));

          try {
            const text = await transcribeWithServer(audioBlob);
            setState((prev) => ({
              ...prev,
              transcript: text,
              mode: 'idle',
              isProcessing: false,
            }));
            onTranscript?.(text, true);

            // VM10 · `voice_stt_success` — whisper path. Length bucket
            // only, never the transcript text itself.
            emitVoiceSttSuccess({
              sttProvider: 'whisper',
              trigger: continuousModeRef.current ? 'conversation' : 'single',
              language: settings.language,
              transcriptLengthBucket: bucketTranscriptLength(text),
            });

            // Auto-send if in continuous mode
            if (continuousModeRef.current && text.trim()) {
              await onSendMessage?.(text.trim());
            }
          } catch (error: any) {
            console.error('[Voice] Transcription error:', error);
            setState((prev) => ({
              ...prev,
              error: error.message,
              mode: 'idle',
              isProcessing: false,
            }));
            // VM10 · `voice_stt_fail` — whisper path. We map fetch
            // network errors (TypeError) vs server non-OK (caught and
            // rethrown by `transcribeWithServer` with the server's
            // `error` field) as distinct closed reasons. Anything else
            // is `unknown` until we observe it and add a mapping.
            const reason =
              error?.name === 'TypeError'
                ? 'network'
                : typeof error?.message === 'string' && error.message.length > 0
                  ? 'server_error'
                  : 'unknown';
            emitVoiceSttFail({
              sttProvider: 'whisper',
              trigger: continuousModeRef.current ? 'conversation' : 'single',
              language: settings.language,
              reason,
            });
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

      startAudioLevelMonitoring(stream);

      // Start recording timer
      let duration = 0;
      recordingTimerRef.current = setInterval(() => {
        duration++;
        setState((prev) => ({ ...prev, recordingDuration: duration }));
      }, 1000);
    } catch (error: any) {
      console.error('[Voice] Failed to start recording:', error);
      setState((prev) => ({
        ...prev,
        error: 'Microphone access denied',
        isListening: false,
        mode: 'idle',
      }));
      // VM10 · `voice_stt_fail` — getUserMedia rejected. The most
      // common cause is `NotAllowedError` (user dismissed the mic
      // permission prompt); we also see `NotFoundError` on devices
      // with no mic. Both map to `permission_denied` from the funnel's
      // point of view — the outcome is "we couldn't capture audio".
      emitVoiceSttFail({
        sttProvider: 'whisper',
        trigger: continuousModeRef.current ? 'conversation' : 'single',
        language: settings.language,
        reason:
          error?.name === 'NotAllowedError' || error?.name === 'NotFoundError'
            ? 'permission_denied'
            : 'unknown',
      });
    }
  }, [
    transcribeWithServer,
    onTranscript,
    onSendMessage,
    startAudioLevelMonitoring,
    stopAudioLevelMonitoring,
    settings.language,
  ]);

  // ========================================================================
  // STT Control Methods
  // ========================================================================

  const startListening = useCallback(() => {
    if (state.isListening || state.isSpeaking) return;

    setState((prev) => ({
      ...prev,
      isListening: true,
      mode: 'listening',
      error: null,
      transcript: '',
      interimTranscript: '',
      recordingDuration: 0,
    }));

    // VM10 · `voice_start` — emit exactly once per idle → listening
    // transition. Guarded by the `if (isListening || isSpeaking)` above
    // so duplicate calls don't double-count. No transcript yet.
    emitVoiceStart({
      sttProvider: settings.sttProvider,
      trigger: continuousModeRef.current ? 'conversation' : 'single',
      language: settings.language,
    });

    if (settings.sttProvider === 'whisper') {
      startMediaRecording();
    } else {
      // Web Speech API
      if (!webRecognitionRef.current) {
        webRecognitionRef.current = initWebSpeechRecognition();
      }
      try {
        webRecognitionRef.current?.start();
      } catch (e) {
        // Already started
      }
    }
  }, [
    state.isListening,
    state.isSpeaking,
    settings.sttProvider,
    startMediaRecording,
    initWebSpeechRecognition,
  ]);

  const stopListening = useCallback(() => {
    if (!state.isListening) return;

    // Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop Web Speech
    webRecognitionRef.current?.stop();

    setState((prev) => ({
      ...prev,
      isListening: false,
      mode: prev.isProcessing ? 'processing' : 'idle',
      recordingDuration: 0,
    }));

    stopAudioLevelMonitoring();
  }, [state.isListening, stopAudioLevelMonitoring]);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // ========================================================================
  // TTS Methods
  // ========================================================================

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      console.log(
        '[Voice] speak() called, provider:',
        settings.ttsProvider,
        'lang:',
        settings.language,
        'text:',
        text.slice(0, 80)
      );

      // Stop any current audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      // Stop listening while speaking
      if (state.isListening) {
        stopListening();
      }

      setState((prev) => ({ ...prev, isSpeaking: true, mode: 'speaking' }));

      // VM10 · `tts_on` — we emit BEFORE the provider fetch so the
      // funnel counts the user intent even when the backend later
      // rejects the request. `auto` is derived from the persistent
      // setting, not from this call's origin — that field answers
      // "did the user opt into auto-read?", not "was this call manual?".
      emitTtsOn({
        ttsProvider: settings.ttsProvider,
        language: settings.language,
        auto: settings.autoSpeakResponses,
      });

      try {
        if (settings.ttsProvider === 'web') {
          // Web Speech Synthesis — supports all 6 app languages with natural voice selection
          return new Promise((resolve, reject) => {
            // Cancel any pending/paused speech first
            window.speechSynthesis.cancel();

            const locale = LANG_TO_BCP47[settings.language] || LANG_TO_BCP47['pl'];
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = locale;
            utterance.rate = settings.ttsSpeed;
            // Slightly warmer pitch for a less robotic feel
            utterance.pitch = 1.05;

            // Pick the best available voice for this language
            const bestVoice = pickBestVoice(locale);
            if (bestVoice) {
              utterance.voice = bestVoice;
              console.log('[Voice] Web TTS: using voice:', bestVoice.name, 'lang:', bestVoice.lang);
            } else {
              console.log(
                '[Voice] Web TTS: no preferred voice found for',
                locale,
                '– using browser default'
              );
            }

            utterance.onend = () => {
              setState((prev) => ({ ...prev, isSpeaking: false, mode: 'idle' }));
              // Resume listening in continuous mode
              if (continuousModeRef.current) {
                setTimeout(startListening, 300);
              }
              resolve();
            };

            utterance.onerror = (event) => {
              console.error('[Voice] Web TTS utterance error:', event);
              setState((prev) => ({ ...prev, isSpeaking: false, mode: 'idle' }));
              reject(new Error('Speech synthesis error'));
            };

            window.speechSynthesis.speak(utterance);
          });
        } else {
          // Server TTS (OpenAI or Edge)
          const response = await fetch('/api/voice/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              text,
              language: settings.language,
              voice: settings.ttsVoice,
              speed: settings.ttsSpeed,
            }),
          });

          if (!response.ok) {
            throw new Error('TTS request failed');
          }

          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);

          onAudioResponse?.(audioUrl);

          return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;

            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              setState((prev) => ({ ...prev, isSpeaking: false, mode: 'idle' }));
              // Resume listening in continuous mode
              if (continuousModeRef.current) {
                setTimeout(startListening, 300);
              }
              resolve();
            };

            audio.onerror = () => {
              URL.revokeObjectURL(audioUrl);
              currentAudioRef.current = null;
              setState((prev) => ({ ...prev, isSpeaking: false, mode: 'idle' }));
              reject(new Error('Audio playback error'));
            };

            audio.play();
          });
        }
      } catch (error: any) {
        console.error('[Voice] TTS error:', error);
        setState((prev) => ({
          ...prev,
          isSpeaking: false,
          mode: 'idle',
          error: error.message,
        }));
        throw error;
      }
    },
    [settings, state.isListening, stopListening, startListening, onAudioResponse]
  );

  const stopSpeaking = useCallback(() => {
    // Stop Web Speech
    window.speechSynthesis?.cancel();

    // Stop audio playback
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setState((prev) => ({ ...prev, isSpeaking: false, mode: 'idle' }));
  }, []);

  // ========================================================================
  // Conversation Mode
  // ========================================================================

  const startConversation = useCallback(() => {
    continuousModeRef.current = true;
    startListening();
  }, [startListening]);

  const endConversation = useCallback(() => {
    continuousModeRef.current = false;
    stopListening();
    stopSpeaking();
    setState((prev) => ({ ...prev, mode: 'idle' }));
  }, [stopListening, stopSpeaking]);

  // ========================================================================
  // Settings & Utilities
  // ========================================================================

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      let changed = false;
      const next: VoiceSettings = { ...prev };
      for (const [key, value] of Object.entries(newSettings) as Array<
        [keyof VoiceSettings, VoiceSettings[keyof VoiceSettings]]
      >) {
        if (value === undefined) continue;
        if (prev[key] !== value) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (next as any)[key] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const getAvailableVoices = useCallback(async () => {
    try {
      const response = await fetch('/api/voice/voices', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        return data.voices;
      }
    } catch (error) {
      console.error('[Voice] Failed to get voices:', error);
    }
    return [];
  }, []);

  const testConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/voice/health', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        return {
          stt: data.stt?.healthyProviders?.length > 0,
          tts: data.tts?.healthyProviders?.length > 0,
        };
      }
    } catch (error) {
      console.error('[Voice] Health check failed:', error);
    }
    return { stt: false, tts: false };
  }, []);

  // ========================================================================
  // Cleanup
  // ========================================================================

  // IMPORTANT:
  // This must run ONLY on unmount. If we depend on callbacks that change each render,
  // React will run the cleanup on every render and we can create an update loop
  // (cleanup calls setState -> render -> cleanup -> ...).
  const stopListeningRef = useRef(stopListening);
  const stopSpeakingRef = useRef(stopSpeaking);
  const stopAudioLevelMonitoringRef = useRef(stopAudioLevelMonitoring);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);
  useEffect(() => {
    stopSpeakingRef.current = stopSpeaking;
  }, [stopSpeaking]);
  useEffect(() => {
    stopAudioLevelMonitoringRef.current = stopAudioLevelMonitoring;
  }, [stopAudioLevelMonitoring]);

  useEffect(() => {
    return () => {
      stopListeningRef.current();
      stopSpeakingRef.current();
      stopAudioLevelMonitoringRef.current();
    };
  }, []);

  // ========================================================================
  // Return
  // ========================================================================

  return {
    state,
    settings,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    startConversation,
    endConversation,
    updateSettings,
    getAvailableVoices,
    testConnection,
  };
}

export default useUniversalVoice;
