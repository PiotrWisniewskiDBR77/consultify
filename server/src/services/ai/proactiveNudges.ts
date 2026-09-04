/**
 * Proactive Nudges Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Generates context-aware nudges based on stale tasks, upcoming deadlines, pending decisions.
 */
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

class ProactiveNudgesServiceImpl {
  async generateNudges(userId: string, orgId?: string) {
    const nudges: any[] = [];
    try {
      const stale = (await dbAll(
        `SELECT id,title FROM tasks WHERE assignee_id=? AND status!='done' AND updated_at < datetime('now','-7 days') LIMIT 5`,
        [userId]
      )) as any[];
      for (const t of stale || [])
        nudges.push({
          id: `nudge_task_${t.id}`,
          userId,
          type: 'stale_task',
          title: 'Zadanie wymaga uwagi',
          message: `"${t.title}" nie bylo aktualizowane 7+ dni`,
          priority: 'medium',
          actionUrl: `/tasks/${t.id}`,
          dismissed: false,
          createdAt: new Date().toISOString(),
        });

      const deadlines = (await dbAll(
        `SELECT id,title,due_date FROM tasks WHERE assignee_id=? AND status!='done' AND due_date IS NOT NULL AND due_date BETWEEN datetime('now') AND datetime('now','+3 days') LIMIT 5`,
        [userId]
      )) as any[];
      for (const t of deadlines || [])
        nudges.push({
          id: `nudge_deadline_${t.id}`,
          userId,
          type: 'upcoming_deadline',
          title: 'Termin',
          message: `"${t.title}" - termin ${t.due_date}`,
          priority: 'high',
          actionUrl: `/tasks/${t.id}`,
          dismissed: false,
          createdAt: new Date().toISOString(),
        });

      const decisions = (await dbAll(
        `SELECT id,title FROM decisions WHERE assigned_to=? AND status='pending' LIMIT 3`,
        [userId]
      )) as any[];
      for (const d of decisions || [])
        nudges.push({
          id: `nudge_decision_${d.id}`,
          userId,
          type: 'governance_gap',
          title: 'Decyzja oczekuje',
          message: `"${d.title}" czeka na rozpatrzenie`,
          priority: 'high',
          actionUrl: `/decisions/${d.id}`,
          dismissed: false,
          createdAt: new Date().toISOString(),
        });
    } catch (e) {
      logger.debug(`[ProactiveNudges] ${(e as Error).message}`);
    }
    logger.debug(`[ProactiveNudges] Generated ${nudges.length} nudges for ${userId}`);
    return nudges;
  }

  async dismissNudge(nudgeId: string, userId: string) {
    try {
      const result = await dbRun(
        `INSERT OR REPLACE INTO ai_dismissed_nudges (nudge_id,user_id,dismissed_at) VALUES (?,?,datetime('now'))`,
        [nudgeId, userId]
      );
      if (!result?.success) return { dismissed: false };
      return { dismissed: true };
    } catch {
      return { dismissed: false };
    }
  }

  async getActiveNudges(userId: string, orgId?: string) {
    const all = await this.generateNudges(userId, orgId);
    try {
      const dismissed = (await dbAll(`SELECT nudge_id FROM ai_dismissed_nudges WHERE user_id=?`, [
        userId,
      ])) as any[];
      const ids = new Set((dismissed || []).map((d: any) => d.nudge_id));
      return all.filter((n) => !ids.has(n.id));
    } catch {
      return all;
    }
  }

  async getPendingNudges(userId: string, orgId?: string, limit = 10, offset = 0) {
    const active = await this.getActiveNudges(userId, orgId);
    return active.slice(offset, offset + limit);
  }

  async trackActivity(
    userId: string,
    orgId: string,
    activity: { type: string; entityId: string; action: string }
  ) {
    try {
      await dbRun(
        `INSERT INTO ai_nudge_activity (user_id, organization_id, activity_type, entity_id, action) VALUES (?, ?, ?, ?, ?)`,
        [userId, orgId, activity.type, activity.entityId, activity.action]
      );
      return { tracked: true };
    } catch {
      return { tracked: false };
    }
  }

  async checkAndGenerateNudges(
    userId: string,
    orgId: string,
    context?: { focusItems?: number; inboxCount?: number }
  ) {
    const nudges = await this.generateNudges(userId, orgId);
    if (context?.inboxCount && context.inboxCount > 20) {
      nudges.push({
        id: `nudge_inbox_overload_${Date.now()}`,
        userId,
        type: 'inbox_overload',
        title: 'Inbox overload',
        message: `You have ${context.inboxCount} items in your inbox. Consider batch triaging.`,
        priority: 'medium',
        actionUrl: '/my-work?tab=inbox',
        dismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
    return nudges;
  }

  async markNudgeActed(userId: string, nudgeId: string, action: string) {
    try {
      await dbRun(
        `INSERT OR REPLACE INTO ai_nudge_actions (nudge_id, user_id, action) VALUES (?, ?, ?)`,
        [nudgeId, userId, action]
      );
      return { acted: true };
    } catch {
      return { acted: false };
    }
  }

  async suppressNudgeType(userId: string, nudgeType: string, durationHours = 168) {
    try {
      const until = new Date(Date.now() + durationHours * 3600000).toISOString();
      await dbRun(
        `INSERT OR REPLACE INTO ai_nudge_suppressions (user_id, nudge_type, suppressed_until) VALUES (?, ?, ?)`,
        [userId, nudgeType, until]
      );
      return { suppressed: true, until };
    } catch {
      return { suppressed: false };
    }
  }
}

export const proactiveNudgesService = new ProactiveNudgesServiceImpl();
export default proactiveNudgesService;
