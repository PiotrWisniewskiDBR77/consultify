import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth.middleware.js';
import logger from '../../utils/Logger.js';

const explainabilityUnavailable = (res: Response, message = 'Explainability service unavailable') =>
  res.status(503).json({ error: message, code: 'FEATURE_UNAVAILABLE' });

export class AIExplainabilityController {
  /**
   * GET /api/ai/explain/evidences
   */
  static async listEvidences(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toLowerCase();
      const isSuperAdmin =
        req.user?.isSuperAdmin ||
        role === 'owner' ||
        role === 'superadmin' ||
        role === 'administrator' ||
        role === 'admin';

      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      return explainabilityUnavailable(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/explain/:entityType/:entityId
   */
  static async getExplanation(req: AuthRequest, res: Response) {
    try {
      const { entityType, entityId } = req.params;

      const validTypes = [
        'suggestion',
        'action',
        'project',
        'decision',
        'execution',
        'proposal',
        'playbook_run',
        'run_step',
      ];
      if (!validTypes.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      return explainabilityUnavailable(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/explain/:entityType/:entityId/evidence
   */
  static async getEvidence(req: AuthRequest, res: Response) {
    try {
      return explainabilityUnavailable(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * POST /api/ai/explain/:entityType/:entityId/validate
   */
  static async validateExplanation(req: AuthRequest, res: Response) {
    try {
      return explainabilityUnavailable(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/explain/validation/:validationId
   */
  static async getValidationResult(req: AuthRequest, res: Response) {
    try {
      return explainabilityUnavailable(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/ai/explain/export/:entityType/:entityId
   */
  static async exportEvidencePack(req: AuthRequest, res: Response) {
    try {
      return explainabilityUnavailable(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
