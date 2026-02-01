/**
 * DecisionsRequiredSection - Reusable report section for pending decisions
 * Shows decisions that require action with escalation status
 * Integration point: Decision Management module
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  FileQuestion,
  Flag,
  Flame,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface DecisionRequiredItem {
  id: string;
  title: string;
  description?: string;
  decisionType: string;
  deadline?: string;
  daysUntilDeadline?: number;
  daysWaiting?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  escalationLevel?: 'none' | 'amber' | 'red';
  requestedByName?: string;
  ownerName?: string;
  projectName?: string;
  relatedObjectType?: string;
  relatedObjectName?: string;
  blockedItemsCount?: number;
}

interface DecisionsRequiredSectionProps {
  decisions: DecisionRequiredItem[];
  title?: string;
  maxItems?: number;
  showOverdueOnly?: boolean;
  showEscalatedOnly?: boolean;
  onDecisionClick?: (decisionId: string) => void;
  className?: string;
}

// Decision type labels
const getTypeLabel = (type: string): { icon: string; label: string; color: string } => {
  const types: Record<string, { icon: string; label: string; color: string }> = {
    INITIATIVE_APPROVAL: { icon: '🎯', label: 'Initiative Approval', color: 'bg-blue-500' },
    PHASE_TRANSITION: { icon: '🚀', label: 'Phase Gate', color: 'bg-purple-500' },
    BUDGET: { icon: '💰', label: 'Budget', color: 'bg-amber-500' },
    SCOPE_CHANGE: { icon: '📐', label: 'Scope Change', color: 'bg-cyan-500' },
    RISK_ACCEPTANCE: { icon: '⚠️', label: 'Risk', color: 'bg-orange-500' },
    BLOCKER_RESOLUTION: { icon: '🔓', label: 'Unblock', color: 'bg-emerald-500' },
    RESOURCE_ALLOCATION: { icon: '👥', label: 'Resource', color: 'bg-indigo-500' },
    STRATEGIC: { icon: '🎯', label: 'Strategic', color: 'bg-violet-500' },
    EXECUTION: { icon: '⚡', label: 'Execution', color: 'bg-green-500' },
    GENERAL: { icon: '📋', label: 'General', color: 'bg-slate-500' },
  };
  return types[type] || types['GENERAL'];
};

// Priority badge
const PriorityBadge: React.FC<{ priority?: string }> = ({ priority }) => {
  if (!priority || priority === 'LOW' || priority === 'MEDIUM') return null;

  const isCritical = priority === 'CRITICAL';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isCritical ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'
      }`}
    >
      {isCritical ? <Zap size={10} /> : <Flag size={10} />}
      {priority}
    </span>
  );
};

// Escalation badge
const EscalationBadge: React.FC<{ level?: string }> = ({ level }) => {
  if (!level || level === 'none') return null;

  const isRed = level === 'red';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isRed ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-white'
      }`}
    >
      {isRed ? <Flame size={10} /> : <TrendingUp size={10} />}
      {isRed ? 'ESCALATED' : 'WARNING'}
    </span>
  );
};

// Single decision card
const DecisionCard: React.FC<{
  decision: DecisionRequiredItem;
  onClick?: (id: string) => void;
}> = ({ decision, onClick }) => {
  const { t } = useTranslation();
  const typeInfo = getTypeLabel(decision.decisionType);
  const isOverdue = decision.daysUntilDeadline !== undefined && decision.daysUntilDeadline < 0;
  const isUrgent = decision.daysUntilDeadline !== undefined && decision.daysUntilDeadline <= 2;
  const isEscalated = decision.escalationLevel === 'red';
  const isWarning = decision.escalationLevel === 'amber';

  const getBorderColor = () => {
    if (isEscalated || (isOverdue && Math.abs(decision.daysUntilDeadline || 0) > 7)) {
      return 'border-red-300 dark:border-red-500/30';
    }
    if (isWarning || isOverdue) {
      return 'border-amber-300 dark:border-amber-500/30';
    }
    if (decision.priority === 'CRITICAL') {
      return 'border-red-200 dark:border-red-500/20';
    }
    return 'border-violet-200 dark:border-violet-500/20';
  };

  const getBgColor = () => {
    if (isEscalated || (isOverdue && Math.abs(decision.daysUntilDeadline || 0) > 7)) {
      return 'bg-red-50 dark:bg-red-900/10';
    }
    if (isWarning || isOverdue) {
      return 'bg-amber-50 dark:bg-amber-900/10';
    }
    return 'bg-violet-50/50 dark:bg-violet-900/10';
  };

  return (
    <div
      onClick={() => onClick?.(decision.id)}
      className={`
        p-4 rounded-lg border-2 transition-all
        ${getBorderColor()} ${getBgColor()}
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
      `}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Badge */}
          <span className={`px-2 py-1 text-xs font-medium rounded text-white ${typeInfo.color}`}>
            {typeInfo.icon} {typeInfo.label}
          </span>

          {/* Priority */}
          <PriorityBadge priority={decision.priority} />

          {/* Escalation */}
          <EscalationBadge level={decision.escalationLevel} />

          {/* Overdue */}
          {isOverdue && decision.escalationLevel !== 'red' && (
            <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded">
              OVERDUE
            </span>
          )}
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-1 text-sm">
          {isOverdue ? (
            <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
              <AlertTriangle size={14} />
              {Math.abs(decision.daysUntilDeadline || 0)}d overdue
            </span>
          ) : isUrgent ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <Clock size={14} />
              {decision.daysUntilDeadline}d left
            </span>
          ) : decision.deadline ? (
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar size={14} />
              Due: {new Date(decision.deadline).toLocaleDateString()}
            </span>
          ) : null}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-navy-900 dark:text-white mb-1">{decision.title}</h3>

      {/* Description */}
      {decision.description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 line-clamp-2">
          {decision.description}
        </p>
      )}

      {/* Meta Info */}
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
        {decision.requestedByName && (
          <span className="flex items-center gap-1">
            <User size={12} />
            {decision.requestedByName}
          </span>
        )}
        {decision.projectName && <span>Project: {decision.projectName}</span>}
        {decision.relatedObjectType && decision.relatedObjectName && (
          <span>
            {decision.relatedObjectType}: {decision.relatedObjectName}
          </span>
        )}
        {(decision.blockedItemsCount || 0) > 0 && (
          <span className="text-red-500 dark:text-red-400 font-medium">
            {decision.blockedItemsCount} items blocked
          </span>
        )}
        {decision.daysWaiting !== undefined && decision.daysWaiting > 0 && (
          <span className="text-slate-400 dark:text-slate-500">
            Waiting: {decision.daysWaiting}d
          </span>
        )}
      </div>

      {/* Click indicator */}
      {onClick && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <span className="text-xs text-violet-500 dark:text-violet-400 flex items-center gap-1">
            View details <ChevronRight size={12} />
          </span>
        </div>
      )}
    </div>
  );
};

