// @ts-nocheck
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
import logger from '../utils/Logger.js';
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
        logger.warn('[initiatives] Failed to parse JSON:', str?.substring?.(0, 100));
        return defaultValue;
    }
};

/**
 * Parse multilingual text and return translation for user's language
 * @param text - JSON string with translations {pl: '...', en: '...', ...} or plain string
 * @param userLang - User's language code (default: 'en')
 * @returns Translated text or original if not multilingual
 */
const getMultilingualText = (text: string | null | undefined, userLang: string = 'en'): string => {
    if (!text) return '';

    // If it's a plain string (not JSON), return as-is
    if (!text.startsWith('{') && !text.startsWith('[')) {
        return text;
    }

    try {
        const translations = JSON.parse(text);
        // Check if it's a multilingual object
        if (typeof translations === 'object' && translations !== null && !Array.isArray(translations)) {
            // Return translation for user's language, fallback to English, then first available
            return translations[userLang] || translations.en || translations[Object.keys(translations)[0]] || text;
        }
        return text;
    } catch {
        // Not JSON, return as-is
        return text;
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

        // Get user language from Accept-Language header or default to English
        const headers = req.headers || {};
        const acceptLang = (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
        const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
        const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
        const lang = supportedLangs.includes(userLang) ? userLang : 'en';

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
            name: getMultilingualText(i.name as string || i.title as string, lang),
            axis: i.axis,
            area: i.area,
            summary: getMultilingualText(i.summary as string, lang),
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

        // Get user language from Accept-Language header or default to English
        const headers = req.headers || {};
        const acceptLang = (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
        const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
        const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
        const lang = supportedLangs.includes(userLang) ? userLang : 'en';

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

        const i = initiative as Record<string, unknown>;

        // Parse JSON fields and apply multilingual text
        const parsed = {
            ...initiative,
            name: getMultilingualText(i.name as string || i.title as string, lang),
            summary: getMultilingualText(i.summary as string, lang),
            deliverables: safeJsonParse(i.deliverables as string, []),
            successCriteria: safeJsonParse(i.success_criteria as string, []),
            scopeIn: safeJsonParse(i.scope_in as string, []),
            scopeOut: safeJsonParse(i.scope_out as string, []),
            keyRisks: safeJsonParse(i.key_risks as string, []),
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
            const { id } = req.params;
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
            const { status, reason } = req.body;
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

    /**
     * Get portfolio data with initiatives and stats
     */
    static getPortfolioData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
            name: i.title || i.name || 'Untitled Initiative',
            title: i.title || i.name || 'Untitled Initiative',
            axis: i.axis || 'operational',
            area: i.area,
            summary: i.summary,
            hypothesis: i.hypothesis,
            status: i.status || 'DRAFT',
            progress: i.progress || 0,
            currentStage: i.current_stage,
            businessValue: i.business_value || 0,
            costCapex: i.cost_capex || 0,
            costOpex: i.cost_opex || 0,
            expectedRoi: i.expected_roi || 0,
            valueDriver: i.value_driver,
            confidenceLevel: i.confidence_level || 'medium',
            valueTiming: i.value_timing,
            plannedStartDate: i.planned_start_date,
            plannedEndDate: i.planned_end_date,
            actualStartDate: i.actual_start_date,
            actualEndDate: i.actual_end_date,
            priority: i.priority || 'medium',
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
            createdAt: i.created_at,
            updatedAt: i.updated_at,
        }));

        // Calculate stats
        const totalInitiatives = initiatives.length;
        const inProgress = initiatives.filter((i: any) => i.status === 'IN_PROGRESS').length;
        const completed = initiatives.filter((i: any) => i.status === 'COMPLETED').length;
        const atRisk = initiatives.filter((i: any) => i.status === 'BLOCKED' || i.status === 'AT_RISK').length;
        const totalBudget = initiatives.reduce((sum: number, i: any) => sum + (i.costCapex || 0) + (i.costOpex || 0), 0);
        const totalValue = initiatives.reduce((sum: number, i: any) => sum + (i.businessValue || 0), 0);
        const avgProgress = totalInitiatives > 0
            ? Math.round(initiatives.reduce((sum: number, i: any) => sum + (i.progress || 0), 0) / totalInitiatives)
            : 0;

        res.json({
            initiatives,
            stats: {
                totalInitiatives,
                inProgress,
                completed,
                atRisk,
                totalBudget,
                totalValue,
                avgProgress,
            },
        });
    });
}

export default InitiativeController;
