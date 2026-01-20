/**
 * Decision Service
 * FLOW-DECISION-001: Core decision management - "Heart of Consultinity"
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface Decision {
  id: string;
  organizationId: string;
  projectId?: string;
  initiativeId?: string;
  taskId?: string;
  title: string;
  description?: string;
  type: 'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER';
  decisionMakerId: string;
  options: DecisionOption[];
  criteria?: string;
  deadline?: string;
  escalationDeadline?: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired' | 'cancelled';
  selectedOption?: string;
  decisionRationale?: string;
  decidedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
}

export interface CreateDecisionInput {
  organizationId: string;
  projectId?: string;
  initiativeId?: string;
  taskId?: string;
  title: string;
  description?: string;
  type: 'GO_NO_GO' | 'APPROVAL' | 'RESOURCE_ALLOCATION' | 'OTHER';
  decisionMakerId: string;
  options?: DecisionOption[];
  criteria?: string;
  deadline?: string;
  stakeholderIds?: string[];
  createdBy: string;
}

export interface MakeDecisionInput {
  decisionId: string;
  selectedOption: string;
  rationale?: string;
  decidedBy: string;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class DecisionService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Create a new decision request
   */
  async createDecision(input: CreateDecisionInput): Promise<Decision> {
    const db = await this.getDb();
    const id = `decision-${uuidv4()}`;
    const now = new Date().toISOString();

    // Calculate escalation deadline (default: 7 days after deadline)
    const deadline = input.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const escalationDeadline = new Date(
      new Date(deadline).getTime() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Default options for GO_NO_GO
    const options =
      input.options ||
      (input.type === 'GO_NO_GO'
        ? [
            { id: 'go', label: 'Go', description: 'Proceed' },
            { id: 'no-go', label: 'No-Go', description: 'Do not proceed' },
          ]
        : [
            { id: 'approve', label: 'Approve' },
            { id: 'reject', label: 'Reject' },
          ]);

    await db.run(
      `INSERT INTO decisions (
                id, organization_id, project_id, initiative_id, task_id,
                title, description, type, decision_maker_id,
                options, criteria, deadline, escalation_deadline,
                status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.projectId || null,
        input.initiativeId || null,
        input.taskId || null,
        input.title,
        input.description || null,
        input.type,
        input.decisionMakerId,
        JSON.stringify(options),
        input.criteria || null,
        deadline,
        escalationDeadline,
        input.createdBy,
        now,
        now,
      ]
    );

    // Add stakeholders
    if (input.stakeholderIds && input.stakeholderIds.length > 0) {
      for (const stakeholderId of input.stakeholderIds) {
        await db.run(
          `INSERT INTO decision_stakeholders (id, decision_id, user_id, role)
                     VALUES (?, ?, ?, 'informed')`,
          [uuidv4(), id, stakeholderId]
        );
      }
    }

    // Record history
    await this.recordHistory(id, 'created', null, 'pending', input.createdBy);

    // Send notification to decision maker
    await this.notifyDecisionMaker(id, input.decisionMakerId, input.title);

    logger.info(`[DecisionService] Created decision ${id}: ${input.title}`);

    return this.getDecision(id) as Promise<Decision>;
  }

  /**
   * Get a decision by ID
   */
  async getDecision(id: string): Promise<Decision | null> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      organization_id: string;
      project_id: string | null;
      initiative_id: string | null;
      task_id: string | null;
      title: string;
      description: string | null;
      type: string;
      decision_maker_id: string;
      options: string;
      criteria: string | null;
      deadline: string | null;
      escalation_deadline: string | null;
      status: string;
      selected_option: string | null;
      decision_rationale: string | null;
      decided_at: string | null;
      created_by: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM decisions WHERE id = ?', [id]);

    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id || undefined,
      initiativeId: row.initiative_id || undefined,
      taskId: row.task_id || undefined,
      title: row.title,
      description: row.description || undefined,
      type: row.type as Decision['type'],
      decisionMakerId: row.decision_maker_id,
      options: JSON.parse(row.options || '[]'),
      criteria: row.criteria || undefined,
      deadline: row.deadline || undefined,
      escalationDeadline: row.escalation_deadline || undefined,
      status: row.status as Decision['status'],
      selectedOption: row.selected_option || undefined,
      decisionRationale: row.decision_rationale || undefined,
      decidedAt: row.decided_at || undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Make a decision
   */
  async makeDecision(input: MakeDecisionInput): Promise<Decision> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const decision = await this.getDecision(input.decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== 'pending' && decision.status !== 'escalated') {
      throw new Error(`Cannot make decision in status: ${decision.status}`);
    }

    const normalizedOption = input.selectedOption.toLowerCase();
    const nextStatus =
      normalizedOption === 'reject' || normalizedOption === 'no-go' ? 'rejected' : 'approved';

    await db.run(
      `UPDATE decisions SET
                status = ?,
                selected_option = ?,
                decision_rationale = ?,
                decided_at = ?,
                updated_at = ?
             WHERE id = ?`,
      [nextStatus, input.selectedOption, input.rationale || null, now, now, input.decisionId]
    );

    // Record history
    await this.recordHistory(
      input.decisionId,
      'decided',
      decision.status,
      nextStatus,
      input.decidedBy,
      {
        selectedOption: input.selectedOption,
        rationale: input.rationale,
      }
    );

    // Notify requester and stakeholders
    await this.notifyDecisionMade(input.decisionId, decision);

    // Unblock related task/initiative if applicable
    await this.unblockRelatedItems(decision);

    // AI Learning - record this decision for pattern learning
    await this.recordForAILearning(decision, input);

    logger.info(`[DecisionService] Decision ${input.decisionId} made: ${input.selectedOption}`);

    return this.getDecision(input.decisionId) as Promise<Decision>;
  }

  /**
   * Get pending decisions for a user (as decision maker)
   */
  async getPendingDecisions(userId: string, orgId: string): Promise<Decision[]> {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      organization_id: string;
      project_id: string | null;
      initiative_id: string | null;
      task_id: string | null;
      title: string;
      description: string | null;
      type: string;
      decision_maker_id: string;
      options: string;
      deadline: string | null;
      status: string;
      created_at: string;
    }>(
      `SELECT * FROM decisions 
             WHERE organization_id = ? 
             AND decision_maker_id = ? 
             AND status IN ('pending', 'escalated')
             ORDER BY deadline ASC`,
      [orgId, userId]
    );

    return (rows || []).map(
      (row) =>
        ({
          id: row.id,
          organizationId: row.organization_id,
          projectId: row.project_id || undefined,
          initiativeId: row.initiative_id || undefined,
          taskId: row.task_id || undefined,
          title: row.title,
          description: row.description || undefined,
          type: row.type as Decision['type'],
          decisionMakerId: row.decision_maker_id,
          options: JSON.parse(row.options || '[]'),
          deadline: row.deadline || undefined,
          status: row.status as Decision['status'],
          createdAt: row.created_at,
        }) as Decision
    );
  }

  /**
   * Escalate a decision
   */
  async escalateDecision(
    decisionId: string,
    escalatedBy: string,
    reason?: string
  ): Promise<Decision> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const decision = await this.getDecision(decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== 'pending') {
      throw new Error(`Cannot escalate decision in status: ${decision.status}`);
    }

    await db.run(
      `UPDATE decisions SET
                status = 'escalated',
                updated_at = ?
             WHERE id = ?`,
      [now, decisionId]
    );

    // Record history
    await this.recordHistory(decisionId, 'escalated', 'pending', 'escalated', escalatedBy, {
      reason,
    });

    // TODO: Notify next-level decision maker
    logger.info(`[DecisionService] Decision ${decisionId} escalated`);

    return this.getDecision(decisionId) as Promise<Decision>;
  }

  /**
   * Cancel a decision
   */
  async cancelDecision(
    decisionId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<Decision> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const decision = await this.getDecision(decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status === 'approved' || decision.status === 'rejected') {
      throw new Error('Cannot cancel a decision that has already been made');
    }

    await db.run(
      `UPDATE decisions SET
                status = 'cancelled',
                updated_at = ?
             WHERE id = ?`,
      [now, decisionId]
    );

    await this.recordHistory(decisionId, 'cancelled', decision.status, 'cancelled', cancelledBy, {
      reason,
    });

    logger.info(`[DecisionService] Decision ${decisionId} cancelled`);

    return this.getDecision(decisionId) as Promise<Decision>;
  }

  /**
   * Get decisions for a project
   */
  async getProjectDecisions(projectId: string, orgId: string): Promise<Decision[]> {
    const db = await this.getDb();

    const rows = await db.all<{ id: string }>(
      `SELECT id FROM decisions 
             WHERE organization_id = ? AND project_id = ?
             ORDER BY created_at DESC`,
      [orgId, projectId]
    );

    const decisions: Decision[] = [];
    for (const row of rows || []) {
      const decision = await this.getDecision(row.id);
      if (decision) decisions.push(decision);
    }

    return decisions;
  }

  /**
   * Get decision history
   */
  async getDecisionHistory(decisionId: string): Promise<
    {
      id: string;
      action: string;
      oldStatus: string | null;
      newStatus: string | null;
      changedBy: string;
      changedAt: string;
      details: Record<string, unknown>;
    }[]
  > {
    const db = await this.getDb();

    const rows = await db.all<{
      id: string;
      action: string;
      old_status: string | null;
      new_status: string | null;
      changed_by: string;
      changed_at: string;
      details: string | null;
    }>(`SELECT * FROM decision_history WHERE decision_id = ? ORDER BY changed_at ASC`, [
      decisionId,
    ]);

    return (rows || []).map((row) => ({
      id: row.id,
      action: row.action,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      details: row.details ? JSON.parse(row.details) : {},
    }));
  }

  /**
   * Process expired decisions (called by cron)
   */
  async processExpiredDecisions(): Promise<{ expired: number; escalated: number }> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const results = { expired: 0, escalated: 0 };

    // Get decisions past escalation deadline that should expire
    const toExpire = await db.all<{ id: string }>(
      `SELECT id FROM decisions 
             WHERE status = 'escalated' 
             AND escalation_deadline < ?`,
      [now]
    );

    for (const row of toExpire || []) {
      await db.run(`UPDATE decisions SET status = 'expired', updated_at = ? WHERE id = ?`, [
        now,
        row.id,
      ]);
      await this.recordHistory(row.id, 'expired', 'escalated', 'expired', 'system');
      results.expired++;
    }

    // Get decisions past deadline that should be escalated
    const toEscalate = await db.all<{ id: string }>(
      `SELECT id FROM decisions 
             WHERE status = 'pending' 
             AND deadline < ?`,
      [now]
    );

    for (const row of toEscalate || []) {
      await this.escalateDecision(row.id, 'system', 'Auto-escalated: deadline passed');
      results.escalated++;
    }

    if (results.expired > 0 || results.escalated > 0) {
      logger.info(
        `[DecisionService] Processed: ${results.escalated} escalated, ${results.expired} expired`
      );
    }

    return results;
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async recordHistory(
    decisionId: string,
    action: string,
    oldStatus: string | null,
    newStatus: string | null,
    changedBy: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const db = await this.getDb();
    await db.run(
      `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        decisionId,
        action,
        oldStatus,
        newStatus,
        changedBy,
        details ? JSON.stringify(details) : null,
      ]
    );
  }

  private async notifyDecisionMaker(
    decisionId: string,
    decisionMakerId: string,
    title: string
  ): Promise<void> {
    try {
      // TODO: Integrate with notification service
      logger.info(
        `[DecisionService] Notification sent to ${decisionMakerId} for decision ${decisionId}`
      );
    } catch (err) {
      logger.warn(`[DecisionService] Failed to notify decision maker:`, err);
    }
  }

  private async notifyDecisionMade(decisionId: string, decision: Decision): Promise<void> {
    try {
      // TODO: Notify requester and stakeholders
      logger.info(`[DecisionService] Decision made notification sent for ${decisionId}`);
    } catch (err) {
      logger.warn(`[DecisionService] Failed to notify decision made:`, err);
    }
  }

  private async unblockRelatedItems(decision: Decision): Promise<void> {
    // TODO: Update task/initiative status to unblocked
    if (decision.taskId) {
      logger.info(`[DecisionService] Unblocking task ${decision.taskId}`);
    }
    if (decision.initiativeId) {
      logger.info(`[DecisionService] Unblocking initiative ${decision.initiativeId}`);
    }
  }

  private async recordForAILearning(decision: Decision, input: MakeDecisionInput): Promise<void> {
    try {
      // TODO: Send to AI learning system
      logger.info(`[DecisionService] Recording decision for AI learning: ${decision.id}`);
    } catch (err) {
      logger.warn(`[DecisionService] Failed to record for AI learning:`, err);
    }
  }
}

// Export singleton
const decisionService = new DecisionService();
export default decisionService;

// Named exports
export const createDecision = (input: CreateDecisionInput) => decisionService.createDecision(input);
export const getDecision = (id: string) => decisionService.getDecision(id);
export const makeDecision = (input: MakeDecisionInput) => decisionService.makeDecision(input);
export const getPendingDecisions = (userId: string, orgId: string) =>
  decisionService.getPendingDecisions(userId, orgId);
export const escalateDecision = (id: string, by: string, reason?: string) =>
  decisionService.escalateDecision(id, by, reason);
export const cancelDecision = (id: string, by: string, reason?: string) =>
  decisionService.cancelDecision(id, by, reason);
export const getProjectDecisions = (projectId: string, orgId: string) =>
  decisionService.getProjectDecisions(projectId, orgId);
export const getDecisionHistory = (id: string) => decisionService.getDecisionHistory(id);
export const processExpiredDecisions = () => decisionService.processExpiredDecisions();
