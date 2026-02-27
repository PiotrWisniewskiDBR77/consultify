/**
 * Trigger Evaluation Service (T062)
 *
 * Periodically scans for event signals (delay, risk, budget)
 * and fires report generation when conditions are met.
 * Enforces throttling (max 1/24h per project per trigger type).
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ============================================
// TYPES
// ============================================

export type TriggerType =
  | 'delay_threshold'
  | 'risk_high'
  | 'budget_threshold'
  | 'milestone_reached'
  | 'artifact_approved';

export interface TriggerRule {
  id: string;
  scheduleId: string;
  triggerType: TriggerType;
  conditions: TriggerConditions;
  isActive: boolean;
  throttleHours: number;
  lastFiredAt: string | null;
  fireCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerConditions {
  threshold?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  delayDays?: number;
  budgetPercent?: number;
  milestoneStatus?: string;
  artifactStatus?: string;
}

export interface TriggerSignal {
  triggerType: TriggerType;
  projectId: string;
  reason: string;
  signalData: Record<string, unknown>;
}

export interface TriggerFireResult {
  ruleId: string;
  scheduleId: string;
  triggerType: TriggerType;
  projectId: string;
  fired: boolean;
  throttled: boolean;
  reason: string;
  executionId?: string;
}

// ============================================
// TRIGGER RULE CRUD
// ============================================

export async function createTriggerRule(
  scheduleId: string,
  triggerType: TriggerType,
  conditions: TriggerConditions,
  throttleHours: number = 24
): Promise<TriggerRule> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await dbRun(
    `INSERT INTO schedule_trigger_rules
       (id, schedule_id, trigger_type, conditions_json, is_active, throttle_hours, fire_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, 0, ?, ?)`,
    [id, scheduleId, triggerType, JSON.stringify(conditions), throttleHours, now, now]
  );

  return {
    id,
    scheduleId,
    triggerType,
    conditions,
    isActive: true,
    throttleHours,
    lastFiredAt: null,
    fireCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getTriggerRules(scheduleId: string): Promise<TriggerRule[]> {
  const rows = await dbAll(
    `SELECT * FROM schedule_trigger_rules WHERE schedule_id = ? ORDER BY created_at ASC`,
    [scheduleId]
  );
  return rows.map(mapRowToRule);
}

export async function getTriggerRule(ruleId: string): Promise<TriggerRule | null> {
  const row = await dbGet(`SELECT * FROM schedule_trigger_rules WHERE id = ?`, [ruleId]);
  return row ? mapRowToRule(row) : null;
}

export async function updateTriggerRule(
  ruleId: string,
  updates: Partial<Pick<TriggerRule, 'conditions' | 'isActive' | 'throttleHours'>>
): Promise<TriggerRule | null> {
  const existing = await getTriggerRule(ruleId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const conditions = updates.conditions ?? existing.conditions;
  const isActive = updates.isActive ?? existing.isActive;
  const throttleHours = updates.throttleHours ?? existing.throttleHours;

  await dbRun(
    `UPDATE schedule_trigger_rules
     SET conditions_json = ?, is_active = ?, throttle_hours = ?, updated_at = ?
     WHERE id = ?`,
    [JSON.stringify(conditions), isActive ? 1 : 0, throttleHours, now, ruleId]
  );

  return { ...existing, conditions, isActive, throttleHours, updatedAt: now };
}

export async function deleteTriggerRule(ruleId: string): Promise<boolean> {
  const result = await dbRun(`DELETE FROM schedule_trigger_rules WHERE id = ?`, [ruleId]);
  return (result as any).changes > 0;
}

// ============================================
// SIGNAL SCANNING
// ============================================

/**
 * Scan for delay signals: projects with overdue planned end dates
 */
