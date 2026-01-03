/**
 * PMO Validation Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Enforces PMO rules for initiatives and tasks
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AuthRequest } from './auth.middleware';

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

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultDb = require('../../database');
        const defaultStatusMachine = require('../../services/statusMachine');
        deps = {
            db: defaultDb,
            StatusMachine: defaultStatusMachine,
        };
    }
    return deps;
};

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Validate initiative creation (owner required)
 */
export const validateInitiative = (
    req: PMORequest,
    res: Response,
    next: NextFunction
): void => {
    const { ownerId, owner_business_id, ownerBusinessId } = req.body;
    const owner = ownerId || owner_business_id || ownerBusinessId;

    if (!owner) {
        res.status(400).json({
            error: 'Initiative must have an owner',
            rule: 'INITIATIVE_OWNER_REQUIRED'
        });
        return;
    }

    next();
};

/**
 * Validate task creation (initiative required)
 */
export const validateTask = (
    req: PMORequest,
    res: Response,
    next: NextFunction
): void => {
    const { db } = getDeps();
    
    const { initiativeId, initiative_id } = req.body;
    const initId = initiativeId || initiative_id;

    if (!initId) {
        res.status(400).json({
            error: 'Task must belong to an initiative',
            rule: 'TASK_INITIATIVE_REQUIRED'
        });
        return;
    }

    // Verify initiative exists
    db.get(`SELECT id FROM initiatives WHERE id = ?`, [initId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(400).json({
                error: 'Initiative not found',
                rule: 'TASK_INITIATIVE_REQUIRED'
            });
            return;
        }
        next();
    });
};

/**
 * Validate initiative status transition
 */
export const validateInitiativeStatus = (
    req: PMORequest,
    res: Response,
    next: NextFunction
): void => {
    const { db, StatusMachine } = getDeps();
    
    const { status, blockedReason, blocked_reason } = req.body;

    if (!status) {
        next();
        return;
    }

    db.get(`SELECT status, project_id FROM initiatives WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }

        const initiativeRow = row as InitiativeRow;
        const validation = StatusMachine.validateInitiativeTransition(initiativeRow.status, status, {
            blockedReason: blockedReason || blocked_reason
        });

        if (!validation.valid) {
            res.status(400).json({
                error: validation.reason,
                rule: 'INVALID_STATUS_TRANSITION',
                currentStatus: initiativeRow.status,
                requestedStatus: status
            });
            return;
        }

        // Store current status for audit
        req.previousStatus = initiativeRow.status;
        req.projectId = initiativeRow.project_id;
        next();
    });
};

/**
 * Validate task status transition
 */
export const validateTaskStatus = (
    req: PMORequest,
    res: Response,
    next: NextFunction
): void => {
    const { db, StatusMachine } = getDeps();
    
    const { status, blockedReason, blocked_reason, blockerType, blocker_type } = req.body;

    if (!status) {
        next();
        return;
    }

    db.get(`SELECT status, initiative_id FROM tasks WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }

        const taskRow = row as TaskRow;
        const validation = StatusMachine.validateTaskTransition(taskRow.status, status, {
            blockedReason: blockedReason || blocked_reason,
            blockerType: blockerType || blocker_type
        });

        if (!validation.valid) {
            res.status(400).json({
                error: validation.reason,
                rule: 'INVALID_STATUS_TRANSITION',
                currentStatus: taskRow.status,
                requestedStatus: status
            });
            return;
        }

        req.previousStatus = taskRow.status;
        req.initiativeId = taskRow.initiative_id;
        next();
    });
};

/**
 * Log status transition to audit log
 */
export const logStatusChange = (entityType: string) => {
    return (req: PMORequest, res: Response, next: NextFunction): void => {
        const { db } = getDeps();
        
        const originalSend = res.json.bind(res);

        res.json = (data: unknown) => {
            // Only log if successful and status changed
            if (res.statusCode < 400 && req.previousStatus && req.body.status) {
                const logSql = `INSERT INTO activity_logs 
                    (id, organization_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
                    VALUES (?, ?, ?, 'status_changed', ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

                db.run(logSql, [
                    uuidv4(),
                    req.organizationId || 'unknown',
                    req.userId,
                    entityType,
                    req.params.id,
                    JSON.stringify({ status: req.previousStatus }),
                    JSON.stringify({ status: req.body.status })
                ], () => { });
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
    deps = { ...getDeps(), ...newDeps };
};

