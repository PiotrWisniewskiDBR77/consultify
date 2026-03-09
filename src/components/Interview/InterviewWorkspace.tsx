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
  CircleAlert,
  Clock,
  Copy,
  Download,
  Edit3,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Save,
  Send,
  Shield,
  Sparkles,
  Target,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Callout } from '@/components/shared/NModeBlocks';
import {
  type NModeAction,
  type NModePropertyField,
  type NModeSection,
  NModeSectionWrapper,
  NModeShell,
} from '@/components/shared/NModeLayout';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { buildArtifactCode } from '@/utils/artifactLinks';

import { type LinkedItem, LinkedItemsSection } from '../MyWork/shared';
import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  CategoryProgress,
  InterviewCategory,
} from './CategorySidebar';
import { CompanyProfile, KeyMetric, OpenGap, Stakeholder } from './CompanyFactsPanel';
import { EvidencePanel, InterviewEvidence } from './EvidencePanel';
import { InterviewSingleQuestionRuntime } from './InterviewSingleQuestionRuntime';
import { InterviewNote, NotesPanel } from './NotesPanel';
import { InterviewQuestion, QuestionsList } from './QuestionsList';
import { RuntimeMode, RuntimeModeSelector } from './RuntimeModeSelector';

type PersistedLinkedItem = LinkedItem & { edgeId?: string };

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
  runtimeModeDefault?: RuntimeMode;
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
  const { setActiveConversation } = useConversationStore();

  // ==========================================
  // STATE
  // ==========================================

  const [session, setSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [evidence, setEvidence] = useState<InterviewEvidence[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>({});
  const [stakeholders] = useState<Stakeholder[]>([]);
  const [openGaps] = useState<OpenGap[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    facts: [],
    gaps: [],
    constraints: [],
    painPoints: [],
  });
  const [linkedItems, setLinkedItems] = useState<PersistedLinkedItem[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);
  const [assignmentInfo, setAssignmentInfo] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<CompanyProfile>({});

  // Expanded sections state - wszystkie sekcje domyślnie zamknięte dla czytelności
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

  // Locking rules:
  // - For assignments: lock on assignment status (submitted/approved/completed)
  // - For ad-hoc sessions: lock on session completion
  const isLocked = useMemo(() => {
    const sessionStatus = (session?.status || '').toLowerCase();
    const asgStatus = (assignmentStatus || '').toLowerCase();
    const assignmentLocked =
      Boolean(session?.assignmentId) && ['submitted', 'approved', 'completed'].includes(asgStatus);
    return assignmentLocked || sessionStatus === 'completed';
  }, [assignmentStatus, session?.assignmentId, session?.status]);

  const isAssignmentMode = Boolean(session?.assignmentId);

  // V6-C04: Reviewer mode — activates when the session is submitted and the
  // current user is NOT the assignee (i.e. they are the reviewer/manager).
  const isReviewerMode = useMemo(() => {
    if (!isAssignmentMode) return false;
    const asgStatus = (assignmentStatus || '').toLowerCase();
    if (asgStatus !== 'submitted') return false;
    const sessionOwnerId = session?.ownerId;
    return Boolean(sessionOwnerId) && sessionOwnerId !== currentUser?.id;
  }, [assignmentStatus, currentUser?.id, isAssignmentMode, session?.ownerId]);

  const [sendBackReason, setSendBackReason] = useState('');
  const [sendBackMissingItems, setSendBackMissingItems] = useState<
    { key: string; label: string; checked: boolean }[]
  >([]);
  const [isSendingBack, setIsSendingBack] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSendBackForm, setShowSendBackForm] = useState(false);

  // Populate send-back checklist when entering reviewer mode
  useEffect(() => {
    if (!isReviewerMode) return;
    const items: { key: string; label: string; checked: boolean }[] = [];
    const unansweredRequired = questions.filter(
      (q) => q.isRequired && q.status !== 'answered'
    );
    for (const q of unansweredRequired) {
      items.push({
        key: `q_${q.id}`,
        label: q.questionText.length > 80 ? q.questionText.slice(0, 77) + '…' : q.questionText,
        checked: true,
      });
    }
    if (items.length === 0) {
      items.push({
        key: 'quality_gaps',
        label: isPolish
          ? 'Doprecyzuj kluczowe odpowiedzi'
          : 'Clarify key answers',
        checked: false,
      });
    }
    setSendBackMissingItems(items);
  }, [isReviewerMode, questions, isPolish]);

  // Domyślnie nie wybieramy żadnej kategorii - użytkownik sam zdecyduje
  const [activeCategory, setActiveCategory] = useState<InterviewCategory | undefined>(undefined);
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('task_list');
  const questionsTopRef = useRef<HTMLDivElement | null>(null);

  // N-mode: active section in the left nav
  const [activeSection, setActiveSection] = useState<string>('questions');

  useEffect(() => {
    if (activeCategory || questions.length === 0) return;

    const firstCategoryWithUnanswered = CATEGORY_ORDER.find((cat) => {
      const catQuestions = questions.filter((q) => q.category === cat);
      return catQuestions.some((q) => q.status !== 'answered');
    });

    const fallbackCategory = CATEGORY_ORDER.find((cat) =>
      questions.some((q) => q.category === cat)
    );

    setActiveCategory(firstCategoryWithUnanswered || fallbackCategory);
  }, [activeCategory, questions]);

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
  const overallPercent =
    totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  const activeCategoryConfig = activeCategory ? CATEGORY_CONFIG[activeCategory] : undefined;
  const ActiveCategoryIcon = activeCategoryConfig?.icon || FileText;
  const activeCategoryProgress = activeCategory
    ? categoryProgress.find((p) => p.category === activeCategory)
    : undefined;
  const activeCategoryPercent =
    activeCategoryProgress && (activeCategoryProgress.totalQuestions || 0) > 0
      ? Math.round(
          ((activeCategoryProgress?.answeredQuestions || 0) /
            (activeCategoryProgress?.totalQuestions || 1)) *
            100
        )
      : 0;

  // Status display (aligned with backend assignment/session statuses)
  const STATUS_MAP: Record<
    string,
    { label: { en: string; pl: string }; color: string; textColor: string }
  > = {
    assigned: {
      label: { en: 'Assigned', pl: 'Przypisany' },
      color: 'bg-slate-400',
      textColor: 'text-slate-600 dark:text-slate-400',
    },
    in_progress: {
      label: { en: 'In Progress', pl: 'W trakcie' },
      color: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    submitted: {
      label: { en: 'Submitted', pl: 'Wysłany' },
      color: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    sent_back: {
      label: { en: 'Sent back', pl: 'Do poprawy' },
      color: 'bg-red-500',
      textColor: 'text-red-600 dark:text-red-400',
    },
    approved: {
      label: { en: 'Approved', pl: 'Zatwierdzony' },
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    completed: {
      label: { en: 'Completed', pl: 'Zakończony' },
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
  };

  const currentStatus = useMemo(() => {
    const raw = String(assignmentStatus || session?.status || 'in_progress').toLowerCase();
    if (raw === 'active') return 'in_progress';
    if (raw === 'assigned') return 'assigned';
    if (raw === 'in_progress') return 'in_progress';
    if (raw === 'submitted') return 'submitted';
    if (raw === 'sent_back') return 'sent_back';
    if (raw === 'approved') return 'approved';
    if (raw === 'completed') return 'completed';
    if (raw === 'archived') return 'completed';
    return 'in_progress';
  }, [assignmentStatus, session?.status]);
  const statusConfig = STATUS_MAP[currentStatus] || STATUS_MAP.in_progress;

  const handleRuntimeModeSelect = useCallback(
    (nextMode: RuntimeMode) => {
      const previous = runtimeMode;
      setRuntimeMode(nextMode);

      trackFunnelEvent('interview_runtime_mode_selected', {
        mode: nextMode,
        templateId: session?.id || null,
      });

      if (previous !== nextMode) {
        trackFunnelEvent('interview_runtime_mode_changed', {
          mode: nextMode,
          previousMode: previous,
          templateId: session?.id || null,
        });
      }
    },
    [runtimeMode, session?.id]
  );

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    const runtimeKey = `interview_runtime_mode:${session?.id || initialSessionId || 'new'}`;
    try {
      const saved = window.localStorage.getItem(runtimeKey);
      if (
        session?.assignmentId ||
        session?.runtimeModeDefault === 'single_question' ||
        session?.runtimeModeDefault === 'task_list'
      ) {
        setRuntimeMode(
          session?.assignmentId ? 'single_question' : (session?.runtimeModeDefault as RuntimeMode)
        );
      } else if (saved === 'single_question' || saved === 'task_list') {
        setRuntimeMode(saved);
      } else {
        setRuntimeMode('single_question');
      }
    } catch {
      setRuntimeMode(session?.assignmentId ? 'single_question' : session?.runtimeModeDefault || 'single_question');
    }
  }, [initialSessionId, session?.assignmentId, session?.id, session?.runtimeModeDefault]);

  useEffect(() => {
    const runtimeKey = `interview_runtime_mode:${session?.id || initialSessionId || 'new'}`;
    try {
      window.localStorage.setItem(runtimeKey, runtimeMode);
    } catch {
      // ignore persistence errors
    }
  }, [initialSessionId, runtimeMode, session?.id]);

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
          setAssignmentStatus(null);
          setAssignmentInfo(null);
          onSessionChange?.(currentSession);

          const [
            questionsRes,
            notesRes,
            evidenceRes,
            contextRes,
            summaryRes,
            myAssignmentsRes,
            linkedItemsRes,
          ] = await Promise.all([
            Api.get(`/interview/sessions/${currentSession.id}/questions`),
            Api.get(`/interview/sessions/${currentSession.id}/notes`),
            Api.get(`/interview/sessions/${currentSession.id}/evidence`),
            Api.get('/interview/context'),
            Api.get(`/interview/sessions/${currentSession.id}/summary`).catch(() => null),
            currentSession.assignmentId
              ? Api.get(`/interview/assignments/my?includeCompleted=true`).catch(() => [])
              : Promise.resolve([]),
            Api.get(`/interview/sessions/${currentSession.id}/linked-items`).catch(() => []),
          ]);

          setQuestions(Array.isArray(questionsRes) ? questionsRes : []);
          setNotes(Array.isArray(notesRes) ? notesRes : []);
          setEvidence(Array.isArray(evidenceRes) ? evidenceRes : []);
          setLinkedItems(
            Array.isArray(linkedItemsRes) ? (linkedItemsRes as PersistedLinkedItem[]) : []
          );

          if (currentSession.assignmentId) {
            const list = Array.isArray(myAssignmentsRes) ? myAssignmentsRes : [];
            const found = list.find((a: any) => a?.id === currentSession?.assignmentId);
            setAssignmentStatus(found?.status || null);
            setAssignmentInfo(found || null);
          }

          if (contextRes && typeof contextRes === 'object') {
            const ctx = contextRes as Record<string, unknown>;
            const profile: CompanyProfile = {
              name: (ctx.companyName as string) || undefined,
              industry: (ctx.industry as string) || undefined,
              size: (ctx.companySize as string) || undefined,
              location: (ctx.location as string) || undefined,
              employees: (ctx.employeeCount as number) || undefined,
              revenue: (ctx.annualRevenue as string) || undefined,
            };
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
  const handleUpdateQuestion = useCallback(
    async (questionId: string, updates: Partial<InterviewQuestion>) => {
      if (!session) return;
      setIsSaving(true);

      try {
        const updated = await Api.patch(`/interview/questions/${questionId}`, updates);
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updated } : q)));
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to update question:', error);
        toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    [session, isPolish]
  );

  // Add question
  const handleAddQuestion = useCallback(
    async (category: InterviewCategory, questionText: string) => {
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
    },
    [session, isPolish]
  );

  // Create note
  const handleCreateNote = useCallback(
    async (title: string, content: string, category?: InterviewCategory) => {
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
    },
    [session, isPolish]
  );

  // Update note
  const handleUpdateNote = useCallback(
    async (noteId: string, updates: Partial<InterviewNote>) => {
      if (!session) return;
      setIsSaving(true);

      try {
        const updated = await Api.patch(`/interview/notes/${noteId}`, updates);
        setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, ...updated } : n)));
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to update note:', error);
        toast.error(isPolish ? 'Nie udało się zapisać notatki' : 'Failed to save note');
      } finally {
        setIsSaving(false);
      }
    },
    [session, isPolish]
  );

  // Delete note
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      if (!session) return;

      try {
        await Api.delete(`/interview/notes/${noteId}`);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to delete note:', error);
        toast.error(isPolish ? 'Nie udało się usunąć notatki' : 'Failed to delete note');
      }
    },
    [session, isPolish]
  );

  // Upload file
  const handleUploadFile = useCallback(
    async (file: File, category?: InterviewCategory, questionId?: string) => {
      if (!session) return;
      setIsSaving(true);

      try {
        const created = await Api.post(`/interview/sessions/${session.id}/evidence`, {
          evidenceType: 'file',
          evidenceRole: 'supporting',
          questionId,
          title: file.name,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          category,
        });
        setEvidence((prev) => [...prev, created as InterviewEvidence]);
        toast.success(isPolish ? 'Plik dodany' : 'File added');
        return created as InterviewEvidence;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to upload file:', error);
        toast.error(isPolish ? 'Nie udało się dodać pliku' : 'Failed to upload file');
        return undefined;
      } finally {
        setIsSaving(false);
      }
    },
    [session, isPolish]
  );

  // Add link
  const handleAddLink = useCallback(
    async (
      name: string,
      url: string,
      description?: string,
      category?: InterviewCategory,
      questionId?: string
    ) => {
      if (!session) return;
      setIsSaving(true);

      try {
        const created = await Api.post(`/interview/sessions/${session.id}/evidence`, {
          evidenceType: 'link',
          evidenceRole: 'supporting',
          questionId,
          title: name,
          url,
          description,
          category,
        });
        setEvidence((prev) => [...prev, created as InterviewEvidence]);
        return created as InterviewEvidence;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to add link:', error);
        toast.error(isPolish ? 'Nie udało się dodać linku' : 'Failed to add link');
        return undefined;
      } finally {
        setIsSaving(false);
      }
    },
    [session, isPolish]
  );

  const handleAddEvidenceComment = useCallback(
    async (text: string, category?: InterviewCategory, questionId?: string) => {
      if (!session) return;
      setIsSaving(true);
      try {
        const created = await Api.post(`/interview/sessions/${session.id}/evidence`, {
          evidenceType: 'comment',
          evidenceRole: 'context',
          questionId,
          title: isPolish ? 'Komentarz kontekstowy' : 'Context comment',
          description: text,
          category,
        });
        setEvidence((prev) => [...prev, created as InterviewEvidence]);
        toast.success(isPolish ? 'Komentarz dodany' : 'Comment added');
        return created as InterviewEvidence;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to add comment evidence:', error);
        toast.error(isPolish ? 'Nie udało się dodać komentarza' : 'Failed to add comment');
        return undefined;
      } finally {
        setIsSaving(false);
      }
    },
    [session, isPolish]
  );

  const handleAddVoiceEvidence = useCallback(
    async (
      file: File,
      transcriptText: string,
      category?: InterviewCategory,
      questionId?: string
    ) => {
      if (!session) return;
      setIsSaving(true);

      try {
        const created = await Api.post(`/interview/sessions/${session.id}/evidence`, {
          evidenceType: 'audio',
          evidenceRole: 'answer_audio',
          questionId,
          title: file.name,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          transcriptText,
          category,
        });
        setEvidence((prev) => [...prev, created as InterviewEvidence]);
        return created as InterviewEvidence;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to add voice evidence:', error);
        toast.error(isPolish ? 'Nie udało się zapisać nagrania' : 'Failed to save recording');
        return undefined;
      } finally {
        setIsSaving(false);
      }
    },
    [session, isPolish]
  );

  // Delete evidence
  const handleDeleteEvidence = useCallback(
    async (evidenceId: string) => {
      if (!session) return;

      try {
        await Api.delete(`/interview/evidence/${evidenceId}`);
        setEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to delete evidence:', error);
        toast.error(isPolish ? 'Nie udało się usunąć' : 'Failed to delete');
      }
    },
    [session, isPolish]
  );

  // Update company profile
  const handleUpdateProfile = useCallback(async () => {
    setIsSaving(true);

    try {
      await Api.put('/interview/context', {
        companyName: editedProfile.name,
        industry: editedProfile.industry,
        companySize: editedProfile.size,
        location: editedProfile.location,
        employeeCount: editedProfile.employees,
        annualRevenue: editedProfile.revenue,
      });
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
      // Keep local session state in sync (used for isDirty and title)
      setSession((prev) => (prev ? { ...prev, name: sessionName } : prev));
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
        // Validate completion before submit (basic rule: all questions answered)
        const missing = questions.filter((q) => q.status !== 'answered');
        if (missing.length > 0) {
          const first = missing[0];
          if (first?.category) {
            setActiveCategory(first.category as InterviewCategory);
            setActiveSection('questions');
            requestAnimationFrame(() => {
              questionsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
          toast.error(
            isPolish
              ? `Uzupełnij brakujące odpowiedzi (${missing.length}).`
              : `Please fill missing answers (${missing.length}).`
          );
          return;
        }

        const result = await Api.post(`/interview/assignments/${session.assignmentId}/submit`, {});
        const updatedSession = (result as any)?.session;
        const updatedAssignment = (result as any)?.assignment;
        const completeness = (result as any)?.completenessPercent;
        if (updatedSession) setSession(updatedSession);
        if (updatedAssignment?.status) setAssignmentStatus(String(updatedAssignment.status));
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
  }, [session, isLocked, isPolish, onComplete, questions]);

  // V6-C04: Reviewer actions
  const handleSendBack = useCallback(async () => {
    if (!session?.assignmentId || !sendBackReason.trim()) return;
    setIsSendingBack(true);
    try {
      const missingItems = sendBackMissingItems
        .filter((item) => item.checked)
        .map((item) => ({ key: item.key, label: item.label }));
      await Api.post(`/interview/assignments/${session.assignmentId}/send-back`, {
        reason: sendBackReason.trim(),
        missingItems,
      });
      setAssignmentStatus('sent_back');
      setShowSendBackForm(false);
      setSendBackReason('');
      toast.success(isPolish ? 'Wywiad odesłany do poprawy.' : 'Interview sent back for revision.');
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to send back:', error);
      toast.error(isPolish ? 'Nie udało się odesłać.' : 'Failed to send back.');
    } finally {
      setIsSendingBack(false);
    }
  }, [session?.assignmentId, sendBackReason, sendBackMissingItems, isPolish]);

  const handleApprove = useCallback(async () => {
    if (!session?.assignmentId) return;
    setIsApproving(true);
    try {
      const result = await Api.post(`/interview/assignments/${session.assignmentId}/approve`, {});
      const updatedAssignment = (result as any)?.assignment;
      if (updatedAssignment?.status) setAssignmentStatus(String(updatedAssignment.status));
      else setAssignmentStatus('approved');
      toast.success(isPolish ? 'Wywiad zatwierdzony.' : 'Interview approved.');
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to approve:', error);
      toast.error(isPolish ? 'Nie udało się zatwierdzić.' : 'Failed to approve.');
    } finally {
      setIsApproving(false);
    }
  }, [session?.assignmentId, isPolish]);

  // Open chat
  const handleOpenChat = useCallback(() => {
    if (!session) return;
    setActiveConversation(`interview-${session.id}`);
  }, [session, setActiveConversation]);

  // Linked items handlers
  const handleAddLinkedItem = async (item: LinkedItem) => {
    if (!session) return;
    const created = (await Api.post(`/interview/sessions/${session.id}/linked-items`, {
      id: item.id,
      type: item.type,
    })) as PersistedLinkedItem;
    setLinkedItems((prev) => [...prev, created]);
  };

  const handleRemoveLinkedItem = async (id: string) => {
    if (!session) return;
    const existing = linkedItems.find((item) => item.id === id || item.edgeId === id);
    if (!existing?.edgeId) {
      setLinkedItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    await Api.delete(`/interview/sessions/${session.id}/linked-items/${existing.edgeId}`);
    setLinkedItems((prev) => prev.filter((i) => i.edgeId !== existing.edgeId));
  };

  const searchLinkedItems = async (query: string) => {
    if (!query || query.length < 2) return [];
    try {
      const [tasks, initiatives, decisions, assessments] = await Promise.all([
        Api.get(`/tasks?search=${encodeURIComponent(query)}&limit=5`).catch(() => []),
        Api.get(`/initiatives?search=${encodeURIComponent(query)}&limit=5`).catch(() => []),
        Api.get(`/decisions?q=${encodeURIComponent(query)}&limit=5`).catch(() => []),
        Api.get(`/assessments?search=${encodeURIComponent(query)}&limit=5`).catch(() => []),
      ]);
      const results: LinkedItem[] = [];
      if (Array.isArray(tasks)) {
        tasks.slice(0, 3).forEach((t: { id: string; title?: string; name?: string }) => {
          results.push({
            id: t.id,
            type: 'task' as LinkedItem['type'],
            title: t.title || t.name || 'Task',
          });
        });
      }
      if (Array.isArray(initiatives)) {
        initiatives.slice(0, 3).forEach((i: { id: string; name?: string; title?: string }) => {
          results.push({
            id: i.id,
            type: 'initiative' as LinkedItem['type'],
            title: i.name || i.title || 'Initiative',
          });
        });
      }
      if (Array.isArray(decisions)) {
        decisions.slice(0, 3).forEach((d: { id: string; title?: string; name?: string }) => {
          results.push({
            id: d.id,
            type: 'decision',
            title: d.title || d.name || 'Decision',
          });
        });
      }
      if (Array.isArray(assessments)) {
        assessments
          .slice(0, 3)
          .forEach((a: { id: string; name?: string; title?: string; status?: string }) => {
            results.push({
              id: a.id,
              type: 'assessment',
              title: a.name || a.title || 'Assessment',
              status: a.status,
            });
          });
      }
      return results;
    } catch {
      return [];
    }
  };

  // Export handlers
  const handleExportMarkdown = () => {
    const content = `# ${sessionName}\n\n## Progress: ${overallPercent}%\n\n${summaryData.facts.map((f) => `- ${f}`).join('\n')}`;
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
    const content = `${sessionName}\n\nProgress: ${overallPercent}%\n\nFacts:\n${summaryData.facts.map((f) => `- ${f}`).join('\n')}`;
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
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
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
    const progress = categoryProgress.find((p) => p.category === category);
    const categoryQuestions = questions.filter((q) => q.category === category);
    const hasQuestions = categoryQuestions.length > 0;

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
        {hasQuestions && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isPolish ? 'Postęp' : 'Progress'}</span>
              <span>
                {progress?.answeredQuestions || 0}/{progress?.totalQuestions || 0}
              </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress?.isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{
                  width: `${(progress?.totalQuestions || 0) > 0 ? ((progress?.answeredQuestions || 0) / (progress?.totalQuestions || 1)) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Questions list */}
        <QuestionsList
          questions={questions}
          category={category}
          runtimeMode={runtimeMode}
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

  const isDirty = Boolean(session) && sessionName !== (session?.name || '');

  const handleNextMissing = () => {
    const first = questions.find((q) => q.status !== 'answered');
    if (first?.category) {
      setActiveCategory(first.category as InterviewCategory);
      setActiveSection('questions');
      requestAnimationFrame(() => {
        questionsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const properties: NModePropertyField[] = (() => {
    const templateName =
      (assignmentInfo as any)?.template?.name || (session as any)?.templateName || '-';
    const assignee =
      (assignmentInfo as any)?.assignee?.name ||
      (assignmentInfo as any)?.assigneeName ||
      currentUser?.displayName ||
      '-';
    const dueAt = (assignmentInfo as any)?.dueAt ? String((assignmentInfo as any)?.dueAt) : '';
    const dueDateOnly = dueAt ? new Date(dueAt).toISOString().slice(0, 10) : '';

    return [
      {
        id: 'template',
        label: { en: 'Template', pl: 'Szablon' },
        type: 'text',
        value: String(templateName || '-'),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'assignee',
        label: { en: 'Assignee', pl: 'Przypisany' },
        type: 'text',
        value: String(assignee || '-'),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'due',
        label: { en: 'Due', pl: 'Termin' },
        type: 'date',
        value: dueDateOnly,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'progress',
        label: { en: 'Progress', pl: 'Postęp' },
        type: 'text',
        value: `${overallPercent}% (${answeredQuestions}/${totalQuestions})`,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'locked',
        label: { en: 'Editable', pl: 'Edycja' },
        type: 'text',
        value: isLocked ? (isPolish ? 'Zablokowane' : 'Locked') : isPolish ? 'Aktywne' : 'Active',
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'lastActivity',
        label: { en: 'Last activity', pl: 'Aktywność' },
        type: 'text',
        value: session?.lastActivityAt
          ? new Date(session.lastActivityAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')
          : '-',
        onChange: () => {},
        readOnly: true,
      },
    ];
  })();

  const actions: NModeAction[] = (() => {
    const out: NModeAction[] = [];

    if (!isLocked) {
      if (isAssignmentMode) {
        out.push({
          id: 'submit',
          label: { en: 'Submit for review', pl: 'Wyślij do przeglądu' },
          icon: Send,
          variant: 'success',
          onClick: () => handleSubmitSession(),
          disabled: isSaving || isLocked,
        });
      }
    }

    out.push({
      id: 'export-md',
      label: { en: 'Markdown', pl: 'Markdown' },
      icon: Download,
      variant: 'neutral',
      onClick: handleExportMarkdown,
    });
    out.push({
      id: 'copy',
      label: { en: 'Copy', pl: 'Kopiuj' },
      icon: Copy,
      variant: 'neutral',
      onClick: handleCopy,
    });

    return out;
  })();

  const sections: NModeSection[] = (() => {
    const overview = (
      <NModeSectionWrapper heading={{ en: 'Overview', pl: 'Podgląd' }}>
        <Callout
          variant={isLocked ? 'info' : 'purple'}
          title={
            isLocked
              ? isPolish
                ? 'Tryb tylko do odczytu'
                : 'Read-only'
              : isPolish
                ? 'Następny krok'
                : 'Next action'
          }
          action={
            isLocked
              ? undefined
              : {
                  label: isPolish ? 'Następne brakujące' : 'Next missing',
                  onClick: handleNextMissing,
                }
          }
          compact
        >
          {isPolish
            ? `Postęp: ${answeredQuestions}/${totalQuestions} (${overallPercent}%).`
            : `Progress: ${answeredQuestions}/${totalQuestions} (${overallPercent}%).`}
        </Callout>
      </NModeSectionWrapper>
    );

    const questionsSection = (
      <NModeSectionWrapper heading={{ en: 'Questions', pl: 'Pytania' }}>
        <div ref={questionsTopRef} />

        <div className="mb-4">
          <RuntimeModeSelector
            currentMode={runtimeMode}
            recommendedMode="single_question"
            onModeSelect={handleRuntimeModeSelect}
            compact={runtimeMode === 'single_question'}
            locked={isLocked}
          />
        </div>

        {runtimeMode === 'single_question' ? (
          activeCategory ? (
            <InterviewSingleQuestionRuntime
              questions={questions}
              evidence={evidence}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onUpdateQuestion={handleUpdateQuestion}
              onUploadFile={handleUploadFile}
              onAddLink={handleAddLink}
              onAddVoiceEvidence={handleAddVoiceEvidence}
              onSubmitSession={handleSubmitSession}
              onSaveAndExit={onClose}
              sessionName={sessionName}
              readOnly={isLocked}
            />
          ) : (
            <Callout
              variant="info"
              title={isPolish ? 'Gotowy do startu' : 'Ready to start'}
              compact
              action={{
                label: isPolish ? 'Rozpocznij' : 'Start',
                onClick: handleNextMissing,
              }}
            >
              {isPolish
                ? 'Kliknij \u201eRozpocznij\u201d, aby przej\u015b\u0107 do pierwszego pytania.'
                : 'Click "Start" to jump to the first question.'}
            </Callout>
          )
        ) : (
          <>
        <div className="mb-4 inline-flex items-center gap-2">
          <button
            onClick={handleNextMissing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/40 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
          >
            <ArrowRight size={14} />
            {isPolish ? 'Następne brakujące' : 'Next missing'}
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {answeredQuestions}/{totalQuestions}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORY_ORDER.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  isActive
                    ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border-primary-500/30'
                    : 'bg-white/60 dark:bg-navy-900/40 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-navy-700/60 hover:bg-slate-50/80 dark:hover:bg-navy-800/50'
                }`}
              >
                <cfg.icon size={14} className={isActive ? 'text-primary-500' : 'text-slate-400'} />
                {isPolish ? cfg.labelPl : cfg.labelEn}
              </button>
            );
          })}
        </div>

        {activeCategory ? (
          <QuestionsList
            questions={questions}
            category={activeCategory}
            runtimeMode={runtimeMode}
            onUpdateQuestion={handleUpdateQuestion}
            onAddQuestion={handleAddQuestion}
            readOnly={isLocked}
          />
        ) : (
          <Callout
            variant="info"
            title={isPolish ? 'Wybierz sekcję' : 'Pick a section'}
            compact
            action={{
              label: isPolish ? 'Następne brakujące' : 'Next missing',
              onClick: handleNextMissing,
            }}
          >
            {isPolish
              ? 'Zacznij od pierwszej brakującej odpowiedzi — poprowadzę Cię przez flow.'
              : 'Start with the next missing answer — we’ll guide you through the flow.'}
          </Callout>
        )}
          </>
        )}
      </NModeSectionWrapper>
    );

    const notesSection = (
      <NModeSectionWrapper heading={{ en: 'Notes', pl: 'Notatki' }}>
        <NotesPanel
          notes={notes}
          activeCategory={activeCategory}
          onCreateNote={handleCreateNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          readOnly={isLocked}
        />
      </NModeSectionWrapper>
    );

    const evidenceSection = (
      <NModeSectionWrapper heading={{ en: 'Evidence', pl: 'Dowody' }}>
        <EvidencePanel
          evidence={evidence}
          activeCategory={activeCategory}
          onUploadFile={handleUploadFile}
          onAddLink={handleAddLink}
          onAddComment={handleAddEvidenceComment}
          onDeleteEvidence={handleDeleteEvidence}
          readOnly={isLocked}
        />
      </NModeSectionWrapper>
    );

    const companyFactsSection = (
      <NModeSectionWrapper heading={{ en: 'Company facts', pl: 'Fakty o firmie' }}>
        <div className="space-y-3">
          {isEditingProfile ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {isPolish ? 'Nazwa' : 'Name'}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.name || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {isPolish ? 'Branża' : 'Industry'}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.industry || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, industry: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {isPolish ? 'Wielkość' : 'Size'}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.size || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, size: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    {isPolish ? 'Lokalizacja' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.location || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, location: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdateProfile}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-blue-500/30 text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/15 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isPolish ? 'Zapisz' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditedProfile(companyProfile);
                    setIsEditingProfile(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200/60 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-navy-900/40 hover:bg-slate-50/80 dark:hover:bg-navy-800/50"
                >
                  <X size={14} />
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-slate-700 dark:text-slate-200">
                {companyProfile.name ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-slate-400" /> {companyProfile.name}
                    </div>
                    {companyProfile.industry && (
                      <div className="text-xs text-slate-500">{companyProfile.industry}</div>
                    )}
                    {companyProfile.location && (
                      <div className="text-xs text-slate-500">{companyProfile.location}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-400">
                    {isPolish ? 'Brak danych firmy' : 'No company data yet'}
                  </span>
                )}
              </div>
              {!isLocked && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200/60 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-navy-900/40 hover:bg-slate-50/80 dark:hover:bg-navy-800/50"
                >
                  <Edit3 size={14} />
                  {isPolish ? 'Edytuj' : 'Edit'}
                </button>
              )}
            </>
          )}
        </div>
      </NModeSectionWrapper>
    );

    const stakeholdersSection = (
      <NModeSectionWrapper
        heading={{ en: 'Stakeholders', pl: 'Interesariusze' }}
        isEmpty={stakeholders.length === 0}
        emptyState={{
          icon: Users,
          message: { en: 'No stakeholders yet.', pl: 'Brak interesariuszy.' },
        }}
      >
        <div className="space-y-2">
          {stakeholders.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-2 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/15 flex items-center justify-center">
                <Users size={14} className="text-cyan-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {s.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{s.role}</div>
              </div>
            </div>
          ))}
        </div>
      </NModeSectionWrapper>
    );

    const gapsSection = (
      <NModeSectionWrapper
        heading={{ en: 'Open gaps', pl: 'Luki informacyjne' }}
        isEmpty={openGaps.length === 0}
        emptyState={{
          icon: AlertTriangle,
          message: { en: 'No gaps identified.', pl: 'Brak zidentyfikowanych luk.' },
        }}
      >
        <div className="space-y-2">
          {openGaps.map((gap) => (
            <div
              key={gap.id}
              className={`p-3 rounded-xl border ${
                gap.priority === 'high'
                  ? 'border-red-500/20 bg-red-500/5 dark:bg-red-500/10'
                  : gap.priority === 'medium'
                    ? 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10'
                    : 'border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/40'
              }`}
            >
              <div className="text-sm text-slate-700 dark:text-slate-200">{gap.description}</div>
              <div className="text-xs text-slate-500 mt-1">{gap.category}</div>
            </div>
          ))}
        </div>
      </NModeSectionWrapper>
    );

    const base: NModeSection[] = [
      {
        id: 'overview',
        icon: BarChart3,
        label: { en: 'Overview', pl: 'Podgląd' },
        component: overview,
      },
      {
        id: 'questions',
        icon: FileText,
        label: { en: 'Questions', pl: 'Pytania' },
        badge: questions.filter((q) => q.status !== 'answered').length,
        component: questionsSection,
      },
      {
        id: 'notes',
        icon: FileText,
        label: { en: 'Notes', pl: 'Notatki' },
        badge: notes.length,
        component: notesSection,
      },
      {
        id: 'evidence',
        icon: Paperclip,
        label: { en: 'Evidence', pl: 'Dowody' },
        badge: evidence.length,
        component: evidenceSection,
      },
      {
        id: 'company-facts',
        icon: Building2,
        label: { en: 'Company facts', pl: 'Fakty' },
        component: companyFactsSection,
      },
      {
        id: 'stakeholders',
        icon: Users,
        label: { en: 'Stakeholders', pl: 'Interesariusze' },
        badge: stakeholders.length,
        component: stakeholdersSection,
      },
      {
        id: 'open-gaps',
        icon: AlertTriangle,
        label: { en: 'Open gaps', pl: 'Luki' },
        badge: openGaps.length,
        component: gapsSection,
      },
    ];

    if (!isAssignmentMode) {
      base.push({
        id: 'summary',
        icon: Sparkles,
        label: { en: 'Summary', pl: 'Podsumowanie' },
        component: (
          <NModeSectionWrapper
            heading={{ en: 'Summary (facts only)', pl: 'Podsumowanie (tylko fakty)' }}
          >
            <Callout variant="warning" title={isPolish ? 'Tylko fakty' : 'Facts only'} compact>
              {isPolish
                ? 'Bez rekomendacji i planów działań.'
                : 'No recommendations or action plans.'}
            </Callout>
            <div className="mt-4 space-y-3">
              {summaryData.facts.length > 0 ? (
                <ul className="space-y-2">
                  {summaryData.facts.map((f, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <Check size={14} className="text-emerald-500 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-400">
                  {isPolish ? 'Brak faktów' : 'No facts yet'}
                </div>
              )}
            </div>
          </NModeSectionWrapper>
        ),
      });
    }

    return base;
  })();

  // NOTE: legacyRender below is dead code — NModeShell is the sole render path.
  // InterviewSingleQuestionRuntime is now rendered inside questionsSection above.
  // TODO: remove legacyRender in a cleanup pass.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const legacyRender = (
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
                  <span>
                    {overallPercent}% {isPolish ? 'ukończone' : 'complete'}
                  </span>
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

            {/* Submit button (assignment mode) */}
            {isAssignmentMode && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmitSession}
                disabled={isLocked || isSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-60 ${
                  isLocked
                    ? 'bg-slate-200/60 dark:bg-navy-800/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border border-emerald-400/30 hover:from-emerald-400 hover:to-teal-500 shadow-lg shadow-emerald-500/20'
                }`}
                title={isPolish ? 'Wyślij do przeglądu' : 'Submit for review'}
              >
                <Send size={16} />
                <span>{isPolish ? 'Wyślij' : 'Submit'}</span>
              </motion.button>
            )}

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

        {isAssignmentMode && assignmentInfo?.dueAt && (
          <div className="max-w-7xl mx-auto mt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {(() => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const due = new Date(assignmentInfo.dueAt);
                due.setHours(0, 0, 0, 0);
                const diffMs = due.getTime() - now.getTime();
                const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                const absDays = Math.abs(days);

                let dueLabel: string;
                let dueColorClass: string;

                if (days < 0) {
                  dueLabel = isPolish
                    ? `${absDays} ${absDays === 1 ? 'dzień' : 'dni'} po terminie`
                    : `${absDays}d overdue`;
                  dueColorClass = 'text-red-600 dark:text-red-400 bg-red-500/10';
                } else if (days === 0) {
                  dueLabel = isPolish ? 'Termin dziś!' : 'Due today!';
                  dueColorClass = 'text-red-600 dark:text-red-400 bg-red-500/10';
                } else if (days <= 3) {
                  dueLabel = isPolish
                    ? `${days} ${days === 1 ? 'dzień' : 'dni'} do terminu`
                    : `${days}d left`;
                  dueColorClass = 'text-amber-600 dark:text-amber-400 bg-amber-500/10';
                } else {
                  dueLabel = isPolish
                    ? `${days} ${days === 1 ? 'dzień' : 'dni'} do terminu`
                    : `${days}d left`;
                  dueColorClass = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
                }

                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dueColorClass}`}
                    title={new Date(assignmentInfo.dueAt).toLocaleDateString(
                      isPolish ? 'pl-PL' : 'en-US'
                    )}
                  >
                    {days <= 0 ? (
                      <AlertTriangle size={12} />
                    ) : days <= 3 ? (
                      <Clock size={12} />
                    ) : (
                      <Calendar size={12} />
                    )}
                    {dueLabel}
                  </span>
                );
              })()}
              {String(assignmentStatus || '').toLowerCase() === 'sent_back' &&
                assignmentInfo?.sentBackReason && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-300">
                    <AlertTriangle size={12} />
                    {isPolish ? 'Do poprawy:' : 'Fix:'} {String(assignmentInfo.sentBackReason)}
                  </span>
                )}
            </div>
          </div>
        )}

        {isLocked && (
          <div className="max-w-7xl mx-auto mt-3">
            <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm">
              {(session?.status || '').toLowerCase() === 'submitted'
                ? isPolish
                  ? 'Wywiad jest wysłany i zablokowany do edycji.'
                  : 'Interview is submitted and locked.'
                : isPolish
                  ? 'Wywiad jest ukończony i zablokowany do edycji.'
                  : 'Interview is completed and locked.'}
            </div>
          </div>
        )}
      </motion.div>

      {/* ==========================================
          V6-C04: REVIEWER MODE PANEL
          ========================================== */}
      {isReviewerMode && (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Reviewer banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-500/10 px-5 py-4">
            <Shield size={20} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                {isPolish ? 'Tryb recenzenta' : 'Reviewer mode'}
              </p>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                {isPolish
                  ? 'Przeglądasz złożony wywiad. Możesz zatwierdzić lub odesłać do poprawy.'
                  : 'You are reviewing a submitted interview. You can approve or send back.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowSendBackForm((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-white dark:bg-navy-900 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                aria-label={isPolish ? 'Odeślij do poprawy' : 'Send back for revision'}
              >
                <Send size={14} className="rotate-180" />
                {isPolish ? 'Odeślij' : 'Send back'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-60 transition-all"
                aria-label={isPolish ? 'Zatwierdź wywiad' : 'Approve interview'}
              >
                {isApproving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ThumbsUp size={14} />
                )}
                {isPolish ? 'Zatwierdź' : 'Approve'}
              </motion.button>
            </div>
          </div>

          {/* Send-back form (collapsible) */}
          <AnimatePresence>
            {showSendBackForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl border border-amber-200/60 dark:border-amber-500/20 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {isPolish ? 'Formularz odesłania' : 'Send-back form'}
                  </h3>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {isPolish ? 'Powód odesłania' : 'Reason for sending back'}
                    </label>
                    <textarea
                      value={sendBackReason}
                      onChange={(e) => setSendBackReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder={
                        isPolish
                          ? 'Opisz, co wymaga poprawy lub uzupełnienia...'
                          : 'Describe what needs to be improved or completed...'
                      }
                      aria-label={isPolish ? 'Powód odesłania' : 'Reason for sending back'}
                    />
                  </div>

                  {sendBackMissingItems.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Brakujące elementy' : 'Missing items'}
                      </label>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {sendBackMissingItems.map((item, idx) => (
                          <label
                            key={item.key}
                            className="flex items-start gap-2.5 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() =>
                                setSendBackMissingItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, checked: !it.checked } : it
                                  )
                                )
                              }
                              className="mt-0.5 rounded border-slate-300 dark:border-navy-600 text-amber-500 focus:ring-amber-400"
                              aria-label={item.label}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSendBackForm(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-navy-700 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSendBack}
                      disabled={isSendingBack || !sendBackReason.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                      aria-label={isPolish ? 'Potwierdź odesłanie' : 'Confirm send back'}
                    >
                      {isSendingBack ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} className="rotate-180" />
                      )}
                      {isPolish ? 'Odeślij do poprawy' : 'Send back'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reviewer: full question list with answers (read-only) */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                  {isPolish ? 'Odpowiedzi respondenta' : 'Respondent answers'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {answeredQuestions}/{totalQuestions}{' '}
                  {isPolish ? 'odpowiedzi' : 'answered'} · {overallPercent}%
                </p>
              </div>
              {/* Gaps indicator */}
              {(() => {
                const unansweredRequired = questions.filter(
                  (q) => q.isRequired && q.status !== 'answered'
                );
                if (unansweredRequired.length === 0) return null;
                return (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <CircleAlert size={12} />
                    {unansweredRequired.length}{' '}
                    {isPolish ? 'wymaganych brakuje' : 'required missing'}
                  </span>
                );
              })()}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-navy-800">
              {CATEGORY_ORDER.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                const catQuestions = questions.filter((q) => q.category === cat);
                if (catQuestions.length === 0) return null;
                const catAnswered = catQuestions.filter((q) => q.status === 'answered').length;

                return (
                  <div key={cat}>
                    <div className="flex items-center gap-3 px-5 py-3 bg-slate-50/60 dark:bg-navy-950/40">
                      <cfg.icon size={14} className={cfg.color} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>
                        {isPolish ? cfg.labelPl : cfg.labelEn}
                      </span>
                      <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                        {catAnswered}/{catQuestions.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-navy-800/50">
                      {catQuestions.map((q) => {
                        const answered = q.status === 'answered';
                        const qEvidence = evidence.filter((e) => e.questionId === q.id);
                        const hasFile = qEvidence.some(
                          (e) => e.evidenceType === 'file' || e.evidenceType === 'document'
                        );
                        const hasLink = qEvidence.some((e) => e.evidenceType === 'link');
                        const hasVoice = qEvidence.some(
                          (e) =>
                            e.evidenceType === 'voice' ||
                            e.evidenceType === 'audio' ||
                            (e.evidenceType === 'file' &&
                              (e.name || '').match(/\.(webm|mp3|wav|ogg|m4a)$/i))
                        );

                        return (
                          <div key={q.id} className="px-5 py-3 space-y-1.5">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 shrink-0">
                                {answered ? (
                                  <Check size={14} className="text-emerald-500" />
                                ) : q.isRequired ? (
                                  <CircleAlert size={14} className="text-rose-400" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-navy-600" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {q.questionText}
                                  {q.isRequired && (
                                    <span className="ml-1.5 text-[10px] text-rose-500">*</span>
                                  )}
                                </p>
                                {q.answerText ? (
                                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                                    {q.answerText}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-xs italic text-slate-400 dark:text-slate-500">
                                    {isPolish ? 'Brak odpowiedzi' : 'No answer'}
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Evidence completeness indicators */}
                            {(hasFile || hasLink || hasVoice) && (
                              <div className="flex items-center gap-2 ml-6">
                                {hasFile && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <Paperclip size={10} />
                                    {isPolish ? 'Plik' : 'File'}
                                  </span>
                                )}
                                {hasLink && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <Link2 size={10} />
                                    {isPolish ? 'Link' : 'Link'}
                                  </span>
                                )}
                                {hasVoice && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                    <Mic size={10} />
                                    {isPolish ? 'Głos' : 'Voice'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom reviewer actions (sticky-ish) */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl p-4 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Sprawdź kompletność odpowiedzi i dowodów przed podjęciem decyzji.'
                : 'Review answer completeness and evidence before making a decision.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSendBackForm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 dark:border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                aria-label={isPolish ? 'Odeślij do poprawy' : 'Send back for revision'}
              >
                <Send size={14} className="rotate-180" />
                {isPolish ? 'Odeślij' : 'Send back'}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-60 transition-all"
                aria-label={isPolish ? 'Zatwierdź wywiad' : 'Approve interview'}
              >
                {isApproving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ThumbsUp size={14} />
                )}
                {isPolish ? 'Zatwierdź' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          TWO-COLUMN GRID (hidden in reviewer mode)
          ========================================== */}
      {!isReviewerMode && <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ==========================================
              LEFT COLUMN - Category Navigation
              ========================================== */}
          <div className="lg:col-span-3 order-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Nawigacja' : 'Navigation'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {isPolish ? 'Sekcje pytań' : 'Question sections'}
                  </div>
                </div>

                <div className="p-3 space-y-1">
                  {CATEGORY_ORDER.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const Icon = cfg.icon;
                    const p = categoryProgress.find((x) => x.category === cat);
                    const isActive = cat === activeCategory;
                    const answered = p?.answeredQuestions || 0;
                    const total = p?.totalQuestions || 0;
                    const isComplete = Boolean(p?.isComplete);

                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          requestAnimationFrame(() => {
                            questionsTopRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'start',
                            });
                          });
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                          isActive
                            ? 'bg-primary-500/10 border-primary-500/30'
                            : 'bg-transparent border-transparent hover:bg-slate-50/80 dark:hover:bg-navy-800/50'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bgColor}`}
                        >
                          {isComplete ? (
                            <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Icon size={16} className={cfg.color} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {isPolish ? cfg.labelPl : cfg.labelEn}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {answered}/{total} {isPolish ? 'odp.' : 'ans.'}
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className={`shrink-0 ${isActive ? 'text-primary-400' : 'text-slate-300 dark:text-slate-600'}`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 border-t border-slate-200/60 dark:border-navy-700/60">
                  <button
                    onClick={() => {
                      const first = questions.find((q) => q.status !== 'answered');
                      if (first?.category) {
                        setActiveCategory(first.category as InterviewCategory);
                        requestAnimationFrame(() => {
                          questionsTopRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                        });
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-all"
                  >
                    <ArrowRight size={16} />
                    {isPolish ? 'Następne brakujące' : 'Next missing'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ==========================================
              MIDDLE COLUMN - Questions (Form)
              ========================================== */}
          <div className="lg:col-span-6 space-y-5 order-2">
            <div ref={questionsTopRef} />

            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden p-4">
              <RuntimeModeSelector
                currentMode={runtimeMode}
                recommendedMode="single_question"
                onModeSelect={handleRuntimeModeSelect}
                compact={runtimeMode === 'single_question'}
                locked={isLocked}
              />
            </div>

            {activeCategory && activeCategoryConfig ? (
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${activeCategoryConfig.bgColor}`}>
                      <ActiveCategoryIcon size={18} className={activeCategoryConfig.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {isPolish ? activeCategoryConfig.labelPl : activeCategoryConfig.labelEn}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {isPolish
                          ? activeCategoryConfig.descriptionPl
                          : activeCategoryConfig.descriptionEn}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {activeCategoryProgress?.answeredQuestions || 0}/
                      {activeCategoryProgress?.totalQuestions || 0}
                    </div>
                  </div>
                  {runtimeMode !== 'single_question' && (
                    <div className="mt-3 h-2 bg-slate-200/70 dark:bg-navy-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-500 transition-all"
                        style={{ width: `${activeCategoryPercent}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  {runtimeMode === 'single_question' ? (
                    <InterviewSingleQuestionRuntime
                      questions={questions}
                      evidence={evidence}
                      activeCategory={activeCategory}
                      onCategoryChange={setActiveCategory}
                      onUpdateQuestion={handleUpdateQuestion}
                      onUploadFile={handleUploadFile}
                      onAddLink={handleAddLink}
                      onAddVoiceEvidence={handleAddVoiceEvidence}
                      onSubmitSession={handleSubmitSession}
                      onSaveAndExit={onClose}
                      sessionName={sessionName}
                      readOnly={isLocked}
                    />
                  ) : (
                    <QuestionsList
                      questions={questions}
                      category={activeCategory}
                      runtimeMode={runtimeMode}
                      onUpdateQuestion={handleUpdateQuestion}
                      onAddQuestion={handleAddQuestion}
                      readOnly={isLocked}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden p-8 text-center">
                <FileText size={48} className="text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Wybierz sekcję pytań z lewej strony, aby rozpocząć'
                    : 'Select a question section from the left to begin'}
                </p>
              </div>
            )}

            {/* Notes Section */}
            {runtimeMode !== 'single_question' &&
              renderCollapsibleSection(
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
                  activeCategory={activeCategory}
                  onCreateNote={handleCreateNote}
                  onUpdateNote={handleUpdateNote}
                  onDeleteNote={handleDeleteNote}
                  readOnly={isLocked}
                />
              </div>
              )}

            {/* Evidence Section */}
            {runtimeMode !== 'single_question' &&
              renderCollapsibleSection(
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
                  activeCategory={activeCategory}
                  onUploadFile={handleUploadFile}
                  onAddLink={handleAddLink}
                  onAddComment={handleAddEvidenceComment}
                  onDeleteEvidence={handleDeleteEvidence}
                  readOnly={isLocked}
                />
              </div>
              )}

            {/* Summary Section (hide in assignment-fill mode to keep the form focused) */}
            {!isAssignmentMode &&
              runtimeMode !== 'single_question' &&
              renderCollapsibleSection(
                'summary',
                <Sparkles size={18} className="text-purple-500 dark:text-purple-400" />,
                isPolish ? 'Podsumowanie' : 'Summary',
                'bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20',
                undefined,
                undefined,
                <div className="p-5 space-y-6">
                  <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    ⚠️{' '}
                    {isPolish
                      ? 'Tylko fakty - bez rekomendacji i planów działań'
                      : 'Facts only - no recommendations or action plans'}
                  </p>

                  {/* Facts */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      {isPolish ? 'Najważniejsze fakty (as-is)' : 'Key Facts (as-is)'}
                    </h4>
                    {summaryData.facts.length > 0 ? (
                      <ul className="space-y-2">
                        {summaryData.facts.map((fact, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                          >
                            <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                            {fact}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        {isPolish
                          ? 'Fakty zostaną wygenerowane automatycznie'
                          : 'Facts will be generated automatically'}
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
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                          >
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
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                          >
                            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                            {constraint}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        {isPolish
                          ? 'Brak zidentyfikowanych ograniczeń'
                          : 'No constraints identified'}
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
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
                          >
                            <ChevronRight size={14} className="text-purple-500 mt-0.5 shrink-0" />
                            {pain}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        {isPolish
                          ? 'Brak zidentyfikowanych problemów'
                          : 'No pain points identified'}
                      </p>
                    )}
                  </div>
                </div>
              )}
          </div>

          {/* ==========================================
              RIGHT COLUMN - Context/Actions (sticky)
              ========================================== */}
          <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-24 self-start order-3">
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
                        ? new Date(session.startedAt).toLocaleDateString(
                            isPolish ? 'pl-PL' : 'en-US'
                          )
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
                        {new Date(session.lastActivityAt).toLocaleDateString(
                          isPolish ? 'pl-PL' : 'en-US'
                        )}
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
                    const percent =
                      cp.totalQuestions > 0
                        ? Math.round((cp.answeredQuestions / cp.totalQuestions) * 100)
                        : 0;
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
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, name: e.target.value })
                        }
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
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, industry: e.target.value })
                        }
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
                        onChange={(e) =>
                          setEditedProfile({ ...editedProfile, location: e.target.value })
                        }
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
                        {isSaving ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
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
                            <span className="text-slate-700 dark:text-slate-300">
                              {companyProfile.name}
                            </span>
                          </div>
                        )}
                        {companyProfile.industry && (
                          <div className="flex items-center gap-2 text-sm">
                            <Target size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {companyProfile.industry}
                            </span>
                          </div>
                        )}
                        {companyProfile.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {companyProfile.location}
                            </span>
                          </div>
                        )}
                        {companyProfile.size && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users size={14} className="text-slate-400" />
                            <span className="text-slate-700 dark:text-slate-300">
                              {companyProfile.size} {isPolish ? 'pracowników' : 'employees'}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        {isPolish
                          ? 'Kliknij edytuj aby dodać dane firmy'
                          : 'Click edit to add company data'}
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
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-navy-800"
                      >
                        <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <Users size={14} className="text-cyan-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                            {s.name}
                          </p>
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
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {gap.description}
                        </p>
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
              readOnly={isLocked}
              allowedTypes={['task', 'initiative', 'decision', 'project', 'assessment', 'report']}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />
          </div>
        </div>
      </div>}
    </div>
  );

  return (
    <NModeShell
      header={{
        title: sessionName,
        onTitleChange: setSessionName,
        titlePlaceholder: { en: 'Session name...', pl: 'Nazwa sesji...' },
        artifactId: session?.id,
        artifactType: 'tool',
        onSave: handleSave,
        saving: isSaving,
        isDirty,
        onChat: handleOpenChat,
        onClose: onClose || (() => {}),
        statusDotColor: statusConfig.color,
      }}
      properties={properties}
      sections={sections}
      actions={actions}
      actionsVisible={actions.length > 0}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      presentationMode="n"
      onPresentationModeChange={() => {}}
      showModeSwitcher={false}
      buildArtifactCode={(type, id) => buildArtifactCode(type as any, id)}
    >
      <div />
    </NModeShell>
  );
};

export default InterviewWorkspace;
