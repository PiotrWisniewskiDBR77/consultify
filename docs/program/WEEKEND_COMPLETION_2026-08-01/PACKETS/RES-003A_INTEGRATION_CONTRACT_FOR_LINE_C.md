---
doc_id: RES-003A-integration-contract-line-c
truth_type: proposed-contract
status: AWAITING_LINE_C_REVIEW
owner: claude
product_owner: piotr
priority: P1
last_reviewed: 2026-08-01
---

# RES-003A — Integration contract for Line C (Initiatives/Execution)

## 0. Why this document exists

Read-only discovery (this session, and independently the RES-002 discovery
packet, `PACKETS/RES-002_DISCOVERY_GATE_2026-08-01.md` §3) both confirm the
same cross-domain break: `server/src/services/initiative/
initiativeKpiAssignmentService.ts`, function `updateInitiativeKpiAssignment`,
writes `initiative_kpis.current_value` directly:

- `pushKpiUpdate('current_value', params.currentValue != null ?
  safeNumber(params.currentValue) : undefined)` — line 747-750
- `await queryHelpers.queryRun(\`UPDATE initiative_kpis SET
  ${updates.join(', ')} WHERE id = ?\`, updateParams)` — line 796-799

This path **never inserts into `kpi_time_series` and never calls
`handleTimeSeriesRecorded`**. The deviation/recovery engine
(`server/src/services/results/kpiDeviationService.ts`) is only invoked from
three places today, none of which is this file:

- `server/src/routes/benefits.routes.ts:540`
- `server/src/routes/v8/results.routes.ts:1695`
- `server/src/services/resultsEnterpriseService.ts:220`

**Effect**: when Execution/PMO updates an initiative-linked KPI's
`current_value`, no Deviation Case is created and — after RES-003A ships — no
Recovery Card is created either, even if the new value crosses the RED
threshold. This document is the contract for the future writer that closes
that gap. Per the mandate boundary already recorded in the RES-002 discovery
packet (§8), `server/src/services/initiative/
initiativeKpiAssignmentService.ts` is **owned by Execution/Initiatives, not
Results** — this is a contract proposal for Line C to implement, not a patch
Results applies unilaterally. Results does **not** edit this file, `InitiativeController.ts`,
initiative governance, or the execution transition engine in this round.

## 1. What to call, and from where

**Do not** call the RES-003A Recovery Card functions
(`ensureRecoveryCardForCase`, `closeRecoveryCard`, …) directly from Line C.
Call the existing, already-integration-tested entry point instead:

```ts
import { handleTimeSeriesRecorded } from '../results/kpiDeviationService.js';
```

`handleTimeSeriesRecorded` already owns deviation-case creation/update *and*,
after RES-003A ships, Recovery Card creation/reopen — internally, with no
extra call needed from Line C. Line C's only job is to feed it a real
measurement, the same way the three existing callers do.

**Recommended shape**, mirroring the canonical pattern at
`server/src/services/resultsEnterpriseService.ts:163-235` (insert the
measurement row, then call the engine in a non-fatal `try/catch`):

