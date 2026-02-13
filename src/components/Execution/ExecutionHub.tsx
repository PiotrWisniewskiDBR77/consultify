/**
 * ExecutionHub
 * Unified Execution Center module with 5 views + RAID Log + Decisions
 * Uses shared ModuleHub components for consistent UX
 *
 * Views: List, Kanban, Tiles (Grid), Timeline (Gantt), Calendar
 * Tabs: Execution Center, RAID Log, Decisions
 * Features: Portfolio Health Dashboard, AI Insights, Decision Gates, Drag & Drop Kanban
 */

import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileQuestion,
  GripVertical,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type CardViewStyle, CardViewSwitcher } from '@/components/shared/CardViewSwitcher';
import { Api } from '@/services/api';
import { getStatusActions, getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';

import { useAppStore } from '../../store/useAppStore';
import { FullInitiative, InitiativeStatus, PortfolioInitiative, Task } from '../../types';
import { RAIDLog } from '../Implementation/RAIDLog';
import { InitiativeCompactPanel } from '../Initiatives/InitiativeCompactPanel';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import { DecisionsPanel } from '../MyWork/DecisionsPanel';
import { PortfolioHealthScore } from '../MyWork/Executive/PortfolioHealthScore';
import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ItemStatus,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { BenefitsTracker } from './BenefitsTracker';
import { CorrectiveActions } from './CorrectiveActions';
import { ExecutionDetailPanel } from './ExecutionDetailPanel';
import { ExecutionTimelineView } from './ExecutionTimelineView';
import { ExecutionWorkloadView } from './ExecutionWorkloadView';
import { KPIDashboard } from './KPIDashboard';

// Kanban column status mapping
type KanbanColumnId = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

type ProjectTaskStatus = Task['status'];

const mapPriorityToPortfolio = (
  priority: FullInitiative['priority']
): PortfolioInitiative['priority'] => {
  switch (priority) {
    case 'Critical':
      return 'CRITICAL';
    case 'High':
      return 'HIGH';
    case 'Medium':
      return 'MEDIUM';
    case 'Low':
    default:
      return 'LOW';
  }
};

const mapPriorityToFull = (
  priority: PortfolioInitiative['priority']
): FullInitiative['priority'] => {
  switch (priority) {
    case 'CRITICAL':
      return 'Critical';
    case 'HIGH':
      return 'High';
    case 'MEDIUM':
      return 'Medium';
    case 'LOW':
    default:
      return 'Low';
  }
};

const toPortfolioInitiative = (initiative: FullInitiative): PortfolioInitiative => ({
  id: initiative.id,
  name: initiative.name,
  summary: initiative.summary,
  description: initiative.description,
  axis: String(initiative.axis),
  status: initiative.status,
  priority: mapPriorityToPortfolio(initiative.priority),
  progress: Number((initiative as any).progress ?? 0),
  budget: Number((initiative as any).budget ?? 0),
  plannedStartDate: initiative.plannedStartDate,
  plannedEndDate: initiative.plannedEndDate,
  projectId: initiative.projectId,
  projectName: (initiative as any).projectName,
  sourceId: (initiative as any).sourceId,
  sourceType: (initiative as any).sourceType,
  ownerBusiness: (initiative as any).ownerBusiness,
  ownerExecution: (initiative as any).ownerExecution,
  dependencies: (initiative as any).dependencies,
  isCriticalPath: (initiative as any).isCriticalPath,
  riskScore: (initiative as any).riskScore,
  valueScore: (initiative as any).valueScore,
  createdAt: (initiative as any).createdAt || new Date().toISOString(),
  updatedAt: (initiative as any).updatedAt || new Date().toISOString(),
});

const KANBAN_STATUS_MAP: Record<KanbanColumnId, ProjectTaskStatus> = {
  todo: 'todo',
  in_progress: 'in_progress',
  review: 'review',
  blocked: 'blocked',
  done: 'done',
};

// Draggable Task Card component
interface DraggableTaskCardProps {
  task: Task;
  isPastDue: (date?: string) => boolean;
}

const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({ task, isPastDue }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-cyan-500/40 transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-lg ring-2 ring-cyan-500/50' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-slate-500 flex-shrink-0" />
          <h4 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">{task.title}</h4>
        </div>
        {isPastDue(task.dueDate) && (
          <span className="text-[10px] text-rose-400 uppercase tracking-wide flex-shrink-0">
            {t('execution.badges.overdue')}
          </span>
        )}
      </div>
      {task.initiativeName && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 ml-6">{task.initiativeName}</div>
      )}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 ml-6">
        <span className="capitalize">{task.priority}</span>
        {task.dueDate && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
};

// Droppable Kanban Column component
interface KanbanColumnProps {
  id: KanbanColumnId;
  label: string;
  accent: string;
  icon: React.ReactNode;
  tasks: Task[];
  isPastDue: (date?: string) => boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id,
  label,
  accent,
  icon,
  tasks,
  isPastDue,
}) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useSortable({
    id: `column-${id}`,
    data: { type: 'column', columnId: id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] bg-white/80 dark:bg-navy-900/50 rounded-xl border transition-colors ${
        isOver ? 'border-cyan-500 bg-cyan-500/5' : 'border-slate-200 dark:border-navy-700'
      }`}
      data-testid={`kanban-column-${id}`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-700 ${accent}`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          {icon}
          {label}
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="p-3 space-y-3 max-h-[520px] overflow-y-auto min-h-[100px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <DraggableTaskCard key={task.id} task={task} isPastDue={isPastDue} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div
            className={`text-center text-xs py-6 border-2 border-dashed rounded-lg transition-colors ${
              isOver ? 'border-cyan-500/50 text-cyan-400' : 'border-slate-300 dark:border-navy-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            {isOver ? t('execution.kanban.dropHere') : t('execution.kanban.noTasks')}
          </div>
        )}
      </div>
    </div>
  );
};

const MODULE_STATUSES = getStatusesForModule('execution');
const EXECUTION_STATUS_FALLBACK: InitiativeStatus[] = [
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
  InitiativeStatus.DONE,
  InitiativeStatus.CANCELLED,
  InitiativeStatus.ARCHIVED,
];
const EXECUTION_STATUSES: InitiativeStatus[] = Array.from(
  new Set([...MODULE_STATUSES, ...EXECUTION_STATUS_FALLBACK])
);

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

interface ExecutionDecision {
  id: string;
  title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';
  dueDate?: string;
  ownerName?: string;
  relatedObjectName?: string;
}

type CalendarItem = {
  id: string;
  type: 'task' | 'decision';
  title: string;
  dueDate: string;
  status: string;
  initiativeName?: string;
  ownerName?: string;
};

type PMOHealthSnapshot = {
  projectId: string;
  projectName: string;
  phase: { number: number; name: string };
  stageGate: {
    gateType: string | null;
    isReady: boolean;
    missingCriteria: Array<{ criterion: string; evidence: string }>;
    metCriteria: Array<{ criterion: string; evidence: string }>;
  };
  blockers: Array<{ type: string; message: string }>;
  tasks: { overdueCount: number; dueSoonCount: number; blockedCount: number };
  decisions: { pendingCount: number; overdueCount: number };
  initiatives: { atRiskCount: number; blockedCount: number };
  updatedAt: string;
};

const normalizeTaskStatus = (
  status: ProjectTaskStatus
): 'todo' | 'in_progress' | 'review' | 'blocked' | 'done' => {
  const normalized = status.toString().toLowerCase();
  if (normalized === 'in_progress') return 'in_progress';
  if (normalized === 'review') return 'review';
  if (normalized === 'blocked') return 'blocked';
  if (normalized === 'done') return 'done';
  return 'todo';
};

const isPastDue = (date?: string): boolean => {
  if (!date) return false;
  return new Date(date).getTime() < new Date().setHours(0, 0, 0, 0);
};

interface ExecutionHubProps {
  initialTab?: ModuleTab;
}

export const ExecutionHub: React.FC<ExecutionHubProps> = ({ initialTab = 'list' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentProjectId, fullSessionData } = useAppStore();
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cardViewStyle, setCardViewStyle] = useState<CardViewStyle>('d'); // D6.9
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // D5.2: Workload heatmap toggle
  const [showWorkloadHeatmap, setShowWorkloadHeatmap] = useState(false);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<FullInitiative | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  // Data state
  const [initiatives, setInitiatives] = useState<FullInitiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<ExecutionDecision[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<PMOHealthSnapshot | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Fetch initiatives in execution phase
  useEffect(() => {
    const loadInitiatives = async () => {
      setIsLoading(true);
      try {
        // Get initiatives that are in execution phase
        const response = await Api.getInitiatives(currentProjectId || undefined);
        const data = Array.isArray(response) ? response : (response as any)?.initiatives || [];

        // Filter to execution-relevant statuses
        const executionInitiatives = data.filter((i: FullInitiative) =>
          EXECUTION_STATUSES.includes(i.status)
        );

        setInitiatives(executionInitiatives);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load:', err);
        // Fallback to session data
        const executionInitiatives = (fullSessionData?.initiatives || []).filter(
          (i: FullInitiative) => EXECUTION_STATUSES.includes(i.status)
        );
        setInitiatives(executionInitiatives);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitiatives();
  }, [currentProjectId, fullSessionData?.initiatives]);

  useEffect(() => {
    if (!currentProjectId) return;
    const loadTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const data = await Api.getTasks({ projectId: currentProjectId });
        setTasks(Array.isArray(data) ? (data as Task[]) : []);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load tasks:', err);
        setTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    };
    loadTasks();
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId) return;
    const loadDecisions = async () => {
      setIsLoadingDecisions(true);
      try {
        const response = await Api.get(`/decisions?projectId=${currentProjectId}`);
        const data = Array.isArray(response) ? response : response?.decisions || [];
        setDecisions(data);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load decisions:', err);
        setDecisions([]);
      } finally {
        setIsLoadingDecisions(false);
      }
    };
    loadDecisions();
  }, [currentProjectId]);

  useEffect(() => {
    if (!currentProjectId) return;
    const loadHealthSnapshot = async () => {
      setIsLoadingHealth(true);
      try {
        const snapshot = await Api.get(`/pmo/health/${currentProjectId}`);
        setHealthSnapshot(snapshot);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load PMO health snapshot:', err);
        setHealthSnapshot(null);
      } finally {
        setIsLoadingHealth(false);
      }
    };
    loadHealthSnapshot();
  }, [currentProjectId]);

  // Calculate stats
  const statusCounts = useMemo(() => {
    const counts = EXECUTION_STATUSES.reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<InitiativeStatus, number>
    );
    initiatives.forEach((initiative) => {
      if (counts[initiative.status] !== undefined) counts[initiative.status] += 1;
    });
    return counts;
  }, [initiatives]);

  const stats = useMemo(
    () => ({
      executing: statusCounts[InitiativeStatus.EXECUTING] ?? 0,
      blocked: statusCounts[InitiativeStatus.BLOCKED] ?? 0,
    }),
    [statusCounts]
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

    if (activeStatusFilter) {
      result = result.filter((i) => i.status === activeStatusFilter);
    }

    return result;
  }, [initiatives, searchQuery, activeFilters, activeStatusFilter]);

  const tasksByInitiative = useMemo(() => {
    return tasks.reduce<Record<string, Task[]>>((acc, task) => {
      if (!task.initiativeId) return acc;
      if (!acc[task.initiativeId]) acc[task.initiativeId] = [];
      acc[task.initiativeId].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const decisionsByInitiative = useMemo(() => {
    return decisions.reduce<Record<string, ExecutionDecision[]>>((acc, decision) => {
      const relatedId = (decision as any).relatedObjectId;
      if (!relatedId) return acc;
      if (!acc[relatedId]) acc[relatedId] = [];
      acc[relatedId].push(decision);
      return acc;
    }, {});
  }, [decisions]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('execution.tabs.execution', 'Execution Center'),
        icon: <LayoutDashboard size={16} />,
        count: filteredInitiatives.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('execution.tabs.initiatives', 'Initiatives'),
        icon: <Target size={16} />,
        count: initiatives.length,
      },
      {
        id: 'raid' as ModuleTab,
        label: t('execution.tabs.raid', 'RAID Log'),
        icon: <Shield size={16} />,
      },
      {
        id: 'decisions' as ModuleTab,
        label: t('execution.tabs.decisions', 'Decisions'),
        icon: <FileQuestion size={16} />,
        count: decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING').length,
      },
      {
        id: 'kpi' as ModuleTab,
        label: t('execution.tabs.kpi', 'KPIs & Benefits'),
        icon: <BarChart3 size={16} />,
      },
    ],
    [t, filteredInitiatives.length, initiatives.length, decisions]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('execution.table.type'),
        width: '80px',
        render: (row) => {
          const code = getTypeCode(row.axis);
          return (
            <div className="flex items-center gap-2">
              <Target size={14} className="text-cyan-400" />
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{code}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('execution.table.name'),
        render: (row) => <span className="text-sm text-slate-900 dark:text-white font-medium">{row.name}</span>,
      },
      {
        id: 'status',
        label: t('execution.table.status'),
        width: '160px',
        filterable: true,
        filterOptions: EXECUTION_STATUSES.map((status) => ({
          value: status,
          label: STATUS_METADATA[status].label,
          color: STATUS_METADATA[status].dotColor,
        })),
        render: (row) => {
          const meta = STATUS_METADATA[row.status as InitiativeStatus];
          const actions = getStatusActions(row.status as InitiativeStatus);
          return (
            <div className="relative group">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${meta?.bgColor || ''} ${meta?.color || ''}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta?.dotColor || 'bg-slate-400'}`} />
                {meta?.label || row.status}
              </div>
              {actions.length > 0 && (
                <select
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleInlineStatusChange(row.id, e.target.value);
                    }
                  }}
                >
                  <option value="">{meta?.label || row.status}</option>
                  {actions.map((a) => (
                    <option key={a.targetStatus} value={a.targetStatus}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        },
      },
      {
        id: 'assignee',
        label: t('execution.table.assignee'),
        width: '150px',
        render: (row) => {
          const owner = row.ownerBusiness || row.ownerTechnical;
          if (!owner) return <span className="text-slate-500 text-sm">{t('execution.table.unassigned')}</span>;
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs text-slate-400 dark:text-white">
                {owner.firstName?.[0]}
                {owner.lastName?.[0]}
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {owner.firstName} {owner.lastName}
              </span>
            </div>
          );
        },
      },
      {
        id: 'progress',
        label: t('execution.table.progress'),
        width: '140px',
        render: (row) => {
          const progress = row.progress || 0;
          const isBlocked = row.status === InitiativeStatus.BLOCKED;
          const isOverdue =
            row.plannedEndDate &&
            new Date(row.plannedEndDate) < new Date() &&
            row.status !== InitiativeStatus.DONE;
          const color = isBlocked
            ? 'bg-red-500'
            : isOverdue
              ? 'bg-amber-500'
              : progress >= 100
                ? 'bg-emerald-500'
                : 'bg-cyan-500';
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">{progress}%</span>
            </div>
          );
        },
      },
      {
        id: 'timeRemaining',
        label: t('execution.table.timeLeft'),
        width: '120px',
        render: (row) => {
          if (!row.plannedEndDate) {
            return <span className="text-xs text-slate-500">No deadline</span>;
          }
          const now = new Date();
          const end = new Date(row.plannedEndDate);
          const diffMs = end.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (row.status === InitiativeStatus.DONE) {
            return (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} />
                {t('execution.badges.done')}
              </span>
            );
          }

          if (diffDays < 0) {
            return (
              <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                <AlertTriangle size={12} />
                {Math.abs(diffDays)}{t('execution.time.daysOverdue')}
              </span>
            );
          }

          if (diffDays <= 7) {
            return (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Clock size={12} />
                {diffDays}{t('execution.time.daysLeft')}
              </span>
            );
          }

          if (diffDays <= 30) {
            return <span className="text-xs text-slate-700 dark:text-slate-300">{diffDays}{t('execution.time.daysLeft')}</span>;
          }

          const weeks = Math.ceil(diffDays / 7);
          return <span className="text-xs text-slate-500 dark:text-slate-400">{weeks}{t('execution.time.weeksLeft')}</span>;
        },
      },
      {
        id: 'alerts',
        label: t('execution.table.alerts'),
        width: '130px',
        render: (row) => {
          const badges: React.ReactNode[] = [];
          const initiativeTasks = tasksByInitiative[row.id] || [];
          const relatedDecisions = decisionsByInitiative[row.id] || [];
          const blockedTasks = initiativeTasks.filter(
            (t) => normalizeTaskStatus(t.status) === 'blocked'
          ).length;
          const overdueDecisions = relatedDecisions.filter(
            (d) => String(d.status).toUpperCase() === 'PENDING' && isPastDue(d.dueDate)
          ).length;

          if (row.status === InitiativeStatus.BLOCKED) {
            badges.push(
              <span
                key="blocked"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400"
              >
                <AlertTriangle size={10} />
                {t('execution.badges.blocked')}
              </span>
            );
          }

          if (
            row.plannedEndDate &&
            new Date(row.plannedEndDate) < new Date() &&
            row.status !== InitiativeStatus.DONE
          ) {
            badges.push(
              <span
                key="overdue"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400"
              >
                <Clock size={10} />
                {t('execution.badges.overdue')}
              </span>
            );
          }

          if (blockedTasks > 0) {
            badges.push(
              <span
                key="btasks"
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/15 text-rose-400"
              >
                {blockedTasks} {t('execution.badges.blocked')}
              </span>
            );
          }

          if (overdueDecisions > 0) {
            badges.push(
              <span
                key="odecisions"
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400"
              >
                {overdueDecisions} {t('execution.badges.decision')}
              </span>
            );
          }

          if (badges.length === 0) {
            return (
              <span className="text-xs text-emerald-400/70 flex items-center gap-1">
                <CheckCircle2 size={12} />
                {t('execution.badges.ok')}
              </span>
            );
          }

          return <div className="flex flex-wrap gap-1">{badges}</div>;
        },
      },
      {
        id: 'tasks',
        label: t('execution.table.tasks'),
        width: '90px',
        render: (row) => {
          const initiativeTasks = tasksByInitiative[row.id] || [];
          if (initiativeTasks.length === 0) {
            return <span className="text-xs text-slate-500">-</span>;
          }
          const doneCount = initiativeTasks.filter(
            (task) => normalizeTaskStatus(task.status) === 'done'
          ).length;
          return (
            <span className="text-xs text-slate-700 dark:text-slate-300">
              {doneCount}/{initiativeTasks.length}
            </span>
          );
        },
      },
      {
        id: 'deadline',
        label: t('execution.table.deadline'),
        width: '100px',
        render: (row) => {
          if (!row.plannedEndDate && !row.slaDeadline) {
            return <span className="text-slate-500 text-sm">-</span>;
          }
          const deadline = row.slaDeadline || row.plannedEndDate;
          const isOverdue = new Date(deadline) < new Date() && row.status !== InitiativeStatus.DONE;
          return (
            <span className={`text-sm ${isOverdue ? 'text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
              {new Date(deadline).toLocaleDateString()}
            </span>
          );
        },
      },
    ],
    [t, decisionsByInitiative, tasksByInitiative]
  );

  const statusFilters = useMemo(
    () => [
      { id: 'all', label: t('execution.filters.all'), color: 'bg-slate-400', count: initiatives.length },
      ...EXECUTION_STATUSES.map((status) => ({
        id: status,
        label: STATUS_METADATA[status].label,
        color: STATUS_METADATA[status].dotColor,
        count: statusCounts[status] ?? 0,
      })),
    ],
    [t, initiatives.length, statusCounts]
  );

  const portfolioMetrics = useMemo(() => {
    const totalInitiatives = initiatives.length;
    const avgProgress = Math.round(
      initiatives.reduce((sum, i) => sum + (i.progress || 0), 0) / Math.max(totalInitiatives, 1)
    );

    const overdueDecisions =
      healthSnapshot?.decisions?.overdueCount ??
      decisions.filter(
        (decision) =>
          String(decision.status).toUpperCase() === 'PENDING' && isPastDue(decision.dueDate)
      ).length;
    const totalDecisions =
      healthSnapshot?.decisions?.pendingCount ??
      decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING').length;
    const decisionHealth = totalDecisions
      ? Math.max(0, 100 - Math.round((overdueDecisions / totalDecisions) * 100))
      : 100;

    const completedTasks = tasks.filter(
      (task) => normalizeTaskStatus(task.status) === 'done'
    ).length;
    const taskHealth = tasks.length
      ? Math.max(0, Math.round((completedTasks / tasks.length) * 100))
      : 0;

    const blockedCount = healthSnapshot?.initiatives?.blockedCount ?? stats.blocked;
    const riskHealth = totalInitiatives
      ? Math.max(0, 100 - Math.round((blockedCount / totalInitiatives) * 100))
      : 100;

    const healthScore = Math.round((avgProgress + decisionHealth + taskHealth + riskHealth) / 4);

    const budgetValues = initiatives
      .map((initiative) => (initiative as any).budget || (initiative as any).costCapex)
      .filter((value) => typeof value === 'number' && value > 0);

    return {
      healthScore,
      avgProgress,
      overdueDecisions,
      totalDecisions,
      blockedCount,
      onTrackCount: Math.max(totalInitiatives - blockedCount, 0),
      budgetHealth: budgetValues.length ? 100 : null,
      breakdown: {
        execution: avgProgress,
        decisions: decisionHealth,
        capacity: taskHealth,
        risk: riskHealth,
      },
      blockers: healthSnapshot?.blockers || [],
      stageGate: healthSnapshot?.stageGate || null,
      isHealthLoading: isLoadingHealth,
    };
  }, [initiatives, decisions, tasks, stats, healthSnapshot, isLoadingHealth]);

  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = [];

    tasks.forEach((task) => {
      if (!task.dueDate) return;
      items.push({
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        dueDate: task.dueDate,
        status: task.status,
        initiativeName: task.initiativeName,
        ownerName: task.assigneeName,
      });
    });

    decisions.forEach((decision) => {
      if (!decision.dueDate) return;
      items.push({
        id: `decision-${decision.id}`,
        type: 'decision',
        title: decision.title,
        dueDate: decision.dueDate,
        status: decision.status,
        initiativeName: decision.relatedObjectName,
        ownerName: decision.ownerName,
      });
    });

    return items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks, decisions]);

  const handleExport = useCallback(() => {
    const headers = ['Name', 'Status', 'Owner', 'Progress', 'Planned Start', 'Planned End'];
    const rows = filteredInitiatives.map((initiative) => [
      `"${initiative.name.replace(/"/g, '""')}"`,
      initiative.status,
      initiative.ownerBusiness
        ? `${initiative.ownerBusiness.firstName} ${initiative.ownerBusiness.lastName}`
        : '',
      initiative.progress ?? 0,
      initiative.plannedStartDate || '',
      initiative.plannedEndDate || '',
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'execution-center-export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredInitiatives]);

  const aiInsights = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const dueSoonTasks = tasks.filter((task) => {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate).getTime();
      return due >= now && due <= now + sevenDays && normalizeTaskStatus(task.status) !== 'done';
    });

    const priorityRecommendations = dueSoonTasks.slice(0, 3).map((task) => ({
      title: task.title,
      context: task.initiativeName || 'Execution Center',
    }));

    const timelineConflicts = initiatives
      .filter(
        (initiative) =>
          !initiative.plannedStartDate ||
          !initiative.plannedEndDate ||
          (initiative.plannedStartDate &&
            initiative.plannedEndDate &&
            new Date(initiative.plannedStartDate) > new Date(initiative.plannedEndDate))
      )
      .slice(0, 3)
      .map((initiative) => ({
        title: initiative.name,
        context:
          !initiative.plannedStartDate || !initiative.plannedEndDate
            ? 'Missing dates'
            : 'Schedule conflict',
      }));

    const riskAlerts = initiatives
      .filter((initiative) => initiative.status === InitiativeStatus.BLOCKED)
      .slice(0, 3)
      .map((initiative) => ({
        title: initiative.name,
        context: 'Blocked initiative',
      }));

    const overdueDecisionAlerts = decisions
      .filter(
        (decision) =>
          String(decision.status).toUpperCase() === 'PENDING' && isPastDue(decision.dueDate)
      )
      .slice(0, 3)
      .map((decision) => ({
        title: decision.title,
        context: decision.relatedObjectName || 'Pending decision',
      }));

    return {
      priorityRecommendations,
      timelineConflicts,
      riskAlerts: [...riskAlerts, ...overdueDecisionAlerts].slice(0, 3),
    };
  }, [tasks, initiatives, decisions]);

  // Handlers
  const handleOpenDocument = useCallback((row: FullInitiative) => {
    const code = getTypeCode(row.axis);
    const doc: OpenDocument = {
      id: row.id,
      type: 'initiative',
      subType: code,
      name: row.name,
      status:
        row.status === InitiativeStatus.BLOCKED
          ? 'BLOCKED'
          : row.status === InitiativeStatus.DONE
            ? 'DONE'
            : 'DRAFT',
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(row.id);
    setIsSidePanelOpen(false);
  }, []);

  const handleOpenSidePanel = useCallback((row: FullInitiative) => {
    setActiveDocumentId(null);
    setSelectedInitiative(row);
    setIsSidePanelOpen(true);
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
    setIsSidePanelOpen(false);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: FullInitiative) => {
      if (action === 'preview' || action === 'view') {
        handleOpenSidePanel(row);
      } else if (action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenSidePanel, handleOpenDocument]
  );

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return filteredInitiatives.map((item) => {
      const isOverdue =
        item.plannedEndDate &&
        new Date(item.plannedEndDate) < new Date() &&
        item.status !== InitiativeStatus.DONE;
      const owner = item.ownerBusiness || item.ownerTechnical;
      const ownerName = owner
        ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
        : undefined;

      return {
        id: item.id,
        name: item.name,
        type: getTypeCode(item.axis),
        typeColor: isOverdue ? 'amber' : 'cyan',
        status:
          item.status === InitiativeStatus.BLOCKED
            ? ('BLOCKED' as ItemStatus)
            : item.status === InitiativeStatus.DONE
              ? ('DONE' as ItemStatus)
              : item.status === InitiativeStatus.EXECUTING
                ? ('EXECUTING' as ItemStatus)
                : ('DRAFT' as ItemStatus),
        progress: item.progress || 0,
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        ownerName,
      };
    });
  }, [filteredInitiatives]);

  // Drag & drop state
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const taskData = active.data.current;
    if (taskData?.type === 'task') {
      setActiveTask(taskData.task);
    }
  }, []);

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Visual feedback is handled by isOver in KanbanColumn
  }, []);

  // Handle drag end - update task status
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Determine target column
      let targetColumnId: KanbanColumnId | null = null;

      if (overId.startsWith('column-')) {
        targetColumnId = overId.replace('column-', '') as KanbanColumnId;
      } else {
        // Dropped on another task - find its column
        const overTask = tasks.find((t) => t.id === overId);
        if (overTask) {
          targetColumnId = normalizeTaskStatus(overTask.status) as KanbanColumnId;
        }
      }

      if (!targetColumnId) return;

      const task = tasks.find((t) => t.id === activeId);
      if (!task) return;

      const currentColumn = normalizeTaskStatus(task.status);
      if (currentColumn === targetColumnId) return;

      // Get the new status
      const newStatus = KANBAN_STATUS_MAP[targetColumnId];

      // Optimistic update
      setTasks((prev) => prev.map((t) => (t.id === activeId ? { ...t, status: newStatus } : t)));

      // API call to update task status
      try {
        await Api.patch(`/tasks/${activeId}`, { status: newStatus });
        toast.success(
          t('execution.toast.taskMoved', 'Zadanie przeniesione do {{column}}', {
            column: targetColumnId.replace('_', ' '),
          })
        );
      } catch (error) {
        // Revert on error
        setTasks((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, status: task.status } : t))
        );
        toast.error(
          t('execution.toast.taskStatusError', 'Nie udało się zaktualizować statusu zadania')
        );
        console.error('Error updating task status:', error);
      }
    },
    [t, tasks]
  );

  const renderTaskBoard = () => {
    const groupedTasks = tasks.reduce(
      (acc, task) => {
        const status = normalizeTaskStatus(task.status);
        acc[status].push(task);
        return acc;
      },
      {
        todo: [] as Task[],
        in_progress: [] as Task[],
        review: [] as Task[],
        blocked: [] as Task[],
        done: [] as Task[],
      }
    );

    if (isLoadingTasks) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    const columns: { id: KanbanColumnId; label: string; accent: string; icon: React.ReactNode }[] =
      [
        { id: 'todo', label: t('execution.kanban.toDo'), accent: 'text-slate-300', icon: <ClipboardList size={14} /> },
        {
          id: 'in_progress',
          label: t('execution.kanban.inProgress'),
          accent: 'text-cyan-300',
          icon: <Target size={14} />,
        },
        { id: 'review', label: t('execution.kanban.review'), accent: 'text-amber-300', icon: <Scale size={14} /> },
        {
          id: 'blocked',
          label: t('execution.kanban.blocked'),
          accent: 'text-rose-300',
          icon: <AlertTriangle size={14} />,
        },
        { id: 'done', label: t('execution.kanban.done'), accent: 'text-emerald-300', icon: <CheckCircle2 size={14} /> },
      ];

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 overflow-x-auto" data-testid="kanban-board">
          <SortableContext items={columns.map((c) => `column-${c.id}`)}>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                accent={col.accent}
                icon={col.icon}
                tasks={groupedTasks[col.id]}
                isPastDue={isPastDue}
              />
            ))}
          </SortableContext>
        </div>

        {/* Drag overlay for smooth dragging experience */}
        <DragOverlay>
          {activeTask ? (
            <div className="p-3 bg-white dark:bg-navy-800 border-2 border-cyan-500 rounded-lg shadow-xl w-[240px]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-cyan-400" />
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
                    {activeTask.title}
                  </h4>
                </div>
              </div>
              {activeTask.initiativeName && (
                <div className="text-xs text-slate-400 mb-2 ml-6">{activeTask.initiativeName}</div>
              )}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 ml-6">
                <span className="capitalize">{activeTask.priority}</span>
                {activeTask.dueDate && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(activeTask.dueDate).toLocaleDateString()}
                  </span>
                )}
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

  // Handle inline status change from table/grid
  const handleInlineStatusChange = useCallback(
    async (initiativeId: string, newStatus: string) => {
      try {
        await Api.patch(`/initiatives/${initiativeId}`, { status: newStatus });
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, status: newStatus as InitiativeStatus } : i))
        );
        toast.success(t('execution.toast.statusUpdated', 'Status updated'));
      } catch (e: any) {
        toast.error(e?.message || t('execution.toast.statusUpdateFailed', 'Failed to update status'));
      }
    },
    [t]
  );

  const handleInitiativeUpdate = useCallback((updated: FullInitiative) => {
    setInitiatives((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedInitiative((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  const handlePortfolioUpdate = useCallback((updated: PortfolioInitiative) => {
    setInitiatives((prev) =>
      prev.map((i) =>
        i.id === updated.id
          ? {
              ...i,
              name: updated.name,
              summary: updated.summary ?? i.summary,
              description: updated.description ?? i.description,
              status: updated.status,
              priority: mapPriorityToFull(updated.priority),
              plannedStartDate: updated.plannedStartDate ?? i.plannedStartDate,
              plannedEndDate: updated.plannedEndDate ?? i.plannedEndDate,
            }
          : i
      )
    );
    setSelectedInitiative((prev) =>
      prev?.id === updated.id ? { ...prev, status: updated.status } : prev
    );
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      const response = await Api.getInitiatives(currentProjectId || undefined);
      const data = Array.isArray(response) ? response : (response as any)?.initiatives || [];
      const executionInitiatives = data.filter((i: FullInitiative) =>
        EXECUTION_STATUSES.includes(i.status)
      );
      setInitiatives(executionInitiatives);
    } catch (err) {
      console.error('[ExecutionHub] Failed to refresh:', err);
    }
  }, [currentProjectId]);

  const renderPortfolioHealth = () => (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]" data-testid="portfolio-health">
      <PortfolioHealthScore
        score={portfolioMetrics.healthScore}
        breakdown={portfolioMetrics.breakdown}
        trend={portfolioMetrics.overdueDecisions > 0 ? 'down' : 'up'}
        loading={portfolioMetrics.isHealthLoading}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.onTrack')}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{portfolioMetrics.onTrackCount}</p>
            </div>
            <CheckCircle2 className="text-emerald-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.blocked')}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{portfolioMetrics.blockedCount}</p>
            </div>
            <AlertTriangle className="text-rose-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.overdueDecisions')}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {portfolioMetrics.overdueDecisions}
              </p>
            </div>
            <Scale className="text-amber-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.avgProgress')}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{portfolioMetrics.avgProgress}%</p>
            </div>
            <Target className="text-cyan-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.budgetHealth')}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {portfolioMetrics.budgetHealth === null ? '—' : `${portfolioMetrics.budgetHealth}%`}
              </p>
            </div>
            <LayoutDashboard className="text-violet-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.decisionSla')}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {portfolioMetrics.totalDecisions === 0
                  ? '—'
                  : `${portfolioMetrics.totalDecisions - portfolioMetrics.overdueDecisions}/${portfolioMetrics.totalDecisions}`}
              </p>
            </div>
            <Clock className="text-amber-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 sm:col-span-2 lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('execution.portfolio.escalationsGates')}</p>
            <span className="text-xs text-slate-500">
              {portfolioMetrics.stageGate?.gateType || 'No gate info'}
            </span>
          </div>
          {portfolioMetrics.blockers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('execution.portfolio.noActiveEscalations')}</p>
          ) : (
            <div className="space-y-2">
              {portfolioMetrics.blockers.slice(0, 4).map((blocker, idx) => (
                <div
                  key={`${blocker.type}-${idx}`}
                  className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <AlertTriangle className="text-rose-400 mt-0.5" size={14} />
                  <span>{blocker.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderAIInsights = () => (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('execution.ai.priorityRecommendations')}</h3>
        {aiInsights.priorityRecommendations.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('execution.ai.noPriorities')}</p>
        ) : (
          <div className="space-y-2">
            {aiInsights.priorityRecommendations.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                <span className="text-slate-500"> · {item.context}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('execution.ai.timelineConflicts')}</h3>
        {aiInsights.timelineConflicts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('execution.ai.noConflicts')}</p>
        ) : (
          <div className="space-y-2">
            {aiInsights.timelineConflicts.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                <span className="text-slate-500"> · {item.context}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">{t('execution.ai.riskSuggestions')}</h3>
        {aiInsights.riskAlerts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('execution.ai.noRisks')}</p>
        ) : (
          <div className="space-y-2">
            {aiInsights.riskAlerts.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                <span className="text-slate-500"> · {item.context}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCalendarView = () => {
    if (isLoadingTasks || isLoadingDecisions) {
      return (
        <div className="flex items-center justify-center h-80">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    if (calendarItems.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-slate-500 dark:text-slate-400">
          <div className="text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-cyan-400/50" />
            <p className="text-lg text-slate-900 dark:text-white">{t('execution.empty.noDeadlines')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('execution.empty.deadlinesWillAppear')}</p>
          </div>
        </div>
      );
    }

    const grouped = calendarItems.reduce<Record<string, CalendarItem[]>>((acc, item) => {
      const dateKey = new Date(item.dueDate).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
    }, {});

    return (
      <div className="p-4 space-y-4">
        {Object.entries(grouped).map(([dateKey, items]) => (
          <div key={dateKey} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-700 dark:text-slate-300">
              <Calendar size={16} className="text-cyan-400" />
              <span className="text-sm font-semibold">
                {new Date(dateKey).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-4 p-3 rounded-lg border ${
                    isPastDue(item.dueDate)
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : 'border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                      {item.type === 'task' ? (
                        <ClipboardList size={14} className="text-cyan-400" />
                      ) : (
                        <Scale size={14} className="text-amber-400" />
                      )}
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.initiativeName || 'Execution Center'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{item.ownerName || t('execution.table.unassigned')}</div>
                    {isPastDue(item.dueDate) && <div className="text-rose-400">{t('execution.badges.overdue')}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderExecutionView = () => {
    if (viewMode === 'table') {
      return (
        <FilterableTable
          columns={columns}
          data={filteredInitiatives as any[]}
          onRowClick={(row) => handleOpenSidePanel(row as unknown as FullInitiative)}
          onRowAction={(action, row) => handleRowAction(action, row as unknown as FullInitiative)}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={t('execution.empty.noInExecution')}
        />
      );
    }

    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={(item) => {
            const initiative = filteredInitiatives.find((entry) => entry.id === item.id);
            if (initiative) handleOpenSidePanel(initiative);
          }}
          onItemAction={(action, item) => {
            const initiative = filteredInitiatives.find((entry) => entry.id === item.id);
            if (initiative) handleRowAction(action, initiative);
          }}
          emptyMessage={t('execution.empty.noAvailable')}
        />
      );
    }

    if (viewMode === 'kanban') {
      return renderTaskBoard();
    }

    if (viewMode === 'timeline') {
      return (
        <div className="min-h-[420px]">
          <ExecutionTimelineView
            initiatives={filteredInitiatives as FullInitiative[]}
            onInitiativeClick={handleOpenSidePanel}
          />
        </div>
      );
    }

    if (viewMode === 'calendar') {
      return renderCalendarView();
    }

    return null;
  };

  // Render RAID Log tab
  const renderRAIDTab = () => (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('execution.raidLog.title')}</h2>
        <p className="text-sm text-slate-400">
          {t('execution.raidLog.description')}
        </p>
      </div>
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden p-4">
        <RAIDLog
          initiativeId={selectedInitiative?.id}
          projectId={currentProjectId || undefined}
          onItemClick={(item) => {
            // Navigate to the initiative that owns this RAID item
            const initiativeId = item?.initiativeId || selectedInitiative?.id;
            if (initiativeId) {
              const full = initiatives.find((i) => i.id === initiativeId);
              if (full) {
                handleOpenDocument(full);
              } else {
                // Fallback: open directly by ID
                setActiveDocumentId(initiativeId);
              }
            }
          }}
        />
      </div>
    </div>
  );

  // Render Decisions tab
  const renderDecisionsTab = () => (
    <div className="p-4 h-full">
      <DecisionsPanel onDecisionClick={(id) => {
        // Open the decision detail — navigate to related initiative if possible
        if (id) {
          setActiveDocumentId(null);
          // Decisions panel handles its own detail view, but we can try to find the related initiative
          const relatedInitiative = initiatives.find((i) =>
            (i as any).decisions?.some?.((d: any) => d.id === id)
          );
          if (relatedInitiative) {
            handleOpenDocument(relatedInitiative);
          }
        }
      }} />
    </div>
  );

  const sidePanelInitiative = useMemo(
    () => (selectedInitiative ? toPortfolioInitiative(selectedInitiative) : null),
    [selectedInitiative]
  );

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    // Handle RAID and Decisions tabs
    if (activeTab === 'raid') {
      return renderRAIDTab();
    }

    if (activeTab === 'decisions') {
      return renderDecisionsTab();
    }

    // KPIs & Benefits tab
    if (activeTab === ('kpi' as ModuleTab)) {
      return (
        <div className="p-4 space-y-8 overflow-auto">
          <KPIDashboard
            projectId={currentProjectId || ''}
            onAddKPI={() =>
              toast(
                t('execution.kpi.addHint', 'Use the AI chat to define KPIs for your initiatives'),
                { icon: 'ℹ️' }
              )
            }
            onUpdateKPI={(kpiId, value) => {
              Api.patch(`/pmo/kpis/${kpiId}`, { actual: value })
                .then(() => {
                  toast.success(t('execution.kpi.updated', 'KPI updated'));
                })
                .catch(() => toast.error(t('execution.kpi.updateFailed', 'Failed to update KPI')));
            }}
            onCreateCorrectiveAction={() => {
              toast(t('execution.kpi.correctiveHint', 'Creating corrective action for KPI...'), {
                icon: '🎯',
              });
            }}
          />
          <BenefitsTracker projectId={currentProjectId || ''} />
          <CorrectiveActions
            projectId={currentProjectId || ''}
            onCreateAction={() =>
              toast(
                t(
                  'execution.corrective.createHint',
                  'Use the AI chat to create corrective actions'
                ),
                { icon: 'ℹ️' }
              )
            }
            onUpdateAction={(actionId, updates) => {
              Api.patch(`/pmo/corrective-actions/${actionId}`, updates)
                .then(() => {
                  toast.success(t('execution.corrective.updated', 'Action updated'));
                })
                .catch(() =>
                  toast.error(t('execution.corrective.updateFailed', 'Failed to update action'))
                );
            }}
          />
        </div>
      );
    }

    // D6.1: Initiatives tab — dedicated view of all execution initiatives
    if (activeTab === 'initiatives') {
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {t('execution.initiativesTab.title', 'Execution Initiatives')}
              </h2>
              <p className="text-sm text-slate-400">
                {t(
                  'execution.initiativesTab.subtitle',
                  'Track progress, owners, alerts and blockers for all initiatives in execution'
                )}
              </p>
            </div>
            {/* D5.2: Heatmap toggle */}
            <button
              onClick={() => setShowWorkloadHeatmap((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showWorkloadHeatmap
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:text-slate-900 dark:hover:text-white hover:border-cyan-500/50'
              }`}
            >
              <CalendarDays size={16} />
              {t('execution.heatmap', 'Workload Heatmap')}
            </button>
          </div>
          {showWorkloadHeatmap ? (
            <ExecutionWorkloadView
              initiatives={initiatives}
              onInitiativeClick={(ini) => {
                setActiveDocumentId(ini.id);
              }}
            />
          ) : (
            <div className="text-sm text-slate-400">
              {t(
                'execution.initiativesTab.info',
                'Select an initiative from the Execution Center tab to view details, or use the Workload Heatmap to see resource allocation.'
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeDocumentId) {
      return (
        <InitiativeDocumentView
          initiativeId={activeDocumentId}
          onBack={handleShowList}
          onStatusChange={() => handleRefresh()}
          sourceModule="execution"
        />
      );
    }

    return (
      <div className="p-4 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Execution Center actions for tasks, decisions, and reporting.
          </div>
          <div className="flex items-center gap-2">
            {/* D6.9: Presentation style switcher */}
            <CardViewSwitcher
              moduleId="execution"
              value={cardViewStyle}
              onChange={setCardViewStyle}
              compact
            />
            <button
              onClick={() => {
                setViewMode('kanban');
                toast(
                  t('execution.toast.openTasksView', 'Otwórz widok Zadań, aby dodać nowe zadanie.')
                );
              }}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-cyan-500/50 transition-colors"
            >
              {t('execution.actions.newTask')}
            </button>
            <button
              onClick={() => {
                setActiveTab('decisions' as ModuleTab);
              }}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-amber-500/50 transition-colors"
            >
              {t('execution.actions.newDecision')}
            </button>
            <button
              onClick={() => {
                setActiveTab('raid' as ModuleTab);
              }}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-rose-500/50 transition-colors"
            >
              {t('execution.actions.raidLog')}
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-emerald-500/50 transition-colors"
            >
              {t('execution.actions.export')}
            </button>
            {/* D6.5: Report button — executive summary of all initiatives */}
            <button
              onClick={() => {
                navigate('/reports');
                toast.success(t('execution.reportNav', 'Opening execution report...'), {
                  duration: 1500,
                  icon: '📊',
                });
              }}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 border border-indigo-500/50 text-sm text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-colors"
            >
              {t('execution.actions.report')}
            </button>
            <button
              onClick={() => {
                if (isChatCollapsed) {
                  toggleChatCollapse();
                }
              }}
              className="px-3 py-2 rounded-lg bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-violet-500/30 text-sm text-violet-300 hover:text-white hover:border-violet-500/50 transition-colors flex items-center gap-2"
              title="Open AI Chat for execution context"
            >
              <MessageSquare size={14} />
              {t('execution.actions.aiChat')}
            </button>
          </div>
        </div>
        {renderPortfolioHealth()}
        {renderAIInsights()}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          {renderExecutionView()}
        </div>
      </div>
    );
  };

  return (
    <>
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
        statusFilters={statusFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
        availableViewModes={['table', 'grid', 'kanban', 'timeline', 'calendar']}
      >
        {renderContent()}
      </ModuleHub>
      <InitiativeCompactPanel
        initiative={sidePanelInitiative}
        isOpen={isSidePanelOpen}
        onClose={() => {
          setIsSidePanelOpen(false);
          setSelectedInitiative(null);
        }}
        onUpdate={handlePortfolioUpdate}
        onOpenFull={(initiative) => {
          const full = initiatives.find((item) => item.id === initiative.id);
          if (full) {
            handleOpenDocument(full);
          }
        }}
      />
    </>
  );
};

export default ExecutionHub;
