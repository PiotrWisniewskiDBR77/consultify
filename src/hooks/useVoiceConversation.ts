import { useCallback, useMemo, useRef, useState } from 'react';

type VoiceConversationSettings = {
  language?: string;
  continuousListening?: boolean;
  autoSpeak?: boolean;
  silenceTimeout?: number;
};

type VoiceConversationHandlers = {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onSendMessage?: (message: string) => Promise<void> | void;
  settings?: VoiceConversationSettings;
};

type VoiceConversationState = {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  interimTranscript: string;
  error?: string | null;
};

type VoiceConversationApi = {
  state: VoiceConversationState;
  startContinuousMode: () => void;
  stopContinuousMode: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  isSupported: boolean;
};

export const useVoiceConversation = ({
  onTranscript,
  onSendMessage,
  settings,
}: VoiceConversationHandlers = {}): VoiceConversationApi => {
  const [state, setState] = useState<VoiceConversationState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    interimTranscript: '',
    error: null,
  });
  const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported = useMemo(() => {
    return typeof window !== 'undefined';
  }, []);

  const startContinuousMode = useCallback(() => {
    setState((prev) => ({ ...prev, isListening: true, error: null }));
    if (settings?.continuousListening === false) {
      setState((prev) => ({ ...prev, isListening: false }));
    }
  }, [settings?.continuousListening]);

  const stopContinuousMode = useCallback(() => {
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      setState((prev) => ({ ...prev, isSpeaking: true }));
      if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
      }
      speakTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, isSpeaking: false }));
      }, settings?.silenceTimeout ?? 800);
    },
    [settings?.silenceTimeout]
  );

  const stopSpeaking = useCallback(() => {
    if (speakTimeoutRef.current) {
      clearTimeout(speakTimeoutRef.current);
    }
    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, []);

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (isFinal) {
        setState((prev) => ({ ...prev, transcript: text, interimTranscript: '' }));
        onTranscript?.(text, true);
        if (text.trim()) {
          onSendMessage?.(text);
        }
      } else {
        setState((prev) => ({ ...prev, interimTranscript: text }));
        onTranscript?.(text, false);
      }
    },
    [onSendMessage, onTranscript]
  );

  // Provide a no-op hook signature that can be expanded later.
  useMemo(() => handleTranscript, [handleTranscript]);

  return {
    state,
    startContinuousMode,
    stopContinuousMode,
    speak,
    stopSpeaking,
    isSupported,
  };
};

export default useVoiceConversation;
