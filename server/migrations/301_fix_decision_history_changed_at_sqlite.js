/**
 * Fix: decision_history.changed_at missing/NULL in SQLite dev DBs
 *
 * SQLite limitation:
 * - ALTER TABLE ... ADD COLUMN does NOT allow non-constant defaults (e.g. CURRENT_TIMESTAMP).
 *
 * This migration:
 * - Ensures `changed_at` column exists (adds it WITHOUT default if missing)
 * - Backfills existing rows (prefers legacy `created_at` if present)
 * - Adds an index for ORDER BY changed_at
 * - Adds a trigger to populate changed_at on INSERT when NULL
 */

export async function up(db) {
  const info = await db.query("PRAGMA table_info('decision_history')", []);
  const cols = (info?.rows || [])
    .map((r) => String(r?.name || '').toLowerCase())
    .filter(Boolean);

  if (cols.length === 0) return; // table doesn't exist in this DB

  const hasChangedAt = cols.includes('changed_at');
  const hasCreatedAt = cols.includes('created_at');

  // 1) Add column if missing (no default due to SQLite limitation)
  if (!hasChangedAt) {
    await db.run('ALTER TABLE decision_history ADD COLUMN changed_at TIMESTAMP;');
  }

  // 2) Backfill existing rows
  if (hasCreatedAt) {
    await db.run(
      "UPDATE decision_history SET changed_at = COALESCE(changed_at, created_at, CURRENT_TIMESTAMP) WHERE changed_at IS NULL;"
    );
  } else {
    await db.run(
      "UPDATE decision_history SET changed_at = COALESCE(changed_at, CURRENT_TIMESTAMP) WHERE changed_at IS NULL;"
    );
  }

  // 3) Index for queries ordering by changed_at
  try {
    await db.run('CREATE INDEX IF NOT EXISTS idx_decision_history_changed_at ON decision_history(changed_at);');
  } catch {
    // non-fatal for local dev
  }

  // 4) Trigger to ensure future inserts get a timestamp if code doesn't provide one
  // Note: We use AFTER INSERT + UPDATE to avoid needing BEFORE triggers.
  try {
    await db.run(`
      CREATE TRIGGER IF NOT EXISTS trg_decision_history_set_changed_at
      AFTER INSERT ON decision_history
      FOR EACH ROW
      WHEN NEW.changed_at IS NULL
      BEGIN
        UPDATE decision_history SET changed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
  } catch {
    // non-fatal for local dev
  }
}

