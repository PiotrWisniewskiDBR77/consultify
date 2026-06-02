/**
 * Presentation pipeline migration dry-run service.
 *
 * Pure-logic core for the Consultify presentation migration runbook
 * (Epic I3). Catalogs the known presentation-pipeline migrations, then
 * produces a deterministic dry-run impact report that operators can
 * review and commit alongside the deploy PR.
 *
 * Invariants:
 *   - Read-only: this module never touches the database.
 *   - Never throws: malformed input becomes a `BLOCK` recommendation
 *     with explicit blockers.
 *   - JSON-serializable output (no Dates, no functions, no Symbols).
 *   - Catalog must stay in sync with `server/migrations/76*.sql`. Any
 *     future presentation migration requires a new catalog entry.
 *
 * Companion CLI: `server/scripts/presentation-migration-dry-run.ts`.
 * Companion runbook: `docs/operations/PRESENTATION_MIGRATION_RUNBOOK.md`.
 */

export type MigrationCategory =
  | 'schema_alter'
  | 'data_normalize'
  | 'index_create'
  | 'data_backfill';

export type MigrationRiskTier = 'P0' | 'P1' | 'P2';

export type RollbackStrategy =
  | 'drop_columns'
  | 'restore_snapshot'
  | 'manual_review'
  | 'not_applicable';

export interface MigrationCatalogEntry {
  id: string;
  filename: string;
  category: MigrationCategory;
  affects: string[];
  riskTier: MigrationRiskTier;
  reversible: boolean;
  rollbackStrategy: RollbackStrategy;
  preflightChecks: string[];
  postCheck: string[];
  description: string;
}

export interface DryRunInput {
  migrationIds: string[];
  organizationIds?: string[];
  estimatedDeckCount?: number;
  estimatedTemplateCount?: number;
}

export interface DryRunImpactRow {
  migrationId: string;
  category: MigrationCategory;
  riskTier: MigrationRiskTier;
  estimatedRowsAffected: number | 'unknown';
  estimatedDurationSeconds: number | 'unknown';
  rollbackPossible: boolean;
  warnings: string[];
  blockers: string[];
}

export interface DryRunReport {
  generatedAt: string;
  scope: {
    organizationIds: string[] | 'global';
    estimatedDeckCount: number | null;
    estimatedTemplateCount: number | null;
  };
  impact: DryRunImpactRow[];
  totals: {
    migrations: number;
    p0: number;
    p1: number;
    p2: number;
    reversibleCount: number;
    nonReversibleCount: number;
  };
  recommendation: 'PROCEED' | 'PROCEED_WITH_REVIEW' | 'BLOCK';
  blockers: string[];
}

/**
 * Canonical catalog of presentation-pipeline migrations.
 *
 * IDs match the SQL filename prefix (without `.sql`). Keep this list
 * sorted by id so the dry-run report has stable ordering.
 */
