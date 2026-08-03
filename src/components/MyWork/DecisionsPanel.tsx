/**
 * DecisionsPanel - Enhanced decision management
 * Part of My Work Module PMO Upgrade
 *
 * Features:
 * - View toggle: My Decisions vs Awaiting Others
 * - Filters and sorting
 * - New decision creation
 * - Quick actions: OK, Not OK, Delegate
 * - Overdue alerts with animations
 * - Escalation system
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  Calendar,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileQuestion,
  Filter,
  Flag,
  FolderKanban,
  Hourglass,
  Loader2,
  MapPin,
  Plus,
  Search,
  Tag,
  Timer,
  TrendingUp,
  User,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type CardViewStyle, CardViewSwitcher } from '@/components/shared/CardViewSwitcher';
import type { GenericListItem, ListColumn, ListSection } from '@/components/shared/ViewLayouts';
import { ClickUpListView, NotionListView } from '@/components/shared/ViewLayouts';
import { PriorityCell } from '@/components/standard/PriorityCell';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

interface Decision {
  id: string;
  title: string;
  description?: string;
  decisionType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'ESCALATED';
  decisionOwnerId?: string;
  ownerName?: string;
  requestedById?: string;
  requestedByName?: string;
  projectId?: string;
  projectName?: string;
  locationId?: string;
  locationName?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  dueDate?: string;
  daysWaiting?: number;
  daysUntilDue?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  escalationLevel?: number;
  blockedItemsCount?: number;
}

type ViewMode = 'my' | 'awaiting';
type SortOrder = 'newest' | 'oldest' | 'urgency' | 'priority';
type FilterType = 'all' | 'overdue' | 'thisWeek' | 'blocking' | 'critical' | 'high';

/* ─────────────── Decision → GenericListItem mapping ─────────────── */

const getDecisionStatusVariant = (status?: string): GenericListItem['statusVariant'] => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'DEFERRED':
      return 'warning';
    case 'ESCALATED':
      return 'purple';
    case 'PENDING':
      return 'info';
    default:
      return 'neutral';
  }
};

const getDecisionPriorityVariant = (priority?: string): GenericListItem['priorityVariant'] => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'medium';
  }
};

