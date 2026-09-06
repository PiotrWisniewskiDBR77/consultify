/**
 * @deprecated This component is LEGACY and will be removed.
 * Use InitiativeDocumentView instead for the canonical full initiative view.
 *
 * InitiativeFullView
 * Full initiative view component designed to be opened as a dynamic tab
 * in ModuleHub (Tools, Assessment, Initiatives modules)
 *
 * Features:
 * - Complete initiative lifecycle visualization
 * - Status-aware action buttons (Submit for Review, Approve, etc.)
 * - Tabbed interface: Overview, Tasks, Definition, Economics, Team, History
 * - Real-time data from API
 * - Integration with gate decisions workflow
 *
 * MIGRATION NOTE: Replace usages with InitiativeDocumentView from './InitiativeDocumentView'
 */

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  History,
  Lightbulb,
  ListTodo,
  Loader2,
  MessageSquare,
  Play,
  Send,
  Shield,
  Target,
  TrendingUp,
  User,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import { formatRoiDisplay } from '@/utils/safeFormat';

import { CapabilityGate } from '../shared/CapabilityGate';
import { type RowAction, RowActionsMenu } from '../shared/RowActionsMenu';
import { InitiativeSourceLink } from './InitiativeSourceLink';

// FAZA C (model ról PM): gate → capability z katalogu backendu
// (effectiveAccessService). Fallback = generyczna zmiana statusu.
const GATE_CAPABILITIES: Record<string, string> = {
  SUBMIT_FOR_REVIEW: 'initiative.submit',
  APPROVE_TO_INITIATIVE: 'initiative.approve_to_review',
  SEND_BACK: 'initiative.send_back',
  ACCEPT: 'initiative.promote',
  APPROVE: 'initiative.approve',
  SCHEDULE: 'initiative.schedule',
  START: 'initiative.start',
  COMPLETE: 'initiative.complete',
  BLOCK: 'initiative.block',
  UNBLOCK: 'initiative.unblock',
  CANCEL: 'initiative.cancel',
};

const capabilityForGate = (gate: string): string =>
  GATE_CAPABILITIES[gate] ?? 'initiative.status.change';

// Status metadata for UI
const STATUS_META: Record<
  string,
  { labelKey: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  DRAFT: {
    labelKey: 'initiatives.status.draft',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-500/20',
    icon: <FileText size={14} />,
  },
  PENDING_REVIEW: {
    labelKey: 'initiatives.status.pendingReview',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: <Clock size={14} />,
  },
  REVIEW: {
    labelKey: 'initiatives.status.review',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: <Eye size={14} />,
  },
  PROMOTED: {
    labelKey: 'initiatives.status.promoted',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <TrendingUp size={14} />,
  },
  PLANNING: {
    labelKey: 'initiatives.status.planning',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    icon: <ListTodo size={14} />,
  },
  APPROVED: {
    labelKey: 'initiatives.status.approved',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: <CheckCircle size={14} />,
  },
  SCHEDULED: {
    labelKey: 'initiatives.status.scheduled',
    color: 'text-c-info',
    bgColor: 'bg-c-info/20',
    icon: <Calendar size={14} />,
  },
  EXECUTING: {
    labelKey: 'initiatives.status.executing',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <Play size={14} />,
  },
  BLOCKED: {
    labelKey: 'initiatives.status.blocked',
    color: 'text-danger-400',
    bgColor: 'bg-danger-500/20',
    icon: <AlertTriangle size={14} />,
  },
  DONE: {
    labelKey: 'initiatives.status.done',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: <CheckCircle2 size={14} />,
  },
  TRACKING: {
    labelKey: 'initiatives.status.tracking',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <BarChart size={14} />,
  },
  CANCELLED: {
    labelKey: 'initiatives.status.cancelled',
    color: 'text-gray-600',
    bgColor: 'bg-gray-500/20',
    icon: <XCircle size={14} />,
  },
};

