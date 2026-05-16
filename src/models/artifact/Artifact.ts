/**
 * V10-ART-001 — unified `Artifact` interface (Wave A seed, schema-only).
 *
 * Implements R-ARTIFACT-1 from
 * `docs/Chat V9/DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md` and
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-001`.
 *
 * Scope (Wave A seed)
 * --------------------
 * This file ships the top-level `Artifact` type and its identity brands
 * only. Sibling tickets (V10-ART-002..005) ship the inner unions
 * (`ArtifactType`, `ReviewState`, `DataClassification`, version lineage).
 * Until those tickets land, this file inlines minimal placeholder unions
 * with a JSDoc pointer to the ticket that will subsume them.
 *
 * The inlined placeholders are intentionally narrow (single sentinel
 * member) so that any downstream code importing them cannot accidentally
 * rely on a richer vocabulary than the sibling ticket will actually
 * ship. When a sibling ticket lands, its canonical union replaces the
 * placeholder here via a `@deprecated` marker and a 1-PR migration.
 *
 * Runtime behaviour
 * -----------------
 * No runtime behaviour. This is a type-only module. The
 * `ff.artifact_unified_model` flag (V10 registry) gates adoption by
 * downstream modules — without the flag on, callers are expected to
 * fall through to their legacy shape.
 *
 * CI contract
 * -----------
 * - Unit test (`Artifact.test.ts`) asserts the interface shape via
 *   `satisfies` + required-keys table.
 * - V10 registry invariant 33 pins this module's owning ticket
 *   (`V10-ART-001` → block `artifact`).
 * - Integration test is deferred to V10-ART-022 (ArtifactStore).
 */

// ---------------------------------------------------------------------------
// §1 — Identity brands.
// ---------------------------------------------------------------------------
// All V10 IDs are branded strings. The brand is phantom-only (erased at
// runtime) and prevents accidental cross-assignment at compile time.

declare const ARTIFACT_ID_BRAND: unique symbol;
declare const ARTIFACT_VERSION_ID_BRAND: unique symbol;
declare const TENANT_ID_BRAND: unique symbol;
declare const USER_ID_BRAND: unique symbol;
declare const POLICY_ID_BRAND: unique symbol;
declare const RETENTION_POLICY_ID_BRAND: unique symbol;
declare const EXPORT_RECORD_ID_BRAND: unique symbol;

export type ArtifactId = string & { readonly [ARTIFACT_ID_BRAND]: void };
export type ArtifactVersionId = string & { readonly [ARTIFACT_VERSION_ID_BRAND]: void };
export type TenantId = string & { readonly [TENANT_ID_BRAND]: void };
export type UserId = string & { readonly [USER_ID_BRAND]: void };
export type PolicyId = string & { readonly [POLICY_ID_BRAND]: void };
export type RetentionPolicyId = string & { readonly [RETENTION_POLICY_ID_BRAND]: void };
export type ExportRecordId = string & { readonly [EXPORT_RECORD_ID_BRAND]: void };

/**
 * ISO-8601 timestamp. Typed alias (not branded) — timestamps are
 * frequently compared with raw `Date.now()` outputs and branding would
 * force a coercion at every comparison site for zero audit benefit.
 */
export type Timestamp = string;

/**
 * Constructor helpers. Kept minimal — a full validation layer lands in
 * V10-ART-022 (ArtifactStore boundary). These unsafe-casts exist so
 * tests and seed code can build branded values without pulling in a
 * validator module that itself depends on this file.
 */
export const unsafeArtifactId = (v: string): ArtifactId => v as ArtifactId;
export const unsafeArtifactVersionId = (v: string): ArtifactVersionId => v as ArtifactVersionId;
export const unsafeTenantId = (v: string): TenantId => v as TenantId;
export const unsafeUserId = (v: string): UserId => v as UserId;
export const unsafePolicyId = (v: string): PolicyId => v as PolicyId;
export const unsafeRetentionPolicyId = (v: string): RetentionPolicyId => v as RetentionPolicyId;
export const unsafeExportRecordId = (v: string): ExportRecordId => v as ExportRecordId;

// ---------------------------------------------------------------------------
// §2 — Placeholder unions (replaced by sibling tickets).
// ---------------------------------------------------------------------------

/**
 * @placeholder Replaced in full by V10-ART-002.
 * Wave A seed ships only the seven canonical types enumerated in
 * `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN §V10-ART-002`.
 */
