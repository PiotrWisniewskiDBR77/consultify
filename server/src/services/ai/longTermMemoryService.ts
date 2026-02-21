/**
 * Long-Term Memory Service
 *
 * Provides persistent user/organization-level memory for AI chat.
 * Stores and retrieves key facts, preferences, and context that persist
 * across conversations to personalize AI responses.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

interface PromptAddendumParams {
  userId?: string;
  organizationId?: string;
}

/**
 * Get a prompt addendum string containing relevant long-term memory facts
 * for a given user/organization context.
 */
async function getPromptAddendum(params: PromptAddendumParams): Promise<string> {
  const { userId, organizationId } = params;
  if (!userId && !organizationId) return '';

  try {
    const dbModule = await import('../../database/Database.js');
    const db = (dbModule as any).default || dbModule;
    const dbAll = db.dbAll?.bind(db) || db.all?.bind(db);
    if (!dbAll) return '';

    const rows = (await dbAll(
      `SELECT key, value FROM ai_long_term_memory 
       WHERE (user_id = ? OR organization_id = ?) AND active = 1
       ORDER BY updated_at DESC LIMIT 20`,
      [userId || '', organizationId || '']
    ).catch(() => null)) as Array<{ key: string; value: string }> | null;

    if (!rows || rows.length === 0) return '';

    const facts = rows.map((r) => `- ${r.key}: ${r.value}`).join('\n');

    return `\n\n## LONG-TERM MEMORY (persistent user/org facts)\n${facts}\n\nRules:\n- Use these facts as supplementary context.\n- Do not expose raw memory entries to the user unless asked.\n`;
  } catch {
    return '';
  }
}

/**
 * Store a long-term memory fact.
 */
async function store(params: {
  userId?: string;
  organizationId?: string;
  key: string;
  value: string;
}): Promise<void> {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const dbModule = await import('../../database/Database.js');
    const db = (dbModule as any).default || dbModule;
    const dbRun = db.dbRun?.bind(db) || db.run?.bind(db);
    if (!dbRun) return;

    await dbRun(
      `INSERT INTO ai_long_term_memory (id, user_id, organization_id, key, value, active, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, organization_id, key) DO UPDATE SET
         value = excluded.value,
         active = 1,
         updated_at = datetime('now')`,
      [uuidv4(), params.userId || null, params.organizationId || null, params.key, params.value]
    );
  } catch {
    // best-effort
  }
}

/**
 * Remove a long-term memory fact.
 */
async function forget(params: {
  userId?: string;
  organizationId?: string;
  key: string;
}): Promise<void> {
  try {
    const dbModule = await import('../../database/Database.js');
    const db = (dbModule as any).default || dbModule;
    const dbRun = db.dbRun?.bind(db) || db.run?.bind(db);
    if (!dbRun) return;

    await dbRun(
      `UPDATE ai_long_term_memory SET active = 0 WHERE user_id = ? AND organization_id = ? AND key = ?`,
      [params.userId || '', params.organizationId || '', params.key]
    );
  } catch {
    // best-effort
  }
}

export default { getPromptAddendum, store, forget };
export { forget, getPromptAddendum, store };