// Lifecycle phases for progress indicator
const LIFECYCLE_PHASES = [
  { id: 'source', labelKey: 'initiatives.fullView.lifecycle.source', statuses: ['DRAFT', 'PENDING_APPROVAL'], color: 'slate' },
  { id: 'review', labelKey: 'initiatives.fullView.lifecycle.review', statuses: ['REVIEW', 'PENDING_APPROVAL'], color: 'amber' },
  {
    id: 'planning',
    labelKey: 'initiatives.fullView.lifecycle.planning',
    statuses: ['PLANNING', 'APPROVED', 'SCHEDULED'],
    color: 'blue',
  },
  {
    id: 'execution',
    labelKey: 'initiatives.fullView.lifecycle.execution',
    statuses: ['IN_EXECUTION', 'IN_EXECUTION', 'DONE'],
    color: 'cyan',
  },
  { id: 'benefits', labelKey: 'initiatives.fullView.lifecycle.benefits', statuses: ['CLOSED'], color: 'teal' },
];

// Task interface
interface InitiativeTask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | "BLOCKED" | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: string;
  estimatedHours?: number;
}

// Full initiative data
interface FullInitiativeData {
  id: string;
  name: string;
  title?: string;
  description?: string;
  summary?: string;
  status: string;
  priority?: string;
  axis?: string;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  ownerBusinessId?: string;
  ownerExecutionId?: string;
  ownerBusiness?: { firstName: string; lastName: string };
  ownerExecution?: { firstName: string; lastName: string };
  sponsorId?: string;
  sponsor?: { firstName: string; lastName: string };
  plannedStartDate?: string;
  plannedEndDate?: string;
  tasks?: InitiativeTask[];
  sourceType?: string;
  sourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  // Extended fields
  strategicIntent?: string;
  businessValue?: string;
  problemStatement?: string;
  targetState?: string;
  keyRisks?: string[];
  deliverables?: string[];
  successCriteria?: string[];
}

type TabType = 'overview' | 'tasks' | 'definition' | 'economics' | 'team' | 'history';

interface InitiativeFullViewProps {
  initiativeId: string;
  onBack?: () => void;
  onStatusChange?: () => void;
  sourceModule?: 'tools' | 'assessment' | 'initiatives' | 'execution';
}

/**
 * B7.3: TruncatedListSection — replaces unreadable long lists.
 * Shows maxVisible items, then a "Show more" toggle for the rest.
 */
const TruncatedListSection: React.FC<{
  title: string;
  items: string[];
  icon: React.ReactNode;
  maxVisible?: number;
}> = ({ title, items, icon, maxVisible = 3 }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center justify-between">
        <span>{title}</span>
        <span className="text-slate-500 font-normal">{items.length}</span>
      </h3>
      <ul className="space-y-2">
        {visible.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            {icon}
            {item}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-c-info hover:text-c-info transition-colors"
        >
          {expanded ? `Show less` : `Show ${items.length - maxVisible} more…`}
        </button>
      )}
    </div>
  );
};

