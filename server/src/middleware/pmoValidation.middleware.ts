/**
 * PMO Validation Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Enforces PMO rules for initiatives and tasks
 */

import { NextFunction, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import StatusMachine from '../services/statusMachine.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Database {
  get: (
    sql: string,
    params: unknown[],
    callback: (err: Error | null, row: unknown) => void
  ) => void;
  run: (sql: string, params: unknown[], callback?: (err: Error | null) => void) => void;
}

interface StatusMachine {
  validateInitiativeTransition: (
    currentStatus: string,
    newStatus: string,
    options?: { blockedReason?: string }
  ) => { valid: boolean; reason?: string };
  validateTaskTransition: (
    currentStatus: string,
    newStatus: string,
    options?: { blockedReason?: string; blockerType?: string }
  ) => { valid: boolean; reason?: string };
}

interface InitiativeRow {
  id: string;
  status: string;
  project_id?: string;
}

interface TaskRow {
  id: string;
  status: string;
  initiative_id?: string;
}

interface PMORequest extends AuthRequest {
  previousStatus?: string;
  projectId?: string;
  initiativeId?: string;
  body: {
    status?: string;
    blockedReason?: string;
    blocked_reason?: string;
    blockerType?: string;
    blocker_type?: string;
    ownerId?: string;
    owner_business_id?: string;
    ownerBusinessId?: string;
    initiativeId?: string;
    initiative_id?: string;
  };
}

interface Dependencies {
  db: Database;
  StatusMachine: StatusMachine;
}

const MAX_PMO_TEXT_FIELD_CHARS = 8192;
const MAX_PMO_STATUS_CHARS = 128;
const MAX_PMO_ENTITY_ID_CHARS = 128;

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
const clampOptionalString = (value: string | undefined, maxChars: number): string | undefined => {
  if (!value) return undefined;
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
};

