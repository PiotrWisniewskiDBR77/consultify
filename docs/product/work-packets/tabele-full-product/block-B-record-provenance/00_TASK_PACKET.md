# Task Packet — Block B: Record Provenance

**Block ID:** `TABELE_BLOCK_B_RECORD_PROVENANCE`
**Template:** `.cursor/TASK_PACKET_TEMPLATE.md`
**Created:** 2026-05-07
**Status:** `PLANNED`
**Lane SSOT:** `DRD/consultify/docs/product/FINAL_IMPLEMENTATION_PLAN_24_TABELE_2026-05-07.md`

---

## 1) Goal

Make every record in the Table Platform first-class auditable: link to source artifacts (documents, URLs, prior records, AI generations), expose confidence score (0–1), and validation status (`unverified`, `auto_validated`, `human_validated`, `rejected`). Surface provenance in the grid UI and in `TabelePreviewLayout` records section. Cover the spec sections 8 (`TableRecord`), 5C, 5D, 11 (governance), 14 (consulting workflows).

## 2) Non-Goals

- No new AI Editor (Block C).
- No QA Engine (Block C).
- No table → document/presentation conversion (Block D).
- No edits to Foundation Block lane components except `TabelePreviewLayout` records section (additive only).
- No real-time multi-user provenance editing (out of program).
- No external source ingestion API beyond record-id / URL / artifact-id (out of program).

## 3) Constraints

### Technical
- DB migration: `CREATE TABLE tp_record_sources (...)` + `ALTER TABLE tp_records ADD COLUMN confidence_score NUMERIC(3,2), validation_status TEXT`. Both NULL-default. Migration filename: `20260508_block_b_record_sources.sql` at top-level `consultify/server/migrations/` (per S0 finding B-S0-F1).
- `tp_record_sources.organization_id` is `TEXT NOT NULL` (no FK), denormalized at write time from `tp_records → tp_tables → tp_bases.organization_id` (per S0 finding B-S0-F2).
- Audit trail uses existing `tp_audit_events` table via `AuditService.logEvent` with `entity_type ∈ {'record_source', 'record_validation'}`. Confidence recompute does NOT log per call (high-frequency); only validation status flips do (per S0 finding B-S0-F3).
- New endpoints under `/api/table-platform/records/:id/sources` (POST/GET/DELETE).
- Source resolution always goes through `PermissionsService.canRead(actor, source_id)` — actual API signature confirmed in S2 (per S0 finding B-S0-F7).
- Confidence scoring algorithm runs on record write + on dependency change; idempotent. Hook integrated in `RecordsService.ts` between formula recompute and realtime notification (lines ~348/570) (per S0 finding B-S0-F4).
- Feature flag `featureRecordProvenanceEnabled` gates read/write of new columns and the new endpoints. The flag is checked INSIDE `ConfidenceScoringService.recompute()` (returns no-op when disabled) so partial deploys cannot crash record writes (per S0 finding B-S0-F6).

### Product / UX
- Grid cell shows tiny confidence bar (sparkline-style) on the row gutter when `confidence_score < 0.7`.
- Validation status renders as small badge on the row's leading cell: `?` (unverified), `✓` AI (auto_validated), `✓` (human_validated), strike-through (rejected).
- Source popover opens from row gutter icon: lists sources, last verified time, "Add source" button, "Mark verified" button.
- All copy in EN + PL.
- DBR77 monochrome accent only.

### Safety / security
- Cross-tenant 403 on every source endpoint.
- Source content rendering goes through ACL filter (cannot show source actor cannot read).
- AI auto-validation never sets `validation_status = human_validated` (only humans can).
- Audit trail records every source mutation and every status flip.

## 4) Scope

### In scope — files to CREATE

**Backend**
- `consultify/server/src/services/tablePlatform/migrations/2026_05_block_b_record_sources.sql`
- `consultify/server/src/services/tablePlatform/RecordSourcesService.ts`
- `consultify/server/src/services/tablePlatform/ConfidenceScoringService.ts`
- `consultify/server/src/services/tablePlatform/ValidationStatusService.ts`
- `consultify/server/src/routes/table-platform.record-sources.routes.ts`
- `consultify/server/src/services/tablePlatform/__tests__/RecordSourcesService.test.ts`
- `consultify/server/src/services/tablePlatform/__tests__/ConfidenceScoringService.test.ts`
- `consultify/server/src/services/tablePlatform/__tests__/ValidationStatusService.test.ts`
- `consultify/server/src/routes/__tests__/record-sources-acl.test.ts`

