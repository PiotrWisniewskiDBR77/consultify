/**
 * Finance v3 — legacy → canonical ID BRIDGE (Gate E, ID_BRIDGE work package).
 *
 * ★ CONTEXT: `FinanceHub.tsx` (the list screen) still lists rows from the OLD
 * `/api/v8/finance/*` surface (`financial_models`, `financial_analyses`,
 * `financial_statement_packs`, `valuations` — legacy TEXT ids). The four v3
 * detail workspaces (Baseline/Prediction/Analysis/Valuation,
 * `src/components/Finance/{BaselineWorkspace,Prediction,Analysis,Valuation}`)
 * are built against the NEW canonical schema
 * (`finance_artifacts.artifact_id` / `finance_business_versions.business_version_id`
 * — a DIFFERENT id space). `AP_MOUNT §B` (see `FinanceHub.tsx` mount branches,
 * `resolveFinanceDetailBranches`) documented this gap and left it open:
 * "There is no ID bridge between the two systems today."
 *
 * This module IS that bridge's read path. It does NOT invent a new mapping —
 * `finance_artifact_aliases` (WP-B01 §2.6, `20260809_finance_v3_b01_core_artifacts.sql`)
 * already exists for exactly this purpose ("legacy -> canonical bridge") and
 * is already WRITTEN by the validated WP-C03 backfill algorithm
 * (`server/scripts/finance-v3-backfill-dry-run.ts`, `getOrCreateArtifact()` +
 * the `INSERT INTO finance_artifact_aliases` calls) — but until this module,
 * nothing in the running server ever READ it (confirmed by grep: the only
 * other production-code reference is a comment in `models.routes.ts` noting
 * "WP-C03, not yet populated"). This is the "powiązanie ISTNIEJE, ale nikt go
 * nie czyta" case, not a new migration.
 *
 * Whether any given (organization, legacy_table, legacy_id) row actually HAS
 * an alias depends on whether the WP-C03 backfill has been run for that
 * organization — a separate, larger program decision (running a historical
 * migration against demo/prod) that is explicitly OUT OF SCOPE for this
 * module. This module's contract is: read whatever is there, and return an
 * HONEST, machine-distinguishable outcome for the two "there is nothing to
 * show yet" cases (never migrated vs. deliberately excluded) so the caller
 * can render an honest message instead of silently rendering an empty shell
 * with a wrong/legacy id.
 */

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { ArtifactRow } from './artifactVersionService.js';

/** The five legacy tables `FinanceHub.tsx`'s list rows are keyed from (grep-confirmed against `finance.routes.ts`), matching the `legacy_table` values the WP-C03 backfill script writes (grep-confirmed against `finance-v3-backfill-dry-run.ts`). */
export const LEGACY_FINANCE_TABLES = [
  'financial_statement_packs',
  'financial_analyses',
  'financial_models',
  'valuations',
] as const;
export type LegacyFinanceTable = (typeof LEGACY_FINANCE_TABLES)[number];

export function isLegacyFinanceTable(value: unknown): value is LegacyFinanceTable {
  return typeof value === 'string' && (LEGACY_FINANCE_TABLES as readonly string[]).includes(value);
}

interface AliasRow {
  alias_id: string;
  legacy_table: string;
  legacy_id: string;
  legacy_version: string | null;
  artifact_id: string;
  organization_id: string;
  business_version_id: string | null;
  mapping_confidence:
    | 'AUTO_MIGRATE'
    | 'MIGRATE_WITH_WARNING'
    | 'QUARANTINE'
    | 'EXCLUDE_WITH_REASON';
  mapping_reason: string | null;
  created_at: string;
}

/**
 * Three, and only three, machine-distinguishable outcomes (CLAUDE.md §2.3 —
 * "zlanie MISSING z PRESENT_ZERO to ten sam błąd co..."). A caller must never
 * collapse `NOT_MIGRATED` and `QUARANTINED` into the same UI copy as
 * `RESOLVED` — but MAY choose to show the same generic "not available yet"
 * shell for both `NOT_MIGRATED`/`QUARANTINED` while still surfacing
 * `mappingReason` for `QUARANTINED` where the backfill recorded one.
 */
export type LegacyBridgeResolution =
  | {
      status: 'RESOLVED';
      artifactId: string;
      businessVersionId: string | null;
      artifactType: ArtifactRow['artifact_type'];
      mappingConfidence: 'AUTO_MIGRATE' | 'MIGRATE_WITH_WARNING';
    }
  | {
      status: 'QUARANTINED';
      mappingConfidence: 'QUARANTINE' | 'EXCLUDE_WITH_REASON';
      reason: string | null;
    }
  | { status: 'NOT_MIGRATED' };

/**
 * Reads `finance_artifact_aliases` for one legacy row, org-scoped. Never
 * throws for "no alias" (that is the ordinary `NOT_MIGRATED` outcome, not an
 * error) — only a genuine transport/DB failure propagates, left to the
 * caller (route handler) to turn into a 5xx, which the FRONTEND then
 * distinguishes from `NOT_MIGRATED` as its own third state (network/server
 * error vs. "this record has no canonical counterpart yet").
 *
 * Most-recent-alias-wins on the (should never happen, but is not DB-enforced
 * beyond the `(legacy_table, legacy_id, legacy_version)` unique constraint)
 * chance of more than one alias row for the same legacy id under different
 * `legacy_version` values — `ORDER BY created_at DESC LIMIT 1`.
 */
export async function resolveLegacyFinanceArtifact(
  organizationId: string,
  legacyTable: LegacyFinanceTable,
  legacyId: string
): Promise<LegacyBridgeResolution> {
  const alias = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<AliasRow>(
      `SELECT * FROM finance_artifact_aliases
       WHERE legacy_table = ? AND legacy_id = ? AND organization_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [legacyTable, legacyId, organizationId]
    )
  );

  if (!alias) {
    return { status: 'NOT_MIGRATED' };
  }

  if (
    alias.mapping_confidence === 'QUARANTINE' ||
    alias.mapping_confidence === 'EXCLUDE_WITH_REASON'
  ) {
    return {
      status: 'QUARANTINED',
      mappingConfidence: alias.mapping_confidence,
      reason: alias.mapping_reason,
    };
  }

  // AUTO_MIGRATE / MIGRATE_WITH_WARNING — resolve the artifact row so the
  // caller gets `artifactType` too (the v3 workspace props need it to pick
  // the right shell) and so a dangling alias (artifact row deleted/archived
  // out-of-band — should never happen, no delete path exists today, but this
  // module does not assume it) degrades to an honest NOT_MIGRATED instead of
  // handing the caller a business_version_id with no artifact behind it.
  const artifact = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ArtifactRow>(
      `SELECT * FROM finance_artifacts WHERE artifact_id = ? AND organization_id = ?`,
      [alias.artifact_id, organizationId]
    )
  );
  if (!artifact) {
    return { status: 'NOT_MIGRATED' };
  }

  return {
    status: 'RESOLVED',
    artifactId: artifact.artifact_id,
    businessVersionId: alias.business_version_id || artifact.current_business_version_id || null,
    artifactType: artifact.artifact_type,
    mappingConfidence: alias.mapping_confidence,
  };
}
