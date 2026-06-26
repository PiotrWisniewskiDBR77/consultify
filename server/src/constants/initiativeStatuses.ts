/**
 * Initiative Statuses - Central Source of Truth (Canonical)
 *
 * This file defines all initiative statuses, their transitions, gate decisions,
 * role permissions, module mappings, and visibility rules for the entire system.
 *
 * Documentation: wdrozenia/standards/03-STATUS-WORKFLOW.md
 *
 * Lifecycle Flow:
 * DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING
 *                                                        ↓
 *                                                    BLOCKED
 *
 * Status-Module Visibility:
 * | Module          | Visible Statuses                                    |
 * |-----------------|-----------------------------------------------------|
 * | Tools           | DRAFT (own)                                         |
 * | Assessment      | DRAFT (own)                                         |
 * | Initiatives     | REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED     |
 * | Execution       | SCHEDULED, EXECUTING, BLOCKED, DONE                 |
 * | Benefits        | TRACKING                                            |
 *
 * @module constants/initiativeStatuses
 */

// ============================================
// INITIATIVE STATUS ENUM (11 statuses)
// ============================================

/**
 * Initiative Status Enum - Canonical Status Values
 * Used across the entire application (frontend and backend)
 */
export const InitiativeStatus = {
  // Source modules (Tools/Assessment) - Draft phase
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',

  // Initiative Management Module - Review & Planning phase
  REVIEW: 'REVIEW',
  PROMOTED: 'PROMOTED',
  PLANNING: 'PLANNING',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',

  // Execution Module - Active work
  EXECUTING: 'EXECUTING',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',

  // Benefits Module - Tracking phase
  TRACKING: 'TRACKING',

  // Terminal State
  CANCELLED: 'CANCELLED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type InitiativeStatusType = (typeof InitiativeStatus)[keyof typeof InitiativeStatus];

// ============================================
// ROLE DEFINITIONS
// ============================================

/**
 * Role identifiers for gate permissions
 */
export const Role = {
  ADMIN: 'ADMIN',
  CONSULTANT: 'CONSULTANT',
  PROJECT_MANAGER: 'PROJECT_MANAGER', // NEW: Can review initiatives from Tools/Assessment
  PROJECT_LEAD: 'PROJECT_LEAD', // NEW: Can review initiatives from Tools/Assessment
  INITIATIVE_OWNER: 'INITIATIVE_OWNER',
  PROJECT_SPONSOR: 'PROJECT_SPONSOR',
  PMO: 'PMO',
  STEERING_COMMITTEE: 'STEERING_COMMITTEE',
  PORTFOLIO_OWNER: 'PORTFOLIO_OWNER',
  TEAM_MEMBER: 'TEAM_MEMBER',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

// ============================================
// GATE DEFINITIONS
// ============================================

/**
 * Gate decision types for status transitions
 */
export const GateType = {
  // FAZA 1: Tools/Assessment gates (NEW)
  SUBMIT_FOR_REVIEW: 'SUBMIT_FOR_REVIEW', // DRAFT → PENDING_REVIEW (Consultant)
  SEND_BACK: 'SEND_BACK', // PENDING_REVIEW → DRAFT (PM/Lead)
  APPROVE_TO_INITIATIVE: 'APPROVE_TO_INITIATIVE', // PENDING_REVIEW → REVIEW (PM/Lead)

  // FAZA 2-4: Existing gates
  ACCEPT: 'ACCEPT',
  REJECT: 'REJECT',
  START_PLANNING: 'START_PLANNING',
  APPROVE: 'APPROVE',
  SCHEDULE: 'SCHEDULE',
  START: 'START',
  BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK',
  COMPLETE: 'COMPLETE',
  START_TRACKING: 'START_TRACKING',
  CANCEL: 'CANCEL',
} as const;

export type GateTypeValue = (typeof GateType)[keyof typeof GateType];

/**
 * Gate permissions - which roles can execute which gates
 * Key rule: CONSULTANT can only execute SUBMIT_FOR_REVIEW (their own work)
 */
export const GATE_PERMISSIONS: Record<GateTypeValue, RoleType[]> = {
  // FAZA 1: Tools/Assessment gates
  [GateType.SUBMIT_FOR_REVIEW]: [Role.CONSULTANT, Role.INITIATIVE_OWNER], // Author submits own work
  [GateType.SEND_BACK]: [Role.PROJECT_MANAGER, Role.PROJECT_LEAD, Role.PMO],
  [GateType.APPROVE_TO_INITIATIVE]: [Role.PROJECT_MANAGER, Role.PROJECT_LEAD, Role.PMO],

  // FAZA 2: Initiatives gates
  [GateType.ACCEPT]: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE],
  [GateType.REJECT]: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE],
  [GateType.START_PLANNING]: [Role.PMO],
  [GateType.APPROVE]: [Role.STEERING_COMMITTEE],
  [GateType.SCHEDULE]: [Role.PMO],

  // FAZA 3: Execution gates
  [GateType.START]: [Role.PMO],
  [GateType.BLOCK]: [Role.INITIATIVE_OWNER, Role.PMO],
  [GateType.UNBLOCK]: [Role.PROJECT_SPONSOR, Role.STEERING_COMMITTEE],
  [GateType.COMPLETE]: [Role.INITIATIVE_OWNER, Role.PMO],

  // FAZA 4: Benefits gates
  [GateType.START_TRACKING]: [Role.BUSINESS_OWNER],

  // Universal
  [GateType.CANCEL]: [Role.PMO, Role.STEERING_COMMITTEE],
};

