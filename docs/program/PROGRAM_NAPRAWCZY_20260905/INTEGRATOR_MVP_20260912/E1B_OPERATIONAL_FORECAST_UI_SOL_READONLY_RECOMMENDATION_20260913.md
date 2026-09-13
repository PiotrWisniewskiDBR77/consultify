# E1b operational forecast UI and native same-ID path — Sol read-only recommendation

Date: 2026-09-13  
Review source: `E1B_OPERATIONAL_FORECAST_UI_NEXT_PACKET.md`, Initiative/Execution implementation canon, and current source at canonical forecast commit `53a8eae7677738252d85fedbb3d999d6b912a100`.

## Decision from binding SSOT

No new owner decision is required to choose the persistence direction.

- `05_DOMAIN_DATA_API_EVENTS.md` §1 assigns delivery forecast to **Execution** and defines the golden thread as relations/projections rather than record duplication.
- §2.1–2.2 requires one stable `initiativeId` through Initiatives and Execution; an Execution Plan/Case may have its own ID but must preserve Initiative correlation.
- §3.2 explicitly includes forecast start/end in the Execution write model.
- §5.3 requires successful commands to read back from an authoritative query, with list and workspace as projections of the same versioned record.
- `06_RUNTIME_MIGRATION_REUSE_AND_TESTS.md` Phase 2 requires one tenant-scoped Initiative query/cache for list, preview, workspace and Execution projection and prohibits dual lifecycle writes.
- `INITIATIVES_EXECUTION_FUNCTIONS_CANON.md` §10.2/§10.5 requires accepted/read-back handoff, an idempotent Execution Case and the same Initiative identity. It does not require a physical row in the compatibility `initiatives` table.

Therefore a Runtime-v1 Initiative may canonically persist forecast in its existing `ie_aggregate_state` payload and material-command receipt/audit/outbox. A compatibility projection into the module table may remain for existing rows, but absence of that row cannot be a permanent product-level prerequisite for the native path. No second Initiative record or identity may be created.

The binding canon defines field authority and the required `source/asOf/completeness/staleness` envelope; it does not enumerate a table-level allowlist for forecast evidence. Selecting the already atomic `ie_command_receipts` record as the canonical command read-model source is therefore an internal adapter decision supported by the implemented material-command contract, not a new owner decision. `ie_audit_events` can corroborate the command but is not needed as a second competing value source.

## Existing sanctioned paths

### Supported module-backed path today

1. `server/src/services/initiative/createInitiativeService.ts` is the single creation funnel and writes the module `initiatives` row.
2. `src/components/Initiatives/PlanScenarioSurface.tsx` invokes `registerInitiativeForPlanning` before adding/generating a plan window.
3. `server/src/domain/initiatives-execution/registerModuleInitiativeForPlanning.ts` is the explicit DEC-421/P15-K2 bridge from that module Initiative to `ie_aggregate_state`, using the exact same Initiative ID and preserving existing canonical payload.
4. Handoff creates/links the governed Execution Case under the same Initiative correlation.
5. `src/components/Execution/ExecutionHub.tsx` loads `/api/initiatives?includeExecutionEvidence=true`, overlays Runtime-v1 Execution Cases and builds Bank rows with the original Initiative ID.

This is the currently proven operational path. It does not create a second Initiative ID.

### Existing canonical-only read projection

`server/src/domain/initiatives-execution/initiativeUnifiedReader.ts` already merges `ie_aggregate_state` and module `initiatives` by exact ID. `listInitiativeHeaders` returns canonical-only headers, deduplicates collisions by ID and is consumed by `InitiativeController.getInitiatives` when the existing `ENABLE_INITIATIVE_UNIFIED_READ` cohort flag is enabled.

This is a legitimate read-model seam, not a writer or adoption mechanism. No new flag or default change is needed for the implementation recommendation.

### Existing forecast writer

The accepted Runtime-v1 command stores forecast in the canonical Initiative payload and, for module-backed records, atomically updates the same-ID `initiatives` forecast columns and writes `initiative_history`. This is a field-scoped compatibility projection. It is not a general canonical-to-module Initiative writer and must not be reused to manufacture rows.

## Concrete native-path gap

The current canonical-only read path loses usable forecast truth:

1. `InitiativeController.getInitiatives` appends only the shallow canonical header and explicitly assigns `forecastStartDate: null`, `forecastEndDate: null`, and an empty-receipt UNKNOWN evidence projection.
2. `readExecutionBankInitiativeEvidence` starts from `SELECT ... FROM initiatives`; when the requested Initiative exists only in `ie_aggregate_state`, it returns `{}` before querying history.
3. The forecast command currently requires `writeInitiativeForecastProjection` to find a module row. Capability disclosure therefore returns `INITIATIVE_FORECAST_PROJECTION_NOT_FOUND` for a canonical-only Initiative even though the canonical aggregate and material command stores can own the forecast under SSOT.

The header merge proves visibility and stable identity, but does not yet constitute an authoritative Execution Bank projection.

## Recommended next implementation

Deliver two ordered slices. The first closes the data contract; the second mounts the already accepted command.

### Slice A — canonical forecast projection into Execution Bank

