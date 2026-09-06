/**
 * Delay Detection Service (T041)
 *
 * Plan vs actual comparison engine that detects deviations in initiatives and tasks.
 * Supports configurable thresholds, "why slip" context, and alert throttling.
 */
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

// ── Types ──────────────────────────────────────────────────────

export type DeviationType = 'LATE_START' | 'LATE_FINISH_RISK' | 'DEADLINE_RISK' | 'OVERDUE';
export type DelaySeverity = 'WARNING' | 'CRITICAL';
export type WhySlipReason =
  | 'BLOCKED'
  | 'DEPENDENCY_NOT_DONE'
  | 'NO_OWNER'
  | 'RAID_HIGH_RISK'
  | 'CAPACITY_OVERLOAD'
  | 'NO_TASKS_PLANNED';

export interface DelaySignal {
  id: string;
  projectId?: string;
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  entityName: string;
  deviationType: DeviationType;
  severity: DelaySeverity;
  daysDeviation: number;
  plannedDate: string | null;
  actualOrCurrent: string | null;
  whySlipReasons: WhySlipContext[];
  alertSentAt: string | null;
  isDismissed: boolean;
  createdAt: string;
}

export interface WhySlipContext {
  reason: WhySlipReason;
  detail: string;
}

interface DeviationThresholds {
  warningDays: number;
  criticalDays: number;
}

const DEFAULT_THRESHOLDS: Record<string, DeviationThresholds> = {
  Critical: { warningDays: 2, criticalDays: 5 },
  High: { warningDays: 3, criticalDays: 7 },
  Medium: { warningDays: 5, criticalDays: 10 },
  Low: { warningDays: 7, criticalDays: 14 },
};

function getThresholds(priority: string | null): DeviationThresholds {
  return DEFAULT_THRESHOLDS[priority || 'Medium'] || DEFAULT_THRESHOLDS.Medium;
}

interface InitiativeRow {
  id: string;
  name: string;
  status: string;
  priority: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  start_date: string | null;
  actual_end_date: string | null;
  execution_started_at: string | null;
  sla_deadline: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  on_hold: boolean | null;
  progress: number | null;
  owner_business_id: string | null;
  owner_execution_id: string | null;
  project_id: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  initiative_id: string | null;
  assignee_id: string | null;
  project_id: string | null;
}

interface DependencyRow {
  from_initiative_id: string;
  to_initiative_id: string;
  from_status: string;
}

interface RaidHighRiskRow {
  initiative_id: string;
  title: string;
}

// ── Why Slip Analysis ──────────────────────────────────────────

async function analyzeWhySlip(
  init: InitiativeRow,
  organizationId: string
): Promise<WhySlipContext[]> {
  const reasons: WhySlipContext[] = [];

  // DEC-424 (P12-int-c): BLOCKED -> IN_EXECUTION + flaga on_hold.
  if (init.on_hold) {
    const blockedDays = init.blocked_at
      ? Math.floor((Date.now() - new Date(init.blocked_at).getTime()) / 86400000)
      : 0;
    reasons.push({
      reason: 'BLOCKED',
      detail: `Blocked for ${blockedDays} days${init.blocked_reason ? `: ${init.blocked_reason}` : ''}`,
    });
  }

  try {
    const deps = (await dbAll(
      `SELECT id.from_initiative_id, id.to_initiative_id, i.status as from_status
       FROM initiative_dependencies id
       JOIN initiatives i ON i.id = id.from_initiative_id
       WHERE id.to_initiative_id = ? AND id.organization_id = ?
         -- DEC-424 (P12-int-c): DONE -> CLOSED, CANCELLED -> REJECTED; ARCHIVED is
         -- now a flag that only ever applies on top of CLOSED/REJECTED anyway.
         AND i.status NOT IN ('CLOSED', 'REJECTED')`,
      [init.id, organizationId]
    )) as DependencyRow[] | null;

    if (deps && deps.length > 0) {
      reasons.push({
        reason: 'DEPENDENCY_NOT_DONE',
        detail: `${deps.length} predecessor(s) not completed`,
      });
    }
  } catch {
    // non-blocking
  }

  if (!init.owner_business_id && !init.owner_execution_id) {
    reasons.push({ reason: 'NO_OWNER', detail: 'No owner assigned' });
  }

  try {
    const raidItems = (await dbAll(
      `SELECT initiative_id, title FROM raid_items
       WHERE initiative_id = ? AND organization_id = ?
         AND type = 'RISK' AND (impact = 'HIGH' OR impact = 'CRITICAL')
         AND status NOT IN ('CLOSED', 'MITIGATED')`,
      [init.id, organizationId]
    )) as RaidHighRiskRow[] | null;

    if (raidItems && raidItems.length > 0) {
      reasons.push({
        reason: 'RAID_HIGH_RISK',
        detail: `${raidItems.length} high/critical risk(s) active`,
      });
    }
  } catch {
    // non-blocking
  }

  return reasons.slice(0, 3);
}

