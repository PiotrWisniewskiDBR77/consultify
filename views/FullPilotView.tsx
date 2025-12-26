import React, { useEffect, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullPilotWorkspace } from '../components/FullPilotWorkspace';
import { FullInitiative, AppView, AIMessageHistory, SessionMode, InitiativeStatus } from '../types';
import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI } from '../services/ai/gemini';
import { toast } from 'react-hot-toast';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

export const FullPilotView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    activeChatMessages: messages,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate,
    currentProjectId
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';

  // Load Session Data
  useEffect(() => {
    const loadSession = async () => {
      if (!currentUser) return;
      const data = await Api.getSession(currentUser.id, SessionMode.FULL, currentProjectId || undefined);
      if (data) {
        updateFullSession(data);
      }
    };
    loadSession();
  }, [currentUser, currentProjectId, updateFullSession]);

  // Find pilot initiative (status = IN_EXECUTION or first initiative)
  const pilotInitiative = fullSession.initiatives.find(
    (i: FullInitiative) => i.status === InitiativeStatus.EXECUTING
  ) || fullSession.initiatives[0];

  const handleUpdateInitiative = useCallback(async (initiative: FullInitiative) => {
    const updatedInitiatives = fullSession.initiatives.map((i: FullInitiative) =>
      i.id === initiative.id ? initiative : i
    );
    const updatedSession = { ...fullSession, initiatives: updatedInitiatives };
    updateFullSession(updatedSession);

    try {
      await Api.saveSession(currentUser?.id || '', SessionMode.FULL, updatedSession, currentProjectId || undefined);
    } catch (error) {
      console.error('Failed to update session:', error);
      toast.error('Failed to save changes');
    }
  }, [fullSession, currentUser, currentProjectId, updateFullSession]);

  const handleNextStep = useCallback(() => {
    onNavigate(AppView.FULL_STEP5_EXECUTION);
  }, [onNavigate]);

  return (
    <SplitLayout title="Pilot Execution">
      <div className="flex h-full">
        <div className="flex-1">
          <FullPilotWorkspace
            fullSession={fullSession}
            pilotInitiative={pilotInitiative}
            onUpdateInitiative={handleUpdateInitiative}
            onNextStep={handleNextStep}
            language={language}
          />
        </div>
        <div className="w-80 border-l border-slate-200 dark:border-white/10 p-4">
          <AIFeedbackButton context="pilot_execution" />
        </div>
      </div>
    </SplitLayout>
  );
};
