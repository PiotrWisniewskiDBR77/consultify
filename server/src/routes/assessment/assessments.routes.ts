/**
 * Assessments Routes
 * Handles CRUD operations for digital maturity assessments
 */
import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/index.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
    user?: {
        id: string;
        organizationId: string;
        role: string;
    };
}

/**
 * GET /api/assessments/my-assessments
 * Returns all assessments for the user's organization
 */
router.get('/my-assessments', async (req: AuthRequest, res: Response) => {
    try {
        const db = getDatabase();
        const organizationId = req.user?.organizationId || 'org-dbr77-system';
        
        logger.info(`[Assessments] Fetching assessments for org: ${organizationId}`);
        
        // Get assessments from database
        const assessments = await new Promise<any[]>((resolve, reject) => {
            db.all(
                `SELECT 
                    id,
                    organization_id as organizationId,
                    name,
                    description,
                    status,
                    created_at as createdAt,
                    updated_at as updatedAt,
                    'DRD' as type,
                    'Digital Readiness Diagnosis' as projectName,
                    75 as progress,
                    3.2 as overallScore
                FROM assessments 
                WHERE organization_id = ?
                ORDER BY created_at DESC`,
                [organizationId],
                (err: Error | null, rows: any[]) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });

        logger.info(`[Assessments] Found ${assessments.length} assessments`);
        
        res.json({ assessments });
    } catch (err: any) {
        logger.error('[Assessments] Error fetching assessments:', err);
        res.status(500).json({ error: 'Failed to fetch assessments', message: err.message });
    }
});

/**
 * GET /api/assessments/:id
 * Returns a single assessment by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const db = getDatabase();
        const { id } = req.params;
        const organizationId = req.user?.organizationId || 'org-dbr77-system';
        
        const assessment = await new Promise<any>((resolve, reject) => {
            db.get(
                `SELECT 
                    id,
                    organization_id as organizationId,
                    name,
                    description,
                    status,
                    created_at as createdAt,
                    updated_at as updatedAt,
                    'DRD' as type,
                    'Digital Readiness Diagnosis' as projectName
                FROM assessments 
                WHERE id = ? AND organization_id = ?`,
                [id, organizationId],
                (err: Error | null, row: any) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        res.json({ assessment });
    } catch (err: any) {
        logger.error('[Assessments] Error fetching assessment:', err);
        res.status(500).json({ error: 'Failed to fetch assessment', message: err.message });
    }
});

/**
 * POST /api/assessments
 * Create a new assessment
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const db = getDatabase();
        const organizationId = req.user?.organizationId || 'org-dbr77-system';
        const { name, description, type } = req.body;
        
        const id = `assessment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO assessments (id, organization_id, name, description, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [id, organizationId, name || 'New Assessment', description || ''],
                (err: Error | null) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        logger.info(`[Assessments] Created assessment: ${id}`);
        
        res.status(201).json({ 
            assessment: { 
                id, 
                organizationId, 
                name: name || 'New Assessment', 
                description: description || '',
                status: 'DRAFT',
                type: type || 'DRD'
            } 
        });
    } catch (err: any) {
        logger.error('[Assessments] Error creating assessment:', err);
        res.status(500).json({ error: 'Failed to create assessment', message: err.message });
    }
});

/**
 * PUT /api/assessments/:id/status
 * Update assessment status
 */
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const db = getDatabase();
        const { id } = req.params;
        const { status } = req.body;
        const organizationId = req.user?.organizationId || 'org-dbr77-system';
        
        await new Promise<void>((resolve, reject) => {
            db.run(
                `UPDATE assessments SET status = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND organization_id = ?`,
                [status, id, organizationId],
                (err: Error | null) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true, id, status });
    } catch (err: any) {
        logger.error('[Assessments] Error updating status:', err);
        res.status(500).json({ error: 'Failed to update status', message: err.message });
    }
});

/**
 * DELETE /api/assessments/:id
 * Delete an assessment
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const db = getDatabase();
        const { id } = req.params;
        const organizationId = req.user?.organizationId || 'org-dbr77-system';
        
        await new Promise<void>((resolve, reject) => {
            db.run(
                `DELETE FROM assessments WHERE id = ? AND organization_id = ?`,
                [id, organizationId],
                (err: Error | null) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        res.json({ success: true });
    } catch (err: any) {
        logger.error('[Assessments] Error deleting assessment:', err);
        res.status(500).json({ error: 'Failed to delete assessment', message: err.message });
    }
});

export default router;