async function scanDelaySignals(organizationId: string): Promise<TriggerSignal[]> {
  const signals: TriggerSignal[] = [];
  try {
    const rows = (await dbAll(
      `SELECT id, name, planned_end_date, status
       FROM projects
       WHERE organization_id = ?
         AND status NOT IN ('completed', 'cancelled', 'COMPLETED', 'CANCELLED')
         AND planned_end_date IS NOT NULL
         AND planned_end_date < datetime('now')`,
      [organizationId]
    )) as any[];

    for (const row of rows) {
      const delayDays = Math.floor(
        (Date.now() - new Date(row.planned_end_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      signals.push({
        triggerType: 'delay_threshold',
        projectId: row.id,
        reason: `Project "${row.name}" overdue by ${delayDays} days`,
        signalData: { projectName: row.name, delayDays, plannedEnd: row.planned_end_date },
      });
    }
  } catch (err) {
    logger.warn('[TriggerEval] Error scanning delay signals:', err);
  }
  return signals;
}

/**
 * Scan for risk signals: high/critical risks in RAID
 */
async function scanRiskSignals(organizationId: string): Promise<TriggerSignal[]> {
  const signals: TriggerSignal[] = [];
  try {
    const rows = (await dbAll(
      `SELECT r.id, r.title, r.severity, r.project_id, p.name as project_name
       FROM raid_items r
       JOIN projects p ON r.project_id = p.id
       WHERE p.organization_id = ?
         AND r.type = 'RISK'
         AND r.severity IN ('high', 'critical', 'HIGH', 'CRITICAL')
         AND r.status NOT IN ('closed', 'mitigated', 'CLOSED', 'MITIGATED')`,
      [organizationId]
    )) as any[];

    for (const row of rows) {
      signals.push({
        triggerType: 'risk_high',
        projectId: row.project_id,
        reason: `High/critical risk: "${row.title}" (${row.severity})`,
        signalData: {
          riskId: row.id,
          riskTitle: row.title,
          severity: row.severity,
          projectName: row.project_name,
        },
      });
    }
  } catch (err) {
    logger.warn('[TriggerEval] Error scanning risk signals:', err);
  }
  return signals;
}

/**
 * Scan for budget signals: projects exceeding consumption thresholds
 */
async function scanBudgetSignals(organizationId: string): Promise<TriggerSignal[]> {
  const signals: TriggerSignal[] = [];
  try {
    const rows = (await dbAll(
      `SELECT id, name, budget_planned, budget_actual
       FROM projects
       WHERE organization_id = ?
         AND budget_planned > 0
         AND budget_actual IS NOT NULL`,
      [organizationId]
    )) as any[];

    for (const row of rows) {
      const consumptionPct = Math.round((row.budget_actual / row.budget_planned) * 100);
      if (consumptionPct >= 80) {
        signals.push({
          triggerType: 'budget_threshold',
          projectId: row.id,
          reason: `Budget consumption at ${consumptionPct}% for "${row.name}"`,
          signalData: {
            projectName: row.name,
            budgetPlanned: row.budget_planned,
            budgetActual: row.budget_actual,
            consumptionPct,
          },
        });
      }
    }
  } catch (err) {
    logger.warn('[TriggerEval] Error scanning budget signals:', err);
  }
  return signals;
}

// ============================================
// THROTTLE CHECK
// ============================================

async function isThrottled(
  ruleId: string,
  projectId: string,
  throttleHours: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - throttleHours * 60 * 60 * 1000).toISOString();

  const row = (await dbGet(
    `SELECT COUNT(*) as cnt FROM trigger_fire_log
     WHERE rule_id = ? AND project_id = ? AND fired_at > ? AND throttled = 0`,
    [ruleId, projectId, cutoff]
  )) as { cnt?: number } | undefined;

  return (row?.cnt ?? 0) > 0;
}

// ============================================
// TRIGGER EVALUATION
// ============================================

/**
 * Evaluate all active trigger rules for an organization.
 * Returns array of fire results.
 */
export async function evaluateTriggers(organizationId: string): Promise<TriggerFireResult[]> {
  const results: TriggerFireResult[] = [];

  const scheduleRows = (await dbAll(
    `SELECT rs.*, str.id as rule_id, str.trigger_type, str.conditions_json,
            str.is_active as rule_active, str.throttle_hours
     FROM report_schedules rs
     JOIN schedule_trigger_rules str ON str.schedule_id = rs.id
     WHERE rs.organization_id = ?
       AND rs.is_active = 1
       AND rs.schedule_type IN ('event_triggered', 'hybrid')
       AND str.is_active = 1`,
    [organizationId]
  )) as any[];

  if (scheduleRows.length === 0) return results;

  const [delaySignals, riskSignals, budgetSignals] = await Promise.all([
    scanDelaySignals(organizationId),
    scanRiskSignals(organizationId),
    scanBudgetSignals(organizationId),
  ]);

  const allSignals = [...delaySignals, ...riskSignals, ...budgetSignals];

  for (const row of scheduleRows) {
    const ruleId = row.rule_id;
    const triggerType = row.trigger_type as TriggerType;
    const conditions: TriggerConditions = JSON.parse(row.conditions_json || '{}');
    const throttleHours = row.throttle_hours || 24;

    const matchingSignals = allSignals.filter((s) => s.triggerType === triggerType);

    for (const signal of matchingSignals) {
      if (!matchesConditions(signal, conditions)) continue;

      const throttled = await isThrottled(ruleId, signal.projectId, throttleHours);

      const logId = uuidv4();
      await dbRun(
        `INSERT INTO trigger_fire_log
           (id, schedule_id, rule_id, trigger_type, scope_type, scope_id, project_id,
            fired_at, reason, signal_data_json, throttled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          row.id,
          ruleId,
          triggerType,
          row.scope_type,
          row.scope_id,
          signal.projectId,
          new Date().toISOString(),
          signal.reason,
          JSON.stringify(signal.signalData),
          throttled ? 1 : 0,
        ]
      );

      if (throttled) {
        results.push({
          ruleId,
          scheduleId: row.id,
          triggerType,
          projectId: signal.projectId,
          fired: false,
          throttled: true,
          reason: `Throttled: already fired within ${throttleHours}h`,
        });
        continue;
      }

      await dbRun(
        `UPDATE schedule_trigger_rules
         SET last_fired_at = ?, fire_count = fire_count + 1, updated_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), new Date().toISOString(), ruleId]
      );

      results.push({
        ruleId,
        scheduleId: row.id,
        triggerType,
        projectId: signal.projectId,
        fired: true,
        throttled: false,
        reason: signal.reason,
      });
    }
  }

  return results;
}

