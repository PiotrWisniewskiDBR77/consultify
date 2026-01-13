/**
 * Stage Gate Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all stage gate-related business logic
 */

import type { Response } from 'express';

import _StageGateService, {
    evaluateGate,
    GATE_TYPES,
    getGateType,
    passGate,
    PHASE_ORDER,
} from '../services/stageGateService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type { PassGateRequest } from '../validators/stageGate.validators.js';

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class StageGateController {
    /**
     * Evaluate gate readiness
     */
    static evaluateGate = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId, gateType } = req.params;
        const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
        const gateTypeStr = Array.isArray(gateType) ? gateType[0] : gateType;

        const result = await evaluateGate(projectIdStr, gateTypeStr as (typeof GATE_TYPES)[keyof typeof GATE_TYPES]);

        res.json(result);
    });

    /**
     * Get current gate for project
     */
    static getCurrentGate = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId } = req.params;
        const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;

        const project = await DbPromise.get<{ current_phase?: string }>(
            `SELECT current_phase FROM projects WHERE id = ?`,
            [projectIdStr],
        );

        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        const currentPhase = project.current_phase || 'Context';
        const phaseIndex = PHASE_ORDER.indexOf(currentPhase as (typeof PHASE_ORDER)[number]);

        if (phaseIndex >= PHASE_ORDER.length - 1) {
            res.json({
                currentPhase,
                nextGate: null,
                message: 'Project is in final phase',
            });
            return;
        }

        const nextPhase = PHASE_ORDER[phaseIndex + 1];
        const gateType = getGateType(currentPhase, nextPhase);

        if (!gateType) {
            res.json({ currentPhase, nextGate: null });
            return;
        }

        const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
        const evaluation = await evaluateGate(projectIdStr, gateType);

        res.json({
            currentPhase,
            nextPhase,
            gateType,
            ...evaluation,
        });
    });

    /**
     * Pass gate
     */
    static passGate = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId, gateType } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check permission - using PermissionService if available
        const PermissionService = (await import('../services/permissionService.js')).default;
        if (!PermissionService.can || !PermissionService.can(req.user!, 'manage_stage_gates')) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
        const gateTypeStr = Array.isArray(gateType) ? gateType[0] : gateType;
        
        // First evaluate
        const evaluation = await evaluateGate(projectIdStr, gateTypeStr as (typeof GATE_TYPES)[keyof typeof GATE_TYPES]);

        if (evaluation.status !== 'READY') {
            res.status(400).json({
                error: 'Gate not ready',
                missingElements: evaluation.missingElements,
            });
            return;
        }

        // Pass the gate
        const result = await passGate(
            projectIdStr,
            gateTypeStr as (typeof GATE_TYPES)[keyof typeof GATE_TYPES],
            userId,
            notes,
        );

        res.json(result);
    });

    /**
     * Get gate history for project
     */
    static getGateHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId } = req.params;

        const gates = await queryHelpers.queryAll(
            `SELECT * FROM stage_gates WHERE project_id = ? ORDER BY approved_at DESC`,
            [projectId],
        );

        res.json(gates);
    });
}

export default StageGateController;
