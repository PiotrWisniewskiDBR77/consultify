/**
 * Czysta logika PORZĄDKOWANIA migracji — wydzielona z `migrate.postgres.ts`.
 *
 * POWÓD WYDZIELENIA:
 * `migrate.postgres.ts` jest plikiem WYKONYWALNYM: ma shebang `#!/usr/bin/env tsx`
 * (łamie parser Rollupa używanego przez vitest — `Parse failure: Expected ident`)
 * i uruchamia migracje na poziomie modułu (sam import kończył się
 * `❌ Postgres migrate failed: DATABASE_URL is required`).
 * Przez to kolejności migracji NIE DAŁO SIĘ przetestować inaczej niż kopiując
 * logikę do testu — a kopia testowałaby samą siebie i przepuściła każdą rozbieżność.
 *
 * Ten moduł jest CZYSTY: bez shebangu, bez bazy, bez env, bez efektów ubocznych.
 * `migrate.postgres.ts` pozostaje jedynym entrypointem i importuje stąd.
 * Zachowanie runnera jest identyczne — dowiedzione porównaniem pełnej listy
 * 576 migracji z `--dry-run` przed i po wydzieleniu.
 */

export type Migration = {
  version: string;
  filename: string;
  filepath: string;
  checksum: string;
};

export const NUMBERED_RE = /^(\d{3})[a-zA-Z]?_/;
export const DATED_RE = /^(\d{4})-?(\d{2})-?(\d{2})[_-]/;

// Filenames that must run after every phase-0 (numbered) and phase-1 (dated)
// migration. Each entry is a hotfix/backfill/guard whose own date prefix
// would otherwise place it too early relative to other dated migrations it
// actually depends on. See STRICT_SCHEMA_REPAIR_REPORT.md ETAP 1 for the
// per-file dependency trace that justifies each entry.
export const LATE_PHASE_MANIFEST: string[] = [
  // Consumer of tool_initiative_links, whose canonical producer is the
  // phase-1 migration 20260719_baseline_gap.sql. Keep this numeric migration
  // in phase 2 so it cannot run before its producer on a fresh database.
  '948_tool_promotion_tenant_idempotency.sql',
];
export const LATE_PHASE_SET = new Set(LATE_PHASE_MANIFEST);

// `isSqliteOnlyMigration()` blanket-excludes every numbered migration with
// version < 500 as "legacy/SQLite-first, superseded by the baseline". That
// heuristic is correct for most of the <500 range, but a handful of those
// files are the ONLY producer of a table that later (>=500 or dated)
// migrations depend on, are already fully Postgres-native (CREATE TABLE IF
// NOT EXISTS, no SQLite dialect), and do not conflict with anything
// `000_z_core_baseline.sql` creates. Excluding them entirely — rather than
// just re-ordering them — left those tables uncreated on a genuinely fresh
// strict run even after the phase fix above (verified against a live
// Postgres catalog, not just exit codes). Each entry here is promoted back
// into the run (still sorted into phase 0 by its own numeric version, so it
// runs alongside the other historical producers) with a one-line reason.
// See STRICT_SCHEMA_REPAIR_REPORT.md ETAP 1/3 for the full trace.
export const PROMOTED_LEGACY_PRODUCERS: string[] = [
  // Sole producer of `studio_documents`, `studio_snapshots`, and the related
  // Studio CRUD tables used by the mounted `/api/studio` routes. The file is
  // Postgres-compatible after the runner's narrow DATETIME/boolean shims and
  // depends only on core baseline tables. Excluding it made strict fresh
  // schema report success while every mounted Studio persistence call failed
  // at runtime with a missing relation.
  '081_studio_tables.sql',
  // Sole producer of `conversations` / `conversation_messages` for the
  // strict path (000_z_core_baseline.sql does not create them). Consumed by
  // 515_team_chat_projects.sql (ALTER ... ADD COLUMN). Already
  // Postgres-native (gen_random_uuid()::text, NOW(), JSONB, catalog-guarded
  // DO $$ blocks) — no SQLite idiom, no conflict with baseline.
  '073_conversations.sql',
  // Sole producer of `partner_organizations`, `partner_users`,
  // `partner_certifications`, etc. Consumed by 730_partner_users_uuid_columns.sql,
  // 778_partner_users_missing_columns.sql, 799_partner_certifications_missing_columns.sql,
  // 555_partner_resources.sql, 20260719_baseline_gap.sql. Postgres-native
  // (gen_random_uuid(), no SQLite idiom); no conflicting definition in baseline.
  '215_partner_portal.sql',
  // Sole producer of `integrations` / `integration_providers`. Consumed by
  // 566_sync_hub_guardrails_t086_t008.sql (guarded ALTER via
  // information_schema check, but needs the table itself to exist first).
  // Postgres-native, no SQLite idiom, no baseline conflict.
  '256_integrations_system.sql',
];
export const PROMOTED_LEGACY_SET = new Set(PROMOTED_LEGACY_PRODUCERS);

