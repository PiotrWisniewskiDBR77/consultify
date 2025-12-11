import React, { useEffect, useState } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { AppView, DRDAxis, AxisAssessment, AdditionalAudit, SessionMode } from '../types';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AIMessageHistory } from '../services/ai/gemini';
import { useAIStream } from '../hooks/useAIStream';
import { AssessmentAxisWorkspace } from '../components/assessment/AssessmentAxisWorkspace';
import { AssessmentSummaryWorkspace } from '../components/assessment/AssessmentSummaryWorkspace';
import { AssessmentAuditsWorkspace } from '../components/assessment/AssessmentAuditsWorkspace';

export const FullAssessmentView: React.FC = () => {
  const {
    currentUser,
    fullSessionData: fullSession,
    currentView: currentAppView,
    setCurrentView: onNavigate,
    setFullSessionData: updateFullSession,
    currentProjectId,
    addChatMessage,
    activeChatMessages: messages,
    setIsBotTyping
  } = useAppStore();

  const { startStream } = useAIStream();

  const language = currentUser?.preferredLanguage || 'EN';
  const [dashboardTab, setDashboardTab] = useState<'summary' | 'audits'>('summary');

  // Load Session Data
  useEffect(() => {
    const loadSession = async () => {
      if (!currentUser) return;
      // Ensure we have a session. If not, create or fetch.
      const data = await Api.getSession(currentUser.id, SessionMode.FULL, currentProjectId || undefined);
      if (data) {
        // Migration safety: Ensure assessment object exists
        if (!data.assessment) data.assessment = {};
        if (!data.audits) data.audits = [];
        updateFullSession(data);
      }
    };
    loadSession();
  }, [currentUser, currentProjectId, updateFullSession]);

  // View Mapping
  const getAxisFromView = (view: AppView): DRDAxis | null => {
    switch (view) {
      case AppView.FULL_STEP1_PROCESSES: return 'processes';
      case AppView.FULL_STEP1_DIGITAL: return 'digitalProducts';
      case AppView.FULL_STEP1_MODELS: return 'businessModels';
      case AppView.FULL_STEP1_DATA: return 'dataManagement';
      case AppView.FULL_STEP1_CULTURE: return 'culture';
      case AppView.FULL_STEP1_CYBERSECURITY: return 'cybersecurity';
      case AppView.FULL_STEP1_AI: return 'aiMaturity';
      default: return null;
    }
  };

  const currentAxisId = getAxisFromView(currentAppView);

  // --- HANDLERS ---

  const handleAxisUpdate = async (axis: DRDAxis, data: Partial<AxisAssessment>) => {
    const updatedAssessment = { ...fullSession.assessment };
    const current = updatedAssessment[axis] || { actual: 1, target: 1, justification: '' };
    updatedAssessment[axis] = { ...current, ...data } as AxisAssessment;

    const newSession = { ...fullSession, assessment: updatedAssessment };
    updateFullSession(newSession);

    // Auto-save
    await Api.saveSession(currentUser!.id, SessionMode.FULL, newSession, currentProjectId || undefined);
  };

  const handleNextAxis = (current: DRDAxis) => {
    const order: DRDAxis[] = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];
    const idx = order.indexOf(current);
    if (idx < order.length - 1) {
      const next = order[idx + 1];
      // Map back to AppView
      const viewMap: Record<DRDAxis, AppView> = {
        processes: AppView.FULL_STEP1_PROCESSES,
        digitalProducts: AppView.FULL_STEP1_DIGITAL,
        businessModels: AppView.FULL_STEP1_MODELS,
        dataManagement: AppView.FULL_STEP1_DATA,
        culture: AppView.FULL_STEP1_CULTURE,
        cybersecurity: AppView.FULL_STEP1_CYBERSECURITY,
        aiMaturity: AppView.FULL_STEP1_AI
      };
      onNavigate(viewMap[next]);
    } else {
      // Done with axes, back to summary
      onNavigate(AppView.FULL_STEP1_ASSESSMENT);
      setDashboardTab('summary');
    }
  };

  const handleAuditAdd = async (audit: AdditionalAudit) => {
    const newAudits = [...(fullSession.audits || []), audit];
    const newSession = { ...fullSession, audits: newAudits };
    updateFullSession(newSession);
    await Api.saveSession(currentUser!.id, SessionMode.FULL, newSession, currentProjectId || undefined);
  };

  const handleAuditRemove = async (id: string) => {
    const newAudits = (fullSession.audits || []).filter(a => a.id !== id);
    const newSession = { ...fullSession, audits: newAudits };
    updateFullSession(newSession);
    await Api.saveSession(currentUser!.id, SessionMode.FULL, newSession, currentProjectId || undefined);
  };

  const handleGenerateInitiatives = async () => {
    // Navigate to Module 3 (Impact Phase)
    onNavigate(AppView.FULL_STEP2_INITIATIVES);

    // Here we would also trigger the AI Generation Engine for Initiatives
    // For now, we assume the view transition triggers it or user initiates it there.
  };

  // --- AI LOGIC ---
  const handleAiChat = async (text: string) => {
    addChatMessage({ id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() });
    setIsBotTyping(true);

    const history: AIMessageHistory[] = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    let context = `User is in Module 2: Assessment.`;
    if (currentAxisId) {
      const data = fullSession.assessment[currentAxisId];
      context += ` Assessing Axis: ${currentAxisId}. Actual: ${data?.actual || '?'}, Target: ${data?.target || '?'}.`;
    } else {
      context += ` Reviewing Assessment Summary/Gap Map.`;
    }
    context += `\nUser asks: ${text}`;

    // Placeholder message
    // Placeholder message (The hook handles streaming updates to store, but SplitLayout handles visual merging)
    // Actually, SplitLayout uses the GLOBAL streaming content to display.
    // So we just need to start the stream.

    // However, SplitLayout expects `activeChatMessages` + `streamingContent`.
    // We already added the user message.

    // Start Stream
    startStream(text, history, context);
  };

  // --- RENDER ---

  // 1. Specific Axis View
  if (currentAxisId) {
    const axisData = fullSession.assessment?.[currentAxisId] || { actual: undefined, target: undefined, justification: '' };

    return (
      <SplitLayout title="DRD Assessment" onSendMessage={handleAiChat}>
        <div className="flex flex-col h-full bg-navy-900 border-l border-white/5 w-full">
          {/* Back Navigation Bar */}
          <div className="h-12 border-b border-white/5 flex items-center px-4 bg-navy-950/30">
            <button
              onClick={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              ← Back to Dashboard
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <AssessmentAxisWorkspace
              axis={currentAxisId}
              data={axisData}
              onChange={(d) => handleAxisUpdate(currentAxisId, d)}
              onNext={() => handleNextAxis(currentAxisId)}
              language={language}
              // PRO Features Props
              context={{
                goals: fullSession.contextSufficiency?.gaps ? [] : ['Growth', 'Efficiency'], // Mock or real if available
                challenges: [],
                industry: currentUser?.companyName || 'Unknown' // Ideally from profile
              }}
            />
          </div>
        </div>
      </SplitLayout>
    );
  }

  // 2. Dashboard View (Summary + Audits)
  return (
    <SplitLayout title="Assessment Dashboard" onSendMessage={handleAiChat}>
      <div className="flex flex-col h-full bg-navy-900 border-l border-white/5 w-full">
        {/* Tabs */}
        <div className="h-16 border-b border-white/5 flex items-center px-8 gap-8 bg-navy-900 shrink-0">
          <button
            onClick={() => setDashboardTab('summary')}
            className={`h-full border-b-2 text-sm font-semibold transition-colors ${dashboardTab === 'summary' ? 'border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Assessment & Gaps
          </button>
          <button
            onClick={() => setDashboardTab('audits')}
            className={`h-full border-b-2 text-sm font-semibold transition-colors ${dashboardTab === 'audits' ? 'border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            Additional Audits
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full">
          {dashboardTab === 'summary' ? (
            // Summary / Gap Map
            <>
              <div className="grid grid-cols-7 gap-1 p-4 bg-navy-950/50 border-b border-white/5">
                {(['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'] as DRDAxis[]).map(axis => (
                  <button
                    key={axis}
                    onClick={() => {
                      const viewMap: Record<DRDAxis, AppView> = {
                        processes: AppView.FULL_STEP1_PROCESSES,
                        digitalProducts: AppView.FULL_STEP1_DIGITAL,
                        businessModels: AppView.FULL_STEP1_MODELS,
                        dataManagement: AppView.FULL_STEP1_DATA,
                        culture: AppView.FULL_STEP1_CULTURE,
                        cybersecurity: AppView.FULL_STEP1_CYBERSECURITY,
                        aiMaturity: AppView.FULL_STEP1_AI
                      };
                      onNavigate(viewMap[axis]);
                    }}
                    className="p-2 rounded bg-white/5 hover:bg-white/10 text-xs text-center border border-white/5 transition-all group"
                  >
                    <span className="block text-slate-400 group-hover:text-white mb-1 truncate">{axis}</span>
                    <div className="flex justify-center gap-1">
                      <span className="w-5 h-5 rounded bg-navy-900 flex items-center justify-center font-bold text-blue-400">
                        {fullSession.assessment?.[axis]?.actual || '-'}
                      </span>
                      <span className="w-5 h-5 rounded bg-navy-900 flex items-center justify-center font-bold text-purple-400">
                        {fullSession.assessment?.[axis]?.target || '-'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <AssessmentSummaryWorkspace
                assessment={fullSession.assessment || {}}
                onGenerateInitiatives={handleGenerateInitiatives}
                language={language}
              />
            </>
          ) : (
            // Audits View
            <AssessmentAuditsWorkspace
              audits={fullSession.audits || []}
              onAddAudit={handleAuditAdd}
              onRemoveAudit={handleAuditRemove}
              language={language}
            />
          )}
        </div>
      </div>
    </SplitLayout>
  );
};
