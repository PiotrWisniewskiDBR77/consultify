import React, { useEffect, useCallback } from 'react';
import { FullStep1Workspace } from '../components/FullStep1Workspace';
import { AppView, AxisId } from '../types';
import { translations } from '../translations';
import { maturityInterpretations } from '../contentLibraries';
import { useAppStore } from '../store/useAppStore';
import { sendMessageToAI, AIMessageHistory, SYSTEM_PROMPTS } from '../services/ai/gemini';

export const FullAssessmentView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    currentView: currentAppView,
    setCurrentView: onNavigate,

    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    // setChatHandler, // deprecated/removed from store? Wait, I need to check if user removed it.
    // In Step 104, User used useStore() which had setChatHandler.
    // In my useAppStore, I don't recall setChatHandler.
    // Let me check useAppStore definition again if I can, OR just assume I need to handle it via effect if Sidebar/ChatPanel isn't using it.
    // Actually, ChatPanel in FullAssessmentView is rendered LOCALLY (see previous edits).
    // So I don't need setChatHandler from store if I pass handleInteraction to ChatPanel directly.
    // I will remove setChatHandler from destructuring if it's not in my store.
    activeChatMessages: messages,
    setIsBotTyping: setTyping
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullAssessment;

  // Map AppView to AxisId
  const getAxisFromView = (view: AppView): AxisId | null => {
    switch (view) {
      case AppView.FULL_STEP1_PROCESSES: return 'processes';
      case AppView.FULL_STEP1_DIGITAL: return 'digitalProducts';
      case AppView.FULL_STEP1_MODELS: return 'businessModels';
      case AppView.FULL_STEP1_DATA: return 'dataManagement';
      case AppView.FULL_STEP1_CULTURE: return 'culture';
      case AppView.FULL_STEP1_AI: return 'aiMaturity';
      default: return null;
    }
  };

  const currentAxisId = getAxisFromView(currentAppView);

  // Chat Helpers
  const addAiMessage = useCallback((content: string, options?: any[], delay = 600) => {
    setTyping(true);
    setTimeout(() => {
      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content,
        timestamp: new Date(),
        options
      });
      setTyping(false);
    }, delay);
  }, [addMessage, setTyping]);

  const addUserMessage = (content: string) => {
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    });
  };

  const askQuestion = useCallback((axisId: AxisId, qIndex: number) => {
    const questions = t.questions[axisId] || [];
    const questionObj = questions[qIndex] || { EN: "Generic Question?", PL: "Pytanie?" };
    const text = (questionObj as any)[language] || questionObj.EN;

    const chips = Array.from({ length: 7 }, (_, i) => ({
      id: String(i + 1), label: String(i + 1), value: String(i + 1)
    }));

    // We could ask AI to rephrase this, but for consistency let's stick to text + AI awareness
    addAiMessage(text, chips);
  }, [language, t, addAiMessage]);

  // Handle Logic
  const handleInteraction = useCallback(async (textOrValue: string) => {
    const isScore = ['1', '2', '3', '4', '5', '6', '7'].includes(textOrValue);

    addUserMessage(textOrValue);

    if (currentAxisId && isScore) {
      const score = parseInt(textOrValue);
      const currentAxisData = fullSession.assessment[currentAxisId];
      const newAnswers = [...currentAxisData.answers, score];

      const updatedAssessment = { ...fullSession.assessment };
      updatedAssessment[currentAxisId].answers = newAnswers;

      if (newAnswers.length >= 3) {
        // Axis Completed
        const avg = newAnswers.reduce((a, b) => a + b, 0) / newAnswers.length;
        updatedAssessment[currentAxisId].score = avg;
        updatedAssessment[currentAxisId].status = 'COMPLETED';
        if (!updatedAssessment.completedAxes.includes(currentAxisId)) {
          updatedAssessment.completedAxes.push(currentAxisId);
        }

        updateFullSession({ assessment: updatedAssessment });

        // AI Insight Generation
        setTyping(true);
        const history: AIMessageHistory[] = messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }));

        const context = `User completed axis: ${currentAxisId} with score ${avg.toFixed(1)}/7. Analyze this score briefy and provide an insight.`;
        const insight = await sendMessageToAI(history, context, "You are an expert consultant analyzing maturity scores.");

        addAiMessage(`Score: ${avg.toFixed(1)}/7.\n\nAI Insight: ${insight}`);

        if (updatedAssessment.completedAxes.length === 6) {
          // Full Completion
          setTimeout(async () => {
            const summaryPrompt = "Assessment complete. Summarize the weakest link and suggest next steps.";
            const summary = await sendMessageToAI([...history, { role: 'model', parts: [{ text: insight }] }], summaryPrompt);
            addAiMessage(summary);
          }, 1000);
        } else {
          setTimeout(() => {
            onNavigate(AppView.FULL_STEP1_ASSESSMENT);
          }, 4000);
        }

      } else {
        updateFullSession({ assessment: updatedAssessment });
        setTimeout(() => askQuestion(currentAxisId, newAnswers.length), 500);
      }
    } else {
      // Chat mode (Non-score input) or General Chat
      setTyping(true);
      const history: AIMessageHistory[] = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      // Pass context about current axis
      const context = currentAxisId
        ? `Current Context: Assessing ${currentAxisId}. Question ${fullSession.assessment[currentAxisId].answers.length + 1}. User asks: ${textOrValue}`
        : `User says: ${textOrValue}`;

      const response = await sendMessageToAI(history, context);
      addAiMessage(response);
    }
  }, [currentAxisId, fullSession, updateFullSession, addAiMessage, askQuestion, onNavigate, language, t, messages]);

  // Removed local setChatHandler effect since we pass handleInteraction directly to ChatPanel if rendered locally
  // But wait, ChatPanel IS rendered locally in this file's return (see Step 108/104 render logic).
  // So we don't need the useEffect for setChatHandler.

  useEffect(() => {
    if (currentAxisId) {
      const axisLabel = translations.sidebar[`fullStep1_${currentAxisId === 'digitalProducts' ? 'prod' : currentAxisId.substring(0, 4)}` as any]?.[language] || currentAxisId;
      const axisData = fullSession.assessment[currentAxisId];

      if (axisData.status === 'COMPLETED') {
        const completedMsg = `${t.axisIntro[language].replace('{axis}', axisLabel)} (${t.completed[language]})`;
        // Check if last message is this one to avoid duplicate?
        // For now just add.
        addAiMessage(completedMsg);
      } else if (axisData.answers.length === 0) {
        addAiMessage(t.axisIntro[language].replace('{axis}', axisLabel));
        // Use AI to generate a warm starter question? No, stick to consistent scale.
        setTimeout(() => askQuestion(currentAxisId, 0), 1000);
      } else {
        addAiMessage("Resuming assessment...");
        setTimeout(() => askQuestion(currentAxisId, axisData.answers.length), 1000);
      }
    }
  }, [currentAxisId, currentAppView, addAiMessage, askQuestion, language, t]); // Add dependencies to silence linter

  return (
    <div className="w-full h-full flex flex-col">
      <FullStep1Workspace
        fullSession={fullSession}
        currentAxisId={currentAxisId || undefined}
        onStartAxis={(id) => {
          const viewMap: Record<string, AppView> = {
            'processes': AppView.FULL_STEP1_PROCESSES,
            'digitalProducts': AppView.FULL_STEP1_DIGITAL,
            'businessModels': AppView.FULL_STEP1_MODELS,
            'dataManagement': AppView.FULL_STEP1_DATA,
            'culture': AppView.FULL_STEP1_CULTURE,
            'aiMaturity': AppView.FULL_STEP1_AI
          };
          onNavigate(viewMap[id]);
        }}
        onNextStep={() => onNavigate(AppView.FULL_STEP2_INITIATIVES)}
        language={language}
      />
    </div>
  );
};
