import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { getTeresaStartFailureMessage } from '../components/AIChat/teresaRuntimeCopy';
import { useTeresaVoice, type UseTeresaVoiceReturn } from '../hooks/useTeresaVoice';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';
import { usePMOStore } from '../store/usePMOStore';
import { readPreferredChatLanguage } from '../utils/chatLanguagePreference';
import { buildTeresaVoiceSystemInstruction } from '../utils/teresaVoiceInstruction';

interface TeresaVoiceContextValue extends UseTeresaVoiceReturn {
  /** Toggle voice on/off — creates conversation if needed */
  handleVoiceToggle: () => Promise<void>;
  /**
   * M01-P05 (GF-CHAT-06): the user's dictated turn, once Gemini Live finalizes
   * it, is staged HERE instead of being sent straight to the conversation.
   * `null` when there is nothing awaiting review. This is what makes the
   * transcript editable before it becomes a chat message — see
   * `confirmPendingTranscript`/`discardPendingTranscript` below and
   * `VoiceConversationOverlay.tsx`, which renders the review UI.
   */
  pendingUserTranscript: string | null;
  /**
   * Sends the (possibly user-edited) pending transcript as the user's chat
   * message and clears the pending state. Pass the edited text explicitly —
   * the caller (the overlay's textarea) owns the live edit buffer, this
   * function does not re-read `pendingUserTranscript` itself, so an in-flight
   * edit is never silently dropped by a stale closure.
   */
  confirmPendingTranscript: (text: string) => void;
  /** Discards the pending transcript without sending it. */
  discardPendingTranscript: () => void;
}

const TeresaVoiceCtx = createContext<TeresaVoiceContextValue | null>(null);

// Safe no-op context used when TeresaVoiceProvider is intentionally not mounted,
// for example on guarded hosts like demo/staging where voice is disabled.
const noopTeresaVoiceContext: TeresaVoiceContextValue = {
  voiceStatus: 'idle',
  voiceError: null,
  voiceAvailable: false,
  voiceUnavailableReason: 'Teresa voice runtime is disabled in this environment.',
  isMuted: true,
  toggleMute: () => {},
  startVoiceConversation: async () => {},
  stopVoiceConversation: async () => {},
  sendTextHistory: () => {},
  handleVoiceToggle: async () => {},
  pendingUserTranscript: null,
  confirmPendingTranscript: () => {},
  discardPendingTranscript: () => {},
};

const VOICE_BACKOFF_BASE_MS = 1000;
const VOICE_BACKOFF_MAX_MS = 60_000;
const VOICE_BACKOFF_STORAGE_KEY = 'consultify-voice-backoff';

let voiceConfigBackoffMs = 0;
let voiceConfigBlockedUntil = 0;
let voiceEventBackoffMs = 0;
let voiceEventBlockedUntil = 0;
let voiceBackoffHydrated = false;

const hydrateVoiceBackoff = () => {
  if (voiceBackoffHydrated || typeof window === 'undefined') return;
  voiceBackoffHydrated = true;
  try {
    const raw = sessionStorage.getItem(VOICE_BACKOFF_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      configBackoffMs?: number;
      configBlockedUntil?: number;
      eventBackoffMs?: number;
      eventBlockedUntil?: number;
    };
    const now = Date.now();
    voiceConfigBackoffMs = Number(parsed?.configBackoffMs || 0);
    voiceConfigBlockedUntil =
      Number(parsed?.configBlockedUntil || 0) > now ? Number(parsed?.configBlockedUntil) : 0;
    voiceEventBackoffMs = Number(parsed?.eventBackoffMs || 0);
    voiceEventBlockedUntil =
      Number(parsed?.eventBlockedUntil || 0) > now ? Number(parsed?.eventBlockedUntil) : 0;
  } catch {
    // no-op
  }
};

const persistVoiceBackoff = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      VOICE_BACKOFF_STORAGE_KEY,
      JSON.stringify({
        configBackoffMs: voiceConfigBackoffMs,
        configBlockedUntil: voiceConfigBlockedUntil,
        eventBackoffMs: voiceEventBackoffMs,
        eventBlockedUntil: voiceEventBlockedUntil,
      })
    );
  } catch {
    // no-op
  }
};

