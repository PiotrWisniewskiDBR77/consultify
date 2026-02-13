/**
 * Initiative Section Library - Shared Types
 *
 * Types used across all initiative sections and the dynamic renderer.
 */

import type { InitiativeStatus } from '../../../types';

// ==========================================
// DATA TYPES
// ==========================================

export interface Decision {
  id: string;
  type: string;
  title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  dueDate?: string;
  ownerName?: string;
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
    forStatus: 'PROMOTED',
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
    toStatus: 'PROMOTED',
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
    fromStatus: 'EXECUTING',
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
    toStatus: 'TRACKING',
    requiredRole: 'owner',
    description: 'Business Owner starts benefits tracking period',
    descriptionPl: 'Właściciel biznesowy rozpoczyna okres śledzenia korzyści',
    requirements: ['baseline_kpis', 'tracking_period'],
  },
  BLOCK: {
    name: 'Block Initiative',
    namePl: 'Zablokowanie inicjatywy',
    fromStatus: 'EXECUTING',
    toStatus: 'BLOCKED',
    requiredRole: 'sponsor',
    description: 'Sponsor approves blocking due to impediment',
    descriptionPl: 'Sponsor zatwierdza zablokowanie z powodu przeszkody',
    requirements: ['blocked_reason', 'impact_assessment'],
  },
  UNBLOCK: {
    name: 'Unblock Initiative',
    namePl: 'Odblokowanie inicjatywy',
    fromStatus: 'BLOCKED',
    toStatus: 'EXECUTING',
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
    color: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-500/10',
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
    route: '/benefits',
    description: 'Value tracking phase',
    descriptionPl: 'Faza śledzenia wartości',
  },
};

export const PRIORITY_CONFIG = {
  critical: {
    label: 'Critical',
    labelPl: 'Krytyczny',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  high: { label: 'High', labelPl: 'Wysoki', color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
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
    color: 'bg-rose-500/20 text-rose-400',
  },
  assumption: {
    label: 'Assumption',
    labelPl: 'Założenie',
    color: 'bg-blue-500/20 text-blue-400',
  },
  issue: {
    label: 'Issue',
    labelPl: 'Problem',
    color: 'bg-red-500/20 text-red-400',
  },
  dependency: {
    label: 'Dependency',
    labelPl: 'Zależność',
    color: 'bg-purple-500/20 text-purple-400',
  },
};

export const SEVERITY_CONFIG = {
  LOW: { label: 'Low', labelPl: 'Niski', color: 'bg-slate-500/20 text-slate-400' },
  MEDIUM: { label: 'Medium', labelPl: 'Średni', color: 'bg-amber-500/20 text-amber-400' },
  HIGH: { label: 'High', labelPl: 'Wysoki', color: 'bg-orange-500/20 text-orange-400' },
  CRITICAL: { label: 'Critical', labelPl: 'Krytyczny', color: 'bg-red-500/20 text-red-400' },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

export const getModuleFromStatus = (status: string): keyof typeof MODULE_CONFIG => {
  if (['DRAFT', 'PENDING_REVIEW'].includes(status)) return 'TOOLS';
  if (
    ['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED', 'SCHEDULED', 'CANCELLED', 'ARCHIVED'].includes(
      status
    )
  )
    return 'INITIATIVES';
  if (['EXECUTING', 'BLOCKED', 'DONE'].includes(status)) return 'EXECUTION';
  if (['TRACKING'].includes(status)) return 'BENEFITS';
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
