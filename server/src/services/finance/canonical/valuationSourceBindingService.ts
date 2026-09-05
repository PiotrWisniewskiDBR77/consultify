/**
 * Finance v3 canonical — "wskaż źródło wyceny": the WRITE half of the Valuation source lineage
 * edge (Baseline/Scenario -> Valuation).
 *
 * ★ Why this file exists (decyzja właściciela 2026-09-05). `valuationFcffService.
 * resolveValuationSource()` refuses to compute a DCF/FCFF without exactly one
 * `MODEL_TO_VALUATION`/`SCENARIO_TO_VALUATION` edge targeting the valuation's business version
 * (`NO_VALUATION_SOURCE_EDGE`). Until today nothing in the product could CREATE that edge for a
 * valuation: `SourceStep.tsx` said so in as many words on screen ("W tym pakiecie (B3, baza
 * 9604652e27) nie istnieje endpoint tworzący to powiązanie"), and the round-4 acceptance measured
 * all three APPROVED CD PROJEKT valuations stuck on „Źródło ZABLOKOWANE". The generic
 * `POST /versions/lineage-edges` (`lineage-navigator.routes.ts`) is NOT a usable substitute from
 * the UI: it makes the caller supply both artifact types, the raw `edgeType`, the
 * `transformationKind` AND the `assumption_snapshot_hash` that
 * `chk_finance_lineage_assumption_hash` mandates for exactly these two edge types — none of which
 * a CFO picking "which Baseline is this valuation built on" can or should know.
 *
 * This service owns the rule set; the router (`valuation.routes.ts`) only maps its result union to
 * HTTP. Every DB statement is delegated to an existing canonical service —
 * `artifactVersionService` (version/artifact reads) and `lineageService` (`getAncestors`,
 * `insertEdge`) — no ad-hoc SQL, no new table, no new migration.
 *
 * ★ APPEND-ONLY IS A HARD FACT, NOT A CHOICE. `finance_lineage_edges` carries
 * `trg_finance_lineage_no_update` / `trg_finance_lineage_no_delete`
 * (`20260809_finance_v3_b03_lineage_freshness.sql`), which RAISE on any UPDATE or DELETE, and
 * `uq_finance_lineage_edges_one_valuation_source` (D09) permits at most ONE source edge per
 * valuation version. A "change the source" operation is therefore not implementable without
 * dismantling that guarantee, so this service does not pretend to offer one: re-posting the SAME
 * source is an idempotent no-op (`created: false`), a DIFFERENT source is refused with
 * `VALUATION_SOURCE_ALREADY_SET`. The honest remedy for a wrong source is a new valuation version,
 * not a rewritten provenance record.
 *
 * ★ `assumption_snapshot_hash` is NOT invented here. The DB requires a non-null value on these two
 * edge types; the honest value for a manual binding is the pin of the exact source content the
 * valuation now claims to descend from — i.e. the source business version's own
 * `content_semantic_hash`. When that column is null (a source version that never ran a compute),
 * we fall back to `canonicalPayloadHash()` over the source version's immutable identity
 * (id + version_no + engine manifest + approval timestamp) rather than a zero/placeholder string,
 * and the response carries `assumptionSnapshotHashOrigin` so nobody downstream mistakes the
 * fallback for a real content hash.
 */

import {
  getArtifact,
  getBusinessVersion,
  type BusinessVersionRow,
} from './artifactVersionService.js';
import { canonicalPayloadHash } from './contentHash.js';
import { TERMINAL_STATUSES, type FinanceArtifactType } from './lifecycleService.js';
import {
  getAncestors,
  insertEdge,
  type LineageEdgeRow,
} from './lineageService.js';
import { getVariant } from './valuationVariantService.js';

/** The two shapes a valuation source can take, in the vocabulary the UI speaks. */
export type ValuationSourceKind = 'baseline' | 'scenario';

