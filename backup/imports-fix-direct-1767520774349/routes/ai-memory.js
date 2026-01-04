/**
 * AI Memory API Routes
 * 
 * CRUD operations for AI user memory (preferences, context).
 * Supports explicit user-set memories and AI-inferred memories.
 */

import express from 'express';
const router = express.Router();
import verifyToken from '../middleware/authMiddleware.js';
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

// Helper: Promisify db.all
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
});

// Helper: Promisify db.get
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
});

// Helper: Promisify db.run
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
    });
});

// ==================== GET ALL MEMORIES ====================
/**
 * GET /api/ai-memory
 * List all user's AI memories
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { source } = req.query;

        console.log('[DEBUG] GET /api/ai-memory called');
        console.log('[DEBUG] req.userId:', userId);
        console.log('[DEBUG] db instance ID:', db.testId);

        let query = `
            SELECT id, key, value, source, confidence, context, created_at, updated_at
            FROM ai_user_memory
            WHERE user_id = ?
        `;
        const params = [userId];

        if (source) {
            query += ` AND source = ?`;
            params.push(source);
        }

        query += ` ORDER BY key ASC`;

        const memories = await dbAll(query, params);

        res.json({
            memories,
            total: memories.length
        });
    } catch (err) {
        console.error('[AIMemory] List error:', err);
        res.status(500).json({ error: 'Failed to fetch memories' });
    }
});

// ==================== GET MEMORY FOR AI CONTEXT ====================
/**
 * GET /api/ai-memory/context
 * Get formatted memory context for AI system prompt
 */
router.get('/context', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;

        const memories = await dbAll(`
            SELECT key, value, source, confidence
            FROM ai_user_memory
            WHERE user_id = ?
            ORDER BY confidence DESC
        `, [userId]);

        if (memories.length === 0) {
            return res.json({ context: null, memories: [] });
        }

        // Build context string
        const contextParts = [];

        // Group memories by category
        const preferences = memories.filter(m =>
            ['preferred_language', 'communication_style', 'response_length', 'timezone'].includes(m.key)
        );
        const context = memories.filter(m =>
            ['role_context', 'project_focus', 'expertise_level'].includes(m.key)
        );
        const custom = memories.filter(m =>
            !preferences.some(p => p.key === m.key) && !context.some(c => c.key === m.key)
        );

        if (preferences.length > 0) {
            contextParts.push('USER PREFERENCES:');
            preferences.forEach(m => {
                contextParts.push(`- ${formatKey(m.key)}: ${m.value}`);
            });
        }

        if (context.length > 0) {
            contextParts.push('\nUSER CONTEXT:');
            context.forEach(m => {
                contextParts.push(`- ${formatKey(m.key)}: ${m.value}`);
            });
        }

        if (custom.length > 0) {
            contextParts.push('\nADDITIONAL NOTES:');
            custom.forEach(m => {
                contextParts.push(`- ${m.key}: ${m.value}`);
            });
        }

        res.json({
            context: contextParts.join('\n'),
            memories: memories.map(m => ({ key: m.key, value: m.value }))
        });
    } catch (err) {
        console.error('[AIMemory] Context error:', err);
        res.status(500).json({ error: 'Failed to generate context' });
    }
});