// ── Detection Engine ───────────────────────────────────────────

export async function detectDelaySignals(
  organizationId: string,
  projectId?: string,
  options?: { maxSignals?: number }
): Promise<DelaySignal[]> {
  const signals: DelaySignal[] = [];
  const now = new Date();

  try {
    // Respect dismissals (even in live detection mode) so dismissed signals do not re-appear.
    const dismissedRows = ((await dbAll(
      `SELECT id FROM delay_signals WHERE organization_id = ? AND is_dismissed = TRUE`,
      [organizationId]
    )) || []) as Array<{ id: string }>;
    const dismissedIds = new Set(dismissedRows.map((r) => String(r.id)));

    const initiativeColumns = await getTableColumns('initiatives');
    const initiativeSelect = (column: string) =>
      initiativeColumns.has(column) ? column : `NULL as ${column}`;

    // DEC-424 (P12-int-c): DONE/TRACKING -> CLOSED, CANCELLED -> REJECTED, ARCHIVED is now a flag.
    const archivedFilter = initiativeColumns.has('archived')
      ? `AND NOT COALESCE(archived, FALSE)`
      : '';
    let initQuery = `
      SELECT id, name, status, ${initiativeSelect('priority')}, ${initiativeSelect('planned_start_date')}, ${initiativeSelect('planned_end_date')},
             ${initiativeSelect('start_date')}, ${initiativeSelect('actual_end_date')}, ${initiativeSelect('execution_started_at')}, ${initiativeSelect('sla_deadline')},
             ${initiativeSelect('blocked_reason')}, ${initiativeSelect('blocked_at')}, ${initiativeSelect('on_hold')}, ${initiativeSelect('progress')},
             ${initiativeSelect('owner_business_id')}, ${initiativeSelect('owner_execution_id')}, ${initiativeSelect('project_id')}
      FROM initiatives
      WHERE organization_id = ?
        AND status NOT IN ('CLOSED', 'REJECTED', 'DRAFT')
        ${archivedFilter}
    `;
    const params: unknown[] = [organizationId];
    if (projectId) {
      initQuery += ' AND project_id = ?';
      params.push(projectId);
    }

    const initiatives = ((await dbAll(initQuery, params)) || []) as InitiativeRow[];

    for (const init of initiatives) {
      const thresholds = getThresholds(init.priority);

      // Late Start: planned start passed but no execution started
      if (init.planned_start_date && !init.execution_started_at && !init.start_date) {
        const plannedStart = new Date(init.planned_start_date);
        if (plannedStart < now) {
          const daysLate = Math.floor((now.getTime() - plannedStart.getTime()) / 86400000);
          if (daysLate >= thresholds.warningDays) {
            const severity: DelaySeverity =
              daysLate >= thresholds.criticalDays ? 'CRITICAL' : 'WARNING';
            const whySlip = await analyzeWhySlip(init, organizationId);
            signals.push({
              id: `late-start-${init.id}`,
              projectId: init.project_id || undefined,
              entityType: 'INITIATIVE',
              entityId: init.id,
              entityName: init.name,
              deviationType: 'LATE_START',
              severity,
              daysDeviation: daysLate,
              plannedDate: init.planned_start_date,
              actualOrCurrent: null,
              whySlipReasons: whySlip,
              alertSentAt: null,
              isDismissed: false,
              createdAt: now.toISOString(),
            });
          }
        }
      }

      // Overdue: planned end passed, not done
      const endDate = init.planned_end_date || init.sla_deadline;
      if (endDate && new Date(endDate) < now && init.status !== 'CLOSED') {
        // DEC-424 (P12-int-c): DONE -> CLOSED.
        const daysOverdue = Math.floor((now.getTime() - new Date(endDate).getTime()) / 86400000);
        const severity: DelaySeverity =
          daysOverdue >= thresholds.criticalDays ? 'CRITICAL' : 'WARNING';
        const whySlip = await analyzeWhySlip(init, organizationId);
        signals.push({
          id: `overdue-${init.id}`,
          projectId: init.project_id || undefined,
          entityType: 'INITIATIVE',
          entityId: init.id,
          entityName: init.name,
          deviationType: 'OVERDUE',
          severity,
          daysDeviation: daysOverdue,
          plannedDate: endDate,
          actualOrCurrent: now.toISOString().split('T')[0],
          whySlipReasons: whySlip,
          alertSentAt: null,
          isDismissed: false,
          createdAt: now.toISOString(),
        });
      }

      // Late Finish Risk: approaching deadline with low progress
      if (init.planned_end_date && init.status !== 'CLOSED' /* DEC-424 (P12-int-c): DONE -> CLOSED */) {
        const daysUntilEnd = Math.floor(
          (new Date(init.planned_end_date).getTime() - now.getTime()) / 86400000
        );
        if (daysUntilEnd > 0 && daysUntilEnd <= thresholds.criticalDays) {
          const progress = init.progress || 0;
          const totalDuration = init.planned_start_date
            ? Math.max(
                1,
                Math.floor(
                  (new Date(init.planned_end_date).getTime() -
                    new Date(init.planned_start_date).getTime()) /
                    86400000
                )
              )
            : 30;
          const elapsed = totalDuration - daysUntilEnd;
          const expectedProgress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

          if (progress < expectedProgress - 15) {
            const severity: DelaySeverity = daysUntilEnd <= 3 ? 'CRITICAL' : 'WARNING';
            const whySlip = await analyzeWhySlip(init, organizationId);
            signals.push({
              id: `late-finish-${init.id}`,
              projectId: init.project_id || undefined,
              entityType: 'INITIATIVE',
              entityId: init.id,
              entityName: init.name,
              deviationType: 'LATE_FINISH_RISK',
              severity,
              daysDeviation: daysUntilEnd,
              plannedDate: init.planned_end_date,
              actualOrCurrent: `${progress}% done (expected ~${expectedProgress}%)`,
              whySlipReasons: whySlip,
              alertSentAt: null,
              isDismissed: false,
              createdAt: now.toISOString(),
            });
          }
        }
      }

      // Deadline Risk: SLA approaching
      if (init.sla_deadline && init.status !== 'CLOSED' /* DEC-424 (P12-int-c): DONE -> CLOSED */) {
        const daysUntilSla = Math.floor(
          (new Date(init.sla_deadline).getTime() - now.getTime()) / 86400000
        );
        if (daysUntilSla > 0 && daysUntilSla <= thresholds.warningDays) {
          signals.push({
            id: `deadline-risk-${init.id}`,
            projectId: init.project_id || undefined,
            entityType: 'INITIATIVE',
            entityId: init.id,
            entityName: init.name,
            deviationType: 'DEADLINE_RISK',
            severity: daysUntilSla <= 3 ? 'CRITICAL' : 'WARNING',
            daysDeviation: daysUntilSla,
            plannedDate: init.sla_deadline,
            actualOrCurrent: null,
            whySlipReasons: [],
            alertSentAt: null,
            isDismissed: false,
            createdAt: now.toISOString(),
          });
        }
      }
    }

    // Task-level deviations
    let taskQuery = `
      SELECT t.id, t.title, t.status, t.priority, t.due_date,
             t.initiative_id, t.assignee_id, i.project_id as project_id
      FROM tasks t
      JOIN initiatives i ON i.id = t.initiative_id
      WHERE i.organization_id = ?
        AND t.status NOT IN ('DONE', 'CANCELLED')
        AND t.due_date IS NOT NULL
    `;
    const taskParams: unknown[] = [organizationId];
    if (projectId) {
      taskQuery += ' AND i.project_id = ?';
      taskParams.push(projectId);
    }
    taskQuery += ' LIMIT 200';

    const tasks = ((await dbAll(taskQuery, taskParams)) || []) as TaskRow[];

    for (const task of tasks) {
      const dueDate = task.due_date;
      if (!dueDate) continue;
      const due = new Date(dueDate);
      if (due >= now) continue;

      const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);
      if (daysOverdue < 1) continue;

      signals.push({
        id: `task-overdue-${task.id}`,
        projectId: task.project_id || undefined,
        entityType: 'TASK',
        entityId: task.id,
        entityName: task.title,
        deviationType: 'OVERDUE',
        severity: daysOverdue >= 7 ? 'CRITICAL' : 'WARNING',
        daysDeviation: daysOverdue,
        plannedDate: dueDate,
        actualOrCurrent: null,
        whySlipReasons: task.assignee_id
          ? []
          : [{ reason: 'NO_OWNER', detail: 'Task has no assignee' }],
        alertSentAt: null,
        isDismissed: false,
        createdAt: now.toISOString(),
      });
    }

    const visibleSignals = signals.filter((s) => !dismissedIds.has(String(s.id)));

    visibleSignals.sort((a, b) => {
      const sev = { CRITICAL: 2, WARNING: 1 };
      return (sev[b.severity] || 0) - (sev[a.severity] || 0) || b.daysDeviation - a.daysDeviation;
    });

    const cap = options?.maxSignals ?? 100;
    return cap > 0 ? visibleSignals.slice(0, cap) : visibleSignals;
  } catch (err) {
    // DEC-120/A1-A3: detectDelaySignals returns a plain array (DelaySignal[])
    // — the shape cannot carry a degraded flag without a breaking contract
    // change (blok B). This loud, tenant-scoped log is the only trace an
    // operator has that "0 delay signals" was actually a failure.
    logger.error('[delayDetectionService] detectDelaySignals failed', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
      projectId,
    });
    return [];
  }
}

