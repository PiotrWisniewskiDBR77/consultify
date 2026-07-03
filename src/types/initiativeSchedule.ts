/**
 * Initiative schedule item — shared time-source contract (M13 Depth · Seria R).
 *
 * One normalized, date-bearing unit drawn from an initiative's tasks, milestones
 * and timeline phases. The SINGLE source consumed by both the Calendar (M13c)
 * and the task-level Gantt (V1), so the two views never drift. `sourceId` +
 * `sourceKind` let a view write a reschedule back to the right endpoint.
 */
export type ScheduleItemType = 'task' | 'milestone' | 'phase';

export interface ScheduleItem {
  /** stable id for React keys (e.g. `task:123`) */
  id: string;
  type: ScheduleItemType;
  title: string;
  /** ISO date (yyyy-mm-dd) or null when undated */
  start: string | null;
  /** ISO date; for a point milestone equals `start` */
  end: string | null;
  /** lifecycle/status label of the underlying item, if any */
  status?: string | null;
  /** original row id (for write-back of a reschedule) */
  sourceId: string;
  /** which collection the item came from (drives the PATCH endpoint) */
  sourceKind: ScheduleItemType;
}

/** Input bag for the FE schedule builder (already-loaded document data). */
export interface ScheduleSource {
  tasks?: any[];
  milestones?: any[];
  timeline?: any[];
}
