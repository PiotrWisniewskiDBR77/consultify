import React, { useEffect, useCallback } from 'react';
import { ChatPanel } from '../components/ChatPanel';
import { FullStep2Workspace } from '../components/FullStep2Workspace';
import { FullInitiative, AppView } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI, AIMessageHistory } from '../services/ai/gemini';
import { generateInitiatives as engineGenerate } from '../services/transformationEngine';
import { Api } from '../services/api';

export const FullInitiativesView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    activeChatMessages: messages,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate,
    isBotTyping,
    currentProjectId
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullInitiatives;

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

  const addUserMessage = (content: string) => {
    addMessage({ id: Date.now().toString(), role: 'user', content, timestamp: new Date() });
  };

  const handleAiChat = async (text: string) => {
    addUserMessage(text);
    setTyping(true);

    const history: AIMessageHistory[] = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    // Context: Initiatives
    const initList = fullSession.initiatives.map(i => `- ${i.name} (${i.priority})`).join('\n');
    const context = `Current Initiatives:\n${initList}\n\nUser asks: ${text}`;

    const response = await sendMessageToAI(history, context);
    addAiMessage(response, 0);
  };

  const generateInitiatives = useCallback(() => {
    // Use the Transformation Engine
    const newInitiatives = engineGenerate(fullSession);

    setTimeout(async () => {
      updateFullSession({ initiatives: newInitiatives });
      await Api.saveSession(currentUser!.id, 'FULL', { ...fullSession, initiatives: newInitiatives }, currentProjectId || undefined);

      // AI Strategic Summary
      const initNames = newInitiatives.slice(0, 5).map(i => i.name).join(', '); // Limit to 5 for prompt
      const prompt = `I have generated these initiatives based on maturity gaps: ${initNames} (and others). Provide a 2-sentence strategic justification for why these are the right focus areas to move up the maturity curve.`;

      const summary = await sendMessageToAI([], prompt);

      addAiMessage(`${t.intro[language]}\n\nStrategy: ${summary}`);
    }, 1500);
  }, [fullSession, updateFullSession, addAiMessage, language, t, currentUser, currentProjectId]);

  useEffect(() => {
    // Generate if empty.
    // Also consider regeneration if assessment changed? 
    // For now, simple check: if empty, generate.
    if (!fullSession.initiatives || fullSession.initiatives.length === 0) {
      // Ensure we have some assessment data before generating?
      const hasAssessment = fullSession.assessment.completedAxes.length > 0;
      if (hasAssessment) {
        addAiMessage("Analyzing your assessment results and generating transformation initiatives...");
        generateInitiatives();
      } else {
        addAiMessage("Please complete the assessment first to generate initiatives.");
      }
    }
  }, []); // Run once on mount if empty. 
  // Note: removing dependencies to prevent loop if initiatives update triggers effect. 
  // We want to run it only on mount.

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
    Api.saveSession(currentUser!.id, 'FULL', { ...fullSession, initiatives: newInits }, currentProjectId || undefined);
  };

  return (
    <div className="flex w-full h-full" dir={language === 'AR' ? 'rtl' : 'ltr'}>
      {/* LEFT: Chat */}
      <div className={`flex-1 flex flex-col h-full min-w-[400px] max-w-[500px] ${language === 'AR' ? 'border-l' : 'border-r'} border-elegant`}>
        <div className="flex items-center justify-center py-4 border-b border-navy-800 bg-navy-950 text-xs text-slate-500">
          AI STRATEGIST
        </div>
        <ChatPanel
          messages={messages}
          onSendMessage={handleAiChat}
          isTyping={isBotTyping}
        />
      </div>

      {/* RIGHT: Workspace */}
      <div className="flex-1 bg-navy-900 flex flex-col overflow-hidden">
        <FullStep2Workspace
          fullSession={fullSession}
          onUpdateInitiative={handleUpdateInitiative}
          onNextStep={() => {
            updateFullSession({ step2Completed: true });
            onNavigate(AppView.FULL_STEP3_ROADMAP);
          }}
          language={language}
        />
      </div>
    </div>
  );
};
