/**
 * Initiative Section Library - Shared Types
 *
 * Types used across all initiative sections and the dynamic renderer.
 */

// ==========================================
// DATA TYPES
// ==========================================

export interface Decision {
  id: string;
  title: string;
  description?: string;
  /** Decision type / category from API (decisionType field) */
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'DEFERRED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decisionMakerId?: string;
  ownerName?: string;
  requestedByName?: string;
  dueDate?: string;
  createdAt?: string;
  isOverdue?: boolean;
  daysOverdue?: number;
  source?: 'manual' | 'ai';
}

export interface RaidItem {
  id: string;
  type: 'risk' | 'issue' | 'assumption' | 'dependency';
  title: string;
  description?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  owner?: string;
  mitigationPlan?: string;
}

export interface Watcher {
  id: string;
  userId: string;
  name?: string;
  email?: string;
}

export interface HistoryEvent {
  id: string;
  eventType: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
  payload?: any;
}

export interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  dueDate?: string;
  assigneeName?: string;
  assigneeId?: string;
  isMilestone?: boolean;
  milestoneDate?: string;
  description?: string;
  taskType?: string;
  estimatedHours?: number | null;
  source?: 'manual' | 'ai';
}

export interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

// ==========================================
// RESOURCE TYPES
// ==========================================

export interface ResourceItem {
  id: string;
  initiativeId?: string;
  userId?: string;
  name: string;
  role: string;
  allocationPercentage: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  source?: 'manual' | 'ai';
}

export interface BudgetItem {
  id: string;
  initiativeId?: string;
  category: string;
  costType: 'CAPEX' | 'OPEX';
  amount: number;
  currency: string;
  description?: string;
  source?: 'manual' | 'ai';
}

export interface ToolItem {
  id: string;
  initiativeId?: string;
  name: string;
  category: string;
  vendor?: string;
  licenseCost: number;
  costType?: 'CAPEX' | 'OPEX';
  licenseType: string;
  status: string;
  notes?: string;
  source?: 'manual' | 'ai';
}

export interface IntangibleAssetItem {
  id: string;
  initiativeId?: string;
  assetType: string; // 'license', 'training', 'certification', 'knowledge', 'ip', 'legal_right', 'other'
  name: string;
  provider?: string;
  cost: number;
  costType?: 'CAPEX' | 'OPEX';
  currency: string;
  validFrom?: string;
  validUntil?: string;
  status: string;
  beneficiaries?: string;
  notes?: string;
  source?: 'manual' | 'ai';
}

export interface PendingApproval {
  id: string;
  gateType: string;
  gateName: string;
  requiredRole: 'owner' | 'sponsor' | 'pmo' | 'committee';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  deciderId?: string;
  deciderName?: string;
  dueDate?: string;
}

// ==========================================
// GATE ROLES
// ==========================================

/**
 * Gate role assignment — maps a governance role to a user for this initiative.
 * Roles align with GATE_PERMISSIONS in server/src/constants/initiativeStatuses.ts.
 */
export interface GateRoleAssignment {
  id: string;
  initiativeId?: string;
  gateRole: string; // PMO, STEERING_COMMITTEE, INITIATIVE_OWNER, SPONSOR, etc.
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  assignedBy?: string;
  assignedAt?: string;
  source: 'explicit' | 'auto'; // 'auto' = derived from owner/sponsor fields
}

/**
 * Status history entry — gate audit trail.
 */
export interface StatusHistoryEntry {
  id: string;
  initiativeId: string;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
  changedByFirstName?: string;
  changedByLastName?: string;
  changedByEmail?: string;
  reason?: string;
  gateType?: string;
  createdAt: string;
}

/**
 * Gate readiness check result from the backend.
 */
export interface GateReadinessCheck {
  currentStatus: string;
  userRoles: string[];
  availableTransitions: Array<{
    targetStatus: string;
    gate: string | null;
    requiredRoles: string[];
    assignedApprovers: Array<{ gateRole: string; userId: string }>;
    canCurrentUserExecute: boolean;
    hasAssignedApprover: boolean;
  }>;
  capabilities?: {
    version: number;
    source: 'backend';
    topBar: {
      canEditPriority: boolean;
      canEditOwner: boolean;
      canEditTargetDate: boolean;
    };
    cards?: {
      canEditCards: boolean;
      reasonCode: string | null;
    };
    reasonCodes?: {
      topBar?: { priority?: string | null; owner?: string | null; targetDate?: string | null };
      cards?: { edit?: string | null };
      ai?: { use?: string | null };
    };
    ctaBar: {
      workflowActions: Array<{ targetStatus: string; gate: string | null }>;
      contextCreateActions: string[];
      canUseAi: boolean;
      aiAllowedSectionKeys?: string[];
    };
  };
  readiness: Array<{
    key: string;
    label: string;
    pass: boolean;
    severity: string;
  }>;
  allBlocking: boolean;
  allWarnings: boolean;
}

