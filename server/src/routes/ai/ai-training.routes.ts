/**
 * AI Training Routes
 * API endpoints for AI feedback and custom prompts
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as _dbGet, run as dbRun } from '../../utils/DbPromise.js';

// Apply rate limiting
const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

/**
 * GET /api/ai-training
 * Get AI feedback for organization
 */
router.get(
    '/',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { helpful, context } = req.query;

        let sql = 'SELECT * FROM ai_feedback WHERE organization_id = ?';
        const params: unknown[] = [organizationId];

        if (helpful !== undefined) {
            sql += ' AND helpful = ?';
            params.push(helpful === 'true' ? 1 : 0);
        }

        if (context) {
            sql += ' AND context = ?';
            params.push(context);
        }

        sql += ' ORDER BY created_at DESC LIMIT 100';

        const rows = await dbAll<{
            id: string;
            organization_id: string;
            user_id: string;
            context: string;
            prompt: string | null;
            response: string;
            helpful: number;
            comment: string | null;
            created_at: string;
        }>(sql, params);

        return res.json(rows || []);
    }),
);

/**
 * POST /api/ai-training
 * Submit AI feedback
 */
router.post(
    '/',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { context, prompt, response, helpful, comment } = req.body;

        if (!context || !response || helpful === undefined) {
            return res.status(400).json({ error: 'context, response, and helpful are required' });
        }

        const id = uuidv4();

        const result = await dbRun(
            `INSERT INTO ai_feedback (id, organization_id, user_id, context, prompt, response, helpful, comment) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, organizationId, userId, context, prompt || '', response, helpful ? 1 : 0, comment || ''],
        );

        if (!result.success) {
            throw new Error(result.error || 'Failed to insert feedback');
        }

        return res.json({
            success: true,
            id,
            message: 'Feedback submitted successfully',
        });
    }),
);

/**
 * GET /api/ai-training/prompts
 * Get custom prompts for organization
 */
router.get(
    '/prompts',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const rows = await dbAll<{
            id: string;
            organization_id: string;
            name: string;
            context: string;
            template: string;
            variables: string | null;
            is_active: number;
            created_by: string;
            created_at: string;
            updated_at: string | null;
        }>('SELECT * FROM custom_prompts WHERE organization_id = ? ORDER BY created_at DESC', [organizationId]);

        return res.json(rows || []);
    }),
);

/**
 * POST /api/ai-training/prompts
 * Create custom prompt template
 */
router.post(
    '/prompts',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!organizationId || !userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, context, template, variables, isActive = true } = req.body;

        if (!name || !context || !template) {
            return res.status(400).json({ error: 'name, context, and template are required' });
        }

        const id = uuidv4();

        const result = await dbRun(
            `INSERT INTO custom_prompts (id, organization_id, name, context, template, variables, is_active, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, organizationId, name, context, template, JSON.stringify(variables || []), isActive ? 1 : 0, userId],
        );

        if (!result.success) {
            throw new Error(result.error || 'Failed to create prompt');
        }

        return res.json({
            success: true,
            id,
            message: 'Custom prompt created successfully',
        });
    }),
);

/**
 * PUT /api/ai-training/prompts/:id
 * Update custom prompt
 */
router.put(
    '/prompts/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, template, variables, isActive } = req.body;

        const result = await dbRun(
            `UPDATE custom_prompts 
         SET name = COALESCE(?, name),
             template = COALESCE(?, template),
             variables = COALESCE(?, variables),
             is_active = COALESCE(?, is_active),
             updated_at = datetime('now')
         WHERE id = ? AND organization_id = ?`,
            [
                name,
                template,
                variables ? JSON.stringify(variables) : null,
                isActive !== undefined ? (isActive ? 1 : 0) : null,
                id,
                organizationId,
            ],
        );

        if (!result.success || (result.changes || 0) === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        return res.json({ success: true, message: 'Prompt updated' });
    }),
);

/**
 * GET /api/ai-training/analytics
 * Get feedback analytics
 */
router.get(
    '/analytics',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const rows = await dbAll<{
            context: string;
            total: number;
            helpful_count: number;
            not_helpful_count: number;
            satisfaction_rate: number;
        }>(
            `SELECT 
            context,
            COUNT(*) as total,
            SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) as helpful_count,
            SUM(CASE WHEN helpful = 0 THEN 1 ELSE 0 END) as not_helpful_count,
            ROUND(AVG(CASE WHEN helpful = 1 THEN 100.0 ELSE 0.0 END), 2) as satisfaction_rate
         FROM ai_feedback 
         WHERE organization_id = ?
         GROUP BY context`,
            [organizationId],
        );

        return res.json(rows || []);
    }),
);

export default router;
