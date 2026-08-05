/**
 * Feedback Learning Service
 *
 * Integrates user feedback with AI memory system.
 * Learns from feedback to improve future AI responses.
 *
 * Learning Pipeline:
 * 1. User provides feedback (thumbs up/down, detailed feedback)
 * 2. Service analyzes feedback patterns
 * 3. Updates user memory with learned preferences
 * 4. Optionally updates organization memory for shared learnings
 *
 * Extended in v2.0.0 with adaptive style feedback fields
 *
 * @version 2.0.0
 */

import { Api } from './api';
import { MemoryCategory, MemoryService } from './memoryService';

// ============================================================================
// Types
// ============================================================================

export interface FeedbackData {
  messageId: string;
  conversationId: string;
  rating: 'positive' | 'negative';

  // Detailed feedback
  lengthFeedback?: 'too-short' | 'just-right' | 'too-long';
  detailFeedback?: 'too-little' | 'just-right' | 'too-much';
  styleFeedback?: 'too-formal' | 'just-right' | 'too-casual';

  // Advanced feedback (v2.0 - Adaptive Style)
  actionability?: number; // 1-5
  accuracy?: number; // 1-5
  expectedFormat?: 'bullets' | 'paragraphs' | 'structured' | 'conversational';
  missingInfo?: string;

  // Optional text feedback
  customFeedback?: string;
  wantedMode?: string;

  // Context
  responseLength: number;
  focusMode?: string;
  workspaceContext?: string;
  screenContext?: string;
}

export interface FeedbackPattern {
  category: string;
  pattern: string;
  confidence: number;
  count: number;
  lastSeen: Date;
}

export interface LearningStats {
  totalFeedback: number;
  positiveRate: number;
  topPatterns: FeedbackPattern[];
  lastLearningUpdate: Date;
}

// ============================================================================
// Feedback Learning Service
// ============================================================================

class FeedbackLearningServiceClass {
  private feedbackBuffer: FeedbackData[] = [];
  private bufferFlushInterval = 5 * 60 * 1000; // 5 minutes
  private minFeedbackForLearning = 3;

  constructor() {
    // Periodically flush feedback buffer
    setInterval(() => this.flushFeedbackBuffer(), this.bufferFlushInterval);
  }

  // ========================================================================
  // Submit Feedback
  // ========================================================================

  /**
   * Submit user feedback and trigger learning if appropriate
   */
  async submitFeedback(feedback: FeedbackData): Promise<void> {
    console.log('[FeedbackLearning] Feedback received:', {
      rating: feedback.rating,
      hasDetailedFeedback: !!(feedback.lengthFeedback || feedback.detailFeedback),
    });

    // Add to buffer
    this.feedbackBuffer.push(feedback);

    // Immediate memory update for explicit preferences
    if (feedback.rating === 'positive' || feedback.rating === 'negative') {
      await this.processImmediateFeedback(feedback);
    }

    // Check if we have enough feedback for pattern learning
    if (this.feedbackBuffer.length >= this.minFeedbackForLearning) {
      await this.learnFromPatterns();
    }

    // Send to backend for storage (v2.0 Adaptive System)
    //
    // M01-P03B (coordinator fix-required, 2026-08-05) — this call is NOT a
    // best-effort side effect like the memory-learning calls above; it is
    // the ACTUAL PERSISTENCE of the user's rating (POST
    // /api/ai-feedback/response -> ai_response_feedback). Swallowing its
    // error here meant a 500 (save failed) or 403 (not your message) looked
    // IDENTICAL, from the caller's point of view, to a real 201 — a
    // confirmed false-success (P1): InlineResponseFeedback set "already
    // rated" regardless of whether anything was actually saved. Rethrow so
    // the caller can tell the difference and be honest about it.
    try {
      await Api.aiFeedback({
        messageId: feedback.messageId,
        conversationId: feedback.conversationId,
        rating: feedback.rating,
        lengthFeedback: feedback.lengthFeedback,
        detailFeedback: feedback.detailFeedback,
        customFeedback: feedback.customFeedback,
        wantedMode: feedback.wantedMode,
        // Advanced v2.0 fields
        actionability: feedback.actionability,
        accuracy: feedback.accuracy,
        expectedFormat: feedback.expectedFormat,
        missingInfo: feedback.missingInfo,
        screenContext: feedback.screenContext,
        focusMode: feedback.focusMode,
        responseMode: feedback.focusMode,
        capability: feedback.workspaceContext || 'chat',
      });
    } catch (err: any) {
      console.error('[FeedbackLearning] Failed to submit to backend:', err);
      throw err;
    }
  }

