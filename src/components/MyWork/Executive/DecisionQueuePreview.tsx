/**
 * DecisionQueuePreview - Quick decision actions for executives
 * Tech Sexy v2.0: Monochromatic, quiet actions, red reserved for destructive only
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  FileQuestion,
  Minus,
  User,
  UserPlus,
} from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface Decision {
  id: string;
  title: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  daysWaiting: number;
  requestedBy?: string;
  projectName?: string;
  description?: string;
}

interface DecisionQueuePreviewProps {
  decisions?: Decision[];
  loading?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelegate?: (id: string) => void;
  onViewAll?: () => void;
  onDecisionClick?: (id: string) => void;
}

const priorityDot: Record<string, string> = {
  critical: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-slate-400 dark:bg-slate-500',
  low: 'bg-slate-300 dark:bg-slate-600',
};

const priorityText: Record<string, string> = {
  critical: 'text-rose-500 dark:text-rose-400',
  high: 'text-amber-600 dark:text-amber-400',
  medium: 'text-slate-500 dark:text-slate-400',
  low: 'text-slate-400 dark:text-slate-500',
};

const DecisionItem: React.FC<{
  decision: Decision;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelegate?: (id: string) => void;
  onClick?: () => void;
}> = ({ decision, onApprove, onReject, onDelegate, onClick }) => {
  const { t } = useTranslation();
  const isOverdue = decision.daysWaiting > 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group px-4 py-3.5 hover:bg-slate-50/60 dark:hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Type & Priority */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {decision.type.replace(/_/g, ' ')}
            </span>
            <span className="flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${priorityDot[decision.priority] || priorityDot.medium}`}
              />
              <span
                className={`text-[10px] font-semibold ${priorityText[decision.priority] || priorityText.medium}`}
              >
                {decision.priority === 'critical'
                  ? t('executive.urgency.critical', 'Critical')
                  : decision.priority === 'high'
                    ? t('executive.urgency.high', 'High')
                    : ''}
              </span>
            </span>
            {isOverdue && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle size={10} />
                {decision.daysWaiting}d
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 mb-1">
            {decision.title}
          </h4>

          {/* Meta */}
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            {decision.requestedBy && (
              <span className="flex items-center gap-1">
                <User size={10} />
                {decision.requestedBy}
              </span>
            )}
            {decision.projectName && (
              <span className="truncate max-w-[120px]">{decision.projectName}</span>
            )}
            {!isOverdue && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {decision.daysWaiting}{t('executive.actions.days', 'd')} {t('executive.decisions.waiting', 'waiting')}
              </span>
            )}
          </div>
        </div>

        {/* Actions — appear on hover, quiet style */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!decision?.id) {
                toast.error(t('executive.decisions.error', 'Failed to process decision'));
                return;
              }
              onApprove?.(decision.id);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 transition-colors duration-150"
            title={t('executive.decisions.approve', 'Approve')}
          >
            <Check size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!decision?.id) {
                toast.error(t('executive.decisions.error', 'Failed to process decision'));
                return;
              }
              onReject?.(decision.id);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors duration-150"
            title={t('executive.decisions.reject', 'Reject')}
          >
            <Minus size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!decision?.id) {
                toast.error(t('executive.decisions.error', 'Failed to process decision'));
                return;
              }
              onDelegate?.(decision.id);
            }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors duration-150"
            title={t('executive.decisions.delegate', 'Delegate')}
          >
            <UserPlus size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const DecisionQueuePreview: React.FC<DecisionQueuePreviewProps> = ({
  decisions = [],
  loading = false,
  onApprove,
  onReject,
  onDelegate,
  onViewAll,
  onDecisionClick,
}) => {
  const { t } = useTranslation();

  const displayDecisions: Decision[] = decisions;
  const criticalCount = displayDecisions.filter((d) => d.priority === 'critical').length;

  if (loading) {
    return (
      <div className="rounded-xl bg-white dark:bg-navy-900/50">
        <div className="px-5 py-4">
          <div className="h-4 w-36 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100/50 dark:divide-white/[0.03]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-3.5 animate-pulse">
              <div className="h-3 w-3/4 bg-slate-200 dark:bg-white/10 rounded mb-2" />
              <div className="h-2.5 w-1/2 bg-slate-100 dark:bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="rounded-xl bg-white dark:bg-navy-900/50 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <FileQuestion size={16} className="text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              {t('executive.decisions.queue', 'Decision Queue')}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-300 tabular-nums">
                {displayDecisions.length}
              </span>
            </h3>
            {criticalCount > 0 && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
                {criticalCount} {t('executive.actions.critical', 'critical')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Decision List */}
      <div className="flex-1 overflow-y-auto">
        {displayDecisions.length > 0 ? (
          <div className="divide-y divide-slate-100/50 dark:divide-white/[0.03]">
            {displayDecisions.slice(0, 5).map((decision) => (
              <DecisionItem
                key={decision.id}
                decision={decision}
                onApprove={onApprove}
                onReject={onReject}
                onDelegate={onDelegate}
                onClick={() => onDecisionClick?.(decision.id)}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <Check size={24} className="mx-auto mb-2 text-emerald-500/60" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('executive.decisions.allClear', 'No pending decisions')}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {displayDecisions.length > 0 && onViewAll && (
        <div className="px-5 py-3 shrink-0">
          <button
            onClick={onViewAll}
            className="w-full text-center text-xs font-medium text-slate-400 dark:text-slate-500 hover:text-primary-500 dark:hover:text-primary-400 flex items-center justify-center gap-1 transition-colors duration-150"
          >
            {t('executive.decisions.viewAll', 'View all decisions')}
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default DecisionQueuePreview;
