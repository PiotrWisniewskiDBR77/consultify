/**
 * ExecutionHub
 * Unified Execution module with 3 tabs (Kanban, Timeline, Workload)
 * Uses shared ModuleHub components for consistent UX
 */

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Calendar, FileText, KanbanSquare, Loader2, Target, Timer, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { useAppStore } from '../../store/useAppStore';
import { FullInitiative, InitiativeStatus } from '../../types';
import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';

// Status metadata for execution
const STATUS_META: Record<string, { color: string; label: string; dotColor: string }> = {
  [InitiativeStatus.DRAFT]: { color: 'slate', label: 'To Do', dotColor: 'bg-slate-400' },
  [InitiativeStatus.PLANNING]: { color: 'blue', label: 'Planning', dotColor: 'bg-blue-400' },
  [InitiativeStatus.APPROVED]: { color: 'emerald', label: 'Ready', dotColor: 'bg-emerald-400' },
  [InitiativeStatus.EXECUTING]: { color: 'cyan', label: 'In Progress', dotColor: 'bg-cyan-400' },
  [InitiativeStatus.BLOCKED]: { color: 'red', label: 'Blocked', dotColor: 'bg-red-400' },
  [InitiativeStatus.DONE]: { color: 'green', label: 'Done', dotColor: 'bg-green-400' },
  [InitiativeStatus.CANCELLED]: { color: 'gray', label: 'Cancelled', dotColor: 'bg-gray-400' },
};

// Type codes
const getTypeCode = (axis: string): string => {
  const codes: Record<string, string> = {
    PROCESSES: 'PRC',
    DIGITAL: 'DIG',
    MODELS: 'MDL',
    DATA: 'DAT',
    CULTURE: 'CUL',
    CYBERSECURITY: 'SEC',
    AI: 'AI',
  };
  return codes[axis] || 'EXE';
};

interface ExecutionHubProps {
  initialTab?: ModuleTab;
}