  // ========================================================================
  // Immediate Learning
  // ========================================================================

  /**
   * Process feedback that should immediately update memory
   */
  private async processImmediateFeedback(feedback: FeedbackData): Promise<void> {
    try {
      // Learn length preference
      if (feedback.lengthFeedback && feedback.lengthFeedback !== 'just-right') {
        const preference = feedback.lengthFeedback === 'too-long' ? 'concise' : 'detailed';
        await MemoryService.updateUserMemory({
          key: 'response_length_preference',
          value: preference,
          category: 'preference',
          source: 'feedback',
        });
        console.log('[FeedbackLearning] Updated length preference:', preference);
      }

      // Learn detail preference
      if (feedback.detailFeedback && feedback.detailFeedback !== 'just-right') {
        const preference = feedback.detailFeedback === 'too-much' ? 'summarized' : 'comprehensive';
        await MemoryService.updateUserMemory({
          key: 'detail_level_preference',
          value: preference,
          category: 'preference',
          source: 'feedback',
        });
        console.log('[FeedbackLearning] Updated detail preference:', preference);
      }

      // Learn style preference
      if (feedback.styleFeedback && feedback.styleFeedback !== 'just-right') {
        const preference = feedback.styleFeedback === 'too-formal' ? 'casual' : 'formal';
        await MemoryService.updateUserMemory({
          key: 'communication_style',
          value: preference,
          category: 'style',
          source: 'feedback',
        });
        console.log('[FeedbackLearning] Updated style preference:', preference);
      }

      // Learn focus mode preference
      if (feedback.wantedMode && feedback.focusMode !== feedback.wantedMode) {
        await MemoryService.updateUserMemory({
          key: `preferred_mode_${feedback.workspaceContext || 'general'}`,
          value: feedback.wantedMode,
          category: 'preference',
          source: 'feedback',
        });
        console.log('[FeedbackLearning] Updated mode preference:', feedback.wantedMode);
      }

      // Track negative feedback for context
      if (feedback.rating === 'negative' && feedback.workspaceContext) {
        await MemoryService.updateUserMemory({
          key: `context_issues_${feedback.workspaceContext}`,
          value: `User had issues with response in ${feedback.workspaceContext} context`,
          category: 'context',
          source: 'feedback',
        });
      }
    } catch (err: any) {
      console.error('[FeedbackLearning] Immediate learning failed:', err);
    }
  }

  // ========================================================================
  // Pattern Learning
  // ========================================================================

  /**
   * Learn from accumulated feedback patterns
   */
  private async learnFromPatterns(): Promise<void> {
    const recentFeedback = this.feedbackBuffer.slice(-20); // Last 20 feedbacks

    if (recentFeedback.length < this.minFeedbackForLearning) {
      return;
    }

    console.log('[FeedbackLearning] Analyzing patterns from', recentFeedback.length, 'feedbacks');

    // Analyze length patterns
    const lengthFeedbacks = recentFeedback.filter((f) => f.lengthFeedback);
    if (lengthFeedbacks.length >= 3) {
      const tooLong = lengthFeedbacks.filter((f) => f.lengthFeedback === 'too-long').length;
      const tooShort = lengthFeedbacks.filter((f) => f.lengthFeedback === 'too-short').length;

      const lengthTendency =
        tooLong > tooShort * 2 ? 'shorter' : tooShort > tooLong * 2 ? 'longer' : null;

      if (lengthTendency) {
        await MemoryService.updateUserMemory({
          key: 'response_length_tendency',
          value: lengthTendency,
          category: 'preference',
          source: 'inferred',
        });
        console.log('[FeedbackLearning] Inferred length tendency:', lengthTendency);
      }
    }

    // Analyze positive/negative ratio by context
    const contextGroups = this.groupByContext(recentFeedback);
    for (const [context, feedbacks] of Object.entries(contextGroups)) {
      const positiveRate =
        feedbacks.filter((f) => f.rating === 'positive').length / feedbacks.length;

      if (positiveRate < 0.3 && feedbacks.length >= 3) {
        // Low satisfaction in this context - flag it
        await MemoryService.updateUserMemory({
          key: `low_satisfaction_${context}`,
          value: `User satisfaction is low (${Math.round(positiveRate * 100)}%) in ${context} context`,
          category: 'context',
          source: 'inferred',
        });
        console.log('[FeedbackLearning] Flagged low satisfaction context:', context);
      }
    }

    // Clear processed feedback
    this.feedbackBuffer = this.feedbackBuffer.slice(-5);
  }