const hasStoredAuthToken = (): boolean => {
  try {
    return Boolean(localStorage.getItem('token'));
  } catch {
    return false;
  }
};

const getAuthHeaders = (): Record<string, string> => {
  let token = '';
  try {
    token = localStorage.getItem('token') || '';
  } catch {
    token = '';
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const bumpVoiceBackoff = (
  type: 'config' | 'event'
): { backoffMs: number; blockedUntil: number } => {
  hydrateVoiceBackoff();
  const current = type === 'config' ? voiceConfigBackoffMs : voiceEventBackoffMs;
  const next = current > 0 ? Math.min(current * 2, VOICE_BACKOFF_MAX_MS) : VOICE_BACKOFF_BASE_MS;
  const blockedUntil = Date.now() + next;
  if (type === 'config') {
    voiceConfigBackoffMs = next;
    voiceConfigBlockedUntil = blockedUntil;
  } else {
    voiceEventBackoffMs = next;
    voiceEventBlockedUntil = blockedUntil;
  }
  persistVoiceBackoff();
  return { backoffMs: next, blockedUntil };
};

const resetVoiceBackoff = (type: 'config' | 'event') => {
  hydrateVoiceBackoff();
  if (type === 'config') {
    voiceConfigBackoffMs = 0;
    voiceConfigBlockedUntil = 0;
    persistVoiceBackoff();
    return;
  }
  voiceEventBackoffMs = 0;
  voiceEventBlockedUntil = 0;
  persistVoiceBackoff();
};

function postTeresaVoiceEvent(payload: Record<string, unknown>) {
  hydrateVoiceBackoff();
  if (!hasStoredAuthToken()) return;
  if (Date.now() < voiceEventBlockedUntil) return;

  fetch('/api/v10/teresa/voice-event', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (res.ok) {
        resetVoiceBackoff('event');
        return;
      }
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        bumpVoiceBackoff('event');
      }
    })
    .catch(() => {
      bumpVoiceBackoff('event');
    });
}

export function useTeresaVoiceContext(): TeresaVoiceContextValue {
  const ctx = useContext(TeresaVoiceCtx);
  if (!ctx) {
    if (typeof window !== 'undefined') {
      // In production we prefer graceful degradation over a hard crash.
      // This can happen on hosts where TeresaVoiceProvider is intentionally disabled.
      // eslint-disable-next-line no-console
      console.warn(
        '[TeresaVoice] useTeresaVoiceContext used without provider; falling back to no-op context.'
      );
    }
    return noopTeresaVoiceContext;
  }
  return ctx;
}

