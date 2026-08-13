# ROI-E006 — PIR & Learning — FROZEN DESIGN

Status: FROZEN. Integration Owner: Claude (orchestrator session, 2026-08-10).
Sixth epic of the ROI domain, builds on ROI-E001-E005, all landed. Backend
only — UI Registry is RN-G2. **Last new-content ROI epic** — closes the
Case's entire lifecycle (`benefits_realization → post_investment_review_due →
post_investment_review → closed`). E007/E008 are integration-seam/legacy
epics, not new domain content.

---

## 0. Epic boundary (confirmed handoff from ROI-E005)

ROI-E005's own closing note: "the `benefits_realization`→
`post_investment_review_due` and final `→closed` transitions remain E006's
job, not built here." Confirmed by grep — zero command anywhere transitions
a case into `post_investment_review_due`, `post_investment_review`, or
`closed`.

`EPIC_LEDGER_LIVE.md`'s prose, quoted verbatim:

> "ROI-E006 PIR & Learning (6 AC: schedule/trigger→PIR Due, frozen review
> snapshot przy starcie reviewera, closure wymaga review/evidence lub
> waiver, cold reopen identyczny final snapshot, portfolio metrics tylko
> governed, Teresa draft lessons wymaga explicit accept)"

Six ACs, accepted verbatim:

1. **AC-01** — A schedule/trigger drives the transition into `post_investment_review_due`.
2. **AC-02** — A frozen review snapshot is captured at reviewer start.
3. **AC-03** — Closure requires review/evidence resolved, or an explicit waiver.
4. **AC-04** — Cold reopen returns an identical final snapshot.
5. **AC-05** — Portfolio metrics computed only from governed data.
6. **AC-06** — A Teresa-drafted lessons text requires explicit human accept.

---

## 1. Decisions

All 14 decision points from the design draft are ratified as specified,
with its own 5 flagged open questions resolved as D15-D19.

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | New CHECK-constraint values needed? | **No.** All three remaining statuses were forward-declared by ROI-E001. | Same reservation-closing shape every prior epic used. |
| D2 | New scheduling/cron infrastructure for AC-01? | **No — confirmed by reading.** Zero scheduled job anywhere touches any `rvn_*` table; `completeObligation` has zero call sites in `resultsVnext` before this epic. | Building new scheduler infra would be the first exception to a pattern held for 5 straight epics — nothing in the 6 ACs meets the burden of proof to break it. |
| D3 | What does "schedule/trigger" mean concretely? | **Two manual mechanisms**: `scheduleRoiCasePostInvestmentReview` (advisory metadata only, no status change) and `markRoiCasePostInvestmentReviewDue` (the actual transition, human-triggered). | Splits the AC's two nouns into two real mechanisms instead of conflating them; the "trigger" is a human decision informed by the "schedule," not a cron firing. |
| D4 | Semantic split of `next_review_at`/`next_action_type`/`next_action_due_at`? | **Confirmed as designed**: `next_review_at` = the scheduled checkpoint, set once, left as historical record; `next_action_type`/`next_action_due_at` = a rolling "what's next" pointer, updated at each transition, cleared at `closed`. | These three ROI-E001-reserved columns have never been written to before this epic — this is the first, and only plausible, referent across the whole domain. Confirmed as a reasonable, low-risk inference (metadata only, not load-bearing for correctness). |
| D5 | Does `markRoiCasePostInvestmentReviewDue` complete E005's `confirm_benefits_realization` obligation? | **Yes.** First real caller of `completeObligation` in this program — flagged as a genuine architectural first, not silently introduced. Then creates a new `conduct_post_investment_review` obligation. | Leaving a permanently-open, never-actionable obligation dangling forever is a real UX defect; a second, parallel, functionally-overlapping obligation would be worse than completing the first and creating a distinct new one. |
| D6 | Self-close/maker-checker for PIR? | **Yes, keep as designed — confirmed** (draft's own flagged open question). `closeRoiCase` throws `RoiPirSelfCloseDeniedError` (403) if the closer is the PIR's own `started_by`. | Sourced from the secondary plan doc's "conduct and approve PIR" phrasing, not the primary 6-AC sentence — but the financial-closure-stakes argument mirrors ROI-E004 D10's own precedent for overriding a no-check default. PIR closure is the Case's single most consequential terminal act. |
| D7 | Does the PIR freeze at review-start or at finalize? | **At review-start**, per AC-02's literal tense. Narrative fields freeze separately, second, at finalize. | Directly follows the AC's own wording — a literal constraint, not an inference. |
| D8 | Does the frozen payload re-embed full snapshot data? | **No — pointer IDs plus a frozen copy of the compare/benefits-realization views and all Variances**, not the full multi-KB ApprovalSnapshot payload. | Avoids duplicating already-immutable, ID-reachable data. Persisting a one-time copy of views ROI-E004/E005 otherwise never persist is a deliberate, explicitly-stated exception scoped to this epic's own frozen record — it does not reopen either of those decisions. |
| D9 | AC-03's exact closure gate? | **Confirmed as designed** (draft's own flagged open question): open variances block closure unless an explicit `openVarianceWaiverReason` is supplied (blanket waiver, not per-category); PIR must have non-null `outcome`/`lessonsLearned`. | No source doc specifies a finer, per-category variance-blocking rule — inventing one would be a guess. The blanket-waiver-with-mandatory-reason shape is the most defensible reading of "resolved lub waiver." |
| D10 | Is the PIR versioned? | **Yes**, `sequence_number` + at-most-one-draft-per-case partial unique index. | Matches the uniform sequence-numbered-immutable-record pattern every other frozen entity in this domain uses; costs nothing, avoids a future `ALTER TABLE` if a redo need surfaces. |
| D11 | New `resource_type`? | **No.** Inherits visibility via `case_id` only. | Same as every prior ROI epic; no AC calls for finer/broader visibility. |
| D12 | Is "Learning" a distinct, cross-case-searchable entity? | **No — confirmed not built** (draft's own flagged open question). "Learning" resolves to the PIR's own narrative field plus the governed portfolio-metrics rollup. | No reusable "lessons library" pattern exists anywhere in `resultsVnext`; a speculative cross-case knowledge base is exactly the scope creep this program has consistently deferred (ROI-E002 D9's precedent). If the product intent really is a searchable cross-case KB, that is a materially different, unbuilt feature — named explicitly as a gap, not silently assumed. |
| D13 | Where does Teresa generation happen? | **Not in this epic.** ROI-E006 ships only the receiving data shape (`teresa_draft_lessons_payload`, disposition columns) and the disposition gate (AC-06). ROI-E008 (Teresa/Legacy/Ops) owns the actual generation call. | Matches the "contract with initially zero real caller" pattern `freezeRoiBaseline` had between ROI-E001 and ROI-E003 — testable in isolation now, wired by the epic explicitly scoped to Teresa integration. |
| D14 | New file or extend E005's org-perspective repository? | **Extend** `roiOrgPerspectiveRepository.ts`, new function `listOrganizationRoiPirOutcomes`, reusing the existing `buildScopedRoiCasesBase` helper. | The helper was already generically named, not `*BenefitsRealization*`-specific — a second near-duplicate CTE file would repeat a pattern this program's own audits have flagged elsewhere. |
| D15 (resolves OQ1) | Confirm D6? | **Confirmed**, see D6. | — |
| D16 (resolves OQ2) | Confirm D12? | **Confirmed**, see D12. Add an explicit backlog note in the ledger naming the cross-case-KB gap for a future epic/product decision. | — |
| D17 (resolves OQ3) | Confirm D9's blanket-waiver shape? | **Confirmed**, see D9. | — |
| D18 (resolves OQ4) | Confirm D4's column-split inference? | **Confirmed**, see D4. | — |
| D19 (resolves OQ5) | Should a distinct PMO/governance role drive AC-01 (mirroring the `initiative_lifecycle_gate_decisions` table ROI-E005 discovered)? | **No — out of scope**, matching ROI-E005's own caution about that exact table. Case owner self-serves `schedule`/`mark-due` for now. | A PMO-governance layer is a materially bigger, unnamed integration no AC calls for. Flagged as backlog, not silently assumed. |

---

## 2. Legacy collision check (accepted from draft)

`rvn_roi_post_investment_reviews`, and the first real writes to
`next_review_at`/`next_action_type`/`next_action_due_at` (reserved since
ROI-E001) — confirmed greenfield / first-claimer, zero collisions.

---

## 3. Schema (full DDL)

Migration file: `server/migrations/20260819_rvn_roi_pir_learning.sql`. Zero
new CHECK-constraint values on `rvn_roi_cases.status` (D1). One new table.

```sql
-- ============================================================
-- rvn_roi_post_investment_reviews — versioned, freezable in two stages
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_post_investment_reviews (
  pir_id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                         UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                 TEXT NOT NULL,

  sequence_number                 INT NOT NULL,
  status                          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),

  -- AC-02: frozen at reviewer start, immutable from creation.
  started_by                      TEXT NOT NULL,
  started_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_snapshot_payload         JSONB NOT NULL,
  review_snapshot_hash            TEXT NOT NULL,

  -- Narrative content, editable while status='draft' only.
  outcome                         TEXT NULL
                                     CHECK (outcome IN ('benefits_fully_realized','benefits_partially_realized','benefits_not_realized')),
  lessons_learned                 TEXT NULL,
  recommendation                  TEXT NULL,

  -- AC-03: closure gate — non-null only when finalized despite open variances.
  open_variance_waiver_reason     TEXT NULL,

  -- AC-06: Teresa draft never becomes authoritative without this.
  teresa_draft_lessons_payload    JSONB NULL,
  teresa_draft_generated_at       TIMESTAMPTZ NULL,
  teresa_draft_disposition        TEXT NULL CHECK (teresa_draft_disposition IN ('accepted','rejected','edited_then_accepted')),
  teresa_draft_disposition_by     TEXT NULL,
  teresa_draft_disposition_at     TIMESTAMPTZ NULL,

  finalized_by                    TEXT NULL,
  finalized_at                    TIMESTAMPTZ NULL,

  row_version                     INT NOT NULL DEFAULT 1,
  created_by                      TEXT NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                      TEXT NULL,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_pir_case_seq
  ON rvn_roi_post_investment_reviews(case_id, sequence_number);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_pir_one_draft_per_case
  ON rvn_roi_post_investment_reviews(case_id) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS idx_rvn_roi_pir_case
  ON rvn_roi_post_investment_reviews(organization_id, case_id, sequence_number DESC);

