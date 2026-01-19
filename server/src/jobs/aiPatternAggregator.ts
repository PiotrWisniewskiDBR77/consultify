/**
 * AI Pattern Aggregator Job
 * 
 * Background job that periodically aggregates AI learning patterns
 * and generates improvement suggestions for organizations.
 * 
 * Schedule: Every hour (configurable)
 * 
 * @version 1.0.0
 */

import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { AILearningService } from '../services/ai/aiLearningService.js';
import { KnowledgeHubService } from '../services/ai/knowledgeHubService.js';
import { InstructionService } from '../services/ai/instructionService.js';

// ==========================================
// CONFIGURATION
// ==========================================

interface AggregatorConfig {
  enabled: boolean;
  intervalMs: number;
  patternExtractionDays: number;
  minInteractionsForPattern: number;
  suggestionThreshold: number;
}

const DEFAULT_CONFIG: AggregatorConfig = {
  enabled: process.env.AI_PATTERN_AGGREGATOR_ENABLED !== 'false',
  intervalMs: parseInt(process.env.AI_PATTERN_AGGREGATOR_INTERVAL_MS || '3600000', 10), // 1 hour
  patternExtractionDays: parseInt(process.env.AI_PATTERN_EXTRACTION_DAYS || '30', 10),
  minInteractionsForPattern: parseInt(process.env.AI_MIN_INTERACTIONS_FOR_PATTERN || '10', 10),
  suggestionThreshold: parseFloat(process.env.AI_SUGGESTION_THRESHOLD || '0.4'),
};

// ==========================================
// JOB IMPLEMENTATION
// ==========================================

class AIPatternAggregatorJob {
  private static instance: AIPatternAggregatorJob;
  private config: AggregatorConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastRunAt: Date | null = null;
  private lastRunStats: {
    organizationsProcessed: number;
    patternsExtracted: number;
    suggestionsGenerated: number;
    insightsAggregated: number;
    errors: number;
  } | null = null;

  private constructor() {
    this.config = DEFAULT_CONFIG;
  }

  public static getInstance(): AIPatternAggregatorJob {
    if (!AIPatternAggregatorJob.instance) {
      AIPatternAggregatorJob.instance = new AIPatternAggregatorJob();
    }
    return AIPatternAggregatorJob.instance;
  }

  // ==========================================
  // JOB CONTROL
  // ==========================================

  /**
   * Start the aggregator job
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('[AIPatternAggregator] Job is disabled by configuration');
      return;
    }

    if (this.intervalId) {
      logger.warn('[AIPatternAggregator] Job is already running');
      return;
    }

    logger.info(`[AIPatternAggregator] Starting job with interval ${this.config.intervalMs}ms`);

    // Run immediately on start
    this.runAggregation().catch(err => {
      logger.error('[AIPatternAggregator] Initial run failed:', err);
    });

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runAggregation().catch(err => {
        logger.error('[AIPatternAggregator] Scheduled run failed:', err);
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop the aggregator job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[AIPatternAggregator] Job stopped');
    }
  }

  /**
   * Get job status
   */
  getStatus(): {
    running: boolean;
    enabled: boolean;
    lastRunAt: Date | null;
    lastRunStats: typeof this.lastRunStats;
    config: Omit<AggregatorConfig, 'enabled'>;
  } {
    return {
      running: !!this.intervalId,
      enabled: this.config.enabled,
      lastRunAt: this.lastRunAt,
      lastRunStats: this.lastRunStats,
      config: {
        intervalMs: this.config.intervalMs,
        patternExtractionDays: this.config.patternExtractionDays,
        minInteractionsForPattern: this.config.minInteractionsForPattern,
        suggestionThreshold: this.config.suggestionThreshold,
      },
    };
  }

  /**
   * Manually trigger aggregation
   */
  async triggerManually(): Promise<typeof this.lastRunStats> {
    await this.runAggregation();
    return this.lastRunStats;
  }

  // ==========================================
  // AGGREGATION LOGIC
  // ==========================================

  /**
   * Main aggregation routine
   */
  private async runAggregation(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[AIPatternAggregator] Skipping run - previous run still in progress');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    const stats = {
      organizationsProcessed: 0,
      patternsExtracted: 0,
      suggestionsGenerated: 0,
      insightsAggregated: 0,
      errors: 0,
    };

