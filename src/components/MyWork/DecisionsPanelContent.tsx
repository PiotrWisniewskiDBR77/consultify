/**
 * DecisionsPanelContent - Professional decision table for MyWorkHub
 * Interview-style design with hover animations and resizable columns
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Copy,
  Edit,
  Eye,
  Flag,
  FolderKanban,
  Loader2,
  Minus,
  MoreVertical,
  Scale,
  Settings2,
  Sparkles,
  Send,
  Square,
  TrendingUp,
  User,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  DECISION_STATUS_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { RowActionsMenu, type RowAction } from '@/components/shared/RowActionsMenu';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { Modal } from '@/components/ui/primitives/Modal';

import {
  DecisionPreviewBody,
  DecisionPreviewFooter,
  type DecisionBrief,
  type DecisionPreviewData,
  type DecisionPreviewMode,
  type DecisionSnoozePreset,
} from './DecisionPreviewPanel';
import { DelegationModal } from './shared/DelegationModal';

type ViewMode = 'all' | 'my' | 'awaiting';
type DecisionPriorityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Decision {
  id: string;
  title: string;
  description?: string;
  decisionType?: string;
  type?: string;
  status: string;
  decisionOwnerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: string;
  requestedById?: string;
  requestedByName?: string;
  projectId?: string;
  projectName?: string;
  priority?: string;
  createdAt: string;
  dueDate?: string;
  deadline?: string;
  daysWaiting?: number;
  daysUntilDue?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  // Response fields for decided items
  answer?: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  decidedAt?: string;
  decidedByName?: string;
  rationale?: string;
  // Escalation tracking
  escalatedAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
}

interface DecisionCounts {
  total: number;
  my: number;
  awaiting: number;
}

export type DecisionsBulkBarPayload =
  | {
      selectedCount: number;
      allSelected: boolean;
      someSelected: boolean;
      selectAllVisible: () => void;
      clearSelection: () => void;
      // Context actions (rendered in Command Row)
      approve?: () => void;
      reject?: () => void;
      deleteSelected?: () => void;
      changePriority?: () => void;
      remind?: () => void;
      escalate?: () => void;
      snoozeTomorrow?: () => void;
    }
  | null;

interface DecisionsPanelContentProps {
  viewMode: ViewMode;
  priorityFilter?: DecisionPriorityFilter;
  searchQuery: string;
  onDecisionClick?: (id: string, decisionData?: Decision) => void;
  onCountsChange: (counts: DecisionCounts) => void;
  refreshTrigger?: number;
  /** V3-A03: bulk selection lives in MyWorkHub command row */
  onBulkBarChange?: (payload: DecisionsBulkBarPayload) => void;
}

// Priority config — 5-color semantic palette
const getPriorityConfig = (priority?: string) => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-500/20',
        dot: 'bg-red-500',
        label: 'Critical',
        icon: Zap,
      };
    case 'HIGH':
      return {
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        dot: 'bg-amber-500',
        label: 'High',
        icon: Flag,
      };
    case 'MEDIUM':
      return {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50/70 dark:bg-blue-500/10',
        dot: 'bg-blue-500',
        label: 'Medium',
        icon: Flag,
      };
    case 'LOW':
      return {
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-navy-800/60',
        dot: 'bg-slate-400',
        label: 'Low',
        icon: Flag,
      };
    default:
      return {
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-navy-800/60',
        dot: 'bg-slate-400',
        label: 'Normal',
        icon: Flag,
      };
  }
};

// Status config — subtle badges, alarm only for blocked/rejected/escalated
const getStatusConfig = (status?: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return {
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50/70 dark:bg-emerald-500/10',
        dot: 'bg-emerald-500',
        label: 'Approved',
      };
    case 'REJECTED':
      return {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-500/20',
        dot: 'bg-red-500',
        label: 'Rejected',
      };
    case 'DEFERRED':
      return {
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50/70 dark:bg-amber-500/10',
        dot: 'bg-amber-500',
        label: 'Deferred',
      };
    case 'ESCALATED':
      return {
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        dot: 'bg-amber-500',
        label: 'Escalated',
      };
    case 'PENDING':
    default:
      return {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50/70 dark:bg-blue-500/10',
        dot: 'bg-blue-500',
        label: 'Pending',
      };
  }
};

// Date formatting
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `${diffDays}d left`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Days waiting calculation
const getDaysWaiting = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
};

// Row hover animation variants
const rowVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -10 },
};

