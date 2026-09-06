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
const MAX_ID_LENGTH = 128;
const MAX_STATUS_LENGTH = 128;
const MAX_BLOCKED_REASON_LENGTH = 8192;

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const safeNext = (next: NextFunction): void => {
  if (typeof next === 'function') {
    next();
  }
};

const safeBody = (req: PMORequest): PMORequest['body'] => {
  const body = safeRead(() => req.body, undefined as unknown);
  if (!body || typeof body !== 'object') {
    return {} as PMORequest['body'];
  }
  return body as PMORequest['body'];
};

const safeParamsId = (req: PMORequest): string | null => {
  try {
    const value = req.params?.id;
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
  } catch {
    return null;
  }
};

const readRawParamsId = (req: PMORequest): unknown => {
  try {
    return req.params?.id;
  } catch {
    return undefined;
  }
};

const normalizeShortString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeEntityId = (value: unknown): string => {
  const normalized = normalizeShortString(value);
  if (!normalized || normalized.length > MAX_ID_LENGTH) return '';
  return normalized;
};

const normalizeStatusValue = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return '__INVALID_STATUS_TYPE__';
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_STATUS_LENGTH) return '__STATUS_TOO_LONG__';
  return normalized;
};

const normalizeBlockedReason = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const normalized = normalizeShortString(value);
    if (normalized) return normalized.slice(0, MAX_BLOCKED_REASON_LENGTH);
  }
  return undefined;
};

const normalizeCurrentStatus = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized;
};

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
  const body = safeBody(req);
  const owner = normalizeEntityId(body.ownerId || body.owner_business_id || body.ownerBusinessId);

  if (!owner) {
    const ownerRaw = body.ownerId || body.owner_business_id || body.ownerBusinessId;
    const tooLong = typeof ownerRaw === 'string' && ownerRaw.trim().length > MAX_ID_LENGTH;
    res.status(400).json({
      error: 'Initiative must have an owner',
      rule: tooLong ? 'OWNER_VALUE_TOO_LONG' : 'INITIATIVE_OWNER_REQUIRED',
    });
    return;
  }

  safeNext(next);
};

/**
 * Validate task creation (initiative required)
 */
export const validateTask = async (
  req: PMORequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const body = safeBody(req);
  const rawId = body.initiativeId || body.initiative_id;
  const initId = normalizeEntityId(rawId);

  if (!initId) {
    res.status(400).json({
      error: 'Task must belong to an initiative',
      rule:
        typeof rawId === 'string' && rawId.trim().length > MAX_ID_LENGTH
          ? 'INVALID_ENTITY_ID'
          : 'TASK_INITIATIVE_REQUIRED',
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
    safeNext(next);
  } catch {
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

  const body = safeBody(req);
  const status = normalizeStatusValue(body.status);
  const blockedReason = normalizeBlockedReason(body.blockedReason, body.blocked_reason);
  const blockerType = normalizeShortString(body.blockerType || body.blocker_type) || undefined;
  const taskId = safeParamsId(req);
  const rawTaskId = readRawParamsId(req);

  if (status === null) {
    safeNext(next);
    return;
  }
  if (status === '__INVALID_STATUS_TYPE__') {
    res.status(400).json({ error: 'Status must be a string', rule: 'INVALID_STATUS_TYPE' });
    return;
  }
  if (status === '__STATUS_TOO_LONG__') {
    res.status(400).json({ error: 'Status value too long', rule: 'STATUS_VALUE_TOO_LONG' });
    return;
  }
  if (!taskId) {
    res.status(400).json({ error: 'Invalid task id', rule: 'INVALID_ENTITY_ID' });
    return;
  }
  if (typeof rawTaskId === 'string' && rawTaskId.trim().length > MAX_ID_LENGTH) {
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
    const currentStatus = normalizeCurrentStatus(row.status);
    if (!currentStatus) {
      res.status(500).json({ error: 'Invalid current task status' });
      return;
    }

    const validation = StatusMachine.validateTaskTransition(currentStatus, status, {
      blockedReason,
      blockerType,
    });

    if (!validation || validation.valid !== true) {
      res.status(400).json({
        error:
          typeof validation?.reason === 'string' ? validation.reason : 'Invalid status transition',
        rule: 'INVALID_STATUS_TRANSITION',
        currentStatus,
        requestedStatus: status,
      });
      return;
    }

    req.previousStatus = currentStatus;
    req.initiativeId = row.initiative_id;
    safeNext(next);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Log status transition to audit log
 */
export const logStatusChange = (entityType: string) => {
  return (req: PMORequest, res: Response, next: NextFunction): void => {
    let originalSend: ((data: unknown) => unknown) | null = null;
    try {
      if (typeof (res as any).json !== 'function') {
        safeNext(next);
        return;
      }
      originalSend = (res as any).json.bind(res);
    } catch {
      safeNext(next);
      return;
    }

    (res.json as any) = async (data: unknown) => {
      // Only log if successful and status changed, and we have a valid org context
      const statusCode = safeRead(() => Number(res.statusCode), Number.NaN);
      const previousStatus = safeRead(() => req.previousStatus || '', '');
      const body = safeBody(req);
      const nextStatus = normalizeStatusValue(body.status);
      const organizationId = normalizeEntityId(safeRead(() => req.organizationId, undefined));
      const userId = normalizeEntityId(safeRead(() => req.userId, undefined));
      const entityId = normalizeEntityId(safeRead(() => req.params?.id, undefined));

      if (
        Number.isFinite(statusCode) &&
        statusCode < 400 &&
        previousStatus &&
        typeof nextStatus === 'string' &&
        nextStatus &&
        organizationId &&
        userId &&
        entityId
      ) {
        const logSql = `INSERT INTO activity_logs 
                    (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
                    VALUES (?, ?, ?, 'status_changed', ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

        try {
          const oldValue = JSON.stringify({ status: previousStatus });
          const newValue = JSON.stringify({ status: nextStatus });
          await DbPromise.run(logSql, [
            uuidv4(),
            organizationId,
            userId,
            entityType,
            entityId,
            oldValue,
            newValue,
          ]);
        } catch (err: unknown) {
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
              entityId,
            });
          } catch (logErr) {
            // Fallback if logging itself fails (e.g., circular reference)
            logger.error('[PMO Validation] Failed to log status change:', errorMessage);
          }
        }
      }

      return originalSend!(data);
    };

    safeNext(next);
  };
};

// ==========================================
// DEPENDENCY INJECTION (for testing)
// ==========================================

export const setDependencies = (newDeps: Partial<Dependencies>): void => {
  deps = { ...deps, ...newDeps };
};