CREATE OR REPLACE FUNCTION rvn_roi_pir_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.started_by IS DISTINCT FROM OLD.started_by
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.review_snapshot_payload IS DISTINCT FROM OLD.review_snapshot_payload
     OR NEW.review_snapshot_hash IS DISTINCT FROM OLD.review_snapshot_hash
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % review snapshot facts are immutable', OLD.pir_id
      USING ERRCODE = '23001';
  END IF;

  IF OLD.status = 'finalized' THEN
    IF NEW.outcome IS DISTINCT FROM OLD.outcome
       OR NEW.lessons_learned IS DISTINCT FROM OLD.lessons_learned
       OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
       OR NEW.open_variance_waiver_reason IS DISTINCT FROM OLD.open_variance_waiver_reason
       OR NEW.teresa_draft_disposition IS DISTINCT FROM OLD.teresa_draft_disposition
    THEN
      RAISE EXCEPTION 'rvn_roi_post_investment_reviews: pir % is finalized', OLD.pir_id USING ERRCODE = '23001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rvn_roi_pir_protect_frozen ON rvn_roi_post_investment_reviews;
CREATE TRIGGER trg_rvn_roi_pir_protect_frozen
  BEFORE UPDATE ON rvn_roi_post_investment_reviews
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_pir_protect_frozen();

