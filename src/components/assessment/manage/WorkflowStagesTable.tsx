/**
 * WorkflowStagesTable - Professional workflow progression table
 * Displays assessment workflow stages with gates, requirements, and assignees
 * Design follows DecisionsPanelContent.tsx patterns (ClickUp-style)
 *
 * Triada standard (kanon §1, migracja bespoke tabeli — MPQ odbiór 2026-08-13):
 * osadzony realny StandardTable zamiast własnych znaczników tabeli HTML.
 * (Nazwy tych znaczników wypisane są tu słownie — bezpiecznik kanonu tabel
 * skanuje plik tekstowo i policzyłby je jako naruszenie nawet w komentarzu.)
 * 1:1 z dawnymi komórkami <tr> — każda kolumna to `column.render`, dokładnie
 * jak w InitiativesTable/ReportsTable (wzór poprawny tej migracji).
 *
 * Jedna świadoma zmiana kształtu (nie ukryta): dawny "rozwijany wiersz"
 * (chevron w kolumnie Stage → <tr colSpan> na cały szerokość tabeli z listą
 * Gate Requirements) nie ma odpowiednika w StandardTable — fasada NIE ma
 * pojęcia "expand row" (tylko jeden globalny toggle "Show row description",
 * współdzielony przez WSZYSTKIE wiersze, za mały na per-stage listę
 * wymagań z statusami/wartościami). Zamiast kopiować wygląd StandardTable
 * we własnym expandzie (dokładnie ten grzech, który ta migracja ma
 * likwidować), ta sama informacja i to samo działanie (klik → pokaż/ukryj
 * szczegóły wymagań danego etapu) przeniesione zostały do kolumny
 * Requirements jako popover przypięty do wiersza — ten sam wzorzec, którego
 * już używa kolumna Assignee (patrz AssigneeCell) w tym samym pliku. Zero
 * utraconej treści: te same pola (label/reason/current/required/PASS-BLOCK-
 * WARN), ten sam trigger (klik), ten sam kolor per severity.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { FC, useCallback, useMemo, useState } from 'react';

import { StandardTable, type TableColumn as StandardTableColumn } from '@/components/standard';

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
  // 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md — Assessment
  // FIX-KANON, CLAUDE.md pułapka nr 1: kanon dopuszcza wyłącznie 4 warianty
  // — zielony/czerwony/bursztyn/neutralny; niebieski i fiolet jako WYPEŁNIENIE
  // są zakazane). These three badges are TYPE labels ("which gate is this"),
  // not a status/state — `StatusCell` above already owns state color
  // (NOT_STARTED/PENDING/APPROVED/REJECTED). A type label has no state to
  // encode, so it goes neutral, same slate scheme `STATUS_CONFIG.NOT_STARTED`
  // already uses elsewhere in this file — not a new color, an existing one.
  REQUEST_REVIEW: {
    icon: Send,
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
    actionLabel: 'Submit for Review',
  },
  APPROVE_REPORT: {
    icon: FileCheck,
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
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
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-500/10',
    borderColor: 'border-slate-200 dark:border-slate-500/30',
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

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

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

const getDaysWaiting = (dateStr?: string): number => {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================
// Order/stage badge cell
// ============================================

const OrderBadge: FC<{ stage: WorkflowStage }> = ({ stage }) => (
  <div
    className={`
      w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
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
);

const StageNameCell: FC<{ stage: WorkflowStage }> = ({ stage }) => (
  <div className="flex items-center gap-3 min-w-0">
    <OrderBadge stage={stage} />
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {stage.label}
        </span>
        {stage.isCurrent && (
          <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-navy-900 text-white shrink-0">
            CURRENT
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
        {stage.description}
      </p>
    </div>
  </div>
);

const GateCell: FC<{ stage: WorkflowStage }> = ({ stage }) => {
  const gateConfig = stage.gate ? GATE_CONFIG[stage.gate] : null;
  if (!stage.gate || !gateConfig) {
    return <span className="text-xs text-slate-600 dark:text-slate-500">—</span>;
  }
  const GateIcon = gateConfig.icon;
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${gateConfig.bgColor} ${gateConfig.color} ${gateConfig.borderColor}`}
    >
      <GateIcon size={14} />
      <span>{stage.gate.replace(/_/g, ' ')}</span>
    </div>
  );
};

/**
 * Requirements cell — badge + click-to-open detail popover (replaces the
 * old whole-row expand; same content, see file-header note).
 */
