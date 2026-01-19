/**
 * AI Learning Service
 * 
 * Manages continuous learning from user feedback to improve AI responses.
 * Tracks patterns, effectiveness, and generates improvement suggestions.
 * 
 * @version 1.0.0
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface LearningInteraction {
  id: string;
  conversationId: string;
  messageId: string;
  userId: string;
  organizationId: string;
  
  // Context
  query: string;
  response: string;
  focusMode?: string;
  workspaceContext?: string;
  
  // Feedback
  rating: 'positive' | 'negative' | 'neutral';
  lengthFeedback?: 'too-short' | 'just-right' | 'too-long';
  detailFeedback?: 'too-little' | 'just-right' | 'too-much';
  styleFeedback?: 'too-formal' | 'just-right' | 'too-casual';
  accuracyFeedback?: 'accurate' | 'partially-accurate' | 'inaccurate';
  helpfulnessFeedback?: 'very-helpful' | 'somewhat-helpful' | 'not-helpful';
  comment?: string;
  
  // Metadata
  responseLength: number;
  responseTime?: number;
  modelUsed?: string;
  instructionsUsed?: string[];
  
  createdAt: Date;
}

export interface LearningPattern {
  id: string;
  organizationId: string;
  patternType: 'preference' | 'issue' | 'success' | 'failure';
  category: string; // e.g., 'length', 'style', 'accuracy', 'topic'
  pattern: string;
  occurrenceCount: number;
  confidence: number;
  impact: 'positive' | 'negative' | 'neutral';
  suggestedAction?: string;
  metadata?: Record<string, any>;
  lastOccurrence: Date;
  createdAt: Date;
}

export interface QualityMetrics {
  organizationId: string;
  period: string; // e.g., '2026-01', '2026-01-19'
  totalInteractions: number;
  positiveRating: number;
  negativeRating: number;
  neutralRating: number;
  avgResponseLength: number;
  avgResponseTime: number;
  lengthIssues: { tooShort: number; tooLong: number };
  detailIssues: { tooLittle: number; tooMuch: number };
  styleIssues: { tooFormal: number; tooCasual: number };
  satisfactionRate: number;
}

export interface ImprovementSuggestion {
  id: string;
  organizationId: string;
  suggestionType: 'instruction' | 'configuration' | 'training';
  title: string;
  description: string;
  basedOnPatterns: string[];
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: number;
  status: 'pending' | 'applied' | 'dismissed';
  createdAt: Date;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

class AILearningServiceImpl {
  private static instance: AILearningServiceImpl;

  private constructor() {}

  public static getInstance(): AILearningServiceImpl {
    if (!AILearningServiceImpl.instance) {
      AILearningServiceImpl.instance = new AILearningServiceImpl();
    }
    return AILearningServiceImpl.instance;
  }

  // ==========================================
  // INTERACTION RECORDING
  // ==========================================

  /**
   * Record an AI interaction with feedback
   */
  async recordInteraction(interaction: Omit<LearningInteraction, 'id' | 'createdAt'>): Promise<string> {
    try {
      const id = `int-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      await dbRun(
        `INSERT INTO ai_learning_interactions (
          id, conversation_id, message_id, user_id, organization_id,
          query, response, focus_mode, workspace_context,
          rating, length_feedback, detail_feedback, style_feedback,
          accuracy_feedback, helpfulness_feedback, comment,
          response_length, response_time, model_used, instructions_used,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          interaction.conversationId,
          interaction.messageId,
          interaction.userId,
          interaction.organizationId,
          interaction.query,
          interaction.response,
          interaction.focusMode || null,
          interaction.workspaceContext || null,
          interaction.rating,
          interaction.lengthFeedback || null,
          interaction.detailFeedback || null,
          interaction.styleFeedback || null,
          interaction.accuracyFeedback || null,
          interaction.helpfulnessFeedback || null,
          interaction.comment || null,
          interaction.responseLength,
          interaction.responseTime || null,
          interaction.modelUsed || null,
          interaction.instructionsUsed ? JSON.stringify(interaction.instructionsUsed) : null,
          now,
        ]
      );

      // Trigger pattern extraction if negative feedback
      if (interaction.rating === 'negative') {
        await this.analyzeNegativeFeedback(id, interaction);
      }

      logger.info(`[AILearningService] Recorded interaction ${id}`);
      return id;
    } catch (error: any) {
      logger.error('[AILearningService] recordInteraction failed:', error);
      throw error;
    }
  }

  /**
   * Update feedback for an existing interaction
   */
  async updateFeedback(
    interactionId: string,
    feedback: Partial<Pick<LearningInteraction, 
      'rating' | 'lengthFeedback' | 'detailFeedback' | 'styleFeedback' | 
      'accuracyFeedback' | 'helpfulnessFeedback' | 'comment'
    >>
  ): Promise<void> {
    try {
      const setClauses: string[] = [];
      const params: any[] = [];

      if (feedback.rating !== undefined) {
        setClauses.push('rating = ?');
        params.push(feedback.rating);
      }
      if (feedback.lengthFeedback !== undefined) {
        setClauses.push('length_feedback = ?');
        params.push(feedback.lengthFeedback);
      }
      if (feedback.detailFeedback !== undefined) {
        setClauses.push('detail_feedback = ?');
        params.push(feedback.detailFeedback);
      }
      if (feedback.styleFeedback !== undefined) {
        setClauses.push('style_feedback = ?');
        params.push(feedback.styleFeedback);
      }
      if (feedback.accuracyFeedback !== undefined) {
        setClauses.push('accuracy_feedback = ?');
        params.push(feedback.accuracyFeedback);
      }
      if (feedback.helpfulnessFeedback !== undefined) {
        setClauses.push('helpfulness_feedback = ?');
        params.push(feedback.helpfulnessFeedback);
      }
      if (feedback.comment !== undefined) {
        setClauses.push('comment = ?');
        params.push(feedback.comment);
      }

      if (setClauses.length === 0) return;

      params.push(interactionId);

      await dbRun(
        `UPDATE ai_learning_interactions SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    } catch (error: any) {
      logger.error('[AILearningService] updateFeedback failed:', error);
    }
  }

  // ==========================================
  // PATTERN EXTRACTION
  // ==========================================

  /**
   * Extract patterns from feedback for an organization
   */
  async extractPatterns(organizationId: string, days: number = 30): Promise<LearningPattern[]> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Get recent interactions
      const interactions = await dbAll(
        `SELECT * FROM ai_learning_interactions 
         WHERE organization_id = ? AND created_at > ?
         ORDER BY created_at DESC`,
        [organizationId, cutoff]
      );

      const patterns: LearningPattern[] = [];

      // Analyze length preferences
      const lengthPattern = this.analyzeLengthPattern(interactions);
      if (lengthPattern) patterns.push(lengthPattern);

      // Analyze detail preferences
      const detailPattern = this.analyzeDetailPattern(interactions);
      if (detailPattern) patterns.push(detailPattern);

      // Analyze style preferences
      const stylePattern = this.analyzeStylePattern(interactions);
      if (stylePattern) patterns.push(stylePattern);

      // Analyze common issues
      const issuePatterns = this.analyzeIssuePatterns(interactions);
      patterns.push(...issuePatterns);

      // Save patterns to database
      for (const pattern of patterns) {
        await this.savePattern(organizationId, pattern);
      }

      return patterns;
    } catch (error: any) {
      logger.error('[AILearningService] extractPatterns failed:', error);
      return [];
    }
  }

  /**
   * Analyze negative feedback for immediate pattern detection
   */
  private async analyzeNegativeFeedback(
    interactionId: string,
    interaction: Omit<LearningInteraction, 'id' | 'createdAt'>
  ): Promise<void> {
    try {
      // Check for specific issues
      if (interaction.lengthFeedback && interaction.lengthFeedback !== 'just-right') {
        await this.incrementPattern(
          interaction.organizationId,
          'issue',
          'length',
          interaction.lengthFeedback,
          'negative'
        );
      }

      if (interaction.detailFeedback && interaction.detailFeedback !== 'just-right') {
        await this.incrementPattern(
          interaction.organizationId,
          'issue',
          'detail',
          interaction.detailFeedback,
          'negative'
        );
      }

      if (interaction.styleFeedback && interaction.styleFeedback !== 'just-right') {
        await this.incrementPattern(
          interaction.organizationId,
          'issue',
          'style',
          interaction.styleFeedback,
          'negative'
        );
      }

      if (interaction.accuracyFeedback === 'inaccurate') {
        await this.incrementPattern(
          interaction.organizationId,
          'issue',
          'accuracy',
          'inaccurate-response',
          'negative'
        );
      }
    } catch (error: any) {
      logger.error('[AILearningService] analyzeNegativeFeedback failed:', error);
    }
  }

  // ==========================================
  // INSTRUCTION EFFECTIVENESS
  // ==========================================

  /**
   * Update instruction effectiveness based on interaction outcome
   */
  async updateInstructionEffectiveness(
    instructionId: string,
    wasHelpful: boolean
  ): Promise<void> {
    try {
      const column = wasHelpful ? 'positive_feedback_count' : 'negative_feedback_count';
      
      // Update in ai_instruction_effectiveness table
      await dbRun(
        `INSERT INTO ai_instruction_effectiveness (id, instruction_id, ${column}, updated_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(instruction_id) DO UPDATE SET
           ${column} = ${column} + 1,
           effectiveness_score = CAST(positive_feedback_count AS REAL) / 
             NULLIF(positive_feedback_count + negative_feedback_count, 0),
           updated_at = ?`,
        [
          `eff-${crypto.randomUUID()}`,
          instructionId,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    } catch (error: any) {
      logger.error('[AILearningService] updateInstructionEffectiveness failed:', error);
    }
  }

  // ==========================================
  // QUALITY METRICS
  // ==========================================

  /**
   * Get quality metrics for an organization
   */
  async getQualityMetrics(
    organizationId: string,
    period: 'day' | 'week' | 'month' = 'month'
  ): Promise<QualityMetrics | null> {
    try {
      let dateFn: string;
      switch (period) {
        case 'day':
          dateFn = "strftime('%Y-%m-%d', created_at)";
          break;
        case 'week':
          dateFn = "strftime('%Y-W%W', created_at)";
          break;
        case 'month':
        default:
          dateFn = "strftime('%Y-%m', created_at)";
      }

      const stats: any = await dbGet(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive,
           SUM(CASE WHEN rating = 'negative' THEN 1 ELSE 0 END) as negative,
           SUM(CASE WHEN rating = 'neutral' THEN 1 ELSE 0 END) as neutral,
           AVG(response_length) as avg_length,
           AVG(response_time) as avg_time,
           SUM(CASE WHEN length_feedback = 'too-short' THEN 1 ELSE 0 END) as too_short,
           SUM(CASE WHEN length_feedback = 'too-long' THEN 1 ELSE 0 END) as too_long,
           SUM(CASE WHEN detail_feedback = 'too-little' THEN 1 ELSE 0 END) as too_little,
           SUM(CASE WHEN detail_feedback = 'too-much' THEN 1 ELSE 0 END) as too_much,
           SUM(CASE WHEN style_feedback = 'too-formal' THEN 1 ELSE 0 END) as too_formal,
           SUM(CASE WHEN style_feedback = 'too-casual' THEN 1 ELSE 0 END) as too_casual,
           ${dateFn} as period
         FROM ai_learning_interactions
         WHERE organization_id = ?
         GROUP BY ${dateFn}
         ORDER BY period DESC
         LIMIT 1`,
        [organizationId]
      );

      if (!stats || stats.total === 0) return null;

      return {
        organizationId,
        period: stats.period,
        totalInteractions: stats.total,
        positiveRating: stats.positive || 0,
        negativeRating: stats.negative || 0,
        neutralRating: stats.neutral || 0,
        avgResponseLength: Math.round(stats.avg_length || 0),
        avgResponseTime: Math.round(stats.avg_time || 0),
        lengthIssues: {
          tooShort: stats.too_short || 0,
          tooLong: stats.too_long || 0,
        },
        detailIssues: {
          tooLittle: stats.too_little || 0,
          tooMuch: stats.too_much || 0,
        },
        styleIssues: {
          tooFormal: stats.too_formal || 0,
          tooCasual: stats.too_casual || 0,
        },
        satisfactionRate: stats.total > 0 
          ? ((stats.positive || 0) / stats.total) * 100 
          : 0,
      };
    } catch (error: any) {
      logger.error('[AILearningService] getQualityMetrics failed:', error);
      return null;
    }
  }

  /**
   * Get quality trend over time
   */
  async getQualityTrend(
    organizationId: string,
    days: number = 30
  ): Promise<{ date: string; satisfactionRate: number; totalInteractions: number }[]> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const rows = await dbAll(
        `SELECT 
           date(created_at) as date,
           COUNT(*) as total,
           SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive
         FROM ai_learning_interactions
         WHERE organization_id = ? AND created_at > ?
         GROUP BY date(created_at)
         ORDER BY date ASC`,
        [organizationId, cutoff]
      );

      return rows.map((r: any) => ({
        date: r.date,
        totalInteractions: r.total,
        satisfactionRate: r.total > 0 ? (r.positive / r.total) * 100 : 0,
      }));
    } catch (error: any) {
      logger.error('[AILearningService] getQualityTrend failed:', error);
      return [];
    }
  }

  // ==========================================
  // IMPROVEMENT SUGGESTIONS
  // ==========================================

  /**
   * Generate improvement suggestions based on patterns
   */
  async generateSuggestions(organizationId: string): Promise<ImprovementSuggestion[]> {
    try {
      const patterns = await dbAll(
        `SELECT * FROM ai_learning_patterns 
         WHERE organization_id = ? AND impact = 'negative' AND occurrence_count >= 5
         ORDER BY occurrence_count DESC
         LIMIT 10`,
        [organizationId]
      );

      const suggestions: ImprovementSuggestion[] = [];

      for (const pattern of patterns) {
        const p = pattern as any;
        let suggestion: Partial<ImprovementSuggestion> | null = null;

        // Generate suggestion based on pattern type
        if (p.category === 'length' && p.pattern === 'too-short') {
          suggestion = {
            suggestionType: 'instruction',
            title: 'Increase Default Response Length',
            description: 'Users frequently report responses are too short. Consider adding an instruction to provide more detailed responses.',
            priority: p.occurrence_count >= 20 ? 'high' : 'medium',
            estimatedImpact: 0.15,
          };
        } else if (p.category === 'length' && p.pattern === 'too-long') {
          suggestion = {
            suggestionType: 'instruction',
            title: 'Reduce Response Verbosity',
            description: 'Users frequently report responses are too long. Consider adding an instruction to be more concise.',
            priority: p.occurrence_count >= 20 ? 'high' : 'medium',
            estimatedImpact: 0.12,
          };
        } else if (p.category === 'detail' && p.pattern === 'too-little') {
          suggestion = {
            suggestionType: 'instruction',
            title: 'Add More Technical Details',
            description: 'Users want more detailed explanations. Consider adjusting response depth settings.',
            priority: p.occurrence_count >= 15 ? 'high' : 'medium',
            estimatedImpact: 0.18,
          };
        } else if (p.category === 'accuracy' && p.pattern === 'inaccurate-response') {
          suggestion = {
            suggestionType: 'configuration',
            title: 'Review Knowledge Base Accuracy',
            description: 'Multiple reports of inaccurate responses. Review and update organizational knowledge facts.',
            priority: 'high',
            estimatedImpact: 0.25,
          };
        }

        if (suggestion) {
          const id = `sug-${crypto.randomUUID()}`;
          suggestions.push({
            id,
            organizationId,
            basedOnPatterns: [p.id],
            status: 'pending',
            createdAt: new Date(),
            ...suggestion,
          } as ImprovementSuggestion);
        }
      }

      // Save suggestions
      for (const sug of suggestions) {
        await this.saveSuggestion(sug);
      }

      return suggestions;
    } catch (error: any) {
      logger.error('[AILearningService] generateSuggestions failed:', error);
      return [];
    }
  }

  /**
   * Get pending suggestions for an organization
   */
  async getPendingSuggestions(organizationId: string): Promise<ImprovementSuggestion[]> {
    try {
      const rows = await dbAll(
        `SELECT * FROM ai_improvement_suggestions 
         WHERE organization_id = ? AND status = 'pending'
         ORDER BY priority DESC, created_at DESC`,
        [organizationId]
      );

      return rows.map((r: any) => ({
        id: r.id,
        organizationId: r.organization_id,
        suggestionType: r.suggestion_type,
        title: r.title,
        description: r.description,
        basedOnPatterns: r.based_on_patterns ? JSON.parse(r.based_on_patterns) : [],
        priority: r.priority,
        estimatedImpact: r.estimated_impact,
        status: r.status,
        createdAt: new Date(r.created_at),
      }));
    } catch (error: any) {
      logger.error('[AILearningService] getPendingSuggestions failed:', error);
      return [];
    }
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private analyzeLengthPattern(interactions: any[]): LearningPattern | null {
    const lengthFeedback = interactions
      .filter((i: any) => i.length_feedback)
      .map((i: any) => i.length_feedback);

    if (lengthFeedback.length < 10) return null;

    const counts = {
      'too-short': lengthFeedback.filter(f => f === 'too-short').length,
      'just-right': lengthFeedback.filter(f => f === 'just-right').length,
      'too-long': lengthFeedback.filter(f => f === 'too-long').length,
    };

    const total = lengthFeedback.length;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    if (dominant[1] / total >= 0.4 && dominant[0] !== 'just-right') {
      return {
        id: `pat-${crypto.randomUUID()}`,
        organizationId: '',
        patternType: 'preference',
        category: 'length',
        pattern: dominant[0],
        occurrenceCount: dominant[1],
        confidence: dominant[1] / total,
        impact: 'negative',
        suggestedAction: dominant[0] === 'too-short' 
          ? 'Consider increasing default response length' 
          : 'Consider reducing response verbosity',
        lastOccurrence: new Date(),
        createdAt: new Date(),
      };
    }

    return null;
  }

  private analyzeDetailPattern(interactions: any[]): LearningPattern | null {
    const detailFeedback = interactions
      .filter((i: any) => i.detail_feedback)
      .map((i: any) => i.detail_feedback);

    if (detailFeedback.length < 10) return null;

    const counts = {
      'too-little': detailFeedback.filter(f => f === 'too-little').length,
      'just-right': detailFeedback.filter(f => f === 'just-right').length,
      'too-much': detailFeedback.filter(f => f === 'too-much').length,
    };

    const total = detailFeedback.length;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    if (dominant[1] / total >= 0.4 && dominant[0] !== 'just-right') {
      return {
        id: `pat-${crypto.randomUUID()}`,
        organizationId: '',
        patternType: 'preference',
        category: 'detail',
        pattern: dominant[0],
        occurrenceCount: dominant[1],
        confidence: dominant[1] / total,
        impact: 'negative',
        suggestedAction: dominant[0] === 'too-little'
          ? 'Consider providing more detailed explanations'
          : 'Consider being more concise in explanations',
        lastOccurrence: new Date(),
        createdAt: new Date(),
      };
    }

    return null;
  }

  private analyzeStylePattern(interactions: any[]): LearningPattern | null {
    const styleFeedback = interactions
      .filter((i: any) => i.style_feedback)
      .map((i: any) => i.style_feedback);

    if (styleFeedback.length < 10) return null;

    const counts = {
      'too-formal': styleFeedback.filter(f => f === 'too-formal').length,
      'just-right': styleFeedback.filter(f => f === 'just-right').length,
      'too-casual': styleFeedback.filter(f => f === 'too-casual').length,
    };

    const total = styleFeedback.length;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    if (dominant[1] / total >= 0.4 && dominant[0] !== 'just-right') {
      return {
        id: `pat-${crypto.randomUUID()}`,
        organizationId: '',
        patternType: 'preference',
        category: 'style',
        pattern: dominant[0],
        occurrenceCount: dominant[1],
        confidence: dominant[1] / total,
        impact: 'negative',
        suggestedAction: dominant[0] === 'too-formal'
          ? 'Consider using a more conversational tone'
          : 'Consider using a more professional tone',
        lastOccurrence: new Date(),
        createdAt: new Date(),
      };
    }

    return null;
  }

  private analyzeIssuePatterns(interactions: any[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];
    
    // Analyze negative interactions for common issues
    const negativeInteractions = interactions.filter((i: any) => i.rating === 'negative');
    
    if (negativeInteractions.length >= 5) {
      // Check for accuracy issues
      const accuracyIssues = negativeInteractions.filter(
        (i: any) => i.accuracy_feedback === 'inaccurate'
      );
      
      if (accuracyIssues.length >= 3) {
        patterns.push({
          id: `pat-${crypto.randomUUID()}`,
          organizationId: '',
          patternType: 'issue',
          category: 'accuracy',
          pattern: 'inaccurate-responses',
          occurrenceCount: accuracyIssues.length,
          confidence: accuracyIssues.length / negativeInteractions.length,
          impact: 'negative',
          suggestedAction: 'Review and update knowledge base, consider adding verification steps',
          lastOccurrence: new Date(),
          createdAt: new Date(),
        });
      }
    }

    return patterns;
  }

  private async incrementPattern(
    organizationId: string,
    patternType: string,
    category: string,
    pattern: string,
    impact: string
  ): Promise<void> {
    try {
      await dbRun(
        `INSERT INTO ai_learning_patterns (
          id, organization_id, pattern_type, category, pattern, 
          occurrence_count, confidence, impact, last_occurrence, created_at
        ) VALUES (?, ?, ?, ?, ?, 1, 0.5, ?, ?, ?)
        ON CONFLICT(organization_id, category, pattern) DO UPDATE SET
          occurrence_count = occurrence_count + 1,
          last_occurrence = ?,
          confidence = MIN(0.95, confidence + 0.02)`,
        [
          `pat-${crypto.randomUUID()}`,
          organizationId,
          patternType,
          category,
          pattern,
          impact,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
    } catch (error: any) {
      // Silently ignore pattern increment errors
      logger.debug('[AILearningService] incrementPattern failed:', error.message);
    }
  }

  private async savePattern(organizationId: string, pattern: LearningPattern): Promise<void> {
    try {
      await dbRun(
        `INSERT OR REPLACE INTO ai_learning_patterns (
          id, organization_id, pattern_type, category, pattern,
          occurrence_count, confidence, impact, suggested_action,
          metadata, last_occurrence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pattern.id,
          organizationId,
          pattern.patternType,
          pattern.category,
          pattern.pattern,
          pattern.occurrenceCount,
          pattern.confidence,
          pattern.impact,
          pattern.suggestedAction || null,
          pattern.metadata ? JSON.stringify(pattern.metadata) : null,
          pattern.lastOccurrence.toISOString(),
          pattern.createdAt.toISOString(),
        ]
      );
    } catch (error: any) {
      logger.error('[AILearningService] savePattern failed:', error);
    }
  }

  private async saveSuggestion(suggestion: ImprovementSuggestion): Promise<void> {
    try {
      await dbRun(
        `INSERT INTO ai_improvement_suggestions (
          id, organization_id, suggestion_type, title, description,
          based_on_patterns, priority, estimated_impact, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          suggestion.id,
          suggestion.organizationId,
          suggestion.suggestionType,
          suggestion.title,
          suggestion.description,
          JSON.stringify(suggestion.basedOnPatterns),
          suggestion.priority,
          suggestion.estimatedImpact,
          suggestion.status,
          suggestion.createdAt.toISOString(),
        ]
      );
    } catch (error: any) {
      logger.error('[AILearningService] saveSuggestion failed:', error);
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const AILearningService = AILearningServiceImpl.getInstance();
export default AILearningService;
