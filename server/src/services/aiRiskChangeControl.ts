/**
 * AI Risk & Change Control Service
 *
 * Monitors and detects risks proactively. Tracks scope changes.
 * AI warns before escalation, never auto-reprioritizes.
 */

import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';

// Use any to avoid type mismatch with DbPromise internal types
type Database = any;

const deps = {
  db: null as Database | null,
  uuidv4,
};

const getDb = (): Database | null => deps.db;

export const RISK_TYPES = {
  DELIVERY: 'delivery',
  CAPACITY: 'capacity',
  DEPENDENCY: 'dependency',
  DECISION: 'decision',
  CHANGE_FATIGUE: 'change_fatigue',
} as const;

export const RISK_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export const CHANGE_TYPES = {
  ADD: 'add',
  REMOVE: 'remove',
  MODIFY: 'modify',
  EXPAND: 'expand',
  REDUCE: 'reduce',
} as const;

type RiskType = (typeof RISK_TYPES)[keyof typeof RISK_TYPES];
type RiskSeverity = (typeof RISK_SEVERITY)[keyof typeof RISK_SEVERITY];
type ChangeType = (typeof CHANGE_TYPES)[keyof typeof CHANGE_TYPES];

type AffectedEntity = {
  type: string;
  id: string;
  name?: string;
};

type RiskRecord = {
  projectId: string;
  organizationId?: string | null;
  riskType: RiskType;
  severity: RiskSeverity;
  title: string;
  description: string;
  triggerConditions: string;
  affectedEntities: AffectedEntity[];
};

type RiskSummary = {
  projectId: string;
  risksDetected: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  risks: RiskRecord[];
  requiresEscalation: boolean;
};

type RiskRow = {
  id: string;
  risk_type: string;
  severity: string;
  title: string;
  description: string;
  trigger_conditions: string;
  affected_entities?: string | null;
  detected_at?: string | null;
  status?: string | null;
  owner_first?: string | null;
  owner_last?: string | null;
};