// Summary stats
const DecisionsSummary: React.FC<{ decisions: DecisionRequiredItem[] }> = ({ decisions }) => {
  const { t } = useTranslation();

  const overdue = decisions.filter(
    (d) => d.daysUntilDeadline !== undefined && d.daysUntilDeadline < 0
  ).length;
  const escalated = decisions.filter((d) => d.escalationLevel === 'red').length;
  const warning = decisions.filter((d) => d.escalationLevel === 'amber').length;
  const critical = decisions.filter((d) => d.priority === 'CRITICAL').length;
  const blocking = decisions.reduce((sum, d) => sum + (d.blockedItemsCount || 0), 0);

  if (overdue === 0 && escalated === 0 && warning === 0 && critical === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
      {escalated > 0 && (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
          <Flame size={14} className="animate-pulse" />
          {escalated} escalated
        </span>
      )}
      {overdue > 0 && overdue !== escalated && (
        <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
          <AlertTriangle size={14} />
          {overdue} overdue
        </span>
      )}
      {warning > 0 && (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertCircle size={14} />
          {warning} warning
        </span>
      )}
      {critical > 0 && (
        <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
          <Zap size={14} />
          {critical} critical
        </span>
      )}
      {blocking > 0 && (
        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
          {blocking} items blocked
        </span>
      )}
    </div>
  );
};

export const DecisionsRequiredSection: React.FC<DecisionsRequiredSectionProps> = ({
  decisions,
  title = 'Decisions Required',
  maxItems,
  showOverdueOnly = false,
  showEscalatedOnly = false,
  onDecisionClick,
  className = '',
}) => {
  const { t } = useTranslation();

  // Filter decisions
  let filteredDecisions = [...decisions];

  if (showOverdueOnly) {
    filteredDecisions = filteredDecisions.filter(
      (d) => d.daysUntilDeadline !== undefined && d.daysUntilDeadline < 0
    );
  }

  if (showEscalatedOnly) {
    filteredDecisions = filteredDecisions.filter(
      (d) => d.escalationLevel === 'red' || d.escalationLevel === 'amber'
    );
  }

  // Sort by urgency (escalated first, then overdue, then by days)
  filteredDecisions.sort((a, b) => {
    // Escalated red first
    if (a.escalationLevel === 'red' && b.escalationLevel !== 'red') return -1;
    if (b.escalationLevel === 'red' && a.escalationLevel !== 'red') return 1;

    // Then amber
    if (a.escalationLevel === 'amber' && b.escalationLevel !== 'amber') return -1;
    if (b.escalationLevel === 'amber' && a.escalationLevel !== 'amber') return 1;

    // Then overdue
    const aOverdue = (a.daysUntilDeadline || 0) < 0;
    const bOverdue = (b.daysUntilDeadline || 0) < 0;
    if (aOverdue && !bOverdue) return -1;
    if (bOverdue && !aOverdue) return 1;

    // Then by days waiting
    return (b.daysWaiting || 0) - (a.daysWaiting || 0);
  });

  // Limit items
  const displayDecisions = maxItems ? filteredDecisions.slice(0, maxItems) : filteredDecisions;

  const hasMore = maxItems && filteredDecisions.length > maxItems;

  if (displayDecisions.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6 ${className}`}
    >
      <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
        <FileQuestion size={20} className="text-violet-500" />
        {title}
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
          ({filteredDecisions.length})
        </span>
      </h2>

      <DecisionsSummary decisions={filteredDecisions} />

      <div className="space-y-4">
        {displayDecisions.map((decision) => (
          <DecisionCard key={decision.id} decision={decision} onClick={onDecisionClick} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-navy-700 text-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            + {filteredDecisions.length - maxItems} more decisions
          </span>
        </div>
      )}
    </div>
  );
};

export default DecisionsRequiredSection;
