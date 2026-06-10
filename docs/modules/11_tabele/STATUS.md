---
module_id: MODULE_TABLES
doc_kind: STATUS
version: 2.0
owner: user
status: canonical
last_updated: 2026-06-03
---

# Status — Tabele (Table Studio)

## Shipping Status (As-Is)

- Runtime class: `mounted + GA-backend`
- `/tabele` mounts the real `TabeleView` (AI-generation lane via
  `KimiWorkspaceShell`). `/excele` permanently redirects to `/tabele`
  (`AppRoutes.tsx`, `reason="excele_merged_into_table_studio"`). There is no
  `V4ComingSoonView` placeholder on either route anymore.
- The My Work table builder (`/my-work/...` table surfaces) and the `/tabele`
  lane share the same backend (`tp_bases` / `tp_tables` / `tp_records`) via
  `/api/table-platform`.
- Records API: `ENABLE_TABLE_PLATFORM_RECORDS_API` now defaults **ON**
  (`server/src/config/FeatureFlags.ts`). The route layer still performs a live
  `tp_*` schema readiness check (503 `SCHEMA_NOT_READY` until migrations run).
  Set the env var to `false` to hard-disable authenticated table endpoints.
- Migration guarantee: the date/700-prefixed migration runner executes at boot
  (`server/src/index.ts`, deferred 5s, default ON unless
  `DISABLE_TP_MIGRATIONS=true`) so the `tp_*` schema is present before traffic.

## AI Editor (Block C) — apply path is LIVE

- `TableAiEditorService.applyProposal` now replays the proposal's persisted
  `operations` array through the new `MutationExecutor`
  (`server/src/services/tablePlatform/TableAiEditorLevels/MutationExecutor.ts`),
  performing REAL `tp_records` / `tp_fields` / `tp_views` mutations. The
  previous `{applied:true, reason:'stub_handler_no_op'}` no-op is removed.
- Levels 1–6 (cell / record / column / structure / view / relational) mutate.
- Levels 7–8 (methodological / source) are read-only by design and apply as
  `skipped: read_only`.
- Failure semantics: a failed/invalid operation leaves the proposal `pending`
  (retryable); audit records the per-operation outcome with `handlerStatus:'live'`.

## Artifact Conversion (Block D) — materializer is LIVE

- `TableArtifactConversionService` default materializer is now the real
  `conversionMaterializer` (`registerArtifactOrigin` → canonical
  `v8_output_artifacts` row) returning the canonical `artifactId` as
  `artifactRunId` and a deep link (`/reports/builder/{id}` for documents,
  `/presentations/{id}` for decks). The `stub-run-*` / null-deep-link stub is
  removed.
- The conversion ROUTE stays env-gated (`ENABLE_TABLE_ARTIFACT_CONVERSION`,
  default off) until the lane UI surface ships; the backend bridge is real when
  enabled.

## UI shell decision (MELS)

- `/tabele` keeps `KimiWorkspaceShell` as the default. The
  `ExecutiveModuleShell` adapter (`TabeleMelsView`, `ff_melsTabele`) remains
  flag-gated OFF because its right-rail AI panels (AI Editor 8 levels, QA,
  Source Pack) are still presentational placeholders (deferred to EPIC-T16-S4).
  Flip `melsTabeleFlag` default once those panels are wired.

## Current Risks

- Conversion lane has no first-class UI yet (API-only behind its flag).
- MELS shell visual review (EPIC-T16-S4) outstanding before it can be default.

## Function Coverage Status

- Required functions documented: `2/2`.
- Covered: `TB_TABLE_RUNTIME` (mounted `TabeleView` on `/tabele`),
  `TB_EXCELE_REDIRECT` (`/excele` → `/tabele`).