// ==========================================
// SECTION TYPE from API
// ==========================================

export interface SectionTypeInfo {
  id: string;
  key: string;
  name: string;
  namePl: string | null;
  description: string | null;
  descriptionPl: string | null;
  category: 'content' | 'control' | 'meta';
  columnPosition: 'left' | 'right';
  defaultOrder: number;
  icon: string | null;
  iconColor: string | null;
  iconBg: string | null;
  componentKey: string;
  isSystem: boolean;
  isActive: boolean;
}

// ==========================================
// SECTION COMPONENT PROPS
// ==========================================

/**
 * Standardized props interface for ALL initiative sections.
 * Each section receives the full context via the InitiativeContext,
 * but also gets these direct props for the dynamic renderer.
 */
export interface InitiativeSectionProps {
  /** The section type metadata */
  sectionType: SectionTypeInfo;
  /** Whether this section is expanded */
  expanded: boolean;
  /** Toggle section expand/collapse */
  onToggle: () => void;
  /** Section-specific config from the template */
  sectionConfig?: Record<string, any>;
  /** Whether the view is read-only */
  readonly?: boolean;
}

// ==========================================
// TIMELINE TYPES
// ==========================================

export type TimelineMode =
  | 'ESTIMATE'
  | 'PLANNING'
  | 'READY_TO_LOCK'
  | 'BASELINED'
  | 'CLOSED'
  | 'COMPLETED';

export interface TimelineMilestone {
  id: string;
  name: string;
  date: string; // Planned date
  actualDate?: string; // Actual completion date
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  description?: string;
  linkedTaskIds?: string[];
}

export interface TimelinePhase {
  id: string;
  name: string;
  namePl?: string;
  startDate: string;
  endDate: string;
  order: number;
  color?: string;
}

export type TimelineRowType =
  | 'start' // Initiative start anchor
  | 'task' // Work item with duration
  | 'milestone' // Point-in-time marker (no duration)
  | 'decision' // Go / No-Go / Escalate checkpoint
  | 'info_event' // Informational event (report, presentation, status update)
  | 'notification' // Cyclical communication notification rule
  | 'meeting' // Recurring meeting item
  | 'pause' // Planned pause in execution
  | 'escalation' // Escalation requiring higher-level attention
  | 'finish'; // Initiative end anchor

export type SchedulingMode = 'after_previous' | 'fixed_date';
export type DecisionOutcome = 'GO' | 'NO_GO' | 'ESCALATE' | null;
export type StartTriggerType = 'date' | 'event' | 'dependency';
export type EndSchedulingMode = 'from_duration' | 'manual_date' | 'from_successor';

/**
 * Unified row for the Timeline planning table / Gantt.
 * Merges tasks, milestones, decisions, events, and initiative start/finish
 * into a single chronologically ordered list.
 */
export interface TimelineRow {
  id: string;
  type: TimelineRowType;
  name: string;

  /** Visual hint — row is on the critical path (UI-only) */
  isCriticalPath?: boolean;

  // ── Time ──
  startDate: string | null;
  endDate: string | null;
  /** Manual duration in days — auto-computes endDate when set */
  durationDays?: number | null;
  /** Controls how end date is set */
  endSchedulingMode?: EndSchedulingMode;
  /** Optional successor row used as end trigger */
  successorId?: string | null;

  // ── Scheduling ──
  /** How this row's start date is determined */
  schedulingMode: SchedulingMode;
  /** High-level start trigger semantics for UI */
  startTriggerType?: StartTriggerType;
  startTriggerEvent?: string;
  /** ID of another TimelineRow this row depends on */
  dependsOnId?: string | null;
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF';

  // ── Assignment ──
  status?: string;
  assigneeId?: string;
  assigneeName?: string;

  // ── Budget / effort ──
  estimatedHours?: number | null;
  actualHours?: number | null;

  // ── Decision-specific ──
  decisionOutcome?: DecisionOutcome;
  /** If true, downstream rows won't start until outcome = GO */
  decisionBlocksNext?: boolean;