```ts
// Inside updateInitiativeKpiAssignment, immediately after the existing
// `UPDATE initiative_kpis SET ... WHERE id = ?` at line 796-799 succeeds,
// and only when params.currentValue was actually provided (i.e. this call
// represents a new measurement, not just an unrelated field edit like
// renaming the KPI):
if (params.currentValue != null) {
  const measurementId = uuidv4();
  const periodStart = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  await queryHelpers.queryRun(
    `INSERT INTO kpi_time_series
       (id, kpi_id, organization_id, value, period_start, period_end, source, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      measurementId,
      params.kpiId,
      params.organizationId,
      safeNumber(params.currentValue),
      periodStart,
      null,
      'execution',             // distinct source label from 'manual' | 'connector-ingest' etc.
      null,
      params.userId || null,
    ]
  );

  try {
    await handleTimeSeriesRecorded({
      db: {
        get: (sql, sqlParams) => queryHelpers.queryOne(sql, sqlParams),
        all: (sql, sqlParams) => queryHelpers.queryAll(sql, sqlParams),
        run: (sql, sqlParams) => queryHelpers.queryRun(sql, sqlParams),
      } as any,
      orgId: params.organizationId,
      kpiId: params.kpiId,
      value: Number(params.currentValue),
      periodStart,
      periodEnd: null,
      recordedByUserId: params.userId || null,
    });
  } catch {
    // Keep the KPI update durable even if deviation/recovery side effects
    // fail — identical non-fatal contract to resultsEnterpriseService.ts:233-235.
  }
}
```

This is a **contract proposal**, not a mandate to insert this exact diff —
Line C decides the precise trigger condition (e.g. whether every
`current_value` write should count as a "measurement", or only ones coming
from a specific UI action) and whether a `period_start` of "today" is the
right period semantics for Execution-sourced values (Results' three existing
callers all pass an explicit, often backdated, `periodStart`; Execution's
`current_value` field has no period concept today).

## 2. Required identifiers

| Field | Source in `updateInitiativeKpiAssignment` | Notes |
|---|---|---|
| `orgId` | `params.organizationId` | Already asserted via `assertInitiativeBelongsToOrg`/`assertKpiBelongsToOrg` (lines 723-724) before this point — no additional tenant check needed. |
| `kpiId` | `params.kpiId` | Already asserted to belong to `orgId` at line 724. |
| `value` | `params.currentValue` | Only call when non-null (see guard above); a `null`/unset update is a metadata edit, not a measurement. |
| `periodStart` | Derived, `YYYY-MM-DD` of "now" | Execution has no explicit period selector; document this as an open question for Line C rather than a Results decision. |
| `recordedByUserId` | `params.userId` | Already threaded through `UpsertInitiativeKpiAssignmentInput.userId?: string \| null`. |

## 3. Idempotency

`kpi_time_series` has **no idempotency key today** (confirmed independently:
"brak idempotency — duplikuje się przy retry" for the existing `POST
/kpis/:id/time-series` route). RES-003A does not add one to `kpi_time_series`
itself — that is a pre-existing gap across all four callers, out of this
migration's scope.

What RES-003A *does* make idempotent is everything downstream of a
measurement: `ensureRecoveryCardForCase` is safe to call twice for the same
case (`ON CONFLICT (deviation_case_id) DO NOTHING`), and `ensureRecoveryAction`
/ `linkRecoveryActionTask` are safe to retry given a stable `idempotencyKey`.
If Line C's writer is itself retry-prone (e.g. behind a flaky network path or
a client that resubmits on timeout), the fix belongs at the `kpi_time_series`
INSERT — e.g. a `(kpi_id, organization_id, period_start, source)` partial
unique index — which is a separate, small migration Line C or Results can
propose later; it is not part of the RES-003A Recovery Card schema.

## 4. Actor / system actor

Use `params.userId` when present (a human edited the KPI through the
Initiatives/Execution UI). When the writer is itself automated (e.g. a future
PMO sync job), pass an explicit system actor string, matching the existing
convention already used one layer down: `kpi_deviation_cases.detected_by
DEFAULT 'system'` (baseline schema). Do not leave `recordedByUserId`
undefined for automated writes — `handleTimeSeriesRecorded` falls back to the
KPI's own `owner_user_id` when it is null, which would misattribute an
automated write to a human owner in the deviation case's audit trail.

## 5. Tenant / project scope

No change needed — `assertInitiativeBelongsToOrg` (line 204-212) and
`assertKpiBelongsToOrg` (line 214-231) already run before
`updateInitiativeKpiAssignment` reaches the `UPDATE initiative_kpis` at line
796-799, and `handleTimeSeriesRecorded` independently re-derives and checks
`organization_id` via its own `getKpiDefinition` query
(`kpiDeviationService.ts:98-134`, `WHERE k.id = ? AND
COALESCE(k.organization_id, i.organization_id) = ?`). Two independent
org-scope checks on the same write is intentional defense-in-depth, matching
the SEC-3 pattern already used in `v8/results.routes.ts`.

## 6. Responses / errors

`handleTimeSeriesRecorded` never throws for a "no deviation" case — it
returns `{ eval: { status: 'GREEN' | 'NO_DATA', ... } }` and does nothing
further. It can throw only on a genuine DB error, which is why the
recommended call site wraps it in a non-fatal `try/catch` — Line C's KPI
`current_value` write must remain durable even if the entire deviation/
recovery subsystem is unavailable. Do not surface `handleTimeSeriesRecorded`
failures to the end user as a failure of the KPI update itself.

## 7. Audit

`kpi_recovery_cards.created_by` / `updated_by` / `closed_by` and
`kpi_recovery_actions.created_by` capture the actor. `kpi_deviation_cases`
already has `detected_at/by`, `acknowledged_at`, `resolved_at`, `closed_at`,
`closed_by` (baseline schema) — RES-003A adds no new columns there. No
separate audit-log table is proposed for Recovery Card mutations in this
packet; `version` + timestamped columns are the audit trail, consistent with
how `kpi_deviation_cases` itself is audited today (no separate history table
either).

## 8. Retry / recovery

If Line C's writer crashes between the `kpi_time_series` INSERT and the
`handleTimeSeriesRecorded` call, the measurement is durably recorded but no
deviation/recovery side effect ran. This is an accepted, pre-existing
characteristic of every current caller (identical failure window exists in
`resultsEnterpriseService.ts:163-235` today) — RES-003A does not change this
risk profile. A future reconciliation job (e.g. "scan `kpi_time_series` rows
newer than the latest `kpi_deviation_cases.detected_at` for their KPI and
replay `handleTimeSeriesRecorded`") is a reasonable follow-up but is out of
scope for this packet.

## 9. Non-goals of this contract

- This document does **not** authorize editing
  `initiativeKpiAssignmentService.ts` — RES-002 discovery packet §8 lists it
  as **not** in the Results line's allowed area. Line C implements this
  contract in their own line/branch.
- This document does **not** change the `POST /workflow/kpi/:id/next-action`
  route in `server/src/routes/v8/results.routes.ts` — that is Results-owned
  and is a separate follow-up build step once the RES-003A migration lands
  (see the adapter contract's `ensureRecoveryAction` /
  `linkRecoveryActionTask` functions, designed specifically to replace the
  broken `UPDATE kpi_deviation_actions SET execution_follow_up_ref = ?` at
  lines 2608-2611 of that file).
- Physical wiring (Line C actually calling this) does not happen in this
  round per Codex/Piotr decision 2026-08-01 point 6.6 — this document is the
  gate for a future controlled B/C integration window, not an immediate
  merge target.