// Two kinds of producer/consumer inversion that phase + numeric/date sort
// alone cannot fix, because they invert relative to their OWN phase's sort
// key (not just the numbered-vs-dated phase boundary already handled above):
//
//   a) A lower-numbered phase-0 file consumes a table only a HIGHER-numbered
//      phase-0 file creates (e.g. 559 needs 739's kb_categories).
//   b) A phase-0 (numbered) file consumes a table only a phase-1 (dated)
//      file creates (e.g. 756_interview_insight_downstream_lineage.sql
//      needs my_ideas, created by 20260220_my_work_my_ideas.sql).
//
// Rather than moving every small consumer, this forces the ONE
// self-contained producer into phase 0 at a synthetic version, so it runs
// early alongside the other historical producers. The real filename is
// untouched; only its sort position changes.
export const EARLY_VERSION_OVERRIDES: Record<string, number> = {
  // Self-contained (no FK to anything outside kb_*); creates
  // kb_categories/kb_articles/kb_category_translations/kb_article_translations,
  // consumed by 559_tools_known_tools_library.sql and
  // 562_tools_toolsets_speed.sql (both < 739 numerically). Sorted to run
  // right after 558 / before 559 so both consumers see the tables.
  '739_knowledge_base_public_articles.sql': 558.5,
  // Self-contained (no FK at all); sole producer of `my_ideas`, consumed by
  // 756_interview_insight_downstream_lineage.sql (phase 0). Without this
  // override it would run in phase 1 (dated), after phase 0 already needed
  // it. Sorted to run early in phase 0 (before 502, the first "real"
  // producer in that range) since nothing else needs to precede it.
  '20260220_my_work_my_ideas.sql': 501.5,
  // Large ~55-table "prod missing tables" reconciliation dump. All of its
  // CREATE TABLE statements are self-contained IF NOT EXISTS, and its only
  // external FK targets (organizations/projects/users/reports/invoices/
  // webhooks) are already produced by baseline or the 000_zz producer file.
  // Its number (900) sorted it far too late: 792_admin_sessions_extended_columns.sql
  // (ALTER, guarded but needs the table) and other consumers in the 790s
  // need admin_sessions/admin_audit_logs/etc. before then. Sorted to run
  // right after the 000_zz producer file, before any other 500+ producer.
  '900_prod_missing_tables_hotfix.sql': 501.6,
  // Sole producer of `permission_requests`. Consumed by
  // 795_permission_requests_missing_columns.sql (phase 0, numbered).
  // Self-contained (only FK to organizations/users, both baseline).
  '20260101_add_profile_fields_and_permission_requests.sql': 501.7,
  // Sole producer of `financial_statement_packs`. Consumed by
  // 915_finance_aggregate_scope.sql (phase 0). Also ALTERs `financial_models`
  // (produced by 571_financial_modeling_t054.sql), so it cannot move all the
  // way to the front — sorted to run right after 571 instead.
  '20260316_financial_statement_packs.sql': 571.5,
  // Sole producer of `initiative_candidates`. Consumed by
  // 932_initiative_candidate_acceptance_receipt.sql (phase 0). No FK at all.
  '20260627_initiative_candidates.sql': 501.8,
  // Additive core parity is the sole producer of initiatives.title, consumed
  // by 20260624_initiative_status_normalize.sql. Its dated filename otherwise
  // sorts after that consumer on a fresh schema. Baseline already creates the
  // projects/initiatives tables; every DDL statement is guarded and the
  // backfill is idempotent, so running it here closes the ordering inversion
  // without editing any already-applied migration file/checksum.
  '20260802_mvp_core_schema_parity.sql': 501.9,
  // Canonical additive producer of initiative_milestones/resources/raid_items.
  // The dated consumer 20260720_fala4_kpi_snap_milestone_deps_ai_policies.sql
  // creates FKs to initiative_milestones, so the producer's 2026-08-01 name
  // otherwise sorts too late on a fresh schema. It depends only on baseline
  // organizations/initiatives/tasks and is fully replay-safe.
  '20260801_exe002004_idempotency_keys.sql': 501.95,
  // Sole producer of interview_library_template_questions.answer_type (+
  // several sibling columns) and interview_library_template_versions.
  // Consumed by 20260703_interview_question_consultant_grade_rewrite.sql
  // (dated, but earlier date than this file's own 2026-08-02 name — a
  // same-phase-1 producer/consumer inversion, not just the numbered/dated
  // boundary). All statements are `ALTER TABLE IF EXISTS ... ADD COLUMN IF
  // NOT EXISTS` — safe to run early EXCEPT that "IF EXISTS" on the target
  // table means running it before interview_library_template_questions
  // exists would silently no-op and mark this migration 'success' forever,
  // never actually adding the columns. Sorted to run right after
  // 727_beta_missing_tables.sql (which creates that table), not all the way
  // to the front.
  '20260802_int001_template_publication_versions.sql': 727.5,
};