export const PRESENTATION_MIGRATION_CATALOG: MigrationCatalogEntry[] = [
  {
    id: '760_presentation_legacy_normalization',
    filename: '760_presentation_legacy_normalization.sql',
    category: 'data_normalize',
    affects: ['presentation_decks', 'presentation_migration_reports'],
    riskTier: 'P0',
    reversible: true,
    rollbackStrategy: 'restore_snapshot',
    preflightChecks: [
      'SELECT COUNT(*) FROM presentation_decks WHERE deck_json IS NOT NULL;',
      'SELECT COUNT(*) FROM presentation_decks WHERE lineage_root_id IS NULL;',
    ],
    postCheck: [
      'SELECT COUNT(*) FROM presentation_decks WHERE lineage_root_id IS NULL; -- must equal 0 after backfill',
      "SELECT COUNT(*) FROM presentation_migration_reports WHERE run_mode = 'apply';",
    ],
    description:
      'Normalizes legacy deck JSON (deck_json/unified_json) into the canonical schema and seeds the presentation_migration_reports ledger. Data-touching migration; rollback requires a pre-migration snapshot.',
  },
  {
    id: '761_presentation_runtime_events',
    filename: '761_presentation_runtime_events.sql',
    category: 'schema_alter',
    affects: ['presentation_runtime_events'],
    riskTier: 'P2',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'presentation_runtime_events' LIMIT 1;",
    ],
    postCheck: [
      'SELECT 1 FROM presentation_runtime_events LIMIT 0;',
      "SELECT 1 FROM pg_indexes WHERE tablename = 'presentation_runtime_events' AND indexname LIKE '%organization%';",
    ],
    description:
      'Creates the presentation_runtime_events telemetry table plus indexes used by the runtime, governance and ops-health surfaces.',
  },
  {
    id: '762_presentation_governance_alerts',
    filename: '762_presentation_governance_alerts.sql',
    category: 'schema_alter',
    affects: [
      'presentation_governance_alert_subscriptions',
      'presentation_governance_alert_dispatches',
    ],
    riskTier: 'P1',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'presentation_governance_alert_subscriptions' LIMIT 1;",
    ],
    postCheck: [
      'SELECT 1 FROM presentation_governance_alert_subscriptions LIMIT 0;',
      'SELECT 1 FROM presentation_governance_alert_dispatches LIMIT 0;',
    ],
    description:
      'Adds outbound governance alert subscriptions and dispatch ledger. Customer-visible (webhook/Slack delivery), so any rollback must be coordinated with subscribers.',
  },
  {
    id: '763_presentation_governance_alert_signing',
    filename: '763_presentation_governance_alert_signing.sql',
    category: 'schema_alter',
    affects: [
      'presentation_governance_alert_subscriptions',
      'presentation_governance_alert_dispatches',
      'presentation_governance_alert_worker_state',
    ],
    riskTier: 'P1',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_governance_alert_subscriptions' AND column_name = 'signing_secret' LIMIT 1;",
    ],
    postCheck: [
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_governance_alert_subscriptions' AND column_name = 'signing_secret';",
      'SELECT 1 FROM presentation_governance_alert_worker_state LIMIT 0;',
    ],
    description:
      'Adds HMAC signing-secret + signature columns and the alert worker state table. Security-relevant: dropping signing_secret invalidates outbound signature verification for subscribers.',
  },
  {
    id: '764_presentation_watchlist_presets',
    filename: '764_presentation_watchlist_presets.sql',
    category: 'schema_alter',
    affects: ['presentation_watchlist_presets'],
    riskTier: 'P2',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'presentation_watchlist_presets' LIMIT 1;",
    ],
    postCheck: ['SELECT 1 FROM presentation_watchlist_presets LIMIT 0;'],
    description:
      'Adds server-side persistence of governance watchlist filter presets (one default per org, partial unique index).',
  },
  {
    id: '765_presentation_governance_subscriber_tokens',
    filename: '765_presentation_governance_subscriber_tokens.sql',
    category: 'schema_alter',
    affects: ['presentation_governance_subscriber_tokens'],
    riskTier: 'P1',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'presentation_governance_subscriber_tokens' LIMIT 1;",
    ],
    postCheck: [
      'SELECT 1 FROM presentation_governance_subscriber_tokens LIMIT 0;',
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_governance_subscriber_tokens' AND column_name = 'token_hash';",
    ],
    description:
      'Adds the subscriber-facing read-only dashboard token table (sha256 hash, 8-char prefix, expires_at). Security-relevant; raw tokens are returned ONCE and never re-derivable from the column.',
  },
  {
    id: '766_presentation_watchlist_saved_searches',
    filename: '766_presentation_watchlist_saved_searches.sql',
    category: 'schema_alter',
    affects: ['presentation_watchlist_saved_searches'],
    riskTier: 'P2',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'presentation_watchlist_saved_searches' LIMIT 1;",
    ],
    postCheck: ['SELECT 1 FROM presentation_watchlist_saved_searches LIMIT 0;'],
    description:
      'Adds named saved-search persistence for the governance watchlist (JSONB filters + per-org default).',
  },
  {
    id: '767_presentation_template_governance',
    filename: '767_presentation_template_governance.sql',
    category: 'schema_alter',
    affects: ['presentation_templates', 'presentation_template_audit'],
    riskTier: 'P0',
    reversible: true,
    rollbackStrategy: 'drop_columns',
    preflightChecks: [
      'SELECT COUNT(*) FROM presentation_templates;',
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_templates' AND column_name = 'lifecycle_state' LIMIT 1;",
    ],
    postCheck: [
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_templates' AND column_name = 'lifecycle_state';",
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'presentation_templates' AND column_name = 'lineage_root_id';",
    ],
    description:
      'Adds the template registry lifecycle gate (draft/approved/deprecated), approval audit trail and lineage chain to presentation_templates. Lifecycle-critical: dropping lifecycle_state effectively reopens the gate. Audit data preserved in presentation_template_audit.',
  },
];