// ── Persist & Throttle ─────────────────────────────────────────

export async function persistDelaySignals(
  organizationId: string,
  signals: DelaySignal[]
): Promise<{ persisted: number; alertsSent: number }> {
  let persisted = 0;
  let alertsSent = 0;
  const now = new Date();

  for (const sig of signals) {
    try {
      await dbRun(
        `INSERT INTO delay_signals
           (id, organization_id, project_id, entity_type, entity_id, entity_name, deviation_type,
            severity, days_deviation, planned_date, actual_or_current, why_slip_reasons, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::JSONB, NOW(), NOW())
         ON CONFLICT ON CONSTRAINT idx_delay_signals_unique_entity
         DO UPDATE SET
           severity = EXCLUDED.severity,
           days_deviation = EXCLUDED.days_deviation,
           actual_or_current = EXCLUDED.actual_or_current,
           why_slip_reasons = EXCLUDED.why_slip_reasons,
           project_id = COALESCE(EXCLUDED.project_id, delay_signals.project_id),
           updated_at = NOW()`,
        [
          sig.id,
          organizationId,
          sig.projectId || null,
          sig.entityType,
          sig.entityId,
          sig.entityName,
          sig.deviationType,
          sig.severity,
          sig.daysDeviation,
          sig.plannedDate,
          sig.actualOrCurrent,
          JSON.stringify(sig.whySlipReasons),
        ]
      );
      persisted++;

      // Throttled alert: max 1 per 24h per entity per deviation type
      const recentAlert = (await dbAll(
        `SELECT id FROM delay_alert_log
         WHERE entity_type = ? AND entity_id = ? AND deviation_type = ?
           AND sent_at > NOW() - INTERVAL '24 hours'
         LIMIT 1`,
        [sig.entityType, sig.entityId, sig.deviationType]
      )) as { id: string }[] | null;

      if (!recentAlert || recentAlert.length === 0) {
        await dbRun(
          `INSERT INTO delay_alert_log
             (id, organization_id, entity_type, entity_id, deviation_type, severity, sent_at)
           VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, ?, NOW())`,
          [organizationId, sig.entityType, sig.entityId, sig.deviationType, sig.severity]
        );
        alertsSent++;
      }
    } catch (err) {
      logger.error(`Failed to persist delay signal ${sig.id}`, err);
    }
  }

  return { persisted, alertsSent };
}

