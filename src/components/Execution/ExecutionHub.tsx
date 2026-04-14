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
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  GripVertical,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Callout } from '@/components/shared/NModeBlocks';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { ROUTES } from '@/routes/routeConfig';
import { Api, API_URL, getHeaders } from '@/services/api';
import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';
import { refreshExecutionWriteTruth } from '@/services/executionWriteTruth';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import {
  getStatusActions,
  getStatusesForModule,
  STATUS_METADATA,
} from '@/services/initiativeLifecycle';
import { useConversationStore } from '@/store/useConversationStore';
import { dispatchPilotAccessBlocked, isPilotParticipantRole } from '@/utils/pilotAccess';

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
import {
  FilterableTable,
  FilterChip,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { ExecutionInitiativesKanbanView } from './ExecutionInitiativesKanbanView';
import { ExecutionManagementView } from './ExecutionManagementView';
import { normalizeExecutionArrayEnvelope } from './executionPayloadGuards';
import {
  buildReportMarkdown,
  computeRAG,
  enrichExecutionReport,
  exportReportPDF,
  RAG_CONFIG,
  type ReportDataContext,
  type ReportDef,
} from './executionReports';
import { DelaySignalItem, ExecutionTimelineView, RiskSignalItem } from './ExecutionTimelineView';
import { ReportDocumentView } from './ReportDocumentView';

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
  status: ProjectTaskStatus | null | undefined
): 'todo' | 'in_progress' | 'review' | 'blocked' | 'done' => {
  if (!status) return 'todo';
  const normalized = String(status).toLowerCase();
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
  const currentUser = useAppStore((s) => s.currentUser);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const isPilotParticipant = isPilotParticipantRole(currentUser?.role);

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
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
  const [reportFilters, setReportFilters] = useState<FilterChip[]>([]);
  const [reportPreviewId, setReportPreviewId] = useState<string | null>(null);
  const [reportPreset, setReportPreset] = useState<
    'all' | 'weekly' | 'monthly' | 'bi-weekly' | 'on-demand' | 'sponsor'
  >('all');

  // Data state
  const initRetryRef = React.useRef(0);
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

  const [managerLaneCounts, setManagerLaneCounts] = useState<
    Record<string, { total: number; critical: number; warning: number }>
  >({});

  useEffect(() => {
    setOpenDocuments((prev) =>
      prev.filter((doc) => !(doc.type === 'report' && doc.subType === 'manager'))
    );
    setActiveDocumentId((prev) => (prev?.startsWith('manager:') ? null : prev));
  }, []);

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

  useEffect(() => {
    if (activeTab === 'list') {
      const allowed: ViewMode[] = ['table', 'kanban', 'timeline'];
      if (!allowed.includes(viewMode)) setViewMode('table');
      return;
    }
    if (activeTab === 'reports') {
      const allowed: ViewMode[] = ['table', 'grid'];
      if (!allowed.includes(viewMode)) setViewMode('table');
      return;
    }
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
    initRetryRef.current = 0;
    const loadInitiatives = async () => {
      setIsLoading(true);
      try {
        const response = await Api.getInitiatives(currentProjectId || undefined);
        const data = normalizeExecutionArrayEnvelope<FullInitiative>(response, ['initiatives']);

        const executionInitiatives = data.filter((i: FullInitiative) =>
          EXECUTION_STATUSES.includes(i.status)
        );

        setInitiatives(executionInitiatives);
        initRetryRef.current = 0;
      } catch (err: any) {
        console.error('[ExecutionHub] Failed to load:', err);
        const isNetworkError =
          !err?.status ||
          err?.message?.includes('Failed to fetch') ||
          err?.message?.includes('NetworkError');
        if (isNetworkError && initRetryRef.current < 3) {
          initRetryRef.current++;
          const delay = Math.min(2000 * Math.pow(2, initRetryRef.current - 1), 8000);
          console.warn(
            `[ExecutionHub] Network error, retrying in ${delay}ms (attempt ${initRetryRef.current}/3)`
          );
          setTimeout(loadInitiatives, delay);
          return;
        }
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
        setRiskSignals(normalizeExecutionArrayEnvelope<RiskSignalItem>(data, ['signals']));
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
        setDelaySignals(normalizeExecutionArrayEnvelope<DelaySignalItem>(data, ['signals']));
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
        setOverspendSignals(
          normalizeExecutionArrayEnvelope<(typeof overspendSignals)[number]>(data, ['signals'])
        );
      } catch {
        setOverspendSignals([]);
      }
    };
    setIsLoadingControlSignals(true);
    void Promise.allSettled([
      loadRiskSignals(),
      loadDelaySignals(),
      loadOverspendSignals(),
    ]).finally(() => setIsLoadingControlSignals(false));
  }, [currentProjectId, executionTruthRefreshKey]);

  useEffect(() => {
    const LANES = [
      'action-queue',
      'decisions',
      'blockers',
      'workload',
      'risk',
      'people-change',
    ] as const;
    const pid = currentProjectId || undefined;
    Promise.allSettled(
      LANES.map(async (laneId) => {
        try {
          const resp = await V8ExecutionControlApi.getManagerProblems(laneId, pid);
          const data = (resp as any)?.data || resp;
          const problems: Array<{ severity: string }> = data?.problems || [];
          return {
            laneId,
            total: problems.length,
            critical: problems.filter((p) => p.severity === 'critical').length,
            warning: problems.filter((p) => p.severity === 'warning').length,
          };
        } catch {
          return { laneId, total: 0, critical: 0, warning: 0 };
        }
      })
    ).then((results) => {
      const counts: Record<string, { total: number; critical: number; warning: number }> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') {
          counts[r.value.laneId] = {
            total: r.value.total,
            critical: r.value.critical,
            warning: r.value.warning,
          };
        }
      }
      setManagerLaneCounts(counts);
    });
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

        const normalizedWarnings = normalizeExecutionArrayEnvelope<GovernedTimelineWarning>(
          warningsData,
          ['warnings']
        );
        setTimelineWarnings(normalizedWarnings);
        setTimelineWarningTotal(
          Number((warningsData as { total?: number } | null)?.total ?? normalizedWarnings.length)
        );
        setCapacityAlerts(
          normalizeExecutionArrayEnvelope<GovernedCapacityAlert>(alertsData, ['alerts'])
        );
        setCapacityTimeline(
          normalizeExecutionArrayEnvelope<GovernedCapacityWeek>(timelineData, ['weeks'])
        );
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
        setTasks(normalizeExecutionArrayEnvelope<Task>(data, ['tasks']));
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
        const data = normalizeExecutionArrayEnvelope<any>(response, ['decisions']);
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
  }, [currentProjectId, executionTruthRefreshKey]);

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

  const refreshExecutionAfterWrite = useCallback(async () => {
    await refreshExecutionWriteTruth({
      activeTab,
      currentProjectId,
      queueExecutionTruthRefresh,
      refreshExecutiveSnapshot: loadExecutiveSnapshot,
    });
  }, [activeTab, currentProjectId, loadExecutiveSnapshot, queueExecutionTruthRefresh]);

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

  const matchesAttentionPreset = useCallback(
    (
      initiative: FullInitiative,
      attention: 'blocked' | 'missing_dates' | 'overdue' | 'overdue_decisions' | 'due_soon_tasks'
    ) => {
      if (attention === 'blocked') {
        return initiative.status === InitiativeStatus.BLOCKED;
      }
      if (attention === 'missing_dates') {
        return !initiative.plannedStartDate || !initiative.plannedEndDate;
      }
      if (attention === 'overdue') {
        if (!initiative.plannedEndDate && !initiative.slaDeadline) return false;
        const deadline = initiative.slaDeadline || initiative.plannedEndDate!;
        const isOverdue = new Date(deadline) < new Date();
        const terminal =
          initiative.status === InitiativeStatus.DONE ||
          initiative.status === InitiativeStatus.ARCHIVED;
        return isOverdue && !terminal;
      }
      if (attention === 'overdue_decisions') {
        const related = decisionsByInitiative[initiative.id] || [];
        return related.some(
          (decision) =>
            String(decision.status).toUpperCase() === 'PENDING' && isPastDue(decision.dueDate)
        );
      }
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const relatedTasks = tasksByInitiative[initiative.id] || [];
      return relatedTasks.some((task) => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate).getTime();
        return due >= now && due <= now + sevenDays && normalizeTaskStatus(task.status) !== 'done';
      });
    },
    [decisionsByInitiative, tasksByInitiative]
  );

  const dashboardBaseInitiatives = useMemo(() => {
    let result = initiatives;
    if (scope === 'active') {
      result = result.filter((i) => ACTIVE_EXECUTION_STATUSES.includes(i.status));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => (i.name || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [initiatives, scope, searchQuery]);

  // Filter initiatives for portfolio surfaces only.
  const filteredInitiatives = useMemo(() => {
    let result = dashboardBaseInitiatives;

    activeFilters.forEach((filter) => {
      if (filter.column === 'status') {
        result = result.filter((i) => i.status === filter.value);
      }
      if (filter.column === 'attention') {
        result = result.filter((i) =>
          matchesAttentionPreset(
            i,
            filter.value as
              | 'blocked'
              | 'missing_dates'
              | 'overdue'
              | 'overdue_decisions'
              | 'due_soon_tasks'
          )
        );
      }
    });

    if (activeStatusFilter) {
      result = result.filter((i) => i.status === activeStatusFilter);
    }

    return result;
  }, [dashboardBaseInitiatives, activeFilters, activeStatusFilter, matchesAttentionPreset]);

  const summaryInitiatives = useMemo(() => {
    let result = dashboardBaseInitiatives;
    if (activeStatusFilter) {
      result = result.filter((i) => i.status === activeStatusFilter);
    }
    return result;
  }, [dashboardBaseInitiatives, activeStatusFilter]);

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
        label: t('execution.tabs.execution', 'Portfolio'),
        icon: <LayoutDashboard size={16} />,
        count:
          (stats.blocked ?? 0) +
          decisions.filter(
            (d) => String(d.status).toUpperCase() === 'PENDING' && isPastDue(d.dueDate)
          ).length,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('execution.tabs.reports', 'Raporty'),
        icon: <FileText size={16} />,
      },
      {
        id: 'people_change' as ModuleTab,
        label: t('execution.tabs.peopleChange', 'Manager'),
        icon: <Shield size={16} />,
        count: (stats.blocked ?? 0) + (actionQueueItems?.length ?? 0),
      },
    ],
    [t, filteredInitiatives.length, stats.blocked, tasks.length, decisions, actionQueueItems]
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
          const canMutateStatus = !isPilotParticipant && actions.length > 0;
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
              {canMutateStatus && (
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
    [decisionsByInitiative, handleInlineStatusChange, isPilotParticipant, t, tasksByInitiative]
  );

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
    const showScope = activeTab === 'list';
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

    if (!showScope) {
      return <div className="flex items-center gap-2">{execChip}</div>;
    }

    return (
      <div className="flex items-center gap-2">
        {execChip}
        {scopeToggle}
      </div>
    );
  }, [activeTab, currentProjectId, execSnapshotSource, execTopline, scopeToggle, t]);

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

    const criticalCapacityAlerts = capacityAlerts.filter(
      (alert) => alert.severity === 'critical'
    ).length;
    const warningCapacityAlerts = capacityAlerts.filter(
      (alert) => alert.severity !== 'critical'
    ).length;
    const capacityHealth =
      capacityAlerts.length === 0
        ? 100
        : Math.max(0, 100 - criticalCapacityAlerts * 30 - warningCapacityAlerts * 15);

    const blockedCount = healthSnapshot?.initiatives?.blockedCount ?? stats.blocked;
    const riskHealth = totalInitiatives
      ? Math.max(0, 100 - Math.round((blockedCount / totalInitiatives) * 100))
      : 100;

    const healthScore = Math.round(
      (avgProgress + decisionHealth + capacityHealth + riskHealth) / 4
    );

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

  const handleOpenReport = useCallback((report: { id: string; title: string }) => {
    const docId = `report:${report.id}`;
    const doc: OpenDocument = {
      id: docId,
      type: 'report',
      subType: 'execution',
      name: report.title,
      status: 'DRAFT',
    };
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === docId)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(docId);
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

  const handleMainTabChange = useCallback((tab: ModuleTab) => {
    setActiveTab(tab);
    setActiveDocumentId(null);
    setIsSidePanelOpen(false);
  }, []);

  const handleRemoveFilter = useCallback(
    (id: string) => {
      if (activeTab === 'list') {
        setSummaryFilters((prev) => prev.filter((f) => f.id !== id));
        return;
      }
      if (activeTab === 'reports') {
        setReportFilters((prev) => prev.filter((f) => f.id !== id));
        return;
      }
      setActiveFilters((prev) => prev.filter((f) => f.id !== id));
    },
    [activeTab]
  );

  const handleClearFilters = useCallback(() => {
    if (activeTab === 'list') {
      setSummaryFilters([]);
      return;
    }
    if (activeTab === 'reports') {
      setReportFilters([]);
      return;
    }
    setActiveFilters([]);
  }, [activeTab]);

  const resetExecutionCommandRow = useCallback(() => {
    setActiveStatusFilter(null);
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
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isPilotParticipant) return;
      const { active } = event;
      const taskData = active.data.current;
      if (taskData?.type === 'task') {
        setActiveTask(taskData.task);
      }
    },
    [isPilotParticipant]
  );

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Visual feedback is handled by isOver in KanbanColumn
  }, []);

  // Handle drag end - update task status
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (isPilotParticipant) {
        setActiveTask(null);
        dispatchPilotAccessBlocked({
          href: '/implementation',
        });
        return;
      }
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
    [isPilotParticipant, t, tasks]
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
      if (isPilotParticipant) {
        dispatchPilotAccessBlocked({
          href: '/implementation',
        });
        return;
      }
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
    [activeTab, initiatives, isPilotParticipant, t, viewMode]
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

  const handleCreateInitiative = useCallback(() => {
    if (isPilotParticipant) {
      dispatchPilotAccessBlocked({
        href: '/initiatives',
      });
      return;
    }
    navigate(`${ROUTES.INITIATIVES}?new=1`);
  }, [isPilotParticipant, navigate]);

  const handleInitiativeUpdate = useCallback((updated: FullInitiative) => {
    setInitiatives((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedInitiative((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  const handlePortfolioUpdate = useCallback(
    (updated: PortfolioInitiative) => {
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
      void refreshExecutionAfterWrite();
    },
    [refreshExecutionAfterWrite]
  );

  const handleTimelineUpdate = useCallback(
    async (initiativeId: string, field: string, value: string, reason?: string) => {
      if (isPilotParticipant) {
        dispatchPilotAccessBlocked({
          href: '/implementation',
        });
        return;
      }
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
        await refreshExecutionAfterWrite();
      } catch (e: any) {
        toast.error(
          e?.message || t('execution.toast.timelineUpdateFailed', 'Failed to update timeline')
        );
      }
    },
    [isPilotParticipant, refreshExecutionAfterWrite, t]
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refreshExecutionAfterWrite();
  }, [refreshExecutionAfterWrite]);

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
      setActiveTab('list' as ModuleTab);
      setViewMode('table');
      setActiveDocumentId(null);
      setIsSidePanelOpen(false);
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

    if (activeTab === 'reports') {
      const reportPresets = [
        { id: 'all' as const, label: t('common.all', 'ALL'), count: 11 },
        { id: 'weekly' as const, label: 'Weekly', count: 4 },
        { id: 'monthly' as const, label: 'Monthly', count: 4 },
        { id: 'bi-weekly' as const, label: 'Bi-weekly', count: 2 },
        { id: 'on-demand' as const, label: 'On demand', count: 2 },
        { id: 'sponsor' as const, label: 'Sponsor', count: 5 },
      ];
      return (
        <div className="flex items-center gap-2">
          {reportPresets.map((preset) => {
            const active = reportPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setReportPreset((prev) => (prev === preset.id ? 'all' : preset.id))}
                className={`${chipBase} ${
                  active
                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
                }`}
              >
                {preset.id === 'all' ? (
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                ) : (
                  <FileText size={14} className="text-cyan-400" />
                )}
                <span>{preset.label}</span>
                <span
                  className={`${badgeBase} ${
                    active
                      ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {preset.count}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    const isAttentionActive = (attention: string) =>
      activeFilters.some((f) => f.column === 'attention' && String(f.value) === attention);

    const blockedCount = actionCenter.blocked.length;
    const overdueDecisionsCount = actionCenter.overdueDecisions.length;
    const missingDatesCount = actionCenter.missingDates.length;
    const dueSoonTasksCount = actionCenter.dueSoonTasks.length;
    const allCount = dashboardBaseInitiatives.length;
    const allActive =
      !activeStatusFilter &&
      !isAttentionActive('overdue_decisions') &&
      !isAttentionActive('missing_dates') &&
      !isAttentionActive('due_soon_tasks');
    const executionPresets = [
      {
        id: 'all',
        label: t('common.all', 'ALL'),
        count: allCount,
        active: allActive,
        disabled: false,
        icon: <span className="w-2 h-2 rounded-full bg-slate-400" />,
        onClick: resetExecutionCommandRow,
      },
      {
        id: 'blocked',
        label: t('execution.attention.blocked', 'Blocked'),
        count: blockedCount,
        active: activeStatusFilter === InitiativeStatus.BLOCKED,
        disabled: blockedCount === 0,
        icon: <AlertTriangle size={14} className="text-rose-400" />,
        onClick: () => {
          if (activeStatusFilter === InitiativeStatus.BLOCKED) {
            resetExecutionCommandRow();
            return;
          }
          openInitiativesWithAttention('blocked');
        },
      },
      {
        id: 'overdue_decisions',
        label: t('execution.attention.overdueDecisions', 'Overdue decisions'),
        count: overdueDecisionsCount,
        active: isAttentionActive('overdue_decisions'),
        disabled: overdueDecisionsCount === 0,
        icon: <Scale size={14} className="text-amber-400" />,
        onClick: () => {
          if (isAttentionActive('overdue_decisions')) {
            resetExecutionCommandRow();
            return;
          }
          openInitiativesWithAttention('overdue_decisions');
        },
      },
      {
        id: 'missing_dates',
        label: t('execution.attention.missingDates', 'Missing dates'),
        count: missingDatesCount,
        active: isAttentionActive('missing_dates'),
        disabled: missingDatesCount === 0,
        icon: <Calendar size={14} className="text-yellow-400" />,
        onClick: () => {
          if (isAttentionActive('missing_dates')) {
            resetExecutionCommandRow();
            return;
          }
          openInitiativesWithAttention('missing_dates');
        },
      },
      {
        id: 'due_soon_tasks',
        label: t('execution.attention.dueSoonTasks', 'Due soon tasks'),
        count: dueSoonTasksCount,
        active: isAttentionActive('due_soon_tasks'),
        disabled: dueSoonTasksCount === 0,
        icon: <Clock size={14} className="text-cyan-400" />,
        onClick: () => {
          if (isAttentionActive('due_soon_tasks')) {
            resetExecutionCommandRow();
            return;
          }
          openInitiativesWithAttention('due_soon_tasks');
        },
      },
    ] as const;

    return (
      <div className="flex items-center gap-2">
        {executionPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={preset.onClick}
            disabled={preset.disabled}
            className={`${chipBase} ${
              preset.active
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : preset.disabled
                  ? 'bg-slate-100/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-navy-700/40 cursor-not-allowed'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title={preset.label}
          >
            {preset.icon}
            <span>{preset.label}</span>
            <span
              className={`${badgeBase} ${
                preset.active
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {preset.count}
            </span>
          </button>
        ))}
      </div>
    );
  }, [
    activeTab,
    actionCenter,
    actionQueueItems.length,
    activeFilters,
    activeStatusFilter,
    dashboardBaseInitiatives.length,
    openInitiativesWithAttention,
    reportPreset,
    resetExecutionCommandRow,
    riskSignals.length,
    t,
    tasks.length,
  ]);

  // ---------------------------------------------------------------------------
  // RAPORTY — pre-defined report catalog (§5 of EXECUTION_SURFACES spec)
  // Every report declares: audience, cadence, scope, data sources,
  // mandatory sections, RAG/confidence logic, expected follow-up actions.
  // ---------------------------------------------------------------------------
  const reportCatalog = useMemo((): Array<
    Omit<
      ReportDef,
      | 'aiExecutiveReadout'
      | 'aiRecommendedActions'
      | 'dataQuality'
      | 'degradedFlags'
      | 'lastRefreshAt'
      | 'scenarioNotes'
    >
  > => {
    const blocked = actionCenter.blocked.length;
    const overdueDecisionCount = actionCenter.overdueDecisions.length;
    const missingDatesCount = actionCenter.missingDates.length;
    const totalTasks = tasks.length;
    const pendingDecisions = decisions.filter(
      (d) => String(d.status).toUpperCase() === 'PENDING'
    ).length;
    const totalInitiatives = dashboardBaseInitiatives.length;
    const progressPct = execSnapshot?.overview?.progressPercent ?? null;

    return [
      {
        id: 'weekly-exec',
        title: 'Weekly Execution Pack',
        audience: 'PMO, Team Leads',
        cadence: 'Weekly',
        scope: 'All active initiatives in current execution cycle',
        dataSources: ['Initiatives', 'Tasks', 'Decisions', 'Risk signals', 'Milestones'],
        sections: [
          'Progress summary',
          'Blockers & escalations',
          'Overdue items',
          'Next milestones',
          'Key decisions needed',
        ],
        ragLogic:
          'GREEN if no blockers and progress on-track; AMBER if overdue items >0 or progress <5% this week; RED if blockers >0',
        followUpActions: [
          'Clear blockers',
          'Resolve overdue decisions',
          'Update missing dates',
          'Reassign stale tasks',
        ],
        icon: <CalendarDays size={18} className="text-cyan-500" />,
        highlights: [
          { label: 'Progress', value: progressPct !== null ? `${progressPct}%` : '—' },
          { label: 'Blocked', value: blocked, variant: blocked > 0 ? 'critical' : 'default' },
          { label: 'Tasks', value: totalTasks },
        ],
      },
      {
        id: 'monthly-pmo',
        title: 'Monthly PMO Review',
        audience: 'PMO Director, Sponsors',
        cadence: 'Monthly',
        scope: 'Full portfolio month-over-month trends',
        dataSources: ['Initiatives', 'Budget', 'Milestones', 'Baseline/forecast', 'Capacity'],
        sections: [
          'Portfolio trend (MoM)',
          'Milestone slippage summary',
          'Budget variance',
          'Delivery confidence',
          'Capacity utilization overview',
        ],
        ragLogic:
          'GREEN if all initiatives on-track; AMBER if >20% initiatives amber; RED if any initiative RED or budget variance >15%',
        followUpActions: [
          'Rebaseline slipped initiatives',
          'Escalate budget overruns',
          'Rebalance overloaded resources',
        ],
        icon: <TrendingUp size={18} className="text-indigo-500" />,
        highlights: [
          { label: 'Initiatives', value: totalInitiatives },
          {
            label: 'Missing dates',
            value: missingDatesCount,
            variant: missingDatesCount > 0 ? 'warn' : 'default',
          },
        ],
      },
      {
        id: 'program-health',
        title: 'Program Health Summary',
        audience: 'Steering Committee',
        cadence: 'Bi-weekly',
        scope: 'Per-initiative RAG and aggregate program health',
        dataSources: [
          'Initiatives',
          'Risk signals',
          'Delay signals',
          'Priority alerts',
          'Exec snapshot',
        ],
        sections: [
          'RAG per initiative',
          'Priority alerts',
          'Confidence score & trend',
          'Executive narrative',
          'Required governance decisions',
        ],
        ragLogic:
          'GREEN if confidence >70% and no critical alerts; AMBER if confidence 40-70% or critical alerts exist; RED if confidence <40% or multiple critical blockers',
        followUpActions: [
          'Review RED initiatives',
          'Approve recovery plans',
          'Authorize resource reallocation',
        ],
        icon: <Shield size={18} className="text-emerald-500" />,
        highlights: [
          { label: 'Blocked', value: blocked, variant: blocked > 0 ? 'critical' : 'default' },
          { label: 'Progress', value: progressPct !== null ? `${progressPct}%` : '—' },
        ],
      },
      {
        id: 'blockers-recovery',
        title: 'Blockers & Recovery Report',
        audience: 'PMO, Delivery Managers',
        cadence: 'On demand',
        scope: 'All blocked initiatives and downstream blast radius',
        dataSources: ['Blocked initiatives', 'Dependencies', 'Tasks', 'Risk register'],
        sections: [
          'Active blockers list',
          'Blast radius per blocker',
          'Owner accountability',
          'Recovery actions proposed',
          'Dependency chain impact',
        ],
        ragLogic:
          'RED if any blockers; AMBER if blockers existed in last 7 days; GREEN if clear for >7 days',
        followUpActions: [
          'Assign blocker owners',
          'Remove external dependencies',
          'Escalate to governance',
          'Replan affected work',
        ],
        icon: <AlertTriangle size={18} className="text-rose-500" />,
        highlights: [
          { label: 'Blocked', value: blocked, variant: blocked > 0 ? 'critical' : 'default' },
          { label: 'Due soon', value: actionCenter.dueSoonTasks.length },
        ],
      },
      {
        id: 'milestone-slippage',
        title: 'Milestone Slippage Report',
        audience: 'PMO, Sponsors',
        cadence: 'Weekly',
        scope: 'All milestones with baseline vs forecast drift',
        dataSources: ['Milestones', 'Baseline', 'Forecast', 'Delay signals'],
        sections: [
          'Slipped milestones',
          'Drift by initiative',
          'Root cause analysis',
          'Forecast accuracy trend',
          'Recovery timeline',
        ],
        ragLogic:
          'GREEN if no milestones slipped >3 days; AMBER if 1-2 milestones slipped; RED if >2 milestones slipped or any critical milestone missed',
        followUpActions: [
          'Rebaseline slipped milestones',
          'Add recovery buffer',
          'Escalate critical misses',
        ],
        icon: <Clock size={18} className="text-amber-500" />,
        highlights: [
          {
            label: 'Missing dates',
            value: missingDatesCount,
            variant: missingDatesCount > 0 ? 'warn' : 'default',
          },
        ],
      },
      {
        id: 'capacity-utilization',
        title: 'Capacity Utilization Report',
        audience: 'Resource Managers, PMO',
        cadence: 'Monthly',
        scope: 'Per-person and per-team workload vs capacity',
        dataSources: ['Tasks', 'Assignments', 'Capacity', 'Workload view'],
        sections: [
          'Utilization by person',
          'Team averages',
          'Overload alerts',
          'Underutilized resources',
          'Capacity horizon (4-week lookahead)',
        ],
        ragLogic:
          'GREEN if all <85% utilized; AMBER if anyone 85-100%; RED if anyone >100% or team average >90%',
        followUpActions: [
          'Smooth overloaded assignments',
          'Redistribute idle capacity',
          'Flag resource gaps to hiring',
        ],
        icon: <Users size={18} className="text-violet-500" />,
        highlights: [{ label: 'Tasks', value: totalTasks }],
      },
      {
        id: 'budget-variance',
        title: 'Budget Variance Report',
        audience: 'Finance, Sponsors',
        cadence: 'Monthly',
        scope: 'Planned vs actual budget per initiative',
        dataSources: ['Budget', 'Initiatives', 'Overspend signals'],
        sections: [
          'Aggregate budget status',
          'Per-initiative variance',
          'Forecast overshoot alerts',
          'Burn rate trend',
          'Cost category breakdown',
        ],
        ragLogic:
          'GREEN if variance <5%; AMBER if 5-15%; RED if >15% overspend or forecast exceeds approved budget',
        followUpActions: [
          'Review overspending initiatives',
          'Request budget reallocation',
          'Freeze discretionary spend',
        ],
        icon: <TrendingUp size={18} className="text-green-500" />,
        highlights: [{ label: 'Initiatives', value: totalInitiatives }],
      },
      {
        id: 'decision-backlog',
        title: 'Decision Backlog & Approval Aging',
        audience: 'PMO, Decision Owners',
        cadence: 'Weekly',
        scope: 'All pending decisions and approval age',
        dataSources: ['Decisions', 'Action queue', 'Initiative dependencies'],
        sections: [
          'Pending decisions list',
          'Aging histogram',
          'Decision-latency risk',
          'Accountability gaps',
          'Downstream blocked work',
        ],
        ragLogic:
          'GREEN if no decisions overdue; AMBER if 1-3 overdue; RED if >3 overdue or any blocking critical path',
        followUpActions: [
          'Escalate aged decisions',
          'Assign decision owners',
          'Unblock dependent work',
        ],
        icon: <Scale size={18} className="text-amber-600" />,
        highlights: [
          {
            label: 'Overdue',
            value: overdueDecisionCount,
            variant: overdueDecisionCount > 0 ? 'warn' : 'default',
          },
          { label: 'Pending', value: pendingDecisions },
        ],
      },
      {
        id: 'cross-dependency',
        title: 'Cross-Initiative Dependency Report',
        audience: 'PMO, Architects',
        cadence: 'Bi-weekly',
        scope: 'Inter-initiative dependency graph and cascade risk',
        dataSources: ['Dependencies', 'Initiatives', 'Risk signals'],
        sections: [
          'Dependency map',
          'Critical path',
          'Cascade impact analysis',
          'Dependency health',
          'External dependency risks',
        ],
        ragLogic:
          'GREEN if no dependency conflicts; AMBER if dependencies at risk; RED if broken dependency chain on critical path',
        followUpActions: [
          'Resolve dependency conflicts',
          'Decouple tightly coupled work',
          'Add buffers to critical chains',
        ],
        icon: <GripVertical size={18} className="text-slate-500" />,
        highlights: [{ label: 'Initiatives', value: totalInitiatives }],
      },
      {
        id: 'delivery-confidence',
        title: 'Delivery Confidence Report',
        audience: 'Steering Committee, Sponsors',
        cadence: 'Monthly',
        scope: 'Risk-adjusted delivery forecast with confidence scoring',
        dataSources: ['Initiatives', 'Risk signals', 'Delay signals', 'Budget', 'Exec snapshot'],
        sections: [
          'Confidence per initiative',
          'Trend direction',
          'Risk-adjusted forecast',
          'Sponsor-ready narrative',
          'Recommended governance actions',
        ],
        ragLogic:
          'GREEN if aggregate confidence >75%; AMBER if 50-75%; RED if <50% or confidence declining for 2+ periods',
        followUpActions: [
          'Investigate declining confidence',
          'Approve recovery plans',
          'Communicate revised timelines',
        ],
        icon: <Sparkles size={18} className="text-cyan-500" />,
        highlights: [
          { label: 'Progress', value: progressPct !== null ? `${progressPct}%` : '—' },
          { label: 'Blocked', value: blocked, variant: blocked > 0 ? 'critical' : 'default' },
        ],
      },
      {
        id: 'sponsor-onepager',
        title: 'Sponsor-Ready One-Pager',
        audience: 'Executive Sponsors',
        cadence: 'On demand',
        scope: 'Concise executive summary of portfolio state',
        dataSources: ['Exec snapshot', 'Initiatives', 'Risk signals', 'Milestones'],
        sections: [
          'Overall progress',
          'Top 3 risks',
          'Next milestones',
          'Decisions required from sponsor',
          'Key achievements this period',
        ],
        ragLogic: 'Mirrors program health RAG: composite of progress, blockers and confidence',
        followUpActions: [
          'Make requested decisions',
          'Remove escalated blockers',
          'Approve budget changes',
        ],
        icon: <FileText size={18} className="text-indigo-500" />,
        highlights: [{ label: 'Progress', value: progressPct !== null ? `${progressPct}%` : '—' }],
      },
    ];
  }, [actionCenter, tasks.length, decisions, dashboardBaseInitiatives.length, execSnapshot]);

  const reportDataContext = useMemo(
    (): ReportDataContext => ({
      initiatives: dashboardBaseInitiatives.map((i) => ({
        id: i.id,
        name: i.name,
        status: i.status,
        health: initiativeHealthMap.get(i.id)?.health,
        progress: (i as any).progressPercent ?? (i as any).progress,
        owner: (i as any).ownerName || (i as any).owner?.name,
        targetDate: (i as any).plannedEndDate || (i as any).targetDate || (i as any).endDate,
        priority: (i as any).priority,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: (t as any).priority,
        dueDate: t.dueDate,
        assigneeName: (t as any).assigneeName || (t as any).assignee?.name,
        initiativeId: (t as any).initiativeId,
        initiativeName: (t as any).initiativeName,
      })),
      decisions: decisions.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        priority: (d as any).priority,
        dueDate: (d as any).dueDate,
        ownerName: (d as any).ownerName || (d as any).owner?.name,
        relatedObjectId: (d as any).relatedObjectId,
      })),
      blocked: actionCenter.blocked.map((i) => ({
        id: i.id,
        name: i.name,
        reason: (i as any).blockedReason,
      })),
      riskSignals: riskSignals.map((r) => ({
        id: (r as any).id,
        title: r.title,
        initiativeName: r.initiativeName,
        severity: r.severity,
        description: r.description,
        suggestedAction: r.suggestedAction,
      })),
      delaySignals: delaySignals.map((d) => ({
        entityName: d.entityName,
        deviationType: d.deviationType,
        daysDeviation: d.daysDeviation,
        severity: d.severity,
      })),
      overdueDecisions: actionCenter.overdueDecisions.map((d) => ({
        id: d.id,
        title: d.title,
        ownerName: (d as any).ownerName || (d as any).owner?.name,
        dueDate: (d as any).dueDate,
      })),
      missingDates: actionCenter.missingDates.map((i) => ({ id: i.id, name: i.name })),
      dueSoonTasks: actionCenter.dueSoonTasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: (t as any).dueDate,
        assigneeName: (t as any).assigneeName,
      })),
      overspendSignals,
      nextMilestones: execSnapshot?.overview?.nextMilestones ?? [],
      priorityAlerts: execSnapshot?.overview?.priorityAlerts ?? [],
      timelineWarnings,
      capacityAlerts,
      capacityTimeline,
      phaseLabel: execSnapshot?.overview?.phaseLabel,
      progressPercent: execSnapshot?.overview?.progressPercent ?? null,
      totalInitiatives: dashboardBaseInitiatives.length,
      lastRefreshAt: execSnapshot?.generatedAt,
    }),
    [
      dashboardBaseInitiatives,
      tasks,
      decisions,
      actionCenter,
      riskSignals,
      delaySignals,
      overspendSignals,
      execSnapshot,
      initiativeHealthMap,
      timelineWarnings,
      capacityAlerts,
      capacityTimeline,
    ]
  );

  const enrichedReportCatalog = useMemo(
    () => reportCatalog.map((report) => enrichExecutionReport(report, reportDataContext)),
    [reportCatalog, reportDataContext]
  );

  const filteredReportCatalog = useMemo(() => {
    let result = enrichedReportCatalog;
    if (reportPreset === 'weekly') {
      result = result.filter((report) => report.cadence === 'Weekly');
    } else if (reportPreset === 'monthly') {
      result = result.filter((report) => report.cadence === 'Monthly');
    } else if (reportPreset === 'bi-weekly') {
      result = result.filter((report) => report.cadence === 'Bi-weekly');
    } else if (reportPreset === 'on-demand') {
      result = result.filter((report) => report.cadence === 'On demand');
    } else if (reportPreset === 'sponsor') {
      result = result.filter(
        (report) => /sponsor/i.test(report.audience) || /sponsor/i.test(report.title)
      );
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (report) =>
          report.title.toLowerCase().includes(query) ||
          report.audience.toLowerCase().includes(query) ||
          report.cadence.toLowerCase().includes(query)
      );
    }
    return result;
  }, [enrichedReportCatalog, reportPreset, searchQuery]);

  // MANAGER — operator cockpit
  // ---------------------------------------------------------------------------
  const managerMetrics = useMemo(() => {
    const kpiAlerts = actionQueueItems.filter(
      (item) => item.type === 'kpi_deviation_no_plan'
    ).length;
    const overdueItems = actionQueueItems.filter(
      (item) => item.type === 'decision_overdue' || item.type === 'comm_overdue'
    ).length;
    const blockedCount = actionCenter.blocked.length;
    const missingDatesCount = actionCenter.missingDates.length;
    return { kpiAlerts, overdueItems, blockedCount, missingDatesCount };
  }, [actionQueueItems, actionCenter]);

  const interventionSuggestions = useMemo(() => {
    const suggestions: {
      id: string;
      action: string;
      reason: string;
      expected: string;
      icon: React.ReactNode;
      severity: 'high' | 'medium' | 'low';
    }[] = [];

    if (managerMetrics.blockedCount > 0) {
      suggestions.push({
        id: 'unblock',
        action: t('execution.manager.suggestions.unblock', 'Resolve blockers'),
        reason: t(
          'execution.manager.suggestions.unblockReason',
          '{{count}} initiative(s) blocked — delivery stalled.',
          { count: managerMetrics.blockedCount }
        ),
        expected: t(
          'execution.manager.suggestions.unblockExpected',
          'Unblocked initiatives resume delivery.'
        ),
        icon: <AlertTriangle size={14} className="text-rose-500" />,
        severity: 'high',
      });
    }

    if (managerMetrics.overdueItems > 0) {
      suggestions.push({
        id: 'escalate-decisions',
        action: t('execution.manager.suggestions.escalate', 'Escalate overdue decisions'),
        reason: t(
          'execution.manager.suggestions.escalateReason',
          '{{count}} approval(s) past due — blocking downstream work.',
          { count: managerMetrics.overdueItems }
        ),
        expected: t(
          'execution.manager.suggestions.escalateExpected',
          'Decision queue clears, dependent tasks unblock.'
        ),
        icon: <Scale size={14} className="text-amber-500" />,
        severity: 'high',
      });
    }

    if (managerMetrics.missingDatesCount > 0) {
      suggestions.push({
        id: 'fill-dates',
        action: t('execution.manager.suggestions.replan', 'Fill missing dates'),
        reason: t(
          'execution.manager.suggestions.replanReason',
          '{{count}} initiative(s) have no target date — timeline invisible.',
          { count: managerMetrics.missingDatesCount }
        ),
        expected: t(
          'execution.manager.suggestions.replanExpected',
          'Timeline becomes credible; slippage detection activates.'
        ),
        icon: <Clock size={14} className="text-cyan-500" />,
        severity: 'medium',
      });
    }

    if (managerMetrics.kpiAlerts > 0) {
      suggestions.push({
        id: 'address-kpi',
        action: t(
          'execution.manager.suggestions.addressKpi',
          'Create recovery plans for KPI deviations'
        ),
        reason: t(
          'execution.manager.suggestions.addressKpiReason',
          '{{count}} KPI deviation(s) without a plan.',
          { count: managerMetrics.kpiAlerts }
        ),
        expected: t(
          'execution.manager.suggestions.addressKpiExpected',
          'Deviations get action plans, confidence improves.'
        ),
        icon: <Target size={14} className="text-fuchsia-500" />,
        severity: 'medium',
      });
    }

    if (actionCenter.dueSoonTasks.length > 3) {
      suggestions.push({
        id: 'smooth-workload',
        action: t('execution.manager.suggestions.smooth', 'Rebalance upcoming workload'),
        reason: t(
          'execution.manager.suggestions.smoothReason',
          '{{count}} tasks due soon — potential resource crunch.',
          { count: actionCenter.dueSoonTasks.length }
        ),
        expected: t(
          'execution.manager.suggestions.smoothExpected',
          'Workload spread evenly; no single-point overload.'
        ),
        icon: <Users size={14} className="text-violet-500" />,
        severity: 'low',
      });
    }

    return suggestions;
  }, [t, managerMetrics, actionCenter.dueSoonTasks.length]);

  // managerDataContext removed — ManagerModuleView now fetches its own data via API

  const handleGenerateReport = useCallback(
    async (report: ReportDef) => {
      const prompt = `Generate an execution report for "${report.title}".
Audience: ${report.audience}
Cadence: ${report.cadence}
Scope: ${report.scope}
Top metrics: ${report.highlights.map((item) => `${item.label}=${item.value}`).join(', ')}
Top exceptions: blockers=${actionCenter.blocked.length}, overdue decisions=${actionCenter.overdueDecisions.length}, missing dates=${actionCenter.missingDates.length}, due soon tasks=${actionCenter.dueSoonTasks.length}
Degraded flags: ${report.degradedFlags.length > 0 ? report.degradedFlags.join(', ') : 'none'}
Known limitations: ${(report.dataQuality.knownLimitations ?? []).length > 0 ? (report.dataQuality.knownLimitations ?? []).join(' | ') : 'none'}
Mandatory sections: ${report.sections.join(', ')}
Existing AI readout: ${report.aiExecutiveReadout.join(' ')}
Expected follow-up actions: ${report.followUpActions.join(', ')}

Please return:
1. a concise executive readout grounded in the data,
2. concrete owner-based actions with timing,
3. any caveats caused by degraded data posture.`;
      try {
        const convId = await openChatWithContext({
          entityType: 'execution_report' as any,
          entityId: report.id,
          entityName: report.title,
          contextData: {
            reportId: report.id,
            scope: report.scope,
            audience: report.audience,
            cadence: report.cadence,
            highlights: report.highlights,
            degradedFlags: report.degradedFlags,
            dataQuality: report.dataQuality,
          },
        });
        await addChatMessage({ conversationId: convId, role: 'user', content: prompt } as any);
        toast.success(
          t('execution.reportCatalog.generating', 'Generating "{{title}}"…', {
            title: report.title,
          }),
          { duration: 2000 }
        );
        if (isChatCollapsed) toggleChatCollapse();
      } catch {
        toast.error(t('execution.reportCatalog.generateError', 'Failed to generate report'));
      }
    },
    [actionCenter, openChatWithContext, addChatMessage, t, isChatCollapsed, toggleChatCollapse]
  );

  const reportColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('execution.reportCatalog.col.title', 'Report'),
        render: (row: any) => {
          const r = row as ReportDef;
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-800">
                {r.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {r.title}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {r.audience}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'cadence',
        label: t('execution.reportCatalog.col.cadence', 'Cadence'),
        width: '100px',
        render: (row: any) => (
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {(row as ReportDef).cadence}
          </span>
        ),
      },
      {
        id: 'highlights',
        label: t('execution.reportCatalog.col.data', 'Live Data'),
        width: '200px',
        render: (row: any) => {
          const r = row as ReportDef;
          return (
            <div className="flex flex-wrap gap-1">
              {r.highlights.slice(0, 3).map((h) => (
                <span
                  key={h.label}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    h.variant === 'critical'
                      ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                      : h.variant === 'warn'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {h.label}: {h.value}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        id: 'sections',
        label: t('execution.reportCatalog.col.sections', 'Sections'),
        width: '60px',
        render: (row: any) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {(row as ReportDef).sections.length}
          </span>
        ),
      },
    ],
    [t]
  );

  const renderReportPreviewBody = useCallback((report: ReportDef) => {
    const rag = computeRAG(report);
    const ragConf = RAG_CONFIG[rag];
    const RagIcon = ragConf.icon;
    return (
      <div className="p-4 space-y-4 overflow-auto">
        {/* RAG badge + title */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${ragConf.bg} ${ragConf.text} ${ragConf.border} border`}
            >
              <RagIcon size={10} className="inline mr-1 -mt-0.5" />
              {ragConf.label}
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {report.cadence}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-navy-800">
              {report.icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {report.title}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {report.audience}
              </div>
            </div>
          </div>
        </div>

        {/* Live highlights */}
        {report.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {report.highlights.map((h) => (
              <span
                key={h.label}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                  h.variant === 'critical'
                    ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                    : h.variant === 'warn'
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {h.label}: {h.value}
              </span>
            ))}
          </div>
        )}

        {/* Scope */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            Scope
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {report.scope}
          </p>
        </div>

        {/* Data sources */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            Data Sources
          </div>
          <div className="flex flex-wrap gap-1">
            {report.dataSources.map((ds) => (
              <span
                key={ds}
                className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-[10px] text-slate-600 dark:text-slate-400"
              >
                {ds}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            AI Executive Readout
          </div>
          <div className="space-y-1.5">
            {report.aiExecutiveReadout.slice(0, 3).map((line) => (
              <div
                key={line}
                className="rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-2 text-[11px] text-slate-600 dark:text-slate-300"
              >
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Mandatory sections */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            Mandatory Sections
          </div>
          <ol className="space-y-0.5 list-decimal list-inside">
            {report.sections.map((s) => (
              <li key={s} className="text-[11px] text-slate-600 dark:text-slate-400">
                {s}
              </li>
            ))}
          </ol>
        </div>

        {/* RAG logic */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            RAG / Confidence Logic
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            {report.ragLogic}
          </p>
        </div>

        {/* Follow-up actions */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            Expected Follow-up Actions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.followUpActions.map((a) => (
              <span
                key={a}
                className="inline-block px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-900/20 text-[10px] font-medium text-cyan-700 dark:text-cyan-300"
              >
                {a}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 font-medium">
            Data Quality
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-[10px] text-slate-600 dark:text-slate-400">
              {report.dataQuality.confidence}
            </span>
            {report.degradedFlags.map((flag) => (
              <span
                key={flag}
                className="inline-block px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-[10px] text-violet-700 dark:text-violet-300"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }, []);

  const handleGenerateInWordy = useCallback(
    (report: ReportDef) => {
      navigate(`/wordy?sourceType=execution_report&sourceId=${encodeURIComponent(report.id)}`);
    },
    [navigate]
  );

  const renderReportPreviewFooter = useCallback(
    (report: ReportDef) => {
      const rag = computeRAG(report);
      return (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 dark:border-navy-800">
          <button
            type="button"
            onClick={() => handleGenerateReport(report)}
            className="h-8 px-4 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors"
          >
            {t('execution.reportPanel.generateAI', 'Generate with AI')}
          </button>
          <button
            type="button"
            onClick={() => handleGenerateInWordy(report)}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-brand/40 text-brand hover:bg-brand/5 dark:border-brand/50 dark:text-brand dark:hover:bg-brand/10 transition-colors"
          >
            {t('execution.reportPanel.generateInWordy', 'Generate in Wordy')}
          </button>
          <button
            type="button"
            onClick={() => {
              exportReportPDF(report, rag);
              toast.success(t('execution.reportPanel.pdfExported', 'PDF downloaded'));
            }}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={() => {
              const md = buildReportMarkdown(report, rag);
              navigator.clipboard.writeText(md).then(
                () => toast.success(t('execution.reportPanel.copied', 'Copied')),
                () => toast.error(t('execution.reportPanel.copyFailed', 'Copy failed'))
              );
            }}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {t('execution.reportPanel.copy', 'Copy')}
          </button>
        </div>
      );
    },
    [handleGenerateReport, handleGenerateInWordy, t]
  );

  const renderReportsCatalog = () => {
    if (reportDataContext.totalInitiatives === 0) {
      return (
        <div className="p-4">
          <Callout
            variant="info"
            title={t('execution.reportCatalog.noData', 'No execution data yet')}
          >
            {t(
              'execution.reportCatalog.noDataDesc',
              'Reports will be populated once initiatives are actively executing. Add initiatives to the portfolio to start generating reports.'
            )}
          </Callout>
        </div>
      );
    }

    if (viewMode === 'table') {
      type ReportRow = ReportDef & { title: string };
      const selectedReportPreviewId = reportPreviewId;
      const selectedReport = selectedReportPreviewId
        ? ((filteredReportCatalog.find((r) => r.id === selectedReportPreviewId) as
            | ReportRow
            | undefined) ?? null)
        : null;
      const reportIds = filteredReportCatalog.map((r) => r.id);

      return (
        <div className="h-full overflow-hidden">
          <TableWithPreviewLayout<ReportRow>
            selectedId={selectedReportPreviewId}
            selectedItem={selectedReport}
            onSelect={setReportPreviewId}
            itemIds={reportIds}
            getItemById={(id) =>
              (filteredReportCatalog.find((r) => r.id === id) as ReportRow) ?? null
            }
            onOpenFull={(id) => {
              const r = filteredReportCatalog.find((x) => x.id === id);
              if (r) handleOpenReport(r);
            }}
            renderPreview={(item) => renderReportPreviewBody(item)}
            renderPreviewFooter={(item) => renderReportPreviewFooter(item)}
          >
            <FilterableTable
              columns={reportColumns}
              data={filteredReportCatalog as any[]}
              selectedRowId={selectedReportPreviewId}
              onRowClick={(row) => setReportPreviewId(String(row.id))}
              onRowDoubleClick={(row) => {
                const r = filteredReportCatalog.find((x) => x.id === row.id);
                if (r) handleOpenReport(r);
              }}
              activeFilters={reportFilters}
              onFilterChange={setReportFilters}
              emptyMessage={t('execution.reportCatalog.noData', 'No reports')}
              canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
              density="compact"
            />
          </TableWithPreviewLayout>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('execution.reportCatalog.heading', 'Execution Reports')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t(
                'execution.reportCatalog.subheading',
                'Pre-defined reports built from live execution data. Click to expand contract, then generate or export.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {t('execution.reportCatalog.openGlobal', 'Global Reports →')}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredReportCatalog.map((report) => {
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => handleOpenReport(report)}
                className="group rounded-xl border bg-white dark:bg-navy-900 transition-all text-left border-slate-200 dark:border-navy-700 hover:border-cyan-500/40 hover:shadow-sm dark:hover:border-cyan-400/30"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-navy-800 group-hover:bg-cyan-50 dark:group-hover:bg-cyan-900/20 transition-colors">
                        {report.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                          {report.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {report.cadence}
                          </span>
                          <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {report.audience}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-slate-300 dark:text-slate-600 transition-transform group-hover:text-cyan-500"
                    />
                  </div>

                  {report.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {report.highlights.map((h) => (
                        <span
                          key={h.label}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            h.variant === 'critical'
                              ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                              : h.variant === 'warn'
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {h.label}: {h.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
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

    if (activeTab === ('people_change' as ModuleTab)) {
      return (
        <ExecutionManagementView
          managerLaneCounts={managerLaneCounts}
          projectId={currentProjectId || undefined}
          searchQuery={searchQuery}
          hasExecutingInitiatives={dashboardBaseInitiatives.length > 0}
          onOpenEntity={
            handleOpenSidePanel
              ? (type, id) => handleOpenSidePanel({ id, name: id } as any)
              : undefined
          }
        />
      );
    }

    if (activeDocumentId) {
      if (activeDocumentId.startsWith('report:')) {
        const reportId = activeDocumentId.replace('report:', '');
        const report = enrichedReportCatalog.find((r) => r.id === reportId);
        if (report) {
          return (
            <ReportDocumentView
              report={report}
              data={reportDataContext}
              onBack={handleShowList}
              onGenerateAI={handleGenerateReport}
            />
          );
        }
      }
      return (
        <InitiativeDocumentView
          initiativeId={activeDocumentId}
          onBack={handleShowList}
          onStatusChange={isPilotParticipant ? undefined : () => handleRefresh()}
          sourceModule="execution"
        />
      );
    }

    if (activeTab === 'list') {
      if (viewMode === 'kanban') {
        return (
          <ExecutionInitiativesKanbanView
            initiatives={portfolioInitiatives}
            scope={scope}
            onInitiativeClick={(pi) => {
              const full =
                summaryInitiatives.find((x) => x.id === pi.id) ||
                filteredInitiatives.find((x) => x.id === pi.id);
              if (full) handleOpenSidePanel(full);
            }}
            onStatusChange={(id, status) => handleInlineStatusChange(id, status)}
            readOnly={isPilotParticipant}
          />
        );
      }

      if (viewMode === 'timeline') {
        return (
          <div className="min-h-[420px]">
            <ExecutionTimelineView
              initiatives={
                (summaryInitiatives.length
                  ? summaryInitiatives
                  : filteredInitiatives) as FullInitiative[]
              }
              onInitiativeClick={handleOpenSidePanel}
              onUpdateInitiative={isPilotParticipant ? undefined : handleInitiativeUpdate}
              onTimelineUpdate={isPilotParticipant ? undefined : handleTimelineUpdate}
              onDependenciesChanged={isPilotParticipant ? undefined : handleRefresh}
              riskSignals={riskSignals}
              delaySignals={delaySignals}
              governedTimelineWarnings={timelineWarnings}
              projectId={currentProjectId || undefined}
            />
          </div>
        );
      }

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

    if (activeTab === 'reports') {
      return renderReportsCatalog();
    }

    return null;
  };

  const availableViewModes = useMemo(
    () =>
      activeTab === 'list'
        ? (['table', 'kanban', 'timeline'] as ViewMode[])
        : activeTab === 'reports'
          ? (['table', 'grid'] as ViewMode[])
          : ([] as ViewMode[]),
    [activeTab]
  );

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleMainTabChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSearch={setSearchQuery}
        openDocuments={activeTab === ('people_change' as ModuleTab) ? [] : openDocuments}
        activeDocumentId={activeTab === ('people_change' as ModuleTab) ? null : activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={
          activeTab === ('people_change' as ModuleTab)
            ? []
            : activeTab === 'list'
              ? summaryFilters
              : activeTab === 'reports'
                ? reportFilters
                : activeFilters
        }
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={isPilotParticipant ? undefined : handleCreateInitiative}
        newItemLabel={t('initiatives.form.newInitiative', 'New Initiative')}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
        rightControls={rightControls}
        availableViewModes={availableViewModes}
        commandRowContent={activeTab === ('people_change' as ModuleTab) ? null : commandRowContent}
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
