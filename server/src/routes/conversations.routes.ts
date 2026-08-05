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
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';

const router = Router();

function resolveConversationCorrelationId(req: AuthRequest): string | null {
  return (req as any).correlationId || req.get('X-Correlation-ID') || null;
}

function buildConversationFailClosedError(
  req: AuthRequest,
  statusCode: number,
  code: string,
  message: string
) {
  return {
    status: statusCode >= 500 ? 'error' : 'fail',
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
    correlationId: resolveConversationCorrelationId(req),
  };
}

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
 * Includes soft-deleted conversations (caller decides how to handle deleted_at).
 */
async function findAccessibleConversation(
  conversationId: string,
  userId: string,
  organizationId?: string
): Promise<any | null> {
  // Try personal ownership first (fast path). Ownership alone is not enough:
  // a conversation belongs to the organization context it was created in.
  // Without the org filter, a user who switches organizations can keep reading
  // and writing a conversation from the previous org (feedback 79802ad8 —
  // Elkomtech user resumed an April dbr77 conversation after the switch).
  // NULL organization_id = legacy rows from before the column existed; those
  // stay accessible in any org context.
  const personal = organizationId
    ? await dbGet(
        `SELECT * FROM conversations
         WHERE id = ? AND user_id = ? AND (organization_id = ? OR organization_id IS NULL)`,
        [conversationId, userId, organizationId]
      )
    : await dbGet('SELECT * FROM conversations WHERE id = ? AND user_id = ?', [
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
  /** Cursor-based pagination: "lastMessageAt|id" — preferred over offset */
  cursor: z.string().optional(),
});

const CreateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  projectId: z.string().uuid().optional(),
  chatProjectId: z.string().uuid().optional(),
  pmoContext: z.record(z.string(), z.unknown()).optional(),
  language: z.enum(['en', 'pl', 'de', 'ar', 'jp', 'es']).optional(),
});

const ConversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

const ConversationMessageParamSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().min(1),
});

const UpdateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  titleSource: z.enum(['auto', 'user']).optional(),
  starred: z.boolean().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  pmoContext: z.record(z.string(), z.unknown()).optional(),
  chatProjectId: z.string().uuid().nullable().optional(),
  language: z.enum(['en', 'pl', 'de', 'ar', 'jp', 'es']).optional(),
  /** Optimistic concurrency: expected version for conflict detection (§2.3.5 E9) */
  expectedVersion: z.number().int().positive().optional(),
});

const AddMessageSchema = z.object({
  role: z.enum(['user', 'ai']),
  content: z.string().min(1),
  messageType: z
    .enum([
      'text',
      'action_request',
      'summary',
      'file',
      'tool_call',
      'voice',
      // V8: governed proposal + execution message family (CHAT_V8_ACTIONS_AND_APPROVALS)
      'execution_proposal',
      'execution_progress',
      'execution_result',
    ])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenCount: z.number().int().positive().optional(),
  modelUsed: z.string().max(100).optional(),
  /** Idempotency key (client-generated) so a retried/duplicated POST collapses to one row. */
  clientMessageId: z.string().min(1).max(128).optional(),
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
      cursor: cursorParam,
    } = req.query as Record<string, string | undefined>;

    const limit = parseInt(limitStr || '50', 10);
    const offset = parseInt(offsetStr || '0', 10);
    const scope = scopeFilter || 'all';
    const useCursor = Boolean(cursorParam);

    try {
      // P34 policy gateway: resolve team read permission before listing (§2.3.3)
      let teamReadAllowed = false;
      if (req.organizationId) {
        const perm = await checkChatPermission(req.userId!, req.organizationId, 'read');
        teamReadAllowed = perm.allowed;
      }

      // Build WHERE clause based on scope (governed by P34 permission)
      let whereClause: string;
      const params: (string | boolean)[] = [];

      // Personal conversations are scoped to the org context they were created in
      // (feedback 79802ad8: after an org switch the list kept showing — and let the
      // user resume — conversations from the previous organization). NULL = legacy
      // rows, visible everywhere.
      const personalOrgFilter = req.organizationId
        ? ` AND (c.organization_id = ? OR c.organization_id IS NULL)`
        : '';

      if (scope === 'personal') {
        whereClause = `WHERE c.user_id = ?`;
        params.push(req.userId!);
        if (personalOrgFilter) {
          whereClause += personalOrgFilter;
          params.push(req.organizationId!);
        }
        whereClause += ` AND (c.chat_project_id IS NULL OR cp.scope IS NULL OR cp.scope = 'personal')`;
      } else if (scope === 'team') {
        if (!req.organizationId || !teamReadAllowed) {
          return res.json({ conversations: [], total: 0, limit, offset });
        }
        whereClause = `WHERE cp.scope = 'team' AND cp.organization_id = ?`;
        params.push(req.organizationId);
      } else {
        // scope === 'all': personal + team (team only if P34 allows read)
        whereClause = `WHERE ((c.user_id = ?${personalOrgFilter})`;
        params.push(req.userId!);
        if (personalOrgFilter) {
          params.push(req.organizationId!);
        }
        if (teamReadAllowed && req.organizationId) {
          whereClause += ` OR (cp.scope = 'team' AND cp.organization_id = ?)`;
          params.push(req.organizationId);
        }
        whereClause += `)`;
      }

      // Exclude soft-deleted conversations by default
      whereClause += ` AND c.deleted_at IS NULL`;

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

      // Cursor-based pagination (preferred over offset)
      if (useCursor && cursorParam) {
        const [cursorTs, cursorId] = cursorParam.split('|');
        if (cursorTs && cursorId) {
          whereClause += ` AND (COALESCE(c.last_message_at, c.updated_at) < ? OR (COALESCE(c.last_message_at, c.updated_at) = ? AND c.id < ?))`;
          params.push(cursorTs, cursorTs, cursorId);
        }
      }

      // Use LEFT JOIN to chat_projects to resolve scope
      const fromClause = `FROM conversations c LEFT JOIN chat_projects cp ON c.chat_project_id = cp.id`;

      // Get total count
      const countResult = (await dbGet(
        `SELECT COUNT(*) as total ${fromClause} ${whereClause}`,
        params
      )) as { total: number };

      // Get conversations (include created_by for team display)
      const fetchLimit = useCursor ? limit + 1 : limit;
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
                    COALESCE(c.last_message_at, c.updated_at) DESC,
                    c.id DESC
                LIMIT ? ${useCursor ? '' : 'OFFSET ?'}
            `,
        useCursor ? [...params, fetchLimit] : [...params, fetchLimit, offset]
      );

      if (useCursor) {
        const hasMore = conversations.length > limit;
        const page = hasMore ? conversations.slice(0, limit) : conversations;
        let nextCursor: string | null = null;
        if (hasMore && page.length > 0) {
          const last = page[page.length - 1] as any;
          nextCursor = `${last.last_message_at || last.updated_at}|${last.id}`;
        }
        return res.json({
          conversations: page,
          total: countResult?.total || 0,
          nextCursor,
          hasMore,
          limit,
        });
      }

      return res.json({
        conversations,
        total: countResult?.total || 0,
        limit,
        offset,
      });
    } catch (err: any) {
      logger.error('[Conversations] List error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to list conversations', code: 'CONVERSATIONS_LIST_FAILED' });
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
              return res.status(403).json({
                error: 'No permission to create thread in this team project',
                reason: perm.reason,
                role: perm.role,
              });
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

      // Create initial session (§2.3.1 — runtime snapshot)
      try {
        await dbRun(
          `INSERT INTO conversation_sessions (id, conversation_id, locale, started_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), id, language || 'en', now, now]
        );
      } catch {
        // Session table may not exist yet; non-blocking
      }

      const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [id]);

      logger.info(`[Conversations] Created: ${id} for user ${req.userId}`);

      return res.status(201).json(conversation);
    } catch (err: any) {
      logger.error('[Conversations] Create error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json({ error: 'Failed to create conversation', code: 'CONVERSATIONS_CREATE_FAILED' });
    }
  })
);

// ==================== SEARCH BY CONTENT (server-side target) ====================
//
// M01-002 (P1): registered BEFORE GET /:id on purpose. Express matches routes
// in registration order; GET /:id validates its param as a UUID and
// validateParams answers a hard 400 without calling next() on mismatch, so
// while this route was registered ~1250 lines further down, every request to
// /search was swallowed by /:id first and this handler was dead code on
// origin/demo. See
// docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/orchestration/packets/M01-P02_PACKET.md
// §3.1 and M01-P00_DISCOVERY.md §4.3/§8.2.

