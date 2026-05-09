# V8 Snapshot Contract Audit — Block D / D-S0

**Date:** 2026-05-08
**Scope:** `tp_source_packs.v8_snapshot` ↔ `materializeArtifactRun` (report + presentation) compatibility.

## Reality vs original packet

The original Block D packet referenced `WordyArtifactService` and `PrezentacjeArtifactService`. **These services do not exist** under those names. The actual conversion plumbing is:

```
TableArtifactConversionService (Block D, NEW)
        │
        ▼
artifactRegistryService.materializeArtifactRun(...)
        │
        ├── resolveMaterializedReportParams       → reports.routes
        └── resolveMaterializedPresentationParams → presentations.routes
```

`materializeArtifactRun` accepts either:

1. **Explicit** `sourceType` + `sourceId` materialize params, OR
2. A `ContextSnapshot` with `sourceContextRefs[]` whose `sourceKind` maps via `SNAPSHOT_SOURCE_KIND_TO_REPORT_SOURCE_TYPE` / `SNAPSHOT_SOURCE_KIND_TO_PRESENTATION_SOURCE_ARTIFACT_TYPE`.

Today's mapping has **no entry** for `source_pack_create` or for raw `tp_tables`.

## The four contracts

| Producer | Shape | Capture vs read |
|---|---|---|
| `tp_source_packs.v8_snapshot` (Block C) | `{ records[], fields[], capturedAt, captureSource:'source_pack_create' }` | Captured at create, immutable. |
| `tp_v8_context_snapshots` (`contextSnapshotService`) | `ContextSnapshot { sourceContextRefs[] }` (sourceKind ∈ `assessment`, `initiative`, `tool`, …) | Captured at chat run, immutable. |
| `v8_version_snapshots` (`versionReplayService`) | `{ resourceType, resourceId, stateData, metadata }` — generic version blob | Per resource version. |
| Block D conversion input (NEW) | TBD this audit | TBD this audit |

## Drift risk

**The source-pack snapshot cannot be passed straight to `materializeArtifactRun`.** Records + fields are not the same axis as `sourceContextRefs`. We need an adapter.

## CTO decision: build a thin adapter, not a new snapshot kind

| Option | Decision |
|---|---|
| Extend `SNAPSHOT_SOURCE_KIND_TO_*` with `source_pack_create` and a new resolver. | **Rejected** — bloats the registry for one consumer; couples Block D to the chat snapshot pipeline. |
| **Pass explicit `sourceType` + `sourceId` to `materializeArtifactRun`, supplying a fresh adapter shape.** | **Accepted** — Block D's `TableArtifactConversionService` translates the source-pack snapshot into the materialize params the report/presentation services already accept. |

## Adapter contract (locked)

```ts
// server/src/services/tablePlatform/TableArtifactConversionService.ts
interface TableConversionInput {
  tableId: string;
  organizationId: string;
  workspaceId: string;
  initiatedBy: string;
  /** When set, Block C source pack provides the V8 snapshot; otherwise we
   *  capture a fresh snapshot at conversion time. */
  sourcePackId?: string;
  target: 'document' | 'presentation';
  /** Optional title override. */
  title?: string;
  /** Optional sections / slides hint forwarded to the existing artifact
   *  pipeline. */
  outline?: Array<{ heading: string; bodyHint?: string }>;
}

interface TableConversionResult {
  /** Identity of the produced artifact run (existing v8_artifact_runs). */
  artifactRunId: string;
  /** Convenience deep link the UI can follow ("/wordy/...?artifactId=..."). */
  laneDeepLink: string;
  /** When provided, the conversion piggy-backed on a pack snapshot. */
  sourcePackId?: string;
}
```

The service:
1. Resolves the tenant via `tp_bases` (cross-tenant guard).
2. Either loads the source pack snapshot (when `sourcePackId` is passed and ACL-checked) or captures a fresh snapshot from `tp_records` + `tp_fields`.
3. Calls `materializeArtifactRun({ workspaceId, organizationId, target, sourceType: 'tabele_table', sourceId: tableId, snapshot })` with the adapter payload.
4. Persists an audit row in a new `tp_table_conversions` table for analytics + replay.

## Migration plan for Block D

```sql
-- 20260512_block_d_table_conversions.sql
CREATE TABLE IF NOT EXISTS tp_table_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  source_pack_id UUID NULL REFERENCES tp_source_packs(id) ON DELETE SET NULL,
  target TEXT NOT NULL CHECK (target IN ('document','presentation')),
  artifact_run_id UUID NULL,                -- set after materialize succeeds
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed')),
  initiated_by TEXT NOT NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL
);
```

**Decision: NO new V8 snapshot kind.** The conversion adapter is a write-once row in `tp_table_conversions`. The actual data lives in the existing `tp_source_packs.v8_snapshot` plus the existing artifact run blob.

## Block D / D-S2 form-intake addendum

`tp_forms` already exists (`server/migrations/704_forms.sql`). Block D will:

1. Add columns: `embed_target_table_id UUID`, `public_jwt_secret TEXT`, `field_allow_list JSONB`.
2. Rename / introduce a new helper `FormService.submitFromPublic(...)` that wraps the existing `FormService.submitForm(...)` with JWT validation, rate limit, and provenance tagging.
3. **Do NOT change** the existing `publicFormRouter` slug-based path — it stays for backward compatibility.
4. Add a new `/api/table-platform/public/forms/jwt/:token/submit` route for JWT-tokenized intake.

## Verdict

`GO` for the Block D plan as defined here. No re-scoping needed.
