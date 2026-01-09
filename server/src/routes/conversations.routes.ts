// @ts-nocheck
/**
 * Conversations Routes
 * Full CRUD API for AI Chat Conversation History
 *
 * Endpoints:
 * - GET    /api/conversations              - List user's conversations
 * - POST   /api/conversations              - Create new conversation
 * - GET    /api/conversations/:id          - Get conversation with messages
 * - PATCH  /api/conversations/:id          - Update conversation metadata
 * - DELETE /api/conversations/:id          - Delete conversation
 * - POST   /api/conversations/:id/messages - Add message to conversation
 * - POST   /api/conversations/:id/title/generate - Auto-generate title
 * - POST   /api/conversations/bulk         - Bulk operations
 * - POST   /api/conversations/migrate      - Migrate from localStorage
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// ==================== VALIDATORS ====================

const ListConversationsQuerySchema = z.object({
    archived: z.enum(['true', 'false']).optional(),
    starred: z.enum(['true', 'false']).optional(),
    projectId: z.string().uuid().optional(),
    chatProjectId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    offset: z.string().regex(/^\d+$/).optional(),
});

const CreateConversationSchema = z.object({
    title: z.string().max(255).optional(),
    projectId: z.string().uuid().optional(),
    chatProjectId: z.string().uuid().optional(),
    pmoContext: z.record(z.unknown()).optional(),
});

const ConversationIdParamSchema = z.object({
    id: z.string().uuid(),
});

const UpdateConversationSchema = z.object({
    title: z.string().max(255).optional(),
    starred: z.boolean().optional(),
    archived: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    pmoContext: z.record(z.unknown()).optional(),
    chatProjectId: z.string().uuid().nullable().optional(),
});

const AddMessageSchema = z.object({
    role: z.enum(['user', 'ai']),
    content: z.string().min(1),
    messageType: z.enum(['text', 'action_request', 'summary', 'file', 'tool_call', 'voice']).optional(),
    metadata: z.record(z.unknown()).optional(),
    tokenCount: z.number().int().positive().optional(),
    modelUsed: z.string().max(100).optional(),
});

const BulkOperationSchema = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum(['archive', 'unarchive', 'delete', 'star', 'unstar']),
});

const MigrateConversationsSchema = z.object({
    conversations: z.array(
        z.object({
            projectId: z.string().uuid().optional(),
            messages: z.array(
                z.object({
                    role: z.string(),
                    content: z.string(),
                    timestamp: z.string().optional(),
                }),
            ),
        }),
    ),
});

// ==================== LIST CONVERSATIONS ====================

router.get(
    '/',
    verifyToken,
    validateQuery(ListConversationsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { archived, starred, projectId, chatProjectId, search, limit: limitStr, offset: offsetStr } =
            req.query as Record<string, string | undefined>;

        const limit = parseInt(limitStr || '50', 10);
        const offset = parseInt(offsetStr || '0', 10);

        try {
            let whereClause = 'WHERE user_id = ?';
            const params: (string | boolean)[] = [req.userId!];

            if (archived !== undefined) {
                whereClause += ' AND archived = ?';
                params.push(archived === 'true');
            }

            if (starred !== undefined) {
                whereClause += ' AND starred = ?';
                params.push(starred === 'true');
            }

            if (projectId) {
                whereClause += ' AND project_id = ?';
                params.push(projectId);
            }

            if (chatProjectId) {
                whereClause += ' AND chat_project_id = ?';
                params.push(chatProjectId);
            }

            if (search) {
                whereClause += ' AND (title ILIKE ? OR last_message_preview ILIKE ?)';
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern);
            }

            // Get total count
            const countResult = (await dbGet(`SELECT COUNT(*) as total FROM conversations ${whereClause}`, params)) as {
                total: number;
            };

            // Get conversations
            const conversations = await dbAll(
                `
                SELECT 
                    id, title, title_source, project_id, chat_project_id, organization_id,
                    starred, archived, tags, pmo_context, message_count,
                    last_message_preview, last_message_at, created_at, updated_at
                FROM conversations
                ${whereClause}
                ORDER BY 
                    CASE WHEN starred = true THEN 0 ELSE 1 END,
                    COALESCE(last_message_at, updated_at) DESC
                LIMIT ? OFFSET ?
            `,
                [...params, limit, offset],
            );

            return res.json({
                conversations,
                total: countResult?.total || 0,
                limit,
                offset,
            });
        } catch (err: any) {
            logger.error('[Conversations] List error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== CREATE CONVERSATION ====================

router.post(
    '/',
    verifyToken,
    validateBody(CreateConversationSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { title, projectId, chatProjectId, pmoContext } = req.body;

        try {
            const id = uuidv4();
            const now = new Date().toISOString();

            await dbRun(
                `
                INSERT INTO conversations (
                    id, user_id, organization_id, project_id, chat_project_id,
                    title, title_source, pmo_context, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                    id,
                    req.userId!,
                    req.organizationId || null,
                    projectId || null,
                    chatProjectId || null,
                    title || 'New conversation',
                    title ? 'user' : 'auto',
                    pmoContext ? JSON.stringify(pmoContext) : '{}',
                    now,
                    now,
                ],
            );

            const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [id]);

            logger.info(`[Conversations] Created: ${id} for user ${req.userId}`);

            return res.status(201).json(conversation);
        } catch (err: any) {
            logger.error('[Conversations] Create error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== GET CONVERSATION WITH MESSAGES ====================

router.get(
    '/:id',
    verifyToken,
    validateParams(ConversationIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        try {
            // Get conversation
            const conversation = await dbGet(
                'SELECT * FROM conversations WHERE id = ? AND user_id = ?',
                [id, req.userId!],
            );

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Get messages
            const messages = await dbAll(
                `
                SELECT id, conversation_id, role, content, message_type, metadata, 
                       token_count, model_used, created_at
                FROM conversation_messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
            `,
                [id],
            );

            return res.json({
                ...conversation,
                messages,
            });
        } catch (err: any) {
            logger.error('[Conversations] Get error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== UPDATE CONVERSATION ====================

router.patch(
    '/:id',
    verifyToken,
    validateParams(ConversationIdParamSchema),
    validateBody(UpdateConversationSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const updates = req.body;

        try {
            // Verify ownership
            const existing = await dbGet(
                'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
                [id, req.userId!],
            );

            if (!existing) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Build update query
            const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
            const params: (string | boolean | null)[] = [];

            if (updates.title !== undefined) {
                setClauses.push('title = ?');
                setClauses.push('title_source = ?');
                params.push(updates.title, 'user');
            }

            if (updates.starred !== undefined) {
                setClauses.push('starred = ?');
                params.push(updates.starred);
            }

            if (updates.archived !== undefined) {
                setClauses.push('archived = ?');
                params.push(updates.archived);
            }

            if (updates.tags !== undefined) {
                setClauses.push('tags = ?');
                params.push(JSON.stringify(updates.tags));
            }

            if (updates.pmoContext !== undefined) {
                setClauses.push('pmo_context = ?');
                params.push(JSON.stringify(updates.pmoContext));
            }

            if (updates.chatProjectId !== undefined) {
                setClauses.push('chat_project_id = ?');
                params.push(updates.chatProjectId);
            }

            params.push(id);

            await dbRun(
                `UPDATE conversations SET ${setClauses.join(', ')} WHERE id = ?`,
                params,
            );

            const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [id]);

            return res.json(conversation);
        } catch (err: any) {
            logger.error('[Conversations] Update error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== DELETE CONVERSATION ====================

router.delete(
    '/:id',
    verifyToken,
    validateParams(ConversationIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        try {
            // Verify ownership
            const existing = await dbGet(
                'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
                [id, req.userId!],
            );

            if (!existing) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Messages will be cascade deleted via FK
            await dbRun('DELETE FROM conversations WHERE id = ?', [id]);

            logger.info(`[Conversations] Deleted: ${id} by user ${req.userId}`);

            return res.json({ success: true, deleted: id });
        } catch (err: any) {
            logger.error('[Conversations] Delete error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== ADD MESSAGE ====================

router.post(
    '/:id/messages',
    verifyToken,
    validateParams(ConversationIdParamSchema),
    validateBody(AddMessageSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id: conversationId } = req.params;
        const { role, content, messageType, metadata, tokenCount, modelUsed } = req.body;

        try {
            // Verify ownership
            const conversation = await dbGet(
                'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
                [conversationId, req.userId!],
            );

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            const messageId = uuidv4();
            const now = new Date().toISOString();

            await dbRun(
                `
                INSERT INTO conversation_messages (
                    id, conversation_id, role, content, message_type, 
                    metadata, token_count, model_used, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                    messageId,
                    conversationId,
                    role,
                    content,
                    messageType || 'text',
                    metadata ? JSON.stringify(metadata) : '{}',
                    tokenCount || null,
                    modelUsed || null,
                    now,
                ],
            );

            // Note: Trigger in DB handles updating conversation metadata

            const message = await dbGet('SELECT * FROM conversation_messages WHERE id = ?', [messageId]);

            return res.status(201).json(message);
        } catch (err: any) {
            logger.error('[Conversations] Add message error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== GENERATE TITLE ====================

router.post(
    '/:id/title/generate',
    verifyToken,
    validateParams(ConversationIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        try {
            // Verify ownership and get current state
            const conversation = (await dbGet(
                'SELECT id, title, title_source, message_count FROM conversations WHERE id = ? AND user_id = ?',
                [id, req.userId!],
            )) as { id: string; title: string; title_source: string; message_count: number } | null;

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Don't regenerate if user set title
            if (conversation.title_source === 'user') {
                return res.json({ skipped: true, reason: 'User-defined title' });
            }

            // Need at least 2 messages (1 user + 1 AI)
            if (conversation.message_count < 2) {
                return res.json({ skipped: true, reason: 'Not enough messages' });
            }

            // Get first few messages for context
            const messages = (await dbAll(
                `
                SELECT role, content 
                FROM conversation_messages 
                WHERE conversation_id = ? 
                ORDER BY created_at ASC 
                LIMIT 4
            `,
                [id],
            )) as Array<{ role: string; content: string }>;

            // Generate title using AI
            const aiPipeline = await import('../services/ai/aiPipeline.js').then((m) => {
                const AIPipelineClass = (m as any).AIPipeline;
                return new AIPipelineClass();
            });

            const messagesContext = messages.map((m) => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');

            const response = await aiPipeline.process({
                type: 'chat',
                capability: 'chat',
                userId: req.userId!,
                organizationId: req.organizationId!,
                prompt: `Generate a short, descriptive title (max 50 chars) for this conversation. Return ONLY the title, no quotes or explanation:\n\n${messagesContext}`,
                stream: false,
            });

            const generatedTitle = ((response as any).text || (response as any).content || 'New conversation')
                .trim()
                .replace(/^["']|["']$/g, '')
                .slice(0, 50);

            // Update conversation title
            await dbRun(
                `UPDATE conversations SET title = ?, title_source = 'auto', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [generatedTitle, id],
            );

            logger.info(`[Conversations] Generated title for ${id}: "${generatedTitle}"`);

            return res.json({ title: generatedTitle });
        } catch (err: any) {
            logger.error('[Conversations] Generate title error:', err);
            // Return success with default title on AI error
            return res.json({ title: 'New conversation', error: err.message });
        }
    }),
);

// ==================== BULK OPERATIONS ====================

router.post(
    '/bulk',
    verifyToken,
    validateBody(BulkOperationSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { ids, action } = req.body;

        try {
            // Verify ownership of all conversations
            const placeholders = ids.map(() => '?').join(',');
            const owned = (await dbAll(
                `SELECT id FROM conversations WHERE id IN (${placeholders}) AND user_id = ?`,
                [...ids, req.userId!],
            )) as Array<{ id: string }>;

            const ownedIds = owned.map((c) => c.id);

            if (ownedIds.length === 0) {
                return res.status(404).json({ error: 'No conversations found' });
            }

            const ownedPlaceholders = ownedIds.map(() => '?').join(',');

            switch (action) {
                case 'archive':
                    await dbRun(
                        `UPDATE conversations SET archived = true, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
                        ownedIds,
                    );
                    break;

                case 'unarchive':
                    await dbRun(
                        `UPDATE conversations SET archived = false, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
                        ownedIds,
                    );
                    break;

                case 'star':
                    await dbRun(
                        `UPDATE conversations SET starred = true, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
                        ownedIds,
                    );
                    break;

                case 'unstar':
                    await dbRun(
                        `UPDATE conversations SET starred = false, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
                        ownedIds,
                    );
                    break;

                case 'delete':
                    await dbRun(`DELETE FROM conversations WHERE id IN (${ownedPlaceholders})`, ownedIds);
                    break;
            }

            logger.info(`[Conversations] Bulk ${action}: ${ownedIds.length} conversations by user ${req.userId}`);

            return res.json({
                success: true,
                affected: ownedIds.length,
                ids: ownedIds,
            });
        } catch (err: any) {
            logger.error('[Conversations] Bulk operation error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

// ==================== MIGRATE FROM LOCALSTORAGE ====================

router.post(
    '/migrate',
    verifyToken,
    validateBody(MigrateConversationsSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { conversations } = req.body;

        try {
            const migrated: Array<{ conversationId: string; messageCount: number }> = [];

            for (const conv of conversations) {
                if (!conv.messages || conv.messages.length === 0) continue;

                const conversationId = uuidv4();
                const now = new Date().toISOString();

                // Create conversation
                await dbRun(
                    `
                    INSERT INTO conversations (
                        id, user_id, organization_id, project_id, 
                        title, title_source, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, 'auto', ?, ?)
                `,
                    [
                        conversationId,
                        req.userId!,
                        req.organizationId || null,
                        conv.projectId || null,
                        'Migrated conversation',
                        now,
                        now,
                    ],
                );

                // Add messages
                for (const msg of conv.messages) {
                    const messageId = uuidv4();
                    const timestamp = msg.timestamp || now;

                    await dbRun(
                        `
                        INSERT INTO conversation_messages (
                            id, conversation_id, role, content, message_type, created_at
                        ) VALUES (?, ?, ?, ?, 'text', ?)
                    `,
                        [messageId, conversationId, msg.role === 'model' ? 'ai' : msg.role, msg.content, timestamp],
                    );
                }

                migrated.push({
                    conversationId,
                    messageCount: conv.messages.length,
                });
            }

            logger.info(`[Conversations] Migrated ${migrated.length} conversations for user ${req.userId}`);

            return res.json({
                success: true,
                migrated,
            });
        } catch (err: any) {
            logger.error('[Conversations] Migration error:', err);
            return res.status(500).json({ error: err.message });
        }
    }),
);

export default router;
