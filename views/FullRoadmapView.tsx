
import React, { useEffect, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullStep3Workspace } from '../components/FullStep3Workspace';
import { FullInitiative, Quarter, Wave, AppView, SessionMode } from '../types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

export const FullRoadmapView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    setFullSessionData: updateFullSession,
    setIsBotTyping: setTyping,
    addChatMessage: addMessage,
    activeChatMessages: messages,
    currentProjectId,
    setCurrentView: onNavigate
  } = useAppStore();

  const handleAiChat = async (text: string) => {
    // Simple pass-through for now, or implement full chat logic
    addMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    // TODO: Implement actual AI chat for Roadmap context equivalent to Initiatives
  };

  const { t: translate } = useTranslation();
  const t = translate('fullRoadmap', { returnObjects: true }) as any;

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

  const generateRoadmap = useCallback(async () => {
    addAiMessage("Optimizing implementation roadmap based on dependencies and priorities...");

    try {
      // CALL AI ROADMAP ENGINE
      const roadmapData = await Api.aiRoadmap(fullSession.initiatives);

      // Map AI result (Year/Quarter structure) back to Initiative objects
      // AI returns { year1: { q1: ["Title 1"], ... } }

      const scheduledInitiatives = fullSession.initiatives.map(init => {
        let quarter: Quarter = 'Q1';
        let wave: Wave = 'Wave 1';
        let year = 1;

        // Find init in roadmap structure
        // This is O(N*Years*Quarters) but N is small (5-10)
        let found = false;

        // Helper to parse structure
        ['year1', 'year2', 'year3'].forEach((yKey, yIdx) => {
          const yObj = roadmapData[yKey];
          if (!yObj) return;

          ['q1', 'q2', 'q3', 'q4'].forEach(qKey => {
            if (found) return;
            const titles = yObj[qKey];
            if (Array.isArray(titles) && titles.includes(init.name)) {
              year = yIdx + 1;
              quarter = qKey.toUpperCase() as Quarter; // "Q1"
              found = true;
            }
          });
        });

        if (!found) {
          // Fallback deterministic logic if not found in AI response
          if (init.priority === 'High') {
            quarter = init.complexity === 'Low' ? 'Q1' : 'Q2';
          } else {
            quarter = 'Q3';
          }
        }

        // Determine Wave based on Year/Quarter
        // Wave 1 = Y1 (Q1-Q4) generally, or Q1-Q2?
        // Existing logic: targetQ <= 4 ? Wave 1 : Wave 2.
        // Let's say Year 1 = Wave 1, Year 2+ = Wave 2
        if (year === 1) wave = 'Wave 1';
        else wave = 'Wave 2'; // Simplified for 2 waves view

        return { ...init, quarter, wave };
      });

      updateFullSession({ initiatives: scheduledInitiatives });
      await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: scheduledInitiatives }, currentProjectId || undefined);
      addAiMessage(t.intro);

    } catch (e) {
      console.error("Roadmap Gen Error", e);
      addAiMessage("AI Roadmap generation failed. Using standard sequencing.");

      // Fallback Logic (original)
      const scheduledInitiatives = fullSession.initiatives.map(init => {
        let targetQ = 1;
        if (init.priority === 'High') targetQ = init.complexity === 'Low' ? 1 : 2;
        else targetQ = 3;

        if (targetQ < 1) targetQ = 1;
        const qStr = `Q${targetQ}` as Quarter;
        const waveStr: Wave = targetQ <= 4 ? 'Wave 1' : 'Wave 2';
        return { ...init, quarter: qStr, wave: waveStr };
      });

      updateFullSession({ initiatives: scheduledInitiatives });
      await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: scheduledInitiatives }, currentProjectId || undefined);
    }
  }, [fullSession, updateFullSession, addAiMessage, t, currentUser, currentProjectId]);

  useEffect(() => {
    const needsGeneration = fullSession.initiatives?.length > 0 && !fullSession.initiatives[0].quarter;

    if (needsGeneration) {
      addAiMessage("Generating implementation roadmap...");
      generateRoadmap();
    }
  }, [fullSession.initiatives, generateRoadmap]);

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });
  };

  // State for Pilot Decision
  const [showPilotDecision, setShowPilotDecision] = React.useState(false);

  const handleNext = () => {
    // PRO MAX: Intercept Next to force Pilot Decision
    setShowPilotDecision(true);
  };

  const confirmPilot = async (pilotId: string) => {
    // Mark initiative as PILOT (step4)
    const updated = fullSession.initiatives.map(i =>
      i.id === pilotId ? { ...i, status: 'step4' as const } : i
    );
    updateFullSession({ initiatives: updated, step3Completed: true });
    await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: updated, step3Completed: true }, currentProjectId || undefined);

    onNavigate(AppView.FULL_STEP4_ROI); // Or go to Step 5 Execution directly? For now ROI.
    // Actually Pilot Execution is Step 5 equivalent (FULL_PILOT_EXECUTION)?
    // Keeping flow: Roadmap -> ROI -> Pilot Execution
  };

  const [users, setUsers] = React.useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:3001/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Failed to fetch users", error);
      }
    };
    if (currentUser?.organizationId) {
      fetchUsers();
    }
  }, [currentUser?.organizationId]);

  return (
    <SplitLayout title="Strategic Roadmap" onSendMessage={handleAiChat}>
      <div className="w-full h-full bg-gray-50 dark:bg-navy-900 flex flex-col overflow-hidden relative">
        <div className="absolute top-2 right-4 z-20">
          <AIFeedbackButton context="roadmap" data={fullSession.initiatives} />
        </div>

        <FullStep3Workspace
          fullSession={fullSession}
          onUpdateInitiative={handleUpdateInitiative}
          onNextStep={handleNext}
          users={users} // Pass users
          currentUser={currentUser} // Pass currentUser
        />

        {showPilotDecision && (
          <div className="absolute inset-0 z-50 bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-navy-900 border border-white/10 rounded-2xl max-w-4xl w-full p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-2">Strategy Decision: Select Pilot</h2>
              <p className="text-slate-400 mb-8">
                Risk Management Protocol: We recommend starting with a "Quick Win" Pilot before full rollout.
                Select <strong>one</strong> high-impact, low-complexity initiative to validate the strategy.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-96 overflow-y-auto">
                {/* Filter for Wave 1 candidates */}
                {fullSession.initiatives.filter(i => i.wave === 'Wave 1').map(init => (
                  <div key={init.id}
                    onClick={() => confirmPilot(init.id)}
                    className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-all hover:border-blue-500 group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-400 uppercase">{init.priority} Priority</span>
                      {init.complexity === 'Low' && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Low Risk</span>}
                    </div>
                    <h4 className="text-lg font-bold text-white mb-1 group-hover:text-blue-300">{init.name}</h4>
                    <p className="text-sm text-slate-400 line-clamp-2">{init.description || init.summary}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => { setShowPilotDecision(false); /* Skip Logic? */ }}
                  className="text-slate-500 hover:text-white px-4 text-sm"
                >
                  Review Roadmap Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SplitLayout>
  );
};