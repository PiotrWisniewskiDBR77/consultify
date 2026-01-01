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

import { useState, useCallback, useRef, useEffect } from 'react';

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
    showLiveTranscript: true
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUniversalVoice(options: UseUniversalVoiceOptions = {}): UseUniversalVoiceReturn {
    const {
        onTranscript,
        onSendMessage,
        onAudioResponse,
        settings: initialSettings = {}
    } = options;

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
        recordingDuration: 0
    });

    const [settings, setSettings] = useState<VoiceSettings>({
        ...DEFAULT_SETTINGS,
        ...initialSettings
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

    // Check browser support
    const isSupported = typeof window !== 'undefined' && 
        (navigator.mediaDevices?.getUserMedia !== undefined) &&
        ('speechSynthesis' in window || true); // TTS via API always available

    // ========================================================================
    // Audio Level Monitoring (VAD)
    // ========================================================================

    const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
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
                
                setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
                
                if (state.isListening) {
                    requestAnimationFrame(checkLevel);
                }
            };

            checkLevel();
        } catch (error) {
            console.warn('[Voice] Audio level monitoring not available:', error);
        }
    }, [state.isListening]);

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

    const transcribeWithServer = useCallback(async (audioBlob: Blob): Promise<string> => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');
        formData.append('language', settings.language);

        const response = await fetch('/api/voice/stt', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'STT failed');
        }

        const result = await response.json();
        return result.text;
    }, [settings.language]);

    // ========================================================================
    // Client-side STT (Web Speech API)
    // ========================================================================

    const initWebSpeechRecognition = useCallback(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || 
                                  (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) return null;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = settings.language === 'pl' ? 'pl-PL' : 
                          settings.language === 'en' ? 'en-US' : 
                          settings.language === 'de' ? 'de-DE' : 'pl-PL';

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

            setState(prev => ({
                ...prev,
                transcript: finalTranscript || prev.transcript,
                interimTranscript
            }));

            if (finalTranscript) {
                onTranscript?.(finalTranscript.trim(), true);
            } else if (interimTranscript) {
                onTranscript?.(interimTranscript, false);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('[Voice] Web Speech error:', event.error);
            if (event.error !== 'no-speech') {
                setState(prev => ({
                    ...prev,
                    error: `Speech recognition error: ${event.error}`,
                    isListening: false,
                    mode: 'idle'
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
                    autoGainControl: true
                }
            });

            audioChunksRef.current = [];
            
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(track => track.stop());
                stopAudioLevelMonitoring();

                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    
                    setState(prev => ({ ...prev, mode: 'processing', isProcessing: true }));

                    try {
                        const text = await transcribeWithServer(audioBlob);
                        setState(prev => ({ 
                            ...prev, 
                            transcript: text,
                            mode: 'idle',
                            isProcessing: false 
                        }));
                        onTranscript?.(text, true);

                        // Auto-send if in continuous mode
                        if (continuousModeRef.current && text.trim()) {
                            await onSendMessage?.(text.trim());
                        }
                    } catch (error: any) {
                        console.error('[Voice] Transcription error:', error);
                        setState(prev => ({ 
                            ...prev, 
                            error: error.message,
                            mode: 'idle',
                            isProcessing: false 
                        }));
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
                setState(prev => ({ ...prev, recordingDuration: duration }));
            }, 1000);

        } catch (error: any) {
            console.error('[Voice] Failed to start recording:', error);
            setState(prev => ({ 
                ...prev, 
                error: 'Microphone access denied',
                isListening: false,
                mode: 'idle'
            }));
        }
    }, [transcribeWithServer, onTranscript, onSendMessage, startAudioLevelMonitoring, stopAudioLevelMonitoring]);

    // ========================================================================
    // STT Control Methods
    // ========================================================================

    const startListening = useCallback(() => {
        if (state.isListening || state.isSpeaking) return;

        setState(prev => ({
            ...prev,
            isListening: true,
            mode: 'listening',
            error: null,
            transcript: '',
            interimTranscript: '',
            recordingDuration: 0
        }));

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
    }, [state.isListening, state.isSpeaking, settings.sttProvider, startMediaRecording, initWebSpeechRecognition]);

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

        setState(prev => ({
            ...prev,
            isListening: false,
            mode: prev.isProcessing ? 'processing' : 'idle',
            recordingDuration: 0
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

    const speak = useCallback(async (text: string): Promise<void> => {
        if (!text.trim()) return;

        // Stop any current audio
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }

        // Stop listening while speaking
        if (state.isListening) {
            stopListening();
        }

        setState(prev => ({ ...prev, isSpeaking: true, mode: 'speaking' }));

        try {
            if (settings.ttsProvider === 'web') {
                // Web Speech Synthesis
                return new Promise((resolve, reject) => {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = settings.language === 'pl' ? 'pl-PL' : 
                                    settings.language === 'en' ? 'en-US' : 'pl-PL';
                    utterance.rate = settings.ttsSpeed;

                    utterance.onend = () => {
                        setState(prev => ({ ...prev, isSpeaking: false, mode: 'idle' }));
                        // Resume listening in continuous mode
                        if (continuousModeRef.current) {
                            setTimeout(startListening, 300);
                        }
                        resolve();
                    };

                    utterance.onerror = (event) => {
                        setState(prev => ({ ...prev, isSpeaking: false, mode: 'idle' }));
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
                        speed: settings.ttsSpeed
                    })
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
                        setState(prev => ({ ...prev, isSpeaking: false, mode: 'idle' }));
                        // Resume listening in continuous mode
                        if (continuousModeRef.current) {
                            setTimeout(startListening, 300);
                        }
                        resolve();
                    };

                    audio.onerror = () => {
                        URL.revokeObjectURL(audioUrl);
                        currentAudioRef.current = null;
                        setState(prev => ({ ...prev, isSpeaking: false, mode: 'idle' }));
                        reject(new Error('Audio playback error'));
                    };

                    audio.play();
                });
            }
        } catch (error: any) {
            console.error('[Voice] TTS error:', error);
            setState(prev => ({ 
                ...prev, 
                isSpeaking: false, 
                mode: 'idle',
                error: error.message 
            }));
            throw error;
        }
    }, [settings, state.isListening, stopListening, startListening, onAudioResponse]);

    const stopSpeaking = useCallback(() => {
        // Stop Web Speech
        window.speechSynthesis?.cancel();
        
        // Stop audio playback
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }

        setState(prev => ({ ...prev, isSpeaking: false, mode: 'idle' }));
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
        setState(prev => ({ ...prev, mode: 'idle' }));
    }, [stopListening, stopSpeaking]);

    // ========================================================================
    // Settings & Utilities
    // ========================================================================

    const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    }, []);

    const getAvailableVoices = useCallback(async () => {
        try {
            const response = await fetch('/api/voice/voices', {
                credentials: 'include'
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
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                return {
                    stt: data.stt?.healthyProviders?.length > 0,
                    tts: data.tts?.healthyProviders?.length > 0
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

    useEffect(() => {
        return () => {
            stopListening();
            stopSpeaking();
            stopAudioLevelMonitoring();
        };
    }, [stopListening, stopSpeaking, stopAudioLevelMonitoring]);

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
        testConnection
    };
}

export default useUniversalVoice;

