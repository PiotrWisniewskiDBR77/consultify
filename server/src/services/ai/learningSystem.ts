/**
 * Learning System Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Processes user feedback to improve AI quality over time.
 */
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export const CONFIG = {
  MIN_FEEDBACK_FOR_PATTERN: 3,
  PATTERN_CONFIDENCE_THRESHOLD: 0.5,
  MAX_PATTERNS_PER_ORG: 50,
  QUALITY_TREND_WINDOW_DAYS: 30,
};

class LearningSystemService {
  async processFeedback(entry: {
    id: string;
    userId: string;
    organizationId?: string;
    conversationId: string;
    messageId: string;
    feedbackType: string;
    comment?: string;
    correction?: string;
    timestamp: string;
  }) {
    try {
      await dbRun(
        `INSERT OR IGNORE INTO ai_feedback (id,user_id,organization_id,conversation_id,message_id,feedback_type,comment,correction,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          entry.id,
          entry.userId,
          entry.organizationId || null,
          entry.conversationId,
          entry.messageId,
          entry.feedbackType,
          entry.comment || null,
          entry.correction || null,
          entry.timestamp,
        ]
      );
    } catch {
      /* ignore */
    }
    if (entry.feedbackType === 'dislike' || entry.feedbackType === 'correction')
      await this.analyzePattern(entry);
    logger.info(`[LearningSystem] Processed ${entry.feedbackType} for ${entry.messageId}`);
  }

  async getReport(orgId: string, days = 30) {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    try {
      const stats = (await dbAll(
        `SELECT COUNT(*) as t, SUM(CASE WHEN feedback_type='like' THEN 1 ELSE 0 END) as l, SUM(CASE WHEN feedback_type='dislike' THEN 1 ELSE 0 END) as d, SUM(CASE WHEN feedback_type='correction' THEN 1 ELSE 0 END) as c FROM ai_feedback WHERE organization_id=? AND created_at>?`,
        [orgId, cutoff]
      )) as any[];
      const s = stats?.[0] || {};
      const total = s.t || 0;
      const patterns = await this.getPatterns(orgId);
      const trend = await this.calcTrend(orgId, days);
      return {
        totalFeedback: total,
        positiveRate: total ? Math.round((s.l / total) * 100) / 100 : 0,
        negativeRate: total ? Math.round((s.d / total) * 100) / 100 : 0,
        correctionCount: s.c || 0,
        topPatterns: patterns.slice(0, 10),
        qualityTrend: trend,
        period: `${days}d`,
      };
    } catch {
      return {
        totalFeedback: 0,
        positiveRate: 0,
        negativeRate: 0,
        correctionCount: 0,
        topPatterns: [] as any[],
        qualityTrend: 'insufficient_data' as const,
        period: `${days}d`,
      };
    }
  }

  async getPatterns(orgId: string) {
    try {
      const rows = (await dbAll(
        `SELECT * FROM ai_learning_patterns WHERE organization_id=? AND confidence_score>=? ORDER BY frequency DESC LIMIT ?`,
        [orgId, CONFIG.PATTERN_CONFIDENCE_THRESHOLD, CONFIG.MAX_PATTERNS_PER_ORG]
      )) as any[];
      return (rows || []).map((r: any) => ({
        id: r.id,
        patternType: r.pattern_type,
        description: r.pattern_data,
        frequency: r.frequency || 1,
        confidence: r.confidence_score,
      }));
    } catch {
      return [];
    }
  }

  async enhancePrompt(basePrompt: string, orgId: string) {
    try {
      const instr = (await dbAll(
        `SELECT instruction FROM ai_instruction_suggestions WHERE organization_id=? AND status='applied' ORDER BY confidence DESC LIMIT 5`,
        [orgId]
      )) as any[];
      if (!instr?.length) return { enhancedPrompt: basePrompt, appliedPatterns: [] as string[] };
      const additions = instr.map((i: any) => i.instruction).filter(Boolean);
      return {
        enhancedPrompt:
          basePrompt +
          '\n\n[Learned Instructions]\n' +
          additions.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n'),
        appliedPatterns: additions.map((_: any, i: number) => `instr_${i + 1}`),
      };
    } catch {
      return { enhancedPrompt: basePrompt, appliedPatterns: [] as string[] };
    }
  }

  private async analyzePattern(entry: {
    organizationId?: string;
    comment?: string;
    correction?: string;
  }) {
    if (!entry.organizationId) return;
    const text = (entry.correction || entry.comment || '').toLowerCase();
    let type = 'topic_weakness';
    if (/wrong|incorrect|error/i.test(text)) type = 'factual_error';
    else if (/too short|missing|incomplete/i.test(text)) type = 'completeness_gap';
    else if (/tone|style/i.test(text)) type = 'tone_issue';
    try {
      const existing = (await dbAll(
        `SELECT id,frequency FROM ai_learning_patterns WHERE organization_id=? AND pattern_type=? LIMIT 1`,
        [entry.organizationId, type]
      )) as any[];
      if (existing?.length) {
        await dbRun(
          `UPDATE ai_learning_patterns SET frequency=frequency+1, confidence_score=MIN(1.0,confidence_score+0.05), updated_at=? WHERE id=?`,
          [new Date().toISOString(), existing[0].id]
        );
      } else {
        await dbRun(
          `INSERT INTO ai_learning_patterns (id,organization_id,pattern_type,pattern_data,frequency,confidence_score,created_at,updated_at) VALUES (?,?,?,?,1,0.3,?,?)`,
          [
            `lp_${Date.now()}`,
            entry.organizationId,
            type,
            text.slice(0, 500),
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );
      }
    } catch {
      /* ignore */
    }
  }

  // ==========================================
  // SCHEDULED JOBS (called by Scheduler cron)
  // ==========================================

  /**
   * Extract patterns from recent unprocessed feedback across all organizations.
   * Runs every 6 hours via Scheduler (job 11).
   */
  async extractAllPatterns(): Promise<{ patternsExtracted: number; recordsProcessed: number }> {
    let recordsProcessed = 0;
    let patternsExtracted = 0;

    try {
      // Get recent unprocessed feedback (negative feedback without corresponding pattern updates)
      const cutoff = new Date(Date.now() - 7 * 86400_000).toISOString();
      const rows = (await dbAll(
        `SELECT organization_id, feedback_type, comment, correction
         FROM ai_feedback
         WHERE created_at > ? AND (feedback_type = 'dislike' OR feedback_type = 'correction')
         ORDER BY created_at DESC LIMIT 500`,
        [cutoff]
      )) as any[];

      if (!rows?.length) return { patternsExtracted: 0, recordsProcessed: 0 };

      // Group by organization
      const byOrg: Record<string, any[]> = {};
      for (const row of rows) {
        const orgId = row.organization_id || '__system__';
        if (!byOrg[orgId]) byOrg[orgId] = [];
        byOrg[orgId].push(row);
      }

      for (const [orgId, entries] of Object.entries(byOrg)) {
        if (orgId === '__system__') continue;
        for (const entry of entries) {
          recordsProcessed++;
          await this.analyzePattern({
            organizationId: orgId,
            comment: entry.comment,
            correction: entry.correction,
          });
          patternsExtracted++;
        }
      }

      logger.info(
        `[LearningSystem] Pattern extraction: ${patternsExtracted} patterns from ${recordsProcessed} records`
      );
    } catch (err: any) {
      logger.error('[LearningSystem] extractAllPatterns failed:', err?.message);
    }

    return { patternsExtracted, recordsProcessed };
  }

  /**
   * Consolidate learning patterns into instruction suggestions.
   * Runs daily at 4:30 AM via Scheduler (job 12).
   */
  async consolidateLearnings(): Promise<{ strategiesCreated: number }> {
    let strategiesCreated = 0;

    try {
      // Find high-confidence patterns that don't yet have instruction suggestions
      const patterns = (await dbAll(
        `SELECT DISTINCT lp.id, lp.organization_id, lp.pattern_type, lp.pattern_data, lp.frequency, lp.confidence_score
         FROM ai_learning_patterns lp
         WHERE lp.confidence_score >= ? AND lp.frequency >= ?
         ORDER BY lp.confidence_score DESC, lp.frequency DESC
         LIMIT 100`,
        [CONFIG.PATTERN_CONFIDENCE_THRESHOLD, CONFIG.MIN_FEEDBACK_FOR_PATTERN]
      )) as any[];

      if (!patterns?.length) return { strategiesCreated: 0 };

      for (const pattern of patterns) {
        // Generate instruction suggestion based on pattern type
        let instruction = '';
        switch (pattern.pattern_type) {
          case 'factual_error':
            instruction = `Be extra cautious about factual accuracy. Users reported errors. Double-check claims before stating them.`;
            break;
          case 'completeness_gap':
            instruction = `Provide more thorough and complete responses. Users reported missing information. Cover edge cases and provide comprehensive answers.`;
            break;
          case 'tone_issue':
            instruction = `Adjust communication tone. Users reported tone/style issues. Match professional but approachable style.`;
            break;
          case 'topic_weakness':
            instruction = `Improve depth on frequently asked topics. Users reported shallow or unhelpful answers in certain areas.`;
            break;
          default:
            instruction = `Address recurring feedback pattern: ${pattern.pattern_type}`;
        }

        // Upsert instruction suggestion (schema: 520_ai_enterprise_tables.sql)
        try {
          const existingInstr = (await dbAll(
            `SELECT id FROM ai_instruction_suggestions WHERE organization_id=? AND based_on_patterns LIKE ? LIMIT 1`,
            [pattern.organization_id, `%${pattern.id}%`]
          )) as any[];

          if (!existingInstr?.length) {
            await dbRun(
              `INSERT INTO ai_instruction_suggestions (id, organization_id, instruction, reason, based_on_patterns, confidence, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
              [
                `is_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                pattern.organization_id,
                instruction,
                `Auto-generated from ${pattern.pattern_type} pattern (freq: ${pattern.frequency})`,
                JSON.stringify([pattern.id]),
                pattern.confidence_score,
                new Date().toISOString(),
                new Date().toISOString(),
              ]
            );
            strategiesCreated++;
          }
        } catch {
          // Table may not exist yet or constraint violation — skip
        }
      }

      logger.info(`[LearningSystem] Consolidation: ${strategiesCreated} strategies created`);
    } catch (err: any) {
      logger.error('[LearningSystem] consolidateLearnings failed:', err?.message);
    }

    return { strategiesCreated };
  }

  /**
   * Clean up old feedback and learning data.
   * Runs weekly on Monday at 5 AM via Scheduler (job 13).
   */
  async cleanupOldData(maxAgeDays = 180): Promise<{ deleted: number }> {
    let deleted = 0;

    try {
      const cutoff = new Date(Date.now() - maxAgeDays * 86400_000).toISOString();

      // Clean old feedback
      const fbResult = await dbRun(
        `DELETE FROM ai_feedback WHERE created_at < ?`,
        [cutoff]
      );
      deleted += fbResult.changes || 0;

      // Clean low-confidence patterns older than retention period
      const ptResult = await dbRun(
        `DELETE FROM ai_learning_patterns WHERE updated_at < ? AND confidence_score < ?`,
        [cutoff, CONFIG.PATTERN_CONFIDENCE_THRESHOLD]
      );
      deleted += ptResult.changes || 0;

      // Clean old instruction suggestions that were rejected
      try {
        const isResult = await dbRun(
          `DELETE FROM ai_instruction_suggestions WHERE updated_at < ? AND status = 'rejected'`,
          [cutoff]
        );
        deleted += isResult.changes || 0;
      } catch {
        // Table may not exist
      }

      logger.info(
        `[LearningSystem] Cleanup: ${deleted} old records deleted (older than ${maxAgeDays} days)`
      );
    } catch (err: any) {
      logger.error('[LearningSystem] cleanupOldData failed:', err?.message);
    }

    return { deleted };
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async calcTrend(
    orgId: string,
    days: number
  ): Promise<'improving' | 'stable' | 'declining' | 'insufficient_data'> {
    try {
      const mid = new Date(Date.now() - (days / 2) * 86400_000).toISOString();
      const start = new Date(Date.now() - days * 86400_000).toISOString();
      const [h1, h2] = await Promise.all([
        dbAll(
          `SELECT AVG(CASE WHEN feedback_type='like' THEN 1.0 ELSE 0.0 END) as r FROM ai_feedback WHERE organization_id=? AND created_at BETWEEN ? AND ?`,
          [orgId, start, mid]
        ),
        dbAll(
          `SELECT AVG(CASE WHEN feedback_type='like' THEN 1.0 ELSE 0.0 END) as r FROM ai_feedback WHERE organization_id=? AND created_at>?`,
          [orgId, mid]
        ),
      ]);
      const r1 = (h1 as any[])?.[0]?.r,
        r2 = (h2 as any[])?.[0]?.r;
      if (r1 == null || r2 == null) return 'insufficient_data';
      if (r2 - r1 > 0.1) return 'improving';
      if (r2 - r1 < -0.1) return 'declining';
      return 'stable';
    } catch {
      return 'insufficient_data';
    }
  }
}

export const learningSystem = new LearningSystemService();
export const LearningSystem = LearningSystemService;
export default learningSystem;
