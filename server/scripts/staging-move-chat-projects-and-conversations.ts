#!/usr/bin/env tsx
/**
 * Move chat_projects + conversations ownership (and related AI audit rows)
 * from one user to another in the SAME staging DB.
 *
 * This is a MOVE (reassign), not a clone:
 * - Piotr will no longer see these chats under his account after the reassignment.
 *
 * Usage (repo root):
 *   SKIP_ENV_VALIDATION=true DB_MANAGED_SCHEMA=off ENV_FILE=.env.staging.local \
 *   npx tsx server/scripts/staging-move-chat-projects-and-conversations.ts \
 *     --from piotr.wisniewski@dbr77.com \
 *     --to torian.richardson@dbr77.com
 */

import dotenv from 'dotenv';

function loadEnv() {
  dotenv.config({ path: '.env' });
  if (!process.env.ENV_FILE) {
    dotenv.config({ path: '.env.local' });
  }
  if (process.env.ENV_FILE) {
    dotenv.config({ path: process.env.ENV_FILE, override: true });
  }
}

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] || null;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

async function tableExists(db: any, tableName: string): Promise<boolean> {
  const r = await db.query(`SELECT to_regclass(?) AS t`, [tableName]);
  return Boolean(r.rows?.[0]?.t);
}

async function main() {
  loadEnv();

  const fromEmail = normalizeEmail(getArg('--from') || '');
  const toEmail = normalizeEmail(getArg('--to') || '');
  if (!fromEmail || !toEmail) throw new Error('Missing --from and/or --to email.');
  if (fromEmail === toEmail) throw new Error('Refusing to move from/to the same email.');

  const { getDatabaseAsync } = await import('../src/database/Database.js');
  const db = await getDatabaseAsync();

  const users = await db.query<{ id: string; email: string }>(
    `SELECT id, lower(trim(email)) AS email
     FROM users
     WHERE lower(trim(email)) = ANY(?)`,
    [[fromEmail, toEmail]]
  );
  const from = users.rows.find((r) => r.email === fromEmail);
  const to = users.rows.find((r) => r.email === toEmail);
  if (!from || !to) {
    throw new Error(`Missing user(s). Found: ${users.rows.map((r) => r.email).join(', ')}`);
  }

  // Tables with BOTH conversation_id and user_id that should follow the move for access checks.
  const convoUserTables = [
    'advisor_response_log',
    'ai_actions_log',
    'ai_agent_audit_metrics',
    'ai_agent_audit_runs',
    'ai_chat_runs',
    'ai_conversations',
    'ai_decision_audit_log',
    'ai_decision_outcomes',
    'ai_deep_thinking_metrics',
    'ai_response_feedback',
    'knowledge_queries',
  ];

  const summary: Record<string, unknown> = {
    source: { fromEmail, fromId: from.id, toEmail, toId: to.id },
  };

  await db.run('BEGIN', []);
  try {
    const conv = await db.query<{ id: string }>(
      `SELECT id FROM conversations WHERE user_id = ? AND deleted_at IS NULL`,
      [from.id]
    );
    const conversationIds = (conv.rows || []).map((r) => r.id);
    summary.conversationsFound = conversationIds.length;

    // Move chat_projects
    const chatProjects = await db.run(`UPDATE chat_projects SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [
      to.id,
      from.id,
    ]);
    summary.chatProjectsMoved = chatProjects?.changes ?? null;

    // Move conversations
    const movedConversations = await db.run(
      `UPDATE conversations
       SET user_id = ?, updated_at = now()
       WHERE user_id = ? AND deleted_at IS NULL`,
      [to.id, from.id]
    );
    summary.conversationsMoved = movedConversations?.changes ?? null;

    // Move per-conversation user-linked tables (only rows for the moved conversations)
    const perTable: Record<string, unknown> = {};
    if (conversationIds.length > 0) {
      for (const t of convoUserTables) {
        const exists = await tableExists(db, `public.${t}`);
        if (!exists) {
          perTable[t] = { skipped: true, reason: 'missing_table' };
          continue;
        }
        const r = await db.run(
          `UPDATE ${t}
           SET user_id = ?
           WHERE user_id = ? AND conversation_id = ANY(?)`,
          [to.id, from.id, conversationIds]
        );
        perTable[t] = { updated: r?.changes ?? null };
      }
    }
    summary.conversationUserTables = perTable;

    await db.run('COMMIT', []);

    const check = await db.query(
      `SELECT
        (SELECT COUNT(*)::int FROM chat_projects WHERE user_id = ?) AS chat_projects,
        (SELECT COUNT(*)::int FROM conversations WHERE user_id = ? AND deleted_at IS NULL) AS conversations`,
      [to.id, to.id]
    );
    summary.toCounts = check.rows?.[0] || {};

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    try {
      await db.run('ROLLBACK', []);
    } catch {
      // ignore
    }
    throw e;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ staging-move-chat-projects-and-conversations failed:', e?.message || e);
  process.exit(1);
});

