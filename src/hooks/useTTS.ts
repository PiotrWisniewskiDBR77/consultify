/**
 * useTTS - Text-to-Speech Hook
 *
 * Provides text-to-speech functionality using the Web Speech API.
 * Features:
 * - Speak text with configurable voice, rate, and pitch
 * - Queue management for multiple utterances
 * - Sentence-by-sentence streaming for AI responses
 * - Support for Polish and English languages
 * - Voice selection from available system voices
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAppStore } from '../store/useAppStore';

export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: TTSVoice[];
  currentText: string;
}

interface UseTTSReturn {
  // State
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: TTSVoice[];
  currentText: string;

  // Actions
  speak: (text: string) => void;
  speakSentences: (text: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getPolishVoices: () => TTSVoice[];
  getEnglishVoices: () => TTSVoice[];
}

/**
 * Extract sentences from text for streaming TTS
 */
const extractSentences = (text: string): string[] => {
  // Split by sentence-ending punctuation, keeping the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.map((s) => s.trim()).filter((s) => s.length > 0);
};

/**
 * Clean text for TTS (remove markdown, code blocks, etc.)
 */
const cleanTextForTTS = (text: string): string => {
  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove bullet points
      .replace(/^[-*+]\s+/gm, '')
      // Remove numbered lists markers
      .replace(/^\d+\.\s+/gm, '')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
};

export const useTTS = (): UseTTSReturn => {
  const { aiConfig } = useAppStore();
  const [state, setState] = useState<TTSState>({
    isSpeaking: false,
    isPaused: false,
    isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    voices: [],
    currentText: '',
  });

  const synthesis = useRef<SpeechSynthesis | null>(null);
  const utteranceQueue = useRef<SpeechSynthesisUtterance[]>([]);
  const currentUtterance = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    synthesis.current = window.speechSynthesis;

    // Load voices
    const loadVoices = () => {
      const availableVoices = synthesis.current?.getVoices() || [];
      const mappedVoices: TTSVoice[] = availableVoices.map((voice) => ({
        id: voice.voiceURI,
        name: voice.name,
        lang: voice.lang,
        localService: voice.localService,
        default: voice.default,
      }));
      setState((s) => ({ ...s, voices: mappedVoices }));
    };

    // Load voices immediately and on change
    loadVoices();
    synthesis.current.addEventListener('voiceschanged', loadVoices);

    return () => {
      synthesis.current?.removeEventListener('voiceschanged', loadVoices);
      synthesis.current?.cancel();
    };
  }, []);

  // Get Polish voices
  const getPolishVoices = useCallback((): TTSVoice[] => {
    return state.voices.filter((v) => v.lang.startsWith('pl'));
  }, [state.voices]);

  // Get English voices
  const getEnglishVoices = useCallback((): TTSVoice[] => {
    return state.voices.filter((v) => v.lang.startsWith('en'));
  }, [state.voices]);

  // Find best voice for text
  const findBestVoice = useCallback(
    (text: string): SpeechSynthesisVoice | null => {
      if (!synthesis.current) return null;

      const voices = synthesis.current.getVoices();

      // If user selected a voice, use it
      if (aiConfig.ttsVoice) {
        const selectedVoice = voices.find((v) => v.voiceURI === aiConfig.ttsVoice);
        if (selectedVoice) return selectedVoice;
      }

      // Detect language (simple heuristic)
      const polishChars = (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
      const isPolish = polishChars > 2 || text.length < 20;

      // Find appropriate voice
      if (isPolish) {
        const polishVoice = voices.find((v) => v.lang.startsWith('pl'));
        if (polishVoice) return polishVoice;
      }

      // Default to English or any available voice
      const englishVoice = voices.find((v) => v.lang.startsWith('en'));
      return englishVoice || voices[0] || null;
    },
    [aiConfig.ttsVoice]
  );

  // Create utterance with config
  const createUtterance = useCallback(
    (text: string): SpeechSynthesisUtterance => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = findBestVoice(text);

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.rate = aiConfig.ttsRate ?? 1.0;
      utterance.pitch = aiConfig.ttsPitch ?? 1.0;
      utterance.volume = 1.0;

      return utterance;
    },
    [aiConfig.ttsRate, aiConfig.ttsPitch, findBestVoice]
  );

  // Process queue
  const processQueue = useCallback(() => {
    if (!synthesis.current || utteranceQueue.current.length === 0) {
      setState((s) => ({ ...s, isSpeaking: false, currentText: '' }));
      return;
    }

    const utterance = utteranceQueue.current.shift()!;
    currentUtterance.current = utterance;

    utterance.onstart = () => {
      setState((s) => ({ ...s, isSpeaking: true, currentText: utterance.text }));
    };

    utterance.onend = () => {
      currentUtterance.current = null;
      processQueue();
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Error:', event.error);
      currentUtterance.current = null;
      processQueue();
    };

    synthesis.current.speak(utterance);
  }, []);

  // Speak entire text at once
  const speak = useCallback(
    (text: string) => {
      if (!synthesis.current || !state.isSupported) {
        console.warn('[TTS] Speech synthesis not supported');
        return;
      }

      // Stop any current speech
      synthesis.current.cancel();
      utteranceQueue.current = [];

      const cleanedText = cleanTextForTTS(text);
      if (!cleanedText) return;

      const utterance = createUtterance(cleanedText);
      utteranceQueue.current.push(utterance);
      processQueue();
    },
    [state.isSupported, createUtterance, processQueue]
  );

  // Speak text sentence by sentence (better for streaming)
  const speakSentences = useCallback(
    (text: string) => {
      if (!synthesis.current || !state.isSupported) {
        console.warn('[TTS] Speech synthesis not supported');
        return;
      }

      const cleanedText = cleanTextForTTS(text);
      const sentences = extractSentences(cleanedText);

      if (sentences.length === 0 && cleanedText) {
        // If no sentences found, speak the whole text
        speak(cleanedText);
        return;
      }

      // Add sentences to queue
      sentences.forEach((sentence) => {
        const utterance = createUtterance(sentence);
        utteranceQueue.current.push(utterance);
      });

      // Start processing if not already speaking
      if (!state.isSpeaking) {
        processQueue();
      }
    },
    [state.isSupported, state.isSpeaking, createUtterance, processQueue, speak]
  );

  // Stop speaking
  const stop = useCallback(() => {
    if (synthesis.current) {
      synthesis.current.cancel();
      utteranceQueue.current = [];
      currentUtterance.current = null;
      setState((s) => ({ ...s, isSpeaking: false, isPaused: false, currentText: '' }));
    }
  }, []);

  // Pause speaking
  const pause = useCallback(() => {
    if (synthesis.current && state.isSpeaking) {
      synthesis.current.pause();
      setState((s) => ({ ...s, isPaused: true }));
    }
  }, [state.isSpeaking]);

  // Resume speaking
  const resume = useCallback(() => {
    if (synthesis.current && state.isPaused) {
      synthesis.current.resume();
      setState((s) => ({ ...s, isPaused: false }));
    }
  }, [state.isPaused]);

  return {
    // State
    isSpeaking: state.isSpeaking,
    isPaused: state.isPaused,
    isSupported: state.isSupported,
    voices: state.voices,
    currentText: state.currentText,

    // Actions
    speak,
    speakSentences,
    stop,
    pause,
    resume,
    getPolishVoices,
    getEnglishVoices,
  };
};

export default useTTS;
