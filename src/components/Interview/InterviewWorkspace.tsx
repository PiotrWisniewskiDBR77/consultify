/**
 * InterviewWorkspace - v3.0 Golden Standard Redesign
 * 
 * Two-column layout matching InsightViewer:
 * - Full-width header with session title, status, actions
 * - Left column (2/3): Categories as collapsible sections
 * - Right column (1/3, sticky): Control, Export, Progress, Company Facts
 * 
 * Features:
 * - 5 Categories: Strategy, Operations, Digital, People, Finance
 * - Collapsible sections with glassmorphism styling
 * - Framer Motion animations
 * - ONLY facts - NO recommendations
 */

import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  Download,
  Edit3,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Monitor,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';

import {
  type Attachment,
  AttachmentsSection,
  type LinkedItem,
  LinkedItemsSection,
} from '../MyWork/shared';

import { InterviewCategory, CategoryProgress, CATEGORY_ORDER, CATEGORY_CONFIG } from './CategorySidebar';
import { QuestionsList, InterviewQuestion } from './QuestionsList';
import { NotesPanel, InterviewNote } from './NotesPanel';
import { EvidencePanel, InterviewEvidence } from './EvidencePanel';
import { CompanyProfile, KeyMetric, Stakeholder, OpenGap } from './CompanyFactsPanel';

// ==========================================
// TYPES
// ==========================================

interface InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: string;
  assignmentId?: string;
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

interface InterviewWorkspaceProps {
  sessionId?: string;
  projectId?: string;
  onComplete?: (sessionId: string) => void;
  onSessionChange?: (session: InterviewSession) => void;
  onClose?: () => void;
}

// ==========================================
// COMPONENT
// ==========================================