const decisionToGenericItem = (d: Decision): GenericListItem => ({
  id: d.id,
  title: d.title || 'Untitled decision',
  subtitle: d.description || undefined,
  status: d.status,
  statusVariant: getDecisionStatusVariant(d.status),
  priority: d.priority || 'MEDIUM',
  priorityVariant: getDecisionPriorityVariant(d.priority),
  dueDate: d.dueDate
    ? new Date(d.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : undefined,
  isOverdue: d.isOverdue,
  assignee: d.ownerName || undefined,
  secondaryLabel: d.projectName || undefined,
  tertiaryLabel: d.decisionType || undefined,
  indicator: d.daysWaiting,
  indicatorLabel: d.daysWaiting ? `${d.daysWaiting}d waiting` : undefined,
  isHighlighted: d.isOverdue || d.priority === 'CRITICAL',
  _raw: d,
});

const DECISION_CLICKUP_COLUMNS: ListColumn[] = [
  { key: 'title', label: 'Decision', width: 'flex-1 min-w-0' },
  { key: 'status', label: 'Status', width: 'w-28' },
  { key: 'priority', label: 'Priority', width: 'w-24' },
  { key: 'assignee', label: 'Owner', width: 'w-32' },
  { key: 'dueDate', label: 'Due', width: 'w-24' },
  { key: 'indicator', label: 'Waiting', width: 'w-24' },
  { key: 'secondaryLabel', label: 'Project', width: 'w-32' },
];

interface DecisionsPanelProps {
  onDecisionClick?: (id: string) => void;
  createModalOpen?: boolean;
  onCreateModalOpen?: () => void;
  onCreateModalClose?: () => void;
  onCountsChange?: (counts: { total: number; my: number; awaiting: number }) => void;
}

/**
 * Overdue Badge Component with animation
 */
const OverdueBadge: React.FC<{ days: number }> = ({ days }) => {
  const { t } = useTranslation();

  const getBadgeStyle = () => {
    if (days > 7) {
      return 'bg-danger-500 text-white animate-pulse';
    } else if (days > 3) {
      return 'bg-amber-500 text-white';
    } else {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${getBadgeStyle()}`}
    >
      <AlertTriangle size={12} />
      {days}d
    </span>
  );
};

/**
 * New Decision Modal
 *
 * Exported (I1-I3 Faza 0) so `UnifiedCreateLauncher`
 * (src/components/shared/UnifiedCreateLauncher.tsx) can delegate to it directly
 * — zero change to the component itself, just visibility. Previously this was
 * only reachable via `DecisionsPanel` → `WorkCenter.tsx`, which has 0 live
 * callers (orphaned) — the unified launcher is now this component's only live
 * caller.
 */
export const NewDecisionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Decision>) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [decisionType, setDecisionType] = useState('GENERAL');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error(t('decisions.titleRequired', 'Title is required'));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        decisionType,
        priority,
        dueDate: dueDate || undefined,
        decisionOwnerId: assigneeId || undefined,
      });
      setTitle('');
      setDescription('');
      setDecisionType('GENERAL');
      setPriority('MEDIUM');
      setDueDate('');
      setAssigneeId('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-c-surface rounded-xl shadow-2xl w-full max-w-xl p-6 m-4 border border-slate-200/60 dark:border-white/[0.03] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-crimson-600 flex items-center justify-center">
              <FileQuestion size={20} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-c-text">
              {t('decisions.newDecision', 'New Decision Request')}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-2 rounded-lg hover:bg-c-surface-raised text-c-text-muted"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('decisions.field.title', 'Title')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('decisions.field.titlePlaceholder', 'What needs to be decided?')}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('decisions.field.description', 'Description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('decisions.field.descriptionPlaceholder', 'Add context or details...')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus resize-none"
            />
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                {t('decisions.field.type', 'Type')}
              </label>
              <select
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="GENERAL">📋 General</option>
                <option value="INITIATIVE_APPROVAL">🎯 Initiative Approval</option>
                <option value="PHASE_TRANSITION">🚀 Phase Transition</option>
                <option value="BUDGET">💰 Budget</option>
                <option value="SCOPE_CHANGE">📐 Scope Change</option>
                <option value="UNBLOCK">🔓 Unblock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-c-text-secondary mb-1">
                {t('decisions.field.priority', 'Priority')}
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
                }
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="LOW">🟢 Low</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="HIGH">🟠 High</option>
                <option value="CRITICAL">🔴 Critical</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              <span className="flex items-center gap-2">
                <CalendarClock size={14} />
                {t('decisions.field.dueDate', 'Decision Needed By')}
              </span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={today}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
            <p className="text-xs text-c-text-muted mt-1">
              {t('decisions.field.dueDateHint', 'Leave empty if no specific deadline')}
            </p>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              <span className="flex items-center gap-2">
                <User size={14} />
                {t('decisions.field.assignee', 'Decision Maker (optional)')}
              </span>
            </label>
            <input
              type="text"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              placeholder={t(
                'decisions.field.assigneePlaceholder',
                'Enter email or leave empty for auto-assign'
              )}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </div>
        </div>

        {/* Priority indicator */}
        {priority === 'CRITICAL' && (
          <div className="mt-4 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/20">
            <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300 text-sm">
              <Zap size={16} className="animate-pulse" />
              <span className="font-medium">
                {t(
                  'decisions.criticalWarning',
                  'Critical priority will trigger immediate notifications'
                )}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised font-medium transition-colors"
          >
            {t('decisions.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-c-text text-c-surface hover:opacity-90 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {t('decisions.create', 'Create')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Delegate Modal
 */
const DelegateModal: React.FC<{
  isOpen: boolean;
  decision: Decision | null;
  onClose: () => void;
  onDelegate: (decisionId: string, toUserId: string, note: string) => void;
}> = ({ isOpen, decision, onClose, onDelegate }) => {
  const { t } = useTranslation();
  const [toUserId, setToUserId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDelegate = async () => {
    if (!decision) {
      toast.error(t('decisions.error', 'No decision selected'));
      return;
    }
    if (!decision.id) {
      toast.error(t('decisions.error', 'Missing decision ID'));
      return;
    }
    if (!toUserId.trim()) {
      toast.error(t('decisions.selectUser', 'Please select a user'));
      return;
    }

    setSubmitting(true);
    try {
      await onDelegate(decision.id, toUserId.trim(), note);
      setToUserId('');
      setNote('');
      onClose();
    } catch (error) {
      console.error('[DelegateModal] Delegation failed:', error);
      toast.error(t('decisions.delegateError', 'Failed to delegate decision'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !decision) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-c-surface rounded-xl shadow-2xl w-full max-w-md p-6 m-4 border border-slate-200/60 dark:border-white/[0.03]"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-c-text flex items-center gap-2">
            <UserPlus size={20} className="text-c-text-secondary" />
            {t('decisions.delegate', 'Delegate Decision')}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-2 rounded-lg hover:bg-c-surface-raised text-c-text-muted"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-c-text-secondary mb-4">
          {t('decisions.delegatingDecision', 'Delegating')}: <strong>{decision.title}</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('decisions.delegateTo', 'Delegate to')} *
            </label>
            <input
              type="text"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              placeholder={t('decisions.enterUserId', 'Enter user email or ID')}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-c-text-secondary mb-1">
              {t('decisions.note', 'Note (optional)')}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('decisions.notePlaceholder', 'Add a message for the new assignee...')}
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised font-medium transition-colors"
          >
            {t('decisions.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleDelegate}
            disabled={submitting || !toUserId.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-c-text text-c-surface hover:opacity-90 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            {t('decisions.delegateBtn', 'Delegate')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/**
 * Priority Badge Component
 */
/**
 * N-29 (przegląd 128 zrzutów, 2026-07-27): kolumna PRIORITY pokazywała
 * wypełnione pigułki — `CRITICAL` był BIAŁYM tekstem na pełnym czerwonym tle
 * z `animate-pulse`, `MEDIUM` amber na amber. Kanon A4 wymaga kropki
 * + tonowanego tekstu; tak robi tabela Tasks, jedyny ekran, o którym Piotr
 * powiedział „na moje ok". Wspólny `PriorityCell` niesie teraz tę samą skalę.
 */
const PriorityBadge: React.FC<{ priority?: string }> = ({ priority }) => {
  const { t } = useTranslation();

  const labels: Record<string, string> = {
    CRITICAL: t('priority.critical', 'Critical'),
    HIGH: t('priority.high', 'High'),
    MEDIUM: t('priority.medium', 'Medium'),
    LOW: t('priority.low', 'Low'),
  };
  const key = String(priority ?? 'MEDIUM').toUpperCase();

  return <PriorityCell value={key} label={labels[key] ?? labels.MEDIUM} />;
};

/**
 * Status Timeline Badge
 */
const StatusTimeline: React.FC<{
  dueDate?: string;
  createdAt: string;
  isOverdue: boolean;
  daysOverdue: number;
  daysUntilDue: number;
}> = ({ dueDate, createdAt, isOverdue, daysOverdue, daysUntilDue }) => {
  const { t } = useTranslation();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  if (isOverdue && daysOverdue > 0) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${
          daysOverdue > 7
            ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 animate-pulse'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        }`}
      >
        <AlertTriangle size={14} className="shrink-0" />
        <div className="text-xs">
          <span className="font-bold">{daysOverdue}d</span>
          <span className="ml-1 opacity-80">{t('decisions.overdue', 'overdue')}</span>
        </div>
      </div>
    );
  }

  if (dueDate) {
    const isUrgent = daysUntilDue <= 2;
    const isSoon = daysUntilDue <= 5;

    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${
          isUrgent
            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            : isSoon
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
              : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300'
        }`}
      >
        {isUrgent ? <Timer size={14} /> : <CalendarClock size={14} />}
        <div className="text-xs">
          {isUrgent ? (
            <>
              <span className="font-bold">{daysUntilDue}d</span>
              <span className="ml-1 opacity-80">{t('decisions.left', 'left')}</span>
            </>
          ) : (
            <>
              <span className="font-medium">{formatDate(dueDate)}</span>
              <span className="ml-1 opacity-60">({daysUntilDue}d)</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-c-surface-raised text-c-text-muted">
      <Clock size={14} />
      <span className="text-xs">{formatDate(createdAt)}</span>
    </div>
  );
};

/**
 * Decision Card Component - Enhanced with full details
 */
const DecisionCard: React.FC<{
  decision: Decision;
  viewMode: ViewMode;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelegate: (decision: Decision) => void;
  onEscalate: (id: string) => void;
  onClick?: (id: string) => void;
}> = ({ decision, viewMode, onApprove, onReject, onDelegate, onEscalate, onClick }) => {
  const { t } = useTranslation();

  const isOverdue = decision.isOverdue || (decision.daysWaiting && decision.daysWaiting > 7);
  const daysOverdue = decision.daysOverdue || Math.max(0, (decision.daysWaiting || 0) - 7);
  const daysUntilDue =
    decision.daysUntilDue ||
    (decision.dueDate
      ? Math.ceil((new Date(decision.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 999);

  const getCardStyle = () => {
    if (isOverdue && daysOverdue > 7) {
      return 'border-l-danger-500 bg-gradient-to-r from-danger-50 to-white dark:from-danger-900/20 dark:to-navy-900 ring-1 ring-danger-200 dark:ring-danger-500/20';
    } else if (isOverdue) {
      return 'border-l-amber-500 bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-navy-900';
    } else if (decision.priority === 'CRITICAL') {
      return 'border-l-danger-500 bg-c-surface';
    } else if (decision.priority === 'HIGH') {
      return 'border-l-amber-500 bg-c-surface';
    }
    return 'border-l-c-border-strong bg-c-surface';
  };

  const getTypeLabel = (decisionType: string) => {
    const types: Record<string, { icon: string; label: string; color: string }> = {
      INITIATIVE_APPROVAL: { icon: '🎯', label: 'Initiative', color: 'text-blue-600' },
      PHASE_TRANSITION: { icon: '🚀', label: 'Phase Gate', color: 'text-c-text-secondary' },
      UNBLOCK: { icon: '🔓', label: 'Unblock', color: 'text-green-600' },
      CANCEL: { icon: '❌', label: 'Cancel', color: 'text-danger-600' },
      BUDGET: { icon: '💰', label: 'Budget', color: 'text-amber-600' },
      SCOPE_CHANGE: { icon: '📐', label: 'Scope', color: 'text-blue-600' },
      GENERAL: { icon: '📋', label: 'General', color: 'text-c-text-secondary' },
    };
    return types[decisionType] || types['GENERAL'];
  };

  const typeInfo = getTypeLabel(decision.decisionType);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-xl border border-c-border-subtle border-l-4 ${getCardStyle()} cursor-pointer hover:shadow-lg transition-all overflow-hidden`}
    >
      {/* Main Content */}
      <div className="p-4" onClick={() => onClick?.(decision.id)}>
        {/* Top Row: Type + Priority + Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Type Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-c-surface-raised ${typeInfo.color}`}
            >
              <span>{typeInfo.icon}</span>
              {typeInfo.label}
            </span>

            {/* Priority */}
            <PriorityBadge priority={decision.priority} />
          </div>

          {/* Status Timeline */}
          <StatusTimeline
            dueDate={decision.dueDate}
            createdAt={decision.createdAt}
            isOverdue={isOverdue || false}
            daysOverdue={daysOverdue}
            daysUntilDue={daysUntilDue}
          />
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-c-text mb-2 line-clamp-2">{decision.title}</h4>

        {/* Description */}
        {decision.description && (
          <p className="text-xs text-c-text-muted line-clamp-2 mb-3">{decision.description}</p>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Project */}
          {decision.projectName && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-c-surface-raised flex items-center justify-center shrink-0">
                <FolderKanban size={12} className="text-c-text-secondary" />
              </div>
              <span className="text-c-text-secondary truncate" title={decision.projectName}>
                {decision.projectName}
              </span>
            </div>
          )}

          {/* Location */}
          {decision.locationName && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <MapPin size={12} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-c-text-secondary truncate" title={decision.locationName}>
                {decision.locationName}
              </span>
            </div>
          )}

          {/* Owner/Assignee */}
          {viewMode === 'awaiting' && decision.ownerName && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-full bg-c-surface-raised flex items-center justify-center shrink-0 text-[10px] font-bold text-c-text-secondary">
                {decision.ownerName.charAt(0).toUpperCase()}
              </div>
              <span className="text-c-text-secondary truncate">{decision.ownerName}</span>
            </div>
          )}

          {/* Blocked Items */}
          {(decision.blockedItemsCount || 0) > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={12} className="text-danger-600 dark:text-danger-400" />
              </div>
              <span className="text-danger-600 dark:text-danger-400 font-medium">
                {decision.blockedItemsCount} {t('decisions.blocked', 'blocked')}
              </span>
            </div>
          )}
        </div>

        {/* Waiting Time Bar */}
        <div className="mt-2 pt-2 border-t border-c-border-subtle">
          <div className="flex items-center justify-between text-[10px] text-c-text-muted mb-1">
            <span>{t('decisions.waitingFor', 'Waiting for')}</span>
            <span className="font-medium">
              {decision.daysWaiting || 0} {t('decisions.days', 'days')}
            </span>
          </div>
          <div className="w-full h-1.5 bg-c-surface-raised rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, ((decision.daysWaiting || 0) / 14) * 100)}%` }}
              className={`h-full rounded-full ${
                (decision.daysWaiting || 0) > 10
                  ? 'bg-danger-500'
                  : (decision.daysWaiting || 0) > 5
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div
        className={`px-4 py-3 border-t flex items-center gap-2 ${
          isOverdue
            ? 'bg-danger-50/50 dark:bg-danger-900/10 border-danger-100 dark:border-danger-500/10'
            : 'bg-c-surface-raised border-c-border-subtle'
        }`}
      >
        {viewMode === 'my' ? (
          <>
            {/* OK Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove(decision.id);
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 size={14} />
              {t('decisions.approve', 'Approve')}
            </button>
            {/* Not OK Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject(decision.id);
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-danger-500 text-white hover:bg-danger-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <XCircle size={14} />
              {t('decisions.reject', 'Reject')}
            </button>
            {/* Delegate Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelegate(decision);
              }}
              className="px-3 py-2 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
              title={t('decisions.delegate', 'Delegate')}
            >
              <UserPlus size={14} />
            </button>
          </>
        ) : (
          <>
            {/* View Details */}
            <button
              onClick={() => onClick?.(decision.id)}
              className="flex-1 px-3 py-2 rounded-lg bg-c-surface border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
            >
              {t('decisions.viewDetails', 'View Details')}
              <ChevronRight size={14} />
            </button>

            {/* Escalate Button - only for overdue */}
            {isOverdue && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEscalate(decision.id);
                }}
                className="px-4 py-2 rounded-lg bg-danger-600 text-white text-xs font-semibold hover:bg-danger-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <TrendingUp size={14} />
                {t('decisions.escalate', 'Escalate')}
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Decisions Panel - Main Export
 */
export const DecisionsPanel: React.FC<DecisionsPanelProps> = ({
  onDecisionClick,
  createModalOpen,
  onCreateModalOpen,
  onCreateModalClose,
  onCountsChange,
}) => {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('my');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [cardViewStyle, setCardViewStyle] = useState<CardViewStyle>('d');
  const [showNewModal, setShowNewModal] = useState(false);
  const [delegateDecision, setDelegateDecision] = useState<Decision | null>(null);

  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = useAppStore((state) => state.currentUser?.id);

  useEffect(() => {
    fetchDecisions();
  }, [currentProjectId]);

  const isCreateModalControlled = createModalOpen !== undefined;
  const resolvedCreateModalOpen = isCreateModalControlled ? createModalOpen : showNewModal;

  const openCreateModal = () => {
    if (isCreateModalControlled) {
      onCreateModalOpen?.();
    } else {
      setShowNewModal(true);
    }
  };

  const closeCreateModal = () => {
    if (isCreateModalControlled) {
      onCreateModalClose?.();
    } else {
      setShowNewModal(false);
    }
  };

  const fetchDecisions = async () => {
    try {
      setLoading(true);
      const url = currentProjectId
        ? `/decisions?projectId=${currentProjectId}&includeAll=true`
        : `/decisions?includeAll=true`;
      const data = await Api.get(url);
      const decisionsList = Array.isArray(data) ? data : data?.decisions || [];

      const enhanced = decisionsList.map((d: Decision) => {
        const daysWaiting =
          d.daysWaiting ||
          Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysWaiting > 7;
        const daysOverdue = Math.max(0, daysWaiting - 7);
        return {
          ...d,
          daysWaiting,
          isOverdue,
          daysOverdue,
          escalationLevel: d.escalationLevel || 0,
        };
      });

      setDecisions(enhanced);
      const myCount = enhanced.filter(
        (d: Decision) =>
          ['PENDING', 'ESCALATED'].includes(d.status) && d.decisionOwnerId === currentUserId
      ).length;
      const awaitingCount = enhanced.filter(
        (d: Decision) =>
          ['PENDING', 'ESCALATED'].includes(d.status) &&
          d.requestedById === currentUserId &&
          d.decisionOwnerId !== currentUserId
      ).length;
      onCountsChange?.({
        total: myCount + awaitingCount,
        my: myCount,
        awaiting: awaitingCount,
      });
    } catch (error) {
      console.error('Failed to fetch decisions:', error);
      const message =
        (error as { message?: string })?.message ||
        t('decisions.loadError', 'Failed to load decisions. Please try again.');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await Api.put(`/decisions/${id}/decide`, {
        status: 'APPROVED',
        outcome: t('decisions.defaultApproveRationale', 'Approved via quick action'),
      });
      toast.success(t('decisions.approved', 'Decision approved'));
      fetchDecisions();
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error(t('decisions.error', 'Failed to update decision'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await Api.put(`/decisions/${id}/decide`, {
        status: 'REJECTED',
        outcome: t('decisions.defaultRejectRationale', 'Rejected via quick action'),
      });
      toast.success(t('decisions.rejected', 'Decision rejected'));
      fetchDecisions();
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error(t('decisions.error', 'Failed to update decision'));
    }
  };

  const handleDelegate = async (decisionId: string, toUserId: string, note: string) => {
    if (!decisionId) {
      toast.error(t('decisions.error', 'Missing decision ID'));
      return;
    }
    if (!toUserId) {
      toast.error(t('decisions.selectUser', 'Please select a user to delegate to'));
      return;
    }
    try {
      await Api.put(`/decisions/${decisionId}`, {
        decisionOwnerId: toUserId,
        delegationNote: note,
      });
      toast.success(t('decisions.delegated', 'Decision delegated'));
      fetchDecisions();
    } catch (error) {
      console.error('Failed to delegate:', error);
      toast.error(t('decisions.delegateError', 'Failed to delegate decision'));
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      await Api.post(`/decisions/${id}/escalate`, {});
      toast.success(t('decisions.escalated', 'Decision escalated to manager'));
      fetchDecisions();
    } catch (error) {
      console.error('Failed to escalate:', error);
      toast.error(t('decisions.escalateError', 'Failed to escalate'));
    }
  };

  const handleCreateDecision = async (data: Partial<Decision>) => {
    try {
      await Api.post('/decisions', {
        ...data,
        projectId: currentProjectId,
        relatedObjectType: 'PROJECT',
        relatedObjectId: currentProjectId,
        requestedById: currentUserId,
      });
      toast.success(t('decisions.created', 'Decision request created'));
      fetchDecisions();
    } catch (error) {
      console.error('Failed to create decision:', error);
      toast.error(t('decisions.createError', 'Failed to create decision'));
    }
  };

  // Filter and sort decisions
  const getFilteredDecisions = () => {
    let filtered = decisions.filter((d) => ['PENDING', 'ESCALATED'].includes(d.status));

    // View mode filter
    if (viewMode === 'my') {
      filtered = filtered.filter((d) => d.decisionOwnerId === currentUserId);
    } else {
      filtered = filtered.filter(
        (d) => d.requestedById === currentUserId && d.decisionOwnerId !== currentUserId
      );
    }

    // Type filter
    switch (filterType) {
      case 'overdue':
        filtered = filtered.filter((d) => d.isOverdue);
        break;
      case 'thisWeek':
        filtered = filtered.filter((d) => (d.daysWaiting || 0) <= 7);
        break;
      case 'blocking':
        filtered = filtered.filter((d) => (d.blockedItemsCount || 0) > 0);
        break;
      case 'critical':
        filtered = filtered.filter((d) => d.priority === 'CRITICAL');
        break;
      case 'high':
        filtered = filtered.filter((d) => d.priority === 'HIGH' || d.priority === 'CRITICAL');
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query) ||
          d.projectName?.toLowerCase().includes(query)
      );
    }

    // Sort
    // Priority order mapping for sorting
    const priorityOrder: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'urgency':
          return (b.daysOverdue || 0) - (a.daysOverdue || 0);
        case 'priority':
          return (
            (priorityOrder[b.priority || 'MEDIUM'] || 2) -
            (priorityOrder[a.priority || 'MEDIUM'] || 2)
          );
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  };

  const filteredDecisions = getFilteredDecisions();
  const myDecisionsCount = decisions.filter(
    (d) => ['PENDING', 'ESCALATED'].includes(d.status) && d.decisionOwnerId === currentUserId
  ).length;
  const awaitingCount = decisions.filter(
    (d) =>
      ['PENDING', 'ESCALATED'].includes(d.status) &&
      d.requestedById === currentUserId &&
      d.decisionOwnerId !== currentUserId
  ).length;
  const urgentCount = decisions.filter(
    (d) => ['PENDING', 'ESCALATED'].includes(d.status) && d.isOverdue
  ).length;

  /* ─── Sections for N / C views ─── */
  const decisionViewSections: ListSection[] = (() => {
    const overdue = filteredDecisions.filter((d) => d.isOverdue).map(decisionToGenericItem);
    const critical = filteredDecisions
      .filter((d) => !d.isOverdue && d.priority === 'CRITICAL')
      .map(decisionToGenericItem);
    const high = filteredDecisions
      .filter((d) => !d.isOverdue && d.priority === 'HIGH')
      .map(decisionToGenericItem);
    const rest = filteredDecisions
      .filter((d) => !d.isOverdue && d.priority !== 'CRITICAL' && d.priority !== 'HIGH')
      .map(decisionToGenericItem);

    return [
      ...(overdue.length > 0
        ? [
            {
              id: 'overdue',
              label: t('decisions.overdue', 'Overdue'),
              items: overdue,
              accentColor: 'text-danger-500',
            },
          ]
        : []),
      ...(critical.length > 0
        ? [
            {
              id: 'critical',
              label: t('decisions.critical', 'Critical'),
              items: critical,
              accentColor: 'text-amber-500',
            },
          ]
        : []),
      ...(high.length > 0
        ? [
            {
              id: 'high',
              label: t('decisions.highPriority', 'High Priority'),
              items: high,
              accentColor: 'text-amber-500',
            },
          ]
        : []),
      ...(rest.length > 0
        ? [
            {
              id: 'other',
              label: t('decisions.other', 'Other'),
              items: rest,
              accentColor: 'text-c-text-secondary',
            },
          ]
        : []),
    ];
  })();

  const handleDecisionItemClick = (item: GenericListItem) => {
    onDecisionClick?.(item.id);
  };

  if (loading) {
    return (
      <div
        className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-8"
        data-testid="decisions-list"
      >
        <LoadingState variant="spinner" />
      </div>
    );
  }

  return (
    <div
      className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] shadow-sm h-full flex flex-col"
      data-testid="decisions-list"
    >
      {/* Header */}
      <div className="p-4 border-b border-c-border-subtle">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-crimson-600 text-white rounded-lg shadow-sm">
              <FileQuestion size={20} />
            </div>
            <div>
              <h3 className="font-bold text-c-text">{t('decisions.title', 'Decisions')}</h3>
              <p className="text-xs text-c-text-muted">
                {myDecisionsCount + awaitingCount} {t('decisions.pending', 'pending')}
                {urgentCount > 0 && (
                  <span className="text-danger-500 ml-1">• {urgentCount} urgent</span>
                )}
              </p>
            </div>
          </div>

          {/* New Button */}
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-lg bg-c-text text-c-surface hover:opacity-90 transition-colors font-medium text-sm flex items-center gap-2"
          >
            <Plus size={16} />
            {t('decisions.new', 'New')}
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 p-1 bg-c-surface-raised rounded-lg">
          <button
            onClick={() => setViewMode('my')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              viewMode === 'my'
                ? 'bg-c-surface text-c-text shadow-sm'
                : 'text-c-text-secondary hover:text-c-text'
            }`}
          >
            <User size={16} />
            {t('decisions.myDecisions', 'My Decisions')}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                viewMode === 'my'
                  ? 'bg-c-info/15 text-c-info'
                  : 'bg-c-surface-raised text-c-text-secondary'
              }`}
            >
              {myDecisionsCount}
            </span>
          </button>
          <button
            onClick={() => setViewMode('awaiting')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              viewMode === 'awaiting'
                ? 'bg-c-surface text-c-text shadow-sm'
                : 'text-c-text-secondary hover:text-c-text'
            }`}
          >
            <Hourglass size={16} />
            {t('decisions.awaiting', 'Awaiting Others')}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                viewMode === 'awaiting'
                  ? 'bg-c-info/15 text-c-info'
                  : 'bg-c-surface-raised text-c-text-secondary'
              }`}
            >
              {awaitingCount}
            </span>
          </button>
        </div>

        {/* Filters & Sort Row */}
        <div className="flex items-center gap-2 mt-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('decisions.search', 'Search...')}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors ${
                filterType !== 'all'
                  ? 'border-c-border-strong bg-c-surface-raised text-c-text'
                  : 'border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'
              }`}
            >
              <Filter size={16} />
              {filterType === 'all'
                ? t('decisions.filter', 'Filter')
                : filterType === 'overdue'
                  ? t('decisions.filterOverdue', 'Overdue')
                  : filterType === 'thisWeek'
                    ? t('decisions.filterThisWeek', 'This Week')
                    : filterType === 'blocking'
                      ? t('decisions.filterBlocking', 'Blocking')
                      : filterType === 'critical'
                        ? t('decisions.filterCritical', 'Critical')
                        : t('decisions.filterHigh', 'High+')}
            </button>

            {showFilters && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-c-surface-raised rounded-lg shadow-lg border border-c-border-subtle py-1 z-20">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-c-text-muted uppercase tracking-wider">
                  {t('decisions.filterByStatus', 'By Status')}
                </div>
                {(['all', 'overdue', 'thisWeek', 'blocking'] as FilterType[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setFilterType(filter);
                      setShowFilters(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-c-surface flex items-center gap-2 ${
                      filterType === filter ? 'text-c-text font-medium' : 'text-c-text-secondary'
                    }`}
                  >
                    {filter === 'all' && <Tag size={14} />}
                    {filter === 'overdue' && (
                      <AlertTriangle size={14} className="text-danger-500" />
                    )}
                    {filter === 'thisWeek' && <Calendar size={14} className="text-blue-500" />}
                    {filter === 'blocking' && <Bell size={14} className="text-amber-500" />}
                    {filter === 'all'
                      ? t('decisions.filterAll', 'All')
                      : filter === 'overdue'
                        ? t('decisions.filterOverdue', 'Overdue')
                        : filter === 'thisWeek'
                          ? t('decisions.filterThisWeek', 'This Week')
                          : t('decisions.filterBlocking', 'Blocking Items')}
                  </button>
                ))}
                <div className="border-t border-c-border-subtle my-1" />
                <div className="px-3 py-1.5 text-[10px] font-semibold text-c-text-muted uppercase tracking-wider">
                  {t('decisions.filterByPriority', 'By Priority')}
                </div>
                {(['critical', 'high'] as FilterType[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setFilterType(filter);
                      setShowFilters(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-c-surface flex items-center gap-2 ${
                      filterType === filter ? 'text-c-text font-medium' : 'text-c-text-secondary'
                    }`}
                  >
                    {filter === 'critical' && <Zap size={14} className="text-danger-500" />}
                    {filter === 'high' && <Flag size={14} className="text-amber-500" />}
                    {filter === 'critical'
                      ? t('decisions.filterCritical', 'Critical Only')
                      : t('decisions.filterHigh', 'High & Critical')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="px-3 py-2 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <option value="newest">↓ {t('decisions.sortNewest', 'Newest')}</option>
            <option value="oldest">↑ {t('decisions.sortOldest', 'Oldest')}</option>
            <option value="urgency">⚠️ {t('decisions.sortUrgency', 'Urgency')}</option>
            <option value="priority">🚨 {t('decisions.sortPriority', 'Priority')}</option>
          </select>

          {/* A7.1: View style switcher */}
          <CardViewSwitcher
            moduleId="my-work-decisions"
            value={cardViewStyle}
            onChange={setCardViewStyle}
            compact
          />
        </div>
      </div>

      {/* Content — switches layout based on cardViewStyle (A7.2/A7.3) */}
      {cardViewStyle === 'n' ? (
        <div className="flex-1 overflow-hidden p-4">
          <NotionListView
            sections={decisionViewSections}
            onItemClick={handleDecisionItemClick}
            emptyMessage={t('decisions.noMyDecisions', 'No decisions awaiting your action')}
          />
        </div>
      ) : cardViewStyle === 'c' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <ClickUpListView
            sections={decisionViewSections}
            columns={DECISION_CLICKUP_COLUMNS}
            onItemClick={handleDecisionItemClick}
            emptyMessage={t('decisions.noMyDecisions', 'No decisions awaiting your action')}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredDecisions.length > 0 ? (
              filteredDecisions.map((decision) => (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  viewMode={viewMode}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelegate={(d) => setDelegateDecision(d)}
                  onEscalate={handleEscalate}
                  onClick={onDecisionClick}
                />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-c-text-muted"
              >
                {viewMode === 'my' ? (
                  <>
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500" />
                    <p className="text-sm font-medium">
                      {t('decisions.noMyDecisions', 'No decisions awaiting your action')}
                    </p>
                    <p className="text-xs">{t('decisions.allCaughtUp', 'All caught up!')}</p>
                  </>
                ) : (
                  <>
                    <Hourglass size={32} className="mx-auto mb-2 text-c-text-muted" />
                    <p className="text-sm font-medium">
                      {t('decisions.noAwaitingOthers', 'No decisions pending from others')}
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <NewDecisionModal
        isOpen={resolvedCreateModalOpen}
        onClose={closeCreateModal}
        onSubmit={handleCreateDecision}
      />

      <DelegateModal
        isOpen={!!delegateDecision}
        decision={delegateDecision}
        onClose={() => setDelegateDecision(null)}
        onDelegate={handleDelegate}
      />
    </div>
  );
};

export default DecisionsPanel;
