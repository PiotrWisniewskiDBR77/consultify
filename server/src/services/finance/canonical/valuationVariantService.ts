/**
 * Finance v3 canonical — Enterprise Valuation Case/Variant registry (Gate D / Fala 7, WP-D10 gap
 * closed by Pakiet B3, DEC-FIN-005 point 1: "Jedna Valuation Case może mieć wiele nazwanych
 * wariantów. Każdy ma: nazwę, opis, autora, timestamp, source artifact/version, ...").
 *
 * `finance_valuation_cases` / `finance_valuation_variants` (WP-D09b migration 01, tables 1-2) had
 * ZERO writers anywhere in the repo before this file — verified by grep, see
 * `docs/validation/finance-v3/generated/gate-e/PKG_B3_VALUATION_API_report.md` §2.1. Every other
 * valuation service (`valuationComputeService.ts`, `valuationAdvisorService.ts`, ...) assumes a
 * `finance_valuation_variants` row already exists and only reads/joins it.
 *
 * A Variant here does NOT create the underlying `finance_business_versions` row — that already
 * happens through the general artifact/version pipeline this package does not own
 * (`POST /finance-v2/artifacts` with `artifactType: 'VALUATION_CASE'`, Pakiet B). This service only
 * REGISTERS an already-existing `VALUATION_CASE` business version under a named Case — the exact
 * "no source column, source lives in lineage, register don't create" precedent WP-D05's
 * `finance_baseline_models` / WP-D07's `finance_prediction_scenarios` already established (see the
 * `finance_valuation_variants` table header comment in the migration file).
 *
 * Router-only caller: `server/src/routes/v8/finance-v2/valuation.routes.ts`. Every function below is
 * a direct, org-scoped SELECT/INSERT/UPDATE — zero domain logic, matching the DEC-FIN-012 "thin
 * reader/writer" allowlist pattern Pakiet B2 already used for
 * `baselineComputeService.listBaselineAssumptions`/`upsertAssumptionsBatch`.
 */

import { randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';

// ---------------------------------------------------------------------------
// finance_valuation_cases
// ---------------------------------------------------------------------------

export interface ValuationCaseRow {
  case_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
  archived_reason: string | null;
}

export async function createCase(params: {
  organizationId: string;
  name: string;
  description?: string | null;
  createdBy: string;
}): Promise<ValuationCaseRow> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ValuationCaseRow>(
      `INSERT INTO finance_valuation_cases (case_id, organization_id, name, description, created_by)
       VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [uuidv4(), params.organizationId, params.name, params.description ?? null, params.createdBy]
    )
  );
  if (!row) throw new Error('createCase: insert returned no row');
  return row;
}

export async function listCases(organizationId: string): Promise<ValuationCaseRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<ValuationCaseRow>(`SELECT * FROM finance_valuation_cases WHERE organization_id = ? ORDER BY created_at DESC`, [organizationId])
  );
}

export async function getCase(organizationId: string, caseId: string): Promise<ValuationCaseRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ValuationCaseRow>(`SELECT * FROM finance_valuation_cases WHERE case_id = ? AND organization_id = ?`, [caseId, organizationId])
  );
}

// ---------------------------------------------------------------------------
// finance_valuation_variants
// ---------------------------------------------------------------------------

export interface ValuationVariantWithStatusRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  case_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  status: string;
  freshness: string;
  version_no: number;
}

export type CreateVariantErrorCode = 'CASE_NOT_FOUND' | 'BUSINESS_VERSION_NOT_FOUND' | 'NOT_A_VALUATION_CASE' | 'ALREADY_A_VARIANT';

export type CreateVariantResult = { ok: true; variant: ValuationVariantWithStatusRow } | { ok: false; code: CreateVariantErrorCode; message: string };

/**
 * `businessVersionId` MUST already exist (created via `POST /artifacts` with
 * `artifactType: 'VALUATION_CASE'`) — this function never creates one. Validates, in order: the
 * Case belongs to `organizationId`, the business version belongs to `organizationId` AND is a
 * `VALUATION_CASE` artifact, and it is not already registered as a variant of ANY case
 * (`uq_finance_valuation_variants_bv` would also reject a duplicate at the DB layer — this is the
 * typed, friendly rejection in front of it, same "app-level mirror, DB is still authoritative"
 * discipline `valuationTerminalService.assertGBelowWacc()` documents).
 */
export async function createVariant(params: {
  organizationId: string;
  caseId: string;
  businessVersionId: string;
  name: string;
  description?: string | null;
  createdBy: string;
}): Promise<CreateVariantResult> {
  return withPinnedPostgresTransaction(async (tx) => {
    const kase = await tx.queryOne<{ case_id: string }>(
      `SELECT case_id FROM finance_valuation_cases WHERE case_id = ? AND organization_id = ?`,
      [params.caseId, params.organizationId]
    );
    if (!kase) {
      return { ok: false, code: 'CASE_NOT_FOUND', message: `Case ${params.caseId} not found for organization ${params.organizationId}` } as const;
    }

    const bv = await tx.queryOne<{ business_version_id: string; artifact_type: string }>(
      `SELECT bv.business_version_id, a.artifact_type
         FROM finance_business_versions bv JOIN finance_artifacts a ON a.artifact_id = bv.artifact_id
        WHERE bv.business_version_id = ? AND bv.organization_id = ?`,
      [params.businessVersionId, params.organizationId]
    );
    if (!bv) {
      return {
        ok: false,
        code: 'BUSINESS_VERSION_NOT_FOUND',
        message: `business_version ${params.businessVersionId} not found for organization ${params.organizationId}`,
      } as const;
    }
    if (bv.artifact_type !== 'VALUATION_CASE') {
      return {
        ok: false,
        code: 'NOT_A_VALUATION_CASE',
        message: `business_version ${params.businessVersionId} has artifact_type=${bv.artifact_type}, not VALUATION_CASE`,
      } as const;
    }

    const existing = await tx.queryOne<{ id: string }>(`SELECT id FROM finance_valuation_variants WHERE business_version_id = ?`, [params.businessVersionId]);
    if (existing) {
      return { ok: false, code: 'ALREADY_A_VARIANT', message: `business_version ${params.businessVersionId} is already registered as a variant` } as const;
    }

    const inserted = await tx.queryOne<{
      id: string;
      organization_id: string;
      business_version_id: string;
      case_id: string;
      name: string;
      description: string | null;
      created_by: string;
      created_at: string;
    }>(
      `INSERT INTO finance_valuation_variants (id, organization_id, business_version_id, case_id, name, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      [uuidv4(), params.organizationId, params.businessVersionId, params.caseId, params.name, params.description ?? null, params.createdBy]
    );
    if (!inserted) throw new Error('createVariant: insert returned no row');

    const bvFull = await tx.queryOne<{ status: string; freshness: string; version_no: number }>(
      `SELECT status, freshness, version_no FROM finance_business_versions WHERE business_version_id = ?`,
      [params.businessVersionId]
    );
    if (!bvFull) throw new Error('createVariant: business_version vanished mid-transaction');

    return { ok: true, variant: { ...inserted, status: bvFull.status, freshness: bvFull.freshness, version_no: bvFull.version_no } } as const;
  });
}