  // ── Info / Escalation-specific ──
  audience?: string;
  escalationLevel?: string;
  pauseReason?: string;
  infoAssetType?: 'external_link' | 'internal_report' | 'generated_presentation' | 'other';
  infoAssetLabel?: string;
  infoAssetUrl?: string;
  /** Placeholder binding until Reports module integration is ready */
  linkedReportPlaceholderId?: string;
  infoEventMode?: 'cyclical' | 'specific_date' | 'after_event';
  infoEventCadence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  infoEventReferenceEvent?: string;
  infoEventParticipantMode?: 'person' | 'group';
  infoEventParticipantUserId?: string;
  infoEventParticipantGroupKey?:
    | 'project_team'
    | 'steering_committee'
    | 'sponsor_group'
    | 'all_stakeholders'
    | 'custom_group';

  // ── Notification-specific ──
  notificationCadence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  notificationChannel?: 'email' | 'slack' | 'meeting' | 'dashboard' | 'other';
  /** Human-readable cyclical communication rule */
  notificationRule?: string;
  notificationRecipientMode?: 'person' | 'group';
  notificationRecipientUserId?: string;
  notificationRecipientUserName?: string;
  notificationRecipientGroupKey?:
    | 'project_team'
    | 'steering_committee'
    | 'sponsor_group'
    | 'all_stakeholders'
    | 'custom_group';
  notificationTriggerMode?: 'event_based' | 'cyclical';
  notificationTriggerEvent?: 'on_start' | 'on_complete' | 'before_next_action' | 'manual_gate';
  /** Lead time before next action (for before_next_action trigger) */
  notificationLeadDays?: number | null;
  notificationMessage?: string;
  notificationAiAutoSend?: boolean;
  notificationAiInstruction?: string;

  // ── Meeting-specific ──
  meetingCadence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  meetingChannel?: 'online' | 'onsite' | 'hybrid';
  meetingAgenda?: string;

  // ── Links to existing entities ──
  linkedTaskId?: string;
  linkedMilestoneId?: string;
  linkedDecisionId?: string;

  /** Manual ordering within the table */
  order: number;
}

/**
 * Derive timeline mode from initiative status.
 * The mode controls which sub-view the TimelineSection renders.
 */
export function getTimelineMode(status: string): TimelineMode {
  const modeMap: Record<string, TimelineMode> = {
    DRAFT: 'ESTIMATE',
    PENDING_REVIEW: 'ESTIMATE',
    REVIEW: 'ESTIMATE',
    PROMOTED: 'PLANNING',
    PLANNING: 'PLANNING',
    APPROVED: 'READY_TO_LOCK',
    SCHEDULED: 'BASELINED',
    EXECUTING: 'CLOSED',
    BLOCKED: 'CLOSED',
    DONE: 'COMPLETED',
    TRACKING: 'COMPLETED',
    CANCELLED: 'COMPLETED',
    ARCHIVED: 'COMPLETED',
  };
  return modeMap[status] || 'ESTIMATE';
}

/**
 * Timeline mode display metadata.
 */
export const TIMELINE_MODE_META: Record<
  TimelineMode,
  { label: string; labelPl: string; color: string; icon: string }
> = {
  ESTIMATE: {
    label: 'Estimate',
    labelPl: 'Szacunek',
    color: 'text-slate-500 bg-slate-500/10',
    icon: 'Clock',
  },
  PLANNING: {
    label: 'Planning',
    labelPl: 'Planowanie',
    color: 'text-blue-500 bg-blue-500/10',
    icon: 'Edit3',
  },
  READY_TO_LOCK: {
    label: 'Awaiting Lock',
    labelPl: 'Do zamrożenia',
    color: 'text-amber-500 bg-amber-500/10',
    icon: 'Lock',
  },
  BASELINED: {
    label: 'Baselined',
    labelPl: 'Bazowy plan',
    color: 'text-emerald-500 bg-emerald-500/10',
    icon: 'Shield',
  },
  TRACKING: {
    label: 'Tracking',
    labelPl: 'Śledzenie',
    color: 'text-c-info bg-c-info/10',
    icon: 'Activity',
  },
  COMPLETED: {
    label: 'Completed',
    labelPl: 'Zakończony',
    color: 'text-emerald-500 bg-emerald-500/10',
    icon: 'CheckCircle',
  },
};

// ==========================================
// CONFIGURATION CONSTANTS
// ==========================================

