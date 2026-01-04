/**
 * AI Memory Routes
 * CRUD operations for AI user memory (preferences, context)
 * Supports explicit user-set memories and AI-inferred memories
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.ts';
import logger from '../utils/Logger.ts';

// Apply rate limiting
const router = Router();

// Helper: Format key for display
function formatKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ==================== GET ALL MEMORIES ====================
/**
 * GET /api/ai-memory
 * List all user's AI memories
 */
router.get(
    '/',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { source } = req.query;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            let query = `
            SELECT id, key, value, source, confidence, context, created_at, updated_at
            FROM ai_user_memory
            WHERE user_id = ?
        `;
            const params: unknown[] = [userId];

            if (source) {
                query += ` AND source = ?`;
                params.push(source);
            }

            query += ` ORDER BY key ASC`;

            const memories = await dbAll(query, params);

            res.json({
                memories,
                total: memories.length,
            });
        } catch (err: unknown) {
            logger.error('[AIMemory] List error:', err);
            res.status(500).json({ error: 'Failed to fetch memories' });
        }
    }),
);

// ==================== GET MEMORY FOR AI CONTEXT ====================
/**
 * GET /api/ai-memory/context
 * Get formatted memory context for AI system prompt
 */
router.get(
    '/context',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user?.id || req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const memories = (await dbAll(
                `
            SELECT key, value, source, confidence
            FROM ai_user_memory
            WHERE user_id = ?
            ORDER BY confidence DESC
        `,
                [userId],
            )) as Array<{
                key?: string;
                value?: string;
                source?: string;
                confidence?: number;
            }>;

            if (memories.length === 0) {
                return res.json({ context: null, memories: [] });
            }

            // Build context string
            const contextParts: string[] = [];

            // Group memories by category
            const preferences = memories.filter(
                (m) =>
                    m.key &&
                    ['preferred_language', 'communication_style', 'response_length', 'timezone'].includes(m.key),
            );
            const context = memories.filter(
                (m) => m.key && ['role_context', 'project_focus', 'expertise_level'].includes(m.key),
            );
            const custom = memories.filter(
                (m) => m.key && !preferences.some((p) => p.key === m.key) && !context.some((c) => c.key === m.key),
            );

            if (preferences.length > 0) {
                contextParts.push('USER PREFERENCES:');
                preferences.forEach((m) => {
                    if (m.key && m.value) {
                        contextParts.push(`- ${formatKey(m.key)}: ${m.value}`);
                    }
                });
            }

            if (context.length > 0) {
                contextParts.push('\nUSER CONTEXT:');
                context.forEach((m) => {
                    if (m.key && m.value) {
                        contextParts.push(`- ${formatKey(m.key)}: ${m.value}`);
                    }
                });
            }

            if (custom.length > 0) {
                contextParts.push('\nADDITIONAL NOTES:');
                custom.forEach((m) => {
                    if (m.key && m.value) {
                        contextParts.push(`- ${m.key}: ${m.value}`);
                    }
                });
            }

            res.json({
                context: contextParts.join('\n'),
                memories: memories.map((m) => ({ key: m.key, value: m.value })),
            });
        } catch (err: unknown) {
            logger.error('[AIMemory] Context error:', err);
            res.status(500).json({ error: 'Failed to generate context' });
        }
    }),
);

// ==================== SET/UPDATE MEMORY ====================
/**
 * PUT /api/ai-memory/:key
 * Set or update a memory value
 */