const CATALOG_INDEX: Map<string, MigrationCatalogEntry> = new Map(
  PRESENTATION_MIGRATION_CATALOG.map((entry) => [entry.id, entry])
);

const DURATION_HEURISTICS: Record<MigrationCategory, number | 'unknown'> = {
  schema_alter: 5,
  index_create: 30,
  data_normalize: 300,
  data_backfill: 'unknown',
};

const SCHEMA_ALTER_FIXED_ROW_ESTIMATE = 0;

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function estimateRowsAffected(
  entry: MigrationCatalogEntry,
  input: DryRunInput
): number | 'unknown' {
  if (entry.category === 'data_normalize') {
    if (isFiniteNonNegativeNumber(input.estimatedDeckCount)) {
      return Math.floor(input.estimatedDeckCount);
    }
    return 'unknown';
  }
  if (entry.category === 'schema_alter') {
    return SCHEMA_ALTER_FIXED_ROW_ESTIMATE;
  }
  if (entry.category === 'index_create') {
    if (isFiniteNonNegativeNumber(input.estimatedDeckCount)) {
      return Math.floor(input.estimatedDeckCount);
    }
    return 'unknown';
  }
  return 'unknown';
}

function estimateDurationSeconds(
  entry: MigrationCatalogEntry,
  rowsAffected: number | 'unknown'
): number | 'unknown' {
  const baseline = DURATION_HEURISTICS[entry.category];
  if (entry.category === 'data_normalize') {
    if (typeof rowsAffected !== 'number') return 'unknown';
    const perTenK = typeof baseline === 'number' ? baseline : 300;
    const blocks = Math.max(1, Math.ceil(rowsAffected / 10000));
    return blocks * perTenK;
  }
  return baseline;
}

function buildEntryWarnings(entry: MigrationCatalogEntry): string[] {
  const warnings: string[] = [];
  if (entry.riskTier === 'P0') {
    warnings.push(`P0 migration — requires backend lead + ops sign-off before apply`);
  }
  if (!entry.reversible) {
    warnings.push(`Migration is NOT reversible — manual review required`);
  }
  if (entry.rollbackStrategy === 'restore_snapshot') {
    warnings.push(`Rollback requires full DB snapshot restore`);
  }
  if (entry.rollbackStrategy === 'manual_review') {
    warnings.push(`Rollback path is case-by-case (manual_review)`);
  }
  if (entry.rollbackStrategy === 'not_applicable') {
    warnings.push(`Rollback is NOT supported automatically (not_applicable)`);
  }
  return warnings;
}

function buildEntryBlockers(entry: MigrationCatalogEntry): string[] {
  const blockers: string[] = [];
  if (entry.reversible && entry.rollbackStrategy === 'not_applicable') {
    blockers.push(
      `Catalog inconsistency: ${entry.id} marked reversible but rollbackStrategy is not_applicable`
    );
  }
  return blockers;
}

function safeIsoNow(): string {
  try {
    return new Date().toISOString();
  } catch {
    return '1970-01-01T00:00:00.000Z';
  }
}

