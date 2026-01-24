/**
 * AI Learning Service
 * FLOW-AILEARNING-001: Process feedback and improve AI
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface FeedbackInput {
  userId: string;
  organizationId?: string;
  conversationId?: string;
  messageId?: string;
  feedbackType: 'like' | 'dislike' | 'correction' | 'suggestion';
  rating?: number;
  comment?: string;
  correction?: string;
  aiResponseSnippet?: string;
  contextType?: string;
  category?: string;
}

export interface LearningPattern {
  id: string;
  patternType: string;
  patternCategory?: string;
  patternData: Record<string, unknown>;
  patternDescription?: string;
  occurrenceCount: number;
  successCount: number;
  failureCount: number;
  confidenceScore: number;
  organizationId?: string;
}

export interface QualityMetrics {
  overallScore: number;
  accuracyScore: number;
  helpfulnessScore: number;
  relevanceScore: number;
  toneScore: number;
  trend: 'improving' | 'stable' | 'declining';
  totalInteractions: number;
  feedbackCount: number;
}

export interface InstructionSuggestion {
  id: string;
  suggestedInstruction: string;
  category: string;
  reason: string;
  confidenceScore: number;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
}

// ==========================================
// SERVICE
// ==========================================

class AILearningService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // FEEDBACK COLLECTION
  // ==========================================

  /**
   * Submit feedback
   */
  async submitFeedback(input: FeedbackInput): Promise<{ feedbackId: string }> {
    const db = await this.getDb();
    const feedbackId = `feedback-${uuidv4()}`;
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO ai_feedback (
                id, organization_id, user_id, conversation_id, message_id,
                feedback_type, rating, comment, correction, ai_response_snippet,
                context_type, category, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        feedbackId,
        input.organizationId || null,
        input.userId,
        input.conversationId || null,
        input.messageId || null,
        input.feedbackType,
        input.rating || null,
        input.comment || null,
        input.correction || null,
        input.aiResponseSnippet || null,
        input.contextType || null,
        input.category || null,
        now,
      ]
    );

    // Trigger async pattern extraction
    this.extractPatternFromFeedback(feedbackId).catch((err) => {
      logger.warn(`[AILearningService] Pattern extraction failed for ${feedbackId}:`, err);
    });

    logger.info(`[AILearningService] Feedback submitted: ${feedbackId} (${input.feedbackType})`);
    return { feedbackId };
  }

  /**
   * Get pending feedback for review
   */
  async getPendingFeedback(
    orgId?: string,
    limit: number = 50
  ): Promise<{
    feedbacks: Array<FeedbackInput & { id: string; createdAt: string }>;
    total: number;
  }> {
    const db = await this.getDb();

    let query = `SELECT * FROM ai_feedback WHERE reviewed_at IS NULL`;
    const params: (string | number)[] = [];

    if (orgId) {
      query += ` AND organization_id = ?`;
      params.push(orgId);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const feedbacks = await db.all<{
      id: string;
      organization_id: string;
      user_id: string;
      conversation_id: string;
      message_id: string;
      feedback_type: string;
      rating: number;
      comment: string;
      correction: string;
      ai_response_snippet: string;
      context_type: string;
      category: string;
      created_at: string;
    }>(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM ai_feedback WHERE reviewed_at IS NULL`;
    if (orgId) {
      countQuery += ` AND organization_id = '${orgId}'`;
    }
    const countResult = await db.get<{ count: number }>(countQuery, []);

    return {
      feedbacks: (feedbacks || []).map((f) => ({
        id: f.id,
        userId: f.user_id,
        organizationId: f.organization_id,
        conversationId: f.conversation_id,
        messageId: f.message_id,
        feedbackType: f.feedback_type as FeedbackInput['feedbackType'],
        rating: f.rating,
        comment: f.comment,
        correction: f.correction,
        aiResponseSnippet: f.ai_response_snippet,
        contextType: f.context_type,
        category: f.category,
        createdAt: f.created_at,
      })),
      total: countResult?.count || 0,
    };
  }

  /**
   * Review feedback
   */
  async reviewFeedback(
    feedbackId: string,
    reviewerId: string,
    actionTaken?: string
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.run(
      `UPDATE ai_feedback SET reviewed_by = ?, reviewed_at = ?, action_taken = ? WHERE id = ?`,
      [reviewerId, now, actionTaken || null, feedbackId]
    );
  }

  // ==========================================
  // PATTERN LEARNING
  // ==========================================

  /**
   * Extract pattern from feedback
   */
  private async extractPatternFromFeedback(feedbackId: string): Promise<void> {
    const db = await this.getDb();

    const feedback = await db.get<{
      feedback_type: string;
      category: string;
      correction: string;
      comment: string;
      context_type: string;
      organization_id: string;
    }>('SELECT * FROM ai_feedback WHERE id = ?', [feedbackId]);

    if (!feedback) return;

    // Only extract patterns from corrections and consistent negative feedback
    if (feedback.feedback_type === 'correction' && feedback.correction) {
      await this.recordPattern({
        patternType: 'correction',
        patternCategory: feedback.category || 'general',
        patternData: {
          contextType: feedback.context_type,
          correction: feedback.correction,
        },
        organizationId: feedback.organization_id,
        isSuccess: false,
      });
    }

    // Mark feedback as processed
    await db.run(`UPDATE ai_feedback SET pattern_extracted = 1 WHERE id = ?`, [feedbackId]);
  }

  /**
   * Record a learning pattern
   */
  async recordPattern(input: {
    patternType: string;
    patternCategory?: string;
    patternData: Record<string, unknown>;
    patternDescription?: string;
    organizationId?: string;
    isSuccess: boolean;
  }): Promise<string> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Check if similar pattern exists
    const dataKey = JSON.stringify(input.patternData);
    const existing = await db.get<{ id: string; occurrence_count: number }>(
      `SELECT id, occurrence_count FROM ai_learning_patterns 
             WHERE pattern_type = ? AND pattern_data = ? AND (organization_id = ? OR organization_id IS NULL)`,
      [input.patternType, dataKey, input.organizationId || null]
    );

    if (existing) {
      // Update existing pattern
      await db.run(
        `UPDATE ai_learning_patterns SET 
                    occurrence_count = occurrence_count + 1,
                    success_count = success_count + ?,
                    failure_count = failure_count + ?,
                    last_occurrence_at = ?,
                    updated_at = ?
                 WHERE id = ?`,
        [input.isSuccess ? 1 : 0, input.isSuccess ? 0 : 1, now, now, existing.id]
      );

      // Recalculate confidence
      await this.recalculatePatternConfidence(existing.id);

      return existing.id;
    }

    // Create new pattern
    const patternId = `pattern-${uuidv4()}`;
    await db.run(
      `INSERT INTO ai_learning_patterns (
                id, pattern_type, pattern_category, pattern_data, pattern_description,
                occurrence_count, success_count, failure_count, confidence_score,
                organization_id, first_occurrence_at, last_occurrence_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0.5, ?, ?, ?)`,
      [
        patternId,
        input.patternType,
        input.patternCategory || null,
        dataKey,
        input.patternDescription || null,
        input.isSuccess ? 1 : 0,
        input.isSuccess ? 0 : 1,
        input.organizationId || null,
        now,
        now,
      ]
    );

    return patternId;
  }

  /**
   * Recalculate pattern confidence
   */
  private async recalculatePatternConfidence(patternId: string): Promise<void> {
    const db = await this.getDb();

    const pattern = await db.get<{
      occurrence_count: number;
      success_count: number;
      failure_count: number;
    }>(
      'SELECT occurrence_count, success_count, failure_count FROM ai_learning_patterns WHERE id = ?',
      [patternId]
    );

    if (!pattern) return;

    // Simple confidence calculation
    // More occurrences and higher success rate = higher confidence
    const occurrenceFactor = Math.min(pattern.occurrence_count / 10, 1); // Max at 10 occurrences
    const successRate =
      pattern.occurrence_count > 0 ? pattern.success_count / pattern.occurrence_count : 0.5;

    const confidence = occurrenceFactor * 0.3 + successRate * 0.7;

    await db.run(`UPDATE ai_learning_patterns SET confidence_score = ? WHERE id = ?`, [
      confidence,
      patternId,
    ]);
  }

  /**
   * Get high-confidence patterns
   */
  async getPatterns(
    patternType?: string,
    orgId?: string,
    minConfidence: number = 0.7,
    limit: number = 20
  ): Promise<LearningPattern[]> {
    const db = await this.getDb();

    let query = `SELECT * FROM ai_learning_patterns WHERE confidence_score >= ?`;
    const params: (string | number)[] = [minConfidence];

    if (patternType) {
      query += ` AND pattern_type = ?`;
      params.push(patternType);
    }

    if (orgId) {
      query += ` AND (organization_id = ? OR organization_id IS NULL)`;
      params.push(orgId);
    }

    query += ` ORDER BY confidence_score DESC, occurrence_count DESC LIMIT ?`;
    params.push(limit);

    const patterns = await db.all<{
      id: string;
      pattern_type: string;
      pattern_category: string;
      pattern_data: string;
      pattern_description: string;
      occurrence_count: number;
      success_count: number;
      failure_count: number;
      confidence_score: number;
      organization_id: string;
    }>(query, params);

    return (patterns || []).map((p) => ({
      id: p.id,
      patternType: p.pattern_type,
      patternCategory: p.pattern_category,
      patternData: JSON.parse(p.pattern_data),
      patternDescription: p.pattern_description,
      occurrenceCount: p.occurrence_count,
      successCount: p.success_count,
      failureCount: p.failure_count,
      confidenceScore: p.confidence_score,
      organizationId: p.organization_id,
    }));
  }

  // ==========================================
  // QUALITY METRICS
  // ==========================================

  /**
   * Calculate and store quality metrics
   */
  async calculateQualityMetrics(orgId?: string): Promise<QualityMetrics> {
    const db = await this.getDb();
    const today = new Date().toISOString().split('T')[0];

    // Get feedback stats for today
    let query = `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN feedback_type = 'like' THEN 1 ELSE 0 END) as likes,
            SUM(CASE WHEN feedback_type = 'dislike' THEN 1 ELSE 0 END) as dislikes,
            SUM(CASE WHEN feedback_type = 'correction' THEN 1 ELSE 0 END) as corrections,
            AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating
        FROM ai_feedback WHERE DATE(created_at) = ?`;

    const params: (string | null)[] = [today];
    if (orgId) {
      query += ` AND organization_id = ?`;
      params.push(orgId);
    }

    const stats = await db.get<{
      total: number;
      likes: number;
      dislikes: number;
      corrections: number;
      avg_rating: number;
    }>(query, params);

    const total = stats?.total || 0;
    const likes = stats?.likes || 0;
    const dislikes = stats?.dislikes || 0;
    const corrections = stats?.corrections || 0;

    // Calculate scores
    const helpfulnessScore = total > 0 ? (likes / (likes + dislikes)) * 100 || 50 : 50;
    const accuracyScore = total > 0 ? Math.max(0, 100 - (corrections / total) * 100) : 50;
    const avgRating = stats?.avg_rating || 3;
    const relevanceScore = (avgRating / 5) * 100;
    const toneScore = 75; // Default - would need sentiment analysis

    const overallScore = (helpfulnessScore + accuracyScore + relevanceScore + toneScore) / 4;

    // Get yesterday's score for trend
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const yesterdayMetrics = await db.get<{ overall_score: number }>(
      `SELECT overall_score FROM ai_quality_metrics WHERE metric_date = ? AND organization_id ${orgId ? '= ?' : 'IS NULL'}`,
      orgId ? [yesterday, orgId] : [yesterday]
    );

    const previousScore = yesterdayMetrics?.overall_score || overallScore;
    const scoreChange = overallScore - previousScore;
    const trend: QualityMetrics['trend'] =
      scoreChange > 2 ? 'improving' : scoreChange < -2 ? 'declining' : 'stable';

    // Store metrics
    const metricsId = `metrics-${uuidv4()}`;
    await db.run(
      `INSERT OR REPLACE INTO ai_quality_metrics (
                id, organization_id, metric_date, overall_score, accuracy_score,
                helpfulness_score, relevance_score, tone_score, total_feedback_count,
                positive_feedback_count, negative_feedback_count, correction_count,
                score_change_from_yesterday, trend
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metricsId,
        orgId || null,
        today,
        overallScore,
        accuracyScore,
        helpfulnessScore,
        relevanceScore,
        toneScore,
        total,
        likes,
        dislikes,
        corrections,
        scoreChange,
        trend,
      ]
    );

    return {
      overallScore,
      accuracyScore,
      helpfulnessScore,
      relevanceScore,
      toneScore,
      trend,
      totalInteractions: total,
      feedbackCount: total,
    };
  }

  /**
   * Get quality metrics
   */
  async getQualityMetrics(orgId?: string): Promise<QualityMetrics> {
    const db = await this.getDb();
    const today = new Date().toISOString().split('T')[0];

    const metrics = await db.get<{
      overall_score: number;
      accuracy_score: number;
      helpfulness_score: number;
      relevance_score: number;
      tone_score: number;
      trend: string;
      total_interactions: number;
      total_feedback_count: number;
    }>(
      `SELECT * FROM ai_quality_metrics WHERE metric_date = ? AND organization_id ${orgId ? '= ?' : 'IS NULL'}`,
      orgId ? [today, orgId] : [today]
    );

    if (!metrics) {
      return this.calculateQualityMetrics(orgId);
    }

    return {
      overallScore: metrics.overall_score,
      accuracyScore: metrics.accuracy_score,
      helpfulnessScore: metrics.helpfulness_score,
      relevanceScore: metrics.relevance_score,
      toneScore: metrics.tone_score,
      trend: metrics.trend as QualityMetrics['trend'],
      totalInteractions: metrics.total_interactions || 0,
      feedbackCount: metrics.total_feedback_count || 0,
    };
  }

  // ==========================================
  // INSTRUCTION SUGGESTIONS
  // ==========================================

  /**
   * Get pending instruction suggestions
   */
  async getInstructionSuggestions(limit: number = 10): Promise<InstructionSuggestion[]> {
    const db = await this.getDb();

    const suggestions = await db.all<{
      id: string;
      suggested_instruction: string;
      category: string;
      reason: string;
      confidence_score: number;
      status: string;
    }>(
      `SELECT * FROM ai_instruction_suggestions 
             WHERE status = 'pending' 
             ORDER BY confidence_score DESC 
             LIMIT ?`,
      [limit]
    );

    return (suggestions || []).map((s) => ({
      id: s.id,
      suggestedInstruction: s.suggested_instruction,
      category: s.category,
      reason: s.reason,
      confidenceScore: s.confidence_score,
      status: s.status as InstructionSuggestion['status'],
    }));
  }

  /**
   * Approve or reject instruction suggestion
   */
  async reviewSuggestion(
    suggestionId: string,
    reviewerId: string,
    action: 'approve' | 'reject',
    notes?: string
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.run(
      `UPDATE ai_instruction_suggestions SET 
                status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ?
             WHERE id = ?`,
      [newStatus, reviewerId, now, notes || null, suggestionId]
    );

    logger.info(`[AILearningService] Suggestion ${suggestionId} ${action}d by ${reviewerId}`);
  }
}

