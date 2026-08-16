/**
 * Workload & Capacity Service
 * V4-TASK-06: Workload model + capacity analytics
 */

import DbPromise from '../utils/DbPromise.js';
import {
  CAPACITY_POLICY,
  capacityHoursForAllocation,
  utilizationPercent,
} from './capacityPolicy.js';

const displayNameSql = (userAlias: string, fallbackExpr: string) =>
  `COALESCE(NULLIF(TRIM(COALESCE(${userAlias}.first_name, '') || ' ' || COALESCE(${userAlias}.last_name, '')), ''), ${userAlias}.email, ${fallbackExpr})`;
const recentDaysSql = (days: number) =>
  process.env.DB_TYPE === 'postgres'
    ? `CURRENT_DATE - INTERVAL '${days} days'`
    : `date('now', '-${days} days')`;

interface UserCapacityRow {
  user_id: string;
  name: string;
  email: string;
  allocation_percent: number;
}

interface TaskAllocationRow {
  user_id: string;
  window_hours: number;
  backlog_hours: number;
}

interface TimeEntryRow {
  user_id: string;
  actual_hours: number;
}

export interface CapacityOverviewUser {
  userId: string;
  name: string;
  capacityHours: number;
  /**
   * Estimated hours of OPEN tasks whose due_date falls inside the current
   * capacity window (this Monday..Sunday). Comparable to capacityHours (one week).
   */
  allocatedHours: number;
  /**
   * Estimated hours of OPEN tasks WITHOUT a due_date (unscheduled backlog).
   * Reported ALONGSIDE utilization — deliberately NOT folded into allocatedHours
   * so that utilizationPercent stays unit-consistent with the one-week window.
   */
  backlogHours: number;
  actualHours: number;
  utilizationPercent: number;
  overloaded: boolean;
}

export interface CapacityOverview {
  users: CapacityOverviewUser[];
  summary: {
    totalCapacity: number;
    totalAllocated: number;
    totalBacklog: number;
    avgUtilization: number;
  };
  /** ISO date (YYYY-MM-DD) of the capacity window the allocation is measured against. */
  windowStart: string;
  windowEnd: string;
}

export interface WeekForecast {
  weekStart: string;
  capacityHours: number;
  allocatedHours: number;
  availableHours: number;
}

export type OverloadWindow = 'day' | 'week' | 'month';

const WINDOW_MULTIPLIER: Record<OverloadWindow, number> = {
  day: 1 / 5,
  week: 1,
  month: 4,
};