/**
 * Check if a signal matches the rule conditions
 */
function matchesConditions(signal: TriggerSignal, conditions: TriggerConditions): boolean {
  switch (signal.triggerType) {
    case 'delay_threshold': {
      const minDays = conditions.delayDays ?? 1;
      return (signal.signalData.delayDays as number) >= minDays;
    }
    case 'risk_high': {
      if (conditions.severity) {
        const severityRank: Record<string, number> = {
          low: 1,
          medium: 2,
          high: 3,
          critical: 4,
        };
        const signalSeverity = String(signal.signalData.severity).toLowerCase();
        return (severityRank[signalSeverity] || 0) >= (severityRank[conditions.severity] || 3);
      }
      return true;
    }
    case 'budget_threshold': {
      const threshold = conditions.budgetPercent ?? 90;
      return (signal.signalData.consumptionPct as number) >= threshold;
    }
    case 'milestone_reached':
    case 'artifact_approved':
      return true;
    default:
      return false;
  }
}

/**
 * Get trigger fire log for a schedule
 */
export async function getTriggerFireLog(scheduleId: string, limit: number = 20): Promise<any[]> {
  const rows = await dbAll(
    `SELECT * FROM trigger_fire_log
     WHERE schedule_id = ?
     ORDER BY fired_at DESC
     LIMIT ?`,
    [scheduleId, limit]
  );

  return rows.map((row: any) => ({
    id: row.id,
    scheduleId: row.schedule_id,
    ruleId: row.rule_id,
    triggerType: row.trigger_type,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    projectId: row.project_id,
    firedAt: row.fired_at,
    reason: row.reason,
    signalData: JSON.parse(row.signal_data_json || '{}'),
    executionId: row.execution_id,
    throttled: Boolean(row.throttled),
  }));
}

// ============================================
// HELPERS
// ============================================

function mapRowToRule(row: any): TriggerRule {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    triggerType: row.trigger_type,
    conditions: JSON.parse(row.conditions_json || '{}'),
    isActive: Boolean(row.is_active),
    throttleHours: row.throttle_hours || 24,
    lastFiredAt: row.last_fired_at,
    fireCount: row.fire_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
