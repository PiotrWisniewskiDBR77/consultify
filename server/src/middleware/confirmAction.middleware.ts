import { type NextFunction, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
const MAX_ACTION_TYPE_LENGTH = 128;
const MAX_REASON_LENGTH = 4000;
const MAX_METADATA_METHOD_LENGTH = 16;
const MAX_METADATA_PATH_LENGTH = 2048;
const INVISIBLE_REASON_CHARS = /[\u200B-\u200D\uFEFF]/g;
const RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'];

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const normalizeOptionalHeaderValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return normalizeOptionalString(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeOptionalString(entry);
      if (normalized) return normalized;
    }
  }
  return undefined;
};
const normalizeReasonForGatekeeping = (value: string): string =>
  value.replace(INVISIBLE_REASON_CHARS, '').trim();
const respondJson = (
  res: Response,
  statusCode: number,
  payload: Record<string, unknown>
): boolean => {
  if (safeRead(() => res.headersSent, false)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch {
    return false;
  }
};

const isExplicitConfirmation = (value: unknown): boolean => {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
};

export function requireConfirmation(actionType: string, riskLevel: RiskLevel = 'high') {
  const normalizedActionType = normalizeOptionalString(actionType);
  if (!normalizedActionType || normalizedActionType.length > MAX_ACTION_TYPE_LENGTH) {
    throw new Error(
      `[ConfirmAction] actionType must be a non-empty string up to ${MAX_ACTION_TYPE_LENGTH} chars`
    );
  }
  if (!RISK_LEVELS.includes(riskLevel)) {
    throw new Error(`[ConfirmAction] riskLevel must be one of: ${RISK_LEVELS.join(', ')}`);
  }

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (safeRead(() => res.headersSent, false)) {
      return;
    }
    const rawBody = safeRead(() => req.body, {} as Record<string, unknown>);
    const body =
      rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
        ? (rawBody as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const rawConfirmation = Object.hasOwn(body, 'confirmation') ? body.confirmation : undefined;
    const rawReason = Object.hasOwn(body, 'reason') ? body.reason : undefined;
    if (
      rawConfirmation !== undefined &&
      rawConfirmation !== null &&
      typeof rawConfirmation !== 'boolean' &&
      typeof rawConfirmation !== 'string'
    ) {
      respondJson(res, 428, {
        error: 'Confirmation must be a boolean or the string "true"',
        code: 'CONFIRMATION_INVALID_TYPE',
        actionType: normalizedActionType,
        riskLevel,
      });
      return;
    }
    const confirmation = isExplicitConfirmation(rawConfirmation);
    if (rawReason !== undefined && typeof rawReason !== 'string') {
      respondJson(res, 422, {
        error: 'Reason must be a string',
        code: 'REASON_INVALID_TYPE',
        actionType: normalizedActionType,
      });
      return;
    }
    const reason = normalizeReasonForGatekeeping(normalizeOptionalString(rawReason) || '');

    if (!confirmation) {
      respondJson(res, 428, {
        error: 'Action requires explicit confirmation',
        code: 'CONFIRMATION_REQUIRED',
        actionType: normalizedActionType,
        riskLevel,
      });
      return;
    }

    if (reason.length < 3) {
      respondJson(res, 422, {
        error: 'A reason must be provided for this action (minimum 3 characters)',
        code: 'REASON_REQUIRED',
        actionType: normalizedActionType,
      });
      return;
    }

    if (reason.length > MAX_REASON_LENGTH) {
      respondJson(res, 422, {
        error: `A reason must be at most ${MAX_REASON_LENGTH} characters`,
        code: 'REASON_TOO_LONG',
        actionType: normalizedActionType,
      });
      return;
    }

    const adminId =
      normalizeOptionalString(safeRead(() => req.userId, undefined)) ||
      normalizeOptionalString(safeRead(() => req.user?.id, undefined));
    if (!adminId) {
      respondJson(res, 401, {
        error: 'Authenticated admin identity is required for confirmed actions',
        code: 'ADMIN_IDENTITY_REQUIRED',
        actionType: normalizedActionType,
      });
      return;
    }
    const targetType =
      normalizeOptionalString(safeRead(() => req.params?.targetType, undefined)) ||
      normalizeOptionalString(safeRead(() => req.params?.id, undefined))
        ? 'resource'
        : undefined;
    const targetId =
      normalizeOptionalString(safeRead(() => req.params?.id, undefined)) ||
      normalizeOptionalString(safeRead(() => req.params?.targetId, undefined)) ||
      undefined;
    const metadataJson = safeRead(
      () =>
        JSON.stringify({
          method: (
            normalizeOptionalString(safeRead(() => req.method, undefined)) || 'UNKNOWN'
          ).slice(0, MAX_METADATA_METHOD_LENGTH),
          path: (
            normalizeOptionalString(safeRead(() => req.originalUrl, undefined)) ||
            normalizeOptionalString(safeRead(() => req.path, undefined)) ||
            ''
          ).slice(0, MAX_METADATA_PATH_LENGTH),
        }),
      '{"method":"UNKNOWN","path":""}'
    );

    try {
      await dbRun(
        `INSERT INTO superadmin_confirmed_actions
           (id, admin_id, action_type, target_type, target_id, reason, risk_level, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          adminId,
          normalizedActionType,
          targetType || null,
          targetId || null,
          reason,
          riskLevel,
          normalizeOptionalString(safeRead(() => req.ip, undefined)) || null,
          normalizeOptionalHeaderValue(safeRead(() => req.headers?.['user-agent'], undefined))
            ?.substring(0, 255) || null,
          metadataJson,
        ]
      );
    } catch (err) {
      logger.error('[ConfirmAction] FAIL-CLOSED: Audit write failed, blocking action', {
        err,
        actionType: normalizedActionType,
        adminId,
      });
      respondJson(res, 503, {
        error:
          'Audit system unavailable — gated action blocked. No sensitive action may proceed without audit.',
        code: 'AUDIT_UNAVAILABLE',
        actionType: normalizedActionType,
        guidance: 'Retry the action. If the problem persists, contact platform support.',
      });
      return;
    }

    if (safeRead(() => res.headersSent, false)) {
      return;
    }
    next();
  };
}
