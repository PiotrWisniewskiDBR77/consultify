// @ts-nocheck
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { all, get, run } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export class AIExperimentsController {
  /**
   * List experiments
   */
  static async getExperiments(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM ai_experiments WHERE organization_id = ?';
      const params: any[] = [req.organizationId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      const experiments = await all(query, params);

      // Fetch variants for each experiment
      const experimentsWithVariants = await Promise.all(
        experiments.map(async (exp: any) => {
          const variants = await all(
            'SELECT * FROM ai_experiment_variants WHERE experiment_id = ?',
            [exp.id]
          );
          return {
            ...exp,
            variants: variants.map((v: any) => ({
              ...v,
              config: JSON.parse(v.config || '{}'),
            })),
          };
        })
      );

      return res.json({ experiments: experimentsWithVariants });
    } catch (err: any) {
      logger.error('[AIExperimentsController] getExperiments error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Create experiment
   */
  static async createExperiment(req: AuthRequest, res: Response) {
    try {
      const { name, description, type, variants, targetCapability } = req.body;

      if (!variants || !Array.isArray(variants) || variants.length < 2) {
        return res.status(400).json({ error: 'At least 2 variants are required' });
      }

      const totalWeight = variants.reduce((sum: number, v: any) => sum + (v.weight || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        return res.status(400).json({ error: 'Variant weights must sum to 100' });
      }

      const experimentId = uuidv4();
      await run(
        `INSERT INTO ai_experiments (id, organization_id, name, description, type, target_capability, status, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          experimentId,
          req.organizationId,
          name,
          description,
          type || 'prompt_variation',
          targetCapability,
          'draft',
          req.userId,
        ]
      );

      for (const variant of variants) {
        await run(
          `INSERT INTO ai_experiment_variants (id, experiment_id, name, weight, config)
                     VALUES (?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            experimentId,
            variant.name,
            variant.weight,
            JSON.stringify(variant.config || {}),
          ]
        );
      }

      return res.status(201).json({
        id: experimentId,
        name,
        status: 'draft',
      });
    } catch (err: any) {
      logger.error('[AIExperimentsController] createExperiment error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get experiment by ID
   */
  static async getExperimentById(req: AuthRequest, res: Response) {
    try {
      const experiment = await get(
        'SELECT * FROM ai_experiments WHERE id = ? AND organization_id = ?',
        [req.params.id, req.organizationId]
      );

      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      const variants = await all('SELECT * FROM ai_experiment_variants WHERE experiment_id = ?', [
        experiment.id,
      ]);

      return res.json({
        ...experiment,
        variants: variants.map((v: any) => ({
          ...v,
          config: JSON.parse(v.config || '{}'),
        })),
      });
    } catch (err: any) {
      logger.error('[AIExperimentsController] getExperimentById error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Update experiment status
   */
  static async updateStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.body;
      const result = await run(
        'UPDATE ai_experiments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?',
        [status, req.params.id, req.organizationId]
      );

      if ((result as any).changes === 0) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      return res.json({ id: req.params.id, status });
    } catch (err: any) {
      logger.error('[AIExperimentsController] updateStatus error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get experiment results
   */
  static async getResults(req: AuthRequest, res: Response) {
    try {
      const experiment = await get(
        'SELECT * FROM ai_experiments WHERE id = ? AND organization_id = ?',
        [req.params.id, req.organizationId]
      );

      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      // Mock results for now
      return res.json({
        experimentId: experiment.id,
        variants: [
          { name: 'Control', conversions: 45, impressions: 500, rate: 0.09 },
          { name: 'Variant A', conversions: 55, impressions: 500, rate: 0.11 },
        ],
        statisticalSignificance: 0.85,
        winner: null,
      });
    } catch (err: any) {
      logger.error('[AIExperimentsController] getResults error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Delete experiment
   */
  static async deleteExperiment(req: AuthRequest, res: Response) {
    try {
      const experiment = await get(
        'SELECT * FROM ai_experiments WHERE id = ? AND organization_id = ?',
        [req.params.id, req.organizationId]
      );

      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      if (experiment.status === 'active') {
        return res.status(400).json({ error: 'Cannot delete active experiments' });
      }

      await run('DELETE FROM ai_experiments WHERE id = ?', [req.params.id]);
      return res.status(204).send();
    } catch (err: any) {
      logger.error('[AIExperimentsController] deleteExperiment error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