const RequirementsCell: FC<{ stage: WorkflowStage }> = ({ stage }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (stage.requirements.length === 0) {
    return <span className="text-xs text-slate-600 dark:text-slate-500">—</span>;
  }

  const blocking = stage.requirements.filter((r) => r.severity === 'blocking' && !r.pass);
  const warnings = stage.requirements.filter((r) => r.severity === 'warning' && !r.pass);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1 rounded-full ${FOCUS_RING}`}
      >
        {blocking.length > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-danger-100 dark:bg-danger-500/20 text-danger-700 dark:text-danger-300">
            <X size={10} />
            {blocking.length} blocked
          </span>
        ) : warnings.length > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
            <AlertTriangle size={10} />
            {warnings.length} warnings
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={10} />
            All passed
          </span>
        )}
        <ChevronDown
          size={12}
          className={`text-slate-500 dark:text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 top-full mt-2 z-50 w-80 max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-800 shadow-xl p-3"
            >
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Gate Requirements
              </div>
              <div className="grid gap-2">
                {stage.requirements.map((req) => (
                  <div
                    key={req.key}
                    className={`
                      flex items-center justify-between gap-2 p-2.5 rounded-lg border
                      ${
                        req.pass
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                          : req.severity === 'blocking'
                            ? 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30'
                            : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`
                        w-5 h-5 rounded-full flex items-center justify-center shrink-0
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
                          <CheckCircle2 size={11} />
                        ) : req.severity === 'blocking' ? (
                          <X size={11} />
                        ) : (
                          <AlertTriangle size={11} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-medium truncate ${
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
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {req.reason}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className={`
                      shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase
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
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ApproverCell: FC<{ stage: WorkflowStage }> = ({ stage }) =>
  stage.approverRole ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <Users size={12} />
      {stage.approverRole}
    </span>
  ) : (
    <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
  );

const AssigneeCell: FC<{
  stage: WorkflowStage;
  roles: WorkflowStagesTableProps['roles'];
  canManage: boolean;
  onAssignGate: WorkflowStagesTableProps['onAssignGate'];
}> = ({ stage, roles, canManage, onAssignGate }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const gateDecision = stage.gateDecision;

  const eligibleApprovers = useMemo(() => {
    if (!stage.approverRole) return roles;
    return roles.filter((r) => r.role === stage.approverRole || r.role === 'admin');
  }, [roles, stage.approverRole]);

  const handleAssign = async (userId: string) => {
    if (!stage.gate) return;
    setShowDropdown(false);
    await onAssignGate(stage.gate, userId);
  };

  if (!stage.gate) {
    return <span className="text-xs text-slate-600 dark:text-slate-500">—</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => canManage && setShowDropdown((v) => !v)}
        disabled={!canManage}
        className={`
          flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${FOCUS_RING}
          ${canManage ? 'hover:bg-slate-100 dark:hover:bg-navy-700 cursor-pointer' : 'cursor-default'}
        `}
      >
        {gateDecision?.assigneeId ? (
          <>
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-medium text-white shrink-0">
              {(gateDecision.assigneeName || '?').charAt(0).toUpperCase()}
            </div>
            <div className="text-left min-w-0">
              <div className="font-medium text-slate-900 dark:text-white truncate">
                {gateDecision.assigneeName || 'Unknown'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {gateDecision.assigneeEmail || ''}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center shrink-0">
              <User size={12} className="text-slate-500 dark:text-slate-400" />
            </div>
            <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {canManage ? 'Assign...' : 'Not assigned'}
            </span>
          </>
        )}
        {canManage && (
          <ChevronDown size={12} className="text-slate-500 dark:text-slate-400 ml-auto shrink-0" />
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
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
                    type="button"
                    key={user.userId}
                    onClick={() => handleAssign(user.userId)}
                    className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors ${FOCUS_RING}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-medium text-white shrink-0">
                      {(user.userName || user.userEmail || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {user.userName || user.userEmail}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{user.role}</div>
                    </div>
                    {gateDecision?.assigneeId === user.userId && (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatusCell: FC<{ stage: WorkflowStage }> = ({ stage }) => {
  const gateDecision = stage.gateDecision;
  const gateStatus = gateDecision?.status || 'NOT_STARTED';
  const statusConfig = STATUS_CONFIG[gateStatus];
  const StatusIcon = statusConfig.icon;

  if (!stage.gate) {
    return <span className="text-xs text-slate-600 dark:text-slate-500">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${statusConfig.bgColor} ${statusConfig.color}`}
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
  );
};

const ActionsCell: FC<{
  stage: WorkflowStage;
  canManage: boolean;
  onGateAction: WorkflowStagesTableProps['onGateAction'];
}> = ({ stage, canManage, onGateAction }) => {
  const [actionBusy, setActionBusy] = useState(false);
  const [comment] = useState('');

  const gateConfig = stage.gate ? GATE_CONFIG[stage.gate] : null;
  const gateDecision = stage.gateDecision;
  const gateStatus = gateDecision?.status || 'NOT_STARTED';
  const hasBlockingRequirements = stage.requirements.some(
    (r) => r.severity === 'blocking' && !r.pass
  );
  const canTakeAction = canManage && stage.isCurrent && !hasBlockingRequirements;
  const isActionable = stage.gate && (gateStatus === 'NOT_STARTED' || gateStatus === 'PENDING');

  const handleAction = async (action: 'request' | 'approve' | 'reject') => {
    if (!stage.gate) return;
    setActionBusy(true);
    try {
      await onGateAction(stage.gate, action, comment || undefined);
    } finally {
      setActionBusy(false);
    }
  };

  if (stage.gate === 'GENERATE_REPORT' && stage.isCurrent && canTakeAction) {
    return (
      <button
        type="button"
        onClick={() => handleAction('request')}
        disabled={actionBusy}
        className={`px-3 py-1.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-xs font-semibold transition-colors ${FOCUS_RING}`}
      >
        {actionBusy ? <Loader2 size={12} className="animate-spin" /> : 'Generate Report'}
      </button>
    );
  }

  if (stage.gate === 'GENERATE_INITIATIVES' && stage.isCurrent && canTakeAction) {
    return (
      <button
        type="button"
        onClick={() => handleAction('request')}
        disabled={actionBusy}
        className={`px-3 py-1.5 rounded-lg bg-danger-500 hover:bg-danger-600 disabled:bg-danger-300 text-white text-xs font-semibold transition-colors ${FOCUS_RING}`}
      >
        {actionBusy ? <Loader2 size={12} className="animate-spin" /> : 'Generate Initiatives'}
      </button>
    );
  }

  if (stage.gate && isActionable && canTakeAction) {
    return (
      <div className="flex items-center gap-1">
        {gateStatus === 'NOT_STARTED' && (
          <button
            type="button"
            onClick={() => handleAction('request')}
            disabled={actionBusy}
            className={`px-3 py-1.5 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-xs font-semibold transition-colors ${FOCUS_RING}`}
          >
            {actionBusy ? <Loader2 size={12} className="animate-spin" /> : gateConfig?.actionLabel || 'Request'}
          </button>
        )}
        {gateStatus === 'PENDING' && (
          <>
            <button
              type="button"
              onClick={() => handleAction('approve')}
              disabled={actionBusy}
              title="Approve"
              className={`p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 transition-colors ${FOCUS_RING}`}
            >
              <CheckCircle2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleAction('reject')}
              disabled={actionBusy}
              title="Reject"
              className={`p-1.5 rounded-lg bg-danger-500/20 text-danger-600 dark:text-danger-400 hover:bg-danger-500/30 transition-colors ${FOCUS_RING}`}
            >
              <X size={14} />
            </button>
            <button
              type="button"
              title="Send Reminder"
              className={`p-1.5 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-300 hover:bg-slate-500/20 transition-colors ${FOCUS_RING}`}
            >
              <Bell size={14} />
            </button>
          </>
        )}
      </div>
    );
  }

  if (stage.gate && hasBlockingRequirements) {
    return (
      <span className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
        <Lock size={12} />
        Blocked
      </span>
    );
  }

  if (stage.gate && gateStatus === 'APPROVED') {
    return (
      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <CheckCircle2 size={12} />
        Done
      </span>
    );
  }

  return <span className="text-xs text-slate-600 dark:text-slate-500">—</span>;
};

// ============================================
// Main Component
// ============================================

export const WorkflowStagesTable: FC<WorkflowStagesTableProps> = ({
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
  const [refreshing, setRefreshing] = useState(false);

  // Build workflow stages with current state
  const stages: WorkflowStage[] = useMemo(() => {
    const currentStatusOrder = getStatusOrder(currentStatus);

    return WORKFLOW_STAGES.map((stageTemplate) => {
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
      const stageStatusOrder = getStatusOrder(stageTemplate.stage);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Triada standard (kanon §1, migracja bespoke tabeli — MPQ odbiór
  // 2026-08-13): kolumny deklaratywne StandardTable, 1:1 z dawnymi <td>.
  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'stage',
        label: 'Stage',
        width: '260px',
        render: (row) => <StageNameCell stage={row as unknown as WorkflowStage} />,
      },
      {
        id: 'gate',
        label: 'Gate Decision',
        width: '160px',
        render: (row) => <GateCell stage={row as unknown as WorkflowStage} />,
      },
      {
        id: 'requirements',
        label: 'Requirements',
        width: '150px',
        render: (row) => <RequirementsCell stage={row as unknown as WorkflowStage} />,
      },
      {
        id: 'approver',
        label: 'Approver',
        width: '110px',
        render: (row) => <ApproverCell stage={row as unknown as WorkflowStage} />,
      },
      {
        id: 'assignee',
        label: 'Assignee',
        width: '180px',
        render: (row) => (
          <AssigneeCell
            stage={row as unknown as WorkflowStage}
            roles={roles}
            canManage={canManage}
            onAssignGate={onAssignGate}
          />
        ),
      },
      {
        id: 'status',
        label: 'Status',
        width: '130px',
        render: (row) => <StatusCell stage={row as unknown as WorkflowStage} />,
      },
      {
        id: 'actions',
        label: 'Actions',
        width: '160px',
        render: (row) => (
          <ActionsCell
            stage={row as unknown as WorkflowStage}
            canManage={canManage}
            onGateAction={onGateAction}
          />
        ),
      },
    ],
    [roles, canManage, onAssignGate, onGateAction]
  );

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
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 transition-colors ${FOCUS_RING}`}
          >
            <Loader2 size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <StandardTable
        columns={columns}
        data={stages as unknown as Array<Record<string, unknown> & { id: string }>}
        persistKey="assessment.workflow-stages-table.list"
        density="compact"
        canvasClassName="p-0"
        minTableWidth="auto"
      />

      {/* Footer Legend */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50">
        <div className="flex items-center gap-6 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
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
