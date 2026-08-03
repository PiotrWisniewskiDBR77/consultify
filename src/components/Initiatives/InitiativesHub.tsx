/**
 * InitiativesHub
 * Unified Initiatives module with ModuleHub UI pattern
 * Integrates original Portfolio components (Kanban, List, Timeline, Grid)
 * Connected to real API endpoints
 */

import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Filter,
  GitBranch,
  Lightbulb,
  List,
  Plus,
  Shield,
  Sparkles,
  Tag,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import {
  DueChip,
  PriorityChip,
  type PriorityLevel,
  statusChipTone,
} from '@/components/ui/primitives/chips';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { ROUTES } from '@/routes/routeConfig';
import { Api, shouldAllowDemoData } from '@/services/api';
import { API_URL, getHeaders } from '@/services/api/baseClient';
import {
  V8PlanningApi,
  type V8PlanningDecisionChain,
  type V8PlanningInitiativeSnapshot,
} from '@/services/api/v8/planning';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';
import {
  createInitiativeWriteTruth,
  getInitiativeStatusPreflightTruth,
  quickUpdateInitiativeWriteTruth,
  updateInitiativeStatusWriteTruth,
} from '@/services/initiativeWriteTruth';
import { useConversationStore } from '@/store/useConversationStore';
import { buildInitiativeDeepLink, readInitiativeDeepLinkId } from '@/utils/initiativeDeepLink';
import { checkDuplicateInitiative } from '@/utils/initiativeDuplicateDetection';
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  formatRelativeTime,
  formatShortDate,
  getHealthInfo,
} from '@/utils/initiativeHelpers';
import { isInitiativesBulkStubEnabled } from '@/utils/initiativesBulkStubFlag';
import { dispatchPilotAccessBlocked, isPilotParticipantRole } from '@/utils/pilotAccess';

import { usePortfolioStore } from '../../store/portfolioSlice';
import { useAppStore } from '../../store/useAppStore';
import { useInitiativeRefreshStore } from '../../store/useInitiativeRefreshStore';
import { InitiativeStatus, PortfolioFilters, PortfolioInitiative } from '../../types';
// Detail views
import { DecisionDetailView } from '../MyWork/DecisionDetailView';
import { TaskDetailView } from '../MyWork/TaskDetailView';
// Grid card for grid view
import { InitiativeGridCard } from '../Portfolio/InitiativeGridCard';
// Portfolio view components
import { type KanbanScope, PortfolioKanbanView } from '../Portfolio/PortfolioKanbanView';
// ModuleHub components
import { FilterChip, ModuleTab, OpenDocument, ViewMode } from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ACTION_DANGER,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
} from '../shared/ModuleMenu3';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { PortfolioAnalysisView } from './Analysis';
import type { AnalysisSubview } from './Analysis/types';
import { type AcceptCandidatePayload, CandidatesPanel } from './CandidatesPanel';
import {
  getCreatedInitiativeRevealState,
  normalizeInitiativeForPortfolio,
  upsertPortfolioInitiative,
} from './initiativeCreateFlow';
import { InitiativeDocumentView } from './InitiativeDocumentView';
import { InitiativeGoalsView } from './InitiativeGoalsView';
import { InitiativeObservabilityPanel } from './InitiativeObservabilityPanel';
import {
  InitiativePreviewV3Body,
  InitiativePreviewV3Footer,
  type InitiativePreviewV3Model,
} from './InitiativePreviewV3';
import { createInitiativesDemoDataset, isShowcaseInitiativeId } from './initiativesDemoData';
import { getSourceDisplayLabel } from './InitiativeSourceLink';
import { InitiativesTimelineView } from './InitiativesTimelineView';
import { DEFAULT_INITIATIVES_VIEW_MODE } from './initiativesViewDefaults';
import PortfolioHealthView from './PortfolioHealthView';
import { InitiativeWizardModal } from './Wizard/InitiativeWizardModal';

const MODULE_STATUSES = getStatusesForModule('initiatives');
const MIN_SHOWCASE_INITIATIVES = 10;

const unwrapApiList = (response: unknown, listKey?: string): any[] => {
  if (Array.isArray(response)) return response;
  const payload = (response as { data?: unknown } | null)?.data;
  if (Array.isArray(payload)) return payload;
  if (listKey) {
    const directList = (response as Record<string, unknown> | null)?.[listKey];
    if (Array.isArray(directList)) return directList;
    const nestedList = (payload as Record<string, unknown> | null)?.[listKey];
    if (Array.isArray(nestedList)) return nestedList;
  }
  return [];
};

// D1.2: Complete status set — includes execution/done + archived/cancelled for restoration
const ALLOWED_STATUSES: InitiativeStatus[] =
  MODULE_STATUSES.length > 0
    ? MODULE_STATUSES
    : [
        InitiativeStatus.DRAFT,
        InitiativeStatus.PENDING_REVIEW,
        InitiativeStatus.REVIEW,
        InitiativeStatus.PROMOTED,
        InitiativeStatus.PLANNING,
        InitiativeStatus.APPROVED,
        InitiativeStatus.SCHEDULED,
        InitiativeStatus.EXECUTING,
        InitiativeStatus.BLOCKED,
        InitiativeStatus.DONE,
        InitiativeStatus.TRACKING,
        InitiativeStatus.CANCELLED,
        InitiativeStatus.ARCHIVED,
      ];

// Subtle "coming soon" badge (task #11) for non-functional CTAs. Neutral, app-consistent.
const COMING_SOON_BADGE =
  'ml-1.5 inline-flex items-center rounded-full bg-c-surface-raised px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-c-text-muted';

// D1.1: Initiative type/level — determines governance complexity
// Downgrade blocked, upgrade possible
export type InitiativeLevel = 'quick_win' | 'standard' | 'strategic' | 'transformation';

export const INITIATIVE_LEVELS: {
  id: InitiativeLevel;
  label: string;
  description: string;
  color: string;
  icon: string;
}[] = [
  {
    id: 'quick_win',
    label: 'Quick Win',
    description: 'Small improvement, minimal governance. < 1 month, 1-2 people.',
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    icon: '⚡',
  },
  {
    id: 'standard',
    label: 'Standard Project',
    description: 'Regular project with defined scope. 1-3 months, dedicated team.',
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    icon: '📋',
  },
  {
    id: 'strategic',
    label: 'Strategic Program',
    description: 'Cross-functional program. 3-12 months, multiple teams, executive sponsor.',
    color: 'text-violet-500 bg-violet-500/10 border-violet-500/30',
    icon: '🎯',
  },
  {
    id: 'transformation',
    label: 'Transformation',
    description: 'Organization-wide change. 6-24 months, full governance, board oversight.',
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    icon: '🚀',
  },
];

interface InitiativesHubProps {
  initialTab?: ModuleTab;
}