/**
 * Gate to status transition mapping
 */
export const GATE_TRANSITIONS: Record<
  GateTypeValue,
  { from: InitiativeStatusType[]; to: InitiativeStatusType }
> = {
  // FAZA 1: Tools/Assessment transitions
  [GateType.SUBMIT_FOR_REVIEW]: {
    from: [InitiativeStatus.DRAFT],
    to: InitiativeStatus.PENDING_REVIEW,
  },
  [GateType.SEND_BACK]: { from: [InitiativeStatus.PENDING_REVIEW], to: InitiativeStatus.DRAFT },
  [GateType.APPROVE_TO_INITIATIVE]: {
    from: [InitiativeStatus.PENDING_REVIEW],
    to: InitiativeStatus.REVIEW,
  },

  // FAZA 2: Initiatives transitions
  [GateType.ACCEPT]: { from: [InitiativeStatus.REVIEW], to: InitiativeStatus.PROMOTED },
  [GateType.REJECT]: { from: [InitiativeStatus.REVIEW], to: InitiativeStatus.DRAFT },
  [GateType.START_PLANNING]: { from: [InitiativeStatus.PROMOTED], to: InitiativeStatus.PLANNING },
  [GateType.APPROVE]: { from: [InitiativeStatus.PLANNING], to: InitiativeStatus.APPROVED },
  [GateType.SCHEDULE]: { from: [InitiativeStatus.APPROVED], to: InitiativeStatus.SCHEDULED },

  // FAZA 3: Execution transitions
  [GateType.START]: { from: [InitiativeStatus.SCHEDULED], to: InitiativeStatus.EXECUTING },
  [GateType.BLOCK]: { from: [InitiativeStatus.EXECUTING], to: InitiativeStatus.BLOCKED },
  [GateType.UNBLOCK]: { from: [InitiativeStatus.BLOCKED], to: InitiativeStatus.EXECUTING },
  [GateType.COMPLETE]: { from: [InitiativeStatus.EXECUTING], to: InitiativeStatus.DONE },

  // FAZA 4: Benefits transitions
  [GateType.START_TRACKING]: { from: [InitiativeStatus.DONE], to: InitiativeStatus.TRACKING },

  // Universal
  [GateType.CANCEL]: {
    from: [
      InitiativeStatus.DRAFT,
      InitiativeStatus.PENDING_REVIEW,
      InitiativeStatus.REVIEW,
      InitiativeStatus.PROMOTED,
      InitiativeStatus.PLANNING,
      InitiativeStatus.APPROVED,
      InitiativeStatus.SCHEDULED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
    ],
    to: InitiativeStatus.CANCELLED,
  },
};

