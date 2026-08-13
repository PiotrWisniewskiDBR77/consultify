# KPI-E001 + KPI-E002 — Approved Design

> Status: APPROVED FOR IMPLEMENTATION (Integration Owner review 2026-08-09).
> Draft: agent `a2f31db3dd772a6e2`. Scope: `rvn_kpi_definitions` (root),
> `rvn_kpi_definition_versions` (versioned contract), `rvn_kpi_measurements`
> (append-only). KPI-E003 (Deviation)/E004 (Scorecards) are separate future
> packages — `deviation_case` is already reserved in `RVN_RESOURCE_TYPES`.

## Decisions on the 12 open questions

| # | Question | Decision |
|---|---|---|
| 1 | Event naming: `kpi.definition.approved` vs `kpi.definition_approved` | **Underscore form** (`kpi.definition_approved`), matching plan §8. Fix the existing dotted placeholder in `atomicWrite.ts`. |
| 2 | No `executeAtomicCreate` sibling exists in platform | **Approved** — add it to `platform/atomicWrite.ts` exactly as drafted (§A.6). This is platform-owned, not KPI-owned; ROI/OKR will need the same primitive. |
| 3 | `EXCLUDE USING gist` partial (`WHERE approval_status='approved'`) | **Approved as designed.** Full (non-partial) exclude would make normal draft→reject→redraft cycles impossible to create. Overlap only matters between governed truths. |
| 4 | Row-level immutability trigger (new pattern vs RN-G1's whole-table REVOKE) | **Approved**, explicitly accepted as a new, second immutability pattern in this program (partial-mutability via trigger, for rows where exactly one field — `effective_to` — must stay writable after approval to close a period). Precedent for ROI's Approved snapshot / OKR's Approved snapshot, which will likely need the same shape. |
| 5 | `primary_process_id` — no FK, no process registry check | **Approved**, deferred. Flag for verification before Slice K1 UI (process picker) is built — not urgent now. |
| 6 | `response_policy_id` — no FK yet (KPI-E003 not in scope) | **Approved**, column exists, FK added when KPI-E003 lands. |
| 7 | Boundary Rule: threshold value belongs to the safer/nearer-target zone (crossing requires strict inequality) | **Approved as the default.** Matches common "meet or exceed target = safe" convention. Reversible later (constant flip of `>=`/`>`) if product feedback disagrees — not a schema-level commitment. |
| 8 | Event catalog gaps in plan §8 (`kpi.definition_rejected`, `kpi.suspended`, `kpi.archived` missing despite commands existing in §7.1) | **Approved as documentation gap, not intentional omission.** Filled per the general platform rule "every state-changing transaction appends an event." |
| 9 | `custom` geometry always returns `neutral`, expression never evaluated | **Approved.** Matches plan's explicit non-goal ("no arbitrary code execution in custom formulas"). A restricted expression engine is out of scope for this package — track as a distinct future package, not silently expanded into this one. |
| 10 | `exact` geometry without `critical_low`/`critical_high`: outside tolerance → `critical` directly (no `warning` zone) | **Approved as designed** — binary pass/fail character is appropriate for an "exact" target without an organization-defined warning band. Documented interpretation, reversible. |
| 11 | No "active visibility policy for domain" lookup helper exists in platform | **Platform-owned, build now as part of this package** (small addition, tightly coupled to what KPI needs immediately) — add `getActiveVisibilityPolicy(client, {organizationId, domain}): Promise<{policyId, policyVersion} \| null>` to `platform/visibilityResolver.ts` (co-located with the other visibility primitives, not a new file). Returns `null` if no active policy exists for the domain — caller (`createKpiDraft`) must fail closed (typed error), never assume a default. |
| 12 | Measurement commands: route through parent KPI's CAS (`row_version`) or standalone? | **Standalone — use `executeAtomicCreate`, NOT `executeAtomicCommand` with parent CAS.** The `ux_rvn_kpi_measurements_period` unique index (`kpi_id, period_start, period_end WHERE correction_of_measurement_id IS NULL`) already provides the concurrency guarantee needed (first writer for a given period wins; a genuine duplicate submission fails on the constraint, which is the correct idempotency behavior). Routing every measurement write through the parent's `row_version` CAS would serialize all measurement writes for a KPI — unnecessary contention for what may be a high-frequency write path (imports, connectors). Corrections (`correction_of_measurement_id IS NOT NULL`) are unconstrained by that index by design (multiple corrections over time are expected) and also don't need parent CAS — they reference a specific prior measurement, not the KPI aggregate version. |

## Frozen schema (from draft, unchanged unless noted above)

Full DDL, trigger, and command-layer code exactly as returned by agent
`a2f31db3dd772a6e2` (see conversation/ledger for complete text) — sections
A.2–A.7, B, C, D of that draft are ratified as-is except where a decision
above overrides them (decision #1 renames the event; decision #12 changes
measurement commands from `executeAtomicCommand` to `executeAtomicCreate`).

Key points implementers must not deviate from without a new ledger entry:

- Three tables: `rvn_kpi_definitions`, `rvn_kpi_definition_versions`,
  `rvn_kpi_measurements`, one migration file `<8-digit-date>_rvn_kpi_core.sql`.
- `performance_status` and `data_quality_status` are ALWAYS two independent
  columns on `rvn_kpi_measurements` — never collapsed into one field.
- Only `rvn_kpi_definitions` gets a row in `rvn_platform_resource_visibility`
  (`resource_type='kpi'`) — versions/measurements inherit visibility via `kpi_id`,
  no separate resource_type per child table.
- `approveDefinitionVersion` enforces self-approval denial (`submitted_by` OR
  `created_by` == approver → `SelfApprovalDeniedError`) server-side, inside
  `applyMutation`, before any write — not delegated to UI or a later check.
- `evaluatePerformanceStatus` is a pure function, zero I/O, exhaustively unit
  tested against the boundary-case table in the draft §C.
- Measurements are append-only: `REVOKE UPDATE, DELETE ... FROM PUBLIC`
  (same limitation as `rvn_platform_events` — does not stop owner/superuser
  connections, documented identically).
- Approved `rvn_kpi_definition_versions` rows are immutable except
  `effective_to`, enforced by `trg_rvn_kpi_definition_versions_protect_approved`
  (DB trigger, not application convention).

## Files to create (per draft §D, decisions applied)

| File | Notes |
|---|---|
| `server/migrations/<date>_rvn_kpi_core.sql` | 3 tables, partial EXCLUDE, trigger, REVOKE, indexes |
| `server/src/services/resultsVnext/platform/atomicWrite.ts` (EDIT) | Add `executeAtomicCreate<TResult>`, fix event name typo, full KPI `EVENT_TYPE_CONSUMER_GROUPS` entries |
| `server/src/services/resultsVnext/platform/visibilityResolver.ts` (EDIT) | Add `getActiveVisibilityPolicy` (decision #11) |
| `server/src/services/resultsVnext/kpi/kpiTypes.ts` | Row + DTO interfaces |
| `server/src/services/resultsVnext/kpi/targetGeometryEvaluator.ts` | Pure function, §C |
| `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts` | `createKpiDraft`, `editDraft`, `submitDefinition`, `approveDefinitionVersion`, `rejectDefinitionVersion`, `activateKpi`, `suspendKpi`, `archiveKpi` |
| `server/src/services/resultsVnext/kpi/kpiMeasurementCommands.ts` | `recordMeasurement`, `correctMeasurement`, `verifyMeasurement`, `disputeMeasurement` — all via `executeAtomicCreate` per decision #12 |
| `server/src/services/resultsVnext/kpi/kpiRepository.ts` | `listKpis`/`getKpi`/`listMeasurements` via `buildVisibilityScopedCte`/`wrapWithVisibilityScope` only |
| `server/src/services/resultsVnext/kpi/README.md` | Status note, same convention as `platform/README.md` |
| `tests/resultsVnext/kpi/targetGeometryEvaluator.test.ts` | Full boundary matrix, `git add -f` (new `tests/` subdir) |
| `tests/resultsVnext/kpi/approveDefinitionVersion.test.ts` | Self-approval denial, STALE_VERSION, idempotent retry |
| `tests/resultsVnext/kpi/migration.realdb.test.ts` | Ephemeral Postgres per RN-G1 §11 pattern — empty DB, idempotency, EXCLUDE rejects overlap, trigger blocks UPDATE on approved row |

Routes (`/api/vnext/results/kpi/*`) explicitly NOT in this package — next one.
