/**
 * VoiceConversationOverlay — Floating bubble + mini-panel for Teresa voice.
 *
 * Two states:
 *   Collapsed: 56px circle in bottom-right corner with pulsing mic
 *   Expanded:  320px mini-panel with transcript, status, controls
 *
 * The user can work in the app while Teresa listens/speaks.
 * Props interface is unchanged from the full-screen version.
 */

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  PhoneOff,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type TeresaVoiceStatus, useTeresaVoice } from '../../hooks/useTeresaVoice';
import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { usePMOStore } from '../../store/usePMOStore';
import {
  buildTeresaVoiceSystemInstruction,
  type TeresaVoiceContext,
} from '../../utils/teresaVoiceInstruction';

interface VoiceConversationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptMessage?: (role: 'user' | 'ai', text: string) => void;
  chatLanguage?: string;
}

interface TranscriptEntry {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

const STATUS_COLORS: Record<TeresaVoiceStatus, string> = {
  idle: 'bg-slate-500',
  connecting: 'bg-amber-500',
  live: 'bg-emerald-500',
  error: 'bg-rose-500',
};

const BUBBLE_BG: Record<TeresaVoiceStatus, string> = {
  idle: 'from-slate-600 to-slate-700',
  connecting: 'from-slate-600 to-slate-700',
  live: 'from-primary-600 to-primary-600',
  error: 'from-rose-600 to-rose-700',
};

export const VoiceConversationOverlay: React.FC<VoiceConversationOverlayProps> = ({
  isOpen,
  onClose,
  onTranscriptMessage,
  chatLanguage = 'pl',
}) => {
  const { t } = useTranslation();
  const { currentUser, currentOrganization } = useAppStore();
  const { projectName } = usePMOStore();
  const { workspaceContext } = useConversationStore() as any;

  const [isExpanded, setIsExpanded] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [currentUserSpeech, setCurrentUserSpeech] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const sessionStartedRef = useRef(false);
  const hasAutoExpandedRef = useRef(false);

  const voiceContext = useMemo<TeresaVoiceContext>(
    () => ({
      language: chatLanguage,
      organizationName: currentOrganization?.name || currentUser?.organizationName,
      organizationId: currentOrganization?.id ?? currentUser?.organizationId ?? undefined,
      userName: currentUser?.firstName,
      activeProject: projectName ?? undefined,
      workspaceType: workspaceContext?.type,
      entityName: workspaceContext?.entityName,
      currentScreen: 'Voice Conversation',
    }),
    [chatLanguage, currentOrganization, currentUser, projectName, workspaceContext]
  );

  const systemInstruction = useMemo(
    () => buildTeresaVoiceSystemInstruction(voiceContext),
    [voiceContext]
  );

  const handleTranscript = useCallback(
    (text: string) => {
      setCurrentUserSpeech(text);
      const trimmed = text.trim();
      if (trimmed.length > 2) {
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'user' && Date.now() - last.timestamp < 3000) {
            return [...prev.slice(0, -1), { ...last, text: trimmed, timestamp: Date.now() }];
          }
          return [
            ...prev,
            { id: `u-${Date.now()}`, role: 'user', text: trimmed, timestamp: Date.now() },
          ];
        });
        onTranscriptMessage?.('user', trimmed);
        if (!hasAutoExpandedRef.current) {
          hasAutoExpandedRef.current = true;
          setIsExpanded(true);
        }
      }
    },
    [onTranscriptMessage]
  );

  const handleModelText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length > 1) {
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai' && Date.now() - last.timestamp < 3000) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + ' ' + trimmed, timestamp: Date.now() },
            ];
          }
          return [
            ...prev,
            { id: `a-${Date.now()}`, role: 'ai', text: trimmed, timestamp: Date.now() },
          ];
        });
        onTranscriptMessage?.('ai', trimmed);
        if (!hasAutoExpandedRef.current) {
          hasAutoExpandedRef.current = true;
          setIsExpanded(true);
        }
      }
    },
    [onTranscriptMessage]
  );

  const { voiceStatus, voiceError, voiceAvailable, startVoiceConversation, stopVoiceConversation } =
    useTeresaVoice({
      enabled: isOpen,
      language: chatLanguage,
      systemInstruction,
      onTranscriptUpdate: handleTranscript,
      onModelAudioText: handleModelText,
    });

  // Auto-start voice session when opened
  useEffect(() => {
    if (isOpen && voiceAvailable && voiceStatus === 'idle' && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      void startVoiceConversation();
    }
    if (!isOpen) {
      sessionStartedRef.current = false;
      hasAutoExpandedRef.current = false;
      setIsExpanded(false);
      setTranscripts([]);
      setCurrentUserSpeech('');
    }
  }, [isOpen, voiceAvailable, voiceStatus, startVoiceConversation]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleEnd = useCallback(async () => {
    await stopVoiceConversation();
    onClose();
  }, [stopVoiceConversation, onClose]);

  const handleRetry = useCallback(() => {
    sessionStartedRef.current = false;
    void startVoiceConversation();
  }, [startVoiceConversation]);

  if (!isOpen) return null;

  const statusLabel: Record<TeresaVoiceStatus, string> = {
    idle: t('voice.idle', 'Ready'),
    connecting: t('voice.connecting', 'Connecting...'),
    live: t('voice.live', 'Listening...'),
    error: voiceError || t('voice.error', 'Error'),
  };

  // ── Collapsed bubble ──────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {/* End button (small X above bubble) */}
        <button
          onClick={handleEnd}
          className="w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
          title={t('voice.end', 'End conversation')}
        >
          <X size={12} strokeWidth={2.5} />
        </button>

        {/* Main bubble */}
        <button
          onClick={() => setIsExpanded(true)}
          className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${BUBBLE_BG[voiceStatus]} text-white shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95`}
          title={t('voice.expand', 'Show voice panel')}
        >
          {/* Pulsing ring when live */}
          {voiceStatus === 'live' && (
            <span className="absolute inset-0 rounded-full animate-ping bg-primary-500/30" />
          )}
          {voiceStatus === 'connecting' ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <Mic size={22} />
          )}
        </button>
      </div>
    );
  }

  // ── Expanded mini-panel ───────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 max-h-[420px] flex flex-col rounded-2xl bg-navy-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40 text-white overflow-hidden transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary-400" />
          <span className="text-sm font-semibold text-primary-300">Teresa</span>
          <span
            className={`w-2 h-2 rounded-full ${STATUS_COLORS[voiceStatus]} ${voiceStatus === 'live' ? 'animate-pulse' : ''}`}
          />
          <span className="text-[11px] text-slate-400">{statusLabel[voiceStatus]}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title={t('voice.collapse', 'Minimize')}
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={handleEnd}
            className="p-1 rounded-md hover:bg-rose-600/80 text-slate-400 hover:text-white transition-colors"
            title={t('voice.end', 'End conversation')}
          >
            <PhoneOff size={14} />
          </button>
        </div>
      </div>

      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[120px] max-h-[280px]">
        {transcripts.length === 0 && voiceStatus === 'live' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-600 to-primary-600 flex items-center justify-center">
                <Mic size={20} className="text-white/90" />
              </div>
              <span className="absolute inset-0 rounded-full animate-ping bg-primary-500/20" />
            </div>
            <p className="text-xs text-slate-500 text-center mt-1">
              {t('voice.speakNow', 'Mów — Teresa słucha...')}
            </p>
          </div>
        )}

        {transcripts.length === 0 && voiceStatus === 'connecting' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <Loader2 size={24} className="animate-spin text-slate-400" />
            <p className="text-xs text-slate-500">
              {t('voice.connectingDesc', 'Łączę się z Teresą...')}
            </p>
          </div>
        )}

        {voiceStatus === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <p className="text-xs text-rose-400 text-center">{voiceError}</p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <RefreshCw size={12} />
              {t('voice.retry', 'Spróbuj ponownie')}
            </button>
          </div>
        )}

        {transcripts.slice(-8).map((entry) => (
          <div
            key={entry.id}
            className={`text-[13px] leading-relaxed ${
              entry.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            {entry.role === 'ai' ? (
              <div className="inline-block bg-white/[0.07] rounded-xl rounded-bl-sm px-3 py-2 max-w-[90%]">
                <span className="text-slate-200">{entry.text}</span>
              </div>
            ) : (
              <div className="inline-block bg-primary-600/30 rounded-xl rounded-br-sm px-3 py-2 max-w-[90%]">
                <span className="text-slate-200">{entry.text}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>

      {/* Live speech indicator */}
      {voiceStatus === 'live' && (
        <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
          {currentUserSpeech ? (
            <p className="text-xs text-slate-400 italic truncate">
              &ldquo;{currentUserSpeech}&rdquo;
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-primary-500/60 rounded-full animate-pulse"
                    style={{
                      height: `${6 + Math.random() * 8}px`,
                      animationDelay: `${i * 150}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-slate-500">
                {t('voice.listening', 'Listening...')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceConversationOverlay;
