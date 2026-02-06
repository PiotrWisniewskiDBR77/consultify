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