export const VALUATION_SOURCE_KINDS: readonly ValuationSourceKind[] = ['baseline', 'scenario'];

export type ValuationSourceEdgeType = 'MODEL_TO_VALUATION' | 'SCENARIO_TO_VALUATION';

/** `sourceKind` <-> (`edge_type`, required `source_artifact_type`) — mirrors `lineageNavigatorContract.ts`'s edge-shape table. */
const SOURCE_KIND_SHAPE: Readonly<
  Record<ValuationSourceKind, { edgeType: ValuationSourceEdgeType; sourceArtifactType: FinanceArtifactType }>
> = {
  baseline: { edgeType: 'MODEL_TO_VALUATION', sourceArtifactType: 'BASELINE_MODEL' },
  scenario: { edgeType: 'SCENARIO_TO_VALUATION', sourceArtifactType: 'PREDICTION_SCENARIO' },
};

const SOURCE_EDGE_TYPES: readonly ValuationSourceEdgeType[] = ['MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION'];

export function isValuationSourceKind(value: unknown): value is ValuationSourceKind {
  return typeof value === 'string' && (VALUATION_SOURCE_KINDS as readonly string[]).includes(value);
}

export interface ValuationSourceEdgeView {
  edgeId: string;
  sourceKind: ValuationSourceKind;
  sourceVersionId: string;
  sourceArtifactType: FinanceArtifactType;
  targetVersionId: string;
  edgeType: ValuationSourceEdgeType;
  transformationKind: string;
  assumptionSnapshotHash: string | null;
  authorId: string | null;
  createdAt: string;
}

function toView(edge: LineageEdgeRow): ValuationSourceEdgeView {
  return {
    edgeId: edge.id,
    sourceKind: edge.edge_type === 'MODEL_TO_VALUATION' ? 'baseline' : 'scenario',
    sourceVersionId: edge.source_version_id,
    sourceArtifactType: edge.source_artifact_type,
    targetVersionId: edge.target_version_id,
    edgeType: edge.edge_type as ValuationSourceEdgeType,
    transformationKind: edge.transformation_kind,
    assumptionSnapshotHash: edge.assumption_snapshot_hash,
    authorId: edge.author_id,
    createdAt: edge.created_at,
  };
}

/**
 * The ONE direct source edge of this valuation version, or `null` when it has none yet.
 * Reuses `lineageService.getAncestors()` (the full recursive chain) and keeps only the edges whose
 * TARGET is this very version — the transitive ancestors (Statement -> Baseline -> Scenario) are
 * legitimately in that result set and must not be mistaken for this version's own source.
 */
async function readDirectSourceEdges(
  organizationId: string,
  valuationBusinessVersionId: string
): Promise<LineageEdgeRow[]> {
  const ancestors = await getAncestors(organizationId, valuationBusinessVersionId);
  return ancestors.filter(
    (edge) =>
      edge.target_version_id === valuationBusinessVersionId &&
      (SOURCE_EDGE_TYPES as readonly string[]).includes(edge.edge_type)
  );
}

export type GetValuationSourceResult =
  | { ok: true; source: ValuationSourceEdgeView | null }
  | { ok: false; code: 'VALUATION_NOT_FOUND' | 'MULTIPLE_VALUATION_SOURCE_EDGES'; message: string };

export async function getValuationSource(
  organizationId: string,
  valuationBusinessVersionId: string
): Promise<GetValuationSourceResult> {
  const variant = await getVariant(organizationId, valuationBusinessVersionId);
  if (!variant) {
    return { ok: false, code: 'VALUATION_NOT_FOUND', message: 'Valuation variant not found in this organization' };
  }
  const edges = await readDirectSourceEdges(organizationId, valuationBusinessVersionId);
  if (edges.length > 1) {
    return {
      ok: false,
      code: 'MULTIPLE_VALUATION_SOURCE_EDGES',
      message: `${edges.length} source edges target business_version_id ${valuationBusinessVersionId}; uq_finance_lineage_edges_one_valuation_source should have prevented this`,
    };
  }
  return { ok: true, source: edges[0] ? toView(edges[0]) : null };
}

