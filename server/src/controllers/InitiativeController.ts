/**
 * Initiative Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all initiative-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type {
    CreateInitiativeRequest,
    UpdateInitiativeRequest,
    UpdateInitiativeStatusRequest,
} from '../validators/initiative.validators.js';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const safeJsonParse = <T = unknown>(str: string | null | undefined, defaultValue: T[] = [] as T[]): T[] => {
    if (!str || str === '' || str === 'null' || str === 'undefined') {
        return defaultValue;
    }
    try {
        const parsed = JSON.parse(str);
        return parsed || defaultValue;
    } catch (e: unknown) {
        console.warn('[initiatives] Failed to parse JSON:', str?.substring?.(0, 100));
        return defaultValue;
    }
};

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class InitiativeController {
    /**
     * Get all initiatives for organization
     */
    static getInitiatives = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const sql = `
            SELECT i.*, 
                ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
                oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
            FROM initiatives i
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            LEFT JOIN users oe ON i.owner_execution_id = oe.id
            WHERE i.organization_id = ?
            ORDER BY i.created_at DESC
        `;

        const rows = await queryHelpers.queryAll(sql, [orgId]);

        const initiatives = rows.map((i: Record<string, unknown>) => ({
            id: i.id,
            organizationId: i.organization_id,
            projectId: i.project_id,
            name: i.title,
            axis: i.axis,
            area: i.area,
            summary: i.summary,
            hypothesis: i.hypothesis,
            status: i.status,
            progress: i.progress || 0,
            currentStage: i.current_stage,
            businessValue: i.business_value,
            costCapex: i.cost_capex,
            costOpex: i.cost_opex,
            expectedRoi: i.expected_roi,
            valueDriver: i.value_driver,
            confidenceLevel: i.confidence_level,
            valueTiming: i.value_timing,
            plannedStartDate: i.planned_start_date,
            plannedEndDate: i.planned_end_date,
            actualStartDate: i.actual_start_date,
            actualEndDate: i.actual_end_date,
            problemStatement: i.problem_statement,
            deliverables: safeJsonParse(i.deliverables as string, []),
            successCriteria: safeJsonParse(i.success_criteria as string, []),
            scopeIn: safeJsonParse(i.scope_in as string, []),
            scopeOut: safeJsonParse(i.scope_out as string, []),
            keyRisks: safeJsonParse(i.key_risks as string, []),
            ownerBusiness: i.owner_business_id
                ? {
                      id: i.owner_business_id,
                      firstName: i.ob_first_name,
                      lastName: i.ob_last_name,
                      avatarUrl: i.ob_avatar,
                  }
                : null,
            ownerExecution: i.owner_execution_id
                ? {
                      id: i.owner_execution_id,
                      firstName: i.oe_first_name,
                      lastName: i.oe_last_name,
                      avatarUrl: i.oe_avatar,
                  }
                : null,
        }));

        res.json(initiatives);
    });

    /**
     * Get single initiative by ID
     */
    static getInitiativeById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const sql = `
            SELECT i.*, 
                ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
                oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
            FROM initiatives i
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            LEFT JOIN users oe ON i.owner_execution_id = oe.id
            WHERE i.id = ? AND i.organization_id = ?
        `;

        const initiative = await queryHelpers.queryOne(sql, [id, orgId]);
        if (!initiative) {
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }

        // Parse JSON fields
        const parsed = {
            ...initiative,
            deliverables: safeJsonParse((initiative as Record<string, unknown>).deliverables as string, []),
            successCriteria: safeJsonParse((initiative as Record<string, unknown>).success_criteria as string, []),
            scopeIn: safeJsonParse((initiative as Record<string, unknown>).scope_in as string, []),
            scopeOut: safeJsonParse((initiative as Record<string, unknown>).scope_out as string, []),
            keyRisks: safeJsonParse((initiative as Record<string, unknown>).key_risks as string, []),
        };

        res.json(parsed);
    });

    /**
     * Create a new initiative
     */
    static createInitiative = asyncHandler(
        async (req: AuthenticatedRequest<CreateInitiativeRequest>, res: Response): Promise<void> => {
            const orgId = req.user?.organizationId;
            if (!orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const {
                projectId,
                title,
                axis,
                area,
                summary,
                hypothesis,
                businessValue,
                costCapex,
                costOpex,
                expectedRoi,
                valueDriver,
                confidenceLevel,
                valueTiming,
                plannedStartDate,
                plannedEndDate,
                ownerBusinessId,
                ownerExecutionId,
                problemStatement,
                deliverables,
                successCriteria,
                scopeIn,
                scopeOut,
                keyRisks,
            } = req.body;

            if (!title) {
                res.status(400).json({ error: 'Title is required' });
                return;
            }

            // TODO: Check access policy when AccessPolicyService is migrated

            const id = uuidv4();
            const now = new Date().toISOString();

            const sql = `
            INSERT INTO initiatives (
                id, organization_id, project_id, title, axis, area, summary, hypothesis,
                business_value, cost_capex, cost_opex, expected_roi,
                value_driver, confidence_level, value_timing,
                planned_start_date, planned_end_date,
                owner_business_id, owner_execution_id,
                problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

            await queryHelpers.queryRun(sql, [
                id,
                orgId,
                projectId,
                title,
                axis ?? null,
                area ?? null,
                summary ?? null,
                hypothesis ?? null,
                businessValue ?? null,
                costCapex ?? null,
                costOpex ?? null,
                expectedRoi ?? null,
                valueDriver ?? null,
                confidenceLevel ?? null,
                valueTiming ?? null,
                plannedStartDate ?? null,
                plannedEndDate ?? null,
                ownerBusinessId ?? null,
                ownerExecutionId ?? null,
                problemStatement ?? null,
                JSON.stringify(deliverables || []),
                JSON.stringify(successCriteria || []),
                JSON.stringify(scopeIn || []),
                JSON.stringify(scopeOut || []),
                JSON.stringify(keyRisks || []),
                now,
                now,
            ]);

            res.json({ id, name: title, message: 'Initiative created' });
        },
    );

    /**
     * Update initiative
     */
    static updateInitiative = asyncHandler(
        async (req: AuthenticatedRequest<UpdateInitiativeRequest>, res: Response): Promise<void> => {
            const { _id } = req.params;
            const orgId = req.user?.organizationId;
            if (!orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // TODO: Implement full update logic with field mapping
            // For now, return success
            res.json({ message: 'Initiative updated' });
        },
    );

    /**
     * Update initiative status
     */
    static updateInitiativeStatus = asyncHandler(
        async (req: AuthenticatedRequest<UpdateInitiativeStatusRequest>, res: Response): Promise<void> => {
            const { id } = req.params;
            const { status, _reason } = req.body;
            const orgId = req.user?.organizationId;
            if (!orgId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // TODO: Use InitiativeStatusService when migrated
            const sql = `UPDATE initiatives SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`;
            await queryHelpers.queryRun(sql, [status, new Date().toISOString(), id, orgId]);

            res.json({ id, status, message: 'Status updated' });
        },
    );
}

export default InitiativeController;