// Snippet highlighting is delimited with control characters, never HTML:
// message content is arbitrary user input, so returning raw <mark>...</mark>
// around a hit would hand the client markup it has to trust not to be
// malicious (verified against Postgres 16: ts_headline does not escape the
// text it highlights — a message containing `<img src=x onerror=alert(1)>`
// comes back byte-for-byte). These control-character delimiters are parsed
// and stripped server-side; only {text, mark} segments cross the API
// boundary, so the client renders inert text nodes and message content can
// never be interpreted as markup.
const SNIPPET_MARK_START = '\u0002';
const SNIPPET_MARK_END = '\u0003';

interface ConversationSnippetSegment {
  text: string;
  mark: boolean;
}

function parseConversationSnippetSegments(raw: unknown): ConversationSnippetSegment[] | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const segments: ConversationSnippetSegment[] = [];
  for (const chunk of raw.split(SNIPPET_MARK_START)) {
    const [highlighted, ...rest] = chunk.split(SNIPPET_MARK_END);
    if (rest.length === 0) {
      // No closing delimiter: this chunk precedes any highlight.
      if (highlighted) segments.push({ text: highlighted, mark: false });
      continue;
    }
    if (highlighted) segments.push({ text: highlighted, mark: true });
    const tail = rest.join(SNIPPET_MARK_END);
    if (tail) segments.push({ text: tail, mark: false });
  }
  return segments.length > 0 ? segments : null;
}

const SearchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  folderId: z.string().uuid().optional(),
  pinned: z.enum(['true', 'false']).optional(),
  archived: z.enum(['true', 'false']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  hasAttachments: z.enum(['true', 'false']).optional(),
  cursor: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

router.get(
  '/search',
  verifyToken,
  validateQuery(SearchQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const {
      q,
      folderId,
      pinned,
      archived,
      from,
      to,
      cursor: cursorParam,
      limit: limitStr,
    } = req.query as Record<string, string | undefined>;

    const query = (q || '').trim();
    if (!query || query.length < 2) {
      return res.json({ conversations: [], query: '', nextCursor: null });
    }

    const limit = Math.min(parseInt(limitStr || '20', 10), 50);

    try {
      const searchPattern = `%${query}%`;

      // P34 policy gateway: resolve team read permission before search (§2.3.3)
      let teamReadAllowed = false;
      if (req.organizationId) {
        const perm = await checkChatPermission(req.userId!, req.organizationId, 'read');
        teamReadAllowed = perm.allowed;
      }

      // Scope: personal + team (governed by P34 permission check)
      let whereClause = `WHERE (c.user_id = ?`;
      const params: (string | boolean)[] = [req.userId!];

      if (teamReadAllowed && req.organizationId) {
        whereClause += ` OR (cp.scope = 'team' AND cp.organization_id = ?)`;
        params.push(req.organizationId);
      }
      whereClause += `)`;

      // Exclude soft-deleted by default
      whereClause += ` AND c.deleted_at IS NULL`;

      // FTS with ILIKE fallback: use tsvector search on conversations + message content
      whereClause += ` AND (
        (c.search_vector IS NOT NULL AND c.search_vector @@ plainto_tsquery('simple', ?))
        OR EXISTS (SELECT 1 FROM conversation_messages cm2 WHERE cm2.conversation_id = c.id AND to_tsvector('simple', coalesce(cm2.content, '')) @@ plainto_tsquery('simple', ?))
        OR c.title ILIKE ? OR c.last_message_preview ILIKE ?
      )`;
      params.push(query, query, searchPattern, searchPattern);

      // Filters
      if (folderId) {
        whereClause += ` AND c.chat_project_id = ?`;
        params.push(folderId);
      }
      if (pinned !== undefined) {
        whereClause += ` AND c.starred = ?`;
        params.push(pinned === 'true');
      }
      if (archived !== undefined) {
        whereClause += ` AND c.archived = ?`;
        params.push(archived === 'true');
      }
      if (from) {
        whereClause += ` AND COALESCE(c.last_message_at, c.updated_at) >= ?`;
        params.push(from);
      }
      if (to) {
        whereClause += ` AND COALESCE(c.last_message_at, c.updated_at) <= ?`;
        params.push(to);
      }

      // hasAttachments filter (checks conversation_message_attachments table)
      const hasAttachments = (req.query as any).hasAttachments;
      if (hasAttachments === 'true') {
        whereClause += ` AND EXISTS (SELECT 1 FROM conversation_message_attachments cma WHERE cma.conversation_id = c.id)`;
      } else if (hasAttachments === 'false') {
        whereClause += ` AND NOT EXISTS (SELECT 1 FROM conversation_message_attachments cma WHERE cma.conversation_id = c.id)`;
      }

      // Cursor-based pagination: cursor = "lastMessageAt|id"
      if (cursorParam) {
        const [cursorTs, cursorId] = cursorParam.split('|');
        if (cursorTs && cursorId) {
          whereClause += ` AND (COALESCE(c.last_message_at, c.updated_at) < ? OR (COALESCE(c.last_message_at, c.updated_at) = ? AND c.id < ?))`;
          params.push(cursorTs, cursorTs, cursorId);
        }
      }

      // Resolve the earliest matching message per conversation via LATERAL, so
      // a hit can carry matched_message_id + a snippet of the message that
      // actually matched (not just the conversation title/preview). LATERAL
      // params are bound first because the FROM clause precedes WHERE in the
      // final query text — DbPromise translates `?` to `$1, $2, ...` in
      // left-to-right source order.
      const lateralParams: string[] = [query, query];
      const fromClause = `FROM conversations c
         LEFT JOIN chat_projects cp ON c.chat_project_id = cp.id
         LEFT JOIN LATERAL (
           SELECT cm.id,
                  ts_headline('simple', cm.content, plainto_tsquery('simple', ?),
                              'MaxWords=24, MinWords=6, StartSel=${SNIPPET_MARK_START}, StopSel=${SNIPPET_MARK_END}') AS snippet
           FROM conversation_messages cm
           WHERE cm.conversation_id = c.id
             AND to_tsvector('simple', coalesce(cm.content, '')) @@ plainto_tsquery('simple', ?)
           ORDER BY cm.seq ASC NULLS LAST, cm.created_at ASC
           LIMIT 1
         ) m ON TRUE`;

      // Rank: FTS relevance (when available) > pinned > recency
      // ts_rank is parameterized via the WHERE clause match; we add it as a tiebreaker
      params.push(query); // param for ts_rank in ORDER BY
      const orderClause = `ORDER BY CASE WHEN c.starred = true THEN 0 ELSE 1 END, CASE WHEN c.search_vector IS NOT NULL THEN ts_rank(c.search_vector, plainto_tsquery('simple', ?)) ELSE 0 END DESC, COALESCE(c.last_message_at, c.updated_at) DESC, c.id DESC`;

      // No DISTINCT: chat_projects joins 1:1 on its primary key and the
      // LATERAL is capped at one row (LIMIT 1), so rows cannot multiply.
      // Postgres also rejects DISTINCT outright once ts_rank is added to
      // ORDER BY ("for SELECT DISTINCT, ORDER BY expressions must appear in
      // select list") — verified against Postgres 16.
      const results = (await dbAll(
        `SELECT c.id, c.title, c.title_source, c.project_id, c.chat_project_id,
                c.starred, c.archived, c.pmo_context, c.language,
                c.message_count, c.last_message_preview, c.last_message_at,
                c.created_at, c.updated_at,
                cp.scope as chat_project_scope,
                m.id as matched_message_id,
                m.snippet as matched_snippet
         ${fromClause}
         ${whereClause}
         ${orderClause}
         LIMIT ?`,
        [...lateralParams, ...params, limit + 1]
      )) as any[];

      const hasMore = results.length > limit;
      const page = hasMore ? results.slice(0, limit) : results;

      let nextCursor: string | null = null;
      if (hasMore && page.length > 0) {
        const last = page[page.length - 1];
        const ts = last.last_message_at || last.updated_at;
        nextCursor = `${ts}|${last.id}`;
      }

      // Fail-closed on out-of-scope results (M01-P02 packet §3.6/§6:
      // "brak uprawnień nie ujawnia ani treści, ani liczby ukrytych
      // wyników"). `scopeLimited` reflects only the caller's OWN permission
      // state (do they lack team-read at all?) — it is NOT computed from
      // whether this specific query matched anything in team scope, so it
      // carries zero information about hidden content or a hidden count. The
      // previous implementation ran a second COUNT(*) query scoped to the
      // caller's search term and returned that count directly, which let an
      // unauthorized caller learn how many team conversations matched their
      // query term — a content-shaped side channel. Removed.
      const scopeLimited = !teamReadAllowed && Boolean(req.organizationId);

      return res.json({
        conversations: page.map((row) => ({
          ...row,
          matched_snippet: parseConversationSnippetSegments(row.matched_snippet),
        })),
        query,
        nextCursor,
        hasMore,
        scopeLimited,
      });
    } catch (err: any) {
      logger.error('[Conversations] Search error:', err);
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_SEARCH_FAILED',
            'Failed to search conversations.'
          )
        );
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
        return res.status(404).json({ error: 'Conversation not found', state: 'not_found' });
      }

      // Deep-link state: soft-deleted conversation
      if (conversation.deleted_at) {
        return res.json({
          ...conversation,
          messages: [],
          _state: 'deleted',
          _stateMessage: 'This conversation has been deleted.',
        });
      }

      // Deep-link state: archived conversation (still accessible, just flagged)
      const conversationState = conversation.archived ? 'archived' : 'active';

      // Get messages (include author info for team display)
      const messages = await dbAll(
        `
                SELECT cm.id, cm.conversation_id, cm.role, cm.content, cm.message_type,
                       cm.metadata, cm.token_count, cm.model_used, cm.author_user_id,
                       cm.created_at, cm.seq,
                       COALESCE(u.first_name || ' ' || u.last_name, u.email) as author_name, u.email as author_email
                FROM conversation_messages cm
                LEFT JOIN users u ON cm.author_user_id = u.id
                WHERE cm.conversation_id = ?
                ORDER BY cm.seq ASC NULLS LAST, cm.created_at ASC, cm.id ASC
            `,
        [id]
      );

      // Include attachment pointers per message (L4 bridge)
      let attachments: any[] = [];
      try {
        attachments =
          (await dbAll(
            `SELECT id, message_id, kind, target_id, target_url, display_name, mime, size_bytes, created_at
           FROM conversation_message_attachments WHERE conversation_id = ? ORDER BY created_at ASC`,
            [id]
          )) || [];
      } catch {
        /* table may not exist */
      }

      const attachmentsByMessage: Record<string, any[]> = {};
      for (const att of attachments) {
        const mid = (att as any).message_id;
        if (!attachmentsByMessage[mid]) attachmentsByMessage[mid] = [];
        attachmentsByMessage[mid].push(att);
      }

      // M01-036 — hydrate the current viewer's own feedback rating per
      // message. Before this, GET /:id never attached any feedback data, so
      // `msg.feedback` was always undefined on real data and
      // InlineResponseFeedback's `existingFeedback` hydration (wired up
      // ahead of this fix) never had anything to consume — a fresh reopen
      // always re-asked "rate this" even for a message the user already
      // rated.
      //
      // M01-P03B correction to the literal M01-036 wording: it named
      // `ai_feedback`, but that table receives ZERO rows from any reachable
      // chat UI path — the one INSERT that targets it (the legacy
      // `POST /api/ai-feedback` root handler) has no frontend caller
      // (verified: no `submitAIFeedback` call site in `src/`), and its
      // column list (interaction_id/draft_id/feedback_type/model_used)
      // doesn't even match the `ai_feedback` table schema on Postgres. The
      // REAL runtime write path for a thumbs rating —
      // InlineResponseFeedback -> FeedbackLearningService.submitFeedback ->
      // Api.aiFeedback -> POST /api/ai-feedback/response ->
      // adaptiveResponseService.processFeedback — inserts into a DIFFERENT
      // table, `ai_response_feedback`. Joining `ai_feedback` here would have
      // compiled, run, and stayed permanently empty: the exact "looks
      // fixed, isn't" shape already found elsewhere in this module (see the
      // `POST /api/ai/report` atrapa fixed under M01-010). Hydrating from
      // `ai_response_feedback` is what actually round-trips a real rating.
      let feedbackByMessage: Record<string, { rating: string; created_at: string }> = {};
      const messageIdsForFeedback = (messages as any[]).map((m: any) => m.id);
      if (messageIdsForFeedback.length > 0) {
        try {
          const fbPlaceholders = messageIdsForFeedback.map(() => '?').join(',');
          const feedbackRows = (await dbAll(
            `SELECT message_id, rating, created_at
             FROM ai_response_feedback
             WHERE message_id IN (${fbPlaceholders}) AND user_id = ?
             ORDER BY created_at DESC`,
            [...messageIdsForFeedback, req.userId!]
          )) as Array<{ message_id: string; rating: string; created_at: string }>;
          for (const row of feedbackRows) {
            // ORDER BY created_at DESC — first row seen per message_id is the
            // most recent rating, which is what "already rated" should show
            // if the user rated the same message more than once.
            if (!feedbackByMessage[row.message_id]) {
              feedbackByMessage[row.message_id] = {
                rating: row.rating,
                created_at: row.created_at,
              };
            }
          }
        } catch {
          /* table may not exist (pre-migration DB) */
        }
      }

      const messagesWithAttachments = (messages as any[]).map((m: any) => {
        const fb = feedbackByMessage[m.id];
        return {
          ...m,
          attachments: attachmentsByMessage[m.id] || [],
          feedback: fb ? { rating: fb.rating, createdAt: fb.created_at } : undefined,
        };
      });

      return res.json({
        ...conversation,
        messages: messagesWithAttachments,
        _state: conversationState,
      });
    } catch (err: any) {
      // Read — but this is the primary content of the screen (opening a chat with
      // its messages), not a side enrichment. Stays fail-closed: real 500 + code,
      // no err.message leak (H6.4).
      logger.error('[Conversations] Get error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_GET_FAILED',
            'Failed to load the conversation.'
          )
        );
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
          return res.status(403).json({
            error: 'No permission to update this team conversation',
            reason: perm.reason,
            role: perm.role,
          });
        }
      }

      // Optimistic concurrency control (§2.3.5 E9)
      if (updates.expectedVersion !== undefined) {
        const currentVersion = (existing as any).version || 1;
        if (currentVersion !== updates.expectedVersion) {
          return res.status(409).json({
            error:
              'Conflict: conversation was modified by another session. Please refresh and retry.',
            code: 'VERSION_CONFLICT',
            currentVersion,
            expectedVersion: updates.expectedVersion,
          });
        }
      }

      // Build update query. Keep it schema-tolerant: older staging schemas do not
      // have the optimistic `version` column yet, and failing the whole update
      // makes rename/folder moves look successful in the UI but disappear later.
      const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const params: (string | boolean | null)[] = [];

      if (updates.title !== undefined) {
        setClauses.push('title = ?');
        setClauses.push('title_source = ?');
        params.push(updates.title, updates.titleSource || 'user');
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

      const updateResult = await dbRun(
        `UPDATE conversations SET ${setClauses.join(', ')} WHERE id = ?`,
        params,
        { fallback: false }
      );
      if (updateResult.success === false) {
        return res.status(500).json({ error: updateResult.error || 'Conversation update failed' });
      }

      const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [id]);

      return res.json(conversation);
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[Conversations] Update error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_UPDATE_FAILED',
            'Failed to update the conversation.'
          )
        );
    }
  })
);

