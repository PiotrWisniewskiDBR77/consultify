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
  Save,
  Send,
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
  type CardLayout,
  type NModeAction,
  NModeActionBar,
  NModeCardManager,
  type NModePropertyField,
  type NModeSection,
  NModeSectionWrapper,
  NModeShell,
  useCardLayout,
} from '@/components/shared/NModeLayout';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
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

import { loadInterviewV8Capability } from './interviewBackendRouting';

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
// MIGRACJA (D-8): kompozycja kart Interview wyprowadzona z WIĄŻĄCEGO kontraktu
// karty (cardContract.types.ts) zamiast z luźnej tablicy NModeSection[] —
// patrz interviewCardContract.ts. Za flagą (default OFF), zero regresji na demo.
import { INTERVIEW_CARD_RENDER_IDS, INTERVIEW_CARD_SPEC } from './interviewCardContract';
import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';
import { InterviewSingleQuestionRuntime } from './InterviewSingleQuestionRuntime';
import { InterviewNote, NotesPanel } from './NotesPanel';
import { InterviewQuestion, QuestionsList } from './QuestionsList';
import { RuntimeMode, RuntimeModeSelector } from './RuntimeModeSelector';

type PersistedLinkedItem = LinkedItem & { edgeId?: string };

export function calculateInterviewProgress(
  questions: Array<Pick<InterviewQuestion, 'status'>>
): { totalQuestions: number; answeredQuestions: number; overallPercent: number } {
  const totalQuestions = questions.length;
  const answeredQuestions = questions.filter((question) => question.status === 'answered').length;
  return {
    totalQuestions,
    answeredQuestions,
    overallPercent:
      totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0,
  };
}

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

// MIGRACJA (D-8, przepis §KROK 3) — kompozycja kart Interview przez WIĄŻĄCY
// kontrakt karty. Default OFF (zero regresji na demo). Opt-in URL `?cardContract=1`
// oraz localStorage `ff.cardContract` działają TAKŻE na produkcji (bez DEV guardu) —
// żeby Piotr mógł włączyć kontrakt tylko sobie jednym linkiem. Kolejność: URL →
// localStorage → env → OFF. Wzór: isInitiativeCardContractEnabled.
function parseCardContractFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

