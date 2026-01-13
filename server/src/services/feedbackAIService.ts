// @ts-nocheck
/**
 * Feedback AI Service
 * Enterprise SaaS - AI-Powered Feedback Analysis
 *
 * Features:
 * - Automatic categorization of feedback
 * - Sentiment analysis
 * - Similar feedback detection (deduplication)
 * - Trend identification
 * - Priority scoring
 * - Actionable insights generation
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==================== TYPES ====================

export interface FeedbackAnalysis {
  id: string;
  feedbackId: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number; // -1 to 1
  categories: string[];
  keywords: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  priorityScore: number; // 0-100
  similarFeedbackIds: string[];
  suggestedActions: string[];
  aiSummary: string;
  analyzedAt: string;
}

export interface FeedbackInsight {
  type: 'suggestion' | 'similar' | 'trending' | 'pattern';
  title: string;
  description: string;
  relevance: number;
  relatedFeedbackCount?: number;
  metadata?: Record<string, unknown>;
}

export interface TrendingTopic {
  topic: string;
  count: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  trend: 'rising' | 'stable' | 'falling';
  examples: string[];
}

export interface PulseSummary {
  averageRating: number;
  totalResponses: number;
  distribution: Record<number, number>;
  trend: 'improving' | 'stable' | 'declining';
  topIssues: string[];
}

// ==================== SERVICE CLASS ====================

class FeedbackAIServiceClass {
  private db: IDatabase;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Database helpers
   */
  private async dbAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all<T>(sql, params, (err: Error | null, rows: unknown) => {
        if (err) reject(err);
        else resolve((rows as T[]) || []);
      });
    });
  }

  private async dbGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get<T>(sql, params, (err: Error | null, row: unknown) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  }

  private async dbRun(
    sql: string,
    params: unknown[] = []
  ): Promise<{ lastID?: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        params,
        function (this: { lastID?: number; changes: number }, err: Error | null) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes || 0 });
        }
      );
    });
  }

  // ==================== FEEDBACK ANALYSIS ====================

  /**
   * Analyze feedback content using AI
   */
  async analyzeFeedback(
    feedbackId: string,
    content: string,
    type: string
  ): Promise<FeedbackAnalysis> {
    const id = uuidv4();

    try {
      // Get AI Pipeline for analysis
      let aiPipeline: any = null;
      try {
        const aiModule = await import('./ai/aiPipeline.js');
        const AIPipelineClass = (aiModule as any).AIPipeline;
        aiPipeline = new AIPipelineClass();
      } catch {
        logger.warn('[FeedbackAI] AI Pipeline not available, using rule-based analysis');
      }

      // Analyze with AI or fallback to rule-based
      const analysis = aiPipeline
        ? await this.analyzeWithAI(aiPipeline, content, type)
        : this.analyzeWithRules(content, type);

      // Find similar feedback
      const similarIds = await this.findSimilarFeedback(content, feedbackId);

      // Calculate priority
      const priorityResult = this.calculatePriority(
        analysis.sentiment,
        analysis.sentimentScore,
        type,
        content
      );

      const result: FeedbackAnalysis = {
        id,
        feedbackId,
        sentiment: analysis.sentiment,
        sentimentScore: analysis.sentimentScore,
        categories: analysis.categories,
        keywords: analysis.keywords,
        priority: priorityResult.priority,
        priorityScore: priorityResult.score,
        similarFeedbackIds: similarIds,
        suggestedActions: this.generateSuggestedActions(analysis, type),
        aiSummary: analysis.summary,
        analyzedAt: new Date().toISOString(),
      };

      // Store analysis
      await this.storeAnalysis(result);

      return result;
    } catch (error) {
      logger.error('[FeedbackAI] Analysis error:', error);
      throw error;
    }
  }

  /**
   * AI-powered analysis
   */
  private async analyzeWithAI(
    aiPipeline: any,
    content: string,
    type: string
  ): Promise<{
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    sentimentScore: number;
    categories: string[];
    keywords: string[];
    summary: string;
  }> {
    const systemPrompt = `You are an expert at analyzing user feedback for a SaaS application.
Analyze the following ${type} feedback and return a JSON object with:
- sentiment: "positive", "negative", "neutral", or "mixed"
- sentimentScore: number from -1 (very negative) to 1 (very positive)
- categories: array of relevant categories (e.g., "ui", "performance", "feature", "bug", "usability")
- keywords: array of 3-5 key terms from the feedback
- summary: one sentence summary of the feedback

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await aiPipeline.process({
        type: 'analysis',
        capability: 'feedback_analysis',
        prompt: content,
        options: {
          systemInstruction: systemPrompt,
          maxTokens: 500,
        },
      });

      const text = response.text || response.content || '';
      const parsed = JSON.parse(
        text
          .replace(/```json?/g, '')
          .replace(/```/g, '')
          .trim()
      );

      return {
        sentiment: parsed.sentiment || 'neutral',
        sentimentScore: parsed.sentimentScore || 0,
        categories: parsed.categories || [],
        keywords: parsed.keywords || [],
        summary: parsed.summary || content.substring(0, 100),
      };
    } catch {
      logger.warn('[FeedbackAI] AI analysis failed, using rules');
      return this.analyzeWithRules(content, type);
    }
  }

  /**
   * Rule-based analysis fallback
   */
  private analyzeWithRules(
    content: string,
    type: string
  ): {
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    sentimentScore: number;
    categories: string[];
    keywords: string[];
    summary: string;
  } {
    const lowerContent = content.toLowerCase();

    // Sentiment analysis
    const positiveWords = [
      'great',
      'love',
      'excellent',
      'amazing',
      'helpful',
      'good',
      'nice',
      'perfect',
      'thanks',
    ];
    const negativeWords = [
      'bug',
      'broken',
      'error',
      'crash',
      'slow',
      'terrible',
      'awful',
      'bad',
      'hate',
      'frustrating',
    ];

    const positiveCount = positiveWords.filter((w) => lowerContent.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lowerContent.includes(w)).length;

    let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    let sentimentScore = 0;

    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      sentimentScore = Math.min(1, positiveCount * 0.3);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      sentimentScore = Math.max(-1, negativeCount * -0.3);
    } else if (positiveCount > 0 && negativeCount > 0) {
      sentiment = 'mixed';
    }

    // Category detection
    const categories: string[] = [];
    if (lowerContent.match(/ui|interface|design|button|layout/)) categories.push('ui');
    if (lowerContent.match(/slow|performance|speed|loading/)) categories.push('performance');
    if (lowerContent.match(/feature|add|want|need|wish/)) categories.push('feature');
    if (lowerContent.match(/bug|error|crash|broken|fix/)) categories.push('bug');
    if (lowerContent.match(/confus|difficult|hard to|usab/)) categories.push('usability');

    if (categories.length === 0) categories.push(type.toLowerCase());

    // Extract keywords (simple approach)
    const words = content.split(/\s+/).filter((w) => w.length > 4);
    const keywords = [...new Set(words)].slice(0, 5);

    return {
      sentiment,
      sentimentScore,
      categories,
      keywords,
      summary: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
    };
  }

  /**
   * Find similar feedback using text similarity
   */
  private async findSimilarFeedback(content: string, excludeId: string): Promise<string[]> {
    try {
      // Get recent feedback
      const recentFeedback = await this.dbAll<{ id: string; message: string }>(
        `SELECT id, message FROM system_feedback 
                 WHERE id != ? AND created_at > datetime('now', '-30 days')
                 ORDER BY created_at DESC LIMIT 100`,
        [excludeId]
      );

      // Simple similarity check (could be replaced with embeddings)
      const contentWords = new Set(
        content
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );
      const similar: { id: string; score: number }[] = [];

      for (const fb of recentFeedback) {
        const fbWords = new Set(
          fb.message
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
        );
        const intersection = [...contentWords].filter((w) => fbWords.has(w)).length;
        const union = new Set([...contentWords, ...fbWords]).size;
        const similarity = union > 0 ? intersection / union : 0;

        if (similarity > 0.3) {
          similar.push({ id: fb.id, score: similarity });
        }
      }

      return similar
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((s) => s.id);
    } catch {
      return [];
    }
  }

  /**
   * Calculate priority based on analysis
   */
  private calculatePriority(
    sentiment: string,
    sentimentScore: number,
    type: string,
    content: string
  ): { priority: 'low' | 'medium' | 'high' | 'critical'; score: number } {
    let score = 50; // Base score

    // Adjust by sentiment
    if (sentimentScore < -0.5) score += 30;
    else if (sentimentScore < 0) score += 15;
    else if (sentimentScore > 0.5) score -= 10;

    // Adjust by type
    if (type === 'BUG') score += 20;
    if (type === 'CRITICAL') score += 40;

    // Keyword adjustments
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('crash')) score += 25;
    if (lowerContent.includes('data loss')) score += 30;
    if (lowerContent.includes('security')) score += 25;
    if (lowerContent.includes('urgent')) score += 15;
    if (lowerContent.includes('block')) score += 20;

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine priority level
    let priority: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 80) priority = 'critical';
    else if (score >= 60) priority = 'high';
    else if (score >= 40) priority = 'medium';
    else priority = 'low';

    return { priority, score };
  }

  /**
   * Generate suggested actions
   */
  private generateSuggestedActions(
    analysis: { sentiment: string; categories: string[]; keywords: string[] },
    type: string
  ): string[] {
    const actions: string[] = [];

    if (type === 'BUG') {
      actions.push('Create bug ticket in issue tracker');
      if (analysis.categories.includes('performance')) {
        actions.push('Schedule performance review');
      }
      if (analysis.sentiment === 'negative') {
        actions.push('Send acknowledgment to user');
      }
    }

    if (type === 'IDEA' || analysis.categories.includes('feature')) {
      actions.push('Add to feature backlog');
      actions.push('Check for existing similar requests');
    }

    if (analysis.categories.includes('usability')) {
      actions.push('Schedule UX review');
    }

    if (analysis.sentiment === 'positive') {
      actions.push('Consider for testimonial');
    }

    return actions;
  }

  /**
   * Store analysis in database
   */
  private async storeAnalysis(analysis: FeedbackAnalysis): Promise<void> {
    await this.dbRun(
      `INSERT INTO feedback_analysis 
             (id, feedback_id, sentiment, sentiment_score, categories_json, keywords_json, 
              priority, priority_score, similar_feedback_ids_json, suggested_actions_json, 
              ai_summary, analyzed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        analysis.id,
        analysis.feedbackId,
        analysis.sentiment,
        analysis.sentimentScore,
        JSON.stringify(analysis.categories),
        JSON.stringify(analysis.keywords),
        analysis.priority,
        analysis.priorityScore,
        JSON.stringify(analysis.similarFeedbackIds),
        JSON.stringify(analysis.suggestedActions),
        analysis.aiSummary,
        analysis.analyzedAt,
      ]
    );
  }

  // ==================== INSIGHTS ====================

  /**
   * Generate AI insights for a user context
   */
  async generateInsights(userId: string, context: string): Promise<FeedbackInsight[]> {
    const insights: FeedbackInsight[] = [];

    try {
      // Get trending topics
      const trending = await this.getTrendingTopics();
      for (const topic of trending.slice(0, 2)) {
        insights.push({
          type: 'trending',
          title: `Trending: ${topic.topic}`,
          description: `${topic.count} users mentioned this (${topic.trend})`,
          relevance: 0.8,
          relatedFeedbackCount: topic.count,
        });
      }

      // Get context-specific suggestions
      const contextSuggestions = await this.getContextSuggestions(context);
      insights.push(...contextSuggestions);

      // Get user's previous feedback status
      const userFeedback = await this.getUserFeedbackStatus(userId);
      if (userFeedback.pendingCount > 0) {
        insights.push({
          type: 'suggestion',
          title: 'Your Feedback Updates',
          description: `${userFeedback.pendingCount} of your reports are being worked on`,
          relevance: 0.9,
        });
      }
    } catch (error) {
      logger.error('[FeedbackAI] Insights generation error:', error);
    }

    return insights.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Get trending topics from recent feedback
   */
  async getTrendingTopics(): Promise<TrendingTopic[]> {
    try {
      const analyses = await this.dbAll<{
        keywords_json: string;
        sentiment: string;
        created_at: string;
      }>(
        `SELECT fa.keywords_json, fa.sentiment, sf.created_at
                 FROM feedback_analysis fa
                 JOIN system_feedback sf ON fa.feedback_id = sf.id
                 WHERE sf.created_at > datetime('now', '-7 days')`,
        []
      );

      const topicCounts: Record<string, { count: number; sentiments: string[]; dates: string[] }> =
        {};

      for (const a of analyses) {
        const keywords = JSON.parse(a.keywords_json || '[]') as string[];
        for (const keyword of keywords) {
          if (!topicCounts[keyword]) {
            topicCounts[keyword] = { count: 0, sentiments: [], dates: [] };
          }
          topicCounts[keyword].count++;
          topicCounts[keyword].sentiments.push(a.sentiment);
          topicCounts[keyword].dates.push(a.created_at);
        }
      }

      const topics: TrendingTopic[] = Object.entries(topicCounts)
        .filter(([_, data]) => data.count >= 2)
        .map(([topic, data]) => {
          const posCount = data.sentiments.filter((s) => s === 'positive').length;
          const negCount = data.sentiments.filter((s) => s === 'negative').length;

          return {
            topic,
            count: data.count,
            sentiment:
              posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral',
            trend: 'stable' as const, // Simplified
            examples: [],
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return topics;
    } catch {
      return [];
    }
  }

  /**
   * Get context-specific suggestions
   */
  private async getContextSuggestions(context: string): Promise<FeedbackInsight[]> {
    const suggestions: FeedbackInsight[] = [];

    // Module-specific suggestions
    if (context.includes('assessment')) {
      suggestions.push({
        type: 'suggestion',
        title: 'Assessment Module',
        description: 'Share feedback about assessment workflow or questions',
        relevance: 0.7,
      });
    } else if (context.includes('dashboard')) {
      suggestions.push({
        type: 'suggestion',
        title: 'Dashboard Feedback',
        description: 'Help us improve your dashboard experience',
        relevance: 0.7,
      });
    }

    return suggestions;
  }

  /**
   * Get user's feedback status
   */
  private async getUserFeedbackStatus(
    userId: string
  ): Promise<{ pendingCount: number; resolvedCount: number }> {
    const result = await this.dbGet<{ pending: number; resolved: number }>(
      `SELECT 
                SUM(CASE WHEN status IN ('NEW', 'PENDING', 'IN_PROGRESS') THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved
             FROM system_feedback
             WHERE user_id = ?`,
      [userId]
    );

    return {
      pendingCount: result?.pending || 0,
      resolvedCount: result?.resolved || 0,
    };
  }

  // ==================== PULSE ANALYTICS ====================

  /**
   * Get pulse feedback summary
   */
  async getPulseSummary(period: '7d' | '30d' | '90d' = '30d'): Promise<PulseSummary> {
    const daysBack = period === '7d' ? 7 : period === '90d' ? 90 : 30;

    const pulseData = await this.dbAll<{ rating: number; comment: string | null }>(
      `SELECT rating, comment FROM feedback_pulse 
             WHERE created_at > datetime('now', '-${daysBack} days')`,
      []
    );

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    for (const p of pulseData) {
      distribution[p.rating] = (distribution[p.rating] || 0) + 1;
      totalRating += p.rating;
    }

    const averageRating = pulseData.length > 0 ? totalRating / pulseData.length : 0;

    // Extract top issues from low-rating comments
    const lowRatingComments = pulseData
      .filter((p) => p.rating <= 2 && p.comment)
      .map((p) => p.comment!)
      .slice(0, 5);

    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalResponses: pulseData.length,
      distribution,
      trend: averageRating >= 3.5 ? 'improving' : averageRating >= 2.5 ? 'stable' : 'declining',
      topIssues: lowRatingComments,
    };
  }

  // ==================== FEATURE REQUESTS ====================

  /**
   * Analyze feature request and find similar
   */
  async analyzeFeatureRequest(
    featureName: string,
    description: string,
    category: string
  ): Promise<{
    existingSimilar: Array<{ id: string; name: string; votes: number; status: string }>;
    suggestedCategory: string;
    estimatedDemand: 'low' | 'medium' | 'high';
  }> {
    // Find similar feature requests
    const similar = await this.dbAll<{
      id: string;
      feature_name: string;
      votes_count: number;
      status: string;
    }>(
      `SELECT id, feature_name, votes_count, status 
             FROM feature_requests 
             WHERE status != 'REJECTED'
             ORDER BY votes_count DESC
             LIMIT 50`,
      []
    );

    const content = `${featureName} ${description}`.toLowerCase();
    const matchingSimilar = similar.filter((s) => {
      const simContent = s.feature_name.toLowerCase();
      return content.includes(simContent) || simContent.includes(featureName.toLowerCase());
    });

    // Estimate demand based on similar requests
    const totalVotes = matchingSimilar.reduce((sum, s) => sum + (s.votes_count || 0), 0);
    const estimatedDemand: 'low' | 'medium' | 'high' =
      totalVotes >= 10 ? 'high' : totalVotes >= 3 ? 'medium' : 'low';

    return {
      existingSimilar: matchingSimilar.map((s) => ({
        id: s.id,
        name: s.feature_name,
        votes: s.votes_count || 0,
        status: s.status,
      })),
      suggestedCategory: category,
      estimatedDemand,
    };
  }
}

// ==================== EXPORTS ====================

const feedbackAIService = new FeedbackAIServiceClass();
export default feedbackAIService;
export { FeedbackAIServiceClass };