// ==================== DELETE CONVERSATION (soft-delete with grace) ====================

router.delete(
  '/:id',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const forceHard = req.query.force === 'true';

    try {
      const existing = (await findAccessibleConversation(
        id,
        req.userId!,
        req.organizationId
      )) as any;

      if (!existing) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

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
          return res.status(403).json({
            error: 'No permission to delete this team conversation',
            reason: perm.reason,
            role: perm.role,
          });
        }
      }

      if (forceHard && existing.deleted_at) {
        // Final purge: hard-delete with audit trail (§2.3.3)
        const msgCountRow = await dbGet(
          `SELECT COUNT(*) as cnt FROM conversation_messages WHERE conversation_id = ?`,
          [id]
        );
        const msgCount = (msgCountRow as any)?.cnt || 0;

        // Preserve minimal audit event before purging content
        try {
          const titleHash = existing.title
            ? Buffer.from(existing.title).toString('base64').slice(0, 64)
            : null;
          await dbRun(
            `INSERT INTO conversation_purge_audit (id, conversation_id, purged_by_user_id, organization_id, message_count, title_hash, purged_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              id,
              req.userId!,
              req.organizationId || null,
              msgCount,
              titleHash,
              new Date().toISOString(),
            ]
          );
        } catch {
          // Audit table may not exist yet; proceed with purge
        }

        await dbRun('DELETE FROM conversation_messages WHERE conversation_id = ?', [id]);
        await dbRun('DELETE FROM conversations WHERE id = ?', [id]);
        logger.info(
          `[Conversations] Hard-deleted (purge): ${id} by user ${req.userId}, ${msgCount} messages`
        );
        return res.json({ success: true, deleted: id, purged: true, messagesRemoved: msgCount });
      }

      // Soft-delete: set deleted_at timestamp (grace window)
      const now = new Date().toISOString();
      try {
        await dbRun(`UPDATE conversations SET deleted_at = ?, updated_at = ? WHERE id = ?`, [
          now,
          now,
          id,
        ]);
      } catch {
        // deleted_at column may not exist yet — fall back to hard delete
        await dbRun('DELETE FROM conversation_messages WHERE conversation_id = ?', [id]);
        await dbRun('DELETE FROM conversations WHERE id = ?', [id]);
        logger.info(
          `[Conversations] Hard-deleted (no deleted_at column): ${id} by user ${req.userId}`
        );
        return res.json({ success: true, deleted: id, purged: true });
      }

      logger.info(`[Conversations] Soft-deleted: ${id} by user ${req.userId}`);

      return res.json({ success: true, deleted: id, softDeleted: true, deletedAt: now });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[Conversations] Delete error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_DELETE_FAILED',
            'Failed to delete the conversation.'
          )
        );
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
    const { role, content, messageType, metadata, tokenCount, modelUsed, clientMessageId } =
      req.body;

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
          return res.status(403).json({
            error: 'No permission to add messages to this team conversation',
            reason: perm.reason,
            role: perm.role,
          });
        }
      }

      // Idempotency: if this client message id was already persisted for this conversation,
      // return the existing row instead of inserting a duplicate (covers retried/double POSTs).
      if (clientMessageId) {
        const existing = await dbGet(
          `SELECT cm.*, COALESCE(u.first_name || ' ' || u.last_name, u.email) as author_name, u.email as author_email
           FROM conversation_messages cm
           LEFT JOIN users u ON cm.author_user_id = u.id
           WHERE cm.conversation_id = ? AND cm.client_message_id = ?`,
          [conversationId, clientMessageId]
        );
        if (existing) {
          return res.status(200).json(existing);
        }
      }

      const messageId = uuidv4();
      const now = new Date().toISOString();
      const authorUserId = role === 'user' ? req.userId! : null;

      // Monotonic per-conversation sequence for deterministic ordering (created_at can collide
      // on the same millisecond). seq is non-unique; created_at + id remain tiebreakers.
      const seqRow = (await dbGet(
        `SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM conversation_messages WHERE conversation_id = ?`,
        [conversationId]
      )) as { next: number } | null;
      const seq = Number(seqRow?.next || 1);

      const insertResult = await dbRun(
        `
                INSERT INTO conversation_messages (
                    id, conversation_id, role, content, message_type,
                    metadata, token_count, model_used, author_user_id, seq, client_message_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          seq,
          clientMessageId || null,
          now,
        ],
        { fallback: false }
      );
      if (insertResult.success === false) {
        // A concurrent request with the same client_message_id may have raced us to the unique
        // index — treat it as idempotent success by returning the row that won.
        if (clientMessageId) {
          const raced = await dbGet(
            `SELECT cm.*, COALESCE(u.first_name || ' ' || u.last_name, u.email) as author_name, u.email as author_email
             FROM conversation_messages cm
             LEFT JOIN users u ON cm.author_user_id = u.id
             WHERE cm.conversation_id = ? AND cm.client_message_id = ?`,
            [conversationId, clientMessageId]
          );
          if (raced) return res.status(200).json(raced);
        }
        return res.status(500).json({ error: insertResult.error || 'Message insert failed' });
      }

      // Auto-persist metadata.attachments to conversation_message_attachments (L4
      // bridge). M01-P04A: this used to blindly INSERT the client's claimed
      // kind/target/mime/size as an implicit "ready" row, with no status
      // column, no idempotency and no ACL check — and useConversationStore.ts
      // ALSO POSTs the same message.metadata.attachments to the dedicated
      // /attachments endpoint right after this handler returns, so every
      // attached message produced two rows (an orphaned duplicate) before the
      // uq_msg_attachments_message_target unique index (migration 942) and
      // findExistingAttachment() below existed. Now routed through the same
      // resolveAttachmentStatus()/findExistingAttachment() helpers the
      // dedicated endpoint uses, so status is honestly attested and the two
      // write paths can never disagree or double-insert. A rejected/invalid
      // attachment never blocks message creation — this stays best-effort.
      if (metadata && Array.isArray((metadata as any).attachments)) {
        for (const att of (metadata as any).attachments) {
          try {
            const kind = att.kind || (att.sourceUrl ? 'link' : 'file');
            const targetId = att.docId || att.targetId || null;
            const targetUrl = att.sourceUrl || att.targetUrl || null;

            const existingAtt = await findExistingAttachment({
              messageId,
              conversationId,
              kind,
              targetId,
              targetUrl,
            });
            if (existingAtt) continue; // already persisted via the dedicated endpoint (or a prior retry)

            const resolution = await resolveAttachmentStatus({
              kind,
              targetId,
              sizeBytes: att.size || att.sizeBytes || null,
              mime: att.mimeType || att.mime || null,
              organizationId: req.organizationId,
            });
            if (!resolution.ok) continue; // ACL-denied reference — silently skip, do not fail the message

            await dbRun(
              `INSERT INTO conversation_message_attachments
               (id, message_id, conversation_id, kind, target_id, target_url, display_name, mime, size_bytes, provenance_pointer, status, status_reason, status_detail, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                messageId,
                conversationId,
                kind,
                targetId,
                targetUrl,
                att.filename || att.displayName || 'attachment',
                att.mimeType || att.mime || null,
                att.size || att.sizeBytes || null,
                att.provenancePointer || null,
                resolution.status,
                resolution.status === 'failed' ? resolution.reason : null,
                resolution.status === 'failed' ? resolution.detail : null,
                now,
              ]
            );
          } catch {
            // Race with the dedicated endpoint hitting the same unique index,
            // or the attachment table unavailable — non-blocking either way.
          }
        }
      }

      // Update conversation metadata (message_count, last_message_preview, last_message_at)
      await dbRun(
        `UPDATE conversations
         SET message_count = message_count + 1,
             last_message_preview = ?,
             last_message_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [content.slice(0, 200), now, now, conversationId]
      );

      const shouldCaptureAsOrgContext =
        role === 'user' &&
        req.organizationId &&
        metadata &&
        typeof metadata === 'object' &&
        (metadata as Record<string, unknown>).captureOrganizationContext === true;

      if (shouldCaptureAsOrgContext) {
        await organizationContextService.recordChatMessage({
          organizationId: req.organizationId,
          userId: req.userId || null,
          payload: {
            conversationId,
            messageId,
            content,
          },
        });
      }

      const message = await dbGet(
        `SELECT cm.*, COALESCE(u.first_name || ' ' || u.last_name, u.email) as author_name, u.email as author_email
         FROM conversation_messages cm
         LEFT JOIN users u ON cm.author_user_id = u.id
         WHERE cm.id = ?`,
        [messageId]
      );

      return res.status(201).json(message);
    } catch (err: any) {
      // Write — this IS the product (a chat message). NEVER fail-soft.
      logger.error('[Conversations] Add message error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_ADD_MESSAGE_FAILED',
            'Failed to save the message.'
          )
        );
    }
  })
);

