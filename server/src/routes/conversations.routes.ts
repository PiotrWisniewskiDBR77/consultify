// @ts-nocheck
/**
 * Conversations Routes
 * Full CRUD API for AI Chat Conversation History
 *
 * Supports both PERSONAL and TEAM conversations.
 * Team conversations live inside team-scope chat_projects and are visible
 * to all organization members. Permission checks use chatPermissionService.
 *
 * Endpoints:
 * - GET    /api/conversations              - List user's conversations (personal + team)
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
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../middleware/validation.middleware.js';
import { checkChatPermission } from '../services/chatPermissionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

// ==================== HELPERS ====================

/**
 * Check if a conversation belongs to a team-scope chat project.
 * Returns the chat_project row (with scope & organization_id) or null.
 */
async function getTeamProjectForConversation(conversationId: string): Promise<{
  id: string;
  scope: string;
  organization_id: string;
} | null> {
  try {
    const row = await dbGet(
      `SELECT cp.id, cp.scope, cp.organization_id
       FROM conversations c
       JOIN chat_projects cp ON c.chat_project_id = cp.id
       WHERE c.id = ? AND cp.scope = 'team'`,
      [conversationId]
    );
    return (row as any) || null;
  } catch {
    return null;
  }
}

/**
 * Check if user can access a conversation (personal ownership OR team membership).
 * Returns the conversation row if accessible, null otherwise.
 */
async function findAccessibleConversation(
  conversationId: string,
  userId: string,
  organizationId?: string
): Promise<any | null> {
  // Try personal ownership first (fast path)
  const personal = await dbGet('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [
    conversationId,
    userId,
  ]);
  if (personal) return personal;

  // Try team access: conversation is in a team-scope project the user's org owns
  if (organizationId) {
    const team = await dbGet(
      `SELECT c.* FROM conversations c
       JOIN chat_projects cp ON c.chat_project_id = cp.id
       WHERE c.id = ?
         AND cp.scope = 'team'
         AND cp.organization_id = ?`,
      [conversationId, organizationId]
    );
    if (team) return team;
  }

  return null;
}

// ==================== VALIDATORS ====================

const ListConversationsQuerySchema = z.object({
  archived: z.enum(['true', 'false']).optional(),
  starred: z.enum(['true', 'false']).optional(),
  projectId: z.string().uuid().optional(),
  chatProjectId: z.string().uuid().optional(),
  /** 'personal' | 'team' | 'all' (default: 'all') */
  scope: z.enum(['personal', 'team', 'all']).optional(),
  search: z.string().max(200).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

const CreateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  projectId: z.string().uuid().optional(),
  chatProjectId: z.string().uuid().optional(),
  pmoContext: z.record(z.unknown()).optional(),
  language: z.enum(['en', 'pl', 'de', 'ar', 'jp', 'es']).optional(),
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
  language: z.enum(['en', 'pl', 'de', 'ar', 'jp', 'es']).optional(),
});

const AddMessageSchema = z.object({
  role: z.enum(['user', 'ai']),
  content: z.string().min(1),
  messageType: z
    .enum(['text', 'action_request', 'summary', 'file', 'tool_call', 'voice'])
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  tokenCount: z.number().int().positive().optional(),
  modelUsed: z.string().max(100).optional(),
});

const TruncateConversationSchema = z.object({
  /** Message ID to keep (inclusive). All later messages will be removed. */
  afterMessageId: z.string().min(1),
  /** Optional edited content for that message (typically a user message edit). */
  editedContent: z.string().min(1).optional(),
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
        })
      ),
    })
  ),
});

// ==================== LIST CONVERSATIONS ====================