router.put(
    '/:key',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user?.id || req.user?.userId;
            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const { key } = req.params;
            const { value, source = 'explicit', confidence = 1.0, context } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!value || (typeof value === 'string' && value.trim().length === 0)) {
                return res.status(400).json({ error: 'Value is required' });
            }

            // Validate key format
            if (!/^[a-z_]+$/.test(key)) {
                return res.status(400).json({
                    error: 'Invalid key format. Use lowercase letters and underscores only.',
                });
            }

            const now = new Date().toISOString();
            const valueStr = typeof value === 'string' ? value.trim() : String(value);

            // Upsert: Insert or update on conflict
            const existing = (await dbGet(
                `
            SELECT id FROM ai_user_memory WHERE user_id = ? AND key = ?
        `,
                [userId, key],
            )) as { id?: string } | null;

            if (existing?.id) {
                await dbRun(
                    `
                UPDATE ai_user_memory
                SET value = ?, source = ?, confidence = ?, context = ?, updated_at = ?
                WHERE id = ?
            `,
                    [valueStr, source, confidence, context || null, now, existing.id],
                );
            } else {
                const id = uuidv4();
                await dbRun(
                    `
                INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, context, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                    [id, userId, organizationId, key, valueStr, source, confidence, context || null, now, now],
                );
            }

            const updated = await dbGet(
                `
            SELECT * FROM ai_user_memory WHERE user_id = ? AND key = ?
        `,
                [userId, key],
            );

            res.json(updated);
        } catch (err: unknown) {
            logger.error('[AIMemory] Set error:', err);
            res.status(500).json({ error: 'Failed to set memory' });
        }
    }),
);

// ==================== DELETE MEMORY ====================
/**
 * DELETE /api/ai-memory/:key
 * Delete a specific memory
 */
router.delete(
    '/:key',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { key } = req.params;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const result = await dbRun(
                `
            DELETE FROM ai_user_memory
            WHERE user_id = ? AND key = ?
        `,
                [userId, key],
            );

            if (!result.success || (result.changes || 0) === 0) {
                return res.status(404).json({ error: 'Memory not found' });
            }

            res.json({ success: true, deleted: key });
        } catch (err: unknown) {
            logger.error('[AIMemory] Delete error:', err);
            res.status(500).json({ error: 'Failed to delete memory' });
        }
    }),
);

// ==================== BULK SET (from AI inference) ====================
/**
 * POST /api/ai-memory/bulk
 * Set multiple memories at once (typically from AI inference)
 */
router.post(
    '/bulk',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const userId = req.user?.id || req.user?.userId;
            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const { memories } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!Array.isArray(memories) || memories.length === 0) {
                return res.status(400).json({ error: 'Memories array is required' });
            }

            const now = new Date().toISOString();
            const results: Array<{ key: string; action: string }> = [];

            for (const memory of memories) {
                const {
                    key,
                    value,
                    source = 'inferred',
                    confidence = 0.8,
                } = memory as {
                    key?: string;
                    value?: string;
                    source?: string;
                    confidence?: number;
                };

                if (!key || !value) continue;
                if (!/^[a-z_]+$/.test(key)) continue;

                const existing = (await dbGet(
                    `
                SELECT id, confidence FROM ai_user_memory WHERE user_id = ? AND key = ?
            `,
                    [userId, key],
                )) as { id?: string; confidence?: number } | null;

                const valueStr = typeof value === 'string' ? value.trim() : String(value);

                // Only update if new confidence is higher or source is explicit
                if (existing?.id) {
                    if (
                        source === 'explicit' ||
                        (confidence && existing.confidence && confidence > existing.confidence)
                    ) {
                        await dbRun(
                            `
                        UPDATE ai_user_memory
                        SET value = ?, source = ?, confidence = ?, updated_at = ?
                        WHERE id = ?
                    `,
                            [valueStr, source, confidence, now, existing.id],
                        );
                        results.push({ key, action: 'updated' });
                    } else {
                        results.push({ key, action: 'skipped' });
                    }
                } else {
                    const id = uuidv4();
                    await dbRun(
                        `
                    INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                        [id, userId, organizationId, key, valueStr, source, confidence, now, now],
                    );
                    results.push({ key, action: 'created' });
                }
            }

            res.json({ success: true, results });
        } catch (err: unknown) {
            logger.error('[AIMemory] Bulk set error:', err);
            res.status(500).json({ error: 'Failed to set memories' });
        }
    }),
);

// ==================== PARSE AI RESPONSE FOR MEMORIES ====================
/**
 * POST /api/ai-memory/parse
 * Parse AI response for REMEMBER: directives
 */
router.post(
    '/parse',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { response } = req.body;

            if (!response || typeof response !== 'string') {
                return res.json({ memories: [] });
            }

            // Look for REMEMBER: patterns in AI response
            const rememberPattern = /REMEMBER:\s*(.+?)(?:\n|$)/gi;
            const memories: Array<{
                key: string;
                value: string;
                source: string;
                confidence: number;
            }> = [];
            let match: RegExpExecArray | null;

            while ((match = rememberPattern.exec(response)) !== null) {
                const statement = match[1].trim();

                // Try to extract key-value pairs
                const kvMatch = statement.match(/^(.+?):\s*(.+)$/);
                if (kvMatch) {
                    const key = kvMatch[1]
                        .toLowerCase()
                        .replace(/[^a-z\s]/g, '')
                        .replace(/\s+/g, '_')
                        .slice(0, 50);
                    const value = kvMatch[2].trim();

                    if (key && value) {
                        memories.push({
                            key,
                            value,
                            source: 'inferred',
                            confidence: 0.8,
                        });
                    }
                } else {
                    // Store as custom note
                    memories.push({
                        key: `note_${Date.now()}`,
                        value: statement,
                        source: 'inferred',
                        confidence: 0.7,
                    });
                }
            }

            res.json({ memories });
        } catch (err: unknown) {
            logger.error('[AIMemory] Parse error:', err);
            res.status(500).json({ error: 'Failed to parse response' });
        }
    }),
);

export default router;