// Export singleton
const aiLearningService = new AILearningService();
export default aiLearningService;

// Named exports
export const submitFeedback = (input: FeedbackInput) => aiLearningService.submitFeedback(input);
export const getPendingFeedback = (orgId?: string, limit?: number) =>
  aiLearningService.getPendingFeedback(orgId, limit);
export const reviewFeedback = (id: string, reviewerId: string, action?: string) =>
  aiLearningService.reviewFeedback(id, reviewerId, action);
export const recordPattern = (input: Parameters<typeof aiLearningService.recordPattern>[0]) =>
  aiLearningService.recordPattern(input);
export const getPatterns = (type?: string, orgId?: string, minConf?: number, limit?: number) =>
  aiLearningService.getPatterns(type, orgId, minConf, limit);
export const calculateQualityMetrics = (orgId?: string) =>
  aiLearningService.calculateQualityMetrics(orgId);
export const getQualityMetrics = (orgId?: string) => aiLearningService.getQualityMetrics(orgId);
export const getInstructionSuggestions = (limit?: number) =>
  aiLearningService.getInstructionSuggestions(limit);
export const reviewSuggestion = (
  id: string,
  reviewerId: string,
  action: 'approve' | 'reject',
  notes?: string
) => aiLearningService.reviewSuggestion(id, reviewerId, action, notes);