// Decision table column definitions
const DECISION_COLUMNS: ColumnDef[] = [
  {
    id: 'select',
    label: '',
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    filterable: false,
  },
  {
    id: 'type',
    label: 'Type',
    width: 100,
    minWidth: 80,
    maxWidth: 140,
    resizable: true,
    filterable: false,
  },
  {
    id: 'indicator',
    label: '',
    width: 32,
    minWidth: 32,
    maxWidth: 32,
    resizable: false,
    filterable: false,
  },
  {
    id: 'title',
    label: 'Decision',
    width: 999, // flex — will stretch to fill remaining space
    minWidth: 300,
    resizable: false,
    filterable: false,
  },
  {
    id: 'project',
    label: 'Project',
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    resizable: true,
    filterable: false,
  },
  {
    id: 'status',
    label: 'Status',
    width: 130,
    minWidth: 100,
    maxWidth: 170,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: DECISION_STATUS_FILTER_OPTIONS,
  },
  {
    id: 'priority',
    label: 'Priority',
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: PRIORITY_FILTER_OPTIONS,
  },
  {
    id: 'date',
    label: 'Due Date',
    width: 130,
    minWidth: 100,
    maxWidth: 170,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: '',
    width: 140,
    minWidth: 100,
    maxWidth: 160,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

const DECISIONS_TABLE_VIEW_STORAGE_KEY = 'consultify-decisions-table-view';
const DECISIONS_TABLE_DEFAULT_HIDDEN_COLUMNS: string[] = [];

function loadDecisionsHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(DECISIONS_TABLE_VIEW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const next = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
    // Always keep title + actions visible (Golden Standard: required columns)
    return next.filter((id) => id !== 'title' && id !== 'actions');
  } catch {
    return [];
  }
}

// Default column widths
const getDefaultColumnWidths = (): ColumnWidths =>
  DECISION_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

// Decision Row Component
const DecisionTableRow: React.FC<{
  decision: Decision;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClick?: (id: string, decisionData?: Decision) => void;
  onOpenFull?: (id: string, decisionData?: Decision) => void;
  columnWidths: ColumnWidths;
  hiddenColumns?: Set<string>;
}> = ({
  decision,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  onClick,
  onOpenFull,
  columnWidths,
  hiddenColumns,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const priorityConfig = getPriorityConfig(decision.priority);
  const statusConfig = getStatusConfig(decision.status);
  const dueDate = decision.dueDate || decision.deadline;
  const overdue = isOverdue(dueDate) && decision.status?.toUpperCase() === 'PENDING';
  const daysWaiting = getDaysWaiting(decision.createdAt);
  const isPending = decision.status?.toUpperCase() === 'PENDING';
  const PriorityIcon = priorityConfig.icon;

  const rowActions = useMemo(() => {
    const actions: RowAction[] = [
      {
        id: 'open',
        label: isPolish ? 'Otwórz' : t('common.open', 'Open'),
        icon: Eye,
        variant: 'primary',
        onClick: () => onOpenFull?.(decision.id, decision) ?? onClick?.(decision.id, decision),
      },
    ];
    if (isPending) {
      actions.push(
        {
          id: 'approve',
          label: isPolish ? 'Przyjęta' : 'Approve',
          icon: Check,
          divider: true,
          onClick: () => onApprove(decision.id),
          variant: 'primary',
        },
        {
          id: 'reject',
          label: isPolish ? 'Odrzucona' : 'Reject',
          icon: X,
          onClick: () => onReject(decision.id),
          variant: 'danger',
        }
      );
    }
    return actions;
  }, [decision, isPending, isPolish, onApprove, onClick, onOpenFull, onReject, t]);

  return (
    <motion.tr
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={() => onClick?.(decision.id, decision)}
      onDoubleClick={() => onOpenFull?.(decision.id, decision)}
      className={`
        group cursor-pointer border-b border-slate-200/70 dark:border-white/[0.06]
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
        transition-colors duration-150
        hover:bg-slate-50/70 dark:hover:bg-white/[0.03]
      `}
    >
      {/* Select Checkbox */}
      <td className="w-10 px-2 py-2.5" style={{ width: columnWidths.select }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(decision.id);
          }}
          className={`
            w-5 h-5 rounded border flex items-center justify-center transition-all
            ${
              isSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }
          `}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {/* Type Badge */}
      {!hiddenColumns?.has('type') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
            <Scale size={12} />
            {decision.decisionType || decision.type || (isPolish ? 'Ogólne' : 'General')}
          </span>
        </td>
      )}

      {/* Priority Dot */}
      <td className="w-8 px-1 py-2.5" style={{ width: columnWidths.indicator }}>
        <div
          className={`w-2.5 h-2.5 rounded-full ${priorityConfig.dot} ${overdue ? 'animate-pulse' : ''}`}
          title={priorityConfig.label}
        />
      </td>

      {/* Decision Title */}
      <td className="px-3 py-2.5 w-full" style={{ minWidth: 300 }}>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {decision.title}
          </span>
          {decision.description && (
            <span className="text-xs text-slate-500 mt-0.5 truncate block max-w-[480px]">
              {decision.description}
            </span>
          )}
        </div>
      </td>

      {/* Project */}
      {!hiddenColumns?.has('project') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.project }}>
          {decision.projectName ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <FolderKanban size={12} />
              <span className="truncate max-w-[100px]">{decision.projectName}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-600">-</span>
          )}
        </td>
      )}

      {/* Status */}
      {!hiddenColumns?.has('status') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.status }}>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${statusConfig.bg} ${statusConfig.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </span>
        </td>
      )}

      {/* Priority */}
      {!hiddenColumns?.has('priority') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.priority }}>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${priorityConfig.color}`}
          >
            <PriorityIcon size={12} />
            {priorityConfig.label}
          </span>
        </td>
      )}

      {/* Due Date / Waiting */}
      {!hiddenColumns?.has('date') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.date }}>
          {dueDate ? (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                overdue
                  ? 'text-red-700 dark:text-red-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {overdue && <AlertTriangle size={12} className="text-red-600 dark:text-red-400" />}
              <Calendar size={12} />
              <span>{formatDate(dueDate)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              <span>{daysWaiting}d waiting</span>
            </div>
          )}
        </td>
      )}

      {/* Actions */}
      {!hiddenColumns?.has('actions') && (
        <td
          className="px-3 py-2.5 text-right"
          style={{ width: columnWidths.actions }}
          onClick={(e) => e.stopPropagation()}
        >
          <RowActionsMenu actions={rowActions} iconVariant="vertical" />
        </td>
      )}
    </motion.tr>
  );
};

// Awaiting Others Decision Row - Different actions (Remind/Escalate instead of Approve/Reject)
const AwaitingDecisionTableRow: React.FC<{
  decision: Decision;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemind: (id: string) => void;
  onEscalate: (id: string) => void;
  onClick?: (id: string, decisionData?: Decision) => void;
  onOpenFull?: (id: string, decisionData?: Decision) => void;
  columnWidths: ColumnWidths;
  hiddenColumns?: Set<string>;
}> = ({
  decision,
  isSelected,
  onSelect,
  onRemind,
  onEscalate,
  onClick,
  onOpenFull,
  columnWidths,
  hiddenColumns,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const priorityConfig = getPriorityConfig(decision.priority);
  const statusConfig = getStatusConfig(decision.status);
  const dueDate = decision.dueDate || decision.deadline;
  const overdue = isOverdue(dueDate) && decision.status?.toUpperCase() === 'PENDING';
  const daysWaiting = getDaysWaiting(decision.createdAt);
  const isPending = decision.status?.toUpperCase() === 'PENDING';
  const isDecided = ['APPROVED', 'REJECTED', 'DEFERRED'].includes(
    decision.status?.toUpperCase() || ''
  );
  const isEscalated = decision.status?.toUpperCase() === 'ESCALATED';
  const PriorityIcon = priorityConfig.icon;

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const responseConfig = (() => {
    const answer = String(decision.answer || decision.status || '').toUpperCase();
    if (answer === 'APPROVED')
      return { label: 'Approved', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/20', icon: Check };
    if (answer === 'REJECTED')
      return { label: 'Rejected', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20', icon: X };
    if (answer === 'DEFERRED')
      return { label: 'Deferred', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/20', icon: Clock };
    return null;
  })();

  const rowActions = useMemo(() => {
    const actions: RowAction[] = [
      {
        id: 'open',
        label: isPolish ? 'Otwórz' : t('common.open', 'Open'),
        icon: Eye,
        variant: 'primary',
        onClick: () => onOpenFull?.(decision.id, decision) ?? onClick?.(decision.id, decision),
      },
    ];
    if (isPending) {
      actions.push(
        {
          id: 'remind',
          label: isPolish ? 'Przypomnij' : 'Send reminder',
          icon: Bell,
          divider: true,
          onClick: () => onRemind(decision.id),
        },
        {
          id: 'escalate',
          label: isPolish ? 'Eskaluj' : overdue ? 'Escalate (urgent)' : 'Escalate',
          icon: TrendingUp,
          onClick: () => onEscalate(decision.id),
          variant: overdue ? 'danger' : 'default',
        }
      );
    }
    return actions;
  }, [decision, isPending, isPolish, onClick, onEscalate, onOpenFull, onRemind, overdue, t]);

  return (
    <motion.tr
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={() => onClick?.(decision.id, decision)}
      onDoubleClick={() => onOpenFull?.(decision.id, decision)}
      className={`
        group cursor-pointer border-b border-slate-200/70 dark:border-white/[0.06]
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
        transition-colors duration-150
        hover:bg-slate-50/70 dark:hover:bg-white/[0.03]
        ${overdue && !isSelected ? 'bg-red-50 dark:bg-red-500/5' : ''}
      `}
    >
      <td className="w-10 px-2 py-2.5" style={{ width: columnWidths.select }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(decision.id);
          }}
          className={`
            w-5 h-5 rounded border flex items-center justify-center transition-all
            ${
              isSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }
          `}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {!hiddenColumns?.has('type') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
            <Scale size={12} />
            {decision.decisionType || decision.type || (isPolish ? 'Ogólne' : 'General')}
          </span>
        </td>
      )}

      <td className="w-8 px-1 py-2.5" style={{ width: columnWidths.indicator }}>
        <div
          className={`w-2.5 h-2.5 rounded-full ${overdue ? 'bg-red-500 animate-pulse' : priorityConfig.dot}`}
          title={overdue ? (isPolish ? 'Po terminie' : 'Overdue') : priorityConfig.label}
        />
      </td>

      <td className="px-3 py-2.5 w-full" style={{ minWidth: 300 }}>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{decision.title}</span>
          {decision.description && (
            <span className="text-xs text-slate-500 mt-0.5 truncate block max-w-[480px]">
              {decision.description}
            </span>
          )}
        </div>
      </td>

      {!hiddenColumns?.has('project') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.project }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-medium text-white">
              {getInitials(decision.ownerName)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-slate-900 dark:text-white truncate">
                {decision.ownerName || (isPolish ? 'Nieznany' : 'Unknown')}
              </span>
              {decision.ownerRole && (
                <span className="text-[10px] text-slate-500 truncate">{decision.ownerRole}</span>
              )}
            </div>
          </div>
        </td>
      )}

      {!hiddenColumns?.has('status') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.status }}>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${statusConfig.bg} ${statusConfig.color}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} ${isEscalated ? 'animate-pulse' : ''}`}
            />
            {statusConfig.label}
          </span>
        </td>
      )}

      {!hiddenColumns?.has('priority') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.priority }}>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${priorityConfig.color}`}>
            <PriorityIcon size={12} />
            {priorityConfig.label}
          </span>
        </td>
      )}

      {!hiddenColumns?.has('date') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.date }}>
          {dueDate ? (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                overdue
                  ? 'text-red-700 dark:text-red-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {overdue ? <AlertTriangle size={12} className="animate-pulse text-red-600 dark:text-red-400" /> : null}
              <Calendar size={12} />
              <span>{formatDate(dueDate)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              <span>{daysWaiting}d waiting</span>
            </div>
          )}
        </td>
      )}

      {!hiddenColumns?.has('actions') && (
        <td
          className="px-3 py-2.5 text-right"
          style={{ width: columnWidths.actions }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-end gap-2">
            {isDecided && responseConfig ? (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${responseConfig.bg} ${responseConfig.color}`}
              >
                <responseConfig.icon size={12} />
                {responseConfig.label}
              </span>
            ) : null}
            <RowActionsMenu actions={rowActions} iconVariant="vertical" />
          </div>
        </td>
      )}
    </motion.tr>
  );
};

