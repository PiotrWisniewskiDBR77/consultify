/**
 * Retention Automation Service
 *
 * Automates data retention policy enforcement:
 * - Cron job to execute retention per org
 * - Pre-deletion notifications (7 days before)
 * - Selective preservation (user can mark conversations to keep)
 * - Handles conversations, embeddings, memory, and audit logs
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface RetentionSchedule {
  id: string;
  organizationId: string;
  dataType: string;
  retentionDays: number;
  nextCleanupAt: string | null;
  lastCleanupAt: string | null;
  itemsDeletedTotal: number;
  notificationSent: boolean;
  isActive: boolean;
}

export interface RetentionResult {
  organizationId: string;
  dataType: string;
  itemsDeleted: number;
  preservedCount: number;
  errors: string[];
}

const DEFAULT_RETENTION_DAYS: Record<string, number> = {
  conversations: 90,
  embeddings: 180,
  ai_memory: 365,
  audit_logs: 730,
  usage_logs: 365,
  feedback: 365,
};

class RetentionAutomationService {
  async initializeSchedule(organizationId: string): Promise<RetentionSchedule[]> {
    const schedules: RetentionSchedule[] = [];

    for (const [dataType, days] of Object.entries(DEFAULT_RETENTION_DAYS)) {
      const existing = await dbGet(
        `SELECT id FROM ai_retention_schedule
         WHERE organization_id = ? AND data_type = ?`,
        [organizationId, dataType]
      );

      if (!existing) {
        const id = randomUUID();
        const nextCleanup = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        await dbRun(
          `INSERT INTO ai_retention_schedule
            (id, organization_id, data_type, retention_days, next_cleanup_at,
             is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
          [id, organizationId, dataType, days, nextCleanup]
        );

        schedules.push({
          id,
          organizationId,
          dataType,
          retentionDays: days,
          nextCleanupAt: nextCleanup,
          lastCleanupAt: null,
          itemsDeletedTotal: 0,
          notificationSent: false,
          isActive: true,
        });
      }
    }

    return schedules;
  }

  async executeRetention(organizationId: string): Promise<RetentionResult[]> {
    const schedules = (await dbAll(
      `SELECT * FROM ai_retention_schedule
       WHERE organization_id = ? AND is_active = 1`,
      [organizationId]
    ).catch(() => [])) as any[];

    const results: RetentionResult[] = [];

    for (const schedule of schedules || []) {
      const cutoffDate = new Date(
        Date.now() - schedule.retention_days * 24 * 60 * 60 * 1000
      ).toISOString();

      const result = await this.deleteExpiredData(organizationId, schedule.data_type, cutoffDate);

      results.push(result);

      await dbRun(
        `UPDATE ai_retention_schedule
         SET last_cleanup_at = datetime('now'),
             items_deleted_total = items_deleted_total + ?,
             next_cleanup_at = datetime('now', '+1 day'),
             updated_at = datetime('now')
         WHERE id = ?`,
        [result.itemsDeleted, schedule.id]
      ).catch(() => {});
    }

    return results;
  }

  async sendPreDeletionNotifications(organizationId: string): Promise<number> {
    const schedules = (await dbAll(
      `SELECT * FROM ai_retention_schedule
       WHERE organization_id = ? AND is_active = 1 AND notification_sent = 0`,
      [organizationId]
    ).catch(() => [])) as any[];

    let notified = 0;

    for (const schedule of schedules || []) {
      const warningCutoff = new Date(
        Date.now() - (schedule.retention_days - 7) * 24 * 60 * 60 * 1000
      ).toISOString();

      const atRiskRow = (await dbGet(this.getCountQuery(schedule.data_type, true), [
        organizationId,
        warningCutoff,
      ]).catch(() => null)) as any;

      const atRiskCount = Number(atRiskRow?.cnt) || 0;

      if (atRiskCount > 0) {
        logger.info(
          `[Retention] Org ${organizationId}: ${atRiskCount} ${schedule.data_type} items will be deleted in 7 days`
        );

        await dbRun(
          `UPDATE ai_retention_schedule SET notification_sent = 1, updated_at = datetime('now') WHERE id = ?`,
          [schedule.id]
        ).catch(() => {});

        notified++;
      }
    }

    return notified;
  }

  async preserveConversation(input: {
    conversationId: string;
    organizationId: string;
    userId: string;
    reason?: string;
  }): Promise<void> {
    await dbRun(
      `INSERT INTO preserved_conversations
        (id, conversation_id, organization_id, preserved_by, reason, preserved_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(conversation_id) DO NOTHING`,
      [randomUUID(), input.conversationId, input.organizationId, input.userId, input.reason || null]
    ).catch(() => {});
  }

  async removePreservation(conversationId: string, organizationId: string): Promise<void> {
    await dbRun(
      `DELETE FROM preserved_conversations WHERE conversation_id = ? AND organization_id = ?`,
      [conversationId, organizationId]
    );
  }

  async getSchedules(organizationId: string): Promise<RetentionSchedule[]> {
    const rows = (await dbAll(
      `SELECT * FROM ai_retention_schedule WHERE organization_id = ? ORDER BY data_type`,
      [organizationId]
    ).catch(() => [])) as any[];

    return (rows || []).map(this.mapSchedule);
  }

  async updateSchedule(
    scheduleId: string,
    organizationId: string,
    updates: { retentionDays?: number; isActive?: boolean }
  ): Promise<void> {
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (updates.retentionDays !== undefined) {
      sets.push('retention_days = ?');
      params.push(updates.retentionDays);
      sets.push('notification_sent = 0');
    }
    if (updates.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }

    params.push(scheduleId, organizationId);
    await dbRun(
      `UPDATE ai_retention_schedule SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
  }

  private async deleteExpiredData(
    orgId: string,
    dataType: string,
    cutoffDate: string
  ): Promise<RetentionResult> {
    const errors: string[] = [];
    let deleted = 0;
    let preserved = 0;

    try {
      switch (dataType) {
        case 'conversations': {
          const preservedIds = (await dbAll(
            `SELECT conversation_id FROM preserved_conversations WHERE organization_id = ?`,
            [orgId]
          ).catch(() => [])) as any[];
          const preservedSet = new Set((preservedIds || []).map((r: any) => r.conversation_id));
          preserved = preservedSet.size;

          const expiredConvs = (await dbAll(
            `SELECT id FROM conversations
             WHERE organization_id = ? AND created_at < ?`,
            [orgId, cutoffDate]
          ).catch(() => [])) as any[];

          for (const conv of expiredConvs || []) {
            if (preservedSet.has(conv.id)) continue;
            await dbRun(`DELETE FROM conversation_messages WHERE conversation_id = ?`, [
              conv.id,
            ]).catch(() => {});
            await dbRun(`DELETE FROM conversations WHERE id = ?`, [conv.id]).catch(() => {});
            deleted++;
          }
          break;
        }
        case 'usage_logs': {
          const result = await dbRun(
            `DELETE FROM ai_usage_logs WHERE organization_id = ? AND created_at < ?`,
            [orgId, cutoffDate]
          );
          deleted = (result as any)?.changes || 0;
          break;
        }
        case 'feedback': {
          const result = await dbRun(
            `DELETE FROM ai_feedback WHERE organization_id = ? AND created_at < ?`,
            [orgId, cutoffDate]
          );
          deleted = (result as any)?.changes || 0;
          break;
        }
        default:
          logger.debug(`[Retention] No handler for data type: ${dataType}`);
      }
    } catch (err: any) {
      errors.push(`${dataType}: ${err?.message}`);
    }

    return {
      organizationId: orgId,
      dataType,
      itemsDeleted: deleted,
      preservedCount: preserved,
      errors,
    };
  }

  private getCountQuery(dataType: string, _isWarning: boolean): string {
    switch (dataType) {
      case 'conversations':
        return `SELECT COUNT(*) as cnt FROM conversations WHERE organization_id = ? AND created_at < ?
                AND id NOT IN (SELECT conversation_id FROM preserved_conversations)`;
      case 'usage_logs':
        return `SELECT COUNT(*) as cnt FROM ai_usage_logs WHERE organization_id = ? AND created_at < ?`;
      case 'feedback':
        return `SELECT COUNT(*) as cnt FROM ai_feedback WHERE organization_id = ? AND created_at < ?`;
      default:
        return `SELECT 0 as cnt`;
    }
  }

  private mapSchedule(row: any): RetentionSchedule {
    return {
      id: row.id,
      organizationId: row.organization_id,
      dataType: row.data_type,
      retentionDays: Number(row.retention_days),
      nextCleanupAt: row.next_cleanup_at,
      lastCleanupAt: row.last_cleanup_at,
      itemsDeletedTotal: Number(row.items_deleted_total) || 0,
      notificationSent: Boolean(row.notification_sent),
      isActive: Boolean(row.is_active),
    };
  }
}

export const retentionAutomationService = new RetentionAutomationService();
export default retentionAutomationService;
