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
import { statusChipTone } from '@/components/ui/primitives/chips';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
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
  cancelInitiativeWriteTruth,
  createInitiativeWriteTruth,
  getInitiativeStatusPreflightTruth,
  quickUpdateInitiativeWriteTruth,
  updateInitiativeStatusWriteTruth,
} from '@/services/initiativeWriteTruth';
import { useConversationStore } from '@/store/useConversationStore';
import { buildInitiativeDeepLink, readInitiativeDeepLinkId } from '@/utils/initiativeDeepLink';
import { checkDuplicateInitiative } from '@/utils/initiativeDuplicateDetection';
import { ACTIVE_STATUSES, formatRelativeTime, formatShortDate } from '@/utils/initiativeHelpers';
import { isInitiativesBulkStubEnabled } from '@/utils/initiativesBulkStubFlag';
import { dispatchPilotAccessBlocked, isPilotParticipantRole } from '@/utils/pilotAccess';

import { listRegisteredInitiatives } from '../../services/initiatives-execution/runtimeApi';
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
import {
  FilterChip,
  HubWorkAreaLoadError,
  ModuleTab,
  OpenDocument,
  ViewMode,
} from '../shared/ModuleHub';
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
import { CanonicalInitiativeCardWorkspace } from './CanonicalInitiativeCardWorkspace';
import { CanonicalInitiativeRegister } from './CanonicalInitiativeRegister';
import { CapacityScenarioSurface } from './CapacityScenarioSurface';
import {
  getCreatedInitiativeRevealState,
  normalizeInitiativeForPortfolio,
  upsertPortfolioInitiative,
} from './initiativeCreateFlow';
import { InitiativeDocumentView } from './InitiativeDocumentView';
import { InitiativeObservabilityPanel } from './InitiativeObservabilityPanel';
import {
  InitiativePreviewV3Body,
  InitiativePreviewV3Footer,
  type InitiativePreviewV3Model,
} from './InitiativePreviewV3';
import { initiativeLoadErrorCode, isInitiativesNetworkError } from './initiativeLoadError';
import {
  canonicalInitiativeMatchesRegisterFilters,
  INITIATIVE_LIFECYCLE_LABELS,
  INITIATIVE_LIFECYCLE_PRESETS,
  type InitiativeLifecyclePreset,
  lifecycleMatchesPreset,
  projectCanonicalInitiativeRegisterRow,
  toCanonicalInitiativeRegisterItem,
} from './initiativeRegisterProjection';
import { createInitiativesDemoDataset, isShowcaseInitiativeId } from './initiativesDemoData';
import { getSourceDisplayLabel } from './InitiativeSourceLink';
import { InitiativesTimelineView } from './InitiativesTimelineView';
import { DEFAULT_INITIATIVES_VIEW_MODE } from './initiativesViewDefaults';
import { PlanScenarioSurface } from './PlanScenarioSurface';
import PortfolioHealthView from './PortfolioHealthView';
import { PortfolioScenarioSurface } from './PortfolioScenarioSurface';
import { SourceProposalRegistrationSurface } from './SourceProposalRegistrationSurface';
import { CandidatesTable } from './CandidatesTable';
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

