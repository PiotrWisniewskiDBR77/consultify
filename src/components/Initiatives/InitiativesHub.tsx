/**
 * InitiativesHub
 * Unified Initiatives module with ModuleHub UI pattern
 * Integrates original Portfolio components (Kanban, List, Timeline, Matrix)
 * Connected to real API endpoints
 */

import { AlertTriangle, Edit2, Filter, Lightbulb, Plus, RefreshCw, Shield } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';
import { checkDuplicateInitiative } from '@/utils/initiativeDuplicateDetection';
import { ACTIVE_STATUSES, ALL_STATUSES } from '@/utils/initiativeHelpers';

import { useAppStore } from '../../store/useAppStore';
import { InitiativeStatus, PortfolioFilters, PortfolioInitiative } from '../../types';
// Detail views
import { DecisionDetailView } from '../MyWork/DecisionDetailView';
import { TaskDetailView } from '../MyWork/TaskDetailView';
// Grid card for grid view
import { InitiativeGridCard } from '../Portfolio/InitiativeGridCard';
// Portfolio view components
import { type KanbanScope, PortfolioKanbanView } from '../Portfolio/PortfolioKanbanView';
import { PortfolioListView } from '../Portfolio/PortfolioListView';
import { PortfolioMatrixView } from '../Portfolio/PortfolioMatrixView';
// ModuleHub components
import {
  FilterChip,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  StatusDropdown,
  ViewMode,
} from '../shared/ModuleHub';
// Compact side panel (replaces old 50% drawer)
import { InitiativeCompactPanel } from './InitiativeCompactPanel';
import { InitiativeDocumentView } from './InitiativeDocumentView';
import { InitiativesTimelineView } from './InitiativesTimelineView';

