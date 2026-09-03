/**
 * ApprovalWorkflow Component
 *
 * Multi-level approval workflow for Management Reports.
 * Shows approval chain status, allows approve/reject actions,
 * and displays SLA countdown.
 *
 * PMO Standards: PRINCE2 Project Board approval flow
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Crown,
  MessageSquare,
  Send,
  Shield,
  Timer,
  User,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { ApprovalChainStatus, ReportApproval, ReportApprovalStatus } from '../../../types';

interface ApprovalWorkflowProps {
  reportId: string;
  approvalStatus: ApprovalChainStatus | null;
  isLoading?: boolean;
  onSubmitForApproval?: () => Promise<void>;
  onApprove?: (comment?: string) => Promise<void>;
  onReject?: (comment: string, returnToDraft?: boolean) => Promise<void>;
  onRefresh?: () => void;
  className?: string;
}

// B3.2: Use centralized role definitions
import {
  getRoleLabel as getSharedRoleLabel,
  type ProjectRole,
  ROLE_DEFINITIONS,
} from '@/services/roleDefinitions';

// Role icons — uses centralized icon mapping
const RoleIcon: React.FC<{ role: string; className?: string }> = ({ role, className }) => {
  const def = ROLE_DEFINITIONS[role as ProjectRole];
  switch (def?.iconName) {
    case 'Crown':
      return <Crown className={className} />;
    case 'Shield':
      return <Shield className={className} />;
    default:
      return <User className={className} />;
  }
};

// Status colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'text-emerald-500 bg-emerald-500/10';
    case 'REJECTED':
      return 'text-danger-500 bg-danger-500/10';
    case 'PENDING':
      return 'text-amber-500 bg-amber-500/10';
    case 'SKIPPED':
      return 'text-slate-600 dark:text-slate-500 bg-slate-400/10';
    default:
      return 'text-slate-600 dark:text-slate-500 bg-slate-400/10';
  }
};

// B3.2: Role labels from shared service
const getRoleLabel = (role: string) => getSharedRoleLabel(role);

// SLA countdown display
const SLACountdown: React.FC<{ dueAt: string }> = ({ dueAt }) => {
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const isOverdue = diffMs < 0;

  if (isOverdue) {
    const overdueHours = Math.abs(diffHours);
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-danger-500">
        <AlertTriangle size={12} />
        {overdueHours}h overdue
      </span>
    );
  }

  const isUrgent = diffHours < 8;
  return (
    <span
      className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}
    >
      <Timer size={12} />
      {diffHours}h {diffMins}m remaining
    </span>
  );
};

// Approval step in the chain
const ApprovalStep: React.FC<{
  approval: ReportApproval;
  isActive: boolean;
  isLast: boolean;
}> = ({ approval, isActive, isLast }) => {
  const statusColor = getStatusColor(approval.status);

  return (
    <div className="flex items-start gap-4">
      {/* Connector line */}
      <div className="flex flex-col items-center">
        <div
          className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${statusColor}
                    ${isActive ? 'ring-2 ring-offset-2 ring-slate-500 dark:ring-white/40' : ''}
                `}
        >
          {approval.status === 'APPROVED' && <CheckCircle2 size={20} />}
          {approval.status === 'REJECTED' && <XCircle size={20} />}
          {approval.status === 'PENDING' && <Clock size={20} />}
          {approval.status === 'SKIPPED' && <span className="text-xs">—</span>}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 h-12 ${
              approval.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-navy-700'
            }`}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pt-1 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RoleIcon
              role={approval.requiredRole}
              className="w-4 h-4 text-slate-600 dark:text-slate-500"
            />
            <span className="font-semibold text-navy-900 dark:text-white">
              Level {approval.approvalLevel}: {getRoleLabel(approval.requiredRole)}
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
            {approval.status}
          </span>
        </div>

        {approval.assignedToName && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Assigned to: {approval.assignedToName}
          </p>
        )}

        {approval.status === 'PENDING' && approval.slaDueAt && (
          <div className="mt-2">
            <SLACountdown dueAt={approval.slaDueAt} />
          </div>
        )}

        {approval.decidedByName && approval.decidedAt && (
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <span>{approval.status === 'APPROVED' ? 'Approved' : 'Rejected'} by </span>
            <span className="font-medium">{approval.decidedByName}</span>
            <span> on {new Date(approval.decidedAt).toLocaleDateString()}</span>
          </div>
        )}

        {approval.decisionComment && (
          <div className="mt-2 p-2 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <MessageSquare size={14} className="mt-0.5 text-slate-600 dark:text-slate-500" />
              {approval.decisionComment}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({
  reportId,
  approvalStatus,
  isLoading = false,
  onSubmitForApproval,
  onApprove,
  onReject,
  onRefresh,
  className = '',
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showDecisionModal, setShowDecisionModal] = useState<'approve' | 'reject' | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [returnToDraft, setReturnToDraft] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Determine overall status badge
  const statusBadge = useMemo(() => {
    if (!approvalStatus) return null;

    const { overallStatus } = approvalStatus;
    switch (overallStatus) {
      case 'APPROVED':
        return { label: 'Approved', color: 'bg-emerald-500 text-white' };
      case 'REJECTED':
        return { label: 'Rejected', color: 'bg-danger-500 text-white' };
      case 'PENDING':
        return { label: 'Pending Approval', color: 'bg-amber-500 text-white' };
      default:
        return { label: 'Not Submitted', color: 'bg-slate-200 text-slate-700 dark:text-slate-300' };
    }
  }, [approvalStatus]);

  // Handle submit for approval
  const handleSubmit = useCallback(async () => {
    if (!onSubmitForApproval) return;
    setSubmitting(true);
    try {
      await onSubmitForApproval();
      onRefresh?.();
    } finally {
      setSubmitting(false);
    }
  }, [onSubmitForApproval, onRefresh]);

  // Handle approve
  const handleApprove = useCallback(async () => {
    if (!onApprove) return;
    setSubmitting(true);
    try {
      await onApprove(decisionComment || undefined);
      setShowDecisionModal(null);
      setDecisionComment('');
      onRefresh?.();
    } finally {
      setSubmitting(false);
    }
  }, [onApprove, decisionComment, onRefresh]);

  // Handle reject
  const handleReject = useCallback(async () => {
    if (!onReject || !decisionComment) return;
    setSubmitting(true);
    try {
      await onReject(decisionComment, returnToDraft);
      setShowDecisionModal(null);
      setDecisionComment('');
      onRefresh?.();
    } finally {
      setSubmitting(false);
    }
  }, [onReject, decisionComment, returnToDraft, onRefresh]);

  // Not submitted state
  if (!approvalStatus || approvalStatus.overallStatus === 'NONE') {
    return (
      <div
        className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
              <Send size={20} className="text-slate-600 dark:text-slate-500" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-900 dark:text-white">Approval Workflow</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Report has not been submitted for approval
              </p>
            </div>
          </div>
          {onSubmitForApproval && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text-secondary disabled:bg-c-border-strong text-c-bg rounded-lg font-medium transition-colors"
            >
              <Send size={16} />
              {submitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Shield size={20} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900 dark:text-white">Approval Workflow</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Level {approvalStatus.currentLevel} of {approvalStatus.totalLevels}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          )}
          {expanded ? (
            <ChevronUp size={20} className="text-slate-600 dark:text-slate-500" />
          ) : (
            <ChevronDown size={20} className="text-slate-600 dark:text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 dark:border-navy-700">
          {/* Approval chain */}
          <div className="mt-4">
            {approvalStatus.levels.map((level, index: number) => (
              <ApprovalStep
                key={level.id}
                approval={level}
                isActive={level.status === 'PENDING' && index === approvalStatus.currentLevel - 1}
                isLast={index === approvalStatus.levels.length - 1}
              />
            ))}
          </div>

          {/* Action buttons */}
          {(approvalStatus.canApprove || approvalStatus.canReject) && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
              {approvalStatus.canApprove && (
                <button
                  onClick={() => setShowDecisionModal('approve')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                >
                  <CheckCircle2 size={18} />
                  Approve
                </button>
              )}
              {approvalStatus.canReject && (
                <button
                  onClick={() => setShowDecisionModal('reject')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white rounded-lg font-medium transition-colors"
                >
                  <XCircle size={18} />
                  Reject
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-900 rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
              {showDecisionModal === 'approve' ? 'Approve Report' : 'Reject Report'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {showDecisionModal === 'approve'
                    ? 'Comment (optional)'
                    : 'Reason for rejection (required)'}
                </label>
                <textarea
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder={
                    showDecisionModal === 'approve'
                      ? 'Add an optional comment...'
                      : 'Please provide a reason for rejection...'
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  rows={4}
                />
              </div>

              {showDecisionModal === 'reject' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={returnToDraft}
                    onChange={(e) => setReturnToDraft(e.target.checked)}
                    className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Return report to DRAFT status for revisions
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDecisionModal(null);
                  setDecisionComment('');
                }}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-navy-700 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showDecisionModal === 'approve' ? handleApprove : handleReject}
                disabled={submitting || (showDecisionModal === 'reject' && !decisionComment)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                  showDecisionModal === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300'
                    : 'bg-danger-500 hover:bg-danger-600 disabled:bg-danger-300'
                }`}
              >
                {submitting
                  ? 'Processing...'
                  : showDecisionModal === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalWorkflow;