export function TeresaVoiceProvider({ children }: { children: React.ReactNode }) {
  hydrateVoiceBackoff();
  const { i18n } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentView = useAppStore((s) => s.currentView);
  const { projectName } = usePMOStore();

  const {
    activeConversationId,
    addMessage,
    createConversation,
    setActiveConversation,
    setConversationChatLanguage,
    chatLanguageByConversationId,
  } = useConversationStore();

  // M01-PTEST root-cause fix: this used to be a `useState` initializer that
  // read `readPreferredChatLanguage('pl')` exactly once on mount and never
  // again — Teresa's live voice session was permanently pinned to whatever
  // language was in localStorage (or 'pl') at first mount, deaf to the
  // per-conversation language the product contract promises ("wybór języka
  // rozmowy niezależnie od języka UI",
  // AGREEMENTS/CHAT_TERESA_COMPLETE_PRODUCT_CONTRACT.md §4.1) and that
  // `chatLanguageByConversationId` exists specifically to hold (already
  // wired the same way in UnifiedChatPanel.tsx's own `chatLanguage`
  // useMemo — same three-step cascade, reused here for parity): an
  // explicit user-set preference wins, then the ACTIVE conversation's own
  // language, then the current UI language, with 'pl' as the final
  // fallback only when none of those resolve.
  const chatLanguage = useMemo<string>(() => {
    const explicitPref = readPreferredChatLanguage();
    const activeLang = activeConversationId
      ? chatLanguageByConversationId[activeConversationId]
      : undefined;
    const uiLang = i18n.language?.split('-')[0];
    return explicitPref || activeLang || uiLang || 'pl';
  }, [activeConversationId, chatLanguageByConversationId, i18n.language]);
  const [voiceConfig, setVoiceConfig] = useState<{
    enabled: boolean;
    apiKey: string | null;
    voiceName?: string | null;
    unavailableReason?: string | null;
    persona?: string | null;
    tone?: string | null;
  }>({
    enabled: false,
    apiKey: null,
    unavailableReason: 'Voice config has not loaded yet.',
  });

  useEffect(() => {
    let cancelled = false;

    // NOTE: do NOT pre-gate on localStorage('token'). Auth here is cookie-based
    // (the fetch below uses credentials: 'include'), so a missing localStorage
    // token is a false negative that wrongly disabled voice with
    // "requires an authenticated session" for logged-in users. The server is the
    // auth authority: the voice-config fetch returns 401/403 when unauthenticated,
    // which the .catch() handles with backoff.

    if (Date.now() < voiceConfigBlockedUntil) {
      setVoiceConfig({
        enabled: false,
        apiKey: null,
        unavailableReason: 'Voice config is temporarily paused after repeated failures.',
      });
      return () => {
        cancelled = true;
      };
    }

    fetch('/api/v10/teresa/voice-config', { credentials: 'include', headers: getAuthHeaders() })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            bumpVoiceBackoff('config');
          }
          throw new Error(`voice-config ${response.status}`);
        }
        resetVoiceBackoff('config');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const clientToken =
          typeof data?.session?.clientToken === 'string' && data.session.clientToken.trim()
            ? data.session.clientToken.trim()
            : null;
        setVoiceConfig({
          enabled: data?.enabled === true && Boolean(clientToken),
          apiKey: clientToken,
          voiceName:
            typeof data?.voiceName === 'string' && data.voiceName.trim()
              ? data.voiceName.trim()
              : null,
          unavailableReason:
            typeof data?.unavailableReason === 'string' ? data.unavailableReason : null,
          persona:
            typeof data?.persona === 'string' && data.persona.trim() ? data.persona.trim() : null,
          tone: typeof data?.tone === 'string' && data.tone.trim() ? data.tone.trim() : null,
        });
        postTeresaVoiceEvent({
          eventName: data?.enabled === true ? 'voice_config_loaded' : 'voice_unavailable',
          status: data?.enabled === true ? 'idle' : 'error',
          unavailableReason:
            typeof data?.unavailableReason === 'string' ? data.unavailableReason : undefined,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setVoiceConfig({
          enabled: false,
          apiKey: null,
          unavailableReason:
            'Voice is unavailable because server-side voice config failed to load.',
        });
        postTeresaVoiceEvent({
          eventName: 'voice_unavailable',
          status: 'error',
          unavailableReason: 'voice_config_load_failed',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const systemInstruction = useMemo(() => {
    const base = buildTeresaVoiceSystemInstruction({
      language: chatLanguage,
      organizationName: currentOrganization?.name || currentUser?.organizationName,
      organizationId: currentOrganization?.id || currentUser?.organizationId || undefined,
      userName: currentUser?.firstName,
      activeProject: projectName || undefined,
      currentScreen: currentView || 'Chat',
    });
    // Admin-configured persona/tone from the Teresa virtual worker (panel-editable).
    // Appended as an addon; the frozen safety contract in `base` always takes
    // precedence. When unset, behavior is identical to the built-in instruction.
    const addon = [voiceConfig.persona, voiceConfig.tone].filter(Boolean).join(' ').trim();
    return addon ? `${base}\n\nPERSONA & TONE (admin-configured):\n${addon}` : base;
  }, [
    chatLanguage,
    currentOrganization,
    currentUser,
    projectName,
    currentView,
    voiceConfig.persona,
    voiceConfig.tone,
  ]);

  // M01-P05 (GF-CHAT-06): the user's finalized turn is staged for review, not
  // sent immediately. Previously `onTranscriptUpdate` called `addMessage`
  // directly on every Gemini Live turn boundary — the live conversation
  // overlay had ZERO editable-transcript-before-send step, unlike the
  // composer's own dictation (`EnhancedChatInput`'s internal Web Speech path,
  // which fills the input for the user to edit and send manually). This
  // closes that gap for the overlay path too — one contract instead of two.
  const [pendingUserTranscript, setPendingUserTranscript] = useState<string | null>(null);

  const onTranscriptUpdate = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed.length > 2) {
      // A new turn arriving while a previous one is still pending review
      // replaces it (newest wins) rather than silently sending the old one —
      // known limitation, documented in M01_P05_VOICE_REPORT.md, not a
      // silent data-loss bug: nothing is sent without the user confirming.
      setPendingUserTranscript(trimmed);
    }
  }, []);

  const confirmPendingTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setPendingUserTranscript(null);
      if (trimmed.length > 0 && activeConversationId) {
        void addMessage({
          conversationId: activeConversationId,
          role: 'user',
          content: trimmed,
          messageType: 'text',
          metadata: { source: 'voice_realtime' } as any,
        });
      }
    },
    [addMessage, activeConversationId]
  );

  const discardPendingTranscript = useCallback(() => {
    setPendingUserTranscript(null);
  }, []);

  const onModelAudioText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length > 1 && activeConversationId) {
        void addMessage({
          conversationId: activeConversationId,
          role: 'ai',
          content: trimmed,
          messageType: 'text',
          metadata: { source: 'voice_realtime' } as any,
        });
      }
    },
    [addMessage, activeConversationId]
  );

  const onVoiceStatusChange = useCallback((status: string) => {
    if (status === 'live') {
      postTeresaVoiceEvent({ eventName: 'voice_started', status: 'live' });
      return;
    }
    if (status === 'error') {
      postTeresaVoiceEvent({ eventName: 'voice_error', status: 'error' });
      return;
    }
    if (status === 'idle') {
      postTeresaVoiceEvent({ eventName: 'voice_stopped', status: 'idle' });
      // Ending the session discards (never auto-sends) whatever was still
      // pending review — consistent with "nothing reaches the conversation
      // without an explicit Send".
      setPendingUserTranscript(null);
    }
  }, []);

  const voice = useTeresaVoice({
    enabled: voiceConfig.enabled,
    apiKey: voiceConfig.apiKey,
    voiceName: voiceConfig.voiceName || undefined,
    unavailableReason: voiceConfig.unavailableReason,
    language: chatLanguage,
    systemInstruction,
    onTranscriptUpdate,
    onModelAudioText,
    onStatusChange: onVoiceStatusChange,
  });

  const handleVoiceToggle = useCallback(async () => {
    if (voice.voiceStatus === 'live' || voice.voiceStatus === 'connecting') {
      await voice.stopVoiceConversation();
      return;
    }

    if (!voice.voiceAvailable) {
      postTeresaVoiceEvent({
        eventName: 'voice_unavailable',
        status: 'error',
        unavailableReason: voice.voiceUnavailableReason || 'client_voice_unavailable',
      });
      await voice.startVoiceConversation();
      return;
    }

    let convId = activeConversationId;
    if (!convId) {
      try {
        const newConv = await createConversation({ projectId: currentProjectId || undefined });
        convId = newConv.id;
        setActiveConversation(newConv.id);
        setConversationChatLanguage(newConv.id, chatLanguage as any);
      } catch (err) {
        console.error('[TeresaVoice] Failed to create conversation:', err);
        toast.error(getTeresaStartFailureMessage(i18n.language));
        return;
      }
    }
    postTeresaVoiceEvent({ eventName: 'voice_start_attempt', status: voice.voiceStatus });
    void voice.startVoiceConversation();
  }, [
    voice,
    activeConversationId,
    chatLanguage,
    createConversation,
    currentProjectId,
    setActiveConversation,
    setConversationChatLanguage,
  ]);

  useEffect(() => {
    if (activeConversationId) return;
    if (voice.voiceStatus !== 'live' && voice.voiceStatus !== 'connecting') return;
    void voice.stopVoiceConversation();
  }, [activeConversationId, voice]);

  const value = useMemo<TeresaVoiceContextValue>(
    () => ({
      ...voice,
      handleVoiceToggle,
      pendingUserTranscript,
      confirmPendingTranscript,
      discardPendingTranscript,
    }),
    [
      voice,
      handleVoiceToggle,
      pendingUserTranscript,
      confirmPendingTranscript,
      discardPendingTranscript,
    ]
  );

  return <TeresaVoiceCtx.Provider value={value}>{children}</TeresaVoiceCtx.Provider>;
}
