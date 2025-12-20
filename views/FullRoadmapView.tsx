
import React, { useEffect, useCallback } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { FullStep3Workspace } from '../components/FullStep3Workspace';
import { FullInitiative, Quarter, Wave, AppView, SessionMode, InitiativeStatus } from '../types';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AIFeedbackButton } from '../components/AIFeedbackButton';

import { WorkloadChart } from '../components/WorkloadChart';
import { RoadmapSummary } from '../components/RoadmapSummary';

import { RebalanceModal } from '../components/RebalanceModal';

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

  // AI Summary State
  const [summary, setSummary] = React.useState({
    summaryText: "",
    riskText: "",
    recommendation: ""
  });
  const [isSummaryLoading, setIsSummaryLoading] = React.useState(false);

  // New State for Rebalancing
  const [hasManualChanges, setHasManualChanges] = React.useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = React.useState(false);


  // Fetch Summary on Mount or Change
  React.useEffect(() => {
    const fetchSummary = async () => {
      if (fullSession.initiatives.length === 0) return;

      setIsSummaryLoading(true);
      try {
        const result = await Api.post('/ai/roadmap-summary', { initiatives: fullSession.initiatives });
        setSummary(result);
      } catch (e) {
        console.error("Summary fetch failed", e);
      } finally {
        setIsSummaryLoading(false);
      }
    };

    // Debounce or just run on mount/change
    fetchSummary();
  }, [fullSession.initiatives.length, fullSession.initiatives.map(i => i.quarter).join(',')]); // Re-run when quarters change

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

  const generatingRef = React.useRef(false);

  useEffect(() => {
    // Check if any initiative is missing a quarter assignment
    const needsGeneration = fullSession.initiatives?.length > 0 && fullSession.initiatives.some(i => !i.quarter);

    // FIX: Only trigger if explicitly needed and not already generating.
    // Also check if we already have a "generated" flag to avoid spamming the chat
    const hasGenerated = generatingRef.current; // Simple check, but ideally we'd store "generated" in session state

    if (needsGeneration && !hasGenerated) {
      generatingRef.current = true;
      // Only send message if we are actually doing work
      addAiMessage("Generating implementation roadmap...");

      generateRoadmap().finally(() => {
        // Add a small delay before releasing the lock to ensure state updates have propagated
        setTimeout(() => {
          // We don't set generatingRef.current = false here immediately to prevent bounce-back loops.
          // In a real app we'd want a more robust state machine.
          // For now, keeping it true effectively "locks" it for this mount session unless manually reset.
          // If we want to allow re-generation, we should check specifically for USER intent or data invalidation.
          generatingRef.current = false;
        }, 2000);
      });
    }
  }, [fullSession.initiatives.length, generateRoadmap, addAiMessage]); // Reduced dependencies to length only to avoid deep object churn loops

  const handleUpdateInitiative = (updated: FullInitiative) => {
    const newInits = fullSession.initiatives.map(i => i.id === updated.id ? updated : i);
    updateFullSession({ initiatives: newInits });

    // Flag manual change if quarter has changed
    const old = fullSession.initiatives.find(i => i.id === updated.id);
    if (old && old.quarter !== updated.quarter) {
      setHasManualChanges(true);
    }
  };

  // Rebalance Handler
  const handleApplyRebalance = (option: any) => {
    // option.schedule is a map of initId -> Quarter string
    if (!option.schedule) return;

    const newInits = fullSession.initiatives.map(i => {
      const newQ = option.schedule[i.id];
      if (newQ) {
        // Simple wave logic
        const wave: Wave = ['Q1', 'Q2', 'Q3', 'Q4'].includes(newQ) ? 'Wave 1' : 'Wave 2';
        return { ...i, quarter: newQ as Quarter, wave };
      }
      return i;
    });

    updateFullSession({ initiatives: newInits });
    setShowRebalanceModal(false);
    setHasManualChanges(false);
    addAiMessage(`Roadmap rebalanced using "${option.type}" strategy.`);
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

  // State for Pilot Decision
  const [showPilotDecision, setShowPilotDecision] = React.useState(false);

  const handleNext = () => {
    // PRO MAX: Intercept Next to force Pilot Decision
    setShowPilotDecision(true);
  };

  const confirmPilot = async (pilotId: string) => {
    // Mark initiative as PILOT (step4 -> IN_EXECUTION)
    const updated = fullSession.initiatives.map(i =>
      i.id === pilotId ? { ...i, status: InitiativeStatus.IN_EXECUTION } : i
    );
    updateFullSession({ initiatives: updated, step3Completed: true });
    await Api.saveSession(currentUser!.id, SessionMode.FULL, { ...fullSession, initiatives: updated, step3Completed: true }, currentProjectId || undefined);

    onNavigate(AppView.FULL_STEP4_ROI); // Or go to Step 5 Execution directly? For now ROI.
    // Actually Pilot Execution is Step 5 equivalent (FULL_PILOT_EXECUTION)?
    // Keeping flow: Roadmap -> ROI -> Pilot Execution
  };

  return (
    <SplitLayout title="Module 3: Strategic Roadmap" onSendMessage={handleAiChat}>
      <div className="w-full h-full relative">
        <div className="w-full h-full bg-slate-50 dark:bg-navy-950 flex flex-col p-6 overflow-y-auto gap-6 relative">
          <div className="absolute top-6 right-6 z-10">
            <AIFeedbackButton context="roadmap" data={fullSession.initiatives} />
          </div>

          <RoadmapSummary
            summary={summary}
            isLoading={isSummaryLoading}
          />

          {hasManualChanges && (
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-400/20 rounded-lg text-amber-600 dark:text-amber-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                </div>
                <div>
                  <h3 className="font-bold text-navy-900 dark:text-white text-sm">Manual Schedule Overrides</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">You have manually moved initiatives. AI optimization is paused.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setHasManualChanges(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  Keep Changes
                </button>
                <button
                  onClick={() => setShowRebalanceModal(true)}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                  Rebalance with AI
                </button>
              </div >
            </div >
          )}

          {/* 2. Workload Chart */}
          <div className="bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/5 rounded-xl p-5 shadow-sm">
            <WorkloadChart initiatives={fullSession.initiatives} quarters={['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8']} />
          </div>

          {/* 3. Main Workspace */}
          <FullStep3Workspace
            fullSession={fullSession}
            onUpdateInitiative={handleUpdateInitiative}
            onNextStep={handleNext}
            users={users} // Pass users
            currentUser={currentUser} // Pass currentUser
          />
        </div >

        {/* Rebalance Modal */}
        < RebalanceModal
          isOpen={showRebalanceModal}
          onClose={() => setShowRebalanceModal(false)}
          onApply={handleApplyRebalance}
          initiatives={fullSession.initiatives}
        />

        {showPilotDecision && (
          <div className="absolute inset-0 z-50 bg-slate-500/50 dark:bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-2xl max-w-4xl w-full p-8 shadow-2xl transition-colors">
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">Strategy Decision: Select Pilot</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                Risk Management Protocol: We recommend starting with a "Quick Win" Pilot before full rollout.
                Select <strong>one</strong> high-impact, low-complexity initiative to validate the strategy.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-96 overflow-y-auto">
                {/* Filter for Wave 1 candidates */}
                {fullSession.initiatives.filter(i => i.wave === 'Wave 1').map(init => (
                  <div key={init.id}
                    onClick={() => confirmPilot(init.id)}
                    className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-all hover:border-blue-500 group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{init.priority} Priority</span>
                      {init.complexity === 'Low' && <span className="text-[10px] bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">Low Risk</span>}
                    </div>
                    <h4 className="text-lg font-bold text-navy-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-300">{init.name}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{init.description || init.summary}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => { setShowPilotDecision(false); /* Skip Logic? */ }}
                  className="text-slate-500 hover:text-navy-900 dark:hover:text-white px-4 text-sm transition-colors"
                >
                  Review Roadmap Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div >
    </SplitLayout >
  );
};