export async function getPersistedDelaySignals(
  organizationId: string,
  options?: {
    projectId?: string;
    severity?: DelaySeverity;
    entityType?: 'INITIATIVE' | 'TASK';
    includeDismissed?: boolean;
    limit?: number;
  }
): Promise<DelaySignal[]> {
  let query = `
    SELECT id, project_id, entity_type, entity_id, entity_name, deviation_type, severity,
           days_deviation, planned_date, actual_or_current, why_slip_reasons,
           alert_sent_at, is_dismissed, created_at
    FROM delay_signals
    WHERE organization_id = ?
  `;
  const params: unknown[] = [organizationId];

  if (!options?.includeDismissed) {
    query += ' AND is_dismissed = FALSE';
  }
  if (options?.projectId) {
    query += ' AND project_id = ?';
    params.push(options.projectId);
  }
  if (options?.severity) {
    query += ' AND severity = ?';
    params.push(options.severity);
  }
  if (options?.entityType) {
    query += ' AND entity_type = ?';
    params.push(options.entityType);
  }

  query +=
    " ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 END, days_deviation DESC";
  query += ` LIMIT ?`;
  params.push(options?.limit || 50);

  const rows = ((await dbAll(query, params)) || []) as Array<{
    id: string;
    project_id: string | null;
    entity_type: string;
    entity_id: string;
    entity_name: string;
    deviation_type: string;
    severity: string;
    days_deviation: number;
    planned_date: string | null;
    actual_or_current: string | null;
    why_slip_reasons: WhySlipContext[] | string;
    alert_sent_at: string | null;
    is_dismissed: boolean;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id || undefined,
    entityType: r.entity_type as 'INITIATIVE' | 'TASK',
    entityId: r.entity_id,
    entityName: r.entity_name,
    deviationType: r.deviation_type as DeviationType,
    severity: r.severity as DelaySeverity,
    daysDeviation: r.days_deviation,
    plannedDate: r.planned_date,
    actualOrCurrent: r.actual_or_current,
    whySlipReasons:
      typeof r.why_slip_reasons === 'string'
        ? JSON.parse(r.why_slip_reasons)
        : r.why_slip_reasons || [],
    alertSentAt: r.alert_sent_at,
    isDismissed: r.is_dismissed,
    createdAt: r.created_at,
  }));
}
