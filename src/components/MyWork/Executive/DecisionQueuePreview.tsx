/**
 * DecisionQueuePreview - Quick decision actions for executives
 * BCG/McKinsey style: Compact, actionable, context-rich
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileQuestion,
  User,
  UserPlus,
  XCircle,
  Zap,
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

// Priority badge
const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const config = {
    critical: { bg: 'bg-rose-500', text: 'text-white', icon: Zap },
    high: { bg: 'bg-orange-500', text: 'text-white', icon: AlertTriangle },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      icon: null,
    },
    low: {
      bg: 'bg-slate-100 dark:bg-white/10',
      text: 'text-slate-600 dark:text-slate-400',
      icon: null,
    },
  };

  const cfg = config[priority as keyof typeof config] || config.medium;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}
    >
      {Icon && <Icon size={10} />}
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};

// Decision Item Row
const DecisionItem: React.FC<{
  decision: Decision;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelegate?: (id: string) => void;
  onClick?: () => void;
}> = ({ decision, onApprove, onReject, onDelegate, onClick }) => {
  const { t } = useTranslation();
  const isOverdue = decision.daysWaiting > 7;
  const isUrgent =
    decision.daysWaiting > 3 || decision.priority === 'critical' || decision.priority === 'high';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'rgba(124, 58, 237, 0.05)' }}
      className={`
                p-4 border-b border-slate-100 dark:border-navy-700 last:border-0
                cursor-pointer transition-colors
                ${isOverdue ? 'bg-rose-50/50 dark:bg-rose-900/10' : ''}
            `}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Left: Content */}
        <div className="flex-1 min-w-0">
          {/* Type & Priority */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {decision.type.replace(/_/g, ' ')}
            </span>
            <PriorityBadge priority={decision.priority} />
            {isOverdue && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500">
                <AlertTriangle size={10} />
                {decision.daysWaiting}d overdue
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white line-clamp-1 mb-1">
            {decision.title}
          </h4>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {decision.requestedBy && (
              <span className="flex items-center gap-1">
                <User size={10} />
                {decision.requestedBy}
              </span>
            )}
            {decision.projectName && (
              <span className="truncate max-w-[120px]">{decision.projectName}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {decision.daysWaiting}d waiting
            </span>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!decision?.id) {
                toast.error('Missing decision ID');
                return;
              }
              onApprove?.(decision.id);
            }}
            className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 flex items-center justify-center transition-colors"
            title={t('executive.decisions.approve', 'Approve')}
          >
            <CheckCircle2 size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!decision?.id) {
                toast.error('Missing decision ID');
                return;
              }
              onReject?.(decision.id);
            }}
            className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 flex items-center justify-center transition-colors"
            title={t('executive.decisions.reject', 'Reject')}
          >
            <XCircle size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!decision?.id) {
                toast.error('Missing decision ID');
                return;
              }
              onDelegate?.(decision.id);
            }}
            className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center transition-colors"
            title={t('executive.decisions.delegate', 'Delegate')}
          >
            <UserPlus size={16} />
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

  // Real data only - no mock fallbacks
  const displayDecisions: Decision[] = decisions;

  const criticalCount = displayDecisions.filter((d) => d.priority === 'critical').length;
  const overdueCount = displayDecisions.filter((d) => d.daysWaiting > 7).length;

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-navy-700">
          <div className="h-6 w-40 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="h-4 w-3/4 bg-slate-200 dark:bg-white/10 rounded mb-2" />
              <div className="h-3 w-1/2 bg-slate-100 dark:bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-navy-700 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <FileQuestion size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                {t('executive.decisions.queue', 'Decision Queue')}
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  {displayDecisions.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {criticalCount > 0 && (
                  <span className="text-rose-500 font-medium">{criticalCount} critical</span>
                )}
                {criticalCount > 0 && overdueCount > 0 && ' • '}
                {overdueCount > 0 && (
                  <span className="text-amber-500 font-medium">{overdueCount} overdue</span>
                )}
                {criticalCount === 0 && overdueCount === 0 && (
                  <span>{t('executive.decisions.pending', 'Pending your action')}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Decision List */}
      <div className="flex-1 overflow-y-auto">
        {displayDecisions.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {displayDecisions.slice(0, 5).map((decision, idx) => (
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
            <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {t('executive.decisions.allClear', 'No pending decisions')}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {displayDecisions.length > 0 && onViewAll && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-white/5 shrink-0">
          <button
            onClick={onViewAll}
            className="w-full text-center text-sm font-medium text-brand hover:text-brand-hover flex items-center justify-center gap-1 transition-colors"
          >
            {t('executive.decisions.viewAll', 'View all decisions')}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default DecisionQueuePreview;
