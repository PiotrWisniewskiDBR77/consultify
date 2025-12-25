
import React, { useEffect, useState } from 'react';
import { SplitLayout } from '../components/SplitLayout';
import { AppView, DRDAxis, AxisAssessment, SessionMode, MaturityLevel, FullSession, AssessmentTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { Api } from '../services/api';
import { AIMessageHistory } from '../services/ai/gemini';
import { useAIStream } from '../hooks/useAIStream';
import { AssessmentAxisWorkspace } from '../components/assessment/AssessmentAxisWorkspace';
import { AssessmentWizard } from '../components/assessment/AssessmentWizard';
import { AssessmentSummaryWorkspace } from '../components/assessment/AssessmentSummaryWorkspace';
import { AssessmentReportsWorkspace } from '../components/assessment/AssessmentReportsWorkspace';
import { AIAssessmentSidebar } from '../components/assessment/AIAssessmentSidebar';
import { AssessmentModuleLayout } from '../components/assessment/AssessmentModuleLayout';
import { AssessmentDashboard } from '../components/assessment/AssessmentDashboard';
import { MyAssessmentsList } from '../components/assessment/MyAssessmentsList';
import { ReviewerDashboard } from '../components/assessment/ReviewerDashboard';
import { GapAnalysisDashboard } from '../components/assessment/GapAnalysisDashboard';
import { useTranslation } from 'react-i18next';
import { Settings, Smartphone, Briefcase, Database, Users, Lock, BrainCircuit, ArrowRight, Brain } from 'lucide-react';
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
    setIsBotTyping,
    currentReportId,
    currentReportMode
  } = useAppStore();
  const { startStream } = useAIStream();
  const [dashboardTab, setDashboardTab] = useState<'summary' | 'reports'>('reports');
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [activeModuleTab, setActiveModuleTab] = useState<AssessmentTab>('dashboard');
  // Load Session Data
  useEffect(() => {
    const loadSession = async () => {
      if (!currentUser) return;
      // Ensure we have a session. If not, create or fetch.
      const data = await Api.getSession(currentUser.id, SessionMode.FULL, currentProjectId || undefined);
      if (data && 'assessment' in data) {
        // Migration safety: Ensure assessment object exists
        const fullSession = data as FullSession;
        if (!fullSession.assessment) fullSession.assessment = { completedAxes: [] };
        if (!fullSession.audits) fullSession.audits = [];
        updateFullSession(fullSession);
      }
    };
    loadSession();
  }, [currentUser, currentProjectId, updateFullSession]);

  // Load Report Snapshot when viewing historical report
  useEffect(() => {
    const loadReportSnapshot = async () => {
      if (!currentReportId || currentReportMode !== 'view') return;

      try {
        const report = await Api.getAssessmentReport(currentReportId);
        if (report && report.assessment_snapshot) {
          // Apply the snapshot to the session view (read-only)
          const snapshotSession: FullSession = {
            ...fullSession,
            assessment: {
              ...report.assessment_snapshot,
              completedAxes: Object.keys(report.assessment_snapshot).filter(k => k !== 'completedAxes')
            }
          };
          updateFullSession(snapshotSession);
          toast.success('Loaded historical report');
        }
      } catch (err) {
        console.error('Failed to load report snapshot:', err);
        toast.error('Failed to load report data');
      }
    };
    loadReportSnapshot();
  }, [currentReportId, currentReportMode]);

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
        <div className="flex h-full">
          <div className="flex flex-col flex-1 bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/5">
            {/* Back Navigation Bar with AI Toggle */}
            <div className="h-12 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 bg-slate-50 dark:bg-navy-950/30">
              <button
                onClick={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white flex items-center gap-1"
              >
                ← {tc.backToDashboard}
              </button>
              <button
                onClick={() => setIsAISidebarOpen(!isAISidebarOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isAISidebarOpen
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                  }`}
              >
                <Brain size={16} />
                AI Assistant
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AssessmentAxisWorkspace
                axis={currentAxisId}
                data={axisData || { actual: 1, target: 1, justification: '' }}
                onChange={(d) => handleAxisUpdate(currentAxisId, d)}
                onNext={() => handleNextAxis(currentAxisId)}
                readOnly={currentReportMode === 'view'}
                projectId={currentProjectId || ''}
                context={{
                  goals: fullSession.contextSufficiency?.gaps ? [] : ['Growth', 'Efficiency'],
                  challenges: [],
                  industry: currentUser?.companyName || 'Unknown'
                }}
              />
            </div>
          </div>

          {/* AI Assessment Sidebar */}
          {currentProjectId && (
            <AIAssessmentSidebar
              projectId={currentProjectId}
              currentAxis={currentAxisId}
              currentScore={axisData?.actual}
              targetScore={axisData?.target}
              isOpen={isAISidebarOpen}
              onClose={() => setIsAISidebarOpen(false)}
              onApplySuggestion={(suggestion) => {
                handleAxisUpdate(currentAxisId, {
                  justification: (axisData?.justification || '') + (axisData?.justification ? '\n\n' : '') + suggestion
                });
              }}
              onNavigateToAxis={(axisId) => {
                const viewMap: Record<DRDAxis, AppView> = {
                  processes: AppView.FULL_STEP1_PROCESSES,
                  digitalProducts: AppView.FULL_STEP1_DIGITAL,
                  businessModels: AppView.FULL_STEP1_MODELS,
                  dataManagement: AppView.FULL_STEP1_DATA,
                  culture: AppView.FULL_STEP1_CULTURE,
                  cybersecurity: AppView.FULL_STEP1_CYBERSECURITY,
                  aiMaturity: AppView.FULL_STEP1_AI
                };
                if (viewMap[axisId as DRDAxis]) {
                  onNavigate(viewMap[axisId as DRDAxis]);
                }
              }}
            />
          )}
        </div>
      </SplitLayout>
    );
  }
  // Helper: Render content based on active tab
  const renderTabContent = () => {
    switch (activeModuleTab) {
      case 'dashboard':
        return (
          <AssessmentDashboard
            onNavigate={onNavigate}
            onNewAssessment={() => {
              setActiveModuleTab('assessments');
              // Could also start new assessment wizard here
            }}
          />
        );
      
      case 'assessments':
        return (
          <MyAssessmentsList
            onViewAssessment={(assessmentId, projectId) => {
              // Navigate to view assessment
              onNavigate(AppView.FULL_STEP1_ASSESSMENT);
            }}
            onEditAssessment={(assessmentId, projectId) => {
              // Navigate to edit assessment
              onNavigate(AppView.FULL_STEP1_ASSESSMENT);
            }}
            onCreateNew={() => {
              // Start new assessment - go to summary tab
              setDashboardTab('summary');
              setActiveModuleTab('gap-map');
            }}
          />
        );
      
      case 'reviews':
        return (
          <ReviewerDashboard
            onNavigateToReview={(assessmentId, reviewId) => {
              // Navigate to review the assessment
              onNavigate(AppView.FULL_STEP1_ASSESSMENT);
            }}
          />
        );
      
      case 'gap-map':
        return (
          <>
            {/* Report Context Header */}
            <div className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                  <Settings size={16} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-navy-900 dark:text-white">
                    {currentReportMode === 'new'
                      ? translate('assessment.workspace.newAssessment', 'New Assessment')
                      : translate('assessment.workspace.viewingReport', 'Viewing Report')}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentReportMode === 'new'
                      ? translate('assessment.workspace.newAssessmentDesc', 'Fill in the 7 DRD axes to create your assessment report')
                      : translate('assessment.workspace.viewingReportDesc', 'Read-only view of historical assessment')}
                  </p>
                </div>
              </div>
              {currentReportMode === 'new' && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded">
                    Draft
                  </span>
                  <button
                    onClick={async () => {
                      if (!currentReportId || !currentProjectId) return;
                      try {
                        await Api.generateAssessmentReport(currentProjectId);
                        toast.success(translate('assessment.reports.saved', 'Report saved'));
                      } catch (err) {
                        toast.error(translate('assessment.reports.saveFailed', 'Failed to save'));
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {translate('assessment.reports.saveDraft', 'Save Draft')}
                  </button>
                  <button
                    onClick={async () => {
                      if (!currentReportId || !currentProjectId) return;
                      if (!confirm(translate('assessment.reports.finalizeConfirm', 'Finalize this report? This will lock it from further edits.'))) return;
                      try {
                        await Api.generateAssessmentReport(currentProjectId);
                        toast.success(translate('assessment.reports.finalized', 'Report finalized'));
                        setActiveModuleTab('reports');
                      } catch (err) {
                        toast.error(translate('assessment.reports.finalizeFailed', 'Failed to finalize'));
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    {translate('assessment.reports.finalize', 'Finalize Report')}
                  </button>
                </div>
              )}
            </div>
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
        );
      
      case 'reports':
        return (
          <AssessmentReportsWorkspace
            onStartNewAssessment={() => setActiveModuleTab('gap-map')}
            onGenerateInitiatives={(reportId) => {
              // Navigate to initiatives with report context
              onNavigate(AppView.INITIATIVE_GENERATOR);
            }}
          />
        );
      
      default:
        return null;
    }
  };

  // Render 2. Dashboard View with Module Layout
  return (
    <SplitLayout title={ta.dashboardHeader} onSendMessage={handleAiChat}>
      <AssessmentModuleLayout
        activeTab={activeModuleTab}
        onTabChange={setActiveModuleTab}
        showGenerateButton={activeModuleTab === 'gap-map'}
        onGenerateClick={handleGenerateInitiatives}
      >
        <div className="h-full overflow-y-auto">
          {renderTabContent()}
        </div>
      </AssessmentModuleLayout>
    </SplitLayout>
  );
};