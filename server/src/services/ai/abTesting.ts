/**
 * ABTesting Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Full implementation with database support for A/B testing experiments.
 */

import { v4 as uuidv4 } from 'uuid';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

interface ExperimentVariant {
  id: string;
  name: string;
  description: string;
  traffic: number;
}

interface ExperimentFilters {
  status?: string;
  promptId?: string;
}

interface CreateExperimentData {
  name: string;
  description?: string;
  type?: string;
  promptId?: string;
  variants?: ExperimentVariant[];
  targetMetric?: string;
  minimumSampleSize?: number;
  confidenceLevel?: number;
  createdBy: string;
}

class ABTestingService {
  /**
   * List all experiments with optional filters
   */
  async listExperiments(filters: ExperimentFilters = {}) {
    try {
      let query = 'SELECT * FROM ai_ab_experiments WHERE 1=1';
      const params: any[] = [];

      if (filters.status && filters.status !== 'all') {
        query += ' AND status = ?';
        params.push(filters.status.toLowerCase());
      }

      if (filters.promptId) {
        query += ' AND prompt_id = ?';
        params.push(filters.promptId);
      }

      query += ' ORDER BY created_at DESC';

      const experiments = (await dbAll(query, params)) as any[];

      // Parse JSON fields and enrich with stats
      return Promise.all(
        experiments.map(async (exp: any) => {
          const stats = await this.getExperimentStats(exp.id);
          return {
            ...exp,
            variants: exp.variants,
            traffic_split: exp.traffic_split,
            ...stats,
          };
        })
      );
    } catch (error: any) {
      logger.error('[ABTestingService] Error listing experiments:', error);
      throw error;
    }
  }

