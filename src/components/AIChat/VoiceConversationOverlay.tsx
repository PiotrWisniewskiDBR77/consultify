/**
 * VoiceConversationOverlay — Full-screen real-time voice UI for Teresa.
 *
 * Renders a dark overlay with animated orb, live transcripts,
 * and a single "End" button. Uses Gemini Live via useTeresaVoice.
 */

import { Loader2, Mic, PhoneOff, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { usePMOStore } from '../../store/usePMOStore';
import { useTeresaVoice, type TeresaVoiceStatus } from '../../hooks/useTeresaVoice';
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

  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [currentUserSpeech, setCurrentUserSpeech] = useState('');
  const [currentAiSpeech, setCurrentAiSpeech] = useState('');
  const [orbScale, setOrbScale] = useState(1);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const orbAnimationRef = useRef<number>(0);
  const sessionStartedRef = useRef(false);

  const voiceContext = useMemo<TeresaVoiceContext>(
    () => ({
      language: chatLanguage,
      organizationName: currentOrganization?.name || currentUser?.organizationName,
      organizationId: currentOrganization?.id || currentUser?.organizationId,
      userName: currentUser?.firstName,
      activeProject: projectName,
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
          return [...prev, { id: `u-${Date.now()}`, role: 'user', text: trimmed, timestamp: Date.now() }];
        });
        onTranscriptMessage?.('user', trimmed);
      }
    },
    [onTranscriptMessage]
  );

  const handleModelText = useCallback(
    (text: string) => {
      setCurrentAiSpeech(text);
      const trimmed = text.trim();
      if (trimmed.length > 1) {
        setTranscripts((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'ai' && Date.now() - last.timestamp < 3000) {
            return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + trimmed, timestamp: Date.now() }];
          }
          return [...prev, { id: `a-${Date.now()}`, role: 'ai', text: trimmed, timestamp: Date.now() }];
        });
        onTranscriptMessage?.('ai', trimmed);
      }
    },
    [onTranscriptMessage]
  );

  const {
    voiceStatus,
    voiceError,
    voiceAvailable,
    startVoiceConversation,
    stopVoiceConversation,
    sendTextHistory,
  } = useTeresaVoice({
    enabled: isOpen,
    language: chatLanguage,
    systemInstruction,
    onTranscriptUpdate: handleTranscript,
    onModelAudioText: handleModelText,
  });

  // Auto-start voice session when overlay opens
  useEffect(() => {
    if (isOpen && voiceAvailable && voiceStatus === 'idle' && !sessionStartedRef.current) {
      sessionStartedRef.current = true;
      void startVoiceConversation();
    }
    if (!isOpen) {
      sessionStartedRef.current = false;
    }
  }, [isOpen, voiceAvailable, voiceStatus, startVoiceConversation]);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Animated orb pulsing
  useEffect(() => {
    if (!isOpen) return;
    let frame: number;
    const animate = () => {
      const t = Date.now() / 1000;
      const base = voiceStatus === 'live' ? 1.0 : 0.85;
      const breathe = Math.sin(t * 2) * 0.08;
      const pulse = voiceStatus === 'live' ? Math.sin(t * 4) * 0.04 : 0;
      setOrbScale(base + breathe + pulse);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [isOpen, voiceStatus]);

  const handleEnd = useCallback(async () => {
    await stopVoiceConversation();
    onClose();
  }, [stopVoiceConversation, onClose]);

  if (!isOpen) return null;

  const statusLabel: Record<TeresaVoiceStatus, string> = {
    idle: t('voice.idle', 'Ready'),
    connecting: t('voice.connecting', 'Connecting...'),
    live: t('voice.live', 'Listening...'),
    error: voiceError || t('voice.error', 'Connection error'),
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-white">
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-primary-400" />
          <span className="text-sm font-semibold tracking-wide uppercase text-primary-300">
            Teresa
          </span>
        </div>
        <div className="text-xs text-slate-400">
          {statusLabel[voiceStatus]}
        </div>
      </div>

      {/* Central orb area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        {/* Orb */}
        <div className="relative flex items-center justify-center">
          {/* Outer glow rings */}
          <div
            className="absolute w-48 h-48 rounded-full transition-transform duration-300"
            style={{
              transform: `scale(${orbScale * 1.3})`,
              background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
            }}
          />
          <div
            className="absolute w-36 h-36 rounded-full transition-transform duration-200"
            style={{
              transform: `scale(${orbScale * 1.15})`,
              background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
            }}
          />
          {/* Main orb */}
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center transition-transform duration-150"
            style={{
              transform: `scale(${orbScale})`,
              background: voiceStatus === 'live'
                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)'
                : voiceStatus === 'connecting'
                  ? 'linear-gradient(135deg, #475569 0%, #64748b 100%)'
                  : voiceStatus === 'error'
                    ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                    : 'linear-gradient(135deg, #334155 0%, #475569 100%)',
              boxShadow: voiceStatus === 'live'
                ? '0 0 60px rgba(99,102,241,0.4), 0 0 120px rgba(139,92,246,0.2)'
                : '0 0 30px rgba(100,116,139,0.2)',
            }}
          >
            {voiceStatus === 'connecting' ? (
              <Loader2 size={32} className="animate-spin text-white/80" />
            ) : (
              <Mic size={32} className="text-white/90" />
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="text-center max-w-md">
          {voiceStatus === 'live' && currentUserSpeech && (
            <p className="text-sm text-slate-300 italic mb-2 animate-pulse">
              &ldquo;{currentUserSpeech}&rdquo;
            </p>
          )}
          {voiceStatus === 'live' && !currentUserSpeech && (
            <p className="text-sm text-slate-500">
              {t('voice.speakNow', 'Mów — Teresa słucha...')}
            </p>
          )}
          {voiceStatus === 'connecting' && (
            <p className="text-sm text-slate-400">
              {t('voice.connectingDesc', 'Łączę się z Teresą...')}
            </p>
          )}
          {voiceStatus === 'error' && (
            <div className="text-center">
              <p className="text-sm text-red-400 mb-3">{voiceError}</p>
              <button
                onClick={() => {
                  sessionStartedRef.current = false;
                  void startVoiceConversation();
                }}
                className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                {t('voice.retry', 'Spróbuj ponownie')}
              </button>
            </div>
          )}
        </div>

        {/* Transcript history */}
        {transcripts.length > 0 && (
          <div className="w-full max-w-lg max-h-48 overflow-y-auto rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 space-y-2">
            {transcripts.slice(-8).map((entry) => (
              <div
                key={entry.id}
                className={`text-sm ${
                  entry.role === 'user'
                    ? 'text-slate-300 text-right'
                    : 'text-primary-300 text-left'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-2">
                  {entry.role === 'user' ? 'Ty' : 'Teresa'}
                </span>
                {entry.text}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>

      {/* Bottom: End button */}
      <div className="w-full flex items-center justify-center px-6 pb-10 pt-4">
        <button
          onClick={handleEnd}
          className="group flex items-center gap-3 px-8 py-4 rounded-full bg-red-600 hover:bg-red-500 text-white font-medium text-base shadow-2xl shadow-red-900/40 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <PhoneOff size={20} className="group-hover:rotate-12 transition-transform" />
          {t('voice.end', 'Zakończ rozmowę')}
        </button>
      </div>
    </div>
  );
};

export default VoiceConversationOverlay;
