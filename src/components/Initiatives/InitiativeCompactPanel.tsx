/**
 * InitiativeCompactPanel
 *
 * Template-driven compact side panel for initiative quick view.
 * Slides in from the right side (~420px). Shows key metrics,
 * status actions, and tabbed sections in a condensed format.
 *
 * Two display modes:
 *   - Embedded: renders inline (no overlay/backdrop)
 *   - Overlay: renders as a slide-over with backdrop
 *
 * Respects the initiative template's visible_sections.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  Maximize2,
  MessageSquare,
  Scale,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { getStatusActions, getStatusMeta, StatusAction } from '@/services/initiativeLifecycle';

import { InitiativeStatus, PortfolioInitiative, User } from '../../types';

// ==========================================
// TYPES
// ==========================================

interface InitiativeCompactPanelProps {
  initiative: PortfolioInitiative | null;
  initiativeId?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenFull?: (initiative: PortfolioInitiative) => void;
  onUpdate?: (updated: PortfolioInitiative) => void;
  mode?: 'overlay' | 'embedded';
  users?: User[];
}

type CompactTab = 'summary' | 'tasks' | 'decisions' | 'raid' | 'finance';

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assigneeName?: string;
  isMilestone?: boolean;
}

interface DecisionItem {
  id: string;
  title: string;
  type: string;
  status: string;
  priority?: string;
  dueDate?: string;
  ownerName?: string;
}

interface RaidItem {
  id: string;
  type: string;
  title: string;
  severity?: string;
  status?: string;
}

// ==========================================
// CONSTANTS
// ==========================================

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-500', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-500', dot: 'bg-orange-500' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-500' },
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500' },
};

const TASK_STATUS_COLORS: Record<string, string> = {
  done: 'text-emerald-500',
  DONE: 'text-emerald-500',
  in_progress: 'text-blue-500',
  IN_PROGRESS: 'text-blue-500',
  todo: 'text-slate-400',
  TODO: 'text-slate-400',
  blocked: 'text-red-500',
  BLOCKED: 'text-red-500',
};

const DECISION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  APPROVED: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  REJECTED: { bg: 'bg-red-500/10', text: 'text-red-500' },
  DEFERRED: { bg: 'bg-slate-500/10', text: 'text-slate-500' },
};

const RAID_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  risk: { icon: AlertTriangle, color: 'text-red-500' },
  RISK: { icon: AlertTriangle, color: 'text-red-500' },
  issue: { icon: AlertTriangle, color: 'text-amber-500' },
  ISSUE: { icon: AlertTriangle, color: 'text-amber-500' },
  assumption: { icon: Target, color: 'text-blue-500' },
  ASSUMPTION: { icon: Target, color: 'text-blue-500' },
  dependency: { icon: ChevronRight, color: 'text-purple-500' },
  DEPENDENCY: { icon: ChevronRight, color: 'text-purple-500' },
};

const COMPACT_TABS: { id: CompactTab; label: string; icon: React.ElementType }[] = [
  { id: 'summary', label: 'Summary', icon: FileText },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'decisions', label: 'Decisions', icon: Scale },
  { id: 'raid', label: 'RAID', icon: AlertTriangle },
  { id: 'finance', label: 'Finance', icon: DollarSign },
];

// ==========================================
// HELPERS
// ==========================================

const formatDate = (d?: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
};

const ProgressBar: React.FC<{ value: number; max: number; color?: string }> = ({
  value,
  max,
  color = 'bg-purple-500',
}) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

export const InitiativeCompactPanel: React.FC<InitiativeCompactPanelProps> = ({
  initiative: propInitiative,
  initiativeId: propInitiativeId,
  isOpen,
  onClose,
  onOpenFull,
  onUpdate,
  mode = 'overlay',
  users = [],
}) => {
  const { t } = useTranslation();
  // Data
  const [initiative, setInitiative] = useState<PortfolioInitiative | null>(propInitiative);
  const [isLoading, setIsLoading] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
  const [activeTab, setActiveTab] = useState<CompactTab>('summary');

  const id = initiative?.id || propInitiativeId;

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // If we don't have a full initiative object, fetch it
      if (!initiative || !initiative.name) {
        const data = await Api.getInitiativeById(id);
        setInitiative(data);
      }

      // Fetch related data in parallel
      const [tasksRes, decisionsRes, raidRes] = await Promise.allSettled([
        Api.get(`/tasks?initiativeId=${id}`),
        Api.get(`/decisions?relatedObjectId=${id}&relatedObjectType=initiative`),
        Api.get(`/initiatives/${id}/raid`),
      ]);

      if (tasksRes.status === 'fulfilled') {
        const arr = Array.isArray(tasksRes.value) ? tasksRes.value : tasksRes.value?.tasks || [];
        setTasks(
          arr.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            assigneeName: t.assigneeName || t.assignee?.name,
            isMilestone: t.isMilestone || false,
          }))
        );
      }

      if (decisionsRes.status === 'fulfilled') {
        const arr = Array.isArray(decisionsRes.value)
          ? decisionsRes.value
          : decisionsRes.value?.decisions || [];
        setDecisions(arr);
      }

      if (raidRes.status === 'fulfilled') {
        const arr =
          raidRes.value?.items ||
          raidRes.value?.raid ||
          (Array.isArray(raidRes.value) ? raidRes.value : []);
        setRaidItems(arr);
      }
    } catch (e: any) {
      console.error('Failed to load initiative data', e);
    } finally {
      setIsLoading(false);
    }
  }, [id, initiative]);

  useEffect(() => {
    if (isOpen && id) {
      fetchData();
    }
  }, [isOpen, id, fetchData]);

  useEffect(() => {
    setInitiative(propInitiative);
  }, [propInitiative]);

  // ==========================================
  // COMPUTED
  // ==========================================

  const status = ((initiative?.status || 'DRAFT') as string).toUpperCase() as InitiativeStatus;
  const statusMeta = getStatusMeta(status);
  const statusActions = getStatusActions(status);
  const priority = (initiative?.priority || 'medium').toLowerCase();
  const priorityStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;

  const tasksDone = useMemo(
    () => tasks.filter((t) => t.status === 'done' || t.status === 'DONE').length,
    [tasks]
  );
  const tasksTotal = tasks.length;
  const taskProgress = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const milestones = useMemo(() => tasks.filter((t) => t.isMilestone), [tasks]);
  const pendingDecisions = useMemo(
    () => decisions.filter((d) => d.status === 'PENDING').length,
    [decisions]
  );
  const riskCount = useMemo(
    () => raidItems.filter((r) => r.type === 'risk' || r.type === 'RISK').length,
    [raidItems]
  );
  const issueCount = useMemo(
    () => raidItems.filter((r) => r.type === 'issue' || r.type === 'ISSUE').length,
    [raidItems]
  );

  // D3.1: Approval validation — check critical fields before allowing APPROVED status
  const handleStatusAction = async (action: StatusAction) => {
    if (!id) return;

    // D3.1: Block approval if critical fields are missing
    if (action.targetStatus === InitiativeStatus.APPROVED && initiative) {
      const approvalErrors: string[] = [];

      if (tasksTotal === 0) {
        approvalErrors.push('At least 1 task is required');
      }
      if (!initiative.plannedEndDate) {
        approvalErrors.push('A deadline (end date) must be set');
      }
      if (!initiative.ownerBusiness?.id) {
        approvalErrors.push('A business owner must be assigned');
      }

      if (approvalErrors.length > 0) {
        toast.error(
          t(
            'initiatives.toast.cannotApprove',
            'Nie można zatwierdzić — brakuje wymaganych pól:\n• {{errors}}',
            { errors: approvalErrors.join('\n• ') }
          ),
          { duration: 6000 }
        );
        return;
      }
    }

    try {
      await Api.patch(`/initiatives/${id}`, { status: action.targetStatus });
      toast.success(
        t('initiatives.toast.statusChangedLabel', 'Status zmieniony na {{label}}', {
          label: action.label,
        })
      );
      const updated = { ...initiative!, status: action.targetStatus as InitiativeStatus };
      setInitiative(updated);
      onUpdate?.(updated);
    } catch (e: any) {
      toast.error(
        e?.message || t('initiatives.toast.statusChangeFailed', 'Zmiana statusu nie powiodła się')
      );
    }
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (!isOpen) return null;

  const panelContent = (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="w-[420px] h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusMeta.dotColor}`} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {initiative?.name || 'Loading...'}
            </h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onOpenFull && initiative && (
              <button
                onClick={() => onOpenFull(initiative)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-500/10 transition-all"
                title="Open full card"
              >
                <Maximize2 size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-all"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Status + Priority + Actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusMeta.bgColor} ${statusMeta.color}`}
          >
            {statusMeta.label}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${priorityStyle.bg} ${priorityStyle.text}`}
          >
            {priority}
          </span>
          {/* Quick status actions */}
          {statusActions
            .filter((a) => a.variant === 'primary')
            .slice(0, 2)
            .map((action) => (
              <button
                key={action.targetStatus}
                onClick={() => handleStatusAction(action)}
                className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors"
              >
                <ArrowRight size={10} />
                {action.label}
              </button>
            ))}
        </div>
      </div>

      {/* D3.3 / D3.4: Missing data banner — motivates to fill in initiative info */}
      {initiative &&
        (() => {
          const missing: string[] = [];
          if (tasksTotal === 0) missing.push(t('initiatives.missing.tasks', 'Tasks'));
          if (!initiative.plannedEndDate)
            missing.push(t('initiatives.missing.deadline', 'Deadline'));
          if (!initiative.ownerBusiness?.id) missing.push(t('initiatives.missing.owner', 'Owner'));
          if (!(initiative as any).summary && !(initiative as any).description)
            missing.push(t('initiatives.missing.summary', 'Summary'));
          if (riskCount === 0) missing.push(t('initiatives.missing.risks', 'Risk assessment'));
          return missing.length > 0 ? (
            <div className="flex-shrink-0 px-4 py-2 border-b border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-900/10">
              <div className="flex items-start gap-2">
                <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                    {t('initiatives.missingData', 'Missing critical data')}
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500">
                    {missing.join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          ) : null;
        })()}

      {/* B7.2: Key Info — Goal always visible (placeholder when empty) */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-slate-100 dark:border-navy-800">
        <div className="flex items-start gap-2">
          <Target size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
          {(initiative as any)?.summary || (initiative as any)?.description ? (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
              {(initiative as any).summary || (initiative as any).description}
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              No goal / summary defined yet — add one in the full view.
            </p>
          )}
        </div>
      </div>

      {/* B7.2: Metrics Dashboard — Tasks, Team, Resources, Finance/Risk */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100 dark:border-navy-800">
        <div className="grid grid-cols-5 gap-2">
          <MetricBox
            icon={CheckSquare}
            label="Tasks"
            value={`${tasksDone}/${tasksTotal}`}
            color="text-blue-500"
            progress={taskProgress}
          />
          <MetricBox
            icon={Users}
            label="Team"
            value={(initiative as any)?.ownerBusiness ? '✓' : '—'}
            color={(initiative as any)?.ownerBusiness ? 'text-purple-500' : 'text-slate-400'}
          />
          <MetricBox
            icon={Calendar}
            label="Timeline"
            value={
              initiative?.plannedEndDate
                ? new Date(initiative.plannedEndDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                  })
                : '—'
            }
            color="text-cyan-500"
          />
          <MetricBox
            icon={DollarSign}
            label="Budget"
            value={(() => {
              const amt =
                (initiative as any)?.estimatedBudget ||
                (initiative as any)?.costCapex ||
                (initiative as any)?.budget;
              if (!amt) return '—';
              if (amt >= 1_000_000) return `${(amt / 1_000_000).toFixed(1)}M`;
              if (amt >= 1_000) return `${(amt / 1_000).toFixed(0)}K`;
              return `${amt}`;
            })()}
            color="text-amber-500"
          />
          <MetricBox
            icon={AlertTriangle}
            label="Risks"
            value={`${riskCount}R/${issueCount}I`}
            color={riskCount > 0 ? 'text-red-500' : 'text-slate-400'}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-slate-200 dark:border-navy-700 px-2 overflow-x-auto">
        {COMPACT_TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.id === 'tasks'
              ? tasksTotal
              : tab.id === 'decisions'
                ? decisions.length
                : tab.id === 'raid'
                  ? raidItems.length
                  : undefined;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={12} />
              {tab.label}
              {count !== undefined && count > 0 && (
                <span
                  className={`ml-0.5 px-1 py-0 rounded text-[9px] font-bold ${activeTab === tab.id ? 'bg-purple-500/15 text-purple-500' : 'bg-slate-200 dark:bg-navy-700 text-slate-500'}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-purple-500" />
          </div>
        ) : (
          <>
            {activeTab === 'summary' && <SummaryTab initiative={initiative} users={users} />}
            {activeTab === 'tasks' && <TasksTab tasks={tasks} milestones={milestones} />}
            {activeTab === 'decisions' && <DecisionsTab decisions={decisions} />}
            {activeTab === 'raid' && <RaidTab items={raidItems} />}
            {activeTab === 'finance' && <FinanceTab initiative={initiative} />}
          </>
        )}
      </div>

      {/* Footer */}
      {onOpenFull && initiative && (
        <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={() => onOpenFull(initiative)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-violet-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold hover:from-purple-500/20 hover:to-violet-500/20 transition-all"
          >
            <Maximize2 size={14} />
            Open Full Initiative Card
          </button>
        </div>
      )}
    </motion.div>
  );

  if (mode === 'embedded') {
    return <AnimatePresence>{isOpen && panelContent}</AnimatePresence>;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex justify-end"
        >
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
          <div className="relative">{panelContent}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// METRIC BOX
// ==========================================

const MetricBox: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  progress?: number;
}> = ({ icon: Icon, label, value, color, progress }) => (
  <div className="text-center">
    <Icon size={14} className={`mx-auto mb-1 ${color}`} />
    <p className={`text-xs font-bold ${color}`}>{value}</p>
    <p className="text-[9px] text-slate-400">{label}</p>
    {progress !== undefined && (
      <div className="mt-1 w-full h-1 rounded-full bg-slate-200 dark:bg-navy-700">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    )}
  </div>
);

// ==========================================
// TAB: SUMMARY
// ==========================================

const SummaryTab: React.FC<{ initiative: PortfolioInitiative | null; users: User[] }> = ({
  initiative,
  users,
}) => {
  if (!initiative) return null;
  const init = initiative as any;

  return (
    <div className="p-4 space-y-4">
      {/* Description */}
      {(init.summary || init.description) && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Description
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-6">
            {init.summary || init.description}
          </p>
        </div>
      )}

      {/* Key Info Grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Owner', value: init.ownerName || init.owner?.name || '—', icon: Users },
          { label: 'Sponsor', value: init.sponsorName || init.sponsor?.name || '—', icon: Shield },
          {
            label: 'Target Date',
            value: formatDate(init.plannedEndDate || init.targetDate),
            icon: Calendar,
          },
          { label: 'Created', value: formatDate(init.createdAt || init.created_at), icon: Clock },
          { label: 'Strategic Axis', value: init.strategicAxis || init.axis || '—', icon: Target },
          {
            label: 'Budget',
            value: init.estimatedBudget ? `${init.estimatedBudget.toLocaleString()} PLN` : '—',
            icon: DollarSign,
          },
        ].map((item) => (
          <div key={item.label} className="p-2 rounded-lg bg-slate-50 dark:bg-navy-800/50">
            <div className="flex items-center gap-1.5 mb-0.5">
              <item.icon size={10} className="text-slate-400" />
              <span className="text-[9px] text-slate-400 font-medium">{item.label}</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tags */}
      {init.tags?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Tags
          </p>
          <div className="flex flex-wrap gap-1">
            {init.tags.map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-800 text-[10px] text-slate-600 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Kill Criteria / Scope */}
      {init.killCriteria?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1.5">
            Kill Criteria
          </p>
          <ul className="space-y-1">
            {init.killCriteria.map((kc: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-500/80">
                <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" />
                <span>{kc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ==========================================
// TAB: TASKS
// ==========================================

const MAX_VISIBLE_TASKS = 5; // B7.3: prevent unreadable long lists

const TasksTab: React.FC<{ tasks: TaskItem[]; milestones: TaskItem[] }> = ({
  tasks,
  milestones,
}) => {
  const [showAllActive, setShowAllActive] = React.useState(false);
  const [showAllBlocked, setShowAllBlocked] = React.useState(false);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400">
        <CheckSquare size={24} className="mb-2 opacity-30" />
        <p className="text-xs">No tasks yet</p>
      </div>
    );
  }

  const byStatus = {
    active: tasks.filter((t) => ['in_progress', 'IN_PROGRESS', 'todo', 'TODO'].includes(t.status)),
    done: tasks.filter((t) => ['done', 'DONE'].includes(t.status)),
    blocked: tasks.filter((t) => ['blocked', 'BLOCKED'].includes(t.status)),
  };

  const visibleBlocked = showAllBlocked
    ? byStatus.blocked
    : byStatus.blocked.slice(0, MAX_VISIBLE_TASKS);
  const visibleActive = showAllActive
    ? byStatus.active
    : byStatus.active.slice(0, MAX_VISIBLE_TASKS);

  return (
    <div className="p-3 space-y-3">
      {/* Progress bar */}
      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-slate-500">Progress</span>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
            {byStatus.done.length}/{tasks.length} (
            {tasks.length > 0 ? Math.round((byStatus.done.length / tasks.length) * 100) : 0}%)
          </span>
        </div>
        <ProgressBar value={byStatus.done.length} max={tasks.length} color="bg-emerald-500" />
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Flag size={10} /> Milestones
          </p>
          {milestones.map((ms) => (
            <div
              key={ms.id}
              className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors"
            >
              <Flag size={11} className="text-purple-500 flex-shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">
                {ms.title}
              </span>
              <span className="text-[10px] text-slate-400">{formatDate(ms.dueDate)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Blocked first — B7.3: truncated */}
      {byStatus.blocked.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">
            Blocked ({byStatus.blocked.length})
          </p>
          {visibleBlocked.map((t) => (
            <CompactTaskRow key={t.id} task={t} />
          ))}
          {byStatus.blocked.length > MAX_VISIBLE_TASKS && (
            <button
              onClick={() => setShowAllBlocked((v) => !v)}
              className="w-full text-center py-1 text-[10px] font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              {showAllBlocked
                ? 'Show less'
                : `Show ${byStatus.blocked.length - MAX_VISIBLE_TASKS} more…`}
            </button>
          )}
        </div>
      )}

      {/* Active — B7.3: truncated */}
      {byStatus.active.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Active ({byStatus.active.length})
          </p>
          {visibleActive.map((t) => (
            <CompactTaskRow key={t.id} task={t} />
          ))}
          {byStatus.active.length > MAX_VISIBLE_TASKS && (
            <button
              onClick={() => setShowAllActive((v) => !v)}
              className="w-full text-center py-1 text-[10px] font-medium text-slate-400 hover:text-slate-300 transition-colors"
            >
              {showAllActive
                ? 'Show less'
                : `Show ${byStatus.active.length - MAX_VISIBLE_TASKS} more…`}
            </button>
          )}
        </div>
      )}

      {/* Done (collapsed) */}
      {byStatus.done.length > 0 && (
        <details className="group">
          <summary className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider cursor-pointer hover:text-emerald-500 transition-colors">
            Done ({byStatus.done.length})
          </summary>
          <div className="mt-1 opacity-60">
            {byStatus.done.map((t) => (
              <CompactTaskRow key={t.id} task={t} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

const CompactTaskRow: React.FC<{ task: TaskItem }> = ({ task }) => {
  const isDone = task.status === 'done' || task.status === 'DONE';
  const statusColor = TASK_STATUS_COLORS[task.status] || 'text-slate-400';

  return (
    <div
      className={`flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors ${isDone ? 'line-through opacity-60' : ''}`}
    >
      <CheckCircle2 size={12} className={statusColor} />
      <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">
        {task.title}
      </span>
      {task.dueDate && (
        <span className="text-[9px] text-slate-400 flex-shrink-0">{formatDate(task.dueDate)}</span>
      )}
    </div>
  );
};

// ==========================================
// TAB: DECISIONS
// ==========================================

const DecisionsTab: React.FC<{ decisions: DecisionItem[] }> = ({ decisions }) => {
  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400">
        <Scale size={24} className="mb-2 opacity-30" />
        <p className="text-xs">No decisions yet</p>
      </div>
    );
  }

  const pending = decisions.filter((d) => d.status === 'PENDING');
  const resolved = decisions.filter((d) => d.status !== 'PENDING');

  return (
    <div className="p-3 space-y-3">
      {pending.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1.5">
            Pending ({pending.length})
          </p>
          {pending.map((d) => (
            <CompactDecisionRow key={d.id} decision={d} />
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Resolved ({resolved.length})
          </p>
          {resolved.map((d) => (
            <CompactDecisionRow key={d.id} decision={d} />
          ))}
        </div>
      )}
    </div>
  );
};

const CompactDecisionRow: React.FC<{ decision: DecisionItem }> = ({ decision }) => {
  const statusStyle = DECISION_STATUS_COLORS[decision.status] || DECISION_STATUS_COLORS.PENDING;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-navy-800/30 mb-1.5">
      <Scale size={12} className="text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{decision.title}</p>
        <p className="text-[9px] text-slate-400">
          {decision.type} {decision.dueDate ? `• Due ${formatDate(decision.dueDate)}` : ''}
        </p>
      </div>
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}
      >
        {decision.status}
      </span>
    </div>
  );
};

// ==========================================
// TAB: RAID
// ==========================================

const RaidTab: React.FC<{ items: RaidItem[] }> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400">
        <AlertTriangle size={24} className="mb-2 opacity-30" />
        <p className="text-xs">No RAID items yet</p>
      </div>
    );
  }

  const grouped = {
    risk: items.filter((i) => i.type === 'risk' || i.type === 'RISK'),
    issue: items.filter((i) => i.type === 'issue' || i.type === 'ISSUE'),
    assumption: items.filter((i) => i.type === 'assumption' || i.type === 'ASSUMPTION'),
    dependency: items.filter((i) => i.type === 'dependency' || i.type === 'DEPENDENCY'),
  };

  return (
    <div className="p-3 space-y-3">
      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(grouped).map(([type, arr]) => {
          if (arr.length === 0) return null;
          const cfg = RAID_TYPE_CONFIG[type] || RAID_TYPE_CONFIG.risk;
          const Icon = cfg.icon;
          return (
            <div
              key={type}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-navy-800/50"
            >
              <Icon size={11} className={cfg.color} />
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                {arr.length} {type}
              </span>
            </div>
          );
        })}
      </div>

      {/* Items */}
      {items.map((item) => {
        const cfg = RAID_TYPE_CONFIG[item.type] || RAID_TYPE_CONFIG.risk;
        const Icon = cfg.icon;
        return (
          <div
            key={item.id}
            className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-navy-800/30"
          >
            <Icon size={12} className={`${cfg.color} mt-0.5 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 dark:text-slate-300">{item.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] text-slate-400 uppercase">{item.type}</span>
                {item.severity && (
                  <span
                    className={`text-[9px] font-medium ${item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'text-red-500' : 'text-slate-400'}`}
                  >
                    {item.severity}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// TAB: FINANCE
// ==========================================

const FinanceTab: React.FC<{ initiative: PortfolioInitiative | null }> = ({ initiative }) => {
  const init = initiative as any;
  if (!init) return null;

  const budget = init.estimatedBudget || init.budget;
  const roi = init.roi || init.estimatedRoi;
  const spent = init.actualSpent || init.spent;

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            label: 'Budget',
            value: budget ? `${Number(budget).toLocaleString()} PLN` : '—',
            icon: DollarSign,
            color: 'text-blue-500',
          },
          {
            label: 'Spent',
            value: spent ? `${Number(spent).toLocaleString()} PLN` : '—',
            icon: TrendingUp,
            color: 'text-amber-500',
          },
          {
            label: 'ROI',
            value: roi ? `${roi}%` : '—',
            icon: BarChart3,
            color: 'text-emerald-500',
          },
          {
            label: 'Impact',
            value: init.impact || init.strategicImpact || '—',
            icon: Target,
            color: 'text-purple-500',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800/50 border border-slate-100 dark:border-navy-700/50 text-center"
          >
            <item.icon size={16} className={`mx-auto mb-1 ${item.color}`} />
            <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      {budget && spent && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-800/50">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Budget utilization</span>
            <span>{Math.round((Number(spent) / Number(budget)) * 100)}%</span>
          </div>
          <ProgressBar
            value={Number(spent)}
            max={Number(budget)}
            color={Number(spent) > Number(budget) ? 'bg-red-500' : 'bg-blue-500'}
          />
        </div>
      )}

      {!budget && !roi && !spent && (
        <div className="flex flex-col items-center justify-center h-24 text-slate-400">
          <DollarSign size={24} className="mb-2 opacity-30" />
          <p className="text-xs">No financial data</p>
        </div>
      )}
    </div>
  );
};
