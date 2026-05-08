# EPIC-T12 — Source Pack Builder

**Block:** C — AI Operator
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, section 5G (RAG / source assembly), section 7 (operational flows).
**Owner agent:** A (backend) + B (frontend) + C (V8 snapshot integration)

---

## Goal

Allow users to assemble a "source pack" — a curated bundle of records (and optionally documents / URLs) — that will feed into a new generation (new records, new column values, or new template instantiation). Pack assembly is governed: every selected source goes through ACL filter; the pack is stored and addressable.

## Acceptance criteria

- `SourcePackService.findCandidates({tableId, query, filters, actor})` returns ranked candidates from records the actor can read.
- Candidate ranking inputs: full-text match, embedding similarity (uses existing index), recency, source verification status.
- `SourcePackService.createPack({tableId, candidateIds, actor})` persists a pack with V8 snapshot of selected records.
- Packs addressable via `pack_id` and consumable by AI Editor levels (column, record, source) as a `payload.sourcePackId`.
- UI `TabeleSourcePackPanel` with search, filter chips (table, recency, verified-only), and selection list.
- "Add to pack" button on each candidate; "Save pack" action persists.
- Pack listing in panel for reuse.
- ACL filter at every step.

## Schema

```sql
CREATE TABLE tp_source_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  owner_user_id UUID NOT NULL REFERENCES users(id),
  table_id UUID NULL REFERENCES tp_tables(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NULL,
  candidate_record_ids UUID[] NOT NULL DEFAULT '{}',
  v8_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_count INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_tp_source_packs_tenant ON tp_source_packs(organization_id);
```

## In scope

### Backend
- `SourcePackService.ts`.
- Migration adds `tp_source_packs` table.
- Routes: `POST /tables/:id/source-pack/find-candidates`, `POST /tables/:id/source-pack/create`, `GET /source-packs/:id`, `GET /tables/:id/source-packs`.
- Tests including ACL filter + cross-tenant.

### Frontend
- `TabeleSourcePackPanel.tsx` with search, filters, list, save flow.
- `SourceCandidateCard.tsx`.
- Wiring into `KimiWorkspaceShell` Menu 3 right-slot.
- Component tests.

## Out of scope

- Pack version history (out of program).
- Sharing packs across tenants (forbidden by tenancy rule).
- Auto-generated packs (covered partly by AI Editor level 8).

## Dependencies

- Block B's `tp_record_sources` for verified-only filter.
- Existing embedding index (assumed available).

## Estimated effort

- S6 (1.5 days): backend + migration + tests + frontend panel.
