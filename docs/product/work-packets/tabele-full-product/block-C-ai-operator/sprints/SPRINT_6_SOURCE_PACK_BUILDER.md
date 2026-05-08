# Sprint 6 — Source Pack Builder (Block C)

**Sprint ID:** `C-S6`
**Owner:** Agent A (backend) + Agent C (V8 snapshot integration) + Agent B (frontend)
**Status:** `EXECUTED — GO`
**Estimate:** ~1.5 days · **Actual:** ~1 day
**Epic:** EPIC-T12

## Goal

Ship `SourcePackBuilderService`, `tp_source_packs` table, deterministic candidate ranking with ACL filter, V8 snapshot persistence, and `TabeleSourcePackPanel` UI wired into the right rail with handoff into the AI Editor (`payload.sourcePackId`).

## Pre-sprint risk check

| Risk | Mitigation in C-S6 | Status |
|---|---|---|
| C-T7 — ranking performance on 10k records | Deterministic in-process ranking, raw scan capped at 1 000 rows; query-only when curator types text. Embedding similarity deferred to TBL-FU-C6-1. | Mitigated |
| C-S2 — ACL filter on candidates | `loadTenant(tableId)` + `tp_records.table_id` ownership probe before snapshot capture. Cross-tenant tables refused with `TENANT_VIOLATION` (403). | Mitigated |
| Embedding index assumption (spec §5G) | Embedding index does not yet exist for `tp_records`; spec language relaxed by CTO decision (deterministic ranking is enough for the MVP). | Documented · TBL-FU-C6-1 |
| `tp_record_sources` may not exist on pre-Block-B deploys | `loadVerifiedSet()` swallows the error and emits a logger warning so candidate search still works. | Mitigated |
| Candidate explosion (a curator picks 1 000+ records) | Hard cap `MAX_PACK_RECORDS = 200`. UI counter exposes the cap. | Mitigated |

## Deliverables

### Backend (Agent A · landed)

- `server/src/services/tablePlatform/SourcePackBuilderService.ts`
  - `findCandidates`, `createPack`, `getPack`, `listPacks`, `markPackUsed`
  - Composite ranking score (lexical 0.45 / recency 0.20 / confidence 0.20 / verified-source 0.15)
  - Optional verified-only and recencyDays filters
  - V8 snapshot capture (`{ records, fields, capturedAt, captureSource }`)
  - Cross-tenant guard at every public method
- `server/migrations/20260510_block_c_source_pack.sql`
  - `tp_source_packs` (org/workspace TEXT for parity with sibling tables)
  - Indexes on `(organization_id)`, `(workspace_id)`, `(table_id)`, `(organization_id, created_at DESC)` for active rows
- `server/migrations/rollback/20260510_block_c_source_pack.down.sql`
- `server/src/routes/table-platform.source-pack.routes.ts`
  - `POST /tables/:tableId/source-pack/find-candidates`
  - `POST /tables/:tableId/source-pack/create`
  - `GET  /source-packs/:packId`
  - `GET  /tables/:tableId/source-packs`
  - `GET  /workspaces/:workspaceId/source-packs`
  - `POST /source-packs/:packId/used`
- `server/src/config/FeatureFlags.ts` — adds `ENABLE_TABLE_SOURCE_PACK` (default `false`)
- `server/src/Gateway.ts` — mounts source-pack routes (and the previously unmounted QA routes from C-S4)
- `server/src/services/tablePlatform/index.ts` — re-exports
- 21 unit tests in `__tests__/SourcePackBuilderService.test.ts`

### Frontend (Agent B · landed)