export const InitiativeFullView: React.FC<InitiativeFullViewProps> = ({
  initiativeId,
  onBack,
  onStatusChange,
  sourceModule = 'initiatives',
}) => {
  // State
  const [initiative, setInitiative] = useState<FullInitiativeData | null>(null);
  const [tasks, setTasks] = useState<InitiativeTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { t, i18n } = useTranslation();

  // Fetch initiative data
  const fetchInitiative = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.getInitiativeById(initiativeId);
      setInitiative({
        id: data.id,
        name: data.name || data.title || t('initiatives.fullView.untitled'),
        title: data.title,
        description: data.description,
        summary: data.summary,
        status: data.status || 'DRAFT',
        priority: data.priority,
        axis: data.axis,
        costCapex: data.costCapex || data.cost_capex,
        costOpex: data.costOpex || data.cost_opex,
        expectedRoi: data.expectedRoi || data.expected_roi,
        ownerBusinessId: data.ownerBusinessId || data.owner_business_id,
        ownerExecutionId: data.ownerExecutionId || data.owner_execution_id,
        ownerBusiness: data.ownerBusiness,
        ownerExecution: data.ownerExecution,
        sponsorId: data.sponsorId || data.sponsor_id,
        sponsor: data.sponsor,
        plannedStartDate: data.plannedStartDate || data.planned_start_date,
        plannedEndDate: data.plannedEndDate || data.planned_end_date,
        tasks: data.tasks || [],
        sourceType: data.sourceType || data.source_type,
        sourceId: data.sourceId || data.source_id,
        createdAt: data.createdAt || data.created_at,
        updatedAt: data.updatedAt || data.updated_at,
        createdBy: data.createdBy || data.created_by,
        strategicIntent: data.strategicIntent || data.strategic_intent,
        businessValue: data.businessValue || data.business_value,
        problemStatement: data.problemStatement || data.problem_statement,
        targetState: data.targetState || data.target_state,
        keyRisks: data.keyRisks || data.key_risks || [],
        deliverables: data.deliverables || [],
        successCriteria: data.successCriteria || data.success_criteria || [],
      });

      // Fetch tasks
      try {
        const tasksData = await Api.getInitiativeTasks(initiativeId);
        setTasks(
          tasksData.map((t: any) => ({
            id: t.id,
            title: t.title || t.name,
            status: t.status || 'TODO',
            priority: t.priority || 'MEDIUM',
            assigneeId: t.assigneeId || t.assignee_id,
            assigneeName: t.assignee?.firstName
              ? `${t.assignee.firstName} ${t.assignee.lastName}`
              : undefined,
            dueDate: t.dueDate || t.due_date,
            estimatedHours: t.estimatedHours || t.estimated_hours,
          }))
        );
      } catch {
        setTasks([]);
      }
    } catch (err: any) {
      console.error('[InitiativeFullView] Fetch error:', err);
      setError(err?.message || t('initiatives.fullView.error.title'));
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId, t]);

  useEffect(() => {
    if (initiativeId) {
      fetchInitiative();
    }
  }, [fetchInitiative, initiativeId]);

  // Get current phase index
  const currentPhaseIndex = useMemo(() => {
    if (!initiative) return 0;
    return LIFECYCLE_PHASES.findIndex((phase) => phase.statuses.includes(initiative.status));
  }, [initiative]);

  // Get available actions based on status
  const availableActions = useMemo(() => {
    if (!initiative) return [];
    const status = initiative.status;
    const actions: {
      id: string;
      label: string;
      gate: string;
      color: string;
      icon: React.ReactNode;
    }[] = [];

    switch (status) {
      case 'PROPOSED':
        actions.push({ id: 'draft', label: t('initiatives.transition.createDraft'), gate: 'CREATE_DRAFT', color: 'bg-c-surface-2', icon: <ListTodo size={16} /> });
        break;
      case 'DRAFT':
        actions.push({
          id: 'submit',
          label: t('initiatives.transition.submitForReview'),
          gate: 'SUBMIT_FOR_REVIEW',
          color: 'bg-amber-600 hover:bg-amber-500',
          icon: <Send size={16} />,
        });
        break;
      case 'PENDING_APPROVAL':
        actions.push({
          id: 'approve',
          label: t('initiatives.transition.approveToInitiatives'),
          gate: 'APPROVE_TO_INITIATIVE',
          color: 'bg-emerald-600 hover:bg-emerald-500',
          icon: <CheckCircle size={16} />,
        });
        actions.push({
          id: 'sendback',
          label: t('initiatives.transition.sendBack'),
          gate: 'SEND_BACK',
          color: 'bg-slate-600 hover:bg-slate-500',
          icon: <ArrowLeft size={16} />,
        });
        break;
      case 'APPROVED':
        actions.push({
          id: 'start',
          label: t('initiatives.transition.startExecution'),
          gate: 'START',
          color: 'bg-blue-600 hover:bg-blue-500',
          icon: <Play size={16} />,
        });
        break;
      case 'IN_EXECUTION':
        actions.push({
          id: 'complete',
          label: t('initiatives.transition.markComplete'),
          gate: 'COMPLETE',
          color: 'bg-green-600 hover:bg-green-500',
          icon: <CheckCircle2 size={16} />,
        });
        break;
    }

    // Cancel is always available (except terminal states)
    if (!['CLOSED', 'REJECTED'].includes(status)) {
      actions.push({
        id: 'cancel',
        label: t('initiatives.transition.cancel'),
        gate: 'CANCEL',
        color: 'bg-gray-600 hover:bg-gray-500',
        icon: <XCircle size={16} />,
      });
    }

    return actions;
  }, [initiative, t]);

  // Handle gate action
  const handleGateAction = useCallback(
    async (gate: string) => {
      if (!initiative) return;
      setIsTransitioning(true);
      try {
        await Api.patch(`/initiatives/${initiative.id}/gate`, { gate });
        toast.success(
          t('initiatives.toast.gateActionSuccess', 'Action "{{gate}}" completed successfully', {
            gate,
          })
        );
        await fetchInitiative();
        onStatusChange?.();
      } catch (err: any) {
        console.error('[InitiativeFullView] Gate action error:', err);
        // #74: Api.patch throws a plain Error (fetch-based, not axios) whose
        // `.message` carries the backend's actual gate/transition reason.
        // `err.response.data.error` is an axios shape this client never
        // produces, so it always fell through to the generic fallback.
        toast.error(
          err?.message ||
            t('initiatives.toast.gateActionError', 'Could not perform {{gate}}', { gate })
        );
      } finally {
        setIsTransitioning(false);
      }
    },
    [initiative, fetchInitiative, onStatusChange]
  );

  // Helper functions
  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(i18n.resolvedLanguage || i18n.language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'DONE':
        return 'bg-green-500/20 text-green-400';
      case 'IN_PROGRESS':
        return 'bg-blue-500/20 text-blue-400';
      case 'IN_EXECUTION':
        return 'bg-danger-500/20 text-danger-400';
      default:
        return 'bg-slate-500/20 text-slate-500 dark:text-slate-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-danger-400';
      case 'HIGH':
        return 'text-amber-400';
      case 'MEDIUM':
        return 'text-amber-400';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  // Task stats
  const taskStats = useMemo(
    () => ({
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'DONE').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      blocked: tasks.filter((t) => t.status === 'IN_EXECUTION').length,
    }),
    [tasks]
  );

  const completionPercent =
    taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0;

  // Tabs
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('initiatives.fullView.tabs.overview'), icon: <Target size={14} /> },
    { id: 'tasks', label: t('initiatives.fullView.tabs.tasks'), icon: <ListTodo size={14} /> },
    { id: 'definition', label: t('initiatives.fullView.tabs.definition'), icon: <FileText size={14} /> },
    { id: 'economics', label: t('initiatives.fullView.tabs.economics'), icon: <DollarSign size={14} /> },
    { id: 'team', label: t('initiatives.fullView.tabs.team'), icon: <Users size={14} /> },
    { id: 'history', label: t('initiatives.fullView.tabs.history'), icon: <History size={14} /> },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <LoadingState variant="spinner" label={t('initiatives.fullView.loading')} />
      </div>
    );
  }

  // Error state
  if (error || !initiative) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-danger-400" />
          <p className="text-lg text-slate-900 dark:text-white mb-2">{t('initiatives.fullView.error.title')}</p>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || t('initiatives.fullView.error.notFound')}
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-slate-200 dark:bg-navy-700 hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-900 dark:text-white rounded-lg text-sm transition-colors"
            >
              {t('initiatives.fullView.error.backToList')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[initiative.status] || STATUS_META.DRAFT;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        {/* Lifecycle Progress */}
        <div className="h-12 border-b border-slate-200 dark:border-navy-800 flex items-center px-6 gap-0">
          {LIFECYCLE_PHASES.map((phase, idx) => {
            const isActive = phase.statuses.includes(initiative.status);
            const isPassed = idx < currentPhaseIndex;
            return (
              <React.Fragment key={phase.id}>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                      : isPassed
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : isPassed
                          ? 'bg-green-500 text-white'
                          : 'bg-slate-600 text-white'
                    }`}
                  >
                    {isPassed && !isActive ? '✓' : idx + 1}
                  </span>
                  <span className="uppercase tracking-wide hidden sm:inline">{t(phase.labelKey)}</span>
                </div>
                {idx < LIFECYCLE_PHASES.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${isPassed || isActive ? 'bg-green-500/30' : 'bg-slate-300 dark:bg-slate-700'}`}
                  />
                )}
              </React.Fragment>
            );
          })}
          <div className="flex-1" />
          <span
            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1.5 ${statusMeta.bgColor} ${statusMeta.color}`}
          >
            {statusMeta.icon}
            {t(statusMeta.labelKey)}
          </span>
        </div>

        {/* Main Header */}
        <div className="px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors mt-1"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {initiative.axis && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-c-info/20 text-c-info capitalize">
                      {t(`initiatives.fullView.axis.${initiative.axis.toLowerCase()}`, initiative.axis)}
                    </span>
                  )}
                  {initiative.priority && (
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(initiative.priority)}`}
                    >
                      {t(`initiatives.priority.${initiative.priority.toLowerCase()}`)}
                    </span>
                  )}
                  {initiative.sourceType && initiative.sourceId ? <InitiativeSourceLink sourceType={initiative.sourceType} sourceId={initiative.sourceId} /> : null}
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {initiative.name}
                </h1>
                {initiative.summary && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl line-clamp-2">
                    {initiative.summary}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {availableActions.slice(0, 2).map((action) => (
                // FAZA C: bramka capability (fail-open — w trybie shadow renderuje
                // 1:1 jak dotąd; filtruje dopiero CAPABILITY_ENFORCE=enforce).
                <CapabilityGate key={action.id} capability={capabilityForGate(action.gate)}>
                  <button
                    onClick={() => handleGateAction(action.gate)}
                    disabled={isTransitioning}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${action.color} disabled:opacity-50`}
                  >
                    {isTransitioning ? <Loader2 size={16} className="animate-spin" /> : action.icon}
                    {action.label}
                  </button>
                </CapabilityGate>
              ))}
              {availableActions.length > 2 && (
                <RowActionsMenu
                  // #40 — pure-wiring bridge onto the sectional kebab contract; filter
                  // replicates legacy flat-menu semantics exactly (zero visible change).
                  sections={[
                    {
                      id: 'legacy',
                      actions: availableActions
                        .slice(2)
                        .map((action) => ({
                          id: action.id,
                          label: action.label,
                          onClick: () => handleGateAction(action.gate),
                          disabled: isTransitioning,
                          variant:
                            action.id === 'cancel' ? ('danger' as const) : ('default' as const),
                        }))
                        .filter((a) => !a.disabled),
                    },
                  ]}
                  size="md"
                />
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pb-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white border-t border-x border-slate-200 dark:border-navy-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'tasks' && taskStats.total > 0 && (
                <span className="px-1.5 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400">
                  {taskStats.total}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Summary */}
              {initiative.summary && (
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <FileText size={14} />
                    {t('initiatives.fullView.overview.summary')}
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {initiative.summary}
                  </p>
                </div>
              )}

              {/* Tasks Summary */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                    <ListTodo size={14} />
                    {t('initiatives.fullView.overview.tasksCount', { count: taskStats.total })}
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">
                      {t('initiatives.fullView.taskStats.done', { count: taskStats.done })}
                    </span>
                    <span className="text-blue-400">
                      {t('initiatives.fullView.taskStats.inProgress', {
                        count: taskStats.inProgress,
                      })}
                    </span>
                    {taskStats.blocked > 0 && (
                      <span className="text-danger-400">
                        {t('initiatives.fullView.taskStats.blocked', { count: taskStats.blocked })}
                      </span>
                    )}
                  </div>
                </div>

                {taskStats.total > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>{t('initiatives.fullView.overview.completion')}</span>
                      <span>{completionPercent}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-c-info to-c-info rounded-full transition-all"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {tasks.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('initiatives.fullView.tasks.empty')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700"
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            task.status === 'DONE'
                              ? 'bg-green-400'
                              : task.status === 'IN_PROGRESS'
                                ? 'bg-blue-400'
                                : task.status === "BLOCKED"
                                  ? 'bg-danger-400'
                                  : 'bg-slate-400'
                          }`}
                        />
                        <span className="flex-1 text-sm text-slate-900 dark:text-white truncate">
                          {task.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getTaskStatusColor(task.status)}`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                    {tasks.length > 5 && (
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className="w-full py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        View all {tasks.length} tasks →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Source Info */}
              {initiative.sourceType && initiative.sourceId && (
                <div className="space-y-2">
                  <InitiativeSourceLink sourceType={initiative.sourceType} sourceId={initiative.sourceId} />
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4">
                  {t('initiatives.fullView.overview.keyMetrics')}
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      CAPEX
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(initiative.costCapex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign size={14} />
                      OPEX
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(initiative.costOpex)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <TrendingUp size={14} />
                      {t('initiatives.fullView.overview.expectedRoi')}
                    </span>
                    <span className="text-sm font-semibold text-green-400">
                      {formatRoiDisplay(initiative.expectedRoi)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Calendar size={14} />
                  {t('initiatives.fullView.overview.timeline')}
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">{t('initiatives.fullView.overview.startDate')}</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {formatDate(initiative.plannedStartDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{t('initiatives.fullView.overview.endDate')}</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {formatDate(initiative.plannedEndDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ownership */}
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <Users size={14} />
                  {t('initiatives.fullView.overview.ownership')}
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500">{t('initiatives.fullView.team.businessOwner')}</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {initiative.ownerBusiness ? (
                        `${initiative.ownerBusiness.firstName} ${initiative.ownerBusiness.lastName}`
                      ) : (
                        <span className="text-slate-500">{t('initiatives.fullView.team.notAssigned')}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">{t('initiatives.fullView.team.executionOwner')}</span>
                    <div className="text-sm text-slate-900 dark:text-white">
                      {initiative.ownerExecution ? (
                        `${initiative.ownerExecution.firstName} ${initiative.ownerExecution.lastName}`
                      ) : (
                        <span className="text-slate-500">{t('initiatives.fullView.team.notAssigned')}</span>
                      )}
                    </div>
                  </div>
                  {initiative.sponsor && (
                    <div>
                      <span className="text-xs text-slate-500">{t('initiatives.fullView.team.sponsor')}</span>
                      <div className="text-sm text-slate-900 dark:text-white">
                        {`${initiative.sponsor.firstName} ${initiative.sponsor.lastName}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-white/50 dark:bg-navy-900/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <div className="space-y-2 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>{t('initiatives.fullView.history.created')}</span>
                    <span>{formatDate(initiative.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('initiatives.fullView.history.updated')}</span>
                    <span>{formatDate(initiative.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ListTodo className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg text-slate-900 dark:text-white mb-2">{t('initiatives.fullView.tasks.empty')}</p>
                <p className="text-sm">{t('initiatives.fullView.tasks.emptyDescription')}</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-c-info/30 transition-colors"
                >
                  <div
                    className={`w-3 h-3 rounded-full ${
                      task.status === 'DONE'
                        ? 'bg-green-400'
                        : task.status === 'IN_PROGRESS'
                          ? 'bg-blue-400'
                          : task.status === "BLOCKED"
                            ? 'bg-danger-400'
                            : 'bg-slate-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-900 dark:text-white font-medium truncate">
                        {task.title}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getTaskStatusColor(task.status)}`}
                      >
                        {t(`initiatives.fullView.taskStatus.${task.status.toLowerCase()}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      {task.assigneeName && (
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {task.assigneeName}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.estimatedHours && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {task.estimatedHours}h
                        </span>
                      )}
                    </div>
                  </div>
                  <Flag size={14} className={getPriorityColor(task.priority)} />
                </div>
              ))
            )}
          </div>
        )}

        {/* Definition Tab */}
        {activeTab === 'definition' && (
          <div className="space-y-6">
            {initiative.strategicIntent && (
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                  {t('initiatives.fullView.definition.strategicIntent')}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {initiative.strategicIntent}
                </p>
              </div>
            )}
            {initiative.businessValue && (
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                  {t('initiatives.fullView.definition.businessValue')}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {initiative.businessValue}
                </p>
              </div>
            )}
            {initiative.problemStatement && (
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">
                  {t('initiatives.fullView.definition.problemStatement')}
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {initiative.problemStatement}
                </p>
              </div>
            )}
            {initiative.deliverables && initiative.deliverables.length > 0 && (
              <TruncatedListSection
                title={t('initiatives.fullView.definition.deliverables')}
                items={initiative.deliverables}
                icon={<CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />}
                maxVisible={3}
              />
            )}
            {initiative.keyRisks && initiative.keyRisks.length > 0 && (
              <TruncatedListSection
                title={t('initiatives.fullView.definition.keyRisks')}
                items={initiative.keyRisks}
                icon={<AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />}
                maxVisible={3}
              />
            )}
            {!initiative.strategicIntent &&
              !initiative.businessValue &&
              !initiative.problemStatement && (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg text-slate-900 dark:text-white mb-2">
                    {t('initiatives.fullView.definition.empty')}
                  </p>
                  <p className="text-sm">
                    {t('initiatives.fullView.definition.emptyDescription')}
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Economics Tab */}
        {activeTab === 'economics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <DollarSign size={20} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">CAPEX</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(initiative.costCapex)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('initiatives.fullView.economics.capexDescription')}</p>
            </div>
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-c-info/20 text-c-info">
                  <DollarSign size={20} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">OPEX</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(initiative.costOpex)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('initiatives.fullView.economics.opexDescription')}</p>
            </div>
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-green-500/20 text-green-400">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                    {t('initiatives.fullView.overview.expectedRoi')}
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {formatRoiDisplay(initiative.expectedRoi)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('initiatives.fullView.economics.roiDescription')}</p>
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                    {t('initiatives.fullView.team.businessOwner')}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {initiative.ownerBusiness
                      ? `${initiative.ownerBusiness.firstName} ${initiative.ownerBusiness.lastName}`
                      : t('initiatives.fullView.team.notAssigned')}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('initiatives.fullView.team.businessOwnerDescription')}</p>
            </div>
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-c-info/20 flex items-center justify-center text-c-info">
                  <User size={20} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                    {t('initiatives.fullView.team.executionOwner')}
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {initiative.ownerExecution
                      ? `${initiative.ownerExecution.firstName} ${initiative.ownerExecution.lastName}`
                      : t('initiatives.fullView.team.notAssigned')}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">{t('initiatives.fullView.team.executionOwnerDescription')}</p>
            </div>
            {initiative.sponsor && (
              <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                      {t('initiatives.fullView.team.sponsor')}
                    </div>
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {`${initiative.sponsor.firstName} ${initiative.sponsor.lastName}`}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500">{t('initiatives.fullView.team.sponsorDescription')}</p>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="text-center py-12 text-slate-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg text-slate-900 dark:text-white mb-2">{t('initiatives.fullView.history.title')}</p>
            <p className="text-sm">{t('initiatives.fullView.history.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InitiativeFullView;