const readEntityId = (req: PMORequest): string | undefined =>
  normalizeOptionalString(safeRead(() => req.params?.id, undefined));

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies = {
  db: getDatabase() as unknown as Database,
  StatusMachine: StatusMachine as unknown as StatusMachine,
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Validate initiative creation (owner required)
 */
export const validateInitiative = (req: PMORequest, res: Response, next: NextFunction): void => {
  const body = safeRead(() => req.body, {} as PMORequest['body']);
  const { ownerId, owner_business_id, ownerBusinessId } = body;
  const owner =
    normalizeOptionalString(ownerId) ||
    normalizeOptionalString(owner_business_id) ||
    normalizeOptionalString(ownerBusinessId);

  if (!owner) {
    res.status(400).json({
      error: 'Initiative must have an owner',
      rule: 'INITIATIVE_OWNER_REQUIRED',
    });
    return;
  }
  if (owner.length > MAX_PMO_ENTITY_ID_CHARS) {
    res.status(400).json({
      error: 'Owner identifier is too long',
      rule: 'OWNER_VALUE_TOO_LONG',
    });
    return;
  }

  next();
};

/**
 * Validate task creation (initiative required)
 */
export const validateTask = async (
  req: PMORequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const body = safeRead(() => req.body, {} as PMORequest['body']);
  const { initiativeId, initiative_id } = body;
  const initId = normalizeOptionalString(initiativeId) || normalizeOptionalString(initiative_id);

  if (!initId) {
    res.status(400).json({
      error: 'Task must belong to an initiative',
      rule: 'TASK_INITIATIVE_REQUIRED',
    });
    return;
  }
  if (initId.length > MAX_PMO_ENTITY_ID_CHARS) {
    res.status(400).json({
      error: 'Invalid initiative id',
      rule: 'INVALID_ENTITY_ID',
    });
    return;
  }

  // Verify initiative exists
  try {
    const row = await DbPromise.get<{ id: string }>(`SELECT id FROM initiatives WHERE id = ?`, [
      initId,
    ]);
    if (!row) {
      res.status(400).json({
        error: 'Initiative not found',
        rule: 'TASK_INITIATIVE_REQUIRED',
      });
      return;
    }
    next();
  } catch (err: any) {
    logger.error('[PMO Validation] validateTask failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Validate initiative status transition
 */
export const validateInitiativeStatus = async (
  req: PMORequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { StatusMachine } = deps;

  const body = safeRead(() => req.body, {} as PMORequest['body']);
  const { blockedReason, blocked_reason } = body;
  const blockedReasonValue = clampOptionalString(
    normalizeOptionalString(blockedReason) || normalizeOptionalString(blocked_reason),
    MAX_PMO_TEXT_FIELD_CHARS
  );
  const status = normalizeOptionalString(body.status);
  if (status && status.length > MAX_PMO_STATUS_CHARS) {
    res.status(400).json({
      error: 'Status value is too long',
      rule: 'STATUS_VALUE_TOO_LONG',
    });
    return;
  }

  if (!status) {
    next();
    return;
  }

  const initiativeId = readEntityId(req);
  if (!initiativeId) {
    res.status(400).json({ error: 'Initiative id is required' });
    return;
  }
  if (initiativeId.length > MAX_PMO_ENTITY_ID_CHARS) {
    res.status(400).json({ error: 'Invalid initiative id', rule: 'INVALID_ENTITY_ID' });
    return;
  }

  try {
    const row = await DbPromise.get<InitiativeRow>(
      `SELECT status, project_id FROM initiatives WHERE id = ?`,
      [initiativeId]
    );
    if (!row) {
      res.status(404).json({ error: 'Initiative not found' });
      return;
    }

    let validation: { valid: boolean; reason?: string };
    try {
      validation = StatusMachine.validateInitiativeTransition(row.status, status, {
        blockedReason: blockedReasonValue,
      });
    } catch (validationError: any) {
      logger.error('[PMO Validation] validateInitiativeStatus: StatusMachine threw', validationError);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (!validation.valid) {
      res.status(400).json({
        error: validation.reason,
        rule: 'INVALID_STATUS_TRANSITION',
        currentStatus: row.status,
        requestedStatus: status,
      });
      return;
    }

    // Store current status for audit
    req.previousStatus = row.status;
    req.projectId = row.project_id;
    next();
  } catch (err: any) {
    logger.error('[PMO Validation] validateInitiativeStatus failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Validate task status transition
 */
export const validateTaskStatus = async (
  req: PMORequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { StatusMachine } = deps;

  const body = safeRead(() => req.body, {} as PMORequest['body']);
  const { blockedReason, blocked_reason, blockerType, blocker_type } = body;
  const blockedReasonValue = clampOptionalString(
    normalizeOptionalString(blockedReason) || normalizeOptionalString(blocked_reason),
    MAX_PMO_TEXT_FIELD_CHARS
  );
  const blockerTypeValue = clampOptionalString(
    normalizeOptionalString(blockerType) || normalizeOptionalString(blocker_type),
    MAX_PMO_TEXT_FIELD_CHARS
  );
  const status = normalizeOptionalString(body.status);
  if (status && status.length > MAX_PMO_STATUS_CHARS) {
    res.status(400).json({
      error: 'Status value is too long',
      rule: 'STATUS_VALUE_TOO_LONG',
    });
    return;
  }

  if (!status) {
    next();
    return;
  }

  const taskId = readEntityId(req);
  if (!taskId) {
    res.status(400).json({ error: 'Task id is required' });
    return;
  }
  if (taskId.length > MAX_PMO_ENTITY_ID_CHARS) {
    res.status(400).json({ error: 'Invalid task id', rule: 'INVALID_ENTITY_ID' });
    return;
  }

  try {
    const row = await DbPromise.get<TaskRow>(
      `SELECT status, initiative_id FROM tasks WHERE id = ?`,
      [taskId]
    );
    if (!row) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    let validation: { valid: boolean; reason?: string };
    try {
      validation = StatusMachine.validateTaskTransition(row.status, status, {
        blockedReason: blockedReasonValue,
        blockerType: blockerTypeValue,
      });
    } catch (validationError: any) {
      logger.error('[PMO Validation] validateTaskStatus: StatusMachine threw', validationError);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (!validation.valid) {
      res.status(400).json({
        error: validation.reason,
        rule: 'INVALID_STATUS_TRANSITION',
        currentStatus: row.status,
        requestedStatus: status,
      });
      return;
    }

    req.previousStatus = row.status;
    req.initiativeId = row.initiative_id;
    next();
  } catch (err: any) {
    logger.error('[PMO Validation] validateTaskStatus failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Log status transition to audit log
 */
export const logStatusChange = (entityType: string) => {
  return (req: PMORequest, res: Response, next: NextFunction): void => {
    const originalSend = safeRead(() => res.json.bind(res), null as unknown as Response['json']);
    if (!originalSend) {
      next();
      return;
    }

    (res.json as any) = async (data: unknown) => {
      const body = safeRead(() => req.body, {} as PMORequest['body']);
      const nextStatus = normalizeOptionalString(body.status);
      const organizationId = normalizeOptionalString(safeRead(() => req.organizationId, undefined));
      const entityId = normalizeOptionalString(safeRead(() => req.params?.id, undefined));
      const userId = normalizeOptionalString(safeRead(() => req.userId, undefined));
      const responseStatus = safeRead(() => res.statusCode, 500);

      // Only log if successful and status changed, and we have a valid org context
      if (responseStatus < 400 && req.previousStatus && nextStatus && organizationId && entityId) {
        const logSql = `INSERT INTO activity_logs 
                    (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
                    VALUES (?, ?, ?, 'status_changed', ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

        try {
          await DbPromise.run(logSql, [
            uuidv4(),
            organizationId,
            userId,
            entityType,
            entityId,
            JSON.stringify({ status: req.previousStatus }),
            JSON.stringify({ status: nextStatus }),
          ]);
        } catch (err: any) {
          // Log error but don't fail the request
          const errorMessage = err instanceof Error ? err.message : String(err);
          const errorStack = err instanceof Error ? err.stack : undefined;
          try {
            logger.error('[PMO Validation] Failed to log status change:', {
              error: errorMessage,
              stack: errorStack,
              sql: logSql,
              organizationId: organizationId || 'unknown',
              userId: userId || null,
              entityType,
              entityId: entityId || '',
            });
          } catch (logErr) {
            // Fallback if logging itself fails (e.g., circular reference)
            logger.error('[PMO Validation] Failed to log status change:', errorMessage);
          }
        }
      }

      return originalSend(data);
    };

    next();
  };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
