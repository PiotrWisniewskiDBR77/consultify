/**
 * AI Memory Manager - Handles 4-layer memory system
 * Enterprise PMO Brain Layer
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

let all = dbAll;
let get = dbGet;
let run = dbRun;
import logger from '../utils/Logger.js';

// ==========================================
// TYPES & CONSTANTS
// ==========================================

export const MemoryType = {
  DECISION: 'DECISION',
  PHASE_TRANSITION: 'PHASE_TRANSITION',
  RECOMMENDATION: 'RECOMMENDATION',
  PATTERN: 'PATTERN',
} as const;

export type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];

export const MEMORY_TYPES = {
  DECISION: MemoryType.DECISION,
  PHASE_TRANSITION: MemoryType.PHASE_TRANSITION,
  RECOMMENDATION: MemoryType.RECOMMENDATION,
  PATTERN: MemoryType.PATTERN,
};

export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  default: 8192,
};

export interface MemoryMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface MemorySession {
  conversationId: string;
  messages: MemoryMessage[];
  currentScreen: string | null;
  startedAt: string;
}

export interface ProjectMemoryEntry {
  id: string;
  project_id: string;
  memory_type: MemoryType;
  content: any;
  recorded_by: string;
  created_at: string;
}

export interface PersonalizationProfile {
  responseLength: 'concise' | 'balanced' | 'detailed';
  technicalDepth: 'beginner' | 'intermediate' | 'advanced' | 'adaptive';
  communicationStyle: 'casual' | 'professional' | 'formal' | 'friendly';
  preferredLanguage: string;
  includeExamples: boolean;
  includeCodeSnippets: boolean;
  formatPreference: 'plain' | 'markdown' | 'structured';
  educationMode: boolean;
  actionOrientation: 'advisory' | 'balanced' | 'action-oriented';
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

export const AIMemoryManager = {
  MEMORY_TYPES,

  setDependencies: (deps: any) => {
    if (deps.db) {
      if (deps.db.all) all = deps.db.all;
      if (deps.db.get) get = deps.db.get;
      if (deps.db.run) run = deps.db.run;
    }
  },

  // ==================== SESSION MEMORY ====================
  // (Handled in-memory, not persisted to DB)

  createSession: async (): Promise<MemorySession> => {
    return {
      conversationId: uuidv4(),
      messages: [],
      currentScreen: null,
      startedAt: new Date().toISOString(),
    };
  },

  addMessage: (session: MemorySession, role: string, content: string): MemorySession => {
    session.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    return session;
  },

  // ==================== PROJECT MEMORY ====================

  /**
   * Record significant project event
   */
  recordProjectMemory: async (
    projectId: string,
    memoryType: MemoryType,
    content: any,
    userId: string
  ) => {
    const id = uuidv4();
    const contentStr = JSON.stringify(content);

    const result = await run(
      `INSERT INTO ai_project_memory (id, project_id, memory_type, content, recorded_by)
             VALUES (?, ?, ?, ?, ?)`,
      [id, projectId, memoryType, contentStr, userId]
    );

    if (!result.success) {
      throw new Error(`Failed to record project memory: ${result.error}`);
    }

    // Log memory write to activity table for audit
    try {
      const project: any = await get(`SELECT organization_id FROM projects WHERE id = ?`, [
        projectId,
      ]);

      if (project && project.organization_id) {
        const contentSnippet =
          typeof content === 'string' ? content.substring(0, 100) : contentStr.substring(0, 100);

        await run(
          `INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
                     VALUES (?, ?, ?, 'ai_memory_write', 'ai_memory', ?, ?, CURRENT_TIMESTAMP)`,
          [
            uuidv4(),
            project.organization_id,
            userId,
            id,
            JSON.stringify({ memoryType, snippet: contentSnippet }),
          ]
        );
      }
    } catch (err: any) {
      logger.warn('[AIMemoryManager] Failed to log activity:', err.message);
    }

    return { id, projectId, memoryType };
  },

  /**
   * Record a decision with rationale
   */
  recordDecision: async (
    projectId: string,
    decisionId: string,
    title: string,
    outcome: string,
    rationale: string,
    userId: string
  ) => {
    return AIMemoryManager.recordProjectMemory(
      projectId,
      MemoryType.DECISION,
      {
        decisionId,
        title,
        outcome,
        rationale,
        recordedAt: new Date().toISOString(),
      },
      userId
    );
  },

  /**
   * Record phase transition
   */
  recordPhaseTransition: async (
    projectId: string,
    fromPhase: string,
    toPhase: string,
    reason: string,
    userId: string
  ) => {
    return AIMemoryManager.recordProjectMemory(
      projectId,
      MemoryType.PHASE_TRANSITION,
      {
        from: fromPhase,
        to: toPhase,
        reason,
        transitionedAt: new Date().toISOString(),
      },
      userId
    );
  },

  /**
   * Record AI recommendation and user response
   */
  recordRecommendation: async (
    projectId: string,
    recommendation: string,
    accepted: boolean,
    userFeedback: string | null,
    userId: string
  ) => {
    return AIMemoryManager.recordProjectMemory(
      projectId,
      MemoryType.RECOMMENDATION,
      {
        recommendation,
        accepted,
        userFeedback,
        recordedAt: new Date().toISOString(),
      },
      userId
    );
  },

  /**
   * Get project memory
   */
  getProjectMemory: async (
    projectId: string,
    memoryType: MemoryType | null = null,
    limit = 20
  ): Promise<ProjectMemoryEntry[]> => {
    let sql = `SELECT * FROM ai_project_memory WHERE project_id = ?`;
    const params: any[] = [projectId];

    if (memoryType) {
      sql += ` AND memory_type = ?`;
      params.push(memoryType);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await all<ProjectMemoryEntry>(sql, params);

    return (rows || []).map((row) => {
      try {
        if (typeof row.content === 'string') {
          row.content = JSON.parse(row.content);
        }
      } catch {}
      return row;
    });
  },

  /**
   * Build project memory summary for AI context
   */
  buildProjectMemorySummary: async (projectId: string) => {
    const decisions = await AIMemoryManager.getProjectMemory(projectId, MemoryType.DECISION, 5);
    const transitions = await AIMemoryManager.getProjectMemory(
      projectId,
      MemoryType.PHASE_TRANSITION,
      3
    );
    const recommendations = await AIMemoryManager.getProjectMemory(
      projectId,
      MemoryType.RECOMMENDATION,
      5
    );

    return {
      projectId,
      majorDecisions: decisions.map((d) => d.content),
      phaseTransitions: transitions.map((t) => t.content),
      aiRecommendations: recommendations.map((r) => r.content),
      memoryCount: decisions.length + transitions.length + recommendations.length,
    };
  },

  // ==================== RELEVANCE FILTERING ====================

  /**
   * Calculate relevance score between query and content
   */
  calculateRelevance: (content: string | any, query: string): number => {
    if (!content || !query) return 0;

    const normalizedContent = (
      typeof content === 'string' ? content : JSON.stringify(content)
    ).toLowerCase();
    const normalizedQuery = query.toLowerCase();

    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'as',
      'or',
      'and',
      'but',
      'if',
      'then',
      'than',
      'so',
      'that',
      'this',
      'these',
      'those',
      'what',
      'which',
      'who',
      'whom',
      'whose',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'not',
      'only',
      'same',
      'just',
      'also',
      'very',
      'it',
      'its',
      'my',
      'your',
    ]);

    const queryWords = normalizedQuery
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    if (queryWords.length === 0) return 0.5;

    let exactMatches = 0;
    let partialMatches = 0;

    queryWords.forEach((word) => {
      const exactRegex = new RegExp(`\\b${word}\\b`, 'gi');
      if (exactRegex.test(normalizedContent)) {
        exactMatches++;
      } else if (normalizedContent.includes(word)) {
        partialMatches++;
      }
    });

    const exactScore = exactMatches / queryWords.length;
    const partialScore = partialMatches / queryWords.length;
    const score = exactScore * 0.7 + partialScore * 0.3;

    if (normalizedContent.includes(normalizedQuery)) {
      return Math.min(1, score + 0.3);
    }

    return score;
  },

  /**
   * Get relevant memory based on query
   */
  getRelevantMemory: async (
    projectId: string,
    query: string,
    limit = 10,
    minRelevance = 0.1
  ): Promise<any[]> => {
    const fetchLimit = Math.max(limit * 3, 50);
    const allMemory = await AIMemoryManager.getProjectMemory(projectId, null, fetchLimit);

    if (!allMemory || allMemory.length === 0) return [];

    const scoredMemory = allMemory.map((item) => {
      const contentString =
        typeof item.content === 'string' ? item.content : JSON.stringify(item.content);

      const relevanceScore = AIMemoryManager.calculateRelevance(contentString, query);

      let typeWeight = 1.0;
      if (item.memory_type === MemoryType.DECISION) typeWeight = 1.2;
      else if (item.memory_type === MemoryType.PHASE_TRANSITION) typeWeight = 1.1;

      const ageInDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(0.8, 1 - ageInDays / 365);

      return {
        ...item,
        relevanceScore,
        weightedScore: relevanceScore * typeWeight * recencyWeight,
      };
    });

    return scoredMemory
      .filter((item) => item.relevanceScore >= minRelevance)
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, limit);
  },

  /**
   * Build relevance-aware project memory summary
   */
  buildRelevantMemorySummary: async (projectId: string, query: string | null) => {
    if (!query) {
      return AIMemoryManager.buildProjectMemorySummary(projectId);
    }

    const relevantMemory = await AIMemoryManager.getRelevantMemory(projectId, query, 15, 0.1);

    const decisions = relevantMemory
      .filter((m) => m.memory_type === MemoryType.DECISION)
      .slice(0, 5);
    const transitions = relevantMemory
      .filter((m) => m.memory_type === MemoryType.PHASE_TRANSITION)
      .slice(0, 3);
    const recommendations = relevantMemory
      .filter((m) => m.memory_type === MemoryType.RECOMMENDATION)
      .slice(0, 5);

    return {
      projectId,
      majorDecisions: decisions.map((d) => ({
        ...d.content,
        _relevance: d.relevanceScore,
      })),
      phaseTransitions: transitions.map((t) => ({
        ...t.content,
        _relevance: t.relevanceScore,
      })),
      aiRecommendations: recommendations.map((r) => ({
        ...r.content,
        _relevance: r.relevanceScore,
      })),
      memoryCount: decisions.length + transitions.length + recommendations.length,
      _relevanceFiltered: true,
      _query: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
    };
  },

  // ==================== ORGANIZATION MEMORY ====================

  /**
   * Get or create organization memory
   */
  getOrganizationMemory: async (organizationId: string) => {
    const row: any = await get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`, [
      organizationId,
    ]);

    if (row) {
      try {
        row.recurringPatterns = JSON.parse(row.recurring_patterns || '[]');
      } catch {
        row.recurringPatterns = [];
      }
      return row;
    }

    // Create default
    await run(`INSERT INTO ai_organization_memory (organization_id) VALUES (?)`, [organizationId]);
    return {
      organization_id: organizationId,
      governance_style: 'BALANCED',
      ai_strictness: 'STANDARD',
      recurringPatterns: [],
      pmo_maturity: 'BASIC',
    };
  },

  /**
   * Update organization memory
   */
  updateOrganizationMemory: async (organizationId: string, updates: any) => {
    const { governanceStyle, aiStrictness, pmoMaturity, patterns } = updates;

    const result = await run(
      `UPDATE ai_organization_memory SET
                governance_style = COALESCE(?, governance_style),
                ai_strictness = COALESCE(?, ai_strictness),
                pmo_maturity = COALESCE(?, pmo_maturity),
                recurring_patterns = COALESCE(?, recurring_patterns),
                updated_at = CURRENT_TIMESTAMP
             WHERE organization_id = ?`,
      [
        governanceStyle,
        aiStrictness,
        pmoMaturity,
        patterns ? JSON.stringify(patterns) : null,
        organizationId,
      ]
    );

    return { updated: result.success && (result.changes || 0) > 0 };
  },

  /**
   * Add recurring pattern
   */
  addRecurringPattern: async (organizationId: string, pattern: any) => {
    const memory = await AIMemoryManager.getOrganizationMemory(organizationId);
    const patterns = memory.recurringPatterns || [];
    patterns.push(pattern);

    return AIMemoryManager.updateOrganizationMemory(organizationId, { patterns });
  },

  // ==================== USER PREFERENCES ====================

  /**
   * Get or create user preferences
   */
  getUserPreferences: async (userId: string) => {
    const row: any = await get(`SELECT * FROM ai_user_preferences WHERE user_id = ?`, [userId]);

    if (row) return row;

    // Create default
    await run(`INSERT INTO ai_user_preferences (user_id) VALUES (?)`, [userId]);
    return {
      user_id: userId,
      preferred_tone: 'EXPERT',
      education_mode: 0,
      proactive_notifications: 1,
      preferred_language: 'en',
    };
  },

  /**
   * Update user preferences
   */
  updateUserPreferences: async (userId: string, updates: any) => {
    const { preferredTone, educationMode, proactiveNotifications, preferredLanguage } = updates;

    await run(
      `INSERT INTO ai_user_preferences (user_id, preferred_tone, education_mode, proactive_notifications, preferred_language)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                preferred_tone = COALESCE(?, preferred_tone),
                education_mode = COALESCE(?, education_mode),
                proactive_notifications = COALESCE(?, proactive_notifications),
                preferred_language = COALESCE(?, preferred_language),
                updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        preferredTone,
        educationMode ? 1 : 0,
        proactiveNotifications !== false ? 1 : 0,
        preferredLanguage || 'en',
        preferredTone,
        educationMode !== undefined ? (educationMode ? 1 : 0) : null,
        proactiveNotifications !== undefined ? (proactiveNotifications ? 1 : 0) : null,
        preferredLanguage,
      ]
    );

    return { updated: true, userId };
  },

  // ==================== CLEAR MEMORY (Admin) ====================

  /**
   * Clear project memory
   */
  clearProjectMemory: async (projectId: string) => {
    const result = await run(`DELETE FROM ai_project_memory WHERE project_id = ?`, [projectId]);
    return { deleted: result.changes };
  },

  /**
   * Clear organization memory
   */
  clearOrganizationMemory: async (organizationId: string) => {
    const result = await run(`DELETE FROM ai_organization_memory WHERE organization_id = ?`, [
      organizationId,
    ]);
    return { deleted: result.changes };
  },

  // ==================== MEMORY CLEANUP ====================

  /**
   * Cleanup old project memory entries
   */
  cleanupOldMemory: async (projectId: string | null = null, maxAgeDays = 90) => {
    let sql = `DELETE FROM ai_project_memory WHERE created_at < datetime('now', '-' || ? || ' days')`;
    const params: any[] = [maxAgeDays];

    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }

    const result = await run(sql, params);
    logger.info(
      `[AIMemoryManager] Cleaned up ${result.changes} old memory entries (older than ${maxAgeDays} days)`
    );

    return {
      deleted: result.changes,
      maxAgeDays,
      projectId: projectId || 'all',
    };
  },

  /**
   * Cleanup old partial responses (streaming resilience)
   */
  cleanupPartialResponses: async (maxAgeHours = 1) => {
    const result = await run(
      `DELETE FROM ai_partial_responses WHERE updated_at < datetime('now', '-' || ? || ' hours')`,
      [maxAgeHours]
    );

    if (
      !result.success &&
      (result.error?.includes('no such table') || result.error?.includes('does not exist'))
    ) {
      return { deleted: 0, skipped: true };
    }

    if ((result.changes || 0) > 0) {
      logger.info(`[AIMemoryManager] Cleaned up ${result.changes} old partial responses`);
    }
    return { deleted: result.changes, maxAgeHours };
  },

  /**
   * Cleanup old feedback entries
   */
  cleanupOldFeedback: async (maxAgeDays = 365) => {
    const result = await run(
      `DELETE FROM ai_feedback WHERE created_at < datetime('now', '-' || ? || ' days')`,
      [maxAgeDays]
    );

    if (
      !result.success &&
      (result.error?.includes('no such table') || result.error?.includes('does not exist'))
    ) {
      return { deleted: 0, skipped: true };
    }

    if ((result.changes || 0) > 0) {
      logger.info(`[AIMemoryManager] Cleaned up ${result.changes} old feedback entries`);
    }
    return { deleted: result.changes, maxAgeDays };
  },

  /**
   * Get memory statistics for monitoring
   */
  getMemoryStats: async () => {
    const stats: any = {};

    const pjCount: any = await get(`SELECT COUNT(*) as count FROM ai_project_memory`);
    stats.projectMemoryCount = pjCount?.count || 0;

    const orgCount: any = await get(`SELECT COUNT(*) as count FROM ai_organization_memory`);
    stats.orgMemoryCount = orgCount?.count || 0;

    const prefCount: any = await get(`SELECT COUNT(*) as count FROM ai_user_preferences`);
    stats.userPreferencesCount = prefCount?.count || 0;

    const oldest: any = await get(`SELECT MIN(created_at) as oldest FROM ai_project_memory`);
    stats.oldestMemoryEntry = oldest?.oldest || null;

    const rows = await all<any>(
      `SELECT memory_type, COUNT(*) as count FROM ai_project_memory GROUP BY memory_type`
    );
    stats.memoryByType = {};
    (rows || []).forEach((r) => {
      stats.memoryByType[r.memory_type] = r.count;
    });

    return stats;
  },

  /**
   * Run full cleanup cycle
   */
  runCleanupCycle: async () => {
    const startTime = Date.now();
    const results: any = {
      timestamp: new Date().toISOString(),
      projectMemory: null,
      partialResponses: null,
      feedback: null,
      stats: null,
      duration: 0,
    };

    try {
      results.projectMemory = await AIMemoryManager.cleanupOldMemory(null, 90);
      results.partialResponses = await AIMemoryManager.cleanupPartialResponses(1);
      results.feedback = await AIMemoryManager.cleanupOldFeedback(365);
      results.stats = await AIMemoryManager.getMemoryStats();
      results.duration = Date.now() - startTime;

      logger.info('[AIMemoryManager] Cleanup cycle complete:', {
        projectMemoryDeleted: results.projectMemory.deleted,
        partialResponsesDeleted: results.partialResponses.deleted,
        feedbackDeleted: results.feedback.deleted,
        duration: `${results.duration}ms`,
      });

      return results;
    } catch (error: any) {
      logger.error('[AIMemoryManager] Cleanup cycle failed:', error);
      results.error = error.message;
      results.duration = Date.now() - startTime;
      return results;
    }
  },

  // ==================== TOKEN MANAGEMENT ====================

  /**
   * Estimate token count for a text string
   */
  estimateTokens: (text: string): number => {
    if (!text || typeof text !== 'string') return 0;
    const charCount = text.length;
    const baseEstimate = Math.ceil(charCount / 3.8);
    return Math.ceil(baseEstimate * 1.1);
  },

  /**
   * Get token limit for a specific model
   */
  getModelTokenLimit: (modelName: string | null): number => {
    if (!modelName) return MODEL_TOKEN_LIMITS.default;

    const normalizedName = modelName.toLowerCase();
    for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
      if (normalizedName.includes(key)) {
        return limit;
      }
    }
    return MODEL_TOKEN_LIMITS.default;
  },

  /**
   * Trim memory to fit within token budget
   */
  trimMemory: (memory: any, maxTokens: number) => {
    if (!memory || maxTokens <= 0) return memory;

    const estimateTokens = AIMemoryManager.estimateTokens;
    let currentTokens = estimateTokens(JSON.stringify(memory));

    if (currentTokens <= maxTokens) return memory;

    const trimmedMemory = { ...memory };

    // Priority order: decisions > phaseTransitions > recommendations
    if (trimmedMemory.aiRecommendations && trimmedMemory.aiRecommendations.length > 0) {
      while (currentTokens > maxTokens && trimmedMemory.aiRecommendations.length > 1) {
        trimmedMemory.aiRecommendations.pop();
        currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
      }
      if (currentTokens > maxTokens) {
        trimmedMemory.aiRecommendations = [];
        currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
      }
    }

    if (trimmedMemory.phaseTransitions && trimmedMemory.phaseTransitions.length > 0) {
      while (currentTokens > maxTokens && trimmedMemory.phaseTransitions.length > 1) {
        trimmedMemory.phaseTransitions.pop();
        currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
      }
      if (currentTokens > maxTokens) {
        trimmedMemory.phaseTransitions = [];
        currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
      }
    }

    if (trimmedMemory.majorDecisions && trimmedMemory.majorDecisions.length > 0) {
      while (currentTokens > maxTokens && trimmedMemory.majorDecisions.length > 1) {
        trimmedMemory.majorDecisions.pop();
        currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
      }
      if (currentTokens > maxTokens) {
        if (trimmedMemory.majorDecisions[0]) {
          const decision = trimmedMemory.majorDecisions[0];
          trimmedMemory.majorDecisions = [
            {
              ...decision,
              rationale: decision.rationale ? decision.rationale.substring(0, 200) + '...' : '',
              _truncated: true,
            },
          ];
        }
      }
    }

    trimmedMemory.memoryCount =
      (trimmedMemory.majorDecisions?.length || 0) +
      (trimmedMemory.phaseTransitions?.length || 0) +
      (trimmedMemory.aiRecommendations?.length || 0);

    trimmedMemory._trimmed = true;
    trimmedMemory._originalTokens = estimateTokens(JSON.stringify(memory));
    trimmedMemory._trimmedTokens = estimateTokens(JSON.stringify(trimmedMemory));

    return trimmedMemory;
  },

  /**
   * Trim conversation history to fit within token budget
   */
  trimHistory: (history: any[], maxTokens: number) => {
    if (!history || !Array.isArray(history) || maxTokens <= 0) return history;

    const estimateTokens = AIMemoryManager.estimateTokens;
    const currentTokens = history.reduce((sum, msg) => sum + estimateTokens(msg.content || ''), 0);

    if (currentTokens <= maxTokens) return history;

    const systemMessages = history.filter((m) => m.role === 'system');
    const conversationMessages = history.filter((m) => m.role !== 'system');

    const systemTokens = systemMessages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content || ''),
      0
    );
    const availableForConversation = maxTokens - systemTokens;

    if (availableForConversation <= 0) return systemMessages;

    const trimmedConversation: any[] = [];
    let conversationTokens = 0;

    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgTokens = estimateTokens(msg.content || '');

      if (conversationTokens + msgTokens <= availableForConversation) {
        trimmedConversation.unshift(msg);
        conversationTokens += msgTokens;
      } else {
        const availableTokens = availableForConversation - conversationTokens;
        if (availableTokens > 50) {
          const truncatedContent =
            (msg.content || '').substring(0, availableTokens * 3) + '... [truncated]';
          trimmedConversation.unshift({
            ...msg,
            content: truncatedContent,
            _truncated: true,
          });
        }
        break;
      }
    }

    if (trimmedConversation.length < conversationMessages.length) {
      trimmedConversation.unshift({
        role: 'system',
        content: `[Note: Earlier conversation history (${conversationMessages.length - trimmedConversation.length} messages) was trimmed to fit context window]`,
        _trimMarker: true,
      });
    }

    return [...systemMessages, ...trimmedConversation];
  },

  /**
   * Calculate total context size and check if within limits
   */
  analyzeContextTokens: (
    systemPrompt: string,
    userMessage: string,
    history: any[],
    memory: any,
    modelName = 'gpt-4'
  ) => {
    const estimateTokens = AIMemoryManager.estimateTokens;
    const modelLimit = AIMemoryManager.getModelTokenLimit(modelName);

    const systemTokens = estimateTokens(systemPrompt || '');
    const userTokens = estimateTokens(userMessage || '');
    const historyTokens = (history || []).reduce(
      (sum, msg) => sum + estimateTokens(msg.content || ''),
      0
    );
    const memoryTokens = estimateTokens(JSON.stringify(memory || {}));

    const totalTokens = systemTokens + userTokens + historyTokens + memoryTokens;
    const responseBuffer = Math.floor(modelLimit * 0.2);
    const availableForContext = modelLimit - responseBuffer;

    return {
      breakdown: {
        system: systemTokens,
        user: userTokens,
        history: historyTokens,
        memory: memoryTokens,
        total: totalTokens,
      },
      limits: {
        model: modelName,
        modelLimit,
        responseBuffer,
        availableForContext,
      },
      status: {
        withinLimits: totalTokens <= availableForContext,
        utilizationPercent: Math.round((totalTokens / availableForContext) * 100),
        overBy: Math.max(0, totalTokens - availableForContext),
        headroom: Math.max(0, availableForContext - totalTokens),
      },
      recommendations:
        totalTokens > availableForContext
          ? {
              trimMemoryBy: Math.min(memoryTokens, totalTokens - availableForContext),
              trimHistoryBy: Math.max(0, totalTokens - availableForContext - memoryTokens),
            }
          : null,
    };
  },

  /**
   * Auto-trim context to fit within model limits
   */
  autoTrimContext: ({ systemPrompt, userMessage, history, memory, modelName = 'gpt-4' }: any) => {
    const analysis = AIMemoryManager.analyzeContextTokens(
      systemPrompt,
      userMessage,
      history,
      memory,
      modelName
    );

    if (analysis.status.withinLimits) {
      return {
        history,
        memory,
        trimmed: false,
        analysis,
      };
    }

    const fixedTokens = analysis.breakdown.system + analysis.breakdown.user;
    const availableForDynamic = analysis.limits.availableForContext - fixedTokens;

    const historyBudget = Math.floor(availableForDynamic * 0.6);
    const memoryBudget = Math.floor(availableForDynamic * 0.4);

    const trimmedHistory = AIMemoryManager.trimHistory(history, historyBudget);
    const trimmedMemory = AIMemoryManager.trimMemory(memory, memoryBudget);

    const newAnalysis = AIMemoryManager.analyzeContextTokens(
      systemPrompt,
      userMessage,
      trimmedHistory,
      trimmedMemory,
      modelName
    );

    return {
      history: trimmedHistory,
      memory: trimmedMemory,
      trimmed: true,
      originalAnalysis: analysis,
      newAnalysis,
    };
  },

  // ========================================================================
  // PERSONALIZATION ENGINE
  // ========================================================================

  DEFAULT_PERSONALIZATION: {
    responseLength: 'balanced',
    technicalDepth: 'adaptive',
    communicationStyle: 'professional',
    preferredLanguage: 'en',
    includeExamples: true,
    includeCodeSnippets: true,
    formatPreference: 'markdown',
    educationMode: false,
    actionOrientation: 'balanced',
  } as PersonalizationProfile,

  /**
   * Get or create personalization profile for a user
   */
  getPersonalizationProfile: async (userId: string | null): Promise<PersonalizationProfile> => {
    if (!userId) {
      return { ...AIMemoryManager.DEFAULT_PERSONALIZATION };
    }

    const row: any = await get(`SELECT preferences FROM user_ai_preferences WHERE user_id = ?`, [
      userId,
    ]);

    if (!row) {
      return { ...AIMemoryManager.DEFAULT_PERSONALIZATION };
    }

    try {
      const prefs = JSON.parse(row.preferences || '{}');
      return {
        ...AIMemoryManager.DEFAULT_PERSONALIZATION,
        ...prefs,
      };
    } catch (e) {
      return { ...AIMemoryManager.DEFAULT_PERSONALIZATION };
    }
  },

  /**
   * Update user's personalization preferences
   */
  updatePersonalizationProfile: async (
    userId: string,
    preferences: Partial<PersonalizationProfile>
  ) => {
    if (!userId) return { success: false, error: 'User ID required' };

    const id = uuidv4();
    const now = new Date().toISOString();

    const current = await AIMemoryManager.getPersonalizationProfile(userId);
    const merged = { ...current, ...preferences };

    const result = await run(
      `
            INSERT INTO user_ai_preferences (id, user_id, preferences, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                preferences = excluded.preferences,
                updated_at = excluded.updated_at
        `,
      [id, userId, JSON.stringify(merged), now]
    );

    return { success: result.success, preferences: merged };
  },

  /**
   * Learn from user interaction patterns to update personalization
   */
  learnFromInteraction: async (userId: string, interaction: any) => {
    if (!userId) return;

    const { messageLength, feedback, usedCodeSnippets } = interaction;
    const profile = await AIMemoryManager.getPersonalizationProfile(userId);
    const updates: any = {};

    if (feedback?.tooLong) {
      if (profile.responseLength === 'detailed') updates.responseLength = 'balanced';
      else if (profile.responseLength === 'balanced') updates.responseLength = 'concise';
    } else if (feedback?.tooShort) {
      if (profile.responseLength === 'concise') updates.responseLength = 'balanced';
      else if (profile.responseLength === 'balanced') updates.responseLength = 'detailed';
    }

    if (messageLength > 500 && profile.technicalDepth !== 'advanced') {
      updates.technicalDepth = 'advanced';
    }

    if (usedCodeSnippets !== undefined) {
      updates.includeCodeSnippets = usedCodeSnippets;
    }

    if (Object.keys(updates).length > 0) {
      await AIMemoryManager.updatePersonalizationProfile(userId, updates);
    }
  },

  /**
   * Build personalized system prompt additions based on user profile
   */
  buildPersonalizedPrompt: async (userId: string | null): Promise<string> => {
    if (!userId) return '';

    const profile = await AIMemoryManager.getPersonalizationProfile(userId);
    const parts: string[] = [];

    switch (profile.responseLength) {
      case 'concise':
        parts.push('Keep responses brief and to the point. Use bullet points when possible.');
        break;
      case 'detailed':
        parts.push('Provide comprehensive responses with thorough explanations and context.');
        break;
      default:
        parts.push('Provide balanced responses - detailed where necessary, concise otherwise.');
    }

    switch (profile.technicalDepth) {
      case 'beginner':
        parts.push('Explain concepts in simple terms. Avoid jargon. Include basic explanations.');
        break;
      case 'advanced':
        parts.push('Use technical terminology freely. Assume familiarity with advanced concepts.');
        break;
      case 'adaptive':
        parts.push('Match technical depth to the complexity of the question.');
        break;
      default:
        parts.push('Use moderate technical language with brief explanations of complex terms.');
    }

    switch (profile.communicationStyle) {
      case 'casual':
        parts.push('Use a casual, conversational tone.');
        break;
      case 'formal':
        parts.push('Use formal, business language.');
        break;
      case 'friendly':
        parts.push('Be warm and encouraging in responses.');
        break;
      default:
        parts.push('Use professional but approachable language.');
    }

    if (profile.formatPreference === 'structured') {
      parts.push('Use clear structure with headers, numbered lists, and sections.');
    }

    if (!profile.includeCodeSnippets) {
      parts.push('Minimize code examples unless specifically requested.');
    }

    if (profile.educationMode) {
      parts.push('Include educational context and explain reasoning behind suggestions.');
    }

    switch (profile.actionOrientation) {
      case 'advisory':
        parts.push('Focus on analysis and recommendations rather than direct actions.');
        break;
      case 'action-oriented':
        parts.push('Prioritize actionable steps and concrete next actions.');
        break;
    }

    return parts.length > 0
      ? `\n\nUSER PREFERENCES:\n${parts.map((p) => `- ${p}`).join('\n')}\n`
      : '';
  },

  /**
   * Get personalization analytics for user
   */
  getPersonalizationAnalytics: async (userId: string) => {
    const profile = await AIMemoryManager.getPersonalizationProfile(userId);
    const stats: any = await get(
      `
            SELECT 
                COUNT(*) as "totalInteractions",
                AVG(CASE WHEN json_extract(metadata, '$.rating') = 'positive' THEN 1 ELSE 0 END) as "positiveRate"
            FROM ai_feedback
            WHERE user_id = ?
            AND created_at >= datetime('now', '-30 days')
        `,
      [userId]
    );

    return {
      profile,
      analytics: {
        totalInteractions: stats?.totalInteractions || 0,
        satisfactionRate: Math.round((stats?.positiveRate || 0) * 100),
        isPersonalized:
          JSON.stringify(profile) !== JSON.stringify(AIMemoryManager.DEFAULT_PERSONALIZATION),
      },
    };
  },
};

export default AIMemoryManager;