const MODULE_STATUSES = getStatusesForModule('initiatives');
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
    color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
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
  const { t } = useTranslation();
  const { currentProjectId, currentUser } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [handledDeepLinkOpen, setHandledDeepLinkOpen] = useState(false);
  const [handledDeepLinkNew, setHandledDeepLinkNew] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  /** Active/All scope toggle — used for Kanban columns and data filtering */
  const [scope, setScope] = useState<KanbanScope>('active');

  // Data state
  const [initiatives, setInitiatives] = useState<PortfolioInitiative[]>([]);
  const [allInitiatives, setAllInitiatives] = useState<PortfolioInitiative[]>([]); // For duplicate detection
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
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

  // Side panel state
  const [selectedInitiative, setSelectedInitiative] = useState<PortfolioInitiative | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  // Filter state for API
  const [filters, setFilters] = useState<PortfolioFilters>({});

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

        // Try portfolio endpoint first, fallback to regular initiatives
        let response: { initiatives?: PortfolioInitiative[] } = { initiatives: [] };
        try {
          response = await Api.get(`/initiatives/portfolio?${params.toString()}`);
        } catch {
          // Fallback to regular initiatives endpoint
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

        // Also fetch all initiatives (including archived/cancelled) for duplicate detection
        // Try to fetch all initiatives without status filter
        try {
          const allParams = new URLSearchParams();
          if (currentProjectId) allParams.append('projectId', currentProjectId);
          if (searchQuery) allParams.append('search', searchQuery);
          // Try portfolio endpoint without status filter to get all initiatives
          const allResponse = await Api.get(`/initiatives/portfolio?${allParams.toString()}`);
          setAllInitiatives(allResponse.initiatives || response.initiatives || []);
        } catch {
          // Fallback: use current initiatives
          setAllInitiatives(response.initiatives || []);
        }
      } catch (error: any) {
        console.error('[InitiativesHub] Fetch error:', error);
        setLoadError(
          error?.response?.data?.error || error?.message || 'Failed to load initiatives'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentProjectId, activeStatusFilter, filters.priority, searchQuery, scope]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await Api.getUsers();
        setUsers(Array.isArray(data) ? data : []);
      } catch (error: any) {
        console.error('[InitiativesHub] Failed to load users:', error);
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

  // Available view modes
  const availableViewModes: ViewMode[] = ['table', 'grid', 'kanban', 'timeline'];

  // Empty tabs - using status filters instead
  const tabs: any[] = [];

  // Bulk edit lives inside Filters dropdown (per contract: no extra top-level icons/buttons)
  const filterActions = useMemo(() => {
    return [
      {
        id: 'bulk-edit',
        label: t('initiatives.bulkEdit.title'),
        badge: selectedIds.size,
        disabled: selectedIds.size === 0,
        onClick: () => {
          if (selectedIds.size === 0) {
            toast.error(t('initiatives.bulkEdit.title'));
            return;
          }
          setShowBulkModal(true);
        },
      },
    ];
  }, [selectedIds.size]);

  // ============================================
  // HANDLERS
  // ============================================

  // Open side panel when clicking on initiative (quick preview)
  const handleInitiativeClick = useCallback((initiative: PortfolioInitiative) => {
    setSelectedInitiative(initiative);
    setIsSidePanelOpen(true);
  }, []);

  // Open initiative as dynamic document (DynamicTabs)
  const handleOpenFullScreen = useCallback(
    (initiative: PortfolioInitiative) => {
      // Close side panel first
      setIsSidePanelOpen(false);

      // Add to open documents for tab display (if not already open)
      const existingDoc = openDocuments.find((d) => d.id === initiative.id);
      if (!existingDoc) {
        const newDoc: OpenDocument = {
          id: initiative.id,
          name: initiative.name,
          type: 'initiative',
          subType: initiative.axis || 'operational',
          status: initiative.status as any,
        };
        setOpenDocuments((prev) => [...prev, newDoc]);
      }
      // Set as active document - this renders InitiativeDocumentView in ModuleHub
      setActiveDocumentId(initiative.id);
    },
    [openDocuments]
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

  // Deep link: open initiative drawer/full card via URL params
  // Supported: /initiatives?open=<initiativeId>&mode=drawer|doc
  useEffect(() => {
    if (handledDeepLinkOpen) return;
    const openId = searchParams.get('open');
    if (!openId) {
      setHandledDeepLinkOpen(true);
      return;
    }

    const mode = (searchParams.get('mode') || 'doc').toLowerCase();

    const run = async () => {
      try {
        // Prefer list row if already loaded; fallback to GET by id
        const fromList = initiatives.find((i) => i.id === openId);
        const response = fromList ? null : await Api.get(`/initiatives/${openId}`);
        const initiative = (fromList || response?.initiative || response) as any;

        if (!initiative?.id) {
          toast.error(t('initiatives.toast.notFound', 'Nie znaleziono inicjatywy'));
          return;
        }

        if (mode === 'drawer') {
          handleInitiativeClick(initiative as any);
        } else {
          handleOpenFullScreen(initiative as any);
        }
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            e?.message ||
            t('initiatives.toast.openFailed', 'Nie udało się otworzyć inicjatywy')
        );
      } finally {
        // Clear only deep-link params (preserve others if any)
        const next = new URLSearchParams(searchParams);
        next.delete('open');
        next.delete('mode');
        setSearchParams(next, { replace: true });
        setHandledDeepLinkOpen(true);
      }
    };

    run();
  }, [
    handledDeepLinkOpen,
    searchParams,
    setSearchParams,
    initiatives,
    handleInitiativeClick,
    handleOpenFullScreen,
  ]);

  // Deep link: open "New Initiative" modal
  // Supported: /initiatives?new=1
  useEffect(() => {
    if (handledDeepLinkNew) return;
    const isNew = searchParams.get('new') === '1';
    if (isNew) {
      setShowNewModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
    setHandledDeepLinkNew(true);
  }, [handledDeepLinkNew, searchParams, setSearchParams]);

  const handleCloseSidePanel = useCallback(() => {
    setIsSidePanelOpen(false);
    setTimeout(() => setSelectedInitiative(null), 300);
  }, []);

  // D3.1: Status change with approval validation
  const handleStatusChange = useCallback(
    async (initiativeId: string, newStatus: InitiativeStatus) => {
      // Preflight via backend gate-readiness-check (source of truth).
      // This avoids local heuristics drifting from canonical gate DoD rules.
      try {
        const rc = await Api.get(`/initiatives/${initiativeId}/gate-readiness-check`);
        const transitions = Array.isArray(rc?.availableTransitions) ? rc.availableTransitions : [];
        const tr = transitions.find(
          (x: any) =>
            String(x?.targetStatus || '').toUpperCase() === String(newStatus).toUpperCase()
        );
        if (!tr || !tr.canCurrentUserExecute) {
          toast.error(
            t(
              'initiatives.toast.statusNotAllowed',
              'Nie masz uprawnień lub bramka nie jest dostępna na tym etapie.'
            ),
            { duration: 5000 }
          );
          return;
        }
        const readiness = Array.isArray(rc?.readiness) ? rc.readiness : [];
        const blockingMissing = readiness.filter(
          (r: any) => r?.severity === 'blocking' && !r?.pass
        );
        if (blockingMissing.length > 0) {
          const list = blockingMissing
            .slice(0, 5)
            .map((r: any) => String(r?.label || r?.key || '').trim())
            .filter(Boolean)
            .join('\n• ');
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
      } catch {
        // Best-effort: backend will enforce anyway on PATCH /status.
      }

      try {
        await Api.patch(`/initiatives/${initiativeId}/status`, { status: newStatus });
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, status: newStatus } : i))
        );
        toast.success(t('initiatives.toast.statusUpdated', 'Status zaktualizowany'));
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
            t('initiatives.toast.statusUpdateFailed', 'Nie udało się zaktualizować statusu')
        );
      }
    },
    [initiatives]
  );

  const handleQuickUpdate = useCallback(
    async (initiativeId: string, updates: Partial<PortfolioInitiative>) => {
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
              'Obniżenie poziomu jest zablokowane. Można jedynie podwyższyć poziom inicjatywy.'
            )
          );
          return;
        }
      }
      try {
        await Api.patch(`/initiatives/${initiativeId}/quick-update`, updates);
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, ...updates } : i))
        );
      } catch (error: any) {
        toast.error(t('initiatives.toast.updateFailed', 'Nie udało się zaktualizować'));
      }
    },
    [initiatives]
  );

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleShowList = useCallback(() => {
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
  }, [bulkOwnerBusinessId, bulkOwnerExecutionId, bulkPriority, bulkStatus, fetchData, selectedIds]);

  // ============================================
  // CONTENT RENDERING - Original Portfolio Components
  // ============================================

  const renderContent = () => {
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

      // Default: initiative document view
      return (
        <InitiativeDocumentView
          initiativeId={activeDocumentId}
          onBack={handleShowList}
          onStatusChange={() => fetchData(true)}
          sourceModule="initiatives"
          onOpenDecision={handleOpenDecision}
          onOpenTask={handleOpenTask}
        />
      );
    }

    if (loadError) {
      return (
        <div className="flex items-center justify-center h-full px-6">
          <div className="max-w-xl w-full p-5 rounded-2xl border border-red-500/20 bg-red-900/10">
            <div className="text-sm font-semibold text-red-300">
              {t('initiatives.hub.failedToLoad')}
            </div>
            <div className="text-sm text-red-200/80 mt-1">{loadError}</div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => fetchData(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors"
              >
                {t('initiatives.hub.retry')}
              </button>
              <button
                onClick={() => setLoadError(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
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
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      );
    }

    if (initiatives.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 text-purple-400/50" />
            <p className="text-lg text-slate-900 dark:text-white">{t('initiatives.empty.title')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {t('initiatives.empty.description')}
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-6 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-slate-900 dark:text-white rounded-lg text-sm font-medium hover:from-primary-400 hover:to-primary-500 transition-all"
            >
              <Plus size={14} className="inline mr-2" />
              {t('initiatives.form.newInitiative')}
            </button>
          </div>
        </div>
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

    switch (viewMode) {
      case 'table':
        return (
          <PortfolioListView
            initiatives={searchedInitiatives}
            onInitiativeClick={handleInitiativeClick}
            onStatusChange={handleStatusChange}
            onQuickUpdate={handleQuickUpdate}
            onSelectionChange={setSelectedIds}
          />
        );
      case 'grid':
        return (
          <div className="h-full overflow-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {searchedInitiatives.map((initiative) => (
                <InitiativeGridCard
                  key={initiative.id}
                  initiative={initiative}
                  onClick={() => handleInitiativeClick(initiative)}
                />
              ))}
            </div>
            {searchedInitiatives.length === 0 && (
              <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
                No initiatives found
              </div>
            )}
          </div>
        );
      case 'kanban':
        return (
          <PortfolioKanbanView
            initiatives={searchedInitiatives}
            onInitiativeClick={handleInitiativeClick}
            onStatusChange={handleStatusChange}
            scope={scope}
          />
        );
      case 'timeline':
        return (
          <InitiativesTimelineView
            initiatives={searchedInitiatives}
            onInitiativeClick={handleInitiativeClick}
            projectId={currentProjectId || undefined}
          />
        );
      case 'matrix':
        return (
          <PortfolioMatrixView
            initiatives={searchedInitiatives}
            onInitiativeClick={handleInitiativeClick}
          />
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
    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60">
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
          className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
            scope === opt.id
              ? 'bg-white/80 dark:bg-navy-900/70 text-slate-700 dark:text-slate-200 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-navy-900/50'
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
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const statusDropdownControl = (
    <StatusDropdown
      context="initiatives"
      value={activeStatusFilter || 'all'}
      onChange={(status) => {
        setActiveStatusFilter(status === 'all' ? null : status);
      }}
      counts={statusCounts}
      size="sm"
    />
  );

  const rightControls = (
    <div className="flex items-center gap-2">
      {scopeToggle}
      {statusDropdownControl}
    </div>
  );

  return (
    <div className="h-full" data-testid="initiatives-hub">
      <ModuleHub
        persistViewModeKey="initiatives"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={() => setShowNewModal(true)}
        newItemLabel={`+ ${t('initiatives.form.newInitiative')}`}
        filterActions={filterActions}
        rightControls={rightControls}
        availableViewModes={availableViewModes}
      >
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </ModuleHub>

      {/* Initiative Compact Side Panel */}
      <InitiativeCompactPanel
        initiative={selectedInitiative}
        isOpen={isSidePanelOpen}
        onClose={handleCloseSidePanel}
        onUpdate={(updated) => {
          setInitiatives((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          if (selectedInitiative?.id === updated.id) {
            setSelectedInitiative(updated);
          }
        }}
        onOpenFull={handleOpenFullScreen}
        users={users}
      />

      {/* New Initiative Modal — D1.1: includes type/level selector */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {t('initiatives.form.createNew')}
            </h2>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.form.titleRequired')}
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  placeholder={t('initiatives.form.titlePlaceholder')}
                  autoFocus
                />
              </div>

              {/* D1.1: Initiative Type/Level selector */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Initiative Type / Level *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {INITIATIVE_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setNewLevel(level.id)}
                      className={`
                        relative p-3 rounded-lg border text-left transition-all
                        ${
                          newLevel === level.id
                            ? `${level.color} border-current ring-1 ring-current/30`
                            : 'bg-slate-50 dark:bg-navy-950 border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:border-slate-500'
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
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.form.axis')}
                </label>
                <select
                  value={newAxis}
                  onChange={(e) => setNewAxis(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="operational">{t('initiatives.axis.operational')}</option>
                  <option value="strategic">{t('initiatives.axis.strategic')}</option>
                  <option value="transformational">{t('initiatives.axis.transformational')}</option>
                  <option value="compliance">{t('initiatives.axis.compliance')}</option>
                </select>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.form.summary')}
                </label>
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white resize-none"
                  rows={3}
                  placeholder={t('initiatives.form.summaryPlaceholder')}
                />
              </div>

              {/* D1.1: Level info callout */}
              {newLevel && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600">
                  <Shield
                    size={14}
                    className="text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
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
                    <span className="text-slate-500 italic">
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
                  const created = await Api.post('/initiatives', {
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
                  // Refresh list and open quick preview for immediate follow-up
                  fetchData(true);
                  const createdId = created?.id || created?.initiative?.id;
                  if (createdId) {
                    // Best-effort: fetch full row for drawer
                    try {
                      const full = await Api.get(`/initiatives/${createdId}`);
                      handleInitiativeClick(full as any);
                    } catch {
                      // ignore
                    }
                  }
                } catch (e: any) {
                  toast.error(
                    e?.response?.data?.error || e?.message || t('initiatives.form.createFailed')
                  );
                } finally {
                  setIsCreating(false);
                }
              }}
              className="w-full mt-6 py-2 text-sm text-slate-900 dark:text-white bg-primary-600 hover:bg-primary-500 transition-colors rounded-lg disabled:opacity-50"
            >
              {isCreating ? t('initiatives.form.creating') : t('initiatives.form.create')}
            </button>
            <button
              disabled={isCreating}
              onClick={() => setShowNewModal(false)}
              className="w-full mt-2 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-300 dark:border-navy-600 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-50"
            >
              {t('initiatives.form.cancel')}
            </button>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {t('initiatives.bulkEdit.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t('initiatives.bulkEdit.selectedCount', { count: selectedIds.size })}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.bulkEdit.status')}
                </label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as InitiativeStatus)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
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
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.bulkEdit.priority')}
                </label>
                <select
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="">{t('initiatives.bulkEdit.noChange')}</option>
                  <option value="CRITICAL">{t('initiatives.priority.critical')}</option>
                  <option value="HIGH">{t('initiatives.priority.high')}</option>
                  <option value="MEDIUM">{t('initiatives.priority.medium')}</option>
                  <option value="LOW">{t('initiatives.priority.low')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.bulkEdit.businessOwner')}
                </label>
                <select
                  value={bulkOwnerBusinessId}
                  onChange={(e) => setBulkOwnerBusinessId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
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
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('initiatives.bulkEdit.executionOwner')}
                </label>
                <select
                  value={bulkOwnerExecutionId}
                  onChange={(e) => setBulkOwnerExecutionId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-white"
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
                className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {t('initiatives.form.cancel')}
              </button>
              <button
                onClick={handleBulkApply}
                className="px-4 py-2 text-sm text-slate-900 dark:text-white bg-primary-600 hover:bg-primary-500 rounded-lg"
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