router.post(
  '/:id/messages/:messageId/save-to-context',
  verifyToken,
  validateParams(ConversationMessageParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId, messageId } = req.params;

    try {
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const message = (await dbGet(
        `SELECT id, conversation_id, role, content, metadata, author_user_id
         FROM conversation_messages
         WHERE id = ? AND conversation_id = ?`,
        [messageId, conversationId]
      )) as {
        id: string;
        conversation_id: string;
        role: 'user' | 'ai';
        content: string;
        metadata?: string | null;
        author_user_id?: string | null;
      } | null;

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const existingItem = await dbGet(
        `SELECT id FROM organization_context_items
         WHERE organization_id = ? AND source_type = 'chat_message' AND source_id = ?
         LIMIT 1`,
        [req.organizationId, messageId]
      );

      if (existingItem) {
        return res.json({ ok: true, itemId: (existingItem as any).id, alreadyCaptured: true });
      }

      let parsedMetadata: Record<string, unknown> = {};
      try {
        parsedMetadata =
          typeof message.metadata === 'string'
            ? JSON.parse(message.metadata || '{}')
            : (message.metadata as Record<string, unknown>) || {};
      } catch {
        parsedMetadata = {};
      }

      const actorUserId =
        message.role === 'user'
          ? String(message.author_user_id || req.userId || '') || null
          : req.userId;

      const result = await organizationContextService.recordChatMessage({
        organizationId: req.organizationId!,
        userId: actorUserId,
        payload: {
          conversationId,
          messageId,
          role: message.role,
          content: message.content,
          metadata: parsedMetadata,
        },
      });

      return res.json({ ok: true, itemId: result.itemId, alreadyCaptured: false });
    } catch (err: any) {
      // Write (explicit user click "save to context") — NEVER fail-soft.
      logger.error('[Conversations] Save-to-context error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_SAVE_TO_CONTEXT_FAILED',
            'Failed to save the message to organization context.'
          )
        );
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
          return res.status(403).json({
            error: 'No permission to edit this team conversation',
            reason: perm.reason,
            role: perm.role,
          });
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
      // Write (edit/regenerate) — NEVER fail-soft.
      logger.error('[Conversations] Truncate error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_TRUNCATE_FAILED',
            'Failed to edit the conversation.'
          )
        );
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
          const cleaned = firstUserMsg.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
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

          generatedTitle = ((response as any).text || (response as any).content || '')
            .trim()
            .replace(/^["']|["']$/g, '')
            .slice(0, 50);

          // If AI returned empty or default, fall back to heuristic
          if (!generatedTitle || generatedTitle === 'New conversation') {
            generatedTitle = heuristicTitle();
          }
        } catch (aiErr: any) {
          logger.warn(
            `[Conversations] AI title generation failed for ${id}, using heuristic:`,
            aiErr?.message
          );
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
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_TITLE_GENERATION_FAILED',
            'Failed to generate conversation title.'
          )
        );
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
        return res
          .status(404)
          .json(
            buildConversationFailClosedError(
              req,
              404,
              'CONVERSATIONS_BULK_NOT_FOUND',
              'No conversations were found for this bulk request.'
            )
          );
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
          try {
            await dbRun(
              `UPDATE conversations SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id IN (${ownedPlaceholders})`,
              ownedIds
            );
          } catch {
            await dbRun(`DELETE FROM conversations WHERE id IN (${ownedPlaceholders})`, ownedIds);
          }
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
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_BULK_OPERATION_FAILED',
            'Bulk conversation operation failed.'
          )
        );
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
      // Write (bulk import from localStorage) — NEVER fail-soft.
      logger.error('[Conversations] Migration error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_MIGRATE_FAILED',
            'Failed to migrate conversations.'
          )
        );
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
      // Verify access (personal ownership or team membership) — prevents cross-tenant
      // read + mutation of arbitrary conversations by UUID (IDOR).
      const conversation = await findAccessibleConversation(id, req.userId!, req.organizationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Summarize mutates messages (writes a summary + flips older ones to 'condensed'),
      // so for team conversations require the same permission as truncate/edit.
      const teamProject = await getTeamProjectForConversation(id);
      if (teamProject) {
        const perm = await checkChatPermission(
          req.userId!,
          teamProject.organization_id,
          'add_message'
        );
        if (!perm.allowed) {
          return res.status(403).json({
            error: 'No permission to summarize this team conversation',
            reason: perm.reason,
            role: perm.role,
          });
        }
      }

      // 1. Fetch all messages
      const messages: any[] = await dbAll(
        `SELECT id, role, content, message_type, created_at
         FROM conversation_messages WHERE conversation_id = ?
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
        `INSERT INTO conversation_messages (id, conversation_id, role, content, message_type, created_at)
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
          `UPDATE conversation_messages SET message_type = 'condensed'
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
      // Write (mutates message history) — NEVER fail-soft.
      logger.error('[Conversations] Summarize error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_SUMMARIZE_FAILED',
            'Failed to summarize the conversation.'
          )
        );
    }
  })
);

// ==================== MESSAGE ATTACHMENTS (§2.3.1 — attachment pointers) ====================
//
// M01-P04A — this endpoint only PERSISTS a pointer to content that was
// already ingested via /api/ai/attachments/ingest[-url] (real text
// extraction + embedding, out of this packet's ownership). Before this
// packet, "ready" was purely a client-remembered UI state never attested by
// the server — nothing here re-checked that the referenced document really
// exists, belongs to the caller's organization, or fits the documented
// format/size matrix. `resolveAttachmentStatus` closes that gap: it is the
// single source of truth for whether a pointer is honestly 'ready' or
// 'failed', and it is applied at BOTH places this table is written —this
// dedicated endpoint, and the `metadata.attachments` auto-bridge inside
// `POST /:id/messages` (see below) — so neither path can independently
// fabricate a "ready" pointer.

// Server-side format/size matrix. Mirrors ai.routes.ts's real, already-
// enforced limits (`attachmentsUpload` multer fileFilter = 25MB + these
// exact mime types; `/attachments/ingest-url` MAX_BYTES = 6MB) so a client
// cannot bypass the matrix by talking to the pointer endpoint directly with
// a fabricated mime/sizeBytes. Keep in sync with
// `src/components/AIChat/chatAttachmentSupport.ts` (client-side pre-check)
// and `server/src/routes/ai.routes.ts` (real ingest enforcement) if the
// matrix ever changes.
const ATTACHMENT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const ATTACHMENT_MAX_URL_BYTES = 6 * 1024 * 1024;
const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function isAllowedAttachmentMime(mime: unknown): boolean {
  const m = String(mime || '')
    .trim()
    .toLowerCase();
  if (!m) return true; // unknown mime is not itself a rejection reason — size + targetId checks still apply
  if (ATTACHMENT_ALLOWED_MIME_TYPES.has(m)) return true;
  return m.startsWith('text/');
}

type AttachmentStatusResolution =
  | { ok: true; status: 'ready' }
  | { ok: true; status: 'failed'; reason: string; detail: string }
  | { ok: false; httpStatus: number; error: string };

/**
 * Decides the honest, server-attested status of an attachment pointer.
 * Only 'file' and 'link' kinds are validated — 'artifact' | 'snapshot' |
 * 'reference' pointers belong to other M01 packets (Canvas share, owner
 * handoffs) with their own object identity/ACL model and are left
 * unconstrained here, exactly as before this packet.
 */
async function resolveAttachmentStatus(params: {
  kind: string;
  targetId?: string | null;
  sizeBytes?: number | null;
  mime?: string | null;
  organizationId?: string | null;
}): Promise<AttachmentStatusResolution> {
  const { kind, targetId, sizeBytes, mime, organizationId } = params;

  if (kind !== 'file' && kind !== 'link') {
    return { ok: true, status: 'ready' };
  }

  const maxBytes = kind === 'link' ? ATTACHMENT_MAX_URL_BYTES : ATTACHMENT_MAX_FILE_BYTES;
  if (typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes > maxBytes) {
    return {
      ok: true,
      status: 'failed',
      reason: 'SIZE_LIMIT_EXCEEDED',
      detail: `${sizeBytes} bytes exceeds the ${maxBytes} byte limit for kind="${kind}"`,
    };
  }

  if (!isAllowedAttachmentMime(mime)) {
    return {
      ok: true,
      status: 'failed',
      reason: 'UNSUPPORTED_FORMAT',
      detail: `mime type "${mime}" is not in the supported attachment matrix`,
    };
  }

  // targetId (docId) is the evidence that real ingestion — text extraction +
  // embedding via /api/ai/attachments/ingest[-url] — actually completed. No
  // targetId => nothing was ever ingested => never allowed to display "ready".
  if (!targetId) {
    return {
      ok: true,
      status: 'failed',
      reason: 'INGEST_NOT_COMPLETED',
      detail: 'no ingested document reference (targetId) was provided',
    };
  }

  // Tenant ACL (P0.9 / GF-CHAT-08). A docId that does not exist, or belongs
  // to a different organization, is rejected OUTRIGHT (403, nothing
  // persisted) rather than stored as a 'failed' row — storing it would let a
  // caller distinguish "doesn't exist" from "exists but isn't yours" across
  // repeated attempts, which is itself an enumeration side-channel. Rows
  // ingested before knowledge_docs.organization_id existed (migration
  // 942_chat_m01p04a_attachment_status.sql) have organization_id = NULL;
  // those are treated as untracked legacy content, not rejected — a
  // documented residual gap (return summary "SCHEMA"/"SECURITY"), not a
  // silent claim that history is fully tenant-scoped.
  let doc: { organization_id?: string | null } | undefined;
  try {
    doc = await dbGet(`SELECT organization_id FROM knowledge_docs WHERE id = ?`, [targetId]);
  } catch (err: any) {
    logger.warn('[Conversations] Attachment ACL lookup failed (fail-closed):', err?.message);
    return { ok: false, httpStatus: 403, error: 'Attachment reference could not be verified' };
  }
  if (!doc) {
    return { ok: false, httpStatus: 403, error: 'Attachment reference could not be verified' };
  }
  const docOrgId = doc.organization_id || null;
  if (docOrgId && organizationId && docOrgId !== organizationId) {
    return { ok: false, httpStatus: 403, error: 'Attachment reference could not be verified' };
  }

  return { ok: true, status: 'ready' };
}

/**
 * Idempotency (packet §6/§8 — "ponowny upload tego samego pliku nie tworzy
 * sieroty"). Backed by the partial unique index
 * `uq_msg_attachments_message_target` (migration 942). Only checked for
 * 'file'/'link' kinds with a resolvable target — matches the index's WHERE
 * clause exactly, so this pre-check and the DB constraint never disagree.
 */
async function findExistingAttachment(params: {
  messageId: string;
  conversationId: string;
  kind: string;
  targetId?: string | null;
  targetUrl?: string | null;
}): Promise<Record<string, unknown> | undefined> {
  const { messageId, conversationId, kind, targetId, targetUrl } = params;
  if (kind !== 'file' && kind !== 'link') return undefined;
  if (!targetId && !targetUrl) return undefined;
  return dbGet(
    `SELECT * FROM conversation_message_attachments
     WHERE message_id = ? AND conversation_id = ? AND kind = ?
       AND COALESCE(target_id, '') = ? AND COALESCE(target_url, '') = ?`,
    [messageId, conversationId, kind, targetId || '', targetUrl || '']
  );
}

const AttachmentSchema = z.object({
  kind: z.enum(['file', 'link', 'artifact', 'snapshot', 'reference']),
  targetId: z.string().max(500).optional(),
  targetUrl: z.string().url().max(2000).optional(),
  displayName: z.string().min(1).max(500),
  mime: z.string().max(200).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  provenancePointer: z.string().max(500).optional(),
});

// POST /:id/messages/:messageId/attachments — Add attachment pointer to a message
router.post(
  '/:id/messages/:messageId/attachments',
  verifyToken,
  validateParams(ConversationMessageParamSchema),
  validateBody(AttachmentSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId, messageId } = req.params;
    const { kind, targetId, targetUrl, displayName, mime, sizeBytes, provenancePointer } = req.body;

    try {
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const message = await dbGet(
        `SELECT id FROM conversation_messages WHERE id = ? AND conversation_id = ?`,
        [messageId, conversationId]
      );
      if (!message) return res.status(404).json({ error: 'Message not found' });

      // Idempotency — return the existing pointer instead of creating an orphaned
      // duplicate when the same file/URL is (re-)attached to the same message.
      const existing = await findExistingAttachment({
        messageId,
        conversationId,
        kind,
        targetId,
        targetUrl,
      });
      if (existing) {
        return res.status(200).json(existing);
      }

      // Server-attested status (§3.1 — never trust a client-claimed "ready").
      const resolution = await resolveAttachmentStatus({
        kind,
        targetId,
        sizeBytes,
        mime,
        organizationId: req.organizationId,
      });
      if (!resolution.ok) {
        return res.status(resolution.httpStatus).json({ error: resolution.error });
      }

      const attachmentId = uuidv4();
      let insertFailed = false;
      let insertError: string | undefined;
      try {
        const insertResult = await dbRun(
          `INSERT INTO conversation_message_attachments
           (id, message_id, conversation_id, kind, target_id, target_url, display_name, mime, size_bytes, provenance_pointer, status, status_reason, status_detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            attachmentId,
            messageId,
            conversationId,
            kind,
            targetId || null,
            targetUrl || null,
            displayName,
            mime || null,
            sizeBytes || null,
            provenancePointer || null,
            resolution.status,
            resolution.status === 'failed' ? resolution.reason : null,
            resolution.status === 'failed' ? resolution.detail : null,
            new Date().toISOString(),
          ],
          { fallback: false }
        );
        if (insertResult && (insertResult as any).success === false) {
          insertFailed = true;
          insertError = (insertResult as any).error;
        }
      } catch (insertErr: any) {
        // `{ fallback: false }` can either reject or resolve `{ success: false }`
        // depending on the underlying driver — handle both so a concurrent
        // unique-index collision on `uq_msg_attachments_message_target` never
        // surfaces as a raw 500 to a client that just double-submitted.
        insertFailed = true;
        insertError = insertErr?.message;
      }

      if (insertFailed) {
        // Concurrent duplicate request raced us to the unique index — treat it
        // as idempotent success and return the row that won, exactly like the
        // client_message_id race handling above for /:id/messages.
        const raced = await findExistingAttachment({
          messageId,
          conversationId,
          kind,
          targetId,
          targetUrl,
        });
        if (raced) return res.status(200).json(raced);
        return res.status(500).json({ error: insertError || 'Attachment insert failed' });
      }

      const attachment = await dbGet(
        `SELECT * FROM conversation_message_attachments WHERE id = ?`,
        [attachmentId]
      );
      return res.status(201).json(attachment);
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[Conversations] Add attachment error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_ADD_ATTACHMENT_FAILED',
            'Failed to attach the file.'
          )
        );
    }
  })
);

