/**
 * Conversation Summary Service
 *
 * Manages short-term conversation summaries for AI chat memory injection.
 * Stores compressed summaries of past conversation turns so the AI model
 * can reference prior context without sending the full history.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the stored summary for a conversation.
 */
async function get(conversationId: string): Promise<string> {
  if (!conversationId) return '';
  try {
    const dbModule = await import('../../database/Database.js');
    const db = (dbModule as any).default || dbModule;
    const dbGet = db.dbGet?.bind(db) || db.get?.bind(db);
    if (!dbGet) return '';

    const row = (await dbGet(
      `SELECT summary FROM conversation_summaries WHERE conversation_id = ? ORDER BY updated_at DESC LIMIT 1`,
      [conversationId]
    )) as { summary?: string } | null;

    return row?.summary || '';
  } catch {
    return '';
  }
}

/**
 * Store/update a conversation summary.
 */
async function set(conversationId: string, summary: string): Promise<void> {
  if (!conversationId || !summary) return;
  try {
    const { v4: uuidv4 } = await import('uuid');
    const dbModule = await import('../../database/Database.js');
    const db = (dbModule as any).default || dbModule;
    const dbRun = db.dbRun?.bind(db) || db.run?.bind(db);
    if (!dbRun) return;

    await dbRun(
      `INSERT INTO conversation_summaries (id, conversation_id, summary, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(conversation_id) DO UPDATE SET
         summary = excluded.summary,
         updated_at = datetime('now')`,
      [uuidv4(), conversationId, summary]
    );
  } catch {
    // best-effort
  }
}

/**
 * Delete a conversation summary.
 */
async function remove(conversationId: string): Promise<void> {
  if (!conversationId) return;
  try {
    const dbModule = await import('../../database/Database.js');
    const db = (dbModule as any).default || dbModule;
    const dbRun = db.dbRun?.bind(db) || db.run?.bind(db);
    if (!dbRun) return;

    await dbRun(`DELETE FROM conversation_summaries WHERE conversation_id = ?`, [conversationId]);
  } catch {
    // best-effort
  }
}

export default { get, set, remove };
export { get, remove, set };