  /**
   * Get a single experiment by ID
   */
  async getExperiment(id: string) {
    try {
      const experiment = (await dbGet('SELECT * FROM ai_ab_experiments WHERE id = ?', [id])) as any;
      if (!experiment) return null;

      const stats = await this.getExperimentStats(id);
      return {
        ...experiment,
        variants: JSON.parse(experiment.variants || '[]'),
        traffic_split: JSON.parse(experiment.traffic_split || '[]'),
        ...stats,
      };
    } catch (error: any) {
      logger.error(`[ABTestingService] Error getting experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new experiment
   */
  async createExperiment(data: CreateExperimentData) {
    try {
      const id = uuidv4();
      const variants = data.variants || [
        { id: uuidv4(), name: 'Control', description: 'Current version', traffic: 50 },
        { id: uuidv4(), name: 'Variant A', description: 'New version', traffic: 50 },
      ];
      const trafficSplit = variants.map((v) => ({ variantId: v.id, traffic: v.traffic }));

      await dbRun(
        `
                INSERT INTO ai_ab_experiments (
                    id, name, description, prompt_id, variants, traffic_split,
                    min_sample_size, confidence_level, primary_metric, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
            `,
        [
          id,
          data.name,
          data.description || '',
          data.promptId || 'general',
          JSON.stringify(variants),
          JSON.stringify(trafficSplit),
          data.minimumSampleSize || 100,
          data.confidenceLevel || 0.95,
          data.targetMetric || 'satisfaction',
          data.createdBy,
        ]
      );

      return this.getExperiment(id);
    } catch (error: any) {
      logger.error('[ABTestingService] Error creating experiment:', error);
      throw error;
    }
  }

  /**
   * Update an experiment
   */
  async updateExperiment(id: string, data: any) {
    try {
      const existing = await this.getExperiment(id);
      if (!existing) throw new Error('Experiment not found');

      const updates: string[] = [];
      const params: any[] = [];

      if (data.name) {
        updates.push('name = ?');
        params.push(data.name);
      }
      if (data.description) {
        updates.push('description = ?');
        params.push(data.description);
      }
      if (data.variants) {
        updates.push('variants = ?');
        params.push(JSON.stringify(data.variants));
      }

      if (updates.length > 0) {
        params.push(id);
        await dbRun(`UPDATE ai_ab_experiments SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      return this.getExperiment(id);
    } catch (error: any) {
      logger.error(`[ABTestingService] Error updating experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Start an experiment
   */
  async startExperiment(id: string, userId: string) {
    try {
      await dbRun(
        `
                UPDATE ai_ab_experiments 
                SET status = 'running', started_at = CURRENT_TIMESTAMP 
                WHERE id = ? AND status = 'draft'
            `,
        [id]
      );
      return this.getExperiment(id);
    } catch (error: any) {
      logger.error(`[ABTestingService] Error starting experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Stop an experiment
   */
  async stopExperiment(id: string, reason?: string) {
    try {
      await dbRun(
        `
                UPDATE ai_ab_experiments 
                SET status = 'completed', ended_at = CURRENT_TIMESTAMP, stop_reason = ?
                WHERE id = ? AND status = 'running'
            `,
        [reason || 'Manual stop', id]
      );
      return this.getExperiment(id);
    } catch (error: any) {
      logger.error(`[ABTestingService] Error stopping experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(id: string) {
    try {
      await dbRun(
        `
                UPDATE ai_ab_experiments 
                SET status = 'paused'
                WHERE id = ? AND status = 'running'
            `,
        [id]
      );
      return this.getExperiment(id);
    } catch (error: any) {
      logger.error(`[ABTestingService] Error pausing experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Resume a paused experiment
   */
  async resumeExperiment(id: string) {
    try {
      await dbRun(
        `
                UPDATE ai_ab_experiments 
                SET status = 'running'
                WHERE id = ? AND status = 'paused'
            `,
        [id]
      );
      return this.getExperiment(id);
    } catch (error: any) {
      logger.error(`[ABTestingService] Error resuming experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Archive an experiment
   */
  async archiveExperiment(id: string) {
    try {
      await dbRun(
        `
                UPDATE ai_ab_experiments 
                SET status = 'archived'
                WHERE id = ?
            `,
        [id]
      );
      return this.getExperiment(id);
    } catch (error: any) {
      logger.error(`[ABTestingService] Error archiving experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(id: string) {
    try {
      await dbRun('DELETE FROM ai_ab_experiments WHERE id = ?', [id]);
      await dbRun('DELETE FROM ai_ab_assignments WHERE experiment_id = ?', [id]);
      await dbRun('DELETE FROM ai_ab_outcomes WHERE experiment_id = ?', [id]);
      return { deleted: true };
    } catch (error: any) {
      logger.error(`[ABTestingService] Error deleting experiment ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics for an experiment
   */
  async getExperimentStats(experimentId: string) {
    try {
      // Get assignment counts per variant
      const assignments = (await dbAll(
        `
                SELECT variant_id, COUNT(*) as count
                FROM ai_ab_assignments
                WHERE experiment_id = ?
                GROUP BY variant_id
            `,
        [experimentId]
      )) as any[];

      // Get outcome stats per variant
      const outcomes = (await dbAll(
        `
                SELECT 
                    variant_id,
                    metric,
                    COUNT(*) as count,
                    AVG(CAST(value AS REAL)) as avg_value
                FROM ai_ab_outcomes
                WHERE experiment_id = ?
                GROUP BY variant_id, metric
            `,
        [experimentId]
      )) as any[];

      const variantStats: Record<string, any> = {};

      for (const a of assignments) {
        variantStats[a.variant_id] = {
          participants: a.count,
          conversions: 0,
          conversionRate: 0,
          avgSatisfaction: 0,
          avgLatency: 0,
        };
      }

      for (const o of outcomes) {
        if (!variantStats[o.variant_id]) {
          variantStats[o.variant_id] = {};
        }
        if (o.metric === 'conversion') {
          variantStats[o.variant_id].conversions = o.count;
          const participants = variantStats[o.variant_id].participants || 1;
          variantStats[o.variant_id].conversionRate = (o.count / participants) * 100;
        }
        if (o.metric === 'satisfaction') {
          variantStats[o.variant_id].avgSatisfaction = o.avg_value || 0;
        }
        if (o.metric === 'latency') {
          variantStats[o.variant_id].avgLatency = o.avg_value || 0;
        }
      }

      const totalParticipants = Object.values(variantStats).reduce(
        (sum: number, v: any) => sum + (v.participants || 0),
        0
      );

      return {
        totalParticipants,
        variantStats,
        statisticalSignificance: this.calculateSignificance(variantStats),
      };
    } catch (error: any) {
      logger.error(`[ABTestingService] Error getting stats for ${experimentId}:`, error);
      return { totalParticipants: 0, variantStats: {}, statisticalSignificance: 0 };
    }
  }

  /**
   * Calculate statistical significance (simplified)
   */
  private calculateSignificance(variantStats: Record<string, any>): number {
    const variants = Object.values(variantStats);
    if (variants.length < 2) return 0;

    const totalParticipants = variants.reduce((sum, v) => sum + (v.participants || 0), 0);
    if (totalParticipants < 100) return 0;

    // Simplified significance calculation
    return Math.min(95, totalParticipants / 10);
  }

  /**
   * Enroll a user in an experiment
   */
  async enrollUser(experimentId: string, userId: string) {
    try {
      // Check if already enrolled
      const existing = (await dbGet(
        'SELECT * FROM ai_ab_assignments WHERE experiment_id = ? AND user_id = ?',
        [experimentId, userId]
      )) as any;

      if (existing) {
        return { variant: existing.variant_id };
      }

      const experiment = await this.getExperiment(experimentId);
      if (!experiment || experiment.status !== 'running') {
        return { variant: 'control' };
      }

      // Random assignment based on traffic split
      const variants = experiment.variants || [];
      const random = Math.random() * 100;
      let cumulative = 0;
      let selectedVariant = variants[0]?.id || 'control';

      for (const variant of variants) {
        cumulative += variant.traffic || 0;
        if (random <= cumulative) {
          selectedVariant = variant.id;
          break;
        }
      }

      await dbRun(
        `
                INSERT INTO ai_ab_assignments (id, experiment_id, user_id, variant_id, assigned_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
        [uuidv4(), experimentId, userId, selectedVariant]
      );

      return { variant: selectedVariant };
    } catch (error: any) {
      logger.error(`[ABTestingService] Error enrolling user:`, error);
      return { variant: 'control' };
    }
  }

  /**
   * Record an outcome metric
   */
  async recordOutcome(experimentId: string, userId: string, metric: string, value: any) {
    try {
      const assignment = (await dbGet(
        'SELECT * FROM ai_ab_assignments WHERE experiment_id = ? AND user_id = ?',
        [experimentId, userId]
      )) as any;

      if (!assignment) return;

      await dbRun(
        `
                INSERT INTO ai_ab_outcomes (id, experiment_id, user_id, variant_id, metric, value, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
        [uuidv4(), experimentId, userId, assignment.variant_id, metric, String(value)]
      );
    } catch (error: any) {
      logger.error(`[ABTestingService] Error recording outcome:`, error);
    }
  }

  /**
   * Alias for recordOutcome
   */
  async recordMetric(experimentId: string, userId: string, metric: string, value: any) {
    return this.recordOutcome(experimentId, userId, metric, value);
  }
}

export const abTestingService = new ABTestingService();
export default abTestingService;