export type ArtifactType =
  | 'slide_deck'
  | 'spreadsheet'
  | 'memo'
  | 'decision_doc'
  | 'raci'
  | 'research_report'
  | 'rich_note';

/**
 * @placeholder Replaced in full by V10-ART-003.
 * Wave A seed ships the canonical FSM states; transition validation is
 * deferred to V10-ART-003.
 */
export type ReviewState =
  | 'draft'
  | 'ready_for_review'
  | 'rejected'
  | 'approved'
  | 'published'
  | 'archived';

/**
 * @placeholder Replaced in full by V10-ART-004.
 * Wave A seed ships the four classification levels; governance
 * enforcement (default per type, inheritance from parent) is deferred.
 */
export type DataClassification = 'Public' | 'Internal' | 'Confidential' | 'Restricted';

/**
 * @placeholder Replaced in full by V10-RSN-015 (TrustBundle contract).
 * Wave A seed carries only the `sha256` digest so the Artifact can be
 * persisted with a provenance hash; full evidence graph is deferred.
 */
export interface EvidenceRef {
  readonly trustBundleSha256: string;
  readonly sourceHint: string | null;
}

/**
 * Opaque placeholder kept for back-compat during the V10-ART-006 ⇒
 * V10-ART-022 migration window. The canonical typed discriminated
 * union lives in `ArtifactCanonicalContent.ts` (V10-ART-006). The
 * ArtifactStore (V10-ART-022) flips persisted rows from this shape
 * to `ArtifactCanonicalContent` in one sweep; until then, callers
 * may carry either shape and cast at the boundary.
 *
 * @placeholder Superseded by `ArtifactCanonicalContent` (V10-ART-006).
 *   Removed in full at V10-ART-022 (ArtifactStore migration).
 */
export type ArtifactContent = { readonly __opaqueType: ArtifactType; readonly blob: unknown };

// ---------------------------------------------------------------------------
// §3 — Artifact core interface.
// ---------------------------------------------------------------------------

/**
 * The unified content object V10 writes to across every block. A memo
 * produced by Chat, a slide deck produced by the deck builder, and a
 * RACI from the ops workspace all share this type. Module views are
 * *renderers* of this model — they do not own their own storage.
 *
 * Stability contract
 * ------------------
 * - `id` is stable across renames, exports, and version bumps. Once
 *   assigned, it never changes.
 * - `currentVersionId` advances with each mutation-proposal apply.
 *   Approved versions are immutable (V10-ART-003).
 * - `lineageRootId === id` when the artifact is the root of its lineage
 *   tree; for derived artifacts, it points at the original.
 *
 * Field-by-field rationale is in the research doc; the dev plan lists
 * only the condensed shape. This file is the authoritative TypeScript.
 */
export interface Artifact {
  readonly id: ArtifactId;
  readonly tenantId: TenantId;
  readonly type: ArtifactType;
  readonly ownerId: UserId;
  readonly permissionPolicyId: PolicyId;
  readonly dataClassification: DataClassification;
  readonly retentionPolicyId: RetentionPolicyId;
  readonly reviewState: ReviewState;
  readonly currentVersionId: ArtifactVersionId;
  readonly lineageRootId: ArtifactId | null;
  readonly parentArtifactId: ArtifactId | null;
  readonly derivedFromVersionId: ArtifactVersionId | null;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly archivedAt: Timestamp | null;
  readonly exportRecords: readonly ExportRecordId[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly content: ArtifactContent;
}

/**
 * The required-keys manifest. Used by the unit test to assert that
 * every key a production ArtifactStore insert must supply is present —
 * a test will fail if a future PR drops a field by accident.
 *
 * The type-level `satisfies` check + the runtime array are
 * intentionally redundant: the runtime array is what CI reflects on;
 * the type-level check prevents a typo (e.g. `'owener'`) from sneaking
 * past a reviewer.
 */
export const ARTIFACT_REQUIRED_KEYS = [
  'id',
  'tenantId',
  'type',
  'ownerId',
  'permissionPolicyId',
  'dataClassification',
  'retentionPolicyId',
  'reviewState',
  'currentVersionId',
  'lineageRootId',
  'parentArtifactId',
  'derivedFromVersionId',
  'createdAt',
  'updatedAt',
  'archivedAt',
  'exportRecords',
  'evidenceRefs',
  'content',
] as const satisfies ReadonlyArray<keyof Artifact>;

export type ArtifactRequiredKey = (typeof ARTIFACT_REQUIRED_KEYS)[number];
