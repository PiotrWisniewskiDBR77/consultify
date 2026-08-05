/**
 * ActionRequiredStrip - Urgent items requiring immediate attention
 * Tech Sexy v2.0: Monochromatic cards, subtle urgency indicators,
 * quiet buttons — red reserved strictly for destructive actions.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  FileQuestion,
  Minus,
  User,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ActionItem {
  id: string;
  type: 'decision' | 'task' | 'escalation' | 'blocker';
  title: string;
  description?: string;
  urgency: 'critical' | 'high' | 'medium';
  dueDate?: string;
  daysOverdue?: number;
  owner?: string;
  projectName?: string;
  actions?: {
    primary?: { label: string; action: () => void };
    secondary?: { label: string; action: () => void };
  };
}

interface ActionRequiredStripProps {
  items?: ActionItem[];
  loading?: boolean;
  onViewAll?: () => void;
  onItemClick?: (item: ActionItem) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const typeIcons = {
  decision: FileQuestion,
  task: Clock,
  escalation: Zap,
  blocker: AlertTriangle,
};

const urgencyDot: Record<string, string> = {
  critical: 'bg-danger-500',
  high: 'bg-amber-500',
  medium: 'bg-slate-400 dark:bg-slate-500',
};

const urgencyLabel: Record<string, string> = {
  critical: 'text-danger-500 dark:text-danger-400',
  high: 'text-amber-600 dark:text-amber-400',
  medium: 'text-slate-500 dark:text-slate-400',
};

const ActionItemCard: React.FC<{
  item: ActionItem;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onClick?: () => void;
}> = ({ item, onApprove, onReject, onClick }) => {
  const { t } = useTranslation();
  const Icon = typeIcons[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-shrink-0 w-72 p-4 rounded-xl bg-slate-50/80 dark:bg-white/[0.03] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] cursor-pointer transition-colors duration-150"
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={15} className="text-slate-600 dark:text-slate-500 shrink-0" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {item.type === 'decision'
            ? t('executive.action.decision', 'Decision')
            : item.type === 'task'
              ? t('executive.action.task', 'Task')
              : item.type === 'escalation'
                ? t('executive.action.escalation', 'Escalation')
                : t('executive.action.blocker', 'Blocker')}
        </span>

        {/* Urgency indicator — small dot + label, not screaming banner */}
        <span className="ml-auto flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${urgencyDot[item.urgency]}`} />
          <span className={`text-[10px] font-semibold uppercase ${urgencyLabel[item.urgency]}`}>
            {item.urgency === 'critical'
              ? t('executive.urgency.critical', 'Critical')
              : item.urgency === 'high'
                ? t('executive.urgency.high', 'High')
                : ''}
          </span>
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 mb-2 leading-snug">
        {item.title}
      </h4>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
        {item.daysOverdue !== undefined && item.daysOverdue > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
            <AlertTriangle size={10} />
            {item.daysOverdue}d
          </span>
        )}
        {item.projectName && <span className="truncate max-w-[100px]">{item.projectName}</span>}
        {item.owner && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {item.owner}
          </span>
        )}
        {item.dueDate && (
          <span className="flex items-center gap-1">
            <Calendar size={10} />
            {new Date(item.dueDate).toLocaleDateString('pl-PL', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </div>

      {/* Decision actions — quiet, not screaming */}
      {item.type === 'decision' && (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove?.(item.id);
            }}
            // CLAUDE.md UI #3: `primary-*` in this codebase IS crimson (#85182F),
            // reserved for critical semantics. "Approve" is a routine CTA, so it
            // renders neutral — the red here read as a destructive action.
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-100 hover:bg-slate-900/[0.1] dark:hover:bg-white/[0.16] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Check size={12} />
            {t('executive.action.approve', 'Approve')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject?.(item.id);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors duration-150"
          >
            <Minus size={12} />
            {t('executive.action.reject', 'Reject')}
          </button>
        </div>
      )}

      {/* Non-decision CTA */}
      {item.type !== 'decision' && (
        <div className="flex items-center justify-end text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
          {t('executive.action.view', 'View details')}
          <ChevronRight size={14} />
        </div>
      )}
    </motion.div>
  );
};

export const ActionRequiredStrip: React.FC<ActionRequiredStripProps> = ({
  items = [],
  loading = false,
  onViewAll,
  onItemClick,
  onApprove,
  onReject,
}) => {
  const { t } = useTranslation();

  const displayItems: ActionItem[] = items;

  const criticalCount = displayItems.filter((i) => i.urgency === 'critical').length;
  const highCount = displayItems.filter((i) => i.urgency === 'high').length;

  if (loading) {
    return (
      <div className="rounded-xl bg-white dark:bg-navy-900/50 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/10 animate-pulse" />
          <div className="h-4 w-36 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-72 h-32 bg-slate-100 dark:bg-white/[0.03] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (displayItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl bg-white dark:bg-navy-900/50 p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Check size={16} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('executive.action.allClear', 'All Clear!')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('executive.action.noUrgent', 'No urgent items requiring your attention.')}
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl bg-white dark:bg-navy-900/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Zap size={16} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {t('executive.action.title', 'Action Required')}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-300 tabular-nums">
                {displayItems.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {criticalCount > 0 && (
                <span className="text-danger-500 dark:text-danger-400 font-medium">
                  {criticalCount} {t('executive.actions.critical', 'critical')}
                </span>
              )}
              {criticalCount > 0 && highCount > 0 && (
                <span className="text-slate-600 dark:text-slate-400"> · </span>
              )}
              {highCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {highCount} {t('executive.actions.highPriority', 'high priority')}
                </span>
              )}
            </p>
          </div>
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-xs font-medium text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1 transition-colors duration-150"
          >
            {t('executive.action.viewAll', 'View all')}
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="px-5 pb-5">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <AnimatePresence mode="popLayout">
            {displayItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onApprove={onApprove}
                onReject={onReject}
                onClick={() => onItemClick?.(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default ActionRequiredStrip;
