/**
 * Smart Suggestions Service
 *
 * Generates context-aware suggestions for the AI chat based on:
 * - User's recent activity (tasks, decisions, initiatives)
 * - Current project state
 * - Conversation context
 * - Screen context
 *
 * @version 1.0.0
 */

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface Suggestion {
  id: string;
  type: 'continue' | 'action' | 'insight' | 'followup' | 'expand';
  text: string;
  priority: number;
  context: string[];
  action?: {
    type: 'navigate' | 'chat' | 'execute';
    view?: string;
    prompt?: string;
    data?: Record<string, unknown>;
  };
}

interface SuggestionOptions {
  limit?: number;
  screenContext?: string;
  focusMode?: string;
}

// ==========================================
// SERVICE
// ==========================================

class SmartSuggestionsService {
  private db: IDatabase | null = null;
  private cache = new Map<string, { suggestions: Suggestion[]; expiresAt: number }>();
  private CACHE_TTL_MS = 60_000; // 1 minute

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Get cached suggestions (used by GET /api/ai/suggestions)
   */
  async getCachedSuggestions(
    userId: string,
    projectId?: string,
    _options: SuggestionOptions = {}
  ): Promise<Suggestion[]> {
    const cacheKey = `${userId}:${projectId || 'none'}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.suggestions;
    }

    const suggestions = await this.generateSuggestions(userId, projectId);
    this.cache.set(cacheKey, { suggestions, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return suggestions;
  }

  /**
   * Get fresh suggestions with conversation context (used by POST /api/ai/suggestions)
   */
  async getSuggestions(
    userId: string,
    projectId?: string,
    conversationContext: Record<string, unknown> = {}
  ): Promise<Suggestion[]> {
    const base = await this.generateSuggestions(userId, projectId);

    // If there's conversation context, add follow-up suggestions
    if (conversationContext.lastTopic) {
      base.unshift({
        id: `followup-${Date.now()}`,
        type: 'followup',
        text: `Continue discussing: ${String(conversationContext.lastTopic).slice(0, 60)}`,
        priority: 100,
        context: ['conversation'],
        action: {
          type: 'chat',
          prompt: `Let's continue discussing ${conversationContext.lastTopic}. What are the next steps?`,
        },
      });
    }

    return base.slice(0, 6);
  }

  /**
   * Generate suggestions based on user's state
   */
  private async generateSuggestions(userId: string, projectId?: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    try {
      const db = await this.getDb();

      // 1. Check for overdue/blocked tasks
      try {
        const blockedTasks = await db.all(
          `SELECT id, title, status FROM tasks
           WHERE assignee_id = ? AND status IN ('blocked', 'in_progress')
           ORDER BY updated_at DESC LIMIT 3`,
          [userId]
        );

        if (blockedTasks && blockedTasks.length > 0) {
          suggestions.push({
            id: 'blocked-tasks',
            type: 'action',
            text: `You have ${blockedTasks.length} blocked/active task${blockedTasks.length > 1 ? 's' : ''} — need help unblocking?`,
            priority: 90,
            context: ['tasks'],
            action: {
              type: 'chat',
              prompt: `I have ${blockedTasks.length} tasks that need attention. Help me prioritize and unblock them.`,
            },
          });
        }
      } catch {
        // Tasks table may not exist
      }

      // 2. Check for pending decisions
      try {
        const pendingDecisions = await db.all(
          `SELECT id, title FROM decisions
           WHERE (assignee_id = ? OR created_by = ?) AND status = 'pending'
           ORDER BY created_at DESC LIMIT 3`,
          [userId, userId]
        );

        if (pendingDecisions && pendingDecisions.length > 0) {
          suggestions.push({
            id: 'pending-decisions',
            type: 'action',
            text: `${pendingDecisions.length} decision${pendingDecisions.length > 1 ? 's' : ''} awaiting your input`,
            priority: 85,
            context: ['decisions'],
            action: {
              type: 'chat',
              prompt:
                'Help me make decisions on my pending items. Show me the options and tradeoffs.',
            },
          });
        }
      } catch {
        // Decisions table may not exist
      }

      // 3. Project-specific suggestions
      if (projectId) {
        try {
          const project = await db.get(`SELECT name, status FROM projects WHERE id = ?`, [
            projectId,
          ]);

          if (project) {
            suggestions.push({
              id: 'project-status',
              type: 'insight',
              text: `Review ${(project as any).name} project status`,
              priority: 70,
              context: ['project'],
              action: {
                type: 'chat',
                prompt: `Give me a brief status update on the "${(project as any).name}" project — what's on track, what needs attention?`,
              },
            });
          }
        } catch {
          // Project query failed
        }
      }

      // 4. Always include general suggestions
      suggestions.push(
        {
          id: 'daily-brief',
          type: 'action',
          text: 'Daily brief',
          priority: 60,
          context: ['general'],
          action: { type: 'chat', prompt: '__DAILY_BRIEF__' },
        },
        {
          id: 'assessment-start',
          type: 'action',
          text: 'Start digital maturity assessment',
          priority: 50,
          context: ['general'],
          action: { type: 'navigate', view: 'ASSESSMENT_OVERVIEW' },
        },
        {
          id: 'create-diagram',
          type: 'expand',
          text: 'Create a process diagram',
          priority: 40,
          context: ['general'],
          action: {
            type: 'chat',
            prompt: 'Create a process diagram for onboarding a new client',
          },
        }
      );
    } catch (err) {
      logger.warn('[SmartSuggestions] Error generating suggestions:', (err as Error).message);

      // Fallback suggestions
      suggestions.push(
        {
          id: 'daily-brief',
          type: 'action',
          text: 'Daily brief',
          priority: 60,
          context: ['fallback'],
          action: { type: 'chat', prompt: '__DAILY_BRIEF__' },
        },
        {
          id: 'assessment-start',
          type: 'action',
          text: 'Start your digital maturity assessment',
          priority: 50,
          context: ['fallback'],
          action: { type: 'navigate', view: 'ASSESSMENT_OVERVIEW' },
        }
      );
    }

    // Sort by priority (highest first)
    return suggestions.sort((a, b) => b.priority - a.priority);
  }
}

const smartSuggestionsService = new SmartSuggestionsService();
export default smartSuggestionsService;
export { SmartSuggestionsService, smartSuggestionsService };
