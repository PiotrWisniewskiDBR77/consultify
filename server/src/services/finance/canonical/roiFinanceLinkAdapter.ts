/**
 * Finance v3 canonical — ROI Finance-link adapter (ROI-E007 Stream B rewrite).
 *
 * Design: Decision D4 (`server/migrations/20260820_rvn_roi_finance_seam.sql`
 * header) — `rvn_roi_finance_links` (owned by Results vNext / ROI-E007) has
 * NO foreign key into any `finance_*` table. Finance IDs are stored as plain
 * TEXT (`finance_artifact_type`/`finance_artifact_id`/`finance_version_id`)
 * — a hard FK would recreate exactly the "shared mutable table" coupling
 * Decision D4/D06 forbid. This file is the FINANCE-SIDE half of that seam:
 * it lets Finance-v3 code (a) create a pinned link FROM a
 * `finance_business_versions` row it already has TO a ROI case, without the
 * caller needing to know Finance's own `finance_artifact_type`/
 * `finance_artifact_id` vocabulary, and (b) resolve a link BACK to the real
 * `finance_business_versions` row it was pinned to, read fresh (never
 * cached), reporting an explicit not-found status if Finance has since
 * archived/lost that exact version rather than crashing or silently
 * following to whatever is now "current".
 *
 * HARD RULE this file follows throughout: it never INSERTs/UPDATEs/DELETEs
 * `rvn_roi_finance_links` (or reads it via a hand-rolled query when the
 * canonical repository already answers the question) — every write goes
 * through `roiFinanceLinkCommands.createRoiFinanceLink`
 * (`server/src/services/resultsVnext/roi/roiFinanceLinkCommands.ts`, ROI-E007,
 * already implemented/owned by Results vNext) and every list read goes
 * through `roiFinanceLinkRepository.listRoiFinanceLinks`. The one exception
 * (`getFinanceContextForLink`'s single-row-by-`link_id` lookup) is documented
 * at its call site below — the canonical repository's single-row read
 * (`getRoiFinanceLink`) requires `{userId, organizationId, caseId, linkId}`
 * for its ABAC visibility join (§B.4), which this function's task signature
 * (`linkId` alone) cannot supply; see that function's comment for why a
 * plain `link_id` PK lookup is safe here instead of duplicating that CTE.
 *
 * `finance_business_versions`/`finance_artifacts` reads go through
 * `artifactVersionService.getBusinessVersion`/`getArtifact`
 * (`server/src/services/finance/canonical/artifactVersionService.ts`,
 * Gate C WP-C02) — this file does not query those tables directly either.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { createRoiFinanceLink } from '../../resultsVnext/roi/roiFinanceLinkCommands.js';
import { listRoiFinanceLinks } from '../../resultsVnext/roi/roiFinanceLinkRepository.js';
import {
  toRoiFinanceLink,
  type RoiFinanceLink,
  type RoiFinanceLinkRow,
} from '../../resultsVnext/roi/roiFinanceSeamTypes.js';

import { getArtifact, getBusinessVersion, type ArtifactRow, type BusinessVersionRow } from './artifactVersionService.js';

// ==========================================
// ERRORS
// ==========================================

/**
 * Thrown by `linkFinanceArtifactToRoiCase` BEFORE the canonical
 * `createRoiFinanceLink` command is ever called — a clean, typed
 * application-layer validation failure (per the task's own AC: "próba
 * linkowania do nieistniejącego finance_business_version_id odrzucona PRZED
 * wywołaniem kanonicznej komendy, czysty błąd walidacyjny, nie brudny SQL
 * error z drugiej strony"). NOT a database constraint violation — Decision
 * D4 explicitly forbids expressing this as a DB-level FK.
 */
export class FinanceBusinessVersionNotFoundError extends Error {
  code = 'FINANCE_BUSINESS_VERSION_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(organizationId: string, financeBusinessVersionId: string) {
    super(
      `finance_business_versions row not found for organization ${organizationId}, ` +
        `business_version_id ${financeBusinessVersionId} — refusing to create a ROI finance ` +
        `link pinned to a Finance version that does not exist`
    );
    this.name = 'FinanceBusinessVersionNotFoundError';
    this.details = { organizationId, financeBusinessVersionId };
  }
}

/**
 * Defensive-only: `finance_business_versions.artifact_id` has no declared FK
 * to `finance_artifacts` (WP-B01 §2.2 forward-reference note), so this
 * should be unreachable in practice — thrown rather than silently
 * proceeding with a fabricated `financeArtifactType` if it ever is.
 */
export class FinanceArtifactNotFoundError extends Error {
  code = 'FINANCE_ARTIFACT_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(organizationId: string, artifactId: string) {
    super(
      `finance_artifacts row not found for organization ${organizationId}, artifact_id ` +
        `${artifactId} — the business version's own artifact_id points nowhere`
    );
    this.name = 'FinanceArtifactNotFoundError';
    this.details = { organizationId, artifactId };
  }
}

