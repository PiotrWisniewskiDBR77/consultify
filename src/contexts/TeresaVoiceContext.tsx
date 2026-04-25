import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useTeresaVoice, type UseTeresaVoiceReturn } from '../hooks/useTeresaVoice';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';
import { usePMOStore } from '../store/usePMOStore';
import { readPreferredChatLanguage } from '../utils/chatLanguagePreference';
import { buildTeresaVoiceSystemInstruction } from '../utils/teresaVoiceInstruction';

interface TeresaVoiceContextValue extends UseTeresaVoiceReturn {
  /** Toggle voice on/off — creates conversation if needed */
  handleVoiceToggle: () => Promise<void>;
}

const TeresaVoiceCtx = createContext<TeresaVoiceContextValue | null>(null);

function postTeresaVoiceEvent(payload: Record<string, unknown>) {
  fetch('/api/v10/teresa/voice-event', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* telemetry must never break voice UX */
  });
}

export function useTeresaVoiceContext(): TeresaVoiceContextValue {
  const ctx = useContext(TeresaVoiceCtx);
  if (!ctx) throw new Error('useTeresaVoiceContext must be used inside <TeresaVoiceProvider>');
  return ctx;
}

export function TeresaVoiceProvider({ children }: { children: React.ReactNode }) {
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
  } = useConversationStore();

  const [chatLanguage] = useState<string>(() => {
    return readPreferredChatLanguage('pl') || 'pl';
  });
  const [voiceConfig, setVoiceConfig] = useState<{
    enabled: boolean;
    apiKey: string | null;
    voiceName?: string | null;
    unavailableReason?: string | null;
  }>({
    enabled: false,
    apiKey: null,
    unavailableReason: 'Voice config has not loaded yet.',
  });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/v10/teresa/voice-config', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`voice-config ${response.status}`);
        }
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

  const systemInstruction = useMemo(
    () =>
      buildTeresaVoiceSystemInstruction({
        language: chatLanguage,
        organizationName: currentOrganization?.name || currentUser?.organizationName,
        organizationId: currentOrganization?.id || currentUser?.organizationId || undefined,
        userName: currentUser?.firstName,
        activeProject: projectName || undefined,
        currentScreen: currentView || 'Chat',
      }),
    [chatLanguage, currentOrganization, currentUser, projectName, currentView]
  );

  const onTranscriptUpdate = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length > 2 && activeConversationId) {
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

  const value = useMemo<TeresaVoiceContextValue>(
    () => ({ ...voice, handleVoiceToggle }),
    [voice, handleVoiceToggle]
  );

  return <TeresaVoiceCtx.Provider value={value}>{children}</TeresaVoiceCtx.Provider>;
}
