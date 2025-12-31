/**
 * useTextToSpeech Hook
 * 
 * Provides text-to-speech functionality for AI responses.
 * Supports multiple languages and voice selection.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTextToSpeechOptions {
    language?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    autoSpeak?: boolean;
}

interface UseTextToSpeechReturn {
    speak: (text: string) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    isSpeaking: boolean;
    isPaused: boolean;
    isSupported: boolean;
    voices: SpeechSynthesisVoice[];
    selectedVoice: SpeechSynthesisVoice | null;
    setVoice: (voice: SpeechSynthesisVoice) => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}): UseTextToSpeechReturn {
    const {
        language,
        rate = 1,
        pitch = 1,
        volume = 1,
        autoSpeak = false
    } = options;

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Get current language from localStorage or use default
    const getCurrentLanguage = useCallback(() => {
        if (language) return language;
        const i18nLang = localStorage.getItem('i18nextLng') || 'pl';
        const langMap: Record<string, string> = {
            'pl': 'pl-PL',
            'en': 'en-US',
            'de': 'de-DE'
        };
        return langMap[i18nLang] || 'pl-PL';
    }, [language]);

    // Initialize TTS and load voices
    useEffect(() => {
        if (!('speechSynthesis' in window)) {
            console.warn('[TTS] Speech synthesis not supported');
            return;
        }

        setIsSupported(true);

        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            setVoices(availableVoices);

            // Select best voice for current language
            const currentLang = getCurrentLanguage();
            const langVoices = availableVoices.filter(v => 
                v.lang.startsWith(currentLang.split('-')[0])
            );

            // Prefer native voices over remote
            const preferredVoice = langVoices.find(v => !v.localService) || 
                                   langVoices[0] ||
                                   availableVoices[0];

            if (preferredVoice && !selectedVoice) {
                setSelectedVoice(preferredVoice);
            }
        };

        // Load voices immediately if available
        loadVoices();

        // Also load when voices change (async loading in some browsers)
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, [getCurrentLanguage, selectedVoice]);

    // Speak text
    const speak = useCallback((text: string) => {
        if (!isSupported || !text.trim()) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = getCurrentLanguage();
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            setIsPaused(false);
        };

        utterance.onerror = (event) => {
            console.error('[TTS] Error:', event.error);
            setIsSpeaking(false);
            setIsPaused(false);
        };

        utterance.onpause = () => {
            setIsPaused(true);
        };

        utterance.onresume = () => {
            setIsPaused(false);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [isSupported, getCurrentLanguage, rate, pitch, volume, selectedVoice]);

    // Stop speech
    const stop = useCallback(() => {
        if (!isSupported) return;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
    }, [isSupported]);

    // Pause speech
    const pause = useCallback(() => {
        if (!isSupported || !isSpeaking) return;
        window.speechSynthesis.pause();
        setIsPaused(true);
    }, [isSupported, isSpeaking]);

    // Resume speech
    const resume = useCallback(() => {
        if (!isSupported || !isPaused) return;
        window.speechSynthesis.resume();
        setIsPaused(false);
    }, [isSupported, isPaused]);

    // Set voice
    const setVoice = useCallback((voice: SpeechSynthesisVoice) => {
        setSelectedVoice(voice);
    }, []);

    return {
        speak,
        stop,
        pause,
        resume,
        isSpeaking,
        isPaused,
        isSupported,
        voices,
        selectedVoice,
        setVoice
    };
}

/**
 * Utility to clean text for TTS (remove markdown, code blocks, etc.)
 */
export function cleanTextForSpeech(text: string): string {
    return text
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code
        .replace(/`[^`]+`/g, '')
        // Remove markdown links, keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove markdown headers
        .replace(/^#{1,6}\s+/gm, '')
        // Remove markdown bold/italic
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
        // Remove bullet points
        .replace(/^[-*+]\s+/gm, '')
        // Remove numbered lists
        .replace(/^\d+\.\s+/gm, '')
        // Clean up extra whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export default useTextToSpeech;

