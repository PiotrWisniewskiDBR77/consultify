# EPIC-T8 — Source Provenance

**Block:** B — Record Provenance
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, sections 8 (`TableRecord`), 11 (governance).
**Owner agent:** A (backend) + B (frontend)

---

## Goal

Enable every record to declare its source(s): document, URL, prior record, AI generation. Persist sources in a new `tp_record_sources` table with audit trail. Surface sources in a popover from each grid row gutter. Resolve content through `PermissionsService` to honor ACL.

## Acceptance criteria

- New table `tp_record_sources` created with FK to `tp_records.id` (CASCADE on delete).
- Source types accepted: `document`, `url`, `record`, `ai_generation`, `form_submission`.
- POST/GET/DELETE endpoints under `/api/table-platform/records/:id/sources` with cross-tenant 403.
- Source popover lists current sources (with type icon, label, last-verified time, link), "Add source" button.
- AddSourceDialog with 4 tabs (one per source type except `ai_generation` which is system-set).
- Removing a source soft-deletes (sets `deleted_at`) and writes audit row.
- Cap of 50 sources per record; oldest active first to evict.
- Resolution of source content goes through `PermissionsService.canRead`; sources actor cannot read are filtered from listings.

## Schema

Final shape per S0 finding B-S0-F2 (TEXT IDs to match table-platform convention):

```sql
CREATE TABLE IF NOT EXISTS tp_record_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,                                          -- TEXT, no FK; denormalized at write
  record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN
    ('document','url','record','ai_generation','form_submission')),
  source_ref TEXT NOT NULL,
  label TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NULL,                                                   -- TEXT to match created_by convention
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NULL,
  last_verified_by TEXT NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record
  ON tp_record_sources(record_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_tenant
  ON tp_record_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record_type
  ON tp_record_sources(record_id, source_type) WHERE deleted_at IS NULL;
```

## In scope

### Backend
- Migration ships table.
- `RecordSourcesService.ts`:
  - `addSource(recordId, sourceInput, actor)` → row, with cap enforcement
  - `listSources(recordId, actor)` → ACL-filtered list
  - `removeSource(sourceId, actor, reason)` → soft-delete + audit
  - `markVerified(sourceId, actor)` → updates `last_verified_*`
- Routes module `table-platform.record-sources.routes.ts` mounted before wildcards.
- Unit + integration tests including cross-tenant 403.

### Frontend
- `SourcePopover.tsx` — opens from row gutter; lists sources; "Add" / "Mark verified" / "Remove" actions.
- `AddSourceDialog.tsx` — 4 tabs (document/url/record/form_submission); validation per tab.
- Wiring inside `GridView.tsx` (provenance gutter slot, additive).
- Unit + component tests.

## Out of scope

- Auto-suggesting sources from existing artifacts (out of program; covered partly by EPIC-T12 Source Pack Builder in Block C).
- Real-time source tracking from connected drives (out of program).

## Dependencies

- A-XB1 — A's `source_reference` field type writes `source_ref` IDs into this table eventually; B owns the table schema.
- B-XB3 — Block D form submissions write sources of type `form_submission`.

## Estimated effort

- S1 (1 day): migration + service skeleton.
- S2 (1.5 days): full CRUD + ACL + tests.
- S4 (1 day): popover + dialog UI + integration tests.
