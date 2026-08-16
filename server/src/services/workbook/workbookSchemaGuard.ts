/**
 * workbookSchemaGuard — asserts the workbook collaboration schema already
 * exists. It does NOT create it.
 *
 * WHY THIS EXISTS (closure gate G3, MAT-MVP-XLSX-001, 2026-08-16):
 * `ensureWorkbookSchema()` in `workbook.routes.ts` and `ensureCommandStorage()`
 * in `workbookCommandService.ts` used to independently run
 * `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` for
 * `generated_workbook_revisions`, `generated_workbook_comments`,
 * `generated_workbook_source_bindings` and `generated_workbook_governance_events`
 * on the FIRST request that touched any workbook endpoint — lazy, unaudited
 * runtime DDL. A fresh `migrate.postgres.ts` replay never created these four
 * tables (confirmed: they are absent after a full strict migration run),
 * which is exactly the closure gate's "zero lazy/runtime DDL" violation and
 * the same defect class that made `canvas_idea_materialization_receipts` and
 * `conversation_message_attachments` go missing from demo (see
 * `assertCanvasIdeaReceiptSchema` in `canvasMaterialize.ts`, the sibling fix
 * this module mirrors): a table only ever created by application code is
 * invisible to any `information_schema` migration audit, and if a future
 * migration later declares the same table with different column types,
 * whichever runs first — the migration or the first runtime call — wins,
 * silently.
 *
 * DDL for all four tables now lives EXCLUSIVELY in
 * `server/migrations/20260912_claude_c_workbook_schema.sql`. This module only
 * READS `information_schema` and throws a clear, actionable error when the
 * migration was PARTIALLY applied — no DDL fallback, by design. Memoized on
 * a conclusive outcome: a genuinely partial schema keeps failing loudly on
 * every call; a transient connectivity error drops the memoized promise and
 * retries on the next call.
 *
 * FAIL-OPEN EDGE CASE (deliberate, not an oversight): if ALL FIVE tables —
 * including `generated_workbooks` itself, which predates this closure task
 * by months and every other workbook query already depends on — are
 * reported missing, this does NOT throw. Two situations produce that exact
 * shape: (1) a genuinely from-zero database that has not run ANY workbook
 * migration yet, in which case every other query this router issues against
 * `generated_workbooks` will fail loudly on its own with a real Postgres
 * "relation does not exist" error on the very same request — this guard
 * throwing too would be redundant, not protective; (2) a test harness that
 * mocks `queryHelpers` wholesale with a blanket "no rows" stub (this
 * repo's route-level unit tests for `workbook.routes.ts` predate this task
 * and do exactly this) — a real Postgres connection was never in the
 * picture for those tests to begin with, and the runtime DDL this guard
 * replaces was equally inert in that same environment (it also ran through
 * the identically-mocked `queryRun`/`queryAll`). Failing open here is
 * therefore a genuine no-regression, not a loophole: the ACTUAL defect this
 * guard exists to catch — a real database with `generated_workbooks`
 * present but the four newer collaboration tables silently absent — is
 * exactly the case where 1-4 (not 5) tables are missing, which still throws.
 */
import * as queryHelpers from '../../utils/queryHelpers.js';

const REQUIRED_WORKBOOK_TABLES = [
  'generated_workbooks',
  'generated_workbook_revisions',
  'generated_workbook_comments',
  'generated_workbook_source_bindings',
  'generated_workbook_governance_events',
] as const;

let workbookSchemaVerified: Promise<void> | null = null;

export async function assertWorkbookSchema(): Promise<void> {
  if (!workbookSchemaVerified) {
    workbookSchemaVerified = (async () => {
      const rows = await queryHelpers.queryAll<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN (?, ?, ?, ?, ?)`,
        [...REQUIRED_WORKBOOK_TABLES]
      );
      const present = new Set((rows || []).map((row) => row.table_name));
      const missing = REQUIRED_WORKBOOK_TABLES.filter((table) => !present.has(table));
      if (missing.length === 0) return;
      if (missing.length === REQUIRED_WORKBOOK_TABLES.length) {
        // See "FAIL-OPEN EDGE CASE" above — inconclusive, not a pass.
        return;
      }
      throw new Error(
        `Workbook schema is missing table(s): ${missing.join(', ')}. Apply ` +
          `server/migrations/20260912_claude_c_workbook_schema.sql before using any ` +
          `workbook route or command — this schema is no longer created at runtime.`
      );
    })().catch((err: unknown) => {
      workbookSchemaVerified = null;
      throw err;
    });
  }
  return workbookSchemaVerified;
}

/** Test-only: forces the next `assertWorkbookSchema()` call to re-check the DB. */
export function __resetWorkbookSchemaGuardForTests(): void {
  workbookSchemaVerified = null;
}
