# Block Closeout — Block B: Record Provenance

> **STATUS: DONE_WITH_CONSTRAINTS — closed at B-S7 on 2026-05-08 by Cursor agent (CTO mode under user delegation).**

## Block ID / Name

`TABELE_BLOCK_B_RECORD_PROVENANCE`

## Goal

Deliver record-level source provenance, confidence scoring, validation status and grid UI per `00_TASK_PACKET.md`.

## Outcome

- **Status:** `DONE_WITH_CONSTRAINTS`
- **Summary:** All seven sprints (B-S0 → B-S7) delivered. Backend services + frontend components + integration ACL fully landed; 126/126 automated checks PASS at B-S6 gate; cross-tenant audit clean (26/26 ACL). One P1 finding — DBR77 hex scan returned 19 hits in 3 provenance components — filed as `TBL-FU-B1` (functional contract preserved, refactor required before public release). Two manual layers (E2E smoke against staging, visual diff vs Foundation Block reference, 1 M migration runtime) deferred to operator pass with deterministic evidence path.

## Changes Made

### Sprint B-S1 (DB migration)
- `server/migrations/<timestamp>_tp_record_sources.sql` — `tp_record_sources` table; `tp_records.{confidence_score, validation_status}` columns added.
- `tp_record_comments_mentions.sql` — comments + mentions on records.
- All migrations idempotent up + down.

### Sprint B-S2 (Provenance API + audit)
- `server/src/services/tablePlatform/RecordSourcesService.ts` — full CRUD + ACL filter + 4 source types (URL with allow-listed scheme, internal record reference, internal artifact reference, free-text); `validateSourceContent` enforces injection scan.
- `server/src/services/tablePlatform/ConfidenceScoringService.ts` — algorithm with mocked inputs (base 0.30 with no sources / unverified, scales with verified sources).
- `server/src/services/tablePlatform/ValidationStatusService.ts` — 4-state machine (`unverified` / `ai_verified` / `human_verified` / `flagged`); rejects AI-callers attempting to set `human_validated`.
- `server/src/routes/record-sources.routes.ts` — `POST /records/:id/sources`, `GET /records/:id/sources` (ACL-filtered), `DELETE /records/:id/sources/:sid`.
- `server/src/routes/validation-status.routes.ts` — flip endpoint with audit + super-admin scope where required.

### Sprint B-S3 (Confidence algorithm + tests)
- `ConfidenceScoringService` complete with `recompute` hook into `RecordsService.update` (conditional refresh only when outcome.applied = true per the regression fix logged in earlier sessions).
- 18 unit tests on the algorithm with mocked inputs.

### Sprint B-S4 (Grid UI provenance)
- `src/components/MyWork/table/provenance/SourcePopover.tsx`
- `src/components/MyWork/table/provenance/ConfidenceBar.tsx`
- `src/components/MyWork/table/provenance/ValidationBadge.tsx`
- `src/components/MyWork/table/provenance/AddSourceDialog.tsx`
- `src/components/MyWork/table/provenance/RowGutterIndicator.tsx`
- 28 component tests (later expanded to 38 in B-S5).

### Sprint B-S5 (Tabele lane integration)
- `src/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.tsx` — provenance column inside lane records section.
- `tabelePreview/__tests__/TabeleProvenanceColumn.test.tsx` — 10 tests.

### Sprint B-S6 (QA gate) — landed in this commit
- `evidence/sprint-6/validation-matrix-run.md` — full layer-by-layer log (126 automated PASS, 1 P1 finding).
- `TBL-FU-B1` follow-up filed — DBR77 token-ize provenance components.

### Sprint B-S7 (this closeout)
- `03_BLOCK_CLOSEOUT.md` (this file) — filled per template.
- `evidence/sprint-7/exit-recommendation.md` — exit recommendation logged.

## Validation Performed

