# ROI-E007 — Finance/KPI Seams — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Seventh epic of the ROI domain, builds on ROI-E001-E006, all landed. Backend
only. **Integration-seam epic, not new domain content** — deliberately
smaller than E001-E006. What NOT to build is as important here as what to
build.

---

## 0. Epic boundary (quoted verbatim, not paraphrased)

`EPIC_LEDGER_LIVE.md` (5 ACs):

> "ROI-E007 Finance/KPI Seams (5 AC: pełna pinned koperta, zero nadpisania w
> obu kierunkach, reconciliation record zamiast silent sync, typed KPI
> evidence zamiast luźnego FK, freshness/supersession event nie propaguje
> wartości automatycznie)"

1. **AC-01** — A full pinned envelope (Finance ↔ ROI reference).
2. **AC-02** — Zero overwrite in either direction.
3. **AC-03** — A reconciliation record instead of silent sync.
4. **AC-04** — Typed KPI evidence instead of a loose FK.
5. **AC-05** — A freshness/supersession event that does not auto-propagate values.

**D06 has real defining text** — found in
`docs/product/results-vnext/03_ROI_IMPLEMENTATION_PLAN.md` §2.2/§2.3/§9.6/§20,
not just a paraphrased name. The operative rule (§2.3, quoted): "a Results
ROI Case may reference a specific Finance artifact and version; a Finance
artifact may reference the ROI Case and the Initiative; values cross the
boundary only through an explicit, versioned mapping or evidence link;
**Results never overwrites Finance values; Finance never overwrites
Approved, Forecast or Actual ROI truth; divergence produces a reconciliation
case, not silent last-write-wins synchronization**." §9.6 gives the literal
target API shape — this design builds to it directly, not to an invented
alternative.

---

## 1. Key findings (accepted from the design draft, independently grounded)

