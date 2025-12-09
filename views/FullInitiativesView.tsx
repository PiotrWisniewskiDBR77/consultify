import React, { useEffect, useCallback } from 'react';
import { ChatPanel } from '../components/ChatPanel';
import { FullStep2Workspace } from '../components/FullStep2Workspace';
import { FullInitiative, AxisId, AppView } from '../types';
import { translations } from '../translations';
import { initiativesLibrary } from '../contentLibraries';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI, AIMessageHistory } from '../services/ai/gemini';

export const FullInitiativesView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    activeChatMessages: messages,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate,
    isBotTyping
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
    const newInitiatives: FullInitiative[] = [];
    let idCounter = 1;
    const scores = fullSession.assessment;

    const addFromLib = (item: typeof initiativesLibrary['processes'][0], axis: AxisId, priorityOverride?: 'High' | 'Medium' | 'Low') => {
      newInitiatives.push({
        id: `INIT-${idCounter++}`,
        name: item.name,
        description: item.description,
        axis: axis,
        priority: priorityOverride || 'Medium',
        complexity: item.complexity,
        status: 'Draft'
      });
    };

    const axisIds = Object.keys(scores).filter(k => k !== 'completedAxes') as AxisId[];
    axisIds.forEach(axisId => {
      const score = scores[axisId].score;
      const libraryItems = initiativesLibrary[axisId];

      if (!libraryItems) return;

      if (score < 3.5) {
        addFromLib(libraryItems[0], axisId, 'High');
        if (libraryItems[1]) addFromLib(libraryItems[1], axisId, 'Medium');
      } else {
        const advancedItem = libraryItems.find(i => i.complexity === 'High') || libraryItems[libraryItems.length - 1];
        if (advancedItem) addFromLib(advancedItem, axisId, 'Medium');
      }
    });

    if (newInitiatives.length < 6) {
      const aiQuickWin = initiativesLibrary.aiMaturity.find(i => i.complexity === 'Low');
      if (aiQuickWin) addFromLib(aiQuickWin, 'aiMaturity', 'Low');
    }

    setTimeout(async () => {
      updateFullSession({ initiatives: newInitiatives });

      // AI Strategic Summary
      const initNames = newInitiatives.map(i => i.name).join(', ');
      const prompt = `I have generated these initiatives: ${initNames}. Provide a 2-sentence strategic justification for why these are the right focus areas based on standard digital transformation maturity curves.`;

      // We pass empty history for this specific internal query or use current messages? 
      // Better to use a fresh prompt for the Summary to avoid chat noise, then append result.
      const summary = await sendMessageToAI([], prompt);

      addAiMessage(`${t.intro[language]}\n\nStrategy: ${summary}`);
    }, 1500);
  }, [fullSession, updateFullSession, addAiMessage, language, t]);

  useEffect(() => {
    if (!fullSession.initiatives || fullSession.initiatives.length === 0) {
      addAiMessage("Generating initiatives based on your assessment...");
      generateInitiatives();
    }
  }, [fullSession.initiatives, generateInitiatives]);

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
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
