/**
 * InitiativeGatesWorkflowTable — N-style Gate Governance Engine
 *
 * 7-column, single-line-per-row gate table for the Initiative lifecycle.
 * Columns: # | Stage | Gate Decision | Approver | Readiness | Status | ⋮
 *
 * Connected to real backend data:
 * - Gate roles (initiative_gate_roles) — shows actual assigned users
 * - Status history (initiative_status_history) — audit trail
 * - Gate readiness check — backend-validated readiness
 * - GATE_PERMISSIONS — role-based access control
 *
 * N-mode aesthetics:
 * - Glass container (rounded-2xl, backdrop-blur)
 * - No visible grid lines — only subtle divide-y
 * - Completed gates: muted, gate badge colorful
 * - Future gates: gray gate badge
 * - Current gate: subtle purple accent row
 * - Quiet, typographic, enterprise-clean
 *
 * @see docs/ui-standards/00-foundation/visual-language.md
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck,
  FileText,
  Flag,
  History,
  Loader2,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import React, { FC, useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  GATE_PERMISSIONS,
  getGateForTransition,
  getLifecycleOrder,
  getLocalizedStatusDescription,
  getLocalizedStatusLabel,
  getStatusMeta,
  type GateTypeValue,
} from '@/services/initiativeLifecycle';
import { InitiativeStatus } from '@/types';

import { type RowAction, RowActionsMenu } from '../../shared/RowActionsMenu';
import { useInitiativeContext } from './InitiativeContext';
import type { GateRoleAssignment } from './types';

// ── Types ───────────────────────────────────────────────────────────────────

type GateDecisionStatus = 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

type GateKey =
  | 'SUBMIT_FOR_REVIEW'
  | 'APPROVE_TO_INITIATIVE'
  | 'ACCEPT'
  | 'START_PLANNING'
  | 'APPROVE'
  | 'SCHEDULE'
  | 'START'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'COMPLETE'
  | 'START_TRACKING'
  | 'CANCEL'
  | 'ARCHIVE';

type RequirementSeverity = 'blocking' | 'warning';

interface GateRequirement {
  key: string;
  label: string;
  pass: boolean;
  severity: RequirementSeverity;
  reason?: string;
}

interface LifecycleGateStage {
  id: string;
  order: number;
  status: InitiativeStatus;
  label: string;
  description: string;
  gateKey: GateKey | null;
  approverLabel: { en: string; pl: string } | null;
  /** Which gate roles are required for this gate (from GATE_PERMISSIONS) */
  requiredRoles: string[];
  requirements: Array<{
    key: string;
    label: { en: string; pl: string };
    severity: RequirementSeverity;
  }>;
}

// ── Gate decision UI config ─────────────────────────────────────────────────

const GATE_UI: Record<
  GateKey,
  {
    icon: React.ElementType;
    color: string;
    bgColor: string;
    actionLabel: { en: string; pl: string };
  }
> = {
  SUBMIT_FOR_REVIEW: {
    icon: Send,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/15',
    actionLabel: { en: 'Submit for Review', pl: 'Wyślij do przeglądu' },
  },
  APPROVE_TO_INITIATIVE: {
    icon: FileCheck,
    color: 'text-c-info',
    bgColor: 'bg-c-info/15',
    actionLabel: { en: 'Approve to Initiatives', pl: 'Przekaż do inicjatyw' },
  },
  ACCEPT: {
    icon: Flag,
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/15',
    actionLabel: { en: 'Accept (Promote)', pl: 'Zaakceptuj (promuj)' },
  },
  START_PLANNING: {
    icon: Sparkles,
    color: 'text-indigo-700 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-500/15',
    actionLabel: { en: 'Start Planning', pl: 'Rozpocznij planowanie' },
  },
  APPROVE: {
    icon: ShieldCheck,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/15',
    actionLabel: { en: 'Approve', pl: 'Zatwierdź' },
  },
  SCHEDULE: {
    icon: Clock,
    color: 'text-c-info',
    bgColor: 'bg-c-info/15',
    actionLabel: { en: 'Schedule', pl: 'Zaplanuj' },
  },
  START: {
    icon: ArrowRight,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/15',
    actionLabel: { en: 'Start Execution', pl: 'Rozpocznij realizację' },
  },
  BLOCK: {
    icon: Lock,
    color: 'text-danger-700 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/15',
    actionLabel: { en: 'Block', pl: 'Zablokuj' },
  },
  UNBLOCK: {
    icon: ArrowRight,
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/15',
    actionLabel: { en: 'Unblock', pl: 'Odblokuj' },
  },
  COMPLETE: {
    icon: FileText,
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/15',
    actionLabel: { en: 'Mark Complete', pl: 'Oznacz jako ukończone' },
  },
  START_TRACKING: {
    icon: Zap,
    color: 'text-sky-700 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-500/15',
    actionLabel: { en: 'Start Tracking', pl: 'Rozpocznij śledzenie' },
  },
  CANCEL: {
    icon: X,
    color: 'text-danger-700 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/15',
    actionLabel: { en: 'Cancel', pl: 'Anuluj' },
  },
  ARCHIVE: {
    icon: FileCheck,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/15',
    actionLabel: { en: 'Archive', pl: 'Zarchiwizuj' },
  },
};

// ── Decision status UI ──────────────────────────────────────────────────────

const STATUS_UI: Record<
  GateDecisionStatus,
  { label: { en: string; pl: string }; color: string; bgColor: string; icon: React.ElementType }