// ============================================
// MODULE DEFINITIONS
// ============================================

/**
 * Module identifiers for routing
 */
export type ModuleId =
  | 'tools'
  | 'assessment'
  | 'initiatives'
  | 'execution'
  | 'benefits'
  | 'reporting';

/**
 * Module configuration interface
 */
export interface ModuleConfig {
  id: ModuleId;
  name: string;
  namePL: string;
  route: string;
  statuses: InitiativeStatusType[];
  color: string;
  description: string;
}

/**
 * Module definitions with their associated statuses
 */
export const MODULES: Record<ModuleId, ModuleConfig> = {
  tools: {
    id: 'tools',
    name: 'Tools',
    namePL: 'Narzędzia',
    route: '/tools',
    statuses: [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW], // UPDATED: includes PENDING_REVIEW
    color: 'slate',
    description: 'Discovery tools generating draft initiatives',
  },
  assessment: {
    id: 'assessment',
    name: 'Assessment',
    namePL: 'Ocena',
    route: '/assessment',
    statuses: [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW], // UPDATED: includes PENDING_REVIEW
    color: 'slate',
    description: 'Assessment module generating draft initiatives',
  },
  initiatives: {
    id: 'initiatives',
    name: 'Initiatives',
    namePL: 'Inicjatywy',
    // M13 SSOT reconciliation (2026-06-17): this `statuses` list is the NARROW
    // "planning-phase" set matching docs (INITIATIVE_STATUS_ROLE_CTA_MATRIX +
    // initiative.ts header). It is REFERENCE-ONLY on the server — no consumer in
    // server/src reads `getStatusesForModule('initiatives')` to filter the API
    // list. The RUNTIME source of truth for what the Initiatives module shows is
    // the FRONTEND `src/services/initiativeLifecycle.ts` MODULES.initiatives,
    // which deliberately lists ALL 13 statuses (D1.2 "complete visibility",
    // consumed at InitiativesHub.tsx:110). Do NOT "reconcile" the FE down to these
    // 5 — that would hide EXECUTING/BLOCKED/DONE/TRACKING/CANCELLED/ARCHIVED
    // initiatives from the hub (a regression). Keep this narrow list as the
    // documented phase-ownership reference only.
    route: '/initiatives',
    statuses: [
      InitiativeStatus.REVIEW,
      InitiativeStatus.PROMOTED,
      InitiativeStatus.PLANNING,
      InitiativeStatus.APPROVED,
      InitiativeStatus.SCHEDULED,
    ],
    color: 'purple',
    description: 'Initiative management and planning',
  },
  execution: {
    id: 'execution',
    name: 'Execution',
    namePL: 'Realizacja',
    route: '/execution',
    statuses: [
      InitiativeStatus.SCHEDULED,
      InitiativeStatus.EXECUTING,
      InitiativeStatus.BLOCKED,
      InitiativeStatus.DONE,
    ],
    color: 'cyan',
    description: 'Execution center for active initiatives',
  },
  benefits: {
    id: 'benefits',
    name: 'Benefits',
    namePL: 'Korzyści',
    route: '/benefits',
    statuses: [InitiativeStatus.TRACKING],
    color: 'teal',
    description: 'Benefits tracking for completed initiatives',
  },
  reporting: {
    id: 'reporting',
    name: 'Reporting',
    namePL: 'Raportowanie',
    route: '/reports',
    statuses: Object.values(InitiativeStatus), // All statuses visible (read-only)
    color: 'indigo',
    description: 'Management reporting across all statuses',
  },
};

// ============================================
// STATUS TRANSITIONS
// ============================================

/**
 * Valid status transitions map
 * Defines which statuses can transition to which other statuses
 */
