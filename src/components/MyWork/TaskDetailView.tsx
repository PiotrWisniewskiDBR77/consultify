/**
 * TaskDetailView
 * Full-page task detail view with N / C presentation modes
 * N mode: NModeHeader + PropertiesStrip + LeftNav (9 sections) + Canvas
 * D mode (accordion): legacy — kept until N mode is fully rolled out
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  FolderOpen,
  GitBranch,
  History,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquare,
  Minus,
  Pause,
  Play,
  Plus,
  Save,
  Scale,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Callout } from '@/components/shared/NModeBlocks';
import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { LoadingState } from '@/components/ui/primitives';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { InitiativeService } from '@/services/initiativeService';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { buildArtifactCode } from '@/utils/artifactLinks';

// ── AI Field Enhancer (shared) ───────────────────────────────────────────────
import { AIFieldEnhancer } from '../shared/AIFieldEnhancer';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
import { NModeCanvas } from '../shared/NModeLayout/NModeCanvas';
// #52 — card-management primitive (show/hide + reorder), same wiring as
// InsightViewer.tsx (nakładka, see comment at `taskCardLayout` below).
import { NModeCardManager } from '../shared/NModeLayout/NModeCardManager';
// ── N-Mode Layout (shared) ──────────────────────────────────────────────────
import { NModeCardState, type NModeCardStatus } from '../shared/NModeLayout/NModeCardState';
import { NModeHeader } from '../shared/NModeLayout/NModeHeader';
import { NModeLeftNav } from '../shared/NModeLayout/NModeLeftNav';
import { NModeSectionWrapper } from '../shared/NModeLayout/NModeSectionWrapper';
import type { NModeSection } from '../shared/NModeLayout/types';
import { type CardLayout, useCardLayout } from '../shared/NModeLayout/useCardLayout';
// ── N-Mode Sections (shared, reusable across artifacts) ─────────────────────
import {
  ActivityLogCanvas,
  type ActivityLogEntry as NModeActivityLogEntry,
  type ActivityStats,
  type ActivityTypeMeta,
  AttachmentsLinksCanvas,
  type CommentItem,
  type CommentPriority,
  CommentsCanvas,
  type DateFilter,
  RiskCanvas,
  type SortOrder,
} from '../shared/NModeSections';
import { NotebookMetadataBadges } from './notebook/NotebookMetadataBadges';
import {
  type Alternative,
  AlternativesSection,
  type Attachment,
  AttachmentsSection,
  type Comment,
  CommentsSection,
  DeadlineAlertBanner,
  DependenciesSection,
  type EscalationRule,
  EscalationRulesSection,
  type EvidenceItem,
  EvidenceSection,
  type EvidenceType,
  type ImplementationIdea,
  ImplementationIdeasSection,
  type LinkedItem,
  LinkedItemsSection,
  type ReminderRule,
  RiskAssessmentCompact,
  type RiskItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  StakeholdersSection,
  type TaskDependency,
  type WarningThresholds,
} from './shared';
import { AIConnections } from './shared/AIConnections';
import { buildAskAIMessage } from './shared/askAiHelper';
// ── Presentation Mode Switcher ───────────────────────────────────────────────
import { PresentationModeSwitcher } from './shared/PresentationModeSwitcher';
import { ReadEditToggle } from './shared/ReadEditToggle';
import { RelatedContext } from './shared/RelatedContext';

interface TaskDetailViewProps {
  taskId: string | null;
  onClose: () => void;
  onSaved?: (data: any) => void;
  onOpenDecision?: (decisionId: string) => void;
}

// Status configuration
const STATUS_CONFIG = {
  todo: {
    label: { en: 'To Do', pl: 'Do zrobienia' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
    icon: CheckSquare,
  },
  in_progress: {
    label: { en: 'In Progress', pl: 'W trakcie' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: Clock,
  },
  review: {
    label: { en: 'Review', pl: 'Przegląd' },
    color: 'bg-sky-500',
    textColor: 'text-sky-600',
    icon: Edit3,
  },
  done: {
    label: { en: 'Done', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    icon: CheckCircle2,
  },
  blocked: {
    label: { en: 'Blocked', pl: 'Zablokowane' },
    color: 'bg-danger-500',
    textColor: 'text-danger-500',
    icon: AlertCircle,
  },
};

const PRIORITY_CONFIG = {
  low: {
    label: { en: 'Low', pl: 'Niski' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
  },
  medium: {
    label: { en: 'Medium', pl: 'Średni' },
    color: 'bg-blue-400',
    textColor: 'text-blue-500',
  },
  high: {
    label: { en: 'High', pl: 'Wysoki' },
    color: 'bg-amber-400',
    textColor: 'text-amber-500',
  },
  critical: {
    label: { en: 'Critical', pl: 'Krytyczny' },
    color: 'bg-danger-500',
    textColor: 'text-danger-500',
  },
};

const normalizePriority = (priority?: string | null): keyof typeof PRIORITY_CONFIG => {
  if (!priority) return 'medium';
  const normalized = priority.toLowerCase();
  if (normalized === 'urgent') return 'critical';
  if (normalized in PRIORITY_CONFIG) return normalized as keyof typeof PRIORITY_CONFIG;
  return 'medium';
};

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  taskId,
  onClose,
  onSaved,
  onOpenDecision,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const {
    isChatCollapsed,
    toggleChatCollapse,
    setChatKickoffMessage,
    emitMyWorkEvent,
    currentUser,
  } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>('todo');
  const [priority, setPriority] = useState<keyof typeof PRIORITY_CONFIG>('medium');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [blockedReason, setBlockedReason] = useState('');

  // People
  const [ownerId, setOwnerId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [users, setUsers] = useState<
    { id: string; firstName: string; lastName: string; email?: string }[]
  >([]);

  // Initiative (parent)
  const [initiativeId, setInitiativeId] = useState<string | null>(null);
  const [initiativeName, setInitiativeName] = useState<string | null>(null);
  const [availableInitiatives, setAvailableInitiatives] = useState<
    { id: string; name: string; type: string }[]
  >([]);
  const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false);

  // Context
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [createdAt, setCreatedAt] = useState('');

  // Checklist
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>(
    []
  );

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // ── Wzorzec N: stan kart AI-draft per sekcja (§3.2) + flaga „AI-generated". ──
  // Klucze = id sekcji AI-zapisywalnych; mapowanie na backend section keys niżej.
  type AICardKey = 'description-scope' | 'checklist' | 'dependencies' | 'evidence';
  const [cardState, setCardState] = useState<Record<AICardKey, NModeCardStatus>>({
    'description-scope': 'edited',
    checklist: 'edited',
    dependencies: 'edited',
    evidence: 'edited',
  });
  const [cardAI, setCardAI] = useState<Record<AICardKey, boolean>>({
    'description-scope': false,
    checklist: false,
    dependencies: false,
    evidence: false,
  });
  const setCard = useCallback((key: AICardKey, next: NModeCardStatus) => {
    setCardState((prev) => ({ ...prev, [key]: next }));
  }, []);
  // Backend key per sekcja (taskSectionGenerationService).
  const CARD_BACKEND_KEY: Record<AICardKey, string> = {
    'description-scope': 'strategy',
    checklist: 'execution',
    dependencies: 'dependencies',
    evidence: 'evidence',
  };

  // T009: Suggested ideas (private) while editing task
  const [suggestedIdeas, setSuggestedIdeas] = useState<
    { id: string; title: string; body?: string; tags?: string[]; createdAt?: string }[]
  >([]);
  const [suggestedIdeasLoading, setSuggestedIdeasLoading] = useState(false);

  // T011: Suggested notebook pages (private/project) while editing task
  const [suggestedNotes, setSuggestedNotes] = useState<
    {
      id: string;
      title: string;
      contentText?: string;
      tags?: string[];
      updatedAt?: string;
      captureSource?: string | null;
      captureMetadata?: { fileOriginalname?: string | null; fileMimetype?: string | null } | null;
      convertedTo?: Array<{ type?: string | null; id?: string | null }> | null;
    }[]
  >([]);
  const [suggestedNotesLoading, setSuggestedNotesLoading] = useState(false);

  // Escalation & Reminders
  const [reminders, setReminders] = useState<ReminderRule[]>([]);
  const [escalation, setEscalation] = useState<EscalationRule | null>(null);
  const [thresholds, setThresholds] = useState<WarningThresholds>({
    warningDays: 3,
    criticalDays: 1,
    showOverdueAlert: true,
  });

  // Attachments, Comments, Links
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);

  // Origin tracking
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);

  // Stakeholders
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);

  // Decision blocking (legacy)
  const [blockedByDecisionId, setBlockedByDecisionId] = useState<string>('');

  // Related Decisions
  interface RelatedDecision {
    id: string;
    /** Persisted Link Graph v3 edge id (link_graph_edges.id). Present once saved server-side. */
    edgeId?: string | null;
    decisionId: string;
    decisionTitle: string;
    decisionStatus: 'pending' | 'approved' | 'rejected' | 'deferred' | 'escalated';
    relationshipType: 'blocks' | 'requires' | 'informs' | 'depends_on';
    note?: string;
  }
  const [relatedDecisions, setRelatedDecisions] = useState<RelatedDecision[]>([]);
  const [showDecisionSearch, setShowDecisionSearch] = useState(false);
  const [decisionSearchQuery, setDecisionSearchQuery] = useState('');
  const [showCreateDecision, setShowCreateDecision] = useState(false);
  const [creatingDecision, setCreatingDecision] = useState(false);
  const [linkingDecisionId, setLinkingDecisionId] = useState<string | null>(null);
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionDescription, setNewDecisionDescription] = useState('');
  const [newDecisionRelationType, setNewDecisionRelationType] = useState<
    'blocks' | 'requires' | 'informs' | 'depends_on'
  >('requires');
  const [availableDecisions, setAvailableDecisions] = useState<
    { id: string; title: string; status: string }[]
  >([]);

  // Related Notes (notebook pages mentioning task title)
  const [relatedNotes, setRelatedNotes] = useState<
    {
      id: string;
      title: string;
      maturity?: string;
      captureSource?: string | null;
      captureMetadata?: { fileOriginalname?: string | null; fileMimetype?: string | null } | null;
      convertedTo?: Array<{ type?: string | null; id?: string | null }> | null;
    }[]
  >([]);

  // New sections state
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [implementationIdeas, setImplementationIdeas] = useState<ImplementationIdea[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [expectedOutcome, setExpectedOutcome] = useState('');

  // Evidence & Acceptance
  const [evidenceRequired, setEvidenceRequired] = useState<EvidenceType[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [acceptanceType, setAcceptanceType] = useState<'manual' | 'automatic' | null>(null);
  const [acceptorId, setAcceptorId] = useState<string | null>(null);
  const [signedOff, setSignedOff] = useState(false);
  const [signedOffAt, setSignedOffAt] = useState<string | undefined>();
  const [signedOffBy, setSignedOffBy] = useState<string | undefined>();

  // Generation states
  const [isGeneratingRisks, setIsGeneratingRisks] = useState(false);
  const [isGeneratingAlternatives, setIsGeneratingAlternatives] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isGeneratingAIComment, setIsGeneratingAIComment] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingOutcome, setIsGeneratingOutcome] = useState(false);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);

  // ── RACI / Governance inline editing (mirrors Decision) ──────────────────
  type IntegrationChannel = 'slack' | 'teams' | 'webhook' | 'jira';
  type CoreDeliveryChannel = 'in_app' | 'email';
  type EscalationMode = 'notify_only' | 'manager_review' | 'executive_alert';
  type DeliveryConfig = {
    coreChannels: CoreDeliveryChannel[];
    integrationChannels: IntegrationChannel[];
    syncTargets: string[];
  };
  type ReminderRuleWithDelivery = ReminderRule & { delivery?: DeliveryConfig };
  type EscalationRuleWithConfig = EscalationRule & {
    warningDays: number;
    criticalDays: number;
    escalationMode: EscalationMode;
    delivery: DeliveryConfig;
  };

  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [stakeholderDraft, setStakeholderDraft] = useState<Stakeholder | null>(null);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderRuleWithDelivery | null>(null);
  const [editingEscalationId, setEditingEscalationId] = useState<string | null>(null);
  const [escalationDraft, setEscalationDraft] = useState<EscalationRuleWithConfig | null>(null);
  const [isSuggestingStakeholders, setIsSuggestingStakeholders] = useState(false);
  const [escalationRules, setEscalationRules] = useState<EscalationRuleWithConfig[]>(() => {
    if (escalation) {
      return [
        {
          ...escalation,
          warningDays: thresholds.warningDays,
          criticalDays: thresholds.criticalDays,
          escalationMode: 'manager_review' as EscalationMode,
          delivery: {
            coreChannels: ['in_app'] as CoreDeliveryChannel[],
            integrationChannels: [],
            syncTargets: [],
          },
        },
      ];
    }
    return [];
  });

  const governanceTableCardClass =
    'bg-white/70 dark:bg-navy-900/70 rounded-2xl border border-slate-200 dark:border-navy-700/60 p-4 space-y-3 h-[340px] flex flex-col';
  const governanceModalClass =
    'relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-navy-700/50 bg-white/95 dark:bg-navy-900/95 shadow-2xl p-6 space-y-5';
  const governanceModalHintClass =
    'rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300';
  const channelChipClass =
    'px-2 py-1 rounded-md border text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  const integrationChannelCatalog: Array<{
    key: IntegrationChannel;
    label: string;
    scope: string;
  }> = [
    { key: 'slack', label: 'Slack', scope: 'notification' },
    { key: 'teams', label: 'Teams', scope: 'notification' },
    { key: 'jira', label: 'Jira', scope: 'work-management' },
    { key: 'webhook', label: 'Webhook', scope: 'custom' },
  ];

  const escalationModeOptions: Array<{ value: EscalationMode; label: string }> = [
    { value: 'notify_only', label: t('myWork.taskDetail.label', 'Notify only') },
    { value: 'manager_review', label: t('myWork.taskDetail.label2', 'Manager review') },
    { value: 'executive_alert', label: t('myWork.taskDetail.label3', 'Executive alert') },
  ];

  const toggleChannel = <T extends string>(list: T[], key: T, enabled: boolean): T[] => {
    if (enabled) return list.includes(key) ? list : [...list, key];
    return list.filter((entry) => entry !== key);
  };

  const ensureDeliveryConfig = (
    source?: Partial<DeliveryConfig> | null,
    fallback?: ReminderRule
  ): DeliveryConfig => {
    if (source?.coreChannels) {
      return {
        coreChannels: source.coreChannels,
        integrationChannels: (source.integrationChannels || []) as IntegrationChannel[],
        syncTargets: (source.syncTargets || []) as string[],
      };
    }
    const channels: CoreDeliveryChannel[] = [];
    if (fallback) {
      if ((fallback as any).inAppNotification !== false) channels.push('in_app');
      if ((fallback as any).emailNotification) channels.push('email');
    }
    return {
      coreChannels: channels.length > 0 ? channels : ['in_app'],
      integrationChannels: (source?.integrationChannels || []) as IntegrationChannel[],
      syncTargets: (source?.syncTargets || []) as string[],
    };
  };

  const normalizeReminderRule = (rule: ReminderRuleWithDelivery): ReminderRuleWithDelivery => {
    const delivery = ensureDeliveryConfig(rule.delivery, rule);
    return {
      ...rule,
      inAppNotification: delivery.coreChannels.includes('in_app'),
      emailNotification: delivery.coreChannels.includes('email'),
      delivery,
    };
  };

  const normalizeEscalationRule = (
    rule: Partial<EscalationRuleWithConfig>
  ): EscalationRuleWithConfig => ({
    id: String(rule.id || Math.random().toString(36).slice(2, 11)),
    enabled: rule.enabled !== false,
    escalateTo: String(rule.escalateTo || ''),
    escalateToName: String(rule.escalateToName || ''),
    afterDays: Number(rule.afterDays ?? 5),
    warningDays: Number(rule.warningDays ?? thresholds.warningDays),
    criticalDays: Number(rule.criticalDays ?? thresholds.criticalDays),
    escalationMode: (rule.escalationMode || 'manager_review') as EscalationMode,
    message: String(rule.message || ''),
    delivery: ensureDeliveryConfig(rule.delivery || null),
  });

  const stakeholderRoleLabel = (role: StakeholderRole) => {
    if (role === 'responsible') return t('myWork.taskDetail.responsible', 'Responsible');
    if (role === 'accountable') return t('myWork.taskDetail.accountable', 'Accountable');
    if (role === 'consulted') return t('myWork.taskDetail.consulted', 'Consulted');
    return t('myWork.taskDetail.informed', 'Informed');
  };

  const stakeholderChannelLabels = (settings?: StakeholderNotificationSettings) => {
    if (!settings?.enabled) return [t('myWork.taskDetail.disabled', 'Disabled')];
    const labels: string[] = [];
    if (settings.inAppEnabled) labels.push('In-app');
    if (settings.emailEnabled) labels.push('Email');
    if (settings.integrationChannels) {
      settings.integrationChannels.forEach((ch: string) => {
        labels.push(ch.charAt(0).toUpperCase() + ch.slice(1));
      });
    }
    return labels.length > 0 ? labels : ['In-app'];
  };

  const deliveryBadgeLabels = (delivery?: DeliveryConfig, fallback?: ReminderRule) => {
    const source = delivery || (fallback ? ensureDeliveryConfig(null, fallback) : null);
    if (!source) return ['In-app'];
    const labels: string[] = source.coreChannels.map((ch: string) =>
      ch === 'in_app' ? 'In-app' : ch.charAt(0).toUpperCase() + ch.slice(1)
    );
    source.integrationChannels.forEach((ch: string) =>
      labels.push(ch.charAt(0).toUpperCase() + ch.slice(1))
    );
    return labels.length > 0 ? labels : ['In-app'];
  };

  // Activity Log
  interface ActivityLogEntry {
    id: string;
    type:
      | 'created'
      | 'status_change'
      | 'assignment'
      | 'comment'
      | 'edit'
      | 'attachment'
      | 'deadline'
      | 'priority';
    description: string;
    userId?: string;
    userName?: string;
    timestamp: string;
    oldValue?: string;
    newValue?: string;
  }
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    {
      id: '1',
      type: 'created',
      description: t('myWork.taskDetail.description', 'Task created'),
      userName: createdBy || 'System',
      timestamp: createdAt || new Date().toISOString(),
    },
  ]);

  // Activity Log helper
  const addActivityLogEntry = (
    type: ActivityLogEntry['type'],
    description: string,
    oldValue?: string,
    newValue?: string
  ) => {
    const entry: ActivityLogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      description,
      timestamp: new Date().toISOString(),
      userName: 'Current User',
      oldValue,
      newValue,
    };
    setActivityLog((prev) => [entry, ...prev]);
  };

  // ── Presentation Mode (N = page-first / C = ClickUp) ──────────────────────
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'task',
    syncURL: true,
  });
  const reducedMotion = useReducedMotion();
  const motionDuration = reducedMotion ? 0 : 0.22;
  const [activeNSection, setActiveNSection] = useState('description-scope');
  // ── Read/Edit toggle (Menu 1, klasa S) ─────────────────────────────────────
  // "Do pokazania klientowi": read = karty read-only (hideActions), główne pola
  // wyłączone, pasek akcji stanu (Reassign/Delay/Mark complete) ukryty.
  // Z31/#31: karta otwiera się DOMYŚLNIE na READ gdy już istnieje (taskId).
  // Wyjątek: świeżo tworzony task (brak taskId — jeszcze nie zapisany, więc
  // z definicji pusty) → EDIT od razu.
  // Drugi wyjątek (task właśnie utworzony i pusty, wiek < 2 min) — patrz loadTask.
  const [readMode, setReadMode] = useState<boolean>(() => Boolean(taskId));

  useEffect(() => {
    if (presentationMode === 'c') {
      setPresentationMode('n');
    }
  }, [presentationMode, setPresentationMode]);

  // N-mode comment state (for CommentsCanvas)
  const [nCommentDraft, setNCommentDraft] = useState('');
  const [nCommentPriority, setNCommentPriority] = useState<CommentPriority>('normal');
  const [nCommentDateFilter, setNCommentDateFilter] = useState<DateFilter>('all');
  const [nCommentSortOrder, setNCommentSortOrder] = useState<SortOrder>('desc');

  // UI State (accordion / D-mode)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

  // Load data
  useEffect(() => {
    loadUsers();
    loadInitiatives();
  }, []);

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
    } else {
      resetForm();
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId || !title?.trim()) {
      setRelatedNotes([]);
      return;
    }
    let cancelled = false;
    Api.getNotebookPages({ q: title, limit: 5 })
      .then((pages) => {
        if (!cancelled) setRelatedNotes(Array.isArray(pages) ? pages : []);
      })
      .catch(() => {
        if (!cancelled) setRelatedNotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, title]);

  // Load persisted task↔decision links from the Link Graph (link_graph_edges).
  // Edges are stored as source = decision, target = task, so we read the task's
  // backlinks and keep only decision sources. Titles/statuses are resolved from
  // availableDecisions when present (falls back to the id while that list loads).
  useEffect(() => {
    if (!taskId) {
      setRelatedDecisions([]);
      return;
    }
    let cancelled = false;
    Api.getLinkGraphBacklinks({ type: 'task', id: taskId, limit: 100 })
      .then((edges) => {
        if (cancelled) return;
        const decisionEdges = (Array.isArray(edges) ? edges : []).filter(
          (e) => String(e.sourceType || '').toLowerCase() === 'decision'
        );
        const decisionById = new Map(availableDecisions.map((d) => [String(d.id), d]));
        const hydrated: RelatedDecision[] = decisionEdges.map((e) => {
          const match = decisionById.get(String(e.sourceId));
          const status = String(match?.status || 'pending').toLowerCase();
          const allowed = ['pending', 'approved', 'rejected', 'deferred', 'escalated'];
          return {
            id: String(e.id),
            edgeId: String(e.id),
            decisionId: String(e.sourceId),
            decisionTitle: match?.title || t('myWork.taskDetail.decision', 'Decision'),
            decisionStatus: (allowed.includes(status)
              ? status
              : 'pending') as RelatedDecision['decisionStatus'],
            relationshipType: 'requires',
          };
        });
        setRelatedDecisions(hydrated);
      })
      .catch(() => {
        if (!cancelled) setRelatedDecisions([]);
      });
    return () => {
      cancelled = true;
    };
    // availableDecisions in deps so titles backfill once the decisions list arrives.
  }, [taskId, availableDecisions, isPolish]);

  useEffect(() => {
    const q = `${title || ''} ${description || ''}`.trim();
    if (!q) {
      setSuggestedIdeas([]);
      setSuggestedNotes([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setSuggestedIdeasLoading(true);
        const ideas = await Api.suggestMyIdeas(q.slice(0, 300), 5);
        const arr = Array.isArray(ideas) ? ideas : [];
        setSuggestedIdeas(arr);
        if (arr.length > 0) {
          trackFunnelEvent('my_idea_suggested', { surface: 'task', count: arr.length });
        }
      } catch {
        setSuggestedIdeas([]);
      } finally {
        setSuggestedIdeasLoading(false);
      }

      try {
        setSuggestedNotesLoading(true);
        const notes = await Api.getNotebookPages({ q: q.slice(0, 300), limit: 5 });
        const arr = Array.isArray(notes) ? notes : [];
        setSuggestedNotes(arr);
        if (arr.length > 0) {
          trackFunnelEvent('active_notes_suggested', { surface: 'task', count: arr.length });
        }
      } catch {
        setSuggestedNotes([]);
      } finally {
        setSuggestedNotesLoading(false);
      }
    }, 450);

    return () => window.clearTimeout(handle);
  }, [title, description]);

  const loadUsers = async () => {
    try {
      const response = await Api.get('/users');
      const usersArray = Array.isArray(response) ? response : response?.users || [];
      setUsers(
        usersArray.map((u: any) => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        }))
      );
    } catch (error) {
      console.error('Failed to load users', error);
    }
  };

  const loadInitiatives = async () => {
    try {
      const data = await InitiativeService.getAll();
      const initiativesArray = Array.isArray(data) ? data : (data as any)?.initiatives || [];
      setAvailableInitiatives(
        initiativesArray.map((i: any) => ({
          id: i.id,
          name: i.name,
          type: i.type || 'project',
        }))
      );
    } catch (error) {
      console.error('Failed to load initiatives', error);
    }
  };

  const loadTask = async (id: string) => {
    try {
      setLoading(true);
      setNotFound(false);
      const task = await Api.getPersonalTask(id);
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(normalizePriority(task.priority));
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setStartDate(task.startedAt ? task.startedAt.split('T')[0] : '');
      setBlockedReason(task.blockedReason || '');
      setOwnerId(task.ownerId || task.assigneeId || '');
      setAssigneeId(task.assigneeId || '');
      setInitiativeId(task.initiativeId || null);
      setProjectId(task.projectId || '');
      setProjectName(task.projectName || '');
      setCreatedBy(task.createdByName || task.createdBy || '');
      setCreatedAt(task.createdAt || '');
      setTags(task.tags || []);
      setChecklist(task.checklist || []);
      setAttachments(task.attachments || []);
      setComments(task.comments || []);
      setLinkedItems(task.linkedItems || []);
      setSourceType(task.sourceType || task.source_type || null);
      setSourceId(task.sourceId || task.source_id || null);
      setBlockedByDecisionId(task.blockedByDecisionId || '');

      // Z31: świeżo utworzony task (bez opisu, wiek < 2 min) → otwórz na EDIT,
      // nie READ (default). Tani sygnał — bez systemu uprawnień (to gate #28).
      const createdAtMs = task.createdAt ? new Date(task.createdAt).getTime() : NaN;
      const isFreshAndEmpty =
        !task.description?.trim() &&
        !Number.isNaN(createdAtMs) &&
        Date.now() - createdAtMs < 2 * 60 * 1000;
      if (isFreshAndEmpty) {
        setReadMode(false);
      }

      // Set initiative name if found
      if (task.initiativeId) {
        const init = availableInitiatives.find((i) => i.id === task.initiativeId);
        setInitiativeName(init?.name || null);
      }

      // Baseline snapshot for dirty-check (only persisted fields)
      try {
        const baseline = {
          title: task.title || '',
          description: task.description || '',
          status: task.status || 'todo',
          priority: normalizePriority(task.priority),
          // Z28: normalize empty dates to null to match the draft/payload snapshot
          // (which use `|| null`); '' vs null made isDirty falsely true → autosave loop.
          dueDate: task.dueDate ? String(task.dueDate).split('T')[0] : null,
          startedAt: task.startedAt ? String(task.startedAt).split('T')[0] : null,
          blockedReason: task.status === 'blocked' ? task.blockedReason || '' : '',
          tags: task.tags || [],
          checklist: task.checklist || [],
          initiativeId: task.initiativeId || null,
          assigneeId: task.assigneeId || null,
          ownerId: task.ownerId || task.assigneeId || null,
        };
        setLastSavedSnapshot(JSON.stringify(baseline));
        setLastSavedAt(new Date().toISOString());
      } catch {
        setLastSavedSnapshot('');
        setLastSavedAt(null);
      }
    } catch (error) {
      console.error('Failed to load task', error);
      // A 404 means the task no longer exists (or isn't visible to this user):
      // render an explicit "not found" state instead of a blank form + toast.
      const status = (error as { status?: number } | null)?.status;
      if (status === 404) {
        setNotFound(true);
      } else {
        toast.error(t('myWork.taskDetail.toastError', 'Failed to load task'));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStatus('todo');
    setPriority('medium');
    setDueDate('');
    setStartDate('');
    setBlockedReason('');
    setOwnerId('');
    setAssigneeId('');
    setInitiativeId(null);
    setInitiativeName(null);
    setProjectId('');
    setProjectName('');
    setTags([]);
    setChecklist([]);
    setAttachments([]);
    setComments([]);
    setLinkedItems([]);
    setStakeholders([]);
    setReminders([]);
    setEscalation(null);
    setBlockedByDecisionId('');
    setRelatedNotes([]);
  };

  const handleSave = async (silent = false) => {
    if (!title.trim()) {
      if (!silent) toast.error(t('myWork.taskDetail.toastError2', 'Title is required'));
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate || null,
        startedAt: startDate || null,
        blockedReason: status === 'blocked' ? blockedReason : '',
        tags,
        checklist,
        initiativeId: initiativeId || null,
        assigneeId: assigneeId || null,
        ownerId: ownerId || null,
      };

      const personalPayload = {
        title,
        description,
        status,
        priority,
        dueDate: dueDate || null,
        tags,
      };

      // Always persist a local draft before attempting network save (offline safety net)
      try {
        const draftKey = `consultify-task-draft:${taskId || 'new'}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            schemaVersion: 1,
            source: 'save',
            savedAt: new Date().toISOString(),
            taskId: taskId || null,
            projectId: projectId || null,
            initiativeId: initiativeId || null,
            draft: {
              ...payload,
              projectId: projectId || null,
              initiativeName,
              projectName,
              createdBy,
              createdAt,
              // Extra editable state (best-effort snapshot)
              blockedByDecisionId,
              attachments,
              comments,
              linkedItems,
              stakeholders,
              reminders,
              escalation,
              thresholds,
            },
          })
        );
      } catch (e) {
        // Local draft is best-effort; don't block Save on storage errors
        console.warn('[TaskDetailView] Failed to persist local draft', e);
      }

      if (taskId) {
        await Api.updatePersonalTask(taskId, personalPayload);
        if (!silent) toast.success(t('myWork.taskDetail.toastSuccess', 'Task updated'));
        emitMyWorkEvent({ type: 'item:updated', entityType: 'task', entityId: taskId });
        if (personalPayload?.dueDate) {
          trackFunnelEvent('personal_task_due_date_set', { source: 'detail', taskId });
        }
        if (personalPayload?.status === 'done') {
          trackFunnelEvent('personal_task_completed', { source: 'detail', taskId });
          emitMyWorkEvent({ type: 'item:completed', entityType: 'task', entityId: taskId });
        }
        onSaved?.({ ...personalPayload, id: taskId });
      } else {
        const created = await Api.createPersonalTask(personalPayload);
        if (!silent) toast.success(t('myWork.taskDetail.toastSuccess2', 'Task created'));
        trackFunnelEvent('personal_task_created', {
          source: 'detail',
          taskId: created?.id || null,
        });
        if (personalPayload?.dueDate) {
          trackFunnelEvent('personal_task_due_date_set', {
            source: 'detail',
            taskId: created?.id || null,
          });
        }
        if (personalPayload?.status === 'done') {
          trackFunnelEvent('personal_task_completed', {
            source: 'detail',
            taskId: created?.id || null,
          });
        }
        onSaved?.({ ...personalPayload, id: created?.id || null });
      }

      // Update dirty baseline after a successful save
      try {
        setLastSavedSnapshot(JSON.stringify({ ...payload, startedAt: startDate || null }));
        setLastSavedAt(new Date().toISOString());
      } catch {
        /* ignore */
      }
    } catch (error) {
      console.error('Failed to save task', error);
      if (!silent) toast.error(t('myWork.taskDetail.toastError3', 'Failed to save task'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = async () => {
    setChatKickoffMessage(
      buildAskAIMessage({
        type: 'task',
        title,
        status,
        priority,
        dueDate: dueDate || undefined,
        description: description || undefined,
      })
    );

    // Persist local draft so user never loses input (even offline)
    const draftKey = `consultify-task-draft:${taskId || 'new'}`;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          schemaVersion: 1,
          source: 'chat',
          savedAt: new Date().toISOString(),
          taskId: taskId || null,
          projectId: projectId || null,
          initiativeId: initiativeId || null,
          draft: {
            title,
            description,
            status,
            priority,
            dueDate: dueDate || null,
            startedAt: startDate || null,
            blockedReason: status === 'blocked' ? blockedReason : '',
            tags,
            checklist,
            initiativeId: initiativeId || null,
            initiativeName,
            assigneeId: assigneeId || null,
            ownerId: ownerId || null,
            projectId: projectId || null,
            projectName,
            blockedByDecisionId,
            attachments,
            comments,
            linkedItems,
            stakeholders,
            reminders,
            escalation,
            thresholds,
          },
        })
      );
    } catch (e) {
      console.warn('[TaskDetailView] Failed to persist local draft (chat)', e);
    }

    // Ensure chat panel is visible
    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    // Push rich task context into the unified chat workspace context (no extra buttons needed)
    updateWorkspaceFromView(AppView.MY_WORK, taskId || 'new', {
      type: 'task',
      id: taskId || null,
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      startedAt: startDate || null,
      blockedReason: status === 'blocked' ? blockedReason : '',
      tags,
      checklist,
      initiativeId: initiativeId || null,
      initiativeName,
      projectId: projectId || null,
      projectName,
      blockedByDecisionId,
    });

    toast.success(t('myWork.taskDetail.toastSuccess3', 'Draft saved and chat opened'));
  };

  // Section toggle
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Checklist handlers
  const addChecklistItem = () => {
    setChecklist([
      ...checklist,
      { id: Math.random().toString(36).substr(2, 9), text: '', completed: false },
    ]);
  };

  const updateChecklistItem = (id: string, updates: Partial<(typeof checklist)[0]>) => {
    setChecklist(checklist.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter((item) => item.id !== id));
  };

  // Tags handlers
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Calculate progress from checklist
  const checklistProgress = useMemo(() => {
    if (checklist.length === 0) return 0;
    return Math.round((checklist.filter((c) => c.completed).length / checklist.length) * 100);
  }, [checklist]);

  // Attachment handlers
  const handleUploadAttachments = async (files: FileList) => {
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleDeleteAttachment = async (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  // Comment handlers
  const handleAddComment = async (content: string, parentId?: string) => {
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      authorId: 'current-user',
      authorName: 'Current User',
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      parentId,
    };
    if (parentId) {
      setComments(
        comments.map((c) =>
          c.id === parentId ? { ...c, replies: [...(c.replies || []), newComment] } : c
        )
      );
    } else {
      setComments([...comments, newComment]);
    }
  };

  const handleDeleteComment = async (id: string) => {
    setComments(comments.filter((c) => c.id !== id));
  };

  const handleLikeComment = async (id: string) => {
    setComments(
      comments.map((c) =>
        c.id === id
          ? { ...c, likes: c.likedByMe ? c.likes - 1 : c.likes + 1, likedByMe: !c.likedByMe }
          : c
      )
    );
  };

  // Linked items handlers
  const handleAddLinkedItem = async (item: LinkedItem) => {
    // Duplicate check — same id + type already present?
    const isDuplicate = linkedItems.some((li) => li.id === item.id && li.type === item.type);
    if (isDuplicate) {
      toast(t('myWork.taskDetail.toast', 'This item is already linked'), {
        icon: '⚠️',
      });
      return;
    }
    setLinkedItems((prev) => [...prev, item]);
  };

  const handleRemoveLinkedItem = async (item: Pick<LinkedItem, 'id' | 'type'>) => {
    setLinkedItems((prev) =>
      prev.filter((i) =>
        item.type ? !(i.id === item.id && i.type === item.type) : i.id !== item.id
      )
    );
  };

  const searchLinkedItems = useCallback(async (query: string): Promise<LinkedItem[]> => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    try {
      const [
        tasksRes,
        initiativesRes,
        decisionsRes,
        projectsRes,
        assessmentsRes,
        reportsRes,
        toolsRes,
        insightsRes,
      ] = await Promise.allSettled([
        Api.getPersonalTasks({ includeDone: true, limit: 50 }),
        Api.get('/initiatives'),
        Api.getDecisions(),
        Api.getProjects(),
        Api.get('/assessments'),
        Api.get('/reports'),
        Api.listToolSessions({ limit: 50 }),
        Api.get('/interview/insights'),
      ]);

      const tasks =
        tasksRes.status === 'fulfilled'
          ? Array.isArray(tasksRes.value)
            ? tasksRes.value
            : (tasksRes.value as any)?.tasks || []
          : [];
      const initiatives =
        initiativesRes.status === 'fulfilled'
          ? Array.isArray(initiativesRes.value)
            ? initiativesRes.value
            : initiativesRes.value?.initiatives || []
          : [];
      const decisions = decisionsRes.status === 'fulfilled' ? decisionsRes.value || [] : [];
      setAvailableDecisions(
        (decisions as any[]).map((d: any) => ({
          id: String(d.id),
          title: String(d.title || 'Decision'),
          status: String(d.status || 'pending'),
        }))
      );
      const projects =
        projectsRes.status === 'fulfilled'
          ? Array.isArray(projectsRes.value)
            ? projectsRes.value
            : (projectsRes.value as any)?.projects || []
          : [];
      const assessments =
        assessmentsRes.status === 'fulfilled'
          ? Array.isArray(assessmentsRes.value)
            ? assessmentsRes.value
            : assessmentsRes.value?.assessments || []
          : [];
      const reports =
        reportsRes.status === 'fulfilled'
          ? Array.isArray(reportsRes.value)
            ? reportsRes.value
            : reportsRes.value?.reports || []
          : [];
      const tools =
        toolsRes.status === 'fulfilled'
          ? Array.isArray(toolsRes.value)
            ? toolsRes.value
            : toolsRes.value?.items || []
          : [];
      const insights =
        insightsRes.status === 'fulfilled'
          ? Array.isArray(insightsRes.value)
            ? insightsRes.value
            : insightsRes.value?.insights || []
          : [];

      const mappedTasks: LinkedItem[] = tasks
        .filter((t: any) =>
          String(t.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((t: any) => ({
          id: String(t.id),
          type: 'task' as const,
          title: String(t.title || 'Task'),
          status: t.status,
          priority: t.priority,
        }));
      const mappedInitiatives: LinkedItem[] = initiatives
        .filter((i: any) =>
          String(i.name || i.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((i: any) => ({
          id: String(i.id),
          type: 'initiative' as const,
          title: String(i.name || i.title || 'Initiative'),
          status: i.status,
          priority: i.priority,
        }));
      const mappedDecisions: LinkedItem[] = decisions
        .filter((d: any) =>
          String(d.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((d: any) => ({
          id: String(d.id),
          type: 'decision' as const,
          title: String(d.title || 'Decision'),
          status: d.status,
          priority: d.priority,
        }));
      const mappedProjects: LinkedItem[] = projects
        .filter((p: any) =>
          String(p.name || p.title || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 10)
        .map((p: any) => ({
          id: String(p.id),
          type: 'project' as const,
          title: String(p.name || p.title || 'Project'),
          status: p.status,
          priority: p.priority,
        }));
      const mappedAssessments: LinkedItem[] = assessments
        .filter((a: any) =>
          String(a.title || a.name || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((a: any) => ({
          id: String(a.id),
          type: 'assessment' as const,
          title: String(a.title || a.name || 'Assessment'),
          status: a.status,
          url: '/assessment',
        }));
      const mappedReports: LinkedItem[] = reports
        .filter((r: any) =>
          String(r.title || r.name || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((r: any) => ({
          id: String(r.id),
          type: 'report' as const,
          title: String(r.title || r.name || 'Report'),
          status: r.status,
          url: `/assessment-reports/${String(r.id)}`,
        }));
      const mappedTools: LinkedItem[] = tools
        .filter((tool: any) =>
          String(tool.name || tool.title || tool.toolType || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((tool: any) => ({
          id: String(tool.id),
          type: 'tool' as const,
          title: String(tool.name || tool.title || tool.toolType || 'Tool'),
          status: tool.status,
          url: '/tools',
        }));
      const mappedInsights: LinkedItem[] = insights
        .filter((insight: any) =>
          String(insight.title || insight.name || insight.summary || '')
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 8)
        .map((insight: any) => ({
          id: String(insight.id),
          type: 'insight' as const,
          title: String(insight.title || insight.name || 'Insight'),
          status: insight.status,
          url: '/interview',
        }));

      return [
        ...mappedTasks,
        ...mappedInitiatives,
        ...mappedDecisions,
        ...mappedProjects,
        ...mappedAssessments,
        ...mappedReports,
        ...mappedTools,
        ...mappedInsights,
      ].slice(0, 24);
    } catch {
      return [];
    }
  }, []);

  const openLinkedItemTarget = useCallback(
    (item: LinkedItem) => {
      const explicitUrl = item.externalUrl || item.url;
      const normalizedItemId = String(item.id);
      const fallbackPath =
        item.type === 'task'
          ? `/my-work/tasks/${normalizedItemId}`
          : item.type === 'decision'
            ? `/my-work/decisions/${normalizedItemId}`
            : item.type === 'initiative'
              ? `/initiatives/${normalizedItemId}`
              : item.type === 'project'
                ? `/projects/${normalizedItemId}`
                : item.type === 'assessment'
                  ? '/assessment'
                  : item.type === 'report'
                    ? `/assessment-reports/${normalizedItemId}`
                    : item.type === 'tool'
                      ? '/tools'
                      : item.type === 'insight'
                        ? '/interview'
                        : null;
      const target = explicitUrl || fallbackPath;
      if (!target) {
        toast(t('myWork.taskDetail.toast2', 'No target link available'), { icon: 'ℹ️' });
        return;
      }
      window.open(target, '_blank', 'noopener,noreferrer');
    },
    [isPolish]
  );

  // NOTE: loading check moved below all hooks to avoid "fewer hooks" error.
  // See the `if (loading)` guard before the N-mode / D-mode render blocks.

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const StatusIcon = statusConfig.icon;
  const isPending = status === 'todo' || status === 'in_progress';
  const isBlocked = status === 'blocked';
  const isDone = status === 'done';
  const isDecisionBlocked = Boolean(blockedByDecisionId);

  // ── Risk helpers (matching Decision pattern) ──────────────────────────────
  const riskLevelOptions = useMemo(() => ['low', 'medium', 'high', 'critical'] as const, []);
  const riskCategoryOptions = useMemo(
    () =>
      ['technical', 'business', 'financial', 'operational', 'security'].map((c) => ({
        value: c,
        label:
          c === 'technical'
            ? t('myWork.taskDetail.technical', 'Technical')
            : c === 'business'
              ? t('myWork.taskDetail.business', 'Business')
              : c === 'financial'
                ? t('myWork.taskDetail.financial', 'Financial')
                : c === 'operational'
                  ? t('myWork.taskDetail.operational', 'Operational')
                  : t('myWork.taskDetail.security', 'Security'),
      })),
    [isPolish]
  );
  const quickMitigationArguments = useMemo(
    () =>
      isPolish
        ? ['POC przed wdrożeniem', 'Przegląd tygodniowy', 'Plan kontroli jakości']
        : ['POC before rollout', 'Weekly review checkpoint', 'Quality control plan'],
    [isPolish]
  );
  const quickContingencyArguments = useMemo(
    () =>
      isPolish
        ? ['Tryb ręczny fallback', 'Eskalacja do PMO', 'Przesunięcie terminu + komunikat']
        : ['Manual fallback mode', 'Escalate to PMO', 'Timeline shift with stakeholder notice'],
    [isPolish]
  );
  const riskLevelToScore = (level?: string) => {
    const n = String(level || '').toLowerCase();
    if (n === 'critical') return 4;
    if (n === 'high') return 3;
    if (n === 'medium') return 2;
    return 1;
  };
  const getRiskScore = (risk: RiskItem) =>
    riskLevelToScore(risk.probability) * riskLevelToScore(risk.impact);
  const getRiskScoreClass = (score: number) => {
    if (score >= 12)
      return 'text-danger-600 dark:text-danger-400 bg-danger-500/10 border-danger-500/30';
    if (score >= 8) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
    if (score >= 4)
      return 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  };
  const getRiskLevelClass = (level?: string) => {
    const n = String(level || '').toLowerCase();
    if (n === 'critical')
      return 'border-danger-500/60 bg-danger-500/10 text-danger-700 dark:text-danger-300';
    if (n === 'high')
      return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    if (n === 'medium')
      return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  };
  const getRiskLevelLabel = (level: string) => {
    if (isPolish) {
      if (level === 'critical') return 'Krytyczny';
      if (level === 'high') return 'Wysoki';
      if (level === 'medium') return 'Średni';
      return 'Niski';
    }
    if (level === 'critical') return 'Critical';
    if (level === 'high') return 'High';
    if (level === 'medium') return 'Medium';
    return 'Low';
  };
  const sortedRisks = useMemo(
    () =>
      [...risks].sort((a, b) => {
        const byScore = getRiskScore(b) - getRiskScore(a);
        if (byScore !== 0) return byScore;
        return String(a.title || '').localeCompare(String(b.title || ''));
      }),
    [risks]
  );
  const updateRisk = (id: string, updates: Partial<RiskItem>) =>
    setRisks(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  const removeRisk = (id: string) => setRisks(risks.filter((r) => r.id !== id));

  // Risk handlers
  const addRisk = () => {
    const newRisk: RiskItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      probability: 'medium',
      impact: 'medium',
      category: 'technical',
      mitigation: '',
      contingency: '',
    };
    setRisks([...risks, newRisk]);
  };

  const generateRisksAI = async () => {
    setIsGeneratingRisks(true);
    await new Promise((r) => setTimeout(r, 1500));
    const aiRisks: RiskItem[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        title: t('myWork.taskDetail.title', 'Delivery delay'),
        probability: 'medium',
        impact: 'high',
        category: 'operational',
        mitigation: '',
        contingency: '',
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        title: t('myWork.taskDetail.title2', 'Resource shortage'),
        probability: 'low',
        impact: 'medium',
        category: 'business',
        mitigation: '',
        contingency: '',
      },
    ];
    setRisks([...risks, ...aiRisks]);
    setIsGeneratingRisks(false);
    toast.success(t('myWork.taskDetail.toastSuccess4', 'AI risks generated'));
  };

  // Alternative handlers
  const addAlternative = () => {
    const newAlt: Alternative = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      description: '',
      pros: [''],
      cons: [''],
      isRecommended: false,
    };
    setAlternatives([...alternatives, newAlt]);
  };

  const generateAlternativesAI = async () => {
    setIsGeneratingAlternatives(true);
    await new Promise((r) => setTimeout(r, 1500));
    const aiAlts: Alternative[] = [
      {
        id: Math.random().toString(36).substr(2, 9),
        title: t('myWork.taskDetail.title3', 'Approach A'),
        description: '',
        pros: [t('myWork.taskDetail.fast', 'Fast')],
        cons: [t('myWork.taskDetail.expensive', 'Expensive')],
        isRecommended: true,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        title: t('myWork.taskDetail.title4', 'Approach B'),
        description: '',
        pros: [t('myWork.taskDetail.cheap', 'Cheap')],
        cons: [t('myWork.taskDetail.slow', 'Slow')],
        isRecommended: false,
      },
    ];
    setAlternatives([...alternatives, ...aiAlts]);
    setIsGeneratingAlternatives(false);
    toast.success(t('myWork.taskDetail.toastSuccess5', 'AI alternatives generated'));
  };

  // Implementation ideas handlers
  const addIdea = () => {
    const newIdea: ImplementationIdea = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      description: '',
      source: 'manual',
      status: 'idea',
      votes: 0,
      votedByMe: false,
    };
    setImplementationIdeas([...implementationIdeas, newIdea]);
  };

  const generateIdeasAI = async () => {
    setIsGeneratingIdeas(true);
    await new Promise((r) => setTimeout(r, 1800));

    const taskContext = title || 'task';
    const aiIdeas: ImplementationIdea[] = isPolish
      ? [
          {
            id: Math.random().toString(36).substr(2, 9),
            title: `Podejście 1: Automatyzacja z wykorzystaniem istniejących narzędzi`,
            description: `Wykorzystaj obecną infrastrukturę i narzędzia zespołu do realizacji "${taskContext}". Skonfiguruj pipeline CI/CD, dodaj testy automatyczne i wdróż monitoring. Estymacja: 3-5 dni roboczych.`,
            source: 'ai',
            status: 'idea',
            votes: 0,
            votedByMe: false,
          },
          {
            id: Math.random().toString(36).substr(2, 9),
            title: `Podejście 2: Outsourcing do specjalisty / zewnętrznego zespołu`,
            description: `Zlecenie realizacji "${taskContext}" wyspecjalizowanemu dostawcy. Wymaga przygotowania specyfikacji i kryteriów akceptacji. Zaleta: szybsze dostarczenie, brak obciążenia zespołu wewnętrznego.`,
            source: 'ai',
            status: 'idea',
            votes: 0,
            votedByMe: false,
          },
          {
            id: Math.random().toString(36).substr(2, 9),
            title: `Podejście 3: Iteracyjne wdrożenie w sprintach`,
            description: `Podziel zadanie na mniejsze deliverables i realizuj w 2-3 sprintach. Sprint 1: PoC/MVP, Sprint 2: integracja, Sprint 3: hardening + dokumentacja. Minimalizuje ryzyko przez wczesne feedback loops.`,
            source: 'ai',
            status: 'idea',
            votes: 0,
            votedByMe: false,
          },
        ]
      : [
          {
            id: Math.random().toString(36).substr(2, 9),
            title: `Approach 1: Automate using existing toolchain`,
            description: `Leverage the team's current infrastructure to implement "${taskContext}". Set up CI/CD pipeline, add automated tests, and deploy monitoring. Estimated effort: 3-5 working days.`,
            source: 'ai',
            status: 'idea',
            votes: 0,
            votedByMe: false,
          },
          {
            id: Math.random().toString(36).substr(2, 9),
            title: `Approach 2: Outsource to specialist / external team`,
            description: `Delegate "${taskContext}" to a specialized vendor. Requires preparing specs and acceptance criteria. Advantage: faster delivery, no internal team load.`,
            source: 'ai',
            status: 'idea',
            votes: 0,
            votedByMe: false,
          },
          {
            id: Math.random().toString(36).substr(2, 9),
            title: `Approach 3: Iterative delivery across sprints`,
            description: `Break the task into smaller deliverables across 2-3 sprints. Sprint 1: PoC/MVP, Sprint 2: integration, Sprint 3: hardening + documentation. Minimizes risk through early feedback loops.`,
            source: 'ai',
            status: 'idea',
            votes: 0,
            votedByMe: false,
          },
        ];

    setImplementationIdeas([...implementationIdeas, ...aiIdeas]);
    setIsGeneratingIdeas(false);
    toast.success(
      t('myWork.taskDetail.aIGenerated3Implementation', 'AI generated 3 implementation proposals')
    );
  };

  // AI Description handler
  const generateAIDescription = async () => {
    if (!title.trim()) {
      toast.error(t('myWork.taskDetail.toastError4', 'Enter title first'));
      return;
    }
    setIsGeneratingDescription(true);
    await new Promise((r) => setTimeout(r, 1500));

    const descriptions = [
      isPolish
        ? `Zadanie "${title}" obejmuje następujące działania:\n\n1. Analiza wymagań i określenie zakresu prac\n2. Przygotowanie niezbędnych zasobów i narzędzi\n3. Realizacja głównych kroków zgodnie z planem\n4. Weryfikacja i testowanie rezultatów\n5. Dokumentacja i przekazanie do akceptacji`
        : `Task "${title}" involves the following activities:\n\n1. Requirements analysis and scope definition\n2. Preparation of necessary resources and tools\n3. Execution of main steps according to plan\n4. Verification and testing of results\n5. Documentation and handover for acceptance`,
      isPolish
        ? `Cel: Realizacja "${title}"\n\nZakres prac:\n- Określenie szczegółowych wymagań\n- Koordynacja z zespołem i interesariuszami\n- Implementacja zgodnie z przyjętymi standardami\n- Kontrola jakości i walidacja\n\nUwagi: Zadanie wymaga regularnej komunikacji z zespołem.`
        : `Goal: Complete "${title}"\n\nScope of work:\n- Define detailed requirements\n- Coordinate with team and stakeholders\n- Implement according to established standards\n- Quality control and validation\n\nNotes: Task requires regular team communication.`,
    ];

    setDescription(descriptions[Math.floor(Math.random() * descriptions.length)]);
    setIsGeneratingDescription(false);
    addActivityLogEntry(
      'edit',
      t('myWork.taskDetail.aIGeneratedDescription', 'AI generated description')
    );
    toast.success(t('myWork.taskDetail.toastSuccess6', 'AI generated description'));
  };

  // AI Expected Outcome handler
  const generateAIOutcome = async () => {
    if (!title.trim()) {
      toast.error(t('myWork.taskDetail.toastError5', 'Enter title first'));
      return;
    }
    setIsGeneratingOutcome(true);
    await new Promise((r) => setTimeout(r, 1200));

    const outcomes = [
      isPolish
        ? `✅ Kryteria sukcesu dla "${title}":\n• Wszystkie wymagania spełnione i zweryfikowane\n• Dokumentacja kompletna i zatwierdzona\n• Brak błędów krytycznych\n• Akceptacja przez interesariuszy`
        : `✅ Success criteria for "${title}":\n• All requirements met and verified\n• Documentation complete and approved\n• No critical errors\n• Stakeholder acceptance`,
      isPolish
        ? `Oczekiwany rezultat:\n1. Zadanie ukończone w terminie\n2. Jakość zgodna ze standardami\n3. Pozytywna walidacja przez zespół QA\n4. Gotowość do wdrożenia/przekazania`
        : `Expected outcome:\n1. Task completed on time\n2. Quality meets standards\n3. Positive QA validation\n4. Ready for deployment/handover`,
    ];

    setExpectedOutcome(outcomes[Math.floor(Math.random() * outcomes.length)]);
    setIsGeneratingOutcome(false);
    addActivityLogEntry('edit', t('myWork.taskDetail.aIGeneratedOutcome', 'AI generated outcome'));
    toast.success(
      t('myWork.taskDetail.aIGeneratedExpectedOutcome', 'AI generated expected outcome')
    );
  };

  // AI Checklist handler
  const generateAIChecklist = async () => {
    if (!title.trim()) {
      toast.error(t('myWork.taskDetail.toastError6', 'Enter title first'));
      return;
    }
    setIsGeneratingChecklist(true);
    await new Promise((r) => setTimeout(r, 1500));

    const checklistItems = isPolish
      ? [
          'Przeanalizować wymagania',
          'Przygotować plan działania',
          'Zebrać niezbędne zasoby',
          'Wykonać główne zadanie',
          'Przetestować rezultaty',
          'Udokumentować wykonane prace',
          'Przekazać do przeglądu',
        ]
      : [
          'Analyze requirements',
          'Prepare action plan',
          'Gather necessary resources',
          'Execute main task',
          'Test results',
          'Document completed work',
          'Submit for review',
        ];

    const newItems = checklistItems.map((text) => ({
      id: Math.random().toString(36).substr(2, 9),
      text,
      completed: false,
    }));

    setChecklist([...checklist, ...newItems]);
    setIsGeneratingChecklist(false);
    addActivityLogEntry(
      'edit',
      t('myWork.taskDetail.aIGeneratedChecklist', 'AI generated checklist')
    );
    toast.success(t('myWork.taskDetail.toastSuccess7', 'AI generated checklist'));
  };

  // AI Comment handler
  const generateAIComment = async () => {
    setIsGeneratingAIComment(true);
    try {
      const recentComments = comments
        .slice(-5)
        .map((c, idx) => `${idx + 1}. ${c.authorName}: ${c.content}`)
        .join('\n');
      const checklistOpenCount = checklist.filter((item) => !item.completed).length;
      const blockersSummary =
        blockedReason?.trim() || linkedItems.filter((item) => item.type === 'risk').length > 0
          ? isPolish
            ? `${blockedReason || 'Brak jawnej przyczyny blokady'}`
            : `${blockedReason || 'No explicit blocking reason'}`
          : t('myWork.taskDetail.noBlockers', 'No blockers');

      const prompt = isPolish
        ? `Wygeneruj JEDEN konkretny komentarz do zadania projektowego.
Cel: pomóc zespołowi podjąć najbliższy sensowny krok.

Zasady:
- 2-4 krótkie zdania.
- Maksymalnie 450 znaków.
- Bez markdown, bez emoji, bez list numerowanych.
- Nie powtarzaj treści podobnej do ostatnich komentarzy.
- Komentarz ma być praktyczny i oparty na danych z kontekstu.

Kontekst zadania:
- Tytuł: ${title || 'Brak tytułu'}
- Opis: ${description || 'Brak opisu'}
- Status: ${status}
- Priorytet: ${priority}
- Termin: ${dueDate || 'Brak terminu'}
- Otwarte checklisty: ${checklistOpenCount}
- Blokery: ${blockersSummary}
- Liczba ryzyk: ${risks.length}
- Liczba zależności: ${dependencies.length}

Ostatnie komentarze:
${recentComments || 'Brak komentarzy'}

Zwróć WYŁĄCZNIE gotowy tekst komentarza.`
        : `Generate ONE concrete comment for a project task.
Goal: help the team choose the most useful immediate next step.

Rules:
- 2-4 short sentences.
- Max 450 characters.
- No markdown, no emoji, no numbered lists.
- Do not repeat or paraphrase recent comments.
- Keep it practical and grounded in the provided task context.

Task context:
- Title: ${title || 'Untitled'}
- Description: ${description || 'No description'}
- Status: ${status}
- Priority: ${priority}
- Due date: ${dueDate || 'No due date'}
- Open checklist items: ${checklistOpenCount}
- Blockers: ${blockersSummary}
- Risk count: ${risks.length}
- Dependency count: ${dependencies.length}

Recent comments:
${recentComments || 'No comments yet'}

Return ONLY the final comment text.`;

      const aiRes = await Api.post('/ai/chat', {
        message: prompt,
        history: [],
        systemInstruction: t(
          'myWork.taskDetail.systemInstruction',
          'You are a practical PMO coach. Respond briefly, concretely, and avoid generic filler.'
        ),
        roleName: 'Task Comment Advisor',
      });

      const raw = String(aiRes?.text || aiRes?.content || '').trim();
      const generatedComment = raw
        .replace(/^```[\w-]*\n?/g, '')
        .replace(/```$/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      if (!generatedComment) {
        throw new Error('Empty AI response');
      }

      const recentAIMessages = comments
        .filter((c) => c.authorId === 'ai-assistant')
        .slice(-3)
        .map((c) => c.content.trim().toLowerCase());

      const isDuplicate = recentAIMessages.includes(generatedComment.toLowerCase());
      if (isDuplicate) {
        throw new Error('Duplicate AI comment');
      }

      const newComment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        content: generatedComment,
        authorId: 'ai-assistant',
        authorName: 'AI Assistant',
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        isAIGenerated: true,
      };

      setComments((prev) => [...prev, newComment]);
      addActivityLogEntry(
        'comment',
        t('myWork.taskDetail.aIGeneratedComment', 'AI generated comment')
      );
      toast.success(t('myWork.taskDetail.toastSuccess8', 'AI comment generated'));
    } catch (error) {
      const fallback = isPolish
        ? `Proponuję doprecyzować jeden najbliższy krok i właściciela zadania na dziś. Dla priorytetu "${priority}" warto też potwierdzić blocker oraz termin, żeby uniknąć opóźnienia.`
        : `I suggest clarifying one immediate next step and assigning a clear owner today. For "${priority}" priority, also confirm blocker status and due date to reduce delivery risk.`;

      const lastAI = comments
        .filter((c) => c.authorId === 'ai-assistant')
        .slice(-1)[0]
        ?.content?.trim()
        .toLowerCase();
      const fallbackWithVariant =
        lastAI === fallback.trim().toLowerCase()
          ? `${fallback} ${t('myWork.taskDetail.focusOnAMeasurable', 'Focus on a measurable outcome by end of day.')}`
          : fallback;

      const newComment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        content: fallbackWithVariant,
        authorId: 'ai-assistant',
        authorName: 'AI Assistant',
        createdAt: new Date().toISOString(),
        likes: 0,
        likedByMe: false,
        isAIGenerated: true,
      };

      setComments((prev) => [...prev, newComment]);
      addActivityLogEntry(
        'comment',
        t('myWork.taskDetail.aIAddedFallbackComment', 'AI added fallback comment')
      );
      toast.success(t('myWork.taskDetail.toastSuccess9', 'Added a fallback AI comment'));
    } finally {
      setIsGeneratingAIComment(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // N-MODE DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Alert border classes for PropertiesStrip ─────────────────────────────
  const statusAlertBorderClass =
    status === 'blocked'
      ? 'border-danger-400/70 dark:border-danger-500/50'
      : status === 'done'
        ? 'border-emerald-400/70 dark:border-emerald-500/50'
        : status === 'in_progress'
          ? 'border-blue-400/70 dark:border-blue-500/50'
          : status === 'review'
            ? 'border-primary-400/70 dark:border-primary-500/50'
            : 'border-slate-200 dark:border-navy-600/60';
  const priorityAlertBorderClass =
    priority === 'critical'
      ? 'border-danger-400/70 dark:border-danger-500/50'
      : priority === 'high'
        ? 'border-amber-400/70 dark:border-amber-500/50'
        : priority === 'medium'
          ? 'border-blue-400/70 dark:border-blue-500/50'
          : 'border-slate-200 dark:border-navy-600/60';
  const dueDateAlertBorderClass = useMemo(() => {
    if (!dueDate) return undefined;
    const d = new Date(dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'border-danger-400 dark:border-danger-500/50';
    if (diff <= 3) return 'border-amber-400 dark:border-amber-500/50';
    return undefined;
  }, [dueDate]);

  // ── N-mode section navigation ────────────────────────────────────────────
  const taskNSections: NModeSection[] = useMemo(
    () => [
      {
        id: 'description-scope',
        icon: FileText,
        label: { en: 'Description & Scope', pl: 'Opis i zakres' },
        component: null,
      },
      {
        id: 'implementation',
        icon: Lightbulb,
        label: { en: 'Implementation Ideas', pl: 'Pomysły realizacji' },
        component: null,
      },
      {
        id: 'risk-alternatives',
        icon: AlertCircle,
        label: { en: 'Risk & Alternatives', pl: 'Ryzyko i alternatywy' },
        component: null,
      },
      {
        id: 'checklist',
        icon: CheckSquare,
        label: { en: 'Checklist', pl: 'Lista kontrolna' },
        component: null,
      },
      {
        id: 'dependencies',
        icon: GitBranch,
        label: { en: 'Dependencies', pl: 'Zależności' },
        component: null,
      },
      {
        id: 'evidence',
        icon: ShieldCheck,
        label: { en: 'Evidence', pl: 'Dowody' },
        component: null,
      },
      {
        id: 'governance',
        icon: Users,
        label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' },
        component: null,
      },
      {
        id: 'comments',
        icon: MessageSquare,
        label: { en: 'Comments', pl: 'Komentarze' },
        component: null,
      },
      {
        id: 'attachments-links',
        icon: FolderOpen,
        label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
        component: null,
      },
      {
        id: 'activity-log',
        icon: History,
        label: { en: 'Activity Log', pl: 'Aktywność' },
        component: null,
      },
    ],
    []
  );

  // ── CommentsCanvas props mapping ─────────────────────────────────────────
  const nModeComments: CommentItem[] = useMemo(
    () =>
      comments
        .filter((c) => {
          if (nCommentDateFilter === 'all') return true;
          const d = new Date(c.createdAt);
          const now = new Date();
          if (nCommentDateFilter === 'today') return d.toDateString() === now.toDateString();
          if (nCommentDateFilter === '7d') return now.getTime() - d.getTime() < 7 * 86400000;
          if (nCommentDateFilter === '30d') return now.getTime() - d.getTime() < 30 * 86400000;
          return true;
        })
        .sort((a, b) =>
          nCommentSortOrder === 'desc'
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
        .map((c) => ({
          id: c.id,
          authorName: c.authorName,
          content: c.content,
          createdAt: c.createdAt,
          isAIGenerated: c.authorId === 'ai-assistant',
          priority: 'normal' as CommentPriority,
        })),
    [comments, nCommentDateFilter, nCommentSortOrder]
  );

  const getPriorityDotClass = (p: CommentPriority) =>
    p === 'high' ? 'bg-danger-500' : p === 'low' ? 'bg-slate-400' : 'bg-blue-500';
  const getCommentPriority = (_c: CommentItem): CommentPriority => 'normal';
  const getPriorityButtonClass = (p: CommentPriority, active: boolean) =>
    active
      ? p === 'high'
        ? 'border-danger-400/80 text-danger-300 bg-danger-500/20 shadow-[0_0_0_1px_rgba(244,63,94,0.3)]'
        : p === 'low'
          ? 'border-emerald-400/80 text-emerald-300 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
          : 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]'
      : 'border-slate-300/55 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:border-slate-400/70 hover:text-slate-700 dark:text-slate-300';
  const getCommentPriorityLabel = (p: CommentPriority) =>
    p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal';
  const getCommentPriorityHint = (p: CommentPriority) =>
    p === 'high'
      ? t('myWork.taskDetail.requiresImmediateAttention', 'Requires immediate attention')
      : p === 'low'
        ? t('myWork.taskDetail.informationalComment', 'Informational comment')
        : t('myWork.taskDetail.standardComment', 'Standard comment');

  const handleNModeSubmitComment = () => {
    if (!nCommentDraft.trim()) return;
    handleAddComment(nCommentDraft);
    setNCommentDraft('');
  };

  // ── ActivityLogCanvas props mapping ──────────────────────────────────────
  const nModeActivityEntries: NModeActivityLogEntry[] = useMemo(
    () =>
      activityLog.map((e) => ({
        id: e.id,
        type: e.type,
        description: e.description,
        timestamp: e.timestamp,
        userName: e.userName,
        oldValue: e.oldValue,
        newValue: e.newValue,
      })),
    [activityLog]
  );

  const nModeActivityStats: ActivityStats = useMemo(() => {
    const total = activityLog.length;
    const edited = activityLog.filter(
      (e) => e.type === 'edit' || e.type === 'status_change'
    ).length;
    const escalations = activityLog.filter(
      (e) => e.type === 'deadline' || e.type === 'priority'
    ).length;
    const collaboration = activityLog.filter(
      (e) => e.type === 'comment' || e.type === 'assignment'
    ).length;
    return { total, edited, escalations, collaboration };
  }, [activityLog]);

  const nModeActivityTypeMeta = (type: string): ActivityTypeMeta => {
    const MAP: Record<string, { icon: React.ReactNode; label: string; style: string }> = {
      created: {
        icon: <Plus size={10} />,
        label: 'Created',
        style: 'border-emerald-300/50 bg-emerald-500/10 text-emerald-600',
      },
      status_change: {
        icon: <CheckCircle2 size={10} />,
        label: 'Status',
        style: 'border-blue-300/50 bg-blue-500/10 text-blue-600',
      },
      assignment: {
        icon: <User size={10} />,
        label: 'Assigned',
        style: 'border-primary-300/50 bg-primary-500/10 text-primary-600',
      },
      comment: {
        icon: <MessageSquare size={10} />,
        label: 'Comment',
        style: 'border-amber-300/50 bg-amber-500/10 text-amber-600',
      },
      edit: {
        icon: <Edit3 size={10} />,
        label: 'Edit',
        style: 'border-slate-300/50 bg-slate-500/10 text-slate-600',
      },
      attachment: {
        icon: <FileText size={10} />,
        label: 'Attachment',
        style: 'border-blue-300/50 bg-blue-500/10 text-blue-600',
      },
      deadline: {
        icon: <Calendar size={10} />,
        label: 'Deadline',
        style: 'border-danger-300/50 bg-danger-500/10 text-danger-600',
      },
      priority: {
        icon: <Flag size={10} />,
        label: 'Priority',
        style: 'border-amber-300/50 bg-amber-500/10 text-amber-600',
      },
    };
    return (
      MAP[type] || {
        icon: <Clock size={10} />,
        label: type,
        style: 'border-slate-300/50 bg-slate-500/10 text-slate-600',
      }
    );
  };

  // ── Wzorzec N: aplikacja wygenerowanej treści karty na pola ──────────────
  const applyGeneratedCard = useCallback(
    (key: AICardKey, content: any) => {
      if (!content) return;
      if (key === 'description-scope') {
        // Strategy → description (+ scal why/expectedOutcome jako blok, bo ten widok
        // nie ma dedykowanych pól why/outcome; nie gubimy treści).
        if (typeof content === 'string') {
          setDescription(content);
        } else if (typeof content === 'object') {
          const parts: string[] = [];
          if (content.description) parts.push(String(content.description));
          if (content.why) parts.push(`${t('myWork.taskDetail.why', 'Why')}: ${content.why}`);
          if (content.expectedOutcome)
            parts.push(
              `${t('myWork.taskDetail.expectedOutcome', 'Expected outcome')}: ${content.expectedOutcome}`
            );
          if (parts.length) setDescription(parts.join('\n\n'));
        }
      } else if (key === 'checklist') {
        const items: any[] = Array.isArray(content)
          ? content
          : Array.isArray(content?.checklist)
            ? content.checklist
            : Array.isArray(content?.acceptanceCriteria)
              ? content.acceptanceCriteria
              : [];
        if (items.length) {
          setChecklist(
            items.map((it: any) => ({
              id: Math.random().toString(36).slice(2, 11),
              text: typeof it === 'string' ? it : it.text || it.title || '',
              completed: false,
            }))
          );
        }
      } else if (key === 'evidence') {
        // Backend zwraca {"evidence": ["dowód 1", ...]} — dodajemy jako pozycje
        // wymaganych dowodów (typ DOCUMENT), NIE nadpisując istniejących ręcznych.
        const raw: any[] = Array.isArray(content)
          ? content
          : Array.isArray(content?.evidence)
            ? content.evidence
            : [];
        const items = raw
          .map((it: any) => (typeof it === 'string' ? it : it?.text || it?.title || ''))
          .filter((t: string) => t.trim().length > 0)
          .map((t: string) => ({
            id: Math.random().toString(36).slice(2, 11),
            type: 'DOCUMENT' as EvidenceType,
            title: t,
          }));
        if (items.length) {
          setEvidenceItems((prev) => [...prev, ...items]);
        }
      }
      // 'dependencies' → treść informacyjna; ten widok trzyma zależności jako
      // powiązane zadania (DependenciesSection), więc AI-draft pokazujemy jako
      // sugestie w opisie sekcji bez nadpisywania realnych powiązań.
    },
    [isPolish]
  );

  // ── Wzorzec N: generacja karty przez AI (onRegenerate / onGenerate) ──────
  const generateCard = useCallback(
    async (key: AICardKey) => {
      if (!taskId) {
        toast.error(
          t('myWork.taskDetail.saveTheTaskBefore', 'Save the task before generating with AI')
        );
        return;
      }
      setCard(key, 'generating');
      try {
        const backendKey = CARD_BACKEND_KEY[key];
        const result: any = await Api.post(`/tasks/${taskId}/sections/${backendKey}/generate`, {
          language: t('myWork.taskDetail.language', 'en'),
        });
        applyGeneratedCard(key, result?.content);
        setCardAI((p) => ({ ...p, [key]: true }));
        setCard(key, 'ai-draft');
      } catch (err) {
        console.error('[TaskDetailView] section generation failed', err);
        setCard(key, 'error');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskId, isPolish, applyGeneratedCard, setCard]
  );

  // ── Build N-mode sections with components ────────────────────────────────
  const nModeSectionsWithContent: NModeSection[] = useMemo(() => {
    return taskNSections.map((section) => {
      let component: React.ReactNode = null;

      switch (section.id) {
        // ── 1. Description & Scope ─────────────────────────────────────
        case 'description-scope':
          {
            // Build related items list (initiative + linked items)
            const relatedTaskItems: { id: string; type: string; title: string }[] = [];
            if (initiativeName && initiativeId) {
              relatedTaskItems.push({
                id: initiativeId,
                type: t('myWork.taskDetail.type', 'Initiative'),
                title: initiativeName,
              });
            }
            linkedItems.forEach((item) => {
              relatedTaskItems.push({
                id: item.id,
                type: item.type || 'item',
                title: item.title || item.id,
              });
            });

            component = (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                    {t('myWork.taskDetail.descriptionScope', 'Description & Scope')}
                  </h2>
                </div>

                {/* 1) Related to — initiative, assessment, survey, etc. */}
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t('myWork.taskDetail.relatedTo', 'Related to')}
                  </label>
                  {relatedTaskItems.length === 0 ? (
                    <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-amber-400/60 text-amber-600 dark:text-amber-300 bg-amber-500/10">
                      {t(
                        'myWork.taskDetail.noLinkedSourceStandalone',
                        'No linked source — standalone task'
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {relatedTaskItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-300"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 uppercase">
                              {item.type}
                            </span>
                            <span className="truncate">{item.title}</span>
                          </div>
                          <span className="shrink-0 text-[11px] font-mono text-slate-500/70 dark:text-slate-500/70">
                            {String(item.id).length > 24
                              ? `${String(item.id).slice(0, 24)}...`
                              : item.id}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2) Task Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t('myWork.taskDetail.taskDescription', 'Task description')}
                    </label>
                    {!readMode && (
                      <AIFieldEnhancer
                        fieldKey="task-description"
                        sectionLabel={t('myWork.taskDetail.sectionLabel', 'Task Description')}
                        currentValue={description}
                        onApply={setDescription}
                        artifactContext={{ title, status, priority, type: 'task' }}
                      />
                    )}
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => !readMode && setDescription(e.target.value)}
                    readOnly={readMode}
                    rows={10}
                    className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-c-focus transition-colors min-h-[200px]"
                    placeholder={t(
                      'myWork.taskDetail.describeWhatNeedsTo',
                      'Describe what needs to be done, why it matters, any constraints or dependencies...'
                    )}
                  />
                </div>

                {/* 2.1) Relevant ideas (T009) — hidden in Read (do pokazania klientowi) */}
                {!readMode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        {t('myWork.ideas.suggestions', 'Relevant ideas')}
                      </label>
                      {suggestedIdeasLoading ? (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('common.loading', 'Loading…')}
                        </span>
                      ) : null}
                    </div>

                    {suggestedIdeas.length === 0 ? (
                      <Callout
                        variant="info"
                        title={t('myWork.ideas.suggestionsEmptyTitle', 'No suggestions')}
                      >
                        {t(
                          'myWork.ideas.suggestionsEmpty',
                          'Save ideas from chat to build your private library.'
                        )}
                      </Callout>
                    ) : (
                      <div className="space-y-2">
                        {suggestedIdeas.map((idea) => (
                          <div
                            key={idea.id}
                            className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/60 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {idea.title}
                                </div>
                                {idea.body ? (
                                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {idea.body}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <button
                                  onClick={() => {
                                    const insert = [
                                      '',
                                      '---',
                                      `${t('myWork.ideas.idea', 'Idea')}: ${idea.title}`,
                                      idea.body || '',
                                    ]
                                      .filter(Boolean)
                                      .join('\n');
                                    setDescription((prev) => `${prev || ''}${insert}`.trim());
                                    trackFunnelEvent('my_idea_used', {
                                      surface: 'task',
                                      ideaId: idea.id,
                                    });
                                    toast.success(
                                      t('myWork.ideas.insertedToast', 'Inserted into description')
                                    );
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 border border-primary-500 text-primary-600 dark:text-primary-300 hover:bg-primary-500/20 transition-colors"
                                >
                                  {t('myWork.ideas.insert', 'Insert')}
                                </button>
                                <button
                                  onClick={() => {
                                    try {
                                      const { setMyWorkIntent } = useAppStore.getState() as any;
                                      setMyWorkIntent?.({
                                        tab: 'ideas',
                                        open: {
                                          type: 'idea',
                                          id: idea.id,
                                          name: idea.title,
                                          data: idea,
                                        },
                                      });
                                    } catch {
                                      /* ignore */
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                                >
                                  {t('myWork.ideas.open', 'Open')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 2.2) Relevant notes (T011) — hidden in Read (do pokazania klientowi) */}
                {!readMode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        {t('myWork.notebook.suggestions', 'Relevant notes')}
                      </label>
                      {suggestedNotesLoading ? (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('common.loading', 'Loading…')}
                        </span>
                      ) : null}
                    </div>

                    {suggestedNotes.length === 0 ? (
                      <Callout
                        variant="info"
                        title={t('myWork.notebook.suggestionsEmptyTitle', 'No suggestions')}
                      >
                        {t(
                          'myWork.notebook.suggestionsEmpty',
                          'Create notebook pages to build a searchable knowledge base.'
                        )}
                      </Callout>
                    ) : (
                      <div className="space-y-2">
                        {suggestedNotes.map((note) => (
                          <div
                            key={note.id}
                            className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/60 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {note.title}
                                </div>
                                {note.contentText ? (
                                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {note.contentText}
                                  </div>
                                ) : null}
                                <NotebookMetadataBadges
                                  captureSource={note.captureSource}
                                  captureMetadata={note.captureMetadata}
                                  convertedTo={note.convertedTo}
                                  isPolish={isPolish}
                                  className="mt-1.5"
                                />
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <button
                                  onClick={() => {
                                    const insert = [
                                      '',
                                      '---',
                                      `${t('myWork.notebook.note', 'Note')}: ${note.title}`,
                                      note.contentText || '',
                                    ]
                                      .filter(Boolean)
                                      .join('\n');
                                    setDescription((prev) => `${prev || ''}${insert}`.trim());
                                    trackFunnelEvent('active_notes_inserted', {
                                      surface: 'task',
                                      noteId: note.id,
                                    });
                                    toast.success(
                                      t(
                                        'myWork.notebook.insertedToast',
                                        'Inserted into description'
                                      )
                                    );
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500/15 border border-primary-500 text-primary-600 dark:text-primary-300 hover:bg-primary-500/20 transition-colors"
                                >
                                  {t('myWork.notebook.insert', 'Insert')}
                                </button>
                                <button
                                  onClick={() => {
                                    trackFunnelEvent('active_notes_opened', {
                                      surface: 'task',
                                      noteId: note.id,
                                    });
                                    try {
                                      const { setMyWorkIntent } = useAppStore.getState() as any;
                                      setMyWorkIntent?.({ tab: 'notebook' });
                                    } catch {
                                      /* ignore */
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                                >
                                  {t('myWork.notebook.open', 'Open')}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3) Expected Outcome */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t('myWork.taskDetail.expectedOutcome2', 'Expected outcome')}
                    </label>
                    {!readMode && (
                      <AIFieldEnhancer
                        fieldKey="task-expected-outcome"
                        sectionLabel={t('myWork.taskDetail.sectionLabel2', 'Expected Outcome')}
                        currentValue={expectedOutcome}
                        onApply={setExpectedOutcome}
                        artifactContext={{ title, status, priority, type: 'task' }}
                      />
                    )}
                  </div>
                  <textarea
                    value={expectedOutcome}
                    onChange={(e) => !readMode && setExpectedOutcome(e.target.value)}
                    readOnly={readMode}
                    rows={8}
                    className="w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y border-b border-slate-200 dark:border-navy-700/40 focus:border-c-focus transition-colors min-h-[160px]"
                    placeholder={t(
                      'myWork.taskDetail.defineTheMeasurableOutcome',
                      'Define the measurable outcome — what does success look like, acceptance criteria...'
                    )}
                  />
                </div>
              </div>
            );
            break;
          }
          break;

        // ── 2. Checklist ───────────────────────────────────────────────
        case 'checklist': {
          const completedCount = checklist.filter((c) => c.completed).length;
          const totalCount = checklist.length;
          component = (
            <div className="space-y-6">
              {/* Heading row */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {t('myWork.taskDetail.checklist', 'Checklist')}
                </h2>
                {!readMode && (
                  <button
                    onClick={addChecklistItem}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-c-focus transition-colors"
                  >
                    <Plus size={13} />
                    {t('myWork.taskDetail.addItem', 'Add item')}
                  </button>
                )}
              </div>

              {/* Progress counter */}
              {totalCount > 0 && (
                <div className="flex items-center justify-end">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500 tabular-nums">
                    {completedCount}/{totalCount}
                  </span>
                </div>
              )}

              {/* Items */}
              {totalCount === 0 ? (
                <div className="py-10 text-center">
                  <CheckSquare
                    size={28}
                    className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t(
                      'myWork.taskDetail.noItemsYetGenerate',
                      'No items yet — generate with AI or add manually'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {checklist.map((item, idx) => {
                    const done = item.completed;
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg transition duration-200 ${
                          done
                            ? 'opacity-50 hover:opacity-70'
                            : 'hover:bg-slate-50/60 dark:hover:bg-navy-800/40'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() =>
                            !readMode && updateChecklistItem(item.id, { completed: !done })
                          }
                          disabled={readMode}
                          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition duration-200 ${
                            done
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 dark:border-navy-600 hover:border-emerald-400 dark:hover:border-emerald-500'
                          }`}
                        >
                          {done && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2.5 6L5 8.5L9.5 3.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>

                        {/* Number + text */}
                        <span
                          className={`text-[11px] font-medium mt-0.5 mr-0.5 tabular-nums select-none ${
                            done
                              ? 'text-slate-700 dark:text-slate-400'
                              : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) =>
                            !readMode && updateChecklistItem(item.id, { text: e.target.value })
                          }
                          readOnly={readMode}
                          placeholder={t('myWork.taskDetail.placeholder', 'Enter item...')}
                          className={`flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 transition-colors ${
                            done
                              ? 'line-through text-slate-500 dark:text-slate-400 dark:text-slate-500'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        />

                        {/* Delete */}
                        {!readMode && (
                          <button
                            onClick={() => removeChecklistItem(item.id)}
                            className="mt-0.5 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-danger-50 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quick-add row at the bottom */}
              {totalCount > 0 && !readMode && (
                <button
                  onClick={addChecklistItem}
                  className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-emerald-500 dark:hover:text-emerald-400 py-1.5 px-3 rounded-lg hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 transition-colors"
                >
                  <Plus size={13} />
                  <span>{t('myWork.taskDetail.addAnotherItem', 'Add another item')}</span>
                </button>
              )}
            </div>
          );
          break;
        }

        // ── 2. Implementation Ideas (N-mode flat) ──────────────────────
        case 'implementation': {
          const sortedIdeas = [...implementationIdeas].sort((a, b) => {
            if (a.status === 'selected' && b.status !== 'selected') return -1;
            if (b.status === 'selected' && a.status !== 'selected') return 1;
            return b.votes - a.votes;
          });
          const selectedCount = implementationIdeas.filter((i) => i.status === 'selected').length;

          const ideaStatusConfig: Record<
            string,
            { label: string; dot: string; text: string; bg: string }
          > = {
            idea: {
              label: t('myWork.taskDetail.label4', 'Idea'),
              dot: 'bg-slate-400',
              text: 'text-slate-500 dark:text-slate-400',
              bg: 'bg-slate-100 dark:bg-slate-500/20',
            },
            considered: {
              label: t('myWork.taskDetail.label5', 'Considered'),
              dot: 'bg-blue-500',
              text: 'text-blue-600 dark:text-blue-400',
              bg: 'bg-blue-100 dark:bg-blue-500/20',
            },
            selected: {
              label: t('myWork.taskDetail.label6', 'Selected'),
              dot: 'bg-emerald-500',
              text: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-100 dark:bg-emerald-500/20',
            },
            rejected: {
              label: t('myWork.taskDetail.label7', 'Rejected'),
              dot: 'bg-danger-500',
              text: 'text-danger-600 dark:text-danger-400',
              bg: 'bg-danger-100 dark:bg-danger-500/20',
            },
          };

          component = (
            <div className="space-y-6">
              {/* Heading */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {t('myWork.taskDetail.implementationIdeas', 'Implementation Ideas')}
                </h2>
                {!readMode && (
                  <button
                    onClick={addIdea}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-c-focus transition-colors"
                  >
                    <Plus size={13} />
                    {t('myWork.taskDetail.addIdea', 'Add idea')}
                  </button>
                )}
              </div>

              {/* Ideas list */}
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500">
                  {isPolish
                    ? `Propozycje (${implementationIdeas.length})`
                    : `Proposals (${implementationIdeas.length})`}
                </label>

                {sortedIdeas.length === 0 ? (
                  <div className="py-8 text-center">
                    <Lightbulb
                      size={28}
                      className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                    />
                    <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {t(
                        'myWork.taskDetail.noIdeasYetGenerate',
                        'No ideas yet — generate with AI or add manually'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedIdeas.map((idea) => {
                      const sConfig = ideaStatusConfig[idea.status] || ideaStatusConfig.idea;
                      const isAI = idea.source === 'ai';
                      const isTeam = idea.source === 'team';

                      return (
                        <div
                          key={idea.id}
                          className={`rounded-xl border transition ${
                            idea.status === 'selected'
                              ? 'border-emerald-300/60 dark:border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-500/5'
                              : 'border-slate-200 dark:border-navy-700/50 hover:border-slate-300 dark:hover:border-navy-600'
                          }`}
                        >
                          <div className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              {/* Vote up / down — horizontal thumbs */}
                              <div className="flex items-center gap-1.5 pt-1">
                                <button
                                  onClick={() =>
                                    !readMode &&
                                    setImplementationIdeas(
                                      implementationIdeas.map((i) =>
                                        i.id === idea.id
                                          ? { ...i, votes: i.votes + 1, votedByMe: true }
                                          : i
                                      )
                                    )
                                  }
                                  disabled={readMode}
                                  className={`p-1 rounded-md transition-colors disabled:cursor-default ${
                                    idea.votedByMe
                                      ? 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-500/10'
                                  }`}
                                  title={t('myWork.taskDetail.title5', 'Vote up')}
                                >
                                  <ThumbsUp size={14} />
                                </button>
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 min-w-[14px] text-center">
                                  {idea.votes}
                                </span>
                                <button
                                  onClick={() =>
                                    !readMode &&
                                    setImplementationIdeas(
                                      implementationIdeas.map((i) =>
                                        i.id === idea.id
                                          ? {
                                              ...i,
                                              votes: Math.max(0, i.votes - 1),
                                              votedByMe: false,
                                            }
                                          : i
                                      )
                                    )
                                  }
                                  disabled={readMode}
                                  className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-danger-500 dark:hover:text-danger-400 hover:bg-danger-500/10 transition-colors disabled:cursor-default"
                                  title={t('myWork.taskDetail.title6', 'Vote down')}
                                >
                                  <ThumbsDown size={14} />
                                </button>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {/* Source badge */}
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      isAI
                                        ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400'
                                        : isTeam
                                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                          : 'bg-slate-100 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {isAI ? <Sparkles size={9} /> : <User size={9} />}
                                    {isAI
                                      ? 'AI'
                                      : isTeam
                                        ? t('myWork.taskDetail.team', 'Team')
                                        : t('myWork.taskDetail.manual', 'Manual')}
                                  </span>
                                  {/* Status */}
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${sConfig.bg} ${sConfig.text}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${sConfig.dot}`} />
                                    {sConfig.label}
                                  </span>
                                  {idea.createdBy && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                      {idea.createdBy}
                                    </span>
                                  )}
                                </div>

                                {/* Title — editable */}
                                <input
                                  type="text"
                                  value={idea.title}
                                  onChange={(e) =>
                                    !readMode &&
                                    setImplementationIdeas(
                                      implementationIdeas.map((i) =>
                                        i.id === idea.id ? { ...i, title: e.target.value } : i
                                      )
                                    )
                                  }
                                  readOnly={readMode}
                                  className="w-full text-sm font-medium bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                                  placeholder={t(
                                    'myWork.taskDetail.placeholder2',
                                    'Approach name...'
                                  )}
                                />

                                {/* Description — editable */}
                                <textarea
                                  value={idea.description}
                                  onChange={(e) =>
                                    !readMode &&
                                    setImplementationIdeas(
                                      implementationIdeas.map((i) =>
                                        i.id === idea.id ? { ...i, description: e.target.value } : i
                                      )
                                    )
                                  }
                                  readOnly={readMode}
                                  rows={3}
                                  className="w-full mt-1 px-0 py-1 bg-transparent text-xs leading-relaxed text-slate-600 dark:text-slate-400 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 resize-y min-h-[48px]"
                                  placeholder={t(
                                    'myWork.taskDetail.describeTheApproachSteps',
                                    'Describe the approach, steps, tools...'
                                  )}
                                />
                              </div>

                              {/* Actions */}
                              {!readMode && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <select
                                    value={idea.status}
                                    onChange={(e) =>
                                      setImplementationIdeas(
                                        implementationIdeas.map((i) =>
                                          i.id === idea.id
                                            ? {
                                                ...i,
                                                status: e.target
                                                  .value as ImplementationIdea['status'],
                                              }
                                            : i
                                        )
                                      )
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer focus:outline-none bg-transparent ${sConfig.text}`}
                                  >
                                    {Object.entries(ideaStatusConfig).map(([key, cfg]) => (
                                      <option key={key} value={key}>
                                        {cfg.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() =>
                                      setImplementationIdeas(
                                        implementationIdeas.filter((i) => i.id !== idea.id)
                                      )
                                    }
                                    className="p-1 rounded hover:bg-danger-100 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                  <AIFieldEnhancer
                                    fieldKey={`idea-${idea.id}`}
                                    sectionLabel={t(
                                      'myWork.taskDetail.implementationIdea',
                                      'Implementation Idea'
                                    )}
                                    currentValue={`${idea.title}\n${idea.description}`}
                                    onApply={(val) => {
                                      const lines = val.split('\n');
                                      const newTitle = lines[0] || idea.title;
                                      const newDesc =
                                        lines.slice(1).join('\n').trim() || idea.description;
                                      setImplementationIdeas(
                                        implementationIdeas.map((i) =>
                                          i.id === idea.id
                                            ? { ...i, title: newTitle, description: newDesc }
                                            : i
                                        )
                                      );
                                    }}
                                    artifactContext={{ title, status, priority, type: 'task' }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected summary */}
              {selectedCount > 0 && (
                <div className="px-3 py-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/30">
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={13} />
                    {isPolish
                      ? `${selectedCount} pomysł(ów) wybranych do realizacji`
                      : `${selectedCount} idea(s) selected for implementation`}
                  </div>
                </div>
              )}
            </div>
          );
          break;
        }

        // ── 3. Risk & Alternatives (N-mode flat — matching Decision) ──
        // ── 4. Risk & Impact (shared RiskCanvas) ─────────────────────
        case 'risk-alternatives':
          component = (
            <RiskCanvas
              risks={risks}
              onAddRisk={addRisk}
              onUpdateRisk={(id, updates) => updateRisk(id, updates as any)}
              onRemoveRisk={removeRisk}
              onAIGenerate={generateRisksAI}
              isGeneratingAI={isGeneratingRisks}
              locked={readMode}
              artifactType="task"
              artifactContext={{ title, status, priority, type: 'task' }}
              fieldKeyPrefix="t"
            />
          );
          break;

        // ── 5. Dependencies ───────────────────────────────────────────
        case 'dependencies':
          component = (
            <div className="space-y-8">
              <DependenciesSection
                taskId={taskId || ''}
                connectedTasks={linkedItems
                  .filter((item) => item.type === 'task')
                  .map((item) => ({
                    id: item.id,
                    title: item.title,
                    status: item.status,
                    priority: item.priority,
                  }))}
                readOnly={readMode}
                showSampleDataWhenEmpty
              />
            </div>
          );
          break;

        // ── Evidence & Acceptance (AI-zapisywalna karta, sectionKey=evidence) ──
        case 'evidence':
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {t('myWork.taskDetail.evidenceAcceptance', 'Evidence & Acceptance')}
                </h2>
              </div>
              <EvidenceSection
                evidenceRequired={evidenceRequired}
                evidenceItems={evidenceItems}
                requiresAcceptance={requiresAcceptance}
                acceptanceType={acceptanceType}
                acceptorId={acceptorId}
                signedOff={signedOff}
                signedOffAt={signedOffAt}
                signedOffBy={signedOffBy}
                readOnly={readMode}
                availableUsers={users.map((u) => ({
                  id: u.id,
                  name: `${u.firstName} ${u.lastName}`,
                }))}
                onEvidenceRequiredChange={setEvidenceRequired}
                onAddEvidence={(item) =>
                  setEvidenceItems([
                    ...evidenceItems,
                    { ...item, id: Math.random().toString(36).substr(2, 9) },
                  ])
                }
                onRemoveEvidence={(id) =>
                  setEvidenceItems(evidenceItems.filter((e) => e.id !== id))
                }
                onVerifyEvidence={(id) =>
                  setEvidenceItems(
                    evidenceItems.map((e) =>
                      e.id === id
                        ? { ...e, verified: true, verifiedAt: new Date().toISOString() }
                        : e
                    )
                  )
                }
                onAcceptanceChange={(requires, type, acceptor) => {
                  setRequiresAcceptance(requires);
                  setAcceptanceType(type);
                  setAcceptorId(acceptor);
                }}
                onSignOff={() => {
                  setSignedOff(true);
                  setSignedOffAt(new Date().toISOString());
                  setSignedOffBy('Current User');
                  toast.success(t('myWork.taskDetail.toastSuccess10', 'Task signed off'));
                }}
                expanded
              />
            </div>
          );
          break;

        // ── 6. Governance & Evidence ───────────────────────────────────
        case 'governance':
          component = (
            <div className="space-y-8">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                {t('myWork.taskDetail.rACIEscalation', 'RACI & Escalation')}
              </h2>
              <div className="space-y-4">
                {/* RACI table */}
                <div className={governanceTableCardClass}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                      {t(
                        'myWork.taskDetail.rACIResponsibilityMatrix',
                        'RACI (responsibility matrix)'
                      )}
                    </h3>
                    {!readMode && (
                      <button
                        onClick={() => {
                          const fallbackUser = users[0];
                          if (!fallbackUser) return;
                          setEditingStakeholderId('__new__');
                          setStakeholderDraft({
                            id: '__new__',
                            decisionId: taskId || 'new',
                            userId: fallbackUser.id,
                            userName: `${fallbackUser.firstName} ${fallbackUser.lastName}`,
                            userEmail: fallbackUser.email,
                            role: 'consulted',
                            notificationSettings: {
                              enabled: true,
                              triggers: ['on_status_change'],
                              emailEnabled: false,
                              inAppEnabled: true,
                              integrationChannels: [],
                              syncTargets: [],
                            },
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors"
                      >
                        + {t('myWork.taskDetail.addPerson', 'Add person')}
                      </button>
                    )}
                  </div>
                  <div className="overflow-auto flex-1">
                    <table
                      /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-sm"
                    >
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.person', 'Person')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.role', 'Role')}
                          </th>
                          <th className="text-left py-2 pr-2">Email</th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.notifications', 'Notifications')}
                          </th>
                          <th className="text-right py-2">
                            {t('myWork.taskDetail.actions', 'Actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                        {stakeholders.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              {t('myWork.taskDetail.noStakeholdersYet', 'No stakeholders yet.')}
                            </td>
                          </tr>
                        ) : (
                          stakeholders.map((s) => (
                            <tr key={s.id}>
                              <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                                {s.userName || s.userId}
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {stakeholderRoleLabel(s.role)}
                              </td>
                              <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                                {s.userEmail || '—'}
                              </td>
                              <td className="py-2 pr-2 text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {stakeholderChannelLabels(s.notificationSettings).map((label) => (
                                    <span
                                      key={`${s.id}-${label}`}
                                      className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 text-right">
                                {!readMode && (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingStakeholderId(s.id);
                                        setStakeholderDraft({ ...s });
                                      }}
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-primary-500"
                                      title={t('myWork.taskDetail.title7', 'Edit')}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setStakeholders(
                                          stakeholders.filter((item) => item.id !== s.id)
                                        )
                                      }
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-danger-500"
                                      title={t('myWork.taskDetail.title8', 'Delete')}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reminders table */}
                <div className={governanceTableCardClass}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                      {t('myWork.taskDetail.reminders', 'Reminders')}
                    </h3>
                    {!readMode && (
                      <button
                        onClick={() => {
                          setEditingReminderId('__new__');
                          setReminderDraft({
                            id: '__new__',
                            type: 'before_due',
                            days: 2,
                            recipients: 'both',
                            inAppNotification: true,
                            emailNotification: false,
                            delivery: ensureDeliveryConfig({ coreChannels: ['in_app'] }),
                            message: '',
                            enabled: true,
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors"
                      >
                        + {t('myWork.taskDetail.addReminder', 'Add reminder')}
                      </button>
                    )}
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.type2', 'Type')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.days', 'Days')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.recipients', 'Recipients')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.notifications2', 'Notifications')}
                          </th>
                          <th className="text-right py-2">
                            {t('myWork.taskDetail.actions2', 'Actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                        {reminders.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              {t('myWork.taskDetail.noRemindersYet', 'No reminders yet.')}
                            </td>
                          </tr>
                        ) : (
                          reminders.map((r) => (
                            <tr key={r.id}>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {r.type === 'before_due'
                                  ? t('myWork.taskDetail.beforeDue', 'Before due')
                                  : t('myWork.taskDetail.afterDue', 'After due')}
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {r.days}
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {r.recipients}
                              </td>
                              <td className="py-2 pr-2 text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {!r.enabled && (
                                    <span className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400">
                                      {t('myWork.taskDetail.disabled2', 'Disabled')}
                                    </span>
                                  )}
                                  {deliveryBadgeLabels(
                                    (r as ReminderRuleWithDelivery).delivery,
                                    r
                                  ).map((label) => (
                                    <span
                                      key={`${r.id}-${label}`}
                                      className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 text-right">
                                {!readMode && (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingReminderId(r.id);
                                        setReminderDraft(
                                          normalizeReminderRule({
                                            ...r,
                                          } as ReminderRuleWithDelivery)
                                        );
                                      }}
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-primary-500"
                                      title={t('myWork.taskDetail.title9', 'Edit')}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setReminders(reminders.filter((item) => item.id !== r.id))
                                      }
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-danger-500"
                                      title={t('myWork.taskDetail.title10', 'Delete')}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Escalation table */}
                <div className={governanceTableCardClass}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                      {t('myWork.taskDetail.escalationAndRules', 'Escalation and rules')}
                    </h3>
                    {!readMode && (
                      <button
                        onClick={() => {
                          setEscalationDraft(
                            normalizeEscalationRule({
                              id: Math.random().toString(36).slice(2, 11),
                              enabled: true,
                              escalateTo: users[0]?.id || '',
                              escalateToName: users[0]
                                ? `${users[0].firstName} ${users[0].lastName}`
                                : '',
                              afterDays: 3,
                              warningDays: thresholds.warningDays,
                              criticalDays: thresholds.criticalDays,
                              escalationMode: 'manager_review',
                              delivery: ensureDeliveryConfig({ coreChannels: ['in_app', 'email'] }),
                              message: '',
                            })
                          );
                          setEditingEscalationId('__new__');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 transition-colors"
                      >
                        + {t('myWork.taskDetail.addEscalation', 'Add escalation')}
                      </button>
                    )}
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-navy-700/50">
                          <th className="text-left py-2 pr-2">Status</th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.wCThresholds', 'W/C thresholds')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.escalateAfter', 'Escalate after')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.escalateTo', 'Escalate to')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.message', 'Message')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.mode', 'Mode')}
                          </th>
                          <th className="text-left py-2 pr-2">
                            {t('myWork.taskDetail.channels', 'Channels')}
                          </th>
                          <th className="text-right py-2">
                            {t('myWork.taskDetail.actions3', 'Actions')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                        {escalationRules.length === 0 ? (
                          <tr>
                            <td
                              colSpan={8}
                              className="py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                            >
                              {t(
                                'myWork.taskDetail.noEscalationRulesYet',
                                'No escalation rules yet.'
                              )}
                            </td>
                          </tr>
                        ) : (
                          escalationRules.map((rule) => (
                            <tr key={rule.id}>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {rule.enabled
                                  ? t('myWork.taskDetail.enabled', 'Enabled')
                                  : t('myWork.taskDetail.disabled3', 'Disabled')}
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {rule.warningDays}/{rule.criticalDays} d
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {rule.afterDays} d
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {rule.escalateToName || '—'}
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {rule.message || '—'}
                              </td>
                              <td className="py-2 pr-2 text-xs text-slate-600 dark:text-slate-300">
                                {rule.escalationMode === 'notify_only'
                                  ? t('myWork.taskDetail.notify', 'Notify')
                                  : rule.escalationMode === 'manager_review'
                                    ? 'Manager review'
                                    : 'Executive alert'}
                              </td>
                              <td className="py-2 pr-2 text-xs">
                                <div className="flex flex-wrap gap-1">
                                  {deliveryBadgeLabels(rule.delivery).map((label) => (
                                    <span
                                      key={`${rule.id}-ch-${label}`}
                                      className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-navy-700/60 bg-slate-50/50 dark:bg-navy-800/50 text-[10px] text-slate-500 dark:text-slate-400"
                                    >
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2 text-right">
                                {!readMode && (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingEscalationId(rule.id);
                                        setEscalationDraft({ ...rule });
                                      }}
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-primary-500"
                                      title={t('myWork.taskDetail.title11', 'Edit')}
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setEscalationRules(
                                          escalationRules.filter((item) => item.id !== rule.id)
                                        )
                                      }
                                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-danger-500"
                                      title={t('myWork.taskDetail.title12', 'Delete')}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
          break;

        // ── 7. Comments (shared CommentsCanvas) ────────────────────────
        case 'comments':
          component = (
            <CommentsCanvas
              comments={nModeComments}
              locked={isDone || readMode}
              onDeleteComment={handleDeleteComment}
              dateFilter={nCommentDateFilter}
              onDateFilterChange={setNCommentDateFilter}
              sortOrder={nCommentSortOrder}
              onToggleSort={() => setNCommentSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              commentDraft={nCommentDraft}
              onCommentDraftChange={setNCommentDraft}
              onSubmitComment={handleNModeSubmitComment}
              draftPriority={nCommentPriority}
              onDraftPriorityChange={setNCommentPriority}
              onAIEnhance={generateAIComment}
              isAIEnhancing={isGeneratingAIComment}
              getPriorityDotClass={getPriorityDotClass}
              getCommentPriority={getCommentPriority}
              getPriorityButtonClass={getPriorityButtonClass}
              getCommentPriorityLabel={getCommentPriorityLabel}
              getCommentPriorityHint={getCommentPriorityHint}
            />
          );
          break;

        // ── 8. Attachments & Links (rich canvas — same as Decision) ────
        case 'attachments-links':
          component = (
            <AttachmentsLinksCanvas
              attachments={attachments}
              readOnly={isDone || readMode}
              onUploadAttachments={handleUploadAttachments}
              onDeleteAttachment={handleDeleteAttachment}
              onEditAttachment={(id, patch) => {
                setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
              }}
              linkedItems={linkedItems}
              onAddLinkedItem={handleAddLinkedItem}
              onRemoveLinkedItem={handleRemoveLinkedItem}
              onEditLinkedItem={(key, patch) => {
                const [type, id] = key.split(':');
                setLinkedItems((prev) =>
                  prev.map((item) =>
                    item.type === type && item.id === id ? { ...item, ...patch } : item
                  )
                );
              }}
              onNavigateLinkedItem={openLinkedItemTarget}
              searchLinkedItems={searchLinkedItems}
            />
          );
          break;

        // ── 9. Activity Log (shared ActivityLogCanvas) ─────────────────
        case 'activity-log':
          component = (
            <ActivityLogCanvas
              entries={nModeActivityEntries}
              stats={nModeActivityStats}
              typeMeta={nModeActivityTypeMeta}
            />
          );
          break;
      }

      // ── Wzorzec N: opakuj sekcje AI-zapisywalne w NModeCardState ──────────
      // (badge AI-draft + pasek ✨Regeneruj · ✎Edytuj · ✓Zaakceptuj). Pozostałe
      // sekcje (governance/comments/attachments/activity-log) zostają bez zmian.
      const AI_CARD_META: Partial<
        Record<string, { key: AICardKey; name: { en: string; pl: string } }>
      > = {
        'description-scope': {
          key: 'description-scope',
          name: { en: 'Strategy', pl: 'Strategia' },
        },
        checklist: { key: 'checklist', name: { en: 'Execution', pl: 'Wykonanie' } },
        dependencies: { key: 'dependencies', name: { en: 'Dependencies', pl: 'Zależności' } },
        evidence: { key: 'evidence', name: { en: 'Evidence', pl: 'Dowody' } },
      };
      const cardMeta = AI_CARD_META[section.id];
      if (cardMeta) {
        const cKey = cardMeta.key;
        component = (
          <NModeCardState
            state={cardState[cKey]}
            sectionName={cardMeta.name}
            aiGenerated={cardAI[cKey]}
            isPolish={isPolish}
            hideActions={readMode}
            onRegenerate={() => generateCard(cKey)}
            onGenerate={() => generateCard(cKey)}
            onFillManually={() => setCard(cKey, 'edited')}
            onEdit={() => setCard(cKey, 'edited')}
            onAccept={() => setCard(cKey, 'done')}
            onRetry={() => generateCard(cKey)}
          >
            {component}
          </NModeCardState>
        );
      }

      return { ...section, component };
    });
  }, [
    taskNSections,
    isPolish,
    cardState,
    cardAI,
    generateCard,
    setCard,
    description,
    expectedOutcome,
    initiativeName,
    checklist,
    checklistProgress,
    implementationIdeas,
    risks,
    alternatives,
    selectedAlternativeId,
    status,
    dependencies,
    relatedDecisions,
    stakeholders,
    users,
    evidenceRequired,
    evidenceItems,
    requiresAcceptance,
    acceptanceType,
    acceptorId,
    signedOff,
    signedOffAt,
    signedOffBy,
    reminders,
    escalation,
    thresholds,
    dueDate,
    escalationRules,
    nModeComments,
    nCommentDraft,
    nCommentPriority,
    nCommentDateFilter,
    nCommentSortOrder,
    attachments,
    linkedItems,
    tags,
    newTag,
    nModeActivityEntries,
    nModeActivityStats,
    isGeneratingDescription,
    isGeneratingOutcome,
    isGeneratingChecklist,
    isGeneratingIdeas,
    isGeneratingRisks,
    isGeneratingAlternatives,
    isGeneratingAIComment,
    taskId,
    onOpenDecision,
    showCreateDecision,
    showDecisionSearch,
    blockedReason,
    readMode,
  ]);

  // ── Card-management primitive (#52, wzorzec N §3.5) ───────────────────────
  // Same "nakładka" wiring as InsightViewer.tsx: `useCardLayout` (TASK_SPEC)
  // drives show/hide + reorder OVER the existing single-active-section
  // switcher (`activeNSection` + NModeLeftNav + NModeCanvas) instead of
  // replacing it — Task already has the same 2-pane engine Insight has, it
  // was just missing the card-layout wiring. `applyToSections` filters +
  // orders `nModeSectionsWithContent` by the live layout in one step (no
  // separate hiddenSectionIds/order state needed — Task has no legacy
  // order key to stay back-compat with, unlike Insight).
  const taskCardLayoutStorageKey = `task:nmode:card-layout:v1:${taskId ?? 'new'}`;
  const initialTaskCardLayout = useMemo<CardLayout | null>(() => {
    try {
      const raw = localStorage.getItem(taskCardLayoutStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      const cleaned = parsed.filter(
        (c: unknown): c is { id: string; visible: boolean; order: number } =>
          !!c &&
          typeof (c as { id?: unknown }).id === 'string' &&
          typeof (c as { visible?: unknown }).visible === 'boolean' &&
          typeof (c as { order?: unknown }).order === 'number'
      );
      return cleaned.length > 0 ? cleaned : null;
    } catch {
      return null;
    }
    // Hydrate once per task id; layout state is owned by the hook afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskCardLayoutStorageKey]);

  const persistTaskCardLayout = useCallback(
    (next: CardLayout) => {
      try {
        localStorage.setItem(taskCardLayoutStorageKey, JSON.stringify(next));
      } catch {
        // Ignore storage errors; card management still works for this session.
      }
    },
    [taskCardLayoutStorageKey]
  );

  const taskCardLayout = useCardLayout({
    artifactType: 'task',
    initialLayout: initialTaskCardLayout,
    onLayoutChange: persistTaskCardLayout,
  });

  const visibleTaskNModeSections = useMemo(
    () => taskCardLayout.applyToSections(nModeSectionsWithContent),
    [taskCardLayout, nModeSectionsWithContent]
  );

  useEffect(() => {
    if (visibleTaskNModeSections.length === 0) return;
    if (!visibleTaskNModeSections.some((section) => section.id === activeNSection)) {
      setActiveNSection(visibleTaskNModeSections[0].id);
    }
  }, [visibleTaskNModeSections, activeNSection]);

  // ── Dirty tracking + autosave (SaaS online persistence) ───────────────────
  const persistedDraft = useMemo(
    () => ({
      title,
      description,
      status,
      priority,
      dueDate: dueDate || null,
      startedAt: startDate || null,
      blockedReason: status === 'blocked' ? blockedReason : '',
      tags,
      checklist,
      initiativeId: initiativeId || null,
      assigneeId: assigneeId || null,
      ownerId: ownerId || null,
    }),
    [
      title,
      description,
      status,
      priority,
      dueDate,
      startDate,
      blockedReason,
      tags,
      checklist,
      initiativeId,
      assigneeId,
      ownerId,
    ]
  );

  const draftSnapshot = useMemo(() => {
    try {
      return JSON.stringify(persistedDraft);
    } catch {
      return '';
    }
  }, [persistedDraft]);

  const isDirty = useMemo(() => {
    // For existing tasks: compare against last saved baseline
    if (taskId) return lastSavedSnapshot.length > 0 && draftSnapshot !== lastSavedSnapshot;
    // For new tasks: enable Save when there's a valid title
    return title.trim().length > 0;
  }, [taskId, lastSavedSnapshot, draftSnapshot, title]);

  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!taskId) return; // don't autosave until the task exists
    if (!isDirty) return;
    if (saving) return;
    if (!title.trim()) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 900);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, isDirty, saving, title, draftSnapshot]);

  // ── Loading guard (AFTER all hooks to respect Rules of Hooks) ────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-navy-950">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-white dark:bg-navy-950 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-navy-800">
          <AlertCircle size={26} className="text-slate-400 dark:text-slate-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {t('myWork.taskDetail.taskNotFound', 'Task not found')}
          </h3>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            {t(
              'myWork.taskDetail.thisTaskHasBeen',
              'This task has been deleted or is no longer available to you. Refresh your task list.'
            )}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-lg border border-slate-200 dark:border-navy-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
          >
            {t('myWork.taskDetail.close', 'Close')}
          </button>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // N-MODE RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (presentationMode === 'n') {
    // ── Dokowany prawy panel artefaktu (SPEC-A) — 5 sekcji z REALNYCH danych ──
    // Kanon: Akcje · Właściwości · Powiązania · Komentarze · Historia/AI.
    // Tylko odczyt istniejących stanów/handlerów; treść tokenami c-* .
    const ownerFullName = (() => {
      const u = users.find((usr) => usr.id === ownerId);
      return u ? `${u.firstName} ${u.lastName}`.trim() : '';
    })();
    const statusLabel = (STATUS_CONFIG[status] || STATUS_CONFIG.todo).label[isPolish ? 'pl' : 'en'];
    const priorityLabel = (PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium).label[
      isPolish ? 'pl' : 'en'
    ];
    const dash = '—';
    const fmtDate = (v?: string) => {
      if (!v) return dash;
      const d = new Date(v);
      return Number.isNaN(d.getTime())
        ? v
        : d.toLocaleDateString(t('myWork.taskDetail.dToLocaleDateString', 'en-US'), {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
    };
    const fmtDateTime = (v?: string) => {
      if (!v) return dash;
      const d = new Date(v);
      return Number.isNaN(d.getTime())
        ? v
        : d.toLocaleString(t('myWork.taskDetail.dToLocaleString', 'en-US'), {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
    };

    const panelKeyClass = 'text-xs text-c-text-muted shrink-0';
    // Klasy komórek tabeli Właściwości (kanon panelu: tylko c-*, neutralnie)
    const tdKey = 'px-3 py-2 text-c-text-muted border-b border-c-border-subtle';
    const tdVal = 'px-3 py-2 text-right text-c-text border-b border-c-border-subtle';
    const tdValLast = 'px-3 py-2 text-right text-c-text';
    const pill =
      'inline-flex items-center h-5 px-2 rounded-md text-xs bg-c-surface-raised text-c-text';

    const rightPanelSections: ArtifactRightPanelSection[] = [
      {
        id: 'actions',
        // #27/#37: AI przeniesiony do nagłówka (NModeHeader, showChatButton) —
        // header ma wolny slot obok Save/mode-switcher, więc rozpisany
        // przycisk AI w tej sekcji był zbędnym duplikatem (Z29/Z30 go tu
        // zostawiły tylko z braku slotu M3 dla klasy S; teraz jest taniej).
        label: t('myWork.taskDetail.label8', 'Actions'),
        icon: Save,
        defaultOpen: true,
        children: (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-c-surface-raised text-c-text border border-c-border-subtle hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50"
            >
              <Save size={14} className="text-c-text-muted" />
              {t('myWork.taskDetail.save', 'Save')}
            </button>
          </div>
        ),
      },
      {
        id: 'properties',
        label: t('myWork.taskDetail.label9', 'Properties'),
        icon: Flag,
        defaultOpen: true,
        children: (
          <div className="rounded-lg border border-c-border-subtle overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-c-surface-raised">
                  <th className="text-left font-medium text-c-text-muted px-3 py-2 border-b border-c-border-subtle">
                    {t('myWork.taskDetail.property', 'Property')}
                  </th>
                  <th className="text-right font-medium text-c-text-muted px-3 py-2 border-b border-c-border-subtle">
                    {t('myWork.taskDetail.value', 'Value')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={tdKey}>{t('myWork.taskDetail.status', 'Status')}</td>
                  <td className={tdVal}>
                    <span className={pill}>{statusLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td className={tdKey}>{t('myWork.taskDetail.priority', 'Priority')}</td>
                  <td className={tdVal}>
                    <span className={pill}>{priorityLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td className={tdKey}>{t('myWork.taskDetail.dueDate', 'Due date')}</td>
                  <td className={`${tdVal} tabular-nums`}>{fmtDate(dueDate)}</td>
                </tr>
                <tr>
                  <td className={tdKey}>{t('myWork.taskDetail.owner', 'Owner')}</td>
                  <td className={tdVal}>{ownerFullName || dash}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-c-text-muted">
                    {t('myWork.taskDetail.initiative', 'Initiative')}
                  </td>
                  <td className={tdValLast}>{initiativeName || dash}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ),
      },
      {
        id: 'relations',
        label: t('myWork.taskDetail.label10', 'Relations'),
        icon: Link2,
        defaultOpen: true,
        isEmpty: !initiativeName && attachments.length === 0,
        emptyLabel: t('myWork.taskDetail.emptyLabel', 'No relations'),
        children: (
          <div className="flex flex-col gap-2">
            {initiativeName ? (
              <div className="flex items-center gap-2">
                <span className={panelKeyClass}>
                  {t('myWork.taskDetail.initiative2', 'Initiative')}
                </span>
                <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-xs font-medium bg-c-surface-raised text-c-text border border-c-border-subtle truncate">
                  <Target size={12} className="text-c-text-muted shrink-0" />
                  <span className="truncate">{initiativeName}</span>
                </span>
              </div>
            ) : null}
            {attachments.length > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <span className={panelKeyClass}>
                  {t('myWork.taskDetail.attachments', 'Attachments')}
                </span>
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[11px] font-semibold tabular-nums text-c-text-muted bg-c-surface-raised">
                  {attachments.length}
                </span>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: 'comments',
        label: t('myWork.taskDetail.label11', 'Comments'),
        icon: MessageSquare,
        defaultOpen: false,
        badge: comments.length,
        isEmpty: comments.length === 0,
        emptyLabel: t('myWork.taskDetail.emptyLabel2', 'No comments'),
        children: (
          <ul className="flex flex-col gap-3">
            {comments.slice(0, 6).map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-c-text truncate">
                    {c.authorName || t('myWork.taskDetail.user', 'User')}
                  </span>
                  <span className="text-[11px] text-c-text-muted shrink-0 tabular-nums">
                    {fmtDateTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-c-text-muted line-clamp-3">{c.content}</p>
              </li>
            ))}
          </ul>
        ),
      },
      {
        id: 'history',
        label: t('myWork.taskDetail.label12', 'History / AI'),
        icon: History,
        defaultOpen: false,
        badge: activityLog.length,
        isEmpty: activityLog.length === 0,
        emptyLabel: t('myWork.taskDetail.emptyLabel3', 'No history'),
        children: (
          <ul className="flex flex-col gap-2.5">
            {activityLog.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-c-text truncate">{entry.description}</span>
                  <span className="text-[11px] text-c-text-muted shrink-0 tabular-nums">
                    {fmtDateTime(entry.timestamp)}
                  </span>
                </div>
                {entry.oldValue || entry.newValue ? (
                  <span className="text-[11px] text-c-text-muted truncate">
                    {entry.oldValue ?? dash} → {entry.newValue ?? dash}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ),
      },
    ];

    return (
      <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
        <div className="p-6">
          <div className="max-w-[1500px] mx-auto xl:flex xl:gap-6 xl:items-start space-y-0">
            {/* ── Lewa kolumna: header + treść (dokowany panel po prawej) ── */}
            <div className="xl:flex-1 xl:min-w-0 space-y-0">
              {/* ── Header ──────────────────────────────────────── */}
              <NModeHeader
                title={title}
                onTitleChange={setTitle}
                titleReadOnly={readMode}
                titlePlaceholder={{ en: 'Task title...', pl: 'Tytuł zadania...' }}
                artifactId={taskId || undefined}
                artifactType="task"
                onSave={handleSave}
                saving={saving}
                isDirty={isDirty}
                draftSavedLabel={
                  lastSavedAt
                    ? isPolish
                      ? `Zapisano ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : undefined
                }
                onChat={handleOpenChat}
                showChatButton
                onClose={onClose}
                statusDotColor={statusConfig.color}
                presentationMode={presentationMode}
                onPresentationModeChange={setPresentationMode}
                buildArtifactCode={buildArtifactCode}
              />

              {/* ── N-Mode Content ──────────────────────────────── */}
              <div className="col-span-full space-y-4 mt-4">
                {/* ── Menu 1 (klasa S): card management (#52) + Read/Edit toggle ── */}
                <div className="flex items-center justify-between">
                  {!readMode ? (
                    <NModeCardManager layout={taskCardLayout} isPolish={isPolish} />
                  ) : (
                    <div />
                  )}
                  <ReadEditToggle readMode={readMode} onChange={setReadMode} />
                </div>
                {/* Deadline Alert */}
                {dueDate && dueDateAlertBorderClass && (
                  <div className="mb-3 px-4 py-2 rounded-xl bg-danger-500/5 dark:bg-danger-500/10 border border-danger-200/60 dark:border-danger-500/30 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {t(
                      'myWork.taskDetail.warningDeadlineApproachingOr',
                      'Warning: deadline approaching or overdue!'
                    )}
                  </div>
                )}

                {/* Blocked reason — editable when status=blocked */}
                {status === 'blocked' && (
                  <div className="mb-3 px-4 py-3 rounded-xl bg-danger-500/5 dark:bg-danger-500/10 border border-danger-200/60 dark:border-danger-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={14} className="text-danger-500 dark:text-danger-400" />
                      <span className="text-xs font-semibold text-danger-600 dark:text-danger-400 uppercase tracking-wide">
                        {t('myWork.taskDetail.blockedReason', 'Blocked Reason')}
                      </span>
                    </div>
                    <textarea
                      value={blockedReason}
                      onChange={(e) => setBlockedReason(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-white/60 dark:bg-navy-800/60 border border-danger-200/40 dark:border-danger-500/20 text-slate-700 dark:text-slate-300 placeholder-danger-300 dark:placeholder-danger-500/50 focus:outline-none focus:border-danger-400 resize-none"
                      placeholder={t(
                        'myWork.taskDetail.describeBlockingReason',
                        'Describe blocking reason...'
                      )}
                    />
                  </div>
                )}

                {/* ── Origin Badge ──────────────────────────────────── */}
                {sourceType && sourceId && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 text-xs">
                    {sourceType === 'idea' && <Lightbulb size={14} className="text-amber-500" />}
                    {sourceType === 'notebook' && <FileText size={14} className="text-blue-500" />}
                    {sourceType === 'decision' && <Scale size={14} className="text-blue-500" />}
                    <span className="text-slate-600 dark:text-slate-300">
                      {sourceType === 'idea'
                        ? t('myWork.taskDetail.createdFromIdea', 'Created from Idea')
                        : sourceType === 'notebook'
                          ? t('myWork.taskDetail.createdFromNote', 'Created from Note')
                          : `Created from ${sourceType}`}
                    </span>
                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('mywork-open-item', {
                            detail: {
                              type: sourceType === 'notebook' ? 'notebook' : sourceType,
                              id: sourceId,
                              name: `Source ${sourceType}`,
                              initialTool: sourceType === 'idea' ? 'mindmap' : undefined,
                            },
                          })
                        );
                      }}
                      className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
                    >
                      {sourceType === 'idea'
                        ? t('myWork.taskDetail.viewSourceInMindmap', 'View source in mindmap →')
                        : t('myWork.taskDetail.viewSource', 'View source →')}
                    </button>
                  </div>
                )}

                {/* ── Task Action Bar ──────────────────────────────── */}
                {/* Read mode ("do pokazania klientowi"): ukryj cały pasek akcji stanu. */}
                {!readMode && (
                  <div className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-navy-700/60">
                    <div className="flex items-center gap-2">
                      {/* Start / Resume — shown when todo or blocked */}
                      {(status === 'todo' || status === 'blocked') && (
                        <button
                          onClick={() => {
                            const old = status;
                            setStatus('in_progress');
                            if (status === 'blocked') setBlockedReason('');
                            addActivityLogEntry(
                              'status_change',
                              t('myWork.taskDetail.taskStarted', 'Task started'),
                              old,
                              'in_progress'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <Play size={13} /> {t('myWork.taskDetail.start', 'Start')}
                        </button>
                      )}

                      {/* Send to Review — shown when in_progress */}
                      {status === 'in_progress' && (
                        <button
                          onClick={() => {
                            setStatus('review');
                            addActivityLogEntry(
                              'status_change',
                              t('myWork.taskDetail.sentToReview', 'Sent to review'),
                              'in_progress',
                              'review'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-400/50 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 transition-colors"
                        >
                          <Eye size={13} /> {t('myWork.taskDetail.sendToReview', 'Send to Review')}
                        </button>
                      )}

                      {/* Complete — shown when in_progress or review */}
                      {(status === 'in_progress' || status === 'review') && (
                        <button
                          onClick={() => {
                            const old = status;
                            setStatus('done');
                            addActivityLogEntry(
                              'status_change',
                              t('myWork.taskDetail.taskCompleted', 'Task completed'),
                              old,
                              'done'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          <CheckCircle2 size={13} /> {t('myWork.taskDetail.complete', 'Complete')}
                        </button>
                      )}

                      {/* Block — shown when not blocked and not done */}
                      {status !== 'blocked' && status !== 'done' && (
                        <button
                          onClick={() => {
                            const old = status;
                            setStatus('blocked');
                            addActivityLogEntry(
                              'status_change',
                              t('myWork.taskDetail.taskBlocked', 'Task blocked'),
                              old,
                              'blocked'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-danger-400/50 text-danger-600 dark:text-danger-400 hover:bg-danger-500/10 transition-colors"
                        >
                          <AlertCircle size={13} /> {t('myWork.taskDetail.block', 'Block')}
                        </button>
                      )}

                      {/* Reopen — shown when done */}
                      {status === 'done' && (
                        <button
                          onClick={() => {
                            setStatus('in_progress');
                            addActivityLogEntry(
                              'status_change',
                              t('myWork.taskDetail.taskReopened', 'Task reopened'),
                              'done',
                              'in_progress'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-400/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          <Play size={13} /> {t('myWork.taskDetail.reopen', 'Reopen')}
                        </button>
                      )}

                      {/* Reassign — always shown */}
                      <button
                        onClick={() => {
                          // scroll to assignee field or open a quick picker
                          toast(
                            t(
                              'myWork.taskDetail.changeAssigneeInThe',
                              'Change assignee in the Assignee field above'
                            )
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Share2 size={13} /> {t('myWork.taskDetail.reassign', 'Reassign')}
                      </button>

                      {/* ── Section-specific AI actions (right-aligned) ── */}
                      {activeNSection === 'implementation' && (
                        <button
                          onClick={generateIdeasAI}
                          disabled={isGeneratingIdeas}
                          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isGeneratingIdeas
                              ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                              : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={t(
                            'myWork.taskDetail.generateImplementationPlanWith',
                            'Generate implementation plan with AI'
                          )}
                        >
                          {isGeneratingIdeas ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          {t('myWork.taskDetail.createIdeas', 'Create Ideas')}
                        </button>
                      )}

                      {activeNSection === 'risk-alternatives' && (
                        <button
                          onClick={generateRisksAI}
                          disabled={isGeneratingRisks}
                          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isGeneratingRisks
                              ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                              : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={t('myWork.taskDetail.title13', 'Analyze risks with AI')}
                        >
                          {isGeneratingRisks ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          {t('myWork.taskDetail.analyzeRisks', 'Analyze risks')}
                        </button>
                      )}

                      {activeNSection === 'checklist' && (
                        <button
                          onClick={generateAIChecklist}
                          disabled={isGeneratingChecklist}
                          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isGeneratingChecklist
                              ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                              : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={t(
                            'myWork.taskDetail.generateChecklistWithAI',
                            'Generate checklist with AI'
                          )}
                        >
                          {isGeneratingChecklist ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          {t('myWork.taskDetail.createChecklist', 'Create Checklist')}
                        </button>
                      )}

                      {activeNSection === 'comments' && (
                        <button
                          onClick={generateAIComment}
                          disabled={isGeneratingAIComment}
                          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isGeneratingAIComment
                              ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                              : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={t('myWork.taskDetail.title14', 'Generate AI comments')}
                        >
                          {isGeneratingAIComment ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          {t('myWork.taskDetail.aIComments', 'AI comments')}
                        </button>
                      )}

                      {activeNSection === 'governance' && (
                        <button
                          onClick={async () => {
                            setIsSuggestingStakeholders(true);
                            try {
                              const roster = users
                                .map((u) => `${u.id}: ${u.firstName} ${u.lastName} (${u.email})`)
                                .join('\n');
                              const prompt = isPolish
                                ? `Na podstawie danych zadania zaproponuj skład RACI. Zwróć WYŁĄCZNIE JSON:\n{"stakeholders":[{"userId":"...","role":"accountable|responsible|consulted|informed","reason":"..."}]}\nDostępne osoby:\n${roster}`
                                : `Based on task data, propose a RACI team. Return JSON ONLY:\n{"stakeholders":[{"userId":"...","role":"accountable|responsible|consulted|informed","reason":"..."}]}\nAvailable people:\n${roster}`;
                              const aiRes = await Api.post('/ai/chat', {
                                message: prompt,
                                history: [],
                                systemInstruction: t(
                                  'myWork.taskDetail.systemInstruction2',
                                  'You are a PMO assistant. Return valid JSON only.'
                                ),
                                roleName: 'RACI Team Advisor',
                              });
                              const raw = String(aiRes?.text || aiRes?.content || '').trim();
                              const jsonMatch = raw.match(/\{[\s\S]*\}/);
                              if (jsonMatch) {
                                const parsed = JSON.parse(jsonMatch[0]);
                                if (Array.isArray(parsed.stakeholders)) {
                                  const next = parsed.stakeholders.map((s: any) => {
                                    const user = users.find((u) => u.id === s.userId);
                                    return {
                                      id: Math.random().toString(36).substr(2, 9),
                                      decisionId: taskId || 'new',
                                      userId: s.userId,
                                      userName: user
                                        ? `${user.firstName} ${user.lastName}`
                                        : s.userId,
                                      userEmail: user?.email || '',
                                      role: s.role as StakeholderRole,
                                      notificationSettings: {
                                        enabled: true,
                                        triggers: ['on_status_change'],
                                        emailEnabled: false,
                                        inAppEnabled: true,
                                        integrationChannels: [],
                                        syncTargets: [],
                                      },
                                    };
                                  });
                                  setStakeholders(next);
                                  toast.success(
                                    isPolish
                                      ? `AI zaproponowało skład RACI (${next.length} osób).`
                                      : `AI proposed RACI team (${next.length} people).`
                                  );
                                }
                              }
                            } catch {
                              // fallback
                              const fallbackTeam = users
                                .slice(0, Math.min(4, users.length))
                                .map((u, i) => ({
                                  id: Math.random().toString(36).substr(2, 9),
                                  decisionId: taskId || 'new',
                                  userId: u.id,
                                  userName: `${u.firstName} ${u.lastName}`,
                                  userEmail: u.email,
                                  role:
                                    (
                                      [
                                        'accountable',
                                        'responsible',
                                        'consulted',
                                        'informed',
                                      ] as StakeholderRole[]
                                    )[i] || 'informed',
                                  notificationSettings: {
                                    enabled: true,
                                    triggers: [
                                      'on_status_change',
                                    ] as StakeholderNotificationSettings['triggers'],
                                    emailEnabled: false,
                                    inAppEnabled: true,
                                    integrationChannels: [],
                                    syncTargets: [],
                                  },
                                }));
                              setStakeholders(fallbackTeam);
                              toast.success(
                                t(
                                  'myWork.taskDetail.appliedFallbackRACITeam',
                                  'Applied fallback RACI team.'
                                )
                              );
                            } finally {
                              setIsSuggestingStakeholders(false);
                            }
                          }}
                          disabled={isSuggestingStakeholders}
                          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isSuggestingStakeholders
                              ? 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10'
                              : 'border-primary-400/50 text-primary-600 dark:text-primary-300 bg-primary-500/10 hover:bg-primary-500/15'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          title={t('myWork.taskDetail.title15', 'Generate RACI with AI')}
                        >
                          {isSuggestingStakeholders ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Sparkles size={13} />
                          )}
                          {t('myWork.taskDetail.generateRACI', 'Generate RACI')}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 2-Pane: LeftNav + Canvas */}
                <div className="flex gap-0 min-h-[60vh]">
                  <NModeLeftNav
                    sections={visibleTaskNModeSections}
                    activeSection={activeNSection}
                    onSectionChange={setActiveNSection}
                    onSectionReorder={(ids) => taskCardLayout.reorderByIds(ids)}
                  />
                  <NModeCanvas
                    sections={visibleTaskNModeSections}
                    activeSection={activeNSection}
                    reducedMotion={reducedMotion}
                    motionDuration={motionDuration}
                  />
                </div>
              </div>
              {/* ── /Lewa kolumna ── */}
            </div>

            {/* ── Dokowany prawy panel artefaktu (lg+; ukryty na <lg) ── */}
            <div className="hidden xl:block shrink-0 sticky top-6 self-start">
              <ArtifactRightPanel
                sections={rightPanelSections}
                className="rounded-2xl border border-c-border-subtle max-h-[calc(100vh-3rem)]"
                ariaLabel={t('myWork.taskDetail.ariaLabel', 'Task details')}
              />
            </div>
          </div>
        </div>

        {/* ── RACI Governance Modals (exact copy from Decision) ── */}

        {/* Stakeholder modal */}
        {stakeholderDraft && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setEditingStakeholderId(null);
                setStakeholderDraft(null);
              }}
            />
            <div className={`${governanceModalClass} min-h-[380px]`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {editingStakeholderId === '__new__'
                    ? t('myWork.taskDetail.addRACIPerson', 'Add RACI person')
                    : t('myWork.taskDetail.editRACIPerson', 'Edit RACI person')}
                </h4>
                <button
                  className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600"
                  onClick={() => {
                    setEditingStakeholderId(null);
                    setStakeholderDraft(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <div className={governanceModalHintClass}>
                {t(
                  'myWork.taskDetail.useThisWindowTo',
                  'Use this window to describe and configure person responsibility in RACI and communication channels.'
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.person2', 'Person')}
                  <select
                    value={stakeholderDraft.userId}
                    onChange={(e) => {
                      const selected = users.find((u) => u.id === e.target.value);
                      setStakeholderDraft({
                        ...stakeholderDraft,
                        userId: e.target.value,
                        userName: selected
                          ? `${selected.firstName} ${selected.lastName}`
                          : stakeholderDraft.userName,
                        userEmail: selected?.email || stakeholderDraft.userEmail,
                      });
                    }}
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.role2', 'Role')}
                  <select
                    value={stakeholderDraft.role}
                    onChange={(e) =>
                      setStakeholderDraft({
                        ...stakeholderDraft,
                        role: e.target.value as StakeholderRole,
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  >
                    <option value="responsible">
                      {t('myWork.taskDetail.responsible2', 'Responsible')}
                    </option>
                    <option value="accountable">
                      {t('myWork.taskDetail.accountable2', 'Accountable')}
                    </option>
                    <option value="consulted">
                      {t('myWork.taskDetail.consulted2', 'Consulted')}
                    </option>
                    <option value="informed">{t('myWork.taskDetail.informed2', 'Informed')}</option>
                  </select>
                </label>
              </div>
              <div className="space-y-2 flex-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.notificationChannels', 'Notification channels')}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('myWork.taskDetail.coreChannels', 'Core channels')}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                      {[
                        {
                          key: 'enabled',
                          label: t('myWork.taskDetail.label13', 'Enabled'),
                          active: stakeholderDraft.notificationSettings.enabled,
                          toggle: () =>
                            setStakeholderDraft({
                              ...stakeholderDraft,
                              notificationSettings: {
                                ...stakeholderDraft.notificationSettings,
                                enabled: !stakeholderDraft.notificationSettings.enabled,
                              },
                            }),
                        },
                        {
                          key: 'in_app',
                          label: 'In-app',
                          active: stakeholderDraft.notificationSettings.inAppEnabled,
                          toggle: () =>
                            setStakeholderDraft({
                              ...stakeholderDraft,
                              notificationSettings: {
                                ...stakeholderDraft.notificationSettings,
                                inAppEnabled: !stakeholderDraft.notificationSettings.inAppEnabled,
                              },
                            }),
                        },
                        {
                          key: 'email',
                          label: 'Email',
                          active: stakeholderDraft.notificationSettings.emailEnabled,
                          toggle: () =>
                            setStakeholderDraft({
                              ...stakeholderDraft,
                              notificationSettings: {
                                ...stakeholderDraft.notificationSettings,
                                emailEnabled: !stakeholderDraft.notificationSettings.emailEnabled,
                              },
                            }),
                        },
                      ].map((channel) => (
                        <button
                          key={channel.key}
                          type="button"
                          onClick={channel.toggle}
                          className={`${channelChipClass} ${channel.active ? 'border-primary-400/60 text-primary-500 bg-primary-500/10' : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'}`}
                        >
                          {channel.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('myWork.taskDetail.integrationChannels', 'Integration channels')}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                      {integrationChannelCatalog.map((channel) => {
                        const list =
                          stakeholderDraft.notificationSettings.integrationChannels || [];
                        const selected = list.includes(channel.key);
                        return (
                          <button
                            key={channel.key}
                            type="button"
                            onClick={() => {
                              const current =
                                stakeholderDraft.notificationSettings.integrationChannels || [];
                              const next = selected
                                ? current.filter((c: string) => c !== channel.key)
                                : [...current, channel.key];
                              setStakeholderDraft({
                                ...stakeholderDraft,
                                notificationSettings: {
                                  ...stakeholderDraft.notificationSettings,
                                  integrationChannels: next,
                                },
                              });
                            }}
                            className={`${channelChipClass} ${selected ? 'border-slate-500/70 text-slate-800 dark:text-white bg-slate-200/70 dark:bg-white/[0.08]' : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'}`}
                            title={channel.scope}
                          >
                            {channel.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                  {t('myWork.taskDetail.syncTargets', 'Sync targets')}
                  <input
                    value={(stakeholderDraft.notificationSettings.syncTargets || []).join(', ')}
                    onChange={(e) =>
                      setStakeholderDraft({
                        ...stakeholderDraft,
                        notificationSettings: {
                          ...stakeholderDraft.notificationSettings,
                          syncTargets: e.target.value
                            .split(',')
                            .map((item: string) => item.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                    placeholder="slack:#ops, jira:DRD"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingStakeholderId(null);
                    setStakeholderDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                >
                  {t('myWork.taskDetail.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    if (!stakeholderDraft) return;
                    if (editingStakeholderId === '__new__') {
                      setStakeholders([
                        ...stakeholders,
                        { ...stakeholderDraft, id: Math.random().toString(36).slice(2, 11) },
                      ]);
                    } else {
                      setStakeholders(
                        stakeholders.map((item) =>
                          item.id === editingStakeholderId
                            ? { ...stakeholderDraft, id: item.id }
                            : item
                        )
                      );
                    }
                    setEditingStakeholderId(null);
                    setStakeholderDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
                >
                  {t('myWork.taskDetail.save2', 'Save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reminder modal */}
        {reminderDraft && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setEditingReminderId(null);
                setReminderDraft(null);
              }}
            />
            <div className={`${governanceModalClass} min-h-[380px]`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {editingReminderId === '__new__'
                    ? t('myWork.taskDetail.addReminder2', 'Add reminder')
                    : t('myWork.taskDetail.editReminder', 'Edit reminder')}
                </h4>
                <div className="inline-flex items-center gap-2">
                  <button
                    disabled={isSuggestingStakeholders}
                    onClick={() => toast(t('myWork.taskDetail.toast3', 'AI will fill the form...'))}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-primary-300/40 dark:border-primary-500/30 text-primary-500 hover:text-primary-600 hover:border-primary-400/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    <Sparkles size={12} /> AI
                  </button>
                  <button
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600"
                    onClick={() => {
                      setEditingReminderId(null);
                      setReminderDraft(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className={governanceModalHintClass}>
                {t(
                  'myWork.taskDetail.useThisWindowTo2',
                  'Use this window to describe reminder intent: when it should trigger, recipients, and the message.'
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.type3', 'Type')}
                  <select
                    value={reminderDraft.type}
                    onChange={(e) =>
                      setReminderDraft({
                        ...reminderDraft,
                        type: e.target.value as 'before_due' | 'after_due',
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  >
                    <option value="before_due">
                      {t('myWork.taskDetail.beforeDue2', 'Before due')}
                    </option>
                    <option value="after_due">
                      {t('myWork.taskDetail.afterDue2', 'After due')}
                    </option>
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.days2', 'Days')}
                  <input
                    type="number"
                    min={0}
                    value={reminderDraft.days}
                    onChange={(e) =>
                      setReminderDraft({ ...reminderDraft, days: Number(e.target.value) || 0 })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  />
                </label>
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('myWork.taskDetail.recipients2', 'Recipients')}
                <select
                  value={reminderDraft.recipients}
                  onChange={(e) =>
                    setReminderDraft({ ...reminderDraft, recipients: e.target.value as any })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  <option value="both">{t('myWork.taskDetail.both', 'Both')}</option>
                  <option value="stakeholders">
                    {t('myWork.taskDetail.stakeholders', 'Stakeholders')}
                  </option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              <div className="space-y-3">
                <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={reminderDraft.enabled}
                    onChange={(e) =>
                      setReminderDraft({ ...reminderDraft, enabled: e.target.checked })
                    }
                  />
                  {t('myWork.taskDetail.ruleEnabled', 'Rule enabled')}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('myWork.taskDetail.coreChannels2', 'Core channels')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { key: 'in_app', label: 'In-app' },
                          { key: 'email', label: 'Email' },
                        ] as Array<{ key: CoreDeliveryChannel; label: string }>
                      ).map((channel) => {
                        const delivery = ensureDeliveryConfig(
                          reminderDraft.delivery,
                          reminderDraft
                        );
                        const coreChannels = Array.isArray(delivery.coreChannels)
                          ? delivery.coreChannels
                          : [];
                        const enabled = coreChannels.includes(channel.key);
                        return (
                          <button
                            key={channel.key}
                            type="button"
                            onClick={() =>
                              setReminderDraft({
                                ...reminderDraft,
                                delivery: {
                                  ...delivery,
                                  coreChannels: toggleChannel(coreChannels, channel.key, !enabled),
                                },
                                inAppNotification:
                                  channel.key === 'in_app'
                                    ? !enabled
                                    : coreChannels.includes('in_app'),
                                emailNotification:
                                  channel.key === 'email'
                                    ? !enabled
                                    : coreChannels.includes('email'),
                              })
                            }
                            className={`${channelChipClass} ${enabled ? 'border-primary-400/60 text-primary-500 bg-primary-500/10' : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'}`}
                          >
                            {channel.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t('myWork.taskDetail.integrationChannels2', 'Integration channels')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {integrationChannelCatalog.map((channel) => {
                        const delivery = ensureDeliveryConfig(
                          reminderDraft.delivery,
                          reminderDraft
                        );
                        const integrationChannels = Array.isArray(delivery.integrationChannels)
                          ? delivery.integrationChannels
                          : [];
                        const enabled = integrationChannels.includes(channel.key);
                        return (
                          <button
                            key={channel.key}
                            type="button"
                            onClick={() =>
                              setReminderDraft({
                                ...reminderDraft,
                                delivery: {
                                  ...delivery,
                                  integrationChannels: toggleChannel(
                                    integrationChannels,
                                    channel.key,
                                    !enabled
                                  ),
                                },
                              })
                            }
                            className={`${channelChipClass} ${enabled ? 'border-primary-400/60 text-primary-500 bg-primary-500/10' : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'}`}
                            title={channel.scope}
                          >
                            {channel.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <label className="text-xs text-slate-500 dark:text-slate-400 block">
                  {t('myWork.taskDetail.syncTargets2', 'Sync targets')}
                  <input
                    value={ensureDeliveryConfig(
                      reminderDraft.delivery,
                      reminderDraft
                    ).syncTargets.join(', ')}
                    onChange={(e) =>
                      setReminderDraft({
                        ...reminderDraft,
                        delivery: {
                          ...ensureDeliveryConfig(reminderDraft.delivery, reminderDraft),
                          syncTargets: e.target.value
                            .split(',')
                            .map((item: string) => item.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                    placeholder="slack:#delivery, jira:PROJ, webhook:ops"
                  />
                </label>
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('myWork.taskDetail.message2', 'Message')}
                <textarea
                  value={reminderDraft.message || ''}
                  onChange={(e) => setReminderDraft({ ...reminderDraft, message: e.target.value })}
                  rows={3}
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingReminderId(null);
                    setReminderDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                >
                  {t('myWork.taskDetail.cancel2', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    if (!reminderDraft) return;
                    const normalized = normalizeReminderRule(reminderDraft);
                    if (editingReminderId === '__new__') {
                      setReminders([
                        ...reminders,
                        { ...normalized, id: Math.random().toString(36).slice(2, 11) },
                      ]);
                    } else {
                      setReminders(
                        reminders.map((item) =>
                          item.id === editingReminderId ? { ...normalized, id: item.id } : item
                        )
                      );
                    }
                    setEditingReminderId(null);
                    setReminderDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
                >
                  {t('myWork.taskDetail.save3', 'Save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Escalation modal */}
        {editingEscalationId && escalationDraft && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setEditingEscalationId(null);
                setEscalationDraft(null);
              }}
            />
            <div className={governanceModalClass}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {editingEscalationId === '__new__'
                    ? t('myWork.taskDetail.addEscalationRule', 'Add escalation rule')
                    : t('myWork.taskDetail.editEscalationRule', 'Edit escalation rule')}
                </h4>
                <div className="inline-flex items-center gap-2">
                  <button
                    disabled={isSuggestingStakeholders}
                    onClick={() => toast(t('myWork.taskDetail.toast4', 'AI will fill the form...'))}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-primary-300/40 dark:border-primary-500/30 text-primary-500 hover:text-primary-600 hover:border-primary-400/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    <Sparkles size={12} /> AI
                  </button>
                  <button
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-600"
                    onClick={() => {
                      setEditingEscalationId(null);
                      setEscalationDraft(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className={governanceModalHintClass}>
                {t(
                  'myWork.taskDetail.useThisWindowTo3',
                  'Use this window to describe escalation rule settings: thresholds, timing, assignee, and message.'
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.warningThresholdDays', 'Warning threshold (days)')}
                  <input
                    type="number"
                    min={0}
                    value={escalationDraft.warningDays}
                    onChange={(e) =>
                      setEscalationDraft({
                        ...escalationDraft,
                        warningDays: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.criticalThresholdDays', 'Critical threshold (days)')}
                  <input
                    type="number"
                    min={0}
                    value={escalationDraft.criticalDays}
                    onChange={(e) =>
                      setEscalationDraft({
                        ...escalationDraft,
                        criticalDays: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.escalateAfterDays', 'Escalate after (days)')}
                  <input
                    type="number"
                    min={1}
                    value={escalationDraft.afterDays}
                    onChange={(e) =>
                      setEscalationDraft({
                        ...escalationDraft,
                        afterDays: Number(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  />
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('myWork.taskDetail.escalateTo2', 'Escalate to')}
                  <select
                    value={escalationDraft.escalateTo}
                    onChange={(e) => {
                      const selected = users.find((u) => u.id === e.target.value);
                      setEscalationDraft({
                        ...escalationDraft,
                        escalateTo: e.target.value,
                        escalateToName: selected
                          ? `${selected.firstName} ${selected.lastName}`
                          : escalationDraft.escalateToName,
                      });
                    }}
                    className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  >
                    <option value="">{t('myWork.taskDetail.select', 'Select')}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('myWork.taskDetail.escalationMode', 'Escalation mode')}
                <select
                  value={escalationDraft.escalationMode}
                  onChange={(e) =>
                    setEscalationDraft({
                      ...escalationDraft,
                      escalationMode: e.target.value as EscalationMode,
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                >
                  {escalationModeOptions.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={escalationDraft.enabled}
                  onChange={(e) =>
                    setEscalationDraft({ ...escalationDraft, enabled: e.target.checked })
                  }
                />
                {t('myWork.taskDetail.ruleEnabled2', 'Rule enabled')}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('myWork.taskDetail.coreChannels3', 'Core channels')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: 'in_app', label: 'In-app' },
                        { key: 'email', label: 'Email' },
                      ] as Array<{ key: CoreDeliveryChannel; label: string }>
                    ).map((channel) => {
                      const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                      const coreChannels = Array.isArray(delivery.coreChannels)
                        ? delivery.coreChannels
                        : [];
                      const enabled = coreChannels.includes(channel.key);
                      return (
                        <button
                          key={channel.key}
                          type="button"
                          onClick={() =>
                            setEscalationDraft({
                              ...escalationDraft,
                              delivery: {
                                ...delivery,
                                coreChannels: toggleChannel(coreChannels, channel.key, !enabled),
                              },
                            })
                          }
                          className={`${channelChipClass} ${enabled ? 'border-primary-400/60 text-primary-500 bg-primary-500/10' : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'}`}
                        >
                          {channel.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-700/60 bg-slate-50/70 dark:bg-navy-800/50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('myWork.taskDetail.integrationChannels3', 'Integration channels')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {integrationChannelCatalog.map((channel) => {
                      const delivery = ensureDeliveryConfig(escalationDraft.delivery);
                      const integrationChannels = Array.isArray(delivery.integrationChannels)
                        ? delivery.integrationChannels
                        : [];
                      const enabled = integrationChannels.includes(channel.key);
                      return (
                        <button
                          key={channel.key}
                          type="button"
                          onClick={() =>
                            setEscalationDraft({
                              ...escalationDraft,
                              delivery: {
                                ...delivery,
                                integrationChannels: toggleChannel(
                                  integrationChannels,
                                  channel.key,
                                  !enabled
                                ),
                              },
                            })
                          }
                          className={`${channelChipClass} ${enabled ? 'border-primary-400/60 text-primary-500 bg-primary-500/10' : 'border-slate-300/70 text-slate-500 hover:border-slate-400/80'}`}
                          title={channel.scope}
                        >
                          {channel.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('myWork.taskDetail.syncTargets3', 'Sync targets')}
                <input
                  value={ensureDeliveryConfig(escalationDraft.delivery).syncTargets.join(', ')}
                  onChange={(e) =>
                    setEscalationDraft({
                      ...escalationDraft,
                      delivery: {
                        ...ensureDeliveryConfig(escalationDraft.delivery),
                        syncTargets: e.target.value
                          .split(',')
                          .map((item: string) => item.trim())
                          .filter(Boolean),
                      },
                    })
                  }
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                  placeholder="slack:#incident, jira:OPS, webhook:oncall"
                />
              </label>
              <label className="text-xs text-slate-500 dark:text-slate-400 block">
                {t('myWork.taskDetail.escalationMessage', 'Escalation message')}
                <textarea
                  value={escalationDraft.message || ''}
                  onChange={(e) =>
                    setEscalationDraft({ ...escalationDraft, message: e.target.value })
                  }
                  rows={3}
                  className="mt-1 w-full px-2 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingEscalationId(null);
                    setEscalationDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs border border-slate-300/60 dark:border-navy-600 text-slate-500"
                >
                  {t('myWork.taskDetail.cancel3', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    if (!escalationDraft) return;
                    const normalized = normalizeEscalationRule(escalationDraft);
                    if (editingEscalationId === '__new__') {
                      setEscalationRules([
                        ...escalationRules,
                        { ...normalized, id: Math.random().toString(36).slice(2, 11) },
                      ]);
                    } else {
                      setEscalationRules(
                        escalationRules.map((item) =>
                          item.id === editingEscalationId ? { ...normalized, id: item.id } : item
                        )
                      );
                    }
                    setEditingEscalationId(null);
                    setEscalationDraft(null);
                  }}
                  className="px-3 py-1.5 rounded-md text-xs bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
                >
                  {t('myWork.taskDetail.save4', 'Save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D-MODE (LEGACY ACCORDION) — kept until N-mode is fully rolled out
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-500/5 to-blue-500/5 dark:from-blue-500/10 dark:to-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-primary-500/5 to-crimson-500/5 dark:from-primary-500/10 dark:to-crimson-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content - Two columns */}
      <div className="relative flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Header - Full width */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3 bg-gradient-to-r from-white/80 via-primary-50/30 to-white/80 dark:from-navy-900/80 dark:via-primary-900/20 dark:to-navy-900/80 backdrop-blur-xl rounded-2xl border border-primary-200/40 dark:border-primary-500/20 shadow-lg shadow-primary-500/10 dark:shadow-primary-500/20 overflow-hidden ring-1 ring-primary-500/10 dark:ring-primary-400/10"
          >
            <div className="flex items-center gap-4 px-5 py-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 -ml-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-navy-800/80 transition"
              >
                <ChevronLeft size={20} />
              </motion.button>

              <div className="flex-1 flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${statusConfig.color} shadow-lg shadow-${statusConfig.color.replace('bg-', '')}/50`}
                />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 text-xl font-bold bg-transparent text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  placeholder={t('myWork.taskDetail.placeholder3', 'Task title...')}
                  autoFocus={!taskId}
                />
                {taskId && (
                  <ArtifactPermalinkButton
                    artifactType="task"
                    artifactId={taskId}
                    isPolish={isPolish}
                    size={13}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Presentation Mode Switcher */}
                <PresentationModeSwitcher value={presentationMode} onChange={setPresentationMode} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  title={t('myWork.taskDetail.title16', 'Save')}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{t('myWork.taskDetail.save5', 'Save')}</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleOpenChat}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-primary-500/40 dark:border-primary-400/30 text-primary-700 dark:text-primary-300 hover:bg-primary-500/10 dark:hover:bg-primary-500/10 text-sm font-semibold transition shadow-sm"
                  title={t('myWork.taskDetail.title17', 'Open task chat')}
                >
                  <MessageSquare size={16} />
                  <span>{t('myWork.taskDetail.chat', 'Chat')}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
          {/* Left Column - 2/3 */}
          <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
            {/* Task Description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('description')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20">
                    <FileText size={18} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.taskDescription2', 'Task description')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {description && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      ✓
                    </span>
                  )}
                  {/* AI Button - visible only when expanded */}
                  <AnimatePresence>
                    {expandedSections.has('description') && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAIDescription();
                        }}
                        disabled={isGeneratingDescription}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 dark:hover:bg-primary-500/30 text-xs font-medium transition disabled:opacity-50"
                        title={t('myWork.taskDetail.title18', 'Generate AI description')}
                      >
                        {isGeneratingDescription ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>AI</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: expandedSections.has('description') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('description') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 resize-none transition"
                        placeholder={t(
                          'myWork.taskDetail.describeTaskDetails',
                          'Describe task details...'
                        )}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Expected Outcome */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('expectedOutcome')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20">
                    <Target size={18} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.expectedOutcome3', 'Expected Outcome')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {expectedOutcome && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      ✓
                    </span>
                  )}
                  {/* AI Button - visible only when expanded */}
                  <AnimatePresence>
                    {expandedSections.has('expectedOutcome') && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAIOutcome();
                        }}
                        disabled={isGeneratingOutcome}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 dark:hover:bg-primary-500/30 text-xs font-medium transition disabled:opacity-50"
                        title={t('myWork.taskDetail.title19', 'Generate AI outcome')}
                      >
                        {isGeneratingOutcome ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>AI</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: expandedSections.has('expectedOutcome') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('expectedOutcome') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <textarea
                        value={expectedOutcome}
                        onChange={(e) => setExpectedOutcome(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 dark:bg-navy-800/80 border border-slate-200 dark:border-navy-600/80 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 resize-none transition"
                        placeholder={t(
                          'myWork.taskDetail.whatShouldBeThe',
                          'What should be the outcome of this task?'
                        )}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Comments */}
            <CommentsSection
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onLikeComment={handleLikeComment}
              onGenerateAIComment={generateAIComment}
              isGeneratingAI={isGeneratingAIComment}
              currentUserId="current-user"
              expanded={expandedSections.has('comments')}
              onToggleExpand={() => toggleSection('comments')}
            />

            {/* Implementation Ideas */}
            <ImplementationIdeasSection
              ideas={implementationIdeas}
              onAdd={addIdea}
              onUpdate={(id, updates) =>
                setImplementationIdeas(
                  implementationIdeas.map((i) => (i.id === id ? { ...i, ...updates } : i))
                )
              }
              onRemove={(id) =>
                setImplementationIdeas(implementationIdeas.filter((i) => i.id !== id))
              }
              onVote={(id) =>
                setImplementationIdeas(
                  implementationIdeas.map((i) =>
                    i.id === id
                      ? {
                          ...i,
                          votes: i.votedByMe ? i.votes - 1 : i.votes + 1,
                          votedByMe: !i.votedByMe,
                        }
                      : i
                  )
                )
              }
              onGenerateAI={generateIdeasAI}
              isGenerating={isGeneratingIdeas}
              expanded={expandedSections.has('ideas')}
              onToggleExpand={() => toggleSection('ideas')}
            />

            {/* Related Decisions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('relatedDecisions')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/10 dark:from-amber-500/20 dark:to-amber-500/20">
                    <Scale size={18} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.relatedDecisions', 'Related Decisions')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {relatedDecisions.length > 0 && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {relatedDecisions.length}
                    </span>
                  )}
                  {relatedDecisions.some(
                    (d) =>
                      d.decisionStatus === 'pending' &&
                      (d.relationshipType === 'blocks' || d.relationshipType === 'requires')
                  ) && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                  <motion.div
                    animate={{ rotate: expandedSections.has('relatedDecisions') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('relatedDecisions') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Related decisions list */}
                      {relatedDecisions.length === 0 &&
                      !showCreateDecision &&
                      !showDecisionSearch ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                          <Scale
                            size={24}
                            className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                          />
                          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                            {t('myWork.taskDetail.noRelatedDecisions', 'No related decisions')}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">
                            {t(
                              'myWork.taskDetail.linkExistingOrCreate',
                              'Link existing or create new decision'
                            )}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {relatedDecisions.map((rel) => {
                            const statusColors: Record<string, string> = {
                              pending: 'bg-amber-500',
                              approved: 'bg-emerald-500',
                              rejected: 'bg-danger-500',
                              deferred: 'bg-slate-500',
                              escalated: 'bg-amber-500',
                            };
                            const statusLabels: Record<string, { en: string; pl: string }> = {
                              pending: { en: 'Pending', pl: 'Oczekuje' },
                              approved: { en: 'Approved', pl: 'Zatwierdzona' },
                              rejected: { en: 'Rejected', pl: 'Odrzucona' },
                              deferred: { en: 'Deferred', pl: 'Odroczona' },
                              escalated: { en: 'Escalated', pl: 'Eskalowana' },
                            };
                            const relationLabels: Record<string, { en: string; pl: string }> = {
                              blocks: { en: 'Blocks', pl: 'Blokuje' },
                              requires: { en: 'Requires', pl: 'Wymaga' },
                              informs: { en: 'Informs', pl: 'Informuje' },
                              depends_on: { en: 'Depends on', pl: 'Zależy od' },
                            };
                            const isBlocking =
                              (rel.relationshipType === 'blocks' ||
                                rel.relationshipType === 'requires') &&
                              rel.decisionStatus === 'pending';

                            return (
                              <div
                                key={rel.id}
                                className={`p-3 rounded-xl border transition ${
                                  isBlocking
                                    ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                                    : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200 dark:border-navy-600'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div
                                      className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${statusColors[rel.decisionStatus] || 'bg-slate-400'}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {rel.decisionTitle}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span
                                          className={`text-xs px-1.5 py-0.5 rounded ${
                                            isBlocking
                                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                              : 'bg-slate-100 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                                          }`}
                                        >
                                          {isPolish
                                            ? relationLabels[rel.relationshipType]?.pl
                                            : relationLabels[rel.relationshipType]?.en}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                          {isPolish
                                            ? statusLabels[rel.decisionStatus]?.pl
                                            : statusLabels[rel.decisionStatus]?.en}
                                        </span>
                                        {isBlocking && (
                                          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                            ⚠️ {t('myWork.taskDetail.blocking', 'Blocking')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {onOpenDecision && (
                                      <button
                                        onClick={() => onOpenDecision(rel.decisionId)}
                                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-blue-500 transition"
                                        title={t('myWork.taskDetail.title20', 'Open decision')}
                                      >
                                        <ExternalLink size={14} />
                                      </button>
                                    )}
                                    <button
                                      onClick={async () => {
                                        // Optimistically remove from UI, then persist the unlink.
                                        const prev = relatedDecisions;
                                        setRelatedDecisions(
                                          relatedDecisions.filter((d) => d.id !== rel.id)
                                        );
                                        if (!rel.edgeId) return; // not yet persisted
                                        try {
                                          await Api.deleteLinkGraphEdge(rel.edgeId);
                                        } catch (err) {
                                          console.error(
                                            '[TaskDetailView] Failed to unlink decision',
                                            err
                                          );
                                          setRelatedDecisions(prev); // rollback
                                          toast.error(
                                            t(
                                              'myWork.taskDetail.failedToRemoveLink',
                                              'Failed to remove link'
                                            )
                                          );
                                        }
                                      }}
                                      className="p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Create new decision form */}
                      {showCreateDecision && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-500/50 bg-amber-50/30 dark:bg-amber-500/5 space-y-3"
                        >
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <Plus size={16} />
                            <span className="text-sm font-semibold">
                              {t('myWork.taskDetail.newDecision', 'New Decision')}
                            </span>
                          </div>

                          {/* Decision title */}
                          <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {t('myWork.taskDetail.decisionTitle', 'Decision title *')}
                            </label>
                            <input
                              type="text"
                              value={newDecisionTitle}
                              onChange={(e) => setNewDecisionTitle(e.target.value)}
                              placeholder={t(
                                'myWork.taskDetail.eGProjectBudget',
                                'E.g. Project budget approval'
                              )}
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                              autoFocus
                            />
                          </div>

                          {/* Decision description */}
                          <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {t(
                                'myWork.taskDetail.problemDescriptionContext',
                                'Problem description / context'
                              )}
                            </label>
                            <textarea
                              value={newDecisionDescription}
                              onChange={(e) => setNewDecisionDescription(e.target.value)}
                              placeholder={t(
                                'myWork.taskDetail.describeTheProblemRequiring',
                                'Describe the problem requiring decision...'
                              )}
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
                            />
                          </div>

                          {/* Relationship type */}
                          <div>
                            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {t(
                                'myWork.taskDetail.relationshipWithTask',
                                'Relationship with task'
                              )}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                {
                                  key: 'requires',
                                  label: { en: 'Requires', pl: 'Wymaga' },
                                  desc: {
                                    en: 'Task requires this decision',
                                    pl: 'Zadanie wymaga tej decyzji',
                                  },
                                },
                                {
                                  key: 'blocks',
                                  label: { en: 'Blocks', pl: 'Blokuje' },
                                  desc: {
                                    en: 'Decision blocks task progress',
                                    pl: 'Decyzja blokuje postęp',
                                  },
                                },
                                {
                                  key: 'depends_on',
                                  label: { en: 'Depends', pl: 'Zależy' },
                                  desc: {
                                    en: 'Task depends on outcome',
                                    pl: 'Zadanie zależy od wyniku',
                                  },
                                },
                                {
                                  key: 'informs',
                                  label: { en: 'Informs', pl: 'Informuje' },
                                  desc: {
                                    en: 'Decision informs task',
                                    pl: 'Decyzja informuje zadanie',
                                  },
                                },
                              ].map((type) => (
                                <button
                                  key={type.key}
                                  onClick={() => setNewDecisionRelationType(type.key as any)}
                                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                                    newDecisionRelationType === type.key
                                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-300'
                                      : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:border-amber-300'
                                  }`}
                                  title={isPolish ? type.desc.pl : type.desc.en}
                                >
                                  {isPolish ? type.label.pl : type.label.en}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-2">
                            <button
                              disabled={creatingDecision || !taskId}
                              onClick={async () => {
                                if (!newDecisionTitle.trim()) {
                                  toast.error(
                                    t(
                                      'myWork.taskDetail.enterDecisionTitle',
                                      'Enter decision title'
                                    )
                                  );
                                  return;
                                }
                                if (!taskId) {
                                  toast.error(
                                    t(
                                      'myWork.taskDetail.saveTheTaskFirst',
                                      'Save the task first to create a decision'
                                    )
                                  );
                                  return;
                                }
                                const decisionMakerId = currentUser?.id || ownerId || assigneeId;
                                if (!decisionMakerId) {
                                  toast.error(
                                    t(
                                      'myWork.taskDetail.noDecisionMakerAvailable',
                                      'No decision maker available — cannot create decision'
                                    )
                                  );
                                  return;
                                }
                                try {
                                  setCreatingDecision(true);
                                  // 1) Persist the decision for real (no more fake Math.random ids).
                                  const created = await Api.createDecision({
                                    title: newDecisionTitle.trim(),
                                    description: newDecisionDescription.trim() || undefined,
                                    type: 'APPROVAL',
                                    decisionMakerId,
                                    taskId,
                                    projectId: projectId || undefined,
                                    initiativeId: initiativeId || undefined,
                                  });
                                  const createdDecision = created?.decision || created;
                                  const realDecisionId = String(
                                    createdDecision?.id || createdDecision?.decisionId || ''
                                  );
                                  if (!realDecisionId) {
                                    throw new Error('Decision id missing in response');
                                  }
                                  // 2) Persist the task↔decision link (source=decision, target=task).
                                  const edgeRes = await Api.createLinkGraphEdge({
                                    source: { type: 'decision', id: realDecisionId },
                                    target: { type: 'task', id: taskId },
                                  });
                                  const newDecision = {
                                    id: realDecisionId,
                                    title: newDecisionTitle.trim(),
                                    status: 'pending',
                                  };
                                  setAvailableDecisions([...availableDecisions, newDecision]);
                                  const newRelation: RelatedDecision = {
                                    id: edgeRes?.edgeId || realDecisionId,
                                    edgeId: edgeRes?.edgeId || null,
                                    decisionId: realDecisionId,
                                    decisionTitle: newDecisionTitle.trim(),
                                    decisionStatus: 'pending',
                                    relationshipType: newDecisionRelationType,
                                  };
                                  setRelatedDecisions([...relatedDecisions, newRelation]);
                                  setShowCreateDecision(false);
                                  setNewDecisionTitle('');
                                  setNewDecisionDescription('');
                                  setNewDecisionRelationType('requires');
                                  addActivityLogEntry(
                                    'edit',
                                    isPolish
                                      ? `Utworzono decyzję: ${newDecisionTitle}`
                                      : `Created decision: ${newDecisionTitle}`
                                  );
                                  toast.success(
                                    t(
                                      'myWork.taskDetail.decisionCreatedAndLinked',
                                      'Decision created and linked'
                                    )
                                  );
                                } catch (err) {
                                  console.error('[TaskDetailView] Failed to create decision', err);
                                  toast.error(
                                    t(
                                      'myWork.taskDetail.failedToCreateDecision',
                                      'Failed to create decision'
                                    )
                                  );
                                } finally {
                                  setCreatingDecision(false);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus size={16} />
                              <span className="text-sm">
                                {t('myWork.taskDetail.createDecision', 'Create Decision')}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setShowCreateDecision(false);
                                setNewDecisionTitle('');
                                setNewDecisionDescription('');
                              }}
                              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-700 transition"
                            >
                              <span className="text-sm">
                                {t('myWork.taskDetail.cancel4', 'Cancel')}
                              </span>
                            </button>
                          </div>

                          {/* Info about full editor */}
                          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 text-center">
                            {t(
                              'myWork.taskDetail.decisionWillBeCreated',
                              'Decision will be created as draft. You can complete it in full editor.'
                            )}
                          </p>
                        </motion.div>
                      )}

                      {/* Search existing decisions */}
                      {showDecisionSearch && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-2"
                        >
                          <div className="relative">
                            <Search
                              size={16}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                            />
                            <input
                              type="text"
                              value={decisionSearchQuery}
                              onChange={(e) => setDecisionSearchQuery(e.target.value)}
                              placeholder={t(
                                'myWork.taskDetail.searchExistingDecisions',
                                'Search existing decisions...'
                              )}
                              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-amber-400"
                              autoFocus
                            />
                          </div>

                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {availableDecisions
                              .filter(
                                (d) =>
                                  d.title
                                    .toLowerCase()
                                    .includes(decisionSearchQuery.toLowerCase()) &&
                                  !relatedDecisions.some((r) => r.decisionId === d.id)
                              )
                              .map((decision) => (
                                <button
                                  key={decision.id}
                                  disabled={linkingDecisionId === decision.id || !taskId}
                                  onClick={async () => {
                                    if (!taskId) {
                                      toast.error(
                                        t(
                                          'myWork.taskDetail.saveTheTaskFirst2',
                                          'Save the task first to link a decision'
                                        )
                                      );
                                      return;
                                    }
                                    try {
                                      setLinkingDecisionId(decision.id);
                                      // Persist the link (source=decision, target=task).
                                      const edgeRes = await Api.createLinkGraphEdge({
                                        source: { type: 'decision', id: decision.id },
                                        target: { type: 'task', id: taskId },
                                      });
                                      const newRelation: RelatedDecision = {
                                        id: edgeRes?.edgeId || decision.id,
                                        edgeId: edgeRes?.edgeId || null,
                                        decisionId: decision.id,
                                        decisionTitle: decision.title,
                                        decisionStatus: decision.status as any,
                                        relationshipType: 'requires',
                                      };
                                      setRelatedDecisions([...relatedDecisions, newRelation]);
                                      setShowDecisionSearch(false);
                                      setDecisionSearchQuery('');
                                      addActivityLogEntry(
                                        'edit',
                                        t('myWork.taskDetail.linkedDecision', 'Linked decision')
                                      );
                                      toast.success(
                                        t('myWork.taskDetail.decisionLinked', 'Decision linked')
                                      );
                                    } catch (err) {
                                      console.error(
                                        '[TaskDetailView] Failed to link decision',
                                        err
                                      );
                                      toast.error(
                                        t(
                                          'myWork.taskDetail.failedToLinkDecision',
                                          'Failed to link decision'
                                        )
                                      );
                                    } finally {
                                      setLinkingDecisionId(null);
                                    }
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      decision.status === 'pending'
                                        ? 'bg-amber-500'
                                        : decision.status === 'approved'
                                          ? 'bg-emerald-500'
                                          : 'bg-slate-400'
                                    }`}
                                  />
                                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                                    {decision.title}
                                  </span>
                                </button>
                              ))}
                            {availableDecisions.filter(
                              (d) =>
                                d.title.toLowerCase().includes(decisionSearchQuery.toLowerCase()) &&
                                !relatedDecisions.some((r) => r.decisionId === d.id)
                            ).length === 0 && (
                              <p className="text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 py-4">
                                {t(
                                  'myWork.taskDetail.noMatchingDecisions',
                                  'No matching decisions'
                                )}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setShowDecisionSearch(false);
                              setDecisionSearchQuery('');
                            }}
                            className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1"
                          >
                            {t('myWork.taskDetail.cancel5', 'Cancel')}
                          </button>
                        </motion.div>
                      )}

                      {/* Action buttons */}
                      {!showCreateDecision && !showDecisionSearch && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowCreateDecision(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition"
                          >
                            <Plus size={16} />
                            <span className="text-sm font-medium">
                              {t('myWork.taskDetail.newDecision2', 'New Decision')}
                            </span>
                          </button>
                          <button
                            onClick={() => setShowDecisionSearch(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700 transition"
                          >
                            <Link2 size={16} />
                            <span className="text-sm font-medium">
                              {t('myWork.taskDetail.linkExisting', 'Link Existing')}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Risk Analysis */}
            <RiskAssessmentCompact
              risks={risks}
              onAdd={addRisk}
              onUpdate={(id, updates) =>
                setRisks(risks.map((r) => (r.id === id ? { ...r, ...updates } : r)))
              }
              onRemove={(id) => setRisks(risks.filter((r) => r.id !== id))}
              onGenerateAI={generateRisksAI}
              isGenerating={isGeneratingRisks}
              expanded={expandedSections.has('risks')}
              onToggleExpand={() => toggleSection('risks')}
            />

            {/* Alternatives */}
            <AlternativesSection
              alternatives={alternatives}
              selectedAlternativeId={selectedAlternativeId}
              status={status}
              onAdd={addAlternative}
              onUpdate={(id, updates) =>
                setAlternatives(alternatives.map((a) => (a.id === id ? { ...a, ...updates } : a)))
              }
              onRemove={(id) => setAlternatives(alternatives.filter((a) => a.id !== id))}
              onSetRecommended={(id) =>
                setAlternatives(alternatives.map((a) => ({ ...a, isRecommended: a.id === id })))
              }
              onSelect={(id) => setSelectedAlternativeId(id)}
              onGenerateAI={generateAlternativesAI}
              isGenerating={isGeneratingAlternatives}
              expanded={expandedSections.has('alternatives')}
              onToggleExpand={() => toggleSection('alternatives')}
            />

            {/* Checklist */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <div
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                onClick={() => toggleSection('checklist')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20">
                    <CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.checklist2', 'Checklist')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {checklist.length > 0 && (
                    <>
                      <div className="w-20 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition"
                          style={{ width: `${checklistProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                        {checklist.filter((c) => c.completed).length}/{checklist.length}
                      </span>
                    </>
                  )}
                  {/* AI Button - visible only when expanded */}
                  <AnimatePresence>
                    {expandedSections.has('checklist') && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          generateAIChecklist();
                        }}
                        disabled={isGeneratingChecklist}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 dark:hover:bg-primary-500/30 text-xs font-medium transition disabled:opacity-50"
                        title={t('myWork.taskDetail.title21', 'Generate AI checklist')}
                      >
                        {isGeneratingChecklist ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        <span>AI</span>
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: expandedSections.has('checklist') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {expandedSections.has('checklist') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-2">
                      {checklist.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                          <CheckSquare
                            size={24}
                            className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                          />
                          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                            {t('myWork.taskDetail.noItems', 'No items')}
                          </p>
                          <button
                            onClick={addChecklistItem}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                          >
                            <Plus size={14} />
                            {t('myWork.taskDetail.addItem2', 'Add item')}
                          </button>
                        </div>
                      ) : (
                        <>
                          {checklist.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 group">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={(e) =>
                                  updateChecklistItem(item.id, { completed: e.target.checked })
                                }
                                className="w-4 h-4 rounded border-slate-300 dark:border-navy-600 text-emerald-500 focus:ring-emerald-500"
                              />
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) =>
                                  updateChecklistItem(item.id, { text: e.target.value })
                                }
                                placeholder={t('myWork.taskDetail.placeholder4', 'Enter item...')}
                                className={`flex-1 px-2 py-1.5 rounded-lg text-sm bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-navy-600 focus:border-emerald-400 dark:focus:border-emerald-500 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none transition-colors ${
                                  item.completed
                                    ? 'line-through text-slate-500 dark:text-slate-400 dark:text-slate-500'
                                    : ''
                                }`}
                              />
                              <button
                                onClick={() => removeChecklistItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/20 text-slate-500 dark:text-slate-400 hover:text-danger-500 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addChecklistItem}
                            className="flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-600 py-2 px-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                          >
                            <Plus size={14} />
                            <span>{t('myWork.taskDetail.addItem3', 'Add item')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Activity Log */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('activityLog')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20">
                    <History size={18} className="text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.activityLog', 'Activity Log')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {activityLog.length > 0 && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {activityLog.length}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('activityLog') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('activityLog') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 max-h-80 overflow-y-auto">
                      {activityLog.length === 0 ? (
                        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
                          <History
                            size={24}
                            className="mx-auto mb-2 text-slate-700 dark:text-slate-400"
                          />
                          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                            {t('myWork.taskDetail.noActivityYet', 'No activity yet')}
                          </p>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200 dark:bg-navy-700" />

                          <div className="space-y-4">
                            {activityLog.map((entry, index) => {
                              const getIcon = () => {
                                switch (entry.type) {
                                  case 'created':
                                    return <Plus size={12} />;
                                  case 'status_change':
                                    return <CheckCircle2 size={12} />;
                                  case 'assignment':
                                    return <User size={12} />;
                                  case 'comment':
                                    return <FileText size={12} />;
                                  case 'edit':
                                    return <Edit3 size={12} />;
                                  case 'attachment':
                                    return <FileText size={12} />;
                                  case 'deadline':
                                    return <Calendar size={12} />;
                                  case 'priority':
                                    return <Flag size={12} />;
                                  default:
                                    return <Clock size={12} />;
                                }
                              };

                              const getColor = () => {
                                switch (entry.type) {
                                  case 'created':
                                    return 'bg-emerald-500 text-white';
                                  case 'status_change':
                                    return 'bg-blue-500 text-white';
                                  case 'assignment':
                                    return 'bg-sky-500 text-white';
                                  case 'comment':
                                    return 'bg-amber-500 text-white';
                                  case 'edit':
                                    return 'bg-slate-500 text-slate-900 dark:text-white';
                                  case 'deadline':
                                    return 'bg-danger-500 text-white';
                                  case 'priority':
                                    return 'bg-amber-500 text-white';
                                  default:
                                    return 'bg-slate-400 text-slate-900 dark:text-white';
                                }
                              };

                              return (
                                <div key={entry.id} className="relative flex gap-3 pl-1">
                                  {/* Icon */}
                                  <div
                                    className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${getColor()}`}
                                  >
                                    {getIcon()}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0 pb-2">
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                      {entry.description}
                                      {entry.oldValue && entry.newValue && (
                                        <span className="text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                          {' '}
                                          <span className="line-through">
                                            {entry.oldValue}
                                          </span> →{' '}
                                          <span className="font-medium text-slate-600 dark:text-slate-300">
                                            {entry.newValue}
                                          </span>
                                        </span>
                                      )}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {entry.userName && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                          {entry.userName}
                                        </span>
                                      )}
                                      <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                        {new Date(entry.timestamp).toLocaleString(
                                          t('myWork.taskDetail.enUS', 'en-US'),
                                          {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Right Column - 1/3 */}
          <div className="space-y-4 lg:sticky lg:top-6 self-start order-1 lg:order-2">
            {/* Deadline Alert */}
            <DeadlineAlertBanner dueDate={dueDate} status={status} />

            {/* Control Panel */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('control')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/10 dark:from-blue-500/20 dark:to-blue-500/20">
                    <Flag size={18} className="text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.control', 'Control')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {taskId && (
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-navy-800/80 px-2 py-0.5 rounded-lg">
                      #{taskId.slice(0, 8)}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('control') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('control') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      {/* Initiative */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {t('myWork.taskDetail.initiative3', 'Initiative')}
                        </label>
                        <button
                          onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {initiativeId ? (
                              <>
                                <div className="p-1 rounded bg-blue-500/10">
                                  <Layers size={12} className="text-blue-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                  {initiativeName ||
                                    availableInitiatives.find((i) => i.id === initiativeId)?.name}
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="p-1 rounded bg-slate-200 dark:bg-navy-700">
                                  <Minus size={12} className="text-slate-500 dark:text-slate-400" />
                                </div>
                                <span className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
                                  {t('myWork.taskDetail.standaloneTask', 'Standalone task')}
                                </span>
                              </>
                            )}
                          </div>
                          <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showInitiativeDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1 max-h-60 overflow-y-auto"
                            >
                              <button
                                onClick={() => {
                                  setInitiativeId(null);
                                  setInitiativeName(null);
                                  setShowInitiativeDropdown(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                  !initiativeId ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                }`}
                              >
                                <div className="p-1 rounded bg-slate-200 dark:bg-navy-700">
                                  <Minus size={12} className="text-slate-500 dark:text-slate-400" />
                                </div>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {t('myWork.taskDetail.standaloneTask2', 'Standalone task')}
                                </span>
                              </button>
                              <div className="border-t border-slate-200 dark:border-navy-700 my-1" />
                              {availableInitiatives.map((init) => (
                                <button
                                  key={init.id}
                                  onClick={() => {
                                    setInitiativeId(init.id);
                                    setInitiativeName(init.name);
                                    setShowInitiativeDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                    initiativeId === init.id ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                  }`}
                                >
                                  <div className="p-1 rounded bg-blue-500/10">
                                    <Layers size={12} className="text-blue-500" />
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {init.name}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Status */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          Status
                        </label>
                        <button
                          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                            </span>
                          </div>
                          <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showStatusDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1"
                            >
                              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setStatus(key as keyof typeof STATUS_CONFIG);
                                    setShowStatusDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                    status === key ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                  }`}
                                >
                                  <div className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {isPolish ? config.label.pl : config.label.en}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Priority */}
                      <div className="relative">
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {t('myWork.taskDetail.priority2', 'Priority')}
                        </label>
                        <button
                          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Flag size={14} className={priorityConfig.textColor} />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {isPolish ? priorityConfig.label.pl : priorityConfig.label.en}
                            </span>
                          </div>
                          <ChevronDown size={16} className="text-slate-500 dark:text-slate-400" />
                        </button>
                        <AnimatePresence>
                          {showPriorityDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-600 py-1"
                            >
                              {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setPriority(key as keyof typeof PRIORITY_CONFIG);
                                    setShowPriorityDropdown(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${
                                    priority === key ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                                  }`}
                                >
                                  <Flag size={14} className={config.textColor} />
                                  <span className="text-slate-700 dark:text-slate-300">
                                    {isPolish ? config.label.pl : config.label.en}
                                  </span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {t('myWork.taskDetail.dueDate2', 'Due Date')}
                        </label>
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600">
                          <Calendar size={14} className="text-slate-500 dark:text-slate-400" />
                          <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Owner / Assignee */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {t('myWork.taskDetail.owner2', 'Owner')}
                          </label>
                          <select
                            value={ownerId}
                            onChange={(e) => setOwnerId(e.target.value)}
                            className="w-full h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">{t('myWork.taskDetail.select2', 'Select')}</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {t('myWork.taskDetail.assignee', 'Assignee')}
                          </label>
                          <select
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                            className="w-full h-[42px] px-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400"
                          >
                            <option value="">{t('myWork.taskDetail.select3', 'Select')}</option>
                            {users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Blocked Reason */}
                      {status === 'blocked' && (
                        <div>
                          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {t('myWork.taskDetail.blockedReason2', 'Blocked Reason')}
                          </label>
                          <textarea
                            value={blockedReason}
                            onChange={(e) => setBlockedReason(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-danger-200 dark:border-danger-500/30 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-danger-400 resize-none"
                            placeholder={t(
                              'myWork.taskDetail.describeBlockingReason2',
                              'Describe blocking reason...'
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Attachments */}
            <AttachmentsSection
              attachments={attachments}
              onUpload={handleUploadAttachments}
              onDelete={handleDeleteAttachment}
              expanded={expandedSections.has('attachments')}
              onToggleExpand={() => toggleSection('attachments')}
            />

            {/* Linked Items */}
            <LinkedItemsSection
              items={linkedItems}
              onAdd={handleAddLinkedItem}
              onRemove={(itemId: string) => handleRemoveLinkedItem({ id: itemId, type: '' as any })}
              searchItems={searchLinkedItems}
              expanded={expandedSections.has('linkedItems')}
              onToggleExpand={() => toggleSection('linkedItems')}
            />

            {taskId && title && (
              <RelatedContext entityType="task" entityId={taskId} entityTitle={title} />
            )}

            {taskId && <AIConnections entityType="task" entityId={taskId} />}

            {/* Stakeholders */}
            <StakeholdersSection
              stakeholders={stakeholders}
              availableUsers={users.map((u) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
                email: u.email,
              }))}
              onAdd={(
                userId: string,
                role: StakeholderRole,
                notificationSettings: StakeholderNotificationSettings
              ) => {
                const user = users.find((u) => u.id === userId);
                const newStakeholder: Stakeholder = {
                  id: Math.random().toString(36).substr(2, 9),
                  decisionId: taskId || 'new',
                  userId,
                  userName: user ? `${user.firstName} ${user.lastName}` : undefined,
                  userEmail: user?.email,
                  role,
                  notificationSettings,
                };
                setStakeholders([...stakeholders, newStakeholder]);
                toast.success(t('myWork.taskDetail.toastSuccess11', 'Stakeholder added'));
              }}
              onUpdate={(id: string, updates: Partial<Stakeholder>) => {
                setStakeholders(stakeholders.map((s) => (s.id === id ? { ...s, ...updates } : s)));
              }}
              onRemove={(id: string) => {
                setStakeholders(stakeholders.filter((s) => s.id !== id));
                toast.success(t('myWork.taskDetail.toastSuccess12', 'Stakeholder removed'));
              }}
            />

            {/* Reminders & Escalation */}
            <EscalationRulesSection
              reminders={reminders}
              escalation={escalation}
              thresholds={thresholds}
              availableUsers={users.map((u) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
              }))}
              onRemindersChange={setReminders}
              onEscalationChange={setEscalation}
              onThresholdsChange={setThresholds}
              dueDate={dueDate}
            />

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
            >
              <motion.button
                whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleSection('tags')}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500/10 to-danger-500/10 dark:from-pink-500/20 dark:to-danger-500/20">
                    <Tag size={18} className="text-pink-500 dark:text-pink-400" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {t('myWork.taskDetail.tags', 'Tags')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {tags.length > 0 && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {tags.length}
                    </span>
                  )}
                  <motion.div
                    animate={{ rotate: expandedSections.has('tags') ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                  </motion.div>
                </div>
              </motion.button>

              <AnimatePresence>
                {expandedSections.has('tags') && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="hover:text-pink-900 dark:hover:text-pink-100"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          placeholder={t('myWork.taskDetail.placeholder5', 'New tag...')}
                          className="flex-1 px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-pink-400"
                        />
                        <button
                          onClick={addTag}
                          disabled={!newTag.trim()}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-500/10 border border-pink-200 dark:border-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Dependencies */}
            <DependenciesSection
              taskId={taskId || ''}
              connectedTasks={linkedItems
                .filter((item) => item.type === 'task')
                .map((item) => ({
                  id: item.id,
                  title: item.title,
                  status: item.status,
                  priority: item.priority,
                }))}
            />

            {/* Evidence & Acceptance */}
            <EvidenceSection
              evidenceRequired={evidenceRequired}
              evidenceItems={evidenceItems}
              requiresAcceptance={requiresAcceptance}
              acceptanceType={acceptanceType}
              acceptorId={acceptorId}
              signedOff={signedOff}
              signedOffAt={signedOffAt}
              signedOffBy={signedOffBy}
              availableUsers={users.map((u) => ({
                id: u.id,
                name: `${u.firstName} ${u.lastName}`,
              }))}
              onEvidenceRequiredChange={setEvidenceRequired}
              onAddEvidence={(item) =>
                setEvidenceItems([
                  ...evidenceItems,
                  { ...item, id: Math.random().toString(36).substr(2, 9) },
                ])
              }
              onRemoveEvidence={(id) => setEvidenceItems(evidenceItems.filter((e) => e.id !== id))}
              onVerifyEvidence={(id) =>
                setEvidenceItems(
                  evidenceItems.map((e) =>
                    e.id === id ? { ...e, verified: true, verifiedAt: new Date().toISOString() } : e
                  )
                )
              }
              onAcceptanceChange={(requires, type, acceptor) => {
                setRequiresAcceptance(requires);
                setAcceptanceType(type);
                setAcceptorId(acceptor);
              }}
              onSignOff={() => {
                setSignedOff(true);
                setSignedOffAt(new Date().toISOString());
                setSignedOffBy('Current User');
                toast.success(t('myWork.taskDetail.toastSuccess13', 'Task signed off'));
              }}
              expanded={expandedSections.has('evidence')}
              onToggleExpand={() => toggleSection('evidence')}
            />

            {/* Related Notes */}
            {relatedNotes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden"
              >
                <div
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors cursor-pointer"
                  onClick={() => toggleSection('relatedNotes')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-500/10 dark:from-primary-500/20 dark:to-primary-500/20">
                      <BookOpen size={18} className="text-primary-500 dark:text-primary-400" />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {t('myWork.taskDetail.relatedNotes', 'Related Notes')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
                      {relatedNotes.length}
                    </span>
                    <motion.div
                      animate={{ rotate: expandedSections.has('relatedNotes') ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedSections.has('relatedNotes') && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
                    >
                      <div className="p-4 space-y-2">
                        {relatedNotes.map((note) => {
                          const mat = (note.maturity || 'seed') as
                            | 'seed'
                            | 'growing'
                            | 'mature'
                            | 'actionable';
                          const maturityStyles: Record<
                            string,
                            { dot: string; bg: string; text: string; border: string; label: string }
                          > = {
                            seed: {
                              dot: 'bg-slate-400',
                              bg: 'bg-slate-500/10',
                              text: 'text-slate-500',
                              border: 'border-slate-400/30',
                              label: t('myWork.taskDetail.label14', 'Seed'),
                            },
                            growing: {
                              dot: 'bg-emerald-500',
                              bg: 'bg-emerald-500/10',
                              text: 'text-emerald-600 dark:text-emerald-400',
                              border: 'border-emerald-500/30',
                              label: t('myWork.taskDetail.label15', 'Growing'),
                            },
                            mature: {
                              dot: 'bg-blue-500',
                              bg: 'bg-blue-500/10',
                              text: 'text-blue-600 dark:text-blue-400',
                              border: 'border-blue-500/30',
                              label: t('myWork.taskDetail.label16', 'Mature'),
                            },
                            actionable: {
                              dot: 'bg-amber-500',
                              bg: 'bg-amber-500/10',
                              text: 'text-amber-600 dark:text-amber-400',
                              border: 'border-amber-500/30',
                              label: t('myWork.taskDetail.label17', 'Actionable'),
                            },
                          };
                          const cfg = maturityStyles[mat] || maturityStyles.seed;
                          return (
                            <button
                              key={note.id}
                              type="button"
                              onClick={() =>
                                window.dispatchEvent(
                                  new CustomEvent('mywork-open-item', {
                                    detail: { type: 'notebook', id: note.id, name: note.title },
                                  })
                                )
                              }
                              className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-navy-600 bg-slate-50/50 dark:bg-navy-800/50 hover:bg-slate-100/80 dark:hover:bg-navy-700/50 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate block">
                                    {note.title}
                                  </span>
                                  <NotebookMetadataBadges
                                    captureSource={note.captureSource}
                                    captureMetadata={note.captureMetadata}
                                    convertedTo={note.convertedTo}
                                    isPolish={isPolish}
                                    className="mt-1"
                                  />
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md border ${cfg.border} ${cfg.bg} ${cfg.text} px-2 py-0.5 font-semibold uppercase tracking-wide text-[9px] shrink-0`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailView;