// Several Case Workspace packets intentionally share the same date prefix but
// encode their dependency order as CW-P01..CW-P11, not alphabetically. Keep
// them in the dated phase while making that declared producer/consumer order
// executable on a fresh database.
export const SAME_DATE_ORDER_OVERRIDES: Record<string, string> = {
  '20260809_case_workspace_case_core.sql': '20260809_01',
  '20260809_case_workspace_case_plan_version.sql': '20260809_02',
  '20260809_case_workspace_capability_registry.sql': '20260809_03',
  '20260809_case_workspace_run_binding.sql': '20260809_04',
  '20260809_case_workspace_proposals_approvals.sql': '20260809_05',
  '20260809_case_workspace_wait_subscription.sql': '20260809_06',
  '20260809_case_workspace_history_value.sql': '20260809_07',
  '20260809_case_workspace_plays.sql': '20260809_08',
  '20260809_case_workspace_artifact_links.sql': '20260809_09',
  '20260809_case_workspace_execution_graph.sql': '20260809_10',
  '20260809_case_workspace_migration_readiness.sql': '20260809_11',
};

// ---------------------------------------------------------------------------
// Closed classification manifest — the end of the silent "phase 3" catch-all
// ---------------------------------------------------------------------------
// `phaseAndKeyFor()` used to end with an unconditional `return { phase: 3 }`
// for any filename matching neither NUMBERED_RE nor DATED_RE. That made an
// unrecognized name indistinguishable from a deliberately order-independent
// one: a typo'd migration silently ran LAST instead of failing, with no log
// line and exit code 0.
//
// Every currently-unclassifiable filename on disk is enumerated below
// (measured: 16 of the 979 runnable top-level entries). Anything NOT listed
// here and not matching either pattern is now a hard error.
//
// All three groups keep `{ phase: 3, key: filename }` — byte-identical to the
// previous behavior. This manifest removes the SILENCE, not the ordering: no
// migration changes execution position as a result of this change.
export const ORDER_INDEPENDENT_MANIFEST: string[] = [
  // Extension bootstrap; creates no schema objects other migrations order
  // against. Genuinely position-independent — the only member of this set
  // the original phase-3 comment actually intended.
  'init-pgvector.sql',
];

