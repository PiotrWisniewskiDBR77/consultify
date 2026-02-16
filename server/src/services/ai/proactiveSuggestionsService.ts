/**
 * Proactive Suggestions Service v2.0 (R7)
 *
 * Generates proactive AI suggestions based on organization/user state.
 * Now includes strategic pattern detection:
 * - Trend detection (declining KPIs)
 * - Resource conflicts
 * - Strategic drift
 * - Benchmark gap alerts
 * - Decision pattern analysis
 * - Budget burn rate warnings
 *
 * @version 2.0.0
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
  type: 'action' | 'insight' | 'reminder' | 'optimization' | 'warning' | 'strategic';
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
   * Generate proactive suggestions including strategic pattern detection.
   */
  async generateSuggestions(request: SuggestionRequest): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    const now = new Date().toISOString();

    try {
      const db = await this.getDb();

      // Run all detection in parallel for speed
      const results = await Promise.allSettled([
        this.detectUpcomingDeadlines(db, request, now),
        this.detectStaleInitiatives(db, request, now),
        this.detectResourceConflicts(db, request, now),
        this.detectBudgetBurnRate(db, request, now),
        this.detectStrategicDrift(db, request, now),
        this.detectOverdueItems(db, request, now),
        this.detectAssessmentGaps(db, request, now),
      ]);

      // Collect successful results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          suggestions.push(...result.value);
        }
      }

      // Always add evergreen suggestions
      suggestions.push({
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
      });
    } catch (err) {
      logger.warn('[ProactiveSuggestions] Error generating suggestions:', (err as Error).message);
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  // ==========================================
  // DETECTION: Upcoming Deadlines
  // ==========================================

  private async detectUpcomingDeadlines(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    try {
      const upcomingDeadlines = await db.all(
        `SELECT id, title, due_date FROM tasks
         WHERE assignee_id = ? AND due_date IS NOT NULL
         AND due_date BETWEEN datetime('now') AND datetime('now', '+7 days')
         AND status NOT IN ('completed', 'cancelled')
         ORDER BY due_date ASC LIMIT 5`,
        [request.userId]
      );

      if (upcomingDeadlines && upcomingDeadlines.length > 0) {
        suggestions.push({
          id: uuidv4(),
          type: 'reminder',
          title: 'Upcoming Deadlines',
          description: `${upcomingDeadlines.length} task${upcomingDeadlines.length > 1 ? 's' : ''} due this week. Earliest: "${(upcomingDeadlines[0] as any)?.title}"`,
          priority: 95,
          category: 'deadlines',
          actionable: true,
          action: {
            type: 'chat',
            prompt: 'Show me my upcoming deadlines and help me plan my week. Prioritize by impact.',
          },
          metadata: { taskCount: upcomingDeadlines.length },
          createdAt: now,
        });
      }
    } catch {
      /* table may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // DETECTION: Stale Initiatives
  // ==========================================

  private async detectStaleInitiatives(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    if (!request.projectId) return suggestions;

    try {
      const staleInitiatives = await db.all(
        `SELECT id, name, status, updated_at FROM initiatives
         WHERE project_id = ? AND status IN ('active', 'in_progress')
         AND updated_at < datetime('now', '-14 days')
         ORDER BY updated_at ASC LIMIT 5`,
        [request.projectId]
      );

      if (staleInitiatives && staleInitiatives.length > 0) {
        const stalestName = (staleInitiatives[0] as any)?.name;
        suggestions.push({
          id: uuidv4(),
          type: 'warning',
          title: 'Stale Initiatives Detected',
          description: `${staleInitiatives.length} initiative${staleInitiatives.length > 1 ? 's' : ''} haven't been updated in 2+ weeks. Most stale: "${stalestName}"`,
          priority: 85,
          category: 'initiatives',
          actionable: true,
          action: {
            type: 'chat',
            prompt:
              'Review my stale initiatives — identify blockers and recommend whether to accelerate, descope, or cancel each one.',
          },
          metadata: { initiativeCount: staleInitiatives.length },
          createdAt: now,
        });
      }
    } catch {
      /* table may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // DETECTION: Resource Conflicts (R7 new)
  // ==========================================

  private async detectResourceConflicts(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    if (!request.projectId) return suggestions;

    try {
      // Find users assigned to multiple active tasks with overlapping deadlines
      const overloaded = await db.all(
        `SELECT assignee_id, COUNT(*) as task_count,
                GROUP_CONCAT(title, ', ') as tasks
         FROM tasks
         WHERE project_id = ? AND status IN ('todo', 'in_progress')
         AND due_date BETWEEN datetime('now') AND datetime('now', '+14 days')
         GROUP BY assignee_id
         HAVING task_count >= 4
         LIMIT 3`,
        [request.projectId]
      );

      if (overloaded && overloaded.length > 0) {
        suggestions.push({
          id: uuidv4(),
          type: 'warning',
          title: 'Resource Conflict Detected',
          description: `${overloaded.length} team member${overloaded.length > 1 ? 's' : ''} ${overloaded.length > 1 ? 'are' : 'is'} overloaded with 4+ tasks due in next 2 weeks`,
          priority: 90,
          category: 'resource_conflict',
          actionable: true,
          action: {
            type: 'chat',
            prompt:
              'Analyze resource conflicts in my project. Who is overloaded? Recommend task redistribution or timeline adjustments.',
          },
          metadata: { overloadedCount: overloaded.length },
          createdAt: now,
        });
      }
    } catch {
      /* table may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // DETECTION: Budget Burn Rate (R7 new)
  // ==========================================

  private async detectBudgetBurnRate(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    if (!request.projectId) return suggestions;

    try {
      const project = (await db.get(
        `SELECT p.id, p.name, p.end_date,
                SUM(i.cost_capex + COALESCE(i.cost_opex, 0)) as total_budget,
                SUM(CASE WHEN i.status = 'completed' THEN i.cost_capex + COALESCE(i.cost_opex, 0) ELSE 0 END) as spent
         FROM projects p
         LEFT JOIN initiatives i ON i.project_id = p.id
         WHERE p.id = ?
         GROUP BY p.id`,
        [request.projectId]
      )) as any;

      if (project?.total_budget > 0 && project?.end_date) {
        const totalBudget = project.total_budget;
        const spent = project.spent || 0;
        const spentPercent = (spent / totalBudget) * 100;

        const endDate = new Date(project.end_date);
        const today = new Date();
        const totalDays =
          (endDate.getTime() - new Date(project.start_date || today).getTime()) /
          (1000 * 60 * 60 * 24);
        const elapsedDays =
          (today.getTime() - new Date(project.start_date || today).getTime()) /
          (1000 * 60 * 60 * 24);
        const timePercent = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 50;

        // Warn if spending is 20%+ ahead of timeline
        if (spentPercent > timePercent + 20) {
          suggestions.push({
            id: uuidv4(),
            type: 'warning',
            title: 'Budget Burn Rate Alert',
            description: `Budget ${Math.round(spentPercent)}% spent but only ${Math.round(timePercent)}% of timeline elapsed. At this rate, budget may be exhausted before project completion.`,
            priority: 92,
            category: 'budget',
            actionable: true,
            action: {
              type: 'chat',
              prompt: `Analyze the budget burn rate for project "${project.name}". We've spent ${Math.round(spentPercent)}% of budget but only ${Math.round(timePercent)}% of time has passed. What cost optimization actions should we take?`,
            },
            metadata: {
              spentPercent: Math.round(spentPercent),
              timePercent: Math.round(timePercent),
            },
            createdAt: now,
          });
        }
      }
    } catch {
      /* table/column may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // DETECTION: Strategic Drift (R7 new)
  // ==========================================

  private async detectStrategicDrift(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    if (!request.projectId) return suggestions;

    try {
      // Check if organization context (goals) was updated recently
      // but initiatives haven't been re-evaluated
      const contextUpdate = (await db.get(
        `SELECT updated_at FROM organization_context
         WHERE organization_id = ? AND updated_at > datetime('now', '-30 days')
         ORDER BY updated_at DESC LIMIT 1`,
        [request.organizationId]
      )) as any;

      if (contextUpdate) {
        const lastContextUpdate = new Date(contextUpdate.updated_at);

        // Check if any initiatives were reviewed after the context change
        const reviewedAfter = (await db.get(
          `SELECT COUNT(*) as count FROM initiatives
           WHERE project_id = ? AND updated_at > ?`,
          [request.projectId, contextUpdate.updated_at]
        )) as any;

        const totalActive = (await db.get(
          `SELECT COUNT(*) as count FROM initiatives
           WHERE project_id = ? AND status IN ('active', 'in_progress')`,
          [request.projectId]
        )) as any;

        const reviewedCount = reviewedAfter?.count || 0;
        const totalCount = totalActive?.count || 0;

        if (totalCount > 0 && reviewedCount < totalCount * 0.5) {
          suggestions.push({
            id: uuidv4(),
            type: 'strategic',
            title: 'Strategic Alignment Check Needed',
            description: `Organization goals were updated ${Math.round((Date.now() - lastContextUpdate.getTime()) / (1000 * 60 * 60 * 24))} days ago, but ${totalCount - reviewedCount} of ${totalCount} active initiatives haven't been reviewed since.`,
            priority: 88,
            category: 'strategic_drift',
            actionable: true,
            action: {
              type: 'chat',
              prompt:
                'Check if our active initiatives are still aligned with the updated strategic goals. Identify any that may need re-prioritization or adjustment.',
            },
            createdAt: now,
          });
        }
      }
    } catch {
      /* table may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // DETECTION: Overdue Items (R7 enhanced)
  // ==========================================

  private async detectOverdueItems(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    try {
      const overdue = await db.all(
        `SELECT id, title, due_date, status FROM tasks
         WHERE assignee_id = ? AND due_date < datetime('now')
         AND status NOT IN ('completed', 'cancelled')
         ORDER BY due_date ASC LIMIT 5`,
        [request.userId]
      );

      if (overdue && overdue.length > 0) {
        const oldestDue = (overdue[0] as any)?.due_date;
        const daysSinceOldest = oldestDue
          ? Math.round((Date.now() - new Date(oldestDue).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        suggestions.push({
          id: uuidv4(),
          type: 'warning',
          title: 'Overdue Tasks',
          description: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}. Oldest is ${daysSinceOldest} days past deadline.`,
          priority: 97,
          category: 'overdue',
          actionable: true,
          action: {
            type: 'chat',
            prompt: `I have ${overdue.length} overdue tasks. Help me triage them — which should I complete, delegate, or reschedule? Apply the Eisenhower matrix.`,
          },
          metadata: { overdueCount: overdue.length, oldestDays: daysSinceOldest },
          createdAt: now,
        });
      }
    } catch {
      /* table may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // DETECTION: Assessment Gaps (R7 new)
  // ==========================================

  private async detectAssessmentGaps(
    db: IDatabase,
    request: SuggestionRequest,
    now: string
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    if (!request.projectId) return suggestions;

    try {
      const criticalGaps = await db.all(
        `SELECT acs.axis_name, acs.current_score, acs.target_score,
                (acs.target_score - acs.current_score) as gap
         FROM assessment_scores acs
         JOIN maturity_assessments ma ON acs.assessment_id = ma.id
         WHERE ma.project_id = ? AND (acs.target_score - acs.current_score) > 1.5
         ORDER BY gap DESC LIMIT 3`,
        [request.projectId]
      );

      if (criticalGaps && criticalGaps.length > 0) {
        const worstGap = criticalGaps[0] as any;
        suggestions.push({
          id: uuidv4(),
          type: 'insight',
          title: 'Critical Maturity Gaps',
          description: `${criticalGaps.length} axis${criticalGaps.length > 1 ? 'es have' : ' has'} gap > 1.5. Worst: "${worstGap.axis_name}" (${worstGap.current_score} → ${worstGap.target_score}, gap: ${worstGap.gap?.toFixed(1)})`,
          priority: 82,
          category: 'assessment_gaps',
          actionable: true,
          action: {
            type: 'chat',
            prompt: `Analyze my critical maturity gaps (gap > 1.5) and recommend specific initiatives to close them. Prioritize by business impact and feasibility.`,
          },
          metadata: { gapCount: criticalGaps.length, worstAxis: worstGap.axis_name },
          createdAt: now,
        });
      }
    } catch {
      /* table may not exist */
    }
    return suggestions;
  }

  // ==========================================
  // METRICS
  // ==========================================

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
