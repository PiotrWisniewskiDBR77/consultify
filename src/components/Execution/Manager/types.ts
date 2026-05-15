/**
 * Manager Module — Problem-list types
 *
 * Each of the 6 manager areas presents a flat table of problems.
 * Every row links back to its source entity (initiative / task / decision / RAID item)
 * and carries actions the manager can take.
 */

export type ManagerLaneId =
  | 'action-queue'
  | 'decisions'
  | 'blockers'
  | 'workload'
  | 'risk'
  | 'people-change';

export type ProblemSeverity = 'critical' | 'warning' | 'info';

export type ProblemType =
  | 'overdue_task'
  | 'blocked_task'
  | 'overdue_decision'
  | 'pending_decision'
  | 'no_decision_maker'
  | 'deferred_decision'
  | 'blocked_initiative'
  | 'dependency_block'
  | 'decision_block'
  | 'critical_issue'
  | 'escalated'
  | 'overloaded_person'
  | 'unassigned_task'
  | 'no_estimate'
  | 'due_soon'
  | 'critical_risk'
  | 'high_risk'
  | 'delay_overdue'
  | 'delay_risk'
  | 'delay_late_start'
  | 'missing_baseline'
  | 'dependency_risk'
  | 'budget_overspend'
  | 'stale_item'
  | 'no_owner'
  | 'no_sponsor'
  | 'no_dates'
  | 'bus_factor'
  | 'low_clarity';

export type SourceEntityType = 'INITIATIVE' | 'TASK' | 'DECISION' | 'RAID_ITEM' | 'PERSON';

export type ProblemActionId =
  | 'replan'
  | 'reassign'
  | 'escalate'
  | 'set_due_date'
  | 'open_entity'
  | 'approve'
  | 'reject'
  | 'defer'
  | 'assign_maker'
  | 'request_info'
  | 'unblock'
  | 'workaround'
  | 'scope_reduction'
  | 'set_capacity'
  | 'smooth_schedule'
  | 'create_mitigation'
  | 'assign_mitigation_owner'
  | 'set_baseline'
  | 'mark_mitigated'
  | 'dismiss'
  | 'assign_owner'
  | 'assign_sponsor'
  | 'set_dates'
  | 'distribute_work'
  | 'send_nudge';

export interface ProblemAction {
  id: ProblemActionId;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
  icon?: string;
}

export interface ManagerProblemRow {
  id: string;
  severity: ProblemSeverity;
  problemType: ProblemType;
  title: string;
  rootCause: string;
  sourceEntityType: SourceEntityType;
  sourceEntityId: string;
  sourceEntityName: string;
  ownerId: string | null;
  ownerName: string | null;
  daysOverdue: number | null;
  impactCount: number;
  affectedEntities: Array<{ id: string; name: string; type: SourceEntityType }>;
  actions: ProblemAction[];
  meta: Record<string, unknown>;
}

export interface MetricDef {
  label: string;
  value: number | string;
  variant?: 'default' | 'warn' | 'critical';
}
