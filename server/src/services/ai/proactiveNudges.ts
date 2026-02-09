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
      if (!result?.success && String(result?.error || '').includes('no such table')) {
        // Best-effort self-heal: create table on demand in environments missing migrations
        await dbRun(
          `CREATE TABLE IF NOT EXISTS ai_dismissed_nudges (
            nudge_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            dismissed_at TEXT NOT NULL,
            PRIMARY KEY (nudge_id, user_id)
          )`,
          []
        );
        await dbRun(
          `INSERT OR REPLACE INTO ai_dismissed_nudges (nudge_id,user_id,dismissed_at) VALUES (?,?,datetime('now'))`,
          [nudgeId, userId]
        );
      }
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
}

export const proactiveNudgesService = new ProactiveNudgesServiceImpl();
export default proactiveNudgesService;