**Frontend**
- `consultify/src/components/MyWork/table/provenance/SourcePopover.tsx`
- `consultify/src/components/MyWork/table/provenance/ConfidenceBar.tsx`
- `consultify/src/components/MyWork/table/provenance/ValidationBadge.tsx`
- `consultify/src/components/MyWork/table/provenance/AddSourceDialog.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.tsx`
- Component tests under `tests/components/MyWork/table/provenance/`

**Docs**
- This packet folder.
- `consultify/docs/product/RECORD_PROVENANCE_V1.md` documenting data model, scoring, validation lifecycle.

### In scope — files to UPDATE (additive only)

- `consultify/server/src/services/tablePlatform/RecordsService.ts` — extend record write path to call `ConfidenceScoringService.recompute(recordId)` on every mutation; new `getRecordWithProvenance(id)` helper.
- `consultify/server/src/services/tablePlatform/index.ts` — export new services.
- `consultify/server/src/index.ts` — mount new route module.
- `consultify/src/components/MyWork/table/GridView.tsx` — render `<ConfidenceBar>` and `<ValidationBadge>` on each row gutter when `featureRecordProvenanceEnabled`.
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx` — records section additive: new column `Source / Confidence`.
- `consultify/public/locales/{en,pl}/translation.json` — ~30 keys for provenance UI.

### Files explicitly OUT OF SCOPE

- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts`
- `consultify/server/src/services/tablePlatform/RelationExplainabilityService.ts`
- All Foundation Block files except `TabelePreviewLayout.tsx` (records section additive only).
- All Wordy / Excele / Prezentacje components.

## 5) Definition Of Done

### Functional
- [ ] Migration deployed; new columns + table exist on staging + production.
- [ ] Source CRUD works for all 4 source types (`document`, `url`, `record`, `ai_generation`).
- [ ] Confidence score recomputed on every record write; documented algorithm.
- [ ] Validation status flips correctly (auto_validated by AI, human_validated by user action, rejected by user).
- [ ] Grid UI renders confidence bar + validation badge + source popover.
- [ ] Tabele Word-canvas records section shows source + confidence column.
- [ ] EN + PL i18n complete.
- [ ] Cross-tenant 403 on every source endpoint.
- [ ] Feature flag `featureRecordProvenanceEnabled` toggles all new UI + endpoints.

### Validation
- [ ] Frontend lint + typecheck clean.
- [ ] Backend typecheck clean.
- [ ] All unit / component / integration tests green.
- [ ] Migration runs on staging snapshot in <30 s and rolls back cleanly.
- [ ] Performance: 50 k records grid render with confidence bars < 100 ms p95.

### Evidence
- All filled in `03_BLOCK_CLOSEOUT.md`.
- Screenshots: source popover, confidence bar, validation badge, Tabele records section with provenance.

## 6) Risk Notes

See `02_RISK_REGISTER.md`. Top risks:

- **B-T1 / PR4** Migration on `tp_records` blocks production. Mitigation: NULL-default, no rewrite, rehearsal in S0.
- **B-T2** Confidence scoring algorithm too aggressive → constant low scores demoralize users. Mitigation: tunable thresholds + telemetry baseline before publish.
- **B-S1** Source content exposure leaks data across ACL boundaries. Mitigation: every render goes through `PermissionsService.canRead`.
- **B-S2** AI auto-validation forge into human-validation. Mitigation: hard rule that `human_validated` requires user action; service-level invariant.

### Rollback strategy

- Tier 1: feature flag off → endpoints return 404, UI hides badges, all writes ignore new columns.
- Tier 2: code revert.
- Tier 3: migration rollback drops new column + table.

---

## Sign-off

- Block lead: ___ (waiting for user GO)
- UI/UX reviewer: ___
- Security reviewer: ___
- Date: ___