  /**
   * Group feedback by workspace context
   */
  private groupByContext(feedback: FeedbackData[]): Record<string, FeedbackData[]> {
    const groups: Record<string, FeedbackData[]> = {};

    for (const f of feedback) {
      const context = f.workspaceContext || 'general';
      if (!groups[context]) {
        groups[context] = [];
      }
      groups[context].push(f);
    }

    return groups;
  }

  // ========================================================================
  // Buffer Management
  // ========================================================================

  /**
   * Flush feedback buffer (periodic cleanup)
   */
  private async flushFeedbackBuffer(): Promise<void> {
    if (this.feedbackBuffer.length > 0) {
      await this.learnFromPatterns();
    }
  }

  // ========================================================================
  // Stats
  // ========================================================================

  /**
   * Get learning statistics
   */
  async getLearningStats(): Promise<LearningStats> {
    const memory = await MemoryService.getUserMemory();

    const feedbackEntries = memory.entries.filter(
      (e) => e.source === 'feedback' || e.source === 'inferred'
    );

    return {
      totalFeedback: this.feedbackBuffer.length,
      positiveRate: this.calculatePositiveRate(),
      topPatterns: this.extractTopPatterns(feedbackEntries),
      lastLearningUpdate: memory.lastUpdated,
    };
  }

  private calculatePositiveRate(): number {
    if (this.feedbackBuffer.length === 0) return 0;
    const positive = this.feedbackBuffer.filter((f) => f.rating === 'positive').length;
    return positive / this.feedbackBuffer.length;
  }

  private extractTopPatterns(entries: any[]): FeedbackPattern[] {
    return entries
      .filter((e) => e.source === 'inferred')
      .map((e) => ({
        category: e.category,
        pattern: e.key,
        confidence: e.confidence || 0.7,
        count: 1,
        lastSeen: e.updatedAt,
      }))
      .slice(0, 5);
  }

  // ========================================================================
  // Context-Aware Suggestions
  // ========================================================================

  /**
   * Get AI prompt suggestions based on learned preferences
   */
  async getPromptSuggestions(context?: string): Promise<string[]> {
    const memory = await MemoryService.getUserMemory();
    const suggestions: string[] = [];

    // Add length instruction
    const lengthPref = memory.entries.find((e) => e.key === 'response_length_preference');
    if (lengthPref) {
      suggestions.push(
        lengthPref.value === 'concise'
          ? 'Provide concise, focused responses.'
          : 'Provide detailed, comprehensive responses.'
      );
    }

    // Add detail instruction
    const detailPref = memory.entries.find((e) => e.key === 'detail_level_preference');
    if (detailPref) {
      suggestions.push(
        detailPref.value === 'summarized'
          ? 'Focus on key points and summaries.'
          : 'Include thorough explanations and examples.'
      );
    }

    // Add style instruction
    const stylePref = memory.entries.find((e) => e.key === 'communication_style');
    if (stylePref) {
      suggestions.push(
        stylePref.value === 'formal'
          ? 'Use a professional, formal tone.'
          : 'Use a friendly, conversational tone.'
      );
    }

    // Context-specific suggestions
    if (context) {
      const contextPref = memory.entries.find((e) => e.key === `preferred_mode_${context}`);
      if (contextPref) {
        suggestions.push(`In ${context} context, user prefers ${contextPref.value} mode.`);
      }
    }

    return suggestions;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const FeedbackLearningService = new FeedbackLearningServiceClass();
export default FeedbackLearningService;
