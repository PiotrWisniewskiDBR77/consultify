/**
 * Decision Escalation Chain Service
 * Manages escalation chains, auto-escalation, and notifications for decisions
 *
 * Features:
 * - Define escalation chains per decision or organization
 * - Auto-escalate overdue decisions based on chain
 * - Send notifications at each escalation level
 * - Audit trail of all escalations
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import notificationService from './notificationService.js';

// ==========================================
// TYPES
// ==========================================

export interface EscalationChainLevel {
  id: string;
  decisionId?: string;
  organizationId?: string;
  level: number;
  escalateToUserId?: string;
  escalateToRole?: string;
  delayHours: number;
  notifyChannels: string;
  notifyMessage?: string;
}

export interface EscalationLogEntry {
  id: string;
  decisionId: string;
  fromLevel: number;
  toLevel: number;
  fromUserId?: string;
  toUserId?: string;
  reason: string;
  triggeredBy: string;
  triggerType: 'auto' | 'manual' | 'threshold';
  createdAt: string;
}

export interface EscalationTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  chainConfig: EscalationChainLevel[];
  warningHours: number;
  criticalHours: number;
}

interface DecisionRow {
  id: string;
  organization_id: string;
  title: string;
  status: string;
  due_date?: string;
  deadline?: string;
  priority?: string;
  escalation_level: number;
  escalated_at?: string;
  decider_id?: string;
  decision_maker_id?: string;
  backup_decider_id?: string;
  last_reminder_sent_at?: string;
}

// ==========================================
// SERVICE CLASS
// ==========================================

export class DecisionEscalationChainService {
  // ==========================================
  // ESCALATION CHAIN MANAGEMENT
  // ==========================================

  /**
   * Get escalation chain for a decision
   */
  static async getEscalationChain(decisionId: string): Promise<EscalationChainLevel[]> {
    const chain = await queryHelpers.queryAll<any>(
      `SELECT * FROM decision_escalation_chain 
       WHERE decision_id = ? 
       ORDER BY level ASC`,
      [decisionId]
    );

    if (chain && chain.length > 0) {
      return chain.map(this.mapChainLevel);
    }

    // Fall back to organization default
    const decision = await queryHelpers.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM decisions WHERE id = ?`,
      [decisionId]
    );

    if (decision?.organization_id) {
      return this.getOrganizationDefaultChain(decision.organization_id);
    }

    return this.getSystemDefaultChain();
  }

  /**
   * Set escalation chain for a decision
   */
  static async setEscalationChain(
    decisionId: string,
    chain: Omit<EscalationChainLevel, 'id'>[],
    createdBy: string
  ): Promise<EscalationChainLevel[]> {
    // Get organization_id
    const decision = await queryHelpers.queryOne<{ organization_id: string }>(
      `SELECT organization_id FROM decisions WHERE id = ?`,
      [decisionId]
    );

    // Delete existing chain
    await queryHelpers.queryRun(`DELETE FROM decision_escalation_chain WHERE decision_id = ?`, [
      decisionId,
    ]);

    // Insert new chain
    const result: EscalationChainLevel[] = [];
    for (const level of chain) {
      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO decision_escalation_chain (
          id, decision_id, organization_id, level, 
          escalate_to_user_id, escalate_to_role, 
          delay_hours, notify_channels, notify_message, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          decisionId,
          decision?.organization_id || null,
          level.level,
          level.escalateToUserId || null,
          level.escalateToRole || null,
          level.delayHours,
          level.notifyChannels || 'in-app,email',
          level.notifyMessage || null,
          createdBy,
        ]
      );
      result.push({ ...level, id });
    }

    logger.info(
      `[DecisionEscalationChainService] Set chain for decision ${decisionId}: ${chain.length} levels`
    );
    return result;
  }

  /**
   * Get organization default escalation chain
   */
  static async getOrganizationDefaultChain(
    organizationId: string
  ): Promise<EscalationChainLevel[]> {
    const template = await queryHelpers.queryOne<{ chain_config: string }>(
      `SELECT chain_config FROM decision_escalation_templates 
       WHERE organization_id = ? AND is_default = 1`,
      [organizationId]
    );

    if (template?.chain_config) {
      try {
        return JSON.parse(template.chain_config);
      } catch {
        // Fall through to system default
      }
    }

    return this.getSystemDefaultChain();
  }

  /**
   * Get system default escalation chain
   */
  static getSystemDefaultChain(): EscalationChainLevel[] {
    return [
      {
        id: 'default-1',
        level: 1,
        escalateToRole: 'backup_decider',
        delayHours: 24,
        notifyChannels: 'in-app,email',
        notifyMessage: 'Decision requires attention - escalated to backup',
      },
      {
        id: 'default-2',
        level: 2,
        escalateToRole: 'pmo_lead',
        delayHours: 48,
        notifyChannels: 'in-app,email',
        notifyMessage: 'Decision overdue - escalated to PMO',
      },
      {
        id: 'default-3',
        level: 3,
        escalateToRole: 'project_sponsor',
        delayHours: 72,
        notifyChannels: 'in-app,email,urgent',
        notifyMessage: 'Critical: Decision requires executive attention',
      },
    ];
  }

  // ==========================================
  // AUTO-ESCALATION
  // ==========================================

  /**
   * Check and escalate overdue decisions (cron job)
   */
  static async checkAndEscalateOverdue(options: { limit?: number } = {}): Promise<{
    processed: number;
    escalated: number;
    notified: number;
    errors: number;
  }> {
    const { limit = 100 } = options;
    const nowIso = new Date().toISOString();
    const results = { processed: 0, escalated: 0, notified: 0, errors: 0 };

    // Get overdue pending decisions
    const decisions = await queryHelpers.queryAll<DecisionRow>(
      `SELECT 
        id, organization_id, title, status, priority,
        COALESCE(due_date, deadline) as due_date,
        escalation_level, escalated_at,
        COALESCE(decider_id, decision_maker_id) as decider_id,
        backup_decider_id, last_reminder_sent_at
       FROM decisions
       WHERE 
         status IN ('pending', 'PENDING', 'escalated', 'ESCALATED')
         AND COALESCE(due_date, deadline) IS NOT NULL
         AND COALESCE(due_date, deadline) < ?
       ORDER BY COALESCE(due_date, deadline) ASC
       LIMIT ?`,
      [nowIso, limit]
    );

    for (const decision of decisions || []) {
      results.processed++;

      try {
        const dueDate = decision.due_date ? new Date(decision.due_date) : null;
        if (!dueDate || isNaN(dueDate.getTime())) continue;

        const overdueHours = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60));
        const currentLevel = decision.escalation_level || 0;

        // Get escalation chain
        const chain = await this.getEscalationChain(decision.id);

        // Find next escalation level
        const nextLevelConfig = chain.find(
          (c) => c.level > currentLevel && overdueHours >= c.delayHours
        );

        if (nextLevelConfig) {
          // Escalate
          await this.escalateToLevel(
            decision,
            nextLevelConfig,
            'auto',
            'Automatic escalation - decision overdue'
          );
          results.escalated++;
          results.notified++;
        } else if (currentLevel === 0 && overdueHours >= 0) {
          // Send reminder without escalating
          const lastReminder = decision.last_reminder_sent_at
            ? new Date(decision.last_reminder_sent_at).getTime()
            : 0;
          const hoursSinceReminder = (Date.now() - lastReminder) / (1000 * 60 * 60);

          if (hoursSinceReminder >= 24) {
            await this.sendOverdueReminder(decision, overdueHours);
            results.notified++;
          }
        }
      } catch (err: any) {
        results.errors++;
        logger.warn(
          `[DecisionEscalationChainService] Error processing decision ${decision.id}:`,
          err.message
        );
      }
    }

    if (results.escalated > 0 || results.notified > 0) {
      logger.info(
        `[DecisionEscalationChainService] Processed ${results.processed}, escalated ${results.escalated}, notified ${results.notified}`
      );
    }

    return results;
  }

  /**
   * Escalate decision to specific level
   */
  static async escalateToLevel(
    decision: DecisionRow,
    levelConfig: EscalationChainLevel,
    triggeredBy: string,
    reason: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const previousLevel = decision.escalation_level || 0;

    // Find the user to escalate to
    let newDeciderId = levelConfig.escalateToUserId;

    if (!newDeciderId && levelConfig.escalateToRole) {
      newDeciderId = await this.resolveRoleToUser(decision, levelConfig.escalateToRole);
    }

    // Update decision
    await queryHelpers.queryRun(
      `UPDATE decisions SET 
        escalation_level = ?,
        escalated_at = ?,
        escalated_by = ?,
        escalation_reason = ?,
        ${newDeciderId ? 'decider_id = ?,' : ''}
        ${newDeciderId ? 'decision_maker_id = ?,' : ''}
        updated_at = ?
       WHERE id = ?`,
      newDeciderId
        ? [
            levelConfig.level,
            nowIso,
            triggeredBy,
            reason,
            newDeciderId,
            newDeciderId,
            nowIso,
            decision.id,
          ]
        : [levelConfig.level, nowIso, triggeredBy, reason, nowIso, decision.id]
    );

    // Log escalation
    await queryHelpers.queryRun(
      `INSERT INTO decision_escalation_log (
        id, decision_id, organization_id,
        from_level, to_level, from_user_id, to_user_id,
        reason, triggered_by, trigger_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        decision.id,
        decision.organization_id,
        previousLevel,
        levelConfig.level,
        decision.decider_id || null,
        newDeciderId || null,
        reason,
        triggeredBy,
        triggeredBy === 'auto' ? 'auto' : 'manual',
        nowIso,
      ]
    );

    // Send notification
    if (newDeciderId) {
      await this.sendEscalationNotification(decision, newDeciderId, levelConfig, reason);
    }

    logger.info(
      `[DecisionEscalationChainService] Escalated decision ${decision.id} from level ${previousLevel} to ${levelConfig.level}`
    );
  }

  /**
   * Manual escalation
   */
  static async manualEscalate(
    decisionId: string,
    escalatedBy: string,
    reason: string,
    escalateToUserId?: string
  ): Promise<void> {
    const decision = await queryHelpers.queryOne<DecisionRow>(
      `SELECT * FROM decisions WHERE id = ?`,
      [decisionId]
    );

    if (!decision) {
      throw new Error('Decision not found');
    }

    const currentLevel = decision.escalation_level || 0;
    const chain = await this.getEscalationChain(decisionId);

    // Find next level or create ad-hoc level
    let nextLevel = chain.find((c) => c.level > currentLevel);

    if (!nextLevel) {
      nextLevel = {
        id: 'manual',
        level: currentLevel + 1,
        escalateToUserId,
        delayHours: 0,
        notifyChannels: 'in-app,email',
      };
    }

    if (escalateToUserId) {
      nextLevel.escalateToUserId = escalateToUserId;
    }

    await this.escalateToLevel(decision, nextLevel, escalatedBy, reason);
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  /**
   * Send escalation notification
   */
  private static async sendEscalationNotification(
    decision: DecisionRow,
    toUserId: string,
    levelConfig: EscalationChainLevel,
    reason: string
  ): Promise<void> {
    try {
      const levelNames: Record<number, string> = {
        1: 'Backup Decider',
        2: 'PMO Lead',
        3: 'Project Sponsor',
      };

      const priority =
        levelConfig.level >= 3 ? 'urgent' : levelConfig.level >= 2 ? 'high' : 'normal';

      await notificationService.send({
        userId: toUserId,
        organizationId: decision.organization_id,
        type: 'decision_escalated',
        title: `Decision Escalated (Level ${levelConfig.level})`,
        body:
          levelConfig.notifyMessage ||
          `Decision "${decision.title}" has been escalated to you as ${levelNames[levelConfig.level] || `Level ${levelConfig.level}`}. Reason: ${reason}`,
        entityType: 'decision',
        entityId: decision.id,
        actionUrl: `/my-work?decision=${decision.id}`,
        priority,
      });

      // Also notify previous decider
      if (decision.decider_id && decision.decider_id !== toUserId) {
        await notificationService.send({
          userId: decision.decider_id,
          organizationId: decision.organization_id,
          type: 'decision_escalated_from',
          title: 'Decision Escalated',
          body: `Decision "${decision.title}" has been escalated from you. Reason: ${reason}`,
          entityType: 'decision',
          entityId: decision.id,
          actionUrl: `/my-work?decision=${decision.id}`,
          priority: 'normal',
        });
      }
    } catch (err: any) {
      logger.warn(
        `[DecisionEscalationChainService] Failed to send escalation notification:`,
        err.message
      );
    }
  }

  /**
   * Send overdue reminder (without escalating)
   */
  private static async sendOverdueReminder(
    decision: DecisionRow,
    overdueHours: number
  ): Promise<void> {
    const nowIso = new Date().toISOString();

    if (!decision.decider_id) return;

    try {
      const overdueDays = Math.floor(overdueHours / 24);
      const priority = overdueDays >= 3 ? 'high' : 'normal';

      await notificationService.send({
        userId: decision.decider_id,
        organizationId: decision.organization_id,
        type: 'decision_overdue',
        title: overdueDays > 0 ? `Decision Overdue (${overdueDays}d)` : 'Decision Due Today',
        body: `Decision "${decision.title}" requires your attention.`,
        entityType: 'decision',
        entityId: decision.id,
        actionUrl: `/my-work?decision=${decision.id}`,
        priority,
      });

      // Update last reminder time
      await queryHelpers.queryRun(`UPDATE decisions SET last_reminder_sent_at = ? WHERE id = ?`, [
        nowIso,
        decision.id,
      ]);
    } catch (err: any) {
      logger.warn(`[DecisionEscalationChainService] Failed to send overdue reminder:`, err.message);
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Resolve role to specific user ID
   */
  private static async resolveRoleToUser(
    decision: DecisionRow,
    role: string
  ): Promise<string | undefined> {
    switch (role) {
      case 'backup_decider':
        return decision.backup_decider_id || undefined;

      case 'pmo_lead':
        // Find PMO lead for the organization
        const pmoLead = await queryHelpers.queryOne<{ user_id: string }>(
          `SELECT user_id FROM organization_members 
           WHERE organization_id = ? AND role IN ('pmo_lead', 'admin')
           LIMIT 1`,
          [decision.organization_id]
        );
        return pmoLead?.user_id;

      case 'project_sponsor':
        // Find project sponsor
        const sponsor = await queryHelpers.queryOne<{ sponsor_id: string }>(
          `SELECT sponsor_id FROM projects 
           WHERE id = (SELECT project_id FROM decisions WHERE id = ?)`,
          [decision.id]
        );
        return sponsor?.sponsor_id;

      default:
        return undefined;
    }
  }

  /**
   * Map database row to EscalationChainLevel
   */
  private static mapChainLevel(row: any): EscalationChainLevel {
    return {
      id: row.id,
      decisionId: row.decision_id,
      organizationId: row.organization_id,
      level: row.level,
      escalateToUserId: row.escalate_to_user_id,
      escalateToRole: row.escalate_to_role,
      delayHours: row.delay_hours,
      notifyChannels: row.notify_channels || 'in-app,email',
      notifyMessage: row.notify_message,
    };
  }

  // ==========================================
  // ESCALATION LOG
  // ==========================================

  /**
   * Get escalation history for a decision
   */
  static async getEscalationLog(decisionId: string): Promise<EscalationLogEntry[]> {
    const logs = await queryHelpers.queryAll<any>(
      `SELECT * FROM decision_escalation_log 
       WHERE decision_id = ? 
       ORDER BY created_at ASC`,
      [decisionId]
    );

    return (logs || []).map((row) => ({
      id: row.id,
      decisionId: row.decision_id,
      fromLevel: row.from_level,
      toLevel: row.to_level,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      reason: row.reason,
      triggeredBy: row.triggered_by,
      triggerType: row.trigger_type,
      createdAt: row.created_at,
    }));
  }

  // ==========================================
  // TEMPLATES
  // ==========================================

  /**
   * Create escalation template for organization
   */
  static async createTemplate(
    template: Omit<EscalationTemplate, 'id'>
  ): Promise<EscalationTemplate> {
    const id = uuidv4();
    const nowIso = new Date().toISOString();

    // If this is default, unset other defaults
    if (template.isDefault) {
      await queryHelpers.queryRun(
        `UPDATE decision_escalation_templates SET is_default = 0 WHERE organization_id = ?`,
        [template.organizationId]
      );
    }

    await queryHelpers.queryRun(
      `INSERT INTO decision_escalation_templates (
        id, organization_id, name, description, is_default,
        chain_config, warning_hours, critical_hours, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        template.organizationId,
        template.name,
        template.description || null,
        template.isDefault ? 1 : 0,
        JSON.stringify(template.chainConfig),
        template.warningHours,
        template.criticalHours,
        nowIso,
      ]
    );

    return { ...template, id };
  }

  /**
   * Get templates for organization
   */
  static async getTemplates(organizationId: string): Promise<EscalationTemplate[]> {
    const templates = await queryHelpers.queryAll<any>(
      `SELECT * FROM decision_escalation_templates WHERE organization_id = ?`,
      [organizationId]
    );

    return (templates || []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      isDefault: !!row.is_default,
      chainConfig: row.chain_config ? JSON.parse(row.chain_config) : [],
      warningHours: row.warning_hours,
      criticalHours: row.critical_hours,
    }));
  }
}

export default DecisionEscalationChainService;