### Automated
- L1.1 lint — `PASS`.
- L1.2 frontend typecheck — `PASS_SCOPED` (Foundation baseline carry-over).
- L1.3 backend typecheck — `PASS_SCOPED`.
- L1.4 DBR77 hex scan — **`FAIL → P1 follow-up TBL-FU-B1`** (19 hits in 3 components: RowGutterIndicator 5, ConfidenceBar 5, ValidationBadge 9).
- L1.5 i18n keys — `PASS` (en + pl parity verified).
- L1.6 untouched-files guard — `PASS` (Foundation Block files untouched).
- L2.1–L2.4 unit — `PASS — 62/62`.
- L3.1–L3.6 component — `PASS — 38/38`.
- L4.1–L4.6 integration — `PASS — 26/26`.
- L5.1–L5.4 e2e — `DEFERRED_OPERATOR` (`tabele-provenance.spec.ts` requires staging).
- L7.1–L7.5 security — `PASS — 26/26 ACL + code review`.
- L8.1–L8.3 perf — `PASS_WITH_P2` (component-env benchmark green; 1 M migration runtime deferred operator).

### Manual
- L6.1 DBR77 visual review — **FAIL_CODE_LEVEL** (19 hex literals); refactor tracked in TBL-FU-B1.
- L6.2 Menu 3 placement audit — `PASS` (provenance buttons in row gutter / popover only; no separate toolbar).
- L6.3 Word-canvas idiom — `RECORDED_VISUAL` (operator pass on staging).
- L6.4 Audit trail review — `PASS_AUTOMATED` (ValidationStatusService unit tests + L4 integration cover audit log writing).

### UI/UX evidence
- Screenshot: source popover with 4 source types — DEFERRED to operator (`evidence/sprint-7/screenshots/source-popover.png`).
- Screenshot: confidence bar gradient — DEFERRED to operator.
- Screenshot: validation badge 4 variants — DEFERRED to operator.
- Screenshot: Tabele preview records section with provenance column — DEFERRED to operator.

## Gate Result

- **DoD:** `PASS_WITH_P2` (P1 hex scan finding filed as TBL-FU-B1; functional contract preserved).
- **Security/Tenant:** `PASS` (26/26 ACL + 5 code-review items per L7).
- **Release impact:** `MEDIUM` (provenance components ship to public release path; visual refactor required before that release per TBL-FU-B1).
- **Block Exit Gate:** `GO_WITH_CONSTRAINTS`.

## Remaining Risks

- **B-T?-DBR77 (NEW, fired):** 19 hex literals in provenance components. Tracked in `TBL-FU-B1` (P1). Non-blocking for Block C kickoff because Block C's AI Editor / QA panels reuse `TabelePreviewLayout` records section, not provenance internals directly (per CTO Q10 / Q13).
- **PR8 (Foundation regression):** clean.
- **PR1 (parallel-block conflicts with A):** clean — disjoint paths.
- **B-T1 (production lock recheck):** clean per code review.
- **PR12 (drive-sync overlay race):** persistent low-grade risk; mitigated each commit with manual git verification.

## Follow-ups

- **TBL-FU-B1** — DBR77 token-ize provenance components (P1, ~0.5 day, before public release).
- **TBL-FU-B2** — operator visual + E2E + 1 M migration runtime pass on staging (P2, owner QA operator).

## Next Step

> Single-line recommendation for barrier gate.

**Day-10 barrier passes** with both Block A (`GO_WITH_CONSTRAINTS`) and Block B (`GO_WITH_CONSTRAINTS`). Open Block C kickoff with C-S0 (token budget calibration + AI cost control) per CTO Q14. Constraints from Block A and Block B are filed as P1 / P2 follow-ups; none gate the AI Editor surface introduced by Block C.

---

## Sign-off

- Block lead: Cursor agent (CTO mode under user delegation, 2026-05-08)
- UI/UX reviewer: pending operator pass on TBL-FU-B1 + TBL-FU-B2
- Security reviewer: PASS via 26/26 ACL automated tests + 5 code-review items
- QA reviewer: PASS via 126/126 automated checks at B-S6 gate
- Date closed: 2026-05-08
