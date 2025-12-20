/**
 * PMO Health Routes
 * Step A: GET /api/pmo/health/:projectId endpoint
 * 
 * Provides canonical PMOHealthSnapshot as single source of truth
 * for both UI and AI context.
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const PMOHealthService = require('../services/pmoHealthService');

/**
 * GET /api/pmo/health/:projectId
 * Returns canonical PMOHealthSnapshot for a project
 * 
 * Response schema:
 * {
 *   projectId: string,
 *   projectName: string,
 *   phase: { number: 1..6, name: string },
 *   stageGate: {
 *     gateType: string,
 *     isReady: boolean,
 *     missingCriteria: Array<{ criterion: string, evidence?: string }>,
 *     metCriteria: Array<{ criterion: string, evidence?: string }>
 *   },
 *   blockers: Array<{ type: 'DECISION'|'TASK'|'GATE'|'GOVERNANCE', message: string, ref?: {entityType, entityId} }>,
 *   tasks: { overdueCount: number, dueSoonCount: number, blockedCount: number },
 *   decisions: { pendingCount: number, overdueCount: number },
 *   initiatives: { atRiskCount: number, blockedCount: number },
 *   updatedAt: ISOString
 * }
 */
router.get('/health/:projectId', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.params;

        const snapshot = await PMOHealthService.getHealthSnapshot(projectId);

        res.json(snapshot);
    } catch (err) {
        console.error('[PMO Health] Error:', err);

        if (err.message === 'Project not found') {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