export const GATE_DEFINITIONS = [
  {
    id: 'GO_NO_GO',
    label: 'Go/No-Go',
    forStatus: 'REVIEW',
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
  },
  {
    id: 'RESOURCES_COMMIT',
    label: 'Resources Commit',
    forStatus: 'PENDING_APPROVAL',
    pmoDomain: 'RESOURCE_RESPONSIBILITY',
  },
  {
    id: 'SCHEDULE_LOCK',
    label: 'Schedule Lock',
    forStatus: 'APPROVED',
    pmoDomain: 'SCHEDULE_MILESTONES',
  },
] as const;

export const GATE_CONFIG: Record<
  string,
  {
    name: string;
    namePl: string;
    fromStatus: string;
    toStatus: string;
    requiredRole: 'owner' | 'sponsor' | 'pmo' | 'committee';
    description: string;
    descriptionPl: string;
    requirements: string[];
  }
> = {
  PROMOTE: {
    name: 'Promote to Initiatives',
    namePl: 'Promocja do Inicjatyw',
    fromStatus: 'REVIEW',
    toStatus: 'PENDING_APPROVAL',
    requiredRole: 'sponsor',
    description: 'Sponsor approves initiative promotion from discovery phase',
    descriptionPl: 'Sponsor zatwierdza promocję inicjatywy z fazy odkrywania',
    requirements: ['title', 'problem', 'owner', 'sponsor'],
  },
  APPROVE: {
    name: 'Approve for Execution',
    namePl: 'Zatwierdzenie do realizacji',
    fromStatus: 'PLANNING',
    toStatus: 'APPROVED',
    requiredRole: 'committee',
    description: 'Steering Committee approves initiative for execution',
    descriptionPl: 'Komitet Sterujący zatwierdza inicjatywę do realizacji',
    requirements: ['objective', 'scope', 'timeline', 'team', 'risks'],
  },
  SCHEDULE: {
    name: 'Schedule for Execution',
    namePl: 'Zaplanowanie realizacji',
    fromStatus: 'APPROVED',
    toStatus: 'SCHEDULED',
    requiredRole: 'pmo',
    description: 'PMO confirms capacity and schedules initiative',
    descriptionPl: 'PMO potwierdza dostępność zasobów i planuje inicjatywę',
    requirements: ['timeline', 'capacity', 'dependencies'],
  },
  COMPLETE: {
    name: 'Complete Execution',
    namePl: 'Zakończenie realizacji',
    fromStatus: 'IN_EXECUTION',
    toStatus: 'DONE',
    requiredRole: 'pmo',
    description: 'PMO confirms all tasks completed and delivery accepted',
    descriptionPl: 'PMO potwierdza zakończenie wszystkich zadań i odbiór',
    requirements: ['all_tasks_done', 'delivery_confirmed'],
  },
  START_TRACKING: {
    name: 'Start Benefits Tracking',
    namePl: 'Rozpoczęcie śledzenia korzyści',
    fromStatus: 'DONE',
    toStatus: 'CLOSED',
    requiredRole: 'owner',
    description: 'Business Owner starts benefits tracking period',
    descriptionPl: 'Właściciel biznesowy rozpoczyna okres śledzenia korzyści',
    requirements: ['baseline_kpis', 'tracking_period'],
  },
  BLOCK: {
    name: 'Block Initiative',
    namePl: 'Zablokowanie inicjatywy',
    fromStatus: 'IN_EXECUTION',
    toStatus: 'IN_EXECUTION',
    requiredRole: 'sponsor',
    description: 'Sponsor approves blocking due to impediment',
    descriptionPl: 'Sponsor zatwierdza zablokowanie z powodu przeszkody',
    requirements: ['blocked_reason', 'impact_assessment'],
  },
  UNBLOCK: {
    name: 'Unblock Initiative',
    namePl: 'Odblokowanie inicjatywy',
    fromStatus: 'IN_EXECUTION',
    toStatus: 'IN_EXECUTION',
    requiredRole: 'sponsor',
    description: 'Sponsor approves unblocking after resolution',
    descriptionPl: 'Sponsor zatwierdza odblokowanie po rozwiązaniu problemu',
    requirements: ['resolution_decision', 'updated_timeline'],
  },
};

