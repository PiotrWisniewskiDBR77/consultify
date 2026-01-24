/**
 * AI Learning Job
 * FLOW-AI-ADAPTIVE-001: Scheduled background job for AI learning and profile optimization
 *
 * Runs periodically to:
 * - Analyze user feedback patterns
 * - Extract style preferences from interactions
 * - Update user profiles with high-confidence patterns
 * - Generate quality metrics
 * - Create instruction suggestions for admins
 *
 * Designed to run every 6 hours in production.
 *
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// Configuration
const CONFIG = {
  runIntervalHours: 6,
  minFeedbackForAnalysis: 5,
  highConfidenceThreshold: 0.7,
  patternExpirationDays: 30,
  maxProfileUpdatesPerRun: 100,
  enableAutoProfileUpdates: true,
  enableInstructionSuggestions: true,
};

// Job state
interface JobStats {
  runsCompleted: number;
  usersProcessed: number;
  patternsExtracted: number;
  profilesUpdated: number;
  suggestionsGenerated: number;
  lastRunDuration: number;
}

interface RunResult {
  runId: string;
  success: boolean;
  duration: number;
  stats: {
    usersProcessed: number;
    patternsFound: number;
    suggestionsApplied: number;
    metricsCalculated: number;
    instructionSuggestionsCreated: number;
  };
  errors?: string[];
}

// ==========================================
// AI LEARNING JOB
// ==========================================

const AILearningJob = {
  CONFIG,

  // State tracking
  lastRun: null as Date | null,
  isRunning: false,
  stats: {
    runsCompleted: 0,
    usersProcessed: 0,
    patternsExtracted: 0,
    profilesUpdated: 0,
    suggestionsGenerated: 0,
    lastRunDuration: 0,
  } as JobStats,

  /**
   * Main job execution - called by scheduler
   */
  async run(): Promise<RunResult> {
    if (this.isRunning) {
      logger.info('[AILearningJob] Already running, skipping...');
      return {
        runId: 'skipped',
        success: false,
        duration: 0,
        stats: {
          usersProcessed: 0,
          patternsFound: 0,
          suggestionsApplied: 0,
          metricsCalculated: 0,
          instructionSuggestionsCreated: 0,
        },
        errors: ['Job already running'],
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const runId = uuidv4();
    const errors: string[] = [];

    logger.info(`[AILearningJob] Starting run ${runId}`);

    let usersProcessed = 0;
    let patternsFound = 0;
    let suggestionsApplied = 0;
    let metricsCalculated = 0;
    let instructionSuggestionsCreated = 0;

    try {
      // 1. Import learning service dynamically
      const learningModule = await import('../services/ai/aiLearningService.js');
      const aiLearningService = learningModule.default;

      // 2. Run batch learning for all organizations
      logger.info('[AILearningJob] Running batch learning...');
      const batchResult = await aiLearningService.runBatchLearning();
      usersProcessed = batchResult.usersProcessed;
      patternsFound = batchResult.patternsFound;
      suggestionsApplied = batchResult.suggestionsApplied;

      // 3. Calculate quality metrics for all organizations
      logger.info('[AILearningJob] Calculating quality metrics...');
      const orgs = await this.getActiveOrganizations();
      for (const orgId of orgs) {
        try {
          await aiLearningService.calculateQualityMetrics(orgId);
          metricsCalculated++;
        } catch (err: any) {
          errors.push(`Metrics calc failed for org ${orgId}: ${err.message}`);
        }
      }

      // 4. Generate instruction suggestions from patterns
      if (CONFIG.enableInstructionSuggestions) {
        logger.info('[AILearningJob] Generating instruction suggestions...');
        const suggestionsCreated = await this.generateInstructionSuggestions();
        instructionSuggestionsCreated = suggestionsCreated;
      }

      // 5. Clean up old patterns
      logger.info('[AILearningJob] Cleaning up expired patterns...');
      await this.cleanupExpiredPatterns();

      // Update stats
      this.stats.runsCompleted++;
      this.stats.usersProcessed += usersProcessed;
      this.stats.patternsExtracted += patternsFound;
      this.stats.profilesUpdated += suggestionsApplied;
      this.stats.suggestionsGenerated += instructionSuggestionsCreated;
      this.lastRun = new Date();
    } catch (error: any) {
      logger.error('[AILearningJob] Run error:', error);
      errors.push(error.message);
    } finally {
      this.isRunning = false;
    }

    const duration = Date.now() - startTime;
    this.stats.lastRunDuration = duration;

    logger.info(`[AILearningJob] Run ${runId} completed in ${duration}ms`, {
      usersProcessed,
      patternsFound,
      suggestionsApplied,
      metricsCalculated,
      instructionSuggestionsCreated,
      errors: errors.length,
    });

    return {
      runId,
      success: errors.length === 0,
      duration,
      stats: {
        usersProcessed,
        patternsFound,
        suggestionsApplied,
        metricsCalculated,
        instructionSuggestionsCreated,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /**
   * Get list of active organizations
   */
  async getActiveOrganizations(): Promise<string[]> {
    try {
      const db = await getDatabase();
      const orgs = await db.all<{ id: string }>(
        `SELECT id FROM organizations WHERE status = 'ACTIVE' LIMIT 1000`,
        []
      );
      return (orgs || []).map((o) => o.id);
    } catch (error) {
      logger.error('[AILearningJob] Failed to get organizations:', error);
      return [];
    }
  },

  /**
   * Generate instruction suggestions from high-frequency negative patterns
   */
  async generateInstructionSuggestions(): Promise<number> {
    let created = 0;

    try {
      const db = await getDatabase();

      // Find patterns that indicate system-wide issues
      const problemPatterns = await db.all<{
        pattern_type: string;
        pattern_value: string;
        count: number;
        contexts: string;
      }>(
        `SELECT 
          pattern_type, 
          pattern_value,
          COUNT(*) as count,
          GROUP_CONCAT(DISTINCT detected_in_context) as contexts
        FROM ai_style_learning_patterns
        WHERE status = 'active'
        AND confidence_score < 0.5
        AND created_at > datetime('now', '-7 days')
        GROUP BY pattern_type, pattern_value
        HAVING count >= 5
        ORDER BY count DESC
        LIMIT 10`,
        []
      );

      for (const pattern of problemPatterns || []) {
        const suggestion = this.generateSuggestionFromPattern(pattern);
        if (suggestion) {
          const id = `suggestion-${uuidv4()}`;
          await db.run(
            `INSERT INTO ai_instruction_suggestions (
              id, suggested_instruction, category, reason, confidence_score, status, created_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
            [
              id,
              suggestion.instruction,
              suggestion.category,
              suggestion.reason,
              suggestion.confidence,
            ]
          );
          created++;
        }
      }
    } catch (error) {
      logger.error('[AILearningJob] generateInstructionSuggestions error:', error);
    }

    return created;
  },

  /**
   * Generate a suggestion from a problem pattern
   */
  generateSuggestionFromPattern(pattern: {
    pattern_type: string;
    pattern_value: string;
    count: number;
    contexts: string;
  }): { instruction: string; category: string; reason: string; confidence: number } | null {
    const { pattern_type, pattern_value, count, contexts } = pattern;

    // Generate instruction based on pattern type
    switch (pattern_type) {
      case 'length_preference':
        if (pattern_value === 'too_long') {
          return {
            instruction:
              'Keep responses more concise. Focus on key points and avoid unnecessary elaboration.',
            category: 'response_length',
            reason: `${count} users indicated responses were too long${contexts ? ` in contexts: ${contexts}` : ''}`,
            confidence: Math.min(0.9, count * 0.1),
          };
        } else if (pattern_value === 'too_short') {
          return {
            instruction:
              'Provide more comprehensive responses with additional context and detail when helpful.',
            category: 'response_length',
            reason: `${count} users indicated responses were too short${contexts ? ` in contexts: ${contexts}` : ''}`,
            confidence: Math.min(0.9, count * 0.1),
          };
        }
        break;

      case 'depth_preference':
        if (pattern_value === 'too_much') {
          return {
            instruction:
              'Prioritize high-level summaries over deep technical details unless specifically asked.',
            category: 'response_depth',
            reason: `${count} users indicated too much detail${contexts ? ` in contexts: ${contexts}` : ''}`,
            confidence: Math.min(0.9, count * 0.1),
          };
        } else if (pattern_value === 'too_little') {
          return {
            instruction: 'Include more thorough explanations and supporting details in responses.',
            category: 'response_depth',
            reason: `${count} users indicated insufficient detail${contexts ? ` in contexts: ${contexts}` : ''}`,
            confidence: Math.min(0.9, count * 0.1),
          };
        }
        break;

      case 'format_preference':
        return {
          instruction: `Consider using ${pattern_value} format more frequently in responses.`,
          category: 'response_format',
          reason: `${count} users requested ${pattern_value} format${contexts ? ` in contexts: ${contexts}` : ''}`,
          confidence: Math.min(0.9, count * 0.1),
        };
    }

    return null;
  },

  /**
   * Clean up expired patterns
   */
  async cleanupExpiredPatterns(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.run(
        `UPDATE ai_style_learning_patterns 
        SET status = 'expired', updated_at = datetime('now')
        WHERE status = 'active'
        AND created_at < datetime('now', '-${CONFIG.patternExpirationDays} days')
        AND confidence_score < 0.7`,
        []
      );
      return (result as any)?.changes || 0;
    } catch (error) {
      logger.error('[AILearningJob] cleanupExpiredPatterns error:', error);
      return 0;
    }
  },

  /**
   * Get current job stats
   */
  getStats(): JobStats & { lastRun: Date | null; isRunning: boolean } {
    return {
      ...this.stats,
      lastRun: this.lastRun,
      isRunning: this.isRunning,
    };
  },

  /**
   * Reset stats
   */
  resetStats(): void {
    this.stats = {
      runsCompleted: 0,
      usersProcessed: 0,
      patternsExtracted: 0,
      profilesUpdated: 0,
      suggestionsGenerated: 0,
      lastRunDuration: 0,
    };
  },
};

// ==========================================
// SCHEDULER INTEGRATION
// ==========================================

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the learning job scheduler
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    logger.warn('[AILearningJob] Scheduler already running');
    return;
  }

  const intervalMs = CONFIG.runIntervalHours * 60 * 60 * 1000;

  logger.info(`[AILearningJob] Starting scheduler (every ${CONFIG.runIntervalHours} hours)`);

  // Run immediately on start
  AILearningJob.run().catch((err) => {
    logger.error('[AILearningJob] Initial run failed:', err);
  });

  // Schedule recurring runs
  schedulerInterval = setInterval(() => {
    AILearningJob.run().catch((err) => {
      logger.error('[AILearningJob] Scheduled run failed:', err);
    });
  }, intervalMs);
}

/**
 * Stop the learning job scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[AILearningJob] Scheduler stopped');
  }
}

/**
 * Run the job manually (for testing or manual triggers)
 */
export function runNow(): Promise<RunResult> {
  return AILearningJob.run();
}

/**
 * Get job stats
 */
export function getJobStats() {
  return AILearningJob.getStats();
}

// Export the job object
export default AILearningJob;
