/**
 * WorkflowStagesTable - Professional workflow progression table
 * Displays assessment workflow stages with gates, requirements, and assignees
 * Design follows DecisionsPanelContent.tsx patterns (ClickUp-style)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Lock,
  PlayCircle,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { ElementType, FC, useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

// ============================================
// Types
// ============================================

export type GateType =
  | 'REQUEST_REVIEW'
  | 'APPROVE_REPORT'
  | 'APPROVE_ASSESSMENT'
  | 'GENERATE_REPORT'
  | 'GENERATE_INITIATIVES';

export type GateStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';

export type WorkflowStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface GateRequirement {
  key: string;
  label: string;
  pass: boolean;
  severity: 'blocking' | 'warning';
  reason?: string;
  currentValue?: string | number;
  requiredValue?: string | number;
}

export interface GateDecision {
  id: string;
  gateType: GateType;
  fromStatus: WorkflowStatus;
  toStatus: WorkflowStatus;
  approverRole: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  status: GateStatus;
  requestedAt?: string;
  requestedBy?: string;
  requesterName?: string;
  requestComment?: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionComment?: string;
  reminderCount?: number;
  daysWaiting?: number;
}

export interface WorkflowStage {
  id: string;
  order: number;
  stage: WorkflowStatus;
  label: string;
  description: string;
  gate: GateType | null;
  gateLabel: string | null;
  approverRole: string | null;
  requirements: GateRequirement[];
  isCurrent: boolean;
  isCompleted: boolean;
  isBlocked: boolean;
  gateDecision?: GateDecision;
}

export interface WorkflowStagesTableProps {
  assessmentId: string;
  currentStatus: WorkflowStatus;
  completionPercent: number;
  confidenceAvg: number;
  reportApproved: boolean;
  eligibilityChecks: GateRequirement[];
  gateDecisions: GateDecision[];
  roles: Array<{
    userId: string;
    userName?: string;
    userEmail?: string;
    role: string;
  }>;
  canManage: boolean;
  onRefresh: () => Promise<void>;
  onGateAction: (
    gateType: GateType,
    action: 'request' | 'approve' | 'reject',
    comment?: string
  ) => Promise<void>;
  onAssignGate: (gateType: GateType, assigneeId: string) => Promise<void>;
}

// ============================================
// Constants
// ============================================

const WORKFLOW_STAGES: Omit<
  WorkflowStage,
  'requirements' | 'isCurrent' | 'isCompleted' | 'isBlocked' | 'gateDecision'
>[] = [
  {
    id: 'draft',
    order: 1,
    stage: 'DRAFT',
    label: 'Draft',
    description: 'Assessment is being filled in by the team',
    gate: null,
    gateLabel: null,
    approverRole: null,
  },
  {
    id: 'request-review',
    order: 2,
    stage: 'DRAFT',
    label: 'Submit for Review',
    description: 'Request review from Project Lead',
    gate: 'REQUEST_REVIEW',
    gateLabel: 'REQUEST_REVIEW',
    approverRole: 'manager',
  },
  {
    id: 'in-review',
    order: 3,
    stage: 'IN_REVIEW',
    label: 'In Review',
    description: 'Assessment is being reviewed',
    gate: 'APPROVE_REPORT',
    gateLabel: 'APPROVE_REPORT',
    approverRole: 'admin',
  },
  {
    id: 'awaiting-approval',
    order: 4,
    stage: 'AWAITING_APPROVAL',
    label: 'Awaiting Approval',
    description: 'Assessment awaiting final approval',
    gate: 'APPROVE_ASSESSMENT',
    gateLabel: 'APPROVE_ASSESSMENT',
    approverRole: 'admin',
  },
  {
    id: 'generate-report',
    order: 5,
    stage: 'APPROVED',
    label: 'Generate Report',
    description: 'Generate analytical report from assessment data',
    gate: 'GENERATE_REPORT',
    gateLabel: 'GENERATE_REPORT',
    approverRole: 'manager',
  },
  {
    id: 'approved',
    order: 6,
    stage: 'APPROVED',
    label: 'Approved',
    description: 'Assessment approved, can generate initiatives',
    gate: 'GENERATE_INITIATIVES',
    gateLabel: 'GENERATE_INITIATIVES',
    approverRole: 'manager',
  },
];

const GATE_CONFIG: Record<
  GateType,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    actionLabel: string;
  }
> = {
  REQUEST_REVIEW: {
    icon: Send,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    actionLabel: 'Submit for Review',
  },
  APPROVE_REPORT: {
    icon: FileCheck,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-500/10',
    borderColor: 'border-violet-200 dark:border-violet-500/30',
    actionLabel: 'Approve Report',
  },
  APPROVE_ASSESSMENT: {
    icon: ShieldCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    actionLabel: 'Approve Assessment',
  },
  GENERATE_REPORT: {
    icon: FileText,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-200 dark:border-blue-500/30',
    actionLabel: 'Generate Report',
  },
  GENERATE_INITIATIVES: {
    icon: Sparkles,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/30',
    actionLabel: 'Generate Initiatives',
  },
};

const STATUS_CONFIG: Record<
  GateStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: React.ElementType;
  }
> = {
  NOT_STARTED: {
    label: 'Not Started',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    icon: Clock,
  },
  PENDING: {
    label: 'Pending',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
    icon: Clock,
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-100 dark:bg-danger-500/20',
    icon: X,
  },
  SKIPPED: {
    label: 'Skipped',
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    icon: ArrowRight,
  },
};

// ============================================
// Helper Functions
// ============================================

const getStatusOrder = (status: WorkflowStatus): number => {
  const order: Record<WorkflowStatus, number> = {
    DRAFT: 1,
    IN_REVIEW: 2,
    AWAITING_APPROVAL: 3,
    APPROVED: 4,
    REJECTED: 0,
    ARCHIVED: 5,
  };
  return order[status] ?? 0;
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getDaysWaiting = (dateStr?: string): number => {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================
// Row Component
// ============================================

const WorkflowStageRow: FC<{
  stage: WorkflowStage;
  roles: WorkflowStagesTableProps['roles'];
  canManage: boolean;
  onGateAction: WorkflowStagesTableProps['onGateAction'];
  onAssignGate: WorkflowStagesTableProps['onAssignGate'];
  isExpanded: boolean;
  onToggleExpand: () => void;
}> = ({ stage, roles, canManage, onGateAction, onAssignGate, isExpanded, onToggleExpand }) => {
  const [actionBusy, setActionBusy] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [comment, setComment] = useState('');

  const gateConfig = stage.gate ? GATE_CONFIG[stage.gate] : null;
  const gateDecision = stage.gateDecision;
  const gateStatus = gateDecision?.status || 'NOT_STARTED';
  const statusConfig = STATUS_CONFIG[gateStatus];
  const GateIcon = gateConfig?.icon || FileText;
  const StatusIcon = statusConfig.icon;

  const hasBlockingRequirements = stage.requirements.some(
    (r) => r.severity === 'blocking' && !r.pass
  );
  const hasWarnings = stage.requirements.some((r) => r.severity === 'warning' && !r.pass);

  const canTakeAction = canManage && stage.isCurrent && !hasBlockingRequirements;
  const isActionable = stage.gate && (gateStatus === 'NOT_STARTED' || gateStatus === 'PENDING');

  const eligibleApprovers = useMemo(() => {
    if (!stage.approverRole) return roles;
    return roles.filter((r) => r.role === stage.approverRole || r.role === 'admin');
  }, [roles, stage.approverRole]);

  const handleAction = async (action: 'request' | 'approve' | 'reject') => {
    if (!stage.gate) return;
    setActionBusy(true);
    try {
      await onGateAction(stage.gate, action, comment || undefined);
      setComment('');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAssign = async (userId: string) => {
    if (!stage.gate) return;
    setShowAssigneeDropdown(false);
    await onAssignGate(stage.gate, userId);
  };

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          group border-b border-slate-200 dark:border-navy-700/50 transition-colors
          ${stage.isCurrent ? 'bg-slate-50/70 dark:bg-white/[0.03]' : ''}
          ${stage.isCompleted ? 'bg-emerald-50/30 dark:bg-emerald-500/5' : ''}
          ${stage.isBlocked ? 'bg-danger-50/30 dark:bg-danger-500/5' : ''}
          hover:bg-slate-50 dark:hover:bg-navy-800/50
        `}
      >
        {/* Order / Stage Indicator */}
        <td className="w-12 px-3 py-3">
          <div
            className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
            ${
              stage.isCompleted
                ? 'bg-emerald-500 text-white'
                : stage.isCurrent
                  ? 'bg-navy-900 text-white animate-pulse'
                  : stage.isBlocked
                    ? 'bg-danger-500/20 text-danger-600 dark:text-danger-400 border-2 border-danger-500/50'
                    : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
            }
          `}
          >
            {stage.isCompleted ? (
              <CheckCircle2 size={16} />
            ) : stage.isBlocked ? (
              <Lock size={14} />
            ) : (
              stage.order
            )}
          </div>
        </td>

        {/* Stage Name */}
        <td className="px-3 py-3 min-w-[160px]">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleExpand}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronRight size={14} className="text-slate-500 dark:text-slate-400" />
              )}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    stage.isCurrent
                      ? 'text-slate-900 dark:text-white'
                      : stage.isCompleted
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {stage.label}
                </span>
                {stage.isCurrent && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-navy-900 text-white">
                    CURRENT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stage.description}
              </p>
            </div>
          </div>
        </td>

        {/* Gate */}
        <td className="px-3 py-3 min-w-[140px]">
          {stage.gate && gateConfig ? (
            <div
              className={`
              inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              ${gateConfig.bgColor} ${gateConfig.color} ${gateConfig.borderColor} border
            `}
            >
              <GateIcon size={14} />
              <span>{stage.gate.replace(/_/g, ' ')}</span>
            </div>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
          )}
        </td>

        {/* Requirements */}
        <td className="px-3 py-3 min-w-[120px]">
          {stage.requirements.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {hasBlockingRequirements ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-danger-100 dark:bg-danger-500/20 text-danger-700 dark:text-danger-300">
                  <X size={10} />
                  {
                    stage.requirements.filter((r) => r.severity === 'blocking' && !r.pass).length
                  }{' '}
                  blocked
                </span>
              ) : hasWarnings ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={10} />
                  {
                    stage.requirements.filter((r) => r.severity === 'warning' && !r.pass).length
                  }{' '}
                  warnings
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={10} />
                  All passed
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
          )}
        </td>

        {/* Approver Role */}
        <td className="px-3 py-3 min-w-[100px]">
          {stage.approverRole ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Users size={12} />
              {stage.approverRole}
            </span>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
          )}
        </td>

        {/* Assignee */}
        <td className="px-3 py-3 min-w-[160px]">
          {stage.gate ? (
            <div className="relative">
              <button
                onClick={() => canManage && setShowAssigneeDropdown(!showAssigneeDropdown)}
                disabled={!canManage}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors
                  ${
                    canManage
                      ? 'hover:bg-slate-100 dark:hover:bg-navy-700 cursor-pointer'
                      : 'cursor-default'
                  }
                `}
              >
                {gateDecision?.assigneeId ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-medium text-white">
                      {(gateDecision.assigneeName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {gateDecision.assigneeName || 'Unknown'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {gateDecision.assigneeEmail || ''}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center">
                      <User size={12} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">
                      {canManage ? 'Assign...' : 'Not assigned'}
                    </span>
                  </>
                )}
                {canManage && (
                  <ChevronDown size={12} className="text-slate-500 dark:text-slate-400 ml-auto" />
                )}
              </button>

              {/* Assignee Dropdown */}
              {showAssigneeDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAssigneeDropdown(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-600">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        Eligible Approvers
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {eligibleApprovers.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                          No eligible approvers
                        </div>
                      ) : (
                        eligibleApprovers.map((user) => (
                          <button
                            key={user.userId}
                            onClick={() => handleAssign(user.userId)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-medium text-white">
                              {(user.userName || user.userEmail || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {user.userName || user.userEmail}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{user.role}</div>
                            </div>
                            {gateDecision?.assigneeId === user.userId && (
                              <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
          )}
        </td>

        {/* Decision Status */}
        <td className="px-3 py-3 min-w-[120px]">
          {stage.gate ? (
            <div className="flex flex-col gap-1">
              <span
                className={`
                inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium
                ${statusConfig.bgColor} ${statusConfig.color}
              `}
              >
                <StatusIcon size={10} />
                {statusConfig.label}
              </span>
              {gateDecision?.requestedAt && gateStatus === 'PENDING' && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {getDaysWaiting(gateDecision.requestedAt)}d waiting
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-3 py-3 min-w-[140px]">
          {/* Special action buttons for GENERATE_REPORT and GENERATE_INITIATIVES */}
          {stage.gate === 'GENERATE_REPORT' && stage.isCurrent && canTakeAction ? (
            <button
              onClick={() => handleAction('request')}
              disabled={actionBusy}
              className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-xs font-semibold transition-colors"
            >
              {actionBusy ? <Loader2 size={12} className="animate-spin" /> : 'Generate Report'}
            </button>
          ) : stage.gate === 'GENERATE_INITIATIVES' && stage.isCurrent && canTakeAction ? (
            <button
              onClick={() => handleAction('request')}
              disabled={actionBusy}
              className="px-3 py-1.5 rounded-lg bg-danger-500 hover:bg-danger-600 disabled:bg-danger-300 text-white text-xs font-semibold transition-colors"
            >
              {actionBusy ? <Loader2 size={12} className="animate-spin" /> : 'Generate Initiatives'}
            </button>
          ) : stage.gate && isActionable && canTakeAction ? (
            <div className="flex items-center gap-1">
              {gateStatus === 'NOT_STARTED' && (
                <button
                  onClick={() => handleAction('request')}
                  disabled={actionBusy}
                  className="px-3 py-1.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-xs font-semibold transition-colors"
                >
                  {actionBusy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    gateConfig?.actionLabel || 'Request'
                  )}
                </button>
              )}
              {gateStatus === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleAction('approve')}
                    disabled={actionBusy}
                    className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    title="Approve"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={actionBusy}
                    className="p-1.5 rounded-lg bg-danger-500/20 text-danger-600 dark:text-danger-400 hover:bg-danger-500/30 transition-colors"
                    title="Reject"
                  >
                    <X size={14} />
                  </button>
                  <button
                    className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 transition-colors"
                    title="Send Reminder"
                  >
                    <Bell size={14} />
                  </button>
                </>
              )}
            </div>
          ) : stage.gate && hasBlockingRequirements ? (
            <span className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
              <Lock size={12} />
              Blocked
            </span>
          ) : stage.gate && gateStatus === 'APPROVED' ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} />
              Done
            </span>
          ) : (
            <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
          )}
        </td>
      </motion.tr>

      {/* Expanded Requirements Row */}
      <AnimatePresence>
        {isExpanded && stage.requirements.length > 0 && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50/50 dark:bg-navy-900/30"
          >
            <td colSpan={8} className="px-6 py-3">
              <div className="ml-8">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Gate Requirements
                </div>
                <div className="grid gap-2">
                  {stage.requirements.map((req) => (
                    <div
                      key={req.key}
                      className={`
                        flex items-center justify-between p-2.5 rounded-lg border
                        ${
                          req.pass
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                            : req.severity === 'blocking'
                              ? 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30'
                              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`
                          w-6 h-6 rounded-full flex items-center justify-center
                          ${
                            req.pass
                              ? 'bg-emerald-500 text-white'
                              : req.severity === 'blocking'
                                ? 'bg-danger-500 text-white'
                                : 'bg-amber-500 text-white'
                          }
                        `}
                        >
                          {req.pass ? (
                            <CheckCircle2 size={12} />
                          ) : req.severity === 'blocking' ? (
                            <X size={12} />
                          ) : (
                            <AlertTriangle size={12} />
                          )}
                        </div>
                        <div>
                          <div
                            className={`text-sm font-medium ${
                              req.pass
                                ? 'text-emerald-800 dark:text-emerald-200'
                                : req.severity === 'blocking'
                                  ? 'text-danger-800 dark:text-danger-200'
                                  : 'text-amber-800 dark:text-amber-200'
                            }`}
                          >
                            {req.label}
                          </div>
                          {req.reason && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {req.reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {req.currentValue !== undefined && (
                          <span className="text-slate-600 dark:text-slate-300">
                            Current: <strong>{req.currentValue}</strong>
                          </span>
                        )}
                        {req.requiredValue !== undefined && (
                          <span className="text-slate-500 dark:text-slate-400">
                            Required: {req.requiredValue}
                          </span>
                        )}
                        <span
                          className={`
                          px-2 py-0.5 rounded-full font-semibold uppercase
                          ${
                            req.pass
                              ? 'bg-emerald-200 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                              : req.severity === 'blocking'
                                ? 'bg-danger-200 dark:bg-danger-500/30 text-danger-800 dark:text-danger-200'
                                : 'bg-amber-200 dark:bg-amber-500/30 text-amber-800 dark:text-amber-200'
                          }
                        `}
                        >
                          {req.pass ? 'PASS' : req.severity === 'blocking' ? 'BLOCK' : 'WARN'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
};

// ============================================
// Main Component
// ============================================

export const WorkflowStagesTable: FC<WorkflowStagesTableProps> = ({
  assessmentId,
  currentStatus,
  completionPercent,
  confidenceAvg,
  reportApproved,
  eligibilityChecks,
  gateDecisions,
  roles,
  canManage,
  onRefresh,
  onGateAction,
  onAssignGate,
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Build workflow stages with current state
  const stages: WorkflowStage[] = useMemo(() => {
    const currentStatusOrder = getStatusOrder(currentStatus);

    return WORKFLOW_STAGES.map((stageTemplate) => {
      const stageOrder = stageTemplate.order;
      const stageStatusOrder = getStatusOrder(stageTemplate.stage);
      const gateDecision = gateDecisions.find((g) => g.gateType === stageTemplate.gate);

      // Determine requirements for this stage
      let requirements: GateRequirement[] = [];
      if (stageTemplate.gate === 'REQUEST_REVIEW') {
        requirements = [
          {
            key: 'completion',
            label: 'Definition of Done (DoD)',
            pass: completionPercent >= 100 && confidenceAvg >= 3,
            severity: 'blocking',
            reason:
              completionPercent < 100 || confidenceAvg < 3
                ? `Completion: ${Math.round(completionPercent)}% (≥100%), Confidence: ${confidenceAvg.toFixed(1)} (≥3)`
                : undefined,
            currentValue: `${Math.round(completionPercent)}%`,
            requiredValue: '≥100%',
          },
          ...eligibilityChecks.filter((c) => c.key !== 'dod'),
        ];
      } else if (stageTemplate.gate === 'APPROVE_ASSESSMENT') {
        requirements = [
          {
            key: 'report_approved',
            label: 'Report Approved',
            pass: reportApproved,
            severity: 'blocking',
            reason: !reportApproved ? 'Report must be approved first' : undefined,
          },
          ...eligibilityChecks,
        ];
      } else if (stageTemplate.gate) {
        requirements = eligibilityChecks;
      }

      // Determine stage status
      const isCurrent = stageTemplate.stage === currentStatus;
      const isCompleted =
        stageStatusOrder < currentStatusOrder || gateDecision?.status === 'APPROVED';
      const isBlocked = requirements.some((r) => r.severity === 'blocking' && !r.pass);

      return {
        ...stageTemplate,
        requirements,
        isCurrent,
        isCompleted,
        isBlocked: !isCompleted && isBlocked,
        gateDecision,
      };
    });
  }, [
    currentStatus,
    completionPercent,
    confidenceAvg,
    reportApproved,
    eligibilityChecks,
    gateDecisions,
  ]);

  const handleToggleExpand = useCallback((stageId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Workflow Progression
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current: <strong>{currentStatus}</strong> • Completion:{' '}
                {Math.round(completionPercent)}%
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <Loader2 size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table
          /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
          style={{ minWidth: 900 }}
        >
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50">
              <th className="w-12 px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[160px]">
                Stage
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[140px]">
                Gate Decision
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[120px]">
                Requirements
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[100px]">
                Approver
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[160px]">
                Assignee
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[120px]">
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[140px]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {stages.map((stage) => (
                <WorkflowStageRow
                  key={stage.id}
                  stage={stage}
                  roles={roles}
                  canManage={canManage}
                  onGateAction={onGateAction}
                  onAssignGate={onAssignGate}
                  isExpanded={expandedRows.has(stage.id)}
                  onToggleExpand={() => handleToggleExpand(stage.id)}
                />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Footer Legend */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
        <div className="flex items-center gap-6 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-navy-900 animate-pulse" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-danger-500/50 border border-danger-500" />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-navy-600" />
            <span>Not Started</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowStagesTable;