- **`financial_roi_links`** (legacy, live, Finance-owned, `server/migrations-v2/001_baseline_20260413.sql`) has no `roi_case_id`-shaped column — only legacy `initiative_id`/`benefit_id`. It is Finance's own legacy-model linking mechanism, structurally blind to `rvn_roi_cases`. **Not touched by this epic** — the new pinned seam is a separate, new table on the ROI side.
- **`rvn_roi_finance_reconciliations`/`finance_artifact_type/id/version_id`** do not exist in code yet — genuinely new, small schema (2 tables).
- **`finance_projection` consumer group is 100% write-only scaffolding** — zero consumers anywhere in the codebase; `outboxDrain.ts`'s own header explicitly says "DO NOT build this now — documented for the next package that does" for wiring a dispatch cron. This is program-wide, pre-existing, deliberate — not this epic's problem to solve.
- **A generic RBAC/PBAC visibility override already exists** (`buildVisibilityScopedCte`'s `hasRbacOverride` branch) — granting a Finance-facing role a capability like `roi_case.view` gives org-wide read access without inventing a new visibility mode.
- **`rvn_roi_benefit_evidence_links`** (ROI-E002) already fully satisfies the *write* side of AC-04 (typed FKs to `rvn_kpi_definitions`/`rvn_kpi_definition_versions`, not a loose reference). What's missing is a reverse read (KPI→ROI).
- **No automated staleness detection exists today** for evidence links — only the manual `flagBenefitEvidenceLinkDisputed` command sets `dispute_status`. AC-05 itself settles the open question ROI-E002 D14 left implicit: a KPI's live value must never auto-flow into ROI Actual data.

---

## 2. Decisions

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Reconciliation resolution endpoint — build the `PATCH` the draft added beyond §9.6's literal `POST`/`GET`? | **Yes, build it.** `PATCH /cases/:caseId/finance-reconciliations/:reconciliationId`, CAS on the reconciliation's own `row_version`, writable fields: `status`/`resolutionNotes`/`resolvedBy`/`resolvedAt`. Mirrors `updateVarianceStatus`'s exact "CAS on the child, not the parent case" shape from ROI-E004. | A reconciliation record with no resolution path stays open forever — an obvious, cheap, low-risk gap-fill in the spirit of the AC ("reconciliation record instead of silent sync" implies the record has a lifecycle, not just a creation event). |
| D2 | AC-04's reverse KPI→ROI read (`listRoiEvidenceLinksByKpi`) — genuinely new work or already done by E002? | **Build it**, small and additive. | Cheap, low-risk, and a plausible direct reading of "typed KPI evidence" as the seam KPI-side consumers would need. Even if this AC is really just E002's write-side work being attributed to E007's closing epic, building the missing reverse-read direction costs little and closes a real gap either way. |
| D3 | Build a composed `GET .../finance-envelope` rollup endpoint? | **No.** | §9.6 doesn't list one; the AC list doesn't ask for it; the existing per-case reads (approval snapshot, benefits-realization view, PIR) already cover "frozen, trustworthy ROI figure" once Finance-role visibility is granted via D06's own §2(d)-style RBAC override. Building a bespoke rollup with no confirmed consumer is exactly the scope creep this program has consistently avoided. |
| D4 | Read-through existence validation of `finance_artifact_id`/`type` against Finance's own tables? | **No.** Pure soft/typed reference, zero read-through coupling, at write time or otherwise. | D06's rule is "no direct coupling" as an architectural absolute — even a read-only existence check at write time creates a code dependency on Finance's schema shape that could break silently if Finance's tables change, which is precisely the fragility D06 exists to prevent. A ROI user pinning a nonexistent Finance artifact id is a data-quality risk the reconciliation mechanism (AC-03) is the correct, designed answer to, not a referential-integrity check that reintroduces coupling. |
| D5 | Build a `finance_projection` outbox consumer? | **No.** | Confirmed zero consumers anywhere; `outboxDrain.ts` explicitly instructs against building this now. Building the first generic dispatcher for a system this program doesn't own the other end of is a materially larger, different piece of work than "Finance/KPI seams" and nothing in the AC list or §9.6 asks for it. This epic is **pull-based only** — continue writing `roi.*` events tagged `finance_projection` (already happening since ROI-E003) for whenever Finance's own team builds a consumer; that costs nothing extra. |
| D6 | New visibility mode for Finance-facing reads? | **No.** Reuse case-level inheritance (`resource_type='roi_case'`) plus the existing RBAC/PBAC `hasRbacOverride` branch — grant a Finance role the `roi_case.view` capability. | Both mechanisms already exist and are unused by any real domain caller today; this is the correct reuse, not a new bespoke mode. |
| D7 | Freshness mechanism — lazy read-time computation, or an automated watcher/cron reacting to KPI approval events? | **Lazy, read-time only.** Any read hydrating a benefit line's evidence links additionally computes `isStale = (pinned_kpi_definition_version_id <> current_definition_version_id)` at read time — no new table, no cron, no consumer. A **separate**, explicit, human-triggered command (`flagEvidenceLinkFreshnessCheck`) appends `roi.evidence_link_freshness_flagged` to the event log when a user acknowledges staleness. The event never carries or propagates the KPI's new value. | Matches the exact pattern ROI-E002 D14 already established for visibility redaction (computed fresh at read time, never trusted from anything stored). Directly satisfies AC-05's literal wording: an event exists, but no automated value propagation happens through it. |

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260820_rvn_roi_finance_seam.sql`. Two new
tables, both inherit visibility via `case_id` only — no new `resource_type`
(D6).

```sql
-- ============================================================
-- rvn_roi_finance_links — ROI-side typed, pinned reference INTO a Finance
-- artifact. No FK to any financial_* table (Finance IDs are TEXT, Finance
-- is a separate system D06 declares off-limits for direct coupling — a
-- hard FK here would be exactly the "shared mutable table" collapse D06
-- forbids).
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_finance_links (
  link_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id         TEXT NOT NULL,

  finance_artifact_type   TEXT NOT NULL,
  finance_artifact_id     TEXT NOT NULL,   -- Finance's own id, TEXT, no FK (D4)
  finance_version_id      TEXT NOT NULL,   -- Finance's own version id, TEXT, no FK (D4)
  mapping_version         INT NOT NULL DEFAULT 1,
  source                  TEXT NOT NULL,
  as_of                   TIMESTAMPTZ NOT NULL,
  semantic_unit           TEXT NULL,
  currency                TEXT NULL,
  link_purpose            TEXT NOT NULL,

  linked_by               TEXT NOT NULL,
  linked_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version               INT NOT NULL DEFAULT 1,
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_finance_links_case
  ON rvn_roi_finance_links(organization_id, case_id);

-- ============================================================
-- rvn_roi_finance_reconciliations — AC-03: a record, never a silent sync.
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_finance_reconciliations (
  reconciliation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id         TEXT NOT NULL,
  finance_link_id         UUID NOT NULL REFERENCES rvn_roi_finance_links(link_id),

  roi_value                NUMERIC NOT NULL,
  finance_value             NUMERIC NOT NULL,
  divergence_reason          TEXT NULL,
  status                     TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','investigating','resolved','accepted_divergence')),

  opened_by                   TEXT NOT NULL,
  opened_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by                  TEXT NULL,
  resolved_at                  TIMESTAMPTZ NULL,
  resolution_notes              TEXT NULL,

  row_version                   INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_finance_reconciliations_case
  ON rvn_roi_finance_reconciliations(organization_id, case_id, opened_at DESC);
```

Neither table has a freeze trigger — links are removable (DELETE, per §9.6),
reconciliations have a bounded, small lifecycle (`open`→`resolved`/
`accepted_divergence`) governed purely by CAS, not immutability. Neither is a
"decision record" in the frozen-snapshot sense ApprovalSnapshot/PIR are.

---

## 4. Command layer (`server/src/services/resultsVnext/roi/`)

Before implementing, read the current exact state of `roiCaseCommands.ts`
(`NON_EDITABLE_STATUSES`), the ROI-E004 `updateVarianceStatus`/
`roiVarianceCommands.ts` (direct CAS-on-child template for the reconciliation
PATCH), and `roiEconomicModelRepository.ts`'s existing D14 hydration read
(the exact function to extend with `isStale`, per D7).

**New** `roiFinanceLinkCommands.ts`:
- `createRoiFinanceLink` — `executeAtomicCreate`. No case-status guard beyond
  the standard `NON_EDITABLE_STATUSES` check (a Finance link is metadata
  about the case, not part of the frozen economic model — editable whenever
  the case itself is editable). `INSERT INTO rvn_roi_finance_links`. No
  existence validation against Finance's tables (D4). Event
  `roi.finance_link_created` → `['mywork_projection','finance_projection']`.
- `removeRoiFinanceLink` — plain delete by id, same guard. Event
  `roi.finance_link_removed` → `['mywork_projection','finance_projection']`.

**New** `roiFinanceReconciliationCommands.ts`:
- `openRoiFinanceReconciliation` — `executeAtomicCreate`. Validates
  `financeLinkId` belongs to the case. `INSERT ... status='open'`. Event
  `roi.finance_reconciliation_opened` →
  `['mywork_projection','finance_projection']`.
- `updateRoiFinanceReconciliationStatus` (D1) — `executeAtomicCommand`, CAS
  on the reconciliation's own `row_version`. Writable: `status`/
  `resolutionNotes`; sets `resolvedBy`/`resolvedAt` when transitioning to
  `resolved`/`accepted_divergence`. Event
  `roi.finance_reconciliation_resolved` →
  `['mywork_projection','finance_projection']` (only on those two terminal
  statuses; an `investigating` transition uses a lighter
  `roi.finance_reconciliation_status_updated` → `['mywork_projection']`).

**New** `roiFinanceLinkRepository.ts`: `listRoiFinanceLinks`/
`getRoiFinanceLink`/`listRoiFinanceReconciliations`/
`getRoiFinanceReconciliation` — standard `case_id`→`resource_type='roi_case'`
visibility join, mandatory `::text` cast.

**New** `listRoiEvidenceLinksByKpi(kpiId, organizationId, viewerId)` (D2),
added to `roiEconomicModelRepository.ts` (Changed file) — the reverse KPI→ROI
read. Applies the same D14 two-layer visibility: the ROI case's own
visibility scope for the link row itself, plus KPI's own
`resourceType:'kpi'` scope when hydrating any KPI content in the response.

**Changed** `roiEconomicModelRepository.ts` — the existing D14 hydration read
gains `isStale: boolean` per evidence link (D7), computed via a join to
`rvn_kpi_definitions.current_definition_version_id`, never stored.

**New** `flagEvidenceLinkFreshnessCheck` (D7), added to
`roiBenefitEvidenceLinkCommands.ts` (Changed file, the existing ROI-E002
command file) — `executeAtomicCommand`, sets `freshness_checked_at=now()` on
the evidence link (existing column, first real writer beyond the initial
insert), appends `roi.evidence_link_freshness_flagged` → `['mywork_projection']`.
Never writes any KPI value anywhere.

---

## 5. Visibility (D6)

Confirmed: both new tables inherit visibility via `case_id` only,
`resource_type='roi_case'`, mandatory `::text` cast. Finance-facing org-wide
reads use the existing RBAC/PBAC `hasRbacOverride` mechanism
(`buildVisibilityScopedCte`) — grant a Finance role the `roi_case.view`
capability through the existing `effectiveAccessService`; no new visibility
mode.

---

## 6. API surface (Changed file: `server/src/routes/resultsVnext/roi.routes.ts`)

| Method | Path | Command/Repository |
|---|---|---|
| `GET`/`POST` | `/cases/:caseId/finance-links` | `listRoiFinanceLinks` / `createRoiFinanceLink` |
| `DELETE` | `/cases/:caseId/finance-links/:linkId` | `removeRoiFinanceLink` |
| `GET`/`POST` | `/cases/:caseId/finance-reconciliations` | `listRoiFinanceReconciliations` / `openRoiFinanceReconciliation` |
| `PATCH` | `/cases/:caseId/finance-reconciliations/:reconciliationId` | `updateRoiFinanceReconciliationStatus` (D1) |
| `POST` | `/cases/:caseId/benefit-lines/:benefitLineId/kpi-evidence-links/:linkId/freshness-check` | `flagEvidenceLinkFreshnessCheck` (D7) |

No new dedicated router — all five routes extend `roi.routes.ts`, matching
every prior epic's convention (no `Gateway.ts` change).

New validators: added to `resultsVnextRoi.validators.ts` (Changed) —
`CreateRoiFinanceLinkSchema`, `OpenRoiFinanceReconciliationSchema`,
`UpdateRoiFinanceReconciliationStatusSchema`, `FreshnessCheckSchema` (empty
body, reused idempotency-key convention).

New error classes for `handleRoiRouteError`: `RoiFinanceLinkNotFoundError`
(404), `RoiFinanceReconciliationNotFoundError` (404),
`RoiFinanceReconciliationValidationError` (409).

**Changed** `atomicWrite.ts` — new event types listed in §4, all consumer
groups as specified there.

---

## 7. File list (backend only)

**New:**
- `server/migrations/20260820_rvn_roi_finance_seam.sql`
- `server/src/services/resultsVnext/roi/roiFinanceSeamTypes.ts`
- `server/src/services/resultsVnext/roi/roiFinanceLinkCommands.ts`
- `server/src/services/resultsVnext/roi/roiFinanceLinkRepository.ts`
- `server/src/services/resultsVnext/roi/roiFinanceReconciliationCommands.ts`
- `tests/resultsVnext/roi/roiFinanceLink.realdb.test.ts` — create/list/remove, `::text` cast, no existence validation confirmed (a link to a fabricated Finance id is accepted, per D4).
- `tests/resultsVnext/roi/roiFinanceReconciliation.realdb.test.ts` — open/list/update-status CAS, event fan-out differs by terminal vs. non-terminal status transition (D1).
- `tests/resultsVnext/roi/roiEvidenceLinkFreshness.realdb.test.ts` — `isStale` computed correctly after a KPI definition version changes; `flagEvidenceLinkFreshnessCheck` never writes any KPI value anywhere (grep the command's own source for any `UPDATE rvn_kpi_*` — must be zero).
- `tests/resultsVnext/roi/roiEvidenceLinksByKpi.realdb.test.ts` — reverse read, two-layer visibility (D2).
- `server/src/routes/resultsVnext/__tests__/roiFinanceSeam.routes.test.ts`

**Changed:**
- `server/src/routes/resultsVnext/roi.routes.ts` — 5 new routes.
- `server/src/services/resultsVnext/resultsVnextRoi.validators.ts` — 4 new schemas.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — 6 new event types.
- `server/src/services/resultsVnext/roi/roiEconomicModelRepository.ts` — `isStale` on the D14 hydration read; `listRoiEvidenceLinksByKpi` added.
- `server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts` — `flagEvidenceLinkFreshnessCheck` added.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry, plus explicit backlog notes for: D3 (no composed finance-envelope endpoint, build later only if a real consumer need surfaces), D5 (no `finance_projection` consumer, out of scope — Finance's own team owns that when ready), D2's own honest caveat (the reverse-read might be redundant with what E002 already satisfies — flag for confirmation, not presented as a certain requirement).

**Explicitly not touched:** `investmentAppraisalService.ts`,
`roiCalculationEngine.ts`, `financeEnterpriseService.ts`,
`financial_roi_links` (or anything under `finance-enterprise.routes.ts`),
`outboxDrain.ts`.

---

## 8. Definition of done

- [ ] `createRoiFinanceLink`/`removeRoiFinanceLink`/`openRoiFinanceReconciliation`/`updateRoiFinanceReconciliationStatus`/`flagEvidenceLinkFreshnessCheck` all work against real prior E001-E006 data
- [ ] AC-01 proven: the pinned envelope shape matches §9.6's field list exactly
- [ ] AC-02 proven: zero write path exists anywhere in this epic's code to any `financial_*` table (grep gate, not just a test)
- [ ] AC-03 proven: a reconciliation record is created and resolvable, never a value overwrite on either side
- [ ] AC-04 proven: the reverse KPI→ROI read respects two-layer visibility
- [ ] AC-05 proven: `isStale` computed correctly at read time; the freshness-check event never carries or writes a KPI value
- [ ] `::text` cast verified on both new tables' joins
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001-E006 test suite still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` ROI-E007 rows updated + backlog notes per §7