router.get(
  '/',
  verifyToken,
  validateQuery(ListConversationsQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      archived,
      starred,
      projectId,
      chatProjectId,
      scope: scopeFilter,
      search,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string | undefined>;

    const limit = parseInt(limitStr || '50', 10);
    const offset = parseInt(offsetStr || '0', 10);
    const scope = scopeFilter || 'all';

    try {
      // Build WHERE clause based on scope
      // personal: user's own conversations (no team project or personal project)
      // team: conversations inside team-scope chat_projects where user is org member
      // all: union of both
      let whereClause: string;
      const params: (string | boolean)[] = [];

      if (scope === 'personal') {
        whereClause = `WHERE c.user_id = ?`;
        params.push(req.userId!);
        // Exclude conversations in team projects (they show under 'team')
        whereClause += ` AND (c.chat_project_id IS NULL OR cp.scope IS NULL OR cp.scope = 'personal')`;
      } else if (scope === 'team') {
        if (!req.organizationId) {
          return res.json({ conversations: [], total: 0, limit, offset });
        }
        whereClause = `WHERE cp.scope = 'team' AND cp.organization_id = ?`;
        params.push(req.organizationId);
      } else {
        // scope === 'all': personal + team
        whereClause = `WHERE (c.user_id = ?`;
        params.push(req.userId!);
        if (req.organizationId) {
          whereClause += ` OR (cp.scope = 'team' AND cp.organization_id = ?)`;
          params.push(req.organizationId);
        }
        whereClause += `)`;
      }

      if (archived !== undefined) {
        whereClause += ' AND c.archived = ?';
        params.push(archived === 'true');
      }

      if (starred !== undefined) {
        whereClause += ' AND c.starred = ?';
        params.push(starred === 'true');
      }

      if (projectId) {
        whereClause += ' AND c.project_id = ?';
        params.push(projectId);
      }

      if (chatProjectId) {
        whereClause += ' AND c.chat_project_id = ?';
        params.push(chatProjectId);
      }

      if (search) {
        whereClause += ' AND (c.title ILIKE ? OR c.last_message_preview ILIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Use LEFT JOIN to chat_projects to resolve scope
      const fromClause = `FROM conversations c LEFT JOIN chat_projects cp ON c.chat_project_id = cp.id`;

      // Get total count
      const countResult = (await dbGet(
        `SELECT COUNT(*) as total ${fromClause} ${whereClause}`,
        params
      )) as { total: number };

      // Get conversations (include created_by for team display)
      const conversations = await dbAll(
        `
                SELECT 
                    c.id, c.title, c.title_source, c.project_id, c.chat_project_id,
                    c.organization_id, c.created_by,
                    c.starred, c.archived, c.tags, c.pmo_context, c.language,
                    c.message_count, c.last_message_preview, c.last_message_at,
                    c.created_at, c.updated_at,
                    cp.scope as chat_project_scope
                ${fromClause}
                ${whereClause}
                ORDER BY 
                    CASE WHEN c.starred = true THEN 0 ELSE 1 END,
                    COALESCE(c.last_message_at, c.updated_at) DESC
                LIMIT ? OFFSET ?
            `,
        [...params, limit, offset]
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
  })
);

// ==================== CREATE CONVERSATION ====================

router.post(
  '/',
  verifyToken,
  validateBody(CreateConversationSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, projectId, chatProjectId, pmoContext, language } = req.body;

    try {
      const id = uuidv4();
      const now = new Date().toISOString();

      // If chatProjectId points to a team project, check add_message permission
      if (chatProjectId) {
        try {
          const cp = await dbGet(`SELECT scope, organization_id FROM chat_projects WHERE id = ?`, [
            chatProjectId,
          ]);
          if ((cp as any)?.scope === 'team' && (cp as any)?.organization_id) {
            const perm = await checkChatPermission(
              req.userId!,
              (cp as any).organization_id,
              'create_thread'
            );
            if (!perm.allowed) {
              return res
                .status(403)
                .json({ error: 'No permission to create thread in this team project' });
            }
          }
        } catch {
          /* graceful: proceed if check fails */
        }
      }

      await dbRun(
        `
                INSERT INTO conversations (
                    id, user_id, organization_id, project_id, chat_project_id,
                    created_by, title, title_source, pmo_context, language,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          id,
          req.userId!,
          req.organizationId || null,
          projectId || null,
          chatProjectId || null,
          req.userId!, // created_by
          title || 'New conversation',
          title ? 'user' : 'auto',
          pmoContext ? JSON.stringify(pmoContext) : '{}',
          language || 'en',
          now,
          now,
        ]
      );

      const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [id]);

      logger.info(`[Conversations] Created: ${id} for user ${req.userId}`);

      return res.status(201).json(conversation);
    } catch (err: any) {
      logger.error('[Conversations] Create error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== GET CONVERSATION WITH MESSAGES ====================

router.get(
  '/:id',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      // Get conversation (personal ownership or team membership)
      const conversation = await findAccessibleConversation(id, req.userId!, req.organizationId);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Get messages (include author info for team display)
      const messages = await dbAll(
        `
                SELECT cm.id, cm.conversation_id, cm.role, cm.content, cm.message_type,
                       cm.metadata, cm.token_count, cm.model_used, cm.author_user_id,
                       cm.created_at,
                       u.name as author_name, u.email as author_email
                FROM conversation_messages cm
                LEFT JOIN users u ON cm.author_user_id = u.id
                WHERE cm.conversation_id = ?
                ORDER BY cm.created_at ASC
            `,
        [id]
      );

      return res.json({
        ...conversation,
        messages,
      });
    } catch (err: any) {
      logger.error('[Conversations] Get error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
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
      // Verify access (personal or team)
      const existing = (await findAccessibleConversation(
        id,
        req.userId!,
        req.organizationId
      )) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // For team conversations, check manage_thread permission
      const teamProject = await getTeamProjectForConversation(id);
      if (teamProject) {
        const isCreator = existing.created_by === req.userId;
        const perm = await checkChatPermission(
          req.userId!,
          teamProject.organization_id,
          'manage_thread',
          { isCreator }
        );
        if (!perm.allowed) {
          return res.status(403).json({ error: 'No permission to update this team conversation' });
        }
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

      if (updates.language !== undefined) {
        setClauses.push('language = ?');
        params.push(updates.language);
      }

      params.push(id);

      await dbRun(`UPDATE conversations SET ${setClauses.join(', ')} WHERE id = ?`, params);

      const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [id]);

      return res.json(conversation);
    } catch (err: any) {
      logger.error('[Conversations] Update error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== DELETE CONVERSATION ====================

router.delete(
  '/:id',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      // Verify access (personal or team)
      const existing = (await findAccessibleConversation(
        id,
        req.userId!,
        req.organizationId
      )) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // For team conversations, check manage_thread permission
      const teamProject = await getTeamProjectForConversation(id);
      if (teamProject) {
        const isCreator = existing.created_by === req.userId;
        const perm = await checkChatPermission(
          req.userId!,
          teamProject.organization_id,
          'manage_thread',
          { isCreator }
        );
        if (!perm.allowed) {
          return res.status(403).json({ error: 'No permission to delete this team conversation' });
        }
      }

      // Messages will be cascade deleted via FK
      await dbRun('DELETE FROM conversations WHERE id = ?', [id]);

      logger.info(`[Conversations] Deleted: ${id} by user ${req.userId}`);

      return res.json({ success: true, deleted: id });
    } catch (err: any) {
      logger.error('[Conversations] Delete error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
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
      // Verify access (personal ownership or team membership)
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // For team conversations, check add_message permission
      const teamProject = await getTeamProjectForConversation(conversationId);
      if (teamProject) {
        const perm = await checkChatPermission(
          req.userId!,
          teamProject.organization_id,
          'add_message'
        );
        if (!perm.allowed) {
          return res
            .status(403)
            .json({ error: 'No permission to add messages to this team conversation' });
        }
      }

      const messageId = uuidv4();
      const now = new Date().toISOString();
      // Set author_user_id for user messages (null for AI messages)
      const authorUserId = role === 'user' ? req.userId! : null;

      await dbRun(
        `
                INSERT INTO conversation_messages (
                    id, conversation_id, role, content, message_type, 
                    metadata, token_count, model_used, author_user_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          authorUserId,
          now,
        ]
      );

      // Note: Trigger in DB handles updating conversation metadata

      const message = await dbGet(
        `SELECT cm.*, u.name as author_name, u.email as author_email
         FROM conversation_messages cm
         LEFT JOIN users u ON cm.author_user_id = u.id
         WHERE cm.id = ?`,
        [messageId]
      );

      return res.status(201).json(message);
    } catch (err: any) {
      logger.error('[Conversations] Add message error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== TRUNCATE / EDIT FROM MESSAGE ====================
// ChatGPT-like: edit a user message and regenerate from that point.
router.post(
  '/:id/truncate',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  validateBody(TruncateConversationSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId } = req.params;
    const { afterMessageId, editedContent } = req.body as {
      afterMessageId: string;
      editedContent?: string;
    };

    try {
      // Verify access (personal ownership or team membership)
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // For team conversations, require permission (reuse add_message for now)
      const teamProject = await getTeamProjectForConversation(conversationId);
      if (teamProject) {
        const perm = await checkChatPermission(
          req.userId!,
          teamProject.organization_id,
          'add_message'
        );
        if (!perm.allowed) {
          return res.status(403).json({ error: 'No permission to edit this team conversation' });
        }
      }

      const target = await dbGet(
        `SELECT * FROM conversation_messages WHERE id = ? AND conversation_id = ?`,
        [afterMessageId, conversationId]
      );
      if (!target) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const now = new Date().toISOString();
      const beforeCountRow = (await dbGet(
        `SELECT COUNT(*) as count FROM conversation_messages WHERE conversation_id = ?`,
        [conversationId]
      )) as any;
      const beforeCount = Number(beforeCountRow?.count || 0);

      // Optionally update message content (edit) + store edit history (best-effort)
      if (editedContent && String(target.role) === 'user') {
        try {
          await dbRun(
            `INSERT INTO message_edits (id, message_id, original_content, edited_content, edited_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), afterMessageId, target.content, editedContent, req.userId!, now]
          );
        } catch (_e) {
          // message_edits table might not exist in some environments; ignore
        }

        // Increment version if column exists (SQLite handles missing columns by error; ignore)
        try {
          await dbRun(
            `UPDATE conversation_messages
             SET content = ?, version = COALESCE(version, 1) + 1
             WHERE id = ? AND conversation_id = ?`,
            [editedContent, afterMessageId, conversationId]
          );
        } catch {
          await dbRun(
            `UPDATE conversation_messages SET content = ? WHERE id = ? AND conversation_id = ?`,
            [editedContent, afterMessageId, conversationId]
          );
        }
      }

      // Delete all messages strictly after the target timestamp.
      // Also delete same-timestamp messages except the target (best-effort ordering).
      await dbRun(
        `DELETE FROM conversation_messages WHERE conversation_id = ? AND created_at > ?`,
        [conversationId, target.created_at]
      );
      await dbRun(
        `DELETE FROM conversation_messages WHERE conversation_id = ? AND created_at = ? AND id != ?`,
        [conversationId, target.created_at, afterMessageId]
      );

      const afterCountRow = (await dbGet(
        `SELECT COUNT(*) as count FROM conversation_messages WHERE conversation_id = ?`,
        [conversationId]
      )) as any;
      const afterCount = Number(afterCountRow?.count || 0);
      const deletedCount = Math.max(0, beforeCount - afterCount);

      const last = await dbGet(
        `SELECT content, created_at FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
        [conversationId]
      );

      await dbRun(
        `UPDATE conversations
         SET message_count = ?, last_message_preview = ?, last_message_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          afterCount,
          last ? String((last as any).content || '').slice(0, 200) : null,
          last ? (last as any).created_at : null,
          now,
          conversationId,
        ]
      );

      return res.json({ success: true, deletedCount });
    } catch (err: any) {
      logger.error('[Conversations] Truncate error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== GENERATE TITLE ====================

router.post(
  '/:id/title/generate',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      // Verify access (personal or team)
      const conversation = (await findAccessibleConversation(
        id,
        req.userId!,
        req.organizationId
      )) as {
        id: string;
        title: string;
        title_source: string;
        message_count: number;
      } | null;

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
        [id]
      )) as Array<{ role: string; content: string }>;

      // Generate title using AI
      const aiPipeline = await import('../services/ai/AIPipeline.js').then((m) => {
        const AIPipelineClass = (m as any).AIPipeline;
        return new AIPipelineClass();
      });

      const messagesContext = messages
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n');

      // Helper: heuristic title from first user message
      const heuristicTitle = (): string => {
        const firstUserMsg = messages.find((m) => m.role === 'user');
        if (firstUserMsg?.content) {
          const cleaned = firstUserMsg.content
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          return cleaned.length > 50 ? cleaned.slice(0, 47) + '...' : cleaned;
        }
        return 'New conversation';
      };

      let generatedTitle: string;

      // Try AI generation only if organizationId is available
      if (req.organizationId) {
        try {
          const response = await aiPipeline.process({
            type: 'chat',
            capability: 'chat',
            userId: req.userId!,
            organizationId: req.organizationId,
            prompt: `Generate a short, descriptive title (max 50 chars) for this conversation. Return ONLY the title, no quotes or explanation:\n\n${messagesContext}`,
            stream: false,
          });

          generatedTitle = (
            (response as any).text ||
            (response as any).content ||
            ''
          )
            .trim()
            .replace(/^["']|["']$/g, '')
            .slice(0, 50);

          // If AI returned empty or default, fall back to heuristic
          if (!generatedTitle || generatedTitle === 'New conversation') {
            generatedTitle = heuristicTitle();
          }
        } catch (aiErr: any) {
          logger.warn(`[Conversations] AI title generation failed for ${id}, using heuristic:`, aiErr?.message);
          generatedTitle = heuristicTitle();
        }
      } else {
        logger.info(`[Conversations] No organizationId for ${id}, using heuristic title`);
        generatedTitle = heuristicTitle();
      }

      // Update conversation title
      await dbRun(
        `UPDATE conversations SET title = ?, title_source = 'auto', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [generatedTitle, id]
      );

      logger.info(`[Conversations] Generated title for ${id}: "${generatedTitle}"`);

      return res.json({ title: generatedTitle });
    } catch (err: any) {
      logger.error('[Conversations] Generate title error:', err);
      // Return error status instead of masking failure
      return res.status(500).json({ error: 'Title generation failed', details: err.message });
    }
  })
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
        [...ids, req.userId!]
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
            ownedIds
          );
          break;

        case 'unarchive':
          await dbRun(
            `UPDATE conversations SET archived = false, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
            ownedIds
          );
          break;

        case 'star':
          await dbRun(
            `UPDATE conversations SET starred = true, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
            ownedIds
          );
          break;

        case 'unstar':
          await dbRun(
            `UPDATE conversations SET starred = false, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
            ownedIds
          );
          break;

        case 'delete':
          await dbRun(`DELETE FROM conversations WHERE id IN (${ownedPlaceholders})`, ownedIds);
          break;
      }

      logger.info(
        `[Conversations] Bulk ${action}: ${ownedIds.length} conversations by user ${req.userId}`
      );

      return res.json({
        success: true,
        affected: ownedIds.length,
        ids: ownedIds,
      });
    } catch (err: any) {
      logger.error('[Conversations] Bulk operation error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
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
          ]
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
            [
              messageId,
              conversationId,
              msg.role === 'model' ? 'ai' : msg.role,
              msg.content,
              timestamp,
            ]
          );
        }

        migrated.push({
          conversationId,
          messageCount: conv.messages.length,
        });
      }

      logger.info(
        `[Conversations] Migrated ${migrated.length} conversations for user ${req.userId}`
      );

      return res.json({
        success: true,
        migrated,
      });
    } catch (err: any) {
      logger.error('[Conversations] Migration error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== CONVERSATION SUMMARY ====================

/**
 * POST /api/conversations/:id/summarize
 *
 * Summarizes older messages in a conversation to keep context windows manageable.
 * Keeps the last `keepRecent` messages (default 10) untouched and condenses
 * everything before them into a single summary message.
 *
 * Returns: { summary: string, condensedCount: number, remainingCount: number }
 */
router.post(
  '/:id/summarize',
  verifyToken,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const keepRecent = Math.max(4, Math.min(30, Number(req.body?.keepRecent) || 10));

    try {
      // 1. Fetch all messages
      const messages: any[] = await dbAll(
        `SELECT id, role, content, message_type, created_at
         FROM messages WHERE conversation_id = ?
         ORDER BY created_at ASC`,
        [id]
      );

      if (messages.length <= keepRecent) {
        return res.json({
          summary: null,
          condensedCount: 0,
          remainingCount: messages.length,
          skipped: true,
          reason: `Only ${messages.length} messages — no summarization needed`,
        });
      }

      // 2. Split: older messages to summarize vs recent to keep
      const toSummarize = messages.slice(0, messages.length - keepRecent);
      const recentMessages = messages.slice(messages.length - keepRecent);

      // 3. Build a transcript of older messages
      const transcript = toSummarize
        .map((m: any) => `[${m.role}]: ${String(m.content || '').slice(0, 500)}`)
        .join('\n');

      // 4. Use LLM to summarize (lazy-load pipeline to avoid circular deps)
      let summaryText: string;
      try {
        const { AIPipeline: PipelineClass } = await import('../services/ai/AIPipeline.js');
        const pipeline = new PipelineClass();
        const result = await pipeline.process({
          prompt: `Summarize the following conversation transcript in 3-5 concise bullet points. Focus on key topics, decisions, and action items discussed. Keep it factual and brief.\n\nTranscript:\n${transcript}`,
          capability: 'CHAT',
          userId: req.userId!,
          organizationId: req.organizationId,
          options: { tier: 'BUDGET' },
        });
        summaryText = result.content || 'Summary unavailable.';
      } catch (llmErr: any) {
        logger.warn('[Conversations] LLM summarization failed, using fallback:', llmErr?.message);
        // Fallback: simple extraction
        const userMsgs = toSummarize.filter((m: any) => m.role === 'user');
        summaryText = `Previous conversation (${toSummarize.length} messages) covered: ${userMsgs
          .slice(0, 5)
          .map((m: any) => String(m.content || '').slice(0, 80))
          .join('; ')}`;
      }

      // 5. Store the summary as a message of type 'summary'
      const summaryId = uuidv4();
      await dbRun(
        `INSERT INTO messages (id, conversation_id, role, content, message_type, created_at)
         VALUES (?, ?, 'ai', ?, 'summary', ?)`,
        [summaryId, id, summaryText, new Date().toISOString()]
      );

      // 6. Optionally soft-delete the summarized messages (mark as condensed)
      // We don't hard-delete to preserve auditability
      const condensedIds = toSummarize.map((m: any) => m.id);
      if (condensedIds.length > 0) {
        // Add metadata flag instead of deleting
        const placeholders = condensedIds.map(() => '?').join(',');
        await dbRun(
          `UPDATE messages SET message_type = 'condensed'
           WHERE id IN (${placeholders}) AND conversation_id = ?`,
          [...condensedIds, id]
        );
      }

      return res.json({
        summary: summaryText,
        summaryMessageId: summaryId,
        condensedCount: condensedIds.length,
        remainingCount: recentMessages.length + 1, // +1 for the new summary message
      });
    } catch (err: any) {
      logger.error('[Conversations] Summarize error:', err);
      return res.status(500).json({ error: err.message });
    }
  })
);

// ==================== SEARCH BY CONTENT ====================

router.get(
  '/search',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = (req.query.q as string || '').trim();
    if (!query || query.length < 2) {
      return res.json({ conversations: [] });
    }

    try {
      const searchPattern = `%${query}%`;

      // Search in conversation titles and message content
      const results = (await dbAll(
        `SELECT DISTINCT c.id, c.title, c.updated_at, c.project_id, c.is_starred,
                c.pmo_context, c.title_source
         FROM conversations c
         LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
         WHERE c.user_id = ?
           AND c.is_archived = 0
           AND (c.title LIKE ? OR cm.content LIKE ?)
         ORDER BY c.updated_at DESC
         LIMIT 20`,
        [req.userId!, searchPattern, searchPattern]
      )) as any[];

      return res.json({
        conversations: results.map((c: any) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updated_at,
          projectId: c.project_id,
          isStarred: c.is_starred === 1,
          titleSource: c.title_source,
          pmoContext: c.pmo_context ? JSON.parse(c.pmo_context) : null,
        })),
        query,
      });
    } catch (err: any) {
      logger.error('[Conversations] Search error:', err);
      return res.status(500).json({ error: 'Search failed' });
    }
  })
);

// ==================== AUTO-ARCHIVE STALE CONVERSATIONS ====================

router.post(
  '/auto-archive',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const daysOld = parseInt(req.body.daysOld) || 30;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await dbRun(
        `UPDATE conversations 
         SET is_archived = 1, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?
           AND is_archived = 0
           AND is_starred = 0
           AND updated_at < ?
           AND title != 'New conversation'`,
        [req.userId!, cutoffDate.toISOString()]
      );

      const archivedCount = (result as any)?.changes || 0;

      logger.info(`[Conversations] Auto-archived ${archivedCount} conversations for user ${req.userId}`);

      return res.json({
        archived: archivedCount,
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (err: any) {
      logger.error('[Conversations] Auto-archive error:', err);
      return res.status(500).json({ error: 'Auto-archive failed' });
    }
  })
);

export default router;