export const DecisionsPanelContent: React.FC<DecisionsPanelContentProps> = ({
  viewMode,
  priorityFilter = 'all',
  searchQuery,
  onDecisionClick,
  onCountsChange,
  refreshTrigger,
  onBulkBarChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { currentUser } = useAppStore();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDecisionId, setPreviewDecisionId] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column widths state (for resizable columns)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());

  // Filter state (session only)
  const [tableFilters, setTableFilters] = useState<TableFilters>({});

  // Open filter dropdown state
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Hidden columns (persisted per-view)
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => loadDecisionsHiddenColumns());
  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);

  // Preview data (full details + brief)
  const [previewDecision, setPreviewDecision] = useState<DecisionPreviewData | null>(null);
  const [previewBrief, setPreviewBrief] = useState<DecisionBrief | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Preview — details kebab + AI strip (Inbox parity)
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const [delegationOpen, setDelegationOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email?: string; avatar?: string }>
  >([]);

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getDecisions();
      setDecisions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch decisions:', error);
      toast.error('Failed to load decisions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions, refreshTrigger]);

  const fetchUsers = useCallback(async () => {
    try {
      const users = await Api.getUsers();
      const mapped = (Array.isArray(users) ? users : []).map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name ||
            `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() ||
            u.email ||
            u.id
        ),
        email: u.email ? String(u.email) : undefined,
        avatar: u.avatar_url || u.avatarUrl || undefined,
      }));
      setAvailableUsers(mapped);
    } catch {
      setAvailableUsers([]);
    }
  }, []);

  const fetchPreview = useCallback(async (id: string) => {
    setPreviewLoading(true);
    try {
      const d = (await Api.getDecision(id)) as any;
      const normalized: DecisionPreviewData = {
        ...d,
        id: String(d?.id || id),
        title: String(d?.title || 'Decision'),
      };
      setPreviewDecision(normalized);
      try {
        const b = (await Api.get(`/my-work/decisions/${id}/brief`)) as any;
        setPreviewBrief(b && typeof b?.summary === 'string' ? (b as DecisionBrief) : null);
      } catch {
        setPreviewBrief(null);
      }
    } catch {
      setPreviewDecision(null);
      setPreviewBrief(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetailsMenuOpen(false);
    setAiMenuOpen(false);
    setAiLoading(false);
    setAiError(null);
    setAiText(null);
    setDetailsLoading(false);
    setDetailsOverride(null);
    setSnoozeOpen(false);
    setDelegationOpen(false);

    if (!previewDecisionId) {
      setPreviewDecision(null);
      setPreviewBrief(null);
      return;
    }
    fetchPreview(previewDecisionId);
  }, [previewDecisionId, fetchPreview]);

  // Filter decisions
  const filteredDecisions = useMemo(() => {
    let result = decisions;
    const userId = currentUser?.id;

    const isMineToDecide = (d: Decision) => Boolean(userId) && d.decisionOwnerId === userId;
    const isMyRequest = (d: Decision) =>
      Boolean(userId) && d.requestedById === userId && d.decisionOwnerId !== userId;
    const isRelevantToMe = (d: Decision) => isMineToDecide(d) || isMyRequest(d);

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title?.toLowerCase().includes(query) || d.description?.toLowerCase().includes(query)
      );
    }

    // Filter by view mode
    if (viewMode === 'my') {
      result = result.filter(isMineToDecide);
    } else if (viewMode === 'awaiting') {
      result = result.filter(isMyRequest);
    } else {
      // "All" in My Work means "relevant to me" (union), not org-wide.
      result = result.filter(isRelevantToMe);
    }

    // Filter by priority (topbar filter)
    if (priorityFilter !== 'all') {
      result = result.filter(
        (d) => String(d.priority || 'MEDIUM').toUpperCase() === String(priorityFilter).toUpperCase()
      );
    }

    // Sort by priority and due date
    const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    result.sort((a, b) => {
      // Pending first
      const aP = a.status?.toUpperCase() === 'PENDING' ? 0 : 1;
      const bP = b.status?.toUpperCase() === 'PENDING' ? 0 : 1;
      if (aP !== bP) return aP - bP;

      // Then by priority
      const ap = priorityOrder[a.priority?.toUpperCase() || 'MEDIUM'] ?? 2;
      const bp = priorityOrder[b.priority?.toUpperCase() || 'MEDIUM'] ?? 2;
      if (ap !== bp) return ap - bp;

      // Then by due date
      const ad = a.dueDate || a.deadline;
      const bd = b.dueDate || b.deadline;
      if (ad && bd) return new Date(ad).getTime() - new Date(bd).getTime();
      return 0;
    });

    return result;
  }, [decisions, searchQuery, viewMode, priorityFilter, currentUser?.id]);

  // Calculate counts
  useEffect(() => {
    const userId = currentUser?.id;
    const isOpen = (d: Decision) =>
      ['PENDING', 'ESCALATED'].includes(String(d.status || '').toUpperCase());
    const myCount = decisions.filter(
      (d) => userId && d.decisionOwnerId === userId && isOpen(d)
    ).length;
    const awaitingCount = decisions.filter(
      (d) => userId && d.requestedById === userId && d.decisionOwnerId !== userId && isOpen(d)
    ).length;
    onCountsChange({
      total: myCount + awaitingCount,
      my: myCount,
      awaiting: awaitingCount,
    });
  }, [decisions, currentUser?.id, onCountsChange]);

  // Handlers
  const openPreview = (decisionId: string) => setPreviewDecisionId(decisionId);

  const handleApprove = async (id: string) => {
    try {
      await Api.decideDecision(id, 'approved');
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'APPROVED' } : d)));
      toast.success('Decision approved');
    } catch (error) {
      toast.error('Failed to approve decision');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await Api.decideDecision(id, 'rejected');
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'REJECTED' } : d)));
      toast.success('Decision rejected');
    } catch (error) {
      toast.error('Failed to reject decision');
    }
  };

  // Handler for sending reminder (Awaiting Others view)
  const handleRemind = async (id: string) => {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;

    try {
      await Api.remindDecision(id);

      // Update reminder count locally
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                reminderCount: (d.reminderCount || 0) + 1,
                lastReminderAt: new Date().toISOString(),
              }
            : d
        )
      );

      toast.success(`Reminder sent to ${decision.ownerName || 'decision owner'}`);
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  // Handler for escalating decision (Awaiting Others view)
  const handleEscalate = async (id: string) => {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;

    try {
      // Update decision status to ESCALATED
      await Api.escalateDecision(id, 'Manual escalation from decisions panel');

      // Create an escalation notification
      await Api.post('/api/notifications', {
        type: 'DECISION_ESCALATION',
        title: `Escalation: ${decision.title}`,
        message: `Decision "${decision.title}" has been escalated by ${currentUser?.displayName || currentUser?.firstName || 'a team member'}. Immediate attention required.`,
        severity: 'CRITICAL',
        userId: decision.decisionOwnerId,
        relatedObjectType: 'DECISION',
        relatedObjectId: id,
      });

      // Update local state
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'ESCALATED',
                escalatedAt: new Date().toISOString(),
              }
            : d
        )
      );

      toast.success(`Decision escalated - ${decision.ownerName || 'owner'} has been notified`);
    } catch (error) {
      console.error('Failed to escalate decision:', error);
      toast.error('Failed to escalate decision');
    }
  };

  const handlePreviewDetailsAction = useCallback(
    async (action: 'expand' | 'summarize' | 'copy') => {
      const d = previewDecision;
      if (!d) return;
      const base = String(detailsOverride ?? d.description ?? '').trim();
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(base || d.title || '');
          toast.success(isPolish ? 'Skopiowano' : 'Copied');
        } catch {
          toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
        } finally {
          setDetailsMenuOpen(false);
        }
        return;
      }

      try {
        setDetailsLoading(true);
        setDetailsMenuOpen(false);
        const language = isPolish ? 'pl' : 'en';
        const systemInstruction = [
          `You are a senior PMO decision advisor.`,
          `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
          `Do NOT invent facts. Use only the provided decision text/context.`,
          `Return plain text only (no markdown).`,
        ].join('\n');

        const mode = action === 'expand' ? 'expand' : 'shorten';
        const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: base || d.title,
          mode,
          systemInstruction,
          fieldLabel: 'Decision details (preview)',
          artifactContext: {
            id: d.id,
            title: d.title,
            type: 'decision',
            status: d.status || 'pending',
            priority: d.priority || 'medium',
          },
          language,
        });
        const text = String((resp as any)?.text || '').trim();
        if (text) setDetailsOverride(text);
      } catch {
        toast.error(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setDetailsLoading(false);
      }
    },
    [detailsOverride, isPolish, previewDecision]
  );

  type DecisionAiIntent = 'summarize_context' | 'propose_options' | 'assess_risk';
  const lastAiIntentRef = React.useRef<DecisionAiIntent>('summarize_context');

  const runPreviewAi = useCallback(
    async (intent: DecisionAiIntent) => {
      const d = previewDecision;
      if (!d) return;
      lastAiIntentRef.current = intent;
      try {
        setAiLoading(true);
        setAiError(null);
        const language = isPolish ? 'pl' : 'en';
        const systemInstruction = [
          `You are a senior PMO decision advisor.`,
          `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
          `Do NOT invent facts. Use only provided decision fields.`,
          `Return plain text. No markdown.`,
          `Keep it concise (3–6 short sentences or bullets).`,
          `Intent: ${intent}`,
        ].join('\n');
        const seed = [
          `[GENERATE FROM SCRATCH]`,
          `Decision: ${d.title || 'Decision'}`,
          `Type: ${d.decisionType || d.type || ''}`,
          `Project: ${d.projectName || ''}`,
          `Status: ${d.status || ''}`,
          `Priority: ${d.priority || ''}`,
          `Due date: ${d.dueDate || ''}`,
          `Description: ${String(d.description || '').trim()}`,
        ]
          .filter(Boolean)
          .join('\n');

        const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: seed,
          mode: 'generate',
          systemInstruction,
          fieldLabel: 'Decision preview AI',
          artifactContext: {
            id: d.id,
            title: d.title,
            type: 'decision',
            status: d.status || 'pending',
            priority: d.priority || 'medium',
          },
          language,
        });
        const text = String((resp as any)?.text || '').trim();
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch {
        setAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setAiLoading(false);
      }
    },
    [isPolish, previewDecision]
  );

  const handleCopyAi = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    } finally {
      setAiMenuOpen(false);
    }
  }, [aiText, isPolish]);

  const handleClearAi = useCallback(() => {
    setAiText(null);
    setAiError(null);
    setAiMenuOpen(false);
  }, []);

  const handleRegenerateAi = useCallback(() => {
    setAiMenuOpen(false);
    void runPreviewAi(lastAiIntentRef.current || 'summarize_context');
  }, [runPreviewAi]);

  const handlePreviewSnooze = useCallback(
    async (preset: DecisionSnoozePreset) => {
      const id = previewDecisionId;
      if (!id) return;
      try {
        await Api.snoozeDecision(id, { preset });
        toast.success(isPolish ? 'Odłożono' : 'Snoozed');
        setPreviewDecisionId(null);
        fetchDecisions();
      } catch {
        toast.error(isPolish ? 'Nie udało się odłożyć' : 'Failed to snooze');
      }
    },
    [fetchDecisions, isPolish, previewDecisionId]
  );

  // Selection handlers
  const handleSelectDecision = (decisionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(decisionId)) {
        next.delete(decisionId);
      } else {
        next.add(decisionId);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(allVisibleDecisionIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Column resize handler
  const handleColumnResize = (columnId: string, newWidth: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: newWidth,
    }));
  };

  // Filter handler
  const handleFilterChange = (columnId: string, values: string[]) => {
    setTableFilters((prev) => ({
      ...prev,
      [columnId]: values.length > 0 ? values : undefined,
    }));
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.decideDecision(id, 'approved')));
      setDecisions((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, status: 'APPROVED' } : d))
      );
      toast.success(`${selectedIds.size} decisions approved`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to approve decisions');
    }
  };

  const handleBulkReject = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.decideDecision(id, 'rejected')));
      setDecisions((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, status: 'REJECTED' } : d))
      );
      toast.success(`${selectedIds.size} decisions rejected`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to reject decisions');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.delete(`/decisions/${id}`)));
      setDecisions((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      toast.success(`${selectedIds.size} decisions deleted`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete decisions');
    }
  };

  const handleBulkRemind = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.remindDecision(id)));
      toast.success(`${selectedIds.size} reminders sent`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to send reminders');
    }
  };

  const handleBulkEscalate = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          Api.escalateDecision(id, 'Bulk escalation from decisions list')
        )
      );
      toast.success(`${selectedIds.size} decisions escalated`);
      setSelectedIds(new Set());
      fetchDecisions();
    } catch {
      toast.error('Failed to escalate decisions');
    }
  };

  const handleBulkSnoozeTomorrow = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.snoozeDecision(id, { preset: 'tomorrow' })));
      toast.success(`${selectedIds.size} decisions snoozed`);
      setSelectedIds(new Set());
      fetchDecisions();
    } catch {
      toast.error('Failed to snooze decisions');
    }
  };

  // Create bulk action configuration
  const handleBulkChangePriority = async () => {
    const newPriority = prompt(
      'Set priority for selected decisions (LOW / MEDIUM / HIGH / CRITICAL):'
    );
    if (!newPriority || !['low', 'medium', 'high', 'critical'].includes(newPriority.toLowerCase()))
      return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          Api.updateDecision(id, { priority: newPriority.toUpperCase() })
        )
      );
      setDecisions((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, priority: newPriority.toUpperCase() } : d))
      );
      toast.success(
        `Priority set to ${newPriority.toUpperCase()} for ${selectedIds.size} decisions`
      );
      setSelectedIds(new Set());
    } catch {
      toast.error('Failed to update priority');
    }
  };

  // Apply table filters to decisions
  const displayedDecisions = useMemo(() => {
    let result = filteredDecisions;

    const statusFilter = tableFilters.status as string[] | undefined;
    const priorityFilter = tableFilters.priority as string[] | undefined;

    if (statusFilter?.length) {
      result = result.filter((d) => statusFilter.includes(d.status?.toLowerCase() || ''));
    }
    if (priorityFilter?.length) {
      result = result.filter((d) => priorityFilter.includes(d.priority?.toLowerCase() || ''));
    }

    return result;
  }, [filteredDecisions, tableFilters]);

  const orderedDecisionIds = useMemo(() => displayedDecisions.map((d) => d.id), [displayedDecisions]);

  const allVisibleDecisionIds = useMemo(() => new Set(orderedDecisionIds), [orderedDecisionIds]);
  const allSelected = selectedIds.size > 0 && selectedIds.size === allVisibleDecisionIds.size;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allVisibleDecisionIds.size;

  // V3-A03: bulk selection lives as a mode of the single command row (parent)
  useEffect(() => {
    if (!onBulkBarChange) return;
    if (selectedIds.size === 0) {
      onBulkBarChange(null);
      return;
    }

    const base = {
      selectedCount: selectedIds.size,
      allSelected,
      someSelected,
      selectAllVisible: () => handleSelectAll(true),
      clearSelection: handleClearSelection,
    } as const;

    if (viewMode === 'awaiting') {
      onBulkBarChange({
        ...base,
        remind: handleBulkRemind,
        escalate: handleBulkEscalate,
        snoozeTomorrow: handleBulkSnoozeTomorrow,
      });
      return;
    }

    onBulkBarChange({
      ...base,
      approve: handleBulkApprove,
      reject: handleBulkReject,
      deleteSelected: handleBulkDelete,
      changePriority: handleBulkChangePriority,
    });
  }, [
    onBulkBarChange,
    selectedIds.size,
    allSelected,
    someSelected,
    viewMode,
    handleSelectAll,
    handleClearSelection,
    handleBulkApprove,
    handleBulkReject,
    handleBulkDelete,
    handleBulkChangePriority,
    handleBulkRemind,
    handleBulkEscalate,
    handleBulkSnoozeTomorrow,
  ]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (displayedDecisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
          {viewMode === 'my'
            ? 'No decisions awaiting your action'
            : viewMode === 'awaiting'
              ? 'No requests pending'
              : 'No decisions'}
        </h3>
        <p className="text-sm text-slate-500">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
      <div className="flex-1 min-h-0">
        <TableWithPreviewLayout<Decision>
          selectedId={previewDecisionId}
          selectedItem={
            previewDecisionId
              ? displayedDecisions.find((d) => d.id === previewDecisionId) || null
              : null
          }
          onSelect={setPreviewDecisionId}
          previewOpen={Boolean(previewDecisionId)}
          autoOpenPreview={false}
          onOpenFull={(id) => {
            const full = decisions.find((d) => d.id === id);
            onDecisionClick?.(id, full);
            setPreviewDecisionId(null);
          }}
          itemIds={orderedDecisionIds}
          renderPreview={(item) => {
            const decisionData = (previewDecision || (item as any)) as DecisionPreviewData;
            if (previewLoading) {
              return (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
                </div>
              );
            }
            return (
              <DecisionPreviewBody
                decision={decisionData}
                brief={previewBrief}
                isPolish={isPolish}
                detailsOverride={detailsOverride}
                detailsLoading={detailsLoading}
                detailsMenuOpen={detailsMenuOpen}
                onToggleDetailsMenu={() => setDetailsMenuOpen((v) => !v)}
                onCloseDetailsMenu={() => setDetailsMenuOpen(false)}
                onDetailsAction={(a) => void handlePreviewDetailsAction(a)}
              />
            );
          }}
          renderPreviewFooter={(item) => {
            const decisionData = (previewDecision || (item as any)) as DecisionPreviewData;
            const mode: DecisionPreviewMode =
              viewMode === 'awaiting' ? 'requests_pending' : viewMode === 'my' ? 'my' : 'all';
            const meId = currentUser?.id ? String(currentUser.id) : null;
            const ownerId = decisionData?.decisionOwnerId ? String(decisionData.decisionOwnerId) : null;
            const canAct = mode !== 'requests_pending' && Boolean(meId && ownerId && meId === ownerId);
            return (
              <DecisionPreviewFooter
                decision={decisionData}
                mode={mode}
                canAct={canAct}
                isPolish={isPolish}
                aiText={aiText}
                aiError={aiError}
                aiLoading={aiLoading}
                aiMenuOpen={aiMenuOpen}
                onToggleAiMenu={() => setAiMenuOpen((v) => !v)}
                onCloseAiMenu={() => setAiMenuOpen(false)}
                onRunAi={(intent) => void runPreviewAi(intent as any)}
                onCopyAi={() => void handleCopyAi()}
                onClearAi={handleClearAi}
                onRegenerateAi={handleRegenerateAi}
                onApprove={async () => {
                  if (!previewDecisionId) return;
                  await handleApprove(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                onReject={async () => {
                  if (!previewDecisionId) return;
                  await handleReject(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                onDelegate={async () => {
                  await fetchUsers();
                  setDelegationOpen(true);
                }}
                onMoreInfo={() => {
                  if (!previewDecisionId) return;
                  onDecisionClick?.(previewDecisionId, decisions.find((d) => d.id === previewDecisionId));
                  setPreviewDecisionId(null);
                }}
                onRemind={async () => {
                  if (!previewDecisionId) return;
                  await handleRemind(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                onEscalate={async () => {
                  if (!previewDecisionId) return;
                  await handleEscalate(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                snoozeOpen={snoozeOpen}
                onToggleSnooze={() => setSnoozeOpen((v) => !v)}
                onCloseSnooze={() => setSnoozeOpen(false)}
                onSnooze={(preset) => {
                  setSnoozeOpen(false);
                  void handlePreviewSnooze(preset);
                }}
              />
            );
          }}
        >
          <div className="p-4 pt-3">
            <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
              <table className="w-full table-fixed" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-white/[0.06] bg-white/60 dark:bg-navy-900/60 sticky top-0 z-10">
                    {/* Select All */}
                    <th className="w-10 px-2 py-2">
                      <button
                        onClick={() => handleSelectAll(!allSelected)}
                        className={`
                          w-5 h-5 rounded border flex items-center justify-center transition-colors
                          ${
                            allSelected
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : someSelected
                                ? 'bg-primary-500/50 border-primary-500 text-white'
                                : 'border-slate-300 dark:border-white/[0.10] hover:border-primary-400 text-transparent hover:text-slate-500 dark:text-slate-400'
                          }
                        `}
                      >
                        {allSelected ? (
                          <CheckSquare size={14} />
                        ) : someSelected ? (
                          <Minus size={14} />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    </th>

                    {!hiddenSet.has('type') && (
                      <th
                        className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                        style={{ width: columnWidths.type }}
                      >
                        <span>{isPolish ? 'Typ' : 'Type'}</span>
                        <ColumnResizer
                          columnId="type"
                          currentWidth={columnWidths.type}
                          minWidth={80}
                          maxWidth={140}
                          onResize={handleColumnResize}
                        />
                      </th>
                    )}

                    <th className="w-8 px-1 py-2" />
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-full">
                      {isPolish ? 'Decyzja' : 'Decision'}
                    </th>

                    {!hiddenSet.has('project') && (
                      <th
                        className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                        style={{ width: columnWidths.project }}
                      >
                        <span>{viewMode === 'awaiting' ? (isPolish ? 'Właściciel' : 'Owner') : isPolish ? 'Projekt' : 'Project'}</span>
                        <ColumnResizer
                          columnId="project"
                          currentWidth={columnWidths.project}
                          minWidth={100}
                          maxWidth={180}
                          onResize={handleColumnResize}
                        />
                      </th>
                    )}

                    {!hiddenSet.has('status') && (
                      <th
                        className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                        style={{ width: columnWidths.status }}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={(tableFilters.status as string[])?.length ? 'text-primary-500' : ''}
                          >
                            {isPolish ? 'Status' : 'Status'}
                          </span>
                          <FilterDropdown
                            column={DECISION_COLUMNS.find((c) => c.id === 'status')!}
                            value={tableFilters.status as string[]}
                            onChange={(val) => handleFilterChange('status', val as string[])}
                            isOpen={openFilterId === 'status'}
                            onToggle={() => setOpenFilterId(openFilterId === 'status' ? null : 'status')}
                            onClose={() => setOpenFilterId(null)}
                          />
                        </div>
                        <ColumnResizer
                          columnId="status"
                          currentWidth={columnWidths.status}
                          minWidth={90}
                          maxWidth={140}
                          onResize={handleColumnResize}
                        />
                      </th>
                    )}

                    {!hiddenSet.has('priority') && (
                      <th
                        className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                        style={{ width: columnWidths.priority }}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={(tableFilters.priority as string[])?.length ? 'text-primary-500' : ''}
                          >
                            {isPolish ? 'Priorytet' : 'Priority'}
                          </span>
                          <FilterDropdown
                            column={DECISION_COLUMNS.find((c) => c.id === 'priority')!}
                            value={tableFilters.priority as string[]}
                            onChange={(val) => handleFilterChange('priority', val as string[])}
                            isOpen={openFilterId === 'priority'}
                            onToggle={() => setOpenFilterId(openFilterId === 'priority' ? null : 'priority')}
                            onClose={() => setOpenFilterId(null)}
                          />
                        </div>
                        <ColumnResizer
                          columnId="priority"
                          currentWidth={columnWidths.priority}
                          minWidth={80}
                          maxWidth={130}
                          onResize={handleColumnResize}
                        />
                      </th>
                    )}

                    {!hiddenSet.has('date') && (
                      <th
                        className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                        style={{ width: columnWidths.date }}
                      >
                        <span>{isPolish ? 'Termin' : 'Due date'}</span>
                        <ColumnResizer
                          columnId="date"
                          currentWidth={columnWidths.date}
                          minWidth={90}
                          maxWidth={140}
                          onResize={handleColumnResize}
                        />
                      </th>
                    )}

                    {!hiddenSet.has('actions') && (
                      <th
                        className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                        style={{ width: columnWidths.actions }}
                      >
                        <button
                          onClick={() => setIsViewSettingsOpen(true)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                          aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                          title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                        >
                          <Settings2 size={14} />
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {displayedDecisions.map((decision) =>
                      viewMode === 'awaiting' ? (
                        <AwaitingDecisionTableRow
                          key={decision.id}
                          decision={decision}
                          isSelected={selectedIds.has(decision.id)}
                          onSelect={handleSelectDecision}
                          onRemind={handleRemind}
                          onEscalate={handleEscalate}
                          onClick={(id) => openPreview(id)}
                          onOpenFull={(id, data) => {
                            onDecisionClick?.(id, data);
                            setPreviewDecisionId(null);
                          }}
                          columnWidths={columnWidths}
                          hiddenColumns={hiddenSet}
                        />
                      ) : (
                        <DecisionTableRow
                          key={decision.id}
                          decision={decision}
                          isSelected={selectedIds.has(decision.id)}
                          onSelect={handleSelectDecision}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onClick={(id) => openPreview(id)}
                          onOpenFull={(id, data) => {
                            onDecisionClick?.(id, data);
                            setPreviewDecisionId(null);
                          }}
                          columnWidths={columnWidths}
                          hiddenColumns={hiddenSet}
                        />
                      )
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </TableWithPreviewLayout>
      </div>

      {/* Table View Settings (standard) */}
      <Modal
        open={isViewSettingsOpen}
        onClose={() => setIsViewSettingsOpen(false)}
        title={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
        description={
          isPolish
            ? 'Wybierz, które kolumny są widoczne w tabeli.'
            : 'Choose which columns are visible in the table.'
        }
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setHiddenColumns([...DECISIONS_TABLE_DEFAULT_HIDDEN_COLUMNS]);
                try {
                  localStorage.setItem(
                    DECISIONS_TABLE_VIEW_STORAGE_KEY,
                    JSON.stringify([...DECISIONS_TABLE_DEFAULT_HIDDEN_COLUMNS])
                  );
                } catch {
                  /* ignore */
                }
              }}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Reset' : 'Reset'}
            </button>
            <button
              onClick={() => setIsViewSettingsOpen(false)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-primary-500/40 dark:border-primary-500/30 bg-primary-600 text-white hover:bg-primary-700 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Gotowe' : 'Done'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {DECISION_COLUMNS.filter((c) => !['select', 'indicator'].includes(c.id)).map((col) => {
            const alwaysVisible = col.id === 'title' || col.id === 'actions';
            const checked = alwaysVisible ? true : !hiddenSet.has(col.id);
            const label =
              col.id === 'type'
                ? isPolish
                  ? 'Typ'
                  : 'Type'
                : col.id === 'project'
                  ? isPolish
                    ? 'Projekt / Właściciel'
                    : 'Project / Owner'
                  : col.id === 'priority'
                    ? isPolish
                      ? 'Priorytet'
                      : 'Priority'
                    : col.id === 'date'
                      ? isPolish
                        ? 'Termin'
                        : 'Due date'
                      : col.id === 'status'
                        ? isPolish
                          ? 'Status'
                          : 'Status'
                        : col.id === 'actions'
                          ? isPolish
                            ? 'Akcje'
                            : 'Actions'
                          : col.label;

            return (
              <label
                key={col.id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 ${
                  alwaysVisible ? 'opacity-60' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={alwaysVisible}
                  onChange={() => {
                    if (alwaysVisible) return;
                    setHiddenColumns((prev) => {
                      const set = new Set(prev);
                      if (set.has(col.id)) set.delete(col.id);
                      else set.add(col.id);
                      const next = Array.from(set);
                      try {
                        localStorage.setItem(DECISIONS_TABLE_VIEW_STORAGE_KEY, JSON.stringify(next));
                      } catch {
                        /* ignore */
                      }
                      return next;
                    });
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{label}</span>
                {alwaysVisible ? (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Wymagane' : 'Required'}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </Modal>

      {/* Delegation modal (preview action) */}
      {previewDecisionId && previewDecision ? (
        <DelegationModal
          isOpen={delegationOpen}
          onClose={() => setDelegationOpen(false)}
          decisionId={previewDecisionId}
          decisionTitle={String(previewDecision?.title || '')}
          availableUsers={availableUsers}
          currentDeciderId={String((previewDecision as any)?.deciderId || previewDecision.decisionOwnerId || '')}
          onDelegated={() => {
            fetchDecisions();
            void fetchPreview(previewDecisionId);
          }}
        />
      ) : null}
    </div>
  );
};

export default DecisionsPanelContent;
