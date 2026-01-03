/**
 * Stage Gate Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Handles all stage gate-related business logic
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
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
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const StageGateService = require('../../services/stageGateService');
        const result = await StageGateService.evaluateGate(projectId, gateType);

        res.json(result);
    });

    /**
     * Get current gate for project
     */
    static getCurrentGate = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId } = req.params;
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const StageGateService = require('../../services/stageGateService');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const db = require('../../database');

        const project = await new Promise<{ current_phase?: string } | null>((resolve, reject) => {
            db.get(`SELECT current_phase FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        const currentPhase = project.current_phase || 'Context';
        const phaseIndex = StageGateService.PHASE_ORDER.indexOf(currentPhase);

        if (phaseIndex >= StageGateService.PHASE_ORDER.length - 1) {
            res.json({
                currentPhase,
                nextGate: null,
                message: 'Project is in final phase'
            });
            return;
        }

        const nextPhase = StageGateService.PHASE_ORDER[phaseIndex + 1];
        const gateType = StageGateService.getGateType(currentPhase, nextPhase);

        if (!gateType) {
            res.json({ currentPhase, nextGate: null });
            return;
        }

        const evaluation = await StageGateService.evaluateGate(projectId, gateType);

        res.json({
            currentPhase,
            nextPhase,
            gateType,
            ...evaluation
        });
    });

    /**
     * Pass gate
     */
    static passGate = asyncHandler(async (req: AuthenticatedRequest<PassGateRequest>, res: Response): Promise<void> => {
        const { projectId, gateType } = req.params;
        const { notes } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check permission
        if (!req.can || !req.can('manage_stage_gates')) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const StageGateService = require('../../services/stageGateService');

        // First evaluate
        const evaluation = await StageGateService.evaluateGate(projectId, gateType);

        if (evaluation.status !== 'READY') {
            res.status(400).json({
                error: 'Gate not ready',
                missingElements: evaluation.missingElements
            });
            return;
        }

        // Pass the gate
        const result = await StageGateService.passGate(projectId, gateType, userId, notes);

        res.json(result);
    });

    /**
     * Get gate history for project
     */
    static getGateHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId } = req.params;

        const gates = await queryHelpers.queryAll(
            `SELECT * FROM stage_gates WHERE project_id = ? ORDER BY approved_at DESC`,
            [projectId]
        );

        res.json(gates);
    });
}

export default StageGateController;

