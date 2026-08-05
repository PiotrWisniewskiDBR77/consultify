/**
 * Adaptive Response Service
 * FLOW-AI-ADAPTIVE-001: Adapts AI responses based on user preferences and context
 *
 * This service handles:
 * - Building response configuration based on user profile and context
 * - Processing feedback to improve future responses
 * - Generating system prompt modifiers for personalization
 * - Adapting response tone and format
 *
 * @version 2.0.0
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';
import userStyleProfileService, {
  type ContextPreference,
  type FeedbackData,
  type UserStyleProfile,
} from './userStyleProfileService.js';

// ==========================================
// TYPES
// ==========================================

export interface ScreenContext {
  screenId: string;
  screenType?:
    | 'task_detail'
    | 'initiative_detail'
    | 'dashboard'
    | 'assessment'
    | 'roadmap'
    | 'chat_full'
    | 'settings'
    | string;
  selectedObjectId?: string;
  selectedObjectType?: string;
  projectId?: string;
}

export interface ResponseConfig {
  format: 'bullets' | 'paragraphs' | 'structured' | 'conversational';
  length: 'concise' | 'medium' | 'comprehensive';
  depth: 'executive_summary' | 'balanced' | 'deep_dive';
  technicalLevel: 'beginner' | 'intermediate' | 'expert';
  systemPromptModifiers: string[];
  contextualInstructions: string[];
}

export interface ExtendedFeedback {
  userId: string;
  messageId: string;
  conversationId?: string;
  rating: 'positive' | 'negative';
  lengthFeedback?: 'too_short' | 'just_right' | 'too_long';
  detailFeedback?: 'too_little' | 'just_right' | 'too_much';
  formatFeedback?: 'too_formal' | 'just_right' | 'too_casual';
  actionability?: number;
  accuracy?: number;
  expectedFormat?: string;
  missingInfo?: string;
  screenContext?: string;
  focusMode?: string;
  responseMode?: string;
  responseLength?: number;
  capability?: string;
}

export interface FeedbackStats {
  total_feedback: number;
  positive_count: number;
  negative_count: number;
  satisfaction_rate: number | null;
  avg_actionability: number | null;
  avg_accuracy: number | null;
}

// ==========================================
// SERVICE
// ==========================================

class AdaptiveResponseService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // RESPONSE CONFIGURATION
  // ==========================================

  /**
   * Get response configuration based on user profile and context
   */
  async getResponseConfig(userId: string, context?: ScreenContext): Promise<ResponseConfig> {
    try {
      // Get user's style profile
      const profile = await userStyleProfileService.getProfile(userId);

      // Get context-specific format preferences
      const contextFormat = context?.screenType
        ? userStyleProfileService.getContextFormat(profile, context.screenType)
        : null;

      // Build system prompt modifiers
      const systemPromptModifiers = userStyleProfileService.buildSystemPromptModifiers(profile);

      // Build contextual instructions
      const contextualInstructions = this.buildContextualInstructions(context, profile);

      // Merge profile defaults with context-specific overrides
      const config: ResponseConfig = {
        format: contextFormat?.format || profile.preferredFormat,
        length: contextFormat?.length || profile.responseLength,
        depth: contextFormat?.depth || profile.preferredDepth,
        technicalLevel: profile.technicalLevel,
        systemPromptModifiers,
        contextualInstructions,
      };

      logger.info(
        `[AdaptiveResponseService] Config for user ${userId}: format=${config.format}, length=${config.length}`
      );

      return config;
    } catch (error) {
      logger.error('[AdaptiveResponseService] getResponseConfig error:', error);
      // Return defaults on error
      return {
        format: 'structured',
        length: 'medium',
        depth: 'balanced',
        technicalLevel: 'intermediate',
        systemPromptModifiers: [],
        contextualInstructions: [],
      };
    }
  }

  /**
   * Build contextual instructions based on screen context
   */
  private buildContextualInstructions(
    context: ScreenContext | undefined,
    profile: UserStyleProfile
  ): string[] {
    const instructions: string[] = [];

    if (!context) return instructions;

    switch (context.screenType) {
      case 'task_detail':
        instructions.push('Focus on actionable steps and clear next actions.');
        instructions.push('Keep response concise and task-focused.');
        if (context.selectedObjectId) {
          instructions.push(`User is viewing a specific task. Provide relevant context.`);
        }
        break;

      case 'initiative_detail':
        instructions.push('Provide strategic perspective and business value context.');
        instructions.push('Include relevant metrics and ROI considerations where appropriate.');
        break;

      case 'dashboard':
        instructions.push('Provide high-level summaries and key insights.');
        instructions.push('Focus on actionable highlights and important updates.');
        break;

      case 'assessment':
        instructions.push('Provide detailed analytical responses.');
        instructions.push('Include specific recommendations and evidence-based insights.');
        instructions.push('Reference relevant PMO standards and best practices.');
        break;

      case 'roadmap':
        instructions.push('Focus on timeline, dependencies, and planning considerations.');
        instructions.push('Highlight critical path items and potential risks.');
        break;

      case 'chat_full':
        // Full chat mode - use user's general preferences
        if (profile.preferredFocusModes.length > 0) {
          instructions.push(
            `User commonly uses these focus modes: ${profile.preferredFocusModes.join(', ')}`
          );
        }
        break;
    }

    // Add expertise-based instructions
    if (profile.detectedExpertiseAreas.length > 0) {
      instructions.push(
        `User has expertise in: ${profile.detectedExpertiseAreas.join(', ')}. Adjust technical depth accordingly.`
      );
    }

    return instructions;
  }

  // ==========================================
  // FEEDBACK PROCESSING
  // ==========================================

  /**
   * Process user feedback on AI response
   */
  async processFeedback(
    userId: string,
    messageId: string,
    conversationId: string | undefined,
    feedback: {
      rating: string;
      lengthFeedback?: string;
      detailFeedback?: string;
      formatFeedback?: string;
      wantedMode?: string;
      customFeedback?: string;
    },
    context: {
      responseMode?: string;
      responseLength?: string;
      capability?: string;
    }
  ): Promise<{ feedbackId: string }> {
    const db = await this.getDb();
    const feedbackId = `fb-${uuidv4()}`;
    const now = new Date().toISOString();

    try {
      // Store feedback in database
      // M01-P03B — column names corrected: this INSERT targeted
      // `response_mode`/`capability`, but the actual `ai_response_feedback`
      // table (see server/migrations/add_response_feedback.sql and
      // 20260805_m01p03b_ai_response_feedback_fresh_db_gap.sql) defines
      // `response_mode_used`/`capability_used`. On Postgres this threw
      // 42703 "column does not exist" on every single call — confirmed live
      // against a real Postgres catalog while building the M01-P03B
      // hydration test — so this write path never persisted a row on
      // Postgres, independent of the separate fresh-db table-creation gap
      // fixed in the same packet.
      await db.run(
        `INSERT INTO ai_response_feedback (
          id, user_id, message_id, conversation_id, rating,
          length_feedback, detail_feedback, format_feedback, wanted_mode,
          custom_feedback, response_mode_used, capability_used, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          feedbackId,
          userId,
          messageId,
          conversationId || null,
          feedback.rating,
          feedback.lengthFeedback || null,
          feedback.detailFeedback || null,
          feedback.formatFeedback || null,
          feedback.wantedMode || null,
          feedback.customFeedback || null,
          context.responseMode || null,
          context.capability || null,
          now,
        ]
      );

      // Process feedback through style profile service
      await userStyleProfileService.processFeedback({
        userId,
        messageId,
        rating: feedback.rating as 'positive' | 'negative',
        lengthFeedback: feedback.lengthFeedback?.replace('-', '_') as any,
        detailFeedback: feedback.detailFeedback?.replace('-', '_') as any,
        formatFeedback: feedback.formatFeedback?.replace('-', '_') as any,
      });

      logger.info(
        `[AdaptiveResponseService] Feedback processed: ${feedbackId} (${feedback.rating})`
      );

      return { feedbackId };
    } catch (error) {
      logger.error('[AdaptiveResponseService] processFeedback error:', error);
      throw error;
    }
  }

  /**
   * Get user's feedback statistics
   */
  async getUserFeedbackStats(userId: string): Promise<FeedbackStats> {
    const db = await this.getDb();

    try {
      const stats = await db.get<{
        total: number;
        positive: number;
        negative: number;
        avg_actionability: number;
        avg_accuracy: number;
      }>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN rating = 'negative' THEN 1 ELSE 0 END) as negative,
          AVG(actionability) as avg_actionability,
          AVG(accuracy) as avg_accuracy
        FROM ai_feedback
        WHERE user_id = ?
        AND created_at > datetime('now', '-30 days')`,
        [userId]
      );

      const total = stats?.total || 0;
      const positive = stats?.positive || 0;
      const negative = stats?.negative || 0;

      return {
        total_feedback: total,
        positive_count: positive,
        negative_count: negative,
        satisfaction_rate: total > 0 ? (positive / total) * 100 : null,
        avg_actionability: stats?.avg_actionability || null,
        avg_accuracy: stats?.avg_accuracy || null,
      };
    } catch (error) {
      logger.error('[AdaptiveResponseService] getUserFeedbackStats error:', error);
      return {
        total_feedback: 0,
        positive_count: 0,
        negative_count: 0,
        satisfaction_rate: null,
        avg_actionability: null,
        avg_accuracy: null,
      };
    }
  }

  /**
   * Get recommended response mode based on user's history
   */
  async getRecommendedMode(userId: string): Promise<string> {
    try {
      const profile = await userStyleProfileService.getProfile(userId);

      // Map response length to mode
      const modeMap: Record<string, string> = {
        concise: 'quick',
        medium: 'standard',
        comprehensive: 'deepStudy',
      };

      return modeMap[profile.responseLength] || 'standard';
    } catch (error) {
      logger.error('[AdaptiveResponseService] getRecommendedMode error:', error);
      return 'standard';
    }
  }

  // ==========================================
  // CONTENT ADAPTATION
  // ==========================================

  /**
   * Adapt response content based on user preferences.
   * Applies structural transformations post-generation.
   */
  async adaptContent(content: string, userId: string, context?: ScreenContext): Promise<string> {
    try {
      if (!content?.trim()) return content;

      const config = await this.getResponseConfig(userId, context);
      let adapted = content;

      // 1. Length adaptation — trim for concise preference
      if (config.length === 'concise' && adapted.length > 1500) {
        adapted = this.trimToKeyPoints(adapted);
      }

      // 2. Depth adaptation — add executive summary for executive_summary depth
      if (config.depth === 'executive_summary' && adapted.length > 800) {
        adapted = this.prependExecutiveSummary(adapted);
      }

      // 3. Format adaptation — convert paragraphs to bullets if preferred
      if (config.format === 'bullets') {
        adapted = this.convertToBullets(adapted);
      }

      // 4. Technical level — simplify jargon for beginners
      if (config.technicalLevel === 'beginner') {
        adapted = this.simplifyJargon(adapted);
      }

      return adapted;
    } catch (error) {
      logger.error('[AdaptiveResponseService] adaptContent error:', error);
      return content;
    }
  }

  /**
   * Trim response to key points for concise preference.
   */
  private trimToKeyPoints(content: string): string {
    const sections = content.split(/\n#{1,3}\s/);
    if (sections.length <= 2) return content;

    // Keep first section (intro/summary) and trim others
    const trimmed = sections.map((section, i) => {
      if (i === 0) return section;
      // For each section, keep header + first 3 bullet points or 2 paragraphs
      const lines = section.split('\n').filter((l) => l.trim());
      const header = lines[0] || '';
      const bodyLines = lines.slice(1);

      const bulletLines = bodyLines.filter(
        (l) => /^[-*•]\s/.test(l.trim()) || /^\d+\.\s/.test(l.trim())
      );
      if (bulletLines.length > 0) {
        return '\n## ' + header + '\n' + bulletLines.slice(0, 4).join('\n');
      }
      return '\n## ' + header + '\n' + bodyLines.slice(0, 3).join('\n');
    });

    return trimmed.join('\n');
  }

  /**
   * Prepend a brief executive summary extracted from the response.
   */
  private prependExecutiveSummary(content: string): string {
    // Extract key takeaways from bullets and bold text
    const boldMatches = content.match(/\*\*([^*]+)\*\*/g)?.slice(0, 3) || [];
    const keyPoints = boldMatches.map((m) => m.replace(/\*\*/g, ''));

    if (keyPoints.length === 0) return content;

    const summary = `> **Executive Summary:** ${keyPoints.join(' | ')}\n\n---\n\n`;
    return summary + content;
  }

  /**
   * Convert paragraph-heavy content to bullet format.
   */
  private convertToBullets(content: string): string {
    return content.replace(/^([A-Z][^.\n]{30,}\.)\s*$/gm, (match) => `- ${match.trim()}`);
  }

  /**
   * Simplify technical jargon for beginner users.
   */
  private simplifyJargon(content: string): string {
    const jargonMap: Record<string, string> = {
      NPV: 'NPV (Net Present Value — wartość netto inwestycji)',
      IRR: 'IRR (Internal Rate of Return — wewnętrzna stopa zwrotu)',
      MECE: 'MECE (wzajemnie wykluczające, wspólnie wyczerpujące)',
      OEE: 'OEE (Overall Equipment Effectiveness — efektywność urządzeń)',
      KPI: 'KPI (Key Performance Indicator — kluczowy wskaźnik)',
    };

    let simplified = content;
    for (const [term, explanation] of Object.entries(jargonMap)) {
      // Only expand the first occurrence
      const regex = new RegExp(`\\b${term}\\b`, '');
      if (regex.test(simplified)) {
        simplified = simplified.replace(regex, explanation);
      }
    }
    return simplified;
  }

  /**
   * Generate response (placeholder for backward compatibility)
   */
  async generateResponse(context: any): Promise<string> {
    logger.info('[AdaptiveResponseService] generateResponse called');
    return 'Response generation should be handled by AIPipeline.';
  }

  /**
   * Analyze feedback (placeholder for backward compatibility)
   */
  async analyzeFeedback(feedback: any): Promise<{ analyzed: boolean }> {
    logger.info('[AdaptiveResponseService] analyzeFeedback called');
    return { analyzed: true };
  }

  // ==========================================
  // PROMPT BUILDING
  // ==========================================

  /**
   * Build full system prompt including user preferences
   */
  async buildAdaptiveSystemPrompt(
    userId: string,
    basePrompt: string,
    context?: ScreenContext
  ): Promise<string> {
    try {
      const config = await this.getResponseConfig(userId, context);

      let prompt = basePrompt;

      // Add user preference modifiers
      if (config.systemPromptModifiers.length > 0) {
        prompt += '\n\n## User Preferences\n';
        prompt += config.systemPromptModifiers.map((m) => `- ${m}`).join('\n');
      }

      // Add contextual instructions
      if (config.contextualInstructions.length > 0) {
        prompt += '\n\n## Context-Specific Guidelines\n';
        prompt += config.contextualInstructions.map((i) => `- ${i}`).join('\n');
      }

      return prompt;
    } catch (error) {
      logger.error('[AdaptiveResponseService] buildAdaptiveSystemPrompt error:', error);
      return basePrompt;
    }
  }
}

// Export singleton
export const adaptiveResponseService = new AdaptiveResponseService();
export default adaptiveResponseService;

// Named exports for convenience
export const getResponseConfig = (userId: string, context?: ScreenContext) =>
  adaptiveResponseService.getResponseConfig(userId, context);
export const processFeedback = (
  userId: string,
  messageId: string,
  conversationId: string | undefined,
  feedback: Parameters<typeof adaptiveResponseService.processFeedback>[3],
  context: Parameters<typeof adaptiveResponseService.processFeedback>[4]
) => adaptiveResponseService.processFeedback(userId, messageId, conversationId, feedback, context);
export const getUserFeedbackStats = (userId: string) =>
  adaptiveResponseService.getUserFeedbackStats(userId);
export const getRecommendedMode = (userId: string) =>
  adaptiveResponseService.getRecommendedMode(userId);
export const buildAdaptiveSystemPrompt = (
  userId: string,
  basePrompt: string,
  context?: ScreenContext
) => adaptiveResponseService.buildAdaptiveSystemPrompt(userId, basePrompt, context);