    try {
      logger.info('[AIPatternAggregator] Starting aggregation run');

      // Get all organizations with AI interactions
      const organizations = await this.getActiveOrganizations();
      logger.info(`[AIPatternAggregator] Found ${organizations.length} organizations to process`);

      for (const org of organizations) {
        try {
          const orgId = (org as any).organization_id;
          
          // 1. Extract patterns from feedback
          const patterns = await AILearningService.extractPatterns(
            orgId,
            this.config.patternExtractionDays
          );
          stats.patternsExtracted += patterns.length;

          // 2. Generate improvement suggestions
          const suggestions = await AILearningService.generateSuggestions(orgId);
          stats.suggestionsGenerated += suggestions.length;

          // 3. Aggregate cross-project insights
          await KnowledgeHubService.aggregateCrossProjectInsights(orgId);
          stats.insightsAggregated++;

          // 4. Update instruction effectiveness
          await this.updateInstructionEffectiveness(orgId);

          stats.organizationsProcessed++;
          logger.debug(`[AIPatternAggregator] Processed org ${orgId}: ${patterns.length} patterns, ${suggestions.length} suggestions`);
        } catch (error: any) {
          stats.errors++;
          logger.error(`[AIPatternAggregator] Error processing org ${(org as any).organization_id}:`, error);
        }
      }

      // Clean up old data
      await this.cleanupOldData();

      const duration = Date.now() - startTime;
      logger.info(`[AIPatternAggregator] Completed in ${duration}ms:`, stats);

    } catch (error: any) {
      stats.errors++;
      logger.error('[AIPatternAggregator] Aggregation failed:', error);
    } finally {
      this.isRunning = false;
      this.lastRunAt = new Date();
      this.lastRunStats = stats;
    }
  }

  /**
   * Get organizations with recent AI interactions
   */
  private async getActiveOrganizations(): Promise<any[]> {
    try {
      const cutoff = new Date(
        Date.now() - this.config.patternExtractionDays * 24 * 60 * 60 * 1000
      ).toISOString();

      // Try to get from learning interactions table
      const orgs = await dbAll(
        `SELECT DISTINCT organization_id 
         FROM ai_learning_interactions 
         WHERE created_at > ?`,
        [cutoff]
      );

      if (orgs.length > 0) return orgs;

      // Fallback: get from conversations table
      return await dbAll(
        `SELECT DISTINCT organization_id 
         FROM conversations 
         WHERE created_at > ? AND organization_id IS NOT NULL`,
        [cutoff]
      );
    } catch (error: any) {
      logger.error('[AIPatternAggregator] getActiveOrganizations failed:', error);
      return [];
    }
  }

  /**
   * Update instruction effectiveness across organization
   */
  private async updateInstructionEffectiveness(organizationId: string): Promise<void> {
    try {
      // Get effectiveness report
      const report = await InstructionService.getEffectivenessReport('organization', organizationId);

      // Auto-disable instructions with very poor effectiveness
      for (const inst of report.needsImprovement) {
        if (inst.effectivenessScore !== undefined && inst.effectivenessScore < 0.2) {
          logger.info(`[AIPatternAggregator] Auto-disabling low-effectiveness instruction: ${inst.id}`);
          await InstructionService.updateInstruction(inst.id, 'organization', { isActive: false });
        }
      }
    } catch (error: any) {
      logger.warn('[AIPatternAggregator] updateInstructionEffectiveness failed:', error.message);
    }
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const cutoffDays = 90; // Keep 90 days of history
      const cutoff = new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString();

      // Clean old patterns with low occurrence
      await dbAll(
        `DELETE FROM ai_learning_patterns 
         WHERE created_at < ? AND occurrence_count < 5`,
        [cutoff]
      );

      // Clean dismissed suggestions older than 30 days
      const suggestionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await dbAll(
        `DELETE FROM ai_improvement_suggestions 
         WHERE status = 'dismissed' AND created_at < ?`,
        [suggestionCutoff]
      );

      // Clean expired web search cache
      const { WebSearchService } = await import('../services/ai/webSearchService.js');
      await WebSearchService.cleanExpiredCache();

      logger.debug('[AIPatternAggregator] Cleanup completed');
    } catch (error: any) {
      logger.warn('[AIPatternAggregator] Cleanup failed:', error.message);
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

export const aiPatternAggregator = AIPatternAggregatorJob.getInstance();

// Auto-start if in production
if (process.env.NODE_ENV === 'production') {
  // Delay start to allow other services to initialize
  setTimeout(() => {
    aiPatternAggregator.start();
  }, 10000);
}

export default aiPatternAggregator;
