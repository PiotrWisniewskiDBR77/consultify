# EPIC-T13 — Table → Document / Presentation Flow

**Block:** D
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, sections 4.3, 5K, 14.
**Owner agent:** A (backend) + B (frontend)

---

## Goal

From any Tabele table, the user can convert the current view + selected source pack into a Wordy document or a Prezentacje deck. The conversion produces a real artifact (V8 snapshot in target format) reflecting confidence, sources, and AI-derived fields.

## Acceptance criteria

- New service `TableArtifactConversionService` with `convertToWordy(tableId, viewId?, sourcePackId?, options)` and `convertToPrezentacje(...)`.
- Output artifact is a full Wordy/Prezentacje doc, not a stub.
- V8 snapshot includes per-record `confidence_score`, `validation_status`, top sources.
- Wordy output renders a "Sources" appendix section listing record sources.
- Prezentacje output renders a "Methodology" slide listing template + governance rules.
- ACL filter: records actor cannot read are excluded.
- Async job: long conversions don't block UI; toast shows progress; opens result lane on completion.
- "Convert to Document" / "Convert to Presentation" buttons live in `KimiWorkspaceShell` Menu 3 right-slot.

## In scope

### Backend
- `TableArtifactConversionService.ts`.
- Route `POST /tables/:id/convert?target=wordy|prezentacje`.
- Reuse `WordyArtifactService` and `PrezentacjeArtifactService` to instantiate the result.
- Tests including ACL + cross-tenant + V8 contract.

### Frontend
- `TabeleConvertButton.tsx` (single button rendering 2 dropdown options).
- `ConversionToast.tsx`.
- Wiring into `KimiWorkspaceShell` Menu 3 right-slot.

## Out of scope

- Excele conversion (Tabele→Excele is rare; out of program).
- Presentation theme picker (out of program; uses default).

## Dependencies

- Block C `SourcePackService` (V8 snapshot of source records).
- Block C QA Engine (optional appendix).
- Block B `confidence_score`, `validation_status`.
- Block A template metadata.

## Estimated effort

- S1 (1 day): backend service + V8 contract + tests.
- S3 (0.5 day): frontend button + toast + wiring.
