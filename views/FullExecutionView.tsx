import React, { useEffect, useCallback } from 'react';
import { FullStep5Workspace } from '../components/FullStep5Workspace';
import { FullInitiative, AppView } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';

export const FullExecutionView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullExecution;

  const addAiMessage = useCallback((content: string, delay = 600) => {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content,
        timestamp: new Date()
      });
      setTyping(false);
    }, delay);
  }, [addMessage, setTyping]);

  const analyzeStateAndSuggest = useCallback(() => {
    const initiatives = fullSession.initiatives;
    const todo = initiatives.filter(i => i.status === 'To Do').length;
    const inProg = initiatives.filter(i => i.status === 'In Progress').length;
    const blocked = initiatives.filter(i => i.status === 'Blocked').length;

    let suggestion = "";
    if (blocked > 0) {
      suggestion = `You have ${blocked} blocked initiatives. I recommend addressing them first.`;
    } else if (inProg > 5) {
      suggestion = `You have ${inProg} items in progress. Consider limiting WIP.`;
    } else if (todo > 0) {
      suggestion = `You have ${todo} items in 'To Do'. Assign owners and due dates.`;
    } else {
      suggestion = "Great job! Keep monitoring the progress.";
    }

    addAiMessage(`Current State: ${todo} To Do, ${inProg} In Progress, ${blocked} Blocked.\n\nAdvice: ${suggestion}`, 1000);
  }, [fullSession, addAiMessage]);

  useEffect(() => {
    const needsInit = fullSession.initiatives.some(i => ['Draft', 'Ready', 'Archived'].includes(i.status));

    if (needsInit) {
      const initializedInitiatives = fullSession.initiatives.map(i => ({
        ...i,
        status: ['Draft', 'Ready', 'Archived'].includes(i.status) ? 'To Do' : i.status,
        progress: i.progress || 0
      }));

      setTimeout(() => {
        updateFullSession({ initiatives: initializedInitiatives as FullInitiative[] });
      }, 0);
    }
  }, [fullSession.initiatives, updateFullSession]);

  // Chat handler effect removed as ChatPanel is not currently rendered in this view
  // TODO: Implement Split View layout if Chat is desired here

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
  };

  return (
    <div className="w-full h-full flex flex-col">
      <FullStep5Workspace
        fullSession={fullSession}
        onUpdateInitiative={handleUpdateInitiative}
        onNextStep={() => {
          updateFullSession({ step5Completed: true });
          onNavigate(AppView.FULL_STEP6_REPORTS);
        }}
        language={language}
      />
    </div>
  );
};
