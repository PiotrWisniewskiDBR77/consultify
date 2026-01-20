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

  // ==========================================
  // STYLE PATTERN EXTRACTION (v2.0)
  // ==========================================

  /**
   * Extract style patterns from recent feedback for a user
   */
  async extractStylePatterns(userId: string): Promise<{
    patterns: Array<{
      type: string;
      value: string;
      confidence: number;
      count: number;
    }>;
    profileSuggestions: Array<{
      field: string;
      suggestedValue: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    const db = await this.getDb();

    // Get recent feedback for the user
    const recentFeedback = await db.all<{
      length_feedback: string | null;
      detail_feedback: string | null;
      expected_format: string | null;
      screen_context: string | null;
      rating: number;
      actionability: number | null;
      accuracy: number | null;
    }>(
      `SELECT 
        CASE WHEN feedback_type IN ('too-short', 'too_short') THEN 'too_short' 
             WHEN feedback_type IN ('too-long', 'too_long') THEN 'too_long' 
             ELSE NULL END as length_feedback,
        CASE WHEN feedback_type IN ('too-little', 'too_little') THEN 'too_little'
             WHEN feedback_type IN ('too-much', 'too_much') THEN 'too_much'
             ELSE NULL END as detail_feedback,
        expected_format, screen_context, rating, actionability, accuracy
      FROM ai_feedback
      WHERE user_id = ?
      AND created_at > datetime('now', '-30 days')
      ORDER BY created_at DESC
      LIMIT 50`,
      [userId]
    );

    const patterns: Array<{ type: string; value: string; confidence: number; count: number }> = [];
    const profileSuggestions: Array<{ field: string; suggestedValue: string; confidence: number; reason: string }> = [];

    // Analyze length preferences
    const lengthCounts = { too_short: 0, too_long: 0 };
    for (const fb of recentFeedback || []) {
      if (fb.length_feedback === 'too_short') lengthCounts.too_short++;
      if (fb.length_feedback === 'too_long') lengthCounts.too_long++;
    }

    if (lengthCounts.too_short >= 3) {
      const confidence = Math.min(0.9, lengthCounts.too_short * 0.15);
      patterns.push({ type: 'length_preference', value: 'comprehensive', confidence, count: lengthCounts.too_short });
      if (confidence >= 0.6) {
        profileSuggestions.push({
          field: 'responseLength',
          suggestedValue: 'comprehensive',
          confidence,
          reason: `User indicated ${lengthCounts.too_short} times that responses were too short`,
        });
      }
    } else if (lengthCounts.too_long >= 3) {
      const confidence = Math.min(0.9, lengthCounts.too_long * 0.15);
      patterns.push({ type: 'length_preference', value: 'concise', confidence, count: lengthCounts.too_long });
      if (confidence >= 0.6) {
        profileSuggestions.push({
          field: 'responseLength',
          suggestedValue: 'concise',
          confidence,
          reason: `User indicated ${lengthCounts.too_long} times that responses were too long`,
        });
      }
    }

    // Analyze detail/depth preferences
    const detailCounts = { too_little: 0, too_much: 0 };
    for (const fb of recentFeedback || []) {
      if (fb.detail_feedback === 'too_little') detailCounts.too_little++;
      if (fb.detail_feedback === 'too_much') detailCounts.too_much++;
    }

    if (detailCounts.too_little >= 3) {
      const confidence = Math.min(0.9, detailCounts.too_little * 0.15);
      patterns.push({ type: 'depth_preference', value: 'deep_dive', confidence, count: detailCounts.too_little });
      if (confidence >= 0.6) {
        profileSuggestions.push({
          field: 'preferredDepth',
          suggestedValue: 'deep_dive',
          confidence,
          reason: `User indicated ${detailCounts.too_little} times that responses lacked detail`,
        });
      }
    } else if (detailCounts.too_much >= 3) {
      const confidence = Math.min(0.9, detailCounts.too_much * 0.15);
      patterns.push({ type: 'depth_preference', value: 'executive_summary', confidence, count: detailCounts.too_much });
      if (confidence >= 0.6) {
        profileSuggestions.push({
          field: 'preferredDepth',
          suggestedValue: 'executive_summary',
          confidence,
          reason: `User indicated ${detailCounts.too_much} times that responses had too much detail`,
        });
      }
    }

    // Analyze format preferences
    const formatCounts: Record<string, number> = {};
    for (const fb of recentFeedback || []) {
      if (fb.expected_format) {
        formatCounts[fb.expected_format] = (formatCounts[fb.expected_format] || 0) + 1;
      }
    }

    const topFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0];
    if (topFormat && topFormat[1] >= 3) {
      const confidence = Math.min(0.9, topFormat[1] * 0.15);
      patterns.push({ type: 'format_preference', value: topFormat[0], confidence, count: topFormat[1] });
      if (confidence >= 0.6) {
        profileSuggestions.push({
          field: 'preferredFormat',
          suggestedValue: topFormat[0],
          confidence,
          reason: `User requested ${topFormat[0]} format ${topFormat[1]} times`,
        });
      }
    }

    return { patterns, profileSuggestions };
  }

  /**
   * Apply high-confidence profile suggestions
   */
  async applyProfileSuggestions(userId: string): Promise<{ applied: number; skipped: number }> {
    let applied = 0;
    let skipped = 0;

    try {
      const { profileSuggestions } = await this.extractStylePatterns(userId);

      // Only apply suggestions with high confidence
      const highConfidence = profileSuggestions.filter((s) => s.confidence >= 0.7);

      if (highConfidence.length === 0) {
        return { applied: 0, skipped: profileSuggestions.length };
      }

      // Import userStyleProfileService dynamically to avoid circular deps
      const styleModule = await import('./userStyleProfileService.js');
      const userStyleProfileService = styleModule.default;

      if (!userStyleProfileService?.updateProfile) {
        logger.warn('[AILearningService] userStyleProfileService not available');
        return { applied: 0, skipped: profileSuggestions.length };
      }

      const updates: Record<string, string> = {};
      for (const suggestion of highConfidence) {
        updates[suggestion.field] = suggestion.suggestedValue;
        applied++;
      }

      if (Object.keys(updates).length > 0) {
        await userStyleProfileService.updateProfile(userId, updates as any);
        logger.info(`[AILearningService] Applied ${applied} profile suggestions for user ${userId}`);
      }

      skipped = profileSuggestions.length - applied;
    } catch (error) {
      logger.error('[AILearningService] applyProfileSuggestions error:', error);
    }

    return { applied, skipped };
  }

  /**
   * Run learning analysis for all active users
   */
  async runBatchLearning(orgId?: string): Promise<{
    usersProcessed: number;
    patternsFound: number;
    suggestionsApplied: number;
  }> {
    const db = await this.getDb();
    let usersProcessed = 0;
    let patternsFound = 0;
    let suggestionsApplied = 0;

    try {
      // Get users with recent feedback
      let query = `
        SELECT DISTINCT user_id 
        FROM ai_feedback 
        WHERE created_at > datetime('now', '-7 days')
      `;
      const params: string[] = [];

      if (orgId) {
        query += ` AND organization_id = ?`;
        params.push(orgId);
      }

      const users = await db.all<{ user_id: string }>(query, params);

      for (const { user_id } of users || []) {
        try {
          const { patterns, profileSuggestions } = await this.extractStylePatterns(user_id);
          patternsFound += patterns.length;

          // Store patterns
          for (const pattern of patterns) {
            await this.recordPattern({
              patternType: pattern.type,
              patternCategory: 'style',
              patternData: { value: pattern.value, count: pattern.count },
              patternDescription: `${pattern.type}: ${pattern.value}`,
              isSuccess: pattern.confidence >= 0.7,
            });
          }

          // Apply high-confidence suggestions
          const { applied } = await this.applyProfileSuggestions(user_id);
          suggestionsApplied += applied;

          usersProcessed++;
        } catch (err) {
          logger.warn(`[AILearningService] Failed to process user ${user_id}:`, err);
        }
      }

      logger.info(
        `[AILearningService] Batch learning complete: ${usersProcessed} users, ${patternsFound} patterns, ${suggestionsApplied} suggestions applied`
      );
    } catch (error) {
      logger.error('[AILearningService] runBatchLearning error:', error);
    }

    return { usersProcessed, patternsFound, suggestionsApplied };
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
export const extractStylePatterns = (userId: string) =>
  aiLearningService.extractStylePatterns(userId);
export const applyProfileSuggestions = (userId: string) =>
  aiLearningService.applyProfileSuggestions(userId);
export const runBatchLearning = (orgId?: string) => aiLearningService.runBatchLearning(orgId);
