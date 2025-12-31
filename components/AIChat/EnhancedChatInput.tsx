/**
 * EnhancedChatInput
 * 
 * Advanced chat input with:
 * - Expanding textarea (auto-resize up to 200px)
 * - Add Files menu [+]
 * - Tools menu [Wrench]
 * - Voice input/output (two-way conversation)
 * - Send button
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Plus, Wrench, Mic, Square, Volume2, VolumeX } from 'lucide-react';
import { AddFilesMenu } from './AddFilesMenu';
import { ToolsMenu } from './ToolsMenu';
import { useAppStore } from '../../store/useAppStore';

interface EnhancedChatInputProps {
    onSend: (message: string, attachments?: any[]) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    showQuickActions?: boolean;
    onQuickAction?: (action: string) => void;
    voiceModeEnabled?: boolean;
    onVoiceModeChange?: (enabled: boolean) => void;
}

export const EnhancedChatInput: React.FC<EnhancedChatInputProps> = ({
    onSend,
    disabled = false,
    placeholder,
    className = '',
    showQuickActions = false,
    onQuickAction,
    voiceModeEnabled = false,
    onVoiceModeChange
}) => {
    const { t } = useTranslation();
    const { aiFreezeStatus } = useAppStore();
    
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [ttsSupported, setTtsSupported] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(voiceModeEnabled);
    const [attachments, setAttachments] = useState<any[]>([]);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<any>(null);

    const isDisabled = disabled || aiFreezeStatus.isFrozen;
    const canSend = value.trim().length > 0 && !isDisabled;

    // Initialize speech recognition and TTS
    useEffect(() => {
        // Speech Recognition (input)
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = true; // Keep listening
            recognition.interimResults = true;

            const i18nLang = localStorage.getItem('i18nextLng') || 'pl';
            const langMap: Record<string, string> = {
                'pl': 'pl-PL',
                'en': 'en-US',
                'de': 'de-DE'
            };
            recognition.lang = langMap[i18nLang] || 'pl-PL';

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0].transcript)
                    .join('');
                setValue(transcript);
                
                // Auto-send in voice mode when speech ends with final result
                const lastResult = event.results[event.results.length - 1];
                if (isVoiceMode && lastResult.isFinal && transcript.trim()) {
                    // Small delay to allow for natural pauses
                    setTimeout(() => {
                        if (transcript.trim()) {
                            onSend(transcript.trim());
                            setValue('');
                        }
                    }, 500);
                }
            };

            recognition.onerror = (e: any) => {
                console.error('[Voice] Recognition error:', e.error);
                if (e.error !== 'no-speech') {
                    setIsRecording(false);
                }
            };
            
            recognition.onend = () => {
                // Auto-restart in voice mode
                if (isVoiceMode && isRecording) {
                    try {
                        recognition.start();
                    } catch (e) {
                        setIsRecording(false);
                    }
                } else {
                    setIsRecording(false);
                }
            };

            recognitionRef.current = recognition;
        }

        // Text-to-Speech (output)
        if ('speechSynthesis' in window) {
            setTtsSupported(true);
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
            // Stop any ongoing speech
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, [isVoiceMode]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [value]);

    const handleSend = () => {
        if (!canSend) return;
        onSend(value.trim(), attachments.length > 0 ? attachments : undefined);
        setValue('');
        setAttachments([]);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleRecording = () => {
        if (!recognitionRef.current) return;

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setValue('');
            try {
                recognitionRef.current.start();
                setIsRecording(true);
            } catch (e) {
                console.error('[Voice] Failed to start recognition:', e);
            }
        }
    };

    // Toggle voice conversation mode (two-way)
    const toggleVoiceMode = () => {
        const newMode = !isVoiceMode;
        setIsVoiceMode(newMode);
        onVoiceModeChange?.(newMode);

        if (newMode) {
            // Start listening when voice mode is enabled
            if (recognitionRef.current && !isRecording) {
                try {
                    recognitionRef.current.start();
                    setIsRecording(true);
                } catch (e) {
                    console.error('[Voice] Failed to start:', e);
                }
            }
        } else {
            // Stop everything when voice mode is disabled
            if (recognitionRef.current && isRecording) {
                recognitionRef.current.stop();
                setIsRecording(false);
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        }
    };

    const handleFileSelect = (files: File[]) => {
        setAttachments(prev => [...prev, ...files]);
    };

    const handlePmoImport = (type: string, data: any) => {
        // Handle PMO data import (assessment, initiative, roadmap)
        console.log('[EnhancedInput] PMO Import:', type, data);
        setAttachments(prev => [...prev, { type: `pmo:${type}`, data }]);
    };

    const placeholderText = aiFreezeStatus.isFrozen
        ? t('aiChat.frozenPlaceholder', 'AI temporarily unavailable')
        : isRecording
            ? t('aiChat.listening', 'Listening...')
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

            {/* Main Input Container */}
            <div className={`
                bg-white dark:bg-navy-900 rounded-2xl border transition-all duration-200
                ${isFocused
                    ? 'border-primary-500 shadow-lg shadow-primary-500/10 dark:shadow-primary-500/5'
                    : 'border-slate-200 dark:border-white/10 shadow-sm'
                }
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
                        ${isRecording ? 'animate-pulse' : ''}
                    `}
                />

                {/* Action Bar */}
                <div className="flex items-center justify-between px-3 pb-3">
                    {/* Left Actions */}
                    <div className="flex items-center gap-1">
                        {/* Add Files Menu */}
                        <AddFilesMenu
                            onFileSelect={handleFileSelect}
                            onPmoImport={handlePmoImport}
                            disabled={isDisabled}
                        />

                        {/* Tools Menu */}
                        <ToolsMenu
                            onToolSelect={(tool) => console.log('Tool selected:', tool)}
                            disabled={isDisabled}
                            icon={Wrench}
                        />
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                        {/* Voice Mode Toggle (two-way conversation) */}
                        {speechSupported && ttsSupported && (
                            <button
                                onClick={toggleVoiceMode}
                                disabled={isDisabled}
                                className={`
                                    p-2 rounded-lg transition-all
                                    ${isVoiceMode
                                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30 animate-pulse'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }
                                    ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                                `}
                                title={isVoiceMode 
                                    ? t('aiChat.voiceModeOn', 'Voice conversation active - click to disable')
                                    : t('aiChat.voiceModeOff', 'Enable voice conversation')
                                }
                            >
                                {isVoiceMode ? <Volume2 size={18} /> : <VolumeX size={18} />}
                            </button>
                        )}

                        {/* Voice Input (manual recording) */}
                        {speechSupported && !isVoiceMode && (
                            <button
                                onClick={toggleRecording}
                                disabled={isDisabled}
                                className={`
                                    p-2 rounded-lg transition-all
                                    ${isRecording
                                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                    }
                                    ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                                `}
                                title={isRecording ? t('aiChat.stopRecording', 'Stop') : t('aiChat.startRecording', 'Voice input')}
                            >
                                {isRecording ? <Square size={18} /> : <Mic size={18} />}
                            </button>
                        )}

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!canSend}
                            className={`
                                p-2.5 rounded-xl transition-all duration-200
                                ${canSend
                                    ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                                    : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                }
                            `}
                            title={t('aiChat.send', 'Send')}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            {showQuickActions && onQuickAction && (
                <div className="flex items-center justify-center gap-3 mt-4">
                    {['Assess', 'Generate', 'Plan', 'Report'].map(action => (
                        <button
                            key={action}
                            onClick={() => onQuickAction(action)}
                            disabled={isDisabled}
                            className="
                                flex items-center gap-2 px-4 py-2
                                bg-white dark:bg-navy-900/50
                                hover:bg-slate-100 dark:hover:bg-navy-800
                                border border-slate-200 dark:border-white/10
                                hover:border-primary-400 dark:hover:border-primary-500/40
                                rounded-full text-sm font-medium
                                text-slate-600 dark:text-slate-300
                                hover:text-primary-600 dark:hover:text-primary-400
                                transition-all duration-200
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {t(`aiChat.actions.${action.toLowerCase()}`, action)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EnhancedChatInput;

