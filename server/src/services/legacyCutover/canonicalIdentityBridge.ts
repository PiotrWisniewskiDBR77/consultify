/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T11 — the canonical identity chain
 *
 *   legacy id  →  artifact id  →  business version id  →  working revision id
 *
 * WHY THIS EXISTS SEPARATELY FROM `finance/canonical/legacyIdBridgeService.ts`:
 * that module resolves the first three links for Finance only, and stops at the
 * business version. A cutover decision needs the fourth link too — a legacy row
 * whose artifact exists but which has no working revision cannot be edited on
 * the canonical surface, so disabling its legacy writer would take away the only
 * way to change it. It also needs to answer the same question for domains other
 * than Finance without pretending they have a registry they do not have.
 *
 * HONESTY CONTRACT (the reason this is not a boolean):
 *   resolved        — a canonical counterpart exists and is named here.
 *   quarantined     — the backfill deliberately excluded this row, with a reason.
 *   not_migrated    — a real legacy row with no canonical counterpart yet.
 *                     Disabling its writer would strand it. This is the state
 *                     that must produce a 409, never a 410.
 *   not_applicable  — the writer carries no legacy record identity at all
 *                     (e.g. a collection-level POST). Never conflate with
 *                     not_migrated.
 *
 * Domains without an alias registry resolve to `not_applicable` with an explicit
 * reason rather than a fabricated `resolved`.
 */

import * as DbPromise from '../../utils/DbPromise.js';

export type CanonicalIdentityStatus =
  | 'resolved'
  | 'quarantined'
  | 'not_migrated'
  | 'not_applicable';

export interface CanonicalIdentity {
  status: CanonicalIdentityStatus;
  artifactId: string | null;
  businessVersionId: string | null;
  workingRevisionId: string | null;
  mappingConfidence: string | null;
  reason: string | null;
}

const NOT_APPLICABLE: CanonicalIdentity = {
  status: 'not_applicable',
  artifactId: null,
  businessVersionId: null,
  workingRevisionId: null,
  mappingConfidence: null,
  reason: null,
};

function notApplicable(reason: string): CanonicalIdentity {
  return { ...NOT_APPLICABLE, reason };
}

/**
 * Per-domain wiring of the identity chain. A domain appears here ONLY when the
 * three tables genuinely exist in `server/migrations`; an entry is a claim that
 * the chain is readable, so adding one without the tables would be exactly the
 * kind of fantasy this lane exists to remove.
 */
interface DomainIdentityRegistry {
  aliasTable: string;
  artifactTable: string;
  artifactIdColumn: string;
  artifactCurrentVersionColumn: string;
  workingRevisionTable: string;
  workingRevisionIdColumn: string;
}

export const DOMAIN_IDENTITY_REGISTRIES: Record<string, DomainIdentityRegistry> = {
  finance: {
    aliasTable: 'finance_artifact_aliases',
    artifactTable: 'finance_artifacts',
    artifactIdColumn: 'artifact_id',
    artifactCurrentVersionColumn: 'current_business_version_id',
    workingRevisionTable: 'finance_working_revisions',
    workingRevisionIdColumn: 'working_revision_id',
  },
};

export function domainHasIdentityRegistry(domain: string): boolean {
  return Object.prototype.hasOwnProperty.call(DOMAIN_IDENTITY_REGISTRIES, domain);
}

interface AliasRow {
  artifact_id: string | null;
  business_version_id: string | null;
  mapping_confidence: string | null;
  mapping_reason: string | null;
}

interface ArtifactRow {
  artifact_id: string | null;
  current_business_version_id: string | null;
}

interface WorkingRevisionRow {
  working_revision_id: string | null;
  business_version_id: string | null;
}

