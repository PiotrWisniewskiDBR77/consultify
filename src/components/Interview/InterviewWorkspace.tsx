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
  ClipboardList,
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
import { LoadingState } from '@/components/ui/primitives';
import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
import {
  V8InterviewApi,
  type V8InterviewSessionEvaluation,
  type V8InterviewWeakAnswerItem,
} from '@/services/api/v8/interview';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { buildArtifactCode } from '@/utils/artifactLinks';

import { type LinkedItem, LinkedItemsSection } from '../MyWork/shared';
import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  CategoryProgress,
  InterviewCategory,
} from './CategorySidebar';
import { CompanyProfile, KeyMetric, OpenGap, Stakeholder } from './CompanyFactsPanel';
import { ConversationalPanel } from './ConversationalPanel';
import { EvidencePanel, InterviewEvidence } from './EvidencePanel';
import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';
import { InterviewSingleQuestionRuntime } from './InterviewSingleQuestionRuntime';
import { InterviewNote, NotesPanel } from './NotesPanel';
import { InterviewQuestion, QuestionsList } from './QuestionsList';
import { RuntimeMode, RuntimeModeSelector } from './RuntimeModeSelector';

type PersistedLinkedItem = LinkedItem & { edgeId?: string };

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

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

type InterviewAnswerEvaluation = V8InterviewSessionEvaluation;
type SendBackChecklistItem = {
  key: string;
  label: string;
  checked: boolean;
  questionId?: string;
  fixType?: V8InterviewWeakAnswerItem['fixType'];
};

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
  const isPolish = i18n.language?.startsWith('pl');
  // Standard-C parity: N⇄C presentation toggle for the non-immersive workspace
  // shell (matches Insight/Initiative). entityType 'tool' is reused because the
  // interview artifact already identifies as artifactType 'tool' (no dedicated
  // enum value exists in usePresentationMode's EntityType).
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'tool',
  });
  const { currentUser, currentOrganization } = useAppStore();
  const openChatWithContext = useOpenChatWithContext();
  const interviewDemoData = useMemo(
    () =>
      createInterviewDemoDataset({
        currentUserId: currentUser?.id,
        currentUserName: currentUser?.displayName || (currentUser as any)?.name,
        currentUserEmail: currentUser?.email,
        organizationId: currentOrganization?.id,
        organizationName: currentOrganization?.name,
      }),
    [
      currentOrganization?.id,
      currentOrganization?.name,
      currentUser?.displayName,
      currentUser?.email,
      currentUser?.id,
      (currentUser as any)?.name,
    ]
  );

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
  const [aiEvaluation, setAiEvaluation] = useState<InterviewAnswerEvaluation | null>(null);
  const [aiEvaluationUpdatedAt, setAiEvaluationUpdatedAt] = useState<string | null>(null);
  const [isAiEvaluating, setIsAiEvaluating] = useState(false);
  const [aiEvaluationError, setAiEvaluationError] = useState<string | null>(null);

  // #11 — Pre-submit AI quality gate
  const MIN_ANSWER_CHARS = 20;
  type QualityGateItem = {
    questionId: string;
    index: number;
    label: string;
    reason: string;
    category?: InterviewCategory;
  };
  const [qualityGate, setQualityGate] = useState<{
    open: boolean;
    items: QualityGateItem[];
    checking: boolean;
  }>({ open: false, items: [], checking: false });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<CompanyProfile>({});

  // IMPACT-UX-002: Degraded UX Error State
  const [loadError, setLoadError] = useState<{ message: string; isTransportBlock: boolean } | null>(
    null
  );

  // Expanded sections state - wszystkie sekcje domyślnie zamknięte dla czytelności
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

  // Locking rules:
  // - For assignments: approval is the final lock; submitted stays editable
  // - For ad-hoc sessions: lock on session completion
  const isLocked = useMemo(() => {
    const sessionStatus = (session?.status || '').toLowerCase();
    const asgStatus = (assignmentStatus || '').toLowerCase();
    const assignmentLocked =
      Boolean(session?.assignmentId) && ['approved', 'completed'].includes(asgStatus);
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
  const [sendBackMissingItems, setSendBackMissingItems] = useState<SendBackChecklistItem[]>([]);
  const [isSendingBack, setIsSendingBack] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSendBackForm, setShowSendBackForm] = useState(false);

  // Populate send-back checklist when entering reviewer mode
  useEffect(() => {
    if (!isReviewerMode) return;
    const items: SendBackChecklistItem[] = [];
    const weakAnswerMap = aiEvaluation?.weakAnswerMap || [];
    for (const weakItem of weakAnswerMap) {
      items.push({
        key: weakItem.key,
        label: `${weakItem.label} (${weakItem.fixType.replaceAll('_', ' ')})`,
        checked: true,
        questionId: weakItem.questionId,
        fixType: weakItem.fixType,
      });
    }
    const unansweredRequired = questions.filter((q) => q.isRequired && q.status !== 'answered');
    for (const q of unansweredRequired) {
      if (items.some((item) => item.questionId === q.id)) continue;
      items.push({
        key: `q_${q.id}`,
        label: q.questionText.length > 80 ? q.questionText.slice(0, 77) + '…' : q.questionText,
        checked: true,
        questionId: q.id,
        fixType: 'complete_required_fields',
      });
    }
    if (items.length === 0) {
      items.push({
        key: 'quality_gaps',
        label: isPolish ? 'Doprecyzuj kluczowe odpowiedzi' : 'Clarify key answers',
        checked: false,
      });
    }
    setSendBackMissingItems(items);
  }, [aiEvaluation?.weakAnswerMap, isReviewerMode, questions, isPolish]);

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
      color: 'bg-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400',
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
    if (raw === 'sent_back') return 'in_progress';
    if (raw === 'approved') return 'approved';
    if (raw === 'completed') return 'completed';
    if (raw === 'archived') return 'completed';
    return 'in_progress';
  }, [assignmentStatus, session?.status]);

  const reviewFeedback = useMemo(() => {
    const reason = String((assignmentInfo as any)?.sentBackReason || '').trim();
    const missingItems = Array.isArray((assignmentInfo as any)?.missingItems)
      ? ((assignmentInfo as any)?.missingItems as Array<{ key: string; label: string }>)
      : [];
    if (!reason && missingItems.length === 0) return null;
    if (String(assignmentStatus || '').toLowerCase() !== 'in_progress') return null;
    return { reason, missingItems };
  }, [assignmentInfo, assignmentStatus]);
  const aiVerdictLabel = useMemo(() => {
    switch (aiEvaluation?.overallVerdict) {
      case 'ready_for_approval':
        return isPolish ? 'Gotowe do zatwierdzenia' : 'Ready for approval';
      case 'needs_improvement':
        return isPolish ? 'Wymaga poprawy' : 'Needs improvement';
      case 'insufficient':
        return isPolish ? 'Niewystarczające' : 'Insufficient';
      case 'empty':
        return isPolish ? 'Brak danych' : 'Empty';
      default:
        return isPolish ? 'Brak oceny' : 'No review';
    }
  }, [aiEvaluation?.overallVerdict, isPolish]);
  const aiWeakAnswerMap = useMemo(() => aiEvaluation?.weakAnswerMap || [], [aiEvaluation]);
  const latestReviewDecision = useMemo(() => {
    const decisions = Array.isArray((assignmentInfo as any)?.reviewDecisionMemory)
      ? ((assignmentInfo as any)?.reviewDecisionMemory as Array<Record<string, unknown>>)
      : [];
    return decisions.length > 0 ? decisions[decisions.length - 1] : null;
  }, [assignmentInfo]);
  const statusConfig = STATUS_MAP[currentStatus] || STATUS_MAP.in_progress;

  // #3 — True lifecycle status for the read-back pill. Unlike `currentStatus`
  // (which collapses sent_back → in_progress so the respondent can resume
  // editing), this preserves `sent_back` so the header pill clearly shows a
  // session was returned for revision.
  const lifecycleStatus = useMemo(() => {
    const raw = String(assignmentStatus || session?.status || 'in_progress').toLowerCase();
    if (raw === 'active') return 'in_progress';
    if (raw === 'archived') return 'completed';
    if (
      ['assigned', 'in_progress', 'submitted', 'sent_back', 'approved', 'completed'].includes(raw)
    ) {
      return raw;
    }
    return 'in_progress';
  }, [assignmentStatus, session?.status]);
  const lifecycleConfig = STATUS_MAP[lifecycleStatus] || STATUS_MAP.in_progress;

  // #7 — Approve pre-condition messaging. The backend rejects Approve unless
  // completeness >= 50% (returns 409). Surface that threshold to the reviewer
  // BEFORE they click, using the answered/total ratio as the client-side proxy
  // for backend completeness so the disabled-state + hint stay in sync.
  const APPROVE_MIN_COMPLETENESS = 50;
  const completionPercent = useMemo(() => {
    const total = questions.length;
    if (total === 0) return 0;
    const answered = questions.filter((q) => q.status === 'answered').length;
    return Math.round((answered / total) * 100);
  }, [questions]);
  const canApprove = completionPercent >= APPROVE_MIN_COMPLETENESS;
  const approveBlockedHint = isPolish
    ? `Zatwierdzenie odblokowuje się przy ${APPROVE_MIN_COMPLETENESS}% kompletności — obecnie ${completionPercent}%.`
    : `Approve unlocks at ${APPROVE_MIN_COMPLETENESS}% completeness — currently ${completionPercent}%.`;

  // #11c — Live (non-blocking) per-answer guidance. Pure local heuristic, no
  // network: flags answers that are too short or required-but-empty so the
  // respondent gets instant feedback in the Overview before they ever submit.
  const liveWeakAnswers = useMemo(() => {
    const ordered = [...questions].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const out: Array<{ id: string; index: number; label: string; reason: string }> = [];
    ordered.forEach((q, i) => {
      const answer = (q.answerText || '').trim();
      const requiredEmpty = Boolean(q.isRequired) && answer.length === 0;
      const tooShort = answer.length > 0 && answer.length < MIN_ANSWER_CHARS;
      if (!requiredEmpty && !tooShort) return;
      out.push({
        id: q.id,
        index: i + 1,
        label: q.questionText.length > 80 ? `${q.questionText.slice(0, 77)}…` : q.questionText,
        reason: requiredEmpty
          ? isPolish
            ? 'wymagane — brak odpowiedzi'
            : 'required — no answer'
          : isPolish
            ? 'odpowiedź wygląda na zbyt krótką'
            : 'answer looks short',
      });
    });
    return out;
  }, [questions, isPolish]);

  const runAiQualityReview = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session?.id) return null;
      setIsAiEvaluating(true);
      setAiEvaluationError(null);
      try {
        const language = isPolish ? 'pl' : 'en';
        const result = (await V8InterviewApi.evaluateSessionAnswers(session.id, { language }).catch(
          () =>
            Api.post(`/interview/sessions/${session.id}/evaluate-answers`, {
              language,
            })
        )) as InterviewAnswerEvaluation;
        setAiEvaluation(result);
        setAiEvaluationUpdatedAt(new Date().toISOString());
        if (!opts?.silent) {
          toast.success(isPolish ? 'Ocena jakości AI jest gotowa.' : 'AI quality review is ready.');
        }
        return result;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to evaluate answers:', error);
        const message = isPolish
          ? 'Nie udało się uruchomić oceny AI'
          : 'Failed to run AI quality review';
        setAiEvaluationError(message);
        if (!opts?.silent) toast.error(message);
        return null;
      } finally {
        setIsAiEvaluating(false);
      }
    },
    [isPolish, session?.id]
  );

  // #11 — Compute weak answers for the pre-submit quality gate.
  // Combines a local heuristic (required-but-unanswered, or answered text that
  // is too short) with the AI evaluation's structured weak-answer map (if any).
  // Falls back silently to local-only when no AI signal is available.
  const computeWeakAnswers = useCallback(
    (evaluation?: InterviewAnswerEvaluation | null): QualityGateItem[] => {
      const orderedQuestions = [...questions].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      );
      const indexById = new Map<string, number>();
      orderedQuestions.forEach((q, i) => indexById.set(q.id, i + 1));

      const items = new Map<string, QualityGateItem>();
      const labelFor = (q: InterviewQuestion) =>
        q.questionText.length > 90 ? `${q.questionText.slice(0, 87)}…` : q.questionText;

      // Local heuristic — never relies on the AI backend being available.
      for (const q of orderedQuestions) {
        const answer = (q.answerText || '').trim();
        const tooShort = answer.length > 0 && answer.length < MIN_ANSWER_CHARS;
        const requiredEmpty = Boolean(q.isRequired) && answer.length === 0;
        if (!tooShort && !requiredEmpty) continue;
        items.set(q.id, {
          questionId: q.id,
          index: indexById.get(q.id) || 0,
          label: labelFor(q),
          category: q.category,
          reason: requiredEmpty
            ? isPolish
              ? 'Pytanie wymagane — brak odpowiedzi'
              : 'Required — no answer yet'
            : isPolish
              ? 'Odpowiedź wygląda na zbyt krótką'
              : 'Answer looks too short',
        });
      }

      // AI signal (optional) — augments / overrides reason text where present.
      const weakMap = evaluation?.weakAnswerMap || [];
      for (const weak of weakMap) {
        if (!weak.questionId) continue;
        if (weak.verdict === 'sufficient') continue;
        const q = questions.find((item) => item.id === weak.questionId);
        if (!q) continue;
        items.set(weak.questionId, {
          questionId: weak.questionId,
          index: indexById.get(weak.questionId) || 0,
          label: labelFor(q),
          category: q.category,
          reason:
            weak.feedback?.trim() ||
            (isPolish ? 'AI: wymaga doprecyzowania' : 'AI: needs improvement'),
        });
      }

      return Array.from(items.values()).sort((a, b) => a.index - b.index);
    },
    [questions, isPolish]
  );

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
        session?.runtimeModeDefault === 'task_list' ||
        session?.runtimeModeDefault === 'conversational'
      ) {
        setRuntimeMode(
          session?.assignmentId ? 'single_question' : (session?.runtimeModeDefault as RuntimeMode)
        );
      } else if (
        saved === 'single_question' ||
        saved === 'task_list' ||
        saved === 'conversational'
      ) {
        setRuntimeMode(saved);
      } else {
        setRuntimeMode('single_question');
      }
    } catch {
      setRuntimeMode(
        session?.assignmentId ? 'single_question' : session?.runtimeModeDefault || 'single_question'
      );
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
      const applyDemoSession = (sessionId: string) => {
        const demoDetail = interviewDemoData.sessionDetailsById[sessionId];
        if (!demoDetail) return false;

        const currentSession = demoDetail.session as InterviewSession;
        setSession(currentSession);
        setSessionName(currentSession.name || 'Discovery Interview');
        setQuestions(demoDetail.questions as InterviewQuestion[]);
        setNotes(demoDetail.notes as InterviewNote[]);
        setEvidence(demoDetail.evidence as InterviewEvidence[]);
        setLinkedItems((demoDetail.linkedItems || []) as PersistedLinkedItem[]);
        setCompanyProfile(demoDetail.companyProfile as CompanyProfile);
        setEditedProfile(demoDetail.companyProfile as CompanyProfile);
        setSummaryData(demoDetail.summary as SummaryData);

        const assignment =
          interviewDemoData.assignmentsBySessionId[sessionId] ||
          Object.values(interviewDemoData.assignmentsBySessionId).find(
            (item: any) => item?.id === currentSession.assignmentId
          ) ||
          null;
        setAssignmentStatus((assignment as any)?.status || null);
        setAssignmentInfo(assignment || null);
        onSessionChange?.(currentSession);
        return true;
      };

      setIsLoading(true);
      setLoadError(null);
      try {
        let currentSession: InterviewSession | null = null;

        if (initialSessionId && isInterviewDemoId(initialSessionId)) {
          if (applyDemoSession(initialSessionId)) return;
        }

        if (initialSessionId) {
          const sessionRes = await V8InterviewApi.getSession(initialSessionId)
            .then((res) => res.session)
            .catch(() => Api.get(`/interview/sessions/${initialSessionId}`))
            .catch(() => null);
          // Trust guard — only fall back to demo data when the id is genuinely
          // a demo id. Previously a failed REAL session load could surface demo
          // scaffolding under the real session name.
          if (
            !sessionRes &&
            isInterviewDemoId(initialSessionId) &&
            applyDemoSession(initialSessionId)
          )
            return;
          currentSession = sessionRes as InterviewSession | null;
        } else {
          const sessionsRes = await V8InterviewApi.getSessions('active')
            .then((res) => res.sessions)
            .catch(() => Api.get('/interview/sessions?status=active'))
            .catch(() => []);
          const sessions = Array.isArray(sessionsRes) ? sessionsRes : [];

          if (sessions.length > 0) {
            currentSession = sessions[0] as InterviewSession;
          } else {
            // Trust guard — when a real project has no active sessions, create a
            // real one. Never silently inject demo scaffolding under a real
            // project (a consultant must never mistake demo data for their own).
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

          const fetchOptional = async <T,>(request: Promise<T>, fallback: T): Promise<T> => {
            try {
              return await request;
            } catch (optionalError: any) {
              const status = Number(optionalError?.status || optionalError?.data?.status || 0);
              const code = String(optionalError?.code || optionalError?.data?.code || '');
              if (status >= 500 || code === 'CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN') {
                throw optionalError;
              }
              return fallback;
            }
          };

          const [
            questionsRes,
            notesRes,
            evidenceRes,
            contextRes,
            summaryRes,
            assignmentRes,
            linkedItemsRes,
          ] = await Promise.all([
            fetchOptional(Api.get(`/interview/sessions/${currentSession.id}/questions`), []),
            fetchOptional(Api.get(`/interview/sessions/${currentSession.id}/notes`), []),
            fetchOptional(Api.get(`/interview/sessions/${currentSession.id}/evidence`), []),
            fetchOptional(Api.get('/interview/context'), null),
            fetchOptional(Api.get(`/interview/sessions/${currentSession.id}/summary`), null),
            currentSession.assignmentId
              ? V8InterviewApi.getManagedAssignments()
                  .then(
                    (res) =>
                      (res.assignments || []).find(
                        (item) => item.id === currentSession?.assignmentId
                      ) || null
                  )
                  .catch(() =>
                    fetchOptional(
                      Api.get(`/interview/assignments/${currentSession.assignmentId}`),
                      null
                    )
                  )
                  .catch(() =>
                    fetchOptional(Api.get(`/interview/assignments/my?includeCompleted=true`), null)
                  )
              : Promise.resolve(null),
            fetchOptional(Api.get(`/interview/sessions/${currentSession.id}/linked-items`), []),
          ]);

          const demoFallback = interviewDemoData.sessionDetailsById[currentSession.id];

          setQuestions(
            Array.isArray(questionsRes) && questionsRes.length > 0
              ? questionsRes
              : (demoFallback?.questions as InterviewQuestion[]) || []
          );
          setNotes(
            Array.isArray(notesRes) && notesRes.length > 0
              ? notesRes
              : (demoFallback?.notes as InterviewNote[]) || []
          );
          setEvidence(
            Array.isArray(evidenceRes) && evidenceRes.length > 0
              ? evidenceRes
              : (demoFallback?.evidence as InterviewEvidence[]) || []
          );
          setLinkedItems(
            Array.isArray(linkedItemsRes) && linkedItemsRes.length > 0
              ? (linkedItemsRes as PersistedLinkedItem[])
              : (demoFallback?.linkedItems as PersistedLinkedItem[]) || []
          );

          if (currentSession.assignmentId) {
            const found =
              (Array.isArray(assignmentRes)
                ? assignmentRes.find((a: any) => a?.id === currentSession?.assignmentId)
                : assignmentRes) || interviewDemoData.assignmentsBySessionId[currentSession.id];
            setAssignmentStatus(found?.status || null);
            setAssignmentInfo(found || null);
            setAiEvaluation((found as any)?.aiReview || null);
            setAiEvaluationUpdatedAt((found as any)?.aiReviewedAt || null);
            if (String(found?.status || '').toLowerCase() === 'submitted') {
              void runAiQualityReview({ silent: true });
            } else {
              setAiEvaluationError(null);
            }
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
          } else if (demoFallback?.companyProfile) {
            setCompanyProfile(demoFallback.companyProfile as CompanyProfile);
            setEditedProfile(demoFallback.companyProfile as CompanyProfile);
          }

          if (summaryRes && typeof summaryRes === 'object') {
            const summary = summaryRes as SummaryData;
            setSummaryData({
              facts: summary.facts || currentSession.summaryFacts || [],
              gaps: summary.gaps || currentSession.summaryGaps || [],
              constraints: summary.constraints || currentSession.summaryConstraints || [],
              painPoints: summary.painPoints || currentSession.summaryPainPoints || [],
            });
          } else if (demoFallback?.summary) {
            setSummaryData(demoFallback.summary as SummaryData);
          }

          const resolvedQuestions =
            Array.isArray(questionsRes) && questionsRes.length > 0
              ? questionsRes
              : (demoFallback?.questions as InterviewQuestion[]) || [];
          if (!demoFallback && resolvedQuestions.length === 0) {
            setLoadError({
              message: isPolish
                ? 'Sesja wywiadu została załadowana, ale pytania nie zostały pobrane. Spróbuj ponownie lub sprawdź połączenie.'
                : 'Interview session loaded, but questions were not fetched. Retry or check the connection.',
              isTransportBlock: false,
            });
          }
        }
      } catch (error: any) {
        console.error('[InterviewWorkspace] Failed to load session:', error);
        if (initialSessionId && applyDemoSession(initialSessionId)) return;
        const isTransportBlock =
          error?.code === 'CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN' ||
          error?.message?.includes('transport safeguard');
        setLoadError({
          message:
            error?.message ||
            (isPolish ? 'Nie udało się załadować sesji' : 'Failed to load session'),
          isTransportBlock,
        });
        toast.error(isPolish ? 'Nie udało się załadować sesji' : 'Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [
    initialSessionId,
    interviewDemoData,
    isPolish,
    onSessionChange,
    projectId,
    runAiQualityReview,
  ]);

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
        const nextQuestions = questions.map((q) =>
          q.id === questionId ? { ...q, ...updated } : q
        );
        setQuestions(nextQuestions);
        const answeredQuestions = nextQuestions.filter((q) => q.status === 'answered').length;
        setSession((prev) => {
          if (!prev) return prev;
          const nextSession = {
            ...prev,
            answeredQuestions,
            totalQuestions: nextQuestions.length,
          };
          onSessionChange?.(nextSession);
          return nextSession;
        });
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to update question:', error);
        toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    },
    [session, questions, isPolish, onSessionChange]
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

  // Submit session — core action (no gate). Used directly when the quality
  // gate is bypassed or when there are no weak answers to flag.
  const performSubmit = useCallback(async () => {
    if (isSubmittingSession) return;
    if (!session) {
      toast.error(
        isPolish
          ? 'Nie udało się załadować sesji. Odśwież stronę i spróbuj ponownie.'
          : 'Session not loaded. Refresh the page and try again.'
      );
      return;
    }

    if (isLocked) {
      toast(
        isPolish
          ? 'Ten wywiad został już zatwierdzony i jest tylko do odczytu.'
          : 'This interview is already submitted and read-only.',
        { icon: 'ℹ️' }
      );
      return;
    }

    setIsSubmittingSession(true);
    const toastId = toast.loading(isPolish ? 'Wysyłam wywiad...' : 'Submitting interview...');

    try {
      if (session.assignmentId) {
        const result = (await V8InterviewApi.submitAssignment(session.assignmentId).catch(() =>
          Api.post(`/interview/assignments/${session.assignmentId}/submit`, {})
        )) as any;
        const updatedSession = (result as any)?.session;
        const updatedAssignment = (result as any)?.assignment;
        const completeness = (result as any)?.completenessPercent;
        if (updatedSession) {
          setSession(updatedSession);
          onSessionChange?.(updatedSession);
        }
        if (updatedAssignment?.status) {
          setAssignmentStatus(String(updatedAssignment.status));
          setAssignmentInfo((prev: any) => ({
            ...(prev || {}),
            ...updatedAssignment,
            sentBackAt: null,
            sentBackReason: null,
            missingItems: [],
          }));
        } else setAssignmentStatus('submitted');
        toast.success(
          isPolish
            ? `Wywiad wysłany do review (${completeness ?? 0}%).`
            : `Submitted for review (${completeness ?? 0}%).`,
          { id: toastId }
        );
        void runAiQualityReview({ silent: true });
        onComplete?.(session.id);
        onClose?.();
        return;
      }

      await withTimeout(
        Api.patch(`/interview/sessions/${session.id}`, { status: 'completed' }),
        15000,
        isPolish
          ? 'Przekroczono limit czasu podczas finalizacji wywiadu.'
          : 'Interview finalization timed out.'
      );
      setSession((prev) => {
        if (!prev) return prev;
        const now = new Date().toISOString();
        const nextSession = { ...prev, status: 'completed', completedAt: now, lastActivityAt: now };
        onSessionChange?.(nextSession);
        return nextSession;
      });
      toast.success(isPolish ? 'Wywiad zakończony!' : 'Interview completed!', { id: toastId });
      onComplete?.(session.id);
      onClose?.();
    } catch (error: any) {
      console.error('[InterviewWorkspace] Failed to submit session:', error);
      const apiMsg =
        error?.response?.data?.error || error?.response?.data?.message || error?.message;
      toast.error(
        apiMsg
          ? isPolish
            ? `Nie udało się zatwierdzić: ${apiMsg}`
            : `Failed to submit: ${apiMsg}`
          : isPolish
            ? 'Nie udało się zatwierdzić'
            : 'Failed to submit',
        { id: toastId }
      );
    } finally {
      setIsSubmittingSession(false);
    }
  }, [
    isLocked,
    isPolish,
    isSubmittingSession,
    onComplete,
    onSessionChange,
    runAiQualityReview,
    session,
  ]);

  // #11 — Pre-submit AI quality gate wrapper.
  // Before finalizing, evaluate answers (local heuristic + existing AI eval).
  // If some are too short/weak, show a skippable modal. If the AI evaluation
  // is unavailable the gate degrades to the local heuristic; if even that finds
  // nothing (or evaluation throws), we never block the user — submit proceeds.
  const handleSubmitSession = useCallback(
    async (opts?: { bypassGate?: boolean }) => {
      if (isSubmittingSession || qualityGate.checking) return;
      if (!session || isLocked) {
        await performSubmit();
        return;
      }

      if (opts?.bypassGate) {
        setQualityGate({ open: false, items: [], checking: false });
        await performSubmit();
        return;
      }

      setQualityGate((prev) => ({ ...prev, checking: true }));
      let evaluation: InterviewAnswerEvaluation | null = aiEvaluation;
      try {
        // Refresh the AI signal silently; tolerate failure (local-only fallback).
        const fresh = await withTimeout(
          runAiQualityReview({ silent: true }),
          12000,
          isPolish
            ? 'Przekroczono limit czasu oceny jakości AI.'
            : 'AI quality review timed out.'
        );
        if (fresh) evaluation = fresh;
      } catch {
        // ignore — fall back to whatever evaluation we already have
      }

      const weak = computeWeakAnswers(evaluation);
      if (weak.length === 0) {
        setQualityGate({ open: false, items: [], checking: false });
        await performSubmit();
        return;
      }

      setQualityGate({ open: true, items: weak, checking: false });
    },
    [
      aiEvaluation,
      computeWeakAnswers,
      isLocked,
      isSubmittingSession,
      performSubmit,
      qualityGate.checking,
      runAiQualityReview,
      session,
    ]
  );

  // #11 — "Go back and improve" jumps to the first flagged question.
  const handleQualityGateGoBack = useCallback(() => {
    const first = qualityGate.items[0];
    setQualityGate({ open: false, items: [], checking: false });
    if (first?.category) {
      setActiveCategory(first.category as InterviewCategory);
      setActiveSection('questions');
      requestAnimationFrame(() => {
        questionsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [qualityGate.items]);

  // V6-C04: Reviewer actions
  const handleSendBack = useCallback(async () => {
    if (!session?.assignmentId || !sendBackReason.trim()) return;
    setIsSendingBack(true);
    try {
      const missingItems = sendBackMissingItems
        .filter((item) => item.checked)
        .map((item) => ({
          key: item.key,
          label: item.label,
          questionId: item.questionId,
          fixType: item.fixType,
        }));
      const result = (await V8InterviewApi.sendBackAssignment(session.assignmentId, {
        reason: sendBackReason.trim(),
        missingItems,
      }).catch(() =>
        Api.post(`/interview/assignments/${session.assignmentId}/send-back`, {
          reason: sendBackReason.trim(),
          missingItems,
        })
      )) as any;
      const updatedAssignment = result?.assignment || result;
      const updatedSession = result?.session;
      if (updatedAssignment?.status) {
        setAssignmentStatus(String(updatedAssignment.status));
        setAssignmentInfo((prev: any) => ({ ...(prev || {}), ...updatedAssignment }));
      } else setAssignmentStatus('in_progress');
      if (updatedSession) {
        setSession(updatedSession);
        onSessionChange?.(updatedSession);
      }
      setAiEvaluation((updatedAssignment as any)?.aiReview || aiEvaluation);
      setAiEvaluationUpdatedAt((updatedAssignment as any)?.aiReviewedAt || aiEvaluationUpdatedAt);
      setAiEvaluationError(null);
      setShowSendBackForm(false);
      setSendBackReason('');
      toast.success(isPolish ? 'Wywiad odesłany do poprawy.' : 'Interview sent back for revision.');
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to send back:', error);
      toast.error(isPolish ? 'Nie udało się odesłać.' : 'Failed to send back.');
    } finally {
      setIsSendingBack(false);
    }
  }, [
    aiEvaluation,
    aiEvaluationUpdatedAt,
    isPolish,
    sendBackMissingItems,
    sendBackReason,
    session?.assignmentId,
  ]);

  const handleApprove = useCallback(async () => {
    if (!session?.assignmentId) return;
    setIsApproving(true);
    try {
      const result = (await V8InterviewApi.approveAssignment(session.assignmentId).catch(() =>
        Api.post(`/interview/assignments/${session.assignmentId}/approve`, {})
      )) as any;
      const updatedAssignment = (result as any)?.assignment;
      const updatedSession = (result as any)?.session;
      if (updatedAssignment?.status) {
        setAssignmentStatus(String(updatedAssignment.status));
        setAssignmentInfo((prev: any) => ({ ...(prev || {}), ...updatedAssignment }));
      } else setAssignmentStatus('approved');
      if (updatedSession) {
        setSession(updatedSession);
        onSessionChange?.(updatedSession);
      }
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
    void openChatWithContext({
      entityType: 'interview session',
      entityId: session.id,
      entityName: session.name,
      contextData: {
        sessionId: session.id,
        projectId: session.projectId || projectId || null,
        assignmentId: session.assignmentId || null,
        status: session.status,
        answeredQuestions: session.answeredQuestions,
        totalQuestions: session.totalQuestions,
      },
    });
  }, [openChatWithContext, projectId, session]);

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
            <ChevronDown size={18} className="text-slate-600" />
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
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
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
        <span className="text-xs font-medium text-slate-600 dark:text-slate-500">
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
        <LoadingState
          variant="spinner"
          label={isPolish ? 'Ładowanie wywiadu...' : 'Loading interview...'}
        />
      </div>
    );
  }

  // IMPACT-UX-002: Degraded UX Error State
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-screen bg-slate-50 dark:bg-navy-900 p-8 text-center">
        <CircleAlert className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          {loadError.isTransportBlock
            ? isPolish
              ? 'Ochrona przed pętlą zapytań (Transport Safeguard)'
              : 'Requests blocked by global transport safeguard'
            : isPolish
              ? 'Błąd pobierania danych'
              : 'Data Loading Error'}
        </h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">{loadError.message}</p>
        <button
          onClick={() => {
            setLoadError(null);
            setIsLoading(true);
            window.location.reload();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-md font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          {isPolish ? 'Spróbuj ponownie' : 'Retry'}
        </button>
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
        id: 'aiReview',
        label: { en: 'AI review', pl: 'Ocena AI' },
        type: 'text',
        value: aiVerdictLabel,
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

    if (isReviewerMode) {
      out.push({
        id: 'approve',
        label: { en: 'Approve', pl: 'Zatwierdź' },
        icon: ThumbsUp,
        variant: 'success',
        onClick: handleApprove,
        disabled: isApproving || isSendingBack || !canApprove,
        title: !canApprove ? { en: approveBlockedHint, pl: approveBlockedHint } : undefined,
      });
      out.push({
        id: 'send-back',
        label: { en: 'Send back', pl: 'Odeślij' },
        icon: AlertTriangle,
        variant: 'danger',
        onClick: () => setShowSendBackForm(true),
        disabled: isApproving || isSendingBack,
      });
    } else if (!isLocked) {
      if (isAssignmentMode) {
        out.push({
          id: 'submit',
          label: { en: 'Submit for review', pl: 'Wyślij do przeglądu' },
          icon: Send,
          variant: 'success',
          onClick: () => handleSubmitSession(),
          disabled: isSaving || isLocked || isSubmittingSession,
          loading: isSubmittingSession,
        });
      }
    }

    out.push({
      id: 'ai-review',
      label: { en: 'AI review', pl: 'Ocena AI' },
      icon: Sparkles,
      variant: 'neutral',
      onClick: () => {
        void runAiQualityReview();
      },
      disabled: isAiEvaluating || !session?.id,
    });
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
        {/* #3 — Lifecycle status read-back (assigned / in_progress / submitted /
            sent_back / approved / completed) via the canonical EntityStatusChip. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? 'Status:' : 'Status:'}
          </span>
          <EntityStatusChip
            status={lifecycleStatus}
            label={isPolish ? lifecycleConfig.label.pl : lifecycleConfig.label.en}
          />
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {completionPercent}% {isPolish ? 'ukończone' : 'complete'}
          </span>
        </div>
        {isReviewerMode && (
          <Callout variant="warning" title={isPolish ? 'Tryb recenzenta' : 'Reviewer mode'} compact>
            <div className="space-y-1">
              <p>
                {isPolish
                  ? 'Przeglądasz odpowiedzi do zatwierdzenia. Użyj przycisków "Zatwierdź" lub "Odeślij" w pasku akcji.'
                  : 'You are reviewing answers for approval. Use "Approve" or "Send back" in the action bar.'}
              </p>
              {!canApprove && <p className="font-medium">{approveBlockedHint}</p>}
            </div>
          </Callout>
        )}
        {!isReviewerMode && reviewFeedback && (
          <Callout
            variant="warning"
            title={isPolish ? 'Feedback od managera' : 'Manager feedback'}
            compact
          >
            <div className="space-y-2">
              {reviewFeedback.reason && <p>{reviewFeedback.reason}</p>}
              {reviewFeedback.missingItems.length > 0 && (
                <ul className="list-disc pl-4 space-y-1">
                  {reviewFeedback.missingItems.map((item) => (
                    <li key={item.key}>{item.label}</li>
                  ))}
                </ul>
              )}
            </div>
          </Callout>
        )}
        {(aiEvaluation || isAiEvaluating || aiEvaluationError) && (
          <Callout
            variant={
              aiEvaluation?.overallVerdict === 'ready_for_approval'
                ? 'success'
                : aiEvaluation?.overallVerdict === 'needs_improvement'
                  ? 'warning'
                  : aiEvaluation?.overallVerdict === 'insufficient'
                    ? 'critical'
                    : 'info'
            }
            title={isPolish ? 'AI quality review' : 'AI quality review'}
            compact
            action={{
              label: isAiEvaluating
                ? isPolish
                  ? 'Analiza...'
                  : 'Running...'
                : isPolish
                  ? 'Odśwież'
                  : 'Refresh',
              onClick: () => {
                void runAiQualityReview();
              },
            }}
          >
            {isAiEvaluating ? (
              <p>
                {isPolish
                  ? 'AI analizuje jakość odpowiedzi...'
                  : 'AI is reviewing answer quality...'}
              </p>
            ) : aiEvaluation ? (
              <div className="space-y-2">
                <p>
                  {isPolish ? 'Werdykt:' : 'Verdict:'} <strong>{aiVerdictLabel}</strong>
                  {' · '}
                  {isPolish ? 'Ocena:' : 'Score:'}{' '}
                  <strong>{aiEvaluation.overallScore.toFixed(1)}/5</strong>
                </p>
                {aiWeakAnswerMap.length > 0 && (
                  <div>
                    <p className="font-medium">
                      {isPolish ? 'Structured weak-answer map:' : 'Structured weak-answer map:'}
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      {aiWeakAnswerMap.slice(0, 5).map((item) => (
                        <li key={item.key}>
                          <strong>{item.label}</strong>
                          {' · '}
                          {item.fixType.replaceAll('_', ' ')}
                          {' · '}
                          {item.feedback}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestReviewDecision && (
                  <p className="text-xs opacity-80">
                    {isPolish ? 'Ostatnia decyzja review:' : 'Latest review decision:'}{' '}
                    <strong>{String(latestReviewDecision.action || '-')}</strong>
                    {' · '}
                    {isPolish ? 'AI alignment:' : 'AI alignment:'}{' '}
                    <strong>{String(latestReviewDecision.alignment || '-')}</strong>
                  </p>
                )}
                {aiEvaluation.recommendations.length > 0 && (
                  <div>
                    <p className="font-medium">
                      {isPolish ? 'Sugestie AI:' : 'AI recommendations:'}
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      {aiEvaluation.recommendations.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiEvaluationUpdatedAt && (
                  <p className="text-xs opacity-80">
                    {isPolish ? 'Ostatnia analiza:' : 'Last review:'}{' '}
                    {new Date(aiEvaluationUpdatedAt).toLocaleString(isPolish ? 'pl-PL' : 'en-US')}
                  </p>
                )}
              </div>
            ) : (
              <p>{aiEvaluationError}</p>
            )}
          </Callout>
        )}
        {showSendBackForm && isReviewerMode && (
          <div className="rounded-xl border border-amber-200/70 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 p-4 space-y-3 mt-2">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {isPolish ? 'Powód odesłania:' : 'Reason for sending back:'}
            </p>
            <textarea
              value={sendBackReason}
              onChange={(e) => setSendBackReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-navy-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder={
                isPolish ? 'Opisz co wymaga poprawy...' : 'Describe what needs improvement...'
              }
            />
            {sendBackMissingItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {isPolish ? 'Brakujące elementy:' : 'Missing items:'}
                </p>
                {sendBackMissingItems.map((item, idx) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => {
                        setSendBackMissingItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it))
                        );
                      }}
                      className="rounded"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSendBack}
                disabled={!sendBackReason.trim() || isSendingBack}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {isSendingBack ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {isPolish ? 'Odeślij' : 'Send back'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSendBackForm(false);
                  setSendBackReason('');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 dark:border-navy-700/70 px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 transition-colors"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
        <Callout
          variant={isReviewerMode ? 'info' : isLocked ? 'info' : 'purple'}
          title={
            isReviewerMode
              ? isPolish
                ? 'Status przeglądu'
                : 'Review status'
              : isLocked
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
          {isReviewerMode
            ? isPolish
              ? `Przeglądasz zgłoszoną wersję. Respondent nadal może ją edytować do czasu zatwierdzenia.`
              : `You are reviewing a submitted version. The respondent can still edit until approval.`
            : currentStatus === 'submitted'
              ? isPolish
                ? `Wysłane do review. Nadal możesz edytować odpowiedzi i wysłać je ponownie.`
                : `Submitted for review. You can keep editing and submit again.`
              : isPolish
                ? `Postęp: ${answeredQuestions}/${totalQuestions} (${overallPercent}%).`
                : `Progress: ${answeredQuestions}/${totalQuestions} (${overallPercent}%).`}
        </Callout>
        {!isReviewerMode && !isLocked && liveWeakAnswers.length > 0 && (
          <Callout
            variant="warning"
            title={
              isPolish
                ? `${liveWeakAnswers.length} odpowiedzi do dopracowania`
                : `${liveWeakAnswers.length} answer(s) need more detail`
            }
            compact
            action={{
              label: isPolish ? 'Przejdź do pierwszej' : 'Go to first',
              onClick: () => {
                const first = liveWeakAnswers[0];
                const q = questions.find((item) => item.id === first?.id);
                if (q?.category) {
                  setActiveCategory(q.category as InterviewCategory);
                  setActiveSection('questions');
                  requestAnimationFrame(() => {
                    questionsTopRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  });
                }
              },
            }}
          >
            <p className="mb-1">
              {isPolish
                ? 'Te odpowiedzi wyglądają na krótkie — dodaj szczegóły lub przykłady (to tylko podpowiedź).'
                : 'These answers look short — add detail or examples (this is just a hint).'}
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {liveWeakAnswers.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <strong className="tabular-nums">#{item.index}</strong> {item.label}
                  {' · '}
                  <span className="opacity-80">{item.reason}</span>
                </li>
              ))}
            </ul>
          </Callout>
        )}
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

        {runtimeMode === 'conversational' && session?.id ? (
          <ConversationalPanel
            sessionId={session.id}
            questions={questions.map((q) => ({
              id: q.id,
              questionText: q.questionText,
              category: String(q.category),
              status: String(q.status),
            }))}
            onQuestionAnswered={(questionId, answerText) => {
              handleUpdateQuestion(questionId, { answerText, status: 'answered' as any });
            }}
            locked={isLocked}
          />
        ) : runtimeMode === 'single_question' ? (
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
              isSubmitting={isSubmittingSession}
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
                    <cfg.icon
                      size={14}
                      className={isActive ? 'text-primary-500' : 'text-slate-600'}
                    />
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
      <NModeSectionWrapper heading={{ en: 'Files & links', pl: 'Pliki i linki' }}>
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
                      <Building2 size={14} className="text-slate-600" /> {companyProfile.name}
                    </div>
                    {companyProfile.industry && (
                      <div className="text-xs text-slate-500">{companyProfile.industry}</div>
                    )}
                    {companyProfile.location && (
                      <div className="text-xs text-slate-500">{companyProfile.location}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-600">
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
              <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                <Users size={14} className="text-blue-500" />
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
                  ? 'border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10'
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

    // Standard-C group labels (#22b) — bilingual headers for the C-board tabs
    // and the grouped N-mode nav. Three lanes: the live interview, supporting
    // context, and the read-only summary.
    const groupInterview = isPolish ? 'Wywiad' : 'Interview';
    const groupContext = isPolish ? 'Kontekst' : 'Context';
    const groupSummary = isPolish ? 'Podsumowanie' : 'Summary';

    const base: NModeSection[] = [
      {
        id: 'overview',
        icon: BarChart3,
        label: { en: 'Overview', pl: 'Podgląd' },
        group: groupInterview,
        cSpan: 2,
        component: overview,
      },
      {
        id: 'questions',
        icon: FileText,
        label: { en: 'Questions', pl: 'Pytania' },
        badge: questions.filter((q) => q.status !== 'answered').length,
        // Full width: the interactive fill/answer flow has its own internal
        // layout and must breathe — never cram it into a 1-col board panel.
        group: groupInterview,
        cSpan: 3,
        component: questionsSection,
      },
      {
        id: 'notes',
        icon: FileText,
        label: { en: 'Notes', pl: 'Notatki' },
        badge: notes.length,
        group: groupInterview,
        cSpan: 2,
        component: notesSection,
      },
      {
        id: 'evidence',
        icon: Paperclip,
        label: { en: 'Files & links', pl: 'Pliki i linki' },
        badge: evidence.length,
        group: groupContext,
        cSpan: 1,
        component: evidenceSection,
      },
      {
        id: 'company-facts',
        icon: Building2,
        label: { en: 'Company facts', pl: 'Fakty' },
        group: groupContext,
        cSpan: 1,
        component: companyFactsSection,
      },
      {
        id: 'stakeholders',
        icon: Users,
        label: { en: 'Stakeholders', pl: 'Interesariusze' },
        badge: stakeholders.length,
        group: groupContext,
        cSpan: 1,
        component: stakeholdersSection,
      },
      {
        id: 'open-gaps',
        icon: AlertTriangle,
        label: { en: 'Open gaps', pl: 'Luki' },
        badge: openGaps.length,
        group: groupContext,
        cSpan: 2,
        component: gapsSection,
      },
    ];

    if (!isAssignmentMode) {
      base.push({
        id: 'summary',
        icon: Sparkles,
        label: { en: 'Summary', pl: 'Podsumowanie' },
        group: groupSummary,
        cSpan: 3,
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
                <div className="text-sm text-slate-600">
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

  // #11 — Pre-submit AI quality gate modal (shared across render branches).
  const qualityGateModal = (
    <AnimatePresence>
      {qualityGate.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setQualityGate({ open: false, items: [], checking: false })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200/70 dark:border-navy-700/70 bg-white dark:bg-navy-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {isPolish
                    ? 'Niektóre odpowiedzi wyglądają na zbyt krótkie'
                    : 'Some answers look too short'}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Możesz je poprawić teraz albo wysłać mimo to — to tylko podpowiedź, nie blokada.'
                    : 'You can improve them now or submit anyway — this is a hint, not a hard block.'}
                </p>
              </div>
            </div>

            <div className="px-5 pb-2 max-h-64 overflow-y-auto">
              <ul className="space-y-2">
                {qualityGate.items.map((item) => (
                  <li
                    key={item.questionId}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/70 dark:border-navy-700/70 bg-slate-50/70 dark:bg-navy-800/40 px-3 py-2"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {item.index || '•'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">{item.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200/70 dark:border-navy-700/70">
              <button
                type="button"
                onClick={handleQualityGateGoBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 dark:border-navy-700/70 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-navy-900/40 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <ChevronLeft size={16} />
                {isPolish ? 'Wróć i popraw' : 'Go back and improve'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSubmitSession({ bypassGate: true });
                }}
                disabled={isSubmittingSession}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {isSubmittingSession ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {isPolish ? 'Wyślij mimo to' : 'Submit anyway'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Immersive single-question mode: bypass NModeShell entirely ──
  if (runtimeMode === 'single_question') {
    const answeredCount = questions.filter((q) => q.status === 'answered').length;
    const totalCount = questions.length;
    const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

    const ensureCategory = () => {
      if (!activeCategory) {
        const first = questions.find((q) => q.status !== 'answered') || questions[0];
        if (first?.category) setActiveCategory(first.category);
      }
    };

    return (
      <>
        {qualityGateModal}
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-navy-950 dark:via-[#0a0f1e] dark:to-navy-950">
          {/* Minimal top bar */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.04] dark:bg-white/[0.02] backdrop-blur-xl">
            <button
              type="button"
              onClick={onClose || (() => {})}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ChevronLeft size={16} />
              {isPolish ? 'Wróć' : 'Back'}
            </button>
            <div className="h-4 w-px bg-white/[0.08]" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[300px]">
              {sessionName || (isPolish ? 'Sesja wywiadu' : 'Interview session')}
            </span>
            <EntityStatusChip
              status={lifecycleStatus}
              label={isPolish ? lifecycleConfig.label.pl : lifecycleConfig.label.en}
            />
            <div className="flex-1" />
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-500">
              {answeredCount}/{totalCount}
            </span>
            <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-500">
              {progressPct}%
            </span>
            <div className="h-4 w-px bg-white/[0.08]" />
            {isReviewerMode ? (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                  <Shield size={10} />
                  {isPolish ? 'Recenzja' : 'Review'}
                </span>
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || !canApprove}
                  title={!canApprove ? approveBlockedHint : undefined}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ThumbsUp size={13} />
                  )}
                  {isPolish ? 'Zatwierdź' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSendBackForm(true)}
                  disabled={isSendingBack}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                >
                  <AlertTriangle size={13} />
                  {isPolish ? 'Odeślij' : 'Send back'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {isPolish ? 'Zapisz' : 'Save'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleRuntimeModeSelect('task_list')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={isPolish ? 'Przełącz na widok listy' : 'Switch to list view'}
            >
              <ArrowRight size={13} />
              {isPolish ? 'Lista' : 'List'}
            </button>
          </div>

          {/* #7 — Approve pre-condition hint (immersive reviewer mode) */}
          {isReviewerMode && !canApprove && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b border-amber-500/20 bg-amber-500/[0.06] text-[11px] font-medium text-amber-600 dark:text-amber-300">
              <AlertTriangle size={12} />
              {approveBlockedHint}
            </div>
          )}

          {/* Send-back form (immersive mode) */}
          {showSendBackForm && isReviewerMode && (
            <div className="shrink-0 px-6 py-3 border-b border-white/[0.06] bg-amber-500/[0.04]">
              <div className="max-w-2xl mx-auto space-y-3">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {isPolish ? 'Powód odesłania:' : 'Reason for sending back:'}
                </p>
                <textarea
                  value={sendBackReason}
                  onChange={(e) => setSendBackReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-navy-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder={
                    isPolish ? 'Opisz co wymaga poprawy...' : 'Describe what needs improvement...'
                  }
                />
                {sendBackMissingItems.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {sendBackMissingItems.map((item, idx) => (
                      <label
                        key={item.key}
                        className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => {
                            setSendBackMissingItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, checked: !it.checked } : it
                              )
                            );
                          }}
                          className="rounded"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSendBack}
                    disabled={!sendBackReason.trim() || isSendingBack}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    {isSendingBack ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    {isPolish ? 'Odeślij' : 'Send back'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendBackForm(false);
                      setSendBackReason('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors"
                  >
                    {isPolish ? 'Anuluj' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Immersive runtime -- no category gate, flat question list */}
          <div className="flex-1 min-h-0">
            {totalCount > 0 ? (
              <InterviewSingleQuestionRuntime
                questions={questions}
                evidence={evidence}
                activeCategory={activeCategory || 'strategy'}
                onCategoryChange={setActiveCategory}
                onUpdateQuestion={handleUpdateQuestion}
                onUploadFile={handleUploadFile}
                onAddLink={handleAddLink}
                onAddVoiceEvidence={handleAddVoiceEvidence}
                onSubmitSession={handleSubmitSession}
                onSaveAndExit={onClose}
                sessionName={sessionName}
                readOnly={isLocked}
                isSubmitting={isSubmittingSession}
                immersive
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="max-w-md text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-500/10">
                    <ClipboardList size={28} className="text-primary-500" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak pytań w tej sesji.' : 'No questions in this session.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {qualityGateModal}
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
        presentationMode={presentationMode}
        onPresentationModeChange={setPresentationMode}
        showModeSwitcher={true}
        buildArtifactCode={(type, id) => buildArtifactCode(type as any, id)}
      >
        <div />
      </NModeShell>
    </>
  );
};

export default InterviewWorkspace;
