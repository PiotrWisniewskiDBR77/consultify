import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../src/utils/DbPromise.js';
import logger from '../src/utils/Logger.js';
import { normalizeDeckDocument } from '../src/services/presentationDeckDocumentService.js';

type DeckRow = {
  id: string;
  organization_id: string;
  title: string;
  deck_json: string | null;
  unified_json: string | null;
  status: string | null;
};

function parseArg(name: string): string | null {
  const flag = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(flag));
  return entry ? entry.slice(flag.length) : null;
}

function isDryRun(): boolean {
  const raw = parseArg('dry-run');
  if (raw == null) return true;
  return raw !== 'false';
}

async function ensureReportTable() {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS presentation_migration_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      run_mode TEXT NOT NULL DEFAULT 'dry_run',
      total_decks INTEGER NOT NULL DEFAULT 0,
      normalized_decks INTEGER NOT NULL DEFAULT 0,
      skipped_decks INTEGER NOT NULL DEFAULT 0,
      failed_decks INTEGER NOT NULL DEFAULT 0,
      retry_pointer_json TEXT,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

async function run() {
  const dryRun = isDryRun();
  const organizationId = parseArg('organization-id');
  const runId = uuidv4().replace(/-/g, '');
  const retryPointers: Array<{ deckId: string; reason: string }> = [];

  await ensureReportTable();

  const rows = (await dbAll(
    `SELECT id, organization_id, title, deck_json, unified_json, status
     FROM presentation_decks
     WHERE (? IS NULL OR organization_id = ?)
     ORDER BY updated_at DESC`,
    [organizationId, organizationId]
  )) as DeckRow[];

  let normalized = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows || []) {
    try {
      const normalizedDeck = normalizeDeckDocument(row as any);
      if (!normalizedDeck) {
        skipped++;
        continue;
      }
      const nextJson = JSON.stringify(normalizedDeck);
      const current = String(row.deck_json || '').trim();
      if (current === nextJson) {
        skipped++;
        continue;
      }
      normalized++;
      if (!dryRun) {
        await dbRun(
          `UPDATE presentation_decks
           SET deck_json = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND organization_id = ?`,
          [nextJson, row.id, row.organization_id]
        );
      }
    } catch (error: any) {
      failed++;
      retryPointers.push({
        deckId: row.id,
        reason: String(error?.message || 'normalization_failed'),
      });
      logger.warn('[PresentationMigration] Failed to normalize deck', {
        deckId: row.id,
        error: error?.message || String(error),
      });
    }
  }

  await dbRun(
    `INSERT INTO presentation_migration_reports
      (id, organization_id, run_mode, total_decks, normalized_decks, skipped_decks, failed_decks, retry_pointer_json, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      organizationId || null,
      dryRun ? 'dry_run' : 'apply',
      rows.length,
      normalized,
      skipped,
      failed,
      JSON.stringify(retryPointers),
      dryRun
        ? 'Dry run completed. Re-run with --dry-run=false to apply.'
        : 'Normalization applied to mutable deck rows.',
      'system',
    ]
  );

  logger.info('[PresentationMigration] Legacy normalization run complete', {
    runId,
    mode: dryRun ? 'dry_run' : 'apply',
    total: rows.length,
    normalized,
    skipped,
    failed,
  });
}

run().catch((error) => {
  logger.error('[PresentationMigration] Fatal failure', error);
  process.exitCode = 1;
});