// GET /:id/messages/:messageId/attachments — List attachments for a message
router.get(
  '/:id/messages/:messageId/attachments',
  verifyToken,
  validateParams(ConversationMessageParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId, messageId } = req.params;

    try {
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      // `{ fallback: false }` — a missing-table error (42P01) must actually
      // reject here so the catch block below can tell it apart from a
      // legitimate "0 attachments" result. With the wrapper's default
      // `fallback: true` this query silently resolved to `[]` on ANY error,
      // including a dropped/never-migrated table (M01-040) — indistinguishable
      // from "no attachments were ever added".
      const attachments = await dbAll(
        `SELECT * FROM conversation_message_attachments WHERE message_id = ? AND conversation_id = ? ORDER BY created_at ASC`,
        [messageId, conversationId],
        { fallback: false }
      );

      return res.json({ attachments: attachments || [] });
    } catch (err: any) {
      const message = String(err?.message || '');
      // Postgres 42P01 = undefined_table. Also matches the driver's own
      // "relation ... does not exist" text as a belt-and-braces fallback in
      // case `.code` isn't propagated through some wrapper layer.
      const isMissingTable =
        err?.code === '42P01' ||
        /relation .* does not exist/i.test(message) ||
        /undefined_table/i.test(message);

      if (isMissingTable) {
        // Read, but must NOT fail-soft here: a missing table is a schema/
        // deployment defect, not "0 attachments". Silently returning an empty
        // list masked the fact that `conversation_message_attachments` was
        // never migrated on an environment (M01-040) — surface it explicitly
        // instead so it's caught before a client mistakes it for real data.
        logger.error('[Conversations] List attachments failed: table unavailable', {
          err,
          correlationId: resolveConversationCorrelationId(req),
        });
        return res.status(503).json({
          error: 'Attachments are temporarily unavailable.',
          code: 'ATTACHMENTS_TABLE_UNAVAILABLE',
        });
      }

      // Read — side panel enrichment (attachment pointers for a message). Fail-soft
      // for genuinely unexpected/transient errors only (H6.4); a missing table is
      // handled explicitly above and must never be conflated with an empty result.
      logger.warn('[Conversations] List attachments degraded', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res.json({
        attachments: [],
        degraded: true,
        _degraded: true,
        _reason: 'list_attachments_unexpected_error',
      });
    }
  })
);