-- No ALTER TABLE rvn_roi_cases — every column this epic writes to already
-- exists (reserved since ROI-E001).
```

---

## 4. Command layer (`server/src/services/resultsVnext/roi/roiPirCommands.ts`, new)

Before implementing, re-read the current exact state of `roiCaseCommands.ts`,
`roiBenefitsRealizationCommands.ts` (direct template), `roiVarianceRepository.ts`/
`roiCompareRepository.ts`/`roiBenefitsRealizationRepository.ts` (frozen-payload
sources), `platform/obligations.ts` — this design describes their shape, not
a guarantee of literal signatures after five epics of edits.

### 4.1 `scheduleRoiCasePostInvestmentReview` (D3/D4)

`executeAtomicCommand`, CAS on the case's `row_version`. Guard:
`fromStatuses: ['tracking','benefits_realization']`. `UPDATE rvn_roi_cases
SET next_review_at=$1, next_action_type='post_investment_review',
next_action_due_at=$1, row_version=$2, ...`. No obligation write. Event
`roi.post_investment_review_scheduled` → `['mywork_projection']`.

### 4.2 `markRoiCasePostInvestmentReviewDue` (AC-01)

Hand-written `executeAtomicCommand`, structurally copied from
`startRoiCaseBenefitsRealization`. Guard: `status === 'benefits_realization'`.
`UPDATE rvn_roi_cases SET status='post_investment_review_due',
next_action_type='conduct_post_investment_review', row_version=$next, ...`.
Same transaction (D5):
1. `completeObligation(client, { organizationId, referenceType:'roi_case',
   referenceId: caseId, obligationType:
   CONFIRM_BENEFITS_REALIZATION_OBLIGATION_TYPE, completedViaCommand:
   'markRoiCasePostInvestmentReviewDue' })` — imported from
   `roiBenefitsRealizationCommands.ts`'s already-exported constant.
2. `createObligation(client, { obligationType: CONDUCT_PIR_OBLIGATION_TYPE,
   assigneeUserId: currentRow.owner_user_id, dueAt: currentRow.next_review_at,
   deduplicationKey:
   \`${organizationId}:roi_case:${caseId}:conduct_post_investment_review\`, ... })`.

Event `roi.post_investment_review_due` → `['mywork_projection']`.

### 4.3 `startRoiCasePostInvestmentReview` (AC-02)

Hand-written `executeAtomicCommand`. Guard: `status ===
'post_investment_review_due'`. Inside `applyMutation`, same pinned client:
1. Read `latestApprovedSnapshotId`/`currentForecastVersionId`/
   `currentActualSnapshotId` off the locked case row.
2. Internal-invariant check: `latestApprovedSnapshotId IS NOT NULL`.
3. Call `getRoiCaseCompareView`/`getRoiCaseBenefitsRealizationView`/
   `listVariances` (read-only, reused verbatim) to build the frozen
   `review_snapshot_payload` per D8.
4. `contentHash = computeStateHash(payload)` (fixed key order).
5. `sequenceNumber = COALESCE(MAX(sequence_number),0)+1 FROM
   rvn_roi_post_investment_reviews WHERE case_id=$1` (safe under the case
   row's own lock).
6. `INSERT INTO rvn_roi_post_investment_reviews (..., status='draft',
   started_by=actorUserId, ...)`.
7. `UPDATE rvn_roi_cases SET status='post_investment_review',
   next_action_type='finalize_post_investment_review', row_version=$next, ...`.

Event `roi.post_investment_review_started` → `['mywork_projection']`.

### 4.4 `updateRoiPostInvestmentReviewDraft`

`executeAtomicCommand`, CAS on the PIR row's own `row_version`. Guard:
`status === 'draft'`. Writable: `outcome`/`lessonsLearned`/`recommendation`
only. Event `roi.post_investment_review_draft_updated` →
`['mywork_projection']`.

### 4.5 `recordRoiPirTeresaDraftDisposition` (AC-06)

`executeAtomicCommand`, CAS on the PIR row. Guard: `status === 'draft'`.
Input: `disposition: 'accepted'|'rejected'|'edited_then_accepted'`,
`finalLessonsText?: string` (required when disposition ≠ `'rejected'`).
Writes `teresa_draft_disposition`/`_by`/`_at`; **only** on
`'accepted'`/`'edited_then_accepted'` does this copy `finalLessonsText` into
the authoritative `lessons_learned` column — `'rejected'` leaves
`lessons_learned` untouched. This is the literal AC-06 mechanism: the draft
payload (`teresa_draft_lessons_payload`, written by a future ROI-E008
caller — no writer shipped in this epic) never reaches the authoritative
field without this explicit human call. Event
`roi.pir_teresa_draft_disposition_recorded` → `['mywork_projection']`.

### 4.6 `closeRoiCase` (AC-03, D6)

Hand-written `executeAtomicCommand`, CAS on the case's `row_version`.
`applyMutation`, in this exact order:
1. Guard `status === 'post_investment_review'`.
2. `SELECT ... FOR UPDATE` the active `status='draft'` PIR row for this
   case — none found → `RoiPirNotFoundError` (404, internal-invariant
   violation, should be unreachable).
3. **Self-close denial (D6, before any write)**: `if (actorUserId ===
   pirRow.started_by) throw new RoiPirSelfCloseDeniedError(...)` (403).
4. Load all `rvn_roi_variances` for the case; any `status='open'` requires
   `input.openVarianceWaiverReason` non-null, else
   `RoiPirValidationError('OPEN_VARIANCES_UNRESOLVED', { openVarianceIds })`.
5. `pirRow.outcome === null || pirRow.lessonsLearned === null` →
   `RoiPirValidationError('PIR_INCOMPLETE', ...)`.
6. `UPDATE rvn_roi_post_investment_reviews SET status='finalized',
   finalized_by=actorUserId, finalized_at=now(),
   open_variance_waiver_reason=$waiverReason, row_version+1 WHERE
   pir_id=$1`.
7. `completeObligation(client, { obligationType: CONDUCT_PIR_OBLIGATION_TYPE,
   completedViaCommand: 'closeRoiCase', ... })`.
8. `UPDATE rvn_roi_cases SET status='closed', next_action_type=NULL,
   next_action_due_at=NULL, row_version=$next, ...` (`next_review_at`
   deliberately left as-is — historical record, per D4).

Event `roi.case_closed` → `['mywork_projection','finance_projection']`.

---

## 5. Repository (`server/src/services/resultsVnext/roi/roiPirRepository.ts`, new)

`listRoiPostInvestmentReviews`/`getRoiPostInvestmentReview({ userId,
organizationId, caseId, pirId })` — visibility-gated via the standard
`resource_type='roi_case'` join, mandatory `::text` cast on `pir.case_id`.
Payload returned as stored — no read-time redaction needed (D8's payload has
no foreign visibility domain the way ApprovalSnapshot's KPI evidence links
do).

---

## 6. Portfolio metrics (AC-05, D14)

**Changed** `roiOrgPerspectiveRepository.ts`: new function
`listOrganizationRoiPirOutcomes({ managerId, organizationId })`, reusing the
existing `buildScopedRoiCasesBase` CTE, scoped to `status IN
('post_investment_review','closed')`, joining the finalized (or draft, for
in-flight cases) `rvn_roi_post_investment_reviews` row per case:

```typescript
interface OrganizationRoiPirOutcomes {
  cases: Array<{
    caseId: string; initiativeId: string; title: string; status: RoiCaseStatus;
    pirOutcome: 'benefits_fully_realized' | 'benefits_partially_realized' | 'benefits_not_realized' | null;
    benefitsRealizationPct: number | null;
    finalizedAt: string | null;
  }>;
  portfolioTotals: { closedCaseCount: number; fullyRealizedCount: number; partiallyRealizedCount: number; notRealizedCount: number };
}
```

Reads only `rvn_roi_cases`/`rvn_roi_post_investment_reviews`/
`rvn_roi_approval_snapshots`/`rvn_roi_actual_snapshots` — never a legacy
table (the literal AC-05 mechanism).

**Changed** `roiPerspectives.routes.ts`: new route `GET /org/pir-outcomes`.

---

## 7. Visibility

Confirmed (D11): `rvn_roi_post_investment_reviews` inherits visibility via
`case_id` only, `resource_type='roi_case'`, mandatory `::text` cast. No new
`resource_type`. The org rollup adds a management-chain scope on top of, not
instead of, per-case visibility.

---

## 8. Self-approval / maker-checker

New: `RoiPirSelfCloseDeniedError` (D6) — `closeRoiCase` denies when
`actorUserId === pirRow.started_by`. No other command in this package has a
self-check — all single-actor, self-serve commands.

---

## 9. API surface

**Changed** `server/src/routes/resultsVnext/roi.routes.ts`:

| Method | Path | Command/Repository |
|---|---|---|
| `PUT` | `/cases/:caseId/post-investment-review-schedule` | `scheduleRoiCasePostInvestmentReview` |
| `POST` | `/cases/:caseId/transitions/mark-pir-due` | `markRoiCasePostInvestmentReviewDue` |
| `POST` | `/cases/:caseId/transitions/start-pir` | `startRoiCasePostInvestmentReview` |
| `GET` | `/cases/:caseId/post-investment-reviews` | `listRoiPostInvestmentReviews` |
| `GET` | `/cases/:caseId/post-investment-reviews/:pirId` | `getRoiPostInvestmentReview` |
| `PATCH` | `/cases/:caseId/post-investment-reviews/:pirId` | `updateRoiPostInvestmentReviewDraft` |
| `POST` | `/cases/:caseId/post-investment-reviews/:pirId/teresa-draft-disposition` | `recordRoiPirTeresaDraftDisposition` |
| `POST` | `/cases/:caseId/transitions/close` | `closeRoiCase` (`openVarianceWaiverReason` optional) |

**Changed** `roiPerspectives.routes.ts`: `GET /org/pir-outcomes`.

**Changed** `handleRoiRouteError`: `RoiPirSelfCloseDeniedError` → 403 (same
slot `RoiSelfApprovalDeniedError`/`RoiActualSelfVerificationDeniedError`
occupy); `RoiPirNotFoundError` → 404; `RoiPirValidationError` → 409.

New validators: `server/src/validators/resultsVnextRoiPir.validators.ts`.

**Changed** `atomicWrite.ts` — new event types:
`roi.post_investment_review_scheduled`/`roi.post_investment_review_due`/
`roi.post_investment_review_started`/
`roi.post_investment_review_draft_updated`/
`roi.pir_teresa_draft_disposition_recorded` → `['mywork_projection']`;
`roi.case_closed` → `['mywork_projection','finance_projection']`.

**Mount-order note**: verify `roi.routes.ts` still owns zero bare top-level
dynamic segments after adding these 8 routes, since `/org/pir-outcomes`
depends on that invariant.

---

## 10. File list (backend only)

**New:**
- `server/migrations/20260819_rvn_roi_pir_learning.sql`
- `server/src/services/resultsVnext/roi/roiPirTypes.ts`
- `server/src/services/resultsVnext/roi/roiPirCommands.ts`
- `server/src/services/resultsVnext/roi/roiPirRepository.ts`
- `server/src/validators/resultsVnextRoiPir.validators.ts`
- `tests/resultsVnext/roi/roiPirScheduleAndDue.realdb.test.ts` — schedule guard scope, the D5 double-obligation effect (old completed, new created with correct `dueAt`).
- `tests/resultsVnext/roi/roiPirStart.realdb.test.ts` — AC-02 proof: frozen payload matches hand-verified figures at start time; a subsequent mutation to a live Variance/Actual row does NOT change the already-frozen `review_snapshot_hash`.
- `tests/resultsVnext/roi/roiPirClose.realdb.test.ts` — AC-03 proof (open-variance block, waiver override, PIR-incomplete block), D6 self-close denial, obligation completion, `next_action_type`/`next_action_due_at` cleared, `next_review_at` preserved.
- `tests/resultsVnext/roi/roiPirTeresaDisposition.realdb.test.ts` — AC-06 proof: `'rejected'` never touches `lessons_learned`; the other two dispositions do; raw UPDATE blocked once finalized.
- `tests/resultsVnext/roi/roiPirColdReopen.realdb.test.ts` — AC-04 proof: finalize, reconnect a fresh client/process, re-`GET`, assert byte-identical `review_snapshot_hash` and payload.
- `tests/resultsVnext/roi/roiOrgPirOutcomes.realdb.test.ts` — AC-05 proof: chain-scoping, confirmed absence of legacy table names in generated SQL.
- `tests/resultsVnext/roi/roiPirVisibilityJoin.realdb.test.ts` — `::text` cast.
- `server/src/routes/resultsVnext/__tests__/roiPir.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/roi/roiOrgPerspectiveRepository.ts` — `listOrganizationRoiPirOutcomes` added.
- `server/src/routes/resultsVnext/roiPerspectives.routes.ts` — new route.
- `server/src/routes/resultsVnext/roi.routes.ts` — 8 new routes; `handleRoiRouteError` gains 3 branches.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — 6 new event types.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry; backlog notes for D16 (no cross-case Learning entity), D19 (no PMO/governance role driving AC-01), D13 (Teresa generation deferred to ROI-E008), no reopen-from-`post_investment_review`/`closed` path.

**Read-only reference:** `roiCaseCommands.ts`, `roiBenefitsRealizationCommands.ts`/`Repository.ts`, `roiCompareRepository.ts`, `roiVarianceRepository.ts`/`Commands.ts`, `roiApprovalSnapshotTypes.ts`, `roiForecastActualTypes.ts`, `platform/obligations.ts`, `roiOrgPerspectiveRepository.ts`, `roiPerspectives.routes.ts`.

---

## 11. Definition of done

- [ ] All 6 new commands work against real prior E001-E005 data
- [ ] AC-01 proven: schedule/mark-due mechanics work as designed
- [ ] AC-02 proven: frozen payload immune to later live-data mutation
- [ ] AC-03 proven: open-variance block, waiver override, PIR-incomplete block, D6 self-close denial
- [ ] AC-04 proven: cold reopen returns byte-identical final snapshot
- [ ] AC-05 proven: org rollup reads only `rvn_roi_*` tables
- [ ] AC-06 proven: Teresa draft disposition gate — rejected never reaches `lessons_learned`
- [ ] `::text` cast verified on the new table's join
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Full existing KPI + ROI-E001-E005 test suite still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` ROI-E006 rows updated + backlog notes per §10
