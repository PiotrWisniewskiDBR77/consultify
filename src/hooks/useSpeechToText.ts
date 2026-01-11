/**
 * useSpeechToText Hook
 *
 * Enhanced Speech-to-Text hook with:
 * - Server-side Whisper API integration
 * - Client-side Web Speech API fallback
 * - Voice Activity Detection (VAD)
 * - Auto-send after silence detection
 * - Live transcript streaming
 *
 * Part of the Universal Voice Conversation System
 *
 * @version 2.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type STTProvider = 'whisper' | 'web';

export interface STTState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  audioLevel: number;
  recordingDuration: number;
  provider: STTProvider;
}

export interface STTSettings {
  provider: STTProvider;
  language: string;
  autoSendDelay: number; // seconds of silence before auto-send
  enableVAD: boolean;
  silenceThreshold: number; // 0-1, level below which is considered silence
}

export interface UseSTTOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAutoSend?: (text: string) => void;
  settings?: Partial<STTSettings>;
}

export interface UseSTTReturn {
  state: STTState;
  settings: STTSettings;
  isSupported: boolean;

  // Controls
  start: () => void;
  stop: () => void;
  toggle: () => void;

  // Settings
  updateSettings: (newSettings: Partial<STTSettings>) => void;

  // Utilities
  getSupportedLanguages: () => string[];
  testProvider: (provider: STTProvider) => Promise<boolean>;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: STTSettings = {
  provider: 'whisper',
  language: 'pl',
  autoSendDelay: 1.5,
  enableVAD: true,
  silenceThreshold: 0.1,
};

const SUPPORTED_LANGUAGES = [
  'pl',
  'en',
  'de',
  'es',
  'ja',
  'ar',
  'fr',
  'it',
  'pt',
  'ru',
  'zh',
  'ko',
];

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSpeechToText(options: UseSTTOptions = {}): UseSTTReturn {
  const { onTranscript, onAutoSend, settings: initialSettings = {} } = options;

  // State
  const [state, setState] = useState<STTState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    audioLevel: 0,
    recordingDuration: 0,
    provider: initialSettings.provider || 'whisper',
  });

  const [settings, setSettings] = useState<STTSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const webRecognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const accumulatedTranscriptRef = useRef<string>('');

  // Check support
  const isSupported =
    typeof window !== 'undefined' &&
    (navigator.mediaDevices?.getUserMedia !== undefined ||
      'webkitSpeechRecognition' in window ||
      'SpeechRecognition' in window);

  // ========================================================================
  // Voice Activity Detection
  // ========================================================================

  const startVAD = useCallback(
    (stream: MediaStream) => {
      if (!settings.enableVAD) return;

      try {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

        vadIntervalRef.current = window.setInterval(() => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalizedLevel = Math.min(1, average / 128);

          setState((prev) => ({ ...prev, audioLevel: normalizedLevel }));

          // Detect speech/silence
          if (normalizedLevel > settings.silenceThreshold) {
            lastSpeechTimeRef.current = Date.now();

            // Clear silence timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else {
            // Check for silence duration
            const silenceDuration = (Date.now() - lastSpeechTimeRef.current) / 1000;

            if (silenceDuration >= settings.autoSendDelay && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                const transcript = accumulatedTranscriptRef.current.trim();
                if (transcript && onAutoSend) {
                  onAutoSend(transcript);
                  accumulatedTranscriptRef.current = '';
                  setState((prev) => ({ ...prev, transcript: '' }));
                }
              }, 100);
            }
          }
        }, 100);
      } catch (error) {
        console.warn('[STT] VAD initialization failed:', error);
      }
    },
    [settings.enableVAD, settings.silenceThreshold, settings.autoSendDelay, onAutoSend]
  );

  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  // ========================================================================
  // Server STT (Whisper)
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
  // MediaRecorder (for Whisper)
  // ========================================================================

  const startMediaRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      accumulatedTranscriptRef.current = '';
      lastSpeechTimeRef.current = Date.now();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
        stopVAD();

        if (audioChunksRef.current.length > 0) {
          setState((prev) => ({ ...prev, isProcessing: true }));

          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const text = await transcribeWithServer(audioBlob);

            setState((prev) => ({
              ...prev,
              transcript: text,
              isProcessing: false,
            }));

            onTranscript?.(text, true);
            accumulatedTranscriptRef.current = text;
          } catch (error: any) {
            console.error('[STT] Transcription error:', error);
            setState((prev) => ({
              ...prev,
              error: error.message,
              isProcessing: false,
            }));
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

      // Start VAD
      startVAD(stream);

      // Start recording timer
      let duration = 0;
      recordingTimerRef.current = setInterval(() => {
        duration++;
        setState((prev) => ({ ...prev, recordingDuration: duration }));
      }, 1000);
    } catch (error: any) {
      console.error('[STT] Failed to start recording:', error);
      setState((prev) => ({
        ...prev,
        error: 'Microphone access denied',
        isListening: false,
      }));
    }
  }, [transcribeWithServer, onTranscript, startVAD, stopVAD]);

  // ========================================================================
  // Web Speech API
  // ========================================================================

  const startWebSpeech = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState((prev) => ({
        ...prev,
        error: 'Web Speech API not supported',
        isListening: false,
      }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    const langMap: Record<string, string> = {
      pl: 'pl-PL',
      en: 'en-US',
      de: 'de-DE',
      es: 'es-ES',
      ja: 'ja-JP',
      ar: 'ar-SA',
      fr: 'fr-FR',
      it: 'it-IT',
      pt: 'pt-BR',
      ru: 'ru-RU',
      zh: 'zh-CN',
      ko: 'ko-KR',
    };
    recognition.lang = langMap[settings.language] || 'pl-PL';

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

      if (finalTranscript) {
        accumulatedTranscriptRef.current += ' ' + finalTranscript;
        setState((prev) => ({
          ...prev,
          transcript: accumulatedTranscriptRef.current.trim(),
          interimTranscript: '',
        }));
        onTranscript?.(finalTranscript.trim(), true);
        lastSpeechTimeRef.current = Date.now();
      } else {
        setState((prev) => ({ ...prev, interimTranscript }));
        onTranscript?.(interimTranscript, false);
      }

      // Auto-send check
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        const transcript = accumulatedTranscriptRef.current.trim();
        if (transcript && onAutoSend) {
          onAutoSend(transcript);
          accumulatedTranscriptRef.current = '';
          setState((prev) => ({ ...prev, transcript: '' }));
        }
      }, settings.autoSendDelay * 1000);
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('[STT] Web Speech error:', event.error);
        setState((prev) => ({
          ...prev,
          error: `Recognition error: ${event.error}`,
        }));
      }
    };

    recognition.onend = () => {
      if (state.isListening && webRecognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already started or stopped
        }
      }
    };

    webRecognitionRef.current = recognition;
    recognition.start();

    // Recording timer
    let duration = 0;
    recordingTimerRef.current = setInterval(() => {
      duration++;
      setState((prev) => ({ ...prev, recordingDuration: duration }));
    }, 1000);
  }, [settings.language, settings.autoSendDelay, onTranscript, onAutoSend, state.isListening]);

  // ========================================================================
  // Control Methods
  // ========================================================================

  const start = useCallback(() => {
    if (state.isListening) return;

    setState((prev) => ({
      ...prev,
      isListening: true,
      error: null,
      transcript: '',
      interimTranscript: '',
      recordingDuration: 0,
      provider: settings.provider,
    }));

    accumulatedTranscriptRef.current = '';
    lastSpeechTimeRef.current = Date.now();

    if (settings.provider === 'whisper') {
      startMediaRecording();
    } else {
      startWebSpeech();
    }
  }, [state.isListening, settings.provider, startMediaRecording, startWebSpeech]);

  const stop = useCallback(() => {
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

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop Web Speech
    if (webRecognitionRef.current) {
      webRecognitionRef.current.stop();
      webRecognitionRef.current = null;
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    stopVAD();

    setState((prev) => ({
      ...prev,
      isListening: false,
      recordingDuration: 0,
      audioLevel: 0,
    }));
  }, [state.isListening, stopVAD]);

  const toggle = useCallback(() => {
    if (state.isListening) {
      stop();
    } else {
      start();
    }
  }, [state.isListening, start, stop]);

  // ========================================================================
  // Settings & Utilities
  // ========================================================================

  const updateSettings = useCallback((newSettings: Partial<STTSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const getSupportedLanguages = useCallback(() => {
    return SUPPORTED_LANGUAGES;
  }, []);

  const testProvider = useCallback(async (provider: STTProvider): Promise<boolean> => {
    if (provider === 'whisper') {
      try {
        const response = await fetch('/api/voice/test/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ provider: 'whisper' }),
        });
        const result = await response.json();
        return result.success;
      } catch {
        return false;
      }
    } else {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      return !!SpeechRecognition;
    }
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
    start,
    stop,
    toggle,
    updateSettings,
    getSupportedLanguages,
    testProvider,
  };
}

export default useSpeechToText;
