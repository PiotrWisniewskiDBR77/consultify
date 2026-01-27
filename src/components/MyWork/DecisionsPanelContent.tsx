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
  Edit,
  Eye,
  Flag,
  FolderKanban,
  Loader2,
  Minus,
  MoreVertical,
  Scale,
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

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import {
  BulkActionBar,
  ColumnResizer,
  createDecisionBulkActions,
  type ColumnDef,
  type ColumnWidths,
  type TableFilters,
  PRIORITY_FILTER_OPTIONS,
  DECISION_STATUS_FILTER_OPTIONS,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';

type ViewMode = 'my' | 'awaiting';

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

interface DecisionsPanelContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  onDecisionClick?: (id: string, decisionData?: Decision) => void;
  onCountsChange: (counts: DecisionCounts) => void;
}

// Priority config
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
        color: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-100 dark:bg-orange-500/20',
        dot: 'bg-orange-500',
        label: 'High',
        icon: Flag,
      };
    case 'MEDIUM':
      return {
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        dot: 'bg-amber-500',
        label: 'Medium',
        icon: Flag,
      };
    case 'LOW':
      return {
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-500/20',
        dot: 'bg-slate-500',
        label: 'Low',
        icon: Flag,
      };
    default:
      return {
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-500/20',
        dot: 'bg-slate-500',
        label: 'Normal',
        icon: Flag,
      };
  }
};