export const InterviewWorkspace: React.FC<InterviewWorkspaceProps> = ({
  sessionId: initialSessionId,
  projectId,
  onComplete,
  onSessionChange,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();
  const { setActiveConversation, setIsOpen } = useConversationStore();

  // ==========================================
  // STATE
  // ==========================================

  const [session, setSession] = useState<InterviewSession | null>(null);
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<CompanyProfile>({});

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['strategy', 'control', 'progress'])
  );

  const isLocked = (session?.status || '').toLowerCase() === 'submitted' || (session?.status || '').toLowerCase() === 'completed';

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

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

  // Overall progress
  const totalQuestions = categoryProgress.reduce((sum, p) => sum + p.totalQuestions, 0);
  const answeredQuestions = categoryProgress.reduce((sum, p) => sum + p.answeredQuestions, 0);
  const overallPercent = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const completedCategories = categoryProgress.filter(p => p.isComplete).length;

  // Status config
  const statusConfig = {
    active: { label: { en: 'In Progress', pl: 'W trakcie' }, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400' },
    submitted: { label: { en: 'Submitted', pl: 'Wysłany' }, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400' },
    completed: { label: { en: 'Completed', pl: 'Zakończony' }, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
  }[(session?.status || 'active').toLowerCase()] || { label: { en: 'Draft', pl: 'Szkic' }, color: 'bg-slate-400', textColor: 'text-slate-600' };

  // ==========================================
  // EFFECTS
  // ==========================================

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      try {
        let currentSession: InterviewSession | null = null;

        if (initialSessionId) {
          const sessionRes = await Api.get(`/interview/sessions/${initialSessionId}`);
          currentSession = sessionRes as InterviewSession;
        } else {
          const sessionsRes = await Api.get('/interview/sessions?status=active');
          const sessions = Array.isArray(sessionsRes) ? sessionsRes : [];
          
          if (sessions.length > 0) {
            currentSession = sessions[0] as InterviewSession;
          } else {
            const newSession = await Api.post('/interview/sessions', { projectId });
            currentSession = newSession as InterviewSession;
          }
        }

        if (currentSession) {
          setSession(currentSession);
          setSessionName(currentSession.name || 'Discovery Interview');
          onSessionChange?.(currentSession);

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

          if (contextRes && typeof contextRes === 'object') {
            const ctx = contextRes as Record<string, unknown>;
            const profile = (ctx.companyProfile as CompanyProfile) || {};
            setCompanyProfile(profile);
            setEditedProfile(profile);
          }

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

  // ==========================================
  // HANDLERS
  // ==========================================

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
  const handleUpdateProfile = useCallback(async () => {
    setIsSaving(true);

    try {
      await Api.put('/interview/context', { companyProfile: editedProfile });
      setCompanyProfile(editedProfile);
      setIsEditingProfile(false);
      toast.success(isPolish ? 'Profil zapisany' : 'Profile saved');
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to update profile:', error);
      toast.error(isPolish ? 'Nie udało się zapisać profilu' : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }, [editedProfile, isPolish]);

  // Save session
  const handleSave = useCallback(async () => {
    if (!session) return;
    setIsSaving(true);

    try {
      await Api.patch(`/interview/sessions/${session.id}`, { name: sessionName });
      toast.success(isPolish ? 'Zapisano' : 'Saved');
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to save:', error);
      toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [session, sessionName, isPolish]);

  // Submit session
  const handleSubmitSession = useCallback(async () => {
    if (!session) return;
    if (isLocked) return;

    try {
      if (session.assignmentId) {
        const result = await Api.post(`/interview/assignments/${session.assignmentId}/submit`, {});
        const updatedSession = (result as any)?.session;
        const completeness = (result as any)?.completenessPercent;
        if (updatedSession) setSession(updatedSession);
        toast.success(
          isPolish
            ? `Wywiad wysłany do review (${completeness ?? 0}%).`
            : `Submitted for review (${completeness ?? 0}%).`
        );
        return;
      }

      await Api.patch(`/interview/sessions/${session.id}`, { status: 'completed' });
      toast.success(isPolish ? 'Wywiad zakończony!' : 'Interview completed!');
      onComplete?.(session.id);
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to submit session:', error);
      toast.error(isPolish ? 'Nie udało się zatwierdzić' : 'Failed to submit');
    }
  }, [session, isLocked, isPolish, onComplete]);

  // Open chat
  const handleOpenChat = useCallback(() => {
    if (!session) return;
    setActiveConversation({
      id: `interview-${session.id}`,
      type: 'interview',
      title: sessionName || 'Interview Session',
      context: { sessionId: session.id },
    });
    setIsOpen(true);
  }, [session, sessionName, setActiveConversation, setIsOpen]);

  // Attachments handlers
  const handleUploadAttachment = async (files: FileList) => {
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser?.name || 'User',
    }));
    setAttachments([...attachments, ...newAttachments]);
    toast.success(isPolish ? 'Załączniki dodane' : 'Attachments added');
  };

  const handleDeleteAttachment = async (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
    toast.success(isPolish ? 'Załącznik usunięty' : 'Attachment deleted');
  };

  // Linked items handlers
  const handleAddLinkedItem = async (item: LinkedItem) => {
    setLinkedItems([...linkedItems, item]);
  };

  const handleRemoveLinkedItem = async (id: string) => {
    setLinkedItems(linkedItems.filter((i) => i.id !== id));
  };

  const searchLinkedItems = async (_query: string) => {
    return [];
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const content = `# ${sessionName}\n\n## Progress: ${overallPercent}%\n\n${summaryData.facts.map(f => `- ${f}`).join('\n')}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionName.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(isPolish ? 'Pobrano' : 'Downloaded');
  };

  const handleCopy = () => {
    const content = `${sessionName}\n\nProgress: ${overallPercent}%\n\nFacts:\n${summaryData.facts.map(f => `- ${f}`).join('\n')}`;
    navigator.clipboard.writeText(content);
    toast.success(isPolish ? 'Skopiowano' : 'Copied');
  };

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderCollapsibleSection = (
    id: string,
    icon: React.ReactNode,
    title: string,
    iconBgClass: string,
    badge?: React.ReactNode,
    headerActions?: React.ReactNode,
    children?: React.ReactNode
  ) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
    >
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBgClass}`}>{icon}</div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {badge}
          <motion.div
            animate={{ rotate: expandedSections.has(id) ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} className="text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence>
        {expandedSections.has(id) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  // Render category section with questions
  const renderCategorySection = (category: InterviewCategory) => {
    const config = CATEGORY_CONFIG[category];
    const Icon = config.icon;
    const progress = categoryProgress.find(p => p.category === category);
    const categoryQuestions = questions.filter(q => q.category === category);

    return renderCollapsibleSection(
      category,
      <Icon size={18} className={config.color} />,
      isPolish ? config.labelPl : config.labelEn,
      config.bgColor,
      <div className="flex items-center gap-2">
        {progress?.isComplete && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Check size={10} />
            {isPolish ? 'Gotowe' : 'Done'}
          </span>
        )}
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {progress?.answeredQuestions || 0}/{progress?.totalQuestions || 0}
        </span>
      </div>,
      undefined,
      <div className="p-4">
        {/* Progress bar */}
        {(progress?.totalQuestions || 0) > 0 && (
          <div className="mb-4">
            <div className="h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress?.isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${(progress?.totalQuestions || 0) > 0 ? ((progress?.answeredQuestions || 0) / (progress?.totalQuestions || 1)) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Questions list */}
        <QuestionsList
          questions={categoryQuestions}
          category={category}
          onUpdateQuestion={handleUpdateQuestion}
          onAddQuestion={handleAddQuestion}
          readOnly={isLocked}
        />
      </div>
    );
  };

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Ładowanie wywiadu...' : 'Loading interview...'}
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* ==========================================
          FULL-WIDTH HEADER
          ========================================== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-navy-700/60 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onClose && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <ChevronLeft size={20} className="text-slate-500" />
              </motion.button>
            )}

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-500/30">
                <MessageSquare size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  placeholder={isPolish ? 'Nazwa sesji...' : 'Session name...'}
                />
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className={`flex items-center gap-1 ${statusConfig.textColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
                    {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                  </span>
                  <span>•</span>
                  <span>{overallPercent}% {isPolish ? 'ukończone' : 'complete'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-slate-400 flex items-center gap-1 mr-2">
                <Loader2 size={12} className="animate-spin" />
                {isPolish ? 'Zapisywanie...' : 'Saving...'}
              </span>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60"
            >
              <Save size={16} />
              <span>{isPolish ? 'Zapisz' : 'Save'}</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenChat}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-purple-500/40 dark:border-purple-400/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 dark:hover:bg-purple-500/10 text-sm font-semibold transition-all shadow-sm"
            >
              <MessageSquare size={16} />
              <span>{isPolish ? 'Czat' : 'Chat'}</span>
            </motion.button>
          </div>
        </div>

        {isLocked && (
          <div className="max-w-7xl mx-auto mt-3">
            <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
              {(session?.status || '').toLowerCase() === 'submitted'
                ? (isPolish
                    ? 'Wywiad jest wysłany i zablokowany do edycji.'
                    : 'Interview is submitted and locked.')
                : (isPolish
                    ? 'Wywiad jest ukończony i zablokowany do edycji.'
                    : 'Interview is completed and locked.')}
            </div>
          </div>
        )}
      </motion.div>

      {/* ==========================================
          TWO-COLUMN GRID
          ========================================== */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ==========================================
              LEFT COLUMN - 2/3 width
              ========================================== */}
          <div className="lg:col-span-2 space-y-5 order-2 lg:order-1">
            {/* Category Sections */}
            {CATEGORY_ORDER.map((category) => (
              <React.Fragment key={category}>
                {renderCategorySection(category)}
              </React.Fragment>
            ))}

            {/* Notes Section */}
            {renderCollapsibleSection(
              'notes',
              <FileText size={18} className="text-amber-500 dark:text-amber-400" />,
              isPolish ? 'Notatki' : 'Notes',
              'bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {notes.length}
              </span>,
              undefined,
              <div className="p-4">
                <NotesPanel
                  notes={notes}
                  activeCategory="strategy"
                  onCreateNote={handleCreateNote}
                  onUpdateNote={handleUpdateNote}
                  onDeleteNote={handleDeleteNote}
                  readOnly={isLocked}
                />
              </div>
            )}

            {/* Evidence Section */}
            {renderCollapsibleSection(
              'evidence',
              <Paperclip size={18} className="text-violet-500 dark:text-violet-400" />,
              isPolish ? 'Dowody' : 'Evidence',
              'bg-gradient-to-br from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {evidence.length}
              </span>,
              undefined,
              <div className="p-4">
                <EvidencePanel
                  evidence={evidence}
                  activeCategory="strategy"
                  onUploadFile={handleUploadFile}
                  onAddLink={handleAddLink}
                  onDeleteEvidence={handleDeleteEvidence}
                  readOnly={isLocked}
                />
              </div>
            )}

            {/* Summary Section */}
            {renderCollapsibleSection(
              'summary',
              <Sparkles size={18} className="text-purple-500 dark:text-purple-400" />,
              isPolish ? 'Podsumowanie' : 'Summary',
              'bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20',
              undefined,
              undefined,
              <div className="p-5 space-y-6">
                <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                  ⚠️ {isPolish 
                    ? 'Tylko fakty - bez rekomendacji i planów działań'
                    : 'Facts only - no recommendations or action plans'
                  }
                </p>

                {/* Facts */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
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
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
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
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {isPolish ? 'Ryzyka i ograniczenia' : 'Risks & Constraints'}
                  </h4>
                  {summaryData.constraints.length > 0 ? (
                    <ul className="space-y-2">
                      {summaryData.constraints.map((constraint, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
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
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
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
            )}
          </div>

          {/* ==========================================
              RIGHT COLUMN - 1/3 width (sticky)
              ========================================== */}
          <div className="space-y-4 lg:sticky lg:top-24 self-start order-1 lg:order-2">
            {/* 1. Control Panel */}
            {renderCollapsibleSection(
              'control',
              <BarChart3 size={18} className="text-purple-500 dark:text-purple-400" />,
              isPolish ? 'Sterowanie' : 'Control',
              'bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20',
              session?.id && (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                  #{session.id.slice(0, 8)}
                </span>
              ),
              undefined,
              <div className="p-4 space-y-4">
                {/* Status */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    Status
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                    </span>
                  </div>
                </div>

                {/* Started */}
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    {isPolish ? 'Rozpoczęto' : 'Started'}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {session?.startedAt
                        ? new Date(session.startedAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')
                        : '-'}
                    </span>
                  </div>
                </div>

                {/* Last Activity */}
                {session?.lastActivityAt && (
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      {isPolish ? 'Ostatnia aktywność' : 'Last Activity'}
                    </label>
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                      <Clock size={14} className="text-slate-400" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {new Date(session.lastActivityAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Export & Actions */}
            {renderCollapsibleSection(
              'export',
              <Send size={18} className="text-emerald-500 dark:text-emerald-400" />,
              isPolish ? 'Eksport i Akcje' : 'Export & Actions',
              'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20',
              undefined,
              undefined,
              <div className="p-4 space-y-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleSubmitSession}
                  disabled={isLocked}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={16} />
                  <span className="text-sm font-medium">
                    {isPolish ? 'Zatwierdź wywiad' : 'Submit Interview'}
                  </span>
                  <ArrowRight size={14} className="ml-auto" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleExportMarkdown}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-all"
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">
                    {isPolish ? 'Pobierz Markdown' : 'Download Markdown'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleCopy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-all"
                >
                  <Copy size={16} />
                  <span className="text-sm font-medium">
                    {isPolish ? 'Kopiuj do schowka' : 'Copy to Clipboard'}
                  </span>
                </motion.button>
              </div>
            )}

            {/* 3. Attachments */}
            <AttachmentsSection
              attachments={attachments}
              onUpload={handleUploadAttachment}
              onDelete={handleDeleteAttachment}
              expanded={expandedSections.has('attachments')}
              onToggleExpand={() => toggleSection('attachments')}
            />

            {/* 4. Progress Overview */}
            {renderCollapsibleSection(
              'progress',
              <Target size={18} className="text-blue-500 dark:text-blue-400" />,
              isPolish ? 'Postęp' : 'Progress',
              'bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20',
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {overallPercent}%
              </span>,
              undefined,
              <div className="p-4 space-y-4">
                {/* Overall Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">{isPolish ? 'Ogólnie' : 'Overall'}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {answeredQuestions}/{totalQuestions}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${overallPercent}%` }}
                    />
                  </div>
                </div>

                {/* Categories Progress */}
                <div className="space-y-3">
                  {categoryProgress.map((cp) => {
                    const config = CATEGORY_CONFIG[cp.category];
                    const percent = cp.totalQuestions > 0 ? Math.round((cp.answeredQuestions / cp.totalQuestions) * 100) : 0;
                    return (
                      <div key={cp.category} className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                          <config.icon size={12} className={config.color} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-slate-600 dark:text-slate-400">
                              {isPolish ? config.labelPl : config.labelEn}
                            </span>
                            <span className="text-slate-500">{percent}%</span>
                          </div>
                          <div className="h-1 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${cp.isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Company Facts */}
            {renderCollapsibleSection(
              'companyFacts',
              <Building2 size={18} className="text-indigo-500 dark:text-indigo-400" />,
              isPolish ? 'Fakty o firmie' : 'Company Facts',
              'bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20',
              undefined,
              !isLocked && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingProfile(!isEditingProfile);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                >
                  <Edit3 size={14} className="text-slate-400" />
                </motion.button>
              ),
              <div className="p-4 space-y-3">
                {isEditingProfile ? (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        {isPolish ? 'Nazwa' : 'Name'}
                      </label>
                      <input
                        type="text"
                        value={editedProfile.name || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        {isPolish ? 'Branża' : 'Industry'}
                      </label>
                      <input
                        type="text"
                        value={editedProfile.industry || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, industry: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">
                        {isPolish ? 'Lokalizacja' : 'Location'}
                      </label>
                      <input
                        type="text"
                        value={editedProfile.location || ''}
                        onChange={(e) => setEditedProfile({ ...editedProfile, location: e.target.value })}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleUpdateProfile}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isPolish ? 'Zapisz' : 'Save'}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setEditedProfile(companyProfile);
                          setIsEditingProfile(false);
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
                      >
                        <X size={14} />
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <>
                    {companyProfile.name || companyProfile.industry || companyProfile.location ? (
                      <div className="space-y-2">
                        {companyProfile.name && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">{companyProfile.name}</span>
                          </div>
                        )}
                        {companyProfile.industry && (
                          <div className="flex items-center gap-2 text-sm">
                            <Target size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">{companyProfile.industry}</span>
                          </div>
                        )}
                        {companyProfile.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">{companyProfile.location}</span>
                          </div>
                        )}
                        {companyProfile.size && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">{companyProfile.size} {isPolish ? 'pracowników' : 'employees'}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        {isPolish ? 'Kliknij edytuj aby dodać dane firmy' : 'Click edit to add company data'}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 6. Stakeholders */}
            {renderCollapsibleSection(
              'stakeholders',
              <Users size={18} className="text-cyan-500 dark:text-cyan-400" />,
              isPolish ? 'Interesariusze' : 'Stakeholders',
              'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20',
              stakeholders.length > 0 && (
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {stakeholders.length}
                </span>
              ),
              undefined,
              <div className="p-4">
                {stakeholders.length > 0 ? (
                  <div className="space-y-2">
                    {stakeholders.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-navy-800">
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <Users size={14} className="text-cyan-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{s.name}</p>
                          <p className="text-xs text-slate-500 truncate">{s.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-2">
                    {isPolish ? 'Brak interesariuszy' : 'No stakeholders'}
                  </p>
                )}
              </div>
            )}

            {/* 7. Open Gaps */}
            {renderCollapsibleSection(
              'gaps',
              <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400" />,
              isPolish ? 'Luki informacyjne' : 'Open Gaps',
              'bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
              openGaps.length > 0 && (
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {openGaps.length}
                </span>
              ),
              undefined,
              <div className="p-4">
                {openGaps.length > 0 ? (
                  <div className="space-y-2">
                    {openGaps.map((gap) => (
                      <div
                        key={gap.id}
                        className={`p-3 rounded-xl border-l-4 ${
                          gap.priority === 'high'
                            ? 'border-l-red-500 bg-red-500/5 dark:bg-red-500/10'
                            : gap.priority === 'medium'
                              ? 'border-l-amber-500 bg-amber-500/5 dark:bg-amber-500/10'
                              : 'border-l-slate-400 bg-slate-50 dark:bg-navy-800'
                        }`}
                      >
                        <p className="text-sm text-slate-700 dark:text-slate-300">{gap.description}</p>
                        <span className="text-xs text-slate-500 mt-1 block">{gap.category}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic text-center py-2">
                    {isPolish ? 'Brak zidentyfikowanych luk' : 'No gaps identified'}
                  </p>
                )}
              </div>
            )}

            {/* 8. Linked Items */}
            <LinkedItemsSection
              items={linkedItems}
              onAdd={handleAddLinkedItem}
              onRemove={handleRemoveLinkedItem}
              searchItems={searchLinkedItems}
              allowedTypes={['task', 'initiative', 'decision', 'risk', 'project', 'external']}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewWorkspace;