export const VALID_TRANSITIONS: Record<InitiativeStatusType, InitiativeStatusType[]> = {
  // FAZA 1: Tools/Assessment
  [InitiativeStatus.DRAFT]: [InitiativeStatus.PENDING_REVIEW, InitiativeStatus.CANCELLED],
  [InitiativeStatus.PENDING_REVIEW]: [
    InitiativeStatus.REVIEW,
    InitiativeStatus.DRAFT,
    InitiativeStatus.CANCELLED,
  ],

  // FAZA 2: Initiatives
  [InitiativeStatus.REVIEW]: [
    InitiativeStatus.PROMOTED,
    InitiativeStatus.DRAFT,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.PROMOTED]: [InitiativeStatus.PLANNING, InitiativeStatus.CANCELLED],
  [InitiativeStatus.PLANNING]: [InitiativeStatus.APPROVED, InitiativeStatus.CANCELLED],
  [InitiativeStatus.APPROVED]: [InitiativeStatus.SCHEDULED, InitiativeStatus.CANCELLED],
  [InitiativeStatus.SCHEDULED]: [InitiativeStatus.EXECUTING, InitiativeStatus.CANCELLED],

  // FAZA 3: Execution
  [InitiativeStatus.EXECUTING]: [
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
    InitiativeStatus.CANCELLED,
  ],
  [InitiativeStatus.BLOCKED]: [InitiativeStatus.EXECUTING, InitiativeStatus.CANCELLED],
  [InitiativeStatus.DONE]: [InitiativeStatus.TRACKING],

  // FAZA 4: Benefits
  [InitiativeStatus.TRACKING]: [InitiativeStatus.ARCHIVED],

  // Terminal
  [InitiativeStatus.CANCELLED]: [InitiativeStatus.ARCHIVED],
  [InitiativeStatus.ARCHIVED]: [], // Terminal state
};

// ============================================
// STATUS METADATA
// ============================================

/**
 * Status metadata for UI display
 */
export interface StatusMeta {
  label: string;
  labelPL: string;
  color: string;
  bgColor: string;
  dotColor: string;
  description: string;
  descriptionPL: string;
  icon: string;
  order: number;
}

