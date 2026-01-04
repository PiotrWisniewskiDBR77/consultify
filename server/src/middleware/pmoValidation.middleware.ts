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
import * as DbPromise from '../utils/DbPromise.ts';
import logger from '../utils/Logger.ts';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    run: (sql: string, params: unknown[], callback?: (err: Error | null) => void) => void;
}

interface StatusMachine {
    validateInitiativeTransition: (
        currentStatus: string,
        newStatus: string,
        options?: { blockedReason?: string },
    ) => { valid: boolean; reason?: string };
    validateTaskTransition: (
        currentStatus: string,
        newStatus: string,
        options?: { blockedReason?: string; blockerType?: string },
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
    const { ownerId, owner_business_id, ownerBusinessId } = req.body;
    const owner = ownerId || owner_business_id || ownerBusinessId;

    if (!owner) {
        res.status(400).json({
            error: 'Initiative must have an owner',
            rule: 'INITIATIVE_OWNER_REQUIRED',
        });
        return;
    }

    next();
};

/**
 * Validate task creation (initiative required)
 */
export const validateTask = async (req: PMORequest, res: Response, next: NextFunction): Promise<void> => {
    const { initiativeId, initiative_id } = req.body;
    const initId = initiativeId || initiative_id;

    if (!initId) {
        res.status(400).json({
            error: 'Task must belong to an initiative',
            rule: 'TASK_INITIATIVE_REQUIRED',
        });
        return;
    }

    // Verify initiative exists
    try {
        const row = await DbPromise.get<{ id: string }>(`SELECT id FROM initiatives WHERE id = ?`, [initId]);
        if (!row) {
            res.status(400).json({
                error: 'Initiative not found',
                rule: 'TASK_INITIATIVE_REQUIRED',
            });
            return;
        }
        next();
    } catch (err: unknown) {
        const error = err as Error;
        res.status(500).json({ error: error.message });
    }
};

/**
 * Validate initiative status transition
 */
export const validateInitiativeStatus = async (req: PMORequest, res: Response, next: NextFunction): Promise<void> => {
    const { StatusMachine } = deps;

    const { status, blockedReason, blocked_reason } = req.body;

    if (!status) {
        next();
        return;
    }

    try {
        const row = await DbPromise.get<InitiativeRow>(`SELECT status, project_id FROM initiatives WHERE id = ?`, [
            req.params.id,
        ]);
        if (!row) {
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }

        const validation = StatusMachine.validateInitiativeTransition(row.status, status, {
            blockedReason: blockedReason || blocked_reason,
        });

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
    } catch (err: unknown) {
        const error = err as Error;
        res.status(500).json({ error: error.message });
    }
};

/**
 * Validate task status transition
 */
export const validateTaskStatus = async (req: PMORequest, res: Response, next: NextFunction): Promise<void> => {
    const { StatusMachine } = deps;

    const { status, blockedReason, blocked_reason, blockerType, blocker_type } = req.body;

    if (!status) {
        next();
        return;
    }

    try {
        const row = await DbPromise.get<TaskRow>(`SELECT status, initiative_id FROM tasks WHERE id = ?`, [
            req.params.id,
        ]);
        if (!row) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const validation = StatusMachine.validateTaskTransition(row.status, status, {
            blockedReason: blockedReason || blocked_reason,
            blockerType: blockerType || blocker_type,
        });

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
    } catch (err: unknown) {
        const error = err as Error;
        res.status(500).json({ error: error.message });
    }
};

/**
 * Log status transition to audit log
 */
export const logStatusChange = (entityType: string) => {
    return (req: PMORequest, res: Response, next: NextFunction): void => {
        const originalSend = res.json.bind(res);

        (res.json as any) = async (data: unknown) => {
            // Only log if successful and status changed
            if (res.statusCode < 400 && req.previousStatus && req.body.status) {
                const logSql = `INSERT INTO activity_logs 
                    (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
                    VALUES (?, ?, ?, 'status_changed', ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

                try {
                    await DbPromise.run(logSql, [
                        uuidv4(),
                        req.organizationId || 'unknown',
                        req.userId,
                        entityType,
                        req.params.id,
                        JSON.stringify({ status: req.previousStatus }),
                        JSON.stringify({ status: req.body.status }),
                    ]);
                } catch (err: unknown) {
                    // Log error but don't fail the request
                    logger.error('[PMO Validation] Failed to log status change:', err);
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
