import express from 'express';
import verifyToken from '../middleware/authMiddleware.js';
import PMOHealthService from '../services/pmoHealthService.js';

const router = express.Router();

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

export default router;
