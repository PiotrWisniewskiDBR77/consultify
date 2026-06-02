/**
 * Fix: decision_history.changed_at missing in some SQLite dev DBs
 *
 * Symptoms:
 * - Backend 500 on decision history queries:
 *   SQLITE_ERROR: no such column: changed_at
 *
 * Root cause:
 * - Some earlier SQLite DBs have `decision_history` created without `changed_at`
 *   (often with `created_at` instead). Later migrations use CREATE TABLE IF NOT EXISTS
 *   and therefore do not alter the existing table.
 *
 * This migration:
 * - Adds `changed_at` if missing
 * - Backfills `changed_at` from `created_at` if present
 */

export async function up(db) {
  // PRAGMA table_info returns rows like: { cid, name, type, notnull, dflt_value, pk }
  const info = await db.query("PRAGMA table_info('decision_history')", []);
  const cols = (info?.rows || []).map((r) => String(r?.name || '').toLowerCase()).filter(Boolean);

  if (cols.length === 0) {
    // Table doesn't exist in this DB; nothing to fix.
    return;
  }

  const hasChangedAt = cols.includes('changed_at');
  const hasCreatedAt = cols.includes('created_at');

  if (!hasChangedAt) {
    await db.run('ALTER TABLE decision_history ADD COLUMN changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;');
  }

  // Backfill when legacy schema used created_at instead.
  if (hasCreatedAt) {
    await db.run(
      "UPDATE decision_history SET changed_at = COALESCE(changed_at, created_at) WHERE changed_at IS NULL;"
    );
  }
}