export interface BindValuationSourceParams {
  organizationId: string;
  valuationBusinessVersionId: string;
  sourceKind: ValuationSourceKind;
  sourceVersionId: string;
  authorId: string;
}

export type BindValuationSourceErrorCode =
  | 'VALUATION_NOT_FOUND'
  | 'VALUATION_VERSION_TERMINAL'
  | 'SOURCE_VERSION_NOT_FOUND'
  | 'SOURCE_KIND_MISMATCH'
  | 'SOURCE_VERSION_NOT_APPROVED'
  | 'SOURCE_IS_TARGET'
  | 'VALUATION_SOURCE_ALREADY_SET'
  | 'MULTIPLE_VALUATION_SOURCE_EDGES'
  | 'LINEAGE_CYCLE_REJECTED'
  | 'ASSUMPTION_SNAPSHOT_HASH_REQUIRED'
  | 'ASSUMPTION_SNAPSHOT_HASH_FORBIDDEN'
  | 'DUPLICATE_EDGE';

export type BindValuationSourceResult =
  | {
      ok: true;
      /** `false` = the identical edge already existed and nothing was written (idempotent re-post). */
      created: boolean;
      source: ValuationSourceEdgeView;
      assumptionSnapshotHashOrigin: 'SOURCE_CONTENT_SEMANTIC_HASH' | 'SOURCE_VERSION_IDENTITY';
    }
  | { ok: false; code: BindValuationSourceErrorCode; message: string };

/**
 * `chk_finance_lineage_assumption_hash` demands a non-null hash on these edge types. See the file
 * header: the source's own `content_semantic_hash` is the truthful pin; the identity fallback is
 * labelled, never disguised.
 */
function resolveAssumptionSnapshotHash(source: BusinessVersionRow): {
  hash: string;
  origin: 'SOURCE_CONTENT_SEMANTIC_HASH' | 'SOURCE_VERSION_IDENTITY';
} {
  if (source.content_semantic_hash) {
    return { hash: source.content_semantic_hash, origin: 'SOURCE_CONTENT_SEMANTIC_HASH' };
  }
  return {
    hash: canonicalPayloadHash({
      valuationSourceIdentity: {
        businessVersionId: source.business_version_id,
        versionNo: source.version_no,
        engineManifestId: source.engine_manifest_id,
        approvedAt: source.approved_at,
      },
    }),
    origin: 'SOURCE_VERSION_IDENTITY',
  };
}

/**
 * Point one valuation version at the exact, APPROVED Baseline/Scenario version it descends from.
 *
 * Rules, in the order they are checked (each one is the reason a specific 4xx exists):
 *  1. the valuation variant must exist IN THE CALLER'S ORG (cross-tenant -> `VALUATION_NOT_FOUND`);
 *  2. its business version must not be terminal (SUPERSEDED/ARCHIVED/INVALIDATED) — provenance on a
 *     retired record would be a write nobody can act on. APPROVED is deliberately ALLOWED: the three
 *     real CD PROJEKT valuations this decision unblocks are all APPROVED, and a lineage edge is an
 *     append-only fact ABOUT the version, not a mutation OF it (no `finance_business_versions`
 *     column is touched, so no immutability trigger applies);
 *  3. the source version must exist in the caller's org (cross-tenant -> `SOURCE_VERSION_NOT_FOUND`);
 *  4. its artifact type must match the declared `sourceKind` (BASELINE_MODEL / PREDICTION_SCENARIO);
 *  5. its status must be exactly APPROVED — "musi wskazywać dokładną, ZATWIERDZONĄ wersję
 *     Baseline/Scenario, nigdy »najnowszą«" (OWN-FIN-021 point 1, quoted verbatim on the screen);
 *  6. append-only reconciliation (see file header).
 */