export const MODULE_CONFIG = {
  TOOLS: {
    label: 'Tools',
    labelPl: 'Narzędzia',
    color: 'bg-slate-500',
    textColor: 'text-slate-600 dark:text-slate-400',
    bgLight: 'bg-slate-500/10',
    icon: 'Wrench',
    route: '/tools',
    description: 'Discovery & ideation phase',
    descriptionPl: 'Faza odkrywania i pomysłów',
  },
  ASSESSMENT: {
    label: 'Assessment',
    labelPl: 'Ocena',
    color: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-500/10',
    icon: 'ClipboardCheck',
    route: '/assessment',
    description: 'Evaluation & scoring phase',
    descriptionPl: 'Faza oceny i punktacji',
  },
  INITIATIVES: {
    label: 'Initiatives',
    labelPl: 'Inicjatywy',
    color: 'bg-navy-900',
    textColor: 'text-navy-900 dark:text-slate-300',
    bgLight: 'bg-navy-900/10',
    icon: 'Lightbulb',
    route: '/initiatives',
    description: 'Planning & approval phase',
    descriptionPl: 'Faza planowania i zatwierdzania',
  },
  EXECUTION: {
    label: 'Execution',
    labelPl: 'Realizacja',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-500/10',
    icon: 'Play',
    route: '/execution',
    description: 'Active implementation phase',
    descriptionPl: 'Faza aktywnej realizacji',
  },
  BENEFITS: {
    label: 'Benefits',
    labelPl: 'Korzyści',
    color: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-500/10',
    icon: 'TrendingUp',
    route: '/results',
    description: 'Value tracking phase',
    descriptionPl: 'Faza śledzenia wartości',
  },
};

export const PRIORITY_CONFIG = {
  critical: {
    label: 'Critical',
    labelPl: 'Krytyczny',
    color: 'text-danger-500',
    bgColor: 'bg-danger-500/10',
  },
  high: { label: 'High', labelPl: 'Wysoki', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  medium: {
    label: 'Medium',
    labelPl: 'Średni',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  low: { label: 'Low', labelPl: 'Niski', color: 'text-slate-500', bgColor: 'bg-slate-500/10' },
};

export const RAID_TYPE_CONFIG = {
  risk: {
    label: 'Risk',
    labelPl: 'Ryzyko',
    color: 'bg-danger-500/20 text-danger-400',
  },
  assumption: {
    label: 'Assumption',
    labelPl: 'Założenie',
    color: 'bg-blue-500/20 text-blue-400',
  },
  issue: {
    label: 'Issue',
    labelPl: 'Problem',
    color: 'bg-danger-500/20 text-danger-400',
  },
  dependency: {
    label: 'Dependency',
    labelPl: 'Zależność',
    color: 'bg-c-info/20 text-c-info',
  },
};

export const SEVERITY_CONFIG = {
  LOW: { label: 'Low', labelPl: 'Niski', color: 'bg-slate-500/20 text-slate-600' },
  MEDIUM: { label: 'Medium', labelPl: 'Średni', color: 'bg-amber-500/20 text-amber-400' },
  HIGH: { label: 'High', labelPl: 'Wysoki', color: 'bg-amber-500/20 text-amber-400' },
  CRITICAL: { label: 'Critical', labelPl: 'Krytyczny', color: 'bg-danger-500/20 text-danger-400' },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export const getModuleFromStatus = (status: string): keyof typeof MODULE_CONFIG => {
  if (['DRAFT', 'PENDING_APPROVAL'].includes(status)) return 'TOOLS';
  if (
    ['REVIEW', 'PENDING_APPROVAL', 'PLANNING', 'APPROVED', 'SCHEDULED', 'CANCELLED', 'ARCHIVED'].includes(
      status
    )
  )
    return 'INITIATIVES';
  if (['IN_EXECUTION', 'IN_EXECUTION', 'DONE'].includes(status)) return 'EXECUTION';
  if (['CLOSED'].includes(status)) return 'BENEFITS';
  return 'TOOLS';
};

export const getNextGateForStatus = (status: string): string | null => {
  const gateMap: Record<string, string> = {
    REVIEW: 'PROMOTE',
    PLANNING: 'APPROVE',
    APPROVED: 'SCHEDULE',
    EXECUTING: 'COMPLETE',
    DONE: 'START_TRACKING',
    BLOCKED: 'UNBLOCK',
  };
  return gateMap[status] || null;
};

export const getRoleLabel = (role: string, isPolish: boolean): string => {
  const labels: Record<string, { en: string; pl: string }> = {
    owner: { en: 'Initiative Owner', pl: 'Właściciel inicjatywy' },
    sponsor: { en: 'Project Sponsor', pl: 'Sponsor projektu' },
    pmo: { en: 'PMO', pl: 'PMO' },
    committee: { en: 'Steering Committee', pl: 'Komitet Sterujący' },
  };
  return isPolish ? labels[role]?.pl || role : labels[role]?.en || role;
};