// Legacy SQLite-first scaffolding. `isSqliteOnlyMigration()` in
// migrate.postgres.ts already excludes every one of these from a normal
// strict run (they start with `add_`, or are named explicitly there), so in
// practice they never reach the sorter. They are classified anyway because
// an explicit `--only <file>` run BYPASSES that exclusion filter and would
// otherwise throw on a file the runner is deliberately able to run.
export const LEGACY_NON_SCHEMA_MANIFEST: string[] = [
  'add_chat_projects.js',
  'add_chat_projects.sql',
  'add_mywork_tables.sql',
  'add_response_feedback.sql',
  'assessment-module.sql',
  'fix_conversations_table.sql',
];

// Dated migrations carrying a single-letter INTRADAY ordering suffix
// (`20260810c_`, `20260813b_`). DATED_RE does not admit that suffix, so all
// nine currently fall through to phase 3 and execute LAST — measured, on a
// virgin database, as running after `20261019_*`, roughly two months later
// than their own names imply.
//
// They are pinned here at their CURRENT position on purpose. Widening
// DATED_RE to admit the suffix would move all nine several hundred positions
// earlier into date-ordered phase 1, which is plausibly their intended
// order — but that is a re-sequencing of nine production migrations, and
// proving it safe needs the fresh-container dry-run diff described in
// STRICT_SCHEMA_REPAIR_REPORT.md ETAP 1, not a classification change. Kept
// order-identical here; the re-sequencing question is deliberately left open
// rather than smuggled in behind a regex edit.
export const INTRADAY_SUFFIX_MANIFEST: string[] = [
  '20260802c_mat010_operation_claims_table.sql',
  '20260810c_case_workspace_inbox_ambiguous_code.sql',
  '20260810d_case_workspace_case_identity.sql',
  '20260810e_case_workspace_event_correlation.sql',
  '20260810f_case_workspace_append_only_guards.sql',
  '20260811a_case_workspace_run_lifecycle.sql',
  '20260812a_case_workspace_outbox_next_retry_at.sql',
  '20260813b_audits_source_classification_split.sql',
  '20260813c_method_core_roles_and_approvals.sql',
];

export const UNORDERED_PHASE_MANIFEST: string[] = [
  ...ORDER_INDEPENDENT_MANIFEST,
  ...LEGACY_NON_SCHEMA_MANIFEST,
  ...INTRADAY_SUFFIX_MANIFEST,
];
export const UNORDERED_PHASE_SET = new Set(UNORDERED_PHASE_MANIFEST);

export class UnclassifiedMigrationFilenameError extends Error {
  constructor(public readonly filename: string) {
    super(
      `UNCLASSIFIED MIGRATION FILENAME: '${filename}' matches neither NUMBERED_RE (NNN_) nor ` +
        `DATED_RE (YYYYMMDD_ / YYYY-MM-DD_), and is not listed in UNORDERED_PHASE_MANIFEST, ` +
        `LATE_PHASE_MANIFEST, EARLY_VERSION_OVERRIDES or SAME_DATE_ORDER_OVERRIDES. Refusing to ` +
        `guess its execution position. Rename it to match a supported convention, or add it to an ` +
        `explicit manifest with a reason.`
    );
    this.name = 'UnclassifiedMigrationFilenameError';
  }
}

export class DuplicateSortKeyError extends Error {
  constructor(
    public readonly filenameA: string,
    public readonly filenameB: string,
    public readonly phase: number,
    public readonly key: string
  ) {
    super(
      `DUPLICATE SORT KEY: '${filenameA}' and '${filenameB}' both resolve to phase ${phase}, key ` +
        `'${key}'. Their relative execution order would be decided by Array.prototype.sort's ` +
        `tie handling rather than by this comparator, so the run order is not a deterministic ` +
        `total order. Give them distinct ordering identity.`
    );
    this.name = 'DuplicateSortKeyError';
  }
}

