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

import { ArrowUp, AudioLines, Loader2, Mic, MicOff, Pen, Square, StopCircle } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { CloudFile, CloudProviderId, useCloudIntegrations } from '../../hooks/useCloudIntegrations';
import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { AddFilesMenu } from './AddFilesMenu';
import { CloudFilePicker } from './CloudFilePicker';
import { CoThinkerMenu } from './CoThinkerMenu';
import { MoveToProjectModal } from './MoveToProjectModal';
import { ToolsMenu } from './ToolsMenu';

// ============================================================================
// Types
// ============================================================================

interface EnhancedChatInputProps {
  onSend: (message: string, attachments?: any[]) => void;
  onStopGenerating?: () => void;
  onVoiceConversationStart?: () => void;
  onVoiceConversationEnd?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * Visual density preset.
   * - default: standard height used in main chat
   * - compact: smaller height (used in welcome/landing-like chat screens)
   */
  variant?: 'default' | 'compact';
  voiceModeEnabled?: boolean;
  onVoiceModeChange?: (enabled: boolean) => void;

  /** Chat/conversation language used for speech recognition (e.g. 'pl', 'en') */
  chatLanguage?: string;

  // Voice Props from Parent
  voiceState?: {
    isListening: boolean;
    isSpeaking: boolean;
    isProcessing: boolean;
    audioLevel: number;
    recordingDuration: number;
    interimTranscript: string;
  };
  startVoiceListening?: () => void;
  stopVoiceListening?: () => void;
  onToolSelect?: (tool: string) => void;

