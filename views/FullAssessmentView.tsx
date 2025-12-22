```typescript
import React, { useEffect, useState } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { AppView, DRDAxis, AxisAssessment, SessionMode, MaturityLevel } from '../types';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AIMessageHistory } from '../services/ai/gemini';
import { useAIStream } from '../hooks/useAIStream';
import { AssessmentAxisWorkspace } from '../components/assessment/AssessmentAxisWorkspace';
import { AssessmentWizard } from '../components/assessment/AssessmentWizard';
import { AssessmentSummaryWorkspace } from '../components/assessment/AssessmentSummaryWorkspace';
import { AssessmentReportsWorkspace } from '../components/assessment/AssessmentReportsWorkspace';
import { useTranslation } from 'react-i18next';
import { Settings, Smartphone, Briefcase, Database, Users, Lock, BrainCircuit, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
type AxisId = DRDAxis;
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
  const [dashboardTab, setDashboardTab] = useState<'summary' | 'reports'>('summary');
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
  const { t: translate } = useTranslation();
  const t = translate('fullAssessment', { returnObjects: true }) as Record<string, any>;
  const ts = translate('sidebar', { returnObjects: true }) as Record<string, any>;
  const ta = translate('assessment.workspace', { returnObjects: true }) as Record<string, any>;
  const tc = translate('common', { returnObjects: true }) as Record<string, any>;
  const [interviewAxis, setInterviewAxis] = useState<{ id: AxisId; label: string } | null>(null);
  const axes: { id: AxisId; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'processes', label: ts.fullStep1_proc, icon: <Settings size={22} />, desc: t.descriptions.processes },
    { id: 'digitalProducts', label: ts.fullStep1_prod, icon: <Smartphone size={22} />, desc: t.descriptions.digitalProducts },
    { id: 'businessModels', label: ts.fullStep1_model, icon: <Briefcase size={22} />, desc: t.descriptions.businessModels },
    { id: 'culture', label: ts.fullStep1_cult, icon: <Users size={22} />, desc: t.descriptions.culture },
    { id: 'dataManagement', label: ts.fullStep1_data, icon: <Database size={22} />, desc: t.descriptions.dataManagement },
    { id: 'cybersecurity', label: ts.fullStep1_cyber, icon: <Lock size={22} />, desc: t.descriptions.cybersecurity },
    { id: 'aiMaturity', label: ts.fullStep1_ai, icon: <BrainCircuit size={22} />, desc: t.descriptions.aiMaturity },
  ];
  // Wizard State - Disabled as per user request
  const [isWizardActive, setIsWizardActive] = useState(false);
  // Auto-start wizard removed.
  const handleAxisUpdate = async (axis: DRDAxis, data: Partial<AxisAssessment>) => {
    const updatedAssessment = { ...fullSession.assessment };
    const current = updatedAssessment[axis] || { actual: 1, target: 1, justification: '' };
    updatedAssessment[axis] = { ...current, ...data } as AxisAssessment;
    const newSession = { ...fullSession, assessment: updatedAssessment };
    updateFullSession(newSession);
    // Auto-save
    try {
      await Api.saveSession(currentUser!.id, SessionMode.FULL, newSession, currentProjectId || undefined);
    } catch (err) {
      console.error('Failed to save assessment', err);
      toast.error('Failed to save changes. Please try again.');
    }
  };
  const handleWizardComplete = (recommendedLevel: MaturityLevel, justification: string, areaScores: Record<string, number[]>) => {
    // Wizard disabled
  };
  const handleNextAxis = (current: DRDAxis) => {
    const order: DRDAxis[] = ['processes', 'digitalProducts', 'businessModels', 'culture', 'dataManagement', 'cybersecurity', 'aiMaturity'];
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
    // Start Stream
    startStream(text, history, context);
  };
  // --- RENDER ---
  // Render 1. Specific Axis View
  if (currentAxisId) {
    const axisData = fullSession.assessment?.[currentAxisId];
    return (
      <SplitLayout title={ta.header} onSendMessage={handleAiChat}>
        <div className="flex flex-col h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/5 w-full">
          {/* Back Navigation Bar - Wizard Toggle Removed */}
          <div className="h-12 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 bg-slate-50 dark:bg-navy-950/30">
            <button
              onClick={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white flex items-center gap-1"
            >
              ← {tc.backToDashboard}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AssessmentAxisWorkspace
              axis={currentAxisId}
              data={axisData || { actual: 1, target: 1, justification: '' }}
              onChange={(d) => handleAxisUpdate(currentAxisId, d)}
              onNext={() => handleNextAxis(currentAxisId)}
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
  // Render 2. Dashboard View
  return (
    <SplitLayout title={ta.dashboardHeader} onSendMessage={handleAiChat}>
      <div className="flex flex-col h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/5 w-full">
        {/* Tabs */}
        <div className="h-16 border-b border-slate-200 dark:border-white/5 flex items-center px-8 bg-white dark:bg-navy-900 shrink-0 justify-between">
          <div className="flex items-center gap-8 h-full">
            <button
              onClick={() => setDashboardTab('summary')}
              className={`h-full px-6 border-b-2 text-base font-medium transition-colors ${dashboardTab === 'summary' ? 'border-purple-500 text-navy-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {ta.tabs.summary}
            </button>
            <button
              onClick={() => setDashboardTab('reports')}
              className={`h-full px-6 border-b-2 text-base font-medium transition-colors ${dashboardTab === 'reports' ? 'border-purple-500 text-navy-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {ta.tabs.reports || 'Reports'}
            </button>
          </div>
          <button
            onClick={handleGenerateInitiatives}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-green-900/20 transition-all"
          >
            <span>{ta.generateInitiatives}</span>
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto w-full">
          {dashboardTab === 'summary' ? (
            // Summary / Gap Map
            <>
              <div className="grid grid-cols-7 gap-1 p-4 bg-slate-50 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/5">
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
                    className="p-2 rounded bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-center border border-slate-200 dark:border-white/5 transition-all group"
                  >
                    <span className="block text-xs text-slate-500 dark:text-slate-400 group-hover:text-navy-900 dark:group-hover:text-white mb-1 truncate">{axis}</span>
                    <div className="flex justify-center gap-1">
                      <span className="w-5 h-5 rounded bg-slate-100 dark:bg-navy-900 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                        {fullSession.assessment?.[axis]?.actual || '-'}
                      </span>
                      <span className="w-5 h-5 rounded bg-slate-100 dark:bg-navy-900 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400">
                        {fullSession.assessment?.[axis]?.target || '-'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <AssessmentSummaryWorkspace
                assessment={fullSession.assessment || {}}
                onNavigate={(axis) => {
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
              />
            </>
          ) : (
            // Reports View
            <AssessmentReportsWorkspace />
          )}
        </div>
      </div>
    </SplitLayout>
  );
};
```