export const ExecutionHub: React.FC<ExecutionHubProps> = ({ initialTab = 'list' }) => {
  const { t } = useTranslation();
  const { currentProjectId, fullSessionData } = useAppStore();

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Data state
  const [initiatives, setInitiatives] = useState<FullInitiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initiatives in execution phase
  useEffect(() => {
    const loadInitiatives = async () => {
      setIsLoading(true);
      try {
        // Get initiatives that are in execution phase
        const response = await Api.getInitiatives(currentProjectId || undefined);
        const data = Array.isArray(response) ? response : (response as any)?.initiatives || [];

        // Filter to execution-relevant statuses
        const executionStatuses = [
          InitiativeStatus.APPROVED,
          InitiativeStatus.EXECUTING,
          InitiativeStatus.BLOCKED,
          InitiativeStatus.DONE,
        ];
        const executionInitiatives = data.filter((i: FullInitiative) =>
          executionStatuses.includes(i.status)
        );

        setInitiatives(executionInitiatives);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load:', err);
        // Fallback to session data
        setInitiatives(fullSessionData?.initiatives || []);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitiatives();
  }, [currentProjectId, fullSessionData?.initiatives]);

  // Calculate stats
  const stats = useMemo(
    () => ({
      toDo: initiatives.filter((i) =>
        [InitiativeStatus.DRAFT, InitiativeStatus.PLANNING, InitiativeStatus.APPROVED].includes(
          i.status
        )
      ).length,
      inProgress: initiatives.filter((i) => i.status === InitiativeStatus.EXECUTING).length,
      blocked: initiatives.filter((i) => i.status === InitiativeStatus.BLOCKED).length,
      done: initiatives.filter((i) => i.status === InitiativeStatus.DONE).length,
    }),
    [initiatives]
  );

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    let result = initiatives;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          (i.description || '').toLowerCase().includes(query)
      );
    }

    activeFilters.forEach((filter) => {
      if (filter.column === 'status') {
        result = result.filter((i) => i.status === filter.value);
      }
    });

    return result;
  }, [initiatives, searchQuery, activeFilters]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('execution.tabs.kanban', 'Kanban'),
        icon: <KanbanSquare size={16} />,
        count: filteredInitiatives.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('execution.tabs.timeline', 'Timeline'),
        icon: <Timer size={16} />,
        count: undefined,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('execution.tabs.workload', 'Workload'),
        icon: <Users size={16} />,
        count: undefined,
      },
    ],
    [t, filteredInitiatives.length]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: 'Type',
        width: '80px',
        render: (row) => {
          const code = getTypeCode(row.axis);
          return (
            <div className="flex items-center gap-2">
              <Target size={14} className="text-cyan-400" />
              <span className="font-mono text-xs font-bold text-slate-300">{code}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => <span className="text-sm text-white font-medium">{row.name}</span>,
      },
      {
        id: 'status',
        label: 'Status',
        width: '130px',
        filterable: true,
        filterOptions: Object.entries(STATUS_META).map(([value, meta]) => ({
          value,
          label: meta.label,
          color: meta.dotColor,
        })),
      },
      {
        id: 'assignee',
        label: 'Assignee',
        width: '150px',
        render: (row) => {
          const owner = row.ownerBusiness || row.ownerTechnical;
          if (!owner) return <span className="text-slate-500 text-sm">Unassigned</span>;
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-navy-700 flex items-center justify-center text-xs text-white">
                {owner.firstName?.[0]}
                {owner.lastName?.[0]}
              </div>
              <span className="text-sm text-slate-300">
                {owner.firstName} {owner.lastName}
              </span>
            </div>
          );
        },
      },
      {
        id: 'progress',
        label: 'Progress',
        width: '120px',
        render: (row) => {
          const progress = row.progress || 0;
          const color = row.status === InitiativeStatus.BLOCKED ? 'bg-red-500' : 'bg-cyan-500';
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 w-8">{progress}%</span>
            </div>
          );
        },
      },
      {
        id: 'deadline',
        label: 'Deadline',
        width: '100px',
        render: (row) => {
          if (!row.plannedEndDate && !row.slaDeadline) {
            return <span className="text-slate-500 text-sm">-</span>;
          }
          const deadline = row.slaDeadline || row.plannedEndDate;
          const isOverdue = new Date(deadline) < new Date();
          return (
            <span className={`text-sm ${isOverdue ? 'text-red-400' : 'text-slate-300'}`}>
              {new Date(deadline).toLocaleDateString()}
            </span>
          );
        },
      },
    ],
    []
  );

  // Handlers
  const handleOpenDocument = useCallback((row: FullInitiative) => {
    const code = getTypeCode(row.axis);
    const statusMeta = STATUS_META[row.status] || STATUS_META[InitiativeStatus.EXECUTING];

    const doc: OpenDocument = {
      id: row.id,
      type: 'initiative',
      subType: code,
      name: row.name,
      status:
        row.status === InitiativeStatus.BLOCKED
          ? 'in_review'
          : row.status === InitiativeStatus.DONE
            ? 'completed'
            : 'draft',
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(row.id);
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

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: FullInitiative) => {
      if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument]
  );

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return filteredInitiatives.map((item) => ({
      id: item.id,
      name: item.name,
      type: getTypeCode(item.axis),
      typeColor: 'cyan',
      status:
        item.status === InitiativeStatus.BLOCKED
          ? ('in_review' as const)
          : item.status === InitiativeStatus.DONE
            ? ('completed' as const)
            : item.status === InitiativeStatus.APPROVED
              ? ('approved' as const)
              : ('draft' as const),
      progress: item.progress || 0,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    }));
  }, [filteredInitiatives]);

  // Column to status mapping for drag & drop
  const columnToStatus: Record<string, InitiativeStatus> = {
    todo: InitiativeStatus.APPROVED,
    inProgress: InitiativeStatus.EXECUTING,
    blocked: InitiativeStatus.BLOCKED,
    done: InitiativeStatus.DONE,
  };

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const initiativeId = active.id as string;
    const targetColumn = over.id as string;

    const newStatus = columnToStatus[targetColumn];
    if (!newStatus) return;

    // Find the initiative
    const initiative = initiatives.find((i) => i.id === initiativeId);
    if (!initiative) return;

    // Check if status actually changed
    const currentColumnId = Object.entries(columnToStatus).find(
      ([_, status]) => status === initiative.status
    )?.[0];
    if (currentColumnId === targetColumn) return;

    // Optimistic update
    setInitiatives((prev) =>
      prev.map((i) => (i.id === initiativeId ? { ...i, status: newStatus } : i))
    );

    try {
      await Api.patch(`/initiatives/${initiativeId}`, { status: newStatus });
      toast.success(`Moved to ${newStatus.toLowerCase()}`);
    } catch (error) {
      console.error('[ExecutionHub] Failed to update status:', error);
      toast.error('Failed to update status');
      // Revert optimistic update
      setInitiatives((prev) =>
        prev.map((i) => (i.id === initiativeId ? { ...i, status: initiative.status } : i))
      );
    }
  };

  // Droppable Column Component
  const DroppableColumn: React.FC<{
    id: string;
    label: string;
    items: FullInitiative[];
    children: React.ReactNode;
  }> = ({ id, label, items, children }) => {
    const { isOver, setNodeRef } = useDroppable({ id });

    return (
      <div className="flex-shrink-0 w-72 flex flex-col">
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-sm font-semibold text-white">{label}</h3>
          <span className="text-xs text-slate-400 bg-navy-800 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <div
          ref={setNodeRef}
          className={`flex-1 space-y-2 overflow-y-auto p-1 rounded-lg transition-colors min-h-[200px] ${
            isOver ? 'bg-cyan-500/10' : ''
          }`}
        >
          {children}
          {items.length === 0 && !isOver && (
            <div className="text-center py-8 text-slate-500 text-sm">No items</div>
          )}
        </div>
      </div>
    );
  };

  // Draggable Card Component
  const DraggableCard: React.FC<{ item: FullInitiative }> = ({ item }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: item.id,
    });

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => !isDragging && handleOpenDocument(item)}
        className={`p-3 bg-navy-800 border border-navy-700 rounded-lg cursor-pointer transition-all ${
          isDragging ? 'shadow-xl border-cyan-500 opacity-50' : 'hover:border-cyan-500/50'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-xs text-cyan-400">{getTypeCode(item.axis)}</span>
          <span
            className={`w-2 h-2 rounded-full ${STATUS_META[item.status]?.dotColor || 'bg-slate-400'}`}
          />
        </div>
        <h4 className="text-sm font-medium text-white mb-2 line-clamp-2">{item.name}</h4>
        <div className="flex items-center justify-between">
          <div className="flex-1 h-1 bg-navy-700 rounded-full overflow-hidden mr-2">
            <div
              className={`h-full ${item.status === InitiativeStatus.BLOCKED ? 'bg-red-500' : 'bg-cyan-500'} rounded-full`}
              style={{ width: `${item.progress || 0}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{item.progress || 0}%</span>
        </div>
      </div>
    );
  };

  // Render Kanban Board with @dnd-kit
  const renderKanbanBoard = () => {
    const columns = [
      {
        id: 'todo',
        label: 'To Do',
        statuses: [InitiativeStatus.DRAFT, InitiativeStatus.PLANNING, InitiativeStatus.APPROVED],
      },
      { id: 'inProgress', label: 'In Progress', statuses: [InitiativeStatus.EXECUTING] },
      { id: 'blocked', label: 'Blocked', statuses: [InitiativeStatus.BLOCKED] },
      { id: 'done', label: 'Done', statuses: [InitiativeStatus.DONE] },
    ];

    const activeItem = activeId ? initiatives.find((i) => i.id === activeId) : null;

    return (
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 p-4 h-full overflow-x-auto">
          {columns.map((column) => {
            const items = filteredInitiatives.filter((i) => column.statuses.includes(i.status));
            return (
              <DroppableColumn key={column.id} id={column.id} label={column.label} items={items}>
                {items.map((item) => (
                  <DraggableCard key={item.id} item={item} />
                ))}
              </DroppableColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeItem ? (
            <div className="p-3 bg-navy-800 border border-cyan-500 rounded-lg shadow-xl rotate-2 w-72">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs text-cyan-400">
                  {getTypeCode(activeItem.axis)}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_META[activeItem.status]?.dotColor || 'bg-slate-400'}`}
                />
              </div>
              <h4 className="text-sm font-medium text-white mb-2 line-clamp-2">
                {activeItem.name}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex-1 h-1 bg-navy-700 rounded-full overflow-hidden mr-2">
                  <div
                    className={`h-full ${activeItem.status === InitiativeStatus.BLOCKED ? 'bg-red-500' : 'bg-cyan-500'} rounded-full`}
                    style={{ width: `${activeItem.progress || 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{activeItem.progress || 0}%</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  };

  // Handle status change from detail panel
  const handleStatusChange = useCallback(
    (newStatus: InitiativeStatus) => {
      setInitiatives((prev) =>
        prev.map((i) => (i.id === activeDocumentId ? { ...i, status: newStatus } : i))
      );
    },
    [activeDocumentId]
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      const response = await Api.getInitiatives(currentProjectId || undefined);
      const data = Array.isArray(response) ? response : (response as any)?.initiatives || [];
      const executionStatuses = [
        InitiativeStatus.APPROVED,
        InitiativeStatus.EXECUTING,
        InitiativeStatus.BLOCKED,
        InitiativeStatus.DONE,
      ];
      const executionInitiatives = data.filter((i: FullInitiative) =>
        executionStatuses.includes(i.status)
      );
      setInitiatives(executionInitiatives);
    } catch (err) {
      console.error('[ExecutionHub] Failed to refresh:', err);
    }
  }, [currentProjectId]);

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    if (activeDocumentId) {
      const initiative = initiatives.find((i) => i.id === activeDocumentId);
      if (initiative) {
        return (
          <div className="p-6 bg-navy-800 rounded-xl border border-navy-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">{initiative.name}</h2>
              <button onClick={handleShowList} className="text-slate-400 hover:text-white">
                ← Back to list
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-navy-700/50 rounded-lg">
                <p className="text-sm text-slate-400">Status</p>
                <p className="text-lg font-medium text-white">{initiative.status}</p>
              </div>
              <div className="p-4 bg-navy-700/50 rounded-lg">
                <p className="text-sm text-slate-400">Progress</p>
                <p className="text-lg font-medium text-white">{initiative.progress || 0}%</p>
              </div>
            </div>
          </div>
        );
      }
    }

    // Tab: Kanban (default)
    if (activeTab === 'list') {
      if (viewMode === 'grid') {
        return renderKanbanBoard();
      }
      return (
        <FilterableTable
          columns={columns}
          data={filteredInitiatives as any[]}
          onRowClick={(row) => handleOpenDocument(row as unknown as FullInitiative)}
          onRowAction={(action, row) => handleRowAction(action, row as unknown as FullInitiative)}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage="No initiatives in execution. Approve initiatives first."
        />
      );
    }

    // Tab: Timeline
    if (activeTab === 'reports') {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-cyan-400/50" />
            <p className="text-lg text-white">Timeline View</p>
            <p className="text-sm text-slate-400">Gantt chart visualization coming soon</p>
          </div>
        </div>
      );
    }

    // Tab: Workload
    if (activeTab === 'initiatives') {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-cyan-400/50" />
            <p className="text-lg text-white">Workload View</p>
            <p className="text-sm text-slate-400">Resource allocation coming soon</p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <ModuleHub
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
    >
      {renderContent()}
    </ModuleHub>
  );
};

export default ExecutionHub;
