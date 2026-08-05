/**
 * @deprecated M01-P03A (2026-08-05) — DEAD CODE, DO NOT IMPORT.
 *
 * Confirmed via `grep -rn "from.*conversationBranchingService"` across
 * `server/`, `src/`, `tests/` (excluding node_modules): this module is
 * imported by ZERO files. The only remaining reference is a comment in
 * `server/src/routes/conversations.routes.ts` explicitly contrasting it
 * with the real, live `POST /:id/branch` handler.
 *
 * It is also functionally broken on the real database: `forkConversation()`
 * and its INSERTs use SQLite syntax (`datetime('now')`, positional `?` that
 * assumes SQLite semantics for functions), which is invalid on Postgres.
 * Because `DbPromise.run()` defaults to `{ fallback: true }`, those INSERTs
 * fail SILENTLY on Postgres (resolve `{ success: false }`, never throw) —
 * verified against a real, freshly-migrated Postgres 16 instance
 * (2026-08-05): the `conversation_branches` table this service targets has
 * the 672-migration shape and rejects `datetime('now')` outright.
 *
 * Real conversation branching lives in
 * `server/src/routes/conversations.routes.ts` (`POST /:id/branch`,
 * `GET /:id/branches`) — that is Postgres-safe, column-defensive, and (as of
 * M01-P03A) persists lineage into `conversation_branches` correctly.
 *
 * Kept in the tree (not deleted) only so history/blame stays intact; do not
 * wire this up, do not fix its SQL, do not extend it. If you need branching
 * behavior, use the route handlers above.
 *
 * Conversation Branching Service
 *
 * Enables forking conversations from any point to explore
 * alternative paths. Supports branch comparison and tree visualization.
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export interface ConversationBranch {
  id: string;
  conversationId: string;
  parentBranchId: string | null;
  forkMessageId: string;
  branchName: string;
  createdBy: string;
  createdAt: string;
  messageCount: number;
}

export interface BranchTree {
  rootConversationId: string;
  branches: ConversationBranch[];
  depth: number;
}

class ConversationBranchingService {
  async forkConversation(input: {
    conversationId: string;
    forkMessageId: string;
    branchName?: string;
    userId: string;
    organizationId: string;
  }): Promise<ConversationBranch> {
    const branchId = randomUUID();

    const parentBranch = (await dbGet(
      `SELECT id FROM conversation_branches
       WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
      [input.conversationId]
    )) as any;

    await dbRun(
      `INSERT INTO conversation_branches
        (id, conversation_id, parent_branch_id, fork_message_id, branch_name, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        branchId,
        input.conversationId,
        parentBranch?.id || null,
        input.forkMessageId,
        input.branchName || `Branch ${branchId.slice(0, 6)}`,
        input.userId,
      ]
    );

    const newConvId = randomUUID();
    // H5.5: these two INSERTs ARE the branch — a swallowed failure previously
    // left this method returning a "success" branch object pointing at a
    // conversation that was never created (silent data loss). Keep it
    // fire-and-forget (semantics unchanged) but surface failures with
    // correlation so the loss is observable instead of invisible.
    await dbRun(
      `INSERT INTO conversations (id, user_id, organization_id, title, parent_conversation_id, branch_id, created_at, updated_at)
       SELECT ?, user_id, organization_id, title || ' (Branch)', ?, ?, datetime('now'), datetime('now')
       FROM conversations WHERE id = ?`,
      [newConvId, input.conversationId, branchId, input.conversationId]
    ).catch((err: unknown) => {
      logger.warn(
        `[ConversationBranching] failed to create branch conversation newConv=${newConvId} ` +
          `branch=${branchId} from=${input.conversationId}: ${
            err instanceof Error ? err.message : String(err)
          }`
      );
    });

    await dbRun(
      `INSERT INTO conversation_messages (id, conversation_id, role, content, created_at)
       SELECT ?, ?, role, content, created_at
       FROM conversation_messages
       WHERE conversation_id = ? AND created_at <= (
         SELECT created_at FROM conversation_messages WHERE id = ?
       )
       ORDER BY created_at`,
      [randomUUID(), newConvId, input.conversationId, input.forkMessageId]
    ).catch((err: unknown) => {
      logger.warn(
        `[ConversationBranching] failed to copy messages into branch newConv=${newConvId} ` +
          `branch=${branchId} fork=${input.forkMessageId}: ${
            err instanceof Error ? err.message : String(err)
          }`
      );
    });

    return {
      id: branchId,
      conversationId: newConvId,
      parentBranchId: parentBranch?.id || null,
      forkMessageId: input.forkMessageId,
      branchName: input.branchName || `Branch ${branchId.slice(0, 6)}`,
      createdBy: input.userId,
      createdAt: new Date().toISOString(),
      messageCount: 0,
    };
  }

  async getBranchTree(conversationId: string): Promise<BranchTree> {
    const branches = (await dbAll(
      `SELECT b.*,
              (SELECT COUNT(*) FROM conversation_messages m
               JOIN conversations c ON c.id = m.conversation_id
               WHERE c.branch_id = b.id) as message_count
       FROM conversation_branches b
       WHERE b.conversation_id = ?
       ORDER BY b.created_at`,
      [conversationId]
    ).catch(() => [])) as any[];

    const mapped: ConversationBranch[] = (branches || []).map((b: any) => ({
      id: b.id,
      conversationId: b.conversation_id,
      parentBranchId: b.parent_branch_id,
      forkMessageId: b.fork_message_id,
      branchName: b.branch_name || 'Unnamed',
      createdBy: b.created_by,
      createdAt: b.created_at,
      messageCount: Number(b.message_count) || 0,
    }));

    let depth = 0;
    const visited = new Set<string>();
    for (const branch of mapped) {
      let d = 0;
      let current = branch;
      while (current.parentBranchId && !visited.has(current.id) && d < 10) {
        visited.add(current.id);
        d++;
        current = mapped.find((b) => b.id === current.parentBranchId) || current;
      }
      depth = Math.max(depth, d);
    }

    return { rootConversationId: conversationId, branches: mapped, depth };
  }

  async compareBranches(
    branchId1: string,
    branchId2: string
  ): Promise<{
    branch1Messages: Array<{ role: string; content: string; createdAt: string }>;
    branch2Messages: Array<{ role: string; content: string; createdAt: string }>;
    divergencePoint: number;
  }> {
    const getMessages = async (branchId: string) => {
      const rows = (await dbAll(
        `SELECT m.role, m.content, m.created_at
         FROM conversation_messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE c.branch_id = ?
         ORDER BY m.created_at`,
        [branchId]
      ).catch(() => [])) as any[];

      return (rows || []).map((r: any) => ({
        role: r.role,
        content: r.content,
        createdAt: r.created_at,
      }));
    };

    const [msgs1, msgs2] = await Promise.all([getMessages(branchId1), getMessages(branchId2)]);

    let divergence = 0;
    for (let i = 0; i < Math.min(msgs1.length, msgs2.length); i++) {
      if (msgs1[i].content === msgs2[i].content) {
        divergence = i + 1;
      } else {
        break;
      }
    }

    return {
      branch1Messages: msgs1,
      branch2Messages: msgs2,
      divergencePoint: divergence,
    };
  }
}

export const conversationBranchingService = new ConversationBranchingService();
export default conversationBranchingService;
