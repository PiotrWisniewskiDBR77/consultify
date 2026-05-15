import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { isValidLanguage, normalizeLanguageCode, type SupportedLanguage } from '@/i18n';
import { useTeresaVoice, type UseTeresaVoiceReturn } from '../hooks/useTeresaVoice';
import { useAppStore } from '../store/useAppStore';
import { useConversationStore } from '../store/useConversationStore';
import { usePMOStore } from '../store/usePMOStore';
import { readPreferredChatLanguage } from '../utils/chatLanguagePreference';
import { buildTeresaVoiceSystemInstruction } from '../utils/teresaVoiceInstruction';
import { getTeresaStartFailureMessage } from '../components/AIChat/teresaRuntimeCopy';

interface TeresaVoiceContextValue extends UseTeresaVoiceReturn {
  /** Toggle voice on/off — creates conversation if needed */
  handleVoiceToggle: () => Promise<void>;
}

const TeresaVoiceCtx = createContext<TeresaVoiceContextValue | null>(null);

export function useTeresaVoiceContext(): TeresaVoiceContextValue {
  const ctx = useContext(TeresaVoiceCtx);
  if (!ctx) throw new Error('useTeresaVoiceContext must be used inside <TeresaVoiceProvider>');
  return ctx;
}

export function TeresaVoiceProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const currentOrganization = useAppStore((s) => s.currentOrganization);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentView = useAppStore((s) => s.currentView);
  const { projectName } = usePMOStore();

  const {
    activeConversationId,
    addMessage,
    chatLanguageByConversationId,
    createConversation,
    setActiveConversation,
    setConversationChatLanguage,
  } = useConversationStore();

  const [fallbackChatLanguage] = useState<SupportedLanguage>(() => {
    return (readPreferredChatLanguage('pl') || 'pl') as SupportedLanguage;
  });
  const chatLanguage: SupportedLanguage = useMemo(() => {
    const explicitPref = readPreferredChatLanguage(null);
    const activeLang = activeConversationId ? chatLanguageByConversationId[activeConversationId] : null;
    const uiLang = i18n.language?.split('-')[0] || 'en';
    const candidate = explicitPref || activeLang || uiLang || fallbackChatLanguage;
    const base = String(candidate).split('-')[0];
    return (normalizeLanguageCode(base) ||
      (isValidLanguage(base) ? (base as SupportedLanguage) : fallbackChatLanguage)) as SupportedLanguage;
  }, [activeConversationId, chatLanguageByConversationId, fallbackChatLanguage, i18n.language]);

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

  const voice = useTeresaVoice({
    enabled: true,
    language: chatLanguage,
    systemInstruction,
    onTranscriptUpdate,
    onModelAudioText,
  });

  const handleVoiceToggle = useCallback(async () => {
    if (voice.voiceStatus === 'live' || voice.voiceStatus === 'connecting') {
      await voice.stopVoiceConversation();
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
    () => ({ ...voice, handleVoiceToggle }),
    [voice, handleVoiceToggle]
  );

  return <TeresaVoiceCtx.Provider value={value}>{children}</TeresaVoiceCtx.Provider>;
}
