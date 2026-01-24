// @ts-nocheck
/**
 * DecisionsList - Minimalist decision management
 * Clean, clickable cards that open detail modal for actions
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  Hourglass,
  Loader2,
  Plus,
  Scale,
  Target,
  User,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { DecisionGroup } from './WorkSidebar';

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
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
  dueDate?: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  relatedObjectName?: string;
}

interface DecisionCounts {
  total: number;
  my: number;
  awaiting: number;
}

interface DecisionsListProps {
  activeGroup: DecisionGroup;
  onCountsChange: (counts: DecisionCounts) => void;
  onDecisionClick?: (decisionId: string) => void;
  onCreateDecision?: () => void;
}

// Get type label
const getTypeLabel = (type: string | undefined): string => {
  if (!type) return 'Decision';
  const types: Record<string, string> = {
    INITIATIVE_APPROVAL: 'Initiative Approval',
    PHASE_TRANSITION: 'Phase Transition',
    TASK_UNBLOCK: 'Unblock Task',
    UNBLOCK: 'Unblock',
    BUDGET: 'Budget',
    SCOPE_CHANGE: 'Scope Change',
    RESOURCE_ALLOCATION: 'Resource',
    EXCEPTION: 'Exception',
    GENERAL: 'General',
  };
  return types[type] || type.replace(/_/g, ' ');
};

// Get related object icon
const getRelatedIcon = (type?: string) => {
  switch (type?.toUpperCase()) {
    case 'INITIATIVE':
      return <Target size={12} className="text-purple-500" />;
    case 'TASK':
      return <CheckSquare size={12} className="text-blue-500" />;
    case 'PHASE':
      return <Clock size={12} className="text-emerald-500" />;
    default:
      return null;
  }
};

const getDaysAgo = (dateStr: string): number => {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

// Minimalist Decision Card - clickable, no inline actions
const DecisionCard: React.FC<{
  decision: Decision;
  isMyDecision: boolean;
  onClick?: (id: string) => void;
}> = ({ decision, isMyDecision, onClick }) => {
  const { t } = useTranslation();
  const daysWaiting = getDaysAgo(decision.createdAt);
  const isUrgent = daysWaiting > 5 || decision.priority === 'CRITICAL';

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
                rounded-lg
                hover:border-purple-300 dark:hover:border-purple-500/50
                transition-all duration-150
                ${isUrgent ? 'border-l-2 border-l-amber-500' : ''}
            `}
    >
      {/* Top row: Type badge + Waiting indicator */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-medium">
            {getTypeLabel(decision.decisionType)}
          </span>
          {isUrgent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
              <AlertCircle size={10} />
              {daysWaiting}d
            </span>
          )}
        </div>
        <ChevronRight
          size={14}
          className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 transition-colors"
        />
      </div>

      {/* Title */}
      <h4 className="text-[13px] font-medium text-slate-800 dark:text-white mb-1 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
        {decision.title}
      </h4>

      {/* Description preview */}
      {decision.description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
          {decision.description}
        </p>
      )}

      {/* Related object link */}
      {decision.relatedObjectType && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-2">
          {getRelatedIcon(decision.relatedObjectType)}
          <span className="truncate">
            {decision.relatedObjectName ||
              `${decision.relatedObjectType} #${decision.relatedObjectId?.slice(0, 8)}`}
          </span>
        </div>
      )}

      {/* Bottom: Meta info + action hint */}
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
          {!isUrgent && (
            <div className="flex items-center gap-1">
              <Hourglass size={11} />
              <span>{daysWaiting}d</span>
            </div>
          )}
        </div>

        {/* Action hint on hover */}
        <span className="text-[10px] text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
          {isMyDecision
            ? t('decisions.clickToReview', 'Click to review')
            : t('decisions.clickToView', 'View details')}{' '}
          →
        </span>
      </div>
    </motion.div>
  );
};

export const DecisionsList: React.FC<DecisionsListProps> = ({
  activeGroup,
  onCountsChange,
  onDecisionClick,
  onCreateDecision,
}) => {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = useAppStore((state) => state.currentUser?.id);

  // Fetch decisions
  useEffect(() => {
    const fetchDecisions = async () => {
      try {
        setLoading(true);
        const url = currentProjectId
          ? `/decisions?projectId=${currentProjectId}&includeAll=true`
          : '/decisions?includeAll=true';
        const data = await Api.get(url);
        setDecisions(
          (data || []).filter((d: Decision) => ['PENDING', 'ESCALATED'].includes(d.status))
        );
      } catch (error) {
        console.error('Failed to fetch decisions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDecisions();
  }, [currentProjectId]);

  // Categorize decisions
  const { myDecisions, awaitingDecisions } = useMemo(() => {
    const my = decisions.filter((d) => d.decisionOwnerId === currentUserId);
    const awaiting = decisions.filter(
      (d) => d.requestedById === currentUserId && d.decisionOwnerId !== currentUserId
    );
    return { myDecisions: my, awaitingDecisions: awaiting };
  }, [decisions, currentUserId]);

  // Update counts
  useEffect(() => {
    onCountsChange({
      total: myDecisions.length + awaitingDecisions.length,
      my: myDecisions.length,
      awaiting: awaitingDecisions.length,
    });
  }, [myDecisions, awaitingDecisions, onCountsChange]);

  // Get displayed decisions based on filter
  const displayedDecisions = useMemo(() => {
    if (activeGroup === 'my') return myDecisions;
    if (activeGroup === 'awaiting') return awaitingDecisions;
    return [...myDecisions, ...awaitingDecisions];
  }, [activeGroup, myDecisions, awaitingDecisions]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={24} />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-900"
      data-testid="mywork-decisions-list"
    >
      {/* View Toggle */}
      <div className="shrink-0 px-4 py-2 border-b border-slate-100 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1 p-1 bg-slate-100 dark:bg-navy-800 rounded-lg">
          <button
            onClick={() => {
              /* Parent controls this via activeGroup */
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeGroup === 'my' || activeGroup === 'all'
                ? 'bg-white dark:bg-navy-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <User size={12} />
            {t('decisions.myDecisions', 'My Decisions')}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeGroup === 'my' || activeGroup === 'all'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              {myDecisions.length}
            </span>
          </button>
          <button
            onClick={() => {
              /* Parent controls this via activeGroup */
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeGroup === 'awaiting'
                ? 'bg-white dark:bg-navy-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Hourglass size={12} />
            {t('decisions.awaiting', 'Awaiting Others')}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeGroup === 'awaiting'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-200 dark:bg-white/10'
              }`}
            >
              {awaitingDecisions.length}
            </span>
          </button>
          </div>
          {onCreateDecision && (
            <button
              onClick={onCreateDecision}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              <Plus size={12} />
              {t('decisions.create', 'New decision')}
            </button>
          )}
        </div>
      </div>

      {/* Decisions List */}
      <div className="flex-1 overflow-y-auto p-4">
        {displayedDecisions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center"
            data-testid="mywork-decisions-empty"
          >
            <CheckCircle2 size={48} className="text-green-400 dark:text-green-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
              {activeGroup === 'my'
                ? t('decisions.noMyDecisions', 'No decisions awaiting your action')
                : t('decisions.noAwaitingOthers', 'No decisions pending from others')}
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {t('decisions.allCaughtUp', 'All caught up!')}
            </p>
            {onCreateDecision && (
              <button
                onClick={onCreateDecision}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
              >
                <Plus size={14} />
                {t('decisions.create', 'New decision')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {displayedDecisions.map((decision) => (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  isMyDecision={decision.decisionOwnerId === currentUserId}
                  onClick={onDecisionClick}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default DecisionsList;
