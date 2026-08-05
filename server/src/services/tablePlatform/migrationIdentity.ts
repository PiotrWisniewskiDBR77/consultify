/**
 * Single source of truth for "which files are migrations" and "how a
 * migration's checksum is computed".
 *
 * Both the runtime runner (migrationRunner.ts) and the release preflight
 * (server/scripts/preflight-pending-migrations.ts) import from here. They
 * previously each carried their own copy of the pattern and no shared
 * checksum at all, so the preflight promised drift detection it could not
 * perform. A parity test pins the two to this module.
 */
import crypto from 'crypto';

/**
 * Discovery pattern for migrations the RUNTIME runner applies.
 *
 * Deliberately NOT widened to 9xx: four unrelated `932_*` files exist in
 * server/migrations (canonical_inbox_items, decision_workflow,
 * initiative_candidate_acceptance_receipt, report_builder_archive_columns)
 * and widening would activate all of them at once without individual review.
 * A migration that must run at runtime gets a date prefix instead.
 *
 * ★ M02-P18 — resolution of findings M02-019/M02-020 ("932 duplicate
 * numbering, identity/checksum bookkeeping contested"): `932_
 * canonical_inbox_items_source_status_initiative.sql` and `932_
 * decision_workflow_canonical.sql` sit side by side in server/migrations
 * with the SAME leading number. Both target tables (`canonical_inbox_items`,
 * `decisions`) already exist and are populated on demo — they were applied
 * out-of-band by the manual runner (`server/scripts/migrate.postgres.ts`,
 * which tracks its own `schema_migrations` table and has no MIGRATION_PATTERN
 * restriction), not by this runtime runner.
 *
 * Neither file matches MIGRATION_PATTERN (both start with `9`, neither is an
 * 8-digit date) and neither is in RUNTIME_MIGRATION_ALLOWLIST below — so
 * `isRuntimeMigrationFile()` returns false for both, on purpose. That means
 * this runner and the preflight that shares its predicate NEVER discover
 * either file: no pending-migration report, no checksum comparison, no
 * DDL re-run. The fix for M02-019/M02-020 is therefore this exclusion itself
 * (a discovery-layer decision, verified by test — see
 * `m02p18-runner-identity-reconciliation.realdb.test.ts`), not a second
 * CREATE TABLE or a rename. A rename to a dated, unambiguous filename (which
 * would bring the Decision migration under this runner's tracking) is
 * product code — M02-B's candidate does exactly that
 * (`20260804_decision_workflow_canonical.sql`) — and is explicitly OUT OF
 * SCOPE for this infrastructure-only packet; whoever lands the Decisions
 * family (P06) owns that rename.
 *
 * Even if a future packet DID allowlist one of these two files by full
 * filename, full-filename keying (a Set, not a numeric-prefix comparison)
 * means the two `932_*` files could never collide with each other in
 * `tp_migration_history` (its `filename` column is UNIQUE) or in discovery
 * — same guarantee that already protects the three independently-numbered
 * `942_*` files below.
 */
export const MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/;

/**
 * ★ EXPLICIT ALLOWLIST — the ONE sanctioned exception to the pattern above.
 *
 * A date prefix is the normal answer, but it is not always available. The
 * MANUAL runner (`server/scripts/migrate.postgres.ts`) sorts dated files into a
 * later phase than numbered ones, so a dated name for the Ideas collaboration
 * producer would run AFTER `20260802_swot_proposals.sql`, which needs
 * `tool_sessions` to already exist — renaming would reintroduce the very
 * failure that migration was written to remove.
 *
 * Each entry is an individually accepted migration: one line, one owner. This
 * list is what lets the pattern stay narrow — adding a name here is a
 * reviewable act, widening the regex is not.
 */