export class OverrideMapCollisionError extends Error {
  constructor(public readonly filename: string, public readonly maps: string[]) {
    super(
      `OVERRIDE MAP COLLISION: '${filename}' appears in more than one classification map ` +
        `{${maps.join(', ')}}. Only the first branch checked in phaseAndKeyFor() wins; every other ` +
        `entry is dead configuration that reads as active. Remove it from all but one map.`
    );
    this.name = 'OverrideMapCollisionError';
  }
}

/**
 * Pure. Verifies no filename is claimed by two classification maps at once.
 * `phaseAndKeyFor()` cannot detect this on its own — it consults exactly one
 * map per call (the first that matches) and silently ignores the rest.
 */
export function validateOverrideMapsAreDisjoint(): void {
  const membership = new Map<string, string[]>();
  const record = (filename: string, mapName: string) => {
    const seen = membership.get(filename);
    if (seen) seen.push(mapName);
    else membership.set(filename, [mapName]);
  };
  for (const f of LATE_PHASE_MANIFEST) record(f, 'LATE_PHASE_MANIFEST');
  for (const f of Object.keys(EARLY_VERSION_OVERRIDES)) record(f, 'EARLY_VERSION_OVERRIDES');
  for (const f of Object.keys(SAME_DATE_ORDER_OVERRIDES)) record(f, 'SAME_DATE_ORDER_OVERRIDES');
  for (const f of UNORDERED_PHASE_MANIFEST) record(f, 'UNORDERED_PHASE_MANIFEST');

  for (const [filename, maps] of membership) {
    if (maps.length > 1) throw new OverrideMapCollisionError(filename, maps);
  }
}

export function phaseAndKeyFor(m: Migration): { phase: number; key: string } {
  const f = m.filename;
  if (LATE_PHASE_SET.has(f)) {
    return { phase: 2, key: f };
  }
  if (Object.prototype.hasOwnProperty.call(EARLY_VERSION_OVERRIDES, f)) {
    const version = EARLY_VERSION_OVERRIDES[f];
    const paddedInt = String(Math.trunc(version)).padStart(6, '0');
    const fraction = version % 1 !== 0 ? String(version).split('.')[1] : '0';
    return { phase: 0, key: `${paddedInt}.${fraction}_${f}` };
  }
  if (Object.prototype.hasOwnProperty.call(SAME_DATE_ORDER_OVERRIDES, f)) {
    return { phase: 1, key: `${SAME_DATE_ORDER_OVERRIDES[f]}_${f}` };
  }
  const numbered = f.match(NUMBERED_RE);
  if (numbered) {
    const version = Number.parseInt(numbered[1], 10);
    const paddedInt = String(Math.trunc(version)).padStart(6, '0');
    const fraction = version % 1 !== 0 ? String(version).split('.')[1] : '0';
    return { phase: 0, key: `${paddedInt}.${fraction}_${f}` };
  }
  const dated = f.match(DATED_RE);
  if (dated) {
    const [, y, mo, d] = dated;
    return { phase: 1, key: `${y}${mo}${d}_${f}` };
  }
  if (UNORDERED_PHASE_SET.has(f)) {
    return { phase: 3, key: f };
  }
  throw new UnclassifiedMigrationFilenameError(f);
}

export function compareMigrationOrder(a: Migration, b: Migration): number {
  const pa = phaseAndKeyFor(a);
  const pb = phaseAndKeyFor(b);
  if (pa.phase !== pb.phase) return pa.phase - pb.phase;
  if (pa.key === pb.key) {
    if (a.filename === b.filename) return 0;
    throw new DuplicateSortKeyError(a.filename, b.filename, pa.phase, pa.key);
  }
  return pa.key < pb.key ? -1 : 1;
}

export function sortMigrationsDeterministically(migrations: Migration[]): Migration[] {
  return [...migrations].sort(compareMigrationOrder);
}