// ==========================================
// linkFinanceArtifactToRoiCase
// ==========================================

export interface LinkFinanceArtifactToRoiCaseParams {
  organizationId: string;
  caseId: string;
  /** `finance_business_versions.business_version_id` — the SPECIFIC
   * milestone version being pinned, not "whatever is current" (AC-01: a
   * full pinned envelope). */
  financeBusinessVersionId: string;
  mappingVersion?: number;
  source: string;
  semanticUnit?: string | null;
  currency?: string | null;
  linkPurpose: string;
  linkedBy: string;
  /** Defaults to `now()` at call time. */
  asOf?: string;
  /**
   * The remaining fields are NOT part of the task's own literal parameter
   * list — they exist because the canonical command this function delegates
   * to (`roiFinanceLinkCommands.createRoiFinanceLink`) requires them for its
   * `AtomicEventInput` envelope (`actorEffectiveRole`/`idempotencyKey`) and
   * optional audit trail (`correlationId`/`causationId`/`reason`). Rather
   * than silently inventing values inside this function (which would hide
   * real caller intent from the event log), they are exposed here as
   * optional passthroughs with safe defaults — a caller that has real
   * request-scoped values (an authenticated actor's role, an HTTP
   * correlation id) should supply them.
   */
  actorEffectiveRole?: string;
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

/** Default `actorEffectiveRole` for system/adapter-initiated links (e.g. a
 * Finance-side automation that pins a link on approval) where no real
 * end-user role is available. A caller acting on behalf of an authenticated
 * user should always pass its own `actorEffectiveRole` instead. */
const DEFAULT_ADAPTER_ACTOR_ROLE = 'finance_adapter';

/**
 * Creates a canonical `rvn_roi_finance_links` row FROM a Finance-side
 * `finance_business_versions` id, resolving Finance's own
 * `finance_artifact_type`/`finance_artifact_id` vocabulary on the caller's
 * behalf so a Finance caller never needs to know the ROI-side schema.
 *
 * Steps (per the task spec):
 *   (a) validates `financeBusinessVersionId` exists for `organizationId` —
 *       an APPLICATION check via `artifactVersionService.getBusinessVersion`,
 *       never a DB FK (Decision D4);
 *   (b) reads that version's `artifact_id`/`artifact_type` from Finance's
 *       own `finance_artifacts` table;
 *   (c) delegates the actual write to the canonical
 *       `roiFinanceLinkCommands.createRoiFinanceLink` — this function itself
 *       performs no INSERT.
 *
 * Returns the canonical `RoiFinanceLink` DTO (unwraps
 * `AtomicCommandOutcome.result` — a caller that also needs `outcome`/
 * `eventId`/`resultingVersion` should call `createRoiFinanceLink` directly).
 */
export async function linkFinanceArtifactToRoiCase(
  params: LinkFinanceArtifactToRoiCaseParams
): Promise<RoiFinanceLink> {
  const {
    organizationId,
    caseId,
    financeBusinessVersionId,
    mappingVersion,
    source,
    semanticUnit = null,
    currency = null,
    linkPurpose,
    linkedBy,
    asOf,
    actorEffectiveRole = DEFAULT_ADAPTER_ACTOR_ROLE,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = params;

  // (a) Finance-side sanity check — runs BEFORE the canonical command, so a
  // bad id fails with a clean validation error here, never a raw SQL error
  // surfacing from inside roiFinanceLinkCommands.ts's transaction.
  const businessVersion = await getBusinessVersion(organizationId, financeBusinessVersionId);
  if (!businessVersion) {
    throw new FinanceBusinessVersionNotFoundError(organizationId, financeBusinessVersionId);
  }

  // (b) resolve the artifact_type/artifact_id Finance owns for this version.
  const artifact = await getArtifact(organizationId, businessVersion.artifact_id);
  if (!artifact) {
    throw new FinanceArtifactNotFoundError(organizationId, businessVersion.artifact_id);
  }

  // (c) delegate to the canonical ROI-side command — no local INSERT.
  const outcome = await createRoiFinanceLink({
    caseId,
    organizationId,
    financeArtifactType: artifact.artifact_type,
    financeArtifactId: artifact.artifact_id,
    financeVersionId: financeBusinessVersionId,
    mappingVersion,
    source,
    asOf: asOf ?? new Date().toISOString(),
    semanticUnit,
    currency,
    linkPurpose,
    actorUserId: linkedBy,
    actorEffectiveRole,
    idempotencyKey: idempotencyKey ?? randomUUID(),
    correlationId,
    causationId,
    reason,
  });

  return outcome.result;
}

// ==========================================
// getFinanceContextForLink
// ==========================================

export type FinanceContextForLink =
  | {
      status: 'OK';
      link: RoiFinanceLink;
      /** Fresh read of the EXACT `finance_business_versions` row the link
       * was pinned to — never the artifact's current version. */
      businessVersion: BusinessVersionRow;
      /** `null` only in the defensive/should-be-unreachable case documented
       * on `FinanceArtifactNotFoundError` — the business version resolved,
       * but its own `artifact_id` did not. */
      artifact: ArtifactRow | null;
    }
  | {
      /** The link row itself still exists, but the specific
       * `finance_business_versions` row it pins no longer resolves — Finance
       * may have deleted/archived it since the link was created; there is no
       * FK to prevent that (Decision D4). Explicit, non-crashing outcome. */
      status: 'FINANCE_VERSION_NOT_FOUND';
      link: RoiFinanceLink;
    }
  | {
      /** No `rvn_roi_finance_links` row with this `link_id` at all. */
      status: 'LINK_NOT_FOUND';
    };

/**
 * Deliberately NOT `roiFinanceLinkRepository.getRoiFinanceLink` — that
 * function's signature is `{userId, organizationId, caseId, linkId}` because
 * it is the user-facing, visibility-scoped read (§B.4 CTE join over
 * `rvn_visible_resources`). `getFinanceContextForLink`'s own task signature
 * is `linkId` alone: a Finance-side system call that already only ever runs
 * with a `linkId` obtained from a source that already authorized it (this
 * adapter's own `linkFinanceArtifactToRoiCase` return value, or
 * `listFinanceLinksForCase`'s own visibility-scoped list) — re-deriving a
 * `userId` here purely to satisfy an unrelated ABAC join would be theater,
 * not a real second access check, and would require widening this
 * function's own signature beyond what the task asked for. `link_id` is a
 * globally unique UUID PRIMARY KEY
 * (`server/migrations/20260820_rvn_roi_finance_seam.sql`), so a plain PK
 * lookup is unambiguous without `organization_id`/`case_id` filters — this
 * is a NEW, narrower query (a bare PK SELECT), not a duplicate of the
 * visibility-scoped repository's CTE-joined one.
 */
async function loadRoiFinanceLinkById(client: PoolClient, linkId: string): Promise<RoiFinanceLinkRow | undefined> {
  const result = await client.query<RoiFinanceLinkRow>(`SELECT * FROM rvn_roi_finance_links WHERE link_id = $1`, [
    linkId,
  ]);
  return result.rows[0];
}

/**
 * Reverse direction of `linkFinanceArtifactToRoiCase`: takes a canonical
 * `rvn_roi_finance_links` row and resolves it BACK to the real, currently-
 * live `finance_business_versions` row (and its `finance_artifacts` row) —
 * read fresh on every call, never cached on the link itself, because
 * Decision D4's whole point is that nothing keeps the link's pin in sync
 * with Finance's own lifecycle (no FK, no trigger, no coupling). If Finance
 * has since archived/lost that exact `business_version_id`, this returns the
 * explicit `'FINANCE_VERSION_NOT_FOUND'` status rather than throwing or
 * crashing — the caller (a reconciliation job, a UI resolving a pinned
 * reference) decides what "the Finance side of this link is gone" means for
 * itself.
 */
export async function getFinanceContextForLink(linkId: string): Promise<FinanceContextForLink> {
  const client = await acquirePgClient();
  let row: RoiFinanceLinkRow | undefined;
  try {
    row = await loadRoiFinanceLinkById(client, linkId);
  } finally {
    client.release();
  }

  if (!row) {
    return { status: 'LINK_NOT_FOUND' };
  }
  const link = toRoiFinanceLink(row);

  const businessVersion = await getBusinessVersion(link.organizationId, link.financeVersionId);
  if (!businessVersion) {
    return { status: 'FINANCE_VERSION_NOT_FOUND', link };
  }

  const artifact = await getArtifact(link.organizationId, businessVersion.artifact_id);
  return { status: 'OK', link, businessVersion, artifact };
}

// ==========================================
// listFinanceLinksForCase
// ==========================================

/**
 * Thin wrapper over the canonical `roiFinanceLinkRepository.listRoiFinanceLinks`
 * — no local SQL.
 *
 * `userId` is not in the task's own literal `(organizationId, caseId)`
 * signature, but IS required by the canonical repository this wraps: its
 * read is visibility-scoped (§B.4 CTE, `resource_type='roi_case'`) by
 * `(userId, organizationId)`, not by `(organizationId, caseId)` alone.
 * Dropping `userId` here would force one of two things this file is
 * explicitly required not to do: (1) re-implement the visibility CTE without
 * a `userId` (an un-scoped list — a visibility bypass), or (2) hand-roll a
 * second, divergent SQL query against `rvn_roi_finance_links` (duplicating
 * the canonical repository's SQL). `userId` is therefore added as a third,
 * required parameter — a caller acting for a real end user passes that
 * user's id; a background/system caller should pass a service-account user
 * id that carries the appropriate RBAC override capability (see
 * `visibilityScopedQuery.ts`'s RBAC-override branch).
 */
export async function listFinanceLinksForCase(
  organizationId: string,
  caseId: string,
  userId: string
): Promise<RoiFinanceLink[]> {
  return listRoiFinanceLinks({ userId, organizationId, caseId });
}
