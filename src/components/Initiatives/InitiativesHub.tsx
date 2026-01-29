/**
 * InitiativesHub
 * Unified Initiatives module with ModuleHub UI pattern
 * Integrates original Portfolio components (Kanban, List, Timeline, Matrix)
 * Connected to real API endpoints
 */

import { Edit2, Lightbulb, Plus, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';

import { useAppStore } from '../../store/useAppStore';
import { InitiativeStatus, PortfolioFilters, PortfolioInitiative } from '../../types';
// Initiative Card component
import { InitiativeCard } from '../InitiativeCard';
// Portfolio view components
import { PortfolioKanbanView } from '../Portfolio/PortfolioKanbanView';
import { PortfolioListView } from '../Portfolio/PortfolioListView';
import { PortfolioMatrixView } from '../Portfolio/PortfolioMatrixView';
// ModuleHub components
import {
  FilterChip,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  StatusFilter,
  ViewMode,
} from '../shared/ModuleHub';
import { InitiativeDocumentView } from './InitiativeDocumentView';
// New Initiative Drawer (50% width with Open wider)
import { InitiativeDrawer } from './InitiativeDrawer';
import { InitiativesTimelineView } from './InitiativesTimelineView';

const MODULE_STATUSES = getStatusesForModule('initiatives');
const ALLOWED_STATUSES: InitiativeStatus[] =
  MODULE_STATUSES.length > 0
    ? MODULE_STATUSES
    : [
        InitiativeStatus.DRAFT,
        InitiativeStatus.PLANNING,
        InitiativeStatus.REVIEW,
        InitiativeStatus.APPROVED,
        InitiativeStatus.EXECUTING,
        InitiativeStatus.BLOCKED,
      ];

interface InitiativesHubProps {
  initialTab?: ModuleTab;
}

export const InitiativesHub: React.FC<InitiativesHubProps> = ({ initialTab = 'list' }) => {
  const { t } = useTranslation();
  const { currentProjectId, currentUser } = useAppStore();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  // Data state
  const [initiatives, setInitiatives] = useState<PortfolioInitiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<any[]>([]);
  const [bulkStatus, setBulkStatus] = useState<InitiativeStatus | ''>('');
  const [bulkPriority, setBulkPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | ''>('');
  const [bulkOwnerBusinessId, setBulkOwnerBusinessId] = useState<string>('');
  const [bulkOwnerExecutionId, setBulkOwnerExecutionId] = useState<string>('');

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
        const params = new URLSearchParams();
        if (currentProjectId) params.append('projectId', currentProjectId);
        if (
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
      } catch (error: any) {
        console.error('[InitiativesHub] Fetch error:', error);
        toast.error('Failed to load initiatives');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentProjectId, activeStatusFilter, filters.priority, searchQuery]
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

  useEffect(() => {
    if (activeStatusFilter && !ALLOWED_STATUSES.includes(activeStatusFilter as InitiativeStatus)) {
      setActiveStatusFilter(null);
    }
  }, [activeStatusFilter]);

  // ============================================
  // STATUS FILTERS
  // ============================================

  const statusFilters: StatusFilter[] = useMemo(() => {
    const counts: Record<string, number> = {};
    initiatives.forEach((i) => {
      counts[i.status] = (counts[i.status] || 0) + 1;
    });

    return [
      { id: 'all', label: 'All', color: 'bg-slate-400', count: initiatives.length },
      ...ALLOWED_STATUSES.map((status) => ({
        id: status,
        label: STATUS_METADATA[status].label,
        color: STATUS_METADATA[status].dotColor,
        count: counts[status] || 0,
      })),
    ];
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
        label: 'Bulk edit',
        badge: selectedIds.size,
        disabled: selectedIds.size === 0,
        onClick: () => {
          if (selectedIds.size === 0) {
            toast.error('Select initiatives to edit');
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
      // Set as active document - this will trigger rendering InitiativeDetailCard
      setActiveDocumentId(initiative.id);
    },
    [openDocuments]
  );

  const handleCloseSidePanel = useCallback(() => {
    setIsSidePanelOpen(false);
    setTimeout(() => setSelectedInitiative(null), 300);
  }, []);

  const handleStatusChange = useCallback(
    async (initiativeId: string, newStatus: InitiativeStatus) => {
      try {
        await Api.patch(`/initiatives/${initiativeId}/status`, { status: newStatus });
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, status: newStatus } : i))
        );
        toast.success('Status updated');
      } catch (error: any) {
        toast.error(error?.response?.data?.error || 'Failed to update status');
      }
    },
    []
  );

  const handleQuickUpdate = useCallback(
    async (initiativeId: string, updates: Partial<PortfolioInitiative>) => {
      try {
        await Api.patch(`/initiatives/${initiativeId}/quick-update`, updates);
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, ...updates } : i))
        );
      } catch (error: any) {
        toast.error('Failed to update');
      }
    },
    []
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
      toast.error(`${failed} updates failed`);
    } else {
      toast.success('Bulk update applied');
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
    // If there's an active document, show the dynamic card
    if (activeDocumentId) {
      return <InitiativeDocumentView initiativeId={activeDocumentId} />;
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
            <p className="text-lg text-white">No Initiatives Yet</p>
            <p className="text-sm text-slate-400 mt-2">
              Create your first initiative to get started
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-6 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg text-sm font-medium hover:from-primary-400 hover:to-primary-500 transition-all"
            >
              <Plus size={14} className="inline mr-2" />
              New Initiative
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
                <InitiativeCard
                  key={initiative.id}
                  initiative={
                    {
                      ...initiative,
                      title: initiative.name,
                      name: initiative.name,
                      status: initiative.status as any,
                      priority: initiative.priority as any,
                    } as any
                  }
                  onClick={() => handleInitiativeClick(initiative)}
                />
              ))}
            </div>
            {searchedInitiatives.length === 0 && (
              <div className="flex items-center justify-center h-64 text-slate-400">
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
        newItemLabel="+ New Initiative"
        filterActions={filterActions}
        statusFilters={statusFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
        availableViewModes={availableViewModes}
      >
        <div className="flex-1 overflow-hidden">{renderContent()}</div>
      </ModuleHub>

      {/* Initiative Drawer (50% width) with Open Wider functionality */}
      <InitiativeDrawer
        initiative={selectedInitiative}
        isOpen={isSidePanelOpen}
        onClose={handleCloseSidePanel}
        onUpdate={(updated) => {
          setInitiatives((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
          if (selectedInitiative?.id === updated.id) {
            setSelectedInitiative(updated);
          }
        }}
        onOpenWider={handleOpenFullScreen}
        users={users}
      />

      {/* New Initiative Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Initiative</h2>
            <p className="text-slate-400 text-sm mb-6">
              This feature is coming soon. Use the AI Chat to generate initiatives from assessments.
            </p>
            <button
              onClick={() => setShowNewModal(false)}
              className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors border border-navy-600 rounded-lg hover:bg-navy-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Bulk edit initiatives</h2>
            <p className="text-sm text-slate-400 mb-4">{selectedIds.size} initiatives selected</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Status</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as InitiativeStatus)}
                  className="w-full px-3 py-2 bg-navy-950 border border-navy-700 rounded-lg text-sm text-white"
                >
                  <option value="">No change</option>
                  <option value="PLANNING">Planning</option>
                  <option value="REVIEW">Review</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <select
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-navy-950 border border-navy-700 rounded-lg text-sm text-white"
                >
                  <option value="">No change</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Business Owner</label>
                <select
                  value={bulkOwnerBusinessId}
                  onChange={(e) => setBulkOwnerBusinessId(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-navy-700 rounded-lg text-sm text-white"
                >
                  <option value="">No change</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Execution Owner</label>
                <select
                  value={bulkOwnerExecutionId}
                  onChange={(e) => setBulkOwnerExecutionId(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-950 border border-navy-700 rounded-lg text-sm text-white"
                >
                  <option value="">No change</option>
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
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkApply}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-500 rounded-lg"
              >
                Apply changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiativesHub;
