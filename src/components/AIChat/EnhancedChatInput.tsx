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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { CloudFile, CloudProviderId, useCloudIntegrations } from '../../hooks/useCloudIntegrations';
import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { CHAT_V9_PII_CHECK_EVENT } from '../../utils/piiHeuristicToastFlag';
import { AddFilesMenu } from './AddFilesMenu';
import { CloudFilePicker } from './CloudFilePicker';
import { CommandPalette, type CommandPaletteItem } from './composer/CommandPalette';
import {
  buildMentionToken,
  insertAtCaret,
  type MentionCandidate,
} from './composer/composerMentions';
import { filterSlashCommands, type SlashCommand } from './composer/slashCommands';
import { useComposerCommands } from './composer/useComposerCommands';
import { useMentionSources } from './composer/useMentionSources';
import { CoThinkerActivePill, CoThinkerMenu } from './CoThinkerMenu';
import { InputCharCounter } from './InputCharCounter';
import { InputSoftLimitToast } from './InputSoftLimitToast';
import { MoveToProjectModal } from './MoveToProjectModal';
import { NextModelChip } from './NextModelChip';
import { ToolsMenu } from './ToolsMenu';
import { VoiceModeLegend } from './VoiceModeLegend';

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
  /** Start a fresh conversation (wired to the parent's existing new-chat handler). */
  onNewChat?: () => void;

  /** Teresa real-time voice status: 'idle' | 'connecting' | 'live' | 'error' */
  teresaVoiceStatus?: string;
  /** Human-readable runtime error when Teresa live voice fails */
  teresaVoiceError?: string | null;
  /** Whether Teresa live voice can start from the current server/browser posture */
  teresaVoiceAvailable?: boolean;
  /** Human-readable reason when Teresa live voice cannot start */
  teresaVoiceUnavailableReason?: string | null;
  /** Toggle Teresa real-time voice on/off */
  onTeresaVoiceToggle?: () => void;
  /** Whether Teresa mic is currently muted */
  teresaVoiceMuted?: boolean;
  /** Toggle Teresa mic mute */
  onTeresaVoiceMuteToggle?: () => void;
}