// DELETE /:id/messages/:messageId/attachments/:attachmentId — Remove attachment pointer
router.delete(
  '/:id/messages/:messageId/attachments/:attachmentId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId, messageId, attachmentId } = req.params;

    try {
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      await dbRun(
        `DELETE FROM conversation_message_attachments WHERE id = ? AND message_id = ? AND conversation_id = ?`,
        [attachmentId, messageId, conversationId]
      );

      return res.json({ success: true, deleted: attachmentId });
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[Conversations] Delete attachment error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_DELETE_ATTACHMENT_FAILED',
            'Failed to remove the attachment.'
          )
        );
    }
  })
);

// ==================== CONVERSATION SESSIONS (§2.3.1 — runtime snapshots) ====================

// GET /:id/sessions — List sessions for a conversation
router.get(
  '/:id/sessions',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId } = req.params;

    try {
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const sessions = await dbAll(
        `SELECT * FROM conversation_sessions WHERE conversation_id = ? ORDER BY started_at DESC`,
        [conversationId]
      );

      return res.json({ sessions: sessions || [] });
    } catch (err: any) {
      // Read — side panel enrichment (runtime session history). Fail-soft: degrade
      // to an empty list instead of breaking the panel with a 500 (H6.4).
      logger.warn('[Conversations] List sessions degraded', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res.json({ sessions: [], degraded: true, _degraded: true });
    }
  })
);

