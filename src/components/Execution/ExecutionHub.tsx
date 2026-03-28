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
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  GripVertical,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type CardViewStyle, CardViewSwitcher } from '@/components/shared/CardViewSwitcher';
import {
  Callout,
  EmbeddedView,
  EmptyStateInline,
  InlineTable,
  ToggleBlock,
} from '@/components/shared/NModeBlocks';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { ROUTES } from '@/routes/routeConfig';
import { Api, API_URL, getHeaders } from '@/services/api';
import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import {
  getStatusActions,
  getStatusesForModule,
  STATUS_METADATA,
} from '@/services/initiativeLifecycle';
import { useConversationStore } from '@/store/useConversationStore';

import { useAppStore } from '../../store/useAppStore';
import { FullInitiative, InitiativeStatus, PortfolioInitiative, Task } from '../../types';
import { InitiativeCompactPanel } from '../Initiatives/InitiativeCompactPanel';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import {
  InitiativePreviewV3Body,
  InitiativePreviewV3Footer,
  type InitiativePreviewV3Model,
} from '../Initiatives/InitiativePreviewV3';
import { PortfolioHealthScore } from '../MyWork/Executive/PortfolioHealthScore';
import { InitiativeGridCard } from '../Portfolio/InitiativeGridCard';
import {
  FilterableTable,
  FilterChip,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { BudgetControlPanel } from './BudgetControlPanel';
import { DelayDetectionPanel } from './DelayDetectionPanel';
import { ExecutionInitiativesKanbanView } from './ExecutionInitiativesKanbanView';
import { DelaySignalItem, ExecutionTimelineView, RiskSignalItem } from './ExecutionTimelineView';
import { ExecutionWorkloadView } from './ExecutionWorkloadView';
import { PeopleChangeWorkspace } from './PeopleChangeWorkspace';
import { RiskSignalsPanel } from './RiskSignalsPanel';

// Kanban column status mapping
type KanbanColumnId = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

type ProjectTaskStatus = Task['status'];

interface GovernedTimelineWarning {
  initiativeId: string;
  initiativeName: string;
  type: 'overdue' | 'blocked' | 'dependency_conflict' | 'sla_approaching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  daysOverdue?: number;
}

interface GovernedCapacityAlert {
  userId: string;
  name: string;
  capacityHours: number;
  allocatedHours: number;
  overloadHours: number;
  severity: 'warning' | 'critical';
  suggestion: string;
}

interface GovernedCapacityWeek {
  weekStart: string;
  capacityHours: number;
  allocatedHours: number;
  availableHours: number;
}

const fetchLegacyExecutionControl = async <T,>(
  path: string,
  params?: Record<string, string>
): Promise<T> => {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const res = await fetch(url.toString(), { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`Legacy execution control request failed for ${path}`);
  }

  return (await res.json()) as T;
};

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
          <h4 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
            {task.title}
          </h4>
        </div>
        {isPastDue(task.dueDate) && (
          <span className="text-[10px] text-rose-400 uppercase tracking-wide flex-shrink-0">
            {t('execution.badges.overdue')}
          </span>
        )}
      </div>
      {task.initiativeName && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 ml-6">
          {task.initiativeName}
        </div>
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
              isOver
                ? 'border-cyan-500/50 text-cyan-400'
                : 'border-slate-300 dark:border-navy-700 text-slate-500 dark:text-slate-400'
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

// Execution "Active" scope = ongoing work only (hide terminal-ish outcomes)
const ACTIVE_EXECUTION_STATUSES: InitiativeStatus[] = [
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
];

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
  type: 'task' | 'decision' | 'initiative';
  kind?: 'start' | 'end';
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

type ExecPeriod = 'week' | 'month' | 'quarter' | 'custom';

type ExecutiveInsightsPayload = {
  paragraph: string;
  recommendedActions: Array<{
    title: string;
    rationale: string;
    ownerHint?: string;
    urgency: 'low' | 'medium' | 'high';
  }>;
  warnings: string[];
};

type ExecutiveAggregateSnapshot = {
  project: { id: string; name: string | null };
  generatedAt: string;
  period: ExecPeriod;
  overview: {
    progressPercent: number;
    phaseLabel: string | null;
    pmoHealth: any | null;
    priorityAlerts: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
    }>;
    nextMilestones: Array<{
      id: string;
      initiativeId: string;
      initiativeName: string;
      name: string;
      targetDate: string | null;
      status: string;
    }>;
  };
  workstreams: {
    items: Array<{
      id: string;
      name: string;
      status: string;
      ownerId: string | null;
      ownerName: string | null;
      initiativeCount: number;
      progressAvg: number;
      onTrackCount: number;
      atRiskCount: number;
      delayedCount: number;
    }>;
    unassignedInitiatives: number;
  };
  kpis: {
    highlights: Array<{
      id: string;
      name: string;
      currentValue: number | null;
      targetValue: number | null;
      unit: string | null;
    }>;
    dataQuality: 'none' | 'partial' | 'good';
  };
  roi: {
    summary: {
      totalProjected: number;
      totalRealized: number;
      totalVariance: number;
      coveragePercent: number;
      initiativeCount: number;
    } | null;
    items: Array<{
      initiativeId: string;
      initiativeName: string;
      projectedBenefit: number;
      realizedBenefit: number;
      variance: number;
      confidence: string | null;
      hasRealized: boolean;
    }>;
  };
  risks: {
    heatmap: Record<string, number>;
    topRisks: Array<{
      id: string;
      title: string;
      probability: string | null;
      impact: string | null;
      score: number;
      ownerId: string | null;
      dueDate: string | null;
      mitigationStatus: string | null;
    }>;
    signals: {
      riskSignals: Array<any>;
      delaySignals: Array<any>;
      overspendSignals: Array<any>;
    };
  };
  ai: {
    enabled: boolean;
    insights: ExecutiveInsightsPayload | null;
  };
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
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const { currentProjectId, fullSessionData } = useAppStore();
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [cardViewStyle, setCardViewStyle] = useState<CardViewStyle>('d'); // D6.9
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(
    InitiativeStatus.EXECUTING
  );
  // Active/All toggle (consistent with InitiativesHub)
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [selectedInitiative, setSelectedInitiative] = useState<FullInitiative | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  // Zestawienie (Table+Preview) filters + preview selection
  const [summaryFilters, setSummaryFilters] = useState<FilterChip[]>([]);
  const [summaryPreviewInitiativeId, setSummaryPreviewInitiativeId] = useState<string | null>(null);

  // Workload heatmap controls (rendered in top bar)
  const [workloadViewMode, setWorkloadViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [workloadWeekCount, setWorkloadWeekCount] = useState(8);
  const [workloadMonthCount, setWorkloadMonthCount] = useState(6);
  const [workloadStartDate, setWorkloadStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today;
  });

  // Data state
  const [initiatives, setInitiatives] = useState<FullInitiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<ExecutionDecision[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<PMOHealthSnapshot | null>(null);
  /** V4-EXEC-01: Per-initiative health + whyRed chain from execution health API */
  const [initiativeHealthMap, setInitiativeHealthMap] = useState<
    Map<string, { health: string; whyRed?: any }>
  >(new Map());
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [riskSignals, setRiskSignals] = useState<RiskSignalItem[]>([]);
  const [delaySignals, setDelaySignals] = useState<DelaySignalItem[]>([]);
  const [overspendSignals, setOverspendSignals] = useState<
    Array<{
      id: string;
      initiativeId: string | null;
      initiativeName: string;
      signalType: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      plannedAmount: number;
      actualAmount: number;
      variancePercent: number;
      message: string;
    }>
  >([]);
  const [isLoadingControlSignals, setIsLoadingControlSignals] = useState(false);
  const [timelineWarnings, setTimelineWarnings] = useState<GovernedTimelineWarning[]>([]);
  const [timelineWarningTotal, setTimelineWarningTotal] = useState(0);
  const [capacityAlerts, setCapacityAlerts] = useState<GovernedCapacityAlert[]>([]);
  const [capacityTimeline, setCapacityTimeline] = useState<GovernedCapacityWeek[]>([]);
  const [executionTruthRefreshKey, setExecutionTruthRefreshKey] = useState(0);
  /** V4-EXEC-02: Action Queue — overdue decisions, high P×I risks, overdue tasks */
  const [actionQueueItems, setActionQueueItems] = useState<
    Array<{
      type:
        | 'decision_overdue'
        | 'risk_high'
        | 'task_overdue'
        | 'comm_overdue'
        | 'kpi_deviation_no_plan';
      id: string;
      title: string;
      dueDate?: string;
      periodStart?: string;
      initiativeId?: string;
      initiativeName?: string;
      [k: string]: any;
    }>
  >([]);
  const [isLoadingActionQueue, setIsLoadingActionQueue] = useState(false);

  // Executive aggregate snapshot (Module 7, sections 7.1–7.6)
  const [execPeriod, setExecPeriod] = useState<ExecPeriod>('week');
  const [execIncludeAI, setExecIncludeAI] = useState(true);
  const [execSnapshot, setExecSnapshot] = useState<ExecutiveAggregateSnapshot | null>(null);
  const [isLoadingExecSnapshot, setIsLoadingExecSnapshot] = useState(false);
  const [execSnapshotError, setExecSnapshotError] = useState<string | null>(null);
  const [execSnapshotSource, setExecSnapshotSource] = useState<'server' | 'local' | null>(null);
  const [workstreamsViewMode, setWorkstreamsViewMode] = useState<'list' | 'table'>('list');

  const formatNumber = useCallback(
    (v: number | null | undefined, opts?: Intl.NumberFormatOptions) => {
      if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
      try {
        return new Intl.NumberFormat(undefined, opts).format(Number(v));
      } catch {
        return String(v);
      }
    },
    []
  );

  const formatMoney = useCallback(
    (v: number | null | undefined) =>
      formatNumber(v, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
    [formatNumber]
  );

  const severityToCalloutVariant = useCallback((s: string) => {
    const sev = String(s || '').toLowerCase();
    if (sev === 'critical') return 'critical' as const;
    if (sev === 'high') return 'warning' as const;
    if (sev === 'medium') return 'warning' as const;
    return 'info' as const;
  }, []);

  const topTimelineWarning = timelineWarnings[0] ?? null;
  const topCapacityAlert = capacityAlerts[0] ?? null;
  const capacityHorizon = capacityTimeline[0] ?? null;
  const queueExecutionTruthRefresh = useCallback(() => {
    setExecutionTruthRefreshKey((prev) => prev + 1);
  }, []);

  const buildLocalExecutiveSnapshot = useCallback((): ExecutiveAggregateSnapshot => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const getIniProgress = (ini: any): number => {
      const v = Number(ini?.progress ?? ini?.progressPct ?? ini?.progress_pct ?? 0);
      return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
    };

    const progressPercent =
      initiatives.length > 0
        ? Math.round(
            initiatives.reduce((acc, i) => acc + getIniProgress(i), 0) / initiatives.length
          )
        : 0;

    const execCount = initiatives.filter(
      (i: any) => String(i.status || '').toUpperCase() === 'EXECUTING'
    ).length;
    const blockedCount = initiatives.filter(
      (i: any) => String(i.status || '').toUpperCase() === 'BLOCKED'
    ).length;

    const overdueTasks = tasks.filter((t: any) => {
      const due = t?.dueDate || t?.due_date || t?.due_date_iso || t?.due_date_at;
      if (!due) return false;
      const dueTs = new Date(String(due)).getTime();
      if (!Number.isFinite(dueTs)) return false;
      const status = String(t?.status || '').toLowerCase();
      const isDone = ['done', 'completed', 'closed', 'cancelled'].includes(status);
      return !isDone && dueTs < todayStart.getTime();
    }).length;

    const pendingDecisions = decisions.filter((d: any) => {
      const s = String(d?.status || '').toLowerCase();
      return s === 'pending' || s === 'escalated';
    }).length;

    const nextMilestones = initiatives
      .map((i: any) => {
        const target =
          i?.plannedEndDate ||
          i?.planned_end_date ||
          i?.planned_end ||
          i?.endDate ||
          i?.end_date ||
          i?.targetDate ||
          i?.target_date;
        const ts = target ? new Date(String(target)).getTime() : NaN;
        return {
          id: `derived-milestone-${String(i.id)}`,
          initiativeId: String(i.id),
          initiativeName: String(i.name || i.title || ''),
          name: t('execution.execSnapshot.overview.nextMilestones', 'Next milestones'),
          targetDate: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
          status: String(i.status || 'PENDING'),
          __sortTs: Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY,
        };
      })
      .filter((m: any) => m.targetDate)
      .sort((a: any, b: any) => (a.__sortTs ?? 0) - (b.__sortTs ?? 0))
      .slice(0, 6)
      .map((m: any) => ({
        id: m.id,
        initiativeId: m.initiativeId,
        initiativeName: m.initiativeName,
        name: 'Planned end',
        targetDate: m.targetDate,
        status: m.status,
      }));

    const priorityAlerts: ExecutiveAggregateSnapshot['overview']['priorityAlerts'] = [];
    if (blockedCount > 0) {
      priorityAlerts.push({
        type: 'blocked',
        severity: blockedCount >= 3 ? 'high' : 'medium',
        message: `${blockedCount} blocked initiatives`,
      });
    }
    if (overdueTasks > 0) {
      priorityAlerts.push({
        type: 'tasks',
        severity: overdueTasks >= 5 ? 'high' : 'medium',
        message: `${overdueTasks} overdue tasks`,
      });
    }
    if (pendingDecisions > 0) {
      priorityAlerts.push({
        type: 'decisions',
        severity: pendingDecisions >= 3 ? 'high' : 'medium',
        message: `${pendingDecisions} pending decisions`,
      });
    }

    return {
      project: { id: currentProjectId || '', name: null },
      generatedAt: new Date().toISOString(),
      period: execPeriod,
      overview: {
        progressPercent,
        phaseLabel: (healthSnapshot as any)?.phase?.name || null,
        pmoHealth: healthSnapshot,
        priorityAlerts: priorityAlerts.slice(0, 6),
        nextMilestones,
      },
      workstreams: {
        items: [],
        unassignedInitiatives: initiatives.filter((i: any) => !i.workstreamId && !i.workstream_id)
          .length,
      },
      kpis: {
        highlights: [
          {
            id: 'derived_initiatives_executing',
            name: 'Initiatives executing',
            currentValue: execCount,
            targetValue: null,
            unit: null,
          },
          {
            id: 'derived_initiatives_blocked',
            name: 'Initiatives blocked',
            currentValue: blockedCount,
            targetValue: null,
            unit: null,
          },
          {
            id: 'derived_tasks_overdue',
            name: 'Overdue tasks',
            currentValue: overdueTasks,
            targetValue: null,
            unit: null,
          },
          {
            id: 'derived_decisions_pending',
            name: 'Pending decisions',
            currentValue: pendingDecisions,
            targetValue: null,
            unit: null,
          },
        ],
        dataQuality: 'partial',
      },
      roi: { summary: null, items: [] },
      risks: {
        heatmap: {},
        topRisks: [],
        signals: { riskSignals, delaySignals, overspendSignals },
      },
      ai: { enabled: false, insights: null },
    };
  }, [
    currentProjectId,
    decisions,
    delaySignals,
    execPeriod,
    healthSnapshot,
    initiatives,
    overspendSignals,
    riskSignals,
    t,
    tasks,
  ]);

  const formatHeatmapKey = useCallback((k: string) => {
    const [p, i] = String(k || '').split(':');
    const pp = p ? p.toUpperCase() : '—';
    const ii = i ? i.toUpperCase() : '—';
    return `${pp} × ${ii}`;
  }, []);

  // Keep view mode consistent per tab (simple, iPhone-like)
  useEffect(() => {
    if (activeTab === 'reports') {
      // View modes order must follow the v3 canonical order (docs/ui-standards/.../view-modes-standard.md)
      const allowed: ViewMode[] = ['table', 'kanban', 'timeline', 'calendar', 'grid'];
      if (!allowed.includes(viewMode)) setViewMode('table');
      return;
    }
    // list / management (and any other tabs)
    if (viewMode !== 'table') setViewMode('table');
  }, [activeTab, viewMode]);

  useEffect(() => {
    trackFunnelEvent('execution_hub_opened', {
      tab: activeTab,
      viewMode,
      projectId: currentProjectId || null,
    });
    // Fire once per hub open (not on every tab/view interaction).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, [currentProjectId, executionTruthRefreshKey, fullSessionData?.initiatives]);

  useEffect(() => {
    const loadRiskSignals = async () => {
      try {
        const data = await V8ExecutionControlApi.getRiskSignals(
          currentProjectId || undefined
        ).catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return (async () => {
            const token = localStorage.getItem('token');
            if (!token) return { signals: [] };
            const params = new URLSearchParams();
            if (currentProjectId) params.set('projectId', currentProjectId);
            const res = await fetch(`/api/execution-control/risk-signals?${params}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return { signals: [] };
            return res.json();
          })();
        });
        setRiskSignals(data.signals || []);
      } catch {
        // risk signals are non-blocking
        setRiskSignals([]);
      }
    };
    const loadDelaySignals = async () => {
      try {
        const data = await V8ExecutionControlApi.getDelaySignals(
          currentProjectId ? { projectId: currentProjectId } : undefined
        ).catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return (async () => {
            const token = localStorage.getItem('token');
            if (!token) return { signals: [] };
            const params = new URLSearchParams();
            if (currentProjectId) params.set('projectId', currentProjectId);
            const res = await fetch(`/api/execution-control/delay-signals?${params}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return { signals: [] };
            return res.json();
          })();
        });
        setDelaySignals(data.signals || []);
      } catch {
        // delay signals are non-blocking
        setDelaySignals([]);
      }
    };
    const loadOverspendSignals = async () => {
      try {
        const data = await V8ExecutionControlApi.getOverspendSignals(
          currentProjectId || undefined
        ).catch((error) => {
          if (!shouldFallbackToLegacyExecutionControl(error)) {
            throw error;
          }
          return fetchLegacyExecutionControl<{ signals: typeof overspendSignals }>(
            '/api/execution-control/budget/overspend-signals',
            currentProjectId ? { projectId: currentProjectId } : undefined
          );
        });
        setOverspendSignals(data.signals || []);
      } catch {
        setOverspendSignals([]);
      }
    };
    setIsLoadingControlSignals(true);
    void Promise.allSettled([loadRiskSignals(), loadDelaySignals(), loadOverspendSignals()]).finally(
      () => setIsLoadingControlSignals(false)
    );
  }, [currentProjectId, executionTruthRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    const loadGovernedControlTower = async () => {
      try {
        const [warningsData, alertsData, timelineData] = await Promise.all([
          V8ExecutionControlApi.getTimelineWarnings(currentProjectId || undefined).catch(
            (error) => {
              if (!shouldFallbackToLegacyExecutionControl(error)) {
                throw error;
              }
              return fetchLegacyExecutionControl<{
                warnings: GovernedTimelineWarning[];
                total: number;
              }>(
                '/api/execution-control/warnings',
                currentProjectId ? { projectId: currentProjectId } : undefined
              );
            }
          ),
          V8ExecutionControlApi.getCapacityLevelingAlerts().catch((error) => {
            if (!shouldFallbackToLegacyExecutionControl(error)) {
              throw error;
            }
            return fetchLegacyExecutionControl<{ alerts: GovernedCapacityAlert[] }>(
              '/api/execution-control/capacity/leveling-alerts'
            );
          }),
          V8ExecutionControlApi.getCapacityTimeline().catch((error) => {
            if (!shouldFallbackToLegacyExecutionControl(error)) {
              throw error;
            }
            return fetchLegacyExecutionControl<{ weeks: GovernedCapacityWeek[] }>(
              '/api/execution-control/capacity/timeline'
            );
          }),
        ]);

        if (cancelled) return;

        setTimelineWarnings(warningsData.warnings || []);
        setTimelineWarningTotal(
          Number(
            warningsData.total ??
              (Array.isArray(warningsData.warnings) ? warningsData.warnings.length : 0)
          )
        );
        setCapacityAlerts(alertsData.alerts || []);
        setCapacityTimeline(timelineData.weeks || []);
      } catch {
        if (cancelled) return;
        setTimelineWarnings([]);
        setTimelineWarningTotal(0);
        setCapacityAlerts([]);
        setCapacityTimeline([]);
      }
    };

    loadGovernedControlTower();

    return () => {
      cancelled = true;
    };
  }, [currentProjectId, executionTruthRefreshKey]);

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
  }, [currentProjectId, executionTruthRefreshKey]);

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
  }, [currentProjectId, executionTruthRefreshKey]);

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
  }, [currentProjectId, executionTruthRefreshKey]);

  // V4-EXEC-01: Fetch execution health for per-initiative whyRed chain
  useEffect(() => {
    if (!currentProjectId) return;
    const loadExecutionHealth = async () => {
      try {
        const data = await Api.get(`/execution/${currentProjectId}/health`);
        const items = (data as any)?.initiativeHealth as Array<{
          id: string;
          health: string;
          whyRed?: any;
        }>;
        if (Array.isArray(items)) {
          const map = new Map<string, { health: string; whyRed?: any }>();
          items.forEach((item) => map.set(item.id, { health: item.health, whyRed: item.whyRed }));
          setInitiativeHealthMap(map);
        } else {
          setInitiativeHealthMap(new Map());
        }
      } catch {
        setInitiativeHealthMap(new Map());
      }
    };
    loadExecutionHealth();
  }, [currentProjectId, executionTruthRefreshKey]);

  // V4-EXEC-02: Fetch Action Queue — overdue decisions, high risks, overdue tasks
  useEffect(() => {
    if (!currentProjectId) return;
    setIsLoadingActionQueue(true);
    Api.get(`/execution/${currentProjectId}/action-queue`)
      .then((data: any) => {
        const items = (data?.items as any[]) || [];
        setActionQueueItems(items);
      })
      .catch(() => setActionQueueItems([]))
      .finally(() => setIsLoadingActionQueue(false));
  }, [currentProjectId]);

  const loadExecutiveSnapshot = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (!currentProjectId) return;
      setIsLoadingExecSnapshot(true);
      setExecSnapshotError(null);
      try {
        const params = new URLSearchParams();
        params.set('projectId', currentProjectId);
        params.set('period', execPeriod);
        params.set('includeAI', execIncludeAI ? 'true' : 'false');
        if (opts?.refresh) params.set('refresh', 'true');
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 9000);
        const fullUrl = `${API_URL}/executive/aggregate?${params.toString()}`;
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers: getHeaders(),
          signal: controller.signal,
        });
        window.clearTimeout(timeout);

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = (json as any)?.error || (json as any)?.message || `HTTP ${res.status}`;
          throw new Error(String(msg));
        }

        const data = (json as any)?.data || json;
        setExecSnapshot(data as ExecutiveAggregateSnapshot);
        setExecSnapshotSource('server');
        trackFunnelEvent('execution_exec_snapshot_loaded', {
          projectId: currentProjectId,
          period: execPeriod,
          includeAI: execIncludeAI,
          refreshed: Boolean(opts?.refresh),
        });
      } catch (e: any) {
        // Fallback: always show something using locally loaded data.
        try {
          setExecSnapshot(buildLocalExecutiveSnapshot());
          setExecSnapshotSource('local');
          setExecSnapshotError(null);
        } catch {
          setExecSnapshot(null);
          setExecSnapshotSource(null);
          setExecSnapshotError(
            e?.message ||
              t('execution.execSnapshot.loadFailed', 'Failed to load executive snapshot')
          );
        }
      } finally {
        setIsLoadingExecSnapshot(false);
      }
    },
    [API_URL, buildLocalExecutiveSnapshot, currentProjectId, execIncludeAI, execPeriod, t]
  );

  const execTopline = useMemo(() => {
    const kpis = execSnapshot?.kpis?.highlights || [];
    const byId = new Map<string, number>();
    for (const k of kpis as any[]) {
      if (!k?.id) continue;
      const v = Number(k.currentValue);
      if (Number.isFinite(v)) byId.set(String(k.id), v);
    }

    const executing =
      byId.get('derived_initiatives_executing') ??
      initiatives.filter((i: any) => String(i.status || '').toUpperCase() === 'EXECUTING').length;
    const blocked =
      byId.get('derived_initiatives_blocked') ??
      initiatives.filter((i: any) => String(i.status || '').toUpperCase() === 'BLOCKED').length;
    const pendingDecisions =
      byId.get('derived_decisions_pending') ??
      decisions.filter((d: any) => {
        const s = String(d?.status || '').toLowerCase();
        return s === 'pending' || s === 'escalated';
      }).length;
    const overdueTasks =
      byId.get('derived_tasks_overdue') ??
      tasks.filter((t: any) => {
        const due = t?.dueDate || t?.due_date || t?.due_date_iso || t?.due_date_at;
        if (!due) return false;
        const dueTs = new Date(String(due)).getTime();
        if (!Number.isFinite(dueTs)) return false;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const status = String(t?.status || '').toLowerCase();
        const isDone = ['done', 'completed', 'closed', 'cancelled'].includes(status);
        return !isDone && dueTs < todayStart.getTime();
      }).length;

    return { executing, blocked, pendingDecisions, overdueTasks };
  }, [decisions, execSnapshot?.kpis?.highlights, initiatives, tasks]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (activeTab !== 'list') return;
    loadExecutiveSnapshot();
  }, [activeTab, currentProjectId, execIncludeAI, execPeriod, loadExecutiveSnapshot]);

  // Keep UI toggle consistent with server-enforced includeAI (RBAC / org policy).
  useEffect(() => {
    if (!execSnapshot) return;
    if (execSnapshot.ai?.enabled === execIncludeAI) return;
    setExecIncludeAI(Boolean(execSnapshot.ai?.enabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execSnapshot?.ai?.enabled]);

  const execControls = useMemo(() => {
    if (activeTab !== 'list') return null;
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100/60 dark:bg-navy-800/60">
          {(['week', 'month', 'quarter'] as ExecPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setExecPeriod(p)}
              className={`h-7 px-2 rounded-md text-[11px] font-medium transition-colors ${
                execPeriod === p
                  ? 'bg-white dark:bg-navy-700 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title={t('execution.execSnapshot.period', 'Period')}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setExecIncludeAI((v) => {
              const next = !v;
              trackFunnelEvent('execution_exec_snapshot_ai_toggled', {
                projectId: currentProjectId,
                enabled: next,
              });
              return next;
            });
          }}
          className={`h-7 px-2 rounded-lg text-[11px] font-medium transition-colors inline-flex items-center gap-1 ${
            execIncludeAI
              ? 'text-purple-500 bg-purple-500/10'
              : 'text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-navy-800/50 hover:bg-slate-100/70 dark:hover:bg-navy-800/70'
          }`}
          title={t('execution.execSnapshot.ai.toggle', 'Toggle AI')}
        >
          <Sparkles size={12} />
          {t('execution.execSnapshot.ai.label', 'AI')}
        </button>

        <button
          type="button"
          onClick={() => {
            trackFunnelEvent('execution_exec_snapshot_refreshed', { projectId: currentProjectId });
            return loadExecutiveSnapshot({ refresh: true });
          }}
          disabled={isLoadingExecSnapshot}
          className="h-7 px-2 rounded-lg text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/50 dark:bg-navy-800/50 hover:bg-slate-100/70 dark:hover:bg-navy-800/70 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
          title={t('execution.execSnapshot.refresh', 'Refresh')}
        >
          <RefreshCw size={12} className={isLoadingExecSnapshot ? 'animate-spin' : ''} />
          {t('execution.execSnapshot.refresh', 'Refresh')}
        </button>
      </div>
    );
  }, [activeTab, execIncludeAI, execPeriod, isLoadingExecSnapshot, loadExecutiveSnapshot, t]);

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

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    let result = initiatives;

    // Scope filter (when user hasn't explicitly chosen a status)
    if (!activeStatusFilter && scope === 'active') {
      result = result.filter((i) => ACTIVE_EXECUTION_STATUSES.includes(i.status));
    }

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
      if (filter.column === 'attention') {
        if (filter.value === 'blocked') {
          result = result.filter((i) => i.status === InitiativeStatus.BLOCKED);
        }
        if (filter.value === 'missing_dates') {
          result = result.filter((i) => !i.plannedStartDate || !i.plannedEndDate);
        }
        if (filter.value === 'overdue') {
          result = result.filter((i) => {
            if (!i.plannedEndDate && !i.slaDeadline) return false;
            const deadline = i.slaDeadline || i.plannedEndDate!;
            const isOverdue = new Date(deadline) < new Date();
            const terminal =
              i.status === InitiativeStatus.DONE || i.status === InitiativeStatus.ARCHIVED;
            return isOverdue && !terminal;
          });
        }
        if (filter.value === 'overdue_decisions') {
          result = result.filter((i) => {
            const arr = decisionsByInitiative[i.id] || [];
            return arr.some(
              (d) => String(d.status).toUpperCase() === 'PENDING' && isPastDue(d.dueDate)
            );
          });
        }
        if (filter.value === 'due_soon_tasks') {
          const now = Date.now();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          result = result.filter((i) => {
            const arr = tasksByInitiative[i.id] || [];
            return arr.some((t) => {
              if (!t.dueDate) return false;
              const due = new Date(t.dueDate).getTime();
              return (
                due >= now && due <= now + sevenDays && normalizeTaskStatus(t.status) !== 'done'
              );
            });
          });
        }
      }
    });

    if (activeStatusFilter) {
      result = result.filter((i) => i.status === activeStatusFilter);
    }

    return result;
  }, [
    initiatives,
    searchQuery,
    activeFilters,
    activeStatusFilter,
    scope,
    tasksByInitiative,
    decisionsByInitiative,
  ]);

  const summaryInitiatives = useMemo(() => {
    let result = initiatives;

    // Scope (Active = scheduled/executing/blocked; All = everything loaded for this hub)
    if (scope === 'active') {
      result = result.filter((i) => ACTIVE_EXECUTION_STATUSES.includes(i.status));
    }

    // Status dropdown selection (default: EXECUTING to satisfy "w realizacji")
    if (activeStatusFilter) {
      result = result.filter((i) => i.status === activeStatusFilter);
    }

    // Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (i) =>
          String(i.name || '')
            .toLowerCase()
            .includes(q) ||
          String(i.summary || i.description || '')
            .toLowerCase()
            .includes(q)
      );
    }

    return result;
  }, [initiatives, scope, activeStatusFilter, searchQuery]);

  const mapToPreviewModel = useCallback((i: FullInitiative): InitiativePreviewV3Model => {
    return {
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
    };
  }, []);

  const openAiChatForInitiative = useCallback(
    async (initiative: FullInitiative, promptText: string) => {
      try {
        const convId = await openChatWithContext({
          entityType: 'initiative',
          entityId: initiative.id,
          entityName: initiative.name,
          contextData: initiative as unknown as Record<string, unknown>,
          pmoContext: { initiativeIds: [initiative.id] },
        });
        await addChatMessage({ conversationId: convId, role: 'user', content: promptText } as any);
        toast.success(t('initiatives.toast.chatOpened', 'Chat opened'), { duration: 1500 });
        if (isChatCollapsed) toggleChatCollapse();
      } catch {
        toast.error(t('initiatives.toast.chatOpenError', 'Failed to open chat'));
      }
    },
    [addChatMessage, isChatCollapsed, openChatWithContext, t, toggleChatCollapse]
  );

  const copyExecutionLink = useCallback(
    async (id: string) => {
      try {
        const url = `${window.location.origin}${ROUTES.IMPLEMENTATION}?open=${encodeURIComponent(id)}&mode=doc`;
        await navigator.clipboard.writeText(url);
        toast.success(t('common.copied', 'Copied'));
      } catch {
        toast.error(t('common.copyFailed', 'Copy failed'));
      }
    },
    [t]
  );

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('execution.tabs.execution', 'Summary'),
        icon: <LayoutDashboard size={16} />,
        count:
          (stats.blocked ?? 0) +
          decisions.filter(
            (d) => String(d.status).toUpperCase() === 'PENDING' && isPastDue(d.dueDate)
          ).length,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('execution.tabs.reports', 'Reporting'),
        icon: <FileText size={16} />,
        count: filteredInitiatives.length,
      },
      {
        id: 'people_change' as ModuleTab,
        label: t('execution.tabs.peopleChange', 'Management'),
        icon: <Heart size={16} />,
        count: stats.blocked ?? 0,
      },
    ],
    [t, filteredInitiatives.length, stats.blocked, tasks.length, decisions]
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
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                {code}
              </span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('execution.table.name'),
        render: (row) => (
          <span
            className="text-sm text-slate-900 dark:text-white font-medium truncate block max-w-[420px]"
            title={String(row.name || '')}
          >
            {row.name}
          </span>
        ),
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
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${meta?.bgColor || ''} ${meta?.color || ''}`}
              >
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${meta?.dotColor || 'bg-slate-400'}`}
                />
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
          if (!owner)
            return (
              <span className="text-slate-500 text-sm">{t('execution.table.unassigned')}</span>
            );
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
              <span className="text-xs text-slate-500 dark:text-slate-400 w-8 text-right">
                {progress}%
              </span>
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
            return (
              <span className="text-xs text-slate-500">{t('execution.table.noDeadline')}</span>
            );
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
                {Math.abs(diffDays)}
                {t('execution.time.daysOverdue')}
              </span>
            );
          }

          if (diffDays <= 7) {
            return (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Clock size={12} />
                {diffDays}
                {t('execution.time.daysLeft')}
              </span>
            );
          }

          if (diffDays <= 30) {
            return (
              <span className="text-xs text-slate-700 dark:text-slate-300">
                {diffDays}
                {t('execution.time.daysLeft')}
              </span>
            );
          }

          const weeks = Math.ceil(diffDays / 7);
          return (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {weeks}
              {t('execution.time.weeksLeft')}
            </span>
          );
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
            <span
              className={`text-sm ${isOverdue ? 'text-red-400' : 'text-slate-700 dark:text-slate-300'}`}
            >
              {new Date(deadline).toLocaleDateString()}
            </span>
          );
        },
      },
    ],
    [t, decisionsByInitiative, tasksByInitiative]
  );

  // Status counts for the StatusDropdown (top bar control)
  const statusDropdownCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = { all: initiatives.length };
    EXECUTION_STATUSES.forEach((s) => {
      counts[s] = statusCounts[s] ?? 0;
    });
    return counts;
  }, [initiatives.length, statusCounts]);

  const scopeToggle = (
    <div
      className="
        flex items-center gap-1 p-0.5 rounded-full h-9
        bg-slate-100 dark:bg-navy-800
        border border-slate-200/60 dark:border-navy-700/60
      "
      role="radiogroup"
      aria-label={t('execution.scope.aria', 'Scope')}
    >
      {(
        [
          { id: 'active' as const, label: t('execution.scope.active', 'Active') },
          { id: 'all' as const, label: t('execution.scope.all', 'All') },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={scope === opt.id}
          onClick={() => {
            setScope(opt.id);
            if (opt.id === 'active') setActiveStatusFilter(null);
          }}
          className={`h-8 px-3 rounded-full text-[11px] font-semibold transition-colors ${
            scope === opt.id
              ? 'bg-white/80 dark:bg-navy-900/70 text-slate-700 dark:text-slate-200 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
          title={
            opt.id === 'active'
              ? t('execution.scope.activeHint', 'Scheduled → Executing → Blocked')
              : t('execution.scope.allHint', 'Include Done / Cancelled / Archived')
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const rightControls = useMemo(() => {
    const showScope = activeTab === 'list' || activeTab === 'reports';
    const showHeatmapShortcut = false;
    const showHeatmapControls = activeTab === ('people_change' as ModuleTab);
    const execChip =
      currentProjectId && activeTab !== 'list' ? (
        <button
          type="button"
          onClick={() => setActiveTab('list' as ModuleTab)}
          className="h-9 px-3 rounded-lg flex items-center gap-2 border border-slate-200/60 dark:border-navy-700/60 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-navy-900/50 transition-colors"
          title={t('execution.execSnapshot.title', 'Executive snapshot')}
        >
          <span className="text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
            exec v2{execSnapshotSource ? ` · ${execSnapshotSource}` : ''}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-emerald-500">
            {execTopline.executing}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-rose-500">
            {execTopline.blocked}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-amber-500">
            {execTopline.pendingDecisions}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-violet-500">
            {execTopline.overdueTasks}
          </span>
        </button>
      ) : null;

    if (!showScope && !showHeatmapShortcut && !showHeatmapControls) {
      return <div className="flex items-center gap-2">{execChip}</div>;
    }

    const navigateWorkload = (direction: 'prev' | 'next') => {
      setWorkloadStartDate((prev) => {
        const next = new Date(prev);
        if (workloadViewMode === 'weekly') {
          next.setDate(next.getDate() + (direction === 'next' ? 7 : -7));
        } else {
          next.setMonth(next.getMonth() + (direction === 'next' ? 1 : -1));
        }
        return next;
      });
    };

    const heatmapShortcut = (
      <button
        type="button"
        onClick={() =>
          setActiveTab(activeTab === 'team' ? ('initiatives' as ModuleTab) : ('team' as ModuleTab))
        }
        className={`h-9 w-9 rounded-lg flex items-center justify-center border transition-colors ${
          activeTab === 'team'
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
        }`}
        title={t('execution.heatmap', 'Workload Heatmap')}
      >
        <Users size={16} />
      </button>
    );

    const heatmapControls = showHeatmapControls ? (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60">
          <button
            type="button"
            onClick={() => navigateWorkload('prev')}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-navy-900/50 transition-colors"
            title={t('common.prev', 'Previous')}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigateWorkload('next')}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-navy-900/50 transition-colors"
            title={t('common.next', 'Next')}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60">
          <button
            type="button"
            onClick={() => setWorkloadViewMode('weekly')}
            className={`h-7 px-2 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
              workloadViewMode === 'weekly'
                ? 'bg-white/80 dark:bg-navy-900/70 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title="Weekly"
          >
            <LayoutGrid size={14} />W
          </button>
          <button
            type="button"
            onClick={() => setWorkloadViewMode('monthly')}
            className={`h-7 px-2 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 ${
              workloadViewMode === 'monthly'
                ? 'bg-white/80 dark:bg-navy-900/70 text-slate-700 dark:text-slate-200 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title="Monthly"
          >
            <CalendarDays size={14} />M
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200/60 dark:border-navy-700/60">
          {(workloadViewMode === 'weekly' ? [6, 8, 12] : [3, 6, 12]).map((n) => (
            <button
              key={`${workloadViewMode}-${n}`}
              type="button"
              onClick={() => {
                if (workloadViewMode === 'weekly') setWorkloadWeekCount(n);
                else setWorkloadMonthCount(n);
              }}
              className={`h-7 px-2 rounded-md text-[11px] font-semibold transition-colors ${
                (workloadViewMode === 'weekly' ? workloadWeekCount === n : workloadMonthCount === n)
                  ? 'bg-white/80 dark:bg-navy-900/70 text-slate-700 dark:text-slate-200 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-navy-900/50'
              }`}
              title={workloadViewMode === 'weekly' ? `${n} weeks` : `${n} months`}
            >
              {n}
              {workloadViewMode === 'weekly' ? 'W' : 'M'}
            </button>
          ))}
        </div>
      </div>
    ) : null;

    return (
      <div className="flex items-center gap-2">
        {execChip}
        {showScope ? scopeToggle : null}
        {showHeatmapShortcut ? heatmapShortcut : null}
        {heatmapControls}
      </div>
    );
  }, [
    activeTab,
    currentProjectId,
    execSnapshotSource,
    execTopline,
    scopeToggle,
    t,
    workloadMonthCount,
    workloadViewMode,
    workloadWeekCount,
  ]);

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

    const criticalCapacityAlerts = capacityAlerts.filter((alert) => alert.severity === 'critical').length;
    const warningCapacityAlerts = capacityAlerts.filter((alert) => alert.severity !== 'critical').length;
    const capacityHealth =
      capacityAlerts.length === 0
        ? 100
        : Math.max(0, 100 - criticalCapacityAlerts * 30 - warningCapacityAlerts * 15);

    const blockedCount = healthSnapshot?.initiatives?.blockedCount ?? stats.blocked;
    const riskHealth = totalInitiatives
      ? Math.max(0, 100 - Math.round((blockedCount / totalInitiatives) * 100))
      : 100;

    const healthScore = Math.round((avgProgress + decisionHealth + capacityHealth + riskHealth) / 4);

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
        capacity: capacityHealth,
        risk: riskHealth,
      },
      blockers: healthSnapshot?.blockers || [],
      stageGate: healthSnapshot?.stageGate || null,
      isHealthLoading: isLoadingHealth,
    };
  }, [initiatives, decisions, tasks, stats, healthSnapshot, isLoadingHealth, capacityAlerts]);

  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = [];
    const initiativeIds = new Set(filteredInitiatives.map((i) => i.id));

    tasks.forEach((task) => {
      if (!task.dueDate) return;
      if (task.initiativeId && !initiativeIds.has(task.initiativeId)) return;
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
      const relatedId = (decision as any).relatedObjectId;
      if (relatedId && !initiativeIds.has(relatedId)) return;
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

    filteredInitiatives.forEach((initiative) => {
      if (initiative.plannedStartDate) {
        items.push({
          id: `initiative-start-${initiative.id}`,
          type: 'initiative',
          kind: 'start',
          title: initiative.name,
          dueDate: initiative.plannedStartDate,
          status: String(initiative.status),
          initiativeName: initiative.name,
        });
      }
      if (initiative.plannedEndDate || (initiative as any).slaDeadline) {
        const end = (initiative as any).slaDeadline || initiative.plannedEndDate;
        if (end) {
          items.push({
            id: `initiative-end-${initiative.id}`,
            type: 'initiative',
            kind: 'end',
            title: initiative.name,
            dueDate: end,
            status: String(initiative.status),
            initiativeName: initiative.name,
          });
        }
      }
    });

    return items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks, decisions, filteredInitiatives]);

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
    if (activeTab === 'list') {
      setSummaryFilters((prev) => prev.filter((f) => f.id !== id));
      return;
    }
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    if (activeTab === 'list') {
      setSummaryFilters([]);
      return;
    }
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

  const portfolioInitiatives = useMemo(
    () => filteredInitiatives.map((i) => toPortfolioInitiative(i)),
    [filteredInitiatives]
  );

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
        {
          id: 'todo',
          label: t('execution.kanban.toDo'),
          accent: 'text-slate-300',
          icon: <ClipboardList size={14} />,
        },
        {
          id: 'in_progress',
          label: t('execution.kanban.inProgress'),
          accent: 'text-cyan-300',
          icon: <Target size={14} />,
        },
        {
          id: 'review',
          label: t('execution.kanban.review'),
          accent: 'text-amber-300',
          icon: <Scale size={14} />,
        },
        {
          id: 'blocked',
          label: t('execution.kanban.blocked'),
          accent: 'text-rose-300',
          icon: <AlertTriangle size={14} />,
        },
        {
          id: 'done',
          label: t('execution.kanban.done'),
          accent: 'text-emerald-300',
          icon: <CheckCircle2 size={14} />,
        },
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
      const previous = initiatives.find((i) => i.id === initiativeId);
      try {
        // Backend exposes a dedicated status transition endpoint (with validation + governance rules).
        await Api.patch(`/initiatives/${initiativeId}/status`, { status: newStatus });
        setInitiatives((prev) =>
          prev.map((i) =>
            i.id === initiativeId ? { ...i, status: newStatus as InitiativeStatus } : i
          )
        );
        trackFunnelEvent('execution_status_updated', {
          initiativeId,
          from: previous?.status || null,
          to: newStatus,
          tab: activeTab,
          viewMode,
        });
        toast.success(t('execution.toast.statusUpdated', 'Status updated'));
      } catch (e: any) {
        toast.error(
          e?.message || t('execution.toast.statusUpdateFailed', 'Failed to update status')
        );
      }
    },
    [activeTab, initiatives, t, viewMode]
  );

  const handleViewModeChange = useCallback(
    (nextViewMode: ViewMode) => {
      setViewMode(nextViewMode);
      if (nextViewMode === 'timeline') {
        trackFunnelEvent('execution_timeline_viewed', {
          tab: activeTab,
          projectId: currentProjectId || null,
        });
      }
    },
    [activeTab, currentProjectId]
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
    queueExecutionTruthRefresh();
  }, [queueExecutionTruthRefresh]);

  const handleTimelineUpdate = useCallback(
    async (initiativeId: string, field: string, value: string, reason?: string) => {
      try {
        const payload = { initiativeId, field, value, reason } as const;
        const fallbackRequest = () =>
          fetch('/api/execution-control/timeline-update', {
            method: 'POST',
            headers: { ...getHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        const response = await V8ExecutionControlApi.updateTimeline({
          initiativeId,
          field: field as
            | 'status'
            | 'planned_start_date'
            | 'planned_end_date'
            | 'start_date'
            | 'actual_end_date'
            | 'progress',
          value,
          reason,
        })
          .then((data) => ({ ok: true, json: async () => data }))
          .catch((error) => {
            if (!shouldFallbackToLegacyExecutionControl(error)) {
              throw error;
            }
            return fallbackRequest();
          });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg =
            (json as any)?.error ||
            (json as any)?.message ||
            `HTTP ${(response as Response).status}`;
          throw new Error(String(msg));
        }

        // Keep UI state consistent with persisted changes.
        setInitiatives((prev) =>
          prev.map((i) => {
            if (i.id !== initiativeId) return i;
            const next: any = { ...i };
            switch (field) {
              case 'planned_start_date':
                next.plannedStartDate = value;
                break;
              case 'planned_end_date':
                next.plannedEndDate = value;
                break;
              case 'start_date':
                next.startDate = value;
                break;
              case 'actual_end_date':
                next.actualEndDate = value;
                break;
              case 'status':
                next.status = value;
                break;
              case 'progress':
                next.progress = Number(value);
                break;
            }
            return next as FullInitiative;
          })
        );
        setSelectedInitiative((prev) => {
          if (!prev || prev.id !== initiativeId) return prev;
          const next: any = { ...prev };
          switch (field) {
            case 'planned_start_date':
              next.plannedStartDate = value;
              break;
            case 'planned_end_date':
              next.plannedEndDate = value;
              break;
            case 'start_date':
              next.startDate = value;
              break;
            case 'actual_end_date':
              next.actualEndDate = value;
              break;
            case 'status':
              next.status = value;
              break;
            case 'progress':
              next.progress = Number(value);
              break;
          }
          return next as FullInitiative;
        });
        queueExecutionTruthRefresh();
      } catch (e: any) {
        toast.error(
          e?.message || t('execution.toast.timelineUpdateFailed', 'Failed to update timeline')
        );
      }
    },
    [queueExecutionTruthRefresh, t]
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    queueExecutionTruthRefresh();
    if (activeTab === 'list' && currentProjectId) {
      void loadExecutiveSnapshot({ refresh: true });
    }
  }, [activeTab, currentProjectId, loadExecutiveSnapshot, queueExecutionTruthRefresh]);

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
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.portfolio.onTrack')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {portfolioMetrics.onTrackCount}
              </p>
            </div>
            <CheckCircle2 className="text-emerald-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.portfolio.blocked')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {portfolioMetrics.blockedCount}
              </p>
            </div>
            <AlertTriangle className="text-rose-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.portfolio.overdueDecisions')}
              </p>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.portfolio.avgProgress')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {portfolioMetrics.avgProgress}%
              </p>
            </div>
            <Target className="text-cyan-400" />
          </div>
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.portfolio.budgetHealth')}
              </p>
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
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.portfolio.decisionSla')}
              </p>
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
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {t('execution.portfolio.escalationsGates')}
            </p>
            <span className="text-xs text-slate-500">
              {portfolioMetrics.stageGate?.gateType ||
                t('execution.portfolio.noGateInfo', 'No gate info')}
            </span>
          </div>
          {portfolioMetrics.blockers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('execution.portfolio.noActiveEscalations')}
            </p>
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

  const renderAIInsights = () =>
    execSnapshot ? (
      <div className="space-y-3">
        {!execIncludeAI || !execSnapshot.ai.enabled ? (
          <Callout
            variant="info"
            title={t('execution.execSnapshot.ai.title', 'AI consultant insights')}
          >
            {t(
              'execution.execSnapshot.ai.disabled',
              'AI insights are disabled for this view (or your role).'
            )}
          </Callout>
        ) : execSnapshot.ai.insights ? (
          <>
            <Callout
              variant="purple"
              title={t('execution.execSnapshot.ai.title', 'AI consultant insights')}
            >
              {execSnapshot.ai.insights.paragraph}
            </Callout>
            {execSnapshot.ai.insights.warnings?.length ? (
              <Callout
                variant="warning"
                title={t('execution.execSnapshot.ai.warnings', 'Warnings')}
                compact
              >
                <ul className="list-disc pl-4 space-y-1">
                  {execSnapshot.ai.insights.warnings.slice(0, 6).map((w, idx) => (
                    <li key={`${idx}-${w}`}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
            <InlineTable
              caption={t('execution.execSnapshot.ai.recommendedActions', 'Recommended actions')}
              columns={[
                {
                  key: 'urgency',
                  header: t('execution.execSnapshot.ai.urgency', 'Urgency'),
                  width: 'w-28',
                  render: (row: any) => {
                    const u = String(row.urgency || 'low');
                    const cls =
                      u === 'high'
                        ? 'text-rose-400'
                        : u === 'medium'
                          ? 'text-amber-400'
                          : 'text-slate-400';
                    return (
                      <span className={`text-xs font-medium uppercase tracking-wide ${cls}`}>
                        {u}
                      </span>
                    );
                  },
                },
                {
                  key: 'title',
                  header: t('execution.execSnapshot.ai.action', 'Action'),
                  render: (row: any) => (
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {row.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {row.rationale}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'ownerHint',
                  header: t('execution.execSnapshot.ai.owner', 'Owner'),
                  width: 'w-40',
                  render: (row: any) => (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {row.ownerHint || '—'}
                    </span>
                  ),
                },
              ]}
              data={(execSnapshot.ai.insights.recommendedActions || []).slice(0, 5) as any[]}
              rowKey={(row: any, idx: number) => `${row.title || 'a'}-${idx}`}
              emptyMessage={t('execution.execSnapshot.ai.noActions', 'No actions suggested.')}
              compact
            />
          </>
        ) : (
          <Callout
            variant="info"
            title={t('execution.execSnapshot.ai.title', 'AI consultant insights')}
          >
            {t('execution.execSnapshot.ai.noInsights', 'No insights available yet.')}
          </Callout>
        )}
      </div>
    ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            {t('execution.ai.priorityRecommendations')}
          </h3>
          {aiInsights.priorityRecommendations.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('execution.ai.noPriorities')}
            </p>
          ) : (
            <div className="space-y-2">
              {aiInsights.priorityRecommendations.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className="text-xs text-slate-700 dark:text-slate-300"
                >
                  <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                  <span className="text-slate-500"> · {item.context}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            {t('execution.ai.timelineConflicts')}
          </h3>
          {aiInsights.timelineConflicts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('execution.ai.noConflicts')}
            </p>
          ) : (
            <div className="space-y-2">
              {aiInsights.timelineConflicts.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className="text-xs text-slate-700 dark:text-slate-300"
                >
                  <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                  <span className="text-slate-500"> · {item.context}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            {t('execution.ai.riskSuggestions')}
          </h3>
          {aiInsights.riskAlerts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('execution.ai.noRisks')}
            </p>
          ) : (
            <div className="space-y-2">
              {aiInsights.riskAlerts.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className="text-xs text-slate-700 dark:text-slate-300"
                >
                  <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                  <span className="text-slate-500"> · {item.context}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

  const dashboardBaseInitiatives = useMemo(() => {
    let result = initiatives;
    if (!activeStatusFilter && scope === 'active') {
      result = result.filter((i) => ACTIVE_EXECUTION_STATUSES.includes(i.status));
    }
    if (activeStatusFilter) {
      result = result.filter((i) => i.status === activeStatusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [initiatives, activeStatusFilter, scope, searchQuery]);

  const actionCenter = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const blocked = dashboardBaseInitiatives.filter((i) => i.status === InitiativeStatus.BLOCKED);
    const missingDates = dashboardBaseInitiatives.filter(
      (i) => !i.plannedStartDate || !i.plannedEndDate
    );

    const overdueDecisions = decisions
      .filter((d) => String(d.status).toUpperCase() === 'PENDING' && isPastDue(d.dueDate))
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    const dueSoonTasks = tasks
      .filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate).getTime();
        return due >= now && due <= now + sevenDays && normalizeTaskStatus(t.status) !== 'done';
      })
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

    return {
      blocked,
      missingDates,
      overdueDecisions,
      dueSoonTasks,
    };
  }, [dashboardBaseInitiatives, decisions, tasks]);

  const weeklyPackMarkdown = useMemo(() => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    const phaseLabel = healthSnapshot?.phase
      ? `${healthSnapshot.phase.number}/6 · ${healthSnapshot.phase.name}`
      : '—';
    const gateType = healthSnapshot?.stageGate?.gateType || '—';
    const missingGate = healthSnapshot?.stageGate?.missingCriteria?.length ?? 0;
    const gateStatus = healthSnapshot?.stageGate?.isReady
      ? 'READY'
      : `NOT_READY (${missingGate} missing)`;

    const blockers = (healthSnapshot?.blockers || []).slice(0, 5);
    const overdueDecisions = actionCenter.overdueDecisions.slice(0, 5);
    const dueSoonTasks = actionCenter.dueSoonTasks.slice(0, 5);

    return [
      `# Weekly Execution Pack (${date})`,
      ``,
      `## PMO Snapshot`,
      `- Phase: ${phaseLabel}`,
      `- Gate: ${gateType} · ${gateStatus}`,
      `- Blockers: ${(healthSnapshot?.blockers || []).length}`,
      `- Overdue tasks: ${healthSnapshot?.tasks?.overdueCount ?? 0}`,
      `- Pending decisions: ${healthSnapshot?.decisions?.pendingCount ?? 0} (overdue: ${healthSnapshot?.decisions?.overdueCount ?? 0})`,
      ``,
      `## Top blockers (action required)`,
      blockers.length ? blockers.map((b) => `- [${b.type}] ${b.message}`).join('\n') : `- None`,
      ``,
      `## Overdue decisions (resolve / escalate)`,
      overdueDecisions.length
        ? overdueDecisions
            .map((d) => `- ${d.title}${d.dueDate ? ` (due: ${d.dueDate})` : ''}`)
            .join('\n')
        : `- None`,
      ``,
      `## Due soon tasks (next 7 days)`,
      dueSoonTasks.length
        ? dueSoonTasks
            .map(
              (task) =>
                `- ${task.title}${task.dueDate ? ` (due: ${task.dueDate})` : ''}${task.initiativeName ? ` · ${task.initiativeName}` : ''}`
            )
            .join('\n')
        : `- None`,
      ``,
    ].join('\n');
  }, [actionCenter.dueSoonTasks, actionCenter.overdueDecisions, healthSnapshot]);

  const handleCopyWeeklyPack = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(weeklyPackMarkdown);
      toast.success(t('execution.reports.copied', 'Weekly pack copied'));
    } catch (e) {
      // Fallback: best-effort copy
      try {
        const el = document.createElement('textarea');
        el.value = weeklyPackMarkdown;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success(t('execution.reports.copied', 'Weekly pack copied'));
      } catch {
        toast.error(t('execution.reports.copyFailed', 'Copy failed'));
      }
    }
  }, [t, weeklyPackMarkdown]);

  const renderWeeklyPackCard = () => (
    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {t('execution.reports.weeklyPack', 'Weekly pack')}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
            {t(
              'execution.reports.weeklyPackHint',
              'One copy-ready snapshot for the weekly execution review.'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyWeeklyPack}
          className="h-9 px-4 rounded-xl text-sm font-medium bg-hig-primary text-white hover:bg-hig-primary-hover transition-colors"
        >
          {t('execution.reports.copy', 'Copy')}
        </button>
      </div>
    </div>
  );

  const activeExecutionInitiativeIds = useMemo(() => {
    return new Set(
      initiatives.filter((i) => ACTIVE_EXECUTION_STATUSES.includes(i.status)).map((i) => i.id)
    );
  }, [initiatives]);

  const executionScopedTasks = useMemo(() => {
    const base = tasks.filter((t) => {
      if (!t.initiativeId) return false;
      return activeExecutionInitiativeIds.has(t.initiativeId);
    });
    // Keep only active-ish tasks for the execution queue
    return base.filter((t) => normalizeTaskStatus(t.status) !== 'done');
  }, [tasks, activeExecutionInitiativeIds]);

  const taskBuckets = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const in7 = now + 7 * day;
    const in30 = now + 30 * day;

    const overdue: Task[] = [];
    const dueSoon: Task[] = [];
    const upcoming: Task[] = [];
    const noDate: Task[] = [];

    for (const task of executionScopedTasks) {
      if (!task.dueDate) {
        noDate.push(task);
        continue;
      }
      const due = new Date(task.dueDate).getTime();
      if (due < new Date().setHours(0, 0, 0, 0)) overdue.push(task);
      else if (due <= in7) dueSoon.push(task);
      else if (due <= in30) upcoming.push(task);
    }

    const byDue = (a: Task, b: Task) => (a.dueDate || '').localeCompare(b.dueDate || '');
    overdue.sort(byDue);
    dueSoon.sort(byDue);
    upcoming.sort(byDue);

    return { overdue, dueSoon, upcoming, noDate };
  }, [executionScopedTasks]);

  const renderTasksQueue = () => {
    if (isLoadingTasks) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    const TaskRow: React.FC<{ task: Task }> = ({ task }) => {
      const overdue = isPastDue(task.dueDate);
      return (
        <button
          type="button"
          onClick={() => {
            const initiative = task.initiativeId
              ? initiatives.find((i) => i.id === task.initiativeId)
              : null;
            if (initiative) {
              handleOpenSidePanel(initiative);
              return;
            }
            toast.error(t('execution.toast.initiativeNotFound', 'Related initiative not found'));
          }}
          className="w-full text-left flex items-start justify-between gap-4 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:border-cyan-500/40 hover:bg-white/60 dark:hover:bg-navy-900/40 transition-colors"
          title={t('execution.tasks.openInitiative', 'Open related initiative')}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {task.title}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {task.initiativeName || '—'}
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <div>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</div>
            {overdue ? <div className="text-rose-400">{t('execution.badges.overdue')}</div> : null}
          </div>
        </button>
      );
    };

    const BucketColumn: React.FC<{ title: string; accent: string; tasks: Task[] }> = ({
      title,
      accent,
      tasks,
    }) => (
      <div className="min-w-[280px] flex-1 bg-white/70 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-700">
          <div className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{title}</div>
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="p-3 space-y-3 max-h-[520px] overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
              {t('execution.kanban.noTasks', 'No tasks')}
            </div>
          ) : (
            tasks.slice(0, 20).map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </div>
      </div>
    );

    const listItems = [
      ...taskBuckets.overdue,
      ...taskBuckets.dueSoon,
      ...taskBuckets.upcoming,
    ].slice(0, 12);

    return (
      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('execution.tabs.tasks', 'Tasks')}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'execution.tasks.subtitle',
                  'Overdue, due soon, and upcoming tasks for initiatives in execution.'
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {taskBuckets.overdue.length} {t('execution.badges.overdue')} ·{' '}
              {taskBuckets.dueSoon.length} {t('execution.attention.dueSoonTasks', 'Due soon')}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {listItems.length === 0 ? (
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('execution.empty.noDeadlines')}
            </div>
          ) : (
            listItems.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto">
          <BucketColumn
            title={t('execution.tasks.overdue', 'Overdue')}
            accent="text-rose-400"
            tasks={taskBuckets.overdue}
          />
          <BucketColumn
            title={t('execution.tasks.due7', 'Due in 7 days')}
            accent="text-amber-400"
            tasks={taskBuckets.dueSoon}
          />
          <BucketColumn
            title={t('execution.tasks.upcoming', 'Upcoming (8–30d)')}
            accent="text-cyan-400"
            tasks={taskBuckets.upcoming}
          />
        </div>
      </div>
    );
  };

  const executionScopedDecisions = useMemo(() => {
    const ids = activeExecutionInitiativeIds;
    return decisions.filter((d) => {
      const relatedId = (d as any).relatedObjectId;
      if (!relatedId) return true; // fallback: keep unlinked decisions visible
      return ids.has(relatedId);
    });
  }, [decisions, activeExecutionInitiativeIds]);

  const decisionBuckets = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const done: ExecutionDecision[] = [];
    const due7: ExecutionDecision[] = [];
    const due14: ExecutionDecision[] = [];
    const due30: ExecutionDecision[] = [];
    const more: ExecutionDecision[] = [];

    const getDue = (d: any): string | undefined => d?.dueDate || d?.deadline || d?.createdAt;
    const isDoneStatus = (s: string) =>
      ['APPROVED', 'REJECTED', 'DEFERRED', 'DONE', 'CLOSED', 'RESOLVED'].includes(s);

    for (const d of executionScopedDecisions) {
      const status = String(d.status || '').toUpperCase();
      if (isDoneStatus(status)) {
        done.push(d);
        continue;
      }
      const dueStr = getDue(d);
      if (!dueStr) {
        more.push(d);
        continue;
      }
      const due = new Date(dueStr).getTime();
      const days = Math.ceil((due - now) / day);
      if (days <= 7) due7.push(d);
      else if (days <= 14) due14.push(d);
      else if (days <= 30) due30.push(d);
      else more.push(d);
    }

    const byDue = (a: any, b: any) => (getDue(a) || '').localeCompare(getDue(b) || '');
    due7.sort(byDue);
    due14.sort(byDue);
    due30.sort(byDue);

    return { done, due7, due14, due30, more };
  }, [executionScopedDecisions]);

  const renderDecisionsBuckets = () => {
    if (isLoadingDecisions) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      );
    }

    const getDue = (d: any): string | undefined => d?.dueDate || d?.deadline || d?.createdAt;

    const DecisionRow: React.FC<{ d: ExecutionDecision }> = ({ d }) => {
      const dueStr = getDue(d);
      const overdue = dueStr ? isPastDue(dueStr) : false;
      return (
        <button
          type="button"
          onClick={() => {
            const relatedId = (d as any).relatedObjectId as string | undefined;
            const initiative = relatedId ? initiatives.find((i) => i.id === relatedId) : null;
            if (initiative) {
              handleOpenSidePanel(initiative);
              return;
            }
            toast.error(t('execution.toast.initiativeNotFound', 'Related initiative not found'));
          }}
          className="w-full text-left p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 hover:border-cyan-500/40 hover:bg-white/60 dark:hover:bg-navy-900/40 transition-colors"
          title={t('execution.decisionsBuckets.openInitiative', 'Open related initiative')}
        >
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {d.title}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {d.relatedObjectName || '—'}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>{d.ownerName || '—'}</span>
            <span className={overdue ? 'text-rose-400' : undefined}>
              {dueStr ? new Date(dueStr).toLocaleDateString() : '—'}
            </span>
          </div>
        </button>
      );
    };

    const Bucket: React.FC<{ title: string; accent: string; items: ExecutionDecision[] }> = ({
      title,
      accent,
      items,
    }) => (
      <div className="min-w-[280px] flex-1 bg-white/70 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-navy-700">
          <div className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{title}</div>
          <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <div className="p-3 space-y-3 max-h-[560px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">—</div>
          ) : (
            items.slice(0, 30).map((d) => <DecisionRow key={d.id} d={d} />)
          )}
        </div>
      </div>
    );

    return (
      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('execution.tabs.decisions', 'Decisions')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t(
              'execution.decisionsBuckets.subtitle',
              'Buckets by due horizon to keep governance fast and explicit.'
            )}
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto">
          <Bucket
            title={t('execution.decisionsBuckets.done', 'Done')}
            accent="text-emerald-400"
            items={decisionBuckets.done}
          />
          <Bucket
            title={t('execution.decisionsBuckets.due7', 'Due ≤7d')}
            accent="text-rose-400"
            items={decisionBuckets.due7}
          />
          <Bucket
            title={t('execution.decisionsBuckets.due14', 'Due 8–14d')}
            accent="text-amber-400"
            items={decisionBuckets.due14}
          />
          <Bucket
            title={t('execution.decisionsBuckets.due30', 'Due 15–30d')}
            accent="text-cyan-400"
            items={decisionBuckets.due30}
          />
          <Bucket
            title={t('execution.decisionsBuckets.more', '30d+ / No date')}
            accent="text-slate-400"
            items={decisionBuckets.more}
          />
        </div>
      </div>
    );
  };

  const openInitiativesWithAttention = useCallback(
    (
      attention: 'blocked' | 'missing_dates' | 'overdue' | 'overdue_decisions' | 'due_soon_tasks'
    ) => {
      setActiveTab('reports' as ModuleTab);
      setViewMode('table');
      // Status filter is useful only for pure-status buckets.
      if (attention === 'blocked') {
        setActiveStatusFilter(InitiativeStatus.BLOCKED);
        setActiveFilters([]);
        return;
      }
      setActiveStatusFilter(null);
      setActiveFilters([
        {
          id: `attention:${attention}`,
          column: 'attention',
          value: attention,
          label:
            attention === 'missing_dates'
              ? t('execution.attention.missingDates', 'Missing dates')
              : attention === 'overdue_decisions'
                ? t('execution.attention.overdueDecisions', 'Overdue decisions')
                : attention === 'due_soon_tasks'
                  ? t('execution.attention.dueSoonTasks', 'Due soon tasks')
                  : t('execution.attention.attention', 'Attention'),
          color:
            attention === 'missing_dates'
              ? 'text-amber-500'
              : attention === 'overdue_decisions'
                ? 'text-rose-500'
                : attention === 'due_soon_tasks'
                  ? 'text-cyan-500'
                  : 'text-slate-500',
        },
      ]);
    },
    [t]
  );

  const commandRowContent = useMemo(() => {
    const chipBase =
      'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';
    const badgeBase =
      'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

    const isAttentionActive = (attention: string) =>
      activeFilters.some((f) => f.column === 'attention' && String(f.value) === attention);

    const blockedCount = actionCenter.blocked.length;
    const overdueDecisionsCount = actionCenter.overdueDecisions.length;
    const missingDatesCount = actionCenter.missingDates.length;
    const dueSoonTasksCount = actionCenter.dueSoonTasks.length;

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => openInitiativesWithAttention('blocked')}
          disabled={blockedCount === 0}
          className={`${chipBase} ${
            activeStatusFilter === InitiativeStatus.BLOCKED
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : blockedCount === 0
                ? 'bg-slate-100/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-navy-700/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
          title={t('execution.attention.blocked', 'Blocked')}
        >
          <AlertTriangle size={14} className="text-rose-400" />
          <span>{t('execution.attention.blocked', 'Blocked')}</span>
          <span
            className={`${badgeBase} ${
              activeStatusFilter === InitiativeStatus.BLOCKED
                ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {blockedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => openInitiativesWithAttention('overdue_decisions')}
          disabled={overdueDecisionsCount === 0}
          className={`${chipBase} ${
            isAttentionActive('overdue_decisions')
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : overdueDecisionsCount === 0
                ? 'bg-slate-100/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-navy-700/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
          title={t('execution.attention.overdueDecisions', 'Overdue decisions')}
        >
          <Scale size={14} className="text-amber-400" />
          <span>{t('execution.attention.overdueDecisions', 'Overdue decisions')}</span>
          <span
            className={`${badgeBase} ${
              isAttentionActive('overdue_decisions')
                ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {overdueDecisionsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => openInitiativesWithAttention('missing_dates')}
          disabled={missingDatesCount === 0}
          className={`${chipBase} ${
            isAttentionActive('missing_dates')
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : missingDatesCount === 0
                ? 'bg-slate-100/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-navy-700/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
          title={t('execution.attention.missingDates', 'Missing dates')}
        >
          <Calendar size={14} className="text-yellow-400" />
          <span>{t('execution.attention.missingDates', 'Missing dates')}</span>
          <span
            className={`${badgeBase} ${
              isAttentionActive('missing_dates')
                ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {missingDatesCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => openInitiativesWithAttention('due_soon_tasks')}
          disabled={dueSoonTasksCount === 0}
          className={`${chipBase} ${
            isAttentionActive('due_soon_tasks')
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
              : dueSoonTasksCount === 0
                ? 'bg-slate-100/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-navy-700/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
          }`}
          title={t('execution.attention.dueSoonTasks', 'Due soon tasks')}
        >
          <Clock size={14} className="text-cyan-400" />
          <span>{t('execution.attention.dueSoonTasks', 'Due soon tasks')}</span>
          <span
            className={`${badgeBase} ${
              isAttentionActive('due_soon_tasks')
                ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {dueSoonTasksCount}
          </span>
        </button>
      </div>
    );
  }, [activeFilters, actionCenter, activeStatusFilter, openInitiativesWithAttention, t]);

  const renderActionCenter = () => (
    <div className="space-y-4">
      {/* V4-EXEC-02: Action Queue — overdue decisions, high P×I risks, overdue tasks */}
      <div
        className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4"
        data-testid="execution-action-queue"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('execution.actionQueue.title', 'Action Queue')}
          </h3>
          {isLoadingActionQueue ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {actionQueueItems.length} {t('execution.actionQueue.items', 'items')}
            </span>
          )}
        </div>
        {actionQueueItems.length === 0 && !isLoadingActionQueue ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('execution.attention.none', 'Nothing urgent')}
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {actionQueueItems.slice(0, 15).map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-slate-50 dark:bg-navy-800/50 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.initiativeName || '—'}
                    {item.type === 'decision_overdue' && item.dueDate
                      ? ` • ${t('execution.actionQueue.due', 'Due')} ${new Date(item.dueDate).toLocaleDateString()}`
                      : ''}
                    {item.type === 'comm_overdue' && item.dueDate
                      ? ` • ${t('execution.actionQueue.commDue', 'Comm due')} ${new Date(item.dueDate).toLocaleDateString()}`
                      : ''}
                    {item.type === 'risk_high' && item.impact ? ` • ${item.impact}` : ''}
                    {item.type === 'kpi_deviation_no_plan' && item.severity
                      ? ` • ${t('execution.actionQueue.severity', 'Severity')} ${item.severity}`
                      : ''}
                    {item.type === 'kpi_deviation_no_plan' && item.periodStart
                      ? ` • ${t('execution.actionQueue.period', 'Period')} ${new Date(item.periodStart).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${
                    item.type === 'decision_overdue'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      : item.type === 'risk_high'
                        ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                        : item.type === 'comm_overdue'
                          ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                          : item.type === 'kpi_deviation_no_plan'
                            ? 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300'
                            : 'bg-slate-200 dark:bg-navy-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.type === 'decision_overdue'
                    ? t('execution.actionQueue.decision', 'Decision')
                    : item.type === 'risk_high'
                      ? t('execution.actionQueue.risk', 'Risk')
                      : item.type === 'comm_overdue'
                        ? t('execution.actionQueue.communication', 'Communication')
                        : item.type === 'kpi_deviation_no_plan'
                          ? t('execution.actionQueue.kpi', 'KPI')
                          : t('execution.actionQueue.task', 'Task')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4" data-testid="execution-action-center">
        <button
          type="button"
          onClick={() => openInitiativesWithAttention('blocked')}
          className="text-left bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-rose-500/40 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.attention.blocked', 'Blocked')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {actionCenter.blocked.length}
              </p>
            </div>
            <AlertTriangle className="text-rose-400" size={18} />
          </div>
          <div className="space-y-1">
            {actionCenter.blocked.slice(0, 3).map((i) => (
              <div key={i.id} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                {i.name}
              </div>
            ))}
            {actionCenter.blocked.length === 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('execution.attention.none', 'Nothing urgent')}
              </div>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openInitiativesWithAttention('overdue_decisions')}
          className="text-left bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-amber-500/40 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.attention.overdueDecisions', 'Overdue decisions')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {actionCenter.overdueDecisions.length}
              </p>
            </div>
            <Scale className="text-amber-400" size={18} />
          </div>
          <div className="space-y-1">
            {actionCenter.overdueDecisions.slice(0, 3).map((d) => (
              <div key={d.id} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                <span className="font-medium text-slate-900 dark:text-white">{d.title}</span>
                <span className="text-slate-500"> · {d.relatedObjectName || '—'}</span>
              </div>
            ))}
            {actionCenter.overdueDecisions.length === 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('execution.attention.none', 'Nothing urgent')}
              </div>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openInitiativesWithAttention('missing_dates')}
          className="text-left bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-cyan-500/40 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.attention.missingDates', 'Missing dates')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {actionCenter.missingDates.length}
              </p>
            </div>
            <Calendar className="text-cyan-400" size={18} />
          </div>
          <div className="space-y-1">
            {actionCenter.missingDates.slice(0, 3).map((i) => (
              <div key={i.id} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                {i.name}
              </div>
            ))}
            {actionCenter.missingDates.length === 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('execution.attention.none', 'Nothing urgent')}
              </div>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openInitiativesWithAttention('due_soon_tasks')}
          className="text-left bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-violet-500/40 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                {t('execution.attention.dueSoonTasks', 'Due soon')}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                {actionCenter.dueSoonTasks.length}
              </p>
            </div>
            <ClipboardList className="text-violet-400" size={18} />
          </div>
          <div className="space-y-1">
            {actionCenter.dueSoonTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                <span className="font-medium text-slate-900 dark:text-white">{task.title}</span>
                <span className="text-slate-500"> · {task.initiativeName || '—'}</span>
              </div>
            ))}
            {actionCenter.dueSoonTasks.length === 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('execution.attention.none', 'Nothing urgent')}
              </div>
            )}
          </div>
        </button>
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
            <p className="text-lg text-slate-900 dark:text-white">
              {t('execution.empty.noDeadlines')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('execution.empty.deadlinesWillAppear')}
            </p>
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
          <div
            key={dateKey}
            className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4"
          >
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
                      ) : item.type === 'decision' ? (
                        <Scale size={14} className="text-amber-400" />
                      ) : (
                        <Calendar size={14} className="text-purple-400" />
                      )}
                      {item.title}
                      {item.type === 'initiative' && item.kind && (
                        <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {item.kind === 'start' ? 'Start' : 'End'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.initiativeName || 'Execution Center'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{item.ownerName || t('execution.table.unassigned')}</div>
                    {isPastDue(item.dueDate) && (
                      <div className="text-rose-400">{t('execution.badges.overdue')}</div>
                    )}
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
    if (viewMode === 'calendar') {
      return renderCalendarView();
    }

    if (viewMode === 'timeline') {
      return (
        <div className="min-h-[420px]">
          <ExecutionTimelineView
            initiatives={filteredInitiatives as FullInitiative[]}
            onInitiativeClick={handleOpenSidePanel}
            onUpdateInitiative={handleInitiativeUpdate}
            onTimelineUpdate={handleTimelineUpdate}
            onDependenciesChanged={handleRefresh}
            riskSignals={riskSignals}
            delaySignals={delaySignals}
            governedTimelineWarnings={timelineWarnings}
            projectId={currentProjectId || undefined}
          />
        </div>
      );
    }

    if (viewMode === 'kanban') {
      return (
        <ExecutionInitiativesKanbanView
          initiatives={portfolioInitiatives}
          scope={scope}
          onInitiativeClick={(pi) => {
            const full = filteredInitiatives.find((x) => x.id === pi.id);
            if (full) handleOpenSidePanel(full);
          }}
          onStatusChange={(id, status) => handleInlineStatusChange(id, status)}
        />
      );
    }

    if (viewMode === 'grid') {
      return (
        <div className="h-full overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {portfolioInitiatives.map((pi) => (
              <InitiativeGridCard
                key={pi.id}
                initiative={pi}
                onClick={() => {
                  const full = filteredInitiatives.find((x) => x.id === pi.id);
                  if (full) handleOpenSidePanel(full);
                }}
              />
            ))}
          </div>
          {portfolioInitiatives.length === 0 && (
            <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
              {t('execution.empty.noAvailable')}
            </div>
          )}
        </div>
      );
    }

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
  };

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

    if (activeTab === 'list') {
      type PreviewItem = FullInitiative & { title: string };

      const selectedInit = summaryPreviewInitiativeId
        ? summaryInitiatives.find((i) => i.id === summaryPreviewInitiativeId) || null
        : null;
      const selectedItem: PreviewItem | null = selectedInit
        ? ({ ...selectedInit, title: selectedInit.name } as PreviewItem)
        : null;
      const itemIds = summaryInitiatives.map((i) => i.id);

      return (
        <div className="h-full overflow-hidden">
          <TableWithPreviewLayout<PreviewItem>
            selectedId={summaryPreviewInitiativeId}
            selectedItem={selectedItem}
            onSelect={setSummaryPreviewInitiativeId}
            itemIds={itemIds}
            getItemById={(id) => {
              const x = summaryInitiatives.find((i) => i.id === id);
              return x ? ({ ...x, title: x.name || x.id } as any) : null;
            }}
            onOpenFull={(id) => {
              const init = summaryInitiatives.find((x) => x.id === id);
              if (init) handleOpenDocument(init);
            }}
            renderPreview={(item) => (
              <InitiativePreviewV3Body
                initiative={mapToPreviewModel(item)}
                onSummarize={() =>
                  openAiChatForInitiative(
                    item,
                    t(
                      'execution.summary.summarizePrompt',
                      'Summarize this initiative in 5 bullets and propose 3 next steps.'
                    )
                  )
                }
              />
            )}
            renderPreviewFooter={(item) => (
              <InitiativePreviewV3Footer
                initiative={mapToPreviewModel(item)}
                tasksCount={tasksByInitiative[item.id]?.length}
                onOpenFull={() => handleOpenDocument(item)}
                onOpenChat={(prompt) => openAiChatForInitiative(item, prompt)}
                onCopyLink={() => copyExecutionLink(item.id)}
              />
            )}
          >
            <FilterableTable
              columns={columns}
              data={summaryInitiatives as any[]}
              selectedRowId={summaryPreviewInitiativeId}
              onRowClick={(row) => setSummaryPreviewInitiativeId(String(row.id))}
              onRowDoubleClick={(row) => {
                const init = summaryInitiatives.find((x) => x.id === row.id);
                if (init) handleOpenDocument(init);
              }}
              onRowAction={(action, row) => {
                const init = summaryInitiatives.find((x) => x.id === row.id);
                if (!init) return;
                if (action === 'preview') {
                  setSummaryPreviewInitiativeId(init.id);
                  return;
                }
                if (action === 'edit') {
                  handleOpenDocument(init);
                }
              }}
              activeFilters={summaryFilters}
              onFilterChange={setSummaryFilters}
              emptyMessage={t('execution.empty.noInExecution')}
              canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
              density="compact"
            />
          </TableWithPreviewLayout>
        </div>
      );
    }

    if (activeTab === 'initiatives') {
      return (
        <div className="p-4">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            {renderExecutionView()}
          </div>
        </div>
      );
    }

    if (activeTab === 'tasks') {
      return <div className="h-full">{renderTasksQueue()}</div>;
    }

    if (activeTab === 'decisions') {
      return <div className="h-full">{renderDecisionsBuckets()}</div>;
    }

    if (activeTab === 'team') {
      return (
        <div className="p-4">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <ExecutionWorkloadView
              initiatives={initiatives}
              onInitiativeClick={handleOpenSidePanel}
              showControls={false}
              controls={{
                viewMode: workloadViewMode,
                setViewMode: setWorkloadViewMode,
                weekCount: workloadWeekCount,
                setWeekCount: setWorkloadWeekCount,
                monthCount: workloadMonthCount,
                setMonthCount: setWorkloadMonthCount,
                startDate: workloadStartDate,
                setStartDate: setWorkloadStartDate,
              }}
            />
          </div>
        </div>
      );
    }

    if (activeTab === ('people_change' as ModuleTab)) {
      const kpiAlerts = actionQueueItems.filter(
        (item) => item.type === 'kpi_deviation_no_plan'
      ).length;
      const overdueItems = actionQueueItems.filter(
        (item) => item.type === 'decision_overdue' || item.type === 'comm_overdue'
      ).length;
      return (
        <div className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('execution.management.workloadTitle', 'Workload changes')}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {actionQueueItems.length}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'execution.management.workloadBody',
                  'Items that need review, acceptance, or follow-up this cycle.'
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('execution.management.overdueTitle', 'Overdue approvals')}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {overdueItems}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'execution.management.overdueBody',
                  'Decisions and communications that are past due and should move first.'
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('execution.management.kpiAlertsTitle', 'KPI alerts without plan')}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {kpiAlerts}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'execution.management.kpiAlertsBody',
                  'Deviation cases surface here so teams can turn them into actions and staffing changes.'
                )}
              </div>
            </div>
          </div>

          {renderActionCenter()}

          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <ExecutionWorkloadView
              initiatives={initiatives}
              onInitiativeClick={handleOpenSidePanel}
              showControls={false}
              controls={{
                viewMode: workloadViewMode,
                setViewMode: setWorkloadViewMode,
                weekCount: workloadWeekCount,
                setWeekCount: setWorkloadWeekCount,
                monthCount: workloadMonthCount,
                setMonthCount: setWorkloadMonthCount,
                startDate: workloadStartDate,
                setStartDate: setWorkloadStartDate,
              }}
            />
          </div>

          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <PeopleChangeWorkspace
              initiativeId={undefined}
              projectId={currentProjectId || undefined}
            />
          </div>
        </div>
      );
    }

    if (activeTab === 'reports') {
      return (
        <div className="p-4 space-y-4">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            {renderExecutionView()}
          </div>

          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 overflow-hidden">
            <BudgetControlPanel
              projectId={currentProjectId || undefined}
              onInitiativeClick={(id) => {
                const init = initiatives.find((i) => i.id === id);
                if (init) handleOpenSidePanel(init);
              }}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ToggleBlock
              title={t('execution.reporting.tasksTitle', 'Tasks')}
              badge={tasks.length}
              defaultOpen={false}
              icon={<ClipboardList size={16} />}
            >
              {renderTasksQueue()}
            </ToggleBlock>
            <ToggleBlock
              title={t('execution.reporting.decisionsTitle', 'Decisions')}
              badge={decisions.filter((d) => String(d.status).toUpperCase() === 'PENDING').length}
              defaultOpen={false}
              icon={<Scale size={16} />}
            >
              {renderDecisionsBuckets()}
            </ToggleBlock>
          </div>

          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('execution.reports.title', 'Execution reports')}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t(
                    'execution.reports.subtitle',
                    'Generate a simple weekly pack and deep-dive reports without adding process overhead.'
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="h-9 px-4 rounded-xl text-sm font-medium bg-hig-primary text-white hover:bg-hig-primary-hover transition-colors"
              >
                {t('execution.reports.open', 'Open Reports')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const snapshot = execSnapshot;
    return (
      <div className="p-4 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('execution.execSnapshot.title', 'Executive snapshot')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {snapshot?.generatedAt
                ? t('execution.execSnapshot.generatedAt', 'Generated at') +
                  `: ${new Date(snapshot.generatedAt).toLocaleString()}`
                : t('execution.execSnapshot.generatedAt', 'Generated at') + ': —'}
            </div>
          </div>
          {execControls}
        </div>

        {execSnapshotError ? (
          <Callout variant="critical" title={t('execution.execSnapshot.error', 'Snapshot error')}>
            {execSnapshotError}
          </Callout>
        ) : null}

        {!snapshot ? (
          <div className="bg-white/40 dark:bg-navy-900/30 rounded-xl border border-slate-200/50 dark:border-navy-700/50 p-8">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('execution.execSnapshot.loading', 'Loading snapshot...')}
            </div>
          </div>
        ) : (
          <>
            {/* 7.1 Overview */}
            <ToggleBlock
              title={t('execution.execSnapshot.overview.title', 'Overview')}
              badge={`${snapshot.overview.progressPercent}%`}
              icon={<LayoutDashboard size={14} />}
              defaultOpen
            >
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('execution.execSnapshot.overview.progress', 'Progress')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {snapshot.overview.progressPercent}%
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('execution.execSnapshot.overview.phase', 'Phase')}:{' '}
                    {snapshot.overview.phaseLabel || '—'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('execution.execSnapshot.overview.alerts', 'Priority alerts')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {snapshot.overview.priorityAlerts?.length || 0}
                  </div>
                  <div className="mt-2 space-y-2">
                    {(snapshot.overview.priorityAlerts || []).slice(0, 3).map((a, idx) => (
                      <Callout
                        key={`${a.type}-${idx}`}
                        variant={severityToCalloutVariant(a.severity)}
                        compact
                        title={a.type}
                      >
                        {a.message}
                      </Callout>
                    ))}
                    {(snapshot.overview.priorityAlerts || []).length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t('execution.execSnapshot.overview.noAlerts', 'No critical alerts.')}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('execution.execSnapshot.overview.nextMilestones', 'Next milestones')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {snapshot.overview.nextMilestones?.length || 0}
                  </div>
                  <InlineTable
                    className="mt-3"
                    compact
                    columns={[
                      {
                        key: 'initiative',
                        header: t('execution.execSnapshot.overview.initiative', 'Initiative'),
                        render: (row: any) => (
                          <button
                            type="button"
                            onClick={() => {
                              const init = initiatives.find((i) => i.id === row.initiativeId);
                              if (init) handleOpenSidePanel(init);
                              else
                                toast.error(
                                  t(
                                    'execution.toast.initiativeNotFound',
                                    'Related initiative not found'
                                  )
                                );
                            }}
                            className="text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:underline"
                          >
                            {row.initiativeName || '—'}
                          </button>
                        ),
                      },
                      {
                        key: 'date',
                        header: t('execution.execSnapshot.overview.targetDate', 'Target'),
                        width: 'w-28',
                        align: 'right',
                        render: (row: any) => (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {row.targetDate ? new Date(row.targetDate).toLocaleDateString() : '—'}
                          </span>
                        ),
                      },
                    ]}
                    data={(snapshot.overview.nextMilestones || []).slice(0, 5) as any[]}
                    rowKey={(row: any) => row.id}
                    emptyMessage={t(
                      'execution.execSnapshot.overview.noMilestones',
                      'No upcoming milestones.'
                    )}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('execution.execSnapshot.overview.timelineWarnings', 'Timeline warnings')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatNumber(timelineWarningTotal)}
                  </div>
                  <div className="mt-2">
                    {topTimelineWarning ? (
                      <Callout
                        compact
                        variant={severityToCalloutVariant(topTimelineWarning.severity)}
                        title={
                          topTimelineWarning.initiativeName ||
                          t('execution.execSnapshot.overview.topWarning', {
                            defaultValue: 'Top warning',
                          })
                        }
                      >
                        {topTimelineWarning.message}
                      </Callout>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          'execution.execSnapshot.overview.noTimelineWarnings',
                          'No timeline warnings detected.'
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('execution.execSnapshot.overview.capacityAlerts', 'Capacity alerts')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatNumber(capacityAlerts.length)}
                  </div>
                  <div className="mt-2">
                    {topCapacityAlert ? (
                      <Callout
                        compact
                        variant={severityToCalloutVariant(topCapacityAlert.severity)}
                        title={
                          topCapacityAlert.name ||
                          t('execution.execSnapshot.overview.topCapacityAlert', {
                            defaultValue: 'Top alert',
                          })
                        }
                      >
                        {t('execution.execSnapshot.overview.capacityAlertDetail', {
                          hours: formatNumber(topCapacityAlert.overloadHours),
                          defaultValue: '{{hours}}h over capacity',
                        })}
                      </Callout>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {t(
                          'execution.execSnapshot.overview.noCapacityAlerts',
                          'No capacity leveling alerts detected.'
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {t('execution.execSnapshot.overview.capacityHorizon', 'Capacity horizon')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {capacityHorizon
                      ? `${formatNumber(capacityHorizon.allocatedHours)}/${formatNumber(capacityHorizon.capacityHours)}h`
                      : '—'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {capacityHorizon
                      ? t('execution.execSnapshot.overview.capacityHorizonDetail', {
                          hours: formatNumber(capacityHorizon.availableHours),
                          date: new Date(capacityHorizon.weekStart).toLocaleDateString(),
                          defaultValue: '{{hours}}h available in week of {{date}}',
                        })
                      : t(
                          'execution.execSnapshot.overview.noCapacityTimeline',
                          'No capacity forecast available.'
                        )}
                  </div>
                </div>
              </div>
            </ToggleBlock>

            {/* 7.2 Workstreams */}
            <ToggleBlock
              title={t('execution.execSnapshot.workstreams.title', 'Workstreams')}
              badge={
                (snapshot.workstreams.items?.length || 0) +
                (snapshot.workstreams.unassignedInitiatives ? 1 : 0)
              }
              icon={<LayoutGrid size={14} />}
              defaultOpen
            >
              <EmbeddedView
                title={t('execution.execSnapshot.workstreams.title', 'Workstreams')}
                count={snapshot.workstreams.items?.length || 0}
                viewModes={['list', 'table']}
                activeMode={workstreamsViewMode}
                onModeChange={(m) => setWorkstreamsViewMode(m as any)}
                onOpenFull={() => navigate('/pmo')}
                loading={isLoadingExecSnapshot}
              >
                {snapshot.workstreams.items?.length ? (
                  workstreamsViewMode === 'table' ? (
                    <InlineTable
                      compact
                      columns={[
                        {
                          key: 'name',
                          header: t('execution.execSnapshot.workstreams.name', 'Workstream'),
                          render: (row: any) => (
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                {row.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {t('execution.execSnapshot.workstreams.owner', 'Owner')}:{' '}
                                {row.ownerName || '—'}
                              </div>
                            </div>
                          ),
                        },
                        {
                          key: 'progress',
                          header: t('execution.execSnapshot.workstreams.progress', 'Progress'),
                          width: 'w-24',
                          align: 'right',
                          render: (row: any) => (
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatNumber(row.progressAvg)}%
                            </span>
                          ),
                        },
                        {
                          key: 'counts',
                          header: t(
                            'execution.execSnapshot.workstreams.initiatives',
                            'Initiatives'
                          ),
                          width: 'w-28',
                          align: 'right',
                          render: (row: any) => (
                            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatNumber(row.initiativeCount)}
                            </span>
                          ),
                        },
                      ]}
                      data={snapshot.workstreams.items as any[]}
                      rowKey={(row: any) => row.id}
                      emptyMessage={t(
                        'execution.execSnapshot.workstreams.empty',
                        'No workstreams defined.'
                      )}
                    />
                  ) : (
                    <div className="space-y-2">
                      {snapshot.workstreams.items.slice(0, 10).map((ws) => (
                        <div
                          key={ws.id}
                          className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                {ws.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {t('execution.execSnapshot.workstreams.owner', 'Owner')}:{' '}
                                {ws.ownerName || '—'}
                              </div>
                            </div>
                            <div className="text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                              <div>{formatNumber(ws.progressAvg)}%</div>
                              <div>
                                {formatNumber(ws.onTrackCount)} on track ·{' '}
                                {formatNumber(ws.atRiskCount)} at risk
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {snapshot.workstreams.unassignedInitiatives ? (
                        <Callout
                          variant="warning"
                          compact
                          title={t('execution.execSnapshot.workstreams.unassigned', 'Unassigned')}
                        >
                          {t(
                            'execution.execSnapshot.workstreams.unassignedHint',
                            'Initiatives without a workstream'
                          )}
                          : {formatNumber(snapshot.workstreams.unassignedInitiatives)}
                        </Callout>
                      ) : null}
                    </div>
                  )
                ) : (
                  <EmptyStateInline
                    message={t(
                      'execution.execSnapshot.workstreams.empty',
                      'No workstreams defined.'
                    )}
                    hint={t(
                      'execution.execSnapshot.workstreams.emptyHint',
                      'Create workstreams to improve accountability and reporting.'
                    )}
                    action={{
                      label: t('execution.execSnapshot.workstreams.openPMO', 'Open PMO'),
                      onClick: () => navigate('/pmo'),
                    }}
                  />
                )}
              </EmbeddedView>
            </ToggleBlock>

            {/* 7.3 KPI */}
            <ToggleBlock
              title={t('execution.execSnapshot.kpis.title', 'KPIs')}
              badge={snapshot.kpis.highlights?.length || 0}
              icon={<TrendingUp size={14} />}
            >
              <InlineTable
                columns={[
                  {
                    key: 'name',
                    header: t('execution.execSnapshot.kpis.kpi', 'KPI'),
                    render: (row: any) => (
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {row.id === 'derived_initiatives_executing'
                            ? t(
                                'execution.execSnapshot.kpis.derived.initiativesExecuting',
                                'Initiatives executing'
                              )
                            : row.id === 'derived_initiatives_blocked'
                              ? t(
                                  'execution.execSnapshot.kpis.derived.initiativesBlocked',
                                  'Initiatives blocked'
                                )
                              : row.id === 'derived_tasks_overdue'
                                ? t(
                                    'execution.execSnapshot.kpis.derived.tasksOverdue',
                                    'Overdue tasks'
                                  )
                                : row.id === 'derived_decisions_pending'
                                  ? t(
                                      'execution.execSnapshot.kpis.derived.decisionsPending',
                                      'Pending decisions'
                                    )
                                  : row.name}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'current',
                    header: t('execution.execSnapshot.kpis.current', 'Current'),
                    width: 'w-28',
                    align: 'right',
                    render: (row: any) => (
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatNumber(row.currentValue)}
                        {row.unit ? ` ${row.unit}` : ''}
                      </span>
                    ),
                  },
                  {
                    key: 'target',
                    header: t('execution.execSnapshot.kpis.target', 'Target'),
                    width: 'w-28',
                    align: 'right',
                    render: (row: any) => (
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatNumber(row.targetValue)}
                        {row.unit ? ` ${row.unit}` : ''}
                      </span>
                    ),
                  },
                ]}
                data={(snapshot.kpis.highlights || []).slice(0, 8) as any[]}
                rowKey={(row: any) => row.id}
                emptyMessage={t('execution.execSnapshot.kpis.empty', 'No KPIs available.')}
                caption={`${t('execution.execSnapshot.kpis.dataQuality', 'Data quality')}: ${snapshot.kpis.dataQuality}`}
              />
            </ToggleBlock>

            {/* 7.4 ROI */}
            <ToggleBlock
              title={t('execution.execSnapshot.roi.title', 'ROI / financial impact')}
              badge={
                snapshot.roi.summary ? `${formatMoney(snapshot.roi.summary.totalProjected)}` : '—'
              }
              icon={<Target size={14} />}
            >
              {snapshot.roi.summary ? (
                <div className="grid gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('execution.execSnapshot.roi.projected', 'Projected')}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatMoney(snapshot.roi.summary.totalProjected)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('execution.execSnapshot.roi.realized', 'Realized')}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatMoney(snapshot.roi.summary.totalRealized)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('execution.execSnapshot.roi.variance', 'Variance')}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatMoney(snapshot.roi.summary.totalVariance)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 bg-white/40 dark:bg-navy-900/30 p-4">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {t('execution.execSnapshot.roi.coverage', 'Coverage')}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                      {formatNumber(snapshot.roi.summary.coveragePercent)}%
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyStateInline
                  message={t('execution.execSnapshot.roi.empty', 'No ROI data available.')}
                  hint={t(
                    'execution.execSnapshot.roi.emptyHint',
                    'Connect initiatives to benefit tracking to compute financial impact.'
                  )}
                  action={{
                    label: t('execution.execSnapshot.roi.openBenefits', 'Open Benefits'),
                    onClick: () => navigate('/benefits'),
                  }}
                />
              )}
              <div className="mt-4">
                <InlineTable
                  compact
                  caption={t('execution.execSnapshot.roi.initiatives', 'Top initiatives')}
                  columns={[
                    {
                      key: 'initiative',
                      header: t('execution.execSnapshot.roi.initiative', 'Initiative'),
                      render: (row: any) => (
                        <button
                          type="button"
                          onClick={() => {
                            const init = initiatives.find((i) => i.id === row.initiativeId);
                            if (init) handleOpenSidePanel(init);
                            else
                              toast.error(
                                t(
                                  'execution.toast.initiativeNotFound',
                                  'Related initiative not found'
                                )
                              );
                          }}
                          className="text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:underline"
                        >
                          {row.initiativeName || '—'}
                        </button>
                      ),
                    },
                    {
                      key: 'projected',
                      header: t('execution.execSnapshot.roi.projected', 'Projected'),
                      width: 'w-32',
                      align: 'right',
                      render: (row: any) => (
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatMoney(row.projectedBenefit)}
                        </span>
                      ),
                    },
                    {
                      key: 'realized',
                      header: t('execution.execSnapshot.roi.realized', 'Realized'),
                      width: 'w-32',
                      align: 'right',
                      render: (row: any) => (
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatMoney(row.realizedBenefit)}
                        </span>
                      ),
                    },
                  ]}
                  data={(snapshot.roi.items || []).slice(0, 8) as any[]}
                  rowKey={(row: any, idx: number) => `${row.initiativeId || idx}`}
                  emptyMessage={t(
                    'execution.execSnapshot.roi.noItems',
                    'No initiatives mapped to ROI.'
                  )}
                />
              </div>
            </ToggleBlock>

            {/* 7.5 Risks */}
            <ToggleBlock
              title={t('execution.execSnapshot.risks.title', 'Risks')}
              badge={snapshot.risks.topRisks?.length || 0}
              icon={<AlertTriangle size={14} />}
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <InlineTable
                    caption={t('execution.execSnapshot.risks.heatmap', 'Heatmap (P×I)')}
                    compact
                    columns={[
                      {
                        key: 'cell',
                        header: t('execution.execSnapshot.risks.cell', 'Cell'),
                        render: (row: any) => row.cell,
                      },
                      {
                        key: 'count',
                        header: t('execution.execSnapshot.risks.count', 'Count'),
                        width: 'w-20',
                        align: 'right',
                        render: (row: any) => (
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {row.count}
                          </span>
                        ),
                      },
                    ]}
                    data={
                      Object.entries(snapshot.risks.heatmap || {})
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .slice(0, 10)
                        .map(([k, v]) => ({ cell: formatHeatmapKey(k), count: v })) as any[]
                    }
                    rowKey={(row: any, idx: number) => `${row.cell}-${idx}`}
                    emptyMessage={t(
                      'execution.execSnapshot.risks.noHeatmap',
                      'No risk heatmap data.'
                    )}
                  />
                </div>
                <div>
                  <InlineTable
                    caption={t('execution.execSnapshot.risks.top', 'Top risks')}
                    compact
                    columns={[
                      {
                        key: 'risk',
                        header: t('execution.execSnapshot.risks.risk', 'Risk'),
                        render: (row: any) => (
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                              {row.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {t('execution.execSnapshot.risks.score', 'Score')}:{' '}
                              {formatNumber(row.score)}
                            </div>
                          </div>
                        ),
                      },
                      {
                        key: 'due',
                        header: t('execution.execSnapshot.risks.due', 'Due'),
                        width: 'w-28',
                        align: 'right',
                        render: (row: any) => (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—'}
                          </span>
                        ),
                      },
                    ]}
                    data={(snapshot.risks.topRisks || []).slice(0, 8) as any[]}
                    rowKey={(row: any) => row.id}
                    emptyMessage={t('execution.execSnapshot.risks.noTop', 'No top risks.')}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <Callout
                  variant="warning"
                  title={t('execution.execSnapshot.risks.signals', 'Signals')}
                  compact
                >
                  {t('execution.execSnapshot.risks.signalCounts', 'Risk/Delay/Overspend signals')}
                  :&nbsp;
                  <span className="tabular-nums">
                    {riskSignals.length}/{delaySignals.length}/{overspendSignals.length}
                  </span>
                </Callout>
                <Callout
                  variant="info"
                  title={t('execution.execSnapshot.risks.openPanels', 'Control panels')}
                  compact
                >
                  {t(
                    'execution.execSnapshot.risks.panelsHint',
                    'See detailed signals in the panels below.'
                  )}
                </Callout>
                <Callout
                  variant="success"
                  title={t('execution.execSnapshot.risks.raids', 'RAID log')}
                  compact
                >
                  {t(
                    'execution.execSnapshot.risks.raidsHint',
                    'Top risks are sourced from the project RAID log.'
                  )}
                </Callout>
              </div>
            </ToggleBlock>

            {/* Existing control panels (detailed) */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
              <RiskSignalsPanel
                projectId={currentProjectId || undefined}
                signals={riskSignals}
                loading={isLoadingControlSignals}
                onRefresh={handleRefresh}
                onInitiativeClick={(id) => {
                  const init = initiatives.find((i) => i.id === id);
                  if (init) handleOpenSidePanel(init);
                }}
              />
            </div>
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 overflow-hidden">
              <DelayDetectionPanel
                projectId={currentProjectId || undefined}
                signals={delaySignals}
                loading={isLoadingControlSignals}
                onRefresh={handleRefresh}
                onInitiativeClick={(id) => {
                  const init = initiatives.find((i) => i.id === id);
                  if (init) handleOpenSidePanel(init);
                }}
              />
            </div>
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 overflow-hidden">
              <BudgetControlPanel
                projectId={currentProjectId || undefined}
                overspendSignals={overspendSignals}
                loading={isLoadingControlSignals}
                onSaved={handleRefresh}
                onInitiativeClick={(id) => {
                  const init = initiatives.find((i) => i.id === id);
                  if (init) handleOpenSidePanel(init);
                }}
              />
            </div>

            {/* Weekly pack + action center + AI */}
            {renderWeeklyPackCard()}
            {renderActionCenter()}
            {renderAIInsights()}
          </>
        )}
      </div>
    );
  };

  const availableViewModes = useMemo(
    () =>
      activeTab === 'reports'
        ? (['table', 'kanban', 'timeline', 'calendar', 'grid'] as ViewMode[])
        : (['table'] as ViewMode[]),
    [activeTab]
  );

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeTab === 'list' ? summaryFilters : activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
        statusDropdownContext={
          activeTab === 'list' || activeTab === 'reports' ? 'execution' : undefined
        }
        statusCounts={
          activeTab === 'list' || activeTab === 'reports' ? statusDropdownCounts : undefined
        }
        rightControls={rightControls}
        availableViewModes={availableViewModes}
        commandRowContent={commandRowContent}
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
        whyRed={
          sidePanelInitiative
            ? (initiativeHealthMap.get(sidePanelInitiative.id)?.whyRed ?? null)
            : null
        }
      />
    </>
  );
};

export default ExecutionHub;
