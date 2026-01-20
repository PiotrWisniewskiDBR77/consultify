/**
 * User Style Profile Service
 * FLOW-AI-ADAPTIVE-001: Manages user communication style preferences and auto-detection
 *
 * This service handles:
 * - User style profile CRUD operations
 * - Automatic preference detection from interactions
 * - Integration with AI memory system
 * - Style pattern learning and application
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../../database/Database.js';
import type { IDatabase } from '../../database/IDatabase.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type PreferredDepth = 'executive_summary' | 'balanced' | 'deep_dive';
export type PreferredFormat = 'bullets' | 'paragraphs' | 'structured' | 'conversational';
export type TechnicalLevel = 'beginner' | 'intermediate' | 'expert';
export type ResponseLength = 'concise' | 'medium' | 'comprehensive';

export interface UserStyleProfile {
  id: string;
  userId: string;
  organizationId: string | null;

  // Communication Preferences
  preferredDepth: PreferredDepth;
  preferredFormat: PreferredFormat;
  technicalLevel: TechnicalLevel;
  responseLength: ResponseLength;

  // Automatically detected patterns
  detectedExpertiseAreas: string[];
  commonQuestionTypes: string[];
  peakActivityHours: number[];
  preferredFocusModes: string[];

  // Context-specific preferences
  contextPreferences: Record<string, ContextPreference>;

  // Learning metrics
  totalInteractions: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  lastProfileUpdate: string | null;
  confidenceScore: number;

  // Auto-learning flags
  autoAdaptEnabled: boolean;
  manualOverrides: Record<string, boolean>;

  createdAt: string;
  updatedAt: string;
}

export interface ContextPreference {
  format?: PreferredFormat;
  length?: ResponseLength;
  depth?: PreferredDepth;
}

export interface StyleLearningPattern {
  id: string;
  userId: string | null;
  organizationId: string | null;
  patternType: 'length_preference' | 'format_preference' | 'depth_preference' | 'context_specific';
  patternKey: string;
  patternValue: string;
  occurrenceCount: number;
  confidenceScore: number;
  detectedInContext: string | null;
  status: 'active' | 'applied' | 'rejected' | 'expired';
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InteractionData {
  userId: string;
  organizationId?: string;
  screenContext?: string;
  focusMode?: string;
  questionType?: string;
  responseLength?: number;
  timestamp?: string;
}

export interface FeedbackData {
  userId: string;
  messageId: string;
  rating: 'positive' | 'negative';
  lengthFeedback?: 'too_short' | 'just_right' | 'too_long';
  detailFeedback?: 'too_little' | 'just_right' | 'too_much';
  formatFeedback?: 'too_formal' | 'just_right' | 'too_casual';
  actionability?: number;
  accuracy?: number;
  expectedFormat?: string;
  screenContext?: string;
  focusMode?: string;
}

export interface ProfileUpdateSuggestion {
  field: keyof UserStyleProfile;
  currentValue: unknown;
  suggestedValue: unknown;
  confidence: number;
  reason: string;
}

// ==========================================
// SERVICE
// ==========================================

class UserStyleProfileService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  // ==========================================
  // PROFILE CRUD
  // ==========================================

  /**
   * Get or create user style profile
   */
  async getProfile(userId: string): Promise<UserStyleProfile> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      user_id: string;
      organization_id: string | null;
      preferred_depth: string;
      preferred_format: string;
      technical_level: string;
      response_length: string;
      detected_expertise_areas: string;
      common_question_types: string;
      peak_activity_hours: string;
      preferred_focus_modes: string;
      context_preferences: string;
      total_interactions: number;
      positive_feedback_count: number;
      negative_feedback_count: number;
      last_profile_update: string | null;
      confidence_score: number;
      auto_adapt_enabled: number;
      manual_overrides: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM ai_user_style_profiles WHERE user_id = ?', [userId]);

    if (row) {
      return this.mapRowToProfile(row);
    }

    // Create default profile
    return this.createProfile(userId);
  }

  /**
   * Create a new user style profile with defaults
   */
  async createProfile(userId: string, organizationId?: string): Promise<UserStyleProfile> {
    const db = await this.getDb();
    const id = `style-${uuidv4()}`;
    const now = new Date().toISOString();

    const defaults = this.getDefaultProfile();

    await db.run(
      `INSERT INTO ai_user_style_profiles (
        id, user_id, organization_id,
        preferred_depth, preferred_format, technical_level, response_length,
        detected_expertise_areas, common_question_types, peak_activity_hours, preferred_focus_modes,
        context_preferences, total_interactions, positive_feedback_count, negative_feedback_count,
        confidence_score, auto_adapt_enabled, manual_overrides, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        organizationId || null,
        defaults.preferredDepth,
        defaults.preferredFormat,
        defaults.technicalLevel,
        defaults.responseLength,
        JSON.stringify(defaults.detectedExpertiseAreas),
        JSON.stringify(defaults.commonQuestionTypes),
        JSON.stringify(defaults.peakActivityHours),
        JSON.stringify(defaults.preferredFocusModes),
        JSON.stringify(defaults.contextPreferences),
        0,
        0,
        0,
        0.5,
        1,
        '{}',
        now,
        now,
      ]
    );

    logger.info(`[UserStyleProfileService] Created profile for user ${userId}`);

    return this.getProfile(userId);
  }

  /**
   * Update user style profile
   */
  async updateProfile(
    userId: string,
    updates: Partial<
      Pick<
        UserStyleProfile,
        | 'preferredDepth'
        | 'preferredFormat'
        | 'technicalLevel'
        | 'responseLength'
        | 'contextPreferences'
        | 'autoAdaptEnabled'
        | 'manualOverrides'
      >
    >
  ): Promise<UserStyleProfile> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.preferredDepth !== undefined) {
      fields.push('preferred_depth = ?');
      values.push(updates.preferredDepth);
    }
    if (updates.preferredFormat !== undefined) {
      fields.push('preferred_format = ?');
      values.push(updates.preferredFormat);
    }
    if (updates.technicalLevel !== undefined) {
      fields.push('technical_level = ?');
      values.push(updates.technicalLevel);
    }
    if (updates.responseLength !== undefined) {
      fields.push('response_length = ?');
      values.push(updates.responseLength);
    }
    if (updates.contextPreferences !== undefined) {
      fields.push('context_preferences = ?');
      values.push(JSON.stringify(updates.contextPreferences));
    }
    if (updates.autoAdaptEnabled !== undefined) {
      fields.push('auto_adapt_enabled = ?');
      values.push(updates.autoAdaptEnabled ? 1 : 0);
    }
    if (updates.manualOverrides !== undefined) {
      fields.push('manual_overrides = ?');
      values.push(JSON.stringify(updates.manualOverrides));
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(now);
      values.push(userId);

      await db.run(
        `UPDATE ai_user_style_profiles SET ${fields.join(', ')} WHERE user_id = ?`,
        values
      );

      logger.info(`[UserStyleProfileService] Updated profile for user ${userId}`);
    }

    return this.getProfile(userId);
  }

  // ==========================================
  // INTERACTION TRACKING
  // ==========================================

  /**
   * Record an interaction and update profile metrics
   */
  async recordInteraction(data: InteractionData): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const hour = new Date().getHours();

    // Ensure profile exists
    const profile = await this.getProfile(data.userId);

    // Update interaction count
    await db.run(
      `UPDATE ai_user_style_profiles SET 
        total_interactions = total_interactions + 1,
        updated_at = ?
      WHERE user_id = ?`,
      [now, data.userId]
    );

    // Update peak activity hours
    const peakHours = [...profile.peakActivityHours];
    if (!peakHours.includes(hour)) {
      peakHours.push(hour);
      // Keep only the 5 most frequent hours
      if (peakHours.length > 5) {
        peakHours.shift();
      }
      await db.run(`UPDATE ai_user_style_profiles SET peak_activity_hours = ? WHERE user_id = ?`, [
        JSON.stringify(peakHours),
        data.userId,
      ]);
    }

    // Update focus modes
    if (data.focusMode && !profile.preferredFocusModes.includes(data.focusMode)) {
      const focusModes = [...profile.preferredFocusModes, data.focusMode].slice(-5);
      await db.run(
        `UPDATE ai_user_style_profiles SET preferred_focus_modes = ? WHERE user_id = ?`,
        [JSON.stringify(focusModes), data.userId]
      );
    }

    // Update question types
    if (data.questionType && !profile.commonQuestionTypes.includes(data.questionType)) {
      const questionTypes = [...profile.commonQuestionTypes, data.questionType].slice(-10);
      await db.run(
        `UPDATE ai_user_style_profiles SET common_question_types = ? WHERE user_id = ?`,
        [JSON.stringify(questionTypes), data.userId]
      );
    }
  }

  // ==========================================
  // FEEDBACK PROCESSING
  // ==========================================

  /**
   * Process feedback and update profile accordingly
   */
  async processFeedback(feedback: FeedbackData): Promise<ProfileUpdateSuggestion[]> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const suggestions: ProfileUpdateSuggestion[] = [];

    const profile = await this.getProfile(feedback.userId);

    // Update feedback counts
    if (feedback.rating === 'positive') {
      await db.run(
        `UPDATE ai_user_style_profiles SET positive_feedback_count = positive_feedback_count + 1, updated_at = ? WHERE user_id = ?`,
        [now, feedback.userId]
      );
    } else {
      await db.run(
        `UPDATE ai_user_style_profiles SET negative_feedback_count = negative_feedback_count + 1, updated_at = ? WHERE user_id = ?`,
        [now, feedback.userId]
      );
    }

    // Only auto-adapt if enabled and no manual override
    if (!profile.autoAdaptEnabled) {
      return suggestions;
    }

    // Process length feedback
    if (feedback.lengthFeedback && feedback.lengthFeedback !== 'just_right') {
      const suggestion = this.suggestLengthChange(profile, feedback.lengthFeedback);
      if (suggestion) {
        suggestions.push(suggestion);
        await this.recordPattern(
          feedback.userId,
          'length_preference',
          feedback.lengthFeedback,
          feedback.screenContext
        );
      }
    }

    // Process detail feedback
    if (feedback.detailFeedback && feedback.detailFeedback !== 'just_right') {
      const suggestion = this.suggestDepthChange(profile, feedback.detailFeedback);
      if (suggestion) {
        suggestions.push(suggestion);
        await this.recordPattern(
          feedback.userId,
          'depth_preference',
          feedback.detailFeedback,
          feedback.screenContext
        );
      }
    }

    // Process format feedback
    if (feedback.expectedFormat && feedback.expectedFormat !== profile.preferredFormat) {
      suggestions.push({
        field: 'preferredFormat',
        currentValue: profile.preferredFormat,
        suggestedValue: feedback.expectedFormat,
        confidence: 0.6,
        reason: `User indicated preference for ${feedback.expectedFormat} format`,
      });
      await this.recordPattern(
        feedback.userId,
        'format_preference',
        feedback.expectedFormat,
        feedback.screenContext
      );
    }

    // Apply high-confidence suggestions automatically
    await this.applyHighConfidenceSuggestions(feedback.userId, suggestions);

    // Update confidence score based on feedback consistency
    await this.updateConfidenceScore(feedback.userId);

    return suggestions;
  }

  /**
   * Record a learning pattern
   */
  private async recordPattern(
    userId: string,
    patternType: string,
    patternValue: string,
    context?: string
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    // Check if pattern exists
    const existing = await db.get<{
      id: string;
      occurrence_count: number;
      confidence_score: number;
    }>(
      `SELECT id, occurrence_count, confidence_score FROM ai_style_learning_patterns 
       WHERE user_id = ? AND pattern_type = ? AND pattern_value = ? AND status = 'active'`,
      [userId, patternType, patternValue]
    );

    if (existing) {
      // Update existing pattern
      const newCount = existing.occurrence_count + 1;
      const newConfidence = Math.min(0.95, existing.confidence_score + 0.1);

      await db.run(
        `UPDATE ai_style_learning_patterns SET 
          occurrence_count = ?, confidence_score = ?, updated_at = ?
        WHERE id = ?`,
        [newCount, newConfidence, now, existing.id]
      );
    } else {
      // Create new pattern
      const id = `pattern-${uuidv4()}`;
      await db.run(
        `INSERT INTO ai_style_learning_patterns (
          id, user_id, pattern_type, pattern_key, pattern_value, 
          occurrence_count, confidence_score, detected_in_context, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, 0.5, ?, 'active', ?, ?)`,
        [id, userId, patternType, patternType, patternValue, context || null, now, now]
      );
    }
  }

  // ==========================================
  // PROFILE ADAPTATION
  // ==========================================

  /**
   * Apply high-confidence suggestions automatically
   */
  private async applyHighConfidenceSuggestions(
    userId: string,
    suggestions: ProfileUpdateSuggestion[]
  ): Promise<void> {
    const highConfidence = suggestions.filter((s) => s.confidence >= 0.8);

    for (const suggestion of highConfidence) {
      const updates: Record<string, unknown> = {};
      updates[suggestion.field as string] = suggestion.suggestedValue;

      await this.updateProfile(userId, updates as any);

      logger.info(
        `[UserStyleProfileService] Auto-applied ${suggestion.field} change for user ${userId}: ${suggestion.suggestedValue}`
      );
    }
  }

  /**
   * Update confidence score based on feedback patterns
   */
  private async updateConfidenceScore(userId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    const profile = await this.getProfile(userId);
    const total = profile.positiveFeedbackCount + profile.negativeFeedbackCount;

    if (total === 0) return;

    // Calculate confidence based on feedback ratio and interaction count
    const positiveRatio = profile.positiveFeedbackCount / total;
    const interactionFactor = Math.min(1, profile.totalInteractions / 50);
    const newConfidence = positiveRatio * 0.7 + interactionFactor * 0.3;

    await db.run(
      `UPDATE ai_user_style_profiles SET confidence_score = ?, last_profile_update = ?, updated_at = ? WHERE user_id = ?`,
      [newConfidence, now, now, userId]
    );
  }

  /**
   * Get learned patterns for a user
   */
  async getLearnedPatterns(userId: string): Promise<StyleLearningPattern[]> {
    const db = await this.getDb();

    const patterns = await db.all<{
      id: string;
      user_id: string;
      organization_id: string | null;
      pattern_type: string;
      pattern_key: string;
      pattern_value: string;
      occurrence_count: number;
      confidence_score: number;
      detected_in_context: string | null;
      status: string;
      applied_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT * FROM ai_style_learning_patterns WHERE user_id = ? AND status = 'active' ORDER BY confidence_score DESC`,
      [userId]
    );

    return (patterns || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      organizationId: p.organization_id,
      patternType: p.pattern_type as StyleLearningPattern['patternType'],
      patternKey: p.pattern_key,
      patternValue: p.pattern_value,
      occurrenceCount: p.occurrence_count,
      confidenceScore: p.confidence_score,
      detectedInContext: p.detected_in_context,
      status: p.status as StyleLearningPattern['status'],
      appliedAt: p.applied_at,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  // ==========================================
  // SYSTEM PROMPT MODIFIERS
  // ==========================================

  /**
   * Build system prompt modifiers based on user profile
   */
  buildSystemPromptModifiers(profile: UserStyleProfile): string[] {
    const modifiers: string[] = [];

    // Depth modifier
    switch (profile.preferredDepth) {
      case 'executive_summary':
        modifiers.push(
          'Provide brief, high-level summaries. Focus on key takeaways and actionable insights. Avoid technical details unless specifically asked.'
        );
        break;
      case 'deep_dive':
        modifiers.push(
          'Provide comprehensive, detailed explanations. Include technical details, examples, and thorough analysis. The user appreciates depth and nuance.'
        );
        break;
      // 'balanced' is default, no modifier needed
    }

    // Format modifier
    switch (profile.preferredFormat) {
      case 'bullets':
        modifiers.push(
          'Structure responses using bullet points and lists. Keep each point concise and scannable.'
        );
        break;
      case 'paragraphs':
        modifiers.push(
          'Write in flowing paragraphs. The user prefers narrative explanations over lists.'
        );
        break;
      case 'conversational':
        modifiers.push(
          'Use a conversational, friendly tone. Feel free to use informal language and engage naturally.'
        );
        break;
      // 'structured' is default
    }

    // Technical level modifier
    switch (profile.technicalLevel) {
      case 'beginner':
        modifiers.push(
          'Explain concepts simply, avoiding jargon. When technical terms are necessary, provide brief definitions.'
        );
        break;
      case 'expert':
        modifiers.push(
          'The user has expert-level knowledge. Feel free to use technical terminology and assume familiarity with advanced concepts.'
        );
        break;
      // 'intermediate' is default
    }

    // Length modifier
    switch (profile.responseLength) {
      case 'concise':
        modifiers.push(
          'Keep responses brief and to the point. Prioritize clarity over completeness.'
        );
        break;
      case 'comprehensive':
        modifiers.push(
          'Provide thorough, complete responses. The user values comprehensive coverage over brevity.'
        );
        break;
      // 'medium' is default
    }

    return modifiers;
  }

  /**
   * Get context-specific format preferences
   */
  getContextFormat(profile: UserStyleProfile, screenContext: string): ContextPreference {
    // Check for context-specific override
    if (profile.contextPreferences[screenContext]) {
      return profile.contextPreferences[screenContext];
    }

    // Return defaults based on screen context
    const contextDefaults: Record<string, ContextPreference> = {
      task_detail: { format: 'bullets', length: 'concise', depth: 'balanced' },
      initiative_detail: { format: 'structured', length: 'medium', depth: 'balanced' },
      dashboard: { format: 'bullets', length: 'concise', depth: 'executive_summary' },
      assessment: { format: 'structured', length: 'comprehensive', depth: 'deep_dive' },
      roadmap: { format: 'structured', length: 'medium', depth: 'balanced' },
      chat_full: {
        format: profile.preferredFormat,
        length: profile.responseLength,
        depth: profile.preferredDepth,
      },
    };

    return (
      contextDefaults[screenContext] || {
        format: profile.preferredFormat,
        length: profile.responseLength,
        depth: profile.preferredDepth,
      }
    );
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private getDefaultProfile(): Omit<
    UserStyleProfile,
    'id' | 'userId' | 'organizationId' | 'createdAt' | 'updatedAt'
  > {
    return {
      preferredDepth: 'balanced',
      preferredFormat: 'structured',
      technicalLevel: 'intermediate',
      responseLength: 'medium',
      detectedExpertiseAreas: [],
      commonQuestionTypes: [],
      peakActivityHours: [],
      preferredFocusModes: [],
      contextPreferences: {},
      totalInteractions: 0,
      positiveFeedbackCount: 0,
      negativeFeedbackCount: 0,
      lastProfileUpdate: null,
      confidenceScore: 0.5,
      autoAdaptEnabled: true,
      manualOverrides: {},
    };
  }

  private mapRowToProfile(row: any): UserStyleProfile {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      preferredDepth: row.preferred_depth as PreferredDepth,
      preferredFormat: row.preferred_format as PreferredFormat,
      technicalLevel: row.technical_level as TechnicalLevel,
      responseLength: row.response_length as ResponseLength,
      detectedExpertiseAreas: JSON.parse(row.detected_expertise_areas || '[]'),
      commonQuestionTypes: JSON.parse(row.common_question_types || '[]'),
      peakActivityHours: JSON.parse(row.peak_activity_hours || '[]'),
      preferredFocusModes: JSON.parse(row.preferred_focus_modes || '[]'),
      contextPreferences: JSON.parse(row.context_preferences || '{}'),
      totalInteractions: row.total_interactions,
      positiveFeedbackCount: row.positive_feedback_count,
      negativeFeedbackCount: row.negative_feedback_count,
      lastProfileUpdate: row.last_profile_update,
      confidenceScore: row.confidence_score,
      autoAdaptEnabled: row.auto_adapt_enabled === 1,
      manualOverrides: JSON.parse(row.manual_overrides || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private suggestLengthChange(
    profile: UserStyleProfile,
    feedback: 'too_short' | 'too_long'
  ): ProfileUpdateSuggestion | null {
    const lengthMap: Record<
      ResponseLength,
      { shorter: ResponseLength | null; longer: ResponseLength | null }
    > = {
      concise: { shorter: null, longer: 'medium' },
      medium: { shorter: 'concise', longer: 'comprehensive' },
      comprehensive: { shorter: 'medium', longer: null },
    };

    const current = profile.responseLength;
    const direction = feedback === 'too_short' ? 'longer' : 'shorter';
    const suggested = lengthMap[current][direction];

    if (!suggested) return null;

    return {
      field: 'responseLength',
      currentValue: current,
      suggestedValue: suggested,
      confidence: 0.6,
      reason: `User feedback indicates responses are ${feedback.replace('_', ' ')}`,
    };
  }

  private suggestDepthChange(
    profile: UserStyleProfile,
    feedback: 'too_little' | 'too_much'
  ): ProfileUpdateSuggestion | null {
    const depthMap: Record<
      PreferredDepth,
      { less: PreferredDepth | null; more: PreferredDepth | null }
    > = {
      executive_summary: { less: null, more: 'balanced' },
      balanced: { less: 'executive_summary', more: 'deep_dive' },
      deep_dive: { less: 'balanced', more: null },
    };

    const current = profile.preferredDepth;
    const direction = feedback === 'too_little' ? 'more' : 'less';
    const suggested = depthMap[current][direction];

    if (!suggested) return null;

    return {
      field: 'preferredDepth',
      currentValue: current,
      suggestedValue: suggested,
      confidence: 0.6,
      reason: `User feedback indicates detail level is ${feedback.replace('_', ' ')}`,
    };
  }
}

// Export singleton
const userStyleProfileService = new UserStyleProfileService();
export default userStyleProfileService;

// Named exports
export const getProfile = (userId: string) => userStyleProfileService.getProfile(userId);
export const updateProfile = (
  userId: string,
  updates: Parameters<typeof userStyleProfileService.updateProfile>[1]
) => userStyleProfileService.updateProfile(userId, updates);
export const recordInteraction = (data: InteractionData) =>
  userStyleProfileService.recordInteraction(data);
export const processFeedback = (feedback: FeedbackData) =>
  userStyleProfileService.processFeedback(feedback);
export const getLearnedPatterns = (userId: string) =>
  userStyleProfileService.getLearnedPatterns(userId);
export const buildSystemPromptModifiers = (profile: UserStyleProfile) =>
  userStyleProfileService.buildSystemPromptModifiers(profile);
export const getContextFormat = (profile: UserStyleProfile, screenContext: string) =>
  userStyleProfileService.getContextFormat(profile, screenContext);