export async function listVariants(organizationId: string, caseId: string): Promise<ValuationVariantWithStatusRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<ValuationVariantWithStatusRow>(
      `SELECT v.*, bv.status, bv.freshness, bv.version_no
         FROM finance_valuation_variants v
         JOIN finance_business_versions bv ON bv.business_version_id = v.business_version_id
        WHERE v.case_id = ? AND v.organization_id = ?
        ORDER BY v.created_at`,
      [caseId, organizationId]
    )
  );
}

export async function getVariant(organizationId: string, businessVersionId: string): Promise<ValuationVariantWithStatusRow | null> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ValuationVariantWithStatusRow>(
      `SELECT v.*, bv.status, bv.freshness, bv.version_no
         FROM finance_valuation_variants v
         JOIN finance_business_versions bv ON bv.business_version_id = v.business_version_id
        WHERE v.business_version_id = ? AND v.organization_id = ?`,
      [businessVersionId, organizationId]
    )
  );
}

export type RenameVariantResult = { ok: true; variant: ValuationVariantWithStatusRow } | { ok: false; code: 'NOT_FOUND'; message: string };

/**
 * `name`/`description` are each independently optional — `undefined` leaves the column untouched,
 * `null` (description only) explicitly clears it. Built as dynamic SET clauses rather than
 * `COALESCE(?, column)` specifically so an explicit "clear the description" is representable (a
 * `COALESCE` cannot distinguish "not supplied" from "supplied as null"). If the parent business
 * version is `APPROVED`, `trg_finance_valuation_variants_parent_immutability` rejects the UPDATE at
 * the DB layer — this function does not pre-check that (no cheap way to distinguish it from
 * "variant not found" without a second round trip the caller can get more cheaply via `getVariant`
 * first), so callers should expect a thrown error, not a typed `NOT_FOUND`, for that case.
 */
export async function renameVariant(params: {
  organizationId: string;
  businessVersionId: string;
  name?: string;
  description?: string | null;
}): Promise<RenameVariantResult> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (params.name !== undefined) {
    sets.push('name = ?');
    vals.push(params.name);
  }
  if (params.description !== undefined) {
    sets.push('description = ?');
    vals.push(params.description);
  }

  if (sets.length === 0) {
    const variant = await getVariant(params.organizationId, params.businessVersionId);
    return variant ? { ok: true, variant } : { ok: false, code: 'NOT_FOUND', message: `Variant ${params.businessVersionId} not found for organization ${params.organizationId}` };
  }

  vals.push(params.businessVersionId, params.organizationId);
  const updated = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ id: string }>(
      `UPDATE finance_valuation_variants SET ${sets.join(', ')} WHERE business_version_id = ? AND organization_id = ? RETURNING id`,
      vals
    )
  );
  if (!updated) {
    return { ok: false, code: 'NOT_FOUND', message: `Variant ${params.businessVersionId} not found for organization ${params.organizationId}` };
  }
  const variant = await getVariant(params.organizationId, params.businessVersionId);
  if (!variant) throw new Error('renameVariant: variant vanished after update');
  return { ok: true, variant };
}
