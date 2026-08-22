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
  ExternalLink,
  FileText,
  GripVertical,
  LayoutDashboard,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rocket,
  Scale,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { GeneratedReportView } from '@/components/Reports/GeneratedReportView';
import {
  generateReportDocument,
  reportDocumentToMarkdown,
} from '@/components/Reports/reportContentGenerator';
import type { ReportConfig } from '@/components/Reports/Wizard';
import { ReportGeneratorWizard } from '@/components/Reports/Wizard';
import { Callout } from '@/components/shared/NModeBlocks';
import { LoadingState } from '@/components/shared/states';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
} from '@/components/standard';
import { DueChip, EntityStatusChip, statusChipTone } from '@/components/ui/primitives/chips';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { ROUTES } from '@/routes/routeConfig';
import {
  Api,
  API_URL,
  clearGlobalTransportFailure,
  getHeaders,
  resetAuthLoopGuard,
} from '@/services/api';
import {
  shouldFallbackToLegacyExecutionControl,
  V8ExecutionControlApi,
} from '@/services/api/v8/execution-control';
import { refreshExecutionWriteTruth } from '@/services/executionWriteTruth';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';
import { useConversationStore } from '@/store/useConversationStore';
import { getArtifactPath } from '@/utils/artifactLinks';
import { mapHubLoadFailureToPresentation } from '@/utils/errors/mapHubLoadFailureToPresentation';
import { dispatchPilotAccessBlocked, isPilotParticipantRole } from '@/utils/pilotAccess';

import { useAppStore } from '../../store/useAppStore';
import { useInitiativeRefreshStore } from '../../store/useInitiativeRefreshStore';
import { FullInitiative, InitiativeStatus, PortfolioInitiative, Task } from '../../types';
import { InitiativeCompactPanel } from '../Initiatives/InitiativeCompactPanel';
import { type InitiativePreviewV3Model } from '../Initiatives/InitiativePreviewV3';
import { PortfolioHealthScore } from '../MyWork/Executive/PortfolioHealthScore';
import {
  FilterChip,
  HubWorkAreaLoadError,
  HubWorkAreaLoading,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import {
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Chip,
} from '../shared/ModuleMenu3';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { ExecutionControlSurface } from './ExecutionControlSurface';
import { ExecutionDeliveryClosurePanel } from './ExecutionDeliveryClosurePanel';
import { isExecutionFlagEnabled } from './executionFeatureFlags';
import { ExecutionManagementView } from './ExecutionManagementView';
import { normalizeExecutionArrayEnvelope } from './executionPayloadGuards';
import { ExecutionRealizationsSurface } from './ExecutionRealizationsSurface';
import {
  buildReportMarkdown,
  computeRAG,
  enrichExecutionReport,
  exportReportPDF,
  RAG_CONFIG,
  type ReportDataContext,
  type ReportDef,
} from './executionReports';
import { ExecutionReportsSurface } from './ExecutionReportsSurface';
import { ExecutionResourcesSurface } from './ExecutionResourcesSurface';
import ExecutionSummaryOneLook from './ExecutionSummaryOneLook';
import type { DelaySignalItem, RiskSignalItem } from './ExecutionTimelineView';
import { ExecutionWorkloadView } from './ExecutionWorkloadView';
import { ExecutionWorkSurface } from './ExecutionWorkSurface';
import { ReportDocumentView } from './ReportDocumentView';
import { RolloutTab } from './RolloutTab';

const ExecutionInitiativeDocumentView = React.lazy(() =>
  import('../Initiatives/InitiativeDocumentView').then((module) => ({
    default: module.InitiativeDocumentView,
  }))
);

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
  /** 0..100; org-wide average utilization for that week (real data from
   * workloadCapacityService — #77 wiring fix 2026-07-19). Optional so older
   * cached/legacy payloads without it still type-check. */
  utilizationPercent?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
   F5 kontrakt — rejestr definicji raportów (report_definitions / reportContract.ts)
   Definicja katalogu Execution płynie z bazy (GET /api/report-builder/definitions),
   NIE z hardkodu. read_mode='live' (tryb 2): baza niesie „jakie raporty + jak je czytać"
   (metric+variant), a wartości metryk liczymy na żywo tutaj. Fallback: gdy API puste
   (np. przed uruchomieniem migracji 910) używamy wbudowanego katalogu — ekran nie pada.
   ──────────────────────────────────────────────────────────────────────────── */

interface ReportDefinitionDto {
  id: string;
  name: string;
  audience: string | null;
  cadence: string | null;
  scope: string | null;
  readMode?: string;
  sections: string[];
  sourceBinding: {
    dataSources?: string[];
    ragLogic?: string;
    followUpActions?: string[];
    icon?: { name?: string; className?: string };
    highlights?: Array<{
      label: string;
      metric?: string;
      value?: string | number;
      variant?: string;
    }>;
  };
}

const REPORT_DEF_ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  CalendarDays,
  TrendingUp,
  Shield,
  AlertTriangle,
  Clock,
  Users,
  Scale,
  GripVertical,
  Sparkles,
  FileText,
};

/**
 * Rehydracja pojedynczego highlightu definicji do live-wartości.
 * `metric` mapuje na policzoną na żywo liczbę; tokeny `critIfPos`/`warnIfPos`
 * zamieniają się w wariant zależnie od tego, czy liczba jest dodatnia.
 */
