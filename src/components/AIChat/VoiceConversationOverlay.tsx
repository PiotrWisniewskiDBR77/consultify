/**
 * VoiceConversationOverlay — Floating bubble + mini-panel for Teresa voice.
 *
 * Two states:
 *   Collapsed: 56px circle in bottom-right corner with pulsing mic
 *   Expanded:  320px mini-panel with transcript, status, controls
 *
 * The user can work in the app while Teresa listens/speaks.
 *
 * v2: this overlay now consumes the shared `useTeresaVoiceContext()` session
 * (started by the welcome-screen / composer "Talk to Teresa" CTA) instead of
 * spinning up a second, conflicting Gemini Live session. It self-mounts whenever
 * the shared voice status leaves `idle`, so a single global mount surfaces the
 * live conversation everywhere. Transcript lines are appended to the active
 * conversation by the context, so this component focuses on presentation.
 */

import { ChevronDown, Loader2, Mic, PhoneOff, RefreshCw, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTeresaVoiceContext } from '../../contexts/TeresaVoiceContext';
import { type TeresaVoiceStatus } from '../../hooks/useTeresaVoice';

const STATUS_COLORS: Record<TeresaVoiceStatus, string> = {
  idle: 'bg-slate-500',
  connecting: 'bg-amber-500',
  live: 'bg-emerald-500',
  error: 'bg-danger-500',
};

const BUBBLE_BG: Record<TeresaVoiceStatus, string> = {
  idle: 'from-slate-600 to-slate-700',
  connecting: 'from-slate-600 to-slate-700',
  // Crimson brand moment for the live voice state.
  live: 'from-crimson-600 to-crimson-800',
  error: 'from-danger-600 to-danger-700',
};

/**
 * Globally-mounted Teresa voice overlay. Renders nothing while idle; appears as
 * soon as a shared voice session is connecting/live/errored.
 */
export const VoiceConversationOverlay: React.FC = () => {
  const { t } = useTranslation();
  const {
    voiceStatus,
    voiceError,
    handleVoiceToggle,
    stopVoiceConversation,
    startVoiceConversation,
  } = useTeresaVoiceContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const hasAutoExpandedRef = useRef(false);

  // Auto-expand once when the session goes live.
  useEffect(() => {
    if (voiceStatus === 'live' && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      setIsExpanded(true);
    }
    if (voiceStatus === 'idle') {
      hasAutoExpandedRef.current = false;
      setIsExpanded(false);
    }
  }, [voiceStatus]);

  const handleEnd = useCallback(async () => {
    await stopVoiceConversation();
  }, [stopVoiceConversation]);

  const handleRetry = useCallback(() => {
    void startVoiceConversation();
  }, [startVoiceConversation]);

  // Idle = no active session → nothing to show.
  if (voiceStatus === 'idle') return null;

  const statusLabel: Record<TeresaVoiceStatus, string> = {
    idle: t('aiChat.voice.startVoice', 'Start by voice'),
    connecting: t('aiChat.voice.voiceConnecting', 'Connecting…'),
    live: t('aiChat.voice.voiceLive', 'Listening…'),
    error: voiceError || t('aiChat.voice.voiceError', 'Voice unavailable. Try again.'),
  };

  // ── Collapsed bubble ──────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
        data-testid="teresa-voice-overlay"
      >
        <button
          onClick={() => void handleEnd()}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-danger-600 text-white shadow-lg transition-all hover:scale-110 hover:bg-danger-500 active:scale-95"
          title={t('aiChat.voice.stopVoice', 'End voice')}
        >
          <X size={12} strokeWidth={2.5} />
        </button>

        <button
          onClick={() => setIsExpanded(true)}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${BUBBLE_BG[voiceStatus]} text-white shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95`}
          title={statusLabel[voiceStatus]}
        >
          {voiceStatus === 'live' && (
            <span className="absolute inset-0 animate-ping rounded-full bg-crimson-500/30" />
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
    <div
      className="fixed bottom-6 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-c-border-subtle bg-navy-900/95 text-white shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-4"
      data-testid="teresa-voice-overlay"
    >
      <div className="flex items-center justify-between border-b border-c-border-subtle bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-crimson-400" />
          <span className="text-sm font-semibold text-crimson-300">Teresa</span>
          <span
            className={`h-2 w-2 rounded-full ${STATUS_COLORS[voiceStatus]} ${voiceStatus === 'live' ? 'animate-pulse' : ''}`}
          />
          <span className="text-[11px] text-slate-600">{statusLabel[voiceStatus]}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(false)}
            className="rounded-md p-1 text-slate-600 transition-colors hover:bg-white/10 hover:text-white"
            title={t('common.minimize', 'Minimize')}
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={() => void handleEnd()}
            className="rounded-md p-1 text-slate-600 transition-colors hover:bg-danger-600/80 hover:text-white"
            title={t('aiChat.voice.stopVoice', 'End voice')}
          >
            <PhoneOff size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6">
        {voiceStatus === 'live' && (
          <>
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-crimson-600 to-crimson-800">
                <Mic size={20} className="text-white/90" />
              </div>
              <span className="absolute inset-0 animate-ping rounded-full bg-crimson-500/20" />
            </div>
            <p className="mt-1 text-center text-xs text-slate-600">
              {t('aiChat.voice.voiceLive', 'Listening…')}
            </p>
            <p className="text-center text-[11px] text-slate-500">
              {t('aiChat.voice.transcriptHint', 'Your conversation appears in the chat below.')}
            </p>
          </>
        )}

        {voiceStatus === 'connecting' && (
          <>
            <Loader2 size={24} className="animate-spin text-slate-600" />
            <p className="text-xs text-slate-500">
              {t('aiChat.voice.voiceConnecting', 'Connecting…')}
            </p>
          </>
        )}

        {voiceStatus === 'error' && (
          <>
            <p className="text-center text-xs text-danger-400">
              {voiceError || t('aiChat.voice.voiceError', 'Voice unavailable. Try again.')}
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs transition-colors hover:bg-white/20"
            >
              <RefreshCw size={12} />
              {t('common.tryAgain', 'Try again')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VoiceConversationOverlay;
