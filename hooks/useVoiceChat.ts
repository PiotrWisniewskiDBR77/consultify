import { useState, useCallback, useRef, useEffect } from 'react';

interface VoiceChatState {
    isSpeaking: boolean;
    voiceEnabled: boolean;
    speechRate: number;
    availableVoices: SpeechSynthesisVoice[];
    selectedVoiceURI: string | null;
}

interface UseVoiceChatReturn extends VoiceChatState {
    speak: (text: string) => void;
    stopSpeaking: () => void;
    toggleVoice: () => void;
    setSpeechRate: (rate: number) => void;
    setSelectedVoice: (voiceURI: string) => void;
    ttsSupported: boolean;
}

/**
 * Custom hook for voice chat functionality
 * Provides Text-to-Speech (TTS) capabilities using Web Speech Synthesis API
 */
export const useVoiceChat = (): UseVoiceChatReturn => {
    const [state, setState] = useState<VoiceChatState>({
        isSpeaking: false,
        voiceEnabled: false,
        speechRate: 1.0,
        availableVoices: [],
        selectedVoiceURI: null
    });

    const synthRef = useRef<SpeechSynthesis | null>(null);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [ttsSupported, setTtsSupported] = useState(false);

    // Initialize Speech Synthesis
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            synthRef.current = window.speechSynthesis;
            setTtsSupported(true);

            // Load voices (may be async on some browsers)
            const loadVoices = () => {
                const voices = synthRef.current?.getVoices() || [];
                setState(prev => ({
                    ...prev,
                    availableVoices: voices,
                    // Prefer Polish voice, fallback to first available
                    selectedVoiceURI: prev.selectedVoiceURI ||
                        voices.find(v => v.lang.startsWith('pl'))?.voiceURI ||
                        voices[0]?.voiceURI || null
                }));
            };

            loadVoices();

            // Some browsers load voices asynchronously
            if (synthRef.current) {
                synthRef.current.onvoiceschanged = loadVoices;
            }
        }

        return () => {
            // Cleanup: stop speaking on unmount
            if (synthRef.current) {
                synthRef.current.cancel();
            }
        };
    }, []);

    // Speak text using TTS
    const speak = useCallback((text: string) => {
        if (!synthRef.current || !ttsSupported) {
            console.warn('Speech Synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        synthRef.current.cancel();

        // Clean text - remove markdown formatting for better speech
        const cleanText = text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1')     // Italic  
            .replace(/`(.*?)`/g, '$1')       // Code
            .replace(/#{1,6}\s/g, '')        // Headers
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '') // Images
            .replace(/[-*•]\s/g, '')         // List bullets
            .replace(/\n{2,}/g, '. ')        // Multiple newlines to pause
            .replace(/\n/g, ' ')             // Single newlines
            .trim();

        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = state.speechRate;
        utterance.lang = 'pl-PL'; // Default to Polish

        // Set selected voice
        if (state.selectedVoiceURI) {
            const voice = state.availableVoices.find(v => v.voiceURI === state.selectedVoiceURI);
            if (voice) {
                utterance.voice = voice;
                utterance.lang = voice.lang;
            }
        }

        utterance.onstart = () => {
            setState(prev => ({ ...prev, isSpeaking: true }));
        };

        utterance.onend = () => {
            setState(prev => ({ ...prev, isSpeaking: false }));
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            setState(prev => ({ ...prev, isSpeaking: false }));
        };

        utteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    }, [state.speechRate, state.selectedVoiceURI, state.availableVoices, ttsSupported]);

    // Stop current speech
    const stopSpeaking = useCallback(() => {
        if (synthRef.current) {
            synthRef.current.cancel();
            setState(prev => ({ ...prev, isSpeaking: false }));
        }
    }, []);

    // Toggle voice enabled
    const toggleVoice = useCallback(() => {
        setState(prev => {
            const newEnabled = !prev.voiceEnabled;
            // If disabling, stop any current speech
            if (!newEnabled && synthRef.current) {
                synthRef.current.cancel();
            }
            return { ...prev, voiceEnabled: newEnabled, isSpeaking: newEnabled ? prev.isSpeaking : false };
        });
    }, []);

    // Set speech rate (0.5 - 2.0)
    const setSpeechRate = useCallback((rate: number) => {
        const clampedRate = Math.min(2.0, Math.max(0.5, rate));
        setState(prev => ({ ...prev, speechRate: clampedRate }));
    }, []);

    // Set selected voice
    const setSelectedVoice = useCallback((voiceURI: string) => {
        setState(prev => ({ ...prev, selectedVoiceURI: voiceURI }));
    }, []);

    return {
        ...state,
        speak,
        stopSpeaking,
        toggleVoice,
        setSpeechRate,
        setSelectedVoice,
        ttsSupported
    };
};

export default useVoiceChat;
