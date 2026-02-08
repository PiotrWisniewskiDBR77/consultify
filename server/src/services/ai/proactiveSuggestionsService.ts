/**
 * Proactive Suggestions Service
 *
 * Generates proactive AI suggestions based on organization/user state.
 * Tracks suggestion actions and provides metrics.
 *
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface SuggestionRequest {
  userId: string;
  organizationId: string;
  projectId?: string | null;
  screenContext?: Record<string, unknown> | null;
  recentActions?: Array<Record<string, unknown>>;
}

interface ProactiveSuggestion {
  id: string;
  type: 'action' | 'insight' | 'reminder' | 'optimization';
  title: string;
  description: string;
  priority: number;
  category: string;
  actionable: boolean;
  action?: {
    type: 'navigate' | 'chat' | 'execute';
    target?: string;
    prompt?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ==========================================
// SERVICE
// ==========================================

class ProactiveSuggestionsService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Generate proactive suggestions
   */
  async generateSuggestions(request: SuggestionRequest): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const now = new Date().toISOString();

    try {
      const db = await this.getDb();

      // 1. Check for upcoming deadlines
      try {
        const upcomingDeadlines = await db.all(
          `SELECT id, title, due_date FROM tasks
           WHERE assignee_id = ? AND due_date IS NOT NULL
           AND due_date BETWEEN datetime('now') AND datetime('now', '+7 days')
           AND status NOT IN ('completed', 'cancelled')
           ORDER BY due_date ASC LIMIT 3`,
          [request.userId]
        );

        if (upcomingDeadlines && upcomingDeadlines.length > 0) {
          suggestions.push({
            id: uuidv4(),
            type: 'reminder',
            title: 'Upcoming Deadlines',
            description: `${upcomingDeadlines.length} task${upcomingDeadlines.length > 1 ? 's' : ''} due this week`,
            priority: 95,
            category: 'deadlines',
            actionable: true,
            action: {
              type: 'chat',
              prompt: 'Show me my upcoming deadlines and help me plan my week accordingly.',
            },
            createdAt: now,
          });
        }
      } catch {
        // Table may not exist
      }

      // 2. Check for stale initiatives
      if (request.projectId) {
        try {
          const staleInitiatives = await db.all(
            `SELECT id, name FROM initiatives
             WHERE project_id = ? AND status = 'active'
             AND updated_at < datetime('now', '-14 days')
             LIMIT 3`,
            [request.projectId]
          );

          if (staleInitiatives && staleInitiatives.length > 0) {
            suggestions.push({
              id: uuidv4(),
              type: 'insight',
              title: 'Stale Initiatives',
              description: `${staleInitiatives.length} initiative${staleInitiatives.length > 1 ? 's' : ''} haven't been updated in 2+ weeks`,
              priority: 80,
              category: 'initiatives',
              actionable: true,
              action: {
                type: 'chat',
                prompt: 'Review my stale initiatives and suggest next steps for each.',
              },
              createdAt: now,
            });
          }
        } catch {
          // Table may not exist
        }
      }

      // 3. General optimization suggestions
      suggestions.push(
        {
          id: uuidv4(),
          type: 'optimization',
          title: 'AI Maturity Check',
          description: "Review your organization's AI readiness",
          priority: 40,
          category: 'assessment',
          actionable: true,
          action: {
            type: 'navigate',
            target: 'ASSESSMENT_OVERVIEW',
          },
          createdAt: now,
        },
        {
          id: uuidv4(),
          type: 'action',
          title: 'Weekly Review',
          description: "Get a summary of this week's progress",
          priority: 50,
          category: 'review',
          actionable: true,
          action: {
            type: 'chat',
            prompt:
              "Give me a weekly review — what was accomplished, what's pending, and what needs attention.",
          },
          createdAt: now,
        }
      );
    } catch (err) {
      logger.warn('[ProactiveSuggestions] Error generating suggestions:', (err as Error).message);
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Record user action on a suggestion (accept/dismiss/snooze)
   */
  async recordSuggestionAction(
    suggestionId: string,
    userId: string,
    action: 'accepted' | 'dismissed' | 'snoozed',
    feedback?: string
  ): Promise<void> {
    try {
      const db = await this.getDb();
      await db.run(
        `INSERT INTO suggestion_actions (id, suggestion_id, user_id, action, feedback, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [uuidv4(), suggestionId, userId, action, feedback || null]
      );
    } catch (err) {
      // Table may not exist — log and continue
      logger.debug(
        '[ProactiveSuggestions] Could not record action (table may not exist):',
        (err as Error).message
      );
    }
  }

  /**
   * Get suggestion metrics for an organization
   */
  async getSuggestionMetrics(
    organizationId: string,
    days: number = 30
  ): Promise<{
    totalGenerated: number;
    totalAccepted: number;
    totalDismissed: number;
    acceptanceRate: number;
  }> {
    try {
      const db = await this.getDb();
      const stats = await db.get(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN action = 'accepted' THEN 1 ELSE 0 END) as accepted,
           SUM(CASE WHEN action = 'dismissed' THEN 1 ELSE 0 END) as dismissed
         FROM suggestion_actions sa
         JOIN users u ON sa.user_id = u.id
         WHERE u.organization_id = ?
         AND sa.created_at > datetime('now', '-' || ? || ' days')`,
        [organizationId, days]
      );

      const total = (stats as any)?.total || 0;
      const accepted = (stats as any)?.accepted || 0;
      const dismissed = (stats as any)?.dismissed || 0;

      return {
        totalGenerated: total,
        totalAccepted: accepted,
        totalDismissed: dismissed,
        acceptanceRate: total > 0 ? accepted / total : 0,
      };
    } catch {
      return { totalGenerated: 0, totalAccepted: 0, totalDismissed: 0, acceptanceRate: 0 };
    }
  }
}

const proactiveSuggestionsService = new ProactiveSuggestionsService();
export default proactiveSuggestionsService;
export { ProactiveSuggestionsService, proactiveSuggestionsService };
