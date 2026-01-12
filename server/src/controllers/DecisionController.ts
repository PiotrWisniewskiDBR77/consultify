/**
 * Decision Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all decision-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type {
    CreateDecisionRequest,
    DecideRequest,
    EscalateDecisionRequest,
} from '../validators/decision.validators.js';

// ==========================================
// TYPES
// ==========================================

interface AuditTrailEntry {
    action: string;
    by: string;
    at: string;
    notes?: string;
}

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class DecisionController {
    /**
     * Get all decisions
     */
    static getDecisions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId, status, relatedObjectId } = req.query;

        let sql = `SELECT d.*, u.first_name, u.last_name 
                   FROM decisions d
                   LEFT JOIN users u ON d.decision_owner_id = u.id
                   WHERE 1=1`;
        type SQLParam = string | number | boolean | null | undefined;
        const params: SQLParam[] = [];

        if (projectId) {
            sql += ` AND d.project_id = ?`;
            params.push(Array.isArray(projectId) ? projectId[0] : projectId);
        }
        if (status) {
            sql += ` AND d.status = ?`;
            params.push(Array.isArray(status) ? status[0] : status);
        }
        if (relatedObjectId) {
            sql += ` AND d.related_object_id = ?`;
            params.push(Array.isArray(relatedObjectId) ? relatedObjectId[0] : relatedObjectId);
        }

        sql += ` ORDER BY d.created_at DESC`;

        const decisions = await queryHelpers.queryAll(sql, params);
        res.json(decisions);
    });

    /**
     * Get decision bottlenecks
     */
    static getBottlenecks = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId } = req.query;

        // Aging decisions
        const agingSql = `
            SELECT d.*, 
                CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as days_waiting,
                u.first_name || ' ' || u.last_name as owner_name
            FROM decisions d
            LEFT JOIN users u ON d.decision_owner_id = u.id
            WHERE d.status = 'PENDING'
            ${projectId ? 'AND d.project_id = ?' : ''}
            AND julianday('now') - julianday(d.created_at) > 5
            ORDER BY days_waiting DESC
            LIMIT 20
        `;
        const agingParams = projectId ? [projectId] : [];

        const aging = await DbPromise.all(agingSql, agingParams);

        // Blocking decisions
        const blockingSql = `
            SELECT d.*, 
                u.first_name || ' ' || u.last_name as owner_name,
                COUNT(di.id) as blocked_count
            FROM decisions d
            LEFT JOIN users u ON d.decision_owner_id = u.id
            LEFT JOIN decision_impacts di ON d.id = di.decision_id AND di.is_blocker = 1
            WHERE d.status = 'PENDING'
            ${projectId ? 'AND d.project_id = ?' : ''}
            GROUP BY d.id
            HAVING blocked_count > 0
            ORDER BY blocked_count DESC
            LIMIT 20
        `;
        const blockingParams = projectId ? [projectId] : [];

        const blocking = await DbPromise.all(blockingSql, blockingParams);

        res.json({ aging, blocking });
    });

    /**
     * Get single decision by ID
     */
    static getDecisionById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        const sql = `
            SELECT d.*, u.first_name, u.last_name, u.avatar_url
            FROM decisions d
            LEFT JOIN users u ON d.decision_owner_id = u.id
            WHERE d.id = ?
        `;

        const decision = await queryHelpers.queryOne(sql, [id]);
        if (!decision) {
            res.status(404).json({ error: 'Decision not found' });
            return;
        }

        res.json(decision);
    });

    /**
     * Create a new decision
     */
    static createDecision = asyncHandler(
        async (req: AuthenticatedRequest, res: Response): Promise<void> => {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Check permission
            if (!req.can || !req.can('approve_changes')) {
                res.status(403).json({ error: 'Permission denied' });
                return;
            }

            const {
                projectId,
                title,
                description,
                pmoDomain,
                decisionOwnerId,
                relatedObjectType,
                relatedObjectId,
                dueDate,
                priority,
            } = req.body;

            if (!projectId || !title) {
                res.status(400).json({ error: 'Missing required fields' });
                return;
            }

            const id = uuidv4();
            const auditTrail = JSON.stringify([
                {
                    action: 'CREATED',
                    by: userId,
                    at: new Date().toISOString(),
                },
            ]);

            const sql = `INSERT INTO decisions (
            id, project_id, title, description, pmo_domain,
            decision_owner_id, related_object_type, related_object_id,
            due_date, priority, status, audit_trail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            await queryHelpers.queryRun(sql, [
                id,
                projectId,
                title,
                description || null,
                pmoDomain,
                decisionOwnerId || userId,
                relatedObjectType || null,
                relatedObjectId || null,
                dueDate || null,
                priority || 'medium',
                'pending',
                auditTrail,
            ]);

            res.status(201).json({ id, projectId, title, status: 'pending' });
        },
    );

    /**
     * Make a decision (approve/reject/defer)
     */
    static decide = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const { decision, rationale, _notes } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        if (!['approved', 'rejected', 'deferred'].includes(decision)) {
            res.status(400).json({ error: 'Invalid decision' });
            return;
        }

        if (!rationale || rationale.trim() === '') {
            res.status(400).json({ error: 'Decision rationale is required' });
            return;
        }

        // Get decision first
        const currentDecision = await queryHelpers.queryOne<{
            decision_owner_id?: string;
            audit_trail?: string;
        }>(`SELECT * FROM decisions WHERE id = ?`, [id]);

        if (!currentDecision) {
            res.status(404).json({ error: 'Decision not found' });
            return;
        }

        // Check if user is decision owner
        if (
            currentDecision.decision_owner_id !== userId &&
            req.user?.role !== 'ADMIN' &&
            req.user?.role !== 'SUPERADMIN'
        ) {
            res.status(403).json({ error: 'Only decision owner can decide' });
            return;
        }

        // Update audit trail
        let auditTrail: AuditTrailEntry[] = [];
        try {
            auditTrail = JSON.parse(currentDecision.audit_trail || '[]') as AuditTrailEntry[];
        } catch {
            // Ignore parse errors
        }
        auditTrail.push({
            action: decision.toUpperCase(),
            by: userId,
            at: new Date().toISOString(),
            notes: rationale,
        });

        const sql = `UPDATE decisions 
                     SET status = ?, outcome = ?, decided_at = CURRENT_TIMESTAMP, audit_trail = ?
                     WHERE id = ?`;

        await queryHelpers.queryRun(sql, [decision, rationale, JSON.stringify(auditTrail), id]);

        res.json({ id, status: decision, decidedBy: userId });
    });

    /**
     * Escalate decision
     */
    static escalateDecision = asyncHandler(
        async (req: AuthenticatedRequest, res: Response): Promise<void> => {
            const { id } = req.params;
            const { reason, escalateToUserId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // TODO: Implement escalation logic
            res.json({ id, message: 'Decision escalated', escalatedBy: userId });
        },
    );
}

export default DecisionController;