  /** Teresa real-time voice status: 'idle' | 'connecting' | 'live' | 'error' */
  teresaVoiceStatus?: string;
  /** Toggle Teresa real-time voice on/off */
  onTeresaVoiceToggle?: () => void;
  /** Whether Teresa mic is currently muted */
  teresaVoiceMuted?: boolean;
  /** Toggle Teresa mic mute */
  onTeresaVoiceMuteToggle?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const EnhancedChatInput: React.FC<EnhancedChatInputProps> = ({
  onSend,
  onStopGenerating,
  onVoiceConversationStart,
  onVoiceConversationEnd,
  disabled = false,
  isStreaming = false,
  placeholder,
  className = '',
  variant = 'default',
  voiceModeEnabled = false,
  onVoiceModeChange,
  chatLanguage,
  voiceState,
  startVoiceListening,
  stopVoiceListening,
  onToolSelect,
  teresaVoiceStatus,
  onTeresaVoiceToggle,
  teresaVoiceMuted,
  onTeresaVoiceMuteToggle,
}) => {
  const { t, i18n } = useTranslation();
  const { aiFreezeStatus } = useAppStore();
  const uiLangBase = String(i18n.language || 'pl')
    .split('-')[0]
    .toLowerCase();
  const uiLang = uiLangBase === 'ja' ? 'jp' : uiLangBase;

  // Cloud integrations
  const {
    connectedProviderIds,
    openFilePicker,
    connectProvider,
    isPickerOpen,
    activeProvider,
    closeFilePicker,
    selectFile,
    isImplemented: isCloudImplemented,
  } = useCloudIntegrations();

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
  const isDictatingRef = useRef(false);

  const isDisabled = disabled || aiFreezeStatus.isFrozen;
  const isInputDisabled = isDisabled || isStreaming;
  const hasText = value.trim().length > 0;
  const canSend = hasText && !isInputDisabled;
  const { activeConversationId, conversations } = useConversationStore();
  const [showMoveToProject, setShowMoveToProject] = useState(false);

  // Use either internal or external voice state
  const isDictatingVal = isDictating;
  const isVoiceConversationVal = voiceState ? voiceState.isListening : isVoiceConversation;
  const isRecordingAny = isDictatingVal || isVoiceConversationVal;

  // When dictation mode is active (internal), use internal state;
  // otherwise defer to external voiceState (voice conversation mode).
  const currentAudioLevel = isDictating
    ? audioLevel
    : voiceState
      ? voiceState.audioLevel
      : audioLevel;
  const currentRecordingDuration = isDictating
    ? recordingDuration
    : voiceState
      ? voiceState.recordingDuration
      : recordingDuration;
  const currentInterimTranscript = isDictating
    ? interimTranscript
    : voiceState
      ? voiceState.interimTranscript
      : interimTranscript;

  // ========================================================================
  // Initialize Speech Recognition
  // ========================================================================

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (
      SpeechRecognitionClass ||
      (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function')
    ) {
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
      const maxPx = variant === 'compact' ? 220 : 280;
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, maxPx) + 'px';
    }
  }, [value, variant]);

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
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    stopVAD();
    isDictatingRef.current = false;
    setIsDictating(false);
    setIsVoiceConversation(false);
    setRecordingDuration(0);
    setInterimTranscript('');
  }, [stopVAD]);

  // ========================================================================
  // Dictation Mode (Web Speech API - fills input, user sends manually)
  // ========================================================================

  const startDictation = useCallback(async () => {
    if (isDictatingRef.current || isVoiceConversation) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[Voice] Web Speech API not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Use chatLanguage prop (conversation language) for speech recognition,
    // falling back to localStorage/default only if not provided.
    const effectiveLang = chatLanguage || uiLang || 'pl';
    const langMap: Record<string, string> = {
      pl: 'pl-PL',
      en: 'en-US',
      de: 'de-DE',
      es: 'es-ES',
      jp: 'ja-JP',
      ja: 'ja-JP', // alias
      ar: 'ar-SA',
    };
    recognition.lang = langMap[effectiveLang] || 'pl-PL';

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
        setValue((prev) => (prev + ' ' + final).trim());
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
      // Use ref to avoid stale closure - isDictating state would always be false here
      if (isDictatingRef.current) {
        // Continue if still in dictation mode
        try {
          recognition.start();
        } catch (e) {
          isDictatingRef.current = false;
          setIsDictating(false);
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      isDictatingRef.current = true;
      setIsDictating(true);

      // Start recording timer
      let duration = 0;
      recordingTimerRef.current = setInterval(() => {
        duration++;
        setRecordingDuration(duration);
      }, 1000);

      // Start audio level monitoring for visual feedback
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = micStream;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        const source = ctx.createMediaStreamSource(micStream);
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
          if (!isDictatingRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const avg = sum / dataArray.length / 255;
          setAudioLevel(avg);
          vadIntervalRef.current = requestAnimationFrame(updateLevel) as unknown as number;
        };
        vadIntervalRef.current = requestAnimationFrame(updateLevel) as unknown as number;
      } catch (micErr) {
        // Non-critical: audio bars won't animate but dictation still works
        console.warn('[Voice] Could not open mic for audio level display:', micErr);
      }
    } catch (e) {
      console.error('[Voice] Failed to start dictation:', e);
    }
  }, [isVoiceConversation]);

  const stopDictation = useCallback(() => {
    if (!isDictatingRef.current) return;

    // Mark as stopped FIRST so onend callback won't restart
    isDictatingRef.current = false;

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

    // Clean up audio monitoring resources
    if (vadIntervalRef.current) {
      cancelAnimationFrame(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;

    setIsDictating(false);
    setRecordingDuration(0);
    setAudioLevel(0);
    setInterimTranscript('');
  }, []);

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
          autoGainControl: true,
        },
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
        stream.getTracks().forEach((track) => track.stop());
        stopVAD();

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          // Send to server for transcription
          try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.webm');
            formData.append('language', chatLanguage || uiLang || 'pl');

            const response = await fetch('/api/voice/stt', {
              method: 'POST',
              body: formData,
              credentials: 'include',
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
  }, [
    isDictating,
    isVoiceConversation,
    onSend,
    onVoiceModeChange,
    onVoiceConversationStart,
    startVAD,
    stopVAD,
  ]);

  const stopVoiceConversation = useCallback(() => {
    if (!isVoiceConversation) return;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
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
    if (isStreaming) return;
    stopDictation();
    onSend(value.trim(), attachments.length > 0 ? attachments : undefined);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, isStreaming, value, attachments, onSend, stopDictation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) return;
        handleSend();
      }
    },
    [handleSend, isStreaming]
  );

  const handleDynamicButtonClick = useCallback(() => {
    if (isStreaming) {
      onStopGenerating?.();
      return;
    }
    if (hasText) {
      handleSend();
    }
  }, [isStreaming, onStopGenerating, hasText, handleSend]);

  const handleDictationClick = useCallback(() => {
    if (isDictatingRef.current) {
      stopDictation();
    } else {
      startDictation();
    }
  }, [startDictation, stopDictation]);

  const handleFileSelect = useCallback((files: File[]) => {
    setAttachments((prev) => [...prev, ...files]);
  }, []);

  const handleUrlAdd = useCallback((url: string) => {
    const clean = String(url || '').trim();
    if (!clean) return;
    setAttachments((prev) => [
      ...prev,
      {
        kind: 'url',
        url: clean,
        name: clean,
      },
    ]);
  }, []);

  // Cloud file selection handler - opens file picker for connected provider
  const handleCloudFileSelect = useCallback(
    (provider: CloudProviderId, _fileId: string, _fileName: string) => {
      openFilePicker(provider);
    },
    [openFilePicker]
  );

  // Cloud connection handler - redirects to integrations settings
  const handleConnectCloud = useCallback(
    (provider: CloudProviderId) => {
      connectProvider(provider);
    },
    [connectProvider]
  );

  // Handle file selection from cloud picker
  const handleCloudFilePickerSelect = useCallback(
    async (file: CloudFile) => {
      if (!activeProvider) return;

      const downloadedFile = await selectFile(file, activeProvider);
      if (downloadedFile) {
        setAttachments((prev) => [...prev, downloadedFile]);
      }
      closeFilePicker();
    },
    [activeProvider, selectFile, closeFilePicker]
  );

  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) || null
    : null;

  const handleToolSelect = useCallback(
    (tool: string) => {
      if (tool === 'addToProject') {
        if (!activeConversation) {
          toast.error(
            t(
              'aiChat.conversation.addToProjectRequiresConversation',
              'Najpierw wyślij pierwszą wiadomość, aby dodać rozmowę do projektu.'
            )
          );
          onToolSelect?.(tool);
          return;
        }
        setShowMoveToProject(true);
      }

      onToolSelect?.(tool);
    },
    [activeConversation, onToolSelect, t]
  );

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
                onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                className="ml-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Live Transcript Indicator */}
      {(isDictating || isVoiceConversationVal) && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          {/* Audio Level Bars */}
          <div className="flex items-center gap-0.5 h-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(4, Math.min(16, currentAudioLevel * 20 * (i + 1)))}px`,
                  opacity: currentAudioLevel > i * 0.2 ? 1 : 0.3,
                }}
              />
            ))}
          </div>

          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {isVoiceConversationVal ? 'Voice Conversation' : 'Dictation'}
          </span>

          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {Math.floor(currentRecordingDuration / 60)}:
            {(currentRecordingDuration % 60).toString().padStart(2, '0')}
          </span>

          {currentInterimTranscript && (
            <span className="flex-1 text-xs text-slate-600 dark:text-slate-400 italic truncate">
              "{currentInterimTranscript}"
            </span>
          )}
        </div>
      )}

      {/* Main Input Container */}
      <div
        className={`
                bg-white dark:bg-navy-900 rounded-xl border transition-all duration-200
                ${
                  isFocused
                    ? 'border-primary-500 shadow-lg shadow-primary-500/10 dark:shadow-primary-500/5'
                    : 'border-slate-200 dark:border-navy-700 shadow-sm'
                }
                ${isRecordingAny ? 'ring-2 ring-blue-500/50' : ''}
                ${isDisabled ? 'opacity-60' : ''}
            `}
      >
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholderText}
          disabled={isInputDisabled}
          rows={variant === 'compact' ? 3 : 2}
          data-testid="chat-input"
          className={`
                        w-full bg-transparent text-navy-900 dark:text-white
                        placeholder-slate-400 dark:placeholder-slate-500
                        px-4 ${variant === 'compact' ? 'pt-4 pb-2' : 'pt-4 pb-2'} resize-none focus:outline-none text-[15px]
                    `}
        />

        {/* Action Bar */}
        <div
          className={`flex items-center justify-between px-3 ${variant === 'compact' ? 'pb-2' : 'pb-3'}`}
        >
          {/* Left Actions */}
          <div className="flex items-center gap-1">
            <AddFilesMenu
              onFileSelect={handleFileSelect}
              onUrlAdd={handleUrlAdd}
              onCloudFileSelect={handleCloudFileSelect}
              onConnectCloud={handleConnectCloud}
              connectedProviders={connectedProviderIds}
              isCloudImplemented={isCloudImplemented}
              disabled={isInputDisabled}
            />
            <ToolsMenu onToolSelect={handleToolSelect} disabled={isInputDisabled} icon={Pen} />
            <CoThinkerMenu disabled={isInputDisabled} />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Mic button: mute/unmute when Teresa voice is live, dictation otherwise */}
            {teresaVoiceStatus === 'live' || teresaVoiceStatus === 'connecting' ? (
              <button
                onClick={() => onTeresaVoiceMuteToggle?.()}
                disabled={teresaVoiceStatus !== 'live'}
                data-testid="chat-mic-button"
                className={`
                  flex items-center gap-1.5 p-2 rounded-lg transition-all
                  ${
                    teresaVoiceMuted
                      ? 'bg-red-500/80 text-white shadow-lg shadow-red-500/30'
                      : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }
                  ${teresaVoiceStatus !== 'live' ? 'cursor-not-allowed opacity-50' : ''}
                `}
                title={
                  teresaVoiceMuted
                    ? t('aiChat.unmuteMic', 'Unmute microphone')
                    : t('aiChat.muteMic', 'Mute microphone')
                }
              >
                {teresaVoiceMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            ) : speechSupported && !isVoiceConversation ? (
              <button
                onClick={handleDictationClick}
                disabled={isInputDisabled}
                data-testid="chat-mic-button"
                className={`
                  flex items-center gap-1.5 p-2 rounded-lg transition-all
                  ${
                    isDictating
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }
                  ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}
                `}
                title={
                  isDictating
                    ? t('aiChat.stopDictation', 'Stop dictation')
                    : t('aiChat.startDictation', 'Dictate (fills input, you review & send)')
                }
              >
                {isDictating ? <StopCircle size={18} /> : <Mic size={18} />}
              </button>
            ) : null}

            {/* Dynamic: Stop Stream / Send / Voice Toggle */}
            {isStreaming ? (
              <button
                onClick={() => onStopGenerating?.()}
                disabled={isDisabled}
                className="p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25"
                title={t('aiChat.stopGenerating', 'Stop generating')}
              >
                <Square size={18} className="fill-current" />
              </button>
            ) : canSend ? (
              <button
                onClick={handleSend}
                disabled={isDisabled}
                className="p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                title={t('aiChat.send', 'Send')}
              >
                <ArrowUp size={18} />
              </button>
            ) : teresaVoiceStatus === 'live' || teresaVoiceStatus === 'connecting' ? (
              <button
                onClick={() => onTeresaVoiceToggle?.()}
                disabled={isDisabled}
                className={`relative p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center text-white shadow-lg ${
                  teresaVoiceStatus === 'live'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-500/25'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/25'
                }`}
                title={t('aiChat.stopVoiceConversation', 'Stop voice conversation')}
              >
                {teresaVoiceStatus === 'connecting' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span className="absolute inset-0 rounded-xl animate-ping bg-red-500/20 pointer-events-none" />
                    <AudioLines size={18} />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => onTeresaVoiceToggle?.()}
                disabled={isDisabled}
                className="p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-500/25 group"
                title={t('aiChat.startVoiceConversation', 'Start voice conversation with Teresa')}
              >
                <AudioLines size={18} className="group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cloud File Picker Modal */}
      {activeProvider && (
        <CloudFilePicker
          isOpen={isPickerOpen}
          onClose={closeFilePicker}
          provider={activeProvider}
          onFileSelect={handleCloudFilePickerSelect}
        />
      )}

      {activeConversation && (
        <MoveToProjectModal
          isOpen={showMoveToProject}
          onClose={() => setShowMoveToProject(false)}
          conversation={activeConversation as any}
        />
      )}
    </div>
  );
};

export default EnhancedChatInput;