function dedupe(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Build a deterministic dry-run report for the requested migrations.
 * Pure function — never throws.
 */
export function buildDryRunReport(input: DryRunInput): DryRunReport {
  const safeInput: DryRunInput = {
    migrationIds: Array.isArray(input?.migrationIds) ? input.migrationIds : [],
    organizationIds: Array.isArray(input?.organizationIds)
      ? input.organizationIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : undefined,
    estimatedDeckCount: isFiniteNonNegativeNumber(input?.estimatedDeckCount)
      ? input!.estimatedDeckCount
      : undefined,
    estimatedTemplateCount: isFiniteNonNegativeNumber(input?.estimatedTemplateCount)
      ? input!.estimatedTemplateCount
      : undefined,
  };

  const impact: DryRunImpactRow[] = [];
  const reportLevelBlockers: string[] = [];

  for (const rawId of safeInput.migrationIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id) {
      reportLevelBlockers.push('Empty migration id supplied');
      continue;
    }
    const entry = CATALOG_INDEX.get(id);
    if (!entry) {
      const blocker = `Unknown migration: ${id}`;
      reportLevelBlockers.push(blocker);
      impact.push({
        migrationId: id,
        category: 'schema_alter',
        riskTier: 'P2',
        estimatedRowsAffected: 'unknown',
        estimatedDurationSeconds: 'unknown',
        rollbackPossible: false,
        warnings: [],
        blockers: [blocker],
      });
      continue;
    }

    const rowsAffected = estimateRowsAffected(entry, safeInput);
    const duration = estimateDurationSeconds(entry, rowsAffected);
    const warnings = buildEntryWarnings(entry);
    const blockers = buildEntryBlockers(entry);

    impact.push({
      migrationId: entry.id,
      category: entry.category,
      riskTier: entry.riskTier,
      estimatedRowsAffected: rowsAffected,
      estimatedDurationSeconds: duration,
      rollbackPossible: entry.reversible && entry.rollbackStrategy !== 'not_applicable',
      warnings,
      blockers,
    });

    for (const b of blockers) {
      reportLevelBlockers.push(b);
    }
  }

  const totals = {
    migrations: impact.length,
    p0: impact.filter((row) => row.riskTier === 'P0').length,
    p1: impact.filter((row) => row.riskTier === 'P1').length,
    p2: impact.filter((row) => row.riskTier === 'P2').length,
    reversibleCount: impact.filter((row) => row.rollbackPossible).length,
    nonReversibleCount: impact.filter((row) => !row.rollbackPossible).length,
  };

  const dedupedBlockers = dedupe(reportLevelBlockers);

  let recommendation: DryRunReport['recommendation'];
  if (dedupedBlockers.length > 0) {
    recommendation = 'BLOCK';
  } else if (totals.p0 > 0 && totals.nonReversibleCount > 0) {
    recommendation = 'PROCEED_WITH_REVIEW';
  } else {
    recommendation = 'PROCEED';
  }

  return {
    generatedAt: safeIsoNow(),
    scope: {
      organizationIds:
        safeInput.organizationIds && safeInput.organizationIds.length > 0
          ? safeInput.organizationIds
          : 'global',
      estimatedDeckCount:
        typeof safeInput.estimatedDeckCount === 'number' ? safeInput.estimatedDeckCount : null,
      estimatedTemplateCount:
        typeof safeInput.estimatedTemplateCount === 'number'
          ? safeInput.estimatedTemplateCount
          : null,
    },
    impact,
    totals,
    recommendation,
    blockers: dedupedBlockers,
  };
}

/**
 * Convenience accessor: returns the catalog entry for an id, or `null`
 * if unknown. Never throws.
 */
export function getCatalogEntry(id: string): MigrationCatalogEntry | null {
  if (typeof id !== 'string' || !id) return null;
  return CATALOG_INDEX.get(id) ?? null;
}

/**
 * List the canonical migration ids in stable catalog order.
 */
export function listCatalogIds(): string[] {
  return PRESENTATION_MIGRATION_CATALOG.map((entry) => entry.id);
}