type ComposerAttachment =
  | File
  | {
      kind?: 'url';
      url: string;
      name?: string;
    }
  // Already-uploaded doc re-attached from the "Recent" flyout — carries the
  // existing server docId, so the send pipeline includes it in RAG scope
  // without re-uploading. (Composer audit A5.)
  | {
      kind: 'doc';
      docId: string;
      name: string;
    };

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
  onNewChat,
  teresaVoiceStatus,
  teresaVoiceError,
  teresaVoiceAvailable = true,
  onTeresaVoiceToggle,
  teresaVoiceMuted,
  onTeresaVoiceMuteToggle,
}) => {
  const { t, i18n } = useTranslation();
  // Provider/config reason codes are operational diagnostics, not product
  // copy. Never expose values such as `server_missing_gemini_live_key` in a
  // title or accessible name; the user only needs the safe next action.
  const safeVoiceUnavailableLabel = t(
    'aiChat.voiceUnavailable',
    'Voice is unavailable. You can continue by text or dictation.'
  );
  const { aiFreezeStatus, setAIConfig } = useAppStore();
  const uiLangBase = String(i18n.language || 'pl')
    .split('-')[0]
    .toLowerCase();
  // Legacy compat: a stale cached bundle/localStorage value could still say 'jp'.
  const uiLang = uiLangBase === 'jp' ? 'ja' : uiLangBase;

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
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

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
  const lastTeresaVoiceToastRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const isDisabled = disabled || aiFreezeStatus.isFrozen;
  const isInputDisabled = isDisabled || isStreaming;
  const hasText = value.trim().length > 0;
  const canSend = hasText && !isInputDisabled;
  const { activeConversationId, conversations, activeMessages } = useConversationStore();
  const [showMoveToProject, setShowMoveToProject] = useState(false);

  // Consume Teresa pending prompt from sessionStorage (set by useOpenChatWithContext
  // when a module like Finance/Initiatives opens chat with a module-specific opener).
  useEffect(() => {
    const consumePending = () => {
      try {
        if (typeof window === 'undefined') return;
        const raw = window.sessionStorage.getItem('consultify.teresa.pendingPrompt');
        if (!raw) return;
        const parsed = JSON.parse(raw) as { prompt?: string; ts?: number };
        // Stale guard: ignore prompts older than 60s
        if (!parsed?.prompt || (parsed.ts && Date.now() - parsed.ts > 60_000)) {
          window.sessionStorage.removeItem('consultify.teresa.pendingPrompt');
          return;
        }
        // Only prefill if input is empty (don't overwrite user-typed text)
        if (!valueRef.current.trim()) {
          setValue(parsed.prompt);
          window.requestAnimationFrame(() => textareaRef.current?.focus());
        }
        window.sessionStorage.removeItem('consultify.teresa.pendingPrompt');
      } catch {
        // Non-critical
      }
    };
    consumePending();
    if (typeof window !== 'undefined') {
      window.addEventListener('consultify:teresa-pending-prompt', consumePending);
      return () => window.removeEventListener('consultify:teresa-pending-prompt', consumePending);
    }
    return undefined;
  }, []);

  // ========================================================================
  // Composer command system (slash `/` + `@`-mention palettes)
  // ========================================================================
  const caretRef = useRef(0);
  const commands = useComposerCommands();
  const slashQuery = commands.state.mode === 'slash' ? commands.state.query : '';
  const mentionQuery = commands.state.mode === 'mention' ? commands.state.query : '';
  const slashResults = useMemo(
    () => (commands.state.mode === 'slash' ? filterSlashCommands(slashQuery) : []),
    [commands.state.mode, slashQuery]
  );
  // Hook must run unconditionally; it self-gates KB search on query length and is
  // cheap for the store-derived candidates. Only surfaced while in mention mode.
  const mentionSourceResults = useMentionSources(mentionQuery, attachments as any);
  const mentionResults = commands.state.mode === 'mention' ? mentionSourceResults : [];
  const paletteCount =
    commands.state.mode === 'slash' ? slashResults.length : mentionResults.length;

  const syncCaretFromTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    caretRef.current = ta.selectionStart ?? 0;
    commands.update(ta.value, caretRef.current);
  }, [commands]);

  const applyInsertion = useCallback(
    (nextValue: string, nextCaret: number) => {
      setValue(nextValue);
      caretRef.current = nextCaret;
      commands.close();
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(nextCaret, nextCaret);
        }
      });
    },
    [commands]
  );

  const selectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      const start = commands.state.start;
      const caret = caretRef.current;
      if (cmd.apply.kind === 'config') {
        setAIConfig(cmd.apply.patch as any);
        const next = insertAtCaret(value, start, caret, '');
        applyInsertion(next.value, next.caret);
        toast.success(t(cmd.labelKey, cmd.labelFallback));
      } else if (cmd.apply.kind === 'template') {
        const text = t(cmd.apply.textKey, cmd.apply.textFallback);
        const next = insertAtCaret(value, start, caret, text);
        applyInsertion(next.value, next.caret);
      } else if (cmd.apply.action === 'clear') {
        setValue('');
        setAttachments([]);
        commands.close();
      } else if (cmd.apply.action === 'newChat') {
        setValue('');
        setAttachments([]);
        commands.close();
        onNewChat?.();
      }
    },
    [commands, value, setAIConfig, applyInsertion, t, onNewChat]
  );

  const selectMention = useCallback(
    (candidate: MentionCandidate) => {
      const next = insertAtCaret(
        value,
        commands.state.start,
        caretRef.current,
        buildMentionToken(candidate)
      );
      applyInsertion(next.value, next.caret);
    },
    [commands.state.start, value, applyInsertion]
  );

  const selectPaletteItemAt = useCallback(
    (index: number) => {
      if (commands.state.mode === 'slash') {
        const cmd = slashResults[index];
        if (cmd) selectSlashCommand(cmd);
      } else if (commands.state.mode === 'mention') {
        const candidate = mentionResults[index];
        if (candidate) selectMention(candidate);
      }
    },
    [commands.state.mode, slashResults, mentionResults, selectSlashCommand, selectMention]
  );

  const selectActivePaletteItem = useCallback(
    () => selectPaletteItemAt(commands.state.activeIndex),
    [selectPaletteItemAt, commands.state.activeIndex]
  );

  const paletteItems: CommandPaletteItem[] =
    commands.state.mode === 'slash'
      ? slashResults.map((c) => ({
          id: c.id,
          label: t(c.labelKey, c.labelFallback),
          sublabel: t(c.descriptionKey, c.descriptionFallback),
          icon: c.icon,
        }))
      : mentionResults.map((c) => ({
          id: `${c.type}:${c.id}`,
          label: c.label,
          sublabel: c.sublabel,
        }));

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

  useEffect(() => {
    if (teresaVoiceStatus !== 'error') {
      lastTeresaVoiceToastRef.current = null;
      return;
    }
    const message = (teresaVoiceError || '').trim() || t('aiChat.voiceError', 'Voice error');
    if (lastTeresaVoiceToastRef.current === message) return;
    lastTeresaVoiceToastRef.current = message;
    toast.error(message);
  }, [t, teresaVoiceError, teresaVoiceStatus]);

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
      ja: 'ja-JP',
      jp: 'ja-JP', // legacy alias (pre-migration code, see src/i18n.ts)
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
    // Chat P1-9 — keep chatLanguage + uiLang in the deps so a mid-conversation
    // language change re-derives `effectiveLang`. Without this the recognition
    // instance kept the language captured on first start.
  }, [isVoiceConversation, chatLanguage, uiLang]);

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
    // Chat P1-9 — track the active conversation language so a mid-conversation
    // language switch isn't masked by a stale closure (was: Polish transcript
    // of English audio when the user toggled language after voice started).
    chatLanguage,
    uiLang,
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
    const outgoing = value.trim();
    onSend(outgoing, attachments.length > 0 ? attachments : undefined);
    // T-PM2-lite — advisory post-send nudge. Dispatched on `window`
    // so the headless `PiiHeuristicToast` can run the detector
    // without this component knowing anything about toasts. The
    // event is a no-op when the kill-switch is off (listener
    // detached) or when no category hits.
    if (typeof window !== 'undefined' && outgoing.length > 0) {
      try {
        window.dispatchEvent(
          new CustomEvent(CHAT_V9_PII_CHECK_EVENT, { detail: { text: outgoing } })
        );
      } catch {
        // CustomEvent is supported everywhere we target; the guard
        // exists only for server-rendered / degraded environments.
      }
    }
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, isStreaming, value, attachments, onSend, stopDictation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 1) Palette navigation takes priority while a `/` or `@` palette is open.
      if (commands.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          commands.move(1, paletteCount);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          commands.move(-1, paletteCount);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          selectActivePaletteItem();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          commands.close();
          return;
        }
      }

      // 2) Esc stops an in-flight stream when no palette is open.
      if (e.key === 'Escape') {
        if (isStreaming) {
          e.preventDefault();
          onStopGenerating?.();
        }
        return;
      }

      // 3) Cmd/Ctrl+Enter force-sends (works even mid-palette intent).
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (!isStreaming) handleSend();
        return;
      }

      // 4) Up-arrow on an empty composer recalls the last user message for editing.
      if (e.key === 'ArrowUp' && value.trim().length === 0) {
        const lastUser = [...activeMessages].reverse().find((m) => m.role === 'user');
        if (lastUser?.content) {
          e.preventDefault();
          applyInsertion(lastUser.content, lastUser.content.length);
        }
        return;
      }

      // 5) Plain Enter sends.
      // Chat P1-5 — guard on IME composition so IME users (Japanese / Chinese /
      // Korean, Polish diacritic IMEs) don't submit the half-finished message
      // when accepting an IME candidate.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any)?.isComposing) {
        e.preventDefault();
        if (isStreaming) return;
        handleSend();
      }
    },
    [
      commands,
      paletteCount,
      selectActivePaletteItem,
      handleSend,
      isStreaming,
      onStopGenerating,
      value,
      activeMessages,
      applyInsertion,
    ]
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

  // Re-attach an already-uploaded doc from the Recent flyout (A5). No re-upload:
  // the docId rides through onSend and the parent adds it to the RAG scope.
  const handleRecentReattach = useCallback((recent: { name: string; docId?: string }) => {
    if (!recent.docId) return;
    setAttachments((prev) => [
      ...prev,
      { kind: 'doc', docId: recent.docId as string, name: recent.name },
    ]);
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
  const hasProjectAssignableConversation = Boolean(activeConversation);

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
          {attachments.map((att, idx) => {
            const isFileAtt = att instanceof File;
            const attKind = !isFileAtt ? (att as { kind?: string }).kind : 'file';
            const isUrlAttachment = attKind === 'url';
            const label = isFileAtt
              ? att.name || att.type
              : (att as { name?: string; url?: string }).name ||
                (att as { url?: string }).url ||
                'attachment';
            const badge = isUrlAttachment ? 'Link' : 'File';
            return (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-navy-800 rounded text-xs text-slate-600 dark:text-slate-400"
              >
                <span className="inline-flex items-center gap-1">
                  <span>{badge}:</span>
                  <span className="max-w-[220px] truncate">{label}</span>
                </span>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="ml-1 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Transcript Indicator */}
      {(isDictating || isVoiceConversationVal) && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-primary-50 dark:from-blue-900/20 dark:to-primary-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
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
        data-idle-pulse={!isInputDisabled && !isRecordingAny && !isFocused && !value.trim()}
        className={`
                relative isolate
                bg-white dark:bg-navy-900 rounded-xl border transition-all duration-200
                ${
                  /* Bez kolorowej obwódki focusa na composerze (decyzja Piotra
                     2026-07-04: „irytująca ramka przy pisaniu — wyłącz").
                     Fokus sygnalizuje caret; przy fokusie tylko minimalnie
                     jaśniejsza neutralna ramka. */
                  isFocused
                    ? 'border-slate-300 dark:border-navy-600'
                    : 'border-slate-200 dark:border-navy-700'
                }
                ${isRecordingAny ? 'ring-2 ring-blue-500/50' : ''}
                ${isDisabled ? 'opacity-60' : ''}
                ${!isInputDisabled && !isRecordingAny && !isFocused && !value.trim() ? 'chat-composer-idle-pulse' : ''}
            `}
      >
        {/* Slash / @-mention palette — floats above the composer */}
        {commands.isOpen && (
          <CommandPalette
            header={
              commands.state.mode === 'slash'
                ? t('aiChat.composer.commands.header', 'Commands')
                : t('aiChat.composer.mentions.header', 'Mention')
            }
            items={paletteItems}
            activeIndex={commands.state.activeIndex}
            emptyText={
              commands.state.mode === 'slash'
                ? t('aiChat.composer.commands.empty', 'No matching commands')
                : t('aiChat.composer.mentions.empty', 'No matches')
            }
            onSelect={(index) => selectPaletteItemAt(index)}
            onHover={commands.setActiveIndex}
            onClose={commands.close}
          />
        )}

        {/* Co-Thinker active persona indicator */}
        <CoThinkerActivePill className="mx-3 mb-1" />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            const caret = e.target.selectionStart ?? next.length;
            setValue(next);
            caretRef.current = caret;
            commands.update(next, caret);
          }}
          onKeyDown={handleKeyDown}
          onClick={syncCaretFromTextarea}
          onSelect={syncCaretFromTextarea}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onPaste={(e) => {
            // Chat P1-3 — paste handler. Files (screenshots / docs) hand off
            // to handleFileSelect; plain-text URLs route through handleUrlAdd
            // so they become attachment chips instead of inline text.
            const cd = e.clipboardData;
            if (!cd) return;
            const files: File[] = [];
            for (let i = 0; i < cd.files.length; i++) {
              const f = cd.files.item(i);
              if (f) files.push(f);
            }
            if (files.length > 0) {
              e.preventDefault();
              handleFileSelect(files);
              return;
            }
            const text = cd.getData('text/plain');
            if (text && /^https?:\/\//i.test(text.trim()) && text.length < 2000) {
              // Only auto-chip when the entire paste is a URL — don't steal
              // pastes inside a larger paragraph.
              if (text.trim() === text) {
                e.preventDefault();
                handleUrlAdd(text.trim());
              }
            }
          }}
          onDragOver={(e) => {
            // Chat P1-4 — drag-drop. Show the cursor as a drop target when
            // files are being dragged in.
            if (e.dataTransfer?.types?.includes('Files')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            const dt = e.dataTransfer;
            if (!dt?.files || dt.files.length === 0) return;
            e.preventDefault();
            const files: File[] = [];
            for (let i = 0; i < dt.files.length; i++) {
              const f = dt.files.item(i);
              if (f) files.push(f);
            }
            if (files.length > 0) handleFileSelect(files);
          }}
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

        {/*
          Action Bar — "less is more": hidden by default, fades in when the
          user actually engages with the chat (hovers the chat panel, focuses
          the input, has typed something, or while a stream is running so the
          Stop button is always reachable). The `group/composer` class lives on
          the chat-panel flex column in UnifiedChatPanel so hovering anywhere
          in the answers OR over the input reveals the row.
        */}
        <div
          className={`flex items-center justify-between gap-2 min-w-0 px-3 ${variant === 'compact' ? 'pb-2' : 'pb-3'} transition-opacity duration-200 ${
            isFocused || value.length > 0 || isStreaming
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none group-hover/composer:opacity-100 group-hover/composer:pointer-events-auto'
          }`}
        >
          {/* Left Actions */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1 shrink-0">
              <AddFilesMenu
                onFileSelect={handleFileSelect}
                onUrlAdd={handleUrlAdd}
                onRecentSelect={handleRecentReattach}
                onCloudFileSelect={handleCloudFileSelect}
                onConnectCloud={handleConnectCloud}
                connectedProviders={connectedProviderIds}
                isCloudImplemented={isCloudImplemented}
                disabled={isInputDisabled}
              />
              <ToolsMenu
                onToolSelect={handleToolSelect}
                disabled={isInputDisabled}
                icon={Pen}
                hasActiveConversation={hasProjectAssignableConversation}
              />
              <CoThinkerMenu disabled={isInputDisabled} />
            </div>
            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto pr-1 scrollbar-none">
              {/* C-IN1 — Next-message model hint. Read-only pill showing
                which model will handle the next send. Self-gates on
                `isNextModelChipEnabled()` and renders null when the
                user has no resolvable model id, so the action bar
                collapses cleanly when the signal is unavailable. */}
              <NextModelChip />
              {/* C-IN2 — Input character counter. Invisible until the
                message crosses the default 400-char threshold, then
                colour-escalates through amber at 80% of the 8k soft
                max and rose once over. Purely advisory; never blocks
                Send. Self-gates on `isInputCharCounterEnabled()`. */}
              <InputCharCounter value={value} />
              {/* C-IN6-lite — one-shot soft-limit inline toast. Headless
                sibling of the counter that fires a single
                `toast.custom` the first time `value.length` crosses
                the counter's rose threshold in this tab, with a
                "Don't show again this session" escape. Self-gates on
                `isInputSoftLimitToastEnabled()` and the sessionStorage
                fired / dismiss sentinels. */}
              <InputSoftLimitToast value={value} />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* VM3 — voice modes legend. Sits immediately before the mic so
                the "?" reads as "what does this mic button do?". Component
                self-gates on `isVoiceModeLegendEnabled()`; when the flag is
                off it renders null and the mic cluster collapses normally.
                VM1-lite: when `speechSupported === false` and the Teresa
                live-voice affordance is also absent, the mic button is
                hidden entirely — the legend then becomes the user's only
                way to learn *why* voice does not work in this browser. */}
            <VoiceModeLegend
              unavailable={
                !speechSupported &&
                teresaVoiceStatus !== 'live' &&
                teresaVoiceStatus !== 'connecting'
              }
            />
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
                      ? 'bg-danger-500/80 text-white shadow-lg shadow-danger-500/30'
                      : 'text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
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
                      ? 'bg-danger-500 text-white shadow-lg shadow-danger-500/30'
                      : 'text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
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
                className="p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center bg-danger-600 hover:bg-danger-700 text-white shadow-lg shadow-danger-500/25"
                title={t('aiChat.stopGenerating', 'Stop generating')}
                aria-label={t('aiChat.stopGenerating', 'Stop generating') as string}
              >
                <Square size={18} className="fill-current" />
              </button>
            ) : canSend ? (
              <button
                onClick={handleSend}
                disabled={isDisabled}
                data-testid="chat-send-btn"
                className="p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg shadow-primary-500/25"
                title={t('aiChat.send', 'Send')}
                aria-label={t('aiChat.send', 'Send') as string}
              >
                <ArrowUp size={18} />
              </button>
            ) : teresaVoiceStatus === 'live' || teresaVoiceStatus === 'connecting' ? (
              <button
                onClick={() => onTeresaVoiceToggle?.()}
                disabled={isDisabled}
                className={`relative p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center text-white shadow-lg ${
                  teresaVoiceStatus === 'live'
                    ? 'bg-danger-600 hover:bg-danger-500 shadow-danger-500/25'
                    : 'bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-black/10'
                }`}
                title={t('aiChat.stopVoiceConversation', 'Stop voice conversation')}
              >
                {teresaVoiceStatus === 'connecting' ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span className="absolute inset-0 rounded-xl animate-ping bg-danger-500/20 pointer-events-none" />
                    <AudioLines size={18} />
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled
                  data-testid="chat-send-btn"
                  className="p-2 rounded-xl min-w-[44px] flex items-center justify-center bg-navy-900/35 text-white/70 dark:bg-[#F4F7FB]/35 dark:text-navy-950/50 cursor-not-allowed shadow-none"
                  title={t('aiChat.send', 'Send')}
                  aria-label={t('aiChat.send', 'Send') as string}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => onTeresaVoiceToggle?.()}
                  disabled={isDisabled || !teresaVoiceAvailable}
                  className={`p-2 rounded-xl transition-all duration-200 min-w-[44px] flex items-center justify-center text-white shadow-lg group ${
                    teresaVoiceAvailable
                      ? 'bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-black/10'
                      : 'bg-c-surface-raised text-c-text-muted cursor-not-allowed shadow-none'
                  }`}
                  title={
                    teresaVoiceAvailable
                      ? t('aiChat.startVoiceConversation', 'Start voice conversation with Teresa')
                      : safeVoiceUnavailableLabel
                  }
                  aria-label={
                    teresaVoiceAvailable
                      ? t('aiChat.startVoiceConversation', 'Start voice conversation with Teresa')
                      : safeVoiceUnavailableLabel
                  }
                >
                  <AudioLines size={18} className="group-hover:scale-110 transition-transform" />
                </button>
              </>
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