export const STATUS_METADATA: Record<InitiativeStatusType, StatusMeta> = {
  // FAZA 1: Tools/Assessment
  [InitiativeStatus.DRAFT]: {
    label: 'Draft',
    labelPL: 'Szkic',
    color: 'text-slate-500',
    bgColor: 'bg-slate-500/10',
    dotColor: 'bg-slate-400',
    description: 'Initial draft, author is working on it',
    descriptionPL: 'Początkowy szkic, autor nad nim pracuje',
    icon: 'FileText',
    order: 1,
  },
  [InitiativeStatus.PENDING_REVIEW]: {
    label: 'Pending Review',
    labelPL: 'Oczekuje na przegląd',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    dotColor: 'bg-orange-400',
    description: 'Awaiting PM/Lead review',
    descriptionPL: 'Oczekuje na przegląd PM/Lead',
    icon: 'Clock',
    order: 2,
  },

  // FAZA 2: Initiatives
  [InitiativeStatus.REVIEW]: {
    label: 'In Review',
    labelPL: 'W przeglądzie biznesowym',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    dotColor: 'bg-amber-400',
    description: 'Under business review (Go/No-Go)',
    descriptionPL: 'W przeglądzie biznesowym (Go/No-Go)',
    icon: 'Eye',
    order: 3,
  },
  [InitiativeStatus.PROMOTED]: {
    label: 'Promoted',
    labelPL: 'Promowana',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    dotColor: 'bg-blue-400',
    description: 'Accepted for planning',
    descriptionPL: 'Zaakceptowana do planowania',
    icon: 'TrendingUp',
    order: 4,
  },
  [InitiativeStatus.PLANNING]: {
    label: 'Planning',
    labelPL: 'Planowanie',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    dotColor: 'bg-indigo-400',
    description: 'Being planned and scoped',
    descriptionPL: 'W trakcie planowania',
    icon: 'ClipboardList',
    order: 5,
  },
  [InitiativeStatus.APPROVED]: {
    label: 'Approved',
    labelPL: 'Zatwierdzona',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    dotColor: 'bg-emerald-400',
    description: 'Approved, ready for scheduling',
    descriptionPL: 'Zatwierdzona, gotowa do zaplanowania',
    icon: 'CheckCircle',
    order: 6,
  },
  [InitiativeStatus.SCHEDULED]: {
    label: 'Scheduled',
    labelPL: 'Zaplanowana',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    dotColor: 'bg-purple-400',
    description: 'Scheduled in roadmap',
    descriptionPL: 'Zaplanowana w roadmapie',
    icon: 'Calendar',
    order: 7,
  },

  // FAZA 3: Execution
  [InitiativeStatus.EXECUTING]: {
    label: 'Executing',
    labelPL: 'W realizacji',
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    dotColor: 'bg-cyan-400',
    description: 'Currently being implemented',
    descriptionPL: 'W trakcie realizacji',
    icon: 'Play',
    order: 8,
  },
  [InitiativeStatus.BLOCKED]: {
    label: 'Blocked',
    labelPL: 'Zablokowana',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    dotColor: 'bg-red-400',
    description: 'Blocked, requires decision',
    descriptionPL: 'Zablokowana, wymaga decyzji',
    icon: 'AlertTriangle',
    order: 9,
  },
  [InitiativeStatus.DONE]: {
    label: 'Done',
    labelPL: 'Ukończona',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    dotColor: 'bg-green-400',
    description: 'Delivery completed',
    descriptionPL: 'Realizacja zakończona',
    icon: 'CheckCircle2',
    order: 10,
  },

  // FAZA 4: Benefits
  [InitiativeStatus.TRACKING]: {
    label: 'Tracking',
    labelPL: 'Śledzenie',
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/10',
    dotColor: 'bg-teal-400',
    description: 'Benefits tracking in progress',
    descriptionPL: 'Śledzenie korzyści w toku',
    icon: 'BarChart',
    order: 11,
  },

  // Terminal
  [InitiativeStatus.CANCELLED]: {
    label: 'Cancelled',
    labelPL: 'Anulowana',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    dotColor: 'bg-gray-400',
    description: 'Initiative was cancelled',
    descriptionPL: 'Inicjatywa została anulowana',
    icon: 'XCircle',
    order: 12,
  },
  [InitiativeStatus.ARCHIVED]: {
    label: 'Archived',
    labelPL: 'Zarchiwizowana',
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    dotColor: 'bg-slate-500',
    description: 'Archived for reference',
    descriptionPL: 'Zarchiwizowana do celów referencyjnych',
    icon: 'Archive',
    order: 13,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user role can execute a gate
 */
export function canExecuteGate(role: RoleType, gate: GateTypeValue): boolean {
  // Admin can technically do anything but should not execute business gates
  if (role === Role.ADMIN) {
    return true; // Technical override - should be logged
  }
  // Consultant can ONLY execute SUBMIT_FOR_REVIEW (their own work)
  if (role === Role.CONSULTANT) {
    return gate === GateType.SUBMIT_FOR_REVIEW;
  }
  return GATE_PERMISSIONS[gate]?.includes(role) ?? false;
}

/**
 * Get the gate required for a status transition
 */
export function getGateForTransition(
  from: InitiativeStatusType,
  to: InitiativeStatusType
): GateTypeValue | null {
  for (const [gate, config] of Object.entries(GATE_TRANSITIONS)) {
    if (config.from.includes(from) && config.to === to) {
      return gate as GateTypeValue;
    }
  }
  return null;
}

/**
 * Get the module for a given status
 */
export function getModuleForStatus(status: InitiativeStatusType): ModuleId {
  // Handle CANCELLED as historical in initiatives
  if (status === InitiativeStatus.CANCELLED || status === InitiativeStatus.ARCHIVED) {
    return 'initiatives';
  }

  for (const [moduleId, config] of Object.entries(MODULES)) {
    if (moduleId !== 'reporting' && config.statuses.includes(status)) {
      return moduleId as ModuleId;
    }
  }
  return 'initiatives'; // Default fallback
}

/**
 * Get the module configuration for a given status
 */
export function getModuleConfigForStatus(status: InitiativeStatusType): ModuleConfig {
  const moduleId = getModuleForStatus(status);
  return MODULES[moduleId];
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: InitiativeStatusType, to: InitiativeStatusType): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses from current status
 */
export function getValidNextStatuses(currentStatus: InitiativeStatusType): InitiativeStatusType[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if transitioning to a new status will change the module
 */
export function willChangeModule(from: InitiativeStatusType, to: InitiativeStatusType): boolean {
  return getModuleForStatus(from) !== getModuleForStatus(to);
}

/**
 * Get all statuses for a module
 */
export function getStatusesForModule(moduleId: ModuleId): InitiativeStatusType[] {
  return MODULES[moduleId]?.statuses || [];
}

/**
 * Check if a status belongs to a specific module
 */
export function isStatusInModule(status: InitiativeStatusType, moduleId: ModuleId): boolean {
  return MODULES[moduleId]?.statuses.includes(status) ?? false;
}

/**
 * Get the progress percentage through the lifecycle
 */
export function getLifecycleProgress(status: InitiativeStatusType): number {
  const progressMap: Record<InitiativeStatusType, number> = {
    // FAZA 1: Tools/Assessment (0-10%)
    [InitiativeStatus.DRAFT]: 5,
    [InitiativeStatus.PENDING_REVIEW]: 10,
    // FAZA 2: Initiatives (15-55%)
    [InitiativeStatus.REVIEW]: 15,
    [InitiativeStatus.PROMOTED]: 25,
    [InitiativeStatus.PLANNING]: 35,
    [InitiativeStatus.APPROVED]: 45,
    [InitiativeStatus.SCHEDULED]: 55,
    // FAZA 3: Execution (60-90%)
    [InitiativeStatus.EXECUTING]: 70,
    [InitiativeStatus.BLOCKED]: 65,
    [InitiativeStatus.DONE]: 90,
    // FAZA 4: Benefits (100%)
    [InitiativeStatus.TRACKING]: 100,
    // Terminal
    [InitiativeStatus.CANCELLED]: 0,
    [InitiativeStatus.ARCHIVED]: 100,
  };
  return progressMap[status] ?? 0;
}

/**
 * Check if an initiative is in a terminal state
 */
export function isTerminalStatus(status: InitiativeStatusType): boolean {
  return status === InitiativeStatus.CANCELLED || status === InitiativeStatus.ARCHIVED;
}

/**
 * Check if an initiative is active (not terminal)
 */
export function isActiveStatus(status: InitiativeStatusType): boolean {
  return !isTerminalStatus(status);
}

/**
 * USPOJNIENIE B3 — kanoniczne grupy statusów (jedno źródło prawdy zamiast
 * rozsianych literałów-tablic). Zmiana grupy w jednym miejscu odbija się wszędzie.
 *
 * SCHEDULED_ONWARD = inicjatywa weszła w realizację: od zaplanowania (SCHEDULED)
 * przez wykonanie (EXECUTING/BLOCKED/DONE) po śledzenie rezultatów (TRACKING).
 * Używane przez bramki gotowości (readiness/timeline/milestone) w gate-readiness
 * i portfolio-read — wcześniej zduplikowane jako literał w obu serwisach.
 */
export const SCHEDULED_ONWARD_STATUSES: InitiativeStatusType[] = [
  InitiativeStatus.SCHEDULED,
  InitiativeStatus.EXECUTING,
  InitiativeStatus.BLOCKED,
  InitiativeStatus.DONE,
  InitiativeStatus.TRACKING,
];

/** Czy status oznacza „inicjatywa w realizacji lub dalej" (od SCHEDULED w górę). */
export function isScheduledOnward(status: InitiativeStatusType | string): boolean {
  return (SCHEDULED_ONWARD_STATUSES as string[]).includes(String(status || '').toUpperCase());
}

/**
 * Check if an initiative needs attention (blocked, pending review, or in review)
 */
export function needsAttention(status: InitiativeStatusType): boolean {
  return (
    status === InitiativeStatus.BLOCKED ||
    status === InitiativeStatus.PENDING_REVIEW ||
    status === InitiativeStatus.REVIEW
  );
}

/**
 * Validate transition with context and return result
 */
export interface TransitionValidationContext {
  userRole: RoleType;
  blockedReason?: string;
  pendingTasks?: number;
  hasBlockingDecisions?: boolean;
  charterCompleteness?: number;
  hasRequiredArtefacts?: boolean;
  isScheduled?: boolean;
  escalationLevel?: 'none' | 'amber' | 'red';
}

export interface TransitionValidationResult {
  valid: boolean;
  reason?: string;
  requiredRoles?: RoleType[];
}

export function validateTransition(
  from: InitiativeStatusType,
  to: InitiativeStatusType,
  context: TransitionValidationContext
): TransitionValidationResult {
  // Check if transition is allowed
  if (!isValidTransition(from, to)) {
    return { valid: false, reason: `Cannot transition from ${from} to ${to}` };
  }

  // Get the gate for this transition
  const gate = getGateForTransition(from, to);
  if (gate) {
    // Check role permission
    if (!canExecuteGate(context.userRole, gate)) {
      return {
        valid: false,
        reason: `Role ${context.userRole} cannot execute gate ${gate}`,
        requiredRoles: GATE_PERMISSIONS[gate],
      };
    }
  }

  // BLOCKED status requires a reason
  if (to === InitiativeStatus.BLOCKED && !context.blockedReason) {
    return { valid: false, reason: 'Blocked status requires a reason' };
  }

  // DONE status validation
  if (to === InitiativeStatus.DONE) {
    if (context.pendingTasks && context.pendingTasks > 0) {
      return {
        valid: false,
        reason: `Cannot complete: ${context.pendingTasks} tasks still pending`,
      };
    }
    if (context.hasBlockingDecisions) {
      return { valid: false, reason: 'Cannot complete: Open blocking decisions exist' };
    }
  }

  // REVIEW → PROMOTED requires artefacts
  if (from === InitiativeStatus.REVIEW && to === InitiativeStatus.PROMOTED) {
    if (context.hasRequiredArtefacts === false) {
      return {
        valid: false,
        reason: 'Required artefacts missing: description, owner, scope, risk flags',
      };
    }
  }

  // APPROVED → SCHEDULED requires scheduling
  if (from === InitiativeStatus.APPROVED && to === InitiativeStatus.SCHEDULED) {
    if (!context.isScheduled) {
      return {
        valid: false,
        reason: 'Initiative must have dates assigned before scheduling',
      };
    }
  }

  // BLOCKED → EXECUTING (UNBLOCK) - escalated decisions go to Steering
  if (from === InitiativeStatus.BLOCKED && to === InitiativeStatus.EXECUTING) {
    if (context.escalationLevel === 'red' && context.userRole !== Role.STEERING_COMMITTEE) {
      return {
        valid: false,
        reason: 'Escalated (red) blocks require Steering Committee decision',
        requiredRoles: [Role.STEERING_COMMITTEE],
      };
    }
  }

  return { valid: true };
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: InitiativeStatusType, lang: 'en' | 'pl' = 'en'): string {
  const meta = STATUS_METADATA[status];
  return lang === 'pl' ? meta?.labelPL : meta?.label || status;
}

/**
 * Get the ordered list of statuses in the lifecycle
 */
export function getLifecycleOrder(): InitiativeStatusType[] {
  return [
    // FAZA 1: Tools/Assessment
    InitiativeStatus.DRAFT,
    InitiativeStatus.PENDING_REVIEW,
    // FAZA 2: Initiatives
    InitiativeStatus.REVIEW,
    InitiativeStatus.PROMOTED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.APPROVED,
    InitiativeStatus.SCHEDULED,
    // FAZA 3: Execution
    InitiativeStatus.EXECUTING,
    InitiativeStatus.DONE,
    // FAZA 4: Benefits
    InitiativeStatus.TRACKING,
    // Terminal
    InitiativeStatus.ARCHIVED,
  ];
}

// ============================================
// MODULE VISIBILITY HELPERS
// ============================================

/**
 * Get statuses visible in Tools module
 * Shows DRAFT and PENDING_REVIEW initiatives created by tools
 */
export function getToolsVisibleStatuses(): InitiativeStatusType[] {
  return [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW];
}

/**
 * Get statuses visible in Assessment module
 * Shows DRAFT and PENDING_REVIEW initiatives created by assessments
 */
export function getAssessmentVisibleStatuses(): InitiativeStatusType[] {
  return [InitiativeStatus.DRAFT, InitiativeStatus.PENDING_REVIEW];
}

/**
 * Get statuses visible in Initiatives module
 */
export function getInitiativesVisibleStatuses(): InitiativeStatusType[] {
  return [
    InitiativeStatus.REVIEW,
    InitiativeStatus.PROMOTED,
    InitiativeStatus.PLANNING,
    InitiativeStatus.APPROVED,
    InitiativeStatus.SCHEDULED,
    InitiativeStatus.CANCELLED,
  ];
}

/**
 * Get statuses visible in Execution module
 */
export function getExecutionVisibleStatuses(): InitiativeStatusType[] {
  return [
    InitiativeStatus.SCHEDULED,
    InitiativeStatus.EXECUTING,
    InitiativeStatus.BLOCKED,
    InitiativeStatus.DONE,
  ];
}

/**
 * Get statuses visible in Benefits module
 */
export function getBenefitsVisibleStatuses(): InitiativeStatusType[] {
  return [InitiativeStatus.TRACKING];
}

/**
 * Build SQL WHERE clause for status filtering by module
 */
export function buildStatusFilterSQL(
  moduleId: ModuleId,
  statusColumn: string = 'status'
): { clause: string; params: string[] } {
  let statuses: InitiativeStatusType[];

  switch (moduleId) {
    case 'tools':
      statuses = getToolsVisibleStatuses();
      break;
    case 'assessment':
      statuses = getAssessmentVisibleStatuses();
      break;
    case 'initiatives':
      statuses = getInitiativesVisibleStatuses();
      break;
    case 'execution':
      statuses = getExecutionVisibleStatuses();
      break;
    case 'benefits':
      statuses = getBenefitsVisibleStatuses();
      break;
    default:
      statuses = Object.values(InitiativeStatus);
  }

  const placeholders = statuses.map(() => '?').join(', ');
  return {
    clause: `UPPER(${statusColumn}) IN (${placeholders})`,
    params: statuses,
  };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  InitiativeStatus,
  Role,
  GateType,
  GATE_PERMISSIONS,
  GATE_TRANSITIONS,
  MODULES,
  VALID_TRANSITIONS,
  STATUS_METADATA,
  canExecuteGate,
  getGateForTransition,
  getModuleForStatus,
  getModuleConfigForStatus,
  isValidTransition,
  getValidNextStatuses,
  willChangeModule,
  getStatusesForModule,
  isStatusInModule,
  getLifecycleProgress,
  isTerminalStatus,
  isActiveStatus,
  needsAttention,
  validateTransition,
  getStatusLabel,
  getLifecycleOrder,
  getToolsVisibleStatuses,
  getAssessmentVisibleStatuses,
  getInitiativesVisibleStatuses,
  getExecutionVisibleStatuses,
  getBenefitsVisibleStatuses,
  buildStatusFilterSQL,
};
