/**
 * Escalation Service
 * Handles automatic escalation logic, notifications, and escalation rules
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ==========================================
// TYPES
// ==========================================

export interface EscalationRule {
  id: string;
  name: string;
  contextType: 'initiative' | 'task' | 'analysis' | 'assessment' | 'tool' | 'project';
  decisionType?: string;
  amberThresholdDays: number;
  redThresholdDays: number;
  autoEscalate: boolean;
  notifyOnAmber: boolean;
  notifyOnRed: boolean;
  escalateToRole?: string;
  organizationId: string;
}

export interface EscalationResult {
  decisionId: string;
  previousLevel: 'none' | 'amber' | 'red';
  newLevel: 'none' | 'amber' | 'red';
  overdueDays: number;
  action: 'none' | 'amber_alert' | 'red_alert' | 'escalated';
}

export interface EscalationSummary {
  processed: number;
  amberAlerts: number;
  redAlerts: number;
  escalated: number;
  errors: number;
}

interface DecisionRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  initiative_id: string | null;
  task_id: string | null;
  type: string;
  deadline: string | null;
  status: string;
  priority: string | null;
  impact: string | null;
  escalation_level: string | null;
  decision_maker_id: string;
  created_at: string;
}

// ==========================================
// CONSTANTS
// ==========================================

const DEFAULT_AMBER_THRESHOLD_DAYS = 5;
const DEFAULT_RED_THRESHOLD_DAYS = 7;

// ==========================================
// ESCALATION LOGIC
// ==========================================

/**
 * Calculate escalation level based on due date and thresholds
 */