- `src/services/api/tablePlatform.api.ts` — adds `findSourcePackCandidates`, `createSourcePack`, `getSourcePack`, `listSourcePacksForTable`, `listSourcePacksForWorkspace`, `markSourcePackUsed` plus types (`SourcePack`, `SourcePackCandidate`, `SourcePackSnapshot`, `FindCandidatesOptions`)
- `src/utils/tabeleSourcePackFlag.ts` — client-side kill switch (`isTabeleSourcePackEnabled`) mirroring the AI Editor / QA flags
- `src/components/AIChat/KimiWorkspace/tabeleShell/sourcePack/SourceCandidateCard.tsx` — DBR77-styled card (verified flag, status pill, score, relative recency)
- `src/components/AIChat/KimiWorkspace/tabeleShell/sourcePack/TabeleSourcePackPanel.tsx` — orchestrator panel with debounced search, recency + verified filters, save flow, saved-pack list, "Use" handoff
- `src/components/AIChat/KimiWorkspace/tabeleShell/useTabeleRightRailPanels.tsx` — wires the new panel into the right rail and adds a `presetFromPack(...)` handoff into the AI Editor (default level `column`, `sourcePackId` in context)
- `__tests__/TabeleSourcePackPanel.test.tsx` — 5 component tests
- `__tests__/useTabeleRightRailPanels.test.tsx` — extended with source-pack assertions

## CTO decisions (CTO seat)

1. **Deterministic ranking** — embedding similarity removed from MVP scope. The composite score uses lexical hits + recency decay + confidence + verified-source bonus only. Embeddings will land in TBL-FU-C6-1 once we ship a real index.
2. **Org / workspace columns are `TEXT`**, not UUID, to match every other `tp_*` table in the codebase. Spec wording took precedence over the EPIC's pseudocode.
3. **V8 snapshot is captured at pack-creation time only** — never updated. If a record changes after the pack is saved the curator sees the snapshot; downstream consumers do too. Matches the immutable-template pattern from Block A.
4. **Pack analytics** — separate `markPackUsed` endpoint instead of bumping `used_count` inside `getPack`. Avoids accidental counter inflation when a UI prefetches a pack.
5. **Right-rail handoff defaults to `column` level** because the most common reason a curator hands a pack to AI is "fill missing values"; the user can switch level inside the AI Editor panel without losing the `sourcePackId`.
6. **Three-flag gating** — `ENABLE_TABLE_SOURCE_PACK` (backend) + `isTabeleSourcePackEnabled()` (frontend) + the existing MELS lane flag. Defaults: all three off until C-S7 closeout.
7. **Routes mounted in Gateway** — fixed a C-S4 oversight (the QA router file was created and exported but never `app.use(...)`-ed). Same commit also mounts the new source-pack router.

## Out of scope (filed)

- Embedding-similarity ranking on top of the lexical ranker. → **TBL-FU-C6-1**
- Pack version history, edit-after-create. → out of program
- Cross-tenant pack sharing → forbidden by tenancy rule
- Auto-generated packs from QA suggestions → covered partly by AI Editor level 8
- Full i18n (EN+PL) for new panel copy → batched into **TBL-FU-C5-1** (existing)
- Automatic pack-counter increment when AI Editor consumes a pack → **TBL-FU-C6-2**
- Server-side performance test on a 10k corpus → **TBL-FU-C6-3** (the in-memory ranking is O(N) over a 1k cap; a real perf gate happens in C-S7 closeout)

## Validation

- 21 backend tests in `SourcePackBuilderService.test.ts` — all pass
- Full Block C backend suite — 115 / 115 tests pass (no regressions across C-S1–C-S5)
- 5 frontend tests in `TabeleSourcePackPanel.test.tsx` — all pass
- Updated `useTabeleRightRailPanels.test.tsx` — 4 / 4 tests pass
- DBR77 hex scan on new components — clean (no raw hex literals)
- ESLint — clean on every modified file

## Sprint Exit Gate

- [x] All endpoints implemented + protected by auth + organization context.
- [x] Cross-tenant 403 verified in unit tests (3 separate paths).
- [x] Pack creation persists V8 snapshot; ownership probe rejects mixed-table candidates.
- [x] Right-rail panel renders DBR77 compliant; "Use" handoff routes pack into AI Editor.
- [x] Recommendation: **`GO` to C-S7 (Block C closeout)**.