export const readV8InitiativeId = (response: unknown): string => {
  if (!response || typeof response !== 'object') return '';
  const record = response as Record<string, unknown>;
  const candidate = 'initiative' in record ? record.initiative : record;
  if (!candidate || typeof candidate !== 'object') return '';
  return String((candidate as Record<string, unknown>).id ?? '').trim();
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

const NEW_INITIATIVE_EMPTY_CTA_TESTID = 'initiatives-new-modal-empty-cta';

const CANONICAL_INITIATIVES_TABS = new Set<ModuleTab>([
  'list',
  'plan',
  'capacity',
]);

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
  const [activeTab, setActiveTab] = useState<ModuleTab>(() => {
    const requestedTab = searchParams.get('tab') as ModuleTab | null;
    return requestedTab && CANONICAL_INITIATIVES_TABS.has(requestedTab) ? requestedTab : initialTab;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // V3-A02: Persistent dynamic tabs via sessionStorage
  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('initiatives');
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [activeLifecyclePreset, setActiveLifecyclePreset] =
    useState<InitiativeLifecyclePreset | null>(null);
  const [canonicalMenu3Preset, setCanonicalMenu3Preset] = useState<Record<string, string>>({
    portfolio: 'current',
    plan: 'published',
    capacity: 'all',
  });
  const [canonicalMenu3Counts, setCanonicalMenu3Counts] = useState<
    Record<string, Record<string, number>>
  >({});
  const updateCanonicalMenu3Counts = useCallback(
    (surface: string, counts: Record<string, number>) =>
      setCanonicalMenu3Counts((current) => {
        const previous = current[surface];
        const keys = Object.keys(counts);
        if (
          previous &&
          Object.keys(previous).length === keys.length &&
          keys.every((key) => previous[key] === counts[key])
        ) {
          return current;
        }
        return { ...current, [surface]: counts };
      }),
    []
  );
  const handlePortfolioMenu3Counts = useCallback(
    (counts: Record<string, number>) => updateCanonicalMenu3Counts('portfolio', counts),
    [updateCanonicalMenu3Counts]
  );
  const handlePlanMenu3Counts = useCallback(
    (counts: Record<string, number>) => updateCanonicalMenu3Counts('plan', counts),
    [updateCanonicalMenu3Counts]
  );
  const handleCapacityMenu3Counts = useCallback(
    (counts: Record<string, number>) => updateCanonicalMenu3Counts('capacity', counts),
    [updateCanonicalMenu3Counts]
  );
  /** Active/All scope toggle — used for Kanban columns and data filtering */
  const [scope, setScope] = useState<KanbanScope>('active');

  // Data state
  const [initiatives, setInitiatives] = useState<PortfolioInitiative[]>([]);
  const [allInitiatives, setAllInitiatives] = useState<PortfolioInitiative[]>([]); // For duplicate detection
  const planInitiatives = useMemo(
    () =>
      allInitiatives.map((initiative) => ({
        id: initiative.id,
        name: initiative.name || initiative.title || initiative.id,
      })),
    [allInitiatives]
  );
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
  const newModalDialogRef = useRef<HTMLDivElement>(null);
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
  const closeNewModal = useCallback(() => {
    if (!isCreating) setShowNewModal(false);
  }, [isCreating]);
  const getNewModalFallbackFocusTarget = useCallback(
    () => document.querySelector<HTMLElement>(`[data-testid="${NEW_INITIATIVE_EMPTY_CTA_TESTID}"]`),
    []
  );
  useDialogA11y({
    open: showNewModal,
    onClose: closeNewModal,
    containerRef: newModalDialogRef,
    getFallbackFocusTarget: getNewModalFallbackFocusTarget,
  });

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
  // Sample data is an explicit user-selected source. DEV/local execution must
  // exercise the same canonical API path as production; otherwise a failed
  // backend can look like a healthy populated register and Plan/Capacity never
  // reach their real endpoints.
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

  // Keep the canonical register fetch stable even when the app store selector
  // returns an equivalent user object with a new reference after a rerender.
  const currentUserId = (currentUser as any)?.id;
  const currentUserDisplayName =
    (currentUser as any)?.displayName ||
    [(currentUser as any)?.firstName, (currentUser as any)?.lastName].filter(Boolean).join(' ') ||
    null;

  const mergeShowcaseInitiatives = useCallback(
    (items: PortfolioInitiative[]) => {
      if (!allowDemoData) return items;

      const canonicalIds = new Set(items.map((item) => String(item.id)));
      return [
        ...items,
        ...initiativesDemoData.initiatives.filter(
          (initiative) => !canonicalIds.has(String(initiative.id))
        ),
      ];
    },
    [allowDemoData, initiativesDemoData.initiatives]
  );

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
        const canonical = await listRegisteredInitiatives();
        const canonicalRows: PortfolioInitiative[] = canonical.initiatives.map((record) =>
          toCanonicalInitiativeRegisterItem(record, {
            id: currentUserId,
            displayName: currentUserDisplayName,
          })
        );
        const mergedRows = mergeShowcaseInitiatives(canonicalRows);
        const response: { initiatives: PortfolioInitiative[] } = {
          initiatives: mergedRows.filter((initiative) => {
            if (
              !canonicalInitiativeMatchesRegisterFilters(initiative, {
                projectId: currentProjectId,
                priorities: filters.priority,
              })
            ) {
              return false;
            }
            if (
              scope === 'active' &&
              [
                InitiativeStatus.DONE,
                InitiativeStatus.CANCELLED,
                InitiativeStatus.ARCHIVED,
              ].includes(initiative.status as InitiativeStatus)
            ) {
              return false;
            }
            if (activeStatusFilter && initiative.status !== activeStatusFilter) return false;
            if (activeLifecyclePreset) {
              if (
                !lifecycleMatchesPreset(
                  String((initiative as any).displayStatus),
                  activeLifecyclePreset
                )
              ) {
                return false;
              }
            }
            if (
              searchQuery &&
              !`${initiative.name ?? ''} ${initiative.summary ?? ''}`
                .toLocaleLowerCase()
                .includes(searchQuery.toLocaleLowerCase())
            ) {
              return false;
            }
            return true;
          }),
        };
        setV8PlanningDegraded(false);

        const allowed = (response.initiatives || []).filter((i) =>
          ALLOWED_STATUSES.includes(i.status as InitiativeStatus)
        );
        setInitiatives(allowed);

        // Duplicate detection uses the same canonical source of truth, including history.
        setAllInitiatives(mergedRows);
      } catch (error: any) {
        console.error('[InitiativesHub] Fetch error:', error);
        const isNetworkError = isInitiativesNetworkError(error);
        if (isNetworkError && fetchRetryRef.current < 3) {
          fetchRetryRef.current++;
          const delay = Math.min(2000 * Math.pow(2, fetchRetryRef.current - 1), 8000);
          console.warn(
            `[InitiativesHub] Network error, retrying in ${delay}ms (attempt ${fetchRetryRef.current}/3)`
          );
          setTimeout(() => fetchData(), delay);
          return;
        }
        if (allowDemoData) {
          const demoRows = mergeShowcaseInitiatives([]);
          const visibleDemoRows = demoRows.filter((initiative) => {
            if (
              scope === 'active' &&
              [InitiativeStatus.DONE, InitiativeStatus.CANCELLED, InitiativeStatus.ARCHIVED].includes(
                initiative.status as InitiativeStatus
              )
            ) {
              return false;
            }
            if (activeStatusFilter && initiative.status !== activeStatusFilter) return false;
            if (
              searchQuery &&
              !`${initiative.name ?? ''} ${initiative.summary ?? ''}`
                .toLocaleLowerCase()
                .includes(searchQuery.toLocaleLowerCase())
            ) {
              return false;
            }
            return true;
          });
          setInitiatives(visibleDemoRows);
          setAllInitiatives(demoRows);
          setLoadError(null);
          setLoadErrorCode(null);
          setV8PlanningDegraded(true);
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
        setLoadErrorCode(initiativeLoadErrorCode(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      currentProjectId,
      activeStatusFilter,
      activeLifecyclePreset,
      allowDemoData,
      currentUserDisplayName,
      currentUserId,
      filters.priority,
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

  // Available view modes — plan and capacity are dedicated analysis workspaces.
  const availableViewModes: ViewMode[] =
    activeTab === 'plan' || activeTab === 'capacity'
      ? []
      : ['table', 'kanban', 'timeline', 'grid'];

  // Owner-approved IA: lifecycle/statuses belong to the initiative registry.
  // Candidate and portfolio semantics remain preserved in the data model, but
  // are no longer exposed as duplicate top-level destinations.
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: 'Inicjatywy',
        icon: <List size={16} />,
      },
      {
        id: 'plan' as ModuleTab,
        label: 'Plan',
        icon: <CalendarClock size={16} />,
      },
      {
        id: 'capacity' as ModuleTab,
        label: 'Obciążenie',
        icon: <Users size={16} />,
      },
    ],
    [t]
  );

  useEffect(() => {
    const requestedTab = searchParams.get('tab') as ModuleTab | null;
    if (!requestedTab || CANONICAL_INITIATIVES_TABS.has(requestedTab)) return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    next.delete('candidateInbox');
    next.delete('candidateId');
    next.delete('sourceProposalId');
    setActiveTab('list');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
      const desiredSubType = isShowcaseInitiativeId(initiative.id)
        ? 'showcase'
        : 'canonical-runtime';
      const existingDoc = openDocuments.find(
        (document) => document.id === initiative.id && document.type === 'initiative'
      );
      if (!existingDoc) {
        const newDoc: OpenDocument = {
          id: initiative.id,
          name: initiative.name || t('initiatives.document.untitled', 'Untitled initiative'),
          type: 'initiative',
          subType: desiredSubType,
          status: (initiative.status || InitiativeStatus.DRAFT) as any,
        };
        setOpenDocuments((prev) => [...prev, newDoc]);
      } else if (existingDoc.subType !== desiredSubType) {
        setOpenDocuments((prev) =>
          prev.map((document) =>
            document.id === initiative.id && document.type === 'initiative'
              ? { ...document, subType: desiredSubType }
              : document
          )
        );
      }
      setActiveTab('list');
      setActiveDocumentId(initiative.id);
      handlePreviewSelection(initiative.id);
      if (readInitiativeDeepLinkId(searchParams.toString()) !== initiative.id) {
        navigate(buildInitiativeDeepLink(initiative.id, { mode: 'doc' }), { replace: true });
      }
    },
    [
      handlePreviewSelection,
      navigate,
      openDocuments,
      searchParams,
      setActiveDocumentId,
      setOpenDocuments,
      setSearchParams,
      t,
    ]
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
        // Resolve the owning read model before choosing a document renderer. A legacy
        // initiative may share the same ID/name shape, but it is not a registered V8
        // runtime card and must stay in InitiativeDocumentView.
        const fromList = initiatives.find((i) => i.id === openId);
        const fromShowcase = initiativesDemoData.initiatives.find((i) => i.id === openId);
        let response: any = null;
        let isCanonicalRuntime = false;
        if (!fromShowcase) {
          try {
            await Api.get(`/initiatives/runtime-v1/initiatives/${encodeURIComponent(openId)}`);
            isCanonicalRuntime = true;
          } catch (registrationError: any) {
            if (registrationError?.status !== 404) throw registrationError;
          }

          try {
            const v8Response = await V8PlanningApi.getInitiative(openId);
            if (readV8InitiativeId(v8Response) === openId) {
              response = v8Response;
            } else if (!fromList) {
              throw new Error('Initiative is not registered in the V8 runtime');
            }
          } catch (v8Error) {
            if (!fromList) {
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
          if (isCanonicalRuntime) {
            handleOpenInitiativeDocument(initiative);
          } else {
            handleOpenDocument({
              id: initiative.id,
              name: initiative.name,
              type: 'initiative',
              status: initiative.status,
            });
          }
        } else {
          handleInitiativeClick(initiative);
        }
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            e?.message ||
            t('initiatives.toast.openFailed', 'Failed to open initiative')
        );
      }
    };

    run();
  }, [
    searchParams,
    initiatives,
    initiativesDemoData,
    handleInitiativeClick,
    handleOpenDocument,
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
          updates as Record<string, unknown>,
          (initiatives.find((item) => item.id === initiativeId) as PortfolioInitiative & { canonicalVersion?: number })?.canonicalVersion
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

  const handleResetInitiativeRegisterFilters = useCallback(() => {
    handleClearFilters();
    setSearchQuery('');
    setActiveStatusFilter(null);
    setActiveLifecyclePreset(null);
    setScope('active');
    handlePreviewSelection(null);
  }, [handleClearFilters, handlePreviewSelection]);

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    next.delete('mode');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleMainTabChange = useCallback(
    (tab: ModuleTab) => {
      setActiveTab(tab);
      setActiveDocumentId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      next.delete('mode');
      if (tab === 'list') next.delete('tab');
      else next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setActiveDocumentId, setSearchParams]
  );

  useEffect(() => {
    const syncTabFromHistory = () => {
      const requestedTab = new URLSearchParams(window.location.search).get(
        'tab'
      ) as ModuleTab | null;
      const nextTab =
        requestedTab && CANONICAL_INITIATIVES_TABS.has(requestedTab) ? requestedTab : 'list';
      setActiveTab(nextTab);
      setActiveDocumentId(null);
    };
    window.addEventListener('popstate', syncTabFromHistory);
    return () => window.removeEventListener('popstate', syncTabFromHistory);
  }, [setActiveDocumentId]);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        const next = new URLSearchParams(searchParams);
        next.delete('open');
        next.delete('mode');
        setSearchParams(next, { replace: true });
      }
    },
    [activeDocumentId, searchParams, setSearchParams]
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
    const statusUpdates: Promise<unknown>[] = [];

    const quickUpdatePayload: Record<string, unknown> = {};
    if (bulkOwnerBusinessId) quickUpdatePayload.ownerBusinessId = bulkOwnerBusinessId;
    if (bulkOwnerExecutionId) quickUpdatePayload.ownerExecutionId = bulkOwnerExecutionId;

    const quickUpdates =
      Object.keys(quickUpdatePayload).length > 0
        ? ids.map((id) => {
            const row = initiatives.find((item) => item.id === id) as PortfolioInitiative & { canonicalVersion?: number } | undefined;
            return quickUpdateInitiativeWriteTruth(id, quickUpdatePayload, row?.canonicalVersion);
          })
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
        toast.error(t('initiatives.toast.archiveGoverned', 'Archive is available only from the governed closure workflow.'));
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
        t('initiatives.confirmCancel', {
          name: name || t('initiatives.thisInitiative', 'this initiative'),
          defaultValue: 'Cancel "{{name}}"? Its immutable history will be preserved.',
        })
      );
      if (!shouldProceed) return;
      try {
        const version = (initiative as PortfolioInitiative & { canonicalVersion?: number }).canonicalVersion;
        if (!version) throw new Error('Canonical version is required');
        await cancelInitiativeWriteTruth(initiative.id, version, `Cancelled from Initiatives Hub: ${name || initiative.id}`);
        toast.success(t('initiatives.toast.cancelled', 'Initiative cancelled'));
        await fetchData(true);
      } catch {
        toast.error(t('initiatives.toast.cancelError', 'Could not cancel initiative'));
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
    // Compatibility mount: source proposals belong to the Initiatives intake flow.
    // The legacy "Accept candidate" write path is intentionally no longer reachable
    // from the UI: registration is a governed, idempotent server command with read-back.
    if (activeTab === 'candidates') {
      const candidateInbox =
        searchParams.get('candidateInbox') === 'discovery' ? 'discovery' : 'source';
      const setCandidateInbox = (nextInbox: 'source' | 'discovery') => {
        const next = new URLSearchParams(searchParams);
        next.set('candidateInbox', nextInbox);
        next.delete(nextInbox === 'source' ? 'candidateId' : 'sourceProposalId');
        setSearchParams(next, { replace: true });
      };
      return (
        <div className="flex h-full min-h-0 flex-col">
          <div
            className="flex items-center gap-2 border-b border-c-border px-4 py-2"
            role="tablist"
            aria-label="Candidate inbox"
          >
            <button
              type="button"
              role="tab"
              aria-selected={candidateInbox === 'source'}
              onClick={() => setCandidateInbox('source')}
              className={candidateInbox === 'source' ? 'btn-primary' : 'btn-secondary'}
            >
              Source proposals
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={candidateInbox === 'discovery'}
              onClick={() => setCandidateInbox('discovery')}
              className={candidateInbox === 'discovery' ? 'btn-primary' : 'btn-secondary'}
            >
              Discovery candidates
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {candidateInbox === 'discovery' ? (
              <CandidatesTable
                demoMode={allowDemoData}
                initialSelectedId={searchParams.get('candidateId')}
                onSelectionChange={(candidateId) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('candidateInbox', 'discovery');
                  if (candidateId) next.set('candidateId', candidateId);
                  else next.delete('candidateId');
                  setSearchParams(next, { replace: true });
                }}
              />
            ) : (
              <SourceProposalRegistrationSurface
                demoMode={allowDemoData}
                initialSelectedId={searchParams.get('sourceProposalId')}
                onSelectionChange={(proposalId) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('candidateInbox', 'source');
                  if (proposalId) next.set('sourceProposalId', proposalId);
                  else next.delete('sourceProposalId');
                  setSearchParams(next, { replace: true });
                }}
                onOpenInitiative={(initiativeId) =>
                  handleOpenDocument({
                    id: initiativeId,
                    type: 'initiative',
                    name: t('initiatives.document.untitled', 'Untitled initiative'),
                    subType: 'canonical-runtime',
                    status: InitiativeStatus.DRAFT,
                  })
                }
              />
            )}
          </div>
        </div>
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
    if (activeTab === 'portfolio') {
      return (
        <PortfolioScenarioSurface
          demoMode={allowDemoData}
          portfolioId={currentProjectId}
          initiatives={allInitiatives.map((initiative) => ({
            id: initiative.id,
            name: initiative.name || initiative.title || initiative.id,
            version: (() => {
              const exact = (initiative as PortfolioInitiative & { canonicalVersion?: number })
                .canonicalVersion;
              return Number.isInteger(exact) && Number(exact) > 0 ? Number(exact) : null;
            })(),
          }))}
          activePreset={canonicalMenu3Preset.portfolio}
          onCountsChange={handlePortfolioMenu3Counts}
        />
      );
    }
    if (activeTab === 'plan') {
      return (
        <PlanScenarioSurface
          demoMode={allowDemoData}
          initiatives={planInitiatives}
          activePreset={canonicalMenu3Preset.plan}
          onCountsChange={handlePlanMenu3Counts}
        />
      );
    }
    if (activeTab === 'capacity')
      return (
        <CapacityScenarioSurface
          demoMode={allowDemoData}
          activePreset={canonicalMenu3Preset.capacity}
          onCountsChange={handleCapacityMenu3Counts}
        />
      );

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
        if (activeDoc?.subType === 'canonical-runtime') {
          return (
            <CanonicalInitiativeCardWorkspace
              initiativeId={activeDocumentId}
              onOpenExecution={(executionCaseId) =>
                navigate(`/execution?tab=list&open=${encodeURIComponent(executionCaseId)}`)
              }
              initialCardKey={searchParams.get('cardKey')}
              initialFindingId={searchParams.get('findingId')}
              onContextChange={({ cardKey, findingId }) => {
                const next = new URLSearchParams(searchParams);
                next.set('cardKey', cardKey);
                if (findingId) next.set('findingId', findingId);
                else next.delete('findingId');
                setSearchParams(next, { replace: true });
              }}
              onBack={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('cardKey');
                next.delete('findingId');
                setSearchParams(next, { replace: true });
                handleShowList();
              }}
            />
          );
        }
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
      // The bespoke card that used to live here was painted in a dark-only
      // danger palette (`text-danger-300/200/100`, `bg-danger-900/10`) with no
      // light variants, so in the LIGHT theme the message and the retry button
      // were effectively invisible — the recovery affordance disappeared exactly
      // when the user needed it. `HubWorkAreaLoadError` is the same card with
      // the measured, token-based palette (see its header comment) and is
      // already the pattern used by Results/Execution.
      return (
        <HubWorkAreaLoadError
          title={t('initiatives.hub.failedToLoad')}
          message={loadError}
          errorCode={loadErrorCode}
          retryLabel={t('initiatives.hub.retry')}
          dismissLabel={t('initiatives.hub.dismiss')}
          onRetry={() => {
            void fetchData(true);
          }}
          onDismiss={() => setLoadError(null)}
        />
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
                  testId: NEW_INITIATIVE_EMPTY_CTA_TESTID,
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
    // canon A10/C1: dot color derives from the neutral c-* semantic tokens
    // (statusChipTone), never from STATUS_METADATA.dotColor — one status there
    // maps to the legacy crimson brand class (tracked separately in
    // initiativeLifecycle.ts) which must not surface in new Triada UI.
    switch (viewMode) {
      case 'table':
        return (
          <CanonicalInitiativeRegister
            rows={searchedInitiatives}
            selectedId={previewInitiativeId}
            onSelect={(row) => (row ? handleInitiativeClick(row) : handlePreviewSelection(null))}
            onOpen={handleOpenInitiativeDocument}
            persistKey="initiatives.canonical-register.v1"
            emptyTitle={t('initiatives.hub.noInitiativesFound', 'No initiatives found')}
            emptyDescription={t(
              'initiatives.hub.noInitiativesFoundDesc',
              'No initiatives match the current filters. Try widening the search or clearing filters.'
            )}
            onResetFilters={handleResetInitiativeRegisterFilters}
            relationForRow={(row) =>
              row.sourceType && row.sourceId
                ? [
                    {
                      label: getSourceDisplayLabel(row.sourceType),
                      onClick: () => navigate(buildInitiativeDeepLink(row.id, { mode: 'doc' })),
                    },
                  ]
                : []
            }
          />
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
                canDrag={false}
                dragDisabledReason={t(
                  'initiatives.kanban.dragDisabled',
                  'Use the governed gate workspace to advance lifecycle.'
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

  const lifecyclePresetCounts = useMemo(() => {
    const countable =
      scope === 'active'
        ? allInitiatives.filter(
            (initiative) =>
              !['CLOSED', 'ARCHIVED', 'CANCELLED'].includes(
                String((initiative as any).displayStatus)
              )
          )
        : allInitiatives;
    const counts: Record<string, number> = { all: countable.length };
    for (const preset of INITIATIVE_LIFECYCLE_PRESETS) {
      counts[preset.id] = countable.filter((initiative) =>
        preset.states.includes(String((initiative as any).displayStatus))
      ).length;
    }
    return counts;
  }, [allInitiatives, scope]);

  // Canon §15.3 Formula 2 — MULTI-SELECT bulk action bar.
  // When ≥1 row is selected in table view, Menu 3 becomes a bulk bar:
  // "N selected · Clear" + framed action buttons (real where wired, disabled
  // "Coming soon (backend)" where the endpoint doesn't exist yet — never omitted).
  const isBulkMode =
    viewMode === 'table' &&
    !activeDocumentId &&
    activeTab !== 'portfolio' &&
    activeTab !== 'plan' &&
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
          onClick={() => {
            setActiveLifecyclePreset(null);
            setActiveStatusFilter(null);
          }}
          className={!activeLifecyclePreset ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
        >
          <span className={MENU_3_ALL_DOT_CLASS} />
          <span>Wszystkie</span>
          <span className={!activeLifecyclePreset ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
            {lifecyclePresetCounts.all ?? 0}
          </span>
        </button>
        {INITIATIVE_LIFECYCLE_PRESETS.map((preset) => {
          const isActive = activeLifecyclePreset === preset.id;
          const count = lifecyclePresetCounts[preset.id] ?? 0;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setActiveLifecyclePreset(isActive ? null : preset.id);
                setActiveStatusFilter(null);
                if (preset.id === 'HISTORICAL' && !isActive) setScope('all');
              }}
              className={isActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
            >
              <span className="h-2 w-2 rounded-full bg-c-text-muted" />
              <span>{preset.label}</span>
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

  const canonicalMenu3Definitions: Record<string, Array<{ id: string; label: string }>> = {
    portfolio: [
      ['current', 'Current scenario'],
      ['unassigned', 'Unassigned'],
      ['included', 'Included'],
      ['conditional', 'Conditional'],
      ['deferred', 'Deferred'],
      ['excluded', 'Excluded'],
      ['mandatory', 'Mandatory'],
      ['low-confidence', 'Low confidence'],
      ['coverage-gaps', 'Coverage gaps'],
      ['duplicates', 'Duplicates'],
    ].map(([id, label]) => ({ id, label })),
    plan: [
      ['unscheduled', 'Unscheduled'],
      ['now', 'Now'],
      ['next', 'Next'],
      ['later', 'Later'],
      ['conflicted', 'Conflicted'],
      ['missing-dependencies', 'Missing dependencies'],
      ['needs-capacity', 'Needs capacity'],
      ['ready', 'Ready for schedule'],
      ['published', 'Published'],
    ].map(([id, label]) => ({ id, label })),
    capacity: [
      ['all', 'All constraints'],
      ['critical', 'Critical'],
      ['unknown-supply', 'Unknown supply'],
      ['missing-demand', 'Missing demand'],
      ['skill-gaps', 'Skill gaps'],
      ['management-load', 'Management load'],
      ['budget-envelope', 'Budget envelope'],
      ['unconfirmed', 'Unconfirmed'],
      ['resolved', 'Resolved in scenario'],
    ].map(([id, label]) => ({ id, label })),
  };
  const canonicalMenu3 = canonicalMenu3Definitions[activeTab] ?? [];

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
          activeTab !== 'list'
            ? undefined
            : isPilotParticipant
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
          activeTab === 'portfolio' ||
          activeTab === 'plan' ||
          activeTab === 'capacity' ||
          activeTab === 'candidates'
            ? undefined
            : isBulkMode
              ? bulkBarContent
              : commandRowContent
        }
        chips={canonicalMenu3.map((preset) => ({
          ...preset,
          count: canonicalMenu3Counts[activeTab]?.[preset.id] ?? 0,
        }))}
        activeChip={canonicalMenu3.length ? canonicalMenu3Preset[activeTab] : null}
        onChipChange={(id) =>
          setCanonicalMenu3Preset((current) => ({ ...current, [activeTab]: id }))
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
        initiativeOwnerId={String((currentUser as any)?.id || '')}
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
              handleOpenDocument({
                id: first.id,
                type: 'initiative',
                name: first.name || t('initiatives.document.untitled', 'Untitled initiative'),
                status: first.status,
              });
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
          <div
            ref={newModalDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="initiatives-new-modal-heading"
            tabIndex={-1}
            className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto outline-none"
          >
            <h2 id="initiatives-new-modal-heading" className="text-lg font-semibold text-c-text mb-4">
              {t('initiatives.form.createNew')}
            </h2>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="initiatives-new-modal-title" className="block text-xs text-c-text-muted mb-1">
                  {t('initiatives.form.titleRequired')}
                </label>
                <input
                  id="initiatives-new-modal-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-c-bg border border-c-border-subtle rounded-lg text-sm text-c-text"
                  placeholder={t('initiatives.form.titlePlaceholder')}
                  required
                  aria-required="true"
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
                    projectId: currentProjectId || '',
                    initiativeOwnerId: String((currentUser as any)?.id || ''),
                    title: newTitle.trim(),
                    problem: newSummary.trim() || newTitle.trim(),
                    proposedOutcome: newSummary.trim() || null,
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
              {false && <div>
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
              </div>}
              {false && <div>
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
              </div>}
              {false && <div>
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
              </div>}
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
