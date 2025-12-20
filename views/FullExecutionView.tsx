import React, { useEffect, useCallback } from 'react';
import { useScreenContext } from '../hooks/useScreenContext';
import { SplitLayout } from '../components/SplitLayout';
import { FullStep5Workspace } from '../components/FullStep5Workspace';
import { FullInitiative, AppView, AIMessageHistory, InitiativeStatus } from '../types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI } from '../services/ai/gemini';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

export const FullExecutionView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate,
    activeChatMessages: messages
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';

  const { t: translate } = useTranslation();
  const t = translate('fullExecution', { returnObjects: true }) as any;

  // --- AI CONTEXT INJECTION ---
  const todoCount = fullSession.initiatives.filter(i => [InitiativeStatus.DRAFT, InitiativeStatus.PLANNED, InitiativeStatus.APPROVED].includes(i.status)).length;
  const inProgCount = fullSession.initiatives.filter(i => i.status === InitiativeStatus.IN_EXECUTION).length;
  const blockedCount = fullSession.initiatives.filter(i => i.status === InitiativeStatus.BLOCKED).length;

  useScreenContext(
    'execution_kanban',
    'Execution Phase (Kanban)',
    {
      stats: { todo: todoCount, inProgress: inProgCount, blocked: blockedCount },
      count: fullSession.initiatives.length,
      initiatives: fullSession.initiatives.map(i => ({ id: i.id, name: i.name, status: i.status }))
    },
    'User is managing initiative execution on a Kanban board.'
  );

  const addUserMessage = (content: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: new Date() });
  };

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

  const handleAiChat = async (text: string) => {
    addUserMessage(text);
    setTyping(true);

    try {
      const history: AIMessageHistory[] = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Context: Execution
      const todo = fullSession.initiatives.filter(i => [InitiativeStatus.DRAFT, InitiativeStatus.PLANNED, InitiativeStatus.APPROVED].includes(i.status)).length;
      const inProg = fullSession.initiatives.filter(i => i.status === InitiativeStatus.IN_EXECUTION).length;
      const blocked = fullSession.initiatives.filter(i => i.status === InitiativeStatus.BLOCKED).length;

      const context = `
        Context: User is in the Execution Phase (Kanban Board).
        Stats: ${todo} To Do, ${inProg} In Progress, ${blocked} Blocked.
        User Question: ${text}
      `;

      const response = await sendMessageToAI(history, context);
      addAiMessage(response, 0);

    } catch (e) {
      console.error(e);
      addAiMessage("I apologize, I am having trouble processing that right now.");
      setTyping(false);
    }
  };


  useEffect(() => {
    // Legacy cleanup: Ensure statuses are valid Enums
    // We don't need to force change to 'To Do' as it's not a valid status
    // Just ensure existing initiatives have valid status if easier, but here we just skip valid ones.
    const needsInit = fullSession.initiatives.some(i => !Object.values(InitiativeStatus).includes(i.status));

    if (needsInit) {
      const initializedInitiatives = fullSession.initiatives.map(i => ({
        ...i,
        status: Object.values(InitiativeStatus).includes(i.status) ? i.status : InitiativeStatus.PLANNED,
        progress: i.progress || 0
      }));

      setTimeout(() => {
        updateFullSession({ initiatives: initializedInitiatives as FullInitiative[] });
      }, 0);
    }
  }, [fullSession.initiatives, updateFullSession]);


  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
  };

  return (
    <SplitLayout title="Execution Dashboard" onSendMessage={handleAiChat}>
      <div className="w-full h-full flex flex-col relative">
        <div className="absolute top-2 right-4 z-20">
          <AIFeedbackButton context="execution" data={fullSession.initiatives} />
        </div>
        <FullStep5Workspace
          fullSession={fullSession}
          onUpdateInitiative={handleUpdateInitiative}
          onNextStep={() => {
            updateFullSession({ step5Completed: true });
            onNavigate(AppView.FULL_STEP6_REPORTS);
          }}
        />
      </div>
    </SplitLayout>
  );
};
