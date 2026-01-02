/**
 * EnhancedChatInput
 * 
 * Perplexity-style chat input with:
 * - Dynamic button switching (voice conversation ↔ send)
 * - Separate dictation mic (for precision prompts)
 * - Live transcript display
 * - Audio level visualization
 * - Two distinct voice modes:
 *   1. Voice Conversation: Auto-send, AI speaks back
 *   2. Dictation: Fill text, user reviews and sends
 * 
 * Part of the Universal Voice Conversation System
 * 
 * @version 2.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Plus, Wrench, Mic, Square, AudioWaveform, StopCircle } from 'lucide-react';
import { AddFilesMenu } from './AddFilesMenu';
import { ToolsMenu } from './ToolsMenu';
import { useAppStore } from '../../store/useAppStore';

// ============================================================================
// Types
// ============================================================================

interface EnhancedChatInputProps {
    onSend: (message: string, attachments?: any[]) => void;
    onVoiceConversationStart?: () => void;
    onVoiceConversationEnd?: () => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    voiceModeEnabled?: boolean;
    onVoiceModeChange?: (enabled: boolean) => void;
}

// ============================================================================
// Component
// ============================================================================

export const EnhancedChatInput: React.FC<EnhancedChatInputProps> = ({
    onSend,
    onVoiceConversationStart,
    onVoiceConversationEnd,
    disabled = false,
    placeholder,
    className = '',
    voiceModeEnabled = false,
    onVoiceModeChange
}) => {
    const { t } = useTranslation();
    const { aiFreezeStatus } = useAppStore();
    
    // Input state
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [attachments, setAttachments] = useState<any[]>([]);
    
    // Voice state
    const [isDictating, setIsDictating] = useState(false);
    const [isVoiceConversation, setIsVoiceConversation] = useState(voiceModeEnabled);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [interimTranscript, setInterimTranscript] = useState('');
    
    // Support detection
    const [speechSupported, setSpeechSupported] = useState(false);
    
    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const vadIntervalRef = useRef<number | null>(null);

    const isDisabled = disabled || aiFreezeStatus.isFrozen;
    const hasText = value.trim().length > 0;
    const canSend = hasText && !isDisabled;
    const isRecordingAny = isDictating || isVoiceConversation;

    // ========================================================================
    // Initialize Speech Recognition
    // ========================================================================

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || 
                                  (window as any).webkitSpeechRecognition;
        
        if (SpeechRecognition || navigator.mediaDevices?.getUserMedia) {
            setSpeechSupported(true);
        }

        return () => {
            stopAllRecording();
        };
    }, []);

    // ========================================================================
    // Auto-resize textarea
    // ========================================================================

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [value]);

    // ========================================================================
    // Voice Activity Detection (VAD)
    // ========================================================================

    const startVAD = useCallback((stream: MediaStream) => {
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
                setAudioLevel(normalizedLevel);
            }, 100);

        } catch (error) {
            console.warn('[Voice] VAD not available');
        }
    }, []);

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
        setAudioLevel(0);
    }, []);

    // ========================================================================
    // Stop All Recording
    // ========================================================================

    const stopAllRecording = useCallback(() => {
        // Clear timers
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        // Stop Web Speech API
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_e) {
                // Ignore errors when stopping recognition
            }
        }

        // Stop MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        // Stop stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        stopVAD();
        setIsDictating(false);
        setIsVoiceConversation(false);
        setRecordingDuration(0);
        setInterimTranscript('');
    }, [stopVAD]);

    // ========================================================================
    // Dictation Mode (Web Speech API - fills input, user sends manually)
    // ========================================================================

    const startDictation = useCallback(async () => {
        if (isDictating || isVoiceConversation) return;

        const SpeechRecognition = (window as any).SpeechRecognition || 
                                  (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('[Voice] Web Speech API not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        const i18nLang = localStorage.getItem('i18nextLng') || 'pl';
        const langMap: Record<string, string> = {
            'pl': 'pl-PL', 'en': 'en-US', 'de': 'de-DE',
            'es': 'es-ES', 'ja': 'ja-JP', 'ar': 'ar-SA'
        };
        recognition.lang = langMap[i18nLang] || 'pl-PL';

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                setValue(prev => (prev + ' ' + final).trim());
                setInterimTranscript('');
            } else {
                setInterimTranscript(interim);
            }
        };

        recognition.onerror = (event: any) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.error('[Voice] Recognition error:', event.error);
            }
        };

        recognition.onend = () => {
            if (isDictating) {
                // Continue if still in dictation mode
                try {
                    recognition.start();
                } catch (e) {
                    setIsDictating(false);
                }
            }
        };

        recognitionRef.current = recognition;
        
        try {
            recognition.start();
            setIsDictating(true);
            
            // Start recording timer
            let duration = 0;
            recordingTimerRef.current = setInterval(() => {
                duration++;
                setRecordingDuration(duration);
            }, 1000);
            
        } catch (e) {
            console.error('[Voice] Failed to start dictation:', e);
        }
    }, [isDictating, isVoiceConversation]);

    const stopDictation = useCallback(() => {
        if (!isDictating) return;

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (_e) {
                // Ignore errors when stopping recognition
            }
        }

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        setIsDictating(false);
        setRecordingDuration(0);
        setInterimTranscript('');
    }, [isDictating]);

    // ========================================================================
    // Voice Conversation Mode (Server STT, auto-send, AI speaks back)
    // ========================================================================

    const startVoiceConversation = useCallback(async () => {
        if (isDictating || isVoiceConversation) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;
            audioChunksRef.current = [];

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
                stream.getTracks().forEach(track => track.stop());
                stopVAD();

                if (audioChunksRef.current.length > 0) {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    
                    // Send to server for transcription
                    try {
                        const formData = new FormData();
                        formData.append('audio', audioBlob, 'audio.webm');
                        formData.append('language', localStorage.getItem('i18nextLng') || 'pl');

                        const response = await fetch('/api/voice/stt', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                        });

                        if (response.ok) {
                            const result = await response.json();
                            if (result.text?.trim()) {
                                onSend(result.text.trim());
                            }
                        }
                    } catch (error) {
                        console.error('[Voice] Transcription error:', error);
                    }
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start(1000);

            startVAD(stream);

            setIsVoiceConversation(true);
            onVoiceModeChange?.(true);
            onVoiceConversationStart?.();

            // Recording timer
            let duration = 0;
            recordingTimerRef.current = setInterval(() => {
                duration++;
                setRecordingDuration(duration);
            }, 1000);

        } catch (error: any) {
            console.error('[Voice] Failed to start voice conversation:', error);
        }
    }, [isDictating, isVoiceConversation, onSend, onVoiceModeChange, onVoiceConversationStart, startVAD, stopVAD]);

    const stopVoiceConversation = useCallback(() => {
        if (!isVoiceConversation) return;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        stopVAD();
        setIsVoiceConversation(false);
        setRecordingDuration(0);
        onVoiceModeChange?.(false);
        onVoiceConversationEnd?.();
    }, [isVoiceConversation, onVoiceModeChange, onVoiceConversationEnd, stopVAD]);

    // ========================================================================
    // Handlers
    // ========================================================================

    const handleSend = useCallback(() => {
        if (!canSend) return;
        stopDictation();
        onSend(value.trim(), attachments.length > 0 ? attachments : undefined);
        setValue('');
        setAttachments([]);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [canSend, value, attachments, onSend, stopDictation]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleDynamicButtonClick = useCallback(() => {
        if (hasText) {
            // Has text → Send
            handleSend();
        } else {
            // Empty → Toggle voice conversation
            if (isVoiceConversation) {
                stopVoiceConversation();
            } else {
                startVoiceConversation();
            }
        }
    }, [hasText, handleSend, isVoiceConversation, stopVoiceConversation, startVoiceConversation]);

    const handleDictationClick = useCallback(() => {
        if (isDictating) {
            stopDictation();
        } else {
            startDictation();
        }
    }, [isDictating, startDictation, stopDictation]);

    const handleFileSelect = useCallback((files: File[]) => {
        setAttachments(prev => [...prev, ...files]);
    }, []);

    const handlePmoImport = useCallback((type: string, data: any) => {
        setAttachments(prev => [...prev, { type: `pmo:${type}`, data }]);
    }, []);

    // ========================================================================
    // Render
    // ========================================================================

    const placeholderText = aiFreezeStatus.isFrozen
        ? t('aiChat.frozenPlaceholder', 'AI temporarily unavailable')
        : isRecordingAny
            ? isVoiceConversation 
                ? t('aiChat.voiceConversation', 'Listening... speak naturally')
                : t('aiChat.dictating', 'Dictating...')
            : placeholder || t('aiChat.placeholder', 'Ask anything...');

    return (
        <div className={`${className}`}>
            {/* Attachments Preview */}
            {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-1">
                    {attachments.map((att, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-navy-800 rounded text-xs text-slate-600 dark:text-slate-400"
                        >
                            <span>{att.name || att.type}</span>
                            <button
                                onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Live Transcript Indicator */}
            {(isDictating || isVoiceConversation) && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    {/* Audio Level Bars */}
                    <div className="flex items-center gap-0.5 h-4">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                                style={{
                                    height: `${Math.max(4, Math.min(16, audioLevel * 20 * (i + 1)))}px`,
                                    opacity: audioLevel > i * 0.2 ? 1 : 0.3
                                }}
                            />
                        ))}
                    </div>
                    
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {isVoiceConversation ? 'Voice Conversation' : 'Dictation'}
                    </span>
                    
                    <span className="text-xs text-slate-500 tabular-nums">
                        {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>

                    {interimTranscript && (
                        <span className="flex-1 text-xs text-slate-600 dark:text-slate-400 italic truncate">
                            "{interimTranscript}"
                        </span>
                    )}
                </div>
            )}

            {/* Main Input Container */}
            <div className={`
                bg-white dark:bg-navy-900 rounded-2xl border transition-all duration-200
                ${isFocused
                    ? 'border-primary-500 shadow-lg shadow-primary-500/10 dark:shadow-primary-500/5'
                    : 'border-slate-200 dark:border-white/10 shadow-sm'
                }
                ${isRecordingAny ? 'ring-2 ring-blue-500/50' : ''}
                ${isDisabled ? 'opacity-60' : ''}
            `}>
                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholderText}
                    disabled={isDisabled}
                    rows={1}
                    className={`
                        w-full bg-transparent text-navy-900 dark:text-white
                        placeholder-slate-400 dark:placeholder-slate-500
                        px-4 pt-4 pb-2 resize-none focus:outline-none text-[15px]
                    `}
                />

                {/* Action Bar */}
                <div className="flex items-center justify-between px-3 pb-3">
                    {/* Left Actions */}
                    <div className="flex items-center gap-1">
                        <AddFilesMenu
                            onFileSelect={handleFileSelect}
                            onPmoImport={handlePmoImport}
                            disabled={isDisabled}
                        />
                        <ToolsMenu
                            onToolSelect={(tool) => console.log('Tool selected:', tool)}
                            disabled={isDisabled}
                            icon={Wrench}
                        />
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Dictation Button (always visible, separate from conversation) */}
                        {speechSupported && !isVoiceConversation && (
                            <button
                                onClick={handleDictationClick}
                                disabled={isDisabled}
                                className={`
                                    flex items-center gap-1.5 p-2 rounded-lg transition-all
                                    ${isDictating
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }
                                    ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                                `}
                                title={isDictating 
                                    ? t('aiChat.stopDictation', 'Stop dictation')
                                    : t('aiChat.startDictation', 'Dictate (fills input, you review & send)')
                                }
                            >
                                {isDictating ? <StopCircle size={18} /> : <Mic size={18} />}
                            </button>
                        )}

                        {/* Dynamic Button: Voice Conversation OR Send */}
                        <button
                            onClick={handleDynamicButtonClick}
                            disabled={isDisabled || (hasText && !canSend)}
                            className={`
                                p-2.5 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center
                                ${hasText
                                    ? canSend
                                        ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                                        : 'bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                                    : isVoiceConversation
                                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 animate-pulse'
                                        : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:bg-primary-100 hover:text-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-400'
                                }
                                ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                            `}
                            title={
                                hasText
                                    ? t('aiChat.send', 'Send')
                                    : isVoiceConversation
                                        ? t('aiChat.stopVoice', 'Stop voice conversation')
                                        : t('aiChat.startVoice', 'Start voice conversation (auto-send)')
                            }
                        >
                            {hasText ? (
                                <Send size={18} />
                            ) : isVoiceConversation ? (
                                <Square size={18} className="fill-current" />
                            ) : (
                                <AudioWaveform size={18} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnhancedChatInput;
