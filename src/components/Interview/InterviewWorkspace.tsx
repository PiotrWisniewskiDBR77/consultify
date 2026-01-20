/**
 * InterviewWorkspace - v2.0 ClickUp-like Redesign
 * 
 * Main workspace for Interview module with:
 * - 5 Categories: Strategy, Operations, Digital, People, Finance
 * - 4 Tabs: Questions, Notes, Evidence, Summary
 * - Task-list style questions with inline edit, status, confidence
 * - Company Facts panel (right sidebar)
 * - ONLY facts - NO recommendations
 * 
 * @see PROMPT 8 in wdrozenia/PROMPTY_DLA_AGENTOW.md
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Sparkles,
} from 'lucide-react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { CategorySidebar, InterviewCategory, CategoryProgress, CATEGORY_ORDER, CATEGORY_CONFIG } from './CategorySidebar';
import { QuestionsList, InterviewQuestion } from './QuestionsList';
import { NotesPanel, InterviewNote } from './NotesPanel';
import { EvidencePanel, InterviewEvidence } from './EvidencePanel';
import { CompanyFactsPanel, CompanyProfile, KeyMetric, Stakeholder, OpenGap } from './CompanyFactsPanel';

// Types
interface InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: string;
  progress: Record<string, unknown>;
  totalQuestions: number;
  answeredQuestions: number;
  summaryFacts: string[];
  summaryGaps: string[];
  summaryConstraints: string[];
  summaryPainPoints: string[];
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
}

interface SummaryData {
  facts: string[];
  gaps: string[];
  constraints: string[];
  painPoints: string[];
}

type TabType = 'questions' | 'notes' | 'evidence' | 'summary';

interface InterviewWorkspaceProps {
  sessionId?: string;
  projectId?: string;
  onComplete?: (sessionId: string) => void;
  onSessionChange?: (session: InterviewSession) => void;
}

export const InterviewWorkspace: React.FC<InterviewWorkspaceProps> = ({
  sessionId: initialSessionId,
  projectId,
  onComplete,
  onSessionChange,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();

  // State
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [activeCategory, setActiveCategory] = useState<InterviewCategory>('strategy');
  const [activeTab, setActiveTab] = useState<TabType>('questions');
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [evidence, setEvidence] = useState<InterviewEvidence[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({});
  const [keyMetrics, setKeyMetrics] = useState<KeyMetric[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [openGaps, setOpenGaps] = useState<OpenGap[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    facts: [],
    gaps: [],
    constraints: [],
    painPoints: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Calculate progress per category
  const categoryProgress: CategoryProgress[] = CATEGORY_ORDER.map((category) => {
    const categoryQuestions = questions.filter((q) => q.category === category);
    const answeredCount = categoryQuestions.filter((q) => q.status === 'answered').length;
    return {
      category,
      totalQuestions: categoryQuestions.length,
      answeredQuestions: answeredCount,
      isComplete: categoryQuestions.length > 0 && answeredCount === categoryQuestions.length,
    };
  });

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      try {
        let currentSession: InterviewSession | null = null;

        if (initialSessionId) {
          // Load specific session
          const sessionRes = await Api.get(`/interview/sessions/${initialSessionId}`);
          currentSession = sessionRes as InterviewSession;
        } else {
          // Check for active session or create new
          const sessionsRes = await Api.get('/interview/sessions?status=active');
          const sessions = Array.isArray(sessionsRes) ? sessionsRes : [];
          
          if (sessions.length > 0) {
            currentSession = sessions[0] as InterviewSession;
          } else {
            // Create new session
            const newSession = await Api.post('/interview/sessions', { projectId });
            currentSession = newSession as InterviewSession;
          }
        }

        if (currentSession) {
          setSession(currentSession);
          onSessionChange?.(currentSession);

          // Load related data in parallel
          const [questionsRes, notesRes, evidenceRes, contextRes, summaryRes] = await Promise.all([
            Api.get(`/interview/sessions/${currentSession.id}/questions`),
            Api.get(`/interview/sessions/${currentSession.id}/notes`),
            Api.get(`/interview/sessions/${currentSession.id}/evidence`),
            Api.get('/interview/context'),
            Api.get(`/interview/sessions/${currentSession.id}/summary`).catch(() => null),
          ]);

          setQuestions(Array.isArray(questionsRes) ? questionsRes : []);
          setNotes(Array.isArray(notesRes) ? notesRes : []);
          setEvidence(Array.isArray(evidenceRes) ? evidenceRes : []);

          // Set company profile from context
          if (contextRes && typeof contextRes === 'object') {
            const ctx = contextRes as Record<string, unknown>;
            setCompanyProfile((ctx.companyProfile as CompanyProfile) || {});
          }

          // Set summary data
          if (summaryRes && typeof summaryRes === 'object') {
            const summary = summaryRes as SummaryData;
            setSummaryData({
              facts: summary.facts || currentSession.summaryFacts || [],
              gaps: summary.gaps || currentSession.summaryGaps || [],
              constraints: summary.constraints || currentSession.summaryConstraints || [],
              painPoints: summary.painPoints || currentSession.summaryPainPoints || [],
            });
          }
        }
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to load session:', error);
        toast.error(isPolish ? 'Nie udało się załadować sesji' : 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [initialSessionId, projectId, isPolish, onSessionChange]);

  // Update question
  const handleUpdateQuestion = useCallback(async (questionId: string, updates: Partial<InterviewQuestion>) => {
    if (!session) return;
    setIsSaving(true);

    try {
      const updated = await Api.patch(`/interview/questions/${questionId}`, updates);
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, ...updated } : q))
      );
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to update question:', error);
      toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [session, isPolish]);

  // Add question
  const handleAddQuestion = useCallback(async (category: InterviewCategory, questionText: string) => {
    if (!session) return;
    setIsSaving(true);

    try {
      const created = await Api.post(`/interview/sessions/${session.id}/questions`, {
        category,
        questionText,
      });
      setQuestions((prev) => [...prev, created as InterviewQuestion]);
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to add question:', error);
      toast.error(isPolish ? 'Nie udało się dodać pytania' : 'Failed to add question');
    } finally {
      setIsSaving(false);
    }
  }, [session, isPolish]);

  // Create note
  const handleCreateNote = useCallback(async (title: string, content: string, category?: InterviewCategory) => {
    if (!session) return;
    setIsSaving(true);

    try {
      const created = await Api.post(`/interview/sessions/${session.id}/notes`, {
        title,
        content,
        category,
      });
      setNotes((prev) => [...prev, created as InterviewNote]);
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to create note:', error);
      toast.error(isPolish ? 'Nie udało się utworzyć notatki' : 'Failed to create note');
    } finally {
      setIsSaving(false);
    }
  }, [session, isPolish]);

  // Update note
  const handleUpdateNote = useCallback(async (noteId: string, updates: Partial<InterviewNote>) => {
    if (!session) return;
    setIsSaving(true);

    try {
      const updated = await Api.patch(`/interview/notes/${noteId}`, updates);
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, ...updated } : n))
      );
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to update note:', error);
      toast.error(isPolish ? 'Nie udało się zapisać notatki' : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }, [session, isPolish]);

  // Delete note
  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!session) return;

    try {
      await Api.delete(`/interview/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to delete note:', error);
      toast.error(isPolish ? 'Nie udało się usunąć notatki' : 'Failed to delete note');
    }
  }, [session, isPolish]);

  // Upload file
  const handleUploadFile = useCallback(async (file: File, category?: InterviewCategory) => {
    if (!session) return;
    setIsSaving(true);

    try {
      // For now, we'll create a placeholder - actual file upload would need FormData
      const created = await Api.post(`/interview/sessions/${session.id}/evidence`, {
        evidenceType: 'file',
        name: file.name,
        fileSize: file.size,
        mimeType: file.type,
        category,
      });
      setEvidence((prev) => [...prev, created as InterviewEvidence]);
      toast.success(isPolish ? 'Plik dodany' : 'File added');
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to upload file:', error);
      toast.error(isPolish ? 'Nie udało się dodać pliku' : 'Failed to upload file');
    } finally {
      setIsSaving(false);
    }
  }, [session, isPolish]);

  // Add link
  const handleAddLink = useCallback(async (name: string, url: string, description?: string, category?: InterviewCategory) => {
    if (!session) return;
    setIsSaving(true);

    try {
      const created = await Api.post(`/interview/sessions/${session.id}/evidence`, {
        evidenceType: 'link',
        name,
        url,
        description,
        category,
      });
      setEvidence((prev) => [...prev, created as InterviewEvidence]);
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to add link:', error);
      toast.error(isPolish ? 'Nie udało się dodać linku' : 'Failed to add link');
    } finally {
      setIsSaving(false);
    }
  }, [session, isPolish]);

  // Delete evidence
  const handleDeleteEvidence = useCallback(async (evidenceId: string) => {
    if (!session) return;

    try {
      await Api.delete(`/interview/evidence/${evidenceId}`);
      setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to delete evidence:', error);
      toast.error(isPolish ? 'Nie udało się usunąć' : 'Failed to delete');
    }
  }, [session, isPolish]);

  // Update company profile
  const handleUpdateProfile = useCallback(async (profile: CompanyProfile) => {
    setIsSaving(true);

    try {
      await Api.put('/interview/context', { companyProfile: profile });
      setCompanyProfile(profile);
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to update profile:', error);
      toast.error(isPolish ? 'Nie udało się zapisać profilu' : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }, [isPolish]);

  // Complete session
  const handleCompleteSession = useCallback(async () => {
    if (!session) return;

    try {
      await Api.patch(`/interview/sessions/${session.id}`, { status: 'completed' });
      toast.success(isPolish ? 'Wywiad zakończony!' : 'Interview completed!');
      onComplete?.(session.id);
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to complete session:', error);
      toast.error(isPolish ? 'Nie udało się zakończyć wywiadu' : 'Failed to complete interview');
    }
  }, [session, isPolish, onComplete]);

  // Render loading
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Ładowanie wywiadu...' : 'Loading interview...'}
          </p>
        </div>
      </div>
    );
  }

  // Tab config
  const tabs: { id: TabType; labelEn: string; labelPl: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'questions',
      labelEn: 'Questions',
      labelPl: 'Pytania',
      icon: <MessageSquare size={16} />,
      count: questions.filter((q) => q.category === activeCategory).length,
    },
    {
      id: 'notes',
      labelEn: 'Notes',
      labelPl: 'Notatki',
      icon: <FileText size={16} />,
      count: notes.length,
    },
    {
      id: 'evidence',
      labelEn: 'Evidence',
      labelPl: 'Dowody',
      icon: <Paperclip size={16} />,
      count: evidence.length,
    },
    {
      id: 'summary',
      labelEn: 'Summary',
      labelPl: 'Podsumowanie',
      icon: <ClipboardList size={16} />,
    },
  ];

  const categoryConfig = CATEGORY_CONFIG[activeCategory];

  return (
    <div className="h-full flex bg-slate-50 dark:bg-navy-950">
      {/* Left Sidebar - Categories */}
      <CategorySidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        progress={categoryProgress}
        sessionName={session?.name}
        sessionStatus={session?.status}
        lastUpdated={session?.lastActivityAt}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${categoryConfig.bgColor} flex items-center justify-center`}>
                  <categoryConfig.icon size={20} className={categoryConfig.color} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                    {isPolish ? categoryConfig.labelPl : categoryConfig.labelEn}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? categoryConfig.descriptionPl : categoryConfig.descriptionEn}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isSaving && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    {isPolish ? 'Zapisywanie...' : 'Saving...'}
                  </span>
                )}
                <button
                  onClick={handleCompleteSession}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Check size={16} />
                  {isPolish ? 'Zakończ wywiad' : 'Complete Interview'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mt-4 bg-slate-100 dark:bg-navy-800/40 rounded-lg p-1 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {isPolish ? tab.labelPl : tab.labelEn}
                  {tab.count !== undefined && (
                    <span className="px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded-full">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'questions' && (
            <QuestionsList
              questions={questions}
              category={activeCategory}
              onUpdateQuestion={handleUpdateQuestion}
              onAddQuestion={handleAddQuestion}
            />
          )}

          {activeTab === 'notes' && (
            <NotesPanel
              notes={notes}
              activeCategory={activeCategory}
              onCreateNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
            />
          )}

          {activeTab === 'evidence' && (
            <EvidencePanel
              evidence={evidence}
              activeCategory={activeCategory}
              onUploadFile={handleUploadFile}
              onAddLink={handleAddLink}
              onDeleteEvidence={handleDeleteEvidence}
            />
          )}

          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="text-purple-500" size={20} />
                  <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                    {isPolish ? 'Podsumowanie wywiadu' : 'Interview Summary'}
                  </h3>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg mb-4">
                  ⚠️ {isPolish 
                    ? 'Tylko fakty - bez rekomendacji i planów działań'
                    : 'Facts only - no recommendations or action plans'
                  }
                </p>

                {/* Facts */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                    {isPolish ? 'Najważniejsze fakty (as-is)' : 'Key Facts (as-is)'}
                  </h4>
                  {summaryData.facts.length > 0 ? (
                    <ul className="space-y-2">
                      {summaryData.facts.map((fact, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          {fact}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      {isPolish ? 'Fakty zostaną wygenerowane automatycznie' : 'Facts will be generated automatically'}
                    </p>
                  )}
                </div>

                {/* Gaps */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                    {isPolish ? 'Główne luki informacyjne' : 'Information Gaps'}
                  </h4>
                  {summaryData.gaps.length > 0 ? (
                    <ul className="space-y-2">
                      {summaryData.gaps.map((gap, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <ChevronRight size={14} className="text-amber-500 mt-0.5 shrink-0" />
                          {gap}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      {isPolish ? 'Brak zidentyfikowanych luk' : 'No gaps identified'}
                    </p>
                  )}
                </div>

                {/* Constraints */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                    {isPolish ? 'Ryzyka i ograniczenia' : 'Risks & Constraints'}
                  </h4>
                  {summaryData.constraints.length > 0 ? (
                    <ul className="space-y-2">
                      {summaryData.constraints.map((constraint, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <ChevronRight size={14} className="text-red-500 mt-0.5 shrink-0" />
                          {constraint}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      {isPolish ? 'Brak zidentyfikowanych ograniczeń' : 'No constraints identified'}
                    </p>
                  )}
                </div>

                {/* Pain Points */}
                <div>
                  <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                    {isPolish ? 'Aktualne problemy (pain points)' : 'Current Pain Points'}
                  </h4>
                  {summaryData.painPoints.length > 0 ? (
                    <ul className="space-y-2">
                      {summaryData.painPoints.map((pain, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <ChevronRight size={14} className="text-purple-500 mt-0.5 shrink-0" />
                          {pain}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">
                      {isPolish ? 'Brak zidentyfikowanych problemów' : 'No pain points identified'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Company Facts */}
      <CompanyFactsPanel
        companyProfile={companyProfile}
        keyMetrics={keyMetrics}
        stakeholders={stakeholders}
        openGaps={openGaps}
        onUpdateProfile={handleUpdateProfile}
      />
    </div>
  );
};

export default InterviewWorkspace;
