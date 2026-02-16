/**
 * MemoryCleanupJob
 *
 * Dynamically imported by Scheduler.ts.
 * Production cleanup for AI memory, partial responses, and stale data.
 */
export async function runMemoryCleanup() {
  let itemsCleaned = 0;
  const errors = [];

  let dbRun;
  try {
    const mod = await import('../utils/DbPromise.js');
    dbRun = mod.run;
  } catch {
    return { itemsCleaned: 0, memoryFreed: 0, error: 'DB not available' };
  }

  // 1. Expired partial responses (>24h)
  try {
    const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
    const r = await dbRun('DELETE FROM ai_partial_responses WHERE created_at < ?', [cutoff]);
    itemsCleaned += r?.changes || 0;
  } catch (e) {
    errors.push('partial: ' + e?.message);
  }

  // 2. Archived conversation messages (>90 days)
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const r = await dbRun(
      'DELETE FROM conversation_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE archived = 1 AND updated_at < ?)',
      [cutoff]
    );
    itemsCleaned += r?.changes || 0;
  } catch (e) {
    errors.push('messages: ' + e?.message);
  }

  // 3. Expired memory patterns (>90 days)
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    const r = await dbRun(
      "DELETE FROM ai_project_memory WHERE updated_at < ? AND memory_type = 'PATTERN'",
      [cutoff]
    );
    itemsCleaned += r?.changes || 0;
  } catch (e) {
    errors.push('memory: ' + e?.message);
  }

  // 4. Old feedback (>180 days, keep corrections)
  try {
    const cutoff = new Date(Date.now() - 180 * 86400000).toISOString();
    const r = await dbRun(
      "DELETE FROM ai_feedback WHERE created_at < ? AND feedback_type != 'correction'",
      [cutoff]
    );
    itemsCleaned += r?.changes || 0;
  } catch (e) {
    errors.push('feedback: ' + e?.message);
  }

  // 5. Old action logs (>365 days)
  try {
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString();
    const r = await dbRun('DELETE FROM ai_actions_log WHERE created_at < ?', [cutoff]);
    itemsCleaned += r?.changes || 0;
  } catch (e) {
    errors.push('actions: ' + e?.message);
  }

  return { itemsCleaned, memoryFreed: itemsCleaned * 512, errors };
}