// POST /:id/sessions — Create a new session (model change, preset switch, etc.)
router.post(
  '/:id/sessions',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  validateBody(
    z.object({
      modelId: z.string().max(100).optional(),
      presetId: z.string().max(100).optional(),
      locale: z.string().max(10).optional(),
      toolsEnabled: z.array(z.string()).optional(),
      retrievalParams: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: conversationId } = req.params;
    const { modelId, presetId, locale, toolsEnabled, retrievalParams } = req.body;

    try {
      const conversation = await findAccessibleConversation(
        conversationId,
        req.userId!,
        req.organizationId
      );
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      // End the current active session
      try {
        await dbRun(
          `UPDATE conversation_sessions SET ended_at = ? WHERE conversation_id = ? AND ended_at IS NULL`,
          [new Date().toISOString(), conversationId]
        );
      } catch {
        /* table may not exist */
      }

      const sessionId = uuidv4();
      const now = new Date().toISOString();

      await dbRun(
        `INSERT INTO conversation_sessions (id, conversation_id, model_id, preset_id, locale, tools_enabled, retrieval_params, started_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          conversationId,
          modelId || null,
          presetId || null,
          locale || null,
          JSON.stringify(toolsEnabled || []),
          JSON.stringify(retrievalParams || {}),
          now,
          now,
        ]
      );

      const session = await dbGet(`SELECT * FROM conversation_sessions WHERE id = ?`, [sessionId]);
      return res.status(201).json(session);
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[Conversations] Create session error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_CREATE_SESSION_FAILED',
            'Failed to create the runtime session.'
          )
        );
    }
  })
);

// ==================== EXPORT CONVERSATION (§2.3.5 E10) ====================

const ExportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['json', 'markdown', 'text']).optional(),
});

router.get(
  '/:id/export',
  verifyToken,
  validateParams(ConversationIdParamSchema),
  validateQuery(ExportQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { from, to, format: exportFormat } = req.query as Record<string, string | undefined>;

    try {
      const conversation = await findAccessibleConversation(id, req.userId!, req.organizationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      // Enforce date range for large conversations (§2.3.5 E10)
      const msgCount = (conversation as any).message_count || 0;
      const MAX_EXPORT_WITHOUT_RANGE = 500;
      if (msgCount > MAX_EXPORT_WITHOUT_RANGE && !from && !to) {
        return res.status(400).json({
          error: 'Too many messages for full export. Please specify a date range (from/to).',
          code: 'EXPORT_TOO_LARGE',
          messageCount: msgCount,
          maxWithoutRange: MAX_EXPORT_WITHOUT_RANGE,
          hint: 'Add ?from=YYYY-MM-DD&to=YYYY-MM-DD to narrow the export scope.',
        });
      }

      let whereClause = `WHERE cm.conversation_id = ?`;
      const params: string[] = [id];

      if (from) {
        whereClause += ` AND cm.created_at >= ?`;
        params.push(from);
      }
      if (to) {
        whereClause += ` AND cm.created_at <= ?`;
        params.push(to);
      }

      const messages = await dbAll(
        `SELECT cm.role, cm.content, cm.message_type, cm.model_used, cm.created_at,
                COALESCE(u.first_name || ' ' || u.last_name, u.email) as author_name
         FROM conversation_messages cm
         LEFT JOIN users u ON cm.author_user_id = u.id
         ${whereClause}
         ORDER BY cm.created_at ASC
         LIMIT 2000`,
        params
      );

      // Fetch attachments for exported messages
      let attachments: any[] = [];
      try {
        attachments =
          (await dbAll(
            `SELECT cma.message_id, cma.kind, cma.display_name, cma.target_url, cma.mime
           FROM conversation_message_attachments cma
           WHERE cma.conversation_id = ?
           ORDER BY cma.created_at ASC`,
            [id]
          )) || [];
      } catch {
        /* table may not exist */
      }

      const fmt = exportFormat || 'json';
      const conv = conversation as any;

      if (fmt === 'markdown') {
        let md = `# ${conv.title || 'Conversation'}\n\n`;
        md += `**Created:** ${conv.created_at}\n`;
        md += `**Messages:** ${(messages as any[]).length}\n\n---\n\n`;
        for (const msg of messages as any[]) {
          const role = msg.role === 'user' ? msg.author_name || 'User' : 'AI';
          md += `### ${role} — ${msg.created_at}\n\n${msg.content}\n\n`;
          const msgAttachments = attachments.filter((a: any) => a.message_id === msg.id);
          if (msgAttachments.length > 0) {
            md += `**Attachments:** ${msgAttachments.map((a: any) => a.display_name).join(', ')}\n\n`;
          }
          md += `---\n\n`;
        }
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${conv.title || 'conversation'}.md"`
        );
        return res.send(md);
      }

      if (fmt === 'text') {
        let txt = `${conv.title || 'Conversation'}\n${'='.repeat(40)}\n\n`;
        for (const msg of messages as any[]) {
          const role = msg.role === 'user' ? msg.author_name || 'User' : 'AI';
          txt += `[${msg.created_at}] ${role}:\n${msg.content}\n\n`;
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${conv.title || 'conversation'}.txt"`
        );
        return res.send(txt);
      }

      // Default: JSON
      return res.json({
        conversation: {
          id: conv.id,
          title: conv.title,
          createdAt: conv.created_at,
          language: conv.language,
        },
        messages,
        attachments,
        exportedAt: new Date().toISOString(),
        dateRange: { from: from || null, to: to || null },
      });
    } catch (err: any) {
      // Explicit download action (user clicked "export") — NEVER fail-soft; a silent
      // degrade here would produce a corrupt/incomplete downloaded file with no
      // indication anything went wrong.
      logger.error('[Conversations] Export error:', {
        err,
        correlationId: resolveConversationCorrelationId(req),
      });
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_EXPORT_FAILED',
            'Failed to export the conversation.'
          )
        );
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

      logger.info(
        `[Conversations] Auto-archived ${archivedCount} conversations for user ${req.userId}`
      );

      return res.json({
        archived: archivedCount,
        cutoffDate: cutoffDate.toISOString(),
      });
    } catch (err: any) {
      logger.error('[Conversations] Auto-archive error:', err);
      return res
        .status(500)
        .json(
          buildConversationFailClosedError(
            req,
            500,
            'CONVERSATIONS_AUTO_ARCHIVE_FAILED',
            'Failed to auto-archive conversations.'
          )
        );
    }
  })
);

/**
 * M01-P03A helper — conversation_branches is the real, migrated (672) table.
 * `conversations.parent_conversation_id` does NOT exist in any migration
 * (confirmed via information_schema on a freshly-migrated Postgres instance,
 * 2026-08-05) — the `cAdd('parent_conversation_id', ...)` call below is a
 * historical no-op left in place for forward-compat only. conversation_branches
 * is therefore the SOLE source of truth for parent/child lineage. We reuse the
 * new conversation's own id as the branch row's id — a branch IS a conversation,
 * so `branch.id` is directly usable to open it (no separate id space to track).
 */
