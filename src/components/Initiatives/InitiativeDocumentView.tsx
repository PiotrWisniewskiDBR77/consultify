/**
 * InitiativeDocumentView - Dynamic Section Renderer
 *
 * Refactored from a 3500-line monolith into a dynamic renderer that:
 * 1. Loads section types from the API (initiative_section_types table)
 * 2. Reads the template's visible_sections to determine which sections to show
 * 3. Renders sections dynamically using the Section Registry
 *
 * All section components live in ./sections/ and consume the InitiativeContext.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Archive,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Copy,
  Crosshair,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Flag,
  FolderOpen,
  GitBranch,
  History,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  MoreVertical,
  Play,
  Plus,
  Save,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Undo2,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Callout, EmbeddedView, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
import { V8PlanningApi } from '@/services/api/v8/planning';
import {
  getContextActions,
  getFilteredStatusActions,
  getModuleForStatus,
  getStatusActions,
  getStatusMeta,
  StatusAction,
  willChangeModule,
} from '@/services/initiativeLifecycle';
import {
  getInitiativeStatusPreflightTruth,
  saveInitiativeWriteTruth,
  updateInitiativeStatusWriteTruth,
} from '@/services/initiativeWriteTruth';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { buildArtifactCode, buildArtifactPermalink } from '@/utils/artifactLinks';

import { INITIATIVE_STATUS_METADATA, InitiativeStatus } from '../../types';
import {
  type Attachment,
  type Comment,
  type LinkedItem,
  type Stakeholder,
  type StakeholderNotificationSettings,
  type StakeholderRole,
  type TaskDependency,
  type WarningThresholds,
} from '../MyWork/shared';
import { AIFieldEnhancer } from '../shared/AIFieldEnhancer';
import { ArtifactPermalinkButton } from '../shared/ArtifactPermalinkButton';
import {
  type NModeAction,
  NModeCanvas,
  NModeHeader,
  NModeLeftNav,
  NModePropertiesStrip,
  type NModePropertyField,
  type NModeSection,
} from '../shared/NModeLayout';
import type { EscalationRuleWithConfig, ReminderRuleWithDelivery } from '../shared/NModeSections';
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
  RaidCanvas as NModeRaidCanvas,
  type SortOrder,
} from '../shared/NModeSections';
import { type RowAction, RowActionsMenu } from '../shared/RowActionsMenu';
import { SourceMetadataBlock } from '../shared/SourceMetadataBlock';
import { normalizeGateReadinessPayload } from './gateReadinessPayload';
import { InitiativeCompactPanel } from './InitiativeCompactPanel';
import { InitiativeScrollView } from './InitiativeScrollView';
import {
  createInitiativesDemoDataset,
  isShowcaseArtifactId,
  isShowcaseInitiativeId,
} from './initiativesDemoData';
import { getSourceDisplayLabel } from './InitiativeSourceLink';
import {
  DEFAULT_SECTION_ORDER,
  DEFAULT_VISIBLE_SECTIONS,
  GATE_CONFIG,
  GATE_DEFINITIONS,
  getModuleFromStatus,
  getNextGateForStatus,
  InitiativeContext,
  MODULE_CONFIG,
  SECTION_REGISTRY,
} from './sections';
import { InitiativeGatesWorkflowTable } from './sections/InitiativeGatesWorkflowTable';
import { ResourcesSection } from './sections/ResourcesSection';
import type {
  Decision,
  GateReadinessCheck,
  GateRoleAssignment,
  HistoryEvent,
  PendingApproval,
  RaidItem,
  SectionTypeInfo,
  StatusHistoryEntry,
  TaskItem,
  UserInfo,
  Watcher,
} from './sections/types';

interface InitiativeDocumentViewProps {
  initiativeId: string;
  onBack?: () => void;
  onStatusChange?: (newStatus: string) => void;
  sourceModule?: 'tools' | 'assessment' | 'initiatives' | 'execution' | 'benefits';
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
}

const KPI_NAME_EN_MAP: Record<string, string> = {
  'Skrócenie czasu changeover': 'Changeover time reduction',
  'Redukcja odpadów rozruchowych': 'Startup scrap reduction',
  'OEE po changeover': 'Post-changeover OEE',
};

const toEnglishKpiName = (name: string, isPolish: boolean): string => {
  if (isPolish) return name;
  return KPI_NAME_EN_MAP[name] || name;
};

const toKpiNumber = (value: string): number => {
  const normalized = String(value || '')
    .replace(',', '.')
    .trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface ExpandableNarrativeFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  isPolish: boolean;
}

const ExpandableNarrativeField: React.FC<ExpandableNarrativeFieldProps> = ({
  value,
  onChange,
  placeholder,
  isPolish,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const updateOverflow = () => {
      if (isExpanded) {
        // While expanded, keep the toggle visible when content is non-trivial.
        setIsOverflowing(value.trim().length > 220 || el.scrollHeight > 120);
        return;
      }
      setIsOverflowing(el.scrollHeight > el.clientHeight + 2);
    };

    updateOverflow();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded, value]);

  useEffect(() => {
    if (!isOverflowing && isExpanded) {
      setIsExpanded(false);
    }
  }, [isOverflowing, isExpanded]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className={`w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 border-b border-slate-200 dark:border-navy-700/40 focus:border-primary-400 transition-colors min-h-[60px] ${
          isExpanded ? 'min-h-[220px] overflow-visible resize-y' : 'h-24 overflow-hidden resize-y'
        }`}
        placeholder={placeholder}
      />
      {isOverflowing && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="absolute -bottom-4 right-4 inline-flex items-center gap-1 px-1 py-0.5 text-[10px] font-medium text-slate-500/90 dark:text-slate-400/90 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {isExpanded ? (isPolish ? 'Mniej' : 'Less') : isPolish ? 'Więcej' : 'More'}
        </button>
      )}
    </div>
  );
};

export const InitiativeDocumentView: React.FC<InitiativeDocumentViewProps> = ({
  initiativeId,
  onBack,
  onStatusChange,
  sourceModule,
  onOpenTask,
  onOpenDecision,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { isChatCollapsed, toggleChatCollapse, setCurrentView, setMyWorkIntent, currentUser } =
    useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();

  const initiativesDemoData = useMemo(() => {
    const currentUserAny = currentUser as any;
    const currentUserName =
      currentUserAny?.name ||
      [currentUserAny?.firstName, currentUserAny?.lastName].filter(Boolean).join(' ') ||
      'Piotr Wisniewski';

    return createInitiativesDemoDataset({
      currentUserId: currentUserAny?.id,
      currentUserName,
      currentUserEmail: currentUserAny?.email,
    });
  }, [currentUser]);

  const normalizeStringList = (value: any): string[] => {
    if (Array.isArray(value)) {
      return value.map((v) => String(v ?? '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      return trimmed
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean);
    }
    if (value && typeof value === 'object') {
      // Common AI / backend wrapper shapes
      const maybeItems = (value as any).items ?? (value as any).list ?? (value as any).values;
      if (Array.isArray(maybeItems) || typeof maybeItems === 'string') {
        return normalizeStringList(maybeItems);
      }
      const maybeText = (value as any).text;
      if (typeof maybeText === 'string') {
        return normalizeStringList(maybeText);
      }
    }
    return [];
  };

  // ==========================================
  // STATE
  // ==========================================

  // Core state
  const [initiative, setInitiative] = useState<any | null>(null);
  const [initiativeTemplate, setInitiativeTemplate] = useState<any | null>(null);
  const [sectionTypes, setSectionTypes] = useState<SectionTypeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string>('');
  const titleInputId = 'initiative-title-input';

  // Related data
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  // Editable fields
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  // Problem definition fields (structured)
  const [symptomDraft, setSymptomDraft] = useState('');
  const [rootCauseDraft, setRootCauseDraft] = useState('');
  const [costOfInactionDraft, setCostOfInactionDraft] = useState('');
  const [marketContextDraft, setMarketContextDraft] = useState('');
  // Target state description
  const [targetDescriptionDraft, setTargetDescriptionDraft] = useState('');
  // Success criteria fields (checklist-style)
  const [targetStateItems, setTargetStateItems] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);
  const [successCriteriaItems, setSuccessCriteriaItems] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);
  const [deliverableItems, setDeliverableItems] = useState<
    { id: string; text: string; done: boolean }[]
  >([]);
  // Scope & boundaries fields
  const [inScopeItems, setInScopeItems] = useState<string[]>([]);
  const [outScopeItems, setOutScopeItems] = useState<string[]>([]);
  const [killCriteriaItems, setKillCriteriaItems] = useState<string[]>([]);
  const [localKpis, setLocalKpis] = useState<
    Array<{
      id: string;
      name: string;
      category?: string;
      unit: string;
      baseline: string;
      target: string;
      current: string;
    }>
  >([]);
  const [showCreateKpi, setShowCreateKpi] = useState(false);
  const [kpiMenuId, setKpiMenuId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editKpiName, setEditKpiName] = useState('');
  const [editKpiUnit, setEditKpiUnit] = useState('');
  const [editKpiBaseline, setEditKpiBaseline] = useState('');
  const [editKpiCurrent, setEditKpiCurrent] = useState('');
  const [editKpiTarget, setEditKpiTarget] = useState('');
  const [resourceItems, setResourceItems] = useState<
    Array<{ id: string; name: string; role: string; allocation: number }>
  >([]);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [resourceTools, setResourceTools] = useState<string[]>([]);
  const [showCreateResource, setShowCreateResource] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceRole, setNewResourceRole] = useState('');
  const [newResourceAllocation, setNewResourceAllocation] = useState('50');
  const [newResourceTool, setNewResourceTool] = useState('');
  // Resources: Team/FTE, Budget Items, Tools (persisted via API)
  const [apiResourceItems, setApiResourceItems] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      userId?: string;
      name: string;
      role: string;
      allocationPercentage: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [apiBudgetItems, setApiBudgetItems] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      category: string;
      costType: 'CAPEX' | 'OPEX';
      amount: number;
      currency: string;
      description?: string;
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [apiToolItems, setApiToolItems] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      name: string;
      category: string;
      vendor?: string;
      licenseCost: number;
      licenseType: string;
      status: string;
      notes?: string;
      costType?: 'CAPEX' | 'OPEX';
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [apiIntangibleAssets, setApiIntangibleAssets] = useState<
    Array<{
      id: string;
      initiativeId?: string;
      assetType: string;
      name: string;
      provider?: string;
      cost: number;
      currency: string;
      validFrom?: string;
      validUntil?: string;
      status: string;
      beneficiaries?: string;
      notes?: string;
      costType?: 'CAPEX' | 'OPEX';
      source?: 'manual' | 'ai';
    }>
  >([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [reminders, setReminders] = useState<ReminderRuleWithDelivery[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRuleWithConfig[]>([]);
  const [thresholds, setThresholds] = useState<WarningThresholds>({
    warningDays: 3,
    criticalDays: 1,
    showOverdueAlert: true,
  });
  const [users, setUsers] = useState<UserInfo[]>([]);

  // Control fields
  const [priority, setPriority] = useState<string>('medium');
  const [ownerId, setOwnerId] = useState('');
  const [sponsorId, setSponsorId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Timeline milestones & phases
  const [timelineMilestones, setTimelineMilestones] = useState<
    import('./sections/types').TimelineMilestone[]
  >([]);
  const [timelinePhases, setTimelinePhases] = useState<import('./sections/types').TimelinePhase[]>(
    []
  );
  const [estimatedDurationMonths, setEstimatedDurationMonths] = useState<number | null>(null);

  // Presentation mode (N/C) — shared hook with URL sync and localStorage persistence
  const { mode: presentationMode, setMode: setPresentationMode } = usePresentationMode({
    entityType: 'initiative',
    syncURL: true,
  });

  // C-mode layout variant (cards = accordion grid, scroll = single column)
  const cModeLayout = 'cards' as const;
  const [showAssessmentPanel, setShowAssessmentPanel] = useState(false);
  const [activeNSection, setActiveNSection] = useState<string>('initiative-definition');
  const [nModeSectionOrder, setNModeSectionOrder] = useState<string[] | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isGeneratingAI, setIsGeneratingAI] = useState<string | null>(null);

  // N-mode comment state (for CommentsCanvas — identical to Task)
  const [nCommentDraft, setNCommentDraft] = useState('');
  const [nCommentPriority, setNCommentPriority] = useState<CommentPriority>('normal');
  const [nCommentDateFilter, setNCommentDateFilter] = useState<DateFilter>('all');
  const [nCommentSortOrder, setNCommentSortOrder] = useState<SortOrder>('desc');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateDecision, setShowCreateDecision] = useState(false);
  const [showCreateRaid, setShowCreateRaid] = useState(false);
  const [tasksAiRequest, setTasksAiRequest] = useState<{
    mode: 'analyze' | 'addOne';
    nonce: number;
  } | null>(null);
  const [decisionsAiRequest, setDecisionsAiRequest] = useState<{
    mode: 'analyze' | 'addOne';
    nonce: number;
  } | null>(null);
  const [raidAiRequest, setRaidAiRequest] = useState<{ nonce: number } | null>(null);
  const [resourcesAiRequest, setResourcesAiRequest] = useState<{ nonce: number } | null>(null);
  const [timelineAiRequest, setTimelineAiRequest] = useState<{ nonce: number } | null>(null);
  const [dependenciesAiRequest, setDependenciesAiRequest] = useState<{ nonce: number } | null>(
    null
  );
  const [teamAiRequest, setTeamAiRequest] = useState<{ nonce: number } | null>(null);
  const [commentsAiRequest, setCommentsAiRequest] = useState<{ nonce: number } | null>(null);
  const [gatesAiRequest, setGatesAiRequest] = useState<{ nonce: number } | null>(null);
  const [kpisAiRequest, setKpisAiRequest] = useState<{ nonce: number } | null>(null);
  const [targetStateAiRequest, setTargetStateAiRequest] = useState<{ nonce: number } | null>(null);

  // RAID AI proposal (analyze → suggestions → apply)
  const [isRaidAIProposing, setIsRaidAIProposing] = useState(false);
  const [showRaidAIModal, setShowRaidAIModal] = useState(false);
  const [raidAiNoSuggestionsMessage, setRaidAiNoSuggestionsMessage] = useState<string | null>(null);
  const [raidAiProposal, setRaidAiProposal] = useState<{
    add: Array<{
      type: 'risk' | 'assumption' | 'issue' | 'dependency';
      title: string;
      description?: string;
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      rationale?: string;
    }>;
    remove: Array<{ raidId: string; reason: string }>;
  } | null>(null);
  const [raidAiSelectedAddIdx, setRaidAiSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [raidAiSelectedRemoveIds, setRaidAiSelectedRemoveIds] = useState<Record<string, boolean>>(
    {}
  );

  // Comments AI proposal (analyze → suggestions → apply)
  const [isCommentsAIProposing, setIsCommentsAIProposing] = useState(false);
  const [showCommentsAIModal, setShowCommentsAIModal] = useState(false);
  const [commentsAiProposal, setCommentsAiProposal] = useState<{
    add: Array<{ content: string; rationale?: string }>;
    remove: Array<{ commentId: string; reason: string }>;
    note?: string;
  } | null>(null);
  const [commentsAiSelectedAddIdx, setCommentsAiSelectedAddIdx] = useState<Record<number, boolean>>(
    {}
  );
  const [commentsAiSelectedRemoveIds, setCommentsAiSelectedRemoveIds] = useState<
    Record<string, boolean>
  >({});

  // V4-IDEA-09: LinkGraph "Used in" backlinks
  const [initiativeBacklinks, setInitiativeBacklinks] = useState<
    Array<{ id: string; sourceType: string; sourceId: string }>
  >([]);
  const [initiativeBacklinksLoading, setInitiativeBacklinksLoading] = useState(false);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showPhaseDropdown, setShowPhaseDropdown] = useState(false);
  const [showApprovalWorkflow, setShowApprovalWorkflow] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [gateRoles, setGateRoles] = useState<GateRoleAssignment[]>([]);
  const [userGateRoles, setUserGateRoles] = useState<string[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [gateReadiness, setGateReadiness] = useState<GateReadinessCheck | null>(null);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskIsMilestone, setNewTaskIsMilestone] = useState(false);
  const [newTaskMilestoneDate, setNewTaskMilestoneDate] = useState('');
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionType, setNewDecisionType] = useState('GOVERNANCE_DECISION_MAKING');
  const [newRaidTitle, setNewRaidTitle] = useState('');
  const [newRaidType, setNewRaidType] = useState<'risk' | 'issue' | 'assumption' | 'dependency'>(
    'risk'
  );
  const [newRaidSeverity, setNewRaidSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>(
    'MEDIUM'
  );
  const [newRaidDescription, setNewRaidDescription] = useState('');

  const currentUserId = currentUser?.id || 'current-user';
  const nModeOrderStorageKey = `initiative:nmode:section-order:v2:${initiativeId}`;
  const initiativeDefinitionDraftStorageKey = `consultify-initiative-definition-draft:v1:${initiativeId}`;
  const definitionDraftRestoredRef = useRef(false);
  const decodeHtmlEntities = useCallback((value: string): string => {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }, []);

  const requestTasksAi = useCallback((mode: 'analyze' | 'addOne') => {
    setTasksAiRequest({ mode, nonce: Date.now() });
  }, []);
  const clearTasksAiRequest = useCallback(() => setTasksAiRequest(null), []);

  const requestDecisionsAi = useCallback((mode: 'analyze' | 'addOne') => {
    setDecisionsAiRequest({ mode, nonce: Date.now() });
  }, []);
  const clearDecisionsAiRequest = useCallback(() => setDecisionsAiRequest(null), []);

  const requestRaidAi = useCallback(() => {
    setRaidAiRequest({ nonce: Date.now() });
  }, []);
  const clearRaidAiRequest = useCallback(() => setRaidAiRequest(null), []);

  const requestResourcesAi = useCallback(() => {
    setResourcesAiRequest({ nonce: Date.now() });
  }, []);
  const clearResourcesAiRequest = useCallback(() => setResourcesAiRequest(null), []);

  const requestTimelineAi = useCallback(() => {
    setTimelineAiRequest({ nonce: Date.now() });
  }, []);
  const clearTimelineAiRequest = useCallback(() => setTimelineAiRequest(null), []);

  const requestDependenciesAi = useCallback(() => {
    setDependenciesAiRequest({ nonce: Date.now() });
  }, []);
  const clearDependenciesAiRequest = useCallback(() => setDependenciesAiRequest(null), []);

  const requestTeamAi = useCallback(() => {
    setTeamAiRequest({ nonce: Date.now() });
  }, []);
  const clearTeamAiRequest = useCallback(() => setTeamAiRequest(null), []);

  const requestCommentsAi = useCallback(() => {
    setCommentsAiRequest({ nonce: Date.now() });
  }, []);
  const clearCommentsAiRequest = useCallback(() => setCommentsAiRequest(null), []);

  const requestGatesAi = useCallback(() => {
    setGatesAiRequest({ nonce: Date.now() });
  }, []);
  const clearGatesAiRequest = useCallback(() => setGatesAiRequest(null), []);

  const requestKpisAi = useCallback(() => {
    setKpisAiRequest({ nonce: Date.now() });
  }, []);
  const clearKpisAiRequest = useCallback(() => setKpisAiRequest(null), []);

  const requestTargetStateAi = useCallback(() => {
    setTargetStateAiRequest({ nonce: Date.now() });
  }, []);
  const clearTargetStateAiRequest = useCallback(() => setTargetStateAiRequest(null), []);

  // ==========================================
  // RAID AI (proposal flow like Tasks/Decisions)
  // ==========================================

  const closeRaidAIModal = useCallback(() => {
    setShowRaidAIModal(false);
    setRaidAiProposal(null);
    setRaidAiSelectedAddIdx({});
    setRaidAiSelectedRemoveIds({});
    setRaidAiNoSuggestionsMessage(null);
  }, []);

  const parseAIJson = useCallback((raw: string): any | null => {
    const text = String(raw || '').trim();
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenced?.[1] || text).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      const start = candidate.indexOf('{');
      const end = candidate.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  const normalizeRaidType = useCallback(
    (value: any): 'risk' | 'assumption' | 'issue' | 'dependency' => {
      const t = String(value || '')
        .trim()
        .toLowerCase();
      if (t === 'risk' || t === 'risks') return 'risk';
      if (t === 'assumption' || t === 'assumptions') return 'assumption';
      if (t === 'issue' || t === 'issues') return 'issue';
      if (t === 'dependency' || t === 'dependencies') return 'dependency';
      return 'risk';
    },
    []
  );

  const normalizeSeverity = useCallback((value: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    const s = String(value || '')
      .trim()
      .toUpperCase();
    if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'CRITICAL') return s;
    return 'MEDIUM';
  }, []);

  const buildRaidRemovalCandidates = useCallback(() => {
    const candidates: Array<{ raidId: string; title: string; type: string; why: string }> = [];
    const seen = new Map<string, string>(); // normTitle -> firstId

    const normalizeTitle = (title: string) =>
      String(title || '')
        .trim()
        .toLowerCase()
        .replace(/\s+—\s+.+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim();

    const junkPatterns: Array<{ re: RegExp; why: string }> = [
      { re: /\b(test|demo|dummy)\b/i, why: 'Test/demo placeholder — not a real RAID entry.' },
      { re: /\b(wip|tmp|temp)\b/i, why: 'Temporary/WIP placeholder — not a real RAID entry.' },
      { re: /^test[-_\s]*raid/i, why: 'Test placeholder — not a real RAID entry.' },
    ];

    const tooShort = (s: string) => String(s || '').trim().length < 6;
    const looksLikeGarbage = (s: string) =>
      /^\?+$/.test(s.trim()) || /^[\d\W_]+$/.test(s.trim()) || /^(new item|item|raid)$/i.test(s);

    for (const r of raidItems || []) {
      const id = String((r as any)?.id || '');
      const title = String((r as any)?.title || '').trim();
      const type = String((r as any)?.type || '').trim();
      const norm = normalizeTitle(title);

      if (!id) continue;

      if (!title) {
        candidates.push({
          raidId: id,
          title: '(empty title)',
          type,
          why: 'Empty title — invalid.',
        });
        continue;
      }

      if (tooShort(title) || looksLikeGarbage(title)) {
        candidates.push({
          raidId: id,
          title,
          type,
          why: 'Placeholder/garbage title — low quality.',
        });
      }

      for (const p of junkPatterns) {
        if (p.re.test(title)) {
          candidates.push({ raidId: id, title, type, why: p.why });
          break;
        }
      }

      if (norm) {
        const first = seen.get(`${type}:${norm}`);
        if (!first) {
          seen.set(`${type}:${norm}`, id);
        } else if (first !== id) {
          candidates.push({
            raidId: id,
            title,
            type,
            why: 'Duplicate (same type + same intent/title).',
          });
        }
      }
    }

    // De-dupe by raidId, keep first reason.
    const byId = new Map<string, (typeof candidates)[number]>();
    for (const c of candidates) {
      if (!byId.has(c.raidId)) byId.set(c.raidId, c);
    }
    return Array.from(byId.values()).slice(0, 25);
  }, [raidItems]);

  const proposeRaidWithAI = useCallback(async () => {
    setIsRaidAIProposing(true);
    setRaidAiNoSuggestionsMessage(null);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';
      const existingIds = new Set((raidItems || []).map((r: any) => String(r?.id || '')));
      const removalCandidates = buildRaidRemovalCandidates();

      const existingRaidCompact = (raidItems || []).slice(0, 80).map((r: any) => ({
        id: String(r?.id || ''),
        type: String(r?.type || ''),
        title: String(r?.title || ''),
        severity: String(r?.severity || r?.impact || ''),
        status: String(r?.status || ''),
      }));

      const existingTasksCompact = (tasks || []).slice(0, 25).map((t: any) => ({
        id: String(t?.id || ''),
        title: String(t?.title || ''),
        status: String(t?.status || ''),
      }));

      const existingDecisionsCompact = (decisions || []).slice(0, 25).map((d: any) => ({
        id: String(d?.id || ''),
        title: String(d?.title || ''),
        status: String(d?.status || ''),
        type: String(d?.type || ''),
      }));

      const systemInstruction = [
        `You are a senior PMO risk and governance lead.`,
        `Your goal is to propose a lean, high-signal RAID log for an initiative.`,
        `Rules:`,
        `- RAID types: risk, assumption, issue, dependency.`,
        `- Keep the log lean: prefer fewer, higher-quality entries.`,
        `- Titles must be concrete and specific (no placeholders).`,
        `- Do NOT invent facts, systems, vendors, budgets, dates, owners, or KPIs not present in context.`,
        `- Use severity as a rough impact indicator: LOW | MEDIUM | HIGH | CRITICAL.`,
        `- Removal suggestions should focus on placeholders/tests/duplicates/low-quality entries.`,
        `- If REMOVAL CANDIDATES are provided, you MUST choose removals from them only (unless you explicitly justify keeping them by returning empty "remove").`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `IMPORTANT: For "remove", you MUST use existing raidId values only (prefer from REMOVAL CANDIDATES). Never fabricate ids.`,
        `Schema:`,
        `{`,
        `  "add": [ { "type": "risk|assumption|issue|dependency", "title": string, "description"?: string, "severity"?: "LOW|MEDIUM|HIGH|CRITICAL", "rationale"?: string } ],`,
        `  "remove": [ { "raidId": string, "reason": string } ]`,
        `}`,
        ``,
        `Mode: review. Return 0–8 items in "add" (only missing/high-value). Return 0–6 items in "remove" (only clearly low-quality/duplicate/placeholder). It is OK to return no changes (both arrays empty) if the RAID log is already good.`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || initiative?.title || ''}`,
        `Status: ${initiative?.status || ''}`,
        `Priority: ${initiative?.priority || ''}`,
        `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
        ``,
        `[TASKS SNAPSHOT]`,
        JSON.stringify(existingTasksCompact, null, 2),
        ``,
        `[DECISIONS SNAPSHOT]`,
        JSON.stringify(existingDecisionsCompact, null, 2),
        ``,
        `[EXISTING RAID]`,
        JSON.stringify(existingRaidCompact, null, 2),
        ``,
        `[REMOVAL CANDIDATES]`,
        `These are flagged by deterministic quality rules. Prefer removing these if they are truly not real RAID entries:`,
        JSON.stringify(removalCandidates, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative RAID review',
        artifactContext: {
          title: initiative?.name || initiative?.title || '',
          status: initiative?.status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String((aiRes as any)?.text || (aiRes as any)?.content || ''));
      const proposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
      } as NonNullable<typeof raidAiProposal>;

      proposal.add = proposal.add
        .map((x: any) => ({
          type: normalizeRaidType(x?.type),
          title: String(x?.title || '').trim(),
          description: x?.description ? String(x.description).trim() : '',
          severity: x?.severity ? normalizeSeverity(x.severity) : undefined,
          rationale: x?.rationale ? String(x.rationale).trim() : '',
        }))
        .filter((x) => x.title.length > 0)
        .slice(0, 20);

      proposal.remove = proposal.remove
        .map((x: any) => ({
          raidId: String(x?.raidId || '').trim(),
          reason: String(x?.reason || '').trim(),
        }))
        .filter((x) => x.raidId.length > 0 && x.reason.length > 0 && existingIds.has(x.raidId))
        .slice(0, 12);

      if (proposal.add.length === 0 && proposal.remove.length === 0) {
        setRaidAiNoSuggestionsMessage(
          isPolish
            ? 'AI nie znalazło sugestii zmian — RAID wygląda OK.'
            : 'AI found no change suggestions — the RAID log looks good.'
        );
      }

      setRaidAiProposal(proposal);
      setRaidAiSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_, idx) => [idx, true])) as Record<number, boolean>
      );
      setRaidAiSelectedRemoveIds(
        Object.fromEntries(proposal.remove.map((r) => [r.raidId, false])) as Record<string, boolean>
      );
      setShowRaidAIModal(true);
    } catch (e: any) {
      toast.error(
        e?.message || (isPolish ? 'Nie udało się przeanalizować RAID' : 'Failed to analyze RAID')
      );
    } finally {
      setIsRaidAIProposing(false);
    }
  }, [
    buildRaidRemovalCandidates,
    decisions,
    initiative,
    isPolish,
    normalizeRaidType,
    normalizeSeverity,
    parseAIJson,
    raidItems,
    tasks,
  ]);

  const applyRaidAIProposal = useCallback(async () => {
    if (!raidAiProposal) return;
    if (!initiativeId) return;

    const toAdd = raidAiProposal.add.filter((_, idx) => !!raidAiSelectedAddIdx[idx]);
    const toRemove = raidAiProposal.remove.filter((r) => !!raidAiSelectedRemoveIds[r.raidId]);

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast(isPolish ? 'Brak wybranych zmian' : 'No selected changes');
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        isPolish
          ? `Usunąć ${toRemove.length} element(ów) RAID? To działanie jest nieodwracalne.`
          : `Delete ${toRemove.length} RAID item(s)? This action cannot be undone.`
      );
      if (!ok) return;
    }

    setIsRaidAIProposing(true);
    try {
      // Add first (non-destructive), then remove.
      for (const x of toAdd) {
        const typeUpper = String(x.type || 'risk').toUpperCase();
        const res: any = await Api.post(`/initiatives/${initiativeId}/raid`, {
          type: typeUpper,
          title: x.title,
          description: x.description || x.rationale || '',
          severity: x.severity || 'MEDIUM',
        });

        const id = String(res?.id || res?.raidId || res?.item?.id || '');
        if (id) {
          setRaidItems((prev) => [
            ...prev,
            {
              id,
              initiativeId,
              type: x.type,
              title: x.title,
              description: x.description || x.rationale || '',
              status: 'OPEN',
              severity: x.severity || 'MEDIUM',
              ownerId: null,
              dueDate: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any,
          ]);
        }
      }

      for (const r of toRemove) {
        const id = r.raidId;
        setRaidItems((prev) => prev.filter((item: any) => String(item?.id) !== String(id)));
        try {
          await Api.delete(`/initiatives/${initiativeId}/raid/${id}`);
        } catch {
          // best-effort
        }
      }

      // Refresh RAID list (server is source of truth)
      try {
        const refreshed = await Api.get(`/initiatives/${initiativeId}/raid`);
        setRaidItems(
          refreshed?.items || refreshed?.raid || (Array.isArray(refreshed) ? refreshed : [])
        );
      } catch {
        // best-effort
      }

      toast.success(isPolish ? 'Zastosowano sugestie AI' : 'Applied AI suggestions');
      closeRaidAIModal();
    } catch (e: any) {
      toast.error(
        e?.message ||
          (isPolish ? 'Nie udało się zastosować sugestii' : 'Failed to apply suggestions')
      );
    } finally {
      setIsRaidAIProposing(false);
    }
  }, [
    closeRaidAIModal,
    initiativeId,
    isPolish,
    raidAiProposal,
    raidAiSelectedAddIdx,
    raidAiSelectedRemoveIds,
    setRaidItems,
  ]);

  useEffect(() => {
    if (!raidAiRequest) return;
    const run = async () => {
      try {
        await proposeRaidWithAI();
      } finally {
        clearRaidAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raidAiRequest?.nonce]);

  // ==========================================
  // COMPUTED VALUES
  // ==========================================

  const rawStatus = String(initiative?.status || InitiativeStatus.DRAFT).toUpperCase();
  const status = (
    (Object.values(InitiativeStatus) as string[]).includes(rawStatus)
      ? rawStatus
      : InitiativeStatus.DRAFT
  ) as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  // Status actions are driven by backend `gate-readiness-check` (source of truth).
  const statusActions = useMemo(() => {
    const transitions = gateReadiness?.availableTransitions || [];
    if (!transitions || transitions.length === 0) return [];

    const byTarget = new Map<string, any>();
    transitions.forEach((t: any) => byTarget.set(String(t.targetStatus).toUpperCase(), t));

    return getStatusActions(status)
      .map((a) => {
        const tr = byTarget.get(String(a.targetStatus).toUpperCase());
        if (!tr || !tr.canCurrentUserExecute) return null;
        return { ...a, gate: tr.gate || null, requiredRoles: tr.requiredRoles || [] };
      })
      .filter(Boolean) as any[];
  }, [status, gateReadiness]);
  const primaryActions = statusActions.filter((a) => a.variant === 'primary').slice(0, 2);
  const contextActions = useMemo(() => {
    return gateReadiness?.capabilities?.ctaBar?.contextCreateActions || [];
  }, [gateReadiness]);
  const currentModule = getModuleFromStatus(status);
  const moduleConfig = MODULE_CONFIG[currentModule];

  const topBarCaps = gateReadiness?.capabilities?.topBar;
  const canEditPriority = !!topBarCaps?.canEditPriority;
  const canEditOwner = !!topBarCaps?.canEditOwner;
  const canEditTargetDate = !!topBarCaps?.canEditTargetDate;
  const canEditCards = !!gateReadiness?.capabilities?.cards?.canEditCards;
  const canUseAi = !!gateReadiness?.capabilities?.ctaBar?.canUseAi;

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openSection = useCallback(
    (sectionId: string) => {
      if (!sectionId) return;
      // Ensure expanded in D-mode (accordion).
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(sectionId);
        return next;
      });
      // Switch active section in N-mode (left nav).
      const nModeMap: Record<string, string> = {
        overview: 'initiative-definition',
        problemDefinition: 'initiative-definition',
        targetState: 'target-state-scope',
        scope: 'target-state-scope',
        raid: 'risk-raid',
        kpis: 'kpi',
        history: 'activity-log',
        attachments: 'attachments-links',
        linkedItems: 'attachments-links',
      };
      const mappedN = nModeMap[sectionId] || sectionId;
      setActiveNSection(mappedN);
    },
    [setActiveNSection]
  );

  const focusTopBarField = useCallback(
    (field: 'title' | 'priority' | 'owner' | 'targetDate') => {
      const ids: Record<typeof field, string> = {
        title: titleInputId,
        priority: 'initiative-topbar-priority',
        owner: 'initiative-topbar-owner',
        targetDate: 'initiative-topbar-targetDate',
      };
      const id = ids[field];
      // Scroll to top so header/strip is visible.
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // ignore
      }
      // Focus after a tick to allow layout updates.
      window.setTimeout(() => {
        const el = document.getElementById(id) as any;
        if (el && typeof el.focus === 'function') {
          el.focus();
        }
      }, 50);
    },
    [titleInputId]
  );

  useEffect(() => {
    if (!kpiMenuId) return;
    const onDocClick = () => setKpiMenuId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [kpiMenuId]);

  const startEditKpi = useCallback(
    (kpi: {
      id: string;
      name: string;
      unit: string;
      baseline: string;
      current: string;
      target: string;
    }) => {
      setEditingKpiId(kpi.id);
      setEditKpiName(kpi.name || '');
      setEditKpiUnit(kpi.unit || '');
      setEditKpiBaseline(kpi.baseline || '');
      setEditKpiCurrent(kpi.current || '');
      setEditKpiTarget(kpi.target || '');
    },
    []
  );

  const cancelEditKpi = useCallback(() => {
    setEditingKpiId(null);
    setEditKpiName('');
    setEditKpiUnit('');
    setEditKpiBaseline('');
    setEditKpiCurrent('');
    setEditKpiTarget('');
  }, []);

  const saveEditKpi = useCallback(() => {
    if (!editingKpiId || !editKpiName.trim() || !editKpiUnit.trim()) return;
    setLocalKpis((prev) =>
      prev.map((k) =>
        k.id === editingKpiId
          ? {
              ...k,
              name: editKpiName.trim(),
              unit: editKpiUnit.trim(),
              baseline: editKpiBaseline.trim(),
              current: editKpiCurrent.trim(),
              target: editKpiTarget.trim(),
            }
          : k
      )
    );
    toast.success(isPolish ? 'KPI zaktualizowane' : 'KPI updated');
    cancelEditKpi();
  }, [
    cancelEditKpi,
    editKpiBaseline,
    editKpiCurrent,
    editKpiName,
    editKpiTarget,
    editKpiUnit,
    editingKpiId,
    isPolish,
  ]);

  const duplicateKpi = useCallback(
    async (kpi: {
      name: string;
      unit: string;
      baseline: string;
      target: string;
      category?: string;
    }) => {
      if (!initiativeId) return;
      setIsMutating(true);
      try {
        const baselineValue = toKpiNumber(kpi.baseline);
        const targetValue = toKpiNumber(kpi.target);
        const res = await Api.post(`/initiatives/${initiativeId}/kpis`, {
          name: `${kpi.name} (${isPolish ? 'kopia' : 'copy'})`,
          category: String(kpi.category || 'benefits'),
          unit: kpi.unit || '%',
          description: null,
          baselineValue,
          targetValue,
          measurementFrequency: 'monthly',
        });

        const created = res?.kpi || {};
        setLocalKpis((prev) => [
          {
            id: String(created.id || `kpi-${Date.now()}`),
            name: String(created.name || `${kpi.name} (${isPolish ? 'kopia' : 'copy'})`),
            category: String(created.category || 'benefits'),
            unit: String(created.unit || kpi.unit || '%'),
            baseline: String(created.baselineValue ?? baselineValue),
            target: String(created.targetValue ?? targetValue),
            current: String(created.currentValue ?? baselineValue),
          },
          ...prev,
        ]);
        toast.success(isPolish ? 'KPI zduplikowane' : 'KPI duplicated');
      } catch (e: any) {
        toast.error(
          e?.message || (isPolish ? 'Nie udało się zduplikować KPI' : 'Failed to duplicate KPI')
        );
      } finally {
        setIsMutating(false);
      }
    },
    [initiativeId, isPolish]
  );

  const removeKpi = useCallback(
    (kpiId: string) => {
      setLocalKpis((prev) => prev.filter((k) => k.id !== kpiId));
      if (editingKpiId === kpiId) cancelEditKpi();
      toast.success(isPolish ? 'KPI usunięte' : 'KPI removed');
    },
    [cancelEditKpi, editingKpiId, isPolish]
  );

  const tasksDone = useMemo(
    () => tasks.filter((t) => t.status === 'done' || t.status === 'DONE').length,
    [tasks]
  );
  const tasksInProgress = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress' || t.status === 'IN_PROGRESS').length,
    [tasks]
  );
  const milestones = useMemo(() => tasks.filter((t) => t.isMilestone), [tasks]);
  const riskCount = useMemo(() => raidItems.filter((r) => r.type === 'risk').length, [raidItems]);
  const issueCount = useMemo(() => raidItems.filter((r) => r.type === 'issue').length, [raidItems]);
  const criticalRaids = useMemo(
    () => raidItems.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH').length,
    [raidItems]
  );
  const ownerName = useMemo(() => {
    const user = users.find((u) => u.id === ownerId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  }, [users, ownerId]);
  const sponsorName = useMemo(() => {
    const user = users.find((u) => u.id === sponsorId);
    return user ? `${user.firstName} ${user.lastName}` : '';
  }, [users, sponsorId]);

  const isWatching = useMemo(
    () => watchers.some((w) => w.userId === currentUserId),
    [watchers, currentUserId]
  );

  const requiredGates = useMemo(
    () => GATE_DEFINITIONS.filter((g) => g.forStatus === status),
    [status]
  );
  const pendingGates = useMemo(
    () =>
      requiredGates.filter((g) => {
        const match = decisions.find((d) => d.type === g.pmoDomain);
        return !match || match.status === 'PENDING';
      }),
    [requiredGates, decisions]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(nModeOrderStorageKey);
      if (!raw) {
        setNModeSectionOrder(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (id): id is string => typeof id === 'string' && id.length > 0
        );
        setNModeSectionOrder(cleaned.length > 0 ? cleaned : null);
      } else {
        setNModeSectionOrder(null);
      }
    } catch {
      setNModeSectionOrder(null);
    }
  }, [nModeOrderStorageKey]);

  const handleNModeSectionReorder = useCallback(
    (sectionIds: string[]) => {
      setNModeSectionOrder(sectionIds);
      try {
        localStorage.setItem(nModeOrderStorageKey, JSON.stringify(sectionIds));
      } catch {
        // Ignore storage errors; drag-and-drop still works for this session.
      }
    },
    [nModeOrderStorageKey]
  );

  // ==========================================
  // VISIBLE SECTIONS (template-driven)
  // ==========================================

  const visibleSections = useMemo(() => {
    const templateVS =
      initiativeTemplate?.visibleSections || initiativeTemplate?.visible_sections || {};
    const hasExplicitTemplateVisibility =
      templateVS && typeof templateVS === 'object' && Object.keys(templateVS).length > 0;
    // If template defines visibility explicitly, treat it as source-of-truth.
    // Otherwise keep legacy "show defaults" behavior.
    if (hasExplicitTemplateVisibility) return templateVS;
    return { ...DEFAULT_VISIBLE_SECTIONS };
  }, [initiativeTemplate]);

  const sectionOrder = useMemo(() => {
    const templateOrder =
      initiativeTemplate?.sectionOrder || initiativeTemplate?.section_order || {};
    return { ...DEFAULT_SECTION_ORDER, ...templateOrder };
  }, [initiativeTemplate]);

  // Resolve which sections to render, split by column
  const { leftSections, rightSections } = useMemo(() => {
    // If we have section types from the API, use them; otherwise fall back to defaults
    const resolvedTypes: SectionTypeInfo[] =
      sectionTypes.length > 0
        ? sectionTypes
        : Object.keys(DEFAULT_VISIBLE_SECTIONS).map((key) => ({
            id: `default-${key}`,
            key,
            name: key,
            namePl: null,
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: (DEFAULT_SECTION_ORDER[key] !== undefined &&
            [
              'control',
              'team',
              'initiativeTeam',
              'raciEscalation',
              'resources',
              'stakeholders',
              'dependencies',
              'linkedItems',
              'tags',
              'reminders',
              'watchers',
            ].includes(key)
              ? 'right'
              : 'left') as 'left' | 'right',
            defaultOrder: DEFAULT_SECTION_ORDER[key] || 100,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: key,
            isSystem: true,
            isActive: true,
          }));

    const visible = resolvedTypes.filter((st) => {
      const key = st.key;
      return visibleSections[key] !== false && SECTION_REGISTRY[st.componentKey];
    });

    const left = visible
      .filter((st) => st.columnPosition === 'left')
      .sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      );

    const right = visible
      .filter((st) => st.columnPosition === 'right')
      .sort(
        (a, b) => (sectionOrder[a.key] ?? a.defaultOrder) - (sectionOrder[b.key] ?? b.defaultOrder)
      );

    return { leftSections: left, rightSections: right };
  }, [sectionTypes, visibleSections, sectionOrder]);

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchAll = useCallback(async () => {
    if (!initiativeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const showcaseDetail = isShowcaseInitiativeId(initiativeId)
        ? initiativesDemoData.initiativeDetailsById[initiativeId]
        : null;
      const data =
        showcaseDetail?.initiative ||
        (await V8PlanningApi.getInitiative(initiativeId).catch(() =>
          Api.getInitiativeById(initiativeId)
        ));
      setInitiative(data);
      setInitiativeTemplate(null);
      setTitleDraft(String(data.title || data.name || '').trim());
      setSummary(data.summary || data.description || '');
      setDescription(data.description || '');
      // Sync problem definition fields — try structured object first, then parse JSON string
      let pd: Record<string, string> = {};
      const rawPd =
        data.problemDefinition ||
        data.problem_definition ||
        data.problemStatement ||
        data.problem_statement;
      if (rawPd && typeof rawPd === 'object') {
        pd = rawPd;
      } else if (rawPd && typeof rawPd === 'string') {
        try {
          const parsed = JSON.parse(rawPd);
          if (typeof parsed === 'object' && parsed !== null) {
            pd = parsed;
          }
        } catch {
          // Some payloads are HTML-escaped by sanitization middleware (e.g. &quot;).
          // Decode and try parsing once more.
          try {
            const decoded = decodeHtmlEntities(rawPd);
            const parsedDecoded = JSON.parse(decoded);
            if (typeof parsedDecoded === 'object' && parsedDecoded !== null) {
              pd = parsedDecoded;
            } else {
              pd = { symptom: decoded };
            }
          } catch {
            // Not JSON — treat as plain text problem statement (legacy)
            pd = { symptom: decodeHtmlEntities(rawPd) };
          }
        }
      }
      setSymptomDraft(pd.symptom || '');
      setRootCauseDraft(pd.rootCause || '');
      setCostOfInactionDraft(pd.costOfInaction || '');
      setMarketContextDraft(data.marketContext || data.market_context || '');
      // Sync success criteria fields
      const td = data.targetState || data.target_state || {};
      if (typeof td === 'object' && td !== null) {
        const tsDesc = td.description || '';
        setTargetDescriptionDraft(tsDesc);
        if (tsDesc) {
          const tsLines = tsDesc.split('\n').filter((l: string) => l.trim());
          setTargetStateItems(
            tsLines.length > 0
              ? tsLines.map((t: string, i: number) => ({
                  id: `ts-${i}`,
                  text: t.replace(/^[-•*]\s*/, ''),
                  done: false,
                }))
              : [{ id: 'ts-0', text: tsDesc, done: false }]
          );
        }
        const sc = td.successCriteria || [];
        setSuccessCriteriaItems(
          sc.map((t: string, i: number) => ({ id: `sc-${i}`, text: t, done: false }))
        );
        const dl = td.deliverables || data.deliverables || [];
        setDeliverableItems(
          dl.map((t: string, i: number) => ({ id: `dl-${i}`, text: t, done: false }))
        );
      }
      setTags(data.tags || []);
      // Sync scope & boundaries fields
      const scopeObj = data.scope || {};
      if (typeof scopeObj === 'object' && scopeObj !== null) {
        setInScopeItems(normalizeStringList((scopeObj as any).inScope));
        setOutScopeItems(normalizeStringList((scopeObj as any).outScope));
      } else {
        setInScopeItems([]);
        setOutScopeItems([]);
      }
      setKillCriteriaItems(
        normalizeStringList(
          data.killCriteria ||
            data.kill_criteria ||
            (typeof scopeObj === 'object' && scopeObj !== null
              ? (scopeObj as any).killCriteria
              : [])
        )
      );

      // Restore local draft if user refreshed before autosave persisted to backend.
      // Only restore fields where server values are empty to avoid overwriting saved data.
      if (!definitionDraftRestoredRef.current) {
        try {
          const rawDraft = localStorage.getItem(initiativeDefinitionDraftStorageKey);
          if (rawDraft) {
            const draft = JSON.parse(rawDraft) as {
              symptomDraft?: string;
              rootCauseDraft?: string;
              costOfInactionDraft?: string;
              marketContextDraft?: string;
              inScopeItems?: string[];
              outScopeItems?: string[];
              killCriteriaItems?: string[];
            };

            const serverSymptom = String(pd.symptom || '').trim();
            const serverRoot = String(pd.rootCause || '').trim();
            const serverCost = String(pd.costOfInaction || '').trim();
            const serverMarket = String(data.marketContext || data.market_context || '').trim();
            const serverInScopeRaw =
              typeof scopeObj === 'object' ? (scopeObj as any).inScope || [] : [];
            const serverOutScopeRaw =
              typeof scopeObj === 'object' ? (scopeObj as any).outScope || [] : [];
            const serverKillRaw =
              data.killCriteria ||
              data.kill_criteria ||
              (typeof scopeObj === 'object' ? (scopeObj as any).killCriteria || [] : []);

            const serverInScope = normalizeStringList(serverInScopeRaw);
            const serverOutScope = normalizeStringList(serverOutScopeRaw);
            const serverKill = normalizeStringList(serverKillRaw);

            let restoredAny = false;
            if (!serverSymptom && String(draft.symptomDraft || '').trim()) {
              setSymptomDraft(String(draft.symptomDraft || ''));
              restoredAny = true;
            }
            if (!serverRoot && String(draft.rootCauseDraft || '').trim()) {
              setRootCauseDraft(String(draft.rootCauseDraft || ''));
              restoredAny = true;
            }
            if (!serverCost && String(draft.costOfInactionDraft || '').trim()) {
              setCostOfInactionDraft(String(draft.costOfInactionDraft || ''));
              restoredAny = true;
            }
            if (!serverMarket && String(draft.marketContextDraft || '').trim()) {
              setMarketContextDraft(String(draft.marketContextDraft || ''));
              restoredAny = true;
            }
            if (
              serverInScope.length === 0 &&
              Array.isArray(draft.inScopeItems) &&
              draft.inScopeItems.length > 0
            ) {
              setInScopeItems(draft.inScopeItems);
              restoredAny = true;
            }
            if (
              serverOutScope.length === 0 &&
              Array.isArray(draft.outScopeItems) &&
              draft.outScopeItems.length > 0
            ) {
              setOutScopeItems(draft.outScopeItems);
              restoredAny = true;
            }
            if (
              serverKill.length === 0 &&
              Array.isArray(draft.killCriteriaItems) &&
              draft.killCriteriaItems.length > 0
            ) {
              setKillCriteriaItems(draft.killCriteriaItems);
              restoredAny = true;
            }

            if (restoredAny) {
              definitionDraftRestoredRef.current = true;
              toast.success(isPolish ? 'Przywrócono lokalny szkic' : 'Restored local draft');
            }
          }
        } catch {
          // ignore local draft parse errors
        }
      }

      const rawKpis = Array.isArray(data.kpis)
        ? data.kpis
        : Array.isArray(data.kpi)
          ? data.kpi
          : [];
      setLocalKpis(
        rawKpis.map((k: any, idx: number) => ({
          id: String(k.id || `kpi-${idx}`),
          name: String(k.name || k.title || ''),
          category: String(k.category || 'benefits'),
          unit: String(k.unit || ''),
          baseline: String(k.baselineValue ?? k.baseline ?? ''),
          target: String(k.targetValue ?? k.target ?? ''),
          current: String(k.currentValue ?? k.current ?? ''),
        }))
      );
      const rawResources = Array.isArray(data.resources) ? data.resources : [];
      setResourceItems(
        rawResources.map((r: any, idx: number) => ({
          id: String(r.id || `res-${idx}`),
          name: String(r.name || r.person || r.role || ''),
          role: String(r.role || ''),
          allocation: Number(r.allocation || r.percent || 0),
        }))
      );
      setBudgetDraft(
        String(
          data.estimatedBudget ||
            data.estimated_budget ||
            data.budget ||
            data.budgetEstimate ||
            data.costCapex ||
            data.cost_capex ||
            ''
        )
      );
      const rawTools = Array.isArray(data.resourceTools)
        ? data.resourceTools
        : Array.isArray(data.resource_tools)
          ? data.resource_tools
          : Array.isArray(data.tools)
            ? data.tools
            : Array.isArray(data.toolsNeeded)
              ? data.toolsNeeded
              : [];
      setResourceTools(rawTools.map((t: any) => String(t)));
      const rawPriority = (data.priority || 'medium').toLowerCase();
      setPriority(rawPriority);
      setOwnerId(data.ownerId || data.owner_id || '');
      setSponsorId(data.sponsorId || data.sponsor_id || '');
      setTargetDate(data.plannedEndDate || data.planned_end_date || data.targetDate || '');
      setStartDate(data.plannedStartDate || data.planned_start_date || null);
      setEndDate(data.plannedEndDate || data.planned_end_date || null);

      // Timeline milestones & phases from initiative data
      if (Array.isArray(data.milestones)) {
        setTimelineMilestones(
          data.milestones.map((m: any, idx: number) => ({
            id: m.id || `ms-${idx}`,
            name: m.name || m.title || '',
            date: m.date || m.plannedDate || '',
            actualDate: m.actualDate || undefined,
            status: m.status || 'pending',
            description: m.description || undefined,
          }))
        );
      }
      if (Array.isArray(data.timelinePhases)) {
        setTimelinePhases(data.timelinePhases);
      }
      if (data.estimatedDurationMonths != null) {
        setEstimatedDurationMonths(data.estimatedDurationMonths);
      }

      if (showcaseDetail) {
        setDecisions(showcaseDetail.decisions || []);
        setRaidItems(showcaseDetail.raidItems || []);
        setWatchers(showcaseDetail.watchers || []);
        setHistory(showcaseDetail.history || []);
        setTasks(showcaseDetail.tasks || []);
        setDependencies(showcaseDetail.dependencies || []);
        setStakeholders(showcaseDetail.stakeholders || []);
        setUsers(initiativesDemoData.users || []);
        setPendingApprovals(showcaseDetail.pendingApprovals || []);
        setComments(showcaseDetail.comments || []);
        setGateRoles(showcaseDetail.gateRoles || []);
        setGateReadiness(showcaseDetail.gateReadiness || null);
        setUserGateRoles(showcaseDetail.gateReadiness?.userRoles || []);
        setStatusHistory(showcaseDetail.statusHistory || []);
        setApiResourceItems(showcaseDetail.resources || []);
        setApiBudgetItems(showcaseDetail.budgetItems || []);
        setApiToolItems(showcaseDetail.tools || []);
        setApiIntangibleAssets(showcaseDetail.intangibleAssets || []);
        setAttachments(showcaseDetail.attachments || []);
        setLinkedItems(showcaseDetail.linkedItems || []);
        return;
      }

      // Fetch related data (best-effort, parallel)
      const fetches = [
        Api.get(`/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative`)
          .then((ds: any) => {
            const raw = Array.isArray(ds) ? ds : ds?.decisions || [];
            setDecisions(
              raw.map((d: any) => ({
                id: d.id,
                title: d.title || '',
                description: d.description || undefined,
                type: d.decisionType || d.type || 'GENERAL',
                status: d.status || 'PENDING',
                priority: d.priority || undefined,
                decisionMakerId: d.decisionOwnerId || d.decisionMakerId || undefined,
                ownerName: d.ownerName || undefined,
                requestedByName: d.requestedByName || undefined,
                dueDate: d.dueDate || undefined,
                createdAt: d.createdAt || undefined,
                isOverdue: d.isOverdue || false,
                daysOverdue: d.daysOverdue || 0,
                source: d.source || 'manual',
              }))
            );
          })
          .catch(() => setDecisions([])),
        V8PlanningApi.getRaid(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/raid`))
          .then((r: any) => setRaidItems(r?.items || r?.raid || (Array.isArray(r) ? r : [])))
          .catch(() => setRaidItems([])),
        V8PlanningApi.getWatchers(initiativeId)
          .then((watchers) => setWatchers(Array.isArray(watchers) ? watchers : []))
          .catch(() =>
            Api.get(`/initiatives/${initiativeId}/watchers`).then((w: any) =>
              setWatchers(w?.watchers || (Array.isArray(w) ? w : []))
            )
          )
          .catch(() => setWatchers([])),
        V8PlanningApi.getKpis(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/kpis`))
          .then((res: any) => {
            const rows = Array.isArray(res?.kpis) ? res.kpis : [];
            setLocalKpis(
              rows.map((k: any, idx: number) => ({
                id: String(k.id || `kpi-${idx}`),
                name: String(k.name || ''),
                category: String(k.category || 'benefits'),
                unit: String(k.unit || ''),
                baseline: String(k.baselineValue ?? ''),
                target: String(k.targetValue ?? ''),
                current: String(k.latestValue ?? k.currentValue ?? ''),
              }))
            );
          })
          .catch(() => {
            // keep fallback KPI mapping from initiative payload
          }),
        V8PlanningApi.getHistory(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/history`))
          .then((h: any) => setHistory(h?.events || h?.history || (Array.isArray(h) ? h : [])))
          .catch(() => setHistory([])),
        Api.get(`/tasks?initiativeId=${initiativeId}`)
          .then((ts: any) => {
            const taskList = Array.isArray(ts) ? ts : ts?.tasks || [];
            setTasks(
              taskList.map((t: any) => ({
                id: t.id,
                title: t.title,
                source: t.source || 'manual',
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                taskType: t.taskType,
                estimatedHours: t.estimatedHours,
                assigneeId: t.assigneeId || t.assignee_id,
                assigneeName: t.assigneeName || t.assignee?.name,
                isMilestone: t.isMilestone || false,
                milestoneDate: t.milestoneDate,
              }))
            );
          })
          .catch(() => setTasks([])),
        V8PlanningApi.getTaskDependencies(initiativeId)
          .then((dependencies) => setDependencies(Array.isArray(dependencies) ? dependencies : []))
          .catch(() =>
            Api.get(`/initiatives/${initiativeId}/task-dependencies`).then((d: any) =>
              setDependencies(Array.isArray(d?.dependencies) ? d.dependencies : [])
            )
          )
          .catch(() => setDependencies([])),
        V8PlanningApi.getStakeholders(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/stakeholders`))
          .then((st: any) => {
            const mapped: Stakeholder[] = (st?.stakeholders || (Array.isArray(st) ? st : [])).map(
              (s: any) => {
                const raci =
                  String(s.raciType || s.raci_type || s.raci || s.role || '').toUpperCase() || 'I';
                const role: StakeholderRole =
                  raci === 'R'
                    ? 'responsible'
                    : raci === 'A'
                      ? 'accountable'
                      : raci === 'C'
                        ? 'consulted'
                        : 'informed';
                return {
                  id: s.id,
                  decisionId: initiativeId,
                  userId: s.userId || s.user_id,
                  userName: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
                  userEmail: s.email,
                  role,
                  notificationSettings: {
                    enabled: true,
                    triggers: ['on_status_change'],
                    emailEnabled: true,
                    inAppEnabled: true,
                    integrationChannels: [],
                    syncTargets: [],
                  },
                };
              }
            );
            setStakeholders(mapped);
          })
          .catch(() => setStakeholders([])),
        Api.get('/users')
          .then((u: any) => setUsers(Array.isArray(u) ? u : u?.users || []))
          .catch(() => setUsers([])),
        Api.get(
          `/decisions?relatedObjectId=${initiativeId}&relatedObjectType=initiative&type=GATE_APPROVAL`
        )
          .then((ad: any) => {
            const approvals = (Array.isArray(ad) ? ad : ad?.decisions || [])
              .filter((d: any) => d.status === 'PENDING')
              .map((d: any) => ({
                id: d.id,
                gateType: d.gateType || d.metadata?.gateType || 'UNKNOWN',
                gateName: d.title,
                requiredRole: d.metadata?.requiredRole || 'sponsor',
                status: d.status,
                requestedAt: d.createdAt,
                deciderId: d.deciderId,
                deciderName: d.deciderName || d.decider?.name,
                dueDate: d.dueDate,
              }));
            setPendingApprovals(approvals);
          })
          .catch(() => setPendingApprovals([])),
        V8PlanningApi.getComments(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/comments`))
          .then((c: any) => {
            const rows = Array.isArray(c?.comments) ? c.comments : Array.isArray(c) ? c : [];
            setComments(
              rows.map((x: any) => ({
                id: String(x.id),
                content: String(x.content || ''),
                authorId: String(x.authorId || x.userId || x.user_id || ''),
                authorName: String(x.authorName || x.author_name || ''),
                createdAt: String(x.createdAt || x.created_at || new Date().toISOString()),
                likes: Number.isFinite(Number(x.likes)) ? Number(x.likes) : 0,
                likedByMe: !!x.likedByMe,
              }))
            );
          })
          .catch(() => setComments([])),
        // Gate roles & governance
        V8PlanningApi.getGateRoles(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/gate-roles`))
          .then((gr: any) => {
            const roles: GateRoleAssignment[] = (gr?.roles || []).map((r: any) => ({
              id: r.id,
              initiativeId: r.initiativeId || initiativeId,
              gateRole: r.gateRole,
              userId: r.userId,
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              assignedBy: r.assignedBy,
              assignedAt: r.assignedAt,
              source: r.source || 'explicit',
            }));
            setGateRoles(roles);
          })
          .catch(() => setGateRoles([])),
        V8PlanningApi.getGateReadiness(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/gate-readiness-check`))
          .then((rc: any) => {
            const payload = normalizeGateReadinessPayload(rc);
            setGateReadiness((payload as GateReadinessCheck | null) || null);
            setUserGateRoles(payload?.userRoles || []);
          })
          .catch(() => {
            setGateReadiness(null);
            setUserGateRoles([]);
          }),
        V8PlanningApi.getStatusHistory(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/status-history`))
          .then((sh: any) => setStatusHistory(sh?.history || (Array.isArray(sh) ? sh : [])))
          .catch(() => setStatusHistory([])),
        // Resources: Team / FTE
        V8PlanningApi.getResources(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/resources`))
          .then((r: any) => {
            const rows = Array.isArray(r?.resources) ? r.resources : Array.isArray(r) ? r : [];
            setApiResourceItems(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                userId: item.userId,
                name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || '',
                role: item.role || 'member',
                allocationPercentage: item.allocationPercentage || 100,
                startDate: item.startDate || undefined,
                endDate: item.endDate || undefined,
                notes: item.notes || undefined,
                firstName: item.firstName,
                lastName: item.lastName,
                avatarUrl: item.avatarUrl,
              }))
            );
          })
          .catch(() => setApiResourceItems([])),
        // Resources: Budget Items
        V8PlanningApi.getBudgetItems(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/budget-items`))
          .then((r: any) => {
            const rows = Array.isArray(r?.budgetItems) ? r.budgetItems : [];
            setApiBudgetItems(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                category: item.category || 'other',
                costType: item.costType || 'OPEX',
                amount: item.amount || 0,
                currency: item.currency || 'PLN',
                description: item.description || undefined,
              }))
            );
          })
          .catch(() => setApiBudgetItems([])),
        // Resources: Tools
        V8PlanningApi.getTools(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/tools`))
          .then((r: any) => {
            const rows = Array.isArray(r?.tools) ? r.tools : [];
            setApiToolItems(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                name: item.name || '',
                category: item.category || 'software',
                vendor: item.vendor || undefined,
                licenseCost: item.licenseCost || 0,
                licenseType: item.licenseType || 'subscription',
                status: item.status || 'planned',
                notes: item.notes || undefined,
              }))
            );
          })
          .catch(() => setApiToolItems([])),
        // Resources: Intangible Assets (Licenses, Training, Knowledge)
        V8PlanningApi.getIntangibleAssets(initiativeId)
          .catch(() => Api.get(`/initiatives/${initiativeId}/intangible-assets`))
          .then((r: any) => {
            const rows = Array.isArray(r?.intangibleAssets) ? r.intangibleAssets : [];
            setApiIntangibleAssets(
              rows.map((item: any) => ({
                id: item.id,
                initiativeId: item.initiativeId,
                assetType: item.assetType || 'license',
                name: item.name || '',
                provider: item.provider || undefined,
                cost: item.cost || 0,
                currency: item.currency || 'PLN',
                validFrom: item.validFrom || undefined,
                validUntil: item.validUntil || undefined,
                status: item.status || 'planned',
                beneficiaries: item.beneficiaries || undefined,
                notes: item.notes || undefined,
              }))
            );
          })
          .catch(() => setApiIntangibleAssets([])),
      ];

      await Promise.allSettled(fetches);
    } catch (e: any) {
      setError(e?.message || 'Failed to load initiative');
    } finally {
      setIsLoading(false);
    }
  }, [
    initiativeId,
    decodeHtmlEntities,
    initiativeDefinitionDraftStorageKey,
    initiativesDemoData,
    isPolish,
  ]);

  // Persist local draft continuously so refresh won't lose edits (even before autosave).
  useEffect(() => {
    if (!initiativeId) return;
    try {
      const hasAny =
        !!symptomDraft.trim() ||
        !!rootCauseDraft.trim() ||
        !!costOfInactionDraft.trim() ||
        !!marketContextDraft.trim() ||
        inScopeItems.length > 0 ||
        outScopeItems.length > 0 ||
        killCriteriaItems.length > 0;
      if (!hasAny) {
        localStorage.removeItem(initiativeDefinitionDraftStorageKey);
        return;
      }
      localStorage.setItem(
        initiativeDefinitionDraftStorageKey,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          symptomDraft,
          rootCauseDraft,
          costOfInactionDraft,
          marketContextDraft,
          inScopeItems,
          outScopeItems,
          killCriteriaItems,
        })
      );
    } catch {
      // ignore localStorage errors (private mode / quota)
    }
  }, [
    initiativeId,
    initiativeDefinitionDraftStorageKey,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
  ]);

  // Fetch section types once
  useEffect(() => {
    Api.get('/initiatives/section-types')
      .then((data: any) => {
        if (Array.isArray(data)) setSectionTypes(data);
      })
      .catch(() => {
        // Fall back to default sections if API fails
        setSectionTypes([]);
      });
  }, []);

  // Fetch template when initiative loads
  useEffect(() => {
    const tplId = initiative?.initiativeTemplateId || initiative?.initiative_template_id;
    if (!tplId) {
      setInitiativeTemplate(null);
      return;
    }
    let cancelled = false;
    Api.get(`/initiatives/templates/${encodeURIComponent(String(tplId))}`)
      .then((resp: any) => {
        if (!cancelled) setInitiativeTemplate(resp?.template || null);
      })
      .catch(() => {
        if (!cancelled) setInitiativeTemplate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [initiative?.initiativeTemplateId, initiative?.initiative_template_id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // V4-IDEA-09: Fetch LinkGraph backlinks for "Used in" section
  useEffect(() => {
    if (!initiativeId) return;
    setInitiativeBacklinksLoading(true);
    Api.getLinkGraphBacklinks({ type: 'initiative', id: initiativeId, limit: 50 })
      .then((rows: any) => {
        setInitiativeBacklinks(
          (Array.isArray(rows) ? rows : [])
            .map((x: any) => ({
              id: String(x?.id || ''),
              sourceType: String(x?.sourceType || ''),
              sourceId: String(x?.sourceId || ''),
            }))
            .filter((x) => x.sourceType && x.sourceId)
        );
      })
      .catch(() => setInitiativeBacklinks([]))
      .finally(() => setInitiativeBacklinksLoading(false));
  }, [initiativeId]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleStatusAction = async (action: StatusAction) => {
    // Warn if this transition moves the initiative to a different module
    const targetStatus = action.targetStatus as InitiativeStatus;
    if (willChangeModule(status, targetStatus)) {
      const targetModule = getModuleForStatus(targetStatus);
      const MODULE_NAMES: Record<string, { en: string; pl: string }> = {
        tools: { en: 'Assessment', pl: 'Ocena' },
        assessment: { en: 'Assessment', pl: 'Ocena' },
        initiatives: { en: 'Initiatives', pl: 'Inicjatywy' },
        execution: { en: 'Execution', pl: 'Realizacja' },
        benefits: { en: 'Benefits', pl: 'Korzyści' },
      };
      const moduleName = MODULE_NAMES[targetModule]?.[isPolish ? 'pl' : 'en'] || targetModule;
      const confirmed = window.confirm(
        isPolish
          ? `Ta zmiana przeniesie inicjatywę do modułu "${moduleName}". Kontynuować?`
          : `This change will move the initiative to the "${moduleName}" module. Continue?`
      );
      if (!confirmed) return;
    }

    setIsMutating(true);
    try {
      const { transition, blockingItems } = await getInitiativeStatusPreflightTruth(
        initiativeId,
        action.targetStatus
      );
      if (!transition || !transition.canCurrentUserExecute) {
        toast.error(
          t('initiatives.toast.statusUpdateError', 'Nie udało się zaktualizować statusu')
        );
        return;
      }
      if (blockingItems.length > 0) {
        const list = blockingItems.slice(0, 5).join('\n• ');
        toast.error(
          t(
            'initiatives.toast.gateBlockedHub',
            'Nie można przejść dalej — brakuje elementów blokujących:\n• {{items}}',
            { items: list || t('common.missing', 'Missing required items') }
          ),
          { duration: 6500 }
        );
        return;
      }

      const truth = await updateInitiativeStatusWriteTruth(initiativeId, action.targetStatus);
      setInitiative((prev: any) => ({
        ...prev,
        ...(truth.initiative || {}),
        status: action.targetStatus,
      }));
      setGateReadiness(truth.gateReadiness);
      setStatusHistory(truth.statusHistory as any);
      setHistory(truth.history as any);
      onStatusChange?.(action.targetStatus);
      toast.success(isPolish ? 'Status zaktualizowany' : 'Status updated');
    } catch (e: any) {
      toast.error(
        e?.message ||
          t('initiatives.toast.statusUpdateError', 'Nie udało się zaktualizować statusu')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleWatch = async () => {
    setIsMutating(true);
    try {
      if (isWatching) {
        const myWatch = watchers.find((w) => w.userId === currentUserId);
        if (myWatch) await Api.delete(`/initiatives/${initiativeId}/watchers/${myWatch.id}`);
        setWatchers((prev) => prev.filter((w) => w.userId !== currentUserId));
        toast.success(isPolish ? 'Przestałeś obserwować' : 'Stopped watching');
      } else {
        const res = await Api.post(`/initiatives/${initiativeId}/watchers`, {
          userId: currentUserId,
        });
        setWatchers((prev) => [...prev, res]);
        toast.success(isPolish ? 'Obserwujesz inicjatywę' : 'Now watching');
      }
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.watchError', 'Nie udało się zmienić obserwowania')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleSave = async (silent = false) => {
    setIsMutating(true);
    try {
      // Build structured problem definition as JSON for the problemStatement field
      const problemDefinitionPayload =
        symptomDraft || rootCauseDraft || costOfInactionDraft
          ? JSON.stringify({
              symptom: symptomDraft,
              rootCause: rootCauseDraft,
              costOfInaction: costOfInactionDraft,
            })
          : undefined;

      const normalizedDeliverables = deliverableItems
        .map((d) => String(d.text || '').trim())
        .filter(Boolean);
      const normalizedSuccessCriteria = successCriteriaItems
        .map((c) => String(c.text || '').trim())
        .filter(Boolean);
      const normalizedScopeIn = inScopeItems.map((v) => String(v || '').trim()).filter(Boolean);
      const normalizedScopeOut = outScopeItems.map((v) => String(v || '').trim()).filter(Boolean);
      const normalizedKillCriteria = killCriteriaItems
        .map((v) => String(v || '').trim())
        .filter(Boolean);

      const normalizedPriority = String(priority || '')
        .trim()
        .toLowerCase();
      const normalizedTitle = String(titleDraft || '').trim();

      const updatePayload: Record<string, unknown> = {
        // Core narrative
        summary,
        description, // backend alias → hypothesis
        // Definition / scope
        problemStatement: problemDefinitionPayload,
        marketContext: marketContextDraft || undefined,
        deliverables: normalizedDeliverables,
        successCriteria: normalizedSuccessCriteria,
        scopeIn: normalizedScopeIn,
        scopeOut: normalizedScopeOut,
        killCriteria: normalizedKillCriteria,
        // Financials / tools / tags
        estimatedBudget: budgetDraft ? parseFloat(budgetDraft.replace(/[^0-9.]/g, '')) : undefined,
        resourceTools,
        tags,
        // Target state (stored as JSON)
        targetState: {
          description: targetDescriptionDraft || undefined,
        },
      };

      // Title is edited in the header and saved as `title` (DB column may be title or name).
      // Guarded by canEditCards to avoid editing in read-only contexts.
      if (canEditCards && normalizedTitle) {
        const savedTitle = String(initiative?.title || initiative?.name || '').trim();
        if (normalizedTitle !== savedTitle) {
          updatePayload.title = normalizedTitle;
        }
      }

      // Top-bar fields are permissioned by backend capabilities (gateReadiness).
      // Do NOT send fields the current user cannot edit, otherwise backend rejects the save.
      if (canEditPriority) {
        updatePayload.priority = normalizedPriority || undefined;
      }
      if (canEditOwner) {
        updatePayload.ownerId = ownerId || undefined;
        updatePayload.sponsorId = sponsorId || undefined;
      }
      if (canEditTargetDate) {
        updatePayload.plannedStartDate = startDate || undefined;
        updatePayload.plannedEndDate = targetDate || undefined;
      }

      const truth = await saveInitiativeWriteTruth(initiativeId, updatePayload);

      // Keep local baseline in sync so dirty-check resets immediately.
      setInitiative((prev: any) => ({
        ...prev,
        ...(truth.initiative || {}),
        title: canEditCards && normalizedTitle ? normalizedTitle : prev?.title,
        name: canEditCards && normalizedTitle ? normalizedTitle : prev?.name,
        summary,
        description,
        priority,
        ownerId,
        owner_id: ownerId,
        sponsorId,
        sponsor_id: sponsorId,
        plannedStartDate: startDate || null,
        planned_start_date: startDate || null,
        plannedEndDate: targetDate || null,
        planned_end_date: targetDate || null,
        targetDate: targetDate || null,
        problemStatement: problemDefinitionPayload || null,
        problem_statement: problemDefinitionPayload || null,
        marketContext: marketContextDraft || null,
        market_context: marketContextDraft || null,
        estimatedBudget: budgetDraft ? parseFloat(budgetDraft.replace(/[^0-9.]/g, '')) : null,
        estimated_budget: budgetDraft ? parseFloat(budgetDraft.replace(/[^0-9.]/g, '')) : null,
        resourceTools,
        resource_tools: resourceTools,
        deliverables: normalizedDeliverables,
        successCriteria: normalizedSuccessCriteria,
        scopeIn: normalizedScopeIn,
        scopeOut: normalizedScopeOut,
        killCriteria: normalizedKillCriteria,
        kill_criteria: normalizedKillCriteria,
        tags,
        targetState: { description: targetDescriptionDraft || '' },
        target_state: { description: targetDescriptionDraft || '' },
      }));
      setGateReadiness(truth.gateReadiness);
      setStatusHistory(truth.statusHistory as any);
      setHistory(truth.history as any);

      // Clear local draft backup after a successful save.
      try {
        localStorage.removeItem(initiativeDefinitionDraftStorageKey);
      } catch {
        // ignore
      }

      if (!silent) {
        toast.success(isPolish ? 'Zapisano' : 'Saved');
      }
    } catch (e: any) {
      if (!silent) {
        toast.error(e?.message || t('initiatives.toast.saveError', 'Nie udało się zapisać'));
      }
    } finally {
      setIsMutating(false);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    const savedProblemRaw = initiative?.problemStatement || initiative?.problem_statement || '';
    let savedSymptom = '';
    let savedRootCause = '';
    let savedCost = '';
    if (savedProblemRaw && typeof savedProblemRaw === 'string') {
      try {
        const parsed = JSON.parse(savedProblemRaw);
        savedSymptom = parsed?.symptom || '';
        savedRootCause = parsed?.rootCause || '';
        savedCost = parsed?.costOfInaction || '';
      } catch {
        try {
          const decoded = decodeHtmlEntities(savedProblemRaw);
          const parsedDecoded = JSON.parse(decoded);
          savedSymptom = parsedDecoded?.symptom || '';
          savedRootCause = parsedDecoded?.rootCause || '';
          savedCost = parsedDecoded?.costOfInaction || '';
        } catch {
          savedSymptom = decodeHtmlEntities(savedProblemRaw);
        }
      }
    }

    const savedBudget = String(
      initiative?.estimatedBudget ||
        initiative?.estimated_budget ||
        initiative?.budget ||
        initiative?.budgetEstimate ||
        initiative?.costCapex ||
        initiative?.cost_capex ||
        ''
    );
    const savedTools = Array.isArray(initiative?.resourceTools)
      ? initiative.resourceTools
      : Array.isArray(initiative?.resource_tools)
        ? initiative.resource_tools
        : Array.isArray(initiative?.tools)
          ? initiative.tools
          : [];

    const savedDeliverables = Array.isArray(initiative?.deliverables)
      ? initiative.deliverables
      : Array.isArray(initiative?.targetState?.deliverables)
        ? initiative.targetState.deliverables
        : Array.isArray(initiative?.target_state?.deliverables)
          ? initiative.target_state.deliverables
          : [];
    const savedSuccessCriteria = Array.isArray(initiative?.successCriteria)
      ? initiative.successCriteria
      : Array.isArray(initiative?.success_criteria)
        ? initiative.success_criteria
        : Array.isArray(initiative?.targetState?.successCriteria)
          ? initiative.targetState.successCriteria
          : Array.isArray(initiative?.target_state?.successCriteria)
            ? initiative.target_state.successCriteria
            : [];

    const savedScopeIn = Array.isArray(initiative?.scopeIn)
      ? initiative.scopeIn
      : Array.isArray(initiative?.scope_in)
        ? initiative.scope_in
        : Array.isArray(initiative?.scope?.inScope)
          ? initiative.scope.inScope
          : [];
    const savedScopeOut = Array.isArray(initiative?.scopeOut)
      ? initiative.scopeOut
      : Array.isArray(initiative?.scope_out)
        ? initiative.scope_out
        : Array.isArray(initiative?.scope?.outScope)
          ? initiative.scope.outScope
          : [];
    const savedKillCriteria = Array.isArray(initiative?.killCriteria)
      ? initiative.killCriteria
      : Array.isArray(initiative?.kill_criteria)
        ? initiative.kill_criteria
        : Array.isArray(initiative?.scope?.killCriteria)
          ? initiative.scope.killCriteria
          : [];

    const normalizedDeliverables = deliverableItems
      .map((d) => String(d.text || '').trim())
      .filter(Boolean);
    const normalizedSuccessCriteria = successCriteriaItems
      .map((c) => String(c.text || '').trim())
      .filter(Boolean);

    const savedTargetDescription = String(
      initiative?.targetState?.description || initiative?.target_state?.description || ''
    );

    return (
      String(titleDraft || '').trim() !==
        String(initiative?.title || initiative?.name || '').trim() ||
      summary !== (initiative?.summary || '') ||
      description !== (initiative?.description || '') ||
      priority !== (initiative?.priority || 'medium').toLowerCase() ||
      ownerId !== (initiative?.ownerId || initiative?.owner_id || '') ||
      sponsorId !== (initiative?.sponsorId || initiative?.sponsor_id || '') ||
      targetDate !== (initiative?.plannedEndDate || initiative?.targetDate || '') ||
      (startDate || '') !==
        (initiative?.plannedStartDate || initiative?.planned_start_date || '') ||
      symptomDraft !== savedSymptom ||
      rootCauseDraft !== savedRootCause ||
      costOfInactionDraft !== savedCost ||
      marketContextDraft !== (initiative?.marketContext || initiative?.market_context || '') ||
      budgetDraft !== savedBudget ||
      JSON.stringify(resourceTools) !== JSON.stringify(savedTools) ||
      JSON.stringify(tags) !== JSON.stringify(initiative?.tags || []) ||
      JSON.stringify(normalizedDeliverables) !== JSON.stringify(savedDeliverables) ||
      JSON.stringify(normalizedSuccessCriteria) !== JSON.stringify(savedSuccessCriteria) ||
      JSON.stringify(inScopeItems) !== JSON.stringify(savedScopeIn) ||
      JSON.stringify(outScopeItems) !== JSON.stringify(savedScopeOut) ||
      JSON.stringify(killCriteriaItems) !== JSON.stringify(savedKillCriteria) ||
      targetDescriptionDraft !== savedTargetDescription
    );
  }, [
    initiative,
    titleDraft,
    summary,
    description,
    priority,
    ownerId,
    sponsorId,
    targetDate,
    startDate,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    budgetDraft,
    resourceTools,
    tags,
    deliverableItems,
    successCriteriaItems,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
    targetDescriptionDraft,
    decodeHtmlEntities,
  ]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasUnsavedChanges || isMutating || !initiativeId) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      handleSave(true);
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsavedChanges, isMutating, initiativeId]);

  const handleCreateTask = async () => {
    if (!canEditCards) {
      toast.error(
        isPolish
          ? 'Nie masz uprawnień do edycji na tym etapie inicjatywy.'
          : 'You do not have edit permissions at this initiative stage.'
      );
      return;
    }
    if (!newTaskTitle.trim()) return;
    setIsMutating(true);
    try {
      const projectId = initiative?.projectId || initiative?.project_id || initiative?.project?.id;
      const res = await Api.post('/tasks', {
        title: newTaskTitle,
        projectId,
        initiativeId,
        status: 'todo',
        source: 'manual',
        isMilestone: newTaskIsMilestone,
        milestoneDate: newTaskIsMilestone ? newTaskMilestoneDate : undefined,
      });
      setTasks((prev) => [
        ...prev,
        {
          id: res.id,
          title: res.title,
          source: res.source || 'manual',
          description: res.description,
          status: res.status,
          priority: res.priority,
          dueDate: res.dueDate,
          taskType: res.taskType,
          estimatedHours: res.estimatedHours,
          assigneeId: res.assigneeId,
          assigneeName: res.assigneeName || res.assignee?.name,
          isMilestone: res.isMilestone,
          milestoneDate: res.milestoneDate,
        },
      ]);
      setNewTaskTitle('');
      setNewTaskIsMilestone(false);
      setNewTaskMilestoneDate('');
      setShowCreateTask(false);
      toast.success(isPolish ? 'Zadanie utworzone' : 'Task created');
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.createTaskError', 'Nie udało się utworzyć zadania')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleCreateDecision = async () => {
    if (!canEditCards) {
      toast.error(
        isPolish
          ? 'Nie masz uprawnień do edycji na tym etapie inicjatywy.'
          : 'You do not have edit permissions at this initiative stage.'
      );
      return;
    }
    if (!newDecisionTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post('/decisions', {
        title: newDecisionTitle,
        type: newDecisionType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
      });
      const mapped = {
        id: res.id,
        title: res.title || newDecisionTitle,
        description: res.description || undefined,
        type: res.decisionType || res.type || newDecisionType,
        status: res.status || 'PENDING',
        priority: res.priority || undefined,
        decisionMakerId: res.decisionOwnerId || res.decisionMakerId || undefined,
        ownerName: res.ownerName || undefined,
        requestedByName: res.requestedByName || undefined,
        dueDate: res.dueDate || undefined,
        createdAt: res.createdAt || new Date().toISOString(),
        isOverdue: false,
        daysOverdue: 0,
        source: 'manual' as const,
      };
      setDecisions((prev) => [...prev, mapped]);
      setNewDecisionTitle('');
      setShowCreateDecision(false);
      toast.success(isPolish ? 'Decyzja utworzona' : 'Decision created');
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.createDecisionError', 'Nie udało się utworzyć decyzji')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveDecision = async (id: string) => {
    try {
      await Api.delete(`/decisions/${id}`);
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      toast.success(isPolish ? 'Decyzja usunięta' : 'Decision removed');
    } catch {
      toast.error(isPolish ? 'Nie udało się usunąć decyzji' : 'Failed to remove decision');
    }
  };

  const handleCreateRaid = async () => {
    if (!canEditCards) {
      toast.error(
        isPolish
          ? 'Nie masz uprawnień do edycji na tym etapie inicjatywy.'
          : 'You do not have edit permissions at this initiative stage.'
      );
      return;
    }
    if (!newRaidTitle.trim()) return;
    setIsMutating(true);
    try {
      const res = await Api.post(`/initiatives/${initiativeId}/raid`, {
        type: newRaidType,
        title: newRaidTitle,
        description: newRaidDescription,
        severity: newRaidSeverity,
        status: 'OPEN',
      });
      setRaidItems((prev) => [...prev, res]);
      setNewRaidTitle('');
      setNewRaidDescription('');
      setShowCreateRaid(false);
      toast.success(isPolish ? 'Element RAID dodany' : 'RAID item added');
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.createRaidError', 'Nie udało się dodać elementu RAID')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleUpdateRaid = useCallback((id: string, updates: Partial<RaidItem>) => {
    setRaidItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, []);

  const handleDeleteRaid = useCallback(
    async (id: string) => {
      setRaidItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(isPolish ? 'Element RAID usunięty' : 'RAID item removed');
      try {
        await Api.delete(`/initiatives/${initiativeId}/raid/${id}`);
      } catch {
        // Best-effort backend delete — item already removed from UI
      }
    },
    [initiativeId, isPolish]
  );

  // ── Resource CRUD handlers (Team / Budget / Tools) ──────────────────────
  const handleAddResource = useCallback(
    async (data: Omit<(typeof apiResourceItems)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/resources`, {
          name: data.name,
          role: data.role,
          allocationPercentage: data.allocationPercentage,
          startDate: data.startDate,
          endDate: data.endDate,
          notes: data.notes,
          userId: data.userId,
        });
        const newItem = res?.resource || res;
        setApiResourceItems((prev) => [
          ...prev,
          { ...data, id: newItem.id || `res-${Date.now()}` },
        ]);
        toast.success(isPolish ? 'Zasób dodany' : 'Resource added');
      } catch (e: any) {
        toast.error(
          e?.message || (isPolish ? 'Nie udało się dodać zasobu' : 'Failed to add resource')
        );
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateResource = useCallback(
    async (id: string, data: Partial<(typeof apiResourceItems)[0]>) => {
      setApiResourceItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      try {
        await Api.put(`/initiatives/${initiativeId}/resources/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteResource = useCallback(
    async (id: string) => {
      setApiResourceItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(isPolish ? 'Zasób usunięty' : 'Resource removed');
      try {
        await Api.delete(`/initiatives/${initiativeId}/resources/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  const handleAddBudgetItem = useCallback(
    async (data: Omit<(typeof apiBudgetItems)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/budget-items`, data);
        const newItem = res?.budgetItem || res;
        setApiBudgetItems((prev) => [...prev, { ...data, id: newItem.id || `bi-${Date.now()}` }]);
        toast.success(isPolish ? 'Pozycja budżetowa dodana' : 'Budget item added');
      } catch (e: any) {
        toast.error(
          e?.message || (isPolish ? 'Nie udało się dodać pozycji' : 'Failed to add budget item')
        );
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateBudgetItem = useCallback(
    async (id: string, data: Partial<(typeof apiBudgetItems)[0]>) => {
      setApiBudgetItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      try {
        await Api.put(`/initiatives/${initiativeId}/budget-items/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteBudgetItem = useCallback(
    async (id: string) => {
      setApiBudgetItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(isPolish ? 'Pozycja usunięta' : 'Budget item removed');
      try {
        await Api.delete(`/initiatives/${initiativeId}/budget-items/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  const handleAddTool = useCallback(
    async (data: Omit<(typeof apiToolItems)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/tools`, data);
        const newItem = res?.tool || res;
        setApiToolItems((prev) => [...prev, { ...data, id: newItem.id || `tool-${Date.now()}` }]);
        toast.success(isPolish ? 'Narzędzie dodane' : 'Tool added');
      } catch (e: any) {
        toast.error(
          e?.message || (isPolish ? 'Nie udało się dodać narzędzia' : 'Failed to add tool')
        );
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateTool = useCallback(
    async (id: string, data: Partial<(typeof apiToolItems)[0]>) => {
      setApiToolItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...data } : item)));
      try {
        await Api.put(`/initiatives/${initiativeId}/tools/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteTool = useCallback(
    async (id: string) => {
      setApiToolItems((prev) => prev.filter((item) => item.id !== id));
      toast.success(isPolish ? 'Narzędzie usunięte' : 'Tool removed');
      try {
        await Api.delete(`/initiatives/${initiativeId}/tools/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  // ── Intangible Assets CRUD handlers ──────────────────────
  const handleAddIntangibleAsset = useCallback(
    async (data: Omit<(typeof apiIntangibleAssets)[0], 'id'>) => {
      try {
        const res = await Api.post(`/initiatives/${initiativeId}/intangible-assets`, data);
        const newItem = res?.intangibleAsset || res;
        setApiIntangibleAssets((prev) => [
          ...prev,
          { ...data, id: newItem.id || `ia-${Date.now()}` },
        ]);
        toast.success(isPolish ? 'Zasób niematerialny dodany' : 'Intangible asset added');
      } catch (e: any) {
        toast.error(e?.message || (isPolish ? 'Nie udało się dodać' : 'Failed to add asset'));
      }
    },
    [initiativeId, isPolish]
  );

  const handleUpdateIntangibleAsset = useCallback(
    async (id: string, data: Partial<(typeof apiIntangibleAssets)[0]>) => {
      setApiIntangibleAssets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...data } : item))
      );
      try {
        await Api.put(`/initiatives/${initiativeId}/intangible-assets/${id}`, data);
      } catch {
        // best-effort
      }
    },
    [initiativeId]
  );

  const handleDeleteIntangibleAsset = useCallback(
    async (id: string) => {
      setApiIntangibleAssets((prev) => prev.filter((item) => item.id !== id));
      toast.success(isPolish ? 'Zasób niematerialny usunięty' : 'Asset removed');
      try {
        await Api.delete(`/initiatives/${initiativeId}/intangible-assets/${id}`);
      } catch {
        // best-effort
      }
    },
    [initiativeId, isPolish]
  );

  const handleAddComment = async (content: string) => {
    const authorName = currentUser
      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
        currentUser.email ||
        'User'
      : 'User';

    // Optimistic local update
    const tempId = Math.random().toString(36).substr(2, 9);
    const newComment: Comment = {
      id: tempId,
      content,
      authorId: currentUserId,
      authorName,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
    };
    setComments((prev) => [...prev, newComment]);

    // Persist to backend
    try {
      const saved = await Api.post(`/initiatives/${initiativeId}/comments`, { content });
      // Replace temp ID with server-generated ID
      if (saved?.id) {
        setComments((prev) => prev.map((c) => (c.id === tempId ? { ...c, id: saved.id } : c)));
      }
    } catch {
      // Comment is shown locally even if persist fails (best-effort)
      // Endpoint may not exist yet — no toast to avoid noise
    }
  };

  // ── Attachment handlers (for AttachmentsLinksCanvas) ──────────────────────
  const handleUploadAttachments = useCallback(async (files: FileList) => {
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
      uploadedAt: new Date().toISOString(),
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleDeleteAttachment = useCallback(async (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Linked items handlers (for AttachmentsLinksCanvas) ──────────────────
  const handleAddLinkedItem = useCallback(
    async (item: LinkedItem) => {
      const isDuplicate = linkedItems.some((li) => li.id === item.id && li.type === item.type);
      if (isDuplicate) {
        toast(isPolish ? 'Ten element jest już powiązany' : 'This item is already linked', {
          icon: '⚠️',
        });
        return;
      }
      setLinkedItems((prev) => [...prev, item]);
    },
    [linkedItems, isPolish]
  );

  const handleRemoveLinkedItem = useCallback(async (item: Pick<LinkedItem, 'id' | 'type'>) => {
    setLinkedItems((prev) =>
      prev.filter((i) =>
        item.type ? !(i.id === item.id && i.type === item.type) : i.id !== item.id
      )
    );
  }, []);

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
        Api.get('/tasks?limit=50'),
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
            : tasksRes.value?.tasks || []
          : [];
      const initiatives =
        initiativesRes.status === 'fulfilled'
          ? Array.isArray(initiativesRes.value)
            ? initiativesRes.value
            : initiativesRes.value?.initiatives || []
          : [];
      const decisions = decisionsRes.status === 'fulfilled' ? decisionsRes.value || [] : [];
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
        toast(isPolish ? 'Brak docelowego linku' : 'No target link available', { icon: 'ℹ️' });
        return;
      }
      window.open(target, '_blank', 'noopener,noreferrer');
    },
    [isPolish]
  );

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(buildArtifactPermalink('initiative', initiativeId))
      .then(() => {
        toast.success(isPolish ? 'Link do inicjatywy skopiowany' : 'Initiative permalink copied');
      })
      .catch(() => {
        toast.error(isPolish ? 'Nie udało się skopiować linku' : 'Failed to copy link');
      })
      .finally(() => {
        setShowMoreMenu(false);
      });
  };
  const handleExportPDF = () => {
    toast(isPolish ? 'Eksport PDF — wkrótce dostępny' : 'PDF export — coming soon', {
      icon: '📄',
    });
    setShowMoreMenu(false);
  };

  const handleGenerateScopeCard = async (): Promise<void> => {
    setIsGeneratingAI('scope');
    const aiLanguage = isPolish ? 'pl' : 'en';
    const targetLanguageName = isPolish ? 'Polish' : 'English';

    const buildParagraphSystemInstruction = (
      fieldLabel: string,
      mode: 'generate' | 'improve',
      opts?: {
        /** Minimum number of sentences when using paragraph format */
        minSentences?: number;
        /** Suggested sentence range when using paragraph format */
        sentenceRangeHint?: string;
        /** Allow simple hyphen bullets as an alternative */
        allowBullets?: boolean;
        /** If bullets are used, suggested range */
        bulletRangeHint?: string;
      }
    ) =>
      [
        mode === 'generate'
          ? `You are a senior PMO consultant and an expert business writer.`
          : `You are a professional PMO content editor.`,
        mode === 'generate'
          ? `Generate professional content for the field "${fieldLabel}".`
          : `Refine the user's text for the field "${fieldLabel}".`,
        `Rules:`,
        `- Output language MUST be ${targetLanguageName}, even if the input/context is in a different language (translate as needed).`,
        `- Do NOT invent new facts, numbers, dates, systems, or KPI values that are not present in the provided context. If information is missing, keep it generic and/or explicitly mark what needs confirmation in a single short sentence.`,
        `- Return ONLY the final field text. No commentary, no quotes, no prefixes, no markdown.`,
        `- Length: ${
          opts?.sentenceRangeHint || '2–5 sentences'
        } (minimum ${opts?.minSentences ?? 2} sentences).`,
        `- Do NOT return a single sentence.`,
        opts?.allowBullets
          ? [
              `- You MAY use a simple hyphen bullet list instead if there are multiple distinct arguments.`,
              `  - Bullets: ${opts?.bulletRangeHint || '3–7 bullets'}`,
              `  - Each bullet must start with "- " and be a standalone point`,
              `  - No numbering, no headings, no bold/italics, no empty lines`,
            ].join('\n')
          : ``,
        mode === 'generate'
          ? `- Style: concrete, delivery-oriented, executive/PMO. Prefer specific operational/business impacts over generic filler.`
          : `- Keep the same meaning, but make it clearer, more decision-oriented, and more actionable.`,
      ].join('\n');

    const buildListSystemInstruction = (fieldLabel: string, mode: 'generate' | 'improve') =>
      [
        mode === 'generate'
          ? `You are a senior PMO consultant and an expert business writer.`
          : `You are a professional PMO content editor.`,
        mode === 'generate'
          ? `Generate a list for the field "${fieldLabel}".`
          : `Refine the list items for the field "${fieldLabel}".`,
        `Rules:`,
        `- Output language MUST be ${targetLanguageName}, even if the input/context is in a different language (translate as needed).`,
        `- Do NOT invent new facts, numbers, dates, systems, or KPI values that are not present in the provided context.`,
        `- Return ONLY the final list text. No commentary, no quotes, no prefixes, no markdown.`,
        `Formatting requirements:`,
        `- ONE item per line`,
        `- No bullets, no numbering`,
        `- No empty lines`,
        mode === 'generate'
          ? `- Return 5–8 distinct items.`
          : `- Make items clearer and more action-oriented.`,
      ].join('\n');

    const refineOrGenerate = async (
      fieldLabel: string,
      current: string,
      output: 'paragraph' | 'list'
    ) => {
      const sanitizedCurrent = String(current || '')
        .replace(/&quot;/g, '"')
        .trim();
      const looksLikeJsonObject =
        sanitizedCurrent.startsWith('{') &&
        (sanitizedCurrent.includes('"symptom"') ||
          sanitizedCurrent.includes('"rootCause"') ||
          sanitizedCurrent.includes('"costOfInaction"') ||
          sanitizedCurrent.includes('"marketContext"'));

      const mode: 'generate' | 'improve' =
        sanitizedCurrent && !looksLikeJsonObject ? 'improve' : 'generate';
      const systemInstruction =
        output === 'list'
          ? buildListSystemInstruction(fieldLabel, mode)
          : buildParagraphSystemInstruction(fieldLabel, mode);

      const text =
        mode === 'generate'
          ? [
              `[GENERATE FROM SCRATCH]`,
              `Field: ${fieldLabel}`,
              `Initiative: ${initiative?.name || ''}`,
              `Known summary: ${String(summary || initiative?.description || '').trim()}`,
              `Known problem: ${String(symptomDraft || '').trim()}`,
              `Known solution: ${String(rootCauseDraft || '').trim()}`,
              `Known cost of inaction: ${String(costOfInactionDraft || '').trim()}`,
              `Known market context: ${String(marketContextDraft || '').trim()}`,
            ].join('\n')
          : sanitizedCurrent;

      const aiRes = await Api.post('/ai/refine-text', {
        text,
        mode,
        systemInstruction,
        fieldLabel,
        artifactContext: {
          title: initiative?.name || '',
          status,
          priority,
          type: 'initiative',
        },
        language: aiLanguage,
      });
      return String(aiRes?.text || '').trim();
    };

    try {
      // 1) Fill the Description & Context fields (generate if empty, improve if present)
      const [problem, solution, cost, market] = await Promise.all([
        refineOrGenerate(isPolish ? 'Problem' : 'Problem', symptomDraft, 'paragraph'),
        refineOrGenerate(
          isPolish ? 'Opis rozwiązania' : 'Proposed Solution',
          rootCauseDraft,
          'paragraph'
        ),
        // Cost of inaction tends to have multiple arguments → allow bullets
        (async () => {
          const current = costOfInactionDraft;
          const mode: 'generate' | 'improve' = String(current || '').trim()
            ? 'improve'
            : 'generate';
          const fieldLabel = isPolish ? 'Koszt bezczynności' : 'Cost of Inaction';
          const systemInstruction = buildParagraphSystemInstruction(fieldLabel, mode, {
            minSentences: 2,
            sentenceRangeHint: '2–6 sentences',
            allowBullets: true,
            bulletRangeHint: '3–8 bullets',
          });
          const text =
            mode === 'generate'
              ? [
                  `[GENERATE FROM SCRATCH]`,
                  `Field: ${fieldLabel}`,
                  `Initiative: ${initiative?.name || ''}`,
                  `Known summary: ${String(summary || initiative?.description || '').trim()}`,
                  `Known problem: ${String(symptomDraft || '').trim()}`,
                  `Known solution: ${String(rootCauseDraft || '').trim()}`,
                  `Known market context: ${String(marketContextDraft || '').trim()}`,
                  ``,
                  `Hint: If multiple distinct impacts exist, prefer hyphen bullets. Mix quantitative and qualitative impacts. If a number is unknown, mark it as [confirm].`,
                ].join('\n')
              : String(current || '')
                  .replace(/&quot;/g, '"')
                  .trim();

          const aiRes = await Api.post('/ai/refine-text', {
            text,
            mode,
            systemInstruction,
            fieldLabel,
            artifactContext: {
              title: initiative?.name || '',
              status,
              priority,
              type: 'initiative',
            },
            language: aiLanguage,
          });
          return String(aiRes?.text || '').trim();
        })(),
        refineOrGenerate(
          isPolish ? 'Kontekst rynkowy' : 'Market Context',
          marketContextDraft,
          'paragraph'
        ),
      ]);

      if (problem) setSymptomDraft(problem);
      if (solution) setRootCauseDraft(solution);
      if (cost) setCostOfInactionDraft(cost);
      if (market) setMarketContextDraft(market);

      // 2) Scope boundaries lists: if all empty -> use structured section prompt; otherwise refine/generate lists
      const safeInScope = normalizeStringList(inScopeItems);
      const safeOutScope = normalizeStringList(outScopeItems);
      const safeKillCriteria = normalizeStringList(killCriteriaItems);

      const hasAnyScope =
        safeInScope.filter(Boolean).length > 0 ||
        safeOutScope.filter(Boolean).length > 0 ||
        safeKillCriteria.filter(Boolean).length > 0;

      if (!hasAnyScope) {
        const context = {
          sectionKey: 'scope',
          initiativeId,
          initiativeName: initiative?.name || '',
          summary: summary || initiative?.description || '',
          problemStatement: initiative?.problem_statement || '',
          category: initiative?.category || '',
          module: initiative?.module || '',
          status: initiative?.status || '',
          language: aiLanguage,
        };
        const res = await Api.post('/initiatives/generate-section', context);
        const parsed = res?.parsedContent || res?.content;
        const parsedInScope = normalizeStringList(parsed?.inScope);
        const parsedOutScope = normalizeStringList(parsed?.outOfScope ?? parsed?.outScope);
        const parsedKillCriteria = normalizeStringList(
          parsed?.killCriteria ?? parsed?.kill_criteria ?? parsed?.killCriteriaItems
        );

        if (parsedInScope.length) setInScopeItems(parsedInScope);
        if (parsedOutScope.length) setOutScopeItems(parsedOutScope);
        if (parsedKillCriteria.length) setKillCriteriaItems(parsedKillCriteria);
      } else {
        const [inScopeText, outScopeText, killText] = await Promise.all([
          refineOrGenerate(
            isPolish ? 'W zakresie (lista)' : 'In Scope (list)',
            safeInScope.filter(Boolean).join('\n'),
            'list'
          ),
          refineOrGenerate(
            isPolish ? 'Poza zakresem (lista)' : 'Out of Scope (list)',
            safeOutScope.filter(Boolean).join('\n'),
            'list'
          ),
          refineOrGenerate(
            isPolish ? 'Kryteria rezygnacji (lista)' : 'Kill Criteria (list)',
            safeKillCriteria.filter(Boolean).join('\n'),
            'list'
          ),
        ]);

        if (inScopeText) setInScopeItems(normalizeStringList(inScopeText));
        if (outScopeText) setOutScopeItems(normalizeStringList(outScopeText));
        if (killText) setKillCriteriaItems(normalizeStringList(killText));
      }

      toast.success(isPolish ? 'Scope wygenerowany przez AI' : 'Scope generated by AI');
    } catch (e: any) {
      toast.error(
        e?.message || (isPolish ? 'Generowanie scope nie powiodło się' : 'Generate scope failed')
      );
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const handleGenerateAI = async (section: string): Promise<any> => {
    setIsGeneratingAI(section);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';
      const context = {
        sectionKey: section,
        initiativeId,
        initiativeName: initiative?.name || '',
        summary: summary || initiative?.description || '',
        problemStatement: initiative?.problem_statement || '',
        category: initiative?.category || '',
        module: initiative?.module || '',
        status: initiative?.status || '',
        language: aiLanguage,
      };

      const result = await Api.post('/initiatives/generate-section', context);

      if (result?.parsedContent || result?.content) {
        if (section === 'overview' || section === 'summary') {
          // Set the summary
          setSummary(result.parsedContent || result.content);

          // Also generate content for Description & Context sub-fields if they are empty
          const subFieldsToGenerate: {
            key: string;
            setter: (v: string) => void;
            current: string;
          }[] = [
            {
              key: 'problem_definition',
              setter: (v: string) => setSymptomDraft(v),
              current: symptomDraft,
            },
            {
              key: 'proposed_solution',
              setter: (v: string) => setRootCauseDraft(v),
              current: rootCauseDraft,
            },
            {
              key: 'cost_of_inaction',
              setter: (v: string) => setCostOfInactionDraft(v),
              current: costOfInactionDraft,
            },
            {
              key: 'market_context',
              setter: (v: string) => setMarketContextDraft(v),
              current: marketContextDraft,
            },
          ];

          // Generate sub-fields in parallel (only empty ones)
          const emptyFields = subFieldsToGenerate.filter((f) => !f.current.trim());
          if (emptyFields.length > 0) {
            const subResults = await Promise.allSettled(
              emptyFields.map((f) =>
                Api.post('/ai/refine-text', {
                  text: `[GENERATE FROM SCRATCH] Section: ${f.key}. Initiative: ${initiative?.name || ''}. Summary: ${result.parsedContent || result.content}`,
                  mode: 'generate',
                  systemInstruction: `You are a strategic PMO expert. Generate professional content for the "${f.key}" section of initiative "${initiative?.name || ''}". Return ONLY the content — no commentary, no quotes, no prefixes. Write concisely (2-4 sentences). Output language: ${targetLanguageName}. Translate as needed.`,
                  fieldLabel: f.key,
                  artifactContext: {
                    title: initiative?.name || '',
                    status,
                    priority,
                    type: 'initiative',
                  },
                  language: aiLanguage,
                })
              )
            );

            subResults.forEach((res, idx) => {
              if (res.status === 'fulfilled' && res.value?.text) {
                emptyFields[idx].setter(String(res.value.text).trim());
              }
            });
          }

          toast.success(isPolish ? 'Opis wygenerowany przez AI' : 'Description generated by AI');
        } else if (section === 'raid') {
          // Parse RAID JSON and insert items into state
          const parsed =
            result.parsedContent ||
            (() => {
              try {
                const jsonMatch = (result.content || '').match(
                  /```(?:json)?\s*([\s\S]*?)\s*```/
                ) || [null, result.content];
                return JSON.parse(jsonMatch[1] || result.content || '{}');
              } catch {
                return null;
              }
            })();
          if (parsed) {
            const now = Date.now();
            const newItems: any[] = [];
            const mapItem = (item: any, type: string, idx: number) => ({
              id: `raid-ai-${now}-${type}-${idx}`,
              type,
              title: item.title || '',
              description: item.description || '',
              severity: (item.impact || item.severity || 'MEDIUM').toUpperCase(),
              status: (item.status || 'OPEN').toUpperCase(),
              owner: item.owner || '',
              mitigationPlan: item.mitigation || item.proposedAction || '',
              probability: item.probability || undefined,
              category: item.category || 'business',
              contingency: item.contingency || '',
              proposedAction: item.proposedAction || '',
              responseStrategy: item.responseStrategy || undefined,
              dueDate: item.dueDate || '',
              source: item.source || 'AI analysis',
            });
            if (Array.isArray(parsed.risks)) {
              parsed.risks.forEach((r: any, i: number) => newItems.push(mapItem(r, 'risk', i)));
            }
            if (Array.isArray(parsed.assumptions)) {
              parsed.assumptions.forEach((r: any, i: number) =>
                newItems.push(mapItem(r, 'assumption', i))
              );
            }
            if (Array.isArray(parsed.issues)) {
              parsed.issues.forEach((r: any, i: number) => newItems.push(mapItem(r, 'issue', i)));
            }
            if (Array.isArray(parsed.dependencies)) {
              parsed.dependencies.forEach((r: any, i: number) =>
                newItems.push(mapItem(r, 'dependency', i))
              );
            }
            if (newItems.length > 0) {
              setRaidItems((prev) => [...newItems, ...prev]);
              toast.success(
                isPolish
                  ? `AI wygenerował ${newItems.length} elementów RAID`
                  : `AI generated ${newItems.length} RAID items`
              );
            } else {
              toast.error(
                isPolish ? 'AI nie wygenerował elementów RAID' : 'AI generated no RAID items'
              );
            }
          } else {
            toast.error(
              isPolish ? 'Nie udało się sparsować odpowiedzi AI' : 'Failed to parse AI response'
            );
          }
        } else if (section === 'comments') {
          const aiComment: Comment = {
            id: `ai-${Date.now()}`,
            content: result.content || (isPolish ? '🤖 Analiza AI' : '🤖 AI Analysis'),
            authorId: 'ai-assistant',
            authorName: 'AI Assistant',
            createdAt: new Date().toISOString(),
            likes: 0,
            likedByMe: false,
          };
          setComments((prev) => [aiComment, ...prev]);
          toast.success(isPolish ? 'AI dodał komentarz' : 'AI added comment');
        } else {
          // For structured sections, the result is returned to the calling component
          toast.success(
            isPolish
              ? `AI wygenerował zawartość: ${section}`
              : `AI generated content for: ${section}`
          );
        }
        return result;
      } else {
        toast.error(isPolish ? 'AI nie zwróciło wyników' : 'AI returned no results');
        return null;
      }
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.aiGenerationError', 'Generowanie AI nie powiodło się')
      );
      return null;
    } finally {
      setIsGeneratingAI(null);
    }
  };

  const handleRequestApproval = async (role: 'owner' | 'sponsor', gateType: string) => {
    setIsMutating(true);
    try {
      const targetUserId = role === 'owner' ? ownerId : sponsorId;
      if (!targetUserId) {
        toast.error(
          isPolish
            ? `Wybierz ${role === 'owner' ? 'właściciela' : 'sponsora'}`
            : `Select ${role} first`
        );
        return;
      }
      await Api.post('/decisions', {
        title: `${gateType} - ${initiative?.name}`,
        type: gateType,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        status: 'PENDING',
        deciderId: targetUserId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success(isPolish ? 'Wysłano prośbę o zatwierdzenie' : 'Approval request sent');
      fetchAll();
    } catch (e: any) {
      toast.error(
        e?.message ||
          t('initiatives.toast.approvalRequestError', 'Nie udało się wysłać prośby o zatwierdzenie')
      );
    } finally {
      setIsMutating(false);
    }
  };

  const handleOpenChat = () => {
    if (isChatCollapsed) toggleChatCollapse();
    updateWorkspaceFromView(AppView.INITIATIVE_GENERATOR, initiativeId, {
      type: 'initiative',
      id: initiativeId,
      title: initiative?.name || '',
      status,
      phase: isPolish ? moduleConfig.labelPl : moduleConfig.label,
      summary,
      tasksCount: tasks.length,
      tasksDone,
      decisionsCount: decisions.length,
      raidCount: raidItems.length,
    });
  };

  const handleOpenTaskArtifact = useCallback(
    (taskId: string) => {
      if (isShowcaseArtifactId(taskId)) {
        toast(
          isPolish
            ? 'To zadanie demo jest pokazane w kontekście inicjatywy.'
            : 'This demo task is presented inside the initiative view.'
        );
        return;
      }
      if (onOpenTask) {
        onOpenTask(taskId);
        return;
      }
      // Fallback: open task artifact in My Work floating document panel
      setMyWorkIntent({
        tab: 'tasks',
        open: {
          type: 'task',
          id: taskId,
          name: isPolish ? 'Zadanie' : 'Task',
        },
      });
      setCurrentView(AppView.MY_WORK);
    },
    [onOpenTask, setMyWorkIntent, setCurrentView, isPolish]
  );

  const handleOpenDecisionArtifact = useCallback(
    (decisionId: string) => {
      if (isShowcaseArtifactId(decisionId)) {
        toast(
          isPolish
            ? 'Ta decyzja demo jest pokazana w kontekście inicjatywy.'
            : 'This demo decision is presented inside the initiative view.'
        );
        return;
      }
      if (onOpenDecision) {
        onOpenDecision(decisionId);
        return;
      }
      // Fallback: open decision artifact in My Work floating document panel
      setMyWorkIntent({
        tab: 'decisions',
        open: {
          type: 'decision',
          id: decisionId,
          name: isPolish ? 'Decyzja' : 'Decision',
        },
      });
      setCurrentView(AppView.MY_WORK);
    },
    [onOpenDecision, setMyWorkIntent, setCurrentView, isPolish]
  );

  const handleArchive = async () => {
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz zarchiwizować tę inicjatywę?'
          : 'Are you sure you want to archive this initiative?'
      )
    )
      return;
    setIsMutating(true);
    try {
      await Api.post(`/initiatives/${initiativeId}/archive`, {});
      toast.success(isPolish ? 'Inicjatywa zarchiwizowana' : 'Initiative archived');
      setShowMoreMenu(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.archiveError', 'Nie udało się zarchiwizować'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (status !== 'DRAFT') {
      toast.error(isPolish ? 'Można usunąć tylko szkice' : 'Only drafts can be deleted');
      return;
    }
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz usunąć tę inicjatywę?'
          : 'Are you sure you want to delete this initiative?'
      )
    )
      return;
    setIsMutating(true);
    try {
      await Api.delete(`/initiatives/${initiativeId}`);
      toast.success(isPolish ? 'Inicjatywa usunięta' : 'Initiative deleted');
      setShowMoreMenu(false);
      onBack?.();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.toast.deleteError', 'Nie udało się usunąć'));
    } finally {
      setIsMutating(false);
    }
  };

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const contextValue = useMemo(
    () => ({
      initiative,
      initiativeId,
      initiativeTemplate,
      isPolish,
      canEditPriority,
      canEditOwner,
      canEditTargetDate,
      canEditCards,
      openSection,
      focusTopBarField,
      decisions,
      setDecisions,
      raidItems,
      setRaidItems,
      watchers,
      setWatchers,
      history,
      tasks,
      setTasks,
      comments,
      setComments,
      linkedItems,
      setLinkedItems,
      attachments,
      setAttachments,
      stakeholders,
      setStakeholders,
      dependencies,
      setDependencies,
      tags,
      setTags,
      users,
      pendingApprovals,
      gateRoles,
      setGateRoles,
      userGateRoles,
      statusHistory,
      gateReadiness,
      summary,
      setSummary,
      description,
      setDescription,
      targetDescriptionDraft,
      setTargetDescriptionDraft,
      successCriteriaItems,
      setSuccessCriteriaItems,
      deliverableItems,
      setDeliverableItems,
      priority,
      setPriority,
      ownerId,
      setOwnerId,
      sponsorId,
      setSponsorId,
      targetDate,
      setTargetDate,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      timelineMilestones,
      setTimelineMilestones,
      timelinePhases,
      setTimelinePhases,
      timelineLocked: ['SCHEDULED', 'EXECUTING', 'BLOCKED', 'DONE', 'TRACKING'].includes(status),
      baselineVersion: initiative?.baselineVersion ?? null,
      estimatedDurationMonths,
      setEstimatedDurationMonths,
      budgetDraft,
      setBudgetDraft,
      resourceTools,
      setResourceTools,
      resourceItems: apiResourceItems,
      setResourceItems: setApiResourceItems,
      budgetItems: apiBudgetItems,
      setBudgetItems: setApiBudgetItems,
      toolItems: apiToolItems,
      setToolItems: setApiToolItems,
      handleAddResource,
      handleUpdateResource,
      handleDeleteResource,
      handleAddBudgetItem,
      handleUpdateBudgetItem,
      handleDeleteBudgetItem,
      handleAddTool,
      handleUpdateTool,
      handleDeleteTool,
      intangibleAssets: apiIntangibleAssets,
      setIntangibleAssets: setApiIntangibleAssets,
      handleAddIntangibleAsset,
      handleUpdateIntangibleAsset,
      handleDeleteIntangibleAsset,
      reminders,
      setReminders,
      escalationRules,
      setEscalationRules,
      thresholds,
      setThresholds,
      expandedSections,
      toggleSection,
      isGeneratingAI,
      isMutating,
      currentUserId,
      status,
      ownerName,
      sponsorName,
      tasksDone,
      tasksInProgress,
      milestones,
      riskCount,
      issueCount,
      criticalRaids,
      isWatching,
      pendingGates,
      statusActions,
      primaryActions,
      handleSave,
      handleStatusAction,
      handleToggleWatch,
      handleGenerateAI,
      tasksAiRequest,
      requestTasksAi,
      clearTasksAiRequest,
      decisionsAiRequest,
      requestDecisionsAi,
      clearDecisionsAiRequest,
      raidAiRequest,
      requestRaidAi,
      clearRaidAiRequest,
      resourcesAiRequest,
      requestResourcesAi,
      clearResourcesAiRequest,
      timelineAiRequest,
      requestTimelineAi,
      clearTimelineAiRequest,
      dependenciesAiRequest,
      requestDependenciesAi,
      clearDependenciesAiRequest,
      teamAiRequest,
      requestTeamAi,
      clearTeamAiRequest,
      gatesAiRequest,
      requestGatesAi,
      clearGatesAiRequest,
      kpisAiRequest,
      requestKpisAi,
      clearKpisAiRequest,
      targetStateAiRequest,
      requestTargetStateAi,
      clearTargetStateAiRequest,
      handleCreateTask,
      handleCreateDecision,
      handleRemoveDecision,
      handleCreateRaid,
      handleUpdateRaid,
      handleDeleteRaid,
      handleAddComment,
      handleRequestApproval,
      handleOpenChat,
      handleArchive,
      handleDelete,
      handleCopyLink,
      handleExportPDF,
      fetchAll,
      newTaskTitle,
      setNewTaskTitle,
      newTaskIsMilestone,
      setNewTaskIsMilestone,
      newTaskMilestoneDate,
      setNewTaskMilestoneDate,
      showCreateTask,
      setShowCreateTask,
      newDecisionTitle,
      setNewDecisionTitle,
      newDecisionType,
      setNewDecisionType,
      showCreateDecision,
      setShowCreateDecision,
      newRaidTitle,
      setNewRaidTitle,
      newRaidType,
      setNewRaidType,
      newRaidSeverity,
      setNewRaidSeverity,
      newRaidDescription,
      setNewRaidDescription,
      showCreateRaid,
      setShowCreateRaid,
      showMoreMenu,
      setShowMoreMenu,
      showStatusDropdown,
      setShowStatusDropdown,
      showPriorityDropdown,
      setShowPriorityDropdown,
      showPhaseDropdown,
      setShowPhaseDropdown,
      showApprovalWorkflow,
      setShowApprovalWorkflow,
      newTag,
      setNewTag,
      onBack,
      onStatusChange,
      onOpenTask: handleOpenTaskArtifact,
      onOpenDecision: handleOpenDecisionArtifact,
    }),
    [
      initiative,
      initiativeId,
      initiativeTemplate,
      isPolish,
      decisions,
      raidItems,
      watchers,
      history,
      tasks,
      comments,
      linkedItems,
      attachments,
      stakeholders,
      dependencies,
      tags,
      users,
      pendingApprovals,
      gateRoles,
      userGateRoles,
      statusHistory,
      gateReadiness,
      canEditPriority,
      canEditOwner,
      canEditTargetDate,
      canEditCards,
      openSection,
      focusTopBarField,
      summary,
      description,
      targetDescriptionDraft,
      setTargetDescriptionDraft,
      successCriteriaItems,
      setSuccessCriteriaItems,
      deliverableItems,
      setDeliverableItems,
      priority,
      ownerId,
      sponsorId,
      targetDate,
      startDate,
      endDate,
      timelineMilestones,
      timelinePhases,
      estimatedDurationMonths,
      apiResourceItems,
      apiBudgetItems,
      apiToolItems,
      handleAddResource,
      handleUpdateResource,
      handleDeleteResource,
      handleAddBudgetItem,
      handleUpdateBudgetItem,
      handleDeleteBudgetItem,
      handleAddTool,
      handleUpdateTool,
      handleDeleteTool,
      apiIntangibleAssets,
      handleAddIntangibleAsset,
      handleUpdateIntangibleAsset,
      handleDeleteIntangibleAsset,
      reminders,
      escalationRules,
      thresholds,
      expandedSections,
      toggleSection,
      isGeneratingAI,
      isMutating,
      currentUserId,
      status,
      ownerName,
      sponsorName,
      tasksDone,
      tasksInProgress,
      milestones,
      riskCount,
      issueCount,
      criticalRaids,
      isWatching,
      pendingGates,
      statusActions,
      primaryActions,
      handleSave,
      handleStatusAction,
      handleToggleWatch,
      handleGenerateAI,
      tasksAiRequest,
      requestTasksAi,
      clearTasksAiRequest,
      decisionsAiRequest,
      requestDecisionsAi,
      clearDecisionsAiRequest,
      resourcesAiRequest,
      requestResourcesAi,
      clearResourcesAiRequest,
      timelineAiRequest,
      requestTimelineAi,
      clearTimelineAiRequest,
      dependenciesAiRequest,
      requestDependenciesAi,
      clearDependenciesAiRequest,
      teamAiRequest,
      requestTeamAi,
      clearTeamAiRequest,
      gatesAiRequest,
      requestGatesAi,
      clearGatesAiRequest,
      kpisAiRequest,
      requestKpisAi,
      clearKpisAiRequest,
      targetStateAiRequest,
      requestTargetStateAi,
      clearTargetStateAiRequest,
      handleCreateTask,
      handleCreateDecision,
      handleRemoveDecision,
      handleCreateRaid,
      handleUpdateRaid,
      handleDeleteRaid,
      handleAddComment,
      handleRequestApproval,
      handleOpenChat,
      handleArchive,
      handleDelete,
      handleCopyLink,
      handleExportPDF,
      fetchAll,
      newTaskTitle,
      newTaskIsMilestone,
      newTaskMilestoneDate,
      showCreateTask,
      newDecisionTitle,
      newDecisionType,
      showCreateDecision,
      newRaidTitle,
      newRaidType,
      newRaidSeverity,
      newRaidDescription,
      showCreateRaid,
      showMoreMenu,
      showStatusDropdown,
      showPriorityDropdown,
      showPhaseDropdown,
      showApprovalWorkflow,
      newTag,
      onBack,
      onStatusChange,
      handleOpenTaskArtifact,
      handleOpenDecisionArtifact,
    ]
  );

  // ==========================================
  // N-MODE: SECTION DEFINITIONS (template-driven visibility)
  // ==========================================

  const templateToNModeSectionIds: Record<string, string[]> = useMemo(
    () => ({
      overview: ['initiative-definition'],
      problemDefinition: ['initiative-definition'],
      targetState: ['target-state-scope'],
      scope: ['target-state-scope'],
      tasks: ['tasks'],
      dependencies: ['dependencies'],
      team: ['team'],
      stakeholders: ['raci'],
      timeline: ['timeline'],
      resources: ['resources'],
      financialAnalysis: ['financial-analysis'],
      financialImpact: ['financial-impact'],
      raid: ['risk-raid'],
      decisions: ['decisions'],
      gates: ['gates'],
      comments: ['comments'],
      history: ['activity-log'],
      attachments: ['attachments-links'],
      linkedItems: ['attachments-links', 'used-in'],
      kpis: ['kpi'],
    }),
    []
  );

  const enabledNModeSectionIds = useMemo(() => {
    const templateVS =
      initiativeTemplate?.visibleSections || initiativeTemplate?.visible_sections || {};
    const hasExplicitTemplateVisibility =
      templateVS && typeof templateVS === 'object' && Object.keys(templateVS).length > 0;
    if (!hasExplicitTemplateVisibility) return null;

    const enabledIds = new Set<string>();
    for (const [key, isVisible] of Object.entries(templateVS)) {
      if (isVisible === false) continue;
      const mappedIds = templateToNModeSectionIds[key];
      if (!mappedIds) continue;
      for (const sectionId of mappedIds) enabledIds.add(sectionId);
    }
    return enabledIds;
  }, [initiativeTemplate, templateToNModeSectionIds]);

  const initiativeNSections: NModeSection[] = useMemo(() => {
    const allSections: NModeSection[] = [
      // --- Definicja (zawsze na górze) ---
      {
        id: 'initiative-definition',
        icon: Search,
        label: { en: 'Initiative Scope', pl: 'Zakres inicjatywy' },
        component: null,
      },
      // --- Codzienne operacje ---
      {
        id: 'tasks',
        icon: ListChecks,
        label: { en: 'Tasks', pl: 'Zadania' },
        badge: tasks.length > 0 ? tasks.length : undefined,
        component: null,
      },
      {
        id: 'decisions',
        icon: Scale,
        label: { en: 'Decisions', pl: 'Decyzje' },
        badge: decisions.length > 0 ? decisions.length : undefined,
        component: null,
      },
      {
        id: 'team',
        icon: Users,
        label: { en: 'Team', pl: 'Zespół' },
        component: null,
      },
      {
        id: 'timeline',
        icon: Calendar,
        label: { en: 'Timeline', pl: 'Harmonogram' },
        component: null,
      },
      {
        id: 'risk-raid',
        icon: Scale,
        label: { en: 'Risk & RAID', pl: 'Ryzyko i RAID' },
        badge: raidItems.length > 0 ? raidItems.length : undefined,
        component: null,
      },
      // --- Cele i mierniki ---
      {
        id: 'target-state-scope',
        icon: Target,
        label: { en: 'Success Criteria', pl: 'Kryteria sukcesu' },
        component: null,
      },
      {
        id: 'kpi',
        icon: TrendingUp,
        label: { en: 'KPIs & Benefits', pl: 'KPI i korzyści' },
        component: null,
      },
      {
        id: 'dependencies',
        icon: GitBranch,
        label: { en: 'Dependencies', pl: 'Zależności' },
        badge: dependencies.length > 0 ? dependencies.length : undefined,
        component: null,
      },
      // --- Finanse ---
      {
        id: 'financial-analysis',
        icon: DollarSign,
        label: { en: 'Financial Analysis', pl: 'Analiza finansowa' },
        component: null,
      },
      {
        id: 'financial-impact',
        icon: DollarSign,
        label: { en: 'Financial Impact', pl: 'Wpływ finansowy' },
        component: null,
      },
      // --- Governance (rzadko używane) ---
      {
        id: 'raci',
        icon: ShieldCheck,
        label: { en: 'RACI', pl: 'RACI' },
        badge: stakeholders.length > 0 ? stakeholders.length : undefined,
        component: null,
      },
      {
        id: 'gates',
        icon: Shield,
        label: { en: 'Gates', pl: 'Bramy' },
        badge: pendingGates.length > 0 ? pendingGates.length : undefined,
        component: null,
      },
      {
        id: 'resources',
        icon: FolderOpen,
        label: { en: 'Resources', pl: 'Zasoby' },
        component: null,
      },
      // --- Dokumentacja i logi (dół) ---
      {
        id: 'attachments-links',
        icon: FolderOpen,
        label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
        badge:
          attachments.length + linkedItems.length > 0
            ? attachments.length + linkedItems.length
            : undefined,
        component: null,
      },
      {
        id: 'used-in',
        icon: Link2,
        label: { en: 'Used in (backlinks)', pl: 'Użyte w (powiązania)' },
        component: null,
      },
      {
        id: 'comments',
        icon: MessageSquare,
        label: { en: 'Comments', pl: 'Komentarze' },
        badge: comments.length > 0 ? comments.length : undefined,
        component: null,
      },
      {
        id: 'activity-log',
        icon: History,
        label: { en: 'Activity Log', pl: 'Dziennik aktywności' },
        badge: history.length > 0 ? history.length : undefined,
        component: null,
      },
    ];

    if (!enabledNModeSectionIds || enabledNModeSectionIds.size === 0) {
      return allSections;
    }

    return allSections.filter((section) => enabledNModeSectionIds.has(section.id));
  }, [
    tasks.length,
    milestones.length,
    dependencies.length,
    stakeholders.length,
    raidItems.length,
    decisions.length,
    pendingGates.length,
    comments.length,
    history.length,
    attachments.length,
    linkedItems.length,
    enabledNModeSectionIds,
  ]);

  // ==========================================
  // N-MODE: PROPERTIES STRIP FIELDS
  // ==========================================

  const nModePropertyFields: NModePropertyField[] = useMemo(() => {
    const statusOptions = [
      { value: 'DRAFT', label: { en: 'Draft', pl: 'Szkic' } },
      { value: 'PENDING_REVIEW', label: { en: 'Pending Review', pl: 'Oczekuje na przegląd' } },
      { value: 'REVIEW', label: { en: 'Review', pl: 'Przegląd' } },
      { value: 'PROMOTED', label: { en: 'Promoted', pl: 'Promowana' } },
      { value: 'PLANNING', label: { en: 'Planning', pl: 'Planowanie' } },
      { value: 'APPROVED', label: { en: 'Approved', pl: 'Zatwierdzona' } },
      { value: 'SCHEDULED', label: { en: 'Scheduled', pl: 'Zaplanowana' } },
      { value: 'EXECUTING', label: { en: 'Executing', pl: 'W realizacji' } },
      { value: 'BLOCKED', label: { en: 'Blocked', pl: 'Zablokowana' } },
      { value: 'DONE', label: { en: 'Done', pl: 'Zakończona' } },
      { value: 'TRACKING', label: { en: 'Tracking', pl: 'Śledzenie' } },
      { value: 'CANCELLED', label: { en: 'Cancelled', pl: 'Anulowana' } },
      { value: 'ARCHIVED', label: { en: 'Archived', pl: 'Zarchiwizowana' } },
    ];

    const priorityOptions = [
      { value: 'critical', label: { en: 'Critical', pl: 'Krytyczny' } },
      { value: 'high', label: { en: 'High', pl: 'Wysoki' } },
      { value: 'medium', label: { en: 'Medium', pl: 'Średni' } },
      { value: 'low', label: { en: 'Low', pl: 'Niski' } },
    ];

    const nextGate = getNextGateForStatus(status);
    const gateConf = nextGate ? GATE_CONFIG[nextGate] : null;
    const fallbackNextAction =
      statusActions.find((a) => a.variant === 'primary') || statusActions[0];
    const gateLabel = gateConf
      ? { en: gateConf.name, pl: gateConf.namePl }
      : fallbackNextAction
        ? { en: fallbackNextAction.label, pl: fallbackNextAction.labelPl }
        : { en: 'Not defined', pl: 'Nie zdefiniowano' };
    const gateValue = fallbackNextAction?.targetStatus || 'NONE';
    const gateOptions =
      statusActions.length > 0
        ? statusActions.map((action) => ({
            value: action.targetStatus,
            label: { en: action.label, pl: action.labelPl },
          }))
        : [{ value: 'NONE', label: { en: 'Not defined', pl: 'Nie zdefiniowano' } }];
    const phaseOptions = Object.entries(MODULE_CONFIG).map(([moduleKey, cfg]) => ({
      value: moduleKey,
      label: { en: cfg.label, pl: cfg.labelPl },
    }));

    // Gate color — depends on whether there's a pending gate and what it targets
    const gateVisual = (() => {
      if (!gateConf)
        if (fallbackNextAction?.targetStatus) {
          const fallbackTargetModule = getModuleFromStatus(fallbackNextAction.targetStatus);
          const fallbackModConf = MODULE_CONFIG[fallbackTargetModule];
          return {
            dot: fallbackModConf.color,
            bg: fallbackModConf.bgLight,
            text: fallbackModConf.textColor,
          };
        }
      if (!gateConf)
        return {
          dot: 'bg-slate-300',
          bg: 'bg-slate-100 dark:bg-navy-800',
          text: 'text-slate-400 dark:text-slate-500',
        };
      // Map target status to module color
      const targetModule = getModuleFromStatus(gateConf.toStatus);
      const targetModConf = MODULE_CONFIG[targetModule];
      return {
        dot: targetModConf.color,
        bg: targetModConf.bgLight,
        text: targetModConf.textColor,
      };
    })();

    // Status color mapping
    const statusAlertBorder = (() => {
      if (status === 'BLOCKED') return 'border-red-400/60';
      if (status === 'EXECUTING') return 'border-emerald-400/60';
      if (status === 'DONE' || status === 'TRACKING') return 'border-blue-400/60';
      if (status === 'CANCELLED' || status === 'ARCHIVED') return 'border-slate-400/60';
      return undefined;
    })();

    // Priority color mapping
    const priorityAlertBorder = (() => {
      if (priority === 'critical') return 'border-red-400/60';
      if (priority === 'high') return 'border-orange-400/60';
      return undefined;
    })();

    // Gate color
    const gateAlertBorder = pendingGates.length > 0 ? 'border-amber-400/60' : undefined;

    // Helper: get metadata for current status
    const currentStatusMeta = INITIATIVE_STATUS_METADATA[status as InitiativeStatus];
    const currentStatusDot = currentStatusMeta?.dotColor || 'bg-slate-400';
    const currentStatusBg = currentStatusMeta?.bgColor || 'bg-slate-50';
    const currentStatusColor = currentStatusMeta?.color || 'text-slate-700';
    const currentStatusLabel = currentStatusMeta
      ? isPolish
        ? currentStatusMeta.labelPL
        : currentStatusMeta.label
      : status;

    // Helper: get metadata for current priority
    const priorityMeta: Record<
      string,
      { dot: string; bg: string; text: string; label: string; labelPl: string }
    > = {
      critical: {
        dot: 'bg-red-500',
        bg: 'bg-red-500/10',
        text: 'text-red-600',
        label: 'Critical',
        labelPl: 'Krytyczny',
      },
      high: {
        dot: 'bg-orange-500',
        bg: 'bg-orange-500/10',
        text: 'text-orange-600',
        label: 'High',
        labelPl: 'Wysoki',
      },
      medium: {
        dot: 'bg-amber-400',
        bg: 'bg-amber-400/10',
        text: 'text-amber-600',
        label: 'Medium',
        labelPl: 'Średni',
      },
      low: {
        dot: 'bg-emerald-500',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600',
        label: 'Low',
        labelPl: 'Niski',
      },
    };
    const currentPriorityMeta = priorityMeta[priority] || priorityMeta.medium;

    return [
      {
        id: 'status',
        label: { en: 'Status', pl: 'Status' },
        type: 'custom' as const,
        value: status,
        onChange: () => {},
        readOnly: true,
        alertBorderClass: statusAlertBorder,
        render: () => (
          <div className="relative">
            <div
              className={`flex h-8 items-center gap-2 w-full px-2.5 rounded-lg text-xs font-semibold ${currentStatusBg} border ${statusAlertBorder || 'border-slate-200/60 dark:border-navy-600/60'} ${currentStatusColor}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentStatusDot}`} />
              <span className="flex-1 truncate">{currentStatusLabel}</span>
            </div>
            <select
              value={status}
              onChange={() => {}}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title={isPolish ? 'Podgląd listy statusów' : 'Preview status list'}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isPolish ? opt.label.pl : opt.label.en}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        id: 'phase',
        label: { en: 'Phase', pl: 'Faza' },
        type: 'custom' as const,
        value: isPolish ? moduleConfig.labelPl : moduleConfig.label,
        onChange: () => {},
        readOnly: true,
        render: () => (
          <div className="relative">
            <div
              className={`flex h-8 items-center gap-2 w-full px-2.5 rounded-lg text-xs font-semibold ${moduleConfig.bgLight} ${moduleConfig.textColor} border border-slate-200/60 dark:border-navy-600/60`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${moduleConfig.color}`} />
              <span className="flex-1 truncate">
                {isPolish ? moduleConfig.labelPl : moduleConfig.label}
              </span>
            </div>
            <select
              value={currentModule}
              onChange={() => {}}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title={isPolish ? 'Podgląd listy faz' : 'Preview phase list'}
            >
              {phaseOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isPolish ? opt.label.pl : opt.label.en}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        id: 'gate',
        label: { en: 'Next Gate', pl: 'Następna brama' },
        type: 'custom' as const,
        value: isPolish ? gateLabel.pl : gateLabel.en,
        onChange: () => {},
        readOnly: true,
        render: () => (
          <div className="relative">
            <div
              className={`flex h-8 items-center gap-2 w-full px-2.5 rounded-lg text-xs font-semibold ${gateVisual.bg} ${gateVisual.text} border ${gateAlertBorder || 'border-slate-200/60 dark:border-navy-600/60'}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${gateVisual.dot}`} />
              <span className="flex-1 truncate">{isPolish ? gateLabel.pl : gateLabel.en}</span>
            </div>
            <select
              value={gateValue}
              onChange={() => {}}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title={isPolish ? 'Podgląd możliwych kolejnych bram' : 'Preview possible next gates'}
            >
              {gateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isPolish ? opt.label.pl : opt.label.en}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        id: 'priority',
        label: { en: 'Priority', pl: 'Priorytet' },
        type: 'custom' as const,
        value: priority,
        onChange: canEditPriority ? setPriority : () => {},
        readOnly: !canEditPriority,
        alertBorderClass: priorityAlertBorder,
        render: () => (
          <div
            className="relative"
            title={
              !canEditPriority
                ? isPolish
                  ? 'Nie masz uprawnień do edycji priorytetu na tym etapie.'
                  : 'You cannot edit priority at this stage.'
                : undefined
            }
          >
            <div
              className={`flex h-8 items-center gap-2 w-full px-2.5 rounded-lg text-xs font-semibold ${currentPriorityMeta.bg} border ${priorityAlertBorder || 'border-slate-200/60 dark:border-navy-600/60'} ${currentPriorityMeta.text} ${
                !canEditPriority ? 'opacity-60' : ''
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${currentPriorityMeta.dot}`} />
              <span className="flex-1 truncate">
                {isPolish ? currentPriorityMeta.labelPl : currentPriorityMeta.label}
              </span>
            </div>
            {canEditPriority && (
              <select
                id="initiative-topbar-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {priorityOptions.map((opt) => {
                  const pm = priorityMeta[opt.value];
                  return (
                    <option key={opt.value} value={opt.value}>
                      {isPolish ? pm?.labelPl || opt.label.pl : pm?.label || opt.label.en}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        ),
      },
      {
        id: 'owner',
        label: { en: 'Owner', pl: 'Właściciel' },
        type: 'custom' as const,
        value: ownerId,
        onChange: canEditOwner ? setOwnerId : () => {},
        readOnly: !canEditOwner,
        render: () => (
          <select
            id="initiative-topbar-owner"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            disabled={!canEditOwner}
            title={
              !canEditOwner
                ? isPolish
                  ? 'Nie masz uprawnień do edycji właściciela na tym etapie.'
                  : 'You cannot edit owner at this stage.'
                : undefined
            }
            className="w-full h-8 px-2.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors"
          >
            <option value="">{isPolish ? '— Wybierz —' : '— Select —'}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: 'targetDate',
        label: { en: 'Target', pl: 'Termin' },
        type: 'custom' as const,
        value: targetDate,
        onChange: canEditTargetDate ? setTargetDate : () => {},
        readOnly: !canEditTargetDate,
        render: () => (
          <input
            id="initiative-topbar-targetDate"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            disabled={!canEditTargetDate}
            title={
              !canEditTargetDate
                ? isPolish
                  ? 'Nie masz uprawnień do edycji terminu na tym etapie.'
                  : 'You cannot edit target date at this stage.'
                : undefined
            }
            className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-600/60 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary-400 transition-colors disabled:opacity-60"
          />
        ),
      },
    ];
  }, [
    initiative,
    status,
    priority,
    ownerId,
    sponsorId,
    startDate,
    targetDate,
    tasks.length,
    tasksDone,
    users,
    isPolish,
    moduleConfig,
    statusActions,
    handleStatusAction,
    setPriority,
    setOwnerId,
    setSponsorId,
    setStartDate,
    setTargetDate,
    pendingGates.length,
    canEditPriority,
    canEditOwner,
    canEditTargetDate,
  ]);

  // ==========================================
  // N-MODE: COMMENTS CANVAS ADAPTERS (identical to Task)
  // ==========================================

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
    p === 'high' ? 'bg-red-500' : p === 'low' ? 'bg-slate-400' : 'bg-blue-500';
  const getCommentPriority = (_c: CommentItem): CommentPriority => 'normal';
  const getPriorityButtonClass = (p: CommentPriority, active: boolean) =>
    active
      ? p === 'high'
        ? 'border-red-400/80 text-red-300 bg-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.3)]'
        : p === 'low'
          ? 'border-emerald-400/80 text-emerald-300 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(16,185,129,0.3)]'
          : 'border-indigo-400/70 text-indigo-300 bg-indigo-500/15 shadow-[0_0_0_1px_rgba(129,140,248,0.2)]'
      : 'border-slate-300/55 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:border-slate-400/70 hover:text-slate-700 dark:text-slate-300';
  const getCommentPriorityLabel = (p: CommentPriority) =>
    p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal';
  const getCommentPriorityHint = (p: CommentPriority) =>
    p === 'high'
      ? isPolish
        ? 'Wymagana natychmiastowa uwaga'
        : 'Requires immediate attention'
      : p === 'low'
        ? isPolish
          ? 'Informacyjny komentarz'
          : 'Informational comment'
        : isPolish
          ? 'Standardowy komentarz'
          : 'Standard comment';

  const handleNModeSubmitComment = () => {
    if (!nCommentDraft.trim()) return;
    handleAddComment(nCommentDraft);
    setNCommentDraft('');
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    // Best-effort backend delete (comments are stored in initiative_comments)
    Api.delete(`/initiatives/${initiativeId}/comments/${commentId}`).catch(() => {});
  };

  // ==========================================
  // COMMENTS AI (Analyze with AI → proposal → apply)
  // ==========================================

  const closeCommentsAIModal = useCallback(() => {
    setShowCommentsAIModal(false);
    setCommentsAiProposal(null);
    setCommentsAiSelectedAddIdx({});
    setCommentsAiSelectedRemoveIds({});
  }, []);

  const buildCommentRemovalCandidates = useCallback(() => {
    const candidates: Array<{ commentId: string; excerpt: string; why: string }> = [];
    const seen = new Map<string, string>(); // norm -> firstId

    const normalize = (s: string) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim();

    const junkPatterns: Array<{ re: RegExp; why: string }> = [
      {
        re: /\b(test-comment|test comment|demo|dummy)\b/i,
        why: 'Test/demo placeholder — not a real delivery comment.',
      },
      {
        re: /^\s*test[-_\s]*comment\b/i,
        why: 'Test placeholder — not a real delivery comment.',
      },
      {
        re: /\b(wip|tmp|temp)\b/i,
        why: 'Temporary/WIP placeholder — low signal.',
      },
    ];

    const tooShort = (s: string) => String(s || '').trim().length < 10;
    const looksLikeGarbage = (s: string) =>
      /^\?+$/.test(s.trim()) || /^[\d\W_]+$/.test(s.trim()) || /^(comment|new comment)$/i.test(s);

    for (const c of comments) {
      const id = String((c as any)?.id || '');
      const content = String((c as any)?.content || '').trim();
      if (!id) continue;

      if (!content) {
        candidates.push({ commentId: id, excerpt: '(empty)', why: 'Empty comment — invalid.' });
        continue;
      }

      if (looksLikeGarbage(content) || tooShort(content)) {
        candidates.push({
          commentId: id,
          excerpt: content.slice(0, 140),
          why: 'Low-signal comment.',
        });
      }

      for (const p of junkPatterns) {
        if (p.re.test(content)) {
          candidates.push({ commentId: id, excerpt: content.slice(0, 140), why: p.why });
          break;
        }
      }

      const norm = normalize(content);
      if (norm) {
        const first = seen.get(norm);
        if (!first) {
          seen.set(norm, id);
        } else if (first !== id) {
          candidates.push({
            commentId: id,
            excerpt: content.slice(0, 140),
            why: 'Duplicate comment (same content/intent).',
          });
        }
      }
    }

    // De-dupe by commentId, keep first reason.
    const byId = new Map<string, (typeof candidates)[number]>();
    for (const c of candidates) {
      if (!byId.has(c.commentId)) byId.set(c.commentId, c);
    }
    return Array.from(byId.values()).slice(0, 20);
  }, [comments]);

  const proposeCommentsWithAI = useCallback(async () => {
    setIsCommentsAIProposing(true);
    try {
      const aiLanguage = isPolish ? 'pl' : 'en';
      const targetLanguageName = isPolish ? 'Polish' : 'English';
      const existingIds = new Set(comments.map((c) => String((c as any)?.id || '')));
      const removalCandidates = buildCommentRemovalCandidates();

      const compactComments = [...comments]
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 30)
        .map((c) => ({
          id: String((c as any)?.id || ''),
          author: String((c as any)?.authorName || ''),
          createdAt: String((c as any)?.createdAt || ''),
          content: String((c as any)?.content || '').slice(0, 500),
        }));

      const systemInstruction = [
        `You are a senior PMO advisor reviewing an initiative discussion thread.`,
        `Your goal is to propose HIGH-SIGNAL improvements to the Comments module (not a summary).`,
        `Rules:`,
        `- Add suggestions should be actionable, specific, and tied to delivery risk reduction.`,
        `- Prefer FEWER, better comments. 0-3 adds is fine.`,
        `- Remove suggestions should focus ONLY on placeholders/tests/duplicates/low-signal noise.`,
        `- If REMOVAL CANDIDATES are provided, you MAY remove from them, but never fabricate ids.`,
        `- Do NOT invent facts, dates, numbers, vendors, systems, or commitments not in context.`,
        `- Output language MUST be ${targetLanguageName}. Translate if needed.`,
        ``,
        `Return ONLY valid JSON (no markdown, no code fences, no commentary).`,
        `IMPORTANT: For "remove", you MUST use existing commentId values only (prefer from REMOVAL CANDIDATES). Never fabricate ids.`,
        `Schema:`,
        `{`,
        `  "add": [ { "content": string, "rationale"?: string } ],`,
        `  "remove": [ { "commentId": string, "reason": string } ],`,
        `  "note"?: string`,
        `}`,
      ].join('\n');

      const contextText = [
        `[INITIATIVE CONTEXT]`,
        `Initiative name: ${initiative?.name || ''}`,
        `Status: ${status || ''}`,
        `Priority: ${priority || ''}`,
        `Summary: ${(summary || initiative?.description || '').toString()}`,
        `Problem statement: ${(initiative?.problem_statement || '').toString()}`,
        ``,
        `[EXISTING COMMENTS]`,
        JSON.stringify(compactComments, null, 2),
        ``,
        `[REMOVAL CANDIDATES]`,
        `These are flagged by deterministic quality rules. Remove ONLY if truly low-signal:`,
        JSON.stringify(removalCandidates, null, 2),
      ].join('\n');

      const aiRes = await Api.post('/ai/refine-text?timeoutMs=20000', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Initiative comments review',
        artifactContext: {
          title: initiative?.name || '',
          status,
          priority,
          type: 'initiative',
        },
        language: aiLanguage,
      });

      const parsed = parseAIJson(String(aiRes?.text || '')) as any;
      const proposal = {
        add: Array.isArray(parsed?.add) ? parsed.add : [],
        remove: Array.isArray(parsed?.remove) ? parsed.remove : [],
        note: parsed?.note ? String(parsed.note).trim() : '',
      };

      const seenAdds = new Set<string>();
      const normalizeAdd = (s: string) =>
        String(s || '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .slice(0, 240);

      proposal.add = proposal.add
        .map((a: any) => ({
          content: String(a?.content || a?.text || a?.comment || '').trim(),
          rationale: a?.rationale ? String(a.rationale).trim() : '',
        }))
        .filter((a: any) => a.content.length > 0)
        .filter((a: any) => {
          const key = normalizeAdd(a.content);
          if (!key) return true;
          if (seenAdds.has(key)) return false;
          seenAdds.add(key);
          return true;
        })
        .slice(0, 5);

      proposal.remove = proposal.remove
        .map((r: any) => ({
          commentId: String(r?.commentId || r?.id || '').trim(),
          reason: String(r?.reason || '').trim(),
        }))
        .filter((r: any) => r.commentId && r.reason && existingIds.has(r.commentId))
        .slice(0, 10);

      const hasAny = proposal.add.length > 0 || proposal.remove.length > 0;
      if (!hasAny && !proposal.note) {
        proposal.note = isPolish
          ? 'AI nie znalazło sugestii zmian — wątek komentarzy wygląda OK.'
          : 'AI found no change suggestions — the comments thread looks good.';
      }

      setCommentsAiProposal(proposal);
      setCommentsAiSelectedAddIdx(
        Object.fromEntries(proposal.add.map((_a: any, idx: number) => [idx, true])) as Record<
          number,
          boolean
        >
      );
      setCommentsAiSelectedRemoveIds(
        Object.fromEntries(proposal.remove.map((r: any) => [r.commentId, false])) as Record<
          string,
          boolean
        >
      );
      setShowCommentsAIModal(true);
    } catch (e: any) {
      toast.error(
        e?.message ||
          (isPolish ? 'Nie udało się przeanalizować komentarzy' : 'Failed to analyze comments')
      );
    } finally {
      setIsCommentsAIProposing(false);
    }
  }, [
    buildCommentRemovalCandidates,
    comments,
    initiative,
    isPolish,
    parseAIJson,
    priority,
    status,
    summary,
  ]);

  const applyCommentsAIProposal = useCallback(async () => {
    if (!commentsAiProposal) return;
    const toAdd = commentsAiProposal.add.filter((_a, idx) => !!commentsAiSelectedAddIdx[idx]);
    const toRemove = commentsAiProposal.remove.filter(
      (r) => !!commentsAiSelectedRemoveIds[r.commentId]
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast(isPolish ? 'Brak wybranych zmian' : 'No selected changes');
      return;
    }

    if (toRemove.length > 0) {
      const ok = window.confirm(
        isPolish
          ? `Usunąć ${toRemove.length} komentarz(e)? To działanie jest nieodwracalne.`
          : `Delete ${toRemove.length} comment(s)? This action cannot be undone.`
      );
      if (!ok) return;
    }

    setIsCommentsAIProposing(true);
    try {
      for (const r of toRemove) {
        handleDeleteComment(r.commentId);
      }
      for (const a of toAdd) {
        await handleAddComment(String((a as any)?.content || '').trim());
      }

      toast.success(
        isPolish
          ? `Zastosowano sugestie AI (${toAdd.length} dodano${toRemove.length ? `, ${toRemove.length} usunięto` : ''})`
          : `Applied AI suggestions (${toAdd.length} added${toRemove.length ? `, ${toRemove.length} removed` : ''})`
      );
      closeCommentsAIModal();
    } catch {
      toast.error(isPolish ? 'Nie udało się zastosować sugestii' : 'Failed to apply suggestions');
    } finally {
      setIsCommentsAIProposing(false);
    }
  }, [
    closeCommentsAIModal,
    commentsAiProposal,
    commentsAiSelectedAddIdx,
    commentsAiSelectedRemoveIds,
    handleAddComment,
    handleDeleteComment,
    isPolish,
  ]);

  useEffect(() => {
    if (!commentsAiRequest) return;
    const run = async () => {
      try {
        await proposeCommentsWithAI();
      } finally {
        // Keep CTA-bar spinner visible until AI finishes.
        clearCommentsAiRequest();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsAiRequest?.nonce]);

  // ==========================================
  // N-MODE: ACTIVITY LOG ADAPTERS (shared ActivityLogCanvas)
  // ==========================================

  const nModeActivityEntries: NModeActivityLogEntry[] = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((e) => {
          // API returns: eventType, actorId, createdAt, oldValue, newValue, notes
          const raw = e as any;
          const notes = raw.notes as string | undefined;
          const eventType =
            typeof (raw.eventType ?? (e as any).eventType) === 'string' &&
            String(raw.eventType ?? (e as any).eventType).trim().length > 0
              ? String(raw.eventType ?? (e as any).eventType)
              : 'unknown_event';
          const eventTypeLabel =
            eventType === 'unknown_event'
              ? isPolish
                ? 'Nieznane zdarzenie'
                : 'Unknown event'
              : eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const description = notes || eventTypeLabel;
          return {
            id: e.id,
            type: eventType,
            description,
            timestamp: e.createdAt,
            userName: e.actorName || raw.actorId || undefined,
            oldValue: raw.oldValue || e.payload?.oldValue,
            newValue: raw.newValue || e.payload?.newValue,
          };
        }),
    [history]
  );

  const nModeActivityStats: ActivityStats = useMemo(() => {
    const total = history.length;
    const edited = history.filter((e) =>
      ['edit', 'status_change', 'update', 'field_change'].includes(e.eventType)
    ).length;
    const escalations = history.filter((e) =>
      ['deadline', 'priority', 'escalated', 'gate_review', 'risk_added'].includes(e.eventType)
    ).length;
    const collaboration = history.filter((e) =>
      ['comment', 'assignment', 'task_added', 'decision_added', 'stakeholder_added'].includes(
        e.eventType
      )
    ).length;
    return { total, edited, escalations, collaboration };
  }, [history]);

  const nModeActivityTypeMeta = useCallback(
    (type: string): ActivityTypeMeta => {
      const MAP: Record<string, ActivityTypeMeta> = {
        created: {
          icon: <Plus size={12} />,
          label: isPolish ? 'Utworzono' : 'Created',
          style: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30',
        },
        status_change: {
          icon: <CheckCircle size={12} />,
          label: isPolish ? 'Zmiana statusu' : 'Status change',
          style: 'text-blue-500 bg-blue-500/10 border-blue-400/30',
        },
        update: {
          icon: <Edit3 size={12} />,
          label: isPolish ? 'Aktualizacja' : 'Update',
          style: 'text-cyan-500 bg-cyan-500/10 border-cyan-400/30',
        },
        field_change: {
          icon: <Edit3 size={12} />,
          label: isPolish ? 'Edycja' : 'Edit',
          style: 'text-slate-500 bg-slate-500/10 border-slate-400/30',
        },
        edit: {
          icon: <Edit3 size={12} />,
          label: isPolish ? 'Edycja' : 'Edit',
          style: 'text-slate-500 bg-slate-500/10 border-slate-400/30',
        },
        comment: {
          icon: <MessageSquare size={12} />,
          label: isPolish ? 'Komentarz' : 'Comment',
          style: 'text-indigo-500 bg-indigo-500/10 border-indigo-400/30',
        },
        assignment: {
          icon: <User size={12} />,
          label: isPolish ? 'Przypisanie' : 'Assignment',
          style: 'text-purple-500 bg-purple-500/10 border-purple-400/30',
        },
        task_added: {
          icon: <CheckSquare size={12} />,
          label: isPolish ? 'Zadanie' : 'Task added',
          style: 'text-sky-500 bg-sky-500/10 border-sky-400/30',
        },
        decision_added: {
          icon: <Scale size={12} />,
          label: isPolish ? 'Decyzja' : 'Decision added',
          style: 'text-violet-500 bg-violet-500/10 border-violet-400/30',
        },
        risk_added: {
          icon: <AlertTriangle size={12} />,
          label: isPolish ? 'Ryzyko' : 'Risk added',
          style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
        },
        stakeholder_added: {
          icon: <Users size={12} />,
          label: isPolish ? 'Interesariusz' : 'Stakeholder',
          style: 'text-sky-500 bg-sky-500/10 border-sky-400/30',
        },
        gate_review: {
          icon: <ShieldCheck size={12} />,
          label: isPolish ? 'Przegląd bramki' : 'Gate review',
          style: 'text-emerald-500 bg-emerald-500/10 border-emerald-400/30',
        },
        deadline: {
          icon: <Calendar size={12} />,
          label: isPolish ? 'Termin' : 'Deadline',
          style: 'text-red-500 bg-red-500/10 border-red-400/30',
        },
        priority: {
          icon: <Flag size={12} />,
          label: isPolish ? 'Priorytet' : 'Priority',
          style: 'text-orange-500 bg-orange-500/10 border-orange-400/30',
        },
        escalated: {
          icon: <AlertTriangle size={12} />,
          label: isPolish ? 'Eskalacja' : 'Escalation',
          style: 'text-amber-500 bg-amber-500/10 border-amber-400/30',
        },
      };
      return (
        MAP[type] || {
          icon: <Clock size={12} />,
          label: type.replace(/_/g, ' '),
          style: 'text-slate-400 bg-slate-400/10 border-slate-300/30',
        }
      );
    },
    [isPolish]
  );

  // ==========================================
  // N-MODE: SECTION CONTENT BUILDER
  // ==========================================

  const nModeSectionsWithContent: NModeSection[] = useMemo(() => {
    return initiativeNSections.map((section) => {
      let component: React.ReactNode = null;

      switch (section.id) {
        case 'initiative-definition': {
          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Opis i kontekst' : 'Description & Context'}
                </h2>
              </div>

              {/* 1) Problem */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Problem' : 'Problem'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish
                        ? 'Jaki problem rozwiązuje ta inicjatywa'
                        : 'What problem does this initiative solve'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-problem"
                    sectionLabel={isPolish ? 'Problem' : 'Problem'}
                    currentValue={symptomDraft}
                    onApply={setSymptomDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={symptomDraft}
                  onChange={setSymptomDraft}
                  isPolish={isPolish}
                  placeholder={
                    isPolish
                      ? 'Jaki problem rozwiązujemy? Co jest nie tak?'
                      : 'What problem are we solving? What is wrong?'
                  }
                />
              </div>

              {/* 2) Proposed Solution */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Opis rozwiązania' : 'Proposed Solution'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish
                        ? 'Proponowane podejście i sposób realizacji'
                        : 'Proposed approach and implementation method'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-proposed-solution"
                    sectionLabel={isPolish ? 'Opis rozwiązania' : 'Proposed Solution'}
                    currentValue={rootCauseDraft}
                    onApply={setRootCauseDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={rootCauseDraft}
                  onChange={setRootCauseDraft}
                  isPolish={isPolish}
                  placeholder={
                    isPolish
                      ? 'Jakie rozwiązanie proponujemy? Jakie podejście?'
                      : 'What solution do we propose? What approach?'
                  }
                />
              </div>

              {/* 3) Cost of Inaction */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Koszt bezczynności' : 'Cost of Inaction'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish
                        ? 'Konsekwencje braku działania'
                        : 'Consequences of not taking action'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-cost-of-inaction"
                    sectionLabel={isPolish ? 'Koszt bezczynności' : 'Cost of Inaction'}
                    currentValue={costOfInactionDraft}
                    onApply={setCostOfInactionDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={costOfInactionDraft}
                  onChange={setCostOfInactionDraft}
                  isPolish={isPolish}
                  placeholder={
                    isPolish
                      ? 'Co się stanie jeśli nie podejmiemy działań?'
                      : 'What happens if we do nothing?'
                  }
                />
              </div>

              {/* 4) Market Context */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                      {isPolish ? 'Kontekst rynkowy' : 'Market Context'}
                    </label>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {isPolish
                        ? 'Otoczenie rynkowe, konkurencja i trendy'
                        : 'Market environment, competition and trends'}
                    </p>
                  </div>
                  <AIFieldEnhancer
                    fieldKey="initiative-market-context"
                    sectionLabel={isPolish ? 'Kontekst rynkowy' : 'Market Context'}
                    currentValue={marketContextDraft}
                    onApply={setMarketContextDraft}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                  />
                </div>
                <ExpandableNarrativeField
                  value={marketContextDraft}
                  onChange={setMarketContextDraft}
                  isPolish={isPolish}
                  placeholder={
                    isPolish
                      ? 'Kontekst rynkowy, konkurencja, trendy...'
                      : 'Market context, competition, trends...'
                  }
                />
              </div>
            </div>
          );
          break;
        }

        case 'target-state-scope': {
          const mkId = () => Math.random().toString(36).slice(2, 10);
          const addTarget = () =>
            setTargetStateItems((prev) => [...prev, { id: mkId(), text: '', done: false }]);
          const addCriteria = () =>
            setSuccessCriteriaItems((prev) => [...prev, { id: mkId(), text: '', done: false }]);
          const addDeliverable = () =>
            setDeliverableItems((prev) => [...prev, { id: mkId(), text: '', done: false }]);

          const updateTarget = (id: string, patch: Partial<{ text: string; done: boolean }>) =>
            setTargetStateItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
            );
          const updateCriteria = (id: string, patch: Partial<{ text: string; done: boolean }>) =>
            setSuccessCriteriaItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
            );
          const updateDeliverable = (id: string, patch: Partial<{ text: string; done: boolean }>) =>
            setDeliverableItems((prev) =>
              prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
            );

          const removeTarget = (id: string) =>
            setTargetStateItems((prev) => prev.filter((item) => item.id !== id));
          const removeCriteria = (id: string) =>
            setSuccessCriteriaItems((prev) => prev.filter((item) => item.id !== id));
          const removeDeliverable = (id: string) =>
            setDeliverableItems((prev) => prev.filter((item) => item.id !== id));

          const renderChecklistRow = (
            item: { id: string; text: string; done: boolean },
            onUpdate: (id: string, patch: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            placeholder: string,
            aiLabel: string,
            aiFieldKey: string
          ) => (
            <div key={item.id} className="group flex items-center gap-2 py-1.5">
              <button
                onClick={() => onUpdate(item.id, { done: !item.done })}
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  item.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 dark:border-navy-600'
                }`}
              >
                {item.done ? (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
              <input
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                placeholder={placeholder}
                className={`flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 ${
                  item.done
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              />
              <AIFieldEnhancer
                fieldKey={`${aiFieldKey}.${item.id}`}
                sectionLabel={aiLabel}
                currentValue={item.text}
                onApply={(v) => onUpdate(item.id, { text: v })}
                artifactContext={{
                  title: initiative?.name || '',
                  status,
                  priority,
                  type: 'initiative',
                }}
                iconOnly
                outputFormat="short"
              />
              <button
                onClick={() => onRemove(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          const renderChecklistCard = (
            titleEn: string,
            titlePl: string,
            helperEn: string,
            helperPl: string,
            items: Array<{ id: string; text: string; done: boolean }>,
            onAdd: () => void,
            onUpdate: (id: string, patch: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            aiFieldKey: string,
            setItems: (items: Array<{ id: string; text: string; done: boolean }>) => void,
            placeholderEn: string,
            placeholderPl: string
          ) => (
            <div className="rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {isPolish ? titlePl : titleEn}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {isPolish ? helperPl : helperEn}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={onAdd}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary-500 transition-colors"
                  >
                    <Plus size={12} />
                    {isPolish ? 'Dodaj' : 'Add item'}
                  </button>
                  <AIFieldEnhancer
                    fieldKey={aiFieldKey}
                    sectionLabel={isPolish ? titlePl : titleEn}
                    currentValue={items
                      .map((item) => item.text)
                      .filter(Boolean)
                      .join('\n')}
                    onApply={(value) => {
                      const rows = value
                        .split('\n')
                        .map((line: string) => line.replace(/^[-•*]\s*/, '').trim())
                        .filter(Boolean);
                      setItems(rows.map((row: string) => ({ id: mkId(), text: row, done: false })));
                    }}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                    outputFormat="list"
                  />
                </div>
              </div>
              <div className="min-h-[56px] border-b border-slate-200/70 dark:border-navy-700/60 pb-2">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                    {isPolish ? 'Brak pozycji' : 'No items yet'}
                  </p>
                ) : (
                  items.map((item) =>
                    renderChecklistRow(
                      item,
                      onUpdate,
                      onRemove,
                      isPolish ? placeholderPl : placeholderEn,
                      isPolish ? `${titlePl} — element listy` : `${titleEn} — list item`,
                      aiFieldKey
                    )
                  )
                )}
              </div>
            </div>
          );

          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Kryteria sukcesu' : 'Success Criteria'}
                </h2>
              </div>
              {renderChecklistCard(
                'Target State',
                'Stan docelowy',
                'Desired end state after initiative completion',
                'Pożądany stan końcowy po wdrożeniu inicjatywy',
                targetStateItems,
                addTarget,
                updateTarget,
                removeTarget,
                'initiative-target-state',
                setTargetStateItems,
                'Target state item...',
                'Element stanu docelowego...'
              )}
              {renderChecklistCard(
                'Success Criteria',
                'Kryteria sukcesu',
                'Measurable conditions to consider initiative successful',
                'Mierzalne warunki uznania inicjatywy za udaną',
                successCriteriaItems,
                addCriteria,
                updateCriteria,
                removeCriteria,
                'initiative-success-criteria',
                setSuccessCriteriaItems,
                'Success criterion...',
                'Kryterium sukcesu...'
              )}
              {renderChecklistCard(
                'Deliverables',
                'Produkty',
                'Specific outputs and results to be delivered',
                'Konkretne produkty i wyniki do dostarczenia',
                deliverableItems,
                addDeliverable,
                updateDeliverable,
                removeDeliverable,
                'initiative-deliverables',
                setDeliverableItems,
                'Deliverable...',
                'Element dostarczany...'
              )}
            </div>
          );
          break;
        }

        case 'target-success': {
          const mkId = () => Math.random().toString(36).substr(2, 9);
          const addTS = () =>
            setTargetStateItems([...targetStateItems, { id: mkId(), text: '', done: false }]);
          const addSC = () =>
            setSuccessCriteriaItems([
              ...successCriteriaItems,
              { id: mkId(), text: '', done: false },
            ]);
          const addDL = () =>
            setDeliverableItems([...deliverableItems, { id: mkId(), text: '', done: false }]);
          const updateTS = (id: string, p: Partial<{ text: string; done: boolean }>) =>
            setTargetStateItems(targetStateItems.map((c) => (c.id === id ? { ...c, ...p } : c)));
          const updateSC = (id: string, p: Partial<{ text: string; done: boolean }>) =>
            setSuccessCriteriaItems(
              successCriteriaItems.map((c) => (c.id === id ? { ...c, ...p } : c))
            );
          const updateDL = (id: string, p: Partial<{ text: string; done: boolean }>) =>
            setDeliverableItems(deliverableItems.map((d) => (d.id === id ? { ...d, ...p } : d)));
          const removeTS = (id: string) =>
            setTargetStateItems(targetStateItems.filter((c) => c.id !== id));
          const removeSC = (id: string) =>
            setSuccessCriteriaItems(successCriteriaItems.filter((c) => c.id !== id));
          const removeDL = (id: string) =>
            setDeliverableItems(deliverableItems.filter((d) => d.id !== id));

          /* ── Reusable checklist item row ── */
          const renderItem = (
            item: { id: string; text: string; done: boolean },
            onUpdate: (id: string, p: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            placeholder: string
          ) => (
            <div
              key={item.id}
              className={`group flex items-start gap-2.5 py-1.5 transition-all duration-200 ${item.done ? 'opacity-50 hover:opacity-70' : ''}`}
            >
              <button
                onClick={() => onUpdate(item.id, { done: !item.done })}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  item.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-300 dark:border-navy-600 hover:border-emerald-400'
                }`}
              >
                {item.done && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={item.text}
                onChange={(e) => onUpdate(item.id, { text: e.target.value })}
                placeholder={placeholder}
                className={`flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 transition-colors ${
                  item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'
                }`}
              />
              <button
                onClick={() => onRemove(item.id)}
                className="mt-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          /* ── Reusable checklist block (identical for all 3) ── */
          const renderBlock = (
            labelEN: string,
            labelPL: string,
            descEN: string,
            descPL: string,
            items: { id: string; text: string; done: boolean }[],
            onUpdate: (id: string, p: Partial<{ text: string; done: boolean }>) => void,
            onRemove: (id: string) => void,
            onAdd: () => void,
            placeholderEN: string,
            placeholderPL: string,
            aiFieldKey: string,
            setItems: (items: { id: string; text: string; done: boolean }[]) => void
          ) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {isPolish ? labelPL : labelEN}
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {isPolish ? descPL : descEN}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onAdd}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <Plus size={14} />
                    {isPolish ? 'Dodaj' : 'Add item'}
                  </button>
                  <AIFieldEnhancer
                    fieldKey={aiFieldKey}
                    sectionLabel={isPolish ? labelPL : labelEN}
                    currentValue={items
                      .map((c) => c.text)
                      .filter(Boolean)
                      .join('\n')}
                    onApply={(val) => {
                      const lines = val.split('\n').filter((l: string) => l.trim());
                      setItems(
                        lines.map((t: string) => ({
                          id: mkId(),
                          text: t.replace(/^[-•*]\s*/, ''),
                          done: false,
                        }))
                      );
                    }}
                    artifactContext={{
                      title: initiative?.name || '',
                      status,
                      priority,
                      type: 'initiative',
                    }}
                    outputFormat="list"
                  />
                </div>
              </div>
              <div className="border-b border-slate-200 dark:border-navy-700/40 pb-2 min-h-[40px]">
                {items.map((item) =>
                  renderItem(item, onUpdate, onRemove, isPolish ? placeholderPL : placeholderEN)
                )}
              </div>
            </div>
          );

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Kryteria sukcesu' : 'Success Criteria'}
                </h2>
              </div>

              {renderBlock(
                'Target State',
                'Stan docelowy',
                'Desired end state after initiative completion',
                'Pożądany stan końcowy po wdrożeniu inicjatywy',
                targetStateItems,
                updateTS,
                removeTS,
                addTS,
                'Target state item...',
                'Element stanu docelowego...',
                'initiative-target-state',
                setTargetStateItems
              )}

              {renderBlock(
                'Success Criteria',
                'Kryteria sukcesu',
                'Measurable conditions to consider the initiative successful',
                'Mierzalne warunki uznania inicjatywy za udaną',
                successCriteriaItems,
                updateSC,
                removeSC,
                addSC,
                'Success criterion...',
                'Kryterium sukcesu...',
                'initiative-success-criteria',
                setSuccessCriteriaItems
              )}

              {renderBlock(
                'Deliverables',
                'Produkty',
                'Specific outputs and results to be delivered',
                'Konkretne produkty i wyniki do dostarczenia',
                deliverableItems,
                updateDL,
                removeDL,
                addDL,
                'Deliverable...',
                'Deliverable...',
                'initiative-deliverables',
                setDeliverableItems
              )}
            </div>
          );
          break;
        }

        case 'scope-boundaries': {
          const mkId = () => Math.random().toString(36).substr(2, 9);
          const addInScope = () => setInScopeItems([...inScopeItems, '']);
          const addOutScope = () => setOutScopeItems([...outScopeItems, '']);
          const addKillCriteria = () => setKillCriteriaItems([...killCriteriaItems, '']);
          const updateInScope = (idx: number, val: string) =>
            setInScopeItems(inScopeItems.map((v, i) => (i === idx ? val : v)));
          const updateOutScope = (idx: number, val: string) =>
            setOutScopeItems(outScopeItems.map((v, i) => (i === idx ? val : v)));
          const updateKill = (idx: number, val: string) =>
            setKillCriteriaItems(killCriteriaItems.map((v, i) => (i === idx ? val : v)));
          const removeInScope = (idx: number) =>
            setInScopeItems(inScopeItems.filter((_, i) => i !== idx));
          const removeOutScope = (idx: number) =>
            setOutScopeItems(outScopeItems.filter((_, i) => i !== idx));
          const removeKill = (idx: number) =>
            setKillCriteriaItems(killCriteriaItems.filter((_, i) => i !== idx));

          /* ── Scope item row with colored dot ── */
          const renderScopeItem = (
            item: string,
            idx: number,
            onUpdate: (idx: number, val: string) => void,
            onRemove: (idx: number) => void,
            dotColor: 'emerald' | 'red',
            placeholder: string,
            aiLabel: string
          ) => (
            <div key={idx} className="group flex items-center gap-2 py-1">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  dotColor === 'emerald' ? 'bg-emerald-500' : 'bg-red-400'
                }`}
              />
              <input
                type="text"
                value={item}
                onChange={(e) => onUpdate(idx, e.target.value)}
                placeholder={placeholder}
                autoFocus={!item}
                className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300"
              />
              <AIFieldEnhancer
                fieldKey={`initiative.scope.${dotColor}.${idx}`}
                sectionLabel={aiLabel}
                currentValue={item}
                onApply={(v) => onUpdate(idx, v)}
                artifactContext={{
                  title: initiative?.name || '',
                  status,
                  priority,
                  type: 'initiative',
                }}
                iconOnly
                outputFormat="short"
              />
              <button
                onClick={() => onRemove(idx)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );

          component = (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Zakres i ograniczenia' : 'Scope & Kill Criteria'}
                </h2>
              </div>

              {/* ── Two-column layout: In Scope | Out of Scope with vertical divider ── */}
              <div className="flex gap-0">
                {/* ── In Scope (left) ── */}
                <div className="flex-1 space-y-2 pr-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {isPolish ? 'W zakresie' : 'In Scope'}
                        </label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {isPolish
                            ? 'Elementy, procesy i obszary objęte inicjatywą'
                            : 'Elements, processes and areas included in this initiative'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addInScope}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        <Plus size={14} />
                        {isPolish ? 'Dodaj' : 'Add item'}
                      </button>
                      <AIFieldEnhancer
                        fieldKey="initiative-scope-in"
                        sectionLabel={isPolish ? 'W zakresie' : 'In Scope'}
                        currentValue={inScopeItems.filter(Boolean).join('\n')}
                        onApply={(val) => {
                          const lines = val.split('\n').filter((l: string) => l.trim());
                          setInScopeItems(lines.map((t: string) => t.replace(/^[-•*✓]\s*/, '')));
                        }}
                        artifactContext={{
                          title: initiative?.name || '',
                          status,
                          priority,
                          type: 'initiative',
                        }}
                        outputFormat="list"
                      />
                    </div>
                  </div>
                  <div className="border-b border-slate-200 dark:border-navy-700/40 pb-2 min-h-[40px]">
                    {inScopeItems.map((item, i) =>
                      renderScopeItem(
                        item,
                        i,
                        updateInScope,
                        removeInScope,
                        'emerald',
                        isPolish ? 'Element zakresu...' : 'Scope item...',
                        isPolish ? 'W zakresie — element listy' : 'In Scope — list item'
                      )
                    )}
                    {inScopeItems.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        {isPolish ? 'Brak elementów' : 'No items yet'}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Vertical divider ── */}
                <div className="w-px bg-slate-200 dark:bg-navy-700/50 shrink-0" />

                {/* ── Out of Scope (right) ── */}
                <div className="flex-1 space-y-2 pl-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {isPolish ? 'Poza zakresem' : 'Out of Scope'}
                        </label>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {isPolish
                            ? 'Wykluczenia i ograniczenia poza zakresem'
                            : 'Exclusions and boundaries not covered'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addOutScope}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Plus size={14} />
                        {isPolish ? 'Dodaj' : 'Add item'}
                      </button>
                      <AIFieldEnhancer
                        fieldKey="initiative-scope-out"
                        sectionLabel={isPolish ? 'Poza zakresem' : 'Out of Scope'}
                        currentValue={outScopeItems.filter(Boolean).join('\n')}
                        onApply={(val) => {
                          const lines = val.split('\n').filter((l: string) => l.trim());
                          setOutScopeItems(lines.map((t: string) => t.replace(/^[-•*✗]\s*/, '')));
                        }}
                        artifactContext={{
                          title: initiative?.name || '',
                          status,
                          priority,
                          type: 'initiative',
                        }}
                        outputFormat="list"
                      />
                    </div>
                  </div>
                  <div className="border-b border-slate-200 dark:border-navy-700/40 pb-2 min-h-[40px]">
                    {outScopeItems.map((item, i) =>
                      renderScopeItem(
                        item,
                        i,
                        updateOutScope,
                        removeOutScope,
                        'red',
                        isPolish ? 'Wykluczenie...' : 'Exclusion...',
                        isPolish ? 'Poza zakresem — element listy' : 'Out of Scope — list item'
                      )
                    )}
                    {outScopeItems.length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        {isPolish ? 'Brak elementów' : 'No items yet'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Horizontal separator ── */}
              <div className="border-t border-slate-200 dark:border-navy-700/50 mt-2" />

              {/* ── Kill Criteria (full width, below) ── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        {isPolish ? 'Kryteria rezygnacji (Kill Criteria)' : 'Kill Criteria'}
                      </label>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {isPolish
                          ? 'Warunki, których spełnienie oznacza natychmiastowe zatrzymanie inicjatywy'
                          : 'Conditions that trigger immediate initiative termination'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={addKillCriteria}
                      className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Plus size={14} />
                      {isPolish ? 'Dodaj' : 'Add item'}
                    </button>
                    <AIFieldEnhancer
                      fieldKey="initiative-kill-criteria"
                      sectionLabel={isPolish ? 'Kryteria rezygnacji' : 'Kill Criteria'}
                      currentValue={killCriteriaItems.filter(Boolean).join('\n')}
                      onApply={(val) => {
                        const lines = val.split('\n').filter((l: string) => l.trim());
                        setKillCriteriaItems(lines.map((t: string) => t.replace(/^[-•*!]\s*/, '')));
                      }}
                      artifactContext={{
                        title: initiative?.name || '',
                        status,
                        priority,
                        type: 'initiative',
                      }}
                      outputFormat="list"
                    />
                  </div>
                </div>
                <div className="border-b border-red-200/40 dark:border-red-500/20 pb-2 min-h-[40px]">
                  {killCriteriaItems.map((item, i) => (
                    <div key={i} className="group flex items-center gap-2 py-1">
                      <AlertTriangle size={12} className="text-red-500 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => updateKill(i, e.target.value)}
                        placeholder={isPolish ? 'Kryterium rezygnacji...' : 'Kill criteria...'}
                        autoFocus={!item}
                        className="flex-1 bg-transparent text-sm leading-snug focus:outline-none placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300"
                      />
                      <AIFieldEnhancer
                        fieldKey={`initiative.scope.killCriteria.${i}`}
                        sectionLabel={
                          isPolish
                            ? 'Kryteria rezygnacji — element listy'
                            : 'Kill Criteria — list item'
                        }
                        currentValue={item}
                        onApply={(v) => updateKill(i, v)}
                        artifactContext={{
                          title: initiative?.name || '',
                          status,
                          priority,
                          type: 'initiative',
                        }}
                        iconOnly
                        outputFormat="short"
                      />
                      <button
                        onClick={() => removeKill(i)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {killCriteriaItems.length === 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                      {isPolish ? 'Brak kryteriów' : 'No criteria yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'tasks': {
          const TasksComp = SECTION_REGISTRY['tasks'];
          const tasksST = [...leftSections, ...rightSections].find((s) => s.key === 'tasks');
          component = (
            <div className="space-y-6">
              {/* Tasks section */}
              {tasksST && TasksComp && (
                <TasksComp sectionType={tasksST} expanded={true} onToggle={() => {}} />
              )}
              {/* Effort Profile */}
              {initiative?.effortProfile && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                    {isPolish ? 'Profil wysiłku' : 'Effort Profile'}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(initiative.effortProfile).map(([key, val]) => (
                      <div
                        key={key}
                        className="p-2.5 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60"
                      >
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize mb-1">
                          {key}
                        </p>
                        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500"
                            style={{ width: `${val as number}%` }}
                          />
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                          {val as number}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
          break;
        }

        case 'dependencies': {
          const DepsTabComp = SECTION_REGISTRY['dependencies'];
          const depsTabST = [...leftSections, ...rightSections].find(
            (s) => s.key === 'dependencies'
          );
          const depsFallbackST = {
            id: 'dependencies',
            key: 'dependencies',
            name: 'Dependencies',
            namePl: 'Zależności',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 60,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'dependencies',
            isSystem: false,
            isActive: true,
          };
          component = DepsTabComp ? (
            <div className="space-y-6">
              <DepsTabComp
                sectionType={depsTabST || depsFallbackST}
                expanded={true}
                onToggle={() => {}}
              />
            </div>
          ) : null;
          break;
        }

        case 'team': {
          const TeamComp = SECTION_REGISTRY['team'];
          const InitTeamComp = SECTION_REGISTRY['initiativeTeam'];
          const teamST = [...leftSections, ...rightSections].find((s) => s.key === 'team');
          const teamFallbackST = {
            id: 'team',
            key: 'team',
            name: 'Team',
            namePl: 'Zespół',
            description: null,
            descriptionPl: null,
            category: 'control' as const,
            columnPosition: 'right' as const,
            defaultOrder: 20,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'team',
            isSystem: true,
            isActive: true,
          };
          const initTeamFallbackST = {
            id: 'initiativeTeam',
            key: 'initiativeTeam',
            name: 'Team management',
            namePl: 'Zarządzanie zespołem',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 120,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'initiativeTeam',
            isSystem: false,
            isActive: true,
          };
          component = TeamComp ? (
            <div className="space-y-6">
              <TeamComp
                sectionType={teamST || teamFallbackST}
                expanded={true}
                onToggle={() => {}}
              />
              {InitTeamComp ? (
                <InitTeamComp
                  sectionType={initTeamFallbackST}
                  expanded={true}
                  onToggle={() => {}}
                />
              ) : null}
            </div>
          ) : null;
          break;
        }

        case 'raci': {
          const RaciComp = SECTION_REGISTRY['raciEscalation'];
          const raciFallbackST = {
            id: 'raciEscalation',
            key: 'raciEscalation',
            name: 'RACI & Escalation',
            namePl: 'RACI i eskalacja',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'right' as const,
            defaultOrder: 55,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'raciEscalation',
            isSystem: false,
            isActive: true,
          };
          component = RaciComp ? (
            <RaciComp sectionType={raciFallbackST} expanded={true} onToggle={() => {}} />
          ) : null;
          break;
        }

        case 'timeline': {
          const TimelineComp = SECTION_REGISTRY['timeline'];
          const timelineFallbackST = {
            id: 'timeline',
            key: 'timeline',
            name: 'Timeline',
            namePl: 'Harmonogram',
            description: null,
            descriptionPl: null,
            category: 'control' as const,
            columnPosition: 'right' as const,
            defaultOrder: 30,
            icon: null,
            iconColor: null,
            iconBg: null,
            componentKey: 'timeline',
            isSystem: false,
            isActive: true,
          };
          component = TimelineComp ? (
            <TimelineComp sectionType={timelineFallbackST} expanded={true} onToggle={() => {}} />
          ) : null;
          break;
        }

        case 'resources': {
          component = <ResourcesSection />;
          break;
        }

        case 'financial-analysis': {
          component = (
            <div className="flex flex-col items-center justify-center py-16 space-y-5">
              {/* Fun accountant illustration */}
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 dark:from-violet-500/15 dark:via-purple-500/10 dark:to-fuchsia-500/15 flex items-center justify-center shadow-lg shadow-violet-200/40 dark:shadow-violet-500/10">
                  <span className="text-5xl" role="img" aria-label="accountant">
                    🧮
                  </span>
                </div>
                {/* Floating decorations */}
                <span
                  className="absolute -top-2 -right-3 text-2xl animate-bounce"
                  style={{ animationDelay: '0.1s', animationDuration: '2s' }}
                >
                  📊
                </span>
                <span
                  className="absolute -bottom-1 -left-3 text-xl animate-bounce"
                  style={{ animationDelay: '0.5s', animationDuration: '2.5s' }}
                >
                  💰
                </span>
                <span
                  className="absolute -top-1 -left-4 text-lg animate-bounce"
                  style={{ animationDelay: '0.8s', animationDuration: '3s' }}
                >
                  ✨
                </span>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Analiza finansowa' : 'Financial Analysis'}
                </h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {isPolish
                    ? 'Nasz księgowy jeszcze liczy... 🤓'
                    : 'Our accountant is still crunching numbers... 🤓'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-500/20">
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
                    Coming soon
                  </span>
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'financial-impact': {
          component = (
            <div className="flex flex-col items-center justify-center py-16 space-y-5">
              {/* Fun money impact illustration */}
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-500/15 dark:via-teal-500/10 dark:to-cyan-500/15 flex items-center justify-center shadow-lg shadow-emerald-200/40 dark:shadow-emerald-500/10">
                  <span className="text-5xl" role="img" aria-label="money chart">
                    📈
                  </span>
                </div>
                {/* Floating decorations */}
                <span
                  className="absolute -top-2 -right-3 text-2xl animate-bounce"
                  style={{ animationDelay: '0.2s', animationDuration: '2.2s' }}
                >
                  🪙
                </span>
                <span
                  className="absolute -bottom-1 -left-3 text-xl animate-bounce"
                  style={{ animationDelay: '0.6s', animationDuration: '2.8s' }}
                >
                  💸
                </span>
                <span
                  className="absolute top-0 -left-4 text-lg animate-bounce"
                  style={{ animationDelay: '1s', animationDuration: '3s' }}
                >
                  🎯
                </span>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Wpływ finansowy' : 'Financial Impact'}
                </h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {isPolish
                    ? 'Pieniądze się liczą... dosłownie! 💵'
                    : 'The money is counting itself... literally! 💵'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20">
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Coming soon
                  </span>
                </div>
              </div>
            </div>
          );
          break;
        }

        case 'risk-raid': {
          // N-mode Risk & RAID — uses shared RaidCanvas component
          const nModeRaidItems = raidItems.map((r: any) => ({
            id: r.id,
            type: r.type as any,
            title: r.title,
            description: r.description || '',
            probability: r.probability || undefined,
            impact: (r.severity || 'MEDIUM').toLowerCase(),
            category: r.category || undefined,
            mitigation: r.mitigation || r.mitigationPlan || '',
            contingency: r.contingency || '',
            proposedAction: r.proposedAction || '',
            status: (r.status || 'OPEN').toLowerCase(),
            responseStrategy: r.responseStrategy || undefined,
            owner: r.owner || r.ownerName || '',
            dueDate: r.dueDate || '',
            source: r.source || '',
          }));
          const nModeRaidUsers = users.map((u: any) => ({
            id: u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id,
          }));
          component = (
            <NModeRaidCanvas
              items={nModeRaidItems}
              onAddItem={(type: any) => {
                const newItem = {
                  id: `raid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  type,
                  title: '',
                  severity: 'MEDIUM' as const,
                  status: 'OPEN',
                  owner: '',
                  mitigationPlan: '',
                };
                setRaidItems((prev: any) => [newItem, ...prev]);
              }}
              onUpdateItem={(id: string, updates: any) => {
                setRaidItems((prev: any) =>
                  prev.map((item: any) => {
                    if (item.id !== id) return item;
                    const patch: any = { ...item };
                    if (updates.title !== undefined) patch.title = updates.title;
                    if (updates.type !== undefined) patch.type = updates.type;
                    if (updates.impact !== undefined) patch.severity = updates.impact.toUpperCase();
                    if (updates.status !== undefined) patch.status = updates.status.toUpperCase();
                    if (updates.owner !== undefined) patch.owner = updates.owner;
                    if (updates.mitigation !== undefined) patch.mitigationPlan = updates.mitigation;
                    if (updates.probability !== undefined) patch.probability = updates.probability;
                    if (updates.category !== undefined) patch.category = updates.category;
                    if (updates.contingency !== undefined) patch.contingency = updates.contingency;
                    if (updates.proposedAction !== undefined)
                      patch.proposedAction = updates.proposedAction;
                    if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate;
                    if (updates.source !== undefined) patch.source = updates.source;
                    if (updates.responseStrategy !== undefined)
                      patch.responseStrategy = updates.responseStrategy;
                    if (updates.description !== undefined) patch.description = updates.description;
                    return patch;
                  })
                );
              }}
              onRemoveItem={(id: string) => {
                setRaidItems((prev: any) => prev.filter((item: any) => item.id !== id));
              }}
              onConvertToIssue={(id: string) => {
                setRaidItems((prev: any) =>
                  prev.map((item: any) => {
                    if (item.id !== id) return item;
                    return {
                      ...item,
                      type: 'issue',
                      status: 'OPEN',
                      source: `${isPolish ? 'Konwersja z' : 'Converted from'} ${item.type}: ${item.title}`,
                    };
                  })
                );
              }}
              onAIGenerate={() => requestRaidAi()}
              isGeneratingAI={!!raidAiRequest || isRaidAIProposing}
              locked={!canEditCards}
              artifactContext={{
                title: initiative?.title || initiative?.name || '',
                status: status || '',
                priority: priority || '',
                type: 'initiative',
              }}
              fieldKeyPrefix="init"
              users={nModeRaidUsers}
            />
          );
          break;
        }

        case 'decisions': {
          const DecisionsComp = SECTION_REGISTRY['decisions'];
          const decisionsST = [...leftSections, ...rightSections].find(
            (s) => s.key === 'decisions'
          );
          const decisionsFallbackST = {
            id: 'decisions',
            key: 'decisions',
            name: 'Decisions',
            namePl: 'Decyzje',
            description: null,
            descriptionPl: null,
            category: 'content' as const,
            columnPosition: 'left' as const,
            defaultOrder: 60,
            icon: 'Scale',
            iconColor: 'text-amber-500',
            iconBg: null,
            componentKey: 'decisions',
            isSystem: false,
            isActive: true,
          };
          component = DecisionsComp ? (
            <DecisionsComp
              sectionType={decisionsST || decisionsFallbackST}
              expanded={true}
              onToggle={() => {}}
            />
          ) : null;
          break;
        }

        case 'gates': {
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Bramy' : 'Gates'}
                </h2>
              </div>

              {/* Full lifecycle gate workflow table (13 stages) */}
              <InitiativeGatesWorkflowTable />
            </div>
          );
          break;
        }

        case 'comments': {
          const selectedAddCount = commentsAiProposal
            ? commentsAiProposal.add.reduce(
                (sum, _a, idx) => sum + (commentsAiSelectedAddIdx[idx] ? 1 : 0),
                0
              )
            : 0;
          const selectedRemoveCount = commentsAiProposal
            ? commentsAiProposal.remove.reduce(
                (sum, r) => sum + (commentsAiSelectedRemoveIds[r.commentId] ? 1 : 0),
                0
              )
            : 0;

          component = (
            <>
              <CommentsCanvas
                comments={nModeComments}
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
                onAIEnhance={() => handleGenerateAI('comments')}
                isAIEnhancing={isGeneratingAI === 'comments'}
                locked={!canEditCards}
                getPriorityDotClass={getPriorityDotClass}
                getCommentPriority={getCommentPriority}
                getPriorityButtonClass={getPriorityButtonClass}
                getCommentPriorityLabel={getCommentPriorityLabel}
                getCommentPriorityHint={getCommentPriorityHint}
              />

              {/* AI proposal modal (Analyze with AI → add/remove) */}
              {showCommentsAIModal && commentsAiProposal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
                  <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
                    <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                          {isPolish
                            ? 'Propozycje zmian w komentarzach (AI)'
                            : 'Proposed comment changes (AI)'}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {isPolish
                            ? 'Zaznacz elementy do dodania/usunięcia, a następnie kliknij „Zastosuj”.'
                            : 'Select items to add/remove, then click “Apply”.'}
                        </p>
                      </div>
                      <button
                        onClick={closeCommentsAIModal}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                        title={isPolish ? 'Zamknij' : 'Close'}
                        disabled={isCommentsAIProposing}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
                      {commentsAiProposal.note ? (
                        <Callout variant="purple" compact title={isPolish ? 'AI' : 'AI'}>
                          {commentsAiProposal.note}
                        </Callout>
                      ) : null}

                      {/* To remove (top) */}
                      <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Do wywalenia' : 'To remove'} (
                            {commentsAiProposal.remove.length})
                          </span>
                          {commentsAiProposal.remove.length > 0 && (
                            <button
                              onClick={() =>
                                setCommentsAiSelectedRemoveIds(
                                  Object.fromEntries(
                                    commentsAiProposal.remove.map((r) => [r.commentId, true])
                                  ) as Record<string, boolean>
                                )
                              }
                              className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              disabled={isCommentsAIProposing}
                            >
                              {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                            </button>
                          )}
                        </div>

                        {commentsAiProposal.remove.length === 0 ? (
                          <EmptyStateInline
                            icon={Trash2}
                            dashed={false}
                            className="p-5"
                            message={
                              isPolish
                                ? 'AI nie zasugerowało usunięć.'
                                : 'No removal suggestions from AI.'
                            }
                            hint={
                              isPolish
                                ? 'Jeśli wątek wygląda dobrze, AI może nie proponować destrukcyjnych zmian.'
                                : 'If the thread looks good, AI may avoid destructive changes.'
                            }
                          />
                        ) : (
                          <div className="space-y-1.5">
                            {commentsAiProposal.remove.map((r) => {
                              const existing = comments.find(
                                (c) => String((c as any)?.id) === String(r.commentId)
                              );
                              const title = existing
                                ? String((existing as any)?.content || '').slice(0, 120)
                                : r.commentId;
                              return (
                                <label
                                  key={r.commentId}
                                  className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!commentsAiSelectedRemoveIds[r.commentId]}
                                    onChange={(e) =>
                                      setCommentsAiSelectedRemoveIds((prev) => ({
                                        ...prev,
                                        [r.commentId]: e.target.checked,
                                      }))
                                    }
                                    className="mt-1"
                                    disabled={isCommentsAIProposing}
                                  />
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium text-slate-800 dark:text-white">
                                      {title || r.commentId}
                                    </span>
                                    <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                                      {r.reason}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* To add */}
                      <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {isPolish ? 'Do dodania' : 'To add'} ({commentsAiProposal.add.length})
                          </span>
                          {commentsAiProposal.add.length > 0 && (
                            <button
                              onClick={() =>
                                setCommentsAiSelectedAddIdx(
                                  Object.fromEntries(
                                    commentsAiProposal.add.map((_a, idx) => [idx, true])
                                  ) as Record<number, boolean>
                                )
                              }
                              className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              disabled={isCommentsAIProposing}
                            >
                              {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                            </button>
                          )}
                        </div>

                        {commentsAiProposal.add.length === 0 ? (
                          <EmptyStateInline
                            icon={Plus}
                            dashed={false}
                            className="p-5"
                            message={
                              isPolish ? 'Brak propozycji do dodania.' : 'No additions proposed.'
                            }
                            hint={
                              isPolish
                                ? 'Jeśli wątek jest kompletny, AI może nie dodawać komentarzy.'
                                : 'If the thread is complete, AI may not add new comments.'
                            }
                          />
                        ) : (
                          <div className="space-y-1.5">
                            {commentsAiProposal.add.map((a, idx) => (
                              <label
                                key={idx}
                                className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!commentsAiSelectedAddIdx[idx]}
                                  onChange={(e) =>
                                    setCommentsAiSelectedAddIdx((prev) => ({
                                      ...prev,
                                      [idx]: e.target.checked,
                                    }))
                                  }
                                  className="mt-1"
                                  disabled={isCommentsAIProposing}
                                />
                                <div className="min-w-0">
                                  <span className="text-sm font-medium text-slate-800 dark:text-white whitespace-pre-wrap">
                                    {a.content}
                                  </span>
                                  {a.rationale ? (
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                      {a.rationale}
                                    </p>
                                  ) : null}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Plan (bottom) */}
                      <Callout
                        variant="purple"
                        title={isPolish ? 'Plan' : 'Plan'}
                        compact
                        className="rounded-xl"
                      >
                        <ul className="list-disc pl-4 space-y-1">
                          <li>
                            {isPolish
                              ? `Usuń zaznaczone komentarze: ${selectedRemoveCount}.`
                              : `Remove selected comments: ${selectedRemoveCount}.`}
                          </li>
                          <li>
                            {isPolish
                              ? `Dodaj zaznaczone komentarze: ${selectedAddCount}.`
                              : `Add selected comments: ${selectedAddCount}.`}
                          </li>
                        </ul>
                      </Callout>
                    </div>

                    <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
                      <button
                        onClick={closeCommentsAIModal}
                        disabled={isCommentsAIProposing}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
                      >
                        {isPolish ? 'Anuluj' : 'Cancel'}
                      </button>
                      <button
                        onClick={() => void applyCommentsAIProposal()}
                        disabled={isCommentsAIProposing}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                      >
                        {isCommentsAIProposing ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : null}
                        {isPolish ? 'Zastosuj' : 'Apply'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
          break;
        }

        case 'activity-log': {
          component = (
            <ActivityLogCanvas
              entries={nModeActivityEntries}
              stats={nModeActivityStats}
              typeMeta={nModeActivityTypeMeta}
            />
          );
          break;
        }

        case 'kpi': {
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'KPI i korzyści' : 'KPIs & Benefits'}
                </h2>
                <div className="inline-flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateKpi((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary-500 transition-colors"
                  >
                    <Plus size={12} />+ Add KPI
                  </button>
                </div>
              </div>
              {showCreateKpi && (
                <div className="rounded-2xl border border-slate-200/70 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 px-4 py-3">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {isPolish
                      ? 'W przygotowaniu. Finalnie KPI będą zarządzane w zakładce Benefits.'
                      : 'In progress. KPI management will be handled in the Benefits tab.'}
                  </p>
                </div>
              )}
              {editingKpiId && (
                <div className="rounded-2xl border border-indigo-300/70 dark:border-indigo-500/40 bg-indigo-50/30 dark:bg-indigo-500/5 p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
                  <input
                    value={editKpiName}
                    onChange={(e) => setEditKpiName(e.target.value)}
                    placeholder={isPolish ? 'Nazwa KPI' : 'KPI name'}
                    className="md:col-span-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white/90 dark:bg-navy-900/70 text-sm"
                  />
                  <input
                    value={editKpiUnit}
                    onChange={(e) => setEditKpiUnit(e.target.value)}
                    placeholder={isPolish ? 'Jednostka' : 'Unit'}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white/90 dark:bg-navy-900/70 text-sm"
                  />
                  <input
                    value={editKpiBaseline}
                    onChange={(e) => setEditKpiBaseline(e.target.value)}
                    placeholder="Baseline"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white/90 dark:bg-navy-900/70 text-sm"
                  />
                  <input
                    value={editKpiCurrent}
                    onChange={(e) => setEditKpiCurrent(e.target.value)}
                    placeholder={isPolish ? 'Obecnie' : 'Current'}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white/90 dark:bg-navy-900/70 text-sm"
                  />
                  <input
                    value={editKpiTarget}
                    onChange={(e) => setEditKpiTarget(e.target.value)}
                    placeholder="Target"
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white/90 dark:bg-navy-900/70 text-sm"
                  />
                  <div className="md:col-span-6 flex justify-end gap-2">
                    <button
                      onClick={cancelEditKpi}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={saveEditKpi}
                      disabled={!editKpiName.trim() || !editKpiUnit.trim()}
                      className="px-3 py-1.5 rounded-lg border border-indigo-400/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 text-xs font-medium disabled:opacity-50"
                    >
                      {isPolish ? 'Zapisz zmiany' : 'Save changes'}
                    </button>
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-navy-700/60">
                      <th className="text-left py-2 pr-2">{isPolish ? 'KPI' : 'KPI'}</th>
                      <th className="text-left py-2 pr-2">{isPolish ? 'Jednostka' : 'Unit'}</th>
                      <th className="text-left py-2 pr-2">{isPolish ? 'Baza' : 'Baseline'}</th>
                      <th className="text-left py-2 pr-2">{isPolish ? 'Obecnie' : 'Current'}</th>
                      <th className="text-left py-2 pr-2">{isPolish ? 'Cel' : 'Target'}</th>
                      <th className="text-right py-2">{isPolish ? 'Tracking' : 'Tracking'}</th>
                      <th className="text-right py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
                    {localKpis.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                        >
                          {isPolish
                            ? 'Brak KPI. Kliknij "+ Nowy", aby dodać pierwszy KPI.'
                            : 'No KPIs defined yet. Click "+ New" to add the first KPI.'}
                        </td>
                      </tr>
                    ) : (
                      localKpis.map((kpi) => (
                        <tr key={kpi.id}>
                          <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">
                            {toEnglishKpiName(kpi.name, isPolish)}
                          </td>
                          <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                            {kpi.unit || '—'}
                          </td>
                          <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                            {kpi.baseline || '—'}
                          </td>
                          <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                            {kpi.current || '—'}
                          </td>
                          <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">
                            {kpi.target || '—'}
                          </td>
                          <td className="py-2 text-right">
                            <span className="inline-flex items-center rounded-md border border-emerald-300/50 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              {isPolish ? 'Benefits' : 'Benefits'}
                            </span>
                          </td>
                          <td className="py-2 text-right relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setKpiMenuId((prev) => (prev === kpi.id ? null : kpi.id));
                              }}
                              className="inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-navy-700/60 transition-colors"
                              title={isPolish ? 'Akcje KPI' : 'KPI actions'}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {kpiMenuId === kpi.id && (
                              <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                                <button
                                  onClick={() => {
                                    setKpiMenuId(null);
                                    startEditKpi(kpi);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                                >
                                  <Edit3 size={13} />
                                  {isPolish ? 'Edytuj' : 'Edit'}
                                </button>
                                <button
                                  onClick={() => {
                                    setKpiMenuId(null);
                                    void duplicateKpi(kpi);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                                >
                                  <Copy size={13} />
                                  {isPolish ? 'Duplikuj' : 'Duplicate'}
                                </button>
                                <div className="my-1 border-t border-slate-100 dark:border-navy-700/50" />
                                <button
                                  onClick={() => {
                                    setKpiMenuId(null);
                                    const ok = window.confirm(
                                      isPolish ? 'Usunąć to KPI?' : 'Delete this KPI?'
                                    );
                                    if (ok) removeKpi(kpi.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 size={13} />
                                  {isPolish ? 'Usuń' : 'Delete'}
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
          );
          break;
        }

        case 'watchers': {
          component = (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Obserwatorzy' : 'Watchers'}
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {watchers.length}
                </span>
              </div>
              {watchers.length === 0 ? (
                <div className="p-5 rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 text-sm text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Brak obserwatorów dla tej inicjatywy.'
                    : 'No watchers for this initiative yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {watchers.map((watcher) => (
                    <div
                      key={watcher.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {watcher.name ||
                            users.find((u) => u.id === watcher.userId)?.firstName ||
                            watcher.userId}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {watcher.email ||
                            users.find((u) => u.id === watcher.userId)?.email ||
                            '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          break;
        }

        // ── Attachments & Links (shared AttachmentsLinksCanvas — same as Task) ──
        case 'attachments-links': {
          component = (
            <AttachmentsLinksCanvas
              attachments={attachments}
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
              readOnly={!canEditCards}
            />
          );
          break;
        }

        // ── V4-IDEA-09: Used in (backlinks) — LinkGraph parity with Ideas/Notebook/Tools ──
        case 'used-in': {
          const openBacklinkItem = (sourceType: string, sourceId: string) => {
            window.dispatchEvent(
              new CustomEvent('mywork-open-item', {
                detail: { type: sourceType, id: sourceId, name: `${sourceType} ${sourceId}` },
              })
            );
          };
          component = (
            <EmbeddedView
              title={isPolish ? 'Użyte w (powiązania)' : 'Used in (backlinks)'}
              count={initiativeBacklinks.length}
              loading={initiativeBacklinksLoading}
              readOnly
              viewModes={['list']}
            >
              {initiativeBacklinks.length === 0 && !initiativeBacklinksLoading ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  {isPolish ? 'Brak powiązań' : 'No links yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {initiativeBacklinks.slice(0, 10).map((bl) => (
                    <div
                      key={bl.id}
                      className="rounded-xl border border-slate-200/40 dark:border-white/[0.04] bg-white/40 dark:bg-white/[0.02] p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                          {getSourceDisplayLabel(bl.sourceType, isPolish)}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {bl.sourceId}
                        </div>
                      </div>
                      <button
                        onClick={() => openBacklinkItem(bl.sourceType, bl.sourceId)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </EmbeddedView>
          );
          break;
        }
      }

      return { ...section, component };
    });
  }, [
    initiativeNSections,
    initiative,
    isPolish,
    summary,
    setSummary,
    tasks,
    tasksDone,
    tasksInProgress,
    ownerName,
    startDate,
    endDate,
    targetDate,
    riskCount,
    criticalRaids,
    pendingGates,
    comments,
    users,
    sponsorId,
    leftSections,
    rightSections,
    decisions,
    raidItems,
    stakeholders,
    attachments,
    linkedItems,
    watchers,
    history,
    nModeActivityEntries,
    nModeActivityStats,
    nModeActivityTypeMeta,
    // CommentsCanvas state
    nModeComments,
    nCommentDraft,
    nCommentPriority,
    nCommentDateFilter,
    nCommentSortOrder,
    // Checklist & draft states — required so useMemo re-computes when items change
    targetStateItems,
    successCriteriaItems,
    deliverableItems,
    inScopeItems,
    outScopeItems,
    killCriteriaItems,
    symptomDraft,
    rootCauseDraft,
    costOfInactionDraft,
    marketContextDraft,
    localKpis,
    showCreateKpi,
    kpiMenuId,
    editingKpiId,
    editKpiName,
    editKpiUnit,
    editKpiBaseline,
    editKpiCurrent,
    editKpiTarget,
    resourceItems,
    budgetDraft,
    resourceTools,
    showCreateResource,
    newResourceName,
    newResourceRole,
    newResourceAllocation,
    newResourceTool,
    showCreateDecision,
    newDecisionTitle,
    showCreateRaid,
    newRaidTitle,
    newRaidType,
    newRaidSeverity,
    newRaidDescription,
    isGeneratingAI,
    isMutating,
    handleCreateDecision,
    onOpenDecision,
    setStartDate,
    setEndDate,
    handleCreateRaid,
    startEditKpi,
    cancelEditKpi,
    saveEditKpi,
    duplicateKpi,
    removeKpi,
    // AttachmentsLinksCanvas handlers
    handleUploadAttachments,
    handleDeleteAttachment,
    handleAddLinkedItem,
    handleRemoveLinkedItem,
    searchLinkedItems,
    openLinkedItemTarget,
    initiativeBacklinks,
    initiativeBacklinksLoading,
  ]);

  const orderedNModeSectionsWithContent: NModeSection[] = useMemo(() => {
    if (!nModeSectionOrder || nModeSectionOrder.length === 0) return nModeSectionsWithContent;

    const byId = new Map(nModeSectionsWithContent.map((section) => [section.id, section]));
    const ordered = nModeSectionOrder
      .map((id) => byId.get(id))
      .filter((section): section is NModeSection => Boolean(section));
    const missing = nModeSectionsWithContent.filter(
      (section) => !nModeSectionOrder.includes(section.id)
    );

    return [...ordered, ...missing];
  }, [nModeSectionsWithContent, nModeSectionOrder]);

  useEffect(() => {
    if (orderedNModeSectionsWithContent.length === 0) return;
    if (!orderedNModeSectionsWithContent.some((section) => section.id === activeNSection)) {
      setActiveNSection(orderedNModeSectionsWithContent[0].id);
    }
  }, [orderedNModeSectionsWithContent, activeNSection]);

  // N-mode status actions for NModeActionBar
  // Dynamically built from statusActions (workflow transitions) + contextActions (create buttons)
  const nModeActions: NModeAction[] = useMemo(() => {
    const actions: NModeAction[] = [];

    // Helper: pick icon based on action variant and target status
    const getActionIcon = (sa: StatusAction) => {
      if (sa.variant === 'danger' && sa.targetStatus === InitiativeStatus.CANCELLED) return XCircle;
      if (sa.variant === 'danger') return AlertTriangle;
      if (sa.variant === 'secondary' && sa.targetStatus === InitiativeStatus.DRAFT) return Undo2;
      if (sa.variant === 'secondary' && sa.targetStatus === InitiativeStatus.ARCHIVED)
        return Archive;
      if (sa.targetStatus === InitiativeStatus.EXECUTING) return Play;
      return CheckSquare;
    };

    // Helper: map StatusAction variant to NModeAction variant
    const mapVariant = (sa: StatusAction): 'success' | 'danger' | 'neutral' => {
      if (sa.variant === 'primary') return 'success';
      if (sa.variant === 'danger') return 'danger';
      return 'neutral';
    };

    // 1. Primary status actions first (forward progress)
    for (const sa of statusActions.filter((a) => a.variant === 'primary')) {
      actions.push({
        id: `status-${sa.targetStatus}`,
        label: { en: sa.label, pl: sa.labelPl },
        icon: getActionIcon(sa),
        variant: 'success',
        onClick: () => handleStatusAction(sa),
        disabled: isMutating,
      });
    }

    // 2. Context-dependent create actions (between status actions)
    if (contextActions.includes('task')) {
      actions.push({
        id: 'new-task',
        label: { en: 'New Task', pl: 'Nowe zadanie' },
        icon: CheckSquare,
        variant: 'neutral',
        onClick: () => {
          toggleSection('tasks');
          setShowCreateTask(true);
        },
      });
    }
    if (contextActions.includes('decision')) {
      actions.push({
        id: 'new-decision',
        label: { en: 'New Decision', pl: 'Nowa decyzja' },
        icon: Scale,
        variant: 'neutral',
        onClick: () => {
          toggleSection('decisions');
          setShowCreateDecision(true);
        },
      });
    }
    if (contextActions.includes('raid')) {
      actions.push({
        id: 'add-raid',
        label: { en: 'Add RAID', pl: 'Dodaj RAID' },
        icon: AlertTriangle,
        variant: 'neutral',
        onClick: () => {
          toggleSection('raid');
          setShowCreateRaid(true);
        },
      });
    }

    // 3. Secondary actions (backward/alternative)
    for (const sa of statusActions.filter((a) => a.variant === 'secondary')) {
      actions.push({
        id: `status-${sa.targetStatus}-secondary`,
        label: { en: sa.label, pl: sa.labelPl },
        icon: getActionIcon(sa),
        variant: mapVariant(sa),
        onClick: () => handleStatusAction(sa),
        disabled: isMutating,
      });
    }

    // 4. Danger actions last (block, cancel, reject)
    for (const sa of statusActions.filter((a) => a.variant === 'danger')) {
      actions.push({
        id: `status-${sa.targetStatus}-danger`,
        label: { en: sa.label, pl: sa.labelPl },
        icon: getActionIcon(sa),
        variant: 'danger',
        onClick: () => handleStatusAction(sa),
        disabled: isMutating,
      });
    }

    return actions;
  }, [
    statusActions,
    contextActions,
    handleStatusAction,
    isMutating,
    toggleSection,
    setShowCreateTask,
    setShowCreateDecision,
    setShowCreateRaid,
  ]);

  // ==========================================
  // LOADING & ERROR STATES
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !initiative) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-slate-500">{error || 'Initiative not found'}</p>
        {onBack && (
          <button onClick={onBack} className="mt-4 text-purple-500 hover:underline">
            {isPolish ? 'Wróć' : 'Go back'}
          </button>
        )}
      </div>
    );
  }

  // C-mode uses the compact panel surface in embedded mode.
  if (presentationMode === 'c') {
    return (
      <InitiativeContext.Provider value={contextValue}>
        <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 p-4">
          <InitiativeCompactPanel
            initiative={initiative as any}
            initiativeId={initiativeId}
            isOpen
            onClose={onBack || (() => setPresentationMode('n'))}
            onOpenFull={(updated) => {
              setInitiative((prev: any) => ({ ...(prev || {}), ...(updated || {}) }));
              setPresentationMode('n');
            }}
            onUpdate={(updated) => {
              setInitiative((prev: any) => ({ ...(prev || {}), ...(updated || {}) }));
              if (updated?.status) {
                onStatusChange?.(String(updated.status));
              }
            }}
            mode="embedded"
            users={users as any}
          />
        </div>
      </InitiativeContext.Provider>
    );
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <InitiativeContext.Provider value={contextValue}>
      {showRaidAIModal && raidAiProposal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Propozycje zmian w RAID (AI)' : 'Proposed RAID changes (AI)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPolish
                    ? 'Zaznacz elementy do dodania/usunięcia, a następnie kliknij „Zastosuj”.'
                    : 'Select items to add/remove, then click “Apply”.'}
                </p>
              </div>
              <button
                onClick={closeRaidAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPolish ? 'Zamknij' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {raidAiNoSuggestionsMessage ? (
                <Callout variant="purple" compact title={isPolish ? 'AI' : 'AI'}>
                  {raidAiNoSuggestionsMessage}
                </Callout>
              ) : null}

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do wywalenia' : 'To remove'} ({raidAiProposal.remove.length})
                  </span>
                  {raidAiProposal.remove.length > 0 && (
                    <button
                      onClick={() =>
                        setRaidAiSelectedRemoveIds(
                          Object.fromEntries(
                            raidAiProposal.remove.map((r) => [r.raidId, true])
                          ) as Record<string, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  )}
                </div>

                {raidAiProposal.remove.length === 0 ? (
                  <EmptyStateInline
                    icon={Trash2}
                    dashed={false}
                    className="p-5"
                    message={
                      isPolish ? 'AI nie zasugerowało usunięć.' : 'No removal suggestions from AI.'
                    }
                    hint={
                      isPolish
                        ? 'Jeśli RAID jest OK, AI może nie zaproponować zmian.'
                        : 'If the RAID log is already good, AI may suggest no changes.'
                    }
                  />
                ) : (
                  <div className="space-y-1.5">
                    {raidAiProposal.remove.map((r) => {
                      const existing = raidItems.find(
                        (x: any) => String(x?.id) === String(r.raidId)
                      );
                      return (
                        <label
                          key={r.raidId}
                          className="flex items-start gap-2 p-2 rounded-xl bg-amber-50/40 dark:bg-amber-500/5 hover:bg-amber-50/70 dark:hover:bg-amber-500/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!raidAiSelectedRemoveIds[r.raidId]}
                            onChange={(e) =>
                              setRaidAiSelectedRemoveIds((prev) => ({
                                ...prev,
                                [r.raidId]: e.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {existing?.title || r.raidId}
                            </span>
                            <p className="text-xs text-amber-800/90 dark:text-amber-200 mt-0.5">
                              {r.reason}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do dodania' : 'To add'} ({raidAiProposal.add.length})
                  </span>
                  {raidAiProposal.add.length > 0 && (
                    <button
                      onClick={() =>
                        setRaidAiSelectedAddIdx(
                          Object.fromEntries(
                            raidAiProposal.add.map((_, idx) => [idx, true])
                          ) as Record<number, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  )}
                </div>

                {raidAiProposal.add.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={isPolish ? 'Brak propozycji do dodania.' : 'No additions proposed.'}
                    hint={
                      isPolish
                        ? 'AI może zwrócić tylko usunięcia lub brak zmian.'
                        : 'AI may return only removals or no changes.'
                    }
                  />
                ) : (
                  <div className="space-y-1.5">
                    {raidAiProposal.add.map((x, idx) => (
                      <label
                        key={idx}
                        className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!raidAiSelectedAddIdx[idx]}
                          onChange={(e) =>
                            setRaidAiSelectedAddIdx((prev) => ({
                              ...prev,
                              [idx]: e.target.checked,
                            }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800 dark:text-white">
                              {x.title}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-navy-700/60 text-slate-600 dark:text-slate-300">
                              {String(x.type || '').toUpperCase()}
                            </span>
                            {x.severity ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-navy-700/60 text-slate-600 dark:text-slate-300">
                                {x.severity}
                              </span>
                            ) : null}
                          </div>
                          {x.description ? (
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap">
                              {x.description}
                            </p>
                          ) : null}
                          {x.rationale ? (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {x.rationale}
                            </p>
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <Callout
                variant="purple"
                title={isPolish ? 'Plan' : 'Plan'}
                compact
                className="rounded-xl"
              >
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {(isPolish
                      ? 'Usuń zaznaczone elementy RAID: '
                      : 'Remove selected RAID items: ') +
                      raidAiProposal.remove.reduce(
                        (sum, r) => sum + (raidAiSelectedRemoveIds[r.raidId] ? 1 : 0),
                        0
                      )}
                  </li>
                  <li>
                    {(isPolish ? 'Dodaj zaznaczone elementy RAID: ' : 'Add selected RAID items: ') +
                      raidAiProposal.add.reduce(
                        (sum, _x, idx) => sum + (raidAiSelectedAddIdx[idx] ? 1 : 0),
                        0
                      )}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeRaidAIModal}
                disabled={isRaidAIProposing}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors disabled:opacity-50"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={() => void applyRaidAIProposal()}
                disabled={isRaidAIProposing || !canEditCards}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                title={
                  !canEditCards
                    ? isPolish
                      ? 'Brak uprawnień do edycji na tym etapie inicjatywy.'
                      : 'No edit permission at this initiative stage.'
                    : undefined
                }
              >
                {isRaidAIProposing ? <Loader2 size={13} className="animate-spin" /> : null}
                {isPolish ? 'Zastosuj' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
        {/* ═══════════════════════════════════════════════════════════════
            N-MODE RENDER
            ═══════════════════════════════════════════════════════════════ */}
        {presentationMode === 'n' ? (
          <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <NModeHeader
                title={titleDraft || initiative?.name || ''}
                onTitleChange={setTitleDraft}
                titleReadOnly={!canEditCards}
                titleInputId={titleInputId}
                artifactId={initiativeId}
                artifactType="initiative"
                onSave={() => handleSave(false)}
                saving={isMutating}
                isDirty={hasUnsavedChanges}
                onChat={handleOpenChat}
                onClose={onBack || (() => {})}
                statusDotColor={statusMeta.dotColor}
                presentationMode={presentationMode}
                onPresentationModeChange={setPresentationMode}
                buildArtifactCode={(type: string, id: string) => buildArtifactCode(type as any, id)}
              />

              <div className="col-span-full space-y-4 mt-4">
                <NModePropertiesStrip fields={nModePropertyFields} maxColumns={6} />

                {/* Action Bar — grouped: primary | context-create | secondary + danger | AI right-aligned */}
                <div className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border border-slate-200 dark:border-navy-700/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const primaryGroup = nModeActions.filter((a) => a.variant === 'success');
                      const contextGroup = nModeActions.filter((a) => a.variant === 'neutral');
                      const dangerGroup = nModeActions.filter((a) => a.variant === 'danger');

                      const renderButton = (action: NModeAction) => {
                        const Icon = action.icon;
                        const variantClasses =
                          action.variant === 'success'
                            ? 'border-emerald-400/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                            : action.variant === 'danger'
                              ? 'border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10'
                              : 'border-slate-300/50 dark:border-navy-600/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/60';
                        return (
                          <button
                            key={action.id}
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${variantClasses} disabled:opacity-50`}
                          >
                            <Icon size={13} />
                            <span>{isPolish ? action.label.pl : action.label.en}</span>
                          </button>
                        );
                      };

                      return (
                        <>
                          {primaryGroup.map(renderButton)}
                          {primaryGroup.length > 0 && contextGroup.length > 0 && (
                            <div
                              key="sep-1"
                              className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5"
                            />
                          )}
                          {contextGroup.map(renderButton)}
                          {(primaryGroup.length > 0 || contextGroup.length > 0) &&
                            dangerGroup.length > 0 && (
                              <div
                                key="sep-2"
                                className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5"
                              />
                            )}
                          {dangerGroup.map(renderButton)}

                          {/* Right-aligned AI Generate button (hidden for activity-log — no analysis) */}
                          <div className="flex-1" />
                          {activeNSection !== 'activity-log' &&
                            (() => {
                              if (activeNSection === 'tasks') {
                                return (
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        if (!canUseAi) {
                                          toast.error(
                                            isPolish
                                              ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                              : 'AI is unavailable because you have no edit permissions in this context.'
                                          );
                                          return;
                                        }
                                        requestTasksAi('analyze');
                                      }}
                                      disabled={!canUseAi || !!tasksAiRequest}
                                      title={
                                        !canUseAi
                                          ? isPolish
                                            ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                            : 'No permission to use AI in this context.'
                                          : undefined
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                    >
                                      {tasksAiRequest?.mode === 'analyze' ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={13} />
                                      )}
                                      <span>
                                        {tasksAiRequest?.mode === 'analyze'
                                          ? isPolish
                                            ? 'Analizuję...'
                                            : 'Analyzing...'
                                          : isPolish
                                            ? 'Analizuj z AI'
                                            : 'Analyze with AI'}
                                      </span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (!canUseAi) {
                                          toast.error(
                                            isPolish
                                              ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                              : 'AI is unavailable because you have no edit permissions in this context.'
                                          );
                                          return;
                                        }
                                        requestTasksAi('addOne');
                                      }}
                                      disabled={!canUseAi || !!tasksAiRequest}
                                      title={
                                        !canUseAi
                                          ? isPolish
                                            ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                            : 'No permission to use AI in this context.'
                                          : undefined
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                    >
                                      {tasksAiRequest?.mode === 'addOne' ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={13} />
                                      )}
                                      <span>
                                        {tasksAiRequest?.mode === 'addOne'
                                          ? isPolish
                                            ? 'Dodaję...'
                                            : 'Generating...'
                                          : isPolish
                                            ? 'AI: dodaj task'
                                            : 'AI: Add task'}
                                      </span>
                                    </button>
                                  </div>
                                );
                              }
                              if (activeNSection === 'decisions') {
                                return (
                                  <div className="inline-flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        if (!canUseAi) {
                                          toast.error(
                                            isPolish
                                              ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                              : 'AI is unavailable because you have no edit permissions in this context.'
                                          );
                                          return;
                                        }
                                        requestDecisionsAi('analyze');
                                      }}
                                      disabled={!canUseAi || !!decisionsAiRequest}
                                      title={
                                        !canUseAi
                                          ? isPolish
                                            ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                            : 'No permission to use AI in this context.'
                                          : undefined
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                    >
                                      {decisionsAiRequest?.mode === 'analyze' ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={13} />
                                      )}
                                      <span>
                                        {decisionsAiRequest?.mode === 'analyze'
                                          ? isPolish
                                            ? 'Analizuję...'
                                            : 'Analyzing...'
                                          : isPolish
                                            ? 'Analizuj z AI'
                                            : 'Analyze with AI'}
                                      </span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (!canUseAi) {
                                          toast.error(
                                            isPolish
                                              ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                              : 'AI is unavailable because you have no edit permissions in this context.'
                                          );
                                          return;
                                        }
                                        requestDecisionsAi('addOne');
                                      }}
                                      disabled={!canUseAi || !!decisionsAiRequest}
                                      title={
                                        !canUseAi
                                          ? isPolish
                                            ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                            : 'No permission to use AI in this context.'
                                          : undefined
                                      }
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                    >
                                      {decisionsAiRequest?.mode === 'addOne' ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Sparkles size={13} />
                                      )}
                                      <span>
                                        {decisionsAiRequest?.mode === 'addOne'
                                          ? isPolish
                                            ? 'Dodaję...'
                                            : 'Generating...'
                                          : isPolish
                                            ? 'AI: dodaj decyzję'
                                            : 'AI: Add decision'}
                                      </span>
                                    </button>
                                  </div>
                                );
                              }
                              if (activeNSection === 'comments') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestCommentsAi();
                                    }}
                                    disabled={!canUseAi || !!commentsAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {commentsAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {commentsAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'resources') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestResourcesAi();
                                    }}
                                    disabled={!canUseAi || !!resourcesAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {resourcesAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {resourcesAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'timeline') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestTimelineAi();
                                    }}
                                    disabled={!canUseAi || !!timelineAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {timelineAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {timelineAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'dependencies') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestDependenciesAi();
                                    }}
                                    disabled={!canUseAi || !!dependenciesAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {dependenciesAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {dependenciesAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'kpis') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestKpisAi();
                                    }}
                                    disabled={!canUseAi || !!kpisAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {kpisAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {kpisAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'team') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestTeamAi();
                                    }}
                                    disabled={!canUseAi || !!teamAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {teamAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {teamAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'targetState') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestTargetStateAi();
                                    }}
                                    disabled={!canUseAi || !!targetStateAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {targetStateAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {targetStateAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }
                              if (activeNSection === 'gates') {
                                return (
                                  <button
                                    onClick={() => {
                                      if (!canUseAi) {
                                        toast.error(
                                          isPolish
                                            ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                            : 'AI is unavailable because you have no edit permissions in this context.'
                                        );
                                        return;
                                      }
                                      requestGatesAi();
                                    }}
                                    disabled={!canUseAi || !!gatesAiRequest}
                                    title={
                                      !canUseAi
                                        ? isPolish
                                          ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                          : 'No permission to use AI in this context.'
                                        : undefined
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                  >
                                    {gatesAiRequest ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )}
                                    <span>
                                      {gatesAiRequest
                                        ? isPolish
                                          ? 'Analizuję...'
                                          : 'Analyzing...'
                                        : isPolish
                                          ? 'Analizuj z AI'
                                          : 'Analyze with AI'}
                                    </span>
                                  </button>
                                );
                              }

                              const aiSectionKey =
                                activeNSection === 'initiative-definition'
                                  ? 'scope'
                                  : activeNSection === 'risk-raid'
                                    ? 'raid'
                                    : activeNSection;
                              const aiLabel =
                                activeNSection === 'initiative-definition'
                                  ? isPolish
                                    ? 'Generuj scope'
                                    : 'Generate scope'
                                  : activeNSection === 'risk-raid'
                                    ? isPolish
                                      ? 'Analizuj RAID'
                                      : 'Analyze RAID'
                                    : isPolish
                                      ? 'Analyze with AI'
                                      : 'Analyze with AI';
                              const isRaidAnalyzing =
                                activeNSection === 'risk-raid' &&
                                (!!raidAiRequest || isRaidAIProposing);
                              return (
                                <button
                                  onClick={async () => {
                                    if (!canUseAi) {
                                      toast.error(
                                        isPolish
                                          ? 'AI jest niedostępne, ponieważ nie masz uprawnień edycji w tym kontekście.'
                                          : 'AI is unavailable because you have no edit permissions in this context.'
                                      );
                                      return;
                                    }
                                    if (activeNSection === 'initiative-definition') {
                                      await handleGenerateScopeCard();
                                      return;
                                    }
                                    if (activeNSection === 'risk-raid') {
                                      requestRaidAi();
                                      return;
                                    }
                                    await handleGenerateAI(aiSectionKey);
                                  }}
                                  disabled={
                                    !canUseAi ||
                                    (activeNSection === 'risk-raid'
                                      ? isRaidAnalyzing
                                      : isGeneratingAI === aiSectionKey)
                                  }
                                  title={
                                    !canUseAi
                                      ? isPolish
                                        ? 'Brak uprawnień do użycia AI w tym kontekście.'
                                        : 'No permission to use AI in this context.'
                                      : undefined
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                >
                                  {activeNSection === 'risk-raid' ? (
                                    isRaidAnalyzing ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Sparkles size={13} />
                                    )
                                  ) : isGeneratingAI === aiSectionKey ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : (
                                    <Sparkles size={13} />
                                  )}
                                  <span>
                                    {activeNSection === 'risk-raid' && isRaidAnalyzing
                                      ? isPolish
                                        ? 'Analizuję...'
                                        : 'Analyzing...'
                                      : aiLabel}
                                  </span>
                                </button>
                              );
                            })()}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* LeftNav + Canvas */}
                <div className="flex gap-0 min-h-[60vh]">
                  <NModeLeftNav
                    sections={orderedNModeSectionsWithContent}
                    activeSection={activeNSection}
                    onSectionChange={setActiveNSection}
                    onSectionReorder={handleNModeSectionReorder}
                  />
                  <NModeCanvas
                    sections={orderedNModeSectionsWithContent}
                    activeSection={activeNSection}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════
            C-MODE RENDER (legacy D-mode cards + scroll)
            ═══════════════════════════════════════════════════════════════ */
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div
              className={
                cModeLayout === 'cards'
                  ? 'grid grid-cols-1 lg:grid-cols-3 gap-6'
                  : 'flex flex-col gap-6'
              }
            >
              {/* ====== HEADER - Full Width ====== */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-3 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {onBack && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onBack}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                      >
                        <ChevronLeft size={20} className="text-slate-500" />
                      </motion.button>
                    )}
                    <div
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${moduleConfig.bgLight} ${moduleConfig.textColor}`}
                    >
                      {isPolish ? moduleConfig.labelPl : moduleConfig.label}
                    </div>
                    <input
                      id={titleInputId}
                      type="text"
                      value={titleDraft || initiative.name || ''}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      readOnly={!canEditCards}
                      className={`flex-1 text-xl font-bold text-slate-800 dark:text-white bg-transparent border-none focus:outline-none truncate ${
                        !canEditCards ? '' : 'cursor-text'
                      }`}
                    />
                    <ArtifactPermalinkButton
                      artifactType="initiative"
                      artifactId={initiativeId}
                      isPolish={isPolish}
                      size={13}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 ${statusMeta.bgColor} ${statusMeta.dotColor.replace('bg-', 'border-').replace('-400', '-500/50')} transition-all`}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${statusMeta.dotColor} animate-pulse`}
                      />
                      <span className={`text-sm font-semibold ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSave(false)}
                      disabled={isMutating || !hasUnsavedChanges}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/70 dark:bg-navy-900/50 border border-blue-500/40 dark:border-blue-400/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/10 text-sm font-semibold transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isMutating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      <span>
                        {hasUnsavedChanges
                          ? isPolish
                            ? 'Zapisz'
                            : 'Save'
                          : isPolish
                            ? 'Zapisane'
                            : 'Saved'}
                      </span>
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
                    {/* Presentation mode switcher (N/C) */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700/60">
                      <button
                        onClick={() => setPresentationMode('n')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${(presentationMode as any) === 'n' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        N
                      </button>
                      <button
                        onClick={() => setPresentationMode('c')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${(presentationMode as any) === 'c' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        C
                      </button>
                    </div>
                    {/* B7.4: Toggle assessment summary panel */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowAssessmentPanel((p) => !p)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                        showAssessmentPanel
                          ? 'bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400'
                          : 'bg-white/70 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-600'
                      }`}
                      title={isPolish ? 'Panel oceny' : 'Assessment panel'}
                    >
                      <Sparkles size={16} />
                    </motion.button>
                    {/* B7.3: RowActionsMenu — z-50, no overlay issues */}
                    <RowActionsMenu
                      actions={
                        [
                          {
                            id: 'new-task',
                            label: isPolish ? 'Nowe zadanie' : 'New Task',
                            icon: CheckSquare,
                            variant: 'primary',
                            onClick: () => {
                              toggleSection('tasks');
                              setShowCreateTask(true);
                            },
                          },
                          {
                            id: 'new-decision',
                            label: isPolish ? 'Nowa decyzja' : 'New Decision',
                            icon: Scale,
                            onClick: () => {
                              toggleSection('decisions');
                              setShowCreateDecision(true);
                            },
                          },
                          {
                            id: 'add-raid',
                            label: isPolish ? 'Dodaj RAID' : 'Add RAID',
                            icon: AlertTriangle,
                            onClick: () => {
                              toggleSection('raid');
                              setShowCreateRaid(true);
                            },
                          },
                          {
                            id: 'new-tab',
                            label: isPolish ? 'Nowa karta' : 'New tab',
                            icon: ExternalLink,
                            divider: true,
                            onClick: () => window.open(window.location.href, '_blank'),
                          },
                          {
                            id: 'copy-link',
                            label: isPolish ? 'Kopiuj link' : 'Copy link',
                            icon: Copy,
                            onClick: handleCopyLink,
                          },
                          {
                            id: 'export-pdf',
                            label: 'PDF',
                            icon: Download,
                            onClick: handleExportPDF,
                          },
                          {
                            id: 'archive',
                            label: isPolish ? 'Archiwizuj' : 'Archive',
                            icon: Archive,
                            variant: 'danger' as const,
                            divider: true,
                            onClick: handleArchive,
                          },
                          ...(status === 'DRAFT'
                            ? [
                                {
                                  id: 'delete',
                                  label: isPolish ? 'Usuń' : 'Delete',
                                  icon: Trash2,
                                  variant: 'danger' as const,
                                  onClick: handleDelete,
                                },
                              ]
                            : []),
                        ] as RowAction[]
                      }
                      size="md"
                    />
                  </div>
                </div>
              </motion.div>

              {/* ====== B7.2: Key Info Bar — 5 sections always visible ====== */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
              >
                {/* 1. Goal / Objective */}
                <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded-lg bg-blue-500/10">
                      <Target size={14} className="text-blue-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Cel' : 'Goal'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {summary ||
                      initiative?.strategicIntent ||
                      initiative?.description ||
                      (isPolish ? 'Brak opisu' : 'No description')}
                  </p>
                </div>

                {/* 2. Tasks */}
                <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded-lg bg-emerald-500/10">
                      <CheckSquare size={14} className="text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Zadania' : 'Tasks'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-800 dark:text-white">
                      {tasksDone}/{tasks.length}
                    </span>
                    {tasks.length > 0 && (
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{
                            width: `${tasks.length > 0 ? Math.round((tasksDone / tasks.length) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {tasksInProgress > 0 && (
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      {tasksInProgress} {isPolish ? 'w toku' : 'in progress'}
                    </p>
                  )}
                </div>

                {/* 3. Team */}
                <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded-lg bg-purple-500/10">
                      <Users size={14} className="text-purple-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Zespół' : 'Team'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {ownerName ? (
                      <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Właściciel:' : 'Owner:'}
                        </span>{' '}
                        {ownerName}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Brak właściciela' : 'No owner'}
                      </p>
                    )}
                    {sponsorName && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {isPolish ? 'Sponsor:' : 'Sponsor:'} {sponsorName}
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Resources */}
                <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded-lg bg-cyan-500/10">
                      <Calendar size={14} className="text-cyan-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Zasoby' : 'Resources'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {startDate || endDate ? (
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {startDate
                          ? new Date(startDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : '?'}
                        {' → '}
                        {endDate
                          ? new Date(endDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : '?'}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Brak dat' : 'No dates'}
                      </p>
                    )}
                    {milestones.length > 0 && (
                      <p className="text-[10px] text-purple-500">
                        {milestones.length} {isPolish ? 'kamieni milowych' : 'milestones'}
                      </p>
                    )}
                  </div>
                </div>

                {/* 5. Finances / Risk */}
                <div className="p-3 rounded-xl bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200 dark:border-navy-700/60 shadow-sm">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded-lg bg-amber-500/10">
                      <DollarSign size={14} className="text-amber-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Finanse / Ryzyko' : 'Finance / Risk'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {initiative?.costCapex || initiative?.cost_capex ? (
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {(() => {
                          const amt = initiative.costCapex || initiative.cost_capex || 0;
                          if (amt >= 1_000_000) return `$${(amt / 1_000_000).toFixed(1)}M`;
                          if (amt >= 1_000) return `$${(amt / 1_000).toFixed(0)}K`;
                          return `$${amt}`;
                        })()}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                    )}
                    {(riskCount > 0 || issueCount > 0) && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${criticalRaids > 0 ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}
                      >
                        {riskCount}R / {issueCount}I
                      </span>
                    )}
                  </div>
                  {initiative?.expectedRoi || initiative?.expected_roi ? (
                    <p className="text-[10px] text-emerald-500 mt-0.5">
                      ROI: {(initiative.expectedRoi || initiative.expected_roi || 0).toFixed(1)}x
                    </p>
                  ) : null}
                </div>
              </motion.div>

              {cModeLayout === 'cards' ? (
                <>
                  {/* ====== LEFT COLUMN - Dynamic Content Sections ====== */}
                  <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
                    {leftSections.map((sectionType) => {
                      const Component = SECTION_REGISTRY[sectionType.componentKey];
                      if (!Component) return null;
                      return (
                        <Component
                          key={sectionType.key}
                          sectionType={sectionType}
                          expanded={expandedSections.has(sectionType.key)}
                          onToggle={() => toggleSection(sectionType.key)}
                          readonly={!canEditCards}
                        />
                      );
                    })}
                  </div>

                  {/* ====== RIGHT COLUMN - Dynamic Control/Meta Sections ====== */}
                  <div className="lg:col-span-1 space-y-4 order-1 lg:order-2">
                    {/* Gate Alert Banner (always check, regardless of sections) */}
                    {pendingGates.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-300/50 dark:border-amber-500/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-amber-500/20">
                            <AlertTriangle size={18} className="text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              {isPolish ? 'Wymagana decyzja bramkowa' : 'Gate decision required'}
                            </p>
                            <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                              {pendingGates.map((g) => g.label).join(', ')}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {rightSections.map((sectionType) => {
                      const Component = SECTION_REGISTRY[sectionType.componentKey];
                      if (!Component) return null;
                      return (
                        <Component
                          key={sectionType.key}
                          sectionType={sectionType}
                          expanded={expandedSections.has(sectionType.key)}
                          onToggle={() => toggleSection(sectionType.key)}
                          readonly={!canEditCards}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                /* ====== SCROLL DOCUMENT VIEW ====== */
                <InitiativeScrollView
                  leftSections={leftSections}
                  rightSections={rightSections}
                  readonly={!canEditCards}
                />
              )}
            </div>

            {/* ====== B7.4: Assessment Summary Panel (right side, C-mode only) ====== */}
            <AnimatePresence>
              {showAssessmentPanel && (
                <motion.aside
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="fixed right-0 top-0 h-full w-80 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-navy-700 shadow-2xl z-40 overflow-y-auto"
                >
                  <div className="p-5 space-y-5">
                    {/* Panel Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-violet-500" />
                        {isPolish ? 'Podsumowanie oceny' : 'Assessment Summary'}
                      </h3>
                      <button
                        onClick={() => setShowAssessmentPanel(false)}
                        className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Readiness Score */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-200/50 dark:border-violet-500/20">
                      <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider mb-2">
                        {isPolish ? 'Gotowość inicjatywy' : 'Initiative Readiness'}
                      </p>
                      <div className="flex items-end gap-2 mb-2">
                        <span className="text-3xl font-bold text-slate-800 dark:text-white">
                          {(() => {
                            let score = 0;
                            if (summary) score += 15;
                            if (ownerName) score += 15;
                            if (sponsorName) score += 10;
                            if (tasks.length > 0) score += 15;
                            if (startDate && endDate) score += 10;
                            if (initiative?.costCapex || initiative?.cost_capex) score += 10;
                            if (raidItems.length > 0) score += 10;
                            if (decisions.length > 0) score += 10;
                            if (stakeholders.length > 0) score += 5;
                            return Math.min(score, 100);
                          })()}
                          %
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {isPolish ? 'kompletność' : 'completeness'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                          style={{
                            width: `${(() => {
                              let score = 0;
                              if (summary) score += 15;
                              if (ownerName) score += 15;
                              if (sponsorName) score += 10;
                              if (tasks.length > 0) score += 15;
                              if (startDate && endDate) score += 10;
                              if (initiative?.costCapex || initiative?.cost_capex) score += 10;
                              if (raidItems.length > 0) score += 10;
                              if (decisions.length > 0) score += 10;
                              if (stakeholders.length > 0) score += 5;
                              return Math.min(score, 100);
                            })()}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Checklist */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        {isPolish ? 'Lista kontrolna' : 'Checklist'}
                      </p>
                      <div className="space-y-1.5">
                        {[
                          {
                            label: isPolish ? 'Opis / cel' : 'Description / goal',
                            done: !!summary,
                          },
                          { label: isPolish ? 'Właściciel' : 'Owner assigned', done: !!ownerName },
                          { label: isPolish ? 'Sponsor' : 'Sponsor assigned', done: !!sponsorName },
                          { label: isPolish ? 'Zadania' : 'Tasks defined', done: tasks.length > 0 },
                          {
                            label: isPolish ? 'Harmonogram' : 'Timeline set',
                            done: !!(startDate && endDate),
                          },
                          {
                            label: isPolish ? 'Budżet' : 'Budget defined',
                            done: !!(initiative?.costCapex || initiative?.cost_capex),
                          },
                          {
                            label: isPolish ? 'Ryzyka' : 'Risks identified',
                            done: raidItems.filter((r) => r.type === 'risk').length > 0,
                          },
                          {
                            label: isPolish ? 'Decyzje' : 'Decisions linked',
                            done: decisions.length > 0,
                          },
                          {
                            label: isPolish ? 'Interesariusze' : 'Stakeholders',
                            done: stakeholders.length > 0,
                          },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-2 text-xs">
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center ${item.done ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'}`}
                            >
                              {item.done ? '✓' : '○'}
                            </div>
                            <span
                              className={
                                item.done
                                  ? 'text-slate-700 dark:text-slate-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }
                            >
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        {isPolish ? 'Statystyki' : 'Quick Stats'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                          <p className="text-lg font-bold text-slate-800 dark:text-white">
                            {tasks.length}
                          </p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">
                            {isPolish ? 'Zadania' : 'Tasks'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                          <p className="text-lg font-bold text-slate-800 dark:text-white">
                            {decisions.length}
                          </p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">
                            {isPolish ? 'Decyzje' : 'Decisions'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                          <p
                            className={`text-lg font-bold ${criticalRaids > 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}
                          >
                            {raidItems.length}
                          </p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">RAID</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50 text-center">
                          <p className="text-lg font-bold text-slate-800 dark:text-white">
                            {stakeholders.length}
                          </p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400">
                            {isPolish ? 'Interesariusze' : 'Stakeholders'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pending Gates */}
                    {pendingGates.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
                        <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
                          {isPolish ? 'Oczekujące bramki' : 'Pending Gates'}
                        </p>
                        {pendingGates.map((g) => (
                          <div
                            key={g.id}
                            className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle size={12} />
                            <span>{g.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </InitiativeContext.Provider>
  );
};