> = {
  NOT_STARTED: {
    label: { en: 'Not started', pl: 'Nie rozpoczęto' },
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    icon: Clock,
  },
  PENDING: {
    label: { en: 'Pending', pl: 'Oczekuje' },
    color: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/20',
    icon: Clock,
  },
  APPROVED: {
    label: { en: 'Approved', pl: 'Zatwierdzone' },
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/20',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: { en: 'Rejected', pl: 'Odrzucone' },
    color: 'text-danger-700 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-500/20',
    icon: X,
  },
};

// ── Gate role labels ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { en: string; pl: string }> = {
  PMO: { en: 'PMO', pl: 'PMO' },
  STEERING_COMMITTEE: { en: 'Steering Committee', pl: 'Komitet Sterujący' },
  INITIATIVE_OWNER: { en: 'Initiative Owner', pl: 'Właściciel Inicjatywy' },
  PROJECT_SPONSOR: { en: 'Project Sponsor', pl: 'Sponsor Projektu' },
  BUSINESS_OWNER: { en: 'Business Owner', pl: 'Właściciel Biznesowy' },
  CONSULTANT: { en: 'Consultant', pl: 'Konsultant' },
  PROJECT_MANAGER: { en: 'Project Manager', pl: 'Kierownik Projektu' },
  PROJECT_LEAD: { en: 'Project Lead', pl: 'Lider Projektu' },
  TEAM_MEMBER: { en: 'Team Member', pl: 'Członek Zespołu' },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const normalizeDecisionStatus = (status?: string): GateDecisionStatus => {
  const s = String(status || '').toUpperCase();
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'REJECTED') return 'REJECTED';
  if (s === 'PENDING' || s === 'ESCALATED') return 'PENDING';
  return 'NOT_STARTED';
};