async function recordConversationBranch(input: {
  branchConversationId: string;
  sourceConversationId: string;
  forkMessageId: string;
  branchName: string;
  createdBy: string;
}): Promise<void> {
  // Chain lineage: if the source conversation is itself a recorded branch,
  // point the new branch's parent_branch_id at that row so nested forks keep
  // a walkable ancestry instead of flattening to the root every time.
  const parentBranchRow = (await dbGet(
    `SELECT id FROM conversation_branches WHERE id = ?`,
    [input.sourceConversationId]
  )) as any;

  const result = await dbRun(
    `INSERT INTO conversation_branches
      (id, conversation_id, parent_branch_id, fork_message_id, branch_name, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.branchConversationId,
      input.sourceConversationId,
      parentBranchRow?.id || null,
      input.forkMessageId,
      input.branchName,
      input.createdBy,
      new Date().toISOString(),
    ]
  );
  if (!(result as any)?.success) {
    logger.error(
      `[Conversations] Failed to persist conversation_branches row for branch=${input.branchConversationId} ` +
        `source=${input.sourceConversationId}: ${(result as any)?.error || 'unknown error'}`
    );
  }
}

/**
 * POST /api/conversations/:id/branch
 *
 * Fork a conversation from a given message (composer feature #4 — branch/fork,
 * like ChatGPT "Branch in new chat" / Claude edit-branch). Copies every message
 * up to and including `forkMessageId` into a fresh conversation so the user can
 * explore an alternative path without losing the original thread, AND records
 * the fork in `conversation_branches` (M01-P03A) so it can be listed and its
 * lineage verified after a fresh reopen via GET /:id/branches.
 *
 * Column-defensive + Postgres-safe (no datetime('now'); fresh id per copied row,
 * unlike the legacy conversationBranchingService which collided primary keys).
 */
router.post(
  '/:id/branch',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const organizationId = req.organizationId || null;
    const sourceId = String(req.params.id);
    const forkMessageId = String(req.body?.forkMessageId || req.body?.messageId || '').trim();
    const requestedBranchName = String(req.body?.branchName || '').trim();

    // Ownership: the caller's personal conversation, or one in their org.
    const source = (await dbGet(
      `SELECT * FROM conversations
       WHERE id = ? AND (user_id = ? OR (organization_id IS NOT NULL AND organization_id = ?))`,
      [sourceId, userId, organizationId]
    )) as any;
    if (!source) return res.status(404).json({ error: 'Conversation not found' });

    // Cutoff = the fork message's created_at (inclusive). Without one, branch all.
    let cutoffCreatedAt: string | null = null;
    if (forkMessageId) {
      const fork = (await dbGet(
        `SELECT created_at FROM conversation_messages WHERE id = ? AND conversation_id = ?`,
        [forkMessageId, sourceId]
      )) as any;
      if (!fork) return res.status(404).json({ error: 'Fork message not found' });
      // M01-P03A bugfix — found via a real-Postgres test, not assumed: the pg
      // driver auto-parses `timestamp` columns into JS `Date` objects, and
      // `String(date)` produces `"Wed Aug 05 2026 06:05:26 GMT+0200 (Central
      // European Summer Time)"` — Postgres's timestamp parser rejects that
      // tz-name format outright ("time zone \"gmt+0200\" not recognized").
      // Because dbAll()/dbRun() default to `{ fallback: true }`, the failing
      // "copy messages up to cutoff" query silently resolved to `[]` instead
      // of throwing — every explicit-forkMessageId branch silently copied
      // ZERO messages in this timezone. `toISOString()` is unambiguous and
      // Postgres-safe regardless of the server's local timezone.
      const forkCreatedAt = fork.created_at;
      cutoffCreatedAt =
        forkCreatedAt instanceof Date ? forkCreatedAt.toISOString() : String(forkCreatedAt);
    }

    const now = new Date().toISOString();
    const newId = uuidv4();

    // --- New conversation (column-defensive) ---
    const convCols = await getTableColumns('conversations');
    const cCols: string[] = [];
    const cVals: string[] = [];
    const cParams: any[] = [];
    const cAdd = (col: string, val: any) => {
      if (!convCols.has(col)) return;
      cCols.push(col);
      cVals.push('?');
      cParams.push(val);
    };
    cAdd('id', newId);
    cAdd('user_id', source.user_id || userId);
    cAdd('organization_id', source.organization_id || organizationId);
    cAdd('project_id', source.project_id || null);
    cAdd('chat_project_id', source.chat_project_id || null);
    cAdd('created_by', userId);
    cAdd('title', `${String(source.title || 'Conversation').slice(0, 180)} (Branch)`);
    cAdd('title_source', 'auto');
    cAdd('language', source.language || 'en');
    cAdd('parent_conversation_id', sourceId);
    cAdd('created_at', now);
    cAdd('updated_at', now);
    await dbRun(
      `INSERT INTO conversations (${cCols.join(', ')}) VALUES (${cVals.join(', ')})`,
      cParams
    );

    // --- Copy messages up to the cutoff, each with a fresh id + monotonic seq ---
    const rows = (await dbAll(
      cutoffCreatedAt
        ? `SELECT * FROM conversation_messages
           WHERE conversation_id = ? AND created_at <= ?
           ORDER BY seq ASC, created_at ASC`
        : `SELECT * FROM conversation_messages
           WHERE conversation_id = ? ORDER BY seq ASC, created_at ASC`,
      cutoffCreatedAt ? [sourceId, cutoffCreatedAt] : [sourceId]
    )) as any[];

    const msgCols = await getTableColumns('conversation_messages');
    let seq = 0;
    for (const m of rows || []) {
      seq += 1;
      const mCols: string[] = [];
      const mVals: string[] = [];
      const mParams: any[] = [];
      const mAdd = (col: string, val: any) => {
        if (!msgCols.has(col)) return;
        mCols.push(col);
        mVals.push('?');
        mParams.push(val);
      };
      mAdd('id', uuidv4());
      mAdd('conversation_id', newId);
      mAdd('role', m.role);
      mAdd('content', m.content);
      mAdd('message_type', m.message_type || 'text');
      mAdd('metadata', m.metadata || '{}');
      mAdd('token_count', m.token_count ?? null);
      mAdd('model_used', m.model_used ?? null);
      mAdd('author_user_id', m.author_user_id ?? null);
      mAdd('seq', seq);
      mAdd('created_at', m.created_at || now);
      await dbRun(
        `INSERT INTO conversation_messages (${mCols.join(', ')}) VALUES (${mVals.join(', ')})`,
        mParams
      );
    }

    const conversation = await dbGet('SELECT * FROM conversations WHERE id = ?', [newId]);

    // --- Record the fork in conversation_branches (M01-P03A) ---
    // fork_message_id is NOT NULL on the real table: prefer the caller-given
    // point, else fall back to the last copied message so a "branch the
    // whole thread" call (no forkMessageId) still has a valid anchor. Only
    // an empty source conversation with no explicit fork point has neither —
    // skip the branch record in that edge case rather than violate the
    // constraint (there is nothing meaningful to branch "from" anyway).
    const effectiveForkMessageId =
      forkMessageId || (rows && rows.length ? String(rows[rows.length - 1].id) : '');
    const branchName =
      requestedBranchName || `${String(source.title || 'Conversation').slice(0, 160)} (Branch)`;
    if (effectiveForkMessageId) {
      await recordConversationBranch({
        branchConversationId: newId,
        sourceConversationId: sourceId,
        forkMessageId: effectiveForkMessageId,
        branchName,
        createdBy: userId,
      });
    } else {
      logger.warn(
        `[Conversations] Branched ${sourceId} -> ${newId} with no messages and no forkMessageId — ` +
          `skipping conversation_branches record (no valid anchor point).`
      );
    }

    const branchRecord = effectiveForkMessageId
      ? ((await dbGet(`SELECT * FROM conversation_branches WHERE id = ?`, [newId])) as any)
      : null;

    logger.info(
      `[Conversations] Branched ${sourceId} -> ${newId} (${(rows || []).length} messages copied)`
    );
    return res.status(201).json({
      conversation,
      branchedFrom: sourceId,
      copiedMessages: (rows || []).length,
      branch: branchRecord
        ? {
            id: branchRecord.id,
            conversationId: branchRecord.conversation_id,
            parentBranchId: branchRecord.parent_branch_id,
            forkMessageId: branchRecord.fork_message_id,
            branchName: branchRecord.branch_name,
            createdBy: branchRecord.created_by,
            createdAt: branchRecord.created_at,
            messageCount: (rows || []).length,
          }
        : null,
    });
  })
);

/**
 * GET /api/conversations/:id/branches
 *
 * Lists conversation_branches forked FROM :id (its direct children), and, if
 * :id is itself a recorded branch, reports its own parent lineage — so a
 * client can both populate a branch switcher AND verify, after a fresh
 * reopen, that a branch still exists and still points at the right
 * parent/fork message (M01-P03A required flow, step 6).
 *
 * Ownership-gated with the exact same predicate as POST /:id/branch — a
 * conversation_branches row carries no organization_id of its own, so tenant
 * isolation is enforced entirely via the owning conversation's user_id/
 * organization_id (verified against a real Postgres instance: the column
 * genuinely does not exist on conversation_branches).
 */
router.get(
  '/:id/branches',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const organizationId = req.organizationId || null;
    const conversationId = String(req.params.id);

    const owned = (await dbGet(
      `SELECT id FROM conversations
       WHERE id = ? AND (user_id = ? OR (organization_id IS NOT NULL AND organization_id = ?))`,
      [conversationId, userId, organizationId]
    )) as any;
    if (!owned) return res.status(404).json({ error: 'Conversation not found' });

    const selfAsBranch = (await dbGet(
      `SELECT * FROM conversation_branches WHERE id = ?`,
      [conversationId]
    )) as any;

    const children = (await dbAll(
      `SELECT b.*,
              (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.conversation_id = b.id) AS message_count
       FROM conversation_branches b
       WHERE b.conversation_id = ?
       ORDER BY b.created_at ASC`,
      [conversationId]
    )) as any[];

    return res.status(200).json({
      conversationId,
      isBranch: Boolean(selfAsBranch),
      parentConversationId: selfAsBranch?.conversation_id || null,
      parentBranchId: selfAsBranch?.parent_branch_id || null,
      forkMessageId: selfAsBranch?.fork_message_id || null,
      branchName: selfAsBranch?.branch_name || null,
      branches: (children || []).map((b: any) => ({
        id: b.id,
        conversationId: b.conversation_id,
        parentBranchId: b.parent_branch_id,
        forkMessageId: b.fork_message_id,
        branchName: b.branch_name,
        createdBy: b.created_by,
        createdAt: b.created_at,
        messageCount: Number(b.message_count) || 0,
      })),
    });
  })
);

export default router;
