// @ts-nocheck
/**
 * DecisionCard - Reusable decision card component
 * Unified decision display for all modules
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  Hourglass,
  Target,
  Timer,
  TrendingUp,
  User,
  UserPlus,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface Decision {
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
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact?: 'LOW' | 'MEDIUM' | 'HIGH';
  escalationLevel?: number;
  escalationLevelName?: 'none' | 'amber' | 'red';
  createdAt: string;
  dueDate?: string;
  daysWaiting?: number;
  daysUntilDue?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  blockedItemsCount?: number;
  relatedObjectType?: string;
  relatedObjectId?: string;
  relatedObjectName?: string;
  contextType?: 'initiative' | 'task' | 'analysis' | 'assessment' | 'tool' | 'project';
  contextId?: string;
}

interface DecisionCardProps {
  decision: Decision;
  variant?: 'compact' | 'full' | 'minimal';
  isMyDecision?: boolean;
  showActions?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelegate?: (decision: Decision) => void;
  onEscalate?: (id: string) => void;
  onClick?: (id: string) => void;
}

// Type label mapping
const getTypeInfo = (type: string): { icon: string; label: string; color: string } => {
  const types: Record<string, { icon: string; label: string; color: string }> = {
    INITIATIVE_APPROVAL: { icon: '🎯', label: 'Initiative', color: 'text-blue-600' },
    PHASE_TRANSITION: { icon: '🚀', label: 'Phase Gate', color: 'text-purple-600' },
    TASK_UNBLOCK: { icon: '🔓', label: 'Unblock', color: 'text-green-600' },
    UNBLOCK: { icon: '🔓', label: 'Unblock', color: 'text-green-600' },
    CANCEL: { icon: '❌', label: 'Cancel', color: 'text-red-600' },
    BUDGET: { icon: '💰', label: 'Budget', color: 'text-amber-600' },
    SCOPE_CHANGE: { icon: '📐', label: 'Scope', color: 'text-cyan-600' },
    RISK_ACCEPTANCE: { icon: '⚠️', label: 'Risk', color: 'text-orange-600' },
    RESOURCE_ALLOCATION: { icon: '👥', label: 'Resource', color: 'text-indigo-600' },
    STRATEGIC: { icon: '🎯', label: 'Strategic', color: 'text-purple-600' },
    EXECUTION: { icon: '⚡', label: 'Execution', color: 'text-emerald-600' },
    GENERAL: { icon: '📋', label: 'General', color: 'text-slate-600 dark:text-slate-400' },
  };
  return types[type] || types['GENERAL'];
};

// Priority badge component
const PriorityBadge: React.FC<{ priority?: string }> = ({ priority }) => {
  const config = {
    CRITICAL: {
      bg: 'bg-red-500',
      text: 'text-white',
      icon: Zap,
      label: 'Critical',
      animate: true,
    },
    HIGH: {
      bg: 'bg-orange-500',
      text: 'text-white',
      icon: Flag,
      label: 'High',
      animate: false,
    },
    MEDIUM: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      icon: Flag,
      label: 'Medium',
      animate: false,
    },
    LOW: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-500 dark:text-slate-400',
      icon: Flag,
      label: 'Low',
      animate: false,
    },
  };

  const cfg = config[priority as keyof typeof config] || config.MEDIUM;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text} ${cfg.animate ? 'animate-pulse' : ''}`}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
};

// Escalation badge component
const EscalationBadge: React.FC<{ level?: string; daysOverdue?: number }> = ({
  level,
  daysOverdue,
}) => {
  if (!level || level === 'none') return null;

  const isRed = level === 'red';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isRed
          ? 'bg-red-500 text-white animate-pulse'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      }`}
    >
      <TrendingUp size={10} />
      {isRed ? 'Escalated' : 'Warning'}
      {daysOverdue && daysOverdue > 0 && <span className="ml-0.5">({daysOverdue}d)</span>}
    </span>
  );
};

// Status timeline badge
const StatusTimeline: React.FC<{
  dueDate?: string;
  createdAt: string;
  isOverdue?: boolean;
  daysOverdue?: number;
  daysUntilDue?: number;
}> = ({ dueDate, createdAt, isOverdue, daysOverdue, daysUntilDue }) => {
  const { t } = useTranslation();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  if (isOverdue && daysOverdue && daysOverdue > 0) {
    return (
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-lg ${
          daysOverdue > 7
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 animate-pulse'
            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
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

  if (dueDate && daysUntilDue !== undefined) {
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
        {isUrgent ? <Timer size={14} /> : <Calendar size={14} />}
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
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400">
      <Clock size={14} />
      <span className="text-xs">{formatDate(createdAt)}</span>
    </div>
  );
};

export const DecisionCard: React.FC<DecisionCardProps> = ({
  decision,
  variant = 'full',
  isMyDecision = false,
  showActions = true,
  onApprove,
  onReject,
  onDelegate,
  onEscalate,
  onClick,
}) => {
  const { t } = useTranslation();
  const typeInfo = getTypeInfo(decision.decisionType);

  const isOverdue =
    decision.isOverdue || (decision.daysWaiting && decision.daysWaiting > 7);
  const daysOverdue = decision.daysOverdue || Math.max(0, (decision.daysWaiting || 0) - 7);
  const daysUntilDue =
    decision.daysUntilDue ??
    (decision.dueDate
      ? Math.ceil((new Date(decision.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : undefined);

  const getCardStyle = () => {
    if (decision.escalationLevelName === 'red' || (isOverdue && daysOverdue > 7)) {
      return 'border-l-red-500 bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-navy-900 ring-1 ring-red-200 dark:ring-red-500/20';
    } else if (decision.escalationLevelName === 'amber' || isOverdue) {
      return 'border-l-orange-500 bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-navy-900';
    } else if (decision.priority === 'CRITICAL') {
      return 'border-l-red-500 bg-white dark:bg-navy-900';
    } else if (decision.priority === 'HIGH') {
      return 'border-l-orange-500 bg-white dark:bg-navy-900';
    }
    return 'border-l-purple-500 bg-white dark:bg-navy-900';
  };

  // Minimal variant - just title and status
  if (variant === 'minimal') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -10 }}
        onClick={() => onClick?.(decision.id)}
        className={`
          group p-2 cursor-pointer
          bg-white dark:bg-navy-900
          border border-slate-200 dark:border-navy-700 
          rounded-lg
          hover:border-purple-300 dark:hover:border-purple-500/50
          transition-all duration-150
          ${isOverdue ? 'border-l-2 border-l-amber-500' : ''}
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-800 dark:text-white truncate">
            {decision.title}
          </span>
          <ChevronRight
            size={14}
            className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors shrink-0"
          />
        </div>
      </motion.div>
    );
  }

  // Compact variant - less detail
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -10 }}
        onClick={() => onClick?.(decision.id)}
        className={`
          group p-3 cursor-pointer
          bg-white dark:bg-navy-900
          border border-slate-200 dark:border-navy-700 
          rounded-lg border-l-4
          hover:border-purple-300 dark:hover:border-purple-500/50
          transition-all duration-150
          ${getCardStyle()}
        `}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-medium">
              {typeInfo.label}
            </span>
            {isOverdue && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle size={10} />
                {daysOverdue}d
              </span>
            )}
          </div>
          <ChevronRight
            size={14}
            className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors"
          />
        </div>

        <h4 className="text-[13px] font-medium text-slate-800 dark:text-white mb-1 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
          {decision.title}
        </h4>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-navy-700">
          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-1">
              <User size={11} />
              <span className="truncate max-w-[80px]">
                {isMyDecision
                  ? decision.requestedByName || 'Requested'
                  : decision.ownerName || 'Unassigned'}
              </span>
            </div>
            {decision.daysWaiting && !isOverdue && (
              <div className="flex items-center gap-1">
                <Hourglass size={11} />
                <span>{decision.daysWaiting}d</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Full variant - all details and actions
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`rounded-xl border border-slate-200 dark:border-navy-700 border-l-4 ${getCardStyle()} cursor-pointer hover:shadow-lg transition-all overflow-hidden`}
    >
      {/* Main Content */}
      <div className="p-4" onClick={() => onClick?.(decision.id)}>
        {/* Top Row: Type + Priority + Escalation + Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-white/10 ${typeInfo.color} dark:text-slate-200`}
            >
              <span>{typeInfo.icon}</span>
              {typeInfo.label}
            </span>
            <PriorityBadge priority={decision.priority} />
            <EscalationBadge level={decision.escalationLevelName} daysOverdue={daysOverdue} />
          </div>

          <StatusTimeline
            dueDate={decision.dueDate}
            createdAt={decision.createdAt}
            isOverdue={isOverdue}
            daysOverdue={daysOverdue}
            daysUntilDue={daysUntilDue}
          />
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2 line-clamp-2">
          {decision.title}
        </h4>

        {/* Description */}
        {decision.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
            {decision.description}
          </p>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {decision.projectName && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <FileText size={12} className="text-purple-600 dark:text-purple-400" />
              </div>
              <span
                className="text-slate-700 dark:text-slate-300 truncate"
                title={decision.projectName}
              >
                {decision.projectName}
              </span>
            </div>
          )}

          {decision.relatedObjectType && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Target size={12} className="text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-slate-700 dark:text-slate-300 truncate">
                {decision.relatedObjectName || decision.relatedObjectType}
              </span>
            </div>
          )}

          {(decision.blockedItemsCount || 0) > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={12} className="text-red-600 dark:text-red-400" />
              </div>
              <span className="text-red-600 dark:text-red-400 font-medium">
                {decision.blockedItemsCount} {t('decisions.blocked', 'blocked')}
              </span>
            </div>
          )}
        </div>

        {/* Waiting Time Bar */}
        {decision.daysWaiting !== undefined && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700">
            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mb-1">
              <span>{t('decisions.waitingFor', 'Waiting for')}</span>
              <span className="font-medium">
                {decision.daysWaiting} {t('decisions.days', 'days')}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (decision.daysWaiting / 14) * 100)}%` }}
                className={`h-full rounded-full ${
                  decision.daysWaiting > 10
                    ? 'bg-red-500'
                    : decision.daysWaiting > 5
                      ? 'bg-orange-500'
                      : 'bg-green-500'
                }`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      {showActions && (
        <div
          className={`px-4 py-3 border-t flex items-center gap-2 ${
            isOverdue
              ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-500/10'
              : 'bg-slate-50/50 dark:bg-white/5 border-slate-100 dark:border-navy-700'
          }`}
        >
          {isMyDecision ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(decision.id);
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={14} />
                {t('decisions.approve', 'Approve')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.(decision.id);
                }}
                className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
              >
                <XCircle size={14} />
                {t('decisions.reject', 'Reject')}
              </button>
              {onDelegate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelegate(decision);
                  }}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
                  title={t('decisions.delegate', 'Delegate')}
                >
                  <UserPlus size={14} />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => onClick?.(decision.id)}
                className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs font-medium flex items-center justify-center gap-1.5"
              >
                {t('decisions.viewDetails', 'View Details')}
                <ChevronRight size={14} />
              </button>

              {isOverdue && onEscalate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEscalate(decision.id);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <TrendingUp size={14} />
                  {t('decisions.escalate', 'Escalate')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DecisionCard;