export const RUNTIME_MIGRATION_ALLOWLIST: readonly string[] = Object.freeze([
  // M02-C: sole producer of tool_sessions / tool_session_presence (Ideas
  // collaboration presence). Without it a fresh deploy answers every
  // /api/realtime-v4/tool-sessions/* call with HTTP 500 — the manual script
  // applied it, this runner did not, and nothing said so.
  '942_ideas_collaboration_tool_sessions.sql',
  // M01-PRUN (CHAT-07): adds work_canvas_proposals.client_idempotency_key +
  // its partial unique index, closing a create-proposal race. "800_" matches
  // neither branch of MIGRATION_PATTERN (not 7xx, not an 8-digit date), so
  // without this entry every deploy would silently skip it and the race
  // window would stay open in production while the manual script (which has
  // no such restriction) papered over the gap in ad-hoc runs.
  '800_chat_007_proposal_idempotency_key.sql',
  // M01-PRUN (M01-P04A): adds conversation_message_attachments.status (+
  // status_reason/status_detail), its idempotency index, and
  // knowledge_docs.organization_id (activates an already-written tenant-scope
  // write in ai.routes.ts). Shares the "942_" numeric prefix with the Ideas
  // collaboration migration above by coincidence of independent numbering —
  // the two are unrelated tables with no FK between them, and discovery here
  // keys off the full filename (a Set, not the prefix), so there is no
  // collision at this layer. See migrationRunner.ts's discoverMigrationFiles
  // for the sort-order guarantee between same-prefix files.
  '942_chat_m01p04a_attachment_status.sql',
  // M02-P18 (finding M02-020/M02-021): `940_mw010_vault_document_versions.sql`
  // creates `knowledge_doc_versions` and adds `knowledge_docs.version` /
  // `.deleted_at` / `.file_size_bytes`. Confirmed on live demo (read-only
  // to_regclass check, 2026-08-05): the table does NOT exist there — this
  // migration's DDL has never run on demo, only its .sql file exists in the
  // repo. Verified idempotent by inspection: every statement is
  // `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` /
  // `CREATE INDEX IF NOT EXISTS`, and the one data-mutating block (backfill)
  // is wrapped in a guard that checks all four columns it reads exist before
  // touching a row — safe to allowlist so the NEXT real deploy closes this
  // gap automatically through the normal fail-closed/atomic runner. This
  // packet does not and must not run it against demo itself (no DDL/DML
  // against demo is permitted here); allowlisting only changes what a
  // FUTURE deploy will discover.
  '940_mw010_vault_document_versions.sql',
  // M02-P16b: adds `ai_agent_plans.run_idempotency_key`, closing a
  // double-submit race on POST /api/ai/agent-plan/:id/run one layer above
  // 941's claimExecution() lease CAS. Shares the "942_" numeric prefix with
  // the Ideas collaboration (M02-C) and chat attachment-status (M01)
  // migrations above by coincidence of independent numbering — a THIRD,
  // unrelated table with no FK to either, and discovery here keys off the
  // full filename (a Set), so there is no collision at this layer either.
  // Coordinator-reviewed defect (M02-P16B_REVIEW.md): the packet added this
  // file but never allowlisted it, so `isRuntimeMigrationFile()` returned
  // false and a real deploy would never have discovered or applied it —
  // the exact M02-020/M02-021 defect class, caught before landing this time.
  '942_ai_agent_plan_run_idempotency.sql',
]);

const ALLOWLIST_SET = new Set(RUNTIME_MIGRATION_ALLOWLIST);

/**
 * THE discovery predicate: will the runtime runner apply this file?
 *
 * Everything that needs that answer — the runner, the release preflight, the
 * parity tests — must call this, never `MIGRATION_PATTERN` directly, or the
 * allowlist silently stops applying in one of them.
 */
export function isRuntimeMigrationFile(filename: string): boolean {
  return MIGRATION_PATTERN.test(filename) || ALLOWLIST_SET.has(filename);
}

/** Copy of the allowlist, so a test can prove it stays narrow. */
export function getRuntimeMigrationAllowlist(): string[] {
  return [...RUNTIME_MIGRATION_ALLOWLIST];
}

/**
 * Checksum recorded in `tp_migration_history.checksum`.
 * sha256, hex, truncated to 16 chars — the truncation is part of the stored
 * format, so any comparison MUST use this function rather than a fresh hash.
 */
export function fileChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/** How a stored checksum compares to the file on disk. */
export type ChecksumVerdict = 'match' | 'drift' | 'unverifiable';

/**
 * Classifies a stored checksum against current file content.
 *
 * A NULL/empty stored checksum predates checksum recording (demo has 181 such
 * rows). That is `unverifiable`, NOT drift — treating it as drift would
 * fail-close every legacy environment on the spot.
 */
export function classifyChecksum(
  storedChecksum: string | null | undefined,
  fileContent: string
): ChecksumVerdict {
  if (storedChecksum == null || storedChecksum === '') return 'unverifiable';
  return fileChecksum(fileContent) === storedChecksum ? 'match' : 'drift';
}