/**
 * Resolves the full chain for one legacy record, tenant-scoped.
 *
 * Tenant scoping is not decoration: `finance_artifact_aliases` is unique on
 * (legacy_table, legacy_id, legacy_version) but NOT on organization, so an
 * un-scoped read would happily hand one tenant another tenant's artifact id.
 * Every statement below therefore filters on organization_id.
 *
 * Throws only on genuine transport/DB failure — "no alias" is the ordinary
 * `not_migrated` outcome, not an error.
 */
export async function resolveCanonicalIdentity(params: {
  domain: string;
  organizationId: string | null;
  legacyTable: string | null;
  legacyId: string | null;
}): Promise<CanonicalIdentity> {
  const { domain, organizationId, legacyTable, legacyId } = params;

  if (!legacyTable || !legacyId) {
    return notApplicable('writer rule carries no legacy record identity');
  }
  if (!organizationId) {
    // Without a tenant we cannot scope the lookup, and an un-scoped lookup is
    // precisely the cross-tenant leak this bridge is meant to prevent.
    return notApplicable('tenant unresolved; identity lookup deliberately skipped');
  }
  const registry = DOMAIN_IDENTITY_REGISTRIES[domain];
  if (!registry) {
    return notApplicable(`domain '${domain}' has no canonical alias registry`);
  }

  const alias = await DbPromise.get<AliasRow>(
    `SELECT artifact_id, business_version_id, mapping_confidence, mapping_reason
       FROM ${registry.aliasTable}
      WHERE organization_id = ? AND legacy_table = ? AND legacy_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
    [organizationId, legacyTable, legacyId],
    { fallback: false }
  );

  if (!alias || !alias.artifact_id) {
    return {
      status: 'not_migrated',
      artifactId: null,
      businessVersionId: null,
      workingRevisionId: null,
      mappingConfidence: null,
      reason: 'no alias row for this tenant and legacy id',
    };
  }

  if (
    alias.mapping_confidence === 'QUARANTINE' ||
    alias.mapping_confidence === 'EXCLUDE_WITH_REASON'
  ) {
    return {
      status: 'quarantined',
      artifactId: null,
      businessVersionId: null,
      workingRevisionId: null,
      mappingConfidence: alias.mapping_confidence,
      reason: alias.mapping_reason || 'excluded by backfill without a recorded reason',
    };
  }

  // A dangling alias (artifact archived out of band) must degrade to an honest
  // not_migrated rather than hand the caller a version id with no artifact.
  const artifact = await DbPromise.get<ArtifactRow>(
    `SELECT ${registry.artifactIdColumn} AS artifact_id,
            ${registry.artifactCurrentVersionColumn} AS current_business_version_id
       FROM ${registry.artifactTable}
      WHERE ${registry.artifactIdColumn} = ? AND organization_id = ?`,
    [alias.artifact_id, organizationId],
    { fallback: false }
  );
  if (!artifact || !artifact.artifact_id) {
    return {
      status: 'not_migrated',
      artifactId: null,
      businessVersionId: null,
      workingRevisionId: null,
      mappingConfidence: alias.mapping_confidence,
      reason: 'alias points at an artifact that is not readable for this tenant',
    };
  }

  const businessVersionId = alias.business_version_id || artifact.current_business_version_id || null;

  // Fourth link. Absence is NOT an error: an artifact with no open working
  // revision is still fully cut over for read and approve flows. It is recorded
  // so the report can distinguish "editable canonically" from "resolved only".
  const workingRevision = await DbPromise.get<WorkingRevisionRow>(
    `SELECT ${registry.workingRevisionIdColumn} AS working_revision_id, business_version_id
       FROM ${registry.workingRevisionTable}
      WHERE artifact_id = ? AND organization_id = ? AND is_current = TRUE
      ORDER BY revision_seq DESC
      LIMIT 1`,
    [artifact.artifact_id, organizationId],
    { fallback: false }
  );

  return {
    status: 'resolved',
    artifactId: artifact.artifact_id,
    businessVersionId,
    workingRevisionId: workingRevision?.working_revision_id || null,
    mappingConfidence: alias.mapping_confidence,
    reason: null,
  };
}