export interface OverloadAlert {
  userId: string;
  name: string;
  capacityHours: number;
  allocatedHours: number;
  /** Unscheduled backlog hours (no due_date), scaled to the same window. Informational. */
  backlogHours: number;
  overloadHours: number;
  severity: 'warning' | 'critical';
  suggestion: string;
  window: OverloadWindow;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDate(d: Date): string {
  // BUG (T4/#77, fixed 2026-07-19): `d.toISOString()` converts to UTC before
  // formatting. `getMonday()`/callers build `d` from LOCAL date components
  // (getDay/getDate/setHours(0,0,0,0)), so in any positive-UTC-offset timezone
  // (e.g. Europe/Warsaw, UTC+1/+2) the UTC conversion rolls the date back by
  // one day — the capacity window silently excluded "today" whenever today
  // was the window's last day (Sunday), zeroing out allocatedHours/overload
  // alerts for anyone with a task due today. Use local Y-M-D parts instead,
  // consistent with getMonday()'s local-time semantics.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getCapacityOverview(orgId: string): Promise<CapacityOverview> {
  const members = await DbPromise.all<UserCapacityRow>(
    `SELECT DISTINCT pm.user_id,
            ${displayNameSql('u', 'pm.user_id')} as name,
            COALESCE(u.email, '') as email,
            COALESCE(pm.allocation_percent, 100) as allocation_percent
     FROM project_members pm
     LEFT JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id IN (SELECT id FROM projects WHERE organization_id = ?)`,
    [orgId]
  );

  const userCapMap = new Map<string, { name: string; capacityHours: number }>();
  for (const m of members) {
    const existing = userCapMap.get(m.user_id);
    const addedCap =
      capacityHoursForAllocation(m.allocation_percent);
    if (existing) {
      existing.capacityHours += addedCap;
    } else {
      userCapMap.set(m.user_id, { name: m.name, capacityHours: addedCap });
    }
  }

  // Capacity window = current ISO week (Monday..Sunday). allocatedHours is measured
  // against THIS window so it is unit-consistent with capacityHours (one week).
  const windowStartDate = getMonday(new Date());
  const windowEndDate = new Date(windowStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  const windowStart = formatDate(windowStartDate);
  const windowEnd = formatDate(windowEndDate);

  const userIds = [...userCapMap.keys()];
  if (userIds.length === 0) {
    return {
      users: [],
      summary: { totalCapacity: 0, totalAllocated: 0, totalBacklog: 0, avgUtilization: 0 },
      windowStart,
      windowEnd,
    };
  }

  const placeholders = userIds.map(() => '?').join(',');

  // Split open-task estimates into:
  //  - window_hours: tasks with a due_date inside [windowStart, windowEnd]
  //  - backlog_hours: tasks with NO due_date (unscheduled) — reported separately
  // Tasks due in other weeks belong to those weeks' windows and are excluded here.
  const allocRows = await DbPromise.all<TaskAllocationRow>(
    `SELECT assignee_id as user_id,
            COALESCE(SUM(CASE
              WHEN due_date IS NOT NULL
                AND date(due_date) >= date(?) AND date(due_date) <= date(?)
              THEN estimated_hours ELSE 0 END), 0) as window_hours,
            COALESCE(SUM(CASE
              WHEN due_date IS NULL
              THEN estimated_hours ELSE 0 END), 0) as backlog_hours
     FROM tasks
     WHERE assignee_id IN (${placeholders}) AND organization_id = ?
       AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
     GROUP BY assignee_id`,
    [windowStart, windowEnd, ...userIds, orgId]
  );
  const allocMap = new Map(allocRows.map((r) => [r.user_id, Number(r.window_hours)]));
  const backlogMap = new Map(allocRows.map((r) => [r.user_id, Number(r.backlog_hours)]));

  let actualMap = new Map<string, number>();
  try {
    const actualRows = await DbPromise.all<TimeEntryRow>(
      `SELECT user_id, COALESCE(SUM(hours), 0) as actual_hours
       FROM time_entries
       WHERE user_id IN (${placeholders}) AND organization_id = ?
         AND date >= ${recentDaysSql(7)}
       GROUP BY user_id`,
      [...userIds, orgId]
    );
    actualMap = new Map(actualRows.map((r) => [r.user_id, Number(r.actual_hours)]));
  } catch {
    // time_entries table may not exist yet
  }

  const users: CapacityOverviewUser[] = [];
  let totalCapacity = 0;
  let totalAllocated = 0;
  let totalBacklog = 0;

  for (const [userId, info] of userCapMap) {
    const cap = round1(info.capacityHours);
    const alloc = round1(allocMap.get(userId) || 0);
    const backlog = round1(backlogMap.get(userId) || 0);
    const actual = round1(actualMap.get(userId) || 0);
    const util = cap > 0 ? Math.round((alloc / cap) * 100) : 0;

    users.push({
      userId,
      name: info.name,
      capacityHours: cap,
      allocatedHours: alloc,
      backlogHours: backlog,
      actualHours: actual,
      utilizationPercent: util,
      overloaded: alloc > cap * 1.1,
    });

    totalCapacity += cap;
    totalAllocated += alloc;
    totalBacklog += backlog;
  }

  const avgUtilization = totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  return {
    users,
    summary: {
      totalCapacity: round1(totalCapacity),
      totalAllocated: round1(totalAllocated),
      totalBacklog: round1(totalBacklog),
      avgUtilization,
    },
    windowStart,
    windowEnd,
  };
}

export async function getUserForecast(orgId: string, userId: string): Promise<WeekForecast[]> {
  const allocRows = await DbPromise.all<{ allocation_percent: number }>(
    `SELECT COALESCE(allocation_percent, 100) as allocation_percent
     FROM project_members
     WHERE user_id = ? AND project_id IN (SELECT id FROM projects WHERE organization_id = ?)`,
    [userId, orgId]
  );

  let weeklyCapacity: number = CAPACITY_POLICY.weeklyHoursPerFte;
  if (allocRows.length > 0) {
    weeklyCapacity = allocRows.reduce(
      (sum, r) =>
        sum +
        (Math.min(100, Math.max(0, Number(r.allocation_percent) || 0)) / 100) *
          CAPACITY_POLICY.weeklyHoursPerFte,
      0
    );
  }

  const today = new Date();
  const weeks: WeekForecast[] = [];

  for (let w = 0; w < 4; w++) {
    const weekStart = getMonday(new Date(today.getTime() + w * 7 * 24 * 60 * 60 * 1000));
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const wsStr = formatDate(weekStart);
    const weStr = formatDate(weekEnd);

    let allocated = 0;

    try {
      const allocRow = await DbPromise.get<{ hours: number }>(
        `SELECT COALESCE(SUM(allocated_hours), 0) as hours
         FROM task_allocations
         WHERE user_id = ? AND organization_id = ? AND week_start = ?`,
        [userId, orgId, wsStr]
      );
      allocated = Number(allocRow?.hours || 0);
    } catch {
      // task_allocations may not exist yet; fall back to estimated_hours
    }

    if (allocated === 0) {
      const estRow = await DbPromise.get<{ hours: number }>(
        `SELECT COALESCE(SUM(estimated_hours), 0) / 4.0 as hours
         FROM tasks
         WHERE assignee_id = ? AND organization_id = ?
           AND lower(coalesce(status,'')) NOT IN ('done','completed','validated','cancelled')
           AND (due_date IS NULL OR due_date >= ?)
           AND (started_at IS NULL OR started_at <= ?)`,
        [userId, orgId, wsStr, weStr]
      );
      allocated = Number(estRow?.hours || 0);
    }

    weeks.push({
      weekStart: wsStr,
      capacityHours: round1(weeklyCapacity),
      allocatedHours: round1(allocated),
      availableHours: round1(Math.max(0, weeklyCapacity - allocated)),
    });
  }

  return weeks;
}

export async function getOverloadAlerts(
  orgId: string,
  window: OverloadWindow = 'week'
): Promise<OverloadAlert[]> {
  const overview = await getCapacityOverview(orgId);
  const alerts: OverloadAlert[] = [];
  const mult = WINDOW_MULTIPLIER[window];

  for (const user of overview.users) {
    // user.allocatedHours / capacityHours are already one-week ('week') values.
    // Scale to the requested window for day/month approximations.
    const windowCapacity = round1(user.capacityHours * mult);
    const windowAllocated = round1(user.allocatedHours * mult);
    const windowBacklog = round1(user.backlogHours * mult);

    if (windowAllocated > windowCapacity * 1.1) {
      const overloadHours = round1(windowAllocated - windowCapacity);
      const severity = windowAllocated > windowCapacity * 1.3 ? 'critical' : 'warning';
      const suggestion =
        severity === 'critical'
          ? `Reassign ${overloadHours}h of work or extend deadlines (${window} window)`
          : `Review task priorities — ${overloadHours}h over capacity (${window} window)`;

      alerts.push({
        userId: user.userId,
        name: user.name,
        capacityHours: windowCapacity,
        allocatedHours: windowAllocated,
        backlogHours: windowBacklog,
        overloadHours,
        severity,
        suggestion,
        window,
      });
    }
  }

  return alerts.sort((a, b) => b.overloadHours - a.overloadHours);
}

// ================================================================
// V4-EXEC-04: Initiative-level capacity
// ================================================================

export interface InitiativeResourceCapacity {
  userId: string;
  name: string;
  role: string | null;
  allocationPercent: number;
  allocatedHours: number;
  actualHours: number;
  crossInitiativeTotal: number;
}

export interface InitiativeCapacity {
  initiativeId: string;
  resources: InitiativeResourceCapacity[];
  summary: {
    totalFteRequired: number;
    totalFteAllocated: number;
    avgUtilization: number;
  };
  alerts: { userId: string; type: 'overloaded' | 'underutilized' | 'skill_gap'; message: string }[];
}

export async function getInitiativeCapacity(
  orgId: string,
  initiativeId: string
): Promise<InitiativeCapacity> {
  const resourceRows = await DbPromise.all<{
    user_id: string;
    name: string;
    role: string | null;
    allocation_percentage: number;
  }>(
    `SELECT ir.user_id,
            ${displayNameSql('u', 'ir.user_id')} AS name,
            ir.role,
            COALESCE(ir.allocation_percentage, 0) AS allocation_percentage
     FROM initiative_resources ir
     LEFT JOIN users u ON u.id = ir.user_id
     WHERE ir.initiative_id = ? AND ir.organization_id = ?`,
    [initiativeId, orgId]
  );

  const userIds = resourceRows.map((r) => r.user_id);
  if (userIds.length === 0) {
    return {
      initiativeId,
      resources: [],
      summary: { totalFteRequired: 0, totalFteAllocated: 0, avgUtilization: 0 },
      alerts: [],
    };
  }

  const ph = userIds.map(() => '?').join(',');

  const crossRows = await DbPromise.all<{ user_id: string; total_alloc: number }>(
    `SELECT user_id, COALESCE(SUM(allocation_percentage), 0) AS total_alloc
     FROM initiative_resources
     WHERE user_id IN (${ph}) AND organization_id = ?
     GROUP BY user_id`,
    [...userIds, orgId]
  );
  const crossMap = new Map(crossRows.map((r) => [r.user_id, Number(r.total_alloc)]));

  const taskRows = await DbPromise.all<{ assignee_id: string; hours: number }>(
    `SELECT assignee_id, COALESCE(SUM(estimated_hours), 0) AS hours
     FROM tasks
     WHERE initiative_id = ? AND organization_id = ? AND assignee_id IN (${ph})
       AND LOWER(COALESCE(status, '')) NOT IN ('done','completed','validated','cancelled')
     GROUP BY assignee_id`,
    [initiativeId, orgId, ...userIds]
  );
  const taskMap = new Map(taskRows.map((r) => [r.assignee_id, Number(r.hours)]));

  let actualMap = new Map<string, number>();
  try {
    const actualRows = await DbPromise.all<{ user_id: string; hours: number }>(
      `SELECT te.user_id, COALESCE(SUM(te.hours), 0) AS hours
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id
       WHERE t.initiative_id = ? AND te.organization_id = ? AND te.user_id IN (${ph})
       GROUP BY te.user_id`,
      [initiativeId, orgId, ...userIds]
    );
    actualMap = new Map(actualRows.map((r) => [r.user_id, Number(r.hours)]));
  } catch {
    // time_entries may not exist
  }

  const resources: InitiativeResourceCapacity[] = [];
  const alerts: InitiativeCapacity['alerts'] = [];
  let totalAllocPercent = 0;

  for (const r of resourceRows) {
    const allocPct = Number(r.allocation_percentage) || 0;
    const allocHours = round1(taskMap.get(r.user_id) || 0);
    const actualHours = round1(actualMap.get(r.user_id) || 0);
    const crossTotal = round1(crossMap.get(r.user_id) || 0);

    totalAllocPercent += allocPct;

    resources.push({
      userId: r.user_id,
      name: r.name,
      role: r.role,
      allocationPercent: allocPct,
      allocatedHours: allocHours,
      actualHours,
      crossInitiativeTotal: crossTotal,
    });

    if (crossTotal > 100) {
      alerts.push({
        userId: r.user_id,
        type: 'overloaded',
        message: `${r.name} is allocated ${crossTotal}% across initiatives (over 100%)`,
      });
    } else if (allocPct < 20 && allocPct > 0) {
      alerts.push({
        userId: r.user_id,
        type: 'underutilized',
        message: `${r.name} has only ${allocPct}% allocation on this initiative`,
      });
    }
  }

  const totalFteAllocated = round1(totalAllocPercent / 100);
  const totalFteRequired = totalFteAllocated;
  const avgUtilization =
    resources.length > 0
      ? Math.round(resources.reduce((s, r) => s + r.allocationPercent, 0) / resources.length)
      : 0;

  return {
    initiativeId,
    resources,
    summary: { totalFteRequired, totalFteAllocated, avgUtilization },
    alerts,
  };
}

export interface LevelingAlerts {
  overloaded: { userId: string; name: string; totalAllocation: number }[];
  underutilized: { userId: string; name: string; totalAllocation: number }[];
  unfilledRoles: { initiativeId: string; initiativeName: string; role: string }[];
}

export async function getLevelingAlerts(orgId: string): Promise<LevelingAlerts> {
  const allocRows = await DbPromise.all<{
    user_id: string;
    name: string;
    total_alloc: number;
  }>(
    `SELECT ir.user_id,
            ${displayNameSql('u', 'ir.user_id')} AS name,
            COALESCE(SUM(ir.allocation_percentage), 0) AS total_alloc
     FROM initiative_resources ir
     LEFT JOIN users u ON u.id = ir.user_id
     WHERE ir.organization_id = ?
     GROUP BY ir.user_id, u.first_name, u.last_name, u.email`,
    [orgId]
  );

  const overloaded = allocRows
    .filter((r) => Number(r.total_alloc) > 100)
    .map((r) => ({ userId: r.user_id, name: r.name, totalAllocation: Number(r.total_alloc) }));

  const underutilized = allocRows
    .filter((r) => Number(r.total_alloc) > 0 && Number(r.total_alloc) < 50)
    .map((r) => ({ userId: r.user_id, name: r.name, totalAllocation: Number(r.total_alloc) }));

  let unfilledRoles: LevelingAlerts['unfilledRoles'] = [];
  try {
    const unfilledRows = await DbPromise.all<{
      initiative_id: string;
      initiative_name: string;
      role: string;
    }>(
      `SELECT ir.initiative_id,
              COALESCE(i.name, i.title, ir.initiative_id) AS initiative_name,
              ir.role
       FROM initiative_resources ir
       LEFT JOIN initiatives i ON i.id = ir.initiative_id
       WHERE ir.organization_id = ? AND (ir.user_id IS NULL OR ir.user_id = '')
         AND ir.role IS NOT NULL`,
      [orgId]
    );
    unfilledRoles = unfilledRows.map((r) => ({
      initiativeId: r.initiative_id,
      initiativeName: r.initiative_name,
      role: r.role,
    }));
  } catch {
    // role column may not exist
  }

  return { overloaded, underutilized, unfilledRoles };
}

export interface CapacityTimelineWeek {
  weekStart: string;
  totalCapacity: number;
  totalAllocated: number;
  utilizationPercent: number;
}

export async function getCapacityTimeline(
  orgId: string,
  initiativeId?: string,
  explicitAnchor?: string
): Promise<CapacityTimelineWeek[]> {
  const anchorRow = explicitAnchor
    ? { anchor_date: explicitAnchor }
    : initiativeId
      ? await DbPromise.get<{ anchor_date: string }>(
          `SELECT created_at AS anchor_date FROM initiatives WHERE id = ? AND organization_id = ?`,
          [initiativeId, orgId]
        )
      : await DbPromise.get<{ anchor_date: string }>(
          `SELECT MIN(created_at) AS anchor_date FROM initiatives WHERE organization_id = ?`,
          [orgId]
        );
  // Never anchor a persisted-data read model to request wall-clock time.
  // Initiative creation is stable across restart/cold readback; an empty org
  // uses a documented fixed Monday until its first initiative is persisted.
  const anchor = new Date(anchorRow?.anchor_date || '1970-01-05T00:00:00.000Z');
  if (Number.isNaN(anchor.getTime())) throw new Error('Invalid capacity timeline anchor');
  const weeks: CapacityTimelineWeek[] = [];

  let memberCountRow: { cnt: number } | null = null;
  if (initiativeId) {
    memberCountRow = await DbPromise.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM initiative_resources WHERE initiative_id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
  } else {
    memberCountRow = await DbPromise.get<{ cnt: number }>(
      `SELECT COUNT(DISTINCT user_id) AS cnt FROM initiative_resources WHERE organization_id = ?`,
      [orgId]
    );
  }
  const memberCount = Number(memberCountRow?.cnt || 0);
  const weeklyCapacity = memberCount * CAPACITY_POLICY.weeklyHoursPerFte;

  for (let w = 0; w < CAPACITY_POLICY.timelineWeeks; w++) {
    const weekStart = getMonday(new Date(anchor.getTime() + w * 7 * 24 * 60 * 60 * 1000));
    const wsStr = formatDate(weekStart);

    let allocated = 0;
    try {
      const params: unknown[] = [orgId, wsStr];
      let sql = `SELECT COALESCE(SUM(allocated_hours), 0) AS hours
                 FROM task_allocations
                 WHERE organization_id = ? AND week_start = ?`;
      if (initiativeId) {
        sql += ` AND task_id IN (SELECT id FROM tasks WHERE initiative_id = ?)`;
        params.push(initiativeId);
      }
      const row = await DbPromise.get<{ hours: number }>(sql, params);
      allocated = Number(row?.hours || 0);
    } catch {
      // task_allocations may not exist
    }

    if (allocated === 0) {
      const params: unknown[] = [CAPACITY_POLICY.timelineWeeks, orgId];
      let sql = `SELECT COALESCE(SUM(estimated_hours), 0) / ? AS hours
                 FROM tasks
                 WHERE organization_id = ?
                   AND LOWER(COALESCE(status, '')) NOT IN ('done','completed','validated','cancelled')`;
      if (initiativeId) {
        sql += ` AND initiative_id = ?`;
        params.push(initiativeId);
      }
      const row = await DbPromise.get<{ hours: number }>(sql, params);
      allocated = Number(row?.hours || 0);
    }

    const util = utilizationPercent(allocated, weeklyCapacity);
    weeks.push({
      weekStart: wsStr,
      totalCapacity: round1(weeklyCapacity),
      totalAllocated: round1(allocated),
      utilizationPercent: util,
    });
  }

  return weeks;
}

export default {
  getCapacityOverview,
  getUserForecast,
  getOverloadAlerts,
  getInitiativeCapacity,
  getLevelingAlerts,
  getCapacityTimeline,
};