const parseJsonArray = (value: string | null | undefined): AffectedEntity[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const dbAll = <T>(sql: string, params: unknown[]): Promise<T[]> => {
  const db = getDb();
  if (db) {
    return DbPromise.all<T>(db, sql, params);
  }
  return DbPromise.all<T>(sql, params);
};

const dbGet = <T>(sql: string, params: unknown[]): Promise<T | null> => {
  const db = getDb();
  if (db) {
    return DbPromise.get<T>(db, sql, params);
  }
  return DbPromise.get<T>(sql, params);
};

const dbRun = (sql: string, params: unknown[]): Promise<DbPromise.RunResult> => {
  const db = getDb();
  if (db) {
    return DbPromise.run(db, sql, params, { fallback: false });
  }
  return DbPromise.run(sql, params, { fallback: false });
};

const AIRiskChangeControl = {
  RISK_TYPES,
  RISK_SEVERITY,
  CHANGE_TYPES,

  setDependencies: (newDeps: Partial<typeof deps> = {}): void => {
    Object.assign(deps, newDeps);
  },

  detectRisks: async (projectId: string): Promise<RiskSummary> => {
    const risks: RiskRecord[] = [];
    const orgId = await AIRiskChangeControl._getOrgId(projectId);

    const deliveryRisks = await AIRiskChangeControl._detectDeliveryRisks(projectId);
    risks.push(...deliveryRisks);

    const capacityRisks = await AIRiskChangeControl._detectCapacityRisks(projectId);
    risks.push(...capacityRisks);

    const dependencyRisks = await AIRiskChangeControl._detectDependencyRisks(projectId);
    risks.push(...dependencyRisks);

    const decisionRisks = await AIRiskChangeControl._detectDecisionRisks(projectId);
    risks.push(...decisionRisks);

    const fatigueRisks = await AIRiskChangeControl._detectChangeFatigueRisks(projectId);
    risks.push(...fatigueRisks);

    for (const risk of risks) {
      await AIRiskChangeControl._registerRisk({
        ...risk,
        projectId,
        organizationId: orgId,
      });
    }

    return {
      projectId,
      risksDetected: risks.length,
      bySeverity: {
        critical: risks.filter((risk) => risk.severity === RISK_SEVERITY.CRITICAL).length,
        high: risks.filter((risk) => risk.severity === RISK_SEVERITY.HIGH).length,
        medium: risks.filter((risk) => risk.severity === RISK_SEVERITY.MEDIUM).length,
        low: risks.filter((risk) => risk.severity === RISK_SEVERITY.LOW).length,
      },
      byType: Object.values(RISK_TYPES).reduce(
        (acc, type) => {
          acc[type] = risks.filter((risk) => risk.riskType === type).length;
          return acc;
        },
        {} as Record<string, number>
      ),
      risks,
      requiresEscalation: risks.some((risk) => risk.severity === RISK_SEVERITY.CRITICAL),
    };
  },

  _detectDeliveryRisks: async (projectId: string): Promise<RiskRecord[]> => {
    const risks: RiskRecord[] = [];

    const overdueTasks = await dbAll<{ id: string; title?: string; due_date: string }>(
      `
                SELECT t.*, i.title as initiative_name
                FROM tasks t
                LEFT JOIN initiatives i ON t.initiative_id = i.id
                WHERE t.project_id = ?
                AND t.status != 'DONE'
                AND t.due_date < date('now')
            `,
      [projectId]
    );

    if (overdueTasks.length > 0) {
      const avgDaysOverdue =
        overdueTasks.reduce((sum, task) => {
          return (
            sum +
            Math.floor((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24))
          );
        }, 0) / overdueTasks.length;

      risks.push({
        projectId,
        riskType: RISK_TYPES.DELIVERY,
        severity: overdueTasks.length > 5 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        title: `${overdueTasks.length} overdue tasks detected`,
        description: `Average ${Math.round(avgDaysOverdue)} days overdue`,
        triggerConditions: `${overdueTasks.length} tasks past due date`,
        affectedEntities: overdueTasks.map((task) => ({
          type: 'task',
          id: task.id,
          name: task.title,
        })),
      });
    }

    const stalledInitiatives = await dbAll<{ id: string; name?: string }>(
      `
                SELECT * FROM initiatives
                WHERE project_id = ?
                AND status IN ('IN_EXECUTION', 'APPROVED')  -- DEC-424 (P12-int-c): EXECUTING -> IN_EXECUTION
                AND updated_at < datetime('now', '-14 days')
            `,
      [projectId]
    );

    if (stalledInitiatives.length > 0) {
      risks.push({
        projectId,
        riskType: RISK_TYPES.DELIVERY,
        severity: RISK_SEVERITY.MEDIUM,
        title: `${stalledInitiatives.length} stalled initiatives`,
        description: 'Initiatives with no updates for 14+ days',
        triggerConditions: 'No status updates in 14 days',
        affectedEntities: stalledInitiatives.map((initiative) => ({
          type: 'initiative',
          id: initiative.id,
          name: initiative.name,
        })),
      });
    }

    return risks;
  },

  _detectCapacityRisks: async (projectId: string): Promise<RiskRecord[]> => {
    const risks: RiskRecord[] = [];

    const overloadedUsers = await dbAll<{
      id: string;
      first_name?: string;
      last_name?: string;
      task_count: number;
    }>(
      `
                SELECT u.id, u.first_name, u.last_name, COUNT(t.id) as task_count
                FROM tasks t
                JOIN users u ON t.assignee_id = u.id
                WHERE t.project_id = ?
                AND t.status != 'DONE'
                GROUP BY u.id
                HAVING task_count > 10
            `,
      [projectId]
    );

    if (overloadedUsers.length > 0) {
      risks.push({
        projectId,
        riskType: RISK_TYPES.CAPACITY,
        severity: overloadedUsers.some((user) => user.task_count > 20)
          ? RISK_SEVERITY.HIGH
          : RISK_SEVERITY.MEDIUM,
        title: `${overloadedUsers.length} team members potentially overloaded`,
        description: 'Users with 10+ active tasks assigned',
        triggerConditions: 'Task count exceeds healthy threshold',
        affectedEntities: overloadedUsers.map((user) => ({
          type: 'user',
          id: user.id,
          name: `${user.first_name || ''} ${user.last_name || ''} (${user.task_count} tasks)`.trim(),
        })),
      });
    }

    return risks;
  },

  _detectDependencyRisks: async (projectId: string): Promise<RiskRecord[]> => {
    const risks: RiskRecord[] = [];

    const blockedTasks = await dbAll<{ id: string; title?: string }>(
      `
                SELECT * FROM tasks
                WHERE project_id = ?
                AND status = 'BLOCKED'
            `,
      [projectId]
    );

    if (blockedTasks.length > 0) {
      risks.push({
        projectId,
        riskType: RISK_TYPES.DEPENDENCY,
        severity: blockedTasks.length > 3 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        title: `${blockedTasks.length} tasks blocked`,
        description: 'Tasks waiting on dependencies or decisions',
        triggerConditions: 'Task status = BLOCKED',
        affectedEntities: blockedTasks.map((task) => ({
          type: 'task',
          id: task.id,
          name: task.title,
        })),
      });
    }

    const blockedDeps = await dbAll<{ id: string; from_name?: string; to_name?: string }>(
      `
                SELECT id.*, 
                    fi.name as from_name, ti.name as to_name
                FROM initiative_dependencies id
                JOIN initiatives fi ON id.from_initiative_id = fi.id
                JOIN initiatives ti ON id.to_initiative_id = ti.id
                WHERE ti.project_id = ?
                AND id.is_satisfied = 0
                AND ti.status IN ('IN_EXECUTION', 'APPROVED')  -- DEC-424 (P12-int-c): EXECUTING -> IN_EXECUTION
            `,
      [projectId]
    );

    if (blockedDeps.length > 0) {
      risks.push({
        projectId,
        riskType: RISK_TYPES.DEPENDENCY,
        severity: RISK_SEVERITY.MEDIUM,
        title: `${blockedDeps.length} unsatisfied initiative dependencies`,
        description: 'Initiatives waiting on predecessor completion',
        triggerConditions: 'Dependency not satisfied',
        affectedEntities: blockedDeps.map((dependency) => ({
          type: 'dependency',
          id: dependency.id,
          name: `${dependency.to_name} waiting on ${dependency.from_name}`,
        })),
      });
    }

    return risks;
  },

  _detectDecisionRisks: async (projectId: string): Promise<RiskRecord[]> => {
    const risks: RiskRecord[] = [];

    const pendingDecisions = await dbAll<{ id: string; title?: string; created_at: string }>(
      `
                SELECT * FROM decisions
                WHERE project_id = ?
                AND status = 'PENDING'
                AND created_at < datetime('now', '-7 days')
            `,
      [projectId]
    );

    if (pendingDecisions.length > 0) {
      const avgDays =
        pendingDecisions.reduce((sum, decision) => {
          return (
            sum +
            Math.floor(
              (Date.now() - new Date(decision.created_at).getTime()) / (1000 * 60 * 60 * 24)
            )
          );
        }, 0) / pendingDecisions.length;

      risks.push({
        projectId,
        riskType: RISK_TYPES.DECISION,
        severity: avgDays > 14 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        title: `${pendingDecisions.length} decisions pending 7+ days`,
        description: `Average wait: ${Math.round(avgDays)} days. Decision debt accumulating.`,
        triggerConditions: 'Decision pending > 7 days',
        affectedEntities: pendingDecisions.map((decision) => ({
          type: 'decision',
          id: decision.id,
          name: decision.title,
        })),
      });
    }

    return risks;
  },

  _detectChangeFatigueRisks: async (projectId: string): Promise<RiskRecord[]> => {
    const risks: RiskRecord[] = [];

    const activeInitiatives = await dbGet<{ count?: number }>(
      `
                SELECT COUNT(*) as count FROM initiatives
                WHERE project_id = ?
                AND status IN ('IN_EXECUTION', 'APPROVED')  -- DEC-424 (P12-int-c): EXECUTING -> IN_EXECUTION
            `,
      [projectId]
    );

    const activeCount = activeInitiatives?.count || 0;
    if (activeCount > 10) {
      risks.push({
        projectId,
        riskType: RISK_TYPES.CHANGE_FATIGUE,
        severity: activeCount > 15 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        title: `High change volume: ${activeCount} active initiatives`,
        description: 'Too many simultaneous changes may overwhelm the organization',
        triggerConditions: 'Active initiatives > 10',
        affectedEntities: [],
      });
    }

    const recentChanges = await dbGet<{ count?: number }>(
      `
                SELECT COUNT(*) as count FROM scope_change_log
                WHERE project_id = ?
                AND changed_at > datetime('now', '-7 days')
            `,
      [projectId]
    );

    const recentCount = recentChanges?.count || 0;
    if (recentCount > 20) {
      risks.push({
        projectId,
        riskType: RISK_TYPES.CHANGE_FATIGUE,
        severity: RISK_SEVERITY.MEDIUM,
        title: `High scope volatility: ${recentCount} changes in 7 days`,
        description: 'Frequent scope changes may indicate instability',
        triggerConditions: 'Scope changes > 20 per week',
        affectedEntities: [],
      });
    }

    return risks;
  },

  _registerRisk: async (risk: RiskRecord): Promise<unknown> => {
    const existing = await dbGet<{ id?: string }>(
      `
                SELECT id FROM risk_register
                WHERE project_id = ? AND risk_type = ? AND title = ? AND status NOT IN ('resolved', 'accepted')
            `,
      [risk.projectId, risk.riskType, risk.title]
    );

    if (existing) {
      return existing;
    }

    const id = deps.uuidv4();

    await dbRun(
      `
                INSERT INTO risk_register 
                (id, project_id, organization_id, risk_type, severity, title, description, trigger_conditions, affected_entities)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
      [
        id,
        risk.projectId,
        risk.organizationId,
        risk.riskType,
        risk.severity,
        risk.title,
        risk.description,
        risk.triggerConditions,
        JSON.stringify(risk.affectedEntities),
      ]
    );

    return { id, ...risk };
  },

  explainRisk: async (
    riskId: string
  ): Promise<{
    riskId: string;
    type: string;
    severity: string;
    title: string;
    explanation: {
      what: string;
      why: string;
      impact: string;
      affectedItems: AffectedEntity[];
      suggestedAction: string;
    };
    detectedAt: string | null | undefined;
    status: string | null | undefined;
  }> => {
    const risk = await dbGet<RiskRow>('SELECT * FROM risk_register WHERE id = ?', [riskId]);

    if (!risk) {
      throw new Error('Risk not found');
    }

    const affectedEntities = parseJsonArray(risk.affected_entities);

    return {
      riskId,
      type: risk.risk_type,
      severity: risk.severity,
      title: risk.title,
      explanation: {
        what: risk.description,
        why: risk.trigger_conditions,
        impact: `Affects ${affectedEntities.length} items`,
        affectedItems: affectedEntities.slice(0, 5),
        suggestedAction: AIRiskChangeControl._suggestMitigation(
          risk.risk_type as RiskType,
          risk.severity as RiskSeverity
        ),
      },
      detectedAt: risk.detected_at,
      status: risk.status,
    };
  },

  _suggestMitigation: (riskType: RiskType, _severity: RiskSeverity): string => {
    const mitigations: Record<RiskType, string> = {
      [RISK_TYPES.DELIVERY]: 'Review task priorities and consider scope adjustment',
      [RISK_TYPES.CAPACITY]: 'Consider task reassignment or timeline extension',
      [RISK_TYPES.DEPENDENCY]: 'Escalate blocked dependencies to decision owners',
      [RISK_TYPES.DECISION]: 'Review decision backlog with governance team',
      [RISK_TYPES.CHANGE_FATIGUE]: 'Consider phasing initiatives to reduce parallel change',
    };

    return mitigations[riskType] || 'Review risk details and consult with project team';
  },

  preEscalationWarning: async (
    riskId: string
  ): Promise<{
    riskId: string;
    warningIssued: boolean;
    message: string;
    severity?: string;
    daysSinceDetection?: number;
    suggestedAction?: string;
    escalationDeadline?: string;
  } | null> => {
    const risk = await dbGet<RiskRow>('SELECT * FROM risk_register WHERE id = ?', [riskId]);

    if (!risk || risk.status === 'escalated') {
      return null;
    }

    const daysSinceDetection = Math.floor(
      (Date.now() - new Date(risk.detected_at || '').getTime()) / (1000 * 60 * 60 * 24)
    );
    const shouldEscalate =
      risk.severity === RISK_SEVERITY.CRITICAL ||
      (risk.severity === RISK_SEVERITY.HIGH && daysSinceDetection > 3) ||
      (risk.severity === RISK_SEVERITY.MEDIUM && daysSinceDetection > 7);

    if (!shouldEscalate) {
      return {
        riskId,
        warningIssued: false,
        message: 'Risk does not yet require escalation',
      };
    }

    return {
      riskId,
      warningIssued: true,
      message: `Risk "${risk.title}" requires attention. Will escalate if not addressed within 48 hours.`,
      severity: risk.severity,
      daysSinceDetection,
      suggestedAction: 'Acknowledge risk and assign mitigation owner',
      escalationDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };
  },

  trackScopeChange: async ({
    projectId,
    entityType,
    entityId,
    changeType,
    summary,
    field,
    previousValue,
    newValue,
    isControlled,
    reason,
    changedBy,
    approvedBy,
  }: {
    projectId: string;
    entityType: string;
    entityId: string;
    changeType: ChangeType;
    summary?: string | null;
    field?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    isControlled: boolean;
    reason?: string | null;
    changedBy?: string | null;
    approvedBy?: string | null;
  }): Promise<{
    id: string;
    projectId: string;
    entityType: string;
    entityId: string;
    changeType: ChangeType;
    isControlled: boolean;
  }> => {
    const id = deps.uuidv4();
    const orgId = await AIRiskChangeControl._getOrgId(projectId);

    await dbRun(
      `
                INSERT INTO scope_change_log 
                (id, project_id, organization_id, entity_type, entity_id, change_type, change_summary, field_changed, previous_value, new_value, is_controlled, change_reason, changed_by, approved_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
      [
        id,
        projectId,
        orgId,
        entityType,
        entityId,
        changeType,
        summary,
        field,
        previousValue,
        newValue,
        isControlled ? 1 : 0,
        reason,
        changedBy,
        approvedBy,
      ]
    );

    return { id, projectId, entityType, entityId, changeType, isControlled };
  },

  detectUncontrolledChanges: async (
    projectId: string,
    days = 7
  ): Promise<{
    projectId: string;
    uncontrolledChanges: number;
    changes: unknown[];
    scopeCreepWarning: boolean;
    message: string;
  }> => {
    const rows = await dbAll(
      `
                SELECT * FROM scope_change_log
                WHERE project_id = ?
                AND is_controlled = 0
                AND changed_at > datetime('now', '-${days} days')
                ORDER BY changed_at DESC
            `,
      [projectId]
    );

    const changes = rows || [];
    return {
      projectId,
      uncontrolledChanges: changes.length,
      changes,
      scopeCreepWarning: changes.length > 5,
      message:
        changes.length > 5
          ? `⚠️ ${changes.length} uncontrolled scope changes detected in last ${days} days`
          : 'Scope changes within normal parameters',
    };
  },

  getScopeChangeSummary: async (
    projectId: string,
    days = 30
  ): Promise<{
    projectId: string;
    periodDays: number;
    totalChanges: number;
    totalUncontrolled: number;
    byEntityType: Record<string, number>;
    byChangeType: Record<string, number>;
    controlRate: number;
  }> => {
    const rows = await dbAll<{
      entity_type: string;
      change_type: string;
      count: number;
      uncontrolled: number;
    }>(
      `
                SELECT 
                    entity_type,
                    change_type,
                    COUNT(*) as count,
                    SUM(CASE WHEN is_controlled = 0 THEN 1 ELSE 0 END) as uncontrolled
                FROM scope_change_log
                WHERE project_id = ?
                AND changed_at > datetime('now', '-${days} days')
                GROUP BY entity_type, change_type
            `,
      [projectId]
    );

    const summary = {
      projectId,
      periodDays: days,
      totalChanges: 0,
      totalUncontrolled: 0,
      byEntityType: {} as Record<string, number>,
      byChangeType: {} as Record<string, number>,
      controlRate: 100,
    };

    for (const row of rows || []) {
      summary.totalChanges += row.count;
      summary.totalUncontrolled += row.uncontrolled;
      summary.byEntityType[row.entity_type] =
        (summary.byEntityType[row.entity_type] || 0) + row.count;
      summary.byChangeType[row.change_type] =
        (summary.byChangeType[row.change_type] || 0) + row.count;
    }

    summary.controlRate =
      summary.totalChanges > 0
        ? Math.round(
            ((summary.totalChanges - summary.totalUncontrolled) / summary.totalChanges) * 100
          )
        : 100;

    return summary;
  },

  getOpenRisks: async (
    projectId: string
  ): Promise<
    Array<
      Omit<RiskRow, 'affected_entities'> & {
        affected_entities: AffectedEntity[];
        ownerName: string;
      }
    >
  > => {
    const rows = await dbAll<RiskRow>(
      `
                SELECT r.*, u.first_name as owner_first, u.last_name as owner_last
                FROM risk_register r
                LEFT JOIN users u ON r.owner_id = u.id
                WHERE r.project_id = ?
                AND r.status NOT IN ('resolved', 'accepted')
                ORDER BY 
                    CASE r.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                    r.detected_at ASC
            `,
      [projectId]
    );

    return (rows || []).map((row) => {
      const { affected_entities, ...rest } = row;
      return {
        ...rest,
        affected_entities: parseJsonArray(affected_entities),
        ownerName: row.owner_first ? `${row.owner_first} ${row.owner_last}` : 'Unassigned',
      };
    });
  },

  updateRiskStatus: async (
    riskId: string,
    { status, notes, ownerId }: { status: string; notes?: string; ownerId?: string }
  ): Promise<{ riskId: string; status: string; updated: boolean }> => {
    let sql = 'UPDATE risk_register SET status = ?';
    const params: Array<string> = [status];

    if (notes) {
      sql += ', resolution_notes = ?';
      params.push(notes);
    }
    if (ownerId) {
      sql += ', owner_id = ?';
      params.push(ownerId);
    }
    if (status === 'resolved') {
      sql += ', resolved_at = CURRENT_TIMESTAMP';
    }
    if (status === 'escalated') {
      sql += ', escalated_at = CURRENT_TIMESTAMP';
    }

    sql += ' WHERE id = ?';
    params.push(riskId);

    const result = await dbRun(sql, params);
    return { riskId, status, updated: (result.changes || 0) > 0 };
  },

  _getOrgId: async (projectId: string): Promise<string | null> => {
    const row = await dbGet<{ organization_id?: string }>(
      'SELECT organization_id FROM projects WHERE id = ?',
      [projectId]
    );
    return row?.organization_id || null;
  },
};

export default AIRiskChangeControl;
