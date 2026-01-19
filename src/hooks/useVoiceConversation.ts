/**
 * useVoiceConversation Hook
 *
 * Implements continuous voice conversation mode for the Co-Thinker.
 * Handles speech-to-text (STT), text-to-speech (TTS), and conversation flow.
 *
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Voice conversation state
export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  error: string | null;
  mode: 'idle' | 'listening' | 'processing' | 'speaking';
  transcript: string;
  interimTranscript: string;
  continuousMode: boolean;
}

// Voice settings
export interface VoiceSettings {
  language: string;
  voicePitch: number;
  voiceRate: number;
  voiceVolume: number;
  continuousListening: boolean;
  autoSpeak: boolean;
  interruptible: boolean;
  silenceTimeout: number;
  preferredVoice?: string;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  language: 'pl-PL',
  voicePitch: 1,
  voiceRate: 1,
  voiceVolume: 1,
  continuousListening: true,
  autoSpeak: true,
  interruptible: true,
  silenceTimeout: 2000,
};

// Speech recognition types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface UseSpeechRecognition {
  new (): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: UseSpeechRecognition;
    webkitSpeechRecognition: UseSpeechRecognition;
  }
}

interface UseVoiceConversationProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onSendMessage?: (message: string) => Promise<void>;
  settings?: Partial<VoiceSettings>;
}

interface UseVoiceConversationReturn {
  state: VoiceState;
  settings: VoiceSettings;
  isSupported: boolean;

  // Control methods
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;

  // Speech synthesis
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => void;

  // Continuous mode
  startContinuousMode: () => void;
  stopContinuousMode: () => void;

  // Settings
  updateSettings: (newSettings: Partial<VoiceSettings>) => void;

  // Utilities
  getAvailableVoices: () => SpeechSynthesisVoice[];
  cleanTextForSpeech: (text: string) => string;
}

export function useVoiceConversation({
  onTranscript,
  onSendMessage,
  settings: initialSettings = {},
}: UseVoiceConversationProps): UseVoiceConversationReturn {
  // State
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    error: null,
    mode: 'idle',
    transcript: '',
    interimTranscript: '',
    continuousMode: false,
  });

  const [settings, setSettings] = useState<VoiceSettings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const continuousModeRef = useRef(false);

  // Check browser support
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
    'speechSynthesis' in window;

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = settings.continuousListening;
    recognition.interimResults = true;
    recognition.lang = settings.language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState((prev) => ({
        ...prev,
        isListening: true,
        mode: 'listening',
        error: null,
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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

      // Send to callback
      if (finalTranscript) {
        onTranscript(finalTranscript.trim(), true);

        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Start silence timer for auto-send
        if (continuousModeRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            if (onSendMessage && finalTranscript.trim()) {
              onSendMessage(finalTranscript.trim());
              setState((prev) => ({ ...prev, transcript: '' }));
            }
          }, settings.silenceTimeout);
        }
      } else if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied';
          break;
        case 'network':
          errorMessage = 'Network error';
          break;
      }

      setState((prev) => ({
        ...prev,
        isListening: false,
        mode: 'idle',
        error: errorMessage,
      }));

      // Try to restart in continuous mode
      if (continuousModeRef.current && event.error !== 'not-allowed') {
        setTimeout(() => {
          if (continuousModeRef.current) {
            recognition.start();
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      setState((prev) => ({
        ...prev,
        isListening: false,
        mode: prev.isSpeaking ? 'speaking' : 'idle',
      }));

      // Restart in continuous mode
      if (continuousModeRef.current && !state.isSpeaking) {
        setTimeout(() => {
          if (continuousModeRef.current) {
            recognition.start();
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [
    isSupported,
    settings.language,
    settings.continuousListening,
    settings.silenceTimeout,
    onTranscript,
    onSendMessage,
  ]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || state.isListening) return;

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  }, [state.isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    continuousModeRef.current = false;
    recognitionRef.current.stop();

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    setState((prev) => ({
      ...prev,
      isListening: false,
      continuousMode: false,
      mode: prev.isSpeaking ? 'speaking' : 'idle',
    }));
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Text-to-speech
  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!isSupported || !text.trim()) return;

      return new Promise((resolve, reject) => {
        // Stop current speech if interruptible
        if (state.isSpeaking && settings.interruptible) {
          window.speechSynthesis.cancel();
        }

        // Pause listening while speaking
        if (state.isListening && recognitionRef.current) {
          recognitionRef.current.stop();
        }

        const cleanText = cleanTextForSpeech(text);
        const utterance = new SpeechSynthesisUtterance(cleanText);

        utterance.lang = settings.language;
        utterance.pitch = settings.voicePitch;
        utterance.rate = settings.voiceRate;
        utterance.volume = settings.voiceVolume;

        // Set preferred voice if available
        if (settings.preferredVoice) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(
            (v) =>
              v.name === settings.preferredVoice ||
              v.lang.startsWith(settings.language.split('-')[0])
          );
          if (voice) {
            utterance.voice = voice;
          }
        }

        utterance.onstart = () => {
          setState((prev) => ({
            ...prev,
            isSpeaking: true,
            mode: 'speaking',
          }));
        };

        utterance.onend = () => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            mode: 'idle',
          }));

          // Resume listening in continuous mode
          if (continuousModeRef.current && recognitionRef.current) {
            setTimeout(() => {
              if (continuousModeRef.current) {
                recognitionRef.current?.start();
              }
            }, 300);
          }

          resolve();
        };

        utterance.onerror = (event) => {
          setState((prev) => ({
            ...prev,
            isSpeaking: false,
            mode: 'idle',
            error: 'Speech synthesis error',
          }));
          reject(new Error('Speech synthesis error'));
        };

        synthesisRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [isSupported, settings, state.isListening, state.isSpeaking]
  );

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();

    setState((prev) => ({
      ...prev,
      isSpeaking: false,
      mode: prev.isListening ? 'listening' : 'idle',
    }));
  }, [isSupported]);

  // Start continuous conversation mode with AI greeting
  const startContinuousMode = useCallback(async () => {
    continuousModeRef.current = true;

    setState((prev) => ({
      ...prev,
      continuousMode: true,
    }));

    // AI greeting - say hello before starting to listen
    const isPolish = settings.language.startsWith('pl');
    const greetings = isPolish
      ? [
          'Cześć! W czym mogę Ci dzisiaj pomóc?',
          'Hej! Słucham, co tam?',
          'Witaj! O czym chcesz porozmawiać?',
          'Cześć! Jestem gotowa. Co dla Ciebie zrobić?',
        ]
      : [
          'Hi! How can I help you today?',
          "Hey! I'm listening, what's up?",
          'Hello! What would you like to talk about?',
          "Hi there! I'm ready. What can I do for you?",
        ];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    // Speak greeting first, then start listening
    try {
      await speak(randomGreeting);
    } catch (error) {
      console.warn('[VoiceConversation] Could not speak greeting:', error);
    }

    // Start listening after greeting
    startListening();
  }, [startListening, speak, settings.language]);

  // Stop continuous mode
  const stopContinuousMode = useCallback(() => {
    continuousModeRef.current = false;
    stopListening();
    stopSpeaking();

    setState((prev) => ({
      ...prev,
      continuousMode: false,
      mode: 'idle',
    }));
  }, [stopListening, stopSpeaking]);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));

    // Update recognition language if changed
    if (newSettings.language && recognitionRef.current) {
      recognitionRef.current.lang = newSettings.language;
    }
  }, []);

  // Get available voices
  const getAvailableVoices = useCallback((): SpeechSynthesisVoice[] => {
    if (!isSupported) return [];
    return window.speechSynthesis.getVoices();
  }, [isSupported]);

  return {
    state,
    settings,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    startContinuousMode,
    stopContinuousMode,
    updateSettings,
    getAvailableVoices,
    cleanTextForSpeech,
  };
}

/**
 * Clean text for speech synthesis
 * Removes markdown, code blocks, and other non-speech content
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';

  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, 'code block')
      // Remove inline code
      .replace(/`[^`]+`/g, 'code')
      // Remove markdown links - keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, 'image: $1')
      // Remove markdown headers
      .replace(/#{1,6}\s+/g, '')
      // Remove bold/italic
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      // Remove bullet points
      .replace(/^[\s-*•]+/gm, '')
      // Remove numbered lists formatting
      .replace(/^\d+\.\s+/gm, '')
      // Remove URLs
      .replace(/https?:\/\/\S+/g, 'link')
      // Remove emoji (basic)
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
      // Remove special characters
      .replace(/[#@&|<>\\]/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export default useVoiceConversation;