export async function bindValuationSource(
  params: BindValuationSourceParams
): Promise<BindValuationSourceResult> {
  const { organizationId, valuationBusinessVersionId, sourceKind, sourceVersionId, authorId } = params;

  const variant = await getVariant(organizationId, valuationBusinessVersionId);
  if (!variant) {
    return { ok: false, code: 'VALUATION_NOT_FOUND', message: 'Valuation variant not found in this organization' };
  }
  const valuationStatus = (variant as { status?: string }).status;
  if (valuationStatus && (TERMINAL_STATUSES as readonly string[]).includes(valuationStatus)) {
    return {
      ok: false,
      code: 'VALUATION_VERSION_TERMINAL',
      message: `Valuation version is ${valuationStatus}; a retired version cannot take a new source binding`,
    };
  }

  if (sourceVersionId === valuationBusinessVersionId) {
    return { ok: false, code: 'SOURCE_IS_TARGET', message: 'A valuation cannot be its own source' };
  }

  const sourceVersion = await getBusinessVersion(organizationId, sourceVersionId);
  if (!sourceVersion) {
    return { ok: false, code: 'SOURCE_VERSION_NOT_FOUND', message: 'sourceVersionId not found in this organization' };
  }
  const sourceArtifact = await getArtifact(organizationId, sourceVersion.artifact_id);
  if (!sourceArtifact) {
    return { ok: false, code: 'SOURCE_VERSION_NOT_FOUND', message: 'Source artifact not found in this organization' };
  }

  const shape = SOURCE_KIND_SHAPE[sourceKind];
  if (sourceArtifact.artifact_type !== shape.sourceArtifactType) {
    return {
      ok: false,
      code: 'SOURCE_KIND_MISMATCH',
      message: `sourceKind '${sourceKind}' requires a ${shape.sourceArtifactType} source; this version is ${sourceArtifact.artifact_type}`,
    };
  }
  if (sourceVersion.status !== 'APPROVED') {
    return {
      ok: false,
      code: 'SOURCE_VERSION_NOT_APPROVED',
      message: `Source version is ${sourceVersion.status}; a valuation may only point at an APPROVED (immutable) source version`,
    };
  }

  const existing = await readDirectSourceEdges(organizationId, valuationBusinessVersionId);
  if (existing.length > 1) {
    return {
      ok: false,
      code: 'MULTIPLE_VALUATION_SOURCE_EDGES',
      message: `${existing.length} source edges already target business_version_id ${valuationBusinessVersionId}`,
    };
  }
  const current = existing[0];
  if (current) {
    if (current.source_version_id === sourceVersionId && current.edge_type === shape.edgeType) {
      // Idempotent re-post: nothing written, the existing fact returned verbatim.
      return {
        ok: true,
        created: false,
        source: toView(current),
        assumptionSnapshotHashOrigin: 'SOURCE_CONTENT_SEMANTIC_HASH',
      };
    }
    return {
      ok: false,
      code: 'VALUATION_SOURCE_ALREADY_SET',
      message:
        'This valuation is already bound to a different source. finance_lineage_edges is append-only (no UPDATE, no DELETE) — create a new valuation version instead of rewriting its provenance.',
    };
  }

  const { hash, origin } = resolveAssumptionSnapshotHash(sourceVersion);
  const inserted = await insertEdge({
    organizationId,
    sourceVersionId,
    sourceArtifactType: shape.sourceArtifactType,
    targetVersionId: valuationBusinessVersionId,
    targetArtifactType: 'VALUATION_CASE',
    edgeType: shape.edgeType,
    transformationKind: 'MANUAL_LINK',
    authorId,
    assumptionSnapshotHash: hash,
  });
  if (!inserted.ok) {
    return { ok: false, code: inserted.code, message: inserted.message };
  }
  return { ok: true, created: true, source: toView(inserted.edge), assumptionSnapshotHashOrigin: origin };
}
