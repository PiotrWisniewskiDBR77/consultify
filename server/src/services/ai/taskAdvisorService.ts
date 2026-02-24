/**
 * Task Advisor Service
 * Analyzes user's portfolio and provides prioritization recommendations.
 */
import { all as dbAll } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

interface TaskAdvisorRecommendation {
  taskId: string;
  title: string;
  rank: number;
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

interface AdvisorResult {
  recommendations: TaskAdvisorRecommendation[];
  overcommitWarning: string | null;
  summary: string;
}

class TaskAdvisorServiceImpl {
  async analyzePortfolio(userId: string, orgId: string): Promise<AdvisorResult> {
    const recommendations: TaskAdvisorRecommendation[] = [];
    let overcommitWarning: string | null = null;

    try {
      const tasks = (await dbAll(
        `SELECT id, title, status, priority, due_date, created_at, updated_at
         FROM tasks 
         WHERE assignee_id = ? AND organization_id = ? AND status NOT IN ('done', 'completed')
         ORDER BY 
           CASE WHEN due_date IS NOT NULL AND due_date < datetime('now') THEN 0 ELSE 1 END,
           CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           due_date ASC NULLS LAST
         LIMIT 20`,
        [userId, orgId]
      )) as any[];

      const decisions = (await dbAll(
        `SELECT id, title, status, priority, due_date, created_at
         FROM decisions 
         WHERE (decision_maker_id = ? OR created_by = ?) AND organization_id = ? AND status = 'pending'
         ORDER BY due_date ASC NULLS LAST
         LIMIT 10`,
        [userId, userId, orgId]
      )) as any[];

      let rank = 1;

      for (const task of tasks || []) {
        if (task.due_date && new Date(task.due_date) < new Date()) {
          recommendations.push({
            taskId: task.id,
            title: task.title,
            rank: rank++,
            reason: `Overdue since ${new Date(task.due_date).toLocaleDateString()}. Address immediately.`,
            urgency: 'critical',
          });
        }
      }

      for (const dec of decisions || []) {
        const daysOld = Math.round((Date.now() - new Date(dec.created_at).getTime()) / 86400000);
        if (daysOld >= 3) {
          recommendations.push({
            taskId: dec.id,
            title: `[Decision] ${dec.title}`,
            rank: rank++,
            reason: `Pending ${daysOld} days. May be blocking dependent work.`,
            urgency: daysOld >= 5 ? 'critical' : 'high',
          });
        }
      }

      for (const task of tasks || []) {
        if (task.due_date && !recommendations.find(r => r.taskId === task.id)) {
          const daysUntil = Math.round((new Date(task.due_date).getTime() - Date.now()) / 86400000);
          if (daysUntil >= 0 && daysUntil <= 1) {
            recommendations.push({
              taskId: task.id,
              title: task.title,
              rank: rank++,
              reason: daysUntil === 0 ? 'Due today.' : 'Due tomorrow.',
              urgency: 'high',
            });
          }
        }
      }

      for (const task of tasks || []) {
        if (!recommendations.find(r => r.taskId === task.id) && ['urgent', 'high'].includes(task.priority)) {
          recommendations.push({
            taskId: task.id,
            title: task.title,
            rank: rank++,
            reason: `${task.priority} priority. ${task.status === 'blocked' ? 'Currently blocked — resolve blocker.' : 'Start or continue.'}`,
            urgency: task.priority === 'urgent' ? 'high' : 'medium',
          });
        }
      }

      const totalOpen = (tasks || []).length;
      if (totalOpen > 12) {
        overcommitWarning = `You have ${totalOpen} open tasks. Historical average is ~8. Consider delegating or deferring ${totalOpen - 8} tasks.`;
      }

      const summary = recommendations.length > 0
        ? `Start with "${recommendations[0].title}" — ${recommendations[0].reason}${recommendations.length > 1 ? ` Then "${recommendations[1].title}".` : ''}`
        : 'Your portfolio looks manageable. Focus on deep work.';

      return { recommendations: recommendations.slice(0, 10), overcommitWarning, summary };
    } catch (err) {
      logger.debug(`[TaskAdvisor] ${(err as Error).message}`);
      return { recommendations: [], overcommitWarning: null, summary: 'Unable to analyze portfolio.' };
    }
  }
}

export const taskAdvisorService = new TaskAdvisorServiceImpl();
export default taskAdvisorService;
