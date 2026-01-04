import express from 'express';
import StageGateService from '../services/stageGateService.js';
import verifyToken from '../middleware/authMiddleware.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

const router = express.Router();

// GET /api/stage-gates/:projectId/evaluate/:gateType
router.get('/:projectId/evaluate/:gateType', verifyToken, async (req, res) => {
    try {
        const result = await StageGateService.evaluateGate(req.params.projectId, req.params.gateType);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stage-gates/:projectId/current
router.get('/:projectId/current', verifyToken, async (req, res) => {
    try {
        // Get project's current phase
        db.get(`SELECT current_phase FROM projects WHERE id = ?`, [req.params.projectId], async (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Project not found' });

            const currentPhase = row.current_phase || 'Context';
            const phaseIndex = StageGateService.PHASE_ORDER.indexOf(currentPhase);

            if (phaseIndex >= StageGateService.PHASE_ORDER.length - 1) {
                return res.json({
                    currentPhase,
                    nextGate: null,
                    message: 'Project is in final phase'
                });
            }

            const nextPhase = StageGateService.PHASE_ORDER[phaseIndex + 1];
            const gateType = StageGateService.getGateType(currentPhase, nextPhase);

            if (!gateType) {
                return res.json({ currentPhase, nextGate: null });
            }

            const evaluation = await StageGateService.evaluateGate(req.params.projectId, gateType);

            res.json({
                currentPhase,
                nextPhase,
                gateType,
                ...evaluation
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/stage-gates/:projectId/pass/:gateType
router.post('/:projectId/pass/:gateType', verifyToken, async (req, res) => {
    if (!req.can('manage_stage_gates')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const { notes } = req.body;

    try {
        // First evaluate
        const evaluation = await StageGateService.evaluateGate(req.params.projectId, req.params.gateType);

        if (evaluation.status !== 'READY') {
            return res.status(400).json({
                error: 'Gate not ready',
                missingElements: evaluation.missingElements
            });
        }

        // Pass the gate
        const result = await StageGateService.passGate(
            req.params.projectId,
            req.params.gateType,
            req.userId,
            notes
        );

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stage-gates/:projectId/history
router.get('/:projectId/history', verifyToken, (req, res) => {
    db.all(`SELECT * FROM stage_gates WHERE project_id = ? ORDER BY approved_at DESC`,
        [req.params.projectId], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows || []);
        });
});

export default router;