export const InitiativesHub: React.FC<InitiativesHubProps> = ({ initialTab = 'list' }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentProjectId, currentUser, currentOrganization } = useAppStore();
  const refreshTrigger = usePortfolioStore((state) => state.refreshTrigger);
  const isPilotParticipant = isPilotParticipantRole(currentUser?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [handledDeepLinkNew, setHandledDeepLinkNew] = useState(false);
  const handledDeepLinkOpenRef = useRef<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(DEFAULT_INITIATIVES_VIEW_MODE);
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // V3-A02: Persistent dynamic tabs via sessionStorage
  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('initiatives');
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  /** Active/All scope toggle — used for Kanban columns and data filtering */
  const [scope, setScope] = useState<KanbanScope>('active');

  // Analysis sub-view state (lifted so chips render in Menu 3 via commandRowContent)
  const [analysisSubview, setAnalysisSubview] = useState<AnalysisSubview>('resources');
  const [analysisActionButtons, setAnalysisActionButtons] = useState<React.ReactNode>(null);
  const registerAnalysisActions = useCallback(
    (node: React.ReactNode) => setAnalysisActionButtons(node),
    []
  );

  // Data state
  const [initiatives, setInitiatives] = useState<PortfolioInitiative[]>([]);
  const [allInitiatives, setAllInitiatives] = useState<PortfolioInitiative[]>([]); // For duplicate detection
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null);
  // L-05: governed V8 Planning runtime degraded (env-off / org not V8-enabled).
  // Set when the V8 portfolio read fails and we silently fall back to legacy
  // reads — surfaces an honest degraded banner instead of a silent fallback.
  const [v8PlanningDegraded, setV8PlanningDegraded] = useState(false);
  const fetchRetryRef = useRef(0);
  const [v8PendingDecisionChains, setV8PendingDecisionChains] = useState<V8PlanningDecisionChain[]>(
    []
  );
  const [v8InitiativeSnapshot, setV8InitiativeSnapshot] =
    useState<V8PlanningInitiativeSnapshot | null>(null);
  const [v8SnapshotInitiativeId, setV8SnapshotInitiativeId] = useState<string | null>(null);
  const [isV8InitiativeSnapshotLoading, setIsV8InitiativeSnapshotLoading] = useState(false);
  const v8SnapshotRequestRef = useRef(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showInitiativeWizard, setShowInitiativeWizard] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState<InitiativeStatus | ''>('');
  const [bulkPriority, setBulkPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | ''>('');
  const [bulkOwnerBusinessId, setBulkOwnerBusinessId] = useState<string>('');
  const [bulkOwnerExecutionId, setBulkOwnerExecutionId] = useState<string>('');

  // New initiative form (P0 minimal)
  const [newTitle, setNewTitle] = useState('');
  const [newAxis, setNewAxis] = useState<
    'strategic' | 'operational' | 'transformational' | 'compliance'
  >('operational');
  const [newLevel, setNewLevel] = useState<InitiativeLevel>('standard');
  const [newSummary, setNewSummary] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Preview pane state (V3 Table+Preview)
  const [previewInitiativeId, setPreviewInitiativeId] = useState<string | null>(null);
  const activeDocument = useMemo(
    () =>
      activeDocumentId ? openDocuments.find((document) => document.id === activeDocumentId) : null,
    [activeDocumentId, openDocuments]
  );
  const activeInitiativeDocumentId = useMemo(() => {
    if (!activeDocumentId) return null;
    // When a deep link opens an initiative document, the active document can render
    // before the session-backed openDocuments list catches up. Treat that transient
    // state as an initiative document so the governed snapshot still hydrates.
    if (activeDocument?.type === 'decision' || activeDocument?.type === 'task') return null;
    return activeDocumentId;
  }, [activeDocument, activeDocumentId]);
  const v8SnapshotTargetId = useMemo(() => {
    if (activeDocumentId) {
      return activeInitiativeDocumentId;
    }
    return previewInitiativeId;
  }, [activeDocumentId, activeInitiativeDocumentId, previewInitiativeId]);

  // Filter state for API
  const [filters, setFilters] = useState<PortfolioFilters>({});
  const allowDemoData = shouldAllowDemoData();

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

  const mergeShowcaseInitiatives = useCallback((items: PortfolioInitiative[]) => {
    return items;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPendingDecisionChains = async () => {
      try {
        const response = await V8PlanningApi.getPendingDecisions();
        if (!cancelled) setV8PendingDecisionChains(response.pendingDecisionChains || []);
      } catch {
        if (!cancelled) setV8PendingDecisionChains([]);
      }
    };
    void loadPendingDecisionChains();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestId = ++v8SnapshotRequestRef.current;

    if (!v8SnapshotTargetId?.trim() || isShowcaseInitiativeId(v8SnapshotTargetId)) {
      setV8InitiativeSnapshot(null);
      setV8SnapshotInitiativeId(v8SnapshotTargetId ?? null);
      setIsV8InitiativeSnapshotLoading(false);
      return;
    }

    setV8SnapshotInitiativeId(v8SnapshotTargetId);
    setV8InitiativeSnapshot(null);
    setIsV8InitiativeSnapshotLoading(true);

    void V8PlanningApi.getInitiativeSnapshot(v8SnapshotTargetId)
      .then((snapshot) => {
        if (v8SnapshotRequestRef.current !== requestId) return;
        setV8InitiativeSnapshot(snapshot);
      })
      .catch(() => {
        if (v8SnapshotRequestRef.current !== requestId) return;
        setV8InitiativeSnapshot(null);
      })
      .finally(() => {
        if (v8SnapshotRequestRef.current !== requestId) return;
        setIsV8InitiativeSnapshotLoading(false);
      });
  }, [v8SnapshotTargetId]);

  // ============================================
  // DATA FETCHING - Real API
  // ============================================

  const fetchData = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        setLoadError(null);
        setLoadErrorCode(null);
        const params = new URLSearchParams();
        if (currentProjectId) params.append('projectId', currentProjectId);
        // Scope-based filtering: 'active' sends only core statuses, 'all' sends everything.
        if (scope === 'active' && !activeStatusFilter) {
          params.append('statuses', ACTIVE_STATUSES.join(','));
        } else if (
          activeStatusFilter &&
          ALLOWED_STATUSES.includes(activeStatusFilter as InitiativeStatus)
        ) {
          params.append('status', activeStatusFilter);
        }
        if (filters.priority?.length) filters.priority.forEach((p) => params.append('priority', p));
        if (searchQuery) params.append('search', searchQuery);

        // Prefer governed V8 portfolio continuity, then fallback to legacy portfolio reads.
        let response: { initiatives?: PortfolioInitiative[] } = { initiatives: [] };
        try {
          response = await V8PlanningApi.getPortfolio({
            projectId: currentProjectId || undefined,
            statuses: scope === 'active' && !activeStatusFilter ? ACTIVE_STATUSES : undefined,
            status: activeStatusFilter || undefined,
            priority: filters.priority?.length ? filters.priority : undefined,
            search: searchQuery || undefined,
          });
          // Governed V8 Planning read succeeded — clear any degraded state.
          setV8PlanningDegraded(false);
          // Base-data fix: a V8-enabled org with ZERO governed initiatives still
          // returns an empty (non-throwing) portfolio — so an initiative created
          // via the legacy endpoint would never appear. When the governed list is
          // empty, cross-check the legacy endpoint and use it if it has rows.
          // (No-op for V8 orgs that already have governed initiatives.)
          if (!(response.initiatives || []).length) {
            try {
              const legacy = await Api.getInitiatives(currentProjectId || undefined);
              const legacyList = Array.isArray(legacy)
                ? legacy
                : (legacy as any)?.initiatives || [];
              if (legacyList.length) response = { initiatives: legacyList };
            } catch {
              /* keep the empty governed result */
            }
          }
        } catch {
          // L-05: governed V8 Planning is unavailable (env-off / org not
          // V8-enabled / 404). Surface a degraded banner instead of silently
          // falling back, then read the legacy initiatives endpoint.
          setV8PlanningDegraded(true);
          const fallbackResponse = await Api.getInitiatives(currentProjectId || undefined);
          response = {
            initiatives: Array.isArray(fallbackResponse)
              ? fallbackResponse
              : (fallbackResponse as any).initiatives || [],
          };
        }

        const allowed = (response.initiatives || []).filter((i) =>
          ALLOWED_STATUSES.includes(i.status as InitiativeStatus)
        );
        setInitiatives(allowed);

        // Also fetch all initiatives (including archived/cancelled) for duplicate detection.
        try {
          const allResponse = await V8PlanningApi.getPortfolio({
            projectId: currentProjectId || undefined,
            search: searchQuery || undefined,
          });
          setAllInitiatives(allResponse.initiatives || response.initiatives || []);
        } catch {
          // Fallback: use current initiatives
          setAllInitiatives(response.initiatives || []);
        }
      } catch (error: any) {
        console.error('[InitiativesHub] Fetch error:', error);
        const isNetworkError =
          !error?.status ||
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('NetworkError');
        if (isNetworkError && fetchRetryRef.current < 3) {
          fetchRetryRef.current++;
          const delay = Math.min(2000 * Math.pow(2, fetchRetryRef.current - 1), 8000);
          console.warn(
            `[InitiativesHub] Network error, retrying in ${delay}ms (attempt ${fetchRetryRef.current}/3)`
          );
          setTimeout(() => fetchData(), delay);
          return;
        }
        setInitiatives([]);
        setAllInitiatives([]);
        setLoadError(
          t(
            'initiatives.errors.loadFailed',
            'Failed to load initiatives from the active data source.'
          )
        );
        const code =
          typeof error?.data?.code === 'string' && error.data.code.trim()
            ? error.data.code.trim()
            : null;
        setLoadErrorCode(code);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      currentProjectId,
      allowDemoData,
      activeStatusFilter,
      filters.priority,
      initiativesDemoData,
      mergeShowcaseInitiatives,
      searchQuery,
      scope,
      t,
    ]
  );

  useEffect(() => {
    fetchRetryRef.current = 0;
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchData(true);
    }
  }, [refreshTrigger, fetchData]);

  // F4.1 — global signal from useInitiativeRefreshStore (bumped by every mutation from initiativeWriteTruth)
  const sharedRefreshVersion = useInitiativeRefreshStore((s) => s.version);
  useEffect(() => {
    if (sharedRefreshVersion > 0) {
      fetchData(true);
    }
  }, [sharedRefreshVersion, fetchData]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await Api.getUsers();
        const rows = Array.isArray(data) ? data : [];
        setUsers(rows);
      } catch (error: any) {
        console.error('[InitiativesHub] Failed to load users:', error);
        setUsers([]);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    if (initiatives.length === 0 && selectedIds.size > 0) {
      setSelectedIds(new Set());
      return;
    }
    if (selectedIds.size > 0) {
      const allowedIds = new Set(initiatives.map((i) => i.id));
      const filtered = new Set(Array.from(selectedIds).filter((id) => allowedIds.has(id)));
      if (filtered.size !== selectedIds.size) {
        setSelectedIds(filtered);
      }
    }
  }, [initiatives, selectedIds]);

  // NOTE: We normalize "all" to null in the handler below (no flicker).

  // ============================================
  // STATUS FILTERS
  // ============================================

  // Status counts for dropdown
  const statusCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = { all: initiatives.length };
    initiatives.forEach((i) => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });
    return counts;
  }, [initiatives]);

  // Available view modes — hide when Analysis tab is active
  const availableViewModes: ViewMode[] =
    activeTab === 'analysis' ||
    activeTab === 'observability' ||
    activeTab === 'candidates' ||
    activeTab === 'portfolioHealth' ||
    activeTab === 'goals'
      ? []
      : ['table', 'kanban', 'timeline', 'grid'];

  // V3-F02: Portfolio Analysis tab + main portfolio tab
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('initiatives.tabs.portfolio', 'Portfolio'),
        icon: <List size={16} />,
      },
      {
        id: 'analysis' as ModuleTab,
        label: t('initiatives.tabs.analysis', 'Analysis'),
        icon: <BarChart3 size={16} />,
      },
      {
        // UNIFICATION E1/E2 — chain observability (lineage + funnel)
        id: 'observability' as ModuleTab,
        label: t('initiatives.tabs.observability', 'Observability'),
        icon: <GitBranch size={16} />,
      },
      {
        // F2 — candidates inbox (AI suggests initiatives from discovery)
        id: 'candidates' as ModuleTab,
        label: t('initiatives.tabs.candidates', 'Candidates'),
        icon: <Sparkles size={16} />,
      },
      {
        // F4 — portfolio health (MECE / gaps / balance / duplicates)
        id: 'portfolioHealth' as ModuleTab,
        label: t('initiatives.tabs.portfolioHealth', 'Portfolio Health'),
        icon: <Activity size={16} />,
      },
      {
        // RES-10 — Initiatives-owned goals/OKR (goals table via initiativeGovernanceService).
        // Distinct from Results' scorecards (kpi_scorecards) — see InitiativeGoalsView.tsx.
        id: 'goals' as ModuleTab,
        label: t('initiatives.tabs.goals', 'Goals'),
        icon: <Target size={16} />,
      },
    ],
    [t]
  );

  // ============================================
  // HANDLERS
  // ============================================

  const requestV8InitiativeSnapshot = useCallback((initiativeId: string | null | undefined) => {
    const trimmedId = String(initiativeId || '').trim();
    if (!trimmedId || isShowcaseInitiativeId(trimmedId)) {
      return;
    }
    const requestId = ++v8SnapshotRequestRef.current;
    setV8SnapshotInitiativeId(trimmedId);
    setV8InitiativeSnapshot(null);
    setIsV8InitiativeSnapshotLoading(true);

    void V8PlanningApi.getInitiativeSnapshot(trimmedId)
      .then((snapshot) => {
        if (v8SnapshotRequestRef.current !== requestId) return;
        setV8InitiativeSnapshot(snapshot);
      })
      .catch(() => {
        if (v8SnapshotRequestRef.current !== requestId) return;
        setV8InitiativeSnapshot(null);
      })
      .finally(() => {
        if (v8SnapshotRequestRef.current !== requestId) return;
        setIsV8InitiativeSnapshotLoading(false);
      });
  }, []);

  const handlePreviewSelection = useCallback(
    (initiativeId: string | null) => {
      setPreviewInitiativeId(initiativeId);
      requestV8InitiativeSnapshot(initiativeId);
    },
    [requestV8InitiativeSnapshot]
  );

  // Single click row/card → selection + preview (V3 Table+Preview)
  const handleInitiativeClick = useCallback(
    (initiative: PortfolioInitiative) => {
      handlePreviewSelection(initiative.id);
    },
    [handlePreviewSelection]
  );

  const handleOpenInitiativeDocument = useCallback(
    (initiative: PortfolioInitiative) => {
      const existingDoc = openDocuments.find(
        (document) => document.id === initiative.id && document.type === 'initiative'
      );
      if (!existingDoc) {
        const newDoc: OpenDocument = {
          id: initiative.id,
          name: initiative.name || t('initiatives.document.untitled', 'Untitled initiative'),
          type: 'initiative',
          subType: String(initiative.axis || 'initiative'),
          status: (initiative.status || InitiativeStatus.DRAFT) as any,
        };
        setOpenDocuments((prev) => [...prev, newDoc]);
      }
      setActiveTab('list');
      setActiveDocumentId(initiative.id);
      handlePreviewSelection(initiative.id);
    },
    [handlePreviewSelection, openDocuments, setActiveDocumentId, setOpenDocuments, t]
  );

  // Generic document opener (used by canon §9 kebab "Open full" on list/grid cards).
  // Restores a referenced-but-undefined handler so the module typechecks.
  const handleOpenDocument = useCallback(
    (doc: {
      id: string;
      type: OpenDocument['type'];
      name: string;
      status?: string;
      subType?: string;
    }) => {
      const existingDoc = openDocuments.find((d) => d.id === doc.id && d.type === doc.type);
      if (!existingDoc) {
        const newDoc: OpenDocument = {
          id: doc.id,
          name: doc.name || t('initiatives.document.untitled', 'Untitled initiative'),
          type: doc.type,
          subType: doc.subType ?? doc.type,
          status: (doc.status || InitiativeStatus.DRAFT) as any,
        };
        setOpenDocuments((prev) => [...prev, newDoc]);
      }
      setActiveTab('list');
      setActiveDocumentId(doc.id);
      handlePreviewSelection(doc.id);
    },
    [handlePreviewSelection, openDocuments, setActiveDocumentId, setOpenDocuments, t]
  );

  // Open decision as dynamic tab (called from InitiativeDocumentView → DecisionsSection)
  const handleOpenDecision = useCallback(
    async (decisionId: string) => {
      try {
        // Fetch decision details to get the name
        const response = await Api.get(`/decisions/${decisionId}`);
        const decision = response?.decision || response;

        // Add to open documents if not already open
        const existingDoc = openDocuments.find((d) => d.id === decisionId && d.type === 'decision');
        if (!existingDoc) {
          const newDoc: OpenDocument = {
            id: decisionId,
            name: decision?.title || t('initiatives.decisions.decision', 'Decision'),
            type: 'decision',
            subType: decision?.type || 'GENERAL',
            status: (decision?.status?.toUpperCase() || 'PENDING') as any,
          };
          setOpenDocuments((prev) => [...prev, newDoc]);
        }
        // Set as active document - this will render DecisionDetailView
        setActiveDocumentId(decisionId);
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            e?.message ||
            t('initiatives.decisions.openFailed', 'Failed to open decision')
        );
      }
    },
    [openDocuments, t]
  );

  // Open task as dynamic tab (called from InitiativeDocumentView → TasksMilestonesSection)
  const handleOpenTask = useCallback(
    async (taskId: string) => {
      try {
        // Fetch task details to get the name
        const response = await Api.get(`/tasks/${taskId}`);
        const task = response?.task || response;

        // Add to open documents if not already open
        const existingDoc = openDocuments.find((d) => d.id === taskId && d.type === 'task');
        if (!existingDoc) {
          const newDoc: OpenDocument = {
            id: taskId,
            name: task?.title || t('initiatives.tasks.task', 'Task'),
            type: 'task',
            subType: task?.type || 'TASK',
            status: (task?.status?.toUpperCase() || 'OPEN') as any,
          };
          setOpenDocuments((prev) => [...prev, newDoc]);
        }
        // Set as active document - this will render TaskDetailView
        setActiveDocumentId(taskId);
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            e?.message ||
            t('initiatives.tasks.openFailed', 'Failed to open task')
        );
      }
    },
    [openDocuments, t]
  );

  // Deep link: open initiative preview via URL params
  // Supported: /initiatives?open=<initiativeId>&mode=drawer|doc
  // USPOJNIENIE D1 — odczyt przez kanoniczny helper (jeden param `open`).
  useEffect(() => {
    const openId = readInitiativeDeepLinkId(searchParams.toString());
    if (!openId) {
      handledDeepLinkOpenRef.current = null;
      return;
    }

    const mode = (searchParams.get('mode') || 'doc').toLowerCase();
    const deepLinkKey = `${openId}:${mode}`;
    if (handledDeepLinkOpenRef.current === deepLinkKey) return;
    handledDeepLinkOpenRef.current = deepLinkKey;

    const run = async () => {
      try {
        // Prefer list row if already loaded; fallback to governed V8 detail read.
        const fromList = initiatives.find((i) => i.id === openId);
        const fromShowcase = initiativesDemoData.initiatives.find((i) => i.id === openId);
        let response: any = null;
        if (!fromList && !fromShowcase) {
          try {
            response = await V8PlanningApi.getInitiative(openId);
          } catch (v8Error) {
            try {
              response = await Api.get(`/initiatives/${encodeURIComponent(openId)}`);
            } catch {
              const interviewResponse = await Api.get('/initiatives?source=interview_insight');
              const interviewInitiatives = unwrapApiList(interviewResponse, 'initiatives');
              response = interviewInitiatives.find((item: any) => String(item?.id) === openId);
              if (!response) throw v8Error;
            }
          }
        }
        const initiative = normalizeInitiativeForPortfolio(
          (fromList || fromShowcase || response?.initiative || response) as any,
          openId
        );

        if (!initiative?.id) {
          toast.error(t('initiatives.toast.notFound', 'Initiative not found'));
          return;
        }

        setInitiatives((prev) => upsertPortfolioInitiative(prev, initiative));
        setAllInitiatives((prev) => upsertPortfolioInitiative(prev, initiative));

        const reveal = getCreatedInitiativeRevealState(
          { scope, activeStatusFilter },
          initiative.status
        );
        setScope(reveal.scope);
        setActiveStatusFilter(reveal.activeStatusFilter);

        if (mode === 'doc') {
          handleOpenInitiativeDocument(initiative);
        } else {
          handleInitiativeClick(initiative);
        }
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            e?.message ||
            t('initiatives.toast.openFailed', 'Failed to open initiative')
        );
      } finally {
        // Clear only deep-link params (preserve others if any)
        const next = new URLSearchParams(searchParams);
        next.delete('open');
        next.delete('mode');
        setSearchParams(next, { replace: true });
      }
    };

    run();
  }, [
    searchParams,
    setSearchParams,
    initiatives,
    initiativesDemoData,
    handleInitiativeClick,
    handleOpenInitiativeDocument,
    scope,
    activeStatusFilter,
  ]);

  // Deep link: open "New Initiative" modal
  // Supported: /initiatives?new=1
  useEffect(() => {
    if (handledDeepLinkNew) return;
    const isNew = searchParams.get('new') === '1';
    if (isNew) {
      if (isPilotParticipant) {
        dispatchPilotAccessBlocked({
          href: '/initiatives',
        });
        const next = new URLSearchParams(searchParams);
        next.delete('new');
        setSearchParams(next, { replace: true });
        setHandledDeepLinkNew(true);
        return;
      }
      setShowNewModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    setHandledDeepLinkNew(true);
  }, [handledDeepLinkNew, isPilotParticipant, searchParams, setSearchParams]);

  // D3.1: Status change with approval validation
  const handleStatusChange = useCallback(
    async (initiativeId: string, newStatus: InitiativeStatus) => {
      if (isPilotParticipant) {
        dispatchPilotAccessBlocked({
          href: '/initiatives',
        });
        return;
      }
      // Preflight via backend gate-readiness-check (source of truth).
      // This avoids local heuristics drifting from canonical gate DoD rules.
      if (isShowcaseInitiativeId(initiativeId)) {
        setInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId ? { ...initiative, status: newStatus } : initiative
          )
        );
        setAllInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId ? { ...initiative, status: newStatus } : initiative
          )
        );
        setOpenDocuments((prev) =>
          prev.map((document) =>
            document.id === initiativeId ? { ...document, status: newStatus as any } : document
          )
        );
        toast.success(t('initiatives.toast.statusUpdated', 'Status updated'));
        return;
      }
      try {
        const { transition: tr, blockingItems } = await getInitiativeStatusPreflightTruth(
          initiativeId,
          newStatus
        );
        if (!tr || !tr.canCurrentUserExecute) {
          toast.error(
            t(
              'initiatives.toast.statusNotAllowed',
              'You do not have permission or the gate is not available at this stage.'
            ),
            { duration: 5000 }
          );
          return;
        }
        if (blockingItems.length > 0) {
          const list = blockingItems.slice(0, 5).join('\n• ');
          toast.error(
            t(
              'initiatives.toast.gateBlockedHub',
              'Cannot proceed — blocking items are missing:\n• {{items}}',
              { items: list || t('common.missing', 'Missing required items') }
            ),
            { duration: 6500 }
          );
          return;
        }
      } catch {
        // Best-effort: backend will enforce anyway on PATCH /status.
      }

      try {
        const truth = await updateInitiativeStatusWriteTruth(initiativeId, newStatus);
        const refreshed = truth.initiative;
        setInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId
              ? ({ ...initiative, ...(refreshed || {}), status: newStatus } as any)
              : initiative
          )
        );
        setAllInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId
              ? ({ ...initiative, ...(refreshed || {}), status: newStatus } as any)
              : initiative
          )
        );
        setOpenDocuments((prev) =>
          prev.map((document) =>
            document.id === initiativeId
              ? {
                  ...document,
                  name: refreshed?.name || refreshed?.title || document.name,
                  status: (refreshed?.status || newStatus) as any,
                }
              : document
          )
        );
        toast.success(t('initiatives.toast.statusUpdated', 'Status updated'));
        fetchData(true);
      } catch (error: any) {
        // #74: updateInitiativeStatusWriteTruth → Api.patch is fetch-based and
        // throws a plain Error whose `.message` already carries the backend's
        // real reason (invalid transition / permission denied / missing
        // reason). `error.response.data.error` is an axios shape this client
        // never produces, so it was always undefined and silently hid the
        // real reason behind a generic toast.
        toast.error(
          error?.message || t('initiatives.toast.statusUpdateFailed', 'Failed to update status')
        );
      }
    },
    [fetchData, isPilotParticipant, setOpenDocuments, t]
  );

  const handleQuickUpdate = useCallback(
    async (initiativeId: string, updates: Partial<PortfolioInitiative>) => {
      if (isPilotParticipant) {
        dispatchPilotAccessBlocked({
          href: '/initiatives',
        });
        return;
      }
      // D1.2: Block level downgrade
      if ((updates as any).level) {
        const LEVEL_ORDER: Record<string, number> = {
          quick_win: 0,
          standard: 1,
          strategic: 2,
          transformation: 3,
        };
        const current = initiatives.find((i) => i.id === initiativeId);
        const currentLevel = LEVEL_ORDER[(current as any)?.level || 'standard'] ?? 1;
        const newLevel = LEVEL_ORDER[(updates as any).level] ?? 1;
        if (newLevel < currentLevel) {
          toast.error(
            t(
              'initiatives.toast.downgradeBlocked',
              'Downgrading the level is blocked. You can only upgrade an initiative level.'
            )
          );
          return;
        }
      }
      if (isShowcaseInitiativeId(initiativeId)) {
        setInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId ? ({ ...initiative, ...updates } as any) : initiative
          )
        );
        setAllInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId ? ({ ...initiative, ...updates } as any) : initiative
          )
        );
        return;
      }
      try {
        const truth = await quickUpdateInitiativeWriteTruth(
          initiativeId,
          updates as Record<string, unknown>
        );
        const refreshed = truth.initiative;
        setInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId
              ? ({ ...initiative, ...(refreshed || updates) } as any)
              : initiative
          )
        );
        setAllInitiatives((prev) =>
          prev.map((initiative) =>
            initiative.id === initiativeId
              ? ({ ...initiative, ...(refreshed || updates) } as any)
              : initiative
          )
        );
        setOpenDocuments((prev) =>
          prev.map((document) =>
            document.id === initiativeId
              ? {
                  ...document,
                  name: refreshed?.name || refreshed?.title || document.name,
                  status: (refreshed?.status || document.status) as any,
                }
              : document
          )
        );
      } catch (error: any) {
        toast.error(t('initiatives.toast.updateFailed', 'Failed to update'));
      }
    },
    [isPilotParticipant, setOpenDocuments, t]
  );

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
    if (id.startsWith('priority:')) {
      const value = id.split(':')[1] as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      setFilters((prev) => {
        const next = (prev.priority || []).filter((p) => p !== value);
        return { ...prev, priority: next.length ? next : undefined };
      });
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
    setFilters({});
  }, []);

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleMainTabChange = useCallback((tab: ModuleTab) => {
    setActiveTab(tab);
    setActiveDocumentId(null);
  }, []);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
      }
    },
    [activeDocumentId]
  );

  const handleBulkApply = useCallback(async () => {
    if (isPilotParticipant) {
      dispatchPilotAccessBlocked({
        href: '/initiatives',
      });
      return;
    }
    if (selectedIds.size === 0) return;

    const ids = Array.from(selectedIds);
    const statusUpdates = bulkStatus
      ? ids.map((id) =>
          Api.patch(`/initiatives/${id}/status`, {
            status: bulkStatus,
          })
        )
      : [];

    const quickUpdatePayload: Record<string, unknown> = {};
    if (bulkPriority) quickUpdatePayload.priority = bulkPriority;
    if (bulkOwnerBusinessId) quickUpdatePayload.ownerBusinessId = bulkOwnerBusinessId;
    if (bulkOwnerExecutionId) quickUpdatePayload.ownerExecutionId = bulkOwnerExecutionId;

    const quickUpdates =
      Object.keys(quickUpdatePayload).length > 0
        ? ids.map((id) => Api.patch(`/initiatives/${id}/quick-update`, quickUpdatePayload))
        : [];

    const results = await Promise.allSettled([...statusUpdates, ...quickUpdates]);
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      toast.error(t('initiatives.bulkEdit.updatesFailed', { count: failed }));
    } else {
      toast.success(t('initiatives.bulkEdit.bulkUpdateApplied'));
    }

    setShowBulkModal(false);
    setSelectedIds(new Set());
    setBulkStatus('');
    setBulkPriority('');
    setBulkOwnerBusinessId('');
    setBulkOwnerExecutionId('');
    fetchData(true);
  }, [
    bulkOwnerBusinessId,
    bulkOwnerExecutionId,
    bulkPriority,
    bulkStatus,
    fetchData,
    isPilotParticipant,
    selectedIds,
    t,
  ]);

  // Canon §9: Archive initiative (only DONE/CANCELLED → ARCHIVED per backend rule)
  const handleArchiveInitiative = useCallback(
    async (initiative: PortfolioInitiative) => {
      try {
        await Api.post(`/initiatives/${initiative.id}/archive`, {});
        toast.success(t('initiatives.toast.archived', 'Initiative archived'));
        await fetchData(true);
      } catch {
        toast.error(t('initiatives.toast.archiveFailed', 'Could not archive initiative'));
      }
    },
    [fetchData, t]
  );

  const handleDeleteInitiative = useCallback(
    async (initiative: PortfolioInitiative) => {
      const name = String(initiative.name || initiative.title || '').trim();
      const shouldProceed = window.confirm(
        t('initiatives.confirmDelete', {
          name: name || t('initiatives.thisInitiative', 'this initiative'),
          defaultValue: 'Permanently delete "{{name}}"? This action cannot be undone.',
        })
      );
      if (!shouldProceed) return;
      try {
        await Api.delete(`/initiatives/${initiative.id}`);
        toast.success(t('initiatives.toast.deleted', 'Initiative deleted'));
        await fetchData(true);
      } catch {
        toast.error(t('initiatives.toast.deleteError', 'Could not delete initiative'));
      }
    },
    [fetchData, t]
  );

  // Canon §15.3 Formula 2: clear multi-select (restores Formula 1 command row).
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Canon §15.3 Formula 2: real bulk action — Export selected rows as CSV (frontend-only).
  const handleExportSelectedCsv = useCallback(() => {
    const selected = initiatives.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const escape = (value: unknown): string => {
      const s = value == null ? '' : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const ownerName = (init: PortfolioInitiative): string => {
      const owner = (init as any).ownerBusiness || (init as any).ownerExecution;
      return owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() : '';
    };
    const headers = [
      'id',
      'name',
      'status',
      'priority',
      'axis',
      'owner',
      'plannedEndDate',
      'updatedAt',
    ];
    const rows = selected.map((i) =>
      [
        i.id,
        i.name,
        i.status,
        (i as any).priority ?? '',
        (i as any).axis ?? '',
        ownerName(i),
        (i as any).plannedEndDate ?? '',
        (i as any).updatedAt ?? '',
      ]
        .map(escape)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    try {
      const blob = new Blob([` ${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `initiatives-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(
        t('initiatives.bulk.exported', {
          count: selected.length,
          defaultValue: 'Exported {{count}}',
        })
      );
    } catch {
      toast.error(t('initiatives.bulk.exportFailed', 'Export failed'));
    }
  }, [initiatives, selectedIds, t]);

  useEffect(() => {
    if (!isPilotParticipant) return;
    if (showNewModal) setShowNewModal(false);
    if (showInitiativeWizard) setShowInitiativeWizard(false);
    if (showBulkModal) setShowBulkModal(false);
  }, [isPilotParticipant, showBulkModal, showInitiativeWizard, showNewModal]);

  // F5 — portfolio-level "Make material": POST /initiatives/portfolio/materialize
  // and download the returned blob (deck/report/table). Best-effort UX with toasts.
  const [isMaterializing, setIsMaterializing] = useState(false);
  const handleMaterializePortfolio = useCallback(
    async (format: 'deck' | 'report' | 'table') => {
      if (isMaterializing) return;
      setIsMaterializing(true);
      const toastId = toast.loading(
        t('initiatives.materialize.working', 'Generating material from the portfolio…')
      );
      try {
        const res = await fetch(`${API_URL}/initiatives/portfolio/materialize`, {
          method: 'POST',
          headers: { ...getHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ format }),
        });
        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          try {
            const body = await res.json();
            message = body?.message || body?.error || message;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(message);
        }
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = /filename="?([^"]+)"?/i.exec(disposition);
        const filename = match?.[1] || `portfolio-${format}`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(t('initiatives.materialize.done', 'Material ready'), { id: toastId });
      } catch (e: any) {
        toast.error(
          e?.message || t('initiatives.materialize.failed', 'Failed to generate material'),
          { id: toastId }
        );
      } finally {
        setIsMaterializing(false);
      }
    },
    [isMaterializing, t]
  );

  // F2 — accept candidate: create a DRAFT initiative via the existing create flow
  // (no dependency on a not-yet-built generator endpoint). The candidate's
  // rationale/brief seeds the summary; source lineage is stamped when available.
  const handleAcceptCandidate = useCallback(
    async (payload: AcceptCandidatePayload) => {
      if (isPilotParticipant) {
        dispatchPilotAccessBlocked({ href: '/initiatives' });
        return;
      }
      try {
        // F2→F1 anti-duplicate: if accept created an initiative server-side (and filled it
        // via the generator), do NOT create a second one — navigate to the returned initiativeId.
        let createdId: string | null;
        let truth: { initiative?: unknown } = {};
        if (payload.initiativeId) {
          createdId = payload.initiativeId;
        } else {
          const r = await createInitiativeWriteTruth({
            projectId: currentProjectId || undefined,
            title: payload.title.trim(),
            axis: 'operational',
            level: 'standard',
            summary: (payload.brief || payload.rationale || '').trim() || undefined,
            status: 'DRAFT',
            sourceType: payload.sourceType || undefined,
            sourceId: payload.sourceId || undefined,
          });
          createdId = r.createdId;
          truth = r.truth;
        }
        toast.success(t('initiatives.form.initiativeCreated', 'Initiative created'));
        if (createdId) {
          try {
            const full = truth.initiative || (await V8PlanningApi.getInitiative(createdId));
            const normalized = normalizeInitiativeForPortfolio(
              full as Record<string, any>,
              createdId
            );
            if (normalized) {
              setAllInitiatives((prev) => upsertPortfolioInitiative(prev, normalized));
              setInitiatives((prev) => upsertPortfolioInitiative(prev, normalized));
              const revealState = getCreatedInitiativeRevealState(
                { scope, activeStatusFilter },
                normalized.status
              );
              setScope(revealState.scope);
              setActiveStatusFilter(revealState.activeStatusFilter);
              setActiveTab('list');
              handleInitiativeClick(normalized);
              return;
            }
          } catch {
            /* fall through to refetch */
          }
        }
        await fetchData(true);
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            e?.message ||
            t('initiatives.form.createFailed', 'Failed to create initiative')
        );
      }
    },
    [
      activeStatusFilter,
      currentProjectId,
      fetchData,
      handleInitiativeClick,
      isPilotParticipant,
      scope,
      t,
    ]
  );

  // Triada standard (canon B.24): Esc closes the Portfolio 'table' (list)
  // StandardPreview; [O] shortcut opens the full initiative document. Mirrors
  // AssessmentHub 'list' / InterviewHub Inbox — renderContent() is a plain
  // function, not a component, so this hook must live at top level
  // (rules-of-hooks).
  useEffect(() => {
    if (viewMode !== 'table' || activeDocumentId || !previewInitiativeId) return;
    const row = initiatives.find((i) => i.id === previewInitiativeId);
    if (!row) return;
    const shortcuts = standardPreviewShortcuts({
      informational: [
        {
          id: 'open',
          variant: 'neutral',
          label: 'Open',
          shortcut: 'O',
          onClick: () => handleOpenInitiativeDocument(row),
        },
      ],
    });
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        handlePreviewSelection(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    viewMode,
    activeDocumentId,
    previewInitiativeId,
    initiatives,
    handleOpenInitiativeDocument,
    handlePreviewSelection,
  ]);

  // ============================================
  // CONTENT RENDERING - Original Portfolio Components
  // ============================================

  const renderContent = () => {
    // USPOJNIENIE E1/E2: Observability tab — lineage + funnel (read-only)
    if (activeTab === 'observability') {
      return <InitiativeObservabilityPanel initialInitiativeId={previewInitiativeId} />;
    }
    // F2: Candidates inbox — AI proposes initiatives from discovery (insights/assessments/audits).
    if (activeTab === 'candidates') {
      return <CandidatesPanel onAccept={handleAcceptCandidate} />;
    }
    // RES-10: Initiatives-owned goals/OKR (goals table). Never Results' kpi_scorecards.
    if (activeTab === 'goals') {
      return (
        <InitiativeGoalsView
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          initiatives={initiatives.map((initiative) => ({
            initiativeId: initiative.id,
            initiativeName: initiative.name,
            initiativeStatus: String(initiative.status),
          }))}
        />
      );
    }
    // F4: Portfolio health — MECE coverage / gaps / balance / duplicate clusters (read-only).
    if (activeTab === 'portfolioHealth') {
      return (
        <PortfolioHealthView
          onOpenInitiative={(id, title) =>
            handleOpenDocument({
              id,
              type: 'initiative',
              name: title || t('initiatives.document.untitled', 'Untitled initiative'),
            })
          }
        />
      );
    }
    // V3-F02: Analysis tab — portfolio quality gate
    if (activeTab === 'analysis') {
      return (
        <PortfolioAnalysisView
          initiatives={initiatives}
          onOpenInitiative={(id) => {
            const init = initiatives.find((i) => i.id === id);
            if (init) handlePreviewSelection(init.id);
          }}
          onQuickUpdate={
            isPilotParticipant
              ? undefined
              : async (initiativeId, updates) => {
                  await handleQuickUpdate(initiativeId, updates as Partial<PortfolioInitiative>);
                }
          }
          users={users}
          projectId={currentProjectId || undefined}
          subview={analysisSubview}
          onRegisterActions={registerAnalysisActions}
        />
      );
    }

    // If there's an active document, show the appropriate view based on type
    if (activeDocumentId) {
      const activeDoc = openDocuments.find((d) => d.id === activeDocumentId);

      if (activeDoc?.type === 'decision') {
        return (
          <DecisionDetailView
            decisionId={activeDocumentId}
            onClose={handleShowList}
            onSaved={() => fetchData(true)}
          />
        );
      }

      if (activeDoc?.type === 'task') {
        return (
          <TaskDetailView
            taskId={activeDocumentId}
            onClose={handleShowList}
            onSaved={() => fetchData(true)}
            onOpenDecision={handleOpenDecision}
          />
        );
      }

      if (activeDoc?.type === 'initiative' || !activeDoc) {
        return (
          <InitiativeDocumentView
            initiativeId={activeDocumentId}
            sourceModule="initiatives"
            onBack={handleShowList}
            onOpenTask={handleOpenTask}
            onOpenDecision={handleOpenDecision}
            onStatusChange={() => fetchData(true)}
          />
        );
      }

      return null;
    }

    if (loadError) {
      return (
        <div className="flex items-center justify-center h-full px-6">
          <div
            className="max-w-xl w-full p-5 rounded-2xl border border-danger-500/20 bg-danger-900/10"
            role="alert"
          >
            <div className="text-sm font-semibold text-danger-300">
              {t('initiatives.hub.failedToLoad')}
            </div>
            <div className="text-sm text-danger-200/80 mt-1">{loadError}</div>
            {loadErrorCode ? (
              <p className="mt-1 text-xs text-danger-200/70 font-mono">code: {loadErrorCode}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => fetchData(true)}
                className="h-9 rounded-lg border border-danger-400/40 px-3 text-sm text-danger-100 hover:bg-danger-500/20"
              >
                {t('initiatives.hub.retry')}
              </button>
              <button
                onClick={() => setLoadError(null)}
                className="h-9 rounded-lg border border-c-border-subtle px-3 text-sm text-c-text-secondary hover:bg-c-surface-raised"
              >
                {t('initiatives.hub.dismiss')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="p-6">
          <SharedLoadingState template="list" rows={6} />
        </div>
      );
    }

    if (initiatives.length === 0) {
      return (
        <SharedEmptyState
          variant="new"
          icon={Lightbulb}
          title={t('initiatives.empty.title')}
          description={t('initiatives.empty.description')}
          primaryAction={
            isPilotParticipant
              ? undefined
              : {
                  label: t('initiatives.form.newInitiative'),
                  onClick: () => setShowNewModal(true),
                  icon: Plus,
                }
          }
        />
      );
    }

    // Filter by status if active
    const filteredInitiatives = activeStatusFilter
      ? initiatives.filter((i) => i.status === activeStatusFilter)
      : initiatives;

    // Filter by search
    const searchedInitiatives = searchQuery
      ? filteredInitiatives.filter(
          (i) =>
            i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (i.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
      : filteredInitiatives;

    type PreviewItem = PortfolioInitiative & { title: string };

    const selectedInit = previewInitiativeId
      ? searchedInitiatives.find((i) => i.id === previewInitiativeId) || null
      : null;
    const selectedItem: PreviewItem | null = selectedInit
      ? ({ ...selectedInit, title: selectedInit.name } as PreviewItem)
      : null;
    const itemIds = searchedInitiatives.map((i) => i.id);

    const getPreviewItemById = (id: string): PreviewItem | null => {
      const x = searchedInitiatives.find((i) => i.id === id);
      return x ? ({ ...x, title: x.name || x.id } as PreviewItem) : null;
    };

    const mapToPreviewModel = (i: PortfolioInitiative): InitiativePreviewV3Model => ({
      id: i.id,
      name: i.name,
      status: i.status,
      axis: (i as any).axis,
      priority: (i as any).priority,
      progress: (i as any).progress ?? null,
      createdAt: (i as any).createdAt ?? null,
      updatedAt: (i as any).updatedAt ?? null,
      summary: (i as any).summary ?? null,
      description: (i as any).description ?? null,
      plannedStartDate: (i as any).plannedStartDate ?? null,
      plannedEndDate: (i as any).plannedEndDate ?? null,
      ownerBusiness: (i as any).ownerBusiness ?? null,
      ownerExecution: (i as any).ownerExecution ?? null,
      sourceType: (i as any).sourceType ?? (i as any).source_type ?? null,
      sourceId: (i as any).sourceId ?? (i as any).source_id ?? null,
    });

    const openAiChat = async (initiative: PortfolioInitiative, promptText: string) => {
      try {
        const convId = await openChatWithContext({
          entityType: 'initiative',
          entityId: initiative.id,
          entityName: initiative.name,
          contextData: initiative as unknown as Record<string, unknown>,
          pmoContext: { initiativeIds: [initiative.id] },
        });
        await addChatMessage({
          conversationId: convId,
          role: 'user',
          content: promptText,
        } as any);
        toast.success(t('initiatives.toast.chatOpened', 'Chat opened'), { duration: 1500 });
      } catch {
        toast.error(t('initiatives.toast.chatOpenError', 'Failed to open chat'));
      }
    };

    const copyInitiativeLink = async (id: string) => {
      try {
        const url = `${window.location.origin}${ROUTES.INITIATIVES}?open=${encodeURIComponent(id)}&mode=drawer`;
        await navigator.clipboard.writeText(url);
        toast.success(t('initiatives.toast.linkCopied', 'Link copied'));
      } catch {
        toast.error(t('initiatives.toast.linkCopyError', 'Copy failed'));
      }
    };

    const renderInitiativePreview = (item: PreviewItem) => (
      <InitiativePreviewV3Body
        initiative={mapToPreviewModel(item)}
        onSummarize={() =>
          openAiChat(
            item,
            t(
              'initiatives.aiPrompt.summarize',
              'Summarize this initiative in 5 bullets and propose 3 next steps.'
            )
          )
        }
        // B1 (deliverables): document intent captured by the chat intercept;
        // the initiative's sourceRefs flow from workspaceContext (openChatWithContext).
        onMakeDocument={() =>
          openAiChat(
            item,
            t(
              'initiatives.aiPrompt.makeDocument',
              'Write a document based on this initiative: goals, status, risks and recommendations.'
            )
          )
        }
      />
    );

    const renderInitiativePreviewFooter = (item: PreviewItem) => (
      <InitiativePreviewV3Footer
        initiative={mapToPreviewModel(item)}
        tasksCount={Array.isArray((item as any).tasks) ? (item as any).tasks.length : undefined}
        // NOTE #15 (TOP): expose the "Open" CTA from board/preview — previously
        // onOpenFull was not passed, so the button did not exist at all and the full
        // initiative view (InitiativeDocumentView) was unreachable from board-preview.
        // We wire in the canonical document-open path (the same one used by
        // deep-link ?open=<id>&mode=doc).
        onOpenFull={() => handleOpenInitiativeDocument(item)}
        onOpenChat={(prompt) => openAiChat(item, prompt)}
        onCopyLink={() => copyInitiativeLink(item.id)}
        extraActionsAfterSlot={
          <button
            type="button"
            onClick={() =>
              navigate(buildInitiativeDeepLink(item.id, { module: 'economics', tab: 'models' }))
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition"
          >
            {t('initiatives.financeShortcut', 'Finance')}
          </button>
        }
      />
    );

    // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Portfolio
    // 'table' viewMode → StandardTable + StandardPreview. Moduł deklaruje
    // TYLKO dane + kontrakt kebaba/akcji; chrome pochodzi z fasad Standard*
    // (wzorzec 1:1 z AssessmentHub 'list' — 6fb79511fe / InterviewHub Inbox —
    // 290c78ea33). Widok KANBAN (poniżej) pozostaje nietknięty.
    const PRIORITY_LEVEL_MAP: Record<string, PriorityLevel> = {
      CRITICAL: 'urgent',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
    };

    const isTerminalStatusValue = (status: string) =>
      status === InitiativeStatus.CANCELLED || status === InitiativeStatus.ARCHIVED;

    // canon A10/C1: dot color derives from the neutral c-* semantic tokens
    // (statusChipTone), never from STATUS_METADATA.dotColor — one status there
    // maps to the legacy crimson brand class (tracked separately in
    // initiativeLifecycle.ts) which must not surface in new Triada UI.
    const statusDotClass = (status: string): string => {
      const tone = statusChipTone(status);
      return tone === 'info'
        ? 'bg-c-info'
        : tone === 'warning'
          ? 'bg-c-warning'
          : tone === 'success'
            ? 'bg-c-success'
            : tone === 'danger'
              ? 'bg-c-danger'
              : 'bg-c-text-muted';
    };

    const initiativeColumns: StandardTableColumn[] = [
      {
        id: 'name',
        label: t('initiatives.table.initiative', 'Initiative'),
        render: (row: PortfolioInitiative) => (
          <span className="text-sm font-semibold text-c-text truncate block">{row.name}</span>
        ),
      },
      {
        id: 'status',
        label: t('initiatives.table.status', 'Status'),
        width: '150px',
        filterable: true,
        filterOptions: ALL_STATUSES.map((s) => ({
          value: s,
          label: STATUS_METADATA[s as InitiativeStatus]?.label || s,
          color: statusDotClass(s),
        })),
        render: (row: PortfolioInitiative) => {
          const label = STATUS_METADATA[row.status as InitiativeStatus]?.label || row.status;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-c-text-secondary">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDotClass(row.status)}`}
              />
              {label}
            </span>
          );
        },
      },
      {
        id: 'priority',
        label: t('initiatives.table.priority', 'Priority'),
        width: '110px',
        filterable: true,
        filterOptions: [
          { value: 'CRITICAL', label: 'Critical', color: 'bg-danger-500' },
          { value: 'HIGH', label: 'High', color: 'bg-amber-500' },
          { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-500' },
          { value: 'LOW', label: 'Low', color: 'bg-c-text-muted' },
        ],
        render: (row: PortfolioInitiative) => {
          const level = PRIORITY_LEVEL_MAP[row.priority];
          return level ? (
            <PriorityChip level={level} label={row.priority} />
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          );
        },
      },
      {
        id: 'owner',
        label: t('initiatives.table.owner', 'Owner'),
        width: '170px',
        render: (row: PortfolioInitiative) => {
          const owner = row.ownerBusiness || row.ownerExecution;
          if (!owner) return <span className="text-xs text-c-text-muted">—</span>;
          const name = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || '—';
          return <span className="text-xs text-c-text-secondary truncate block">{name}</span>;
        },
      },
      {
        id: 'plannedEndDate',
        label: t('initiatives.table.targetDate', 'Target date'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: PortfolioInitiative) =>
          row.plannedEndDate ? new Date(row.plannedEndDate).getTime() : 0,
        render: (row: PortfolioInitiative) =>
          row.plannedEndDate ? (
            <DueChip
              label={formatShortDate(row.plannedEndDate)}
              due={isTerminalStatusValue(row.status) ? null : row.plannedEndDate}
              showIcon
            />
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          ),
      },
      {
        id: 'health',
        label: t('initiatives.table.health', 'Health'),
        width: '110px',
        render: (row: PortfolioInitiative) => {
          const health = getHealthInfo(row);
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-c-text-muted">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${health.dotClass}`} />
              {health.label}
            </span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('initiatives.table.updated', 'Updated'),
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: PortfolioInitiative) =>
          row.updatedAt ? new Date(row.updatedAt).getTime() : 0,
        render: (row: PortfolioInitiative) => (
          <span className="text-xs text-c-text-muted tabular-nums">
            {formatRelativeTime(row.updatedAt)}
          </span>
        ),
      },
    ];

    const selectedTableRow: PortfolioInitiative | null = selectedInit;

    const tablePreviewActions: StandardPreviewActions | undefined = selectedTableRow
      ? {
          resolutions: !isPilotParticipant
            ? [
                {
                  id: 'delete',
                  variant: 'destructive',
                  label: t('common.delete', 'Delete'),
                  icon: Trash2,
                  onClick: () => void handleDeleteInitiative(selectedTableRow),
                },
              ]
            : undefined,
          informational: [
            {
              id: 'copy-link',
              variant: 'neutral',
              label: t('initiatives.copyLinkAction', 'Copy link'),
              icon: Copy,
              onClick: () => void copyInitiativeLink(selectedTableRow.id),
            },
          ],
        }
      : undefined;

    switch (viewMode) {
      case 'table':
        return (
          <div className="h-full flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
              <StandardTable
                columns={initiativeColumns}
                data={
                  searchedInitiatives as unknown as Array<Record<string, unknown> & { id: string }>
                }
                selectedRowId={previewInitiativeId}
                onRowClick={(row) => handleInitiativeClick(row as unknown as PortfolioInitiative)}
                onRowDoubleClick={(row) =>
                  handleOpenInitiativeDocument(row as unknown as PortfolioInitiative)
                }
                rowDescription={(row) => (row as unknown as PortfolioInitiative).summary || null}
                defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
                persistKey="initiatives.portfolio.list"
                selection={{ selectedIds, onChange: setSelectedIds }}
                empty={{
                  icon: Lightbulb,
                  title: t('initiatives.hub.noInitiativesFound', 'No initiatives found'),
                  description: t(
                    'initiatives.hub.noInitiativesFoundDesc',
                    'No initiatives match the current filters. Try widening the search or clearing filters.'
                  ),
                }}
                rowMenu={(row): StandardRowMenu => {
                  const initiative = row as unknown as PortfolioInitiative;
                  const canArchive =
                    initiative.status === InitiativeStatus.DONE ||
                    initiative.status === InitiativeStatus.CANCELLED;
                  return {
                    primary: [
                      {
                        id: 'open',
                        label: t('common.open', 'Open'),
                        icon: ExternalLink,
                        onClick: () => handleOpenInitiativeDocument(initiative),
                      },
                    ],
                    timeActions: initiative.plannedEndDate
                      ? [
                          {
                            id: 'delay',
                            label: t('common.delay', 'Delay'),
                            icon: Clock,
                            // Brak dedykowanego endpointu "delay by N days" — quickUpdate
                            // istnieje, ale bez zwalidowanej semantyki przesunięcia terminu
                            // w tym module (§9-todo w PortfolioListView). Disabled z notą
                            // zamiast cichego dopisywania nowej logiki biznesowej.
                            disabled: true,
                            note: t('common.comingSoonBackend', 'Coming soon (backend)'),
                          },
                        ]
                      : undefined,
                    universalHandlers: {
                      preview: () => handleInitiativeClick(initiative),
                      edit: () => handleInitiativeClick(initiative),
                      archive: canArchive ? () => handleArchiveInitiative(initiative) : undefined,
                      archiveNote: canArchive
                        ? undefined
                        : t('initiatives.archive.hint', 'Zakończ lub anuluj najpierw'),
                    },
                    destructive: {
                      onClick: isPilotParticipant
                        ? undefined
                        : () => handleDeleteInitiative(initiative),
                      note: isPilotParticipant
                        ? t('initiatives.pilotAccessBlocked', 'Not available in pilot mode')
                        : undefined,
                    },
                  };
                }}
              />
            </div>

            {selectedTableRow ? (
              <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                <StandardPreview
                  title={
                    selectedTableRow.name ||
                    t('initiatives.document.untitled', 'Untitled initiative')
                  }
                  onClose={() => handlePreviewSelection(null)}
                  onOpenFull={() => handleOpenInitiativeDocument(selectedTableRow)}
                  meta={{
                    pills: [
                      {
                        label:
                          STATUS_METADATA[selectedTableRow.status as InitiativeStatus]?.label ||
                          selectedTableRow.status,
                        tone: statusChipTone(selectedTableRow.status),
                      },
                      {
                        label: selectedTableRow.priority || 'MEDIUM',
                        tone: 'neutral',
                      },
                    ],
                    trailing: (
                      <span className="text-[11px] font-semibold text-c-text-secondary">
                        {selectedTableRow.plannedEndDate
                          ? formatShortDate(selectedTableRow.plannedEndDate)
                          : '—'}
                      </span>
                    ),
                  }}
                  details={{
                    text:
                      selectedTableRow.summary ||
                      selectedTableRow.description ||
                      t('initiatives.noDescription', 'No description.'),
                    onCopy: () => {
                      void navigator.clipboard?.writeText(
                        `${selectedTableRow.name} — ${selectedTableRow.status}`
                      );
                    },
                  }}
                  ai={{
                    hints: [
                      t('initiatives.aiHint.summarize', 'Summarize'),
                      t('initiatives.aiHint.makeDocument', 'Make document'),
                    ],
                    onRunHint: (hint) => {
                      const isSummarize = hint === 'Podsumuj' || hint === 'Summarize';
                      void openAiChat(
                        selectedTableRow,
                        isSummarize
                          ? t(
                              'initiatives.aiPrompt.summarize',
                              'Summarize this initiative in 5 bullets and propose 3 next steps.'
                            )
                          : t(
                              'initiatives.aiPrompt.makeDocument',
                              'Write a document based on this initiative: goals, status, risks and recommendations.'
                            )
                      );
                    },
                  }}
                  relations={
                    selectedTableRow.sourceType && selectedTableRow.sourceId
                      ? [
                          {
                            label: getSourceDisplayLabel(selectedTableRow.sourceType),
                            onClick: () =>
                              navigate(
                                buildInitiativeDeepLink(selectedTableRow.id, { mode: 'doc' })
                              ),
                          },
                        ]
                      : []
                  }
                  actions={tablePreviewActions}
                />
              </aside>
            ) : null}
          </div>
        );
      case 'grid':
        return (
          <div className="h-full overflow-hidden">
            <TableWithPreviewLayout<PreviewItem>
              selectedId={previewInitiativeId}
              selectedItem={selectedItem}
              onSelect={handlePreviewSelection}
              itemIds={itemIds}
              getItemById={getPreviewItemById}
              renderPreview={renderInitiativePreview}
              renderPreviewFooter={renderInitiativePreviewFooter}
            >
              <div className="h-full overflow-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {searchedInitiatives.map((initiative) => (
                    <InitiativeGridCard
                      key={initiative.id}
                      initiative={initiative}
                      onClick={() => handleInitiativeClick(initiative)}
                      onArchive={handleArchiveInitiative}
                      onOpenFull={(initiative) =>
                        handleOpenDocument({
                          id: initiative.id,
                          type: 'initiative',
                          name: String(initiative.name || ''),
                          status: String(initiative.status || '').toUpperCase() as any,
                        })
                      }
                    />
                  ))}
                </div>
                {searchedInitiatives.length === 0 && (
                  <SharedEmptyState
                    variant="filter"
                    title={t('initiatives.hub.noInitiativesFound', 'No initiatives found')}
                    description={t(
                      'initiatives.hub.noInitiativesFoundDesc',
                      'No initiatives match the current filters. Try widening the search or clearing filters.'
                    )}
                    primaryAction={{
                      label: t('common.clearFilters', 'Clear filters'),
                      onClick: () => {
                        setSearchQuery('');
                        setActiveStatusFilter(null);
                      },
                    }}
                  />
                )}
              </div>
            </TableWithPreviewLayout>
          </div>
        );
      case 'kanban':
        return (
          <div className="h-full overflow-hidden">
            <TableWithPreviewLayout<PreviewItem>
              selectedId={previewInitiativeId}
              selectedItem={selectedItem}
              onSelect={handlePreviewSelection}
              itemIds={itemIds}
              getItemById={getPreviewItemById}
              renderPreview={renderInitiativePreview}
              renderPreviewFooter={renderInitiativePreviewFooter}
            >
              <PortfolioKanbanView
                initiatives={searchedInitiatives}
                onInitiativeClick={handleInitiativeClick}
                onStatusChange={handleStatusChange}
                scope={scope}
                // #75a — same existing signal that already gates
                // handleStatusChange (dispatchPilotAccessBlocked above):
                // pilot/viewer roles have no permission to change an
                // initiative's status, so disable picking up cards for them
                // instead of only failing after the drop.
                canDrag={!isPilotParticipant}
                dragDisabledReason={t(
                  'initiatives.kanban.dragDisabled',
                  "You don't have permission to change this initiative's status."
                )}
              />
            </TableWithPreviewLayout>
          </div>
        );
      case 'timeline':
        return (
          <div className="h-full overflow-hidden">
            <TableWithPreviewLayout<PreviewItem>
              selectedId={previewInitiativeId}
              selectedItem={selectedItem}
              onSelect={handlePreviewSelection}
              itemIds={itemIds}
              getItemById={getPreviewItemById}
              renderPreview={renderInitiativePreview}
              renderPreviewFooter={renderInitiativePreviewFooter}
            >
              <InitiativesTimelineView
                initiatives={searchedInitiatives}
                onInitiativeClick={handleInitiativeClick}
                projectId={currentProjectId || undefined}
              />
            </TableWithPreviewLayout>
          </div>
        );
      default:
        return null;
    }
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  // Active / All scope toggle (matches agreed UI spec)
  const scopeToggle = (
    <div
      className="inline-flex items-center rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised p-0.5"
      role="radiogroup"
      aria-label={t('initiatives.scope.label', 'Scope')}
    >
      {[
        { id: 'active' as const, label: t('initiatives.scope.active', 'Active') },
        { id: 'all' as const, label: t('initiatives.scope.all', 'All') },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            setScope(opt.id);
            if (opt.id === 'active') setActiveStatusFilter(null);
          }}
          className={`inline-flex items-center justify-center h-8 px-3 rounded-full text-[11px] font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-c-bg ${
            scope === opt.id
              ? 'bg-c-surface text-c-text shadow-sm border border-c-border-subtle'
              : 'text-c-text-secondary hover:bg-c-surface-raised'
          }`}
          title={
            opt.id === 'active'
              ? t(
                  'initiatives.scope.activeHint',
                  'Review → Promoted → Planning → Approved → Scheduled'
                )
              : t(
                  'initiatives.scope.allHint',
                  'Full lifecycle including Draft, Executing, Blocked, Done, Archived...'
                )
          }
          role="radio"
          aria-checked={scope === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const rightControls = <div className="flex items-center gap-2">{scopeToggle}</div>;

  const totalPendingDecisionEntries = v8PendingDecisionChains.reduce(
    (sum, chain) =>
      sum + chain.decisions.filter((decision) => decision.status === 'pending').length,
    0
  );
  const hasActiveV8Snapshot =
    !!v8InitiativeSnapshot && !!v8SnapshotTargetId && v8SnapshotInitiativeId === v8SnapshotTargetId;
  const v8SnapshotPendingDecisionEntries = hasActiveV8Snapshot
    ? v8InitiativeSnapshot.decisionChains.reduce(
        (sum, chain) =>
          sum + chain.decisions.filter((decision) => decision.status === 'pending').length,
        0
      )
    : 0;
  const v8SnapshotGapCount =
    hasActiveV8Snapshot && !v8InitiativeSnapshot.wbsCompleteness.complete
      ? v8InitiativeSnapshot.wbsCompleteness.gaps.length
      : 0;

  const ANALYSIS_SUBVIEWS: { id: AnalysisSubview; labelKey: string; icon: React.ReactNode }[] = [
    {
      id: 'resources',
      labelKey: 'initiatives.analysis.resources.title',
      icon: <Users size={14} className="text-c-text-secondary" />,
    },
    {
      id: 'feasibility',
      labelKey: 'initiatives.analysis.feasibility.title',
      icon: <Target size={14} className="text-amber-400" />,
    },
    {
      id: 'logic',
      labelKey: 'initiatives.analysis.logic.title',
      icon: <GitBranch size={14} className="text-blue-400" />,
    },
    {
      id: 'timeline',
      labelKey: 'initiatives.analysis.timeline.title',
      icon: <BarChart3 size={14} className="text-emerald-400" />,
    },
    {
      id: 'completeness',
      labelKey: 'initiatives.analysis.completeness.title',
      icon: <CheckCircle2 size={14} className="text-danger-400" />,
    },
  ];

  const analysisCommandRow = (
    <div className="flex items-center justify-between gap-2">
      <div className={MENU_3_LEFT_CLASS}>
        {ANALYSIS_SUBVIEWS.map((sv) => (
          <button
            key={sv.id}
            type="button"
            onClick={() => setAnalysisSubview(sv.id)}
            className={analysisSubview === sv.id ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
          >
            {sv.icon}
            {t(sv.labelKey, sv.id.charAt(0).toUpperCase() + sv.id.slice(1))}
          </button>
        ))}
      </div>
      {analysisActionButtons && <div className={MENU_3_RIGHT_CLASS}>{analysisActionButtons}</div>}
    </div>
  );

  // Menu 3 stability: render the FULL portfolio status set ALWAYS (In Review →
  // Promoted → Planning → Approved → Scheduled), regardless of which filter is
  // active or which view is shown. Only the active state + the bottom list change —
  // Menu 3 itself never rebuilds on view/filter change. Any extra active status
  // (e.g. a non-portfolio status reached via deep link) is appended so it never
  // disappears while selected.
  const PORTFOLIO_STATUS_CHIPS: InitiativeStatus[] = useMemo(
    () => [
      InitiativeStatus.REVIEW,
      InitiativeStatus.PROMOTED,
      InitiativeStatus.PLANNING,
      InitiativeStatus.APPROVED,
      InitiativeStatus.SCHEDULED,
    ],
    []
  );
  const visibleStatusChips = useMemo(() => {
    const base = [...PORTFOLIO_STATUS_CHIPS];
    if (
      activeStatusFilter &&
      ALLOWED_STATUSES.includes(activeStatusFilter as InitiativeStatus) &&
      !base.includes(activeStatusFilter as InitiativeStatus)
    ) {
      base.push(activeStatusFilter as InitiativeStatus);
    }
    return base;
  }, [PORTFOLIO_STATUS_CHIPS, activeStatusFilter]);

  // Canon §15.3 Formula 2 — MULTI-SELECT bulk action bar.
  // When ≥1 row is selected in table view, Menu 3 becomes a bulk bar:
  // "N selected · Clear" + framed action buttons (real where wired, disabled
  // "Coming soon (backend)" where the endpoint doesn't exist yet — never omitted).
  const isBulkMode =
    viewMode === 'table' &&
    !activeDocumentId &&
    activeTab !== 'analysis' &&
    !isPilotParticipant &&
    selectedIds.size > 0;

  const comingSoonBackend = t('common.comingSoonBackend', 'Coming soon (backend)');
  // "Coming soon" affordance for features that are not yet functional (task #11).
  const comingSoonPrep = t('common.comingSoonPrep', 'Coming soon');
  const bulkButtonBase = `${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`;
  // DP-5: bulk Tag / Change due date / Delete have no backend endpoint. Hide
  // the stub behind a flag (default OFF) instead of shipping dead CTAs.
  const showBulkStubActions = isInitiativesBulkStubEnabled();

  const bulkBarContent = (
    <div className="flex items-center justify-between gap-2">
      <div className="inline-flex items-center gap-2">
        <span className="text-xs font-semibold text-c-text-secondary">
          {t('initiatives.bulk.selected', {
            count: selectedIds.size,
            defaultValue: '{{count}} selected',
          })}
        </span>
        <button
          type="button"
          onClick={handleClearSelection}
          className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
        >
          <X className="h-3.5 w-3.5" />
          {t('common.clear', 'Clear')}
        </button>
      </div>
      <div className={`${MENU_3_RIGHT_CLASS} overflow-x-auto no-scrollbar`}>
        {/* Export CSV — real, frontend-only */}
        <button type="button" onClick={handleExportSelectedCsv} className={bulkButtonBase}>
          <Download className="h-3.5 w-3.5" />
          {t('initiatives.bulk.exportCsv', 'Export CSV')}
        </button>
        {/* Tag — no backend endpoint (DP-5: hidden unless stub flag is on) */}
        {showBulkStubActions && (
          <button type="button" disabled className={bulkButtonBase} title={comingSoonBackend}>
            <Tag className="h-3.5 w-3.5" />
            {t('initiatives.bulk.tag', 'Tag')}
          </button>
        )}
        {/* Assign / Reassign — wired via bulk modal (owner change) */}
        <button type="button" onClick={() => setShowBulkModal(true)} className={bulkButtonBase}>
          <UserPlus className="h-3.5 w-3.5" />
          {t('initiatives.bulk.assign', 'Assign')}
        </button>
        {/* Change due date — no backend endpoint (DP-5: hidden unless stub flag on) */}
        {showBulkStubActions && (
          <button type="button" disabled className={bulkButtonBase} title={comingSoonBackend}>
            <CalendarClock className="h-3.5 w-3.5" />
            {t('initiatives.bulk.changeDueDate', 'Change due date')}
          </button>
        )}
        {/* Archive — wired (only DONE/CANCELLED eligible per backend rule) */}
        <button
          type="button"
          onClick={async () => {
            const eligible = initiatives.filter(
              (i) =>
                selectedIds.has(i.id) &&
                (i.status === InitiativeStatus.DONE || i.status === InitiativeStatus.CANCELLED)
            );
            if (eligible.length === 0) {
              toast.error(
                t(
                  'initiatives.bulk.archiveIneligible',
                  'Only done/cancelled initiatives can be archived'
                )
              );
              return;
            }
            for (const init of eligible) {
              // eslint-disable-next-line no-await-in-loop
              await handleArchiveInitiative(init);
            }
            handleClearSelection();
          }}
          className={bulkButtonBase}
        >
          <Archive className="h-3.5 w-3.5" />
          {t('common.archive', 'Archive')}
        </button>
        {/* AI: Analyze selection — contextual, retained */}
        <button
          type="button"
          onClick={() => setShowBulkModal(true)}
          className={MENU_3_ACTION_NEUTRAL}
          title={t('portfolio.ai.analyzeSelection', 'AI: Analyze selection')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t('portfolio.ai.analyzeSelection', 'AI: Analyze selection')}
        </button>
        {/* Delete — danger, no backend endpoint (DP-5: hidden unless stub flag on) */}
        {showBulkStubActions && (
          <button
            type="button"
            disabled
            className={`${MENU_3_ACTION_DANGER} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={comingSoonBackend}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('common.delete', 'Delete')}
          </button>
        )}
      </div>
    </div>
  );

  const commandRowContent = (
    <div className="flex items-center justify-between gap-2">
      <div className={MENU_3_LEFT_CLASS}>
        <button
          type="button"
          onClick={() => setActiveStatusFilter(null)}
          className={!activeStatusFilter ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
        >
          <span className={MENU_3_ALL_DOT_CLASS} />
          <span>ALL</span>
          <span className={!activeStatusFilter ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
            {statusCounts.all ?? 0}
          </span>
        </button>
        {visibleStatusChips.map((s) => {
          const meta = STATUS_METADATA[s];
          const isActive = activeStatusFilter === s;
          const count = statusCounts[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActiveStatusFilter(isActive ? null : s)}
              className={isActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
            >
              <span className={`w-2 h-2 rounded-full ${meta?.dotColor || 'bg-c-text-muted'}`} />
              <span>{meta?.label || s}</span>
              <span className={isActive ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {/* P-22 (Piotr, OBR-102 2026-07-27): „Te dwa przyciski nie są potrzebne
          na pewno" — prawa strona Menu 3 jest teraz PUSTA.
          - „+ New"   → usunięty 07-27 (D-01: dublował CTA „New initiative")
          - „Charter" → usunięty tu (2026-07-28): kanon TRIADA A3 dopuszcza po
            prawej stronie Menu 3 WYŁĄCZNIE przyciski AI (wzorzec: `AI Priorities`
            w Tasks), a Charter to akcja tworzenia. Funkcja NIE zniknęła —
            `InitiativeCharterWizard` ma wejście w globalnym
            `UnifiedCreateLauncher` (shared/UnifiedCreateLauncher.tsx) oraz
            w `InitiativeGeneratorModal`.
          #75 — the "AI Initiative Wizard" entry that used to live here was
          removed earlier: it duplicated the source-anchored insight-picker that
          belongs to the SOURCE (Interview/Tools). */}
    </div>
  );

  return (
    <div className="h-full" data-testid="initiatives-hub">
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleMainTabChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        primaryCta={
          isPilotParticipant
            ? {
                label: t('initiatives.form.newInitiative'),
                onClick: () => dispatchPilotAccessBlocked({ href: '/initiatives' }),
                locked: true,
                lockedReason: t(
                  'initiatives.pilot.createLocked',
                  'Available in the next project phase'
                ),
              }
            : {
                label: t('initiatives.form.newInitiative'),
                onClick: () => setShowInitiativeWizard(true),
              }
        }
        filterControls={rightControls}
        commandRowContent={
          activeTab === 'analysis'
            ? analysisCommandRow
            : isBulkMode
              ? bulkBarContent
              : commandRowContent
        }
        viewModes={availableViewModes}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">{renderContent()}</div>
        </div>
      </StandardModuleBar>

      <InitiativeWizardModal
        isOpen={showInitiativeWizard}
        language={i18n.language === 'pl' ? 'pl' : 'en'}
        projectId={currentProjectId || undefined}
        existingInitiatives={allInitiatives}
        onClose={() => setShowInitiativeWizard(false)}
        onCreated={(created) => {
          if (!created.length) return;
          setAllInitiatives((prev) =>
            created.reduce((next, initiative) => upsertPortfolioInitiative(next, initiative), prev)
          );
          setInitiatives((prev) =>
            created.reduce((next, initiative) => upsertPortfolioInitiative(next, initiative), prev)
          );
          const first = created[0];
          if (first?.id) {
            const revealState = getCreatedInitiativeRevealState(
              {
                scope,
                activeStatusFilter,
              },
              first.status
            );
            setScope(revealState.scope);
            setActiveStatusFilter(revealState.activeStatusFilter);
            if (created.length === 1) {
              // M13 flow redesign: a single freshly created initiative opens
              // straight in its DOCUMENT (not just the list preview).
              handleOpenInitiativeDocument(first);
            } else {
              setPreviewInitiativeId(first.id);
            }
          }
        }}
      />

      {/* P-22 (2026-07-28): `InitiativeCharterWizard` zdjęty razem z przyciskiem
          „Charter" z Menu 3 — bez triggera modal był martwym drzewem. Wejście do
          kreatora żyje w `UnifiedCreateLauncher` i `InitiativeGeneratorModal`. */}

      {/* New Initiative Modal — D1.1: includes type/level selector */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-c-text mb-4">
              {t('initiatives.form.createNew')}
            </h2>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.form.titleRequired')}
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                  placeholder={t('initiatives.form.titlePlaceholder')}
                  autoFocus
                />
              </div>

              {/* D1.1: Initiative Type/Level selector */}
              <div>
                <label className="block text-xs text-c-text-muted mb-2">
                  Initiative Type / Level *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {INITIATIVE_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setNewLevel(level.id)}
                      className={`
                        relative p-3 rounded-lg border text-left transition-[background-color,border-color,box-shadow] duration-200
                        ${
                          newLevel === level.id
                            ? `${level.color} border-current ring-1 ring-current/30`
                            : 'bg-c-bg border-c-border-subtle text-c-text-muted hover:border-c-border-strong'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{level.icon}</span>
                        <span className="text-xs font-semibold">{level.label}</span>
                      </div>
                      <p className="text-[10px] leading-tight opacity-70">{level.description}</p>
                      {newLevel === level.id && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Axis */}
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.form.axis')}
                </label>
                <select
                  value={newAxis}
                  onChange={(e) => setNewAxis(e.target.value as any)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                >
                  <option value="operational">{t('initiatives.axis.operational')}</option>
                  <option value="strategic">{t('initiatives.axis.strategic')}</option>
                  <option value="transformational">{t('initiatives.axis.transformational')}</option>
                  <option value="compliance">{t('initiatives.axis.compliance')}</option>
                </select>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.form.summary')}
                </label>
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text resize-none"
                  rows={3}
                  placeholder={t('initiatives.form.summaryPlaceholder')}
                />
              </div>

              {/* D1.1: Level info callout */}
              {newLevel && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-c-surface-raised border border-c-border-subtle">
                  <Shield size={14} className="text-c-text-muted mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-c-text-muted">
                    <span className="font-medium text-c-text-secondary">
                      {INITIATIVE_LEVELS.find((l) => l.id === newLevel)?.label}
                    </span>
                    {' — '}
                    {newLevel === 'quick_win' && 'Minimal governance. Can be self-approved.'}
                    {newLevel === 'standard' &&
                      'Standard approval flow. Requires owner + deadline + tasks.'}
                    {newLevel === 'strategic' &&
                      'Executive approval required. Full charter + RAID analysis.'}
                    {newLevel === 'transformation' &&
                      'Board-level governance. Full charter, steering committee, gate reviews.'}
                    <br />
                    <span className="text-c-text-muted italic">
                      Level can be upgraded later but not downgraded.
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button
              disabled={isCreating}
              onClick={async () => {
                if (!newTitle.trim()) {
                  toast.error(t('initiatives.form.titleRequiredError'));
                  return;
                }

                // Check for duplicates
                const duplicateName = checkDuplicateInitiative(newTitle.trim(), allInitiatives);
                if (duplicateName) {
                  const shouldProceed = window.confirm(
                    `${t('initiatives.form.duplicateWarning', { name: duplicateName })}\n\n${t('initiatives.form.duplicateWarningDesc')}\n\n${t('common.confirm', 'Do you want to proceed anyway?')}`
                  );
                  if (!shouldProceed) {
                    return;
                  }
                  toast.error(t('initiatives.form.duplicateWarning', { name: duplicateName }), {
                    duration: 5000,
                  });
                }

                try {
                  setIsCreating(true);
                  const { createdId, truth } = await createInitiativeWriteTruth({
                    projectId: currentProjectId || undefined,
                    title: newTitle.trim(),
                    axis: newAxis,
                    level: newLevel, // D1.1: send initiative level
                    summary: newSummary.trim() || undefined,
                    status: 'DRAFT',
                  });
                  toast.success(t('initiatives.form.initiativeCreated'));
                  setShowNewModal(false);
                  setNewTitle('');
                  setNewSummary('');
                  setNewLevel('standard');
                  if (createdId) {
                    try {
                      const full =
                        truth.initiative || (await V8PlanningApi.getInitiative(createdId));
                      const normalized = normalizeInitiativeForPortfolio(
                        full as Record<string, any>,
                        createdId
                      );
                      if (normalized) {
                        setAllInitiatives((prev) => upsertPortfolioInitiative(prev, normalized));
                        setInitiatives((prev) => upsertPortfolioInitiative(prev, normalized));

                        const revealState = getCreatedInitiativeRevealState(
                          {
                            scope,
                            activeStatusFilter,
                          },
                          normalized.status
                        );

                        if (
                          revealState.scope !== scope ||
                          revealState.activeStatusFilter !== activeStatusFilter
                        ) {
                          setScope(revealState.scope);
                          setActiveStatusFilter(revealState.activeStatusFilter);
                        } else {
                          fetchData(true);
                        }

                        // M13 flow redesign: land in the initiative DOCUMENT
                        // right after creation (draft with clear next steps).
                        handleOpenInitiativeDocument(normalized);
                      } else {
                        fetchData(true);
                      }
                    } catch {
                      fetchData(true);
                    }
                  } else {
                    fetchData(true);
                  }
                } catch (e: any) {
                  toast.error(
                    e?.response?.data?.error || e?.message || t('initiatives.form.createFailed')
                  );
                } finally {
                  setIsCreating(false);
                }
              }}
              className="w-full mt-6 py-2 text-sm text-c-surface bg-c-text hover:opacity-90 transition-colors rounded-lg disabled:opacity-50"
            >
              {isCreating ? t('initiatives.form.creating') : t('initiatives.form.create')}
            </button>
            <button
              disabled={isCreating}
              onClick={() => setShowNewModal(false)}
              className="w-full mt-2 py-2 text-sm text-c-text-muted hover:text-c-text transition-colors border border-c-border-subtle rounded-lg hover:bg-c-surface-raised disabled:opacity-50"
            >
              {t('initiatives.form.cancel')}
            </button>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-c-text mb-4">
              {t('initiatives.bulkEdit.title')}
            </h2>
            <p className="text-sm text-c-text-muted mb-4">
              {t('initiatives.bulkEdit.selectedCount', { count: selectedIds.size })}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.bulkEdit.status')}
                </label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as InitiativeStatus)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                >
                  <option value="">{t('initiatives.bulkEdit.noChange')}</option>
                  {ALLOWED_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_METADATA[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.bulkEdit.priority')}
                </label>
                <select
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                >
                  <option value="">{t('initiatives.bulkEdit.noChange')}</option>
                  <option value="CRITICAL">{t('initiatives.priority.critical')}</option>
                  <option value="HIGH">{t('initiatives.priority.high')}</option>
                  <option value="MEDIUM">{t('initiatives.priority.medium')}</option>
                  <option value="LOW">{t('initiatives.priority.low')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.bulkEdit.businessOwner')}
                </label>
                <select
                  value={bulkOwnerBusinessId}
                  onChange={(e) => setBulkOwnerBusinessId(e.target.value)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                >
                  <option value="">{t('initiatives.bulkEdit.noChange')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.bulkEdit.executionOwner')}
                </label>
                <select
                  value={bulkOwnerExecutionId}
                  onChange={(e) => setBulkOwnerExecutionId(e.target.value)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                >
                  <option value="">{t('initiatives.bulkEdit.noChange')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-sm text-c-text-muted hover:text-c-text"
              >
                {t('initiatives.form.cancel')}
              </button>
              <button
                onClick={handleBulkApply}
                className="px-4 py-2 text-sm text-c-surface bg-c-text hover:opacity-90 rounded-lg"
              >
                {t('initiatives.bulkEdit.applyChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiativesHub;