function resolveDefinitionHighlight(
  h: { label: string; metric?: string; value?: string | number; variant?: string },
  metrics: Record<string, number>,
  progressLabel: string
): { label: string; value: string | number; variant?: 'default' | 'warn' | 'critical' } {
  let value: string | number;
  if (h.metric === 'progress') value = progressLabel;
  else if (h.metric && h.metric in metrics) value = metrics[h.metric];
  else value = h.value ?? '—';

  const numeric = typeof value === 'number' ? value : 0;
  let variant: 'default' | 'warn' | 'critical' = 'default';
  if (h.variant === 'critIfPos') variant = numeric > 0 ? 'critical' : 'default';
  else if (h.variant === 'warnIfPos') variant = numeric > 0 ? 'warn' : 'default';
  else if (h.variant === 'critical' || h.variant === 'warn') variant = h.variant;

  return { label: h.label, value, variant };
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
      className={`p-3 bg-c-surface-raised border border-c-border-subtle rounded-lg hover:border-c-border-strong transition-colors cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-lg ring-2 ring-c-accent/40' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-c-text-muted flex-shrink-0" />
          <h4 className="text-sm font-medium text-c-text line-clamp-2">{task.title}</h4>
        </div>
        {isPastDue(task.dueDate) && (
          <span className="text-[10px] text-danger-400 uppercase tracking-wide flex-shrink-0">
            {t('execution.badges.overdue')}
          </span>
        )}
      </div>
      {task.initiativeName && (
        <div className="text-xs text-c-text-muted mb-2 ml-6">{task.initiativeName}</div>
      )}
      <div className="flex items-center justify-between text-xs text-c-text-muted ml-6">
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
      className={`flex-1 min-w-[260px] bg-c-surface/80 rounded-xl border transition-colors ${
        isOver ? 'border-c-accent bg-c-accent-soft' : 'border-c-border-subtle'
      }`}
      data-testid={`kanban-column-${id}`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-c-border-subtle ${accent}`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          {icon}
          {label}
        </div>
        <span className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
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
                ? 'border-c-accent/50 text-c-accent'
                : 'border-c-border-subtle text-c-text-muted'
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
const EXECUTION_MENU3: Record<string, Array<{ id: string; label: string }>> = {
  list: [
    ['active', 'Active'],
    ['at-risk', 'At risk'],
    ['critical', 'Critical'],
    ['blocked', 'Blocked work'],
    ['missing-baseline', 'Missing baseline'],
    ['missing-forecast', 'Missing forecast'],
    ['closing', 'Closing'],
    ['delivered', 'Recently delivered'],
    ['unknown', 'Unknown data'],
  ].map(([id, label]) => ({ id, label })),
  work: [
    ['all', 'All'],
    ['tasks', 'Tasks'],
    ['decisions', 'Decisions'],
    ['blocked', 'Blocked'],
    ['overdue', 'Overdue'],
    ['due-soon', 'Due soon'],
    ['missing-owner', 'Missing owner'],
    ['missing-evidence', 'Missing DoD/evidence'],
    ['waiting', 'Waiting dependency'],
    ['mine', 'Mine'],
    ['team', 'By team'],
  ].map(([id, label]) => ({ id, label })),
  resources: [
    ['all', 'All'],
    ['overallocated', 'Overallocated'],
    ['unassigned', 'Unassigned work'],
    ['skill-gaps', 'Skill gaps'],
    ['unconfirmed', 'Unconfirmed assignments'],
    ['unknown', 'Availability unknown'],
    ['cost-risk', 'Cost risk'],
    ['needs-decision', 'Needs decision'],
    ['team', 'By team'],
    ['initiative', 'By Initiative'],
  ].map(([id, label]) => ({ id, label })),
  control: [
    ['needs-action', 'Needs action'],
    ['critical', 'Critical'],
    ['decisions', 'Decisions'],
    ['schedule', 'Schedule'],
    ['resources', 'Resources'],
    ['cost', 'Cost'],
    ['risk', 'Risk'],
    ['dependencies', 'Dependencies'],
    ['adoption', 'Adoption'],
    ['outcome-risk', 'Outcome risk'],
    ['verification-overdue', 'Verification overdue'],
    ['resolved', 'Resolved'],
  ].map(([id, label]) => ({ id, label })),
  reports: [
    ['all', 'All'],
    ['weekly', 'Weekly'],
    ['monthly', 'Monthly'],
    ['on-demand', 'On demand'],
    ['sponsor', 'Sponsor'],
    ['needs-generation', 'Needs generation'],
    ['needs-review', 'Needs review'],
    ['partial-stale', 'Partial/stale'],
    ['published', 'Published'],
    ['failed', 'Failed'],
    ['recent', 'Recent runs'],
  ].map(([id, label]) => ({ id, label })),
};

export const ExecutionHub: React.FC<ExecutionHubProps> = ({ initialTab = 'list' }) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const { currentProjectId, fullSessionData } = useAppStore();
  const currentUser = useAppStore((s) => s.currentUser);
  const toggleChatCollapse = useAppStore((s) => s.toggleChatCollapse);
  const isChatCollapsed = useAppStore((s) => s.isChatCollapsed);
  const isPilotParticipant = isPilotParticipantRole(currentUser?.role);

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [canonicalMenu3Preset, setCanonicalMenu3Preset] = useState<Record<string, string>>({
    list: 'active',
    work: 'all',
    resources: 'all',
    control: 'needs-action',
    reports: 'all',
  });
  const [canonicalMenu3Counts, setCanonicalMenu3Counts] = useState<
    Record<string, Record<string, number>>
  >({});
  const menu3CountHandlers = useMemo(
    () =>
      Object.fromEntries(
        ['list', 'work', 'resources', 'control', 'reports'].map((surface) => [
          surface,
          (counts: Record<string, number>) =>
            setCanonicalMenu3Counts((current) => ({ ...current, [surface]: counts })),
        ])
      ) as Record<string, (counts: Record<string, number>) => void>,
    []
  );
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
  const [managerCommandRowContent, setManagerCommandRowContent] = useState<React.ReactNode>(null);
  const [managerCommandRowRightContent, setManagerCommandRowRightContent] =
    useState<React.ReactNode>(null);
  const [rolloutCommandRowContent, setRolloutCommandRowContent] = useState<React.ReactNode>(null);
  // Zestawienie (Table+Preview) filters + preview selection
  const [summaryFilters, setSummaryFilters] = useState<FilterChip[]>([]);
  const [summaryPreviewInitiativeId, setSummaryPreviewInitiativeId] = useState<string | null>(null);
  // #12 — bulk selection for the Execution Summary table (left checkbox column).
  const [summarySelectedIds, setSummarySelectedIds] = useState<Set<string>>(new Set());
  // #19 — active Rollout sub-view, so the Menu-2 CTA can vary per sub-view.
  // The Rollout tab (lane L8) owns the sub-view state and broadcasts it via a
  // 'rollout:subview-change' CustomEvent (detail.subview). We listen here.
  const [rolloutSubview, setRolloutSubview] = useState<string>('kpi');
  const [reportFilters, setReportFilters] = useState<FilterChip[]>([]);
  const [reportPreviewId, setReportPreviewId] = useState<string | null>(null);
  // #12 — bulk selection for the Reports catalog table (left checkbox column).
  const [reportSelectedIds, setReportSelectedIds] = useState<Set<string>>(new Set());
  const [reportPreset, setReportPreset] = useState<
    'all' | 'weekly' | 'monthly' | 'bi-weekly' | 'on-demand' | 'sponsor'
  >('all');
  // #20 — reports produced by the Report Generator Wizard. The wizard mounts near
  // this surface (below) and emits 'reporting:report-created' (detail=ReportConfig)
  // on Complete; we append the entry here so it shows up in the Reporting list.
  const [generatedReports, setGeneratedReports] = useState<ReportConfig[]>([]);

  // F5 kontrakt — definicje raportów z rejestru report_definitions (null = jeszcze nie pobrano;
  // [] = pobrano, ale puste → używamy fallbacku hardkodu). Patrz reportContract.ts / migracja 910.
  const [reportDefinitions, setReportDefinitions] = useState<ReportDefinitionDto[] | null>(null);

  // Data state
  const initRetryRef = React.useRef(0);
  const [initiatives, setInitiatives] = useState<FullInitiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initiativesLoadError, setInitiativesLoadError] = useState<string | null>(null);
  const [initiativesLoadErrorCode, setInitiativesLoadErrorCode] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [decisions, setDecisions] = useState<ExecutionDecision[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<PMOHealthSnapshot | null>(null);
  /** V4-EXEC-01: Per-initiative health + whyRed chain from execution health API */
  const [initiativeHealthMap, setInitiativeHealthMap] = useState<
    Map<string, { health: string; whyRed?: any }>
  >(new Map());
  // M14/F1 — single source of truth for portfolio health. The authoritative
  // score + breakdown come from GET /execution/:id/health (ExecutionController).
  // The cockpit consumes THIS instead of recomputing client-side, so the number
  // on screen always equals the API value. Client computation stays only as a
  // degraded fallback when the endpoint fails (executiveHealthFailed).
  const [executionHealth, setExecutionHealth] = useState<{
    healthScore?: number;
    breakdown?: { execution: number; decisions: number; capacity: number; risk: number };
  } | null>(null);
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
  const [controlTowerFailed, setControlTowerFailed] = useState(false);
  // L-02: surface degradation instead of silently falling back to []/empty
  const [executiveHealthFailed, setExecutiveHealthFailed] = useState(false);
  const [actionQueueFailed, setActionQueueFailed] = useState(false);
  const [tasksFailed, setTasksFailed] = useState(false);
  const [decisionsFailed, setDecisionsFailed] = useState(false);
  const [healthSnapshotFailed, setHealthSnapshotFailed] = useState(false);
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
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

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
  const [managerV8Degraded, setManagerV8Degraded] = useState(false);

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

  // F4.2 — globalny sygnał z useInitiativeRefreshStore (bumped przez każdą mutację)
  const sharedInitiativeRefreshVersion = useInitiativeRefreshStore((s) => s.version);
  useEffect(() => {
    if (sharedInitiativeRefreshVersion > 0) {
      setExecutionTruthRefreshKey((k) => k + 1);
    }
  }, [sharedInitiativeRefreshVersion]);

  useEffect(() => {
    if (deepLinkHandled) return;
    const openId = String(searchParams.get('open') || '').trim();
    const mode = String(searchParams.get('mode') || '')
      .trim()
      .toLowerCase();
    const targetTab = String(searchParams.get('tab') || '')
      .trim()
      .toLowerCase();
    const targetView = String(searchParams.get('view') || '')
      .trim()
      .toLowerCase();

    if (['list', 'work', 'resources', 'control', 'reports'].includes(targetTab)) {
      setActiveTab(targetTab as ModuleTab);
      setViewMode(targetView === 'grid' ? 'grid' : 'table');
      setDeepLinkHandled(true);
      return;
    }

    // Rollout consolidation: /rollout redirects to /execution?tab=rollout
    if (targetTab === 'rollout') {
      setActiveTab('rollout' as ModuleTab);
      setDeepLinkHandled(true);
      return;
    }

    if (openId && (mode === 'doc' || mode === 'initiative')) {
      setActiveTab('list');
      setViewMode('table');
      setActiveDocumentId(openId);
      setIsSidePanelOpen(false);
      setDeepLinkHandled(true);
    }
  }, [deepLinkHandled, searchParams]);

  useEffect(() => {
    if (!deepLinkHandled) return;
    const next = new URLSearchParams(searchParams);
    let changed = false;
    // Only strip the *transient* deep-link triggers here. `view` is persistent UI
    // state owned by the tab/view-sync effect below — deleting it here made the two
    // effects ping-pong (this one removes `view`, the other re-adds it), which is an
    // infinite setSearchParams loop ("Maximum update depth exceeded").
    if (next.has('open')) {
      next.delete('open');
      changed = true;
    }
    if (next.has('mode')) {
      next.delete('mode');
      changed = true;
    }
    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [deepLinkHandled, searchParams, setSearchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const currentTab = String(next.get('tab') || '')
      .trim()
      .toLowerCase();
    const desiredTab = String(activeTab || '')
      .trim()
      .toLowerCase();
    if (desiredTab && currentTab !== desiredTab) {
      next.set('tab', desiredTab);
      changed = true;
    }
    const currentView = String(next.get('view') || '')
      .trim()
      .toLowerCase();
    const desiredView = String(viewMode || '')
      .trim()
      .toLowerCase();
    if (desiredView && currentView !== desiredView) {
      next.set('view', desiredView);
      changed = true;
    }
    const currentInitiativeScope = String(next.get('initiativeId') || '').trim();
    const desiredInitiativeScope =
      activeDocumentId && !activeDocumentId.startsWith('report:') ? activeDocumentId : '';
    if (desiredInitiativeScope) {
      if (currentInitiativeScope !== desiredInitiativeScope) {
        next.set('initiativeId', desiredInitiativeScope);
        changed = true;
      }
    } else if (currentInitiativeScope) {
      next.delete('initiativeId');
      changed = true;
    }
    if (!changed) return;
    setSearchParams(next, { replace: true });
  }, [activeDocumentId, activeTab, searchParams, setSearchParams, viewMode]);

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
    // Frozen Realizacje is backed exclusively by canonical Execution Case APIs.
    // Do not issue the legacy initiatives portfolio request on this route.
    if (activeTab === 'list') {
      setIsLoading(false);
      setInitiativesLoadError(null);
      return;
    }
    initRetryRef.current = 0;
    const loadInitiatives = async () => {
      setIsLoading(true);
      setInitiativesLoadError(null);
      setInitiativesLoadErrorCode(null);
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
        const { message, code } = mapHubLoadFailureToPresentation(
          err,
          t('execution.hub.failedToLoad', 'Failed to load execution initiatives.')
        );
        setInitiativesLoadError(message);
        setInitiativesLoadErrorCode(code);
      } finally {
        setIsLoading(false);
      }
    };
    loadInitiatives();
  }, [activeTab, currentProjectId, executionTruthRefreshKey, fullSessionData?.initiatives, t]);

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
        } catch (err: any) {
          if ([404, 501].includes(Number(err?.status))) {
            setManagerV8Degraded(true);
          }
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
        setControlTowerFailed(false);
      } catch {
        if (cancelled) return;
        setTimelineWarnings([]);
        setTimelineWarningTotal(0);
        setCapacityAlerts([]);
        setCapacityTimeline([]);
        setControlTowerFailed(true);
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
        setTasksFailed(false);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load tasks:', err);
        setTasks([]);
        setTasksFailed(true);
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
        setDecisionsFailed(false);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load decisions:', err);
        setDecisions([]);
        setDecisionsFailed(true);
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
        setHealthSnapshotFailed(false);
      } catch (err) {
        console.error('[ExecutionHub] Failed to load PMO health snapshot:', err);
        setHealthSnapshot(null);
        setHealthSnapshotFailed(true);
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
        // F1 SSOT: capture the authoritative portfolio score + breakdown.
        setExecutionHealth(
          typeof (data as any)?.healthScore === 'number'
            ? { healthScore: (data as any).healthScore, breakdown: (data as any).breakdown }
            : null
        );
        const items = (data as any)?.initiativeHealth as Array<{
          id: string;
          health: string;
          whyRed?: any;
        }>;
        if (Array.isArray(items)) {
          const map = new Map<string, { health: string; whyRed?: any }>();
          items.forEach((item) => map.set(item.id, { health: item.health, whyRed: item.whyRed }));
          setInitiativeHealthMap(map);
          setExecutiveHealthFailed(false);
        } else {
          setInitiativeHealthMap(new Map());
          setExecutiveHealthFailed(false);
        }
      } catch {
        setInitiativeHealthMap(new Map());
        setExecutionHealth(null);
        setExecutiveHealthFailed(true);
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
        setActionQueueFailed(false);
      })
      .catch(() => {
        setActionQueueItems([]);
        setActionQueueFailed(true);
      })
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
        (i) =>
          (i.name || '').toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q)
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
        const isMissingDatesFilter = filter.value === 'missing_dates';
        result = result.filter((i) =>
          matchesAttentionPreset(
            i,
            (isMissingDatesFilter ? 'missing_dates' : filter.value) as
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

  // #12 — bulk selection helpers for the Execution Summary table.
  const summaryVisibleIds = useMemo(
    () => summaryInitiatives.map((i) => String(i.id)),
    [summaryInitiatives]
  );
  const summaryAllSelected =
    summaryVisibleIds.length > 0 && summaryVisibleIds.every((id) => summarySelectedIds.has(id));

  const toggleSummaryRow = useCallback((id: string) => {
    setSummarySelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSummarySelectAll = useCallback(() => {
    setSummarySelectedIds((prev) => {
      const allSelected =
        summaryVisibleIds.length > 0 && summaryVisibleIds.every((id) => prev.has(id));
      return allSelected ? new Set<string>() : new Set(summaryVisibleIds);
    });
  }, [summaryVisibleIds]);

  const clearSummarySelection = useCallback(() => setSummarySelectedIds(new Set()), []);

  // #12 — confirm dialog for bulk mutations (canon, replaces native confirm()).

  // Drop selections for rows that are no longer visible (filter/scope changes).
  useEffect(() => {
    setSummarySelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(summaryVisibleIds);
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [summaryVisibleIds]);

  // #19 — listen for the Rollout sub-view broadcast from lane L8.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const sv = detail?.subview;
      if (typeof sv === 'string' && sv) setRolloutSubview(sv);
    };
    window.addEventListener('rollout:subview-change', handler as EventListener);
    return () => window.removeEventListener('rollout:subview-change', handler as EventListener);
  }, []);

  // #20 — listen for reports created by the Report Generator Wizard and append
  // them to the Reporting list. Switch to the Reporting tab so the new entry is
  // visible, and preview-select it.
  useEffect(() => {
    const handler = (e: Event) => {
      const config = (e as CustomEvent).detail as ReportConfig | undefined;
      if (!config || !config.id) return;
      setGeneratedReports((prev) =>
        prev.some((r) => r.id === config.id) ? prev : [config, ...prev]
      );
      setActiveTab('reports');
      setReportPreset('all');
      setReportPreviewId(config.id);
    };
    window.addEventListener('reporting:report-created', handler as EventListener);
    return () => window.removeEventListener('reporting:report-created', handler as EventListener);
  }, []);

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
          contextData: {
            ...(initiative as unknown as Record<string, unknown>),
            p11Handoff: {
              source: 'execution_hub',
              lane: activeTab === 'reports' ? 'execution_reports' : 'execution_portfolio',
              initiativeId: initiative.id,
              initiativeIds: [initiative.id],
            },
          },
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

  const openRolloutRiskChat = useCallback(
    async (topSignal: string) => {
      try {
        const convId = await openChatWithContext({
          entityType: 'execution-rollout-risk',
          entityId: currentProjectId || 'rollout',
          entityName: t('execution.rollout.tabLabel', 'Rollout'),
          contextData: {
            topSignal,
            riskSignals,
            delaySignals,
            p11Handoff: { source: 'execution_hub', lane: 'execution_rollout_risk' },
          },
        });
        await addChatMessage({
          conversationId: convId,
          role: 'user',
          content: t(
            'execution.rollout.teresaPrompt',
            'Review the active rollout risk and delay signals and propose mitigations.'
          ),
        } as any);
        if (isChatCollapsed) toggleChatCollapse();
      } catch {
        toast.error(t('initiatives.toast.chatOpenError', 'Failed to open chat'));
      }
    },
    [
      addChatMessage,
      currentProjectId,
      delaySignals,
      isChatCollapsed,
      openChatWithContext,
      riskSignals,
      t,
      toggleChatCollapse,
    ]
  );

  const copyExecutionLink = useCallback(
    async (id: string) => {
      try {
        const query = new URLSearchParams();
        query.set('open', encodeURIComponent(id));
        query.set('mode', 'doc');
        query.set('initiativeId', encodeURIComponent(id));
        query.set('tab', String(activeTab || 'list'));
        query.set('view', String(viewMode || 'table'));
        const url = `${window.location.origin}${ROUTES.EXECUTION}?${query.toString()}`;
        await navigator.clipboard.writeText(url);
        toast.success(t('common.copied', 'Copied'));
      } catch {
        toast.error(t('common.copyFailed', 'Copy failed'));
      }
    },
    [activeTab, t, viewMode]
  );

  // #77 / Z94 — flaga kokpitu; MUSI być zadeklarowana PRZED `tabs` (useMemo woła
  // fabrykę synchronicznie w renderze → użycie przed deklaracją = ReferenceError/TDZ).
  const summaryOneLookEnabled = isExecutionFlagEnabled('summaryOneLook');

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: 'Realizacje',
        icon: <LayoutDashboard size={16} />,
      },
      {
        id: 'work' as ModuleTab,
        label: 'Praca',
        icon: <ClipboardList size={16} />,
      },
      {
        id: 'resources' as ModuleTab,
        label: 'Zasoby',
        icon: <Users size={16} />,
      },
      {
        id: 'control' as ModuleTab,
        label: 'Sterowanie',
        icon: <Target size={16} />,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Raporty',
        icon: <FileText size={16} />,
      },
    ],
    [t]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        // #12 — NAME is the first content column (title left). Relabeled to
        // "Initiative". The leading select column is auto-prepended by
        // StandardTable (MUST #7) whenever a `selection` prop is passed — the
        // module no longer declares its own select column slot here.
        id: 'name',
        label: t('execution.table.initiative', 'Initiative'),
        render: (row) => (
          <span
            className="text-sm text-c-text font-medium truncate block"
            title={String(row.name || '')}
          >
            {row.name}
          </span>
        ),
      },
      {
        // #12 — TYPE moved AFTER the NAME column.
        id: 'type',
        label: t('execution.table.type'),
        width: '80px',
        render: (row) => {
          const code = getTypeCode(row.axis);
          return (
            <div className="flex items-center gap-2">
              <Target size={14} className="text-blue-400" />
              <span className="font-mono text-xs font-bold text-c-text-secondary">{code}</span>
            </div>
          );
        },
      },
      {
        id: 'status',
        label: t('execution.table.status'),
        width: '160px',
        filterable: true,
        filterOptions: EXECUTION_STATUSES.map((status) => {
          // Guard: EXECUTION_STATUSES is partly config-driven; never assume a
          // metadata entry exists for every status (a missing one would throw
          // synchronously during render and crash the whole module).
          const meta = STATUS_METADATA[status];
          return {
            value: status,
            label: meta?.label || String(status),
            color: meta?.dotColor || 'bg-slate-400',
          };
        }),
        render: (row) => {
          const meta = STATUS_METADATA[row.status as InitiativeStatus];
          return (
            <EntityStatusChip
              status={String(row.status)}
              label={meta?.label || String(row.status)}
            />
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
              <span className="text-c-text-muted text-sm">{t('execution.table.unassigned')}</span>
            );
          return (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-c-border-subtle flex items-center justify-center text-xs text-c-text">
                {owner.firstName?.[0]}
                {owner.lastName?.[0]}
              </div>
              <span className="text-sm text-c-text-secondary">
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
          // §4.3/§4.0: progress fill is NEVER danger/crimson. info (in-progress)
          // → success @100%; amber only for the explicit "at-risk" (overdue) signal.
          const isOverdue =
            row.plannedEndDate &&
            new Date(row.plannedEndDate) < new Date() &&
            row.status !== InitiativeStatus.DONE;
          const color = isOverdue
            ? 'bg-amber-500'
            : progress >= 100
              ? 'bg-emerald-500'
              : 'bg-blue-500';
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-c-border-subtle rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-xs text-c-text-muted w-8 text-right">{progress}%</span>
            </div>
          );
        },
      },
      {
        // Canon §4.4 — ONE DueChip column (was split across timeRemaining +
        // alerts overdue badge + deadline). DueChip renders relative time +
        // overdue/soon state itself; falls back to SLA deadline.
        id: 'due',
        label: t('execution.table.deadline'),
        width: '130px',
        render: (row) => {
          const deadline = row.plannedEndDate || row.slaDeadline;
          if (!deadline) {
            return <span className="text-xs text-c-text-muted">—</span>;
          }
          const terminal = row.status === InitiativeStatus.DONE;
          return (
            <DueChip
              label={new Date(deadline).toLocaleDateString()}
              due={terminal ? null : deadline}
              showIcon
            />
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

          // #12 — signal-tone system (danger/warning/success) with a leading
          // signal dot, readable in light mode. Hard-coded rose/amber/emerald
          // tints replaced with the c.* tokens.
          if (row.status === InitiativeStatus.BLOCKED) {
            badges.push(
              <span
                key="blocked"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-danger/10 text-c-danger"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-c-danger" aria-hidden="true" />
                {t('execution.badges.blocked')}
              </span>
            );
          }

          // Overdue signal lives in the single DueChip column (canon §4.4) —
          // not duplicated here.

          if (blockedTasks > 0) {
            badges.push(
              <span
                key="btasks"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-danger/10 text-c-danger"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-c-danger" aria-hidden="true" />
                {blockedTasks} {t('execution.badges.blocked')}
              </span>
            );
          }

          if (overdueDecisions > 0) {
            badges.push(
              <span
                key="odecisions"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-c-warning/10 text-c-warning"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-c-warning" aria-hidden="true" />
                {overdueDecisions} {t('execution.badges.decision')}
              </span>
            );
          }

          if (badges.length === 0) {
            return (
              <span className="inline-flex items-center gap-1 text-xs text-c-success">
                <span className="h-1.5 w-1.5 rounded-full bg-c-success" aria-hidden="true" />
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
            return <span className="text-xs text-c-text-muted">-</span>;
          }
          const doneCount = initiativeTasks.filter(
            (task) => normalizeTaskStatus(task.status) === 'done'
          ).length;
          return (
            <span className="text-xs text-c-text-secondary">
              {doneCount}/{initiativeTasks.length}
            </span>
          );
        },
      },
    ],
    [decisionsByInitiative, t, tasksByInitiative]
  );

  const scopeToggle = (
    <div
      className="
        flex items-center gap-1 p-0.5 rounded-full h-9
        bg-c-surface-raised
        border border-c-border-subtle
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
              ? 'bg-c-surface/80 text-c-text-secondary shadow-sm'
              : 'text-c-text-muted hover:bg-c-surface/60'
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
          className="h-9 px-3 rounded-lg flex items-center gap-2 border border-c-border-subtle bg-c-surface-raised text-c-text-secondary hover:bg-c-surface/60 transition-colors"
          title={t('execution.execSnapshot.title', 'Executive snapshot')}
        >
          <span className="text-[10px] font-mono uppercase tracking-wide text-c-text-muted">
            exec v2{execSnapshotSource ? ` · ${execSnapshotSource}` : ''}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-emerald-500">
            {execTopline.executing}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-danger-500">
            {execTopline.blocked}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-amber-500">
            {execTopline.pendingDecisions}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-c-danger">
            {execTopline.overdueTasks}
          </span>
        </button>
      ) : null;

    // #22/#13/#15/#21a — the "Results" button was removed at its single source
    // here, so it no longer appears on ANY Implementation sub-tab (Summary,
    // Rollout/*, Reporting, Management).

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

    const budgetPairs = initiatives
      .map((initiative) => ({
        budget: (initiative as any).budget || (initiative as any).costCapex,
        actual: (initiative as any).actualCost ?? (initiative as any).actual_cost,
      }))
      .filter(
        (pair) =>
          typeof pair.budget === 'number' && pair.budget > 0 && typeof pair.actual === 'number'
      );

    let budgetHealth: number | null = null;
    if (budgetPairs.length > 0) {
      const totalBudget = budgetPairs.reduce((sum, pair) => sum + pair.budget, 0);
      const totalActual = budgetPairs.reduce((sum, pair) => sum + pair.actual, 0);
      // Budget health penalises OVERRUN, not consumption. The old formula
      // (100 − consumed%) inverted the meaning: 100% spent at 100% delivered
      // showed 0% "health", and underspend (often a delay signal) scored high.
      // Within budget ⇒ 100; over budget ⇒ drops by the overrun %. (Full EVM
      // CPI lands in F2 — this stops the tile from lying.)
      const overrunPct =
        totalBudget > 0 ? Math.max(0, ((totalActual - totalBudget) / totalBudget) * 100) : 0;
      budgetHealth = Math.max(0, Math.min(100, Math.round(100 - overrunPct)));
    }

    // F1 SSOT: prefer the authoritative BE score/breakdown (GET /execution/health);
    // the client computation above is the degraded fallback used only when that
    // endpoint failed. This guarantees the cockpit number == the API value.
    const ssot = !executiveHealthFailed && executionHealth ? executionHealth : null;
    return {
      healthScore: ssot?.healthScore ?? healthScore,
      healthScoreSource: ssot ? 'server' : 'client',
      avgProgress,
      overdueDecisions,
      totalDecisions,
      blockedCount,
      onTrackCount: Math.max(totalInitiatives - blockedCount, 0),
      budgetHealth,
      breakdown: ssot?.breakdown ?? {
        execution: avgProgress,
        decisions: decisionHealth,
        capacity: capacityHealth,
        risk: riskHealth,
      },
      blockers: healthSnapshot?.blockers || [],
      stageGate: healthSnapshot?.stageGate || null,
      isHealthLoading: isLoadingHealth,
    };
  }, [
    initiatives,
    decisions,
    tasks,
    stats,
    healthSnapshot,
    isLoadingHealth,
    capacityAlerts,
    executionHealth,
    executiveHealthFailed,
  ]);

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

  // Triada standard (docs/ui-standards/TRIADA_KANON.md A6): kebab contract for
  // initiative rows. Module declares blocks 1-3 only; StandardTable auto-adds
  // block 4 (Open preview · Edit · Archive) and block 5 (Delete, danger,
  // always last). Archive/Delete have no execution-side endpoint yet → left
  // undeclared so StandardTable renders them disabled with "Coming soon
  // (backend)", never silently omitted.
  const buildInitiativeRowMenu = useCallback(
    (init: FullInitiative): StandardRowMenu => {
      const hasDue = Boolean(init.plannedEndDate || init.slaDeadline);
      return {
        primary: [
          {
            id: 'open_preview',
            label: t('common.openPreview', 'Otwórz podgląd'),
            icon: ChevronRight,
            onClick: () => setSummaryPreviewInitiativeId(init.id),
          },
        ],
        statusTransitions: [],
        timeActions: hasDue
          ? [
              {
                id: 'delay',
                label: t('common.delay', 'Opóźnij'),
                icon: Clock,
                disabled: true,
                note: t('common.comingSoonBackend', 'Wkrótce (backend)'),
              },
            ]
          : undefined,
        universalHandlers: {
          preview: () => setSummaryPreviewInitiativeId(init.id),
          edit: isPilotParticipant ? undefined : () => handleOpenDocument(init),
          // Brak API archiwizacji inicjatywy — pozycja disabled z notą
          // (StandardTable dokłada ją sama, canon A6 blok 4).
        },
        destructive: {
          // Brak endpointu usuwania inicjatywy — disabled z notą (StandardTable
          // dokłada ją sama, canon A6 blok 5).
        },
      };
    },
    [handleOpenDocument, isPilotParticipant, t]
  );

  // Triada standard (StandardTable rowMenu contract, canon A6) — Reports
  // catalog kebab. Module declares blocks 1-3 only; StandardTable auto-adds
  // block 4 (Open preview · Edit · Archive) and block 5 (Delete, danger,
  // always last). Report catalog rows are generated definitions (no per-row
  // edit/archive backend) → left undeclared so StandardTable renders them
  // disabled with "Coming soon (backend)", never silently omitted.
  const buildReportRowMenu = useCallback(
    (report: ReportDef): StandardRowMenu => ({
      primary: [
        {
          id: 'open_full',
          label: t('common.openFull', 'Otwórz pełny widok'),
          icon: FileText,
          onClick: () => handleOpenReport(report),
        },
      ],
      universalHandlers: {
        preview: () => setReportPreviewId(report.id),
        // Brak API edycji/archiwizacji definicji raportu — pozycje disabled
        // z notą (StandardTable dokłada je sama, canon A6 blok 4).
      },
      destructive: {
        // Brak endpointu usuwania raportu — disabled z notą (StandardTable
        // dokłada ją sama, canon A6 blok 5).
      },
    }),
    [handleOpenReport, t]
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
          href: '/execution',
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
        <div className="p-6">
          <LoadingState template="list" rows={6} />
        </div>
      );
    }

    const columns: { id: KanbanColumnId; label: string; accent: string; icon: React.ReactNode }[] =
      [
        {
          id: 'todo',
          label: t('execution.kanban.toDo'),
          accent: 'text-c-text-muted',
          icon: <ClipboardList size={14} />,
        },
        {
          id: 'in_progress',
          label: t('execution.kanban.inProgress'),
          accent: 'text-blue-300',
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
          accent: 'text-danger-300',
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
            <div className="p-3 bg-c-surface border-2 border-c-accent rounded-lg shadow-xl w-[240px]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="text-c-text-muted" />
                  <h4 className="text-sm font-medium text-c-text line-clamp-2">
                    {activeTask.title}
                  </h4>
                </div>
              </div>
              {activeTask.initiativeName && (
                <div className="text-xs text-c-text-muted mb-2 ml-6">
                  {activeTask.initiativeName}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-c-text-muted ml-6">
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

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refreshExecutionAfterWrite();
  }, [refreshExecutionAfterWrite]);

  const renderPortfolioHealth = () => (
    <div className="space-y-3" data-testid="portfolio-health">
      {healthSnapshotFailed && (
        <Callout
          variant="warning"
          title={t('execution.healthSnapshot.failed', 'PMO health snapshot unavailable')}
        >
          {t(
            'execution.healthSnapshot.failedDesc',
            'The authoritative PMO health snapshot could not be loaded. The Health Score, decision and blocker counts below fall back to client-side estimates and may be incomplete — a degraded state, not a confirmed-healthy portfolio.'
          )}
        </Callout>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr]">
        <PortfolioHealthScore
          score={portfolioMetrics.healthScore}
          breakdown={portfolioMetrics.breakdown}
          trend={portfolioMetrics.overdueDecisions > 0 ? 'down' : 'up'}
          loading={portfolioMetrics.isHealthLoading}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-c-text-muted uppercase tracking-wide">
                  {t('execution.portfolio.onTrack')}
                </p>
                <p className="text-2xl font-semibold text-c-text">
                  {portfolioMetrics.onTrackCount}
                </p>
              </div>
              <CheckCircle2 className="text-emerald-400" />
            </div>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-c-text-muted uppercase tracking-wide">
                  {t('execution.portfolio.blocked')}
                </p>
                <p className="text-2xl font-semibold text-c-text">
                  {portfolioMetrics.blockedCount}
                </p>
              </div>
              <AlertTriangle className="text-danger-400" />
            </div>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-c-text-muted uppercase tracking-wide">
                  {t('execution.portfolio.overdueDecisions')}
                </p>
                <p className="text-2xl font-semibold text-c-text">
                  {portfolioMetrics.overdueDecisions}
                </p>
              </div>
              <Scale className="text-amber-400" />
            </div>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-c-text-muted uppercase tracking-wide">
                  {t('execution.portfolio.avgProgress')}
                </p>
                <p className="text-2xl font-semibold text-c-text">
                  {portfolioMetrics.avgProgress}%
                </p>
              </div>
              <Target className="text-blue-400" />
            </div>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-c-text-muted uppercase tracking-wide">
                  {t('execution.portfolio.budgetHealth')}
                </p>
                <p className="text-2xl font-semibold text-c-text">
                  {portfolioMetrics.budgetHealth === null
                    ? '—'
                    : `${portfolioMetrics.budgetHealth}%`}
                </p>
              </div>
              <LayoutDashboard className="text-c-text-muted" />
            </div>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-c-text-muted uppercase tracking-wide">
                  {t('execution.portfolio.decisionSla')}
                </p>
                <p className="text-2xl font-semibold text-c-text">
                  {portfolioMetrics.totalDecisions === 0
                    ? '—'
                    : `${portfolioMetrics.totalDecisions - portfolioMetrics.overdueDecisions}/${portfolioMetrics.totalDecisions}`}
                </p>
              </div>
              <Clock className="text-amber-400" />
            </div>
          </div>
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-c-text-muted uppercase tracking-wide">
                {t('execution.portfolio.escalationsGates')}
              </p>
              <span className="text-xs text-c-text-muted">
                {portfolioMetrics.stageGate?.gateType ||
                  t('execution.portfolio.noGateInfo', 'No gate info')}
              </span>
            </div>
            {portfolioMetrics.blockers.length === 0 ? (
              <p className="text-sm text-c-text-muted">
                {t('execution.portfolio.noActiveEscalations')}
              </p>
            ) : (
              <div className="space-y-2">
                {portfolioMetrics.blockers.slice(0, 4).map((blocker, idx) => (
                  <div
                    key={`${blocker.type}-${idx}`}
                    className="flex items-start gap-2 text-sm text-c-text-secondary"
                  >
                    <AlertTriangle className="text-danger-400 mt-0.5" size={14} />
                    <span>{blocker.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
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

  // ── #77 / Z94 — Kokpit menedżera „pełna wizja McKinsey" (Summary one-look).
  // Bezstanowe props mapowane 1:1 z istniejących źródeł (execSnapshot / portfolio
  // Metrics / actionCenter / capacityAlerts) — ZERO nowego backendu, zero
  // zmyślonych liczb (integrity: brak danych → null/empty-state w widoku).
  // (deklaracja flagi `summaryOneLookEnabled` przeniesiona wyżej — przed `tabs`).
  const summaryOneLookProps = useMemo(() => {
    const wsItems = execSnapshot?.workstreams?.items ?? [];
    const wsOnTrack = wsItems.reduce((s, w) => s + (w.onTrackCount || 0), 0);
    const wsAtRisk = wsItems.reduce((s, w) => s + (w.atRiskCount || 0), 0);
    const wsDelayed = wsItems.reduce((s, w) => s + (w.delayedCount || 0), 0);
    const wsTotal = wsOnTrack + wsAtRisk + wsDelayed;

    // On-time %: preferuj workstreamy (silnik), inaczej portfolioMetrics.
    const totalInit = wsTotal || dashboardBaseInitiatives.length;
    const onTrack = wsTotal ? wsOnTrack : portfolioMetrics.onTrackCount;
    const delayed = wsTotal ? wsDelayed : portfolioMetrics.blockedCount;
    const atRisk = wsTotal ? wsAtRisk : Math.max(totalInit - onTrack - delayed, 0);
    const onTimePercent = totalInit > 0 ? Math.round((onTrack / totalInit) * 100) : null;

    // Obłożenie (#77 wiring fix 2026-07-19): realny silnik istnieje
    // (workloadCapacityService.getCapacityTimeline, DB-backed) i jest już
    // pobierany do `capacityTimeline` (org-wide, tydzień[0] = bieżący tydzień
    // ISO). utilizationPercent = realna wartość tego tygodnia; brak danych
    // (pusta tablica / capacityHours=0, np. brak project_members) → nadal
    // null/empty-state, zero zmyślonych liczb. Przeciążenia z capacityAlerts,
    // headcount z unikalnych wykonawców zadań, unassigned z workstreamów.
    const currentWeekCapacity = capacityTimeline[0] ?? null;
    const utilizationPercent =
      currentWeekCapacity && currentWeekCapacity.capacityHours > 0
        ? (currentWeekCapacity.utilizationPercent ??
          Math.round(
            (currentWeekCapacity.allocatedHours / currentWeekCapacity.capacityHours) * 100
          ))
        : null;
    const criticalCapacity = capacityAlerts.filter((a) => a.severity === 'critical').length;
    const headcount = new Set(
      tasks.map((tk) => (tk as any).assigneeId || (tk as any).assignee_id).filter(Boolean)
    ).size;

    const roi = execSnapshot?.roi?.summary ?? null;

    const risks = (execSnapshot?.risks?.topRisks ?? []).slice(0, 3).map((r) => ({
      id: r.id,
      title: r.title,
      probability: r.probability,
      impact: r.impact,
      score: r.score,
      ownerName: null,
      dueDate: r.dueDate,
      mitigationStatus: r.mitigationStatus,
    }));

    const ageDays = (iso?: string | null): number | null => {
      if (!iso) return null;
      const d = new Date(iso).getTime();
      if (Number.isNaN(d)) return null;
      return Math.max(0, Math.round((Date.now() - d) / 86_400_000));
    };

    const blockerDecisions = actionCenter.blocked.map((i) => ({
      id: `blk:${i.id}`,
      title: i.name || 'Blocked initiative',
      kind: 'blocker' as const,
      ownerName: (i as any).ownerName ?? null,
      ageDays: null,
      context: t('execution.summary.blockedInitiative', 'Zablokowana inicjatywa'),
    }));
    const overdueDecisionItems = actionCenter.overdueDecisions.map((d) => ({
      id: `dec:${d.id}`,
      title: (d as any).title || (d as any).name || 'Decision',
      kind: 'overdue' as const,
      ownerName: (d as any).ownerName ?? null,
      ageDays: ageDays((d as any).dueDate),
      context: null,
    }));
    const pendingDecisionItems = decisions
      .filter((d) => String(d.status).toUpperCase() === 'PENDING' && !isPastDue((d as any).dueDate))
      .slice(0, 6)
      .map((d) => ({
        id: `pend:${d.id}`,
        title: (d as any).title || (d as any).name || 'Decision',
        kind: 'decision' as const,
        ownerName: (d as any).ownerName ?? null,
        ageDays: ageDays((d as any).createdAt),
        context: null,
      }));

    const milestones = (execSnapshot?.overview?.nextMilestones ?? []).map((m) => ({
      id: m.id,
      initiativeName: m.initiativeName,
      name: m.name,
      targetDate: m.targetDate,
      status: m.status,
    }));

    return {
      health: {
        healthScore: portfolioMetrics.healthScore ?? null,
        progressPercent:
          execSnapshot?.overview?.progressPercent ?? portfolioMetrics.avgProgress ?? null,
        phaseLabel: execSnapshot?.overview?.phaseLabel ?? null,
      },
      onTime: {
        onTimePercent,
        onTrackCount: onTrack,
        atRiskCount: atRisk,
        delayedCount: delayed,
        totalInitiatives: totalInit,
      },
      value: roi
        ? {
            totalProjected: roi.totalProjected,
            totalRealized: roi.totalRealized,
            totalVariance: roi.totalVariance,
            coveragePercent: roi.coveragePercent,
            initiativeCount: roi.initiativeCount,
          }
        : null,
      people: {
        utilizationPercent,
        overallocatedCount: criticalCapacity,
        underutilizedCount: 0,
        unassignedInitiatives: execSnapshot?.workstreams?.unassignedInitiatives ?? 0,
        headcount,
      },
      topRisks: risks,
      decisions: [...blockerDecisions, ...overdueDecisionItems, ...pendingDecisionItems],
      milestones,
      generatedAt: execSnapshot?.generatedAt ?? null,
    };
  }, [
    execSnapshot,
    portfolioMetrics,
    actionCenter,
    capacityAlerts,
    capacityTimeline,
    decisions,
    tasks,
    dashboardBaseInitiatives,
    t,
  ]);

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
        <div className="p-6">
          <LoadingState template="list" rows={6} />
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
          className="w-full text-left flex items-start justify-between gap-4 p-3 rounded-lg bg-c-surface-raised border border-c-border-subtle hover:border-c-border-strong hover:bg-c-surface/60 transition-colors"
          title={t('execution.tasks.openInitiative', 'Open related initiative')}
        >
          <div className="min-w-0">
            <div className="text-sm font-medium text-c-text truncate">{task.title}</div>
            <div className="text-xs text-c-text-muted truncate mt-0.5">
              {task.initiativeName || '—'}
            </div>
          </div>
          <div className="text-right text-xs text-c-text-muted shrink-0">
            <div>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}</div>
            {overdue ? (
              <div className="text-danger-400">{t('execution.badges.overdue')}</div>
            ) : null}
          </div>
        </button>
      );
    };

    const BucketColumn: React.FC<{ title: string; accent: string; tasks: Task[] }> = ({
      title,
      accent,
      tasks,
    }) => (
      <div className="min-w-[280px] flex-1 bg-c-surface/70 rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
          <div className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{title}</div>
          <span className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="p-3 space-y-3 max-h-[520px] overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-xs text-c-text-muted text-center py-6">
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
        {tasksFailed && (
          <Callout variant="warning" title={t('execution.tasks.failed', 'Tasks unavailable')}>
            {t(
              'execution.tasks.failedDesc',
              'Tasks could not be loaded. The buckets below are empty because of a load failure, not because there are no tasks — this is a degraded state.'
            )}
          </Callout>
        )}
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-c-text">
                {t('execution.tabs.tasks', 'Tasks')}
              </div>
              <div className="text-xs text-c-text-muted">
                {t(
                  'execution.tasks.subtitle',
                  'Overdue, due soon, and upcoming tasks for initiatives in execution.'
                )}
              </div>
            </div>
            <div className="text-xs text-c-text-muted">
              {taskBuckets.overdue.length} {t('execution.badges.overdue')} ·{' '}
              {taskBuckets.dueSoon.length} {t('execution.attention.dueSoonTasks', 'Due soon')}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {listItems.length === 0 ? (
            <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-6 text-center text-sm text-c-text-muted">
              {t('execution.empty.noDeadlines')}
            </div>
          ) : (
            listItems.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto">
          <BucketColumn
            title={t('execution.tasks.overdue', 'Overdue')}
            accent="text-danger-400"
            tasks={taskBuckets.overdue}
          />
          <BucketColumn
            title={t('execution.tasks.due7', 'Due in 7 days')}
            accent="text-amber-400"
            tasks={taskBuckets.dueSoon}
          />
          <BucketColumn
            title={t('execution.tasks.upcoming', 'Upcoming (8–30d)')}
            accent="text-blue-400"
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
    // CANCELLED = soft-deleted via DELETE /api/decisions/:id; must not linger in
    // the active due7/due14/due30 buckets as if it were still awaiting action.
    const isDoneStatus = (s: string) =>
      ['APPROVED', 'REJECTED', 'DEFERRED', 'DONE', 'CLOSED', 'RESOLVED', 'CANCELLED'].includes(s);

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
        <div className="p-6">
          <LoadingState template="list" rows={6} />
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
          className="w-full text-left p-3 rounded-lg bg-c-surface-raised border border-c-border-subtle hover:border-c-border-strong hover:bg-c-surface/60 transition-colors"
          title={t('execution.decisionsBuckets.openInitiative', 'Open related initiative')}
        >
          <div className="text-sm font-medium text-c-text truncate">{d.title}</div>
          <div className="text-xs text-c-text-muted truncate mt-0.5">
            {d.relatedObjectName || '—'}
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-c-text-muted">
            <span>{d.ownerName || '—'}</span>
            <span className={overdue ? 'text-danger-400' : undefined}>
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
      <div className="min-w-[280px] flex-1 bg-c-surface/70 rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
          <div className={`text-xs font-semibold uppercase tracking-wide ${accent}`}>{title}</div>
          <span className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <div className="p-3 space-y-3 max-h-[560px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-xs text-c-text-muted text-center py-6">—</div>
          ) : (
            items.slice(0, 30).map((d) => <DecisionRow key={d.id} d={d} />)
          )}
        </div>
      </div>
    );

    return (
      <div className="p-4 space-y-4">
        {decisionsFailed && (
          <Callout
            variant="warning"
            title={t('execution.decisionsBuckets.failed', 'Decisions unavailable')}
          >
            {t(
              'execution.decisionsBuckets.failedDesc',
              'Decisions could not be loaded. The buckets below are empty because of a load failure, not because there are no pending decisions — this is a degraded state.'
            )}
          </Callout>
        )}
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-4">
          <div className="text-sm font-semibold text-c-text">
            {t('execution.tabs.decisions', 'Decisions')}
          </div>
          <div className="text-xs text-c-text-muted mt-0.5">
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
            accent="text-danger-400"
            items={decisionBuckets.due7}
          />
          <Bucket
            title={t('execution.decisionsBuckets.due14', 'Due 8–14d')}
            accent="text-amber-400"
            items={decisionBuckets.due14}
          />
          <Bucket
            title={t('execution.decisionsBuckets.due30', 'Due 15–30d')}
            accent="text-blue-400"
            items={decisionBuckets.due30}
          />
          <Bucket
            title={t('execution.decisionsBuckets.more', '30d+ / No date')}
            accent="text-c-text-muted"
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
                ? 'text-danger-500'
                : attention === 'due_soon_tasks'
                  ? 'text-blue-500'
                  : 'text-c-text-muted',
        },
      ]);
    },
    [t]
  );

  const commandRowContent = useMemo(() => {
    if (activeTab === 'reports') {
      const reportPresets = [
        { id: 'all' as const, label: t('common.all', 'ALL'), count: 11 },
        { id: 'weekly' as const, label: t('execution.reports.preset.weekly', 'Weekly'), count: 4 },
        {
          id: 'monthly' as const,
          label: t('execution.reports.preset.monthly', 'Monthly'),
          count: 4,
        },
        {
          id: 'bi-weekly' as const,
          label: t('execution.reports.preset.biweekly', 'Bi-weekly'),
          count: 2,
        },
        {
          id: 'on-demand' as const,
          label: t('execution.reports.preset.onDemand', 'On demand'),
          count: 2,
        },
        {
          id: 'sponsor' as const,
          label: t('execution.reports.preset.sponsor', 'Sponsor'),
          count: 5,
        },
      ];
      return (
        <div className={MENU_3_LEFT_CLASS}>
          {reportPresets.map((preset) => {
            const active = reportPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setReportPreset((prev) => (prev === preset.id ? 'all' : preset.id))}
                className={active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
              >
                {preset.id === 'all' ? (
                  <span className={MENU_3_ALL_DOT_CLASS} />
                ) : (
                  <FileText size={14} className="text-blue-400" />
                )}
                <span>{preset.label}</span>
                <span className={active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
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
        icon: <span className={MENU_3_ALL_DOT_CLASS} />,
        onClick: resetExecutionCommandRow,
      },
      {
        id: 'blocked',
        label: t('execution.attention.blocked', 'Blocked'),
        count: blockedCount,
        active: activeStatusFilter === InitiativeStatus.BLOCKED,
        disabled: blockedCount === 0,
        icon: <AlertTriangle size={14} className="text-danger-400" />,
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
        icon: <Clock size={14} className="text-blue-400" />,
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
      <div className={MENU_3_LEFT_CLASS}>
        {executionPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={preset.onClick}
            disabled={preset.disabled}
            className={`${preset.active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE} ${
              preset.disabled ? 'cursor-not-allowed opacity-55' : ''
            }`}
            title={preset.label}
          >
            {preset.icon}
            <span>{preset.label}</span>
            <span className={preset.active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
              {preset.count}
            </span>
          </button>
        ))}
      </div>
    );
  }, [
    activeDocumentId,
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
    navigate,
  ]);

  const renderActionCenter = () => {
    const kpiDeviationItems = actionQueueItems.filter(
      (item) => item.type === 'kpi_deviation_no_plan'
    );
    const missingPlanItems = actionCenter.missingDates;
    const rows = [
      {
        id: 'action-queue',
        label: t('execution.actionCenter.actionQueue', 'Action queue'),
        count: actionQueueItems.length,
        description: t(
          'execution.actionCenter.actionQueueDesc',
          'Overdue decisions, risks, communications, and KPI deviations that need owner action.'
        ),
        onClick: () => openInitiativesWithAttention('overdue_decisions'),
      },
      {
        id: 'missing-plan-handling',
        label: t('execution.actionCenter.missingPlan', 'Missing-plan handling'),
        count: missingPlanItems.length,
        description: t(
          'execution.actionCenter.missingPlanDesc',
          'Initiatives without start/end dates stay visible as degraded planning state instead of disappearing from reports.'
        ),
        onClick: () => openInitiativesWithAttention('missing_dates'),
      },
      {
        id: 'kpi-deviation-no-plan',
        label: t('execution.actionCenter.kpiNoPlan', 'KPI deviation without plan'),
        count: kpiDeviationItems.length,
        description: t(
          'execution.actionCenter.kpiNoPlanDesc',
          'KPI deviations without recovery plans are tracked in the same action queue.'
        ),
        onClick: () => setActiveTab('people_change' as ModuleTab),
      },
    ];

    return (
      <div className="space-y-3">
        {actionQueueFailed && (
          <Callout
            variant="warning"
            title={t('execution.actionQueue.failed', 'Action queue unavailable')}
          >
            {t(
              'execution.actionQueue.failedDesc',
              'The action queue (overdue decisions, risks, KPI deviations) could not be loaded. Counts shown may be incomplete — this is a degraded state, not an empty queue.'
            )}
          </Callout>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={row.onClick}
              className="text-left rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 hover:border-c-border-strong transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {row.label}
                </div>
                <span className="text-xs font-semibold rounded-full bg-c-surface-raised text-c-text-secondary px-2 py-0.5">
                  {row.count}
                </span>
              </div>
              <p className="mt-2 text-xs text-c-text-muted leading-relaxed">{row.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // RAPORTY — pre-defined report catalog (§5 of EXECUTION_SURFACES spec)
  // Every report declares: audience, cadence, scope, data sources,
  // mandatory sections, RAG/confidence logic, expected follow-up actions.
  // ---------------------------------------------------------------------------
  // F5 kontrakt — pobierz rejestr definicji raportów Execution (systemowe + org-własne).
  // Best-effort: błąd/puste → fallback na wbudowany katalog (ekran działa przed migracją).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/report-builder/definitions?kind=EXECUTION_PACK', {
          headers: getHeaders(),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { definitions?: ReportDefinitionDto[] };
        if (!cancelled && Array.isArray(data.definitions)) {
          setReportDefinitions(data.definitions);
        }
      } catch {
        // best-effort: zostaje fallback (reportDefinitions = null → hardkod)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

    type CatalogEntry = Omit<
      ReportDef,
      | 'aiExecutiveReadout'
      | 'aiRecommendedActions'
      | 'dataQuality'
      | 'degradedFlags'
      | 'lastRefreshAt'
      | 'scenarioNotes'
    >;

    // Metryki live (tryb 2): definicje z bazy niosą klucz `metric`, wartość liczymy tutaj.
    const metricValues: Record<string, number> = {
      blocked,
      tasks: totalTasks,
      initiatives: totalInitiatives,
      missingDates: missingDatesCount,
      overdueDecisions: overdueDecisionCount,
      pendingDecisions,
      dueSoon: actionCenter.dueSoonTasks.length,
    };
    const progressLabel = progressPct !== null ? `${progressPct}%` : '—';

    // Katalog wbudowany — FALLBACK gdy rejestr `report_definitions` jest pusty/niedostępny.
    const fallbackBase: CatalogEntry[] = [
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
        icon: <CalendarDays size={18} className="text-blue-500" />,
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
        icon: <AlertTriangle size={18} className="text-danger-500" />,
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
        icon: <Users size={18} className="text-c-text-muted" />,
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
        icon: <GripVertical size={18} className="text-c-text-muted" />,
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
        icon: <Sparkles size={18} className="text-blue-500" />,
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

    // F5 kontrakt — definicje z rejestru (report_definitions) mają pierwszeństwo nad hardkodem.
    // Mapujemy wiersz DB → CatalogEntry: ikona z {name,className}, highlighty rehydrowane live.
    const base: CatalogEntry[] =
      reportDefinitions && reportDefinitions.length > 0
        ? reportDefinitions.map((def): CatalogEntry => {
            const sb = def.sourceBinding || {};
            const IconCmp = REPORT_DEF_ICON_MAP[sb.icon?.name || ''] || FileText;
            return {
              id: def.id,
              title: def.name,
              audience: def.audience || '',
              cadence: def.cadence || '',
              scope: def.scope || '',
              dataSources: Array.isArray(sb.dataSources) ? sb.dataSources : [],
              sections: Array.isArray(def.sections) ? def.sections : [],
              ragLogic: sb.ragLogic || '',
              followUpActions: Array.isArray(sb.followUpActions) ? sb.followUpActions : [],
              icon: <IconCmp size={18} className={sb.icon?.className || 'text-c-text-muted'} />,
              highlights: (Array.isArray(sb.highlights) ? sb.highlights : []).map((h) =>
                resolveDefinitionHighlight(h, metricValues, progressLabel)
              ),
            };
          })
        : fallbackBase;

    // #20 — prepend reports produced by the Report Generator Wizard so they show
    // up at the top of the Reporting list. They flow through enrichExecutionReport
    // like the predefined catalog entries.
    const wizardEntries: CatalogEntry[] = generatedReports.map((config) => ({
      id: config.id,
      title: config.title,
      audience: config.audience,
      cadence: config.cadenceLabel,
      scope: config.scopeNote || config.goal || 'Generated report',
      dataSources: ['Initiatives', 'Tasks', 'Decisions', 'Risk signals', 'Milestones'],
      sections: config.sections,
      ragLogic: 'Mirrors program health RAG: composite of progress, blockers and confidence',
      followUpActions: [],
      icon: <Sparkles size={18} className="text-indigo-500" />,
      highlights: [{ label: 'Progress', value: progressPct !== null ? `${progressPct}%` : '—' }],
    }));

    return [...wizardEntries, ...base];
  }, [
    actionCenter,
    tasks.length,
    decisions,
    dashboardBaseInitiatives.length,
    execSnapshot,
    generatedReports,
    reportDefinitions,
  ]);

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

  // #12 — bulk selection helpers for the Reports catalog table, 1:1 with the
  // 'list' (Portfolio) tab's toggleSummarySelectAll/clearSummarySelection.
  const toggleReportSelectAll = useCallback(() => {
    setReportSelectedIds((prev) => {
      const visibleIds = filteredReportCatalog.map((r) => r.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      return allSelected ? new Set<string>() : new Set(visibleIds);
    });
  }, [filteredReportCatalog]);

  const clearReportSelection = useCallback(() => setReportSelectedIds(new Set()), []);

  // MANAGER — operator cockpit metrics/suggestions removed (dead remnants);
  // ManagerModuleView now fetches its own data via API.

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
              <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-c-surface-raised">
                {r.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-c-text truncate">{r.title}</div>
                <div className="text-[10px] text-c-text-muted truncate">{r.audience}</div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'cadence',
        label: t('execution.reportCatalog.col.cadence', 'Cadence'),
        width: '100px',
        filterable: true,
        filterOptions: [
          { value: 'Weekly', label: t('execution.reportCatalog.cadence.weekly', 'Weekly') },
          { value: 'Bi-weekly', label: t('execution.reportCatalog.cadence.biweekly', 'Bi-weekly') },
          { value: 'Monthly', label: t('execution.reportCatalog.cadence.monthly', 'Monthly') },
          { value: 'On demand', label: t('execution.reportCatalog.cadence.onDemand', 'On demand') },
        ],
        render: (row: any) => (
          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
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
                      ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400'
                      : h.variant === 'warn'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : 'bg-c-surface-raised text-c-text-muted'
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
          <span className="text-xs text-c-text-muted tabular-nums">
            {(row as ReportDef).sections.length}
          </span>
        ),
      },
    ],
    [t]
  );

  const renderReportPreviewBody = useCallback(
    (report: ReportDef) => {
      const rag = computeRAG(report);
      const ragConf = RAG_CONFIG[rag];
      const RagIcon = ragConf.icon;

      // #20 — generate REAL report CONTENT from live data for this report type.
      // Wizard-created reports carry a period via generatedReports; predefined
      // catalog entries fall back to a live snapshot.
      const wizardConfig = generatedReports.find((g) => g.id === report.id);
      const generatedDoc = generateReportDocument({
        typeId: (wizardConfig?.typeId as string) || report.id,
        title: report.title,
        audience: report.audience,
        periodFrom: wizardConfig?.periodFrom,
        periodTo: wizardConfig?.periodTo,
        scopeNote: wizardConfig?.scopeNote,
        ctx: reportDataContext,
        isPolish,
      });

      return (
        <div className="overflow-auto">
          {/* Generated, data-backed report document */}
          <GeneratedReportView doc={generatedDoc} />

          {/* Configuration / methodology descriptor */}
          <div className="px-4 pb-2 pt-1">
            <div className="text-[10px] uppercase tracking-wider text-c-text-muted font-medium border-t border-c-border-subtle pt-3">
              {t('execution.reportPanel.methodology', 'Report configuration & methodology')}
            </div>
          </div>
          <div className="p-4 pt-2 space-y-4">
            {/* RAG badge + title */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${ragConf.bg} ${ragConf.text} ${ragConf.border} border`}
                >
                  <RagIcon size={10} className="inline mr-1 -mt-0.5" />
                  {ragConf.label}
                </div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                  {report.cadence}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-c-surface-raised">
                  {report.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-c-text">{report.title}</div>
                  <div className="text-[10px] text-c-text-muted">{report.audience}</div>
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
                        ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400'
                        : h.variant === 'warn'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                          : 'bg-c-surface-raised text-c-text-muted'
                    }`}
                  >
                    {h.label}: {h.value}
                  </span>
                ))}
              </div>
            )}

            {/* Scope */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                Scope
              </div>
              <p className="text-xs text-c-text-secondary leading-relaxed">{report.scope}</p>
            </div>

            {/* Data sources */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                Data Sources
              </div>
              <div className="flex flex-wrap gap-1">
                {report.dataSources.map((ds) => (
                  <span
                    key={ds}
                    className="inline-block px-1.5 py-0.5 rounded bg-c-surface-raised text-[10px] text-c-text-muted"
                  >
                    {ds}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                AI Executive Readout
              </div>
              <div className="space-y-1.5">
                {report.aiExecutiveReadout.slice(0, 3).map((line) => (
                  <div
                    key={line}
                    className="rounded-lg border border-c-border-subtle px-3 py-2 text-[11px] text-c-text-secondary"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory sections */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                Mandatory Sections
              </div>
              <ol className="space-y-0.5 list-decimal list-inside">
                {report.sections.map((s) => (
                  <li key={s} className="text-[11px] text-c-text-muted">
                    {s}
                  </li>
                ))}
              </ol>
            </div>

            {/* RAG logic */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                RAG / Confidence Logic
              </div>
              <p className="text-[11px] text-c-text-muted leading-relaxed">{report.ragLogic}</p>
            </div>

            {/* Follow-up actions */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                Expected Follow-up Actions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.followUpActions.map((a) => (
                  <span
                    key={a}
                    className="inline-block rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised px-2 py-0.5 text-[10px] font-medium text-c-text-secondary"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1 font-medium">
                Data Quality
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-block px-2 py-0.5 rounded-full bg-c-surface-raised text-[10px] text-c-text-muted">
                  {report.dataQuality.confidence}
                </span>
                {report.degradedFlags.map((flag) => (
                  <span
                    key={flag}
                    className="inline-block rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised px-2 py-0.5 text-[10px] text-c-text-muted"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    },
    [generatedReports, reportDataContext, isPolish, t]
  );

  const handleGenerateInWordy = useCallback(
    (report: ReportDef) => {
      navigate(`/wordy?sourceType=execution_report&sourceId=${encodeURIComponent(report.id)}`);
    },
    [navigate]
  );

  // Note: the footer button row (Generate with AI / Generate in Wordy / PDF /
  // Copy) that used to live here as `renderReportPreviewFooter` is now the
  // StandardPreview canon A7 block 6 action grid — see `reportPreviewActions`
  // below, wired into the 'reports' table-view preview pane.

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
      // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Execution
      // 'reports' tab → StandardTable + StandardPreview, 1:1 with the 'list'
      // (Portfolio) tab in this same file. Module declares TYLKO data + kebab
      // contract (buildReportRowMenu); all chrome comes from Standard* facades.
      type ReportRow = ReportDef & { title: string };
      const selectedReportPreviewId = reportPreviewId;
      const selectedReport = selectedReportPreviewId
        ? ((filteredReportCatalog.find((r) => r.id === selectedReportPreviewId) as
            | ReportRow
            | undefined) ?? null)
        : null;
      const rag = selectedReport ? computeRAG(selectedReport) : null;
      const ragConf = rag ? RAG_CONFIG[rag] : null;
      const ragTone: 'success' | 'warning' | 'danger' | 'neutral' =
        rag === 'green'
          ? 'success'
          : rag === 'amber'
            ? 'warning'
            : rag === 'red'
              ? 'danger'
              : 'neutral';

      return (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="min-h-0 flex-1 flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
              <StandardTable
                columns={reportColumns}
                data={
                  filteredReportCatalog as unknown as Array<
                    Record<string, unknown> & { id: string }
                  >
                }
                selectedRowId={selectedReportPreviewId}
                onRowClick={(row) => setReportPreviewId(String((row as any).id))}
                onRowDoubleClick={(row) => {
                  const r = filteredReportCatalog.find((x) => x.id === (row as any).id);
                  if (r) handleOpenReport(r);
                }}
                rowDescription={() => null}
                persistKey="execution-reports"
                density="compact"
                selection={{ selectedIds: reportSelectedIds, onChange: setReportSelectedIds }}
                empty={{
                  icon: FileText,
                  title: t('execution.reportCatalog.noData', 'No reports'),
                  description: t(
                    'execution.reportCatalog.noDataDesc',
                    'Reports will be populated once initiatives are actively executing. Add initiatives to the portfolio to start generating reports.'
                  ),
                }}
                rowMenu={(row) => {
                  const r = filteredReportCatalog.find((x) => x.id === (row as any).id);
                  return r
                    ? buildReportRowMenu(r)
                    : ({ primary: [], universalHandlers: {}, destructive: {} } as StandardRowMenu);
                }}
                activeFilters={reportFilters}
                onFilterChange={setReportFilters}
              />
            </div>

            {selectedReport ? (
              <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                <StandardPreview
                  title={selectedReport.title}
                  onClose={() => setReportPreviewId(null)}
                  onOpenFull={() => handleOpenReport(selectedReport)}
                  meta={{
                    pills: [
                      ...(ragConf ? [{ label: ragConf.label, tone: ragTone }] : []),
                      { label: selectedReport.cadence, tone: 'neutral' as const },
                    ],
                    trailing: (
                      <span className="text-[11px] font-semibold text-c-text-secondary">
                        {selectedReport.audience}
                      </span>
                    ),
                  }}
                  details={{
                    text: [
                      `${t('execution.reportCatalog.col.data', 'Live Data')}: ${
                        selectedReport.highlights.map((h) => `${h.label}: ${h.value}`).join(', ') ||
                        '—'
                      }`,
                      `${t('execution.reportCatalog.col.sections', 'Sections')}: ${selectedReport.sections.length}`,
                      '',
                      selectedReport.scope,
                    ].join('\n'),
                    onCopy: () => {
                      void navigator.clipboard?.writeText(
                        `${selectedReport.title} — ${selectedReport.cadence} (${ragConf?.label ?? ''})`
                      );
                    },
                  }}
                  ai={{
                    hints: [
                      t(
                        'execution.reportPanel.summarizePrompt',
                        'Summarize this report in 5 bullets and propose 3 next steps.'
                      ),
                    ],
                    onRunHint: () => handleGenerateReport(selectedReport),
                  }}
                  relations={selectedReport.dataSources.map((ds) => ({ label: ds }))}
                  actions={reportPreviewActions(selectedReport)}
                >
                  {/* Rich generated report document + methodology descriptor —
                      preserved from the pre-triada preview (module-specific
                      content beyond the 6 canon blocks, canon A7 `children`). */}
                  {renderReportPreviewBody(selectedReport)}
                </StandardPreview>
              </aside>
            ) : null}
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-c-text">
              {t('execution.reports.title', 'Execution reports')}
            </h2>
            <p className="mt-0.5 text-xs text-c-text-muted">
              {t(
                'execution.reportCatalog.subheading',
                'Pre-defined reports built from live execution data. Click to expand contract, then generate or export.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('execution.reportCatalog.openGlobal', 'Global Reports →')}
          </button>
        </div>

        {executiveHealthFailed && (
          <Callout
            variant="warning"
            title={t('execution.executiveHealth.failed', 'Executive health signals unavailable')}
          >
            {t(
              'execution.executiveHealth.failedDesc',
              'Per-initiative health (RAG status, why-red chains) could not be loaded. The dashboard is operating without execution-health overlays — a degraded state, not an all-healthy portfolio.'
            )}
          </Callout>
        )}

        {renderActionCenter()}

        <details className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
            {t('execution.reports.workloadPreview', 'Workload preview')}
          </summary>
          <div className="border-t border-c-border-subtle">
            <ExecutionWorkloadView
              initiatives={dashboardBaseInitiatives as FullInitiative[]}
              onInitiativeClick={handleOpenSidePanel}
              projectId={currentProjectId || undefined}
              showControls={false}
            />
          </div>
        </details>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredReportCatalog.map((report) => {
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => handleOpenReport(report)}
                className="group rounded-xl border bg-c-surface transition-all text-left border-c-border-subtle hover:border-c-border-strong hover:shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-c-surface-raised group-hover:bg-c-surface-raised transition-colors">
                        {report.icon}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-c-text leading-tight">
                          {report.title}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-c-text-muted">
                            {report.cadence}
                          </span>
                          <span className="text-[10px] text-c-text-muted">·</span>
                          <span className="text-[10px] text-c-text-muted">{report.audience}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      size={14}
                      className="text-c-text-muted transition-transform group-hover:text-c-text-secondary"
                    />
                  </div>

                  {report.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {report.highlights.map((h) => (
                        <span
                          key={h.label}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                            h.variant === 'critical'
                              ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400'
                              : h.variant === 'warn'
                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                : 'bg-c-surface-raised text-c-text-muted'
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

  // Triada standard (StandardPreview, canon A7): selected row + actions for the
  // 'list' tab (Portfolio) preview pane. 1:1 with the Assessment 'list' /
  // Meeting 'list' / Results KPI catalog adopters.
  const selectedSummaryInitiative: FullInitiative | null = summaryPreviewInitiativeId
    ? (summaryInitiatives.find((i) => i.id === summaryPreviewInitiativeId) ?? null)
    : null;

  const listPreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedSummaryInitiative
        ? {
            // canon §7.3 — "Open" usunięte z informational: dublowało onOpenFull
            // przekazywane do StandardPreview w tym samym renderze (header ma już Open).
            informational: [
              {
                id: 'copy-link',
                variant: 'neutral',
                label: t('execution.actions.copyLink', 'Copy link'),
                icon: Link2,
                onClick: () => void copyExecutionLink(selectedSummaryInitiative.id),
              },
            ],
          }
        : undefined,
    [selectedSummaryInitiative, t, handleOpenDocument, copyExecutionLink]
  );

  // Triada standard (StandardPreview, canon A7): action grid for the
  // 'reports' tab preview pane, 1:1 with listPreviewActions above. Row 1
  // (resolutions) = generation entry points; row 2 (informational) = export.
  const reportPreviewActions = useCallback(
    (report: ReportDef): StandardPreviewActions => {
      const rag = computeRAG(report);
      return {
        resolutions: [
          {
            id: 'generate-ai',
            variant: 'positive',
            label: t('execution.reportPanel.generateAI', 'Generate with AI'),
            icon: Sparkles,
            shortcut: 'A',
            onClick: () => handleGenerateReport(report),
          },
          {
            id: 'generate-wordy',
            variant: 'neutral',
            label: t('execution.reportPanel.generateInWordy', 'Generate in Wordy'),
            icon: FileText,
            onClick: () => handleGenerateInWordy(report),
          },
        ],
        informational: [
          {
            id: 'pdf',
            variant: 'neutral',
            label: 'PDF',
            icon: ExternalLink,
            onClick: () => {
              exportReportPDF(report, rag);
              toast.success(t('execution.reportPanel.pdfExported', 'PDF downloaded'));
            },
          },
          {
            id: 'copy',
            variant: 'neutral',
            label: t('execution.reportPanel.copy', 'Copy'),
            icon: Link2,
            onClick: () => {
              const wizardConfig = generatedReports.find((g) => g.id === report.id);
              const doc = generateReportDocument({
                typeId: (wizardConfig?.typeId as string) || report.id,
                title: report.title,
                audience: report.audience,
                periodFrom: wizardConfig?.periodFrom,
                periodTo: wizardConfig?.periodTo,
                scopeNote: wizardConfig?.scopeNote,
                ctx: reportDataContext,
                isPolish,
              });
              const md = `${reportDocumentToMarkdown(doc)}\n\n---\n\n${buildReportMarkdown(report, rag)}`;
              navigator.clipboard.writeText(md).then(
                () => toast.success(t('execution.reportPanel.copied', 'Copied')),
                () => toast.error(t('execution.reportPanel.copyFailed', 'Copy failed'))
              );
            },
          },
        ],
      };
    },
    [t, handleGenerateReport, handleGenerateInWordy, generatedReports, reportDataContext, isPolish]
  );

  // Esc closes preview; single-key shortcuts (O) active while preview open (kanon B.24/B.31).
  useEffect(() => {
    if (activeTab !== 'list' || viewMode !== 'table' || !summaryPreviewInitiativeId) return;
    const shortcuts = standardPreviewShortcuts(listPreviewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setSummaryPreviewInitiativeId(null);
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
  }, [activeTab, viewMode, summaryPreviewInitiativeId, listPreviewActions]);

  // Esc closes preview; single-key shortcuts (A) active while preview open
  // (kanon B.24/B.31), 1:1 with the 'list' tab effect above.
  useEffect(() => {
    if (activeTab !== 'reports' || viewMode !== 'table' || !reportPreviewId) return;
    const selected = filteredReportCatalog.find((r) => r.id === reportPreviewId);
    const shortcuts = selected ? standardPreviewShortcuts(reportPreviewActions(selected)) : {};
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setReportPreviewId(null);
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
  }, [activeTab, viewMode, reportPreviewId, filteredReportCatalog, reportPreviewActions]);

  // Triada standard (canon A3/Menu 3): bulk command row for the 'list' tab
  // table, 1:1 with Assessment/Results catalog bulk bars. Replaces the
  // FilterableTable-internal bulk strip that used to live inline in the table
  // content area.
  const summaryBulkCommandRowContent = null;

  // Triada standard (canon A3/Menu 3): bulk command row for the 'reports' tab
  // table, 1:1 with the 'list' tab above. Report catalog rows have no bulk
  // status transitions (generated definitions) — Select all/Clear only.
  const reportBulkCommandRowContent =
    activeTab === 'reports' && viewMode === 'table' && reportSelectedIds.size > 0 ? (
      <div className={MENU_3_INNER_CLASS}>
        <div className={MENU_3_LEFT_CLASS}>
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
            {t('execution.table.selectedCount', '{{count}} selected', {
              count: reportSelectedIds.size,
            })}
          </span>
          <Menu3Chip onClick={toggleReportSelectAll}>
            {t('common.selectAll', 'Select all')}
          </Menu3Chip>
          <Menu3Chip onClick={clearReportSelection}>{t('common.clear', 'Clear')}</Menu3Chip>
        </div>
        <div className={MENU_3_RIGHT_CLASS} />
      </div>
    ) : null;

  // Render content
  const renderContent = () => {
    if (activeTab === 'list')
      return (
        <ExecutionRealizationsSurface
          scope={scope}
          activePreset={canonicalMenu3Preset.list}
          onCountsChange={menu3CountHandlers.list}
        />
      );
    if (activeTab === ('work' as ModuleTab))
      return (
        <ExecutionWorkSurface
          activePreset={canonicalMenu3Preset.work}
          onCountsChange={menu3CountHandlers.work}
        />
      );
    if (activeTab === ('resources' as ModuleTab))
      return (
        <ExecutionResourcesSurface
          activePreset={canonicalMenu3Preset.resources}
          onCountsChange={menu3CountHandlers.resources}
        />
      );
    if (activeTab === ('control' as ModuleTab))
      return (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <ExecutionDeliveryClosurePanel
            initialLinkId={searchParams.get('executionLinkId')}
            onLinkIdChange={(linkId) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', 'control');
              next.set('executionLinkId', linkId);
              setSearchParams(next, { replace: true });
            }}
          />
          <ExecutionControlSurface
            activePreset={canonicalMenu3Preset.control}
            onCountsChange={menu3CountHandlers.control}
          />
        </div>
      );
    if (activeTab === 'reports')
      return (
        <ExecutionReportsSurface
          activePreset={canonicalMenu3Preset.reports}
          onCountsChange={menu3CountHandlers.reports}
        />
      );
    // Rollout tab manages its own data + loading/error states independently of
    // the portfolio fetch, so resolve it before the portfolio loading guards.
    if (activeTab === ('rollout' as ModuleTab)) {
      return (
        <RolloutTab
          projectId={currentProjectId || undefined}
          initiatives={
            (summaryInitiatives.length ? summaryInitiatives : initiatives) as FullInitiative[]
          }
          riskSignals={riskSignals}
          delaySignals={delaySignals}
          readOnly={isPilotParticipant}
          onRegisterCommandRowContent={setRolloutCommandRowContent}
          onOpenChat={openRolloutRiskChat}
        />
      );
    }

    if (initiativesLoadError) {
      // IMPACT-TR-002 / BUG-2: previously this rendered an infinite spinner on a
      // load failure (the "stuck spinner" the user saw). Degrade gracefully with a
      // localized error + a retry that also clears any latched transport/auth-loop
      // guard so a transient block (429 storm, refresh race) can recover.
      const isTransportBlock =
        initiativesLoadErrorCode === 'CLIENT_AUTH_LOOP_GUARD_OPEN' ||
        initiativesLoadErrorCode === 'CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN' ||
        /transport safeguard|auth loop guard/i.test(initiativesLoadError || '');
      return (
        <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-c-danger" />
          <h3 className="mb-2 text-lg font-semibold text-c-text">
            {isTransportBlock
              ? t('execution.hub.transportBlockedTitle', 'Requests temporarily blocked')
              : t('execution.hub.loadErrorTitle', 'Failed to load implementation data')}
          </h3>
          <p className="mb-6 max-w-md text-sm text-c-text-muted">{initiativesLoadError}</p>
          <button
            type="button"
            onClick={() => {
              clearGlobalTransportFailure();
              resetAuthLoopGuard();
              initRetryRef.current = 0;
              setInitiativesLoadError(null);
              setInitiativesLoadErrorCode(null);
              setIsLoading(true);
              queueExecutionTruthRefresh();
            }}
            className="inline-flex items-center gap-2 rounded-token-md bg-c-text px-4 py-2 text-sm font-medium text-c-surface transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-[var(--c-surface)]"
          >
            <RefreshCw className="h-4 w-4" />
            {t('common.retry', 'Retry')}
          </button>
        </div>
      );
    }

    if (isLoading) {
      return <HubWorkAreaLoading />;
    }

    if (summaryOneLookEnabled && activeTab === ('summary' as ModuleTab)) {
      return (
        <ExecutionSummaryOneLook
          health={summaryOneLookProps.health}
          onTime={summaryOneLookProps.onTime}
          value={summaryOneLookProps.value}
          people={summaryOneLookProps.people}
          topRisks={summaryOneLookProps.topRisks}
          decisions={summaryOneLookProps.decisions}
          milestones={summaryOneLookProps.milestones}
          currency="PLN"
          isPolish={isPolish}
          generatedAt={summaryOneLookProps.generatedAt}
          onOpenEntity={(type, id) => {
            if (handleOpenSidePanel) handleOpenSidePanel({ id, name: id } as any);
          }}
        />
      );
    }

    if (activeTab === ('people_change' as ModuleTab)) {
      return (
        <ExecutionManagementView
          managerLaneCounts={managerLaneCounts}
          v8Degraded={managerV8Degraded}
          projectId={currentProjectId || undefined}
          searchQuery={searchQuery}
          hasExecutingInitiatives={dashboardBaseInitiatives.length > 0}
          onRegisterCommandRowContent={setManagerCommandRowContent}
          onRegisterCommandRowRightContent={setManagerCommandRowRightContent}
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
        <Suspense fallback={<HubWorkAreaLoading />}>
          <ExecutionInitiativeDocumentView
            initiativeId={activeDocumentId}
            onBack={handleShowList}
            onStatusChange={isPilotParticipant ? undefined : () => handleRefresh()}
            sourceModule="execution"
          />
        </Suspense>
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
        ? (['table'] as ViewMode[])
        : activeTab === 'reports'
          ? (['table'] as ViewMode[])
          : ([] as ViewMode[]),
    [activeTab]
  );

  // Tabs that render their own full-bleed surface (no document tabs / filters / new-item).
  const isChromelessTab =
    activeTab === ('people_change' as ModuleTab) || activeTab === ('rollout' as ModuleTab);

  // #19 — per-view Menu-2 CTA. The right-side primary action depends on the
  // active sub-view. Rollout sub-actions are fired as CustomEvents (the contract
  // with lane L8, which builds the tab tables and listens for them).
  const menuCta = useMemo((): { onNewItem?: () => void; newItemLabel: string } => {
    const defaultLabel = t('initiatives.form.newInitiative', 'New Initiative');
    if (isPilotParticipant) return { onNewItem: undefined, newItemLabel: defaultLabel };

    const dispatch = (name: string) => () => window.dispatchEvent(new CustomEvent(name));

    if (activeTab === 'reports') {
      return {
        onNewItem: undefined,
        newItemLabel: t('execution.reports.newReport', 'New Report'),
      };
    }

    if (activeTab === ('rollout' as ModuleTab)) {
      switch (rolloutSubview) {
        case 'kpi':
          return {
            onNewItem: dispatch('execution:add-kpi'),
            newItemLabel: t('execution.rollout.addKpi', 'Add KPI'),
          };
        case 'risks':
          return {
            onNewItem: dispatch('execution:add-risk'),
            newItemLabel: t('execution.rollout.addRisk', 'Add Risk'),
          };
        case 'closure':
          return {
            onNewItem: dispatch('execution:add-closure-item'),
            newItemLabel: t('execution.rollout.addClosureItem', 'Add Item'),
          };
        // 'plan' (Master Rollout Plan) and 'change' (Change Log) -> NO CTA.
        default:
          return { onNewItem: undefined, newItemLabel: defaultLabel };
      }
    }

    if (activeTab === ('people_change' as ModuleTab)) {
      return { onNewItem: undefined, newItemLabel: defaultLabel };
    }

    // Canonical Realizacje are created only by accepted Handoff; never manually.
    return { onNewItem: undefined, newItemLabel: defaultLabel };
  }, [activeTab, handleCreateInitiative, isPilotParticipant, rolloutSubview, t]);

  return (
    <>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleMainTabChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onSearch={setSearchQuery}
        openItems={isChromelessTab ? [] : openDocuments}
        activeItemId={isChromelessTab ? null : activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={
          isChromelessTab
            ? []
            : activeTab === 'list'
              ? summaryFilters
              : activeTab === 'reports'
                ? reportFilters
                : activeFilters
        }
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={menuCta.onNewItem}
        newItemLabel={menuCta.newItemLabel}
        activeStatusFilter={activeStatusFilter}
        onStatusFilterChange={setActiveStatusFilter}
        filterControls={rightControls}
        viewModes={availableViewModes}
        commandRowContent={undefined}
        commandRowRightContent={undefined}
        chips={(EXECUTION_MENU3[activeTab] ?? []).map((preset) => ({
          ...preset,
          count: canonicalMenu3Counts[activeTab]?.[preset.id] ?? 0,
        }))}
        activeChip={canonicalMenu3Preset[activeTab] ?? null}
        onChipChange={(id) =>
          setCanonicalMenu3Preset((current) => ({ ...current, [activeTab]: id }))
        }
      >
        {renderContent()}
      </StandardModuleBar>
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
      {/* #20 — Report Generator Wizard. Self-mounts here so it can catch the
          'reporting:new-report' CustomEvent dispatched by the Reporting Menu-2 CTA
          and emit 'reporting:report-created' on Complete (handled above). */}
      <ReportGeneratorWizard />
    </>
  );
};

export default ExecutionHub;
