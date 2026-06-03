/**
 * DecisionBoard
 *
 * Board for managing decisions related to executing initiatives.
 * Shows pending, approved, and rejected decisions with escalation workflow.
 */

import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Filter,
  Lightbulb,
  MessageSquare,
  Rocket,
  Send,
  Target,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export type DecisionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'DEFERRED';
export type DecisionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Decision {
  id: string;
  title: string;
  description: string;
  status: DecisionStatus;
  priority: DecisionPriority;
  dueDate?: string;
  createdAt: string;
  initiativeId?: string;
  initiativeName?: string;
  requestedBy?: { id: string; firstName: string; lastName: string };
  decidedBy?: { id: string; firstName: string; lastName: string };
  decidedAt?: string;
  escalatedTo?: { id: string; firstName: string; lastName: string };
  comments?: { id: string; text: string; author: string; createdAt: string }[];
  isBlocking?: boolean;
}

interface DecisionBoardProps {
  initiativeId?: string;
  onDecisionClick?: (decision: Decision) => void;
}

export const DecisionBoard: React.FC<DecisionBoardProps> = ({ initiativeId, onDecisionClick }) => {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'blocking'>('all');
  const [showMakeDecisionModal, setShowMakeDecisionModal] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [decisionComment, setDecisionComment] = useState('');

  useEffect(() => {
    fetchDecisions();
  }, [initiativeId]);

  const fetchDecisions = async () => {
    setIsLoading(true);
    try {
      const url = initiativeId ? `/decisions?initiativeId=${initiativeId}` : '/decisions';
      const response = await Api.get(url);
      setDecisions(response.decisions || []);
    } catch (err) {
      console.error('[DecisionBoard] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecide = async (decision: Decision, outcome: 'APPROVED' | 'REJECTED') => {
    try {
      await Api.patch(`/decisions/${decision.id}/decide`, {
        outcome,
        comment: decisionComment,
      });
      toast.success(`Decision ${outcome.toLowerCase()}`);
      setShowMakeDecisionModal(false);
      setSelectedDecision(null);
      setDecisionComment('');
      fetchDecisions();
    } catch (err) {
      toast.error('Failed to record decision');
    }
  };

  const handleEscalate = async (decision: Decision) => {
    try {
      await Api.post(`/decisions/${decision.id}/escalate`, {
        reason: 'Requires higher authority decision',
      });
      toast.success('Decision escalated');
      fetchDecisions();
    } catch (err) {
      toast.error('Failed to escalate');
    }
  };

  const getDaysOverdue = (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    return Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredDecisions = decisions.filter((d) => {
    if (filter === 'pending') return d.status === 'PENDING';
    if (filter === 'blocking') return d.isBlocking;
    return true;
  });

  const pendingCount = decisions.filter((d) => d.status === 'PENDING').length;
  const blockingCount = decisions.filter((d) => d.isBlocking).length;
  const overdueCount = decisions.filter(
    (d) => d.status === 'PENDING' && d.dueDate && getDaysOverdue(d.dueDate) > 0
  ).length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400';
      case 'HIGH':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'MEDIUM':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'REJECTED':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400';
      case 'ESCALATED':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
      case 'DEFERRED':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      default:
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
    }
  };

  const renderDecisionCard = (decision: Decision) => {
    const isOverdue =
      decision.status === 'PENDING' && decision.dueDate && getDaysOverdue(decision.dueDate) > 0;
    const daysOverdue = decision.dueDate ? getDaysOverdue(decision.dueDate) : 0;

    return (
      <div
        key={decision.id}
        className={`bg-white dark:bg-navy-900 rounded-lg border p-4 transition-all ${
          isOverdue
            ? 'border-rose-300 dark:border-rose-500/50 shadow-rose-100 dark:shadow-rose-900/20 shadow-md'
            : decision.isBlocking
              ? 'border-amber-300 dark:border-amber-500/50'
              : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-white/20'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${getPriorityColor(decision.priority)}`}
              >
                {decision.priority}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(decision.status)}`}
              >
                {decision.status}
              </span>
              {decision.isBlocking && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 animate-pulse">
                  BLOCKING
                </span>
              )}
            </div>
            <h4 className="font-medium text-navy-900 dark:text-white">{decision.title}</h4>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
          {decision.description}
        </p>

        {/* Linked Initiative */}
        {decision.initiativeName && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
            <Rocket size={12} />
            <span>{decision.initiativeName}</span>
          </div>
        )}

        {/* Due date / overdue warning */}
        {decision.dueDate && (
          <div
            className={`flex items-center gap-2 p-2 rounded text-xs ${
              isOverdue
                ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                : daysOverdue > -7
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            {isOverdue ? (
              <>
                <AlertTriangle size={12} />
                <span className="font-medium">{daysOverdue} days overdue!</span>
              </>
            ) : (
              <>
                <Calendar size={12} />
                <span>Due: {new Date(decision.dueDate).toLocaleDateString('pl-PL')}</span>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-navy-700">
          {/* Requested by */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <User size={12} />
            <span>
              {decision.requestedBy
                ? `${decision.requestedBy.firstName} ${decision.requestedBy.lastName}`
                : 'Unknown'}
            </span>
          </div>

          {/* Actions */}
          {decision.status === 'PENDING' && (
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDecision(decision);
                  setShowMakeDecisionModal(true);
                }}
                className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                title="Approve"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDecide(decision, 'REJECTED');
                }}
                className="p-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded hover:bg-rose-200 dark:hover:bg-rose-900/50"
                title="Reject"
              >
                <ThumbsDown size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEscalate(decision);
                }}
                className="p-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded hover:bg-primary-200 dark:hover:bg-primary-900/50"
                title="Escalate"
              >
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 p-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              pendingCount > 0
                ? 'bg-amber-100 dark:bg-amber-900/30'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <Clock
              size={20}
              className={pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pending</p>
            <p className="text-lg font-bold text-navy-900 dark:text-white">{pendingCount}</p>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-200 dark:bg-white/10" />

        <div className="flex items-center gap-2">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              blockingCount > 0
                ? 'bg-rose-100 dark:bg-rose-900/30'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <AlertTriangle
              size={20}
              className={blockingCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Blocking</p>
            <p className="text-lg font-bold text-navy-900 dark:text-white">{blockingCount}</p>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-200 dark:bg-white/10" />

        <div className="flex items-center gap-2">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              overdueCount > 0
                ? 'bg-rose-100 dark:bg-rose-900/30 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}
          >
            <Clock
              size={20}
              className={overdueCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Overdue</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{overdueCount}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
          >
            <option value="all">All Decisions</option>
            <option value="pending">Pending Only</option>
            <option value="blocking">Blocking Only</option>
          </select>
        </div>
      </div>

      {/* Decision cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center h-32 text-slate-400 dark:text-slate-500">
            Loading decisions...
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500">
            <CheckCircle size={24} className="mb-2 text-green-500" />
            <span>No decisions to display</span>
          </div>
        ) : (
          filteredDecisions.map(renderDecisionCard)
        )}
      </div>

      {/* Make Decision Modal */}
      {showMakeDecisionModal && selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg p-6 m-4">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">Make Decision</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{selectedDecision.title}</p>
            <textarea
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              placeholder="Add a comment (optional)"
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMakeDecisionModal(false);
                  setSelectedDecision(null);
                  setDecisionComment('');
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDecide(selectedDecision, 'REJECTED')}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-500"
              >
                Reject
              </button>
              <button
                onClick={() => handleDecide(selectedDecision, 'APPROVED')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionBoard;