const getDaysWaiting = (dateStr?: string): number => {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

const toIsoFromDateOnly = (dateOnly?: string): string | undefined => {
  const d = String(dateOnly || '').trim();
  if (!d) return undefined;
  const [yy, mm, dd] = d.split('-').map((x) => Number(x));
  if (!yy || !mm || !dd) return undefined;
  const dt = new Date(yy, mm - 1, dd, 12, 0, 0);
  return dt.toISOString();
};

const getUserDisplayName = (user: {
  firstName?: string;
  lastName?: string;
  email?: string;
}): string => {
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return full || user.email || '?';
};

// ── Component ───────────────────────────────────────────────────────────────

export const InitiativeGatesWorkflowTable: FC = () => {
  const { t } = useTranslation();
  const {
    initiative,
    initiativeId,
    isPolish,
    status: currentStatusRaw,
    decisions,
    users,
    ownerId,
    sponsorId,
    summary,
    description,
    stakeholders,
    raidItems,
    tasks,
    isMutating,
    fetchAll,
    onOpenDecision,
    // Gate governance data
    gateRoles,
    setGateRoles,
    userGateRoles,
    statusHistory,
    gateReadiness,
  } = useInitiativeContext();

  const currentStatus = (currentStatusRaw || 'DRAFT') as InitiativeStatus;
  const lifecycle = useMemo(() => getLifecycleOrder(), []);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [requestBusyGate, setRequestBusyGate] = useState<GateKey | null>(null);
  const [assigneeDraft, setAssigneeDraft] = useState<Record<string, string>>({});
  const [dueDateDraft, setDueDateDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  // Gate role assignment drafts for the modal
  const [roleAssignmentDrafts, setRoleAssignmentDrafts] = useState<Record<string, string>>({});

  // ── Gate role helpers ─────────────────────────────────────────────────────

  /** Get assigned users for a specific gate role */
  const getAssignedUsersForRole = useCallback(
    (role: string): GateRoleAssignment[] => {
      return (gateRoles || []).filter((gr) => gr.gateRole === role);
    },
    [gateRoles]
  );

  /** Get assigned users for any of the required roles for a gate */
  const getApproversForGate = useCallback(
    (gateKey: GateKey): GateRoleAssignment[] => {
      const requiredRoles = GATE_PERMISSIONS[gateKey as GateTypeValue] || [];
      return (gateRoles || []).filter((gr) => requiredRoles.includes(gr.gateRole as any));
    },
    [gateRoles]
  );

  /** Get status history entry for a specific gate transition */
  const getHistoryForTransition = useCallback(
    (fromStatus: string, toStatus: string) => {
      return (statusHistory || []).find(
        (h) => h.fromStatus?.toUpperCase() === fromStatus && h.toStatus?.toUpperCase() === toStatus
      );
    },
    [statusHistory]
  );

  // ── Requirement checks ──────────────────────────────────────────────────

  const checkRequirement = useCallback(
    (key: string): boolean => {
      switch (key) {
        case 'title':
          return !!initiative?.name;
        case 'problem':
          return !!summary;
        case 'owner':
          return !!ownerId;
        case 'sponsor':
          return !!sponsorId;
        case 'timeline':
          return !!(
            (initiative as any)?.plannedEndDate ||
            (initiative as any)?.targetDate ||
            (initiative as any)?.planned_end_date ||
            (initiative as any)?.target_date
          );
        case 'team':
          return (stakeholders || []).length > 0;
        case 'risks':
          return (raidItems || []).some((r) => r.type === 'risk');
        case 'objective':
          return !!summary;
        case 'scope':
          return !!description;
        case 'all_tasks_done': {
          const all = (tasks || []).every(
            (task) => String(task.status || '').toUpperCase() === 'DONE'
          );
          return (tasks || []).length > 0 ? all : false;
        }
        default:
          return false;
      }
    },
    [initiative, summary, ownerId, sponsorId, stakeholders, raidItems, description, tasks]
  );

  // ── Stage definitions ───────────────────────────────────────────────────

  const stages: LifecycleGateStage[] = useMemo(() => {
    // ★ 2026-08-30 — defekt językowy naprawiony u źródła. Tabela brała ZAWSZE
    // `meta.label` i `meta.description`, czyli wersje angielskie, mimo że
    // `INITIATIVE_STATUS_METADATA` ma komplet `labelPL`/`descriptionPL` dla
    // wszystkich 13 etapów, a komponent ma `isPolish` pod ręką. Skutkiem był
    // polski ekran z angielskimi opisami cyklu życia („Benefits tracking in
    // progress", „Initiative was cancelled", „Archived for reference") obok
    // polskich etykiet akcji i statusu bramy. Zmierzone na zrzucie 2026-08-30.
    // Etykieta i opis idą przez funkcje KANONICZNE oparte na kluczach tłumaczeń
    // (CB-06/RB-035), a nie przez surowe `getStatusMeta`. Surowa tablica
    // `STATUS_METADATA` niesie wyłącznie angielski — stąd brał się polski ekran
    // z angielskimi opisami cyklu życia.
    const mk = (s: InitiativeStatus): { label: string; description: string } => ({
      label: getLocalizedStatusLabel(s, t),
      description: getLocalizedStatusDescription(s, t),
    });

    const getRoles = (gateKey: GateKey | null): string[] => {
      if (!gateKey) return [];
      return (GATE_PERMISSIONS[gateKey as GateTypeValue] || []) as string[];
    };

    const defs: LifecycleGateStage[] = [
      {
        id: 'draft',
        order: 1,
        status: InitiativeStatus.DRAFT,
        ...mk(InitiativeStatus.DRAFT),
        gateKey: 'SUBMIT_FOR_REVIEW',
        approverLabel: { en: 'Initiative owner', pl: 'Właściciel inicjatywy' },
        requiredRoles: getRoles('SUBMIT_FOR_REVIEW'),
        requirements: [
          {
            key: 'title',
            label: { en: 'Title defined', pl: 'Tytuł zdefiniowany' },
            severity: 'blocking',
          },
          {
            key: 'owner',
            label: { en: 'Owner assigned', pl: 'Właściciel przypisany' },
            severity: 'blocking',
          },
        ],
      },
      {
        id: 'pending_review',
        order: 2,
        status: InitiativeStatus.PENDING_APPROVAL,
        ...mk(InitiativeStatus.PENDING_APPROVAL),
        gateKey: 'APPROVE_TO_INITIATIVE',
        approverLabel: { en: 'Project lead / PMO', pl: 'Project Lead / PMO' },
        requiredRoles: getRoles('APPROVE_TO_INITIATIVE'),
        requirements: [
          {
            key: 'title',
            label: { en: 'Title defined', pl: 'Tytuł zdefiniowany' },
            severity: 'blocking',
          },
          {
            key: 'problem',
            label: { en: 'Problem statement', pl: 'Opis problemu' },
            severity: 'warning',
          },
        ],
      },
      {
        id: 'review',
        order: 3,
        status: InitiativeStatus.PENDING_APPROVAL,
        ...mk(InitiativeStatus.PENDING_APPROVAL),
        gateKey: 'ACCEPT',
        approverLabel: { en: 'Sponsor / committee', pl: 'Sponsor / komitet' },
        requiredRoles: getRoles('ACCEPT'),
        requirements: [
          {
            key: 'title',
            label: { en: 'Title defined', pl: 'Tytuł zdefiniowany' },
            severity: 'blocking',
          },
          {
            key: 'problem',
            label: { en: 'Problem statement', pl: 'Opis problemu' },
            severity: 'blocking',
          },
          {
            key: 'owner',
            label: { en: 'Owner assigned', pl: 'Właściciel przypisany' },
            severity: 'blocking',
          },
          {
            key: 'sponsor',
            label: { en: 'Sponsor assigned', pl: 'Sponsor przypisany' },
            severity: 'warning',
          },
        ],
      },
      {
        id: 'promoted',
        order: 4,
        status: InitiativeStatus.PENDING_APPROVAL,
        ...mk(InitiativeStatus.PENDING_APPROVAL),
        gateKey: 'START_PLANNING',
        approverLabel: { en: 'PMO', pl: 'PMO' },
        requiredRoles: getRoles('START_PLANNING'),
        requirements: [
          {
            key: 'objective',
            label: { en: 'Objective defined', pl: 'Cel zdefiniowany' },
            severity: 'blocking',
          },
          {
            key: 'scope',
            label: { en: 'Scope defined', pl: 'Zakres zdefiniowany' },
            severity: 'warning',
          },
        ],
      },
      {
        id: 'planning',
        order: 5,
        status: InitiativeStatus.PENDING_APPROVAL,
        ...mk(InitiativeStatus.PENDING_APPROVAL),
        gateKey: 'APPROVE',
        approverLabel: { en: 'Steering committee', pl: 'Komitet sterujący' },
        requiredRoles: getRoles('APPROVE'),
        requirements: [
          {
            key: 'objective',
            label: { en: 'Objective defined', pl: 'Cel zdefiniowany' },
            severity: 'blocking',
          },
          {
            key: 'scope',
            label: { en: 'Scope defined', pl: 'Zakres zdefiniowany' },
            severity: 'blocking',
          },
          {
            key: 'team',
            label: { en: 'Team assigned', pl: 'Zespół przypisany' },
            severity: 'warning',
          },
          {
            key: 'risks',
            label: { en: 'Risks identified', pl: 'Ryzyka zidentyfikowane' },
            severity: 'warning',
          },
        ],
      },
      {
        id: 'approved',
        order: 6,
        status: InitiativeStatus.APPROVED,
        ...mk(InitiativeStatus.APPROVED),
        gateKey: 'SCHEDULE',
        approverLabel: { en: 'PMO', pl: 'PMO' },
        requiredRoles: getRoles('SCHEDULE'),
        requirements: [
          {
            key: 'timeline',
            label: { en: 'Timeline set', pl: 'Harmonogram ustalony' },
            severity: 'blocking',
          },
        ],
      },
      {
        id: 'scheduled',
        order: 7,
        status: InitiativeStatus.APPROVED,
        ...mk(InitiativeStatus.APPROVED),
        gateKey: 'START',
        approverLabel: { en: 'PMO', pl: 'PMO' },
        requiredRoles: getRoles('START'),
        requirements: [
          {
            key: 'timeline',
            label: { en: 'Timeline set', pl: 'Harmonogram ustalony' },
            severity: 'warning',
          },
        ],
      },
      {
        id: 'executing',
        order: 8,
        status: InitiativeStatus.IN_EXECUTION,
        ...mk(InitiativeStatus.IN_EXECUTION),
        gateKey: 'COMPLETE',
        approverLabel: { en: 'PMO / owner', pl: 'PMO / właściciel' },
        requiredRoles: getRoles('COMPLETE'),
        requirements: [
          {
            key: 'all_tasks_done',
            label: { en: 'All tasks done', pl: 'Wszystkie zadania ukończone' },
            severity: 'blocking',
          },
        ],
      },
      {
        id: 'blocked',
        order: 9,
        status: InitiativeStatus.IN_EXECUTION,
        ...mk(InitiativeStatus.IN_EXECUTION),
        gateKey: 'UNBLOCK',
        approverLabel: { en: 'Sponsor / committee', pl: 'Sponsor / komitet' },
        requiredRoles: getRoles('UNBLOCK'),
        requirements: [],
      },
      {
        id: 'done',
        order: 10,
        status: InitiativeStatus.CLOSED,
        ...mk(InitiativeStatus.CLOSED),
        gateKey: 'START_TRACKING',
        approverLabel: { en: 'Business owner', pl: 'Właściciel biznesowy' },
        requiredRoles: getRoles('START_TRACKING'),
        requirements: [],
      },
      {
        id: 'tracking',
        order: 11,
        status: InitiativeStatus.CLOSED,
        ...mk(InitiativeStatus.CLOSED),
        gateKey: 'ARCHIVE',
        approverLabel: { en: 'PMO', pl: 'PMO' },
        requiredRoles: [],
        requirements: [],
      },
      {
        id: 'cancelled',
        order: 12,
        status: InitiativeStatus.REJECTED,
        ...mk(InitiativeStatus.REJECTED),
        gateKey: 'ARCHIVE',
        approverLabel: { en: 'PMO', pl: 'PMO' },
        requiredRoles: [],
        requirements: [],
      },
      {
        id: 'archived',
        order: 13,
        status: InitiativeStatus.CLOSED,
        ...mk(InitiativeStatus.CLOSED),
        gateKey: null,
        approverLabel: null,
        requiredRoles: [],
        requirements: [],
      },
    ];

    const indexByStatus = new Map(lifecycle.map((s, idx) => [s, idx]));
    return defs
      .filter((d) => indexByStatus.has(d.status))
      .sort((a, b) => (indexByStatus.get(a.status) ?? 0) - (indexByStatus.get(b.status) ?? 0))
      .map((d, idx) => ({ ...d, order: idx + 1 }));
    // ★ 2026-08-30: `t` w zależnościach — etykiety i opisy etapów idą teraz przez
    // klucze tłumaczeń, więc memo musi się przeliczyć po zmianie języka.
  }, [lifecycle, t]);

  // ── Decision lookup ─────────────────────────────────────────────────────

  const decisionByGate = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of decisions || []) {
      const type = String(d.type || '');
      if (!type) continue;
      if (!map.has(type)) map.set(type, d);
      const prev = map.get(type);
      const prevIsPending = normalizeDecisionStatus(prev?.status) === 'PENDING';
      const currIsPending = normalizeDecisionStatus(d?.status) === 'PENDING';
      if (!prevIsPending && currIsPending) map.set(type, d);
    }
    return map;
  }, [decisions]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleToggleExpand = useCallback((stageId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  const requestGateDecision = async (gateKey: GateKey, stage: LifecycleGateStage) => {
    const gateLabel = isPolish ? GATE_UI[gateKey].actionLabel.pl : GATE_UI[gateKey].actionLabel.en;
    if (decisionByGate.get(gateKey)) return;

    const draftAssigneeId = assigneeDraft[gateKey];
    // Try to find an assigned approver from gate roles
    const gateApprovers = getApproversForGate(gateKey);
    const fallbackAssigneeId = gateApprovers[0]?.userId || ownerId || sponsorId;
    const deciderId = draftAssigneeId || fallbackAssigneeId;
    if (!deciderId) {
      toast.error(t('initiatives.initiativeGatesWorkflowTable.assignApproverFirst'));
      return;
    }

    const reqs: GateRequirement[] = stage.requirements.map((r) => ({
      key: r.key,
      label: isPolish ? r.label.pl : r.label.en,
      severity: r.severity,
      pass: checkRequirement(r.key),
    }));
    if (reqs.some((r) => r.severity === 'blocking' && !r.pass)) {
      toast.error(t('initiatives.initiativeGatesWorkflowTable.blockingRequirementsMissing'));
      return;
    }

    setRequestBusyGate(gateKey);
    try {
      const dueDate =
        toIsoFromDateOnly(dueDateDraft[gateKey]) ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const note = String(noteDraft[gateKey] || '').trim();
      await Api.post('/decisions', {
        title: `${gateKey} - ${initiative?.name || initiativeId}`,
        description: note || undefined,
        type: gateKey,
        decisionType: gateKey,
        relatedObjectId: initiativeId,
        relatedObjectType: 'initiative',
        initiativeId,
        status: 'PENDING',
        deciderId,
        decisionOwnerId: deciderId,
        dueDate,
      });
      toast.success(t('initiatives.initiativeGatesWorkflowTable.requested', { label: gateLabel }));
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.initiativeGatesWorkflowTable.failed'));
    } finally {
      setRequestBusyGate(null);
    }
  };

  const handleSaveGateRoles = async (newRoles: Array<{ gateRole: string; userId: string }>) => {
    setSavingRoles(true);
    try {
      // Merge with existing explicit roles
      const existingExplicit = (gateRoles || [])
        .filter((r) => r.source === 'explicit')
        .map((r) => ({ gateRole: r.gateRole, userId: r.userId }));

      // Remove duplicates and merge
      const keySet = new Set(newRoles.map((r) => `${r.gateRole}::${r.userId}`));
      const merged = [
        ...newRoles,
        ...existingExplicit.filter((r) => !keySet.has(`${r.gateRole}::${r.userId}`)),
      ];

      await Api.put(`/initiatives/${initiativeId}/gate-roles`, { roles: merged });
      toast.success(t('initiatives.initiativeGatesWorkflowTable.gateRolesSaved'));
      await fetchAll();
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.initiativeGatesWorkflowTable.failedToSaveRoles'));
    } finally {
      setSavingRoles(false);
    }
  };

  const currentIdx = lifecycle.indexOf(currentStatus);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl overflow-hidden">
      <table
        /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full table-fixed"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-navy-800">
          <tr className="border-b border-slate-200/40 dark:border-navy-700/40">
            <th className="w-[48px] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              #
            </th>
            <th className="w-[20%] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('initiatives.initiativeGatesWorkflowTable.stage')}
            </th>
            <th className="w-[18%] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('initiatives.initiativeGatesWorkflowTable.gateDecision')}
            </th>
            <th className="w-[18%] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('initiatives.initiativeGatesWorkflowTable.approver')}
            </th>
            <th className="w-[12%] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('initiatives.initiativeGatesWorkflowTable.readiness')}
            </th>
            <th className="w-[12%] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Status
            </th>
            <th className="w-[36px] px-1 py-2" />
          </tr>
        </thead>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <tbody className="divide-y divide-slate-200/30 dark:divide-navy-700/30">
          <AnimatePresence>
            {stages.map((stage) => {
              const stageIdx = lifecycle.indexOf(stage.status);
              const isCurrent = stage.status === currentStatus;
              const isCompleted = stageIdx >= 0 && currentIdx >= 0 ? stageIdx < currentIdx : false;
              const isFuture = !isCurrent && !isCompleted;

              const gateKey = stage.gateKey;
              const gateUi = gateKey ? GATE_UI[gateKey] : null;
              const GateIcon = gateUi?.icon || FileText;

              const decision = gateKey ? decisionByGate.get(gateKey) : null;
              const decisionStatus: GateDecisionStatus = gateKey
                ? decision
                  ? normalizeDecisionStatus(decision.status)
                  : 'NOT_STARTED'
                : 'NOT_STARTED';
              const statusUi = STATUS_UI[decisionStatus];
              const StatusIcon = statusUi.icon;

              const requirements: GateRequirement[] = stage.requirements.map((r) => ({
                key: r.key,
                label: isPolish ? r.label.pl : r.label.en,
                severity: r.severity,
                pass: checkRequirement(r.key),
              }));

              const hasBlocking = requirements.some((r) => r.severity === 'blocking' && !r.pass);
              const hasWarnings = requirements.some((r) => r.severity === 'warning' && !r.pass);
              const canTakeAction = isCurrent && !!gateKey && !hasBlocking && !isMutating;

              const requestedAt =
                (decision as any)?.createdAt ||
                (decision as any)?.created_at ||
                (decision as any)?.requestedAt ||
                (decision as any)?.requested_at;
              const daysWaiting = decisionStatus === 'PENDING' ? getDaysWaiting(requestedAt) : 0;

              // ── Approver: show real assigned users from gate roles ────
              const gateApprovers = gateKey ? getApproversForGate(gateKey) : [];
              const approverNames = gateApprovers.map((a) => getUserDisplayName(a));
              const hasAssignedApprover = gateApprovers.length > 0;

              // Fallback role label if no users assigned yet
              const roleLabel = stage.approverLabel
                ? isPolish
                  ? stage.approverLabel.pl
                  : stage.approverLabel.en
                : null;

              // Status history for completed gates
              const historyEntry =
                isCompleted && gateKey
                  ? getHistoryForTransition(
                      stage.status,
                      stages.find((s) => s.order === stage.order + 1)?.status || ''
                    )
                  : null;

              // Row actions
              const rowActions: RowAction[] = [
                {
                  id: `edit-${stage.id}`,
                  label: t('initiatives.initiativeGatesWorkflowTable.edit'),
                  icon: Edit3,
                  onClick: () => {
                    setEditingStageId((prev) => (prev === stage.id ? null : stage.id));
                    // Pre-fill role assignment drafts
                    if (gateKey) {
                      const newDrafts: Record<string, string> = {};
                      for (const role of stage.requiredRoles) {
                        const assigned = getAssignedUsersForRole(role);
                        if (assigned.length > 0) {
                          newDrafts[role] = assigned[0].userId;
                        }
                      }
                      setRoleAssignmentDrafts(newDrafts);

                      if (decision) {
                        const due = (decision as any)?.dueDate || (decision as any)?.due_date;
                        if (due) {
                          try {
                            const d = new Date(due);
                            setDueDateDraft((p) => ({
                              ...p,
                              [gateKey]: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                            }));
                          } catch {
                            /* ignore */
                          }
                        }
                        const note = (decision as any)?.description || (decision as any)?.notes;
                        if (note) setNoteDraft((p) => ({ ...p, [gateKey]: String(note) }));
                      }
                    }
                  },
                },
                {
                  id: `delete-${stage.id}`,
                  label: t('initiatives.initiativeGatesWorkflowTable.deleteDecision'),
                  icon: Trash2,
                  variant: 'danger',
                  divider: true,
                  disabled: !gateKey || !decision?.id,
                  onClick: async () => {
                    if (!gateKey || !decision?.id) return;
                    const ok = window.confirm(
                      t('initiatives.initiativeGatesWorkflowTable.deleteLinkedDecision')
                    );
                    if (!ok) return;
                    try {
                      await Api.delete(`/decisions/${decision.id}`);
                      toast.success(t('initiatives.initiativeGatesWorkflowTable.deleted'));
                      await fetchAll();
                    } catch (e: any) {
                      toast.error(
                        e?.message || t('initiatives.initiativeGatesWorkflowTable.error')
                      );
                    }
                  },
                },
              ];

              const gateIsActive = isCompleted || isCurrent;

              return (
                <React.Fragment key={stage.id}>
                  {/* ── Main row ─────────────────────────────────────── */}
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleToggleExpand(stage.id)}
                    className={`
                      group cursor-pointer transition-colors duration-150
                      ${isCurrent ? 'bg-slate-50/60 dark:bg-white/[0.03]' : ''}
                      ${hasBlocking && isCurrent ? 'bg-danger-500/[0.04] dark:bg-danger-500/[0.06]' : ''}
                      hover:bg-slate-50/80 dark:hover:bg-white/[0.02]
                    `}
                  >
                    {/* ── # ────────────────────────────────────────── */}
                    <td className="px-3 py-2">
                      <div
                        className={`
                          w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                          ${
                            isCompleted
                              ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isCurrent
                                ? hasBlocking
                                  ? 'bg-danger-100 dark:bg-danger-500/15 text-danger-600 dark:text-danger-400 ring-1 ring-danger-500/30'
                                  : 'bg-navy-900 text-white'
                                : 'bg-slate-200/80 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                          }
                        `}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={14} />
                        ) : hasBlocking && isCurrent ? (
                          <Lock size={12} />
                        ) : (
                          stage.order
                        )}
                      </div>
                    </td>

                    {/* ── Stage ─────────────────────────────────────── */}
                    <td className="px-3 py-2 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-medium truncate ${
                                isCurrent
                                  ? 'text-c-focus'
                                  : isCompleted
                                    ? 'text-slate-600 dark:text-slate-400'
                                    : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-navy-900 text-white uppercase tracking-wider">
                                {t('initiatives.initiativeGatesWorkflowTable.now')}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-[11px] truncate mt-0.5 ${
                              isCompleted
                                ? 'text-slate-500 dark:text-slate-500'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {stage.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* ── Gate Decision ─────────────────────────────── */}
                    <td className="px-3 py-2">
                      {gateKey && gateUi ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`
                              inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium truncate max-w-full
                              ${
                                gateIsActive
                                  ? `${gateUi.bgColor} ${gateUi.color}`
                                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                              }
                            `}
                            title={isPolish ? gateUi.actionLabel.pl : gateUi.actionLabel.en}
                          >
                            <GateIcon size={13} className="flex-shrink-0" />
                            <span className="truncate">
                              {isPolish ? gateUi.actionLabel.pl : gateUi.actionLabel.en}
                            </span>
                          </div>
                          {/* Inline CTA for current gate */}
                          {decisionStatus === 'NOT_STARTED' && canTakeAction && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                requestGateDecision(gateKey, stage);
                              }}
                              disabled={requestBusyGate === gateKey || isMutating}
                              className="flex-shrink-0 px-2 py-1 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-40 text-white dark:text-navy-950 text-[10px] font-semibold transition-colors"
                            >
                              {requestBusyGate === gateKey ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Send size={11} />
                              )}
                            </button>
                          )}
                          {decisionStatus === 'PENDING' && decision?.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDecision?.(String(decision.id));
                              }}
                              className="flex-shrink-0 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              {t('initiatives.initiativeGatesWorkflowTable.open')}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* ── Approver (real users + role fallback) ──────── */}
                    <td className="px-3 py-2">
                      {hasAssignedApprover ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`text-xs truncate ${
                              isFuture
                                ? 'text-slate-500 dark:text-slate-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {approverNames.slice(0, 2).join(', ')}
                            {approverNames.length > 2 && ` +${approverNames.length - 2}`}
                          </span>
                        </div>
                      ) : roleLabel ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className={`text-xs truncate italic ${
                              isCurrent
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-600 dark:text-slate-500'
                            }`}
                          >
                            {roleLabel}
                          </span>
                          {isCurrent && (
                            <span
                              className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
                              title={t('initiatives.initiativeGatesWorkflowTable.notAssigned')}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* ── Readiness ─────────────────────────────── */}
                    <td className="px-3 py-2">
                      {requirements.length > 0 ? (
                        hasBlocking ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger-600 dark:text-danger-400">
                            <X size={10} />
                            {
                              requirements.filter((r) => r.severity === 'blocking' && !r.pass)
                                .length
                            }{' '}
                            {t('initiatives.initiativeGatesWorkflowTable.block')}
                          </span>
                        ) : hasWarnings ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={10} />
                            {
                              requirements.filter((r) => r.severity === 'warning' && !r.pass).length
                            }{' '}
                            {t('initiatives.initiativeGatesWorkflowTable.warn')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={10} />
                            OK
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* ── Status ────────────────────────────────────── */}
                    <td className="px-3 py-2">
                      {gateKey ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`
                              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                              ${statusUi.bgColor} ${statusUi.color}
                            `}
                          >
                            <StatusIcon size={10} />
                            {isPolish ? statusUi.label.pl : statusUi.label.en}
                          </span>
                          {decisionStatus === 'PENDING' && daysWaiting > 0 && (
                            <span className="text-[10px] text-slate-600 dark:text-slate-500">
                              {daysWaiting}d
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* ── Actions ⋮ ─────────────────────────────────── */}
                    <td className="px-1 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        // #40 — pure-wiring bridge onto the sectional kebab contract;
                        // filter replicates legacy flat-menu semantics (zero visible change).
                        sections={[
                          { id: 'legacy', actions: rowActions.filter((a) => !a.disabled) },
                        ]}
                        iconVariant="vertical"
                      />
                    </td>
                  </motion.tr>

                  {/* ── Expanded detail ─────────────────────────────── */}
                  <AnimatePresence>
                    {expandedRows.has(stage.id) && (
                      <motion.tr
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <td colSpan={7} className="px-4 pb-3 pt-1">
                          <div className="ml-10 space-y-2">
                            {/* Requirements */}
                            {requirements.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {requirements.map((req) => (
                                  <div
                                    key={req.key}
                                    className={`
                                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                                      ${
                                        req.pass
                                          ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                          : req.severity === 'blocking'
                                            ? 'bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-400'
                                            : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
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
                                    {req.label}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Gate approvers detail */}
                            {gateKey && stage.requiredRoles.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {stage.requiredRoles.map((role) => {
                                  const assignedUsers = getAssignedUsersForRole(role);
                                  const roleName = isPolish
                                    ? ROLE_LABELS[role]?.pl || role
                                    : ROLE_LABELS[role]?.en || role;
                                  return (
                                    <div
                                      key={role}
                                      className={`
                                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                                      ${
                                        assignedUsers.length > 0
                                          ? 'bg-c-info/10 dark:bg-c-info/20 text-c-info'
                                          : 'bg-slate-100 dark:bg-slate-500/15 text-slate-500 dark:text-slate-400'
                                      }
                                    `}
                                    >
                                      {assignedUsers.length > 0 ? (
                                        <>
                                          <CheckCircle2 size={11} />
                                          {roleName}:{' '}
                                          {assignedUsers
                                            .map((u) => getUserDisplayName(u))
                                            .join(', ')}
                                        </>
                                      ) : (
                                        <>
                                          <UserPlus size={11} />
                                          {roleName}:{' '}
                                          {t(
                                            'initiatives.initiativeGatesWorkflowTable.notAssignedLower'
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Audit trail for completed gates */}
                            {isCompleted && historyEntry && (
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <History size={11} />
                                <span>
                                  {historyEntry.changedByFirstName
                                    ? `${historyEntry.changedByFirstName} ${historyEntry.changedByLastName || ''}`
                                    : historyEntry.changedByEmail || 'System'}
                                  {' · '}
                                  {new Date(historyEntry.createdAt).toLocaleDateString(
                                    isPolish ? 'pl-PL' : 'en-US'
                                  )}
                                  {historyEntry.reason && (
                                    <span className="italic"> — {historyEntry.reason}</span>
                                  )}
                                </span>
                              </div>
                            )}

                            {/* Open decision link */}
                            {gateKey && decision && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDecision?.(String(decision.id));
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-c-info bg-c-info/10 dark:bg-c-info/20 hover:bg-c-info/20 dark:hover:bg-c-info/30 transition-colors font-medium"
                              >
                                {t('initiatives.initiativeGatesWorkflowTable.openDecision')} →
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>

      {/* ── Edit Gate Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {editingStageId &&
          (() => {
            const editStage = stages.find((s) => s.id === editingStageId);
            const editGateKey = editStage?.gateKey;
            if (!editStage || !editGateKey) return null;

            const editDecision = decisionByGate.get(editGateKey);
            const editGateUi = GATE_UI[editGateKey];
            const EditGateIcon = editGateUi?.icon || FileText;
            const editRequiredRoles = editStage.requiredRoles;

            return (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                key="gate-edit-modal"
              >
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setEditingStageId(null)}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 dark:border-navy-700/60"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${editGateUi.bgColor}`}>
                        <EditGateIcon size={18} className={editGateUi.color} />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">
                          {t('initiatives.initiativeGatesWorkflowTable.editGate')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {editStage.label} —{' '}
                          {isPolish ? editGateUi.actionLabel.pl : editGateUi.actionLabel.en}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setEditingStageId(null)}
                      className="p-2 rounded-xl text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Gate Role Assignments */}
                    {editRequiredRoles.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <UserPlus size={14} className="text-slate-500 dark:text-slate-400" />
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            {t('initiatives.initiativeGatesWorkflowTable.gateRoles')}
                          </label>
                        </div>
                        <div className="space-y-2">
                          {editRequiredRoles.map((role) => {
                            const roleName = isPolish
                              ? ROLE_LABELS[role]?.pl || role
                              : ROLE_LABELS[role]?.en || role;
                            const currentAssigned = getAssignedUsersForRole(role);
                            return (
                              <div
                                key={role}
                                className="grid grid-cols-[140px_1fr] gap-2 items-center"
                              >
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                                  {roleName}
                                </span>
                                <select
                                  value={
                                    roleAssignmentDrafts[role] || currentAssigned[0]?.userId || ''
                                  }
                                  onChange={(e) =>
                                    setRoleAssignmentDrafts((prev) => ({
                                      ...prev,
                                      [role]: e.target.value,
                                    }))
                                  }
                                  className="w-full px-3 py-1.5 rounded-xl text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus transition-all"
                                >
                                  <option value="">
                                    {t('initiatives.initiativeGatesWorkflowTable.notAssignedDash')}
                                  </option>
                                  {users.map((u) => {
                                    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
                                    return (
                                      <option key={u.id} value={u.id}>
                                        {full || u.email || u.id}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Due date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('initiatives.initiativeGatesWorkflowTable.decisionDeadline')}
                      </label>
                      <input
                        type="date"
                        value={dueDateDraft[editGateKey] || ''}
                        onChange={(e) =>
                          setDueDateDraft((prev) => ({ ...prev, [editGateKey]: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus transition-all"
                      />
                    </div>

                    {/* Note */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t('initiatives.initiativeGatesWorkflowTable.note')}
                      </label>
                      <textarea
                        value={noteDraft[editGateKey] || ''}
                        onChange={(e) =>
                          setNoteDraft((prev) => ({ ...prev, [editGateKey]: e.target.value }))
                        }
                        rows={3}
                        placeholder={t('initiatives.initiativeGatesWorkflowTable.addGateContext')}
                        className="w-full px-3 py-2 rounded-xl text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus transition-all resize-none"
                      />
                    </div>

                    {/* Requirements summary */}
                    {editStage.requirements.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {t('initiatives.initiativeGatesWorkflowTable.requirements')}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {editStage.requirements.map((req) => {
                            const pass = checkRequirement(req.key);
                            return (
                              <span
                                key={req.key}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium ${
                                  pass
                                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : req.severity === 'blocking'
                                      ? 'bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-400'
                                      : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                }`}
                              >
                                {pass ? (
                                  <CheckCircle2 size={10} />
                                ) : req.severity === 'blocking' ? (
                                  <X size={10} />
                                ) : (
                                  <AlertTriangle size={10} />
                                )}
                                {isPolish ? req.label.pl : req.label.en}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-900/50">
                    <button
                      onClick={() => setEditingStageId(null)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    >
                      {t('initiatives.initiativeGatesWorkflowTable.cancel')}
                    </button>
                    <div className="flex items-center gap-2">
                      {editDecision?.id && (
                        <button
                          onClick={() => {
                            onOpenDecision?.(String(editDecision.id));
                            setEditingStageId(null);
                          }}
                          className="px-4 py-2 rounded-xl text-sm font-medium text-c-info hover:bg-c-info/10 dark:hover:bg-c-info/20 transition-colors"
                        >
                          {t('initiatives.initiativeGatesWorkflowTable.openDecision')}
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!editGateKey) return;

                          // 1. Save gate role assignments
                          const newRoleAssignments = Object.entries(roleAssignmentDrafts)
                            .filter(([, userId]) => !!userId)
                            .map(([gateRole, userId]) => ({ gateRole, userId }));

                          if (newRoleAssignments.length > 0) {
                            await handleSaveGateRoles(newRoleAssignments);
                          }

                          // 2. Save decision if exists
                          if (editDecision?.id) {
                            setSavingEdit(true);
                            try {
                              const deciderFromRole = newRoleAssignments[0]?.userId;
                              await Api.put(`/decisions/${editDecision.id}`, {
                                decisionOwnerId:
                                  deciderFromRole || assigneeDraft[editGateKey] || undefined,
                                dueDate: toIsoFromDateOnly(dueDateDraft[editGateKey]),
                                description:
                                  String(noteDraft[editGateKey] || '').trim() || undefined,
                                title: `${editGateKey} — ${initiative?.name || initiativeId}`,
                              });
                              toast.success(t('initiatives.initiativeGatesWorkflowTable.saved'));
                            } catch (e: any) {
                              toast.error(
                                e?.message || t('initiatives.initiativeGatesWorkflowTable.error')
                              );
                            } finally {
                              setSavingEdit(false);
                            }
                          } else if (newRoleAssignments.length === 0) {
                            toast.success(t('initiatives.initiativeGatesWorkflowTable.draftSaved'));
                          }

                          setEditingStageId(null);
                          await fetchAll();
                        }}
                        disabled={savingEdit || savingRoles}
                        className="px-5 py-2 rounded-xl bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-40 text-white dark:text-navy-950 text-sm font-semibold transition-colors"
                      >
                        {savingEdit || savingRoles ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          t('initiatives.initiativeGatesWorkflowTable.save')
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })()}
      </AnimatePresence>
    </div>
  );
};

export default InitiativeGatesWorkflowTable;