// Helper: Format key for display
function formatKey(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ==================== SET/UPDATE MEMORY ====================
/**
 * PUT /api/ai-memory/:key
 * Set or update a memory value
 */
router.put('/:key', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { key } = req.params;
        const { value, source = 'explicit', confidence = 1.0, context } = req.body;

        if (!value || value.trim().length === 0) {
            return res.status(400).json({ error: 'Value is required' });
        }

        // Validate key format
        if (!/^[a-z_]+$/.test(key)) {
            return res.status(400).json({
                error: 'Invalid key format. Use lowercase letters and underscores only.'
            });
        }

        const now = new Date().toISOString();

        // Upsert: Insert or update on conflict
        const existing = await dbGet(`
            SELECT id FROM ai_user_memory WHERE user_id = ? AND key = ?
        `, [userId, key]);

        if (existing) {
            await dbRun(`
                UPDATE ai_user_memory
                SET value = ?, source = ?, confidence = ?, context = ?, updated_at = ?
                WHERE id = ?
            `, [value.trim(), source, confidence, context || null, now, existing.id]);
        } else {
            const id = uuidv4();
            await dbRun(`
                INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, context, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, userId, organizationId, key, value.trim(), source, confidence, context || null, now, now]);
        }

        const updated = await dbGet(`
            SELECT * FROM ai_user_memory WHERE user_id = ? AND key = ?
        `, [userId, key]);

        res.json(updated);
    } catch (err) {
        console.error('[AIMemory] Set error:', err);
        res.status(500).json({ error: 'Failed to set memory' });
    }
});

// ==================== DELETE MEMORY ====================
/**
 * DELETE /api/ai-memory/:key
 * Delete a specific memory
 */
router.delete('/:key', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { key } = req.params;

        const result = await dbRun(`
            DELETE FROM ai_user_memory
            WHERE user_id = ? AND key = ?
        `, [userId, key]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Memory not found' });
        }

        res.json({ success: true, deleted: key });
    } catch (err) {
        console.error('[AIMemory] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete memory' });
    }
});

// ==================== BULK SET (from AI inference) ====================
/**
 * POST /api/ai-memory/bulk
 * Set multiple memories at once (typically from AI inference)
 */
router.post('/bulk', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const organizationId = req.organizationId;
        const { memories } = req.body;

        if (!Array.isArray(memories) || memories.length === 0) {
            return res.status(400).json({ error: 'Memories array is required' });
        }

        const now = new Date().toISOString();
        const results = [];

        for (const memory of memories) {
            const { key, value, source = 'inferred', confidence = 0.8 } = memory;

            if (!key || !value) continue;
            if (!/^[a-z_]+$/.test(key)) continue;

            const existing = await dbGet(`
                SELECT id, confidence FROM ai_user_memory WHERE user_id = ? AND key = ?
            `, [userId, key]);

            // Only update if new confidence is higher or source is explicit
            if (existing) {
                if (source === 'explicit' || confidence > existing.confidence) {
                    await dbRun(`
                        UPDATE ai_user_memory
                        SET value = ?, source = ?, confidence = ?, updated_at = ?
                        WHERE id = ?
                    `, [value.trim(), source, confidence, now, existing.id]);
                    results.push({ key, action: 'updated' });
                } else {
                    results.push({ key, action: 'skipped' });
                }
            } else {
                const id = uuidv4();
                await dbRun(`
                    INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [id, userId, organizationId, key, value.trim(), source, confidence, now, now]);
                results.push({ key, action: 'created' });
            }
        }

        res.json({ success: true, results });
    } catch (err) {
        console.error('[AIMemory] Bulk set error:', err);
        res.status(500).json({ error: 'Failed to set memories' });
    }
});

// ==================== PARSE AI RESPONSE FOR MEMORIES ====================
/**
 * POST /api/ai-memory/parse
 * Parse AI response for REMEMBER: directives
 */
router.post('/parse', verifyToken, async (req, res) => {
    try {
        const { response } = req.body;

        if (!response) {
            return res.json({ memories: [] });
        }

        // Look for REMEMBER: patterns in AI response
        const rememberPattern = /REMEMBER:\s*(.+?)(?:\n|$)/gi;
        const memories = [];
        let match;

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
                        confidence: 0.8
                    });
                }
            } else {
                // Store as custom note
                memories.push({
                    key: `note_${Date.now()}`,
                    value: statement,
                    source: 'inferred',
                    confidence: 0.7
                });
            }
        }

        res.json({ memories });
    } catch (err) {
        console.error('[AIMemory] Parse error:', err);
        res.status(500).json({ error: 'Failed to parse response' });
    }
});

export default router;