export function calculateEscalationLevel(
  dueDate: string | null | undefined,
  priority: string | null | undefined,
  impact: string | null | undefined,
  amberThreshold: number = DEFAULT_AMBER_THRESHOLD_DAYS,
  redThreshold: number = DEFAULT_RED_THRESHOLD_DAYS
): { level: 'none' | 'amber' | 'red'; overdueDays: number } {
  if (!dueDate) {
    return { level: 'none', overdueDays: 0 };
  }

  const due = new Date(dueDate);
  if (isNaN(due.getTime())) {
    return { level: 'none', overdueDays: 0 };
  }

  const now = Date.now();
  const diffDays = Math.floor((now - due.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { level: 'none', overdueDays: 0 };
  }

  // Critical priority or high impact decisions escalate to red faster
  const isCritical = priority?.toUpperCase() === 'CRITICAL' || impact?.toUpperCase() === 'HIGH';

  if (isCritical) {
    // Critical decisions: any overdue = red
    return { level: 'red', overdueDays: diffDays };
  }

  if (diffDays > redThreshold) {
    return { level: 'red', overdueDays: diffDays };
  }

  if (diffDays > amberThreshold) {
    return { level: 'amber', overdueDays: diffDays };
  }

  return { level: 'amber', overdueDays: diffDays };
}

/**
 * Get escalation rules for an organization
 */
export async function getEscalationRules(organizationId: string): Promise<EscalationRule[]> {
  try {
    const rules = await queryHelpers.queryAll<EscalationRule>(
      `SELECT * FROM escalation_rules WHERE organization_id = ? AND is_active = 1`,
      [organizationId]
    );
    return rules || [];
  } catch (error) {
    // Table may not exist, return defaults
    return [];
  }
}

/**
 * Get default escalation thresholds
 */
export function getDefaultThresholds(decisionType?: string): { amber: number; red: number } {
  // Different decision types might have different thresholds
  const thresholds: Record<string, { amber: number; red: number }> = {
    INITIATIVE_APPROVAL: { amber: 3, red: 7 },
    PHASE_TRANSITION: { amber: 2, red: 5 },
    BUDGET: { amber: 3, red: 7 },
    SCOPE_CHANGE: { amber: 3, red: 7 },
    BLOCKER_RESOLUTION: { amber: 1, red: 3 },
    RISK_ACCEPTANCE: { amber: 2, red: 5 },
    EXECUTION: { amber: 2, red: 5 },
  };

  return (
    thresholds[decisionType || ''] || {
      amber: DEFAULT_AMBER_THRESHOLD_DAYS,
      red: DEFAULT_RED_THRESHOLD_DAYS,
    }
  );
}

// ==========================================
// SERVICE CLASS
// ==========================================

export class EscalationService {
  /**
   * A projectId alone carries no org context — without this check, any
   * authenticated caller who knew/guessed a projectId belonging to another
   * organization could read (`getEscalations`) or mutate
   * (`runAutoEscalation`) that project's decision-escalation state via
   * GET/POST /notifications/escalations/:projectId(/run), bypassing the org
   * boundary entirely.
   */
  private static async projectBelongsToOrg(
    projectId: string,
    organizationId: string
  ): Promise<boolean> {
    if (!projectId || !organizationId) return false;
    const project = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [projectId, organizationId]
    );
    return !!project;
  }

  /**
   * Get escalations for a project (used by notifications routes)
   */
  static async getEscalations(projectId: string, organizationId: string, status?: string) {
    if (!(await this.projectBelongsToOrg(projectId, organizationId))) {
      return [];
    }

    const params: any[] = [projectId];
    let sql = `
      SELECT *
      FROM decisions
      WHERE project_id = ?
        AND (status = 'escalated' OR escalation_level IS NOT NULL)
    `;
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY deadline ASC, created_at DESC`;
    return await queryHelpers.queryAll(sql, params);
  }

  /**
   * Run auto-escalation for a specific project (used by notifications routes)
   */
  static async runAutoEscalation(projectId: string, organizationId: string) {
    if (!(await this.projectBelongsToOrg(projectId, organizationId))) {
      return { projectId, processed: 0, amberAlerts: 0, redAlerts: 0, escalated: 0, errors: 0 };
    }

    const decisions = await queryHelpers.queryAll<DecisionRow>(
      `SELECT * FROM decisions
       WHERE project_id = ?
         AND status IN ('pending', 'escalated')
         AND deadline IS NOT NULL`,
      [projectId]
    );

    let processed = 0;
    let escalated = 0;
    let amberAlerts = 0;
    let redAlerts = 0;
    let errors = 0;

    for (const decision of decisions || []) {
      try {
        const { level, overdueDays } = calculateEscalationLevel(
          decision.deadline,
          decision.priority,
          decision.impact
        );
        processed++;

        const prev = (decision.escalation_level || 'none') as any;
        if (level === prev) continue;

        if (level === 'amber') amberAlerts++;
        if (level === 'red') redAlerts++;

        await queryHelpers.queryRun(
          `UPDATE decisions SET escalation_level = ?, updated_at = datetime('now') WHERE id = ?`,
          [level, decision.id]
        );

        if (level === 'red' && decision.status !== 'escalated') {
          await queryHelpers.queryRun(
            `UPDATE decisions SET status = 'escalated', updated_at = datetime('now') WHERE id = ?`,
            [decision.id]
          );
          escalated++;
        }

        logger.info(
          `[EscalationService] Project ${projectId}: decision ${decision.id} ${prev} -> ${level} (overdueDays=${overdueDays})`
        );
      } catch (err) {
        errors++;
        logger.warn('[EscalationService] runAutoEscalation decision error:', err);
      }
    }

    return { projectId, processed, amberAlerts, redAlerts, escalated, errors };
  }

  /**
   * Process escalations for all pending decisions in an organization
   */
  static async processEscalations(organizationId: string): Promise<EscalationSummary> {
    const summary: EscalationSummary = {
      processed: 0,
      amberAlerts: 0,
      redAlerts: 0,
      escalated: 0,
      errors: 0,
    };

    try {
      // Get all pending decisions
      const decisions = await queryHelpers.queryAll<DecisionRow>(
        `SELECT * FROM decisions 
         WHERE organization_id = ? 
         AND status IN ('pending', 'escalated')
         AND deadline IS NOT NULL`,
        [organizationId]
      );

      if (!decisions || decisions.length === 0) {
        return summary;
      }

      // Get escalation rules
      const rules = await getEscalationRules(organizationId);

      // Process each decision
      for (const decision of decisions) {
        try {
          const result = await this.processDecisionEscalation(decision, rules);
          summary.processed++;

          if (result.action === 'amber_alert') {
            summary.amberAlerts++;
          } else if (result.action === 'red_alert') {
            summary.redAlerts++;
          } else if (result.action === 'escalated') {
            summary.escalated++;
          }
        } catch (error) {
          summary.errors++;
          logger.error(`Failed to process escalation for decision ${decision.id}:`, error);
        }
      }

      return summary;
    } catch (error) {
      logger.error('Failed to process escalations:', error);
      throw error;
    }
  }

  /**
   * Process escalation for a single decision
   */
  static async processDecisionEscalation(
    decision: DecisionRow,
    rules: EscalationRule[] = []
  ): Promise<EscalationResult> {
    const result: EscalationResult = {
      decisionId: decision.id,
      previousLevel: (decision.escalation_level as 'none' | 'amber' | 'red') || 'none',
      newLevel: 'none',
      overdueDays: 0,
      action: 'none',
    };

    // Get thresholds (from rules or defaults)
    const thresholds = getDefaultThresholds(decision.type);
    const rule = rules.find(
      (r) =>
        r.decisionType === decision.type ||
        (r.contextType === 'initiative' && decision.initiative_id) ||
        (r.contextType === 'task' && decision.task_id)
    );

    const amberThreshold = rule?.amberThresholdDays ?? thresholds.amber;
    const redThreshold = rule?.redThresholdDays ?? thresholds.red;

    // Calculate new escalation level
    const escalation = calculateEscalationLevel(
      decision.deadline,
      decision.priority,
      decision.impact,
      amberThreshold,
      redThreshold
    );

    result.newLevel = escalation.level;
    result.overdueDays = escalation.overdueDays;

    // Determine action
    if (result.newLevel !== result.previousLevel) {
      if (result.newLevel === 'red' && result.previousLevel !== 'red') {
        result.action = 'red_alert';
      } else if (result.newLevel === 'amber' && result.previousLevel === 'none') {
        result.action = 'amber_alert';
      }

      // Update decision
      const shouldEscalateStatus = result.newLevel === 'red' && rule?.autoEscalate !== false;
      const newStatus = shouldEscalateStatus ? 'escalated' : decision.status;

      await queryHelpers.queryRun(
        `UPDATE decisions 
         SET escalation_level = ?, 
             status = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [result.newLevel, newStatus, decision.id]
      );

      // Log to history
      await queryHelpers.queryRun(
        `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          decision.id,
          result.action === 'red_alert' ? 'auto_escalated' : 'escalation_level_changed',
          decision.status,
          newStatus,
          'system',
          JSON.stringify({
            previousLevel: result.previousLevel,
            newLevel: result.newLevel,
            overdueDays: result.overdueDays,
            autoEscalated: shouldEscalateStatus,
          }),
        ]
      );

      if (shouldEscalateStatus) {
        result.action = 'escalated';
      }
    }

    return result;
  }

  /**
   * Get escalation status for a decision
   */
  static async getEscalationStatus(decisionId: string): Promise<{
    level: 'none' | 'amber' | 'red';
    overdueDays: number;
    isBlocking: boolean;
    blockedItemsCount: number;
  }> {
    const decision = await queryHelpers.queryOne<DecisionRow>(
      `SELECT d.*, 
        (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = TRUE) as blocked_count
       FROM decisions d
       WHERE d.id = ?`,
      [decisionId]
    );

    if (!decision) {
      return { level: 'none', overdueDays: 0, isBlocking: false, blockedItemsCount: 0 };
    }

    const escalation = calculateEscalationLevel(
      decision.deadline,
      decision.priority,
      decision.impact
    );

    const blockedCount = (decision as any).blocked_count || 0;

    return {
      level: escalation.level,
      overdueDays: escalation.overdueDays,
      isBlocking: blockedCount > 0,
      blockedItemsCount: blockedCount,
    };
  }

  /**
   * Get all decisions that need attention (amber or red level)
   */
  static async getDecisionsNeedingAttention(organizationId: string): Promise<{
    amber: DecisionRow[];
    red: DecisionRow[];
    blocking: DecisionRow[];
  }> {
    const decisions = await queryHelpers.queryAll<DecisionRow>(
      `SELECT d.*, 
        (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = TRUE) as blocked_count
       FROM decisions d
       WHERE d.organization_id = ?
       AND d.status IN ('pending', 'escalated')`,
      [organizationId]
    );

    const result = {
      amber: [] as DecisionRow[],
      red: [] as DecisionRow[],
      blocking: [] as DecisionRow[],
    };

    if (!decisions) return result;

    for (const decision of decisions) {
      const escalation = calculateEscalationLevel(
        decision.deadline,
        decision.priority,
        decision.impact
      );

      if (escalation.level === 'red') {
        result.red.push(decision);
      } else if (escalation.level === 'amber') {
        result.amber.push(decision);
      }

      if ((decision as any).blocked_count > 0) {
        result.blocking.push(decision);
      }
    }

    return result;
  }

  /**
   * Get escalation history for a decision
   */
  static async getEscalationHistory(decisionId: string): Promise<any[]> {
    const history = await queryHelpers.queryAll(
      `SELECT * FROM decision_history 
       WHERE decision_id = ? 
       AND (action LIKE '%escalat%' OR details LIKE '%escalat%' OR details LIKE '%Level%')
       ORDER BY changed_at ASC`,
      [decisionId]
    );

    return history || [];
  }

  /**
   * Create a new escalation rule
   */
  static async createEscalationRule(rule: Omit<EscalationRule, 'id'>): Promise<EscalationRule> {
    const id = uuidv4();

    try {
      await queryHelpers.queryRun(
        `INSERT INTO escalation_rules (
          id, name, context_type, decision_type, 
          amber_threshold_days, red_threshold_days,
          auto_escalate, notify_on_amber, notify_on_red,
          escalate_to_role, organization_id, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [
          id,
          rule.name,
          rule.contextType,
          rule.decisionType || null,
          rule.amberThresholdDays,
          rule.redThresholdDays,
          rule.autoEscalate ? 1 : 0,
          rule.notifyOnAmber ? 1 : 0,
          rule.notifyOnRed ? 1 : 0,
          rule.escalateToRole || null,
          rule.organizationId,
        ]
      );

      return { ...rule, id };
    } catch (error) {
      // Table might not exist, log and continue
      logger.warn('Could not create escalation rule, table may not exist:', error);
      return { ...rule, id };
    }
  }

  /**
   * Manually escalate a decision
   */
  static async escalateDecision(
    decisionId: string,
    escalatedBy: string,
    reason?: string,
    escalateToUserId?: string
  ): Promise<void> {
    const decision = await queryHelpers.queryOne<DecisionRow>(
      `SELECT * FROM decisions WHERE id = ?`,
      [decisionId]
    );

    if (!decision) {
      throw new Error('Decision not found');
    }

    const newOwnerId = escalateToUserId || decision.decision_maker_id;

    await queryHelpers.queryRun(
      `UPDATE decisions 
       SET status = 'escalated', 
           escalation_level = 'red',
           decision_maker_id = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newOwnerId, decisionId]
    );

    await queryHelpers.queryRun(
      `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
       VALUES (?, ?, 'manually_escalated', ?, 'escalated', ?, ?)`,
      [
        uuidv4(),
        decisionId,
        decision.status,
        escalatedBy,
        JSON.stringify({
          reason: reason || 'Manual escalation',
          escalatedTo: newOwnerId,
          previousOwner: decision.decision_maker_id,
        }),
      ]
    );
  }
}

export default EscalationService;