// Status config
const getStatusConfig = (status?: string) => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return {
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-500/20',
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
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        dot: 'bg-amber-500',
        label: 'Deferred',
      };
    case 'ESCALATED':
      return {
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-500/20',
        dot: 'bg-purple-500',
        label: 'Escalated',
      };
    case 'PENDING':
    default:
      return {
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-500/20',
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
  hover: { 
    y: -2, 
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: { duration: 0.2 }
  },
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
    width: 300,
    minWidth: 200,
    resizable: false,
    filterable: false,
  },
  {
    id: 'project',
    label: 'Project',
    width: 140,
    minWidth: 100,
    maxWidth: 180,
    resizable: true,
    filterable: false,
  },
  {
    id: 'status',
    label: 'Status',
    width: 110,
    minWidth: 90,
    maxWidth: 140,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: DECISION_STATUS_FILTER_OPTIONS,
  },
  {
    id: 'priority',
    label: 'Priority',
    width: 100,
    minWidth: 80,
    maxWidth: 130,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: PRIORITY_FILTER_OPTIONS,
  },
  {
    id: 'date',
    label: 'Due Date',
    width: 110,
    minWidth: 90,
    maxWidth: 140,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 140,
    minWidth: 100,
    maxWidth: 160,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

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
  columnWidths: ColumnWidths;
}> = ({ decision, isSelected, onSelect, onApprove, onReject, onClick, columnWidths }) => {
  const [showMenu, setShowMenu] = useState(false);
  const { t } = useTranslation();
  
  const priorityConfig = getPriorityConfig(decision.priority);
  const statusConfig = getStatusConfig(decision.status);
  const dueDate = decision.dueDate || decision.deadline;
  const overdue = isOverdue(dueDate) && decision.status?.toUpperCase() === 'PENDING';
  const daysWaiting = getDaysWaiting(decision.createdAt);
  const isPending = decision.status?.toUpperCase() === 'PENDING';
  const PriorityIcon = priorityConfig.icon;

  return (
    <motion.tr
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      onClick={() => onClick?.(decision.id, decision)}
      className={`
        group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
        transition-colors duration-150
        hover:bg-slate-50 dark:hover:bg-navy-800/50
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
            ${isSelected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }
          `}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {/* Type Badge */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
          <Scale size={12} />
          {decision.decisionType || decision.type || 'General'}
        </span>
      </td>

      {/* Priority Dot */}
      <td className="w-8 px-1 py-2.5" style={{ width: columnWidths.indicator }}>
        <div 
          className={`w-2.5 h-2.5 rounded-full ${priorityConfig.dot} ${overdue ? 'animate-pulse' : ''}`}
          title={priorityConfig.label}
        />
      </td>

      {/* Decision Title */}
      <td className="px-3 py-2.5" style={{ minWidth: 200 }}>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{decision.title}</span>
          {decision.description && (
            <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">{decision.description}</span>
          )}
        </div>
      </td>

      {/* Project */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.project }}>
        {decision.projectName ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <FolderKanban size={12} />
            <span className="truncate max-w-[100px]">{decision.projectName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-600">-</span>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.status }}>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${statusConfig.bg} ${statusConfig.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.priority }}>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${priorityConfig.color}`}>
          <PriorityIcon size={12} />
          {priorityConfig.label}
        </span>
      </td>

      {/* Due Date / Waiting */}
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

      {/* Actions */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.actions }}>
        <div className="flex items-center gap-1">
          {/* Quick Actions for Pending */}
          {isPending && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove(decision.id);
                }}
                className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                title="Approve"
              >
                <Check size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject(decision.id);
                }}
                className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Reject"
              >
                <X size={14} />
              </button>
            </>
          )}
          
          {/* View/Edit/Menu */}
          <div className={`flex items-center gap-1 ${isPending ? 'ml-1' : ''} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(decision.id);
              }}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="View"
            >
              <Eye size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(decision.id);
              }}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Edit"
            >
              <Edit size={14} />
            </button>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <MoreVertical size={14} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick?.(decision.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                    {isPending && (
                      <>
                        <div className="border-t border-slate-200 dark:border-navy-600" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprove(decision.id);
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                        >
                          <Check size={14} />
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReject(decision.id);
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </td>
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
  columnWidths: ColumnWidths;
}> = ({ decision, isSelected, onSelect, onRemind, onEscalate, onClick, columnWidths }) => {
  const [showMenu, setShowMenu] = useState(false);
  const { t } = useTranslation();
  
  const priorityConfig = getPriorityConfig(decision.priority);
  const statusConfig = getStatusConfig(decision.status);
  const dueDate = decision.dueDate || decision.deadline;
  const overdue = isOverdue(dueDate) && decision.status?.toUpperCase() === 'PENDING';
  const daysWaiting = getDaysWaiting(decision.createdAt);
  const isPending = decision.status?.toUpperCase() === 'PENDING';
  const isDecided = ['APPROVED', 'REJECTED', 'DEFERRED'].includes(decision.status?.toUpperCase() || '');
  const isEscalated = decision.status?.toUpperCase() === 'ESCALATED';
  const PriorityIcon = priorityConfig.icon;

  // Get owner initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get response badge config
  const getResponseConfig = (answer?: string) => {
    switch (answer?.toUpperCase()) {
      case 'APPROVED':
        return {
          label: 'Approved',
          color: 'text-emerald-700 dark:text-emerald-400',
          bg: 'bg-emerald-100 dark:bg-emerald-500/20',
          icon: Check,
        };
      case 'REJECTED':
        return {
          label: 'Rejected',
          color: 'text-red-700 dark:text-red-400',
          bg: 'bg-red-100 dark:bg-red-500/20',
          icon: X,
        };
      case 'DEFERRED':
        return {
          label: 'Deferred',
          color: 'text-amber-700 dark:text-amber-400',
          bg: 'bg-amber-100 dark:bg-amber-500/20',
          icon: Clock,
        };
      default:
        return null;
    }
  };

  const responseConfig = getResponseConfig(decision.answer || decision.status);

  return (
    <motion.tr
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      onClick={() => onClick?.(decision.id, decision)}
      className={`
        group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
        transition-colors duration-150
        hover:bg-slate-50 dark:hover:bg-navy-800/50
        ${overdue && !isSelected ? 'bg-red-50 dark:bg-red-500/5' : ''}
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
            ${isSelected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }
          `}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {/* Type Badge */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 text-xs font-medium">
          <Scale size={12} />
          {decision.decisionType || decision.type || 'General'}
        </span>
      </td>

      {/* Priority/Overdue Indicator */}
      <td className="w-8 px-1 py-2.5" style={{ width: columnWidths.indicator }}>
        <div 
          className={`w-2.5 h-2.5 rounded-full ${overdue ? 'bg-red-500 animate-pulse' : priorityConfig.dot}`}
          title={overdue ? 'Overdue!' : priorityConfig.label}
        />
      </td>

      {/* Decision Title */}
      <td className="px-3 py-2.5" style={{ minWidth: 180 }}>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{decision.title}</span>
          {decision.description && (
            <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">{decision.description}</span>
          )}
        </div>
      </td>

      {/* Owner (who needs to decide) */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.project }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xs font-medium text-white">
            {getInitials(decision.ownerName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-900 dark:text-white truncate">
              {decision.ownerName || 'Unknown'}
            </span>
            {decision.ownerRole && (
              <span className="text-[10px] text-slate-500 truncate">{decision.ownerRole}</span>
            )}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.status }}>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${statusConfig.bg} ${statusConfig.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot} ${isEscalated ? 'animate-pulse' : ''}`} />
          {statusConfig.label}
        </span>
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.priority }}>
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${priorityConfig.color}`}>
          <PriorityIcon size={12} />
          {priorityConfig.label}
        </span>
      </td>

      {/* Due Date / Overdue */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.date }}>
        {dueDate ? (
          <div
            className={`flex items-center gap-1.5 text-xs ${
              overdue
                ? 'text-red-700 dark:text-red-400 font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {overdue && <AlertTriangle size={12} className="animate-pulse text-red-600 dark:text-red-400" />}
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

      {/* Response (for decided items) or Actions (for pending) */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.actions }}>
        {isDecided && responseConfig ? (
          // Show response for decided items
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${responseConfig.bg} ${responseConfig.color}`}>
              <responseConfig.icon size={12} />
              {responseConfig.label}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick?.(decision.id, decision);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="View details"
            >
              <Eye size={14} />
            </button>
          </div>
        ) : (
          // Show Remind/Escalate actions for pending items
          <div className="flex items-center gap-1">
            {/* Remind Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemind(decision.id);
              }}
              className="p-1.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
              title="Send reminder"
            >
              <Bell size={14} />
            </button>
            
            {/* Escalate Button - more prominent when overdue */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEscalate(decision.id);
              }}
              className={`p-1.5 rounded transition-colors ${
                overdue 
                  ? 'bg-red-500/30 text-red-400 hover:bg-red-500/40' 
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              }`}
              title={overdue ? 'Escalate (overdue!)' : 'Escalate'}
            >
              <TrendingUp size={14} />
            </button>
            
            {/* Menu */}
            <div className="relative ml-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreVertical size={14} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick?.(decision.id, decision);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                    <div className="border-t border-slate-200 dark:border-navy-600" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemind(decision.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <Bell size={14} />
                      Send Reminder
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEscalate(decision.id);
                        setShowMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 ${
                        overdue ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      <TrendingUp size={14} />
                      {overdue ? 'Escalate (Urgent!)' : 'Escalate to Manager'}
                    </button>
                    {decision.reminderCount && decision.reminderCount > 0 && (
                      <>
                        <div className="border-t border-slate-200 dark:border-navy-600" />
                        <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-500">
                          {decision.reminderCount} reminder{decision.reminderCount > 1 ? 's' : ''} sent
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </td>
    </motion.tr>
  );
};

export const DecisionsPanelContent: React.FC<DecisionsPanelContentProps> = ({
  viewMode,
  searchQuery,
  onDecisionClick,
  onCountsChange,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Column widths state (for resizable columns)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());
  
  // Filter state (session only)
  const [tableFilters, setTableFilters] = useState<TableFilters>({});
  
  // Open filter dropdown state
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

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
  }, [fetchDecisions]);

  // Filter decisions
  const filteredDecisions = useMemo(() => {
    let result = decisions;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title?.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query)
      );
    }

    // Filter by view mode
    if (viewMode === 'my') {
      result = result.filter((d) => d.decisionOwnerId === currentUser?.id);
    } else if (viewMode === 'awaiting') {
      result = result.filter((d) => d.decisionOwnerId !== currentUser?.id);
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
  }, [decisions, searchQuery, viewMode, currentUser?.id]);

  // Calculate counts
  useEffect(() => {
    const myCount = decisions.filter((d) => d.decisionOwnerId === currentUser?.id).length;
    const awaitingCount = decisions.filter((d) => d.decisionOwnerId !== currentUser?.id).length;
    onCountsChange({
      total: decisions.length,
      my: myCount,
      awaiting: awaitingCount,
    });
  }, [decisions, currentUser?.id, onCountsChange]);

  // Handlers
  const handleApprove = async (id: string) => {
    try {
      await Api.updateDecision(id, { status: 'APPROVED' });
      setDecisions((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'APPROVED' } : d))
      );
      toast.success('Decision approved');
    } catch (error) {
      toast.error('Failed to approve decision');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await Api.updateDecision(id, { status: 'REJECTED' });
      setDecisions((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'REJECTED' } : d))
      );
      toast.success('Decision rejected');
    } catch (error) {
      toast.error('Failed to reject decision');
    }
  };

  // Handler for sending reminder (Awaiting Others view)
  const handleRemind = async (id: string) => {
    const decision = decisions.find(d => d.id === id);
    if (!decision) return;

    try {
      // Create a reminder notification
      await Api.post('/api/notifications', {
        type: 'DECISION_REMINDER',
        title: `Reminder: Decision needed - ${decision.title}`,
        message: `${currentUser?.name || 'Someone'} is waiting for your decision on "${decision.title}"`,
        severity: decision.priority === 'HIGH' || decision.priority === 'CRITICAL' ? 'WARNING' : 'INFO',
        userId: decision.decisionOwnerId,
        relatedObjectType: 'DECISION',
        relatedObjectId: id,
      });

      // Update reminder count locally
      setDecisions((prev) =>
        prev.map((d) => (d.id === id ? { 
          ...d, 
          reminderCount: (d.reminderCount || 0) + 1,
          lastReminderAt: new Date().toISOString()
        } : d))
      );

      toast.success(`Reminder sent to ${decision.ownerName || 'decision owner'}`);
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  // Handler for escalating decision (Awaiting Others view)
  const handleEscalate = async (id: string) => {
    const decision = decisions.find(d => d.id === id);
    if (!decision) return;

    try {
      // Update decision status to ESCALATED
      await Api.updateDecision(id, { 
        status: 'ESCALATED',
        escalatedAt: new Date().toISOString()
      });

      // Create an escalation notification  
      await Api.post('/api/notifications', {
        type: 'DECISION_ESCALATION',
        title: `Escalation: ${decision.title}`,
        message: `Decision "${decision.title}" has been escalated by ${currentUser?.name || 'a team member'}. Immediate attention required.`,
        severity: 'CRITICAL',
        userId: decision.decisionOwnerId,
        relatedObjectType: 'DECISION',
        relatedObjectId: id,
      });

      // Update local state
      setDecisions((prev) =>
        prev.map((d) => (d.id === id ? { 
          ...d, 
          status: 'ESCALATED',
          escalatedAt: new Date().toISOString()
        } : d))
      );

      toast.success(`Decision escalated - ${decision.ownerName || 'owner'} has been notified`);
    } catch (error) {
      console.error('Failed to escalate decision:', error);
      toast.error('Failed to escalate decision');
    }
  };

  // Selection helpers
  const allVisibleDecisionIds = useMemo(() => {
    return new Set(filteredDecisions.map(d => d.id));
  }, [filteredDecisions]);

  const allSelected = selectedIds.size > 0 && selectedIds.size === allVisibleDecisionIds.size;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allVisibleDecisionIds.size;

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
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          Api.updateDecision(id, { status: 'APPROVED' })
        )
      );
      setDecisions((prev) =>
        prev.map((d) =>
          selectedIds.has(d.id) ? { ...d, status: 'APPROVED' } : d
        )
      );
      toast.success(`${selectedIds.size} decisions approved`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to approve decisions');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.deleteDecision(id)));
      setDecisions((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      toast.success(`${selectedIds.size} decisions deleted`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete decisions');
    }
  };

  // Create bulk action configuration
  const bulkActions = createDecisionBulkActions({
    onApprove: handleBulkApprove,
    onDelete: handleBulkDelete,
    onChangePriority: () => toast('Priority change coming soon'),
  });

  // Apply table filters to decisions
  const displayedDecisions = useMemo(() => {
    let result = filteredDecisions;
    
    const statusFilter = tableFilters.status as string[] | undefined;
    const priorityFilter = tableFilters.priority as string[] | undefined;
    
    if (statusFilter?.length) {
      result = result.filter(d => statusFilter.includes(d.status?.toLowerCase() || ''));
    }
    if (priorityFilter?.length) {
      result = result.filter(d => priorityFilter.includes(d.priority?.toLowerCase() || ''));
    }
    
    return result;
  }, [filteredDecisions, tableFilters]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  if (filteredDecisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium text-slate-400 mb-2">
          {viewMode === 'my' ? 'No decisions awaiting your action' : 'No delegated decisions'}
        </h3>
        <p className="text-sm text-slate-500">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
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
                            : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-400'
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
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.type }}>
                  <span>Type</span>
                  <ColumnResizer
                    columnId="type"
                    currentWidth={columnWidths.type}
                    minWidth={80}
                    maxWidth={140}
                    onResize={handleColumnResize}
                  />
                </th>
                <th className="w-8 px-1 py-2"></th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Decision</th>
                {/* Show Owner column for awaiting mode, Project for my decisions */}
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.project }}>
                  <span>{viewMode === 'awaiting' ? 'Owner' : 'Project'}</span>
                  <ColumnResizer
                    columnId="project"
                    currentWidth={columnWidths.project}
                    minWidth={100}
                    maxWidth={180}
                    onResize={handleColumnResize}
                  />
                </th>
                
                {/* Status with Filter */}
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.status }}>
                  <div className="flex items-center gap-1">
                    <span className={(tableFilters.status as string[])?.length ? 'text-primary-500' : ''}>Status</span>
                    <FilterDropdown
                      column={DECISION_COLUMNS.find(c => c.id === 'status')!}
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
                
                {/* Priority with Filter */}
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.priority }}>
                  <div className="flex items-center gap-1">
                    <span className={(tableFilters.priority as string[])?.length ? 'text-primary-500' : ''}>Priority</span>
                    <FilterDropdown
                      column={DECISION_COLUMNS.find(c => c.id === 'priority')!}
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
                
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.date }}>
                  <span>Due Date</span>
                  <ColumnResizer
                    columnId="date"
                    currentWidth={columnWidths.date}
                    minWidth={90}
                    maxWidth={140}
                    onResize={handleColumnResize}
                  />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: columnWidths.actions }}>
                  {viewMode === 'awaiting' ? 'Response / Actions' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {displayedDecisions.map((decision) => (
                  viewMode === 'awaiting' ? (
                    <AwaitingDecisionTableRow
                      key={decision.id}
                      decision={decision}
                      isSelected={selectedIds.has(decision.id)}
                      onSelect={handleSelectDecision}
                      onRemind={handleRemind}
                      onEscalate={handleEscalate}
                      onClick={onDecisionClick}
                      columnWidths={columnWidths}
                    />
                  ) : (
                    <DecisionTableRow
                      key={decision.id}
                      decision={decision}
                      isSelected={selectedIds.has(decision.id)}
                      onSelect={handleSelectDecision}
                      onApprove={handleApprove}
                      onReject={handleReject}
                      onClick={onDecisionClick}
                      columnWidths={columnWidths}
                    />
                  )
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        actions={bulkActions}
      />
    </div>
  );
};

export default DecisionsPanelContent;