function useInterviewCardContractEnabled(): boolean {
  return useMemo(() => {
    if (typeof window !== 'undefined' && window.location) {
      try {
        const q = parseCardContractFlag(
          new URLSearchParams(window.location.search).get('cardContract')
        );
        if (q !== null) {
          try {
            window.localStorage.setItem('ff.cardContract', q ? '1' : '0');
          } catch {
            /* ignore */
          }
          return q;
        }
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const ls = parseCardContractFlag(window.localStorage.getItem('ff.cardContract'));
        if (ls !== null) return ls;
      } catch {
        /* ignore */
      }
    }
    if (import.meta.env.VITE_VF1_INTERVIEW_CARD_CONTRACT === 'true') return true;
    return false;
  }, []);
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
  const { t, i18n } = useTranslation();
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
  // L-07 / SPEC_13 §5.1 — 'hard' = objective insufficiency (required question with
  // no answer); these BLOCK submit with no "submit anyway" escape. 'soft' = quality
  // hints (too short / AI needs_improvement); these stay skippable.
  type QualityGateItem = {
    questionId: string;
    index: number;
    label: string;
    reason: string;
    category?: InterviewCategory;
    severity: 'hard' | 'soft';
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

  // #48B — "poprzednia wersja": load answer-history snapshots (taken on a
  // prior send-back) for the reviewer view. Fail-open: on any error the map
  // just stays empty and the per-question disclosure simply doesn't render —
  // no impact on review/approve/send-back itself.
  const [answerHistoryByQuestionId, setAnswerHistoryByQuestionId] = useState<
    Record<string, Array<{ id: string; answerText: string | null; savedAt: string }>>
  >({});

  useEffect(() => {
    if (!isReviewerMode || !session?.assignmentId) {
      setAnswerHistoryByQuestionId({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await Api.get(
          `/interview/assignments/${session.assignmentId}/answer-history`
        );
        if (!cancelled) {
          setAnswerHistoryByQuestionId((result as any)?.byQuestion || {});
        }
      } catch {
        if (!cancelled) setAnswerHistoryByQuestionId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReviewerMode, session?.assignmentId]);

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
        label: t('interview.workspace.clarifyKeyAnswers'),
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
  // The persisted Interview contract also permits organization-defined
  // categories (for example `process`, `risk` and `improvement`).  Computing
  // the headline progress from CATEGORY_ORDER silently discarded those
  // questions, so the same submitted session rendered as 3/3 in its navigator
  // but 0/0 in the properties rail.  The overall counter is a property of the
  // complete session, not only of the built-in navigation groups.
  const { totalQuestions, answeredQuestions, overallPercent } = calculateInterviewProgress(questions);
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
      color: 'bg-c-surface-raised',
      textColor: 'text-c-text-muted',
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
      color: 'bg-c-danger',
      textColor: 'text-c-danger',
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
        return t('interview.workspace.readyForApproval');
      case 'needs_improvement':
        return t('interview.workspace.needsImprovement');
      case 'insufficient':
        return t('interview.workspace.insufficient');
      case 'empty':
        return t('interview.workspace.empty');
      default:
        return t('interview.workspace.noReview');
    }
    // `t` MUSI byc w zaleznosciach. Tlumaczenia ladowane sa asynchronicznie
    // (HttpBackend); memo policzone PRZED ich zaladowaniem zwraca surowy klucz
    // ('interview.workspace.noReview') i bez `t` w deps NIGDY sie nie przelicza —
    // klucz zostaje na ekranie na stale. Znalezione wzrokiem w harnessie
    // 2026-07-21; `isPolish` nie wystarcza, bo zmienia sie przy zmianie jezyka,
    // a nie w momencie doczytania zasobu.
  }, [aiEvaluation?.overallVerdict, isPolish, t]);
  const aiWeakAnswerMap = useMemo(() => aiEvaluation?.weakAnswerMap || [], [aiEvaluation]);
  const latestReviewDecision = useMemo(() => {
    const decisions = Array.isArray((assignmentInfo as any)?.reviewDecisionMemory)
      ? ((assignmentInfo as any)?.reviewDecisionMemory as Array<Record<string, unknown>>)
      : [];
    return decisions.length > 0 ? decisions[decisions.length - 1] : null;
  }, [assignmentInfo]);
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
  const approveBlockedHint = t('interview.workspace.approveBlockedHint', {
    min: APPROVE_MIN_COMPLETENESS,
    current: completionPercent,
  });

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
          ? t('interview.workspace.requiredNoAnswer')
          : t('interview.workspace.answerLooksShort'),
      });
    });
    return out;
  }, [
    questions,
    isPolish,
    /* + t: tlumaczenia ladowane async — bez tego memo zwraca surowy klucz na stale (2026-07-21) */ t,
  ]);

  const runAiQualityReview = useCallback(
    // INT-DELIVERY-OPS-001 (2): `signal` is an optional settled-guard. The
    // caller-side `withTimeout()` races this promise against a timer but has
    // no way to cancel it — the loser keeps running and, without this guard,
    // still called setAiEvaluation(...) after the caller already moved on
    // with the timeout fallback (state clobbered by a stale late resolve). A
    // caller that wraps this call in withTimeout creates a `{ cancelled: false }`
    // object, passes it in, and flips `cancelled = true` in the timeout's catch
    // branch; this function then skips its state writes for that call.
    async (opts?: { silent?: boolean; signal?: { cancelled: boolean } }) => {
      if (!session?.id) return null;
      setIsAiEvaluating(true);
      setAiEvaluationError(null);
      try {
        const language = isPolish ? 'pl' : 'en';
        const result = (await loadInterviewV8Capability('evaluation', () =>
          V8InterviewApi.evaluateSessionAnswers(session.id, { language })
        )) as InterviewAnswerEvaluation;
        if (opts?.signal?.cancelled) return result;
        setAiEvaluation(result);
        setAiEvaluationUpdatedAt(new Date().toISOString());
        if (!opts?.silent) {
          toast.success(t('interview.workspace.aiQualityReviewIsReady'));
        }
        return result;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to evaluate answers:', error);
        if (opts?.signal?.cancelled) return null;
        const message = t('interview.workspace.failedToRunAiQuality');
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
      // required-but-empty = HARD floor (objective); too-short = SOFT hint.
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
          severity: requiredEmpty ? 'hard' : 'soft',
          reason: requiredEmpty
            ? t('interview.workspace.requiredNoAnswerYet')
            : t('interview.workspace.answerLooksTooShort'),
        });
      }

      // AI signal (optional) — augments / overrides reason text where present.
      // verdict 'insufficient'/'unanswered' = HARD floor; 'needs_improvement' = SOFT.
      const weakMap = evaluation?.weakAnswerMap || [];
      for (const weak of weakMap) {
        if (!weak.questionId) continue;
        if (weak.verdict === 'sufficient') continue;
        const q = questions.find((item) => item.id === weak.questionId);
        if (!q) continue;
        const aiHard = weak.verdict === 'insufficient' || weak.verdict === 'unanswered';
        const existing = items.get(weak.questionId);
        items.set(weak.questionId, {
          questionId: weak.questionId,
          index: indexById.get(weak.questionId) || 0,
          label: labelFor(q),
          category: q.category,
          // never downgrade an item the local heuristic already flagged as hard.
          severity: existing?.severity === 'hard' || aiHard ? 'hard' : 'soft',
          // #48A — prefer the concrete depth nudge ("this answer could be
          // deeper: Depth") over the generic LLM feedback sentence when present;
          // same reason field the modal already renders, no new UI.
          reason:
            weak.depthHint?.trim() ||
            weak.feedback?.trim() ||
            t('interview.workspace.aiNeedsImprovement'),
        });
      }

      return Array.from(items.values()).sort((a, b) => {
        // hard items first, then by order
        if (a.severity !== b.severity) return a.severity === 'hard' ? -1 : 1;
        return a.index - b.index;
      });
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
              message: t('interview.workspace.interviewSessionLoadedButQuestions'),
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
          message: error?.message || t('interview.workspace.failedToLoadSession'),
          isTransportBlock,
        });
        toast.error(t('interview.workspace.failedToLoadSession'));
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
        // INT-DELIVERY-OPS-001: answer writes are never last-write-wins. A
        // legacy/cached object without a token is refreshed before mutation;
        // if the server still cannot provide a token, fail locally instead of
        // sending an unguarded write that the backend correctly rejects (428).
        let current = questions.find((q) => q.id === questionId);
        if (!current?.updatedAt) {
          const refreshed = (await Api.get(
            `/interview/sessions/${session.id}/questions`
          )) as InterviewQuestion[];
          current = refreshed.find((q) => q.id === questionId);
          setQuestions(refreshed);
        }
        if (!current?.updatedAt) {
          throw Object.assign(new Error('Answer version is unavailable'), { status: 428 });
        }
        const payload = { ...updates, expectedUpdatedAt: current.updatedAt };
        const updated = await Api.patch(`/interview/questions/${questionId}`, payload);
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
      } catch (error: any) {
        console.error('[InterviewWorkspace] Failed to update question:', error);
        if (error?.status === 409) {
          toast.error(
            isPolish
              ? 'Ktoś inny zaktualizował tę odpowiedź w międzyczasie. Odśwież i spróbuj ponownie.'
              : 'This answer was updated elsewhere. Reload and try again.'
          );
        } else if (error?.status === 428) {
          toast.error(
            isPolish
              ? 'Nie udało się ustalić wersji odpowiedzi. Odśwież wywiad i spróbuj ponownie.'
              : 'The answer version is unavailable. Reload the interview and try again.'
          );
        } else {
          toast.error(t('interview.workspace.failedToSave'));
        }
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
        toast.error(t('interview.workspace.failedToAddQuestion'));
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
        toast.error(t('interview.workspace.failedToCreateNote'));
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
        toast.error(t('interview.workspace.failedToSaveNote'));
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
        toast.error(t('interview.workspace.failedToDeleteNote'));
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
        toast.success(t('interview.workspace.fileAdded'));
        return created as InterviewEvidence;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to upload file:', error);
        toast.error(t('interview.workspace.failedToUploadFile'));
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
        toast.error(t('interview.workspace.failedToAddLink'));
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
          title: t('interview.workspace.contextComment'),
          description: text,
          category,
        });
        setEvidence((prev) => [...prev, created as InterviewEvidence]);
        toast.success(t('interview.workspace.commentAdded'));
        return created as InterviewEvidence;
      } catch (error) {
        console.error('[InterviewWorkspace] Failed to add comment evidence:', error);
        toast.error(t('interview.workspace.failedToAddComment'));
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
        toast.error(t('interview.workspace.failedToSaveRecording'));
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
        toast.error(t('interview.workspace.failedToDelete'));
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
      toast.success(t('interview.workspace.profileSaved'));
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to update profile:', error);
      toast.error(t('interview.workspace.failedToSaveProfile'));
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
      toast.success(t('interview.workspace.saved'));
      // Keep local session state in sync (used for isDirty and title)
      setSession((prev) => (prev ? { ...prev, name: sessionName } : prev));
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to save:', error);
      toast.error(t('interview.workspace.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  }, [session, sessionName, isPolish]);

  // Submit session — core action (no gate). Used directly when the quality
  // gate is bypassed or when there are no weak answers to flag.
  const performSubmit = useCallback(async () => {
    if (isSubmittingSession) return;
    if (!session) {
      toast.error(t('interview.workspace.sessionNotLoadedRefreshThe'));
      return;
    }

    if (isLocked) {
      toast(t('interview.workspace.thisInterviewIsAlreadySubmitted'), { icon: 'ℹ️' });
      return;
    }

    setIsSubmittingSession(true);
    const toastId = toast.loading(t('interview.workspace.submittingInterview'));

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
        toast.success(t('interview.workspace.submittedForReviewPct', { pct: completeness ?? 0 }), {
          id: toastId,
        });
        void runAiQualityReview({ silent: true });
        onComplete?.(session.id);
        onClose?.();
        return;
      }

      await withTimeout(
        Api.patch(`/interview/sessions/${session.id}`, { status: 'completed' }),
        15000,
        t('interview.workspace.interviewFinalizationTimedOut')
      );
      setSession((prev) => {
        if (!prev) return prev;
        const now = new Date().toISOString();
        const nextSession = { ...prev, status: 'completed', completedAt: now, lastActivityAt: now };
        onSessionChange?.(nextSession);
        return nextSession;
      });
      toast.success(t('interview.workspace.interviewCompleted'), { id: toastId });
      onComplete?.(session.id);
      onClose?.();
    } catch (error: any) {
      console.error('[InterviewWorkspace] Failed to submit session:', error);
      const data = error?.response?.data;
      const apiMsg = data?.error || data?.message || error?.message;

      // L-07 / SPEC_13 §5.1 — server enforced the objective-insufficiency floor.
      // Re-open the gate as a HARD block listing the server's blocked items, so a
      // stale client bypass still results in no escape hatch.
      if (data?.code === 'OBJECTIVE_INSUFFICIENCY') {
        const blocked = Array.isArray(data.blockedItems) ? data.blockedItems : [];
        const indexById = new Map<string, number>();
        [...questions]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .forEach((q, i) => indexById.set(q.id, i + 1));
        const items = blocked.map((b: any, i: number) => ({
          questionId: String(b.questionId || b.key || `blocked_${i}`),
          index: b.questionId ? indexById.get(String(b.questionId)) || 0 : 0,
          label: String(b.label || t('interview.workspace.requiredAnswer')),
          reason: t('interview.workspace.requiredNoAnswerYet'),
          severity: 'hard' as const,
        }));
        setQualityGate({
          open: true,
          items: items.length > 0 ? items : [],
          checking: false,
        });
        toast.error(t('interview.workspace.cannotSubmitCompleteTheRequired'), { id: toastId });
        return;
      }

      toast.error(
        apiMsg
          ? t('interview.workspace.failedToSubmitWithReason', { reason: apiMsg })
          : t('interview.workspace.failedToSubmit'),
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
    questions,
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

      // bypassGate only skips SOFT hints. Hard-floor items (objective
      // insufficiency) can never be bypassed client-side (SPEC_13 §5.1); the
      // server also enforces this with a 422, so a stale bypass is still rejected.
      if (opts?.bypassGate) {
        const hardItems = computeWeakAnswers(aiEvaluation).filter((i) => i.severity === 'hard');
        if (hardItems.length > 0) {
          setQualityGate({ open: true, items: hardItems, checking: false });
          return;
        }
        setQualityGate({ open: false, items: [], checking: false });
        await performSubmit();
        return;
      }

      setQualityGate((prev) => ({ ...prev, checking: true }));
      let evaluation: InterviewAnswerEvaluation | null = aiEvaluation;
      // INT-DELIVERY-OPS-001 (2): settled-guard — Promise.race inside withTimeout
      // cannot cancel the losing promise, so runAiQualityReview keeps running
      // after we give up on it below. Flip this once the timeout fires so a late
      // resolve is a no-op inside runAiQualityReview instead of overwriting
      // aiEvaluation state after the quality gate already moved on.
      const aiReviewSignal = { cancelled: false };
      try {
        // Refresh the AI signal silently; tolerate failure (local-only fallback).
        const fresh = await withTimeout(
          runAiQualityReview({ silent: true, signal: aiReviewSignal }),
          12000,
          isPolish
            ? 'Przekroczono limit czasu oceny jakości AI.'
            : 'AI quality review timed out.'
        );
        if (fresh) evaluation = fresh;
      } catch {
        // ignore — fall back to whatever evaluation we already have
        aiReviewSignal.cancelled = true;
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
      toast.success(t('interview.workspace.interviewSentBackForRevision'));
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to send back:', error);
      toast.error(t('interview.workspace.failedToSendBack'));
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
      toast.success(t('interview.workspace.interviewApproved'));
    } catch (error) {
      console.error('[InterviewWorkspace] Failed to approve:', error);
      toast.error(t('interview.workspace.failedToApprove'));
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
    toast.success(t('interview.workspace.downloaded'));
  };

  const handleCopy = () => {
    const content = `${sessionName}\n\nProgress: ${overallPercent}%\n\nFacts:\n${summaryData.facts.map((f) => `- ${f}`).join('\n')}`;
    navigator.clipboard.writeText(content);
    toast.success(t('interview.workspace.copied'));
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
      className="bg-white/70 dark:bg-c-surface/70 backdrop-blur-xl rounded-2xl border border-c-border/60 shadow-lg shadow-c-border-strong/50 overflow-hidden"
    >
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => toggleSection(id)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${iconBgClass}`}>{icon}</div>
          <span className="text-sm font-semibold text-c-text-secondary">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {badge}
          <motion.div
            animate={{ rotate: expandedSections.has(id) ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} className="text-c-text-secondary" />
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence>
        {expandedSections.has(id) && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-c-border overflow-hidden"
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
      t(`interview.workspace.categoryLabel.${category}`, config.labelEn),
      config.bgColor,
      <div className="flex items-center gap-2">
        {progress?.isComplete && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <Check size={10} />
            {t('interview.workspace.done')}
          </span>
        )}
        <span className="text-xs font-medium text-c-text-secondary">
          {progress?.answeredQuestions || 0}/{progress?.totalQuestions || 0}
        </span>
      </div>,
      undefined,
      <div className="p-4">
        {/* Progress bar */}
        {hasQuestions && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-c-text-muted mb-1">
              <span>{t('interview.workspace.progress')}</span>
              <span>
                {progress?.answeredQuestions || 0}/{progress?.totalQuestions || 0}
              </span>
            </div>
            <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
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

  // ── MIGRACJA (D-8): kompozycja kart przez WIĄŻĄCY kontrakt karty ────────────
  //
  // Hooki MUSZĄ stać PRZED wczesnym returnem (isLoading/loadError niżej) —
  // reguła hooków. `applyToSections` (nie-hook) wołamy dopiero przy budowie
  // `sections` w gałęzi renderu. Wzorzec 1:1 z POC Decision (DecisionDetailView).
  //
  // OGRANICZENIE (przepis R2): `useCardLayout.artifactType` przyjmuje
  // `NModeArtifactType` = 'insight'|'initiative'|'decision'|'task' — NIE ma
  // 'interview' (rozjazd z `KartaNKey`, które 'interview' ma). Gdy flaga ON,
  // `spec` (INTERVIEW_CARD_SPEC) NADPISUJE fallback, więc `artifactType` jest
  // MARTWY (nie konsumowany); podajemy inertny literał. DO POTWIERDZENIA PIOTRA:
  // czy `NModeArtifactType` ma dostać 'interview' (osobny pakiet — dotyka powłoki).
  const interviewCardContractEnabled = useInterviewCardContractEnabled();
  const interviewCardLayoutStorageKey = `interview:nmode:card-layout:${
    interviewCardContractEnabled ? 'v2-contract' : 'v1'
  }:${session?.id ?? 'new'}`;
  const initialInterviewCardLayout = useMemo<CardLayout | null>(() => {
    try {
      const raw = localStorage.getItem(interviewCardLayoutStorageKey);
      return raw ? (JSON.parse(raw) as CardLayout) : null;
    } catch {
      return null;
    }
  }, [interviewCardLayoutStorageKey]);
  const persistInterviewCardLayout = useCallback(
    (next: CardLayout) => {
      try {
        localStorage.setItem(interviewCardLayoutStorageKey, JSON.stringify(next));
      } catch {
        /* localStorage niedostępny — layout zostaje w pamięci sesji */
      }
    },
    [interviewCardLayoutStorageKey]
  );
  const interviewCardLayout = useCardLayout({
    // Inertny fallback (patrz wyżej) — nadpisany przez `spec` gdy flaga ON.
    artifactType: 'insight',
    spec: interviewCardContractEnabled ? INTERVIEW_CARD_SPEC : undefined,
    initialLayout: initialInterviewCardLayout,
    onLayoutChange: persistInterviewCardLayout,
  });

  // ==========================================
  // LOADING STATE
  // ==========================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-c-surface p-8">
        <div className="mx-auto max-w-3xl">
          <LoadingState template="panel" label={t('interview.workspace.loadingInterview')} />
        </div>
      </div>
    );
  }

  // IMPACT-UX-002: Degraded UX Error State
  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-c-surface-raised p-8">
        <EmptyState
          variant="error"
          title={
            loadError.isTransportBlock
              ? t('interview.workspace.requestsBlockedByGlobalTransport')
              : t('interview.workspace.dataLoadingError')
          }
          description={loadError.message}
          onRetry={() => {
            setLoadError(null);
            setIsLoading(true);
            window.location.reload();
          }}
        />
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
        value: isLocked ? t('interview.workspace.locked') : t('interview.workspace.active'),
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'lastActivity',
        label: { en: 'Last activity', pl: 'Aktywność' },
        type: 'text',
        value: session?.lastActivityAt
          ? new Date(session.lastActivityAt).toLocaleDateString(
              t('interview.workspace.enUs', 'en-US')
            )
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
        // SPEC-N §2.6 — formularz „Odeślij" ma JEDNO miejsce w powłoce: sekcja
        // Podgląd. Odkąd tryb pojedynczego pytania nie ma własnego top-baru,
        // recenzent może kliknąć tę akcję będąc na sekcji Pytania — bez skoku
        // formularz otwierałby się poza widokiem (akcja bez skutku na ekranie).
        onClick: () => {
          setActiveSection('overview');
          setShowSendBackForm(true);
        },
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

  // ── STATUS-ETYKIETA (D-B 2026-07-22) ────────────────────────────────────────
  // Menu 1 pokazuje ton+tekst cyklu zycia jako pigulke c-* (nie naga kropke).
  // Tekst bierzemy z istniejacego, dwujezycznego STATUS_MAP (lifecycleConfig),
  // wiec zero nowych kluczy i18n. Ton mapujemy z realnego lifecycleStatus:
  // sent_back → rejected (czerwien semantyczna), approved/completed → success,
  // in_progress/submitted → info (aktywna praca / w przegladzie), assigned → neutral.
  const statusToneMap: Record<string, 'draft' | 'review' | 'approved' | 'rejected' | 'neutral'> = {
    assigned: 'neutral',
    in_progress: 'review',
    submitted: 'review',
    sent_back: 'rejected',
    approved: 'approved',
    completed: 'approved',
  };
  const headerStatusLabel = isPolish ? lifecycleConfig.label.pl : lifecycleConfig.label.en;
  const headerStatusTone = statusToneMap[lifecycleStatus] ?? 'neutral';

  // ── PRIMARY CTA NAGLOWKA (D11 — karta nie miala ZADNEGO primary) ────────────
  // Wybor akcji: "Zakoncz wywiad". Uzasadnienie: to TERMINALNE zdarzenie cyklu
  // zycia warsztatu — `handleSubmitSession` domyka sesje (w trybie bez
  // przypisania: status → 'completed', z bramka jakosci + ocena AI), analogicznie
  // do Decision "Zatwierdz decyzje" (primary tylko gdy `isPending`). NIE
  // wymyslamy nowej mechaniki (np. "Generuj insighty" nie ma handlera) — pinamy
  // istniejacy, dzialajacy przeplyw.
  // Warunkowanie stanem (jak Decision): primary znika gdy nie ma juz nic do
  // zrobienia (locked: approved/completed) oraz gdy karte oglada recenzent
  // (jego terminalna akcja "Zatwierdz" zyje juz w pasku `actions` — bez
  // duplikatu, SPEC-N §2.6). W trybie przypisania submit tez zyje w `actions`
  // ("Wyslij do przegladu"), wiec primary naglowka wypelnia dokladnie luke
  // sesji BEZ przypisania (jak w tej karcie), gdzie pasek nie ma zadnego CTA.
  const canFinishInterview =
    Boolean(session?.id) && !isAssignmentMode && !isReviewerMode && !isLocked;
  const headerPrimaryAction = canFinishInterview
    ? {
        label: { en: 'Complete interview', pl: 'Zakończ wywiad' },
        icon: Check,
        onClick: () => {
          void handleSubmitSession();
        },
        disabled: isSaving || isSubmittingSession,
      }
    : undefined;

  // ── PRAWY PANEL ARTEFAKTU (SPEC-N §2.2 — pole WYMAGANE, nie opcjonalne) ─────
  //
  // Do 2026-07-21 karta Interview byla jedna z pieciu bez prawego panelu w ogole
  // (A1). Metadane sesji wisialy jako pozioma listwa `NModePropertiesStrip` pod
  // naglowkiem — dokladnie ten sam antywzorzec, co pozioma siatka 7 pol w
  // Initiative, ktory §2.2 nazywa „brakiem calej struktury".
  //
  // Kolejnosc sekcji jest kanoniczna (§11.2): Akcje · Wlasciwosci · Powiazania ·
  // Komentarze · Historia. Interview deklaruje TRZY z nich, swiadomie:
  //  · Akcje — NIE MA. Wszystkie akcje karty (Zatwierdz / Odeslij / Wyslij do
  //    przegladu / Ocena AI / Markdown / Kopiuj) renderuje toolbar powloki
  //    (`actions`), a Zapis i AI — naglowek. Powtorzenie ich tutaj byloby
  //    duplikatem, ktory §2.6 zakazuje wprost. Funkcja nie znika — znika kopia.
  //  · Komentarze — sesja wywiadu nie ma dzis w ogole watku komentarzy (brak
  //    modelu i endpointu). Pusty akordeon udawalby zdolnosc, ktorej nie ma.
  //
  // ZRODLO WLASCIWOSCI: ta sama tablica `properties`, ktora wczesniej zasilala
  // listwe poziomą. Listwa zostaje ZDJETA z `NModeShell` (prop `properties`
  // pominięty) — inaczej te same pola renderowalyby sie dwa razy naraz.
  const panelLocale = isPolish ? 'pl-PL' : 'en-US';
  // Jawnie ustalony locale zamiast `t('…enUs')`: klucz istnieje tylko w pl/en,
  // a w pozostalych jezykach i18next zwraca sam klucz → `Invalid language tag`
  // → cala karta w error-boundary (znalezisko z harnessu, SPEC-N §6A poz. 2).
  const formatPanelDate = (value?: string | null, withTime = false) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return withTime ? d.toLocaleString(panelLocale) : d.toLocaleDateString(panelLocale);
  };

  const historyEntries: Array<{ key: string; label: string; value: string }> = [
    {
      key: 'started',
      label: t('interview.workspace.startedAt', 'Started'),
      value: formatPanelDate(session?.startedAt),
    },
    {
      key: 'lastActivity',
      label: t('interview.workspace.lastActivityAt', 'Last activity'),
      value: formatPanelDate(session?.lastActivityAt, true),
    },
    {
      key: 'aiReview',
      // Osobny klucz, NIE `lastReview` — tamten ma w tresci dwukropek
      // („Ostatnia analiza:"), bo jest uzywany w zdaniu, a nie jako etykieta.
      label: t('interview.workspace.aiReviewedAt', 'Last AI review'),
      value: formatPanelDate(aiEvaluationUpdatedAt, true),
    },
    {
      key: 'completed',
      label: t('interview.workspace.completedAt', 'Completed'),
      value: formatPanelDate(session?.completedAt),
    },
  ].filter((row) => row.value !== '—');

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'properties',
      label: t('interview.workspace.properties', 'Properties'),
      icon: ClipboardList,
      defaultOpen: true,
      children: (
        <ArtifactPropertiesTable
          propertyLabel={t('interview.workspace.property', 'Property')}
          valueLabel={t('interview.workspace.value', 'Value')}
          rows={properties.map((field) => ({
            id: field.id,
            label: isPolish ? field.label.pl : field.label.en,
            value: field.value || '—',
            mono: field.id === 'due' || field.id === 'progress',
          }))}
        />
      ),
    },
    {
      id: 'relations',
      label: t('interview.workspace.relations', 'Relations'),
      icon: Link2,
      defaultOpen: false,
      badge: linkedItems.length,
      // Uczciwie puste, nie udawane: gdy sesja nie ma powiazan, panel mowi to
      // wprost zamiast renderowac pusty kontener (DoD §18.1 „stan pusty").
      isEmpty: linkedItems.length === 0,
      emptyLabel: t('interview.workspace.noRelations', 'No linked items'),
      children: (
        <ul className="flex flex-col gap-1.5">
          {linkedItems.map((item) => {
            // DoD §18.1 „powiązania klikalne first-class": nawigacja przez
            // wspólny bus `mywork-open-item` (wzór: RelatedContext/AIConnections/
            // DecisionDetailView). Gdy brak id — pozycja zostaje statyczna.
            const isClickable = Boolean(item.id);
            const content = (
              <>
                <Link2 size={13} className="mt-0.5 shrink-0 text-c-text-muted" />
                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${
                      isClickable ? 'text-c-info' : 'text-c-text-secondary'
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                    {String(item.type || '')}
                    {item.status ? ` · ${item.status}` : ''}
                  </p>
                </div>
              </>
            );

            if (!isClickable) {
              return (
                <li
                  key={item.edgeId || item.id}
                  className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2"
                >
                  {content}
                </li>
              );
            }

            return (
              <li key={item.edgeId || item.id}>
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('mywork-open-item', {
                        detail: { type: item.type, id: item.id, name: item.title },
                      })
                    )
                  }
                  className="flex w-full items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface px-3 py-2 text-left cursor-pointer transition-colors hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {content}
                </button>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      id: 'history',
      label: t('interview.workspace.history', 'History'),
      icon: Clock,
      defaultOpen: false,
      isEmpty: historyEntries.length === 0 && !latestReviewDecision,
      emptyLabel: t('interview.workspace.noHistoryYet', 'No history yet'),
      children: (
        <div className="flex flex-col gap-2">
          {historyEntries.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-c-text-muted">{row.label}</span>
              <span className="text-xs font-medium tabular-nums text-c-text-secondary">
                {row.value}
              </span>
            </div>
          ))}
          {latestReviewDecision && (
            <div className="mt-1 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-c-text-muted">
                {t('interview.workspace.latestReviewDecisionLabel', 'Latest review decision')}
              </p>
              <p className="text-xs font-medium text-c-text-secondary">
                {String(latestReviewDecision.action || '—')}
              </p>
            </div>
          )}
        </div>
      ),
    },
  ];

  const sections: NModeSection[] = (() => {
    const overview = (
      <NModeSectionWrapper heading={{ en: 'Overview', pl: 'Podgląd' }}>
        {/* #3 — Lifecycle status read-back (assigned / in_progress / submitted /
            sent_back / approved / completed) via the canonical EntityStatusChip. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-c-text-muted">
            {t('interview.workspace.status')}
          </span>
          <EntityStatusChip
            status={lifecycleStatus}
            label={t(
              `interview.workspace.lifecycleStatusLabel.${lifecycleStatus}`,
              lifecycleConfig.label.en
            )}
          />
          <span className="text-xs text-c-text-muted tabular-nums">
            {completionPercent}% {t('interview.workspace.complete')}
          </span>
        </div>
        {isReviewerMode && (
          <Callout variant="warning" title={t('interview.workspace.reviewerMode')} compact>
            <div className="space-y-1">
              <p>{t('interview.workspace.youAreReviewingAnswersFor')}</p>
              {!canApprove && <p className="font-medium">{approveBlockedHint}</p>}
            </div>
          </Callout>
        )}
        {!isReviewerMode && reviewFeedback && (
          <Callout variant="warning" title={t('interview.workspace.managerFeedback')} compact>
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
            title={t('interview.workspace.aiQualityReview')}
            compact
            action={{
              label: isAiEvaluating
                ? t('interview.workspace.running')
                : t('interview.workspace.refresh'),
              onClick: () => {
                void runAiQualityReview();
              },
            }}
          >
            {isAiEvaluating ? (
              <p>{t('interview.workspace.aiIsReviewingAnswerQuality')}</p>
            ) : aiEvaluation ? (
              <div className="space-y-2">
                <p>
                  {t('interview.workspace.verdict')} <strong>{aiVerdictLabel}</strong>
                  {' · '}
                  {t('interview.workspace.score')}{' '}
                  <strong>{aiEvaluation.overallScore.toFixed(1)}/5</strong>
                </p>
                {aiWeakAnswerMap.length > 0 && (
                  <div>
                    <p className="font-medium">
                      {t('interview.workspace.structuredWeakAnswerMap')}
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
                    {t('interview.workspace.latestReviewDecision')}{' '}
                    <strong>{String(latestReviewDecision.action || '-')}</strong>
                    {' · '}
                    {t('interview.workspace.aiAlignment')}{' '}
                    <strong>{String(latestReviewDecision.alignment || '-')}</strong>
                  </p>
                )}
                {aiEvaluation.recommendations.length > 0 && (
                  <div>
                    <p className="font-medium">{t('interview.workspace.aiRecommendations')}</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {aiEvaluation.recommendations.map((item, index) => (
                        <li key={`${index}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiEvaluationUpdatedAt && (
                  <p className="text-xs opacity-80">
                    {t('interview.workspace.lastReview')}{' '}
                    {new Date(aiEvaluationUpdatedAt).toLocaleString(
                      t('interview.workspace.enUs', 'en-US')
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p>{aiEvaluationError}</p>
            )}
          </Callout>
        )}
        {showSendBackForm && isReviewerMode && (
          <div className="rounded-xl border-l-4 border-l-amber-500 border border-amber-300/50 dark:border-amber-500/20 bg-amber-100 dark:bg-amber-500/10 p-4 space-y-3 mt-2">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t('interview.workspace.reasonForSendingBack')}
            </p>
            <textarea
              value={sendBackReason}
              onChange={(e) => setSendBackReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-amber-200 dark:border-amber-500/30 bg-c-surface px-3 py-2 text-sm text-c-text-secondary resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder={t('interview.workspace.describeWhatNeedsImprovement')}
            />
            {sendBackMissingItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t('interview.workspace.missingItems')}
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
                /* R1 / SPEC-N §2.3 — poza slotem primary NIC nie jest solid.
                   Bylo `bg-amber-500 text-white` (pelne wypelnienie), czyli
                   drugie CTA konkurujace wizualnie z akcja glowna powloki.
                   Teraz: obrys + tinta ostrzegawcza — waga semantyczna zostaje
                   (to nadal akcja ostrzegawcza), waga wizualna spada. */
                className="inline-flex items-center gap-1.5 rounded-lg border border-c-warning/40 bg-c-warning/10 px-3 py-1.5 text-xs font-medium text-c-warning transition-colors hover:bg-c-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50"
              >
                {isSendingBack ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Send size={12} />
                )}
                {t('interview.workspace.sendBack')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSendBackForm(false);
                  setSendBackReason('');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-c-border/70 px-3 py-1.5 text-xs font-medium text-c-text-muted transition-colors"
              >
                {t('interview.workspace.cancel')}
              </button>
            </div>
          </div>
        )}
        <Callout
          variant={isReviewerMode ? 'info' : isLocked ? 'info' : 'purple'}
          title={
            isReviewerMode
              ? t('interview.workspace.reviewStatus')
              : isLocked
                ? t('interview.workspace.readOnly')
                : t('interview.workspace.nextAction')
          }
          action={
            isLocked
              ? undefined
              : {
                  label: t('interview.workspace.nextMissing'),
                  onClick: handleNextMissing,
                }
          }
          compact
        >
          {isReviewerMode
            ? t('interview.workspace.youAreReviewingASubmitted')
            : currentStatus === 'submitted'
              ? t('interview.workspace.submittedForReviewYouCan')
              : t('interview.workspace.progressXofY', {
                  answered: answeredQuestions,
                  total: totalQuestions,
                  pct: overallPercent,
                })}
        </Callout>
        {!isReviewerMode && !isLocked && liveWeakAnswers.length > 0 && (
          <Callout
            variant="warning"
            title={t('interview.workspace.answersNeedMoreDetail', {
              count: liveWeakAnswers.length,
            })}
            compact
            action={{
              label: t('interview.workspace.goToFirst'),
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
            <p className="mb-1">{t('interview.workspace.theseAnswersLookShortAdd')}</p>
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
          /* SPEC-N §7 decyzja #5 — JEDNA POWŁOKA, różni się CENTRUM.
             Do 2026-07-21 tryb `single_question` robił `return` PRZED
             `NModeShell` i budował własny bespoke top-bar (tytuł, status,
             pasek postępu, Save/Approve/Send-back, przełącznik trybu) —
             czyli drugą, konkurencyjną powłokę z duplikatami akcji
             (łamanie §2.6 anty-duplikacja i §2.4 jedna droga budowy).
             Teraz runtime „pytanie po pytaniu" renderuje się TUTAJ, wewnątrz
             sekcji Pytania tej samej powłoki; wszystkie akcje mieszkają w
             slotach powłoki (Save → NModeHeader, Approve/Send-back/Submit →
             toolbar `actions`, postęp/metadane → prawy panel, zmiana trybu →
             RuntimeModeSelector wyżej w tej sekcji).
             Wariant `immersive` runtime'u ZOSTAJE (płaska lista wszystkich
             pytań, bez bramki kategorii) — to jest właśnie „inne centrum".
             Wymaga kontenera o ZNANEJ wysokości, bo w środku używa
             `h-full` + `overflow-hidden`; w swobodnym przepływie dokumentu
             zapadłby się do zera. */
          /* Celowo `questions.length`, a NIE `totalQuestions`: to drugie sumuje
             `categoryProgress`, wiec pytanie o kategorii spoza CATEGORY_ORDER
             by sie nie policzylo i runtime dostalby pusty ekran mimo danych.
             Usunieta galaz immersive liczyla tak samo — zachowanie bez zmian. */
          questions.length > 0 ? (
            /* Wysokosc zalezna od GESTOSCI, nie od trybu prezentacji (SPEC-N
               §2.7 rozdziela te dwa pojecia): w N-mode runtime dostaje pelna
               scene, w gestej tablicy C-mode musi zmiescic sie w kaflu obok
               innych sekcji — inaczej rozjezdza plansze. To ten SAM komponent
               i ta sama sciezka kodu, tylko inna gestosc. */
            <div
              className={
                presentationMode === 'c' ? 'h-[420px] -mx-1' : 'h-[70vh] min-h-[540px] -mx-1'
              }
            >
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
                answerHistoryByQuestionId={answerHistoryByQuestionId}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="max-w-md text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-c-surface-raised">
                  <ClipboardList size={28} className="text-c-text-muted" />
                </div>
                <p className="text-sm text-c-text-muted">
                  {t('interview.workspace.noQuestionsInThisSession')}
                </p>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="mb-4 inline-flex items-center gap-2">
              <button
                onClick={handleNextMissing}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-c-border/60 bg-white/60 dark:bg-c-surface/40 hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50 transition-colors"
              >
                <ArrowRight size={14} />
                {t('interview.workspace.nextMissing')}
              </button>
              <span className="text-xs text-c-text-muted">
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
                        ? 'bg-c-surface-raised/70 dark:bg-white/[0.08] text-c-text border-c-border-strong/40 dark:border-white/20'
                        : 'bg-white/60 dark:bg-c-surface/40 text-c-text-muted border-c-border/60 hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50'
                    }`}
                  >
                    <cfg.icon
                      size={14}
                      className={isActive ? 'text-c-text-secondary' : 'text-c-text-secondary'}
                    />
                    {t(`interview.workspace.categoryLabel.${cat}`, cfg.labelEn)}
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
                title={t('interview.workspace.pickASection')}
                compact
                action={{
                  label: t('interview.workspace.nextMissing'),
                  onClick: handleNextMissing,
                }}
              >
                {t('interview.workspace.startWithTheNextMissing')}
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
                  <label className="block text-xs text-c-text-muted mb-1">
                    {t('interview.workspace.name')}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.name || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-c-surface/40 border border-c-border/60 text-c-text-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted mb-1">
                    {t('interview.workspace.industry')}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.industry || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, industry: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-c-surface/40 border border-c-border/60 text-c-text-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted mb-1">
                    {t('interview.workspace.size')}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.size || ''}
                    onChange={(e) => setEditedProfile({ ...editedProfile, size: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-c-surface/40 border border-c-border/60 text-c-text-secondary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-c-text-muted mb-1">
                    {t('interview.workspace.location')}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.location || ''}
                    onChange={(e) =>
                      setEditedProfile({ ...editedProfile, location: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg bg-white/60 dark:bg-c-surface/40 border border-c-border/60 text-c-text-secondary"
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
                  {t('interview.workspace.save')}
                </button>
                <button
                  onClick={() => {
                    setEditedProfile(companyProfile);
                    setIsEditingProfile(false);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-c-border/60 text-c-text-secondary bg-white/60 dark:bg-c-surface/40 hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50"
                >
                  <X size={14} />
                  {t('interview.workspace.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-c-text-secondary">
                {companyProfile.name ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-c-text-secondary" />{' '}
                      {companyProfile.name}
                    </div>
                    {companyProfile.industry && (
                      <div className="text-xs text-c-text-muted">{companyProfile.industry}</div>
                    )}
                    {companyProfile.location && (
                      <div className="text-xs text-c-text-muted">{companyProfile.location}</div>
                    )}
                  </div>
                ) : (
                  <span className="text-c-text-secondary">
                    {t('interview.workspace.noCompanyDataYet')}
                  </span>
                )}
              </div>
              {!isLocked && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-c-border/60 text-c-text-secondary bg-white/60 dark:bg-c-surface/40 hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50"
                >
                  <Edit3 size={14} />
                  {t('interview.workspace.edit')}
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
              className="flex items-center gap-3 p-2 rounded-xl bg-white/60 dark:bg-c-surface/40 border border-c-border/60"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                <Users size={14} className="text-blue-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-c-text-secondary truncate">{s.name}</div>
                <div className="text-xs text-c-text-muted truncate">{s.role}</div>
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
                  ? 'border-c-danger/20 bg-c-danger/5 dark:bg-c-danger/10'
                  : gap.priority === 'medium'
                    ? 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10'
                    : 'border-c-border/60 bg-white/60 dark:bg-c-surface/40'
              }`}
            >
              <div className="text-sm text-c-text-secondary">{gap.description}</div>
              <div className="text-xs text-c-text-muted mt-1">{gap.category}</div>
            </div>
          ))}
        </div>
      </NModeSectionWrapper>
    );

    // Standard-C group labels (#22b) — bilingual headers for the C-board tabs
    // and the grouped N-mode nav. Three lanes: the live interview, supporting
    // context, and the read-only summary.
    const groupInterview = t('interview.workspace.interview');
    const groupContext = t('interview.workspace.context');
    const groupSummary = t('interview.workspace.summary');

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
            <Callout variant="warning" title={t('interview.workspace.factsOnly')} compact>
              {t('interview.workspace.noRecommendationsOrActionPlans')}
            </Callout>
            <div className="mt-4 space-y-3">
              {summaryData.facts.length > 0 ? (
                <ul className="space-y-2">
                  {summaryData.facts.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-c-text-secondary">
                      <Check size={14} className="text-emerald-500 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-c-text-secondary">
                  {t('interview.workspace.noFactsYet')}
                </div>
              )}
            </div>
          </NModeSectionWrapper>
        ),
      });
    }

    return base;
  })();

  // ── KONTRAKT AI PER SEKCJA (SPEC-N §2.5) ───────────────────────────────────
  //
  // §2.5 zada, by KAZDA sekcja deklarowala kontrakt AI albo jawne wykluczenie:
  // „milczenie przestaje byc mozliwe". Interview to narzedzie AI-heavy, a mialo
  // dotad jeden przycisk toolbara („Ocena AI") i zero deklaracji per sekcja.
  //
  // OGRANICZENIE, KTORE TRZEBA ZNAC: docelowo kontrakt ma byc POLEM sekcji
  // (`aiContract` na `NModeSection`, §5.1 „stany niedozwolone maja byc
  // niewyrazalne"). Typ `NModeSection` w `shared/NModeLayout/types.ts` tego pola
  // JESZCZE NIE MA, a ten pakiet migracyjny nie ma prawa dotykac powloki.
  // Dlatego kontrakt zyje na razie OBOK sekcji, w tej mapie, i jest pilnowany
  // dev-warnem nizej. Gdy powloka dostanie pole `aiContract`, ta mapa przenosi
  // sie 1:1 na deklaracje sekcji i znika stad — tresc juz jest ustalona.
  const sectionAiContract: Record<
    string,
    { kind: 'generate' | 'review' | 'assist' } | { none: true; reason: string }
  > = {
    // AI realnie PISZE / ocenia:
    overview: { kind: 'review' }, // ocena jakosci odpowiedzi + rekomendacje (runAiQualityReview)
    questions: { kind: 'assist' }, // tryb konwersacyjny i pytanie-po-pytaniu prowadzi AI
    summary: { kind: 'generate' }, // podsumowanie faktow wyprowadzane z odpowiedzi
    // AI NIE pisze — jawne wykluczenie z powodem (§2.5):
    notes: { none: true, reason: 'notatki wlasne konsultanta — zapis reczny, bez generacji' },
    evidence: { none: true, reason: 'pliki i linki wgrywa czlowiek; AI ich nie tworzy' },
    'company-facts': { none: true, reason: 'twarde dane o firmie — zrodlo zewnetrzne, nie model' },
    stakeholders: { none: true, reason: 'lista osob — dane wprowadzane recznie' },
    'open-gaps': {
      none: true,
      reason: 'luki wynikaja z pytan bez odpowiedzi, liczone, nie pisane',
    },
  };

  if (import.meta.env.DEV) {
    const bezKontraktu = sections.filter((s) => !sectionAiContract[s.id]).map((s) => s.id);
    if (bezKontraktu.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SPEC-N §2.5] InterviewWorkspace: sekcje bez zadeklarowanego kontraktu AI: ${bezKontraktu.join(', ')}`
      );
    }
  }

  // ── MIGRACJA (D-8): filtr+kolejność sekcji przez kontrakt karty ─────────────
  // `applyToSections` (nie-hook) zwęża `sections` do zestawu z layoutu i porządku;
  // rdzeń `questions` (core:true) jest nieusuwalny (removeCard przerywa). Flaga OFF
  // ⇒ `sections` bez zmian (zero regresji na demo). Sekcje spoza layoutu (np.
  // `summary` w trybie assignment nieobecny) nie znikają (useCardLayout:307).
  const orderedSections = interviewCardContractEnabled
    ? interviewCardLayout.applyToSections(sections)
    : sections;

  // R2 (przepis §9): każda sekcja renderowana ma wpis w katalogu kanonicznym i
  // odwrotnie. Cichy dev-only sygnał rozjazdu id kod↔katalog (nie blokuje). Plain
  // `if` (nie useEffect) — ten fragment biegnie PO wczesnym returnie (rules-of-hooks).
  if (import.meta.env.DEV && interviewCardContractEnabled) {
    const bezWpisu = sections
      .map((s) => s.id)
      .filter((id) => !INTERVIEW_CARD_RENDER_IDS.includes(id));
    if (bezWpisu.length > 0) {
      // eslint-disable-next-line no-console
      console.warn('[interviewCardContract] sekcje bez wpisu w katalogu:', bezWpisu);
    }
  }

  // #11 — Pre-submit AI quality gate modal (shared across render branches).
  // L-07 / SPEC_13 §5.1 — when any hard-floor item is present the gate is a HARD
  // block: no "submit anyway" escape. Soft-only gates stay skippable.
  const gateHasHardBlock = qualityGate.items.some((i) => i.severity === 'hard');
  const qualityGateModal = (
    <AnimatePresence>
      {qualityGate.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-c-surface-raised/40 dark:bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setQualityGate({ open: false, items: [], checking: false })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-c-border/70 bg-c-surface shadow-2xl overflow-hidden"
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  gateHasHardBlock
                    ? 'bg-c-danger/15 text-c-danger'
                    : 'bg-amber-500/15 text-amber-500'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-c-text">
                  {gateHasHardBlock
                    ? t('interview.workspace.completeTheRequiredAnswersBefore')
                    : t('interview.workspace.someAnswersLookTooShort')}
                </h3>
                <p className="mt-1 text-sm text-c-text-muted">
                  {gateHasHardBlock
                    ? t('interview.workspace.theseItemsAreRequiredThe')
                    : t('interview.workspace.youCanImproveThemNow')}
                </p>
              </div>
            </div>

            <div className="px-5 pb-2 max-h-64 overflow-y-auto">
              <ul className="space-y-2">
                {qualityGate.items.map((item) => {
                  const hard = item.severity === 'hard';
                  return (
                    <li
                      key={item.questionId}
                      className="flex items-start gap-3 rounded-xl border border-c-border/70 bg-c-bg/70 dark:bg-c-surface-raised/40 px-3 py-2"
                    >
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                          hard
                            ? 'bg-c-danger/15 text-c-danger'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.index || '•'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-c-text-secondary truncate">
                          {item.label}
                        </p>
                        <p
                          className={`text-xs ${
                            hard ? 'text-c-danger' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.reason}
                          {hard ? t('interview.workspace.required') : ''}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-c-border/70">
              <button
                type="button"
                onClick={handleQualityGateGoBack}
                className="inline-flex items-center gap-1.5 rounded-lg border border-c-border/70 px-4 py-2 text-sm font-medium text-c-text-secondary bg-white/60 dark:bg-c-surface/40 hover:bg-c-bg/80 dark:hover:bg-c-surface-raised/50 transition-colors"
              >
                <ChevronLeft size={16} />
                {gateHasHardBlock
                  ? t('interview.workspace.completeNow')
                  : t('interview.workspace.goBackAndImprove')}
              </button>
              {!gateHasHardBlock && (
                <button
                  type="button"
                  onClick={() => {
                    void handleSubmitSession({ bypassGate: true });
                  }}
                  disabled={isSubmittingSession}
                  /* R1 / SPEC-N §2.3 — „Wyslij mimo to" bylo jedynym solidem na
                     tym ekranie (bg-c-surface / surowy hex w dark), przez co
                     UCIECZKA od bramki jakosci wygladala jak akcja zalecana,
                     a „Wroc i popraw" — jak rezygnacja. Odwrocone: zalecana
                     zostaje obrysowa (mocniejsza), ucieczka schodzi do ghost.
                     Przy okazji znikaja navy-* i surowy hex na rzecz c-*. */
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-c-text-muted transition-colors hover:bg-c-surface-raised hover:text-c-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50"
                >
                  {isSubmittingSession ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                  {t('interview.workspace.submitAnyway')}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // SPEC-N §7 decyzja #5 — tu KIEDYS stal `if (runtimeMode === 'single_question')
  // { return … }`, czyli druga powloka: wlasny top-bar z tytulem, statusem,
  // paskiem postepu i DUPLIKATAMI Save / Approve / Send-back, calkowicie
  // omijajaca NModeShell/NModeHeader. Usuniete — tryb pojedynczego pytania
  // renderuje sie teraz WEWNATRZ tej samej powloki (sekcja „Pytania",
  // wariant `immersive` runtime'u), a jego akcje mieszkaja w slotach powloki.
  // Nie ma juz drugiej deklaracji tych samych akcji (SPEC-N §2.6).

  return (
    <>
      {qualityGateModal}
      <NModeShell
        header={{
          title: sessionName,
          onTitleChange: setSessionName,
          // D-A: Interview = aktywny warsztat → tryb EDYCJI (tytul edytowalny).
          // Wyjatek: sesja zamknieta (approved/completed → isLocked) przechodzi
          // w PODGLAD, wiec tytul staje sie tylko-do-odczytu.
          titleReadOnly: isLocked,
          titlePlaceholder: { en: 'Session name...', pl: 'Nazwa sesji...' },
          artifactId: session?.id,
          artifactType: 'tool',
          onSave: handleSave,
          saving: isSaving,
          isDirty,
          onChat: handleOpenChat,
          // MARTWE WPIECIE AI — naprawione. `onChat` istnial i dzialal
          // (`handleOpenChat` otwiera czat z kontekstem sesji), ale
          // `NModeHeader` renderuje przycisk AI tylko przy `showChatButton`
          // (domyslnie `false`, back-compat). Przez to w narzedziu AI-heavy
          // przycisk AI NIE RENDEROWAL SIE NIGDY — handler byl podpiety do
          // niczego. DoD §18.1: slot AI jest staly, nie opcjonalny.
          showChatButton: true,
          onClose: onClose || (() => {}),
          // D-B: status jako etykieta-pigulka c-* (tekst + ton), nie naga kropka.
          // statusDotColor jest @deprecated i nierenderowany — usuniety.
          statusLabel: headerStatusLabel,
          statusTone: headerStatusTone,
          // D11: pojedynczy primary cyklu zycia ("Zakoncz wywiad").
          primaryAction: headerPrimaryAction,
        }}
        // `properties` CELOWO pominiete — te same pola renderuje teraz sekcja
        // Wlasciwosci prawego panelu (SPEC-N §2.2). Podanie obu naraz dalo by
        // te sama tresc w dwoch miejscach (§2.6).
        sections={orderedSections}
        actions={actions}
        actionsVisible={actions.length > 0}
        // MIGRACJA (D-8): gdy flaga ON, pasek akcji dostaje picker kontraktu
        // (Sekcje ▾ z przełącznikiem Rdzeń/Pełny + Nowa karta ▾), a istniejące
        // akcje renderujemy obok (NModeActionBar) — nic nie ginie. Flaga OFF ⇒
        // `undefined` ⇒ powłoka rysuje standardowy pasek jak dotąd (zero regresji).
        renderActionBar={
          interviewCardContractEnabled
            ? () => (
                <div className="flex items-center gap-2 min-h-[36px] flex-wrap">
                  <NModeCardManager layout={interviewCardLayout} isPolish={isPolish} />
                  {actions.length > 0 && (
                    <div className="ml-auto">
                      <NModeActionBar actions={actions} activeSection={activeSection} />
                    </div>
                  )}
                </div>
              )
            : undefined
        }
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        presentationMode={presentationMode}
        onPresentationModeChange={setPresentationMode}
        showModeSwitcher={true}
        buildArtifactCode={(type, id) => buildArtifactCode(type as any, id)}
        rightPanel={
          <ArtifactRightPanel
            sections={rightPanelSections}
            className="h-full border-l border-c-border-subtle"
            ariaLabel={t('interview.workspace.sessionDetails', 'Session details')}
          />
        }
      >
        <div />
      </NModeShell>
    </>
  );
};

export default InterviewWorkspace;
