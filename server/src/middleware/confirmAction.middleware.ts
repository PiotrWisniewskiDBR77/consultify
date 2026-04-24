import { type NextFunction, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function requireConfirmation(actionType: string, riskLevel: RiskLevel = 'high') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { confirmation, reason } = req.body || {};

    if (!confirmation) {
      res.status(428).json({
        error: 'Action requires explicit confirmation',
        code: 'CONFIRMATION_REQUIRED',
        actionType,
        riskLevel,
      });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      res.status(422).json({
        error: 'A reason must be provided for this action (minimum 3 characters)',
        code: 'REASON_REQUIRED',
        actionType,
      });
      return;
    }

    const adminId = req.userId || req.user?.id || 'unknown';
    const targetType = req.params.targetType || req.params.id ? 'resource' : undefined;
    const targetId = req.params.id || req.params.targetId || undefined;

    try {
      await dbRun(
        `INSERT INTO superadmin_confirmed_actions
           (id, admin_id, action_type, target_type, target_id, reason, risk_level, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          adminId,
          actionType,
          targetType || null,
          targetId || null,
          reason.trim(),
          riskLevel,
          req.ip || null,
          req.headers['user-agent']?.substring(0, 255) || null,
          JSON.stringify({ method: req.method, path: req.originalUrl }),
        ]
      );
    } catch (err) {
      logger.error('[ConfirmAction] FAIL-CLOSED: Audit write failed, blocking action', {
        err,
        actionType,
        adminId,
      });
      res.status(503).json({
        error:
          'Audit system unavailable — gated action blocked. No sensitive action may proceed without audit.',
        code: 'AUDIT_UNAVAILABLE',
        actionType,
        guidance: 'Retry the action. If the problem persists, contact platform support.',
      });
      return;
    }

    next();
  };
}
