/**
 * ExecutionHub
 * Unified Execution module with 3 tabs (Kanban, Timeline, Workload)
 * Uses shared ModuleHub components for consistent UX
 */

import {
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Loader2,
  Scale,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';

import { useAppStore } from '../../store/useAppStore';
import { FullInitiative, InitiativeStatus, Task, TaskStatus } from '../../types';
import { PortfolioHealthScore } from '../MyWork/Executive/PortfolioHealthScore';
import { InitiativeSidePanel } from '../Portfolio/InitiativeSidePanel';
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
import { ExecutionDetailPanel } from './ExecutionDetailPanel';
import { ExecutionTimelineView } from './ExecutionTimelineView';

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

const normalizeTaskStatus = (status: TaskStatus): 'todo' | 'in_progress' | 'review' | 'blocked' | 'done' => {
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
  const { currentProjectId, fullSessionData } = useAppStore();

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
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
        const executionInitiatives = (fullSessionData?.initiatives || []).filter((i: FullInitiative) =>
          EXECUTION_STATUSES.includes(i.status)
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
        filterOptions: EXECUTION_STATUSES.map((status) => ({
          value: status,
          label: STATUS_METADATA[status].label,
          color: STATUS_METADATA[status].dotColor,
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
        id: 'decisions',
        label: 'Decisions',
        width: '140px',
        render: (row) => {
          const relatedDecisions = decisionsByInitiative[row.id] || [];
          const overdueCount = relatedDecisions.filter(
            (decision) =>
              String(decision.status).toUpperCase() === 'PENDING' && isPastDue(decision.dueDate)
          ).length;
          if (relatedDecisions.length === 0) {
            return <span className="text-xs text-slate-500">None</span>;
          }
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-300">{relatedDecisions.length} total</span>
              {overdueCount > 0 && (
                <span className="text-rose-400">{overdueCount} overdue</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'tasks',
        label: 'Tasks',
        width: '120px',
        render: (row) => {
          const initiativeTasks = tasksByInitiative[row.id] || [];
          if (initiativeTasks.length === 0) {
            return <span className="text-xs text-slate-500">None</span>;
          }
          const doneCount = initiativeTasks.filter(
            (task) => normalizeTaskStatus(task.status) === 'done'
          ).length;
          return (
            <span className="text-xs text-slate-300">
              {doneCount}/{initiativeTasks.length}
            </span>
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
    [decisionsByInitiative, tasksByInitiative]
  );

  const statusFilters = useMemo(
    () => [
      { id: 'all', label: 'All', color: 'bg-slate-400', count: initiatives.length },
      ...EXECUTION_STATUSES.map((status) => ({
        id: status,
        label: STATUS_METADATA[status].label,
        color: STATUS_METADATA[status].dotColor,
        count: statusCounts[status] ?? 0,
      })),
    ],
    [initiatives.length, statusCounts]
  );

  const portfolioMetrics = useMemo(() => {
    const totalInitiatives = initiatives.length;
    const avgProgress = Math.round(
      initiatives.reduce((sum, i) => sum + (i.progress || 0), 0) / Math.max(totalInitiatives, 1)
    );

    const overdueDecisions =
      healthSnapshot?.decisions?.overdueCount ??
      decisions.filter(
        (decision) => String(decision.status).toUpperCase() === 'PENDING' && isPastDue(decision.dueDate)
      ).length;
    const totalDecisions =
      healthSnapshot?.decisions?.pendingCount ??
      decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING').length;
    const decisionHealth = totalDecisions
      ? Math.max(0, 100 - Math.round((overdueDecisions / totalDecisions) * 100))
      : 100;

    const completedTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === 'done').length;
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
        context: !initiative.plannedStartDate || !initiative.plannedEndDate
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
      if (action === 'view' || action === 'edit') {
        handleOpenSidePanel(row);
      }
    },
    [handleOpenSidePanel]
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
            : item.status === InitiativeStatus.EXECUTING
              ? ('approved' as const)
              : ('draft' as const),
      progress: item.progress || 0,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
    }));
  }, [filteredInitiatives]);

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

    const renderColumn = (
      label: string,
      status: keyof typeof groupedTasks,
      accent: string,
      icon: React.ReactNode
    ) => (
      <div className="flex-1 min-w-[260px] bg-navy-900/50 rounded-xl border border-navy-700">
        <div className={`flex items-center justify-between px-3 py-2 border-b border-navy-700 ${accent}`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
            {icon}
            {label}
          </div>
          <span className="text-xs text-slate-400 bg-navy-800 px-2 py-0.5 rounded-full">
            {groupedTasks[status].length}
          </span>
        </div>
        <div className="p-3 space-y-3 max-h-[520px] overflow-y-auto">
          {groupedTasks[status].map((task) => (
            <div
              key={task.id}
              className="p-3 bg-navy-800 border border-navy-700 rounded-lg hover:border-cyan-500/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-medium text-white line-clamp-2">{task.title}</h4>
                {isPastDue(task.dueDate) && (
                  <span className="text-[10px] text-rose-400 uppercase tracking-wide">Overdue</span>
                )}
              </div>
              {task.initiativeName && (
                <div className="text-xs text-slate-400 mb-2">{task.initiativeName}</div>
              )}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="capitalize">{task.priority}</span>
                {task.dueDate && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}
          {groupedTasks[status].length === 0 && (
            <div className="text-center text-xs text-slate-500 py-6">No tasks</div>
          )}
        </div>
      </div>
    );

    if (isLoadingTasks) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {renderColumn('To Do', 'todo', 'text-slate-300', <ClipboardList size={14} />)}
        {renderColumn('In Progress', 'in_progress', 'text-cyan-300', <Target size={14} />)}
        {renderColumn('Review', 'review', 'text-amber-300', <Scale size={14} />)}
        {renderColumn('Blocked', 'blocked', 'text-rose-300', <AlertTriangle size={14} />)}
        {renderColumn('Done', 'done', 'text-emerald-300', <CheckCircle2 size={14} />)}
      </div>
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

  const handleInitiativeUpdate = useCallback((updated: FullInitiative) => {
    setInitiatives((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedInitiative((prev) => (prev?.id === updated.id ? updated : prev));
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
    <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
      <PortfolioHealthScore
        score={portfolioMetrics.healthScore}
        breakdown={portfolioMetrics.breakdown}
        trend={portfolioMetrics.overdueDecisions > 0 ? 'down' : 'up'}
        loading={portfolioMetrics.isHealthLoading}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">On Track</p>
              <p className="text-2xl font-semibold text-white">{portfolioMetrics.onTrackCount}</p>
            </div>
            <CheckCircle2 className="text-emerald-400" />
          </div>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Blocked</p>
              <p className="text-2xl font-semibold text-white">{portfolioMetrics.blockedCount}</p>
            </div>
            <AlertTriangle className="text-rose-400" />
          </div>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Overdue Decisions</p>
              <p className="text-2xl font-semibold text-white">{portfolioMetrics.overdueDecisions}</p>
            </div>
            <Scale className="text-amber-400" />
          </div>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Avg Progress</p>
              <p className="text-2xl font-semibold text-white">{portfolioMetrics.avgProgress}%</p>
            </div>
            <Target className="text-cyan-400" />
          </div>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Budget Health</p>
              <p className="text-2xl font-semibold text-white">
                {portfolioMetrics.budgetHealth === null ? '—' : `${portfolioMetrics.budgetHealth}%`}
              </p>
            </div>
            <LayoutDashboard className="text-violet-400" />
          </div>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Decision SLA</p>
              <p className="text-2xl font-semibold text-white">
                {portfolioMetrics.totalDecisions === 0
                  ? '—'
                  : `${portfolioMetrics.totalDecisions - portfolioMetrics.overdueDecisions}/${portfolioMetrics.totalDecisions}`}
              </p>
            </div>
            <Clock className="text-amber-400" />
          </div>
        </div>
        <div className="bg-navy-900 border border-navy-700 rounded-xl p-4 sm:col-span-2 lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Escalations & Gates</p>
            <span className="text-xs text-slate-500">
              {portfolioMetrics.stageGate?.gateType || 'No gate info'}
            </span>
          </div>
          {portfolioMetrics.blockers.length === 0 ? (
            <p className="text-sm text-slate-400">No active escalations.</p>
          ) : (
            <div className="space-y-2">
              {portfolioMetrics.blockers.slice(0, 4).map((blocker, idx) => (
                <div
                  key={`${blocker.type}-${idx}`}
                  className="flex items-start gap-2 text-sm text-slate-300"
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
      <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">AI Priority Recommendations</h3>
        {aiInsights.priorityRecommendations.length === 0 ? (
          <p className="text-xs text-slate-400">No upcoming priorities detected.</p>
        ) : (
          <div className="space-y-2">
            {aiInsights.priorityRecommendations.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="text-xs text-slate-300">
                <span className="font-medium text-white">{item.title}</span>
                <span className="text-slate-500"> · {item.context}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">AI Timeline Conflicts</h3>
        {aiInsights.timelineConflicts.length === 0 ? (
          <p className="text-xs text-slate-400">No timeline conflicts detected.</p>
        ) : (
          <div className="space-y-2">
            {aiInsights.timelineConflicts.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="text-xs text-slate-300">
                <span className="font-medium text-white">{item.title}</span>
                <span className="text-slate-500"> · {item.context}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">AI Risk Suggestions</h3>
        {aiInsights.riskAlerts.length === 0 ? (
          <p className="text-xs text-slate-400">No active risks detected.</p>
        ) : (
          <div className="space-y-2">
            {aiInsights.riskAlerts.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="text-xs text-slate-300">
                <span className="font-medium text-white">{item.title}</span>
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
        <div className="flex items-center justify-center h-80 text-slate-500">
          <div className="text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-cyan-400/50" />
            <p className="text-lg text-white">No deadlines scheduled</p>
            <p className="text-sm text-slate-400">Tasks and decisions will appear here</p>
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
          <div key={dateKey} className="bg-navy-900 border border-navy-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-slate-300">
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
                      : 'border-navy-700 bg-navy-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      {item.type === 'task' ? (
                        <ClipboardList size={14} className="text-cyan-400" />
                      ) : (
                        <Scale size={14} className="text-amber-400" />
                      )}
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {item.initiativeName || 'Execution Center'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{item.ownerName || 'Unassigned'}</div>
                    {isPastDue(item.dueDate) && <div className="text-rose-400">Overdue</div>}
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
          emptyMessage="No initiatives in execution. Move initiatives to execution first."
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
          emptyMessage="No initiatives available."
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
          <div className="p-6">
            <ExecutionDetailPanel
              initiative={initiative}
              onBack={handleShowList}
              onUpdate={handleInitiativeUpdate}
            />
          </div>
        );
      }
    }

    return (
      <div className="p-4 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Execution Center actions for tasks, decisions, and reporting.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setViewMode('kanban');
                toast('Open Tasks view to add a new task.');
              }}
              className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-slate-300 hover:text-white hover:border-cyan-500/50 transition-colors"
            >
              New Task
            </button>
            <button
              onClick={() => {
                setViewMode('calendar');
                toast('Open Decisions to create or follow up.');
              }}
              className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-slate-300 hover:text-white hover:border-amber-500/50 transition-colors"
            >
              New Decision
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 rounded-lg bg-navy-800 border border-navy-700 text-sm text-slate-300 hover:text-white hover:border-emerald-500/50 transition-colors"
            >
              Export
            </button>
          </div>
        </div>
        {renderPortfolioHealth()}
        {renderAIInsights()}
        <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
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
      <InitiativeSidePanel
        initiative={selectedInitiative as any}
        isOpen={isSidePanelOpen}
        onClose={() => {
          setIsSidePanelOpen(false);
          setSelectedInitiative(null);
        }}
        onUpdate={handleInitiativeUpdate}
        onOpenFullDetail={(initiative) => handleOpenDocument(initiative as FullInitiative)}
      />
    </>
  );
};

export default ExecutionHub;
