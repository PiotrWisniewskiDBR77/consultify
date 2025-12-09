import React, { useEffect, useCallback } from 'react';
import { FullStep3Workspace } from '../components/FullStep3Workspace';
import { FullInitiative, Quarter, Wave, AppView } from '../types';
import { translations } from '../translations';
import { useAppStore } from '../store/useAppStore';

export const FullRoadmapView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    addChatMessage: addMessage,
    setIsBotTyping: setTyping,
    setCurrentView: onNavigate
  } = useAppStore();

  const language = currentUser?.preferredLanguage || 'EN';
  const t = translations.fullRoadmap;

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

  const generateRoadmap = useCallback(() => {
    const scores = fullSession.assessment;

    const scheduledInitiatives = fullSession.initiatives.map(init => {
      let targetQ = 1;

      if (init.priority === 'High') {
        targetQ = init.complexity === 'Low' ? 1 : 2;
      } else if (init.priority === 'Medium') {
        targetQ = 3;
      } else {
        targetQ = 5;
      }

      if (['dataManagement', 'culture', 'processes'].includes(init.axis)) {
      } else if (init.axis === 'aiMaturity') {
        if (scores.dataManagement.score < 3 || scores.processes.score < 3) {
          targetQ += 2;
        }
      }

      if (targetQ < 1) targetQ = 1;
      if (targetQ > 8) targetQ = 8;

      const qStr = `Q${targetQ}` as Quarter;
      const waveStr: Wave = targetQ <= 4 ? 'Wave 1' : 'Wave 2';

      return { ...init, quarter: qStr, wave: waveStr };
    });

    setTimeout(() => {
      updateFullSession({ initiatives: scheduledInitiatives });
      addAiMessage(t.intro[language]);
    }, 1500);
  }, [fullSession, updateFullSession, addAiMessage, language, t]);

  useEffect(() => {
    const needsGeneration = fullSession.initiatives?.length > 0 && !fullSession.initiatives[0].quarter;

    if (needsGeneration) {
      addAiMessage("Generating implementation roadmap...");
      generateRoadmap();
    }
  }, [fullSession.initiatives, generateRoadmap]);

  // Chat handler removed


  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
  };

  return (
    <div className="w-full h-full flex flex-col">
      <FullStep3Workspace
        fullSession={fullSession}
        onUpdateInitiative={handleUpdateInitiative}
        onNextStep={() => {
          updateFullSession({ step3Completed: true });
          onNavigate(AppView.FULL_STEP4_ROI);
        }}
        language={language}
      />
    </div>
  );
};