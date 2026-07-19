/**
 * Conflict-target registry for the SQLite -> PostgreSQL upsert adapter.
 *
 * WHY THIS EXISTS
 * ---------------
 * `adaptQuery()` in PostgresDatabase.ts rewrites SQLite `INSERT OR REPLACE`
 * and `INSERT OR IGNORE` into PostgreSQL `INSERT ... ON CONFLICT (...)`. The
 * legacy heuristic always used the FIRST column of the INSERT column list as
 * the conflict target. For every table whose upsert dedups on a natural key
 * (composite UNIQUE / non-`id` PK) while inserting a fresh surrogate `id`
 * first, that heuristic targeted the wrong column — the REPLACE/IGNORE either
 * never fired (silent duplicate rows) or raised "no unique or exclusion
 * constraint matching the ON CONFLICT specification". This was the root cause
 * of ~6 real RED-sec bugs (organization_settings, invoices billing sync,
 * project membership, role permissions, task dependencies, ...).
 *
 * CTO DECISION (Fable)
 * --------------------
 *   1. Registry is EXPLICIT: table -> ordered list of conflict-target columns.
 *   2. A table with an entry uses that entry as the ON CONFLICT target.
 *   3. A table WITHOUT an entry logs a loud `warn` (once per process) and
 *      falls back to the historical first-column heuristic — ZERO change of
 *      semantics for unregistered tables.
 *
 * HOW THE TARGETS WERE DERIVED
 * ----------------------------
 * Every column list below was verified against the live parity Postgres
 * (`:5443`, dump shared with demo) via `pg_constraint` / `pg_indexes`, and
 * cross-checked so that all target columns actually appear in the runtime
 * INSERT statement. Where the parity/demo schema has drifted away from the
 * migration source (e.g. a composite UNIQUE that was never applied on demo),
 * the entry deliberately uses the constraint that EXISTS in the live DB so the
 * generated `ON CONFLICT` cannot raise "no matching constraint" at runtime.
 * Such cases are annotated inline.
 *
 * DELIBERATELY OMITTED (fall through to warn-loud + first-column heuristic):
 *   - link_graph_edges  : its only natural UNIQUE is an expression index using
 *                         COALESCE(...) and therefore cannot be named by a
 *                         plain `ON CONFLICT (col, ...)` column list.
 *   - ai_settings       : no CREATE TABLE for the bare `ai_settings` table
 *                         found anywhere in the codebase — cannot verify a key.
 *   - pmo_domains,
 *     project_pmo_domains: no schema definition found in src or migrations.
 */

import logger from '../utils/Logger.js';

/**
 * Map of table name (lower-case) -> ordered conflict-target columns.
 * The order matters: it is emitted verbatim into `ON CONFLICT (a, b, c)`.
 */
export const CONFLICT_TARGETS: Readonly<Record<string, readonly string[]>> = {
  // --- Composite / natural-key upserts (FIX vs. legacy first-column) ---
  admin_role_assignments: ['organization_id', 'user_id', 'role_id'],
  ai_actions_config: ['organization_id', 'project_id'],
  ai_dismissed_nudges: ['nudge_id', 'user_id'],
  ai_nudge_actions: ['nudge_id', 'user_id'], // schema: migration 520 (absent from parity dump)
  ai_nudge_suppressions: ['user_id', 'nudge_type'], // schema: proactiveNudges.ts / migration 520
  analytics_snapshots: ['organization_id', 'snapshot_date'], // schema: migration 261
  assessment_definitions: ['methodology_id', 'version'],
  assessment_responses: ['assessment_id', 'question_id'], // schema: migration 248
  budget_initiative_links: ['budget_id', 'initiative_id'],
  content_favorites: ['user_id', 'content_id', 'content_type'], // schema: migration 047
  content_permissions: ['content_id', 'content_type', 'user_id', 'permission_key'], // migration 048
  content_tag_mappings: ['content_id', 'content_type', 'tag_id'], // schema: migration 047
  exchange_rates: ['from_currency', 'to_currency'], // schema: migration 030
  invoices: ['stripe_invoice_id'], // FIX: Stripe invoice sync deduped on random id before
  llm_tier_assignments: ['provider_id', 'tier'],
  my_work_signal_dismissals: ['user_id', 'signal_key'],
  my_work_signal_snoozes: ['user_id', 'signal_key'],
  organization_provider_settings: ['organization_id', 'provider_id'],
  organization_settings: ['organization_id', 'setting_key'], // FIX: was targeting organization_id only
  project_members: ['project_id', 'user_id'],
  project_steering_board_members: ['project_id', 'user_id'],
  role_permission_assignments: ['role_id', 'permission_id'],
  role_permissions: ['role', 'permission_key'],
  task_dependencies: ['from_task_id', 'to_task_id'], // FIX: idx_task_deps_unique (verified in parity DB)
  team_members: ['team_id', 'user_id'],
  user_group_members: ['group_id', 'user_id'], // schema: migration 015
  vat_validations: ['vat_number', 'country_code'], // schema: migration 150

  // --- Single natural-key upserts (UNIQUE or non-id PK) ---
  ai_purposes: ['purpose'],
  my_work_signal_prefs: ['user_id'],
  organization_billing: ['organization_id'], // UNIQUE(organization_id); insert omits id
  permissions: ['key'],
  project_notification_settings: ['project_id'], // UNIQUE(project_id)
  revoked_tokens: ['jti'],
  settings: ['key'],
  user_activation_status: ['user_id'],
  user_token_balance: ['user_id'],

  // --- Surrogate-id upserts: id is the only constraint that exists in the ---
  // --- live DB (deterministic or append-only inserts). Matches legacy      ---
  // --- behaviour but is now explicit so the warn does not fire.            ---
  ai_feedback: ['id'],
  ai_quality_metrics: ['id'], // natural (organization_id, metric_date) UNIQUE absent on demo/parity (drift)
  benchmark_datasets: ['id'],
  circuit_breaker_state: ['id'], // runtime insert writes (id, service, ...); breaker_key not inserted
  compliance_frameworks: ['id'], // deterministic framework id; name-UNIQUE absent on demo/parity (drift)
  feedback_trending_topics: ['id'],
  initiative_dependencies: ['id'], // no (from,to) UNIQUE in live DB
  initiative_section_types: ['id'],
  knowledge_chunks: ['id'],
  knowledge_docs: ['id'],
  market_trends: ['id'],
  organization_limits: ['id'], // UNIQUE(organization_id) absent on demo/parity (drift) — id PK only
  report_builder_templates: ['id'],
  role_change_audit_events: ['id'],
  tier_round_robin_state: ['id'], // id is deterministic (`${org}-${tier}`)
};

/** Normalise a raw table token (strip quotes/backticks, trim, lower-case). */
export function normalizeTableName(rawTable: string): string {
  return rawTable.replace(/["'`]/g, '').trim().toLowerCase();
}

/**
 * Registered conflict-target columns for a table, or `undefined` when the
 * table is not in the registry.
 */
export function getConflictTarget(rawTable: string): readonly string[] | undefined {
  return CONFLICT_TARGETS[normalizeTableName(rawTable)];
}

// Warn at most once per (table) per process so the signal is loud but not a flood.
const warnedTables = new Set<string>();

/**
 * Loud, once-per-table warning emitted when an `INSERT OR REPLACE/IGNORE`
 * targets a table with no registry entry. Used only on the fallback path.
 */
export function warnUnregisteredConflictTable(
  rawTable: string,
  mode: 'REPLACE' | 'IGNORE',
  fallbackColumn: string
): void {
  const table = normalizeTableName(rawTable);
  if (warnedTables.has(table)) return;
  warnedTables.add(table);
  logger.warn(
    `[adaptQuery] INSERT OR ${mode} INTO "${table}" has no entry in conflictTargets registry; ` +
      `falling back to first-column heuristic ON CONFLICT (${fallbackColumn}). ` +
      `If "${fallbackColumn}" is not this table's real unique/primary key the upsert may ` +
      `silently duplicate rows or fail. Add "${table}" to server/src/database/conflictTargets.ts.`
  );
}

/**
 * Resolve the conflict-target column list (as a ready-to-embed
 * `col1, col2` string) for a table. Registered tables return their explicit
 * target; unregistered tables warn loudly and return the caller-supplied
 * `fallbackColumn` so historical behaviour is preserved exactly.
 */
export function resolveConflictTargetSql(
  rawTable: string,
  fallbackColumn: string,
  mode: 'REPLACE' | 'IGNORE'
): string {
  const registered = getConflictTarget(rawTable);
  if (registered && registered.length > 0) {
    return registered.join(', ');
  }
  warnUnregisteredConflictTable(rawTable, mode, fallbackColumn);
  return fallbackColumn;
}