1. Extend `server/src/services/initiative/executionBankEvidenceReadService.ts` to read requested canonical Initiative states from `ie_aggregate_state` as well as module rows. Keep tenant and requested-ID scoping in every query.
2. For canonical forecast evidence, read durable `ie_command_receipts` for `command_type='initiative.forecast.update'`, keyed by organization, aggregate type and exact Initiative ID. The stored `response_json` is the command response itself, so read `response_json.after` rather than a nonexistent `response_json.response.after`. Use `aggregate_version`, `client_request_id`, and the receipt's database `created_at` as the durable receipt identity/version/observation instant. Do not infer observation time from unrelated aggregate/task updates or trust a client timestamp. If the HTTP response retains its current `observedAt`, the canonical-only command path must populate it from a database instant inside the same transaction; the Bank read model remains anchored to persisted `ie_command_receipts.created_at`.
3. Merge sources by exact ID. Prefer canonical forecast plus its matching canonical receipt when present. Preserve module evidence for compatibility records and return conflicts as `UNKNOWN/SOURCE_CONFLICT`; never choose an older receipt merely because its value matches.
4. Replace the canonical-only `null/UNKNOWN` placeholder in `InitiativeController.getInitiatives` with this projection. Keep progress, baseline, actual and other fields UNKNOWN unless their own authoritative source exists.
5. Make the module projection optional inside the forecast command transaction: update it only when the same-ID row exists; do not insert/adopt a module Initiative. Always persist the canonical payload and material command receipt/audit/outbox. A canonical-only receipt uses `client_request_id` as record identity and `created_at` as its persisted database observation instant. Preserve the currently proven atomic module-backed path unchanged, including its `initiative_history` receipt; declare deterministic precedence by field and version so both receipts do not become competing truths.
6. Once Slice A has real read-back proof, remove the module-row prerequisite from `forecast.available`; retain authorization and SCHEDULED/IN_EXECUTION lifecycle checks.

No schema, new authority, baseline change, second Initiative ID or flag-default change is required.

Primary source allowlist:

- `server/src/services/initiative/executionBankEvidenceReadService.ts`
- `server/src/controllers/InitiativeController.ts`
- `server/src/domain/initiatives-execution/initiativeForecast.ts`
- `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts`
- `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` only for capability alignment

### Slice B — operational editor in the existing Initiative card

1. Add one `OperationalForecastEditor` inline in the existing Timeline card. Mount it from the `timeline` case in `InitiativeDocumentView`; do not create a drawer, Execution copy or second form.
2. Keep forecast drafts separate from Timeline's `startDate/endDate`. Those values are planned schedule/baseline-adjacent and participate in legacy autosave; reusing them risks a baseline/current-plan write.
3. Read current aggregate version through `readRegisteredInitiative` and availability/denial solely through `readInitiativeCapabilities`. Show baseline and current plan as read-only context.
4. A selected empty forecast field sends explicit `null`; an unselected field is omitted. Require reason.
5. Keep one request ID for retrying the exact same payload. Editing the proposed values/reason invalidates that attempt. After a version conflict, refresh the canonical reference/version while preserving the user's draft; the next submission uses a new request ID because `expectedVersion` changed and is part of the command fingerprint.
6. On success, use response `after` and `aggregateVersion`, refresh the same card and call the existing global Initiative refresh bump so Execution Bank reloads the same ID and evidence. Do not claim success until the read model returns the receipt/value.

Primary frontend allowlist:

- new `src/components/Initiatives/sections/OperationalForecastEditor.tsx`
- `src/components/Initiatives/InitiativeDocumentView.tsx`
- `src/services/initiatives-execution/runtimeApi.ts` for explicit forecast fields on the registered read type
- `server/src/services/v8/planningPortfolioReadService.ts` only to expose existing module forecast columns with explicit camel-case aliases for the legacy-rich card read

`ExecutionHub.tsx`, Bank renderers and the accepted forecast route do not need a UI-specific copy or alternate writer.

## Required RED and acceptance packet

### Slice A behavioral RED

A SCHEDULED canonical aggregate with forecast values and a canonical forecast command receipt, but no `initiatives` row:

- appears exactly once in `GET /api/initiatives?includeExecutionEvidence=true` under the existing unified-read cohort;
- retains the exact Initiative ID and canonical lifecycle;
- returns known forecast value, receipt/source, `observedAt`, `asOf`, completeness and staleness;
- does not invent progress, baseline or actual;
- can execute the canonical forecast command without inserting an `initiatives` row;
- survives reload and remains tenant-invisible to another organization.

Add collision coverage: when both stores contain the same ID, the list contains one row; canonical forecast receipt/value wins only according to the declared field authority, and contradictory evidence becomes explicit rather than silently overwritten.

### Slice B mounted behavior

- available SCHEDULED/IN_EXECUTION editor in the real Timeline card;
- explicit clear versus omitted field;
- baseline/current plan stay unchanged;
- capability, lifecycle and tenant denials are visible;
- version conflict preserves the proposed values until explicit reference refresh;
- retry of an unchanged submission is idempotent;
- changed draft/new version uses a new request ID;
- success reloads the same Initiative ID and displays the exact receipt-backed forecast in Execution Bank.

Final runtime proof must start from the supported Initiative creation funnel, pass through planning registration and governed handoff, use the visible editor through signed JWT/actual Gateway/PostgreSQL, then reload card and Bank. A separate canonical-only fixture proves Slice A without seeding a compatibility module row. Cleanup and foreign-tenant readback remain mandatory.

## Disposition

**READY FOR TWO BOUNDED IMPLEMENTATION SLICES.** The module-backed UI can proceed against the accepted writer. Full native same-ID acceptance remains OPEN until Slice A stops replacing canonical forecast truth with `null/UNKNOWN` and removes the physical module-row prerequisite without creating a duplicate Initiative.
