# OKR-E004 Check-ins — FROZEN DESIGN

## §-IO. Integration Owner rulings (binding; override any contrary provisional wording below)

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
The sections below are the design draft as researched, accepted in full, subject to these rulings.

**Cross-cutting rulings — these resolve the recurring open questions common to every OKR draft:**

| # | Recurring question | Ruling |
|---|---|---|
| IO-1 | Prior OKR epics are designed but **not landed as code**; every cited signature/table/column comes from frozen docs, not running code. Several drafts independently confirmed this by direct grep. | **Correct, acknowledged, and NOT a blocker to freezing the design — but it IS a hard build-time gate.** The implementer MUST re-verify every cross-epic signature, table, and column against actually-landed code before writing against it, and MUST report divergence rather than silently adapting. The OKR epics land strictly in order E001→E008; each implementation begins by re-reading its predecessors' landed code. |
| IO-2 | A policy value the design needs has **no column on `okr_vnext_programs`** (attention thresholds, clamping rules, status-suggestion policy). | **Do NOT `ALTER TABLE okr_vnext_programs` for it in this epic.** Use an explicitly-named constant or return `not_calculable`, and record the gap in the closure entry. Reserving a column costs a migration on a table that may already hold data; naming the gap costs nothing and keeps it visible. Mirrors `reflection_required_for_close`'s own reserve-and-flag precedent. |
| IO-3 | A capability is plausible and useful but **no AC in the ledger names it**. | **Do not build it.** Name it in the closure entry as a deferred, unowned gap. Every prior domain held this line; speculative scope is exactly what the per-epic AC tables exist to prevent. |
| IO-4 | A cross-epic boundary is assumed but unconfirmed by any AC. | **Restate it forward explicitly** in the closure entry, addressed to whoever implements the neighbouring epic — never leave it a silent assumption. Precedent: OKR-E002 D13's `resolveScopeVisibility` gap, restated rather than quietly resolved. |
| IO-5 | A formula, threshold, or gradient is **not specified in any source document**. | **Never invent one carrying a free parameter.** Either use the definitionally-forced value (e.g. binary = 1.0/0.0) or return `not_calculable` with a reason. A fabricated gradient inside a number that feeds review decisions is the same class of risk as ROI's NPV/rounding gap. |
| IO-6 | The design needs a change to a file **outside this epic's own allowlist** (another module's controller, a shared platform primitive). | **Permitted only when additive and strictly backward-compatible** (new optional field, new exported function, widened guard that rejects nothing previously accepted). It must be its own separate commit, named in the closure entry as a cross-module change. Anything more invasive stops and reports instead. |

Any open question in this draft not addressed by an epic-specific ruling below stands **exactly as the draft documented it** — flagged, unresolved, and to be restated in the closure entry rather than silently decided during implementation.

---

Status: IN PROGRESS (written incrementally, append-only during drafting to survive crashes)
Author: Claude (design agent), 2026-08-10
Worktree: `consultify-results-vnext-g0-20260809`, branch `codex/results-vnext-g0-20260809`
Read-only task — no repo files modified.

---

## 0. Source-of-truth AC table (VERBATIM from `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` lines 49-59)

> Wypełnione przez agenta `aa3fc90c059b0bf01` — 2026-08-09.

### OKR-E004 Check-ins

| Pole | OKR-F-010-AC-01 | OKR-F-011-AC-01 | OKR-F-012-AC-01 (izolujący AC) | OKR-F-013-AC-01 |
|---|---|---|---|---|
| Decision ID | D08 | D08, D09 | D09 | D12 |
| Requirement | Check-in idempotentny per KR+okno cadence; ponowne zgłoszenie w oknie = korekta, nigdy nadpisanie historii. | Progress/confidence/status/attention = 4 osobne wartości; brak check-in → stale/attention, NIGDY syntetyczne 0%. | **Sugerowana wartość check-in NIE CZYTA `kpi_time_series` bezpośrednio ani nie importuje `kpiDefinitionService.js`** — bezpośrednia naprawa AS-IS naruszenia D09 (`okrService.ts::getSuggestedValueForKeyResult`). | Ukończenie MyWork "check in" wywołuje domenową komendę; nie tworzy równoległej kopii OKR stanu w MyWork. |
| Aggregate/owner | OKRCheckIn | OKRSet/Objective/KeyResult (4 pola niezależne) | OKRCheckIn suggestion service | OKRCheckIn ↔ MyWork obligation |
| Command/query/API | `GET/POST .../key-results/:id/check-ins` | `GET .../sets/:id` (agregacja 4 wymiarów) | wewnętrzny — typed optional reference, NIE strukturalny odczyt | MyWork completion handler → `POST .../check-ins` |
| Schema/migration/constraint | `okr_vnext_checkin_occurrences`, `okr_vnext_checkins` | `okr_vnext_sets.attention_state` osobna kolumna | **BRAK FK z `okr_vnext_*` do `kpi_*`** | MyWork item (`reference_type/reference_id`) |
| Roles/visibility | KR Owner, Manager | wszystkie autoryzowane wg visibility Set | KR Owner (widzi sugestię, nie źródło KPI) | KR Owner |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

**Key takeaways from the table itself, before any interpretation:**
- Check-in is explicitly **per Key Result** — the route is `.../key-results/:id/check-ins`, not `.../sets/:id/check-ins` or `.../objectives/:id/check-ins`. This resolves question (A) directly from the ACs, no guessing needed.
- "Korekta, nigdy nadpisanie historii" (AC-010) is an explicit, verbatim append-only/correction mandate — matches KPI/ROI precedent.
- AC-011 requires FOUR independent fields (progress, confidence, status, attention) that live on OKRSet/Objective/KeyResult — i.e., rollup touches all three levels, not just the Set.
- AC-011 forbids "synthetic 0%" on missing check-in — the state must read as stale/attention, not silently regress to zero. This has direct implications for (C) and (F).
- AC-012 is explicitly called out as an "isolating AC" — it exists specifically to prevent the AS-IS violation already found in legacy `okrService.ts::getSuggestedValueForKeyResult` (reads `kpi_time_series` / imports `kpiDefinitionService.js` directly) from being carried into vNext. This is a hard constraint on (C)'s suggestion mechanism, not on write-through itself.
- AC-013 confirms the MyWork↔OKR obligation pattern used elsewhere in this program: completion drives a domain command, not a parallel state copy.

---

## 1. Plan-doc grounding (`04_OKR_IMPLEMENTATION_PLAN.md`)

### 1.1 Schema shapes given in the plan (aspirational, pre-AS-BUILT — E001/E002 already deviated from some of this, see §2 below)

`OKRCheckIn` (plan §4.7):
```yaml
OKRCheckIn:
  id: uuid
  organization_id: uuid
  okr_set_id: uuid
  objective_id: uuid
  key_result_id: uuid
  cadence_occurrence_id: uuid
  period_date: date
  previous_value: decimal | null
  new_value: decimal | null
  calculated_progress: decimal | null
  owner_declared_status: status | null
  system_suggested_status: status | null
  confidence: high | medium | low | numeric | null
  note: text
  blocker: text | null
  support_requested: text | null
  evidence_references: json
  submitted_by: uuid
  submitted_at: datetime
```
"One check-in occurrence is idempotent per KR and cadence window. Corrections create a new revision/event; they do not overwrite history." (plan §4.7, verbatim) — this is the plan-doc source for AC-010's requirement, confirms append-only-with-correction over mutation.

Note the plan's `OKRCheckIn` denormalizes `okr_set_id`/`objective_id` alongside `key_result_id` — convenient for querying without joins, but the AC table's Command/API cell (`GET/POST .../key-results/:id/check-ins`) confirms the check-in's *identity* is scoped to the KR; the Set/Objective ids are lineage/denormalization, not the aggregate boundary.

### 1.2 Progress/confidence/status/attention (plan §5.4, verbatim definitions)

- **Progress:** backward-looking numerical attainment according to KR geometry.
- **Confidence:** owner assessment of likelihood of future success.
- **Status:** declared or policy-suggested domain state.
- **Attention:** operational need for intervention.

Worked examples from the plan, verbatim:
- "progress 45%, expected 40%, confidence low → attention required despite acceptable progress"
- "progress 30%, expected 50%, confidence high → at risk, but manager may validate recovery route"
- "missing check-in → stale/attention, never synthetic 0% progress"

"No universal fixed 70/40 thresholds. The policy version defines status suggestions, trajectory, clamping, overachievement, and roll-up." — status/attention derivation must be **policy-driven and versioned**, mirroring OKR-E003's progress-calc-service pattern (which itself stores "policy/version and reason" per OKR-F-009-AC-02).

Progress geometries (plan §5.4, for KR-level progress — OKR-E003's job, but check-in is what feeds `current_value` into it):
```text
increase: (current - baseline) / (target - baseline)
decrease: (baseline - current) / (baseline - target)
binary: 0 or 100%
percentage direct: configured direct value or baseline-to-target
maintain range: policy-defined in-range evaluation
```
Degenerate/missing inputs yield `not_calculable`, not fabricated zero — same discipline as the "never synthetic 0%" rule for missing check-ins.

### 1.3 MyWork obligation catalog (plan §13, verbatim list — relevant subset)

Generated obligation types include: draft OKR Set; submit for review; review/request changes/approve; respond to changes; **check in**; **explain low confidence**; respond to support request; mid-cycle review; final score; reflection; manager review; prepare next cycle.

"Every item has `reference_type`, `reference_id`, obligation type, cadence occurrence, policy version, source event, due date, and deterministic deduplication key. Completing it invokes a domain command; it does not create a parallel OKR copy." — this is the plan-doc source for AC-013, and it names **cadence occurrence** and **deterministic deduplication key** as required fields on the obligation itself — directly relevant to (F) missed-cadence handling.

Risk table (plan §18, verbatim row): "Duplicate obligations | noisy MyWork and conflicting state | cadence occurrence + deterministic idempotency key" and "Check-in fatigue | quarterly bureaucracy in weekly form | short MyWork flow, automatic prefill, exception focus."

### 1.4 Maker-checker note relevant to check-ins (plan §7.3, verbatim)

"owner submits check-ins; manager responds rather than overwriting owner evidence" — the Manager role named in AC-010's Roles/visibility cell alongside KR Owner is for *responding* (comment/support/escalation), not for submitting corrections on the owner's behalf as if the manager were the owner. No AC or plan text grants managers write access to submit a check-in's numeric value on someone else's KR.

### 1.5 API contract given in the plan (§9, verbatim) — for check-ins specifically

```text
GET    /api/vnext/results/okr/key-results/:keyResultId/check-ins
POST   /api/vnext/results/okr/key-results/:keyResultId/check-ins
```
Exactly matches the AC table's Command/query/API cell for OKR-F-010-AC-01 — plan and live ledger agree here, no drift to reconcile.

### 1.6 Legacy AS-IS gap the plan already names (§3.2, verbatim)

"check-ins lack blocker, support request, previous value, cadence occurrence, and evidence context" — i.e. the plan's own critique of the *current* (legacy) `okr_check_ins` implementation is exactly the isolating-AC problem (AC-012) restated: legacy check-ins are thin and, per OKR-E001's design doc §0, the live `okrService.ts::getSuggestedValueForKeyResult` additionally reaches into `kpi_time_series` directly — a second, independent legacy defect beyond the missing-fields one, and the one AC-012 exists to block from crossing into vNext.

---

## 2. OKR-E001/E002 as-built context (both FROZEN, read in full)

### 2.1 OKR-E001 — `okr_vnext_checkin_occurrences` (the table this epic gets a real FK to, per handoff P11)

Migration `server/migrations/20260822_rvn_okr_program_cycle.sql` (per the frozen design; verify this filename/path actually landed before implementing):

```sql
CREATE TABLE IF NOT EXISTS okr_vnext_checkin_occurrences (
  cadence_occurrence_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id            TEXT NOT NULL,
  cycle_id                    UUID NOT NULL REFERENCES okr_vnext_cycles(cycle_id),
  window_start                DATE NOT NULL,
  window_end                  DATE NOT NULL,
  generated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by                 TEXT NOT NULL DEFAULT 'system:okr_cycle_scheduler',
  UNIQUE (cycle_id, window_start)
);
```

Key facts:
- **Cycle-scoped, not KR-scoped or Set-scoped.** One occurrence row = one cadence window for the whole Cycle (e.g. "the biweekly window starting 2026-09-01"), generated once by the scheduler and shared by every KR that needs a check-in in that window. This is deliberate — OKR-E001 explicitly built it as a "minimal shell" for OKR-E004 to extend via FK, never ALTER.
- `generateCadenceOccurrences(input: { organizationId, cycleId })` in `okrCycleScheduler.ts` — idempotent via `INSERT ... ON CONFLICT (cycle_id, window_start) DO NOTHING`, materializes rows "from `active_start_at` through `final_update_due_at`, at intervals derived from the Program's `checkin_frequency`" (`weekly|biweekly|monthly|custom`; `custom` is a documented no-op until a later epic — i.e. **this epic** — defines its interval source. This is an open item, see §9 Open Questions below).
- Not exposed over HTTP; internal, service-actor only (P10).
- OKR-E001's own design doc explicitly states its P11 rationale: "OKR-F-003-AC-02 pins this schema pointer directly to this epic; the idempotency mechanism must exist for the scheduler to be testable." — i.e. E001 built just enough for its own scheduler idempotency test, not the check-in itself.

**Consequence for this design**: because `okr_vnext_checkin_occurrences` is Cycle-scoped (one row per window, not per KR), `okr_vnext_checkins` cannot derive its own per-KR idempotency purely from a 1:1 relationship to the occurrence row — the idempotency key for AC-010 ("check-in idempotentny per KR+okno cadence") must be the **pair** `(key_result_id, cadence_occurrence_id)`, not `cadence_occurrence_id` alone (which only identifies the window, shared across every KR in the Cycle). This is resolved in §4 below with a composite unique index.

### 2.2 OKR-E002 — reserved rollup columns on `okr_vnext_sets` (the handoff this epic must honor)

Migration `server/migrations/20260823_rvn_okr_set.sql`, from the frozen design (verbatim DDL fragment):

```sql
  -- Reserved for OKR-E003/E004 rollups — NOT populated, NOT read, by any
  -- E002 command. Same "reserve now" discipline as
  -- rvn_kpi_definitions.response_policy_id.
  overall_progress              NUMERIC NULL,
  overall_confidence            TEXT NULL CHECK (overall_confidence IN ('high','medium','low','numeric')),
  attention_state                TEXT NOT NULL DEFAULT 'none'
                                   CHECK (attention_state IN ('none','watch','action_required','escalated')),
  last_checkin_at                TIMESTAMPTZ NULL,
  next_checkin_due_at            TIMESTAMPTZ NULL,
```

E002's own comment attributes these to "OKR-E003/E004" jointly — OKR-E003 (Objectives & KRs) owns KR-level `progress`/`confidence` (per its progress-calc service, OKR-F-009), and this epic (E004) is what actually *drives* those values to change over time (a KR's progress only moves because a check-in updated `current_value`) and is what populates the **Set**-level `overall_*`/`attention_state`/`last_checkin_at`/`next_checkin_due_at` columns specifically — no other epic in the ledger claims Set-level rollup ownership (E005 Alignment explicitly disclaims progress/confidence mutation via alignment: "**BRAK triggera/kaskady**" (OKR-F-015-AC-01); E006 owns the *read model* over attention signals, i.e. the Manager attention queue, but not the write path that sets `attention_state` itself — see §6 below).

Other confirmed-relevant facts from E002:
- `okr_vnext_sets.status` CHECK constraint already includes `'review'` and `'closed'` "reserved for OKR-E004/E007 — no E002 transition reaches them" — confirms E004 is expected to have *some* Set-lifecycle touchpoint, though the AC table gives this epic no Set-status-transition AC directly (plausibly the Cycle's own review-close transitions drive Set status elsewhere, or a later epic does — flagged as an open question, not invented here).
- Visibility: Set reads go through `buildVisibilityScopedCte`/`wrapWithVisibilityScope({resourceType:'okr_set'})`, **mandatory `::text` cast** on `rvn_platform_resource_visibility.resource_id` joins against `okr_vnext_sets.set_id` (UUID) — E002's design doc calls this "the single most-repeated real bug in this program" (7 times in one KPI epic alone). `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` "carry no visibility row of their own — inherit via `set_id`, same `::text` requirement." Same posture almost certainly applies to `okr_vnext_checkins` (inherits Set visibility via `key_result_id`→...→`set_id`, no own ACL row) — confirmed as this epic's own decision in §7.
- **Standing re-verification warning, repeated in both E001 and E002's own docs**: "this design was drafted while [prior epic]'s code was still in flight... re-read the actual landed code and confirm every cross-reference" before implementing. That discipline applies doubly here since neither E001 nor E002 nor (critically) **E003 has a frozen design doc confirmed landed** as of this reading — see §3.

**Confirmed: no `OKR_E003_DESIGN.md` exists in `docs/product/results-vnext/`** (directory listing checked directly). Only `OKR_E001_DESIGN.md` and `OKR_E002_DESIGN.md` exist for the OKR domain as of this reading. This means `okr_vnext_objectives`/`okr_vnext_key_results` — the tables this epic's `okr_vnext_checkins` needs a real FK to `key_result_id` against — are **not yet frozen, let alone landed**. This design proceeds using the shape given in `04_OKR_IMPLEMENTATION_PLAN.md` §4.6 (KeyResult) as the best available approximation and flags every KR-shape assumption explicitly (§9 Open Questions) for mandatory re-verification once OKR-E003 is frozen/lands — same "standing re-verification" discipline OKR-E002 itself imposed on OKR-E001.

Also confirmed: `EXECUTION_LEDGER.md` (3399 lines, read via section-header scan) has **no OKR-E001 or OKR-E002 implementation entry** — only KPI-E001 through KPI-E007 and ROI-E001 through ROI-E007 show landed-and-verified sections (§14-§38). The OKR domain's design docs (E001, E002) are marked FROZEN by their own headers but the ledger gives no evidence either has actually been implemented/merged yet. **Flag for the Integration Owner: confirm OKR-E001/E002 code state (design-only vs. landed) before this epic's implementer starts** — this draft treats their DDL as the contract to build against regardless, per the explicit handoff (P11), but "frozen design" and "landed code" are not the same claim and this repo's own stated discipline (Golden Rule #1 in `CLAUDE.md`) is to verify against real runtime, not docs, before declaring anything working.

---

## 3. ROI-E004's Decision D9/D10 — the direct precedent for rollup-timing and verifier questions (`ROI_E004_DESIGN.md`, read in full)

ROI-E004 is "fourth epic of the ROI domain, builds on ROI-E001/E002/E003, all landed" — closes ROI-E001's two reserved pointer columns (`current_forecast_version_id`, `current_actual_snapshot_id`) exactly analogous to this epic closing OKR-E002's five reserved columns (`overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/`next_checkin_due_at`).

**D9 (verbatim)**: "Is Variance stored or computed live? **Both, for different jobs.** `GET .../compare` is pure, computed live, never persisted (satisfies AC-04's freshness need). `rvn_roi_variances`/`rvn_roi_variance_causes` are stored, human-curated, fact-immutable-after-creation (satisfies AC-05's durable cause+contribution structure). **Ratified as designed.**" Rationale: "AC-04 and AC-05 have genuinely different needs (always-fresh vs. durably-explained) that no single mechanism satisfies simultaneously."

**Direct application to this design's question (D)**: the same split applies to OKR-E004. There are two genuinely different jobs:
1. **KR progress/confidence itself** — this is "always current," computed from the KR's own `current_value` (which a check-in writes) using the KR's stored geometry/policy (OKR-E003's progress-calc service). This is the "always-fresh" job, analogous to ROI's live `/compare`.
2. **Set-level `overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/`next_checkin_due_at`** — these are denormalized rollup pointers on a row that many other reads (list views, attention queue, MyWork) need to query cheaply without recomputing across every KR of every Objective of the Set on every read. This is the "stored, periodically-updated" job, analogous to ROI's `rvn_roi_actual_snapshots`.

This maps to a concrete recommendation in §5/§6 below: check-in **writes through** to the KR's `current_value` (KPI's `recordMeasurement`-append-only style — the check-in row IS the source of truth, not a separate derived-later value), and the KR's `progress`/`confidence` are then **recomputed synchronously in the same transaction** (cheap — one KR's geometry calc), while the Set's `overall_*` rollup columns are **also recomputed synchronously in the same transaction** by aggregating across the Set's live Objectives/KRs (D9-style "eager, in the same write" — not a background job, not lazy-on-read) because: (a) AC-011 requires attention_state to reflect missing-checkin staleness, which a lazy-on-read model would still need to compute at read time anyway for Sets nobody has checked into recently, defeating the purpose of denormalizing it; (b) OKR-E001/E002 established no background-job/cron infrastructure exists yet in this program (`okrCycleScheduler.ts` is "pure, fully-tested, directly-callable functions," not a live cron — Decision P10) — eager-write-in-transaction is the only mechanism actually available without inventing new infrastructure.

**D10 (verbatim)**: "Should verifying an Actual entry check the verifier isn't its own recorder? **OVERRIDE the draft's recommendation — add the check.** `verifyActualEntry` throws `RoiActualSelfVerificationDeniedError` (403) if `verifierId === recordedBy` of the entry (or entry chain's original recorder) being verified." Rationale: "AC-03 explicitly names an 'Actual Verifier **role**' — language implying separation of duties was intended... ROI's financial stakes are also higher than KPI's."

**Direct application to this design's question (E)**: the OKR-E004 AC table names **KR Owner, Manager** as Roles/visibility for AC-010 (check-in) — "Manager" here is explicitly named alongside KR Owner, unlike ROI-E004's AC-03 which named a verifier *role* as a structural requirement. But no OKR-E004 AC uses "verifier" language or requires a check/approval step on a check-in the way ROI's Actual entries require verification. Per D9/D10's own methodology (only add a check when an AC's own wording implies it, verified by direct AC-text reading, not by structural analogy to a sibling domain) — **no self-verification-denial check is warranted for OKR check-ins** by the AC table as written; "Manager" in the Roles cell most plausibly means "Manager can view / respond to / escalate on" (matching plan §7.3's "manager responds rather than overwriting owner evidence"), not "Manager verifies/countersigns the entry." This is resolved as a decision in §5 below, flagged as the analogous-but-different judgment call D10 itself models.

---

## 4. Append-only precedent — read in full: `kpiMeasurementCommands.ts`, `kpiRepository.ts`, `roiActualEntryCommands.ts`, `platform/obligations.ts`

### 4.1 `kpiMeasurementCommands.ts` (`server/src/services/resultsVnext/kpi/kpiMeasurementCommands.ts`) — the direct analogue this epic's `okr_vnext_checkins` commands should mirror

- All four commands (`recordMeasurement`, `correctMeasurement`, `verifyMeasurement`, `disputeMeasurement`) go through `executeAtomicCreate` — **never** `executeAtomicCommand` with parent CAS. Documented rationale (KPI decision #12, quoted in the file header): a unique index already provides the concurrency guarantee needed; routing every measurement write through the parent's `row_version` CAS "would serialize all measurement writes for a KPI — unnecessary contention for what may be a high-frequency write path." **Directly applicable**: check-ins should be equally high-frequency-relative-to-their-parent (a KR gets many check-ins over a Cycle) — `executeAtomicCreate`, no CAS on `okr_vnext_key_results.row_version`, is the right shape.
- `correctMeasurement`/`verifyMeasurement`/`disputeMeasurement` are three thin wrappers over one shared `insertSupersedingMeasurement(client, params)` helper — same INSERT shape, different fixed `data_quality_status` target and required fields. The table's own `REVOKE UPDATE, DELETE FROM PUBLIC` makes an UPDATE-based implementation impossible even in intent.
- `recordMeasurement`/`correctMeasurement` (the two commands that can produce a new fact) call a side-effect function (`openOrEscalateDeviationCase`) **on the same pinned client, inside `applyMutation`, immediately after their own INSERT** — same transaction, not a post-commit/outbox step, because "the outbox has zero working consumers today." `verifyMeasurement`/`disputeMeasurement` do NOT call it (they only change `data_quality_status`, not the underlying fact). **Directly applicable to (D)/(E)**: this epic's check-in-recording command should, in the identical shape, recompute KR progress/confidence AND the Set's rollup columns synchronously inside the same `applyMutation`, and (if warranted) create/complete MyWork obligations there too — no outbox/async dependency, for the identical documented reason (no working async consumer exists in this program yet).
- `resolveDeviationCaseOwner` shows the "resolve a fallback owner from the parent, don't fail on a null" pattern — relevant if this epic needs a fallback assignee for an obligation when a KR has no explicit owner.

### 4.2 `kpiRepository.ts`'s "current row" resolution (`listMeasurements`, lines ~209-223)

```sql
-- "Current" view: latest row per period. Simpler-than-fully-general rule:
-- keep rows with correction_of_measurement_id IS NOT NULL when they are the
-- newest for their (kpi_id, period_start, period_end), and drop the
-- original row they superseded.
AND NOT EXISTS (
  SELECT 1 FROM rvn_kpi_measurements newer
   WHERE newer.correction_of_measurement_id = m.measurement_id
)
```
The file's own comment notes the fully general form would be "walking the `correction_of_measurement_id` chain forward via a recursive CTE" but for KPI's scope (no deep correction chains expected) the simpler `NOT EXISTS` rule is equivalent: a row is "current" iff no later row corrects it. **Directly reusable for `okr_vnext_checkins`**, with the same caveat about chain depth — see §9 Open Questions for whether OKR check-in correction chains could realistically get deep enough (many corrections within one cadence window) to need ROI's heavier `WITH RECURSIVE` approach instead (used there specifically because D10's self-verification-denial needs the TRUE ROOT of the chain, not just "is this superseded" — a materially different question than KPI's "current row" query answers).

### 4.3 `roiActualEntryCommands.ts` (ROI-E004's adaptation) — confirms the pattern generalizes cleanly to a second domain

Structurally identical to `kpiMeasurementCommands.ts`: `recordActualEntry`/`correctActualEntry`/`verifyActualEntry`/`disputeActualEntry`, same `executeAtomicCreate` + shared `insertSupersedingActualEntry` helper shape, same `REVOKE UPDATE, DELETE` table protection. Two adaptations beyond the KPI shape, both instructive:
- **D10's self-verification walk-back** (`resolveOriginalActualEntryRecorder`, a `WITH RECURSIVE` CTE walking `correction_of_actual_entry_id` back to the row where it is `NULL`) — added specifically because AC-03 named a verifier **role**, a stronger signal than anything in this epic's own AC table (see §3 above — concluded NOT warranted for OKR check-ins, no AC uses "verifier" language here).
- **AC-06 (disputed evidence never overwrites Actual)** achieved by having `disputeActualEntry` inherit every value field from the original row unchanged (`amountOverride`/`currencyOverride` simply omitted) — only `data_quality_status`/`verified_by`/`verified_at` change. If this epic needs an analogous "flag this check-in as disputed/needs-follow-up without changing its reported value" capability, the same wrapper shape applies directly (see §9 — no AC currently asks for this, flagged as out of scope, not built here).

### 4.4 `platform/obligations.ts` — the generic MyWork primitive, already used by KPI-E003/ROI-E001/E004/E005/OKR-E001

Critical, previously-unnoticed detail confirmed by direct read: **`rvn_platform_obligations` already has a `cadence_occurrence_id` column** (`CreateObligationParams.cadenceOccurrenceId?: string | null`, file comment: "`null` for a one-shot obligation... design §C: `cadence_occurrence_id = NULL -- one-shot, not a recurring check-in`" — i.e. the platform table's own doc comment names check-ins as the intended non-null case for this column). This means the "check in" MyWork obligation this epic creates should pass the actual `okr_vnext_checkin_occurrences.cadence_occurrence_id` value straight through — no new column needed anywhere, confirms AC-013's "does not create a parallel OKR copy" is achievable with zero platform changes.

- `createObligation(client, params)`: idempotent via `ON CONFLICT (organization_id, deduplication_key) DO NOTHING`, returns `null` on the losing side of a race (not an error) — caller decides if that's expected. Runs on the caller's own pinned `PoolClient`, no independent transaction — must be called inside the check-in command's own `applyMutation`, mirroring how `openOrEscalateDeviationCase` is called from inside `recordMeasurement`.
- `completeObligation(client, {organizationId, referenceType, referenceId, obligationType, completedViaCommand})`: `UPDATE ... WHERE status='open'` — a second/retried call matches zero rows, harmless idempotent no-op. **This is the literal mechanism for AC-013** ("MyWork completion handler → `POST .../check-ins`"): the route/command that records a check-in should call `completeObligation` with `obligationType: 'check_in'` (or whatever this epic names it) for the corresponding KR, referencing the deterministic dedup key the obligation was created with.
- `attachSourceEventId`: a second-step pattern for callers whose triggering event is only known post-INSERT of the `rvn_platform_events` row — likely NOT needed here if the check-in command follows `kpiDeviationCommands.ts`'s own pattern of manually inserting its platform-events row and getting `event_id` synchronously in the same transaction (per the file's own header note about `openOrEscalateDeviationCase`).

### 4.5 One correction to an initial framing (from the task's own prompt), found by direct read

The task's own framing suggested `rvn_kpi_definitions.current_definition_version_id` as an example of "a denormalized pointer" analogous to a possible write-through target for OKR check-ins. Direct read of `20260810_rvn_kpi_core.sql` shows this is **not actually analogous** to a measurement-*value* pointer: `current_definition_version_id` points at which **policy/schema version** (`rvn_kpi_definition_versions`) currently governs the KPI — a structural/definitional pointer, not a "latest value" cache. **`rvn_kpi_definitions` has NO column caching the KPI's current measured value at all** — `recordMeasurement` never touches `rvn_kpi_definitions`; every "current value" read goes through `kpiRepository.ts`'s live `NOT EXISTS`-filtered query (§4.2 above). This matters directly for Decision (C) below: the real precedent for "does a KPI/OKR/ROI definition-level row get a value written through to it" is **negative** in KPI's case, and the real precedent for "does a case/aggregate-level row get a pointer column updated by a child-aggregate-creating command" is ROI's `current_forecast_version_id`/`current_actual_snapshot_id` — confirmed by direct read of `roiForecastVersionCommands.ts`/`roiActualSnapshotCommands.ts`:

```typescript
// roiForecastVersionCommands.ts — loadRoiCaseForUpdate
async function loadRoiCaseForUpdate(client: PoolClient, caseId: string, organizationId: string) {
  const result = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}
// ... later, inside the same transaction as the new forecast-version INSERT:
// "Decision D6: current_forecast_version_id always moves to the latest."
await client.query(
  `UPDATE rvn_roi_cases SET current_forecast_version_id = $1, row_version = $2, updated_by = $3, updated_at = now()
     WHERE case_id = $4`,
  [forecastVersionId, currentRowVersion + 1, updatedBy, caseId]
);
```

**This is the exact mechanism this design borrows for (C)/(D) below**: a child-aggregate-creating command (here, `recordCheckIn`) locks the parent row with `SELECT ... FOR UPDATE` inside its own `applyMutation` (same transaction as its own INSERT), then issues a plain `UPDATE` against the parent's own columns with an incremented `row_version` — **not** a caller-supplied `expectedVersion`/CAS the way `executeAtomicCommand`'s normal edit-path works, because the child command itself decides the pointer always advances to "whatever I just created" (ROI-E004 D6: "always moves to the latest," no override contest). This resolves the concurrency question this design's own analysis in §4.1-4.4 left open: `FOR UPDATE` on the KR row (and, separately, on the Set row) inside `recordCheckIn`'s transaction serializes it correctly against any concurrent OKR-E003 KR-edit command, which will use the identical `loadForUpdate`-then-CAS shape via `executeAtomicCommand`.

---

## 5. Design decisions (D1-D14)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Check-in aggregate scope: Set, Objective, or KR? | **Key Result.** `okr_vnext_checkins.key_result_id` is the aggregate's real identity; `objective_id`/`set_id` are denormalized on the row for query convenience only. | Directly given by the AC table's own Command/API cell: `GET/POST .../key-results/:id/check-ins`. Plan §4.7's `OKRCheckIn` schema names all three ids, but the API route is the load-bearing fact — same "route/API cell over YAML prose" precedent OKR-E002 used repeatedly. |
| D2 | How is "check-in idempotentny per KR+okno cadence" (AC-010) enforced at the DB level? | **Partial unique index**: `UNIQUE (key_result_id, cadence_occurrence_id) WHERE correction_of_checkin_id IS NULL` — first original write for a (KR, window) pair wins, corrections are unconstrained (many allowed over time). | **Exact structural mirror** of `ux_rvn_kpi_measurements_period` (`UNIQUE (kpi_id, period_start, period_end) WHERE correction_of_measurement_id IS NULL`, `20260810_rvn_kpi_core.sql`) — same "first writer for a given period/window wins" idempotency mechanism, confirmed by direct read, not invented here. |
| D3 | Since `okr_vnext_checkin_occurrences` is Cycle-scoped (one row per window, shared by every KR in the Cycle — confirmed in §2.1), does the FK to it alone give per-KR idempotency? | **No — this is exactly why D2's unique index is composite** (`key_result_id, cadence_occurrence_id`), not just `cadence_occurrence_id` alone. | Direct structural consequence of OKR-E001's P11 shell: the occurrence row identifies the *window*, not "this KR's check-in slot." Flagging this explicitly because it is the one place a naive reader of OKR-E001's schema could mis-design a single-column unique index and silently allow duplicate check-ins across different KRs in the same window (harmless) but ALSO silently allow duplicate *original* check-ins for the SAME KR if the join were built wrong — worth stating as a landmine avoided, not assumed obvious. |
| D4 | Auto-convert a second `recordCheckIn` call for an already-checked-in (KR, occurrence) into a correction, or reject and require an explicit `correctCheckIn` call? | **Reject.** `recordCheckIn`'s `applyMutation` catches the `23505` unique-violation on `ux_okr_vnext_checkins_kr_occurrence_original` (SAVEPOINT-wrapped, same shape `createOkrSet`/`createRoiCase` use for THEIR duplicate-prevention, not a naive catch-without-SAVEPOINT which fails with `25P02` — that exact bug already found and fixed once in this program per OKR-E001 §4.1's own dedup discussion) and throws `OkrCheckInAlreadyExistsForOccurrenceError` (409, names the existing `checkin_id`). Caller (route/UI) must call `POST .../key-results/:id/check-ins/:checkinId/correct` instead. | KPI's `recordMeasurement`/ROI's `recordActualEntry` never auto-convert either — both are separate, explicitly-named commands the caller chooses between. Silent auto-conversion would also violate AC-010's own wording: "ponowne zgłoszenie w oknie = korekta" describes what the *outcome* must be (a correction, not an overwrite), not that the *same command* silently reinterprets itself — the explicit-command-choice shape is what every other append-only aggregate in this program already does. |
| D5 | Confidence field shape — the plan's own YAML gives `confidence: high \| medium \| low \| numeric \| null`, an ambiguous union that isn't directly expressible as one SQL column. | **Two nullable columns**: `confidence_label TEXT NULL CHECK (confidence_label IN ('high','medium','low'))` and `confidence_numeric NUMERIC NULL`. Command-layer validation (not a DB CHECK) enforces "exactly one is populated, matching the Program's `confidence_model`" — deferred to application code because it is a cross-table business rule (needs the Program's `confidence_model` loaded), the same class of rule OKR-E001 P9 explicitly kept out of a DB CHECK. | Same judgment call OKR-E001 P5/OKR-E002 D4 made repeatedly: resolve an ambiguous plan-doc union type against real column types explicitly, state the resolution, don't silently pick one arm of the union and call it "the" type. |
| D6 | Does a check-in write through to the KR's `current_value`/`progress`/`confidence`/`status`, or are those always derived live from the check-in history? | **Write-through**, inside `recordCheckIn`'s own `applyMutation`, using the ROI-E004 D6 pointer-update pattern (§4.5): `SELECT * FROM okr_vnext_key_results WHERE key_result_id=$1 FOR UPDATE`, compute new `progress`/`confidence`/`status` from the KR's stored geometry + the Program's policy (calling OKR-E003's progress-calc service — see §9 open question on its exact exported signature, not yet confirmed since E003 isn't frozen), then `UPDATE ... SET current_value=$, progress=$, confidence_label=$, confidence_numeric=$, status=$, row_version=row_version+1, updated_at=now() WHERE key_result_id=$1`. | Corrects an initial mis-mapping (§4.5): KPI's `rvn_kpi_definitions` has **no** value-caching column at all (measurements are always live-queried) — that is NOT the applicable precedent here, because unlike `rvn_kpi_definitions`, the plan's own `KeyResult` schema (§4.6) already has `current_value`/`progress`/`confidence`/`status` as first-class KR fields, not KPI-style "look it up from the child table every time." The applicable precedent is ROI-E004 D6's pointer-update shape, generalized from "pointer to a version id" to "denormalized computed values," because OKR-E003's KR row is expected to carry them directly per its own plan-doc schema. |
| D7 | Does the check-in command bypass OKR-E003's own KR-edit CAS path (`updateKeyResult` or similar, once E003 lands), and is that safe? | **Yes, it bypasses it, and it's safe by the same `FOR UPDATE` mechanism ROI-E004 D6 already uses**: `recordCheckIn` locks the KR row itself (not via `executeAtomicCommand`'s caller-supplied `expectedVersion`, since check-in doesn't know or care what version the caller last saw — it always wins over whatever's there, mirroring "always moves to latest"), which correctly serializes against a concurrent OKR-E003 edit command (which will use `executeAtomicCommand`'s own internal `loadForUpdate`/CAS, itself backed by row-level locking). | Direct extension of the ROI-E004 D6 mechanism (§4.5) to a second table. **Flag forward, explicitly, in the closure entry**: OKR-E003's implementer must be told a SECOND writer (`recordCheckIn`) touches `okr_vnext_key_results`' `row_version`/`current_value`/`progress`/`confidence`/`status` columns outside its own command surface — same class of cross-epic heads-up OKR-E002 gave OKR-E003 about `isOkrSetReadyForSubmissionEligible` needing to be wrapped, not replaced. |
| D8 | Does the check-in command also write through to the **Set**-level `overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/`next_checkin_due_at`? | **Yes, eagerly, in the same transaction** — `SELECT * FROM okr_vnext_sets WHERE set_id=$1 FOR UPDATE`, recompute by aggregating live over the Set's current Objectives/KRs (a join query, not a second denormalized layer), `UPDATE` with `row_version+1`. | Direct application of ROI-E004 D9's "both, for different jobs" split (§3): KR-level progress is the "always-fresh, derived-from-source" job (technically also stored per D6, but derivable), Set-level rollup is the "stored, periodically-updated, cheap-to-list" job. Eager-in-transaction (not a background job) because **no live cron/job-scheduler infrastructure exists anywhere in this program yet** — OKR-E001 P10 confirms `okrCycleScheduler.ts` is "pure, directly-callable functions... wiring an actual periodic trigger is out of scope," so eager write-in-transaction is the only mechanism actually available without inventing new platform infrastructure this epic has no mandate to build. |
| D9 | Rollup formula for Set-level `overall_progress`/`overall_confidence`? | **Program-policy-driven** (`objective_rollup_model: equal_average \| weighted_average \| manual \| none`, `objective_confidence_model: lowest_kr \| owner_selected \| custom` — both already defined on `okr_vnext_programs` per OKR-E001's DDL), delegated to a new, small, exported, directly-testable pure function `computeSetRollup(objectives, policy)`, not inlined in the command. Objectives with `status='cancelled'` excluded from the average; a Set with zero non-cancelled Objectives (or all `not_calculable` KRs) yields `overall_progress=null`/`overall_confidence=null`, never a fabricated `0`. | Mirrors OKR-F-009-AC-02's own requirement ("every calculated value stores calculation policy/version and reason") applied one level up, and AC-011's explicit "never synthetic 0%" carried through to the Set level, not just the KR level. `objective_rollup_model`/`objective_confidence_model` are read directly off the already-landed (per OKR-E001 DDL) Program row — no new policy field invented. |
| D10 | Rollup formula for `last_checkin_at`/`next_checkin_due_at`? | `last_checkin_at = MAX(checkin.submitted_at)` across every KR belonging to the Set (a live aggregate query, cheap — bounded by the Set's own KR count). `next_checkin_due_at = MIN(occurrence.window_end)` across every **open** occurrence (i.e. `window_end >= now()`) for the Set's Cycle for which **at least one** of the Set's KRs has no original check-in yet — i.e. "the most urgent still-open obligation this Set owes." `NULL` when every KR is current through the latest generated occurrence. | Not directly given by any AC or the plan doc (which names the columns but not their exact formula) — a genuine, explicitly-flagged design addition, same posture OKR-E001 §6.5/OKR-E002 D15 took toward `cancelOkrSet`: stated as an addition, not silently invented. The "most urgent pending" framing is the only reading that makes `next_checkin_due_at` useful for a list/attention view (the whole point of denormalizing it) — an alternative "earliest occurrence regardless of completion" reading would make the column true-but-useless once any check-in exists. |
| D11 | Does `recordCheckIn` create/complete MyWork obligations (AC-013)? | **Yes.** `recordCheckIn` calls `completeObligation(client, {referenceType:'okr_key_result', referenceId: keyResultId, obligationType:'check_in', completedViaCommand:'recordCheckIn'})` inside its own `applyMutation` — matching AC-013's literal text ("MyWork completion handler → `POST .../check-ins`... Completing it invokes a domain command; it does not create a parallel OKR copy"). Obligation **creation** (the other half) is NOT this command's job — it is the missed-cadence scheduler's job (§7, D13) and, at minimum, an initial obligation seeded when a Cycle's occurrence is generated (a hook this epic adds onto `generateCadenceOccurrences`, or a new pass after it — see D13). | AC-013's own text is specifically about *completion*, matching `completeObligation`'s own idempotent, harmless-no-op-on-retry shape exactly (§4.4). Creation is handled separately because a check-in obligation logically exists BEFORE any check-in happens (it is what makes the check-in "due" in the first place) — creating it only reactively inside `recordCheckIn` itself would be circular. |
| D12 | Self-verification-denial (ROI-E004 D10 precedent) — does OKR-E004 need an analogous check? | **No.** No AC uses "verifier" role language for check-ins (contrast ROI-E004 AC-03's literal "Actual Verifier role"); the AC-010 Roles cell names "KR Owner, Manager" where "Manager" reads as respond/escalate access (plan §7.3: "manager responds rather than overwriting owner evidence"), not a countersignature step. Building a self-verification check here would be importing ROI's stronger financial-stakes posture into a domain whose own AC table doesn't ask for it — exactly the mistake D9/D10's own methodology (read the AC's literal wording, don't structurally clone a sibling domain's strengthening) warns against. | Direct application of the analytical method ROI-E004 D9/D10 itself models, reasoned through in full in §3 above. |
| D13 | Own error class or reuse KPI's/ROI's? | **Own classes**: `OkrCheckInAlreadyExistsForOccurrenceError`, `OkrCheckInNotFoundError`, `OkrCheckInValidationError`. | Established per-aggregate pattern in this program (`KpiMeasurementNotFoundError` → `RoiActualEntryNotFoundError` → this epic's own) — never reused across aggregates, confirmed by direct read of both prior files. |
| D14 | Does `okr_vnext_checkins` get its own `RVN_RESOURCE_TYPES`/ABAC visibility row? | **No.** Inherits Set visibility transitively via `key_result_id → (future) okr_vnext_key_results.objective_id → okr_vnext_objectives.okr_set_id → okr_vnext_sets`. No new resource type. | Matches OKR-E002 D13's own stated posture for `okr_vnext_approved_snapshots`/`okr_vnext_set_versions`: "carry no visibility row of their own — inherit via `set_id`." Same reasoning applies one level deeper here — no AC asks for per-check-in visibility finer than the Set's own. |

---

## 6. Schema (DDL sketch)

Migration file: `server/migrations/20260824_rvn_okr_checkin.sql` (naming convention: sequential date after E001's `20260822`/E002's `20260823`; **verify no collision with an actual landed date once E001/E002's true merge dates are confirmed** — flagged per §2.3's standing concern that neither may be landed yet).

```sql
-- ============================================================
-- okr_vnext_checkins — root aggregate #4. Append-only, per-KR-per-window.
-- FK to OKR-E001's okr_vnext_checkin_occurrences per handoff Decision P11
-- (OKR_E001_DESIGN.md: "adds its own okr_vnext_checkins table with a real
-- FK to this one — no ALTER on this table required later").
--
-- FORWARD-REFERENCE WARNING: key_result_id/objective_id/set_id FKs below
-- assume OKR-E003's okr_vnext_key_results/okr_vnext_objectives tables exist
-- with the column names given in 04_OKR_IMPLEMENTATION_PLAN.md §4.5/§4.6.
-- OKR-E003 has NO frozen design doc as of this draft (confirmed: no
-- OKR_E003_DESIGN.md in docs/product/results-vnext/) — this epic's
-- implementer MUST re-verify these FK targets against OKR-E003's actual
-- landed schema before running this migration, exactly the "standing
-- re-verification" discipline OKR-E002 imposed on itself toward OKR-E001.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_checkins (
  checkin_id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              TEXT NOT NULL,

  key_result_id                 UUID NOT NULL REFERENCES okr_vnext_key_results(key_result_id),
  -- Denormalized for query convenience only (D1) — NOT the aggregate's
  -- identity. Populated from the KR's own objective_id/okr_set_id at
  -- insert time, read-only thereafter (never independently updatable).
  objective_id                   UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  set_id                          UUID NOT NULL REFERENCES okr_vnext_sets(set_id),

  cadence_occurrence_id            UUID NOT NULL REFERENCES okr_vnext_checkin_occurrences(cadence_occurrence_id),

  previous_value                    NUMERIC NULL,
  new_value                          NUMERIC NULL,
  calculated_progress                 NUMERIC NULL,

  owner_declared_status                 TEXT NULL
                                          CHECK (owner_declared_status IN (
                                            'not_started','on_track','at_risk','off_track',
                                            'achieved','not_achieved','cancelled'
                                          )),
  system_suggested_status                TEXT NULL
                                          CHECK (system_suggested_status IN (
                                            'not_started','on_track','at_risk','off_track',
                                            'achieved','not_achieved','cancelled'
                                          )),

  -- D5: plan's single ambiguous `confidence` union resolved into two real
  -- columns; command layer enforces exactly-one-populated against the
  -- Program's confidence_model, not a DB CHECK (cross-table rule).
  confidence_label                        TEXT NULL CHECK (confidence_label IN ('high','medium','low')),
  confidence_numeric                       NUMERIC NULL,

  note                                      TEXT NOT NULL,
  blocker                                    TEXT NULL,
  support_requested                           TEXT NULL,
  evidence_refs                                JSONB NOT NULL DEFAULT '[]',

  -- Append-only correction chain (D2/D4) — NULL = original recording,
  -- participates in the "one row per KR+window" uniqueness below. Never an
  -- UPDATE of a prior row (REVOKE below makes this impossible even for the
  -- owner connection in intent).
  correction_of_checkin_id                      UUID NULL REFERENCES okr_vnext_checkins(checkin_id),
  correction_reason                              TEXT NULL,

  submitted_by                                    TEXT NOT NULL,
  submitted_at                                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AC-010 idempotency (D2/D3): composite because okr_vnext_checkin_occurrences
-- is Cycle-scoped, not KR-scoped (§2.1) — one row per window is shared
-- across every KR, so the KR must be part of the uniqueness key.
CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_checkins_kr_occurrence_original
  ON okr_vnext_checkins(key_result_id, cadence_occurrence_id)
  WHERE correction_of_checkin_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_kr
  ON okr_vnext_checkins(organization_id, key_result_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_set
  ON okr_vnext_checkins(organization_id, set_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_correction_of
  ON okr_vnext_checkins(correction_of_checkin_id) WHERE correction_of_checkin_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_okr_vnext_checkins_occurrence
  ON okr_vnext_checkins(organization_id, cadence_occurrence_id);

-- Same append-only limitation as rvn_kpi_measurements/rvn_roi_actual_entries
-- (documented there): REVOKE from PUBLIC does not stop an owner/superuser
-- connection — no named least-privilege application role exists yet in this
-- program. Structural intent is still expressed here.
REVOKE UPDATE, DELETE ON okr_vnext_checkins FROM PUBLIC;
```

No changes to `okr_vnext_checkin_occurrences` (per the P11 handoff's explicit "no ALTER on this table required later" — confirmed honored: this migration only adds a new table + a downstream FK reference, never touches E001's table).

No `ALTER TABLE okr_vnext_sets` needed either — D8/D9/D10's write-through targets the five columns E002 already reserved (`overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/`next_checkin_due_at`), confirmed present verbatim in E002's frozen DDL (§2.2). This epic is, structurally, the payoff of both prior epics' "reserve now, no ALTER later" discipline — worth stating plainly since it's the clearest evidence that discipline worked as intended.

---

## 7. Command layer (`server/src/services/resultsVnext/okr/`)

### 7.1 `recordCheckIn` — `okrCheckInCommands.ts`, `executeAtomicCreate`

```typescript
export interface RecordCheckInInput {
  keyResultId: string;
  organizationId: string;
  cadenceOccurrenceId: string;
  newValue: number | null;
  ownerDeclaredStatus?: KeyResultStatus | null;
  confidenceLabel?: 'high' | 'medium' | 'low' | null;
  confidenceNumeric?: number | null;
  note: string;                       // required — plan §4.7 `note: text` (no null arm)
  blocker?: string | null;
  supportRequested?: string | null;
  evidenceRefs?: unknown[];
  submittedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function recordCheckIn(
  input: RecordCheckInInput
): Promise<AtomicCommandOutcome<{ checkIn: OkrCheckIn; keyResult: OkrKeyResult; set: OkrSet }>>
```

Inside `applyMutation` (single pinned client, single transaction):
1. **SAVEPOINT-wrapped INSERT** into `okr_vnext_checkins` (`correction_of_checkin_id = NULL`) — catch `23505` on `ux_okr_vnext_checkins_kr_occurrence_original`, `ROLLBACK TO SAVEPOINT`, throw `OkrCheckInAlreadyExistsForOccurrenceError` naming the existing `checkin_id` (D4). Same SAVEPOINT-not-naive-catch discipline `createOkrSet`/`createRoiCase` already established (a plain catch-and-report without the SAVEPOINT leaves the whole transaction in Postgres's aborted `25P02` state — that exact bug already found and fixed once in this program).
2. `SELECT * FROM okr_vnext_key_results WHERE key_result_id=$1 AND organization_id=$2 FOR UPDATE` (D6/D7's borrowed ROI-E004 D6 lock-then-pointer-update shape).
3. `previous_value = keyResultRow.current_value`; write it onto the just-inserted checkin row (a second, targeted `UPDATE okr_vnext_checkins SET previous_value=$1 WHERE checkin_id=$2` — cheaper than restructuring step 1 to know it beforehand, since the KR lock in step 2 happens after the checkin INSERT to keep the SAVEPOINT/duplicate-catch logic in step 1 simple and self-contained).
4. Compute `calculated_progress`/`system_suggested_status` from the KR's geometry (`direction`/`baseline_value`/`target_value`/`range_min`/`range_max` per plan §5.4's five geometries) + `newValue` — calling OKR-E003's progress-calc service function (exact export name TBD, not yet frozen — §9 open question). Degenerate/missing inputs yield `not_calculable`/`null`, never a fabricated value (same discipline as `okr_vnext_key_results.progress` itself, OKR-F-009-AC-01).
5. `UPDATE okr_vnext_key_results SET current_value=$1, progress=$2, confidence_label=$3, confidence_numeric=$4, status=$5, row_version=row_version+1, updated_at=now() WHERE key_result_id=$1`.
6. `SELECT * FROM okr_vnext_sets WHERE set_id=$1 FOR UPDATE`; load all live (non-cancelled) Objectives/KRs for the Set; `computeSetRollup(...)` (§7.3); `UPDATE okr_vnext_sets SET overall_progress=$, overall_confidence=$, attention_state=$, last_checkin_at=now(), next_checkin_due_at=$, row_version=row_version+1, updated_at=now() WHERE set_id=$1`.
7. `completeObligation(client, {organizationId, referenceType:'okr_key_result', referenceId: keyResultId, obligationType:'check_in', completedViaCommand:'recordCheckIn'})` (D11/AC-013).
8. If `confidenceLabel === 'low'`: `createObligation(client, {..., obligationType:'explain_low_confidence', deduplicationKey: \`okr_explain_low_confidence:${keyResultId}:${cadenceOccurrenceId}\`})` — mirrors `recordMeasurement`'s synchronous, same-transaction `openOrEscalateDeviationCase` call (§4.1) applied to the plan's own named `explain low confidence` obligation type (plan §13).

`OkrCheckInValidationError('KR_NOT_ACTIVE', ...)` if the KR's own Set is not `status='active'` (a check-in against a draft/closed Set's KR makes no sense) — guard checked at step 2 against the loaded KR/Set state before any further work; exact status-gating rule to confirm once OKR-E003 defines `okr_vnext_key_results.status`'s own lifecycle (§9).

### 7.2 `correctCheckIn` — `executeAtomicCreate`

Mirrors `correctMeasurement`/`correctActualEntry` exactly: shared `insertSupersedingCheckIn(client, params)` helper, looks up the original row by `checkin_id`, INSERTs a new row with `correction_of_checkin_id` set, `correctionReason` required. Re-runs steps 4-8 of §7.1 against the **superseding** row's values (a correction can change `new_value`/confidence, so it can produce a new KR progress/Set rollup fact — same "correction re-runs the reactive side effects" pattern `correctMeasurement` uses for `openOrEscalateDeviationCase`, §4.1). Does **not** re-run step 7 (`completeObligation`) — the obligation was already completed by the original `recordCheckIn`; a correction to an already-checked-in window does not reopen it.

```typescript
export interface CorrectCheckInInput {
  checkinId: string;
  organizationId: string;
  newValue: number | null;
  ownerDeclaredStatus?: KeyResultStatus | null;
  confidenceLabel?: 'high' | 'medium' | 'low' | null;
  confidenceNumeric?: number | null;
  correctionReason: string;   // required, matching KPI/ROI's correctionReason
  submittedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
}

export async function correctCheckIn(
  input: CorrectCheckInInput
): Promise<AtomicCommandOutcome<{ original: OkrCheckIn; superseding: OkrCheckIn; keyResult: OkrKeyResult; set: OkrSet }>>
```

No `verifyCheckIn`/`disputeCheckIn` (D12 — no AC warrants a verifier role for check-ins, unlike ROI-E004's AC-03).

### 7.3 `computeSetRollup` — pure function, `okrSetRollupCalculator.ts` (new file, not inlined in the command)

```typescript
export interface ComputeSetRollupInput {
  objectives: Array<{ objectiveId: string; status: string; progress: number | null; confidence: { label: string | null; numeric: number | null } }>;
  keyResults: Array<{ objectiveId: string; status: string; progress: number | null }>;
  policy: { objectiveRollupModel: 'equal_average' | 'weighted_average' | 'manual' | 'none'; objectiveConfidenceModel: 'lowest_kr' | 'owner_selected' | 'custom' };
  openCheckInsRemaining: Array<{ keyResultId: string; nextOccurrenceWindowEnd: string }>; // D10
  now: Date;
}

export interface ComputeSetRollupResult {
  overallProgress: number | null;
  overallConfidence: { label: string | null; numeric: number | null };
  attentionState: 'none' | 'watch' | 'action_required' | 'escalated';
  nextCheckinDueAt: string | null;
  reason: string;   // audit trail, mirrors OKR-F-009-AC-02's "every calculated value stores ... reason"
}

export function computeSetRollup(input: ComputeSetRollupInput): ComputeSetRollupResult
```

`objective_rollup_model='none'` → `overallProgress=null` always (an explicit Program choice not to roll up, not a missing-data case). `'equal_average'`/`'weighted_average'` average non-cancelled Objectives' own `progress` (which is itself already rolled up from KRs by OKR-E003's own KR→Objective rollup, out of this epic's scope to recompute — this function consumes Objective-level progress, does not re-derive it from KRs directly, keeping the two rollup layers cleanly separated). `attentionState` derivation is the one piece of this function **explicitly flagged as needing a real policy-versioned mapping this epic cannot fabricate** — see §9 Open Questions; a first honest cut, stated as such: `'watch'` if any KR is stale (past-due occurrence, no check-in) or any confidence is `'low'`; `'action_required'` if progress trails expected trajectory by a program-undefined margin (no threshold field exists on `okr_vnext_programs` today — flagged, not invented) AND confidence is not `'high'`; `'escalated'` never set by this function (reserved for a human/manager action, presumably OKR-E006's job, per its "Manager attention queue" read-model ownership — this function only ever proposes `none`/`watch`/`action_required`).

### 7.4 `okr_vnext_checkins` visibility inheritance helper — none needed as a command; see §9.

---

## 8. Attention/escalation and missed-cadence handling (D, E, F)

### 8.1 What "missed check-in" means operationally, given E001's Cycle-scoped occurrences

Because `okr_vnext_checkin_occurrences` rows are generated by `generateCadenceOccurrences` (E001, unmodified — §2.1) at the Cycle level, and because no live cron exists (P10), a KR can only be known to have "missed" a window once (a) the occurrence row exists (scheduler has run at least once since the window opened) and (b) something explicitly checks whether the window has closed without a check-in. Two touchpoints own this, both new to E004:

### 8.2 Obligation seeding — `okrCheckInScheduler.ts` (new file; does NOT modify OKR-E001's `okrCycleScheduler.ts`)

```typescript
/**
 * Calls E001's generateCadenceOccurrences (imported, unmodified — the P11
 * handoff's "no ALTER" covers the table; this function additionally seeds
 * per-KR obligations for any NEWLY created occurrence, which E001 itself
 * has no reason to know about since okr_vnext_checkins didn't exist yet
 * when E001 was designed).
 */
export async function generateCadenceOccurrencesAndSeedCheckInObligations(
  input: { organizationId: string; cycleId: string }
): Promise<{ occurrencesCreated: number; obligationsSeeded: number }>
```

For every newly-created occurrence (the `created` count from `generateCadenceOccurrences`, re-queried by `window_start` to get their ids — `generateCadenceOccurrences` itself only returns a count, not the row ids; **this function needs the actual new rows, so it either re-queries `WHERE generated_at >= <call-time>` or E001's function needs a return-shape extension — flagged as a possible small, additive change to `okrCycleScheduler.ts`'s return type, not a schema ALTER, so still consistent with the P11 handoff's letter if not literally its silence on the function signature**), for every live (non-cancelled) KR belonging to a Set in that Cycle: `createObligation(client, {organizationId, assigneeUserId: keyResult.ownerUserId, referenceType:'okr_key_result', referenceId: keyResultId, obligationType:'check_in', dueAt: occurrence.windowEnd, cadenceOccurrenceId: occurrence.cadenceOccurrenceId, deduplicationKey: \`okr_checkin:${keyResultId}:${occurrence.cadenceOccurrenceId}\`})`. Idempotent via `createObligation`'s own `ON CONFLICT DO NOTHING` (§4.4) — safe to re-run.

### 8.3 Missed-window detection/escalation — `detectAndFlagMissedCheckIns` (`okrCheckInScheduler.ts`)

```typescript
/**
 * For every occurrence in the Cycle whose window_end has passed 'now' (asOf),
 * finds every KR with an OPEN check_in obligation for that occurrence (i.e.
 * never completed — completeObligation only fires from recordCheckIn/
 * correctCheckIn) and, for each affected Set, re-runs computeSetRollup with
 * the current (stale) state — which will surface 'watch'/'action_required'
 * per §7.3's staleness rule — and writes the recomputed attention_state/
 * overall_* back (same FOR UPDATE + UPDATE shape as recordCheckIn §7.1 step
 * 6, just triggered by the scheduler instead of a check-in). Pure,
 * directly-callable, not wired to a live cron — same P10 posture as
 * proposeAndExecuteDueCycleTransitions.
 */
export async function detectAndFlagMissedCheckIns(
  input: { organizationId: string; cycleId: string; asOf?: Date }
): Promise<{ setsReassessed: number; obligationsStillOpen: number }>
```

This is what actually satisfies AC-011's "brak check-in → stale/attention, NIGDY syntetyczne 0%" for Sets that receive no check-in activity at all: without this function, a Set's `attention_state` would only ever update reactively (when SOME check-in happens on ANY of its KRs, §7.1 step 6) and would never independently notice "an entire window closed with nothing recorded." Not wired to a live trigger (P10) — **this is a real, named operational gap**: between scheduler runs, `attention_state` can be stale. Mitigated at read time (§8.4).

### 8.4 Read-time staleness overlay (defensive, not persisted)

`getOkrSet`/`listOkrSets` (repository, not command) additionally computes an **ephemeral, response-only** `isOverdue: boolean = next_checkin_due_at !== null && next_checkin_due_at < now()` field on top of the stored `attention_state`, so a UI reading a Set between scheduler runs still sees the true deadline state even if `detectAndFlagMissedCheckIns` hasn't run recently. This does NOT get written to the DB (avoiding a second, competing write path for the same column) — purely a computed field in the read projection, the same "read overlay vs. stored best-current-guess" split ROI-E004 D9 uses between live `/compare` and stored `rvn_roi_variances` (§3).

---

## 9. Isolating AC-012 — the suggested-value service (`okrCheckInSuggestionService.ts`)

AC-012 is explicitly the "isolating AC" in the ledger — it exists to block a **specific, already-confirmed** legacy defect from crossing into vNext: `okrService.ts::getSuggestedValueForKeyResult` today "reads `kpi_time_series` directly" and "imports `kpiDefinitionService.js`" (OKR-E001 design doc §0, itself confirmed by direct code read during E001's own drafting). The AC's Schema/migration/constraint cell states this in the strongest possible terms: **"BRAK FK z `okr_vnext_*` do `kpi_*`"**.

```typescript
/**
 * AC-F-012-AC-01: this function NEVER queries kpi_time_series, NEVER imports
 * anything from server/src/services/kpiDefinitionService.js (legacy) or
 * server/src/services/resultsVnext/kpi/* (vNext — equally forbidden, D09 is
 * about cross-domain coupling in general, not just the legacy path
 * specifically), and the KR schema carries NO FK to any kpi_* table.
 *
 * "Typed optional reference, NIE strukturalny odczyt" (AC table, Schema
 * cell): a KR MAY carry a caller-supplied, unvalidated, opaque text
 * reference (e.g. "see KPI dashboard X") purely as a human-readable pointer
 * — never resolved, joined, or dereferenced by this service. If OKR-E003's
 * KeyResult schema ends up with a field for this (not confirmed — E003 is
 * unfrozen), it must be a plain nullable TEXT column with zero FK, exactly
 * matching D09's own established shape for cross-domain references
 * elsewhere in this program (typed optional reference records, not
 * structural ownership — 04_OKR_IMPLEMENTATION_PLAN.md §10, verbatim).
 *
 * What this function CAN do: read the KR's own check-in HISTORY
 * (okr_vnext_checkins, this epic's own table) to suggest "your last 3
 * check-ins trended +5%/window, a naive linear suggestion for this window is
 * X" — a suggestion derived PURELY from the OKR domain's own data, never
 * from KPI's.
 */
export function suggestNextCheckInValue(
  priorCheckIns: OkrCheckIn[],
  keyResult: OkrKeyResult
): { suggestedValue: number | null; basis: 'linear_trend' | 'no_history' | 'not_calculable' }
```

Roles/visibility cell confirms this is UI-facing only: "KR Owner (widzi sugestię, nie źródło KPI)" — the suggestion is surfaced to the person doing the check-in, with no provenance claim back to any KPI source (because there is none). This keeps Teresa's own later check-in-assistance capability (plan §12, `POST .../advisor/check-in`, OKR-E008) similarly clean: Teresa can call this same pure function for its own "prefill" suggestion, never reaching into KPI data either — same safety contract plan §12 already states for Teresa generally ("never invents current value... facts, inference, and recommendation are visibly separated").

**Not exposed over HTTP as its own route** — called internally by `GET .../key-results/:id/check-ins` (or a dedicated lightweight endpoint if the UI needs it separately; the AC table names no dedicated route, consistent with "wewnętrzny" in its Command/query/API cell).

---

## 10. Visibility (G)

`okr_vnext_checkins` gets **no own ABAC resource-visibility row** (D14) — inherits via the chain `key_result_id → objective_id → set_id`, matching OKR-E002's own established posture for `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` ("carry no visibility row of their own — inherit via `set_id`").

Reads (`listCheckIns`/`getCheckIn` in a new `okrCheckInRepository.ts`) go through `wrapWithVisibilityScope({ resourceType: 'okr_set' })` joined against the **Set's own** visibility row, not a new resource type — the join path is `okr_vnext_checkins.set_id` (denormalized, D1) directly to `rvn_platform_resource_visibility.resource_id`, avoiding an extra hop through `objective_id`/`key_result_id` for this specific query shape (acceptable because `set_id` is stored redundantly on the checkin row precisely for this).

**Mandatory `::text` cast, restated explicitly per the standing warning both OKR-E001 and OKR-E002 give this exact bug its own paragraph over**: `rvn_platform_resource_visibility.resource_id` is `TEXT`; `okr_vnext_checkins.set_id`/`okr_vnext_sets.set_id` are `UUID` — every join must cast `::text`. OKR-E002's own design doc calls this "the single most-repeated real bug in this program" (7 times in one KPI epic alone) — this epic's realDB test suite must include an explicit `okrCheckInVisibilityJoin.realdb.test.ts` proving the cast is present, mirroring `okrSetVisibilityJoin.realdb.test.ts`'s own shape.

`GET .../key-results/:id/check-ins` additionally needs `key_result_id`'s own visibility to resolve BEFORE the check-in list query runs (a KR belongs to exactly one Objective/Set — visibility is fully determined by the Set once OKR-E003 lands, so this is a two-step lookup: resolve `key_result_id → set_id` first, `wrapWithVisibilityScope` against that `set_id`, then query `okr_vnext_checkins` — not a query-time join against three tables, for the same performance reason OKR-E002's own `listOkrSets` avoids over-joining).

---

## 11. API surface (`server/src/routes/resultsVnext/okr.routes.ts`, extended — same file as E001/E002)

| Method | Path | Command/Repository | Notes |
|---|---|---|---|
| `GET` | `/key-results/:keyResultId/check-ins` | `listCheckIns` | Matches AC-010's own Command/query/API cell verbatim; visibility per §10 |
| `POST` | `/key-results/:keyResultId/check-ins` | `recordCheckIn` | 409 `OkrCheckInAlreadyExistsForOccurrenceError` on duplicate-in-window |
| `POST` | `/key-results/:keyResultId/check-ins/:checkinId/correct` | `correctCheckIn` | |
| `GET` | `/key-results/:keyResultId/check-ins/:checkinId/suggested-next-value` | `suggestNextCheckInValue` (§9) | Optional dedicated route if the UI wants it separate from the record form's own prefill call — not AC-mandated as its own route, added for a plausible real UI need, flagged not silently assumed |

Explicitly NOT in this package: any route under `/advisor/check-in` (Teresa — OKR-E008), `/attention` (Manager attention queue read model — OKR-E006, though it consumes this epic's `attention_state` writes), `/sets/:id/close`/`/carry-forward` (OKR-E007).

Error mapping (extends OKR-E001/E002's existing table in the same file): `OkrCheckInAlreadyExistsForOccurrenceError`→409, `OkrCheckInNotFoundError`→404, `OkrCheckInValidationError`→409, Zod→400, unknown→500. `AtomicWriteConflictError`/`AtomicWriteAggregateNotFoundError` mappings already exist from E001/E002, reused as-is.

Validators: extend `server/src/validators/resultsVnextOkr.validators.ts` (same file, not a new one — matches the file's own established per-domain-not-per-epic granularity).

---

## 12. File list (backend only)

**New:**
- `server/migrations/20260824_rvn_okr_checkin.sql`
- `server/src/services/resultsVnext/okr/okrCheckInTypes.ts`
- `server/src/services/resultsVnext/okr/okrCheckInCommands.ts` (`recordCheckIn`, `correctCheckIn`, `OkrCheckInAlreadyExistsForOccurrenceError`, `OkrCheckInNotFoundError`, `OkrCheckInValidationError`)
- `server/src/services/resultsVnext/okr/okrSetRollupCalculator.ts` (`computeSetRollup`, pure/unit-testable, no DB access — §7.3)
- `server/src/services/resultsVnext/okr/okrCheckInSuggestionService.ts` (`suggestNextCheckInValue` — §9, AC-012 isolation)
- `server/src/services/resultsVnext/okr/okrCheckInScheduler.ts` (`generateCadenceOccurrencesAndSeedCheckInObligations`, `detectAndFlagMissedCheckIns` — §8.2/§8.3)
- `server/src/services/resultsVnext/okr/okrCheckInRepository.ts` (`listCheckIns`, `getCheckIn` — visibility-scoped per §10)
- `tests/resultsVnext/okr/okrCheckInAppendOnly.realdb.test.ts` (duplicate-in-window rejected + SAVEPOINT proof, correction chain, raw UPDATE/DELETE blocked via fresh `NOLOGIN` role — same proof shape `roiActualEntryAppendOnly.realdb.test.ts` used, not `has_table_privilege` which the ROI-E004 closure entry already found unreliable for a superuser test connection)
- `tests/resultsVnext/okr/okrCheckInRollup.realdb.test.ts` (KR progress/confidence write-through, Set-level `overall_*`/`attention_state`/`last_checkin_at`/`next_checkin_due_at` recompute, D9's "never synthetic 0%" proof with a zero-KR/all-cancelled Set)
- `tests/resultsVnext/okr/okrCheckInScheduler.realdb.test.ts` (obligation seeding idempotency, missed-window detection/escalation, `detectAndFlagMissedCheckIns` two-call idempotency mirroring OKR-E001's own scheduler test shape)
- `tests/resultsVnext/okr/okrCheckInVisibilityJoin.realdb.test.ts` (`::text` cast proof, mirroring `okrSetVisibilityJoin.realdb.test.ts`)
- `tests/resultsVnext/okr/okrCheckInSuggestion.test.ts` (pure function, no DB — proves zero `kpi_*` import via a static grep-based test asserting the file's own import list, same defensive-test style `legacyIsolation.realdb.test.ts` uses elsewhere in this program for D09-class guarantees)
- `tests/resultsVnext/okr/okrSetRollupCalculator.test.ts` (pure function unit tests — every `objective_rollup_model`/`objective_confidence_model` combination, `not_calculable`/zero-Objectives edge cases)
- `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` (extended, matching E001/E002's own file)

**Changed:**
- `server/src/routes/resultsVnext/okr.routes.ts` — 4 new routes (§11)
- `server/src/validators/resultsVnextOkr.validators.ts` — new schemas
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new event types (`okr_checkin.recorded`, `okr_checkin.corrected`), both → `['mywork_projection']`
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry, restating: (a) OKR-E003's KR-shape forward-reference risk (§2.3/§6 header comment) as a mandatory pre-implementation re-verification, (b) the cross-aggregate write-through onto `okr_vnext_key_results` (D7) as a heads-up for OKR-E003's implementer, (c) `attention_state`'s heuristic mapping (§7.3) as a named, real policy gap pending a Founder-level thresholds decision, exactly as OKR-E002 restated D13/D17 in its own closure entry rather than letting them go silent.

**Read-only reference:** `kpiMeasurementCommands.ts`, `kpiRepository.ts` (§4.1/§4.2), `roiActualEntryCommands.ts` (§4.3), `roiForecastVersionCommands.ts`/`roiActualSnapshotCommands.ts` (§4.5, pointer-update-with-lock pattern), `platform/obligations.ts` (§4.4), OKR-E001's `okrCycleScheduler.ts` (read-only — not modified, §8.2), OKR-E002's `okrSetCommands.ts`/`okrSetRepository.ts` — **all must be re-read for exact current signatures at implementation time**, and OKR-E003's actual landed schema/commands **must be read fresh** since no frozen design exists for it as of this draft (repeated from §2.3 because it is the single largest risk to this design's accuracy).

---

## 13. Definition of done

- [ ] All 4 new endpoints work against a real KR belonging to a real active Set (requires OKR-E001/E002/E003 test fixtures — confirm OKR-E001/E002 are actually landed before this epic starts implementation, per §2.3's flagged gap)
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] Duplicate check-in in the same KR+window rejected (409, SAVEPOINT-proven, not `25P02`-poisoned)
- [ ] Correction chain: `correctCheckIn` produces a new row, never mutates the original; raw UPDATE/DELETE blocked via a fresh `NOLOGIN` role test connection (not `has_table_privilege` on the superuser test connection — ROI-E004's own closure entry documents why that check is invalid)
- [ ] KR `current_value`/`progress`/`confidence`/`status` write-through verified against real Postgres, with a concurrent-write test proving the `FOR UPDATE` lock correctly serializes against a simulated concurrent OKR-E003-style KR edit
- [ ] Set `overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/`next_checkin_due_at` recompute verified; explicit proof that a zero-Objective / all-cancelled / no-check-in Set yields `null`/`'none'`-or-`'watch'`, never a fabricated `0`
- [ ] `okrCheckInSuggestionService.ts` proven to import nothing from any `kpi/*` path (static test) and to issue zero SQL against `kpi_time_series` (AC-012's literal proof)
- [ ] `::text` cast verified against real Postgres on the checkin→set visibility join
- [ ] Missed-check-in scheduler (`detectAndFlagMissedCheckIns`) idempotency verified (two-call, no double-escalation)
- [ ] Obligation seeding/completion round-trip verified: seed on occurrence generation → open in MyWork → `recordCheckIn` completes it → re-running the scheduler does not resurrect it
- [ ] Full existing KPI + ROI + OKR-E001/E002(/E003 if landed) test suites still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E004 rows updated, explicitly restating the three flagged gaps (§12's "Changed" list item on the ledger)
- [ ] `attention_state`'s heuristic mapping (§7.3) explicitly re-confirmed as a fail-safe/policy-pending stand-in, not silently presented as final — same posture OKR-E001 took toward `reflection_required_for_close`'s default

---

## 14. Open questions (J) — genuine ambiguity, not resolved by guessing

1. **OKR-E003 is unfrozen.** No `OKR_E003_DESIGN.md` exists (confirmed by directory listing). Every FK target (`okr_vnext_key_results.key_result_id`/`.objective_id`/`.current_value`/`.progress`/`.confidence_label`/`.confidence_numeric`/`.status`/`.row_version`, `okr_vnext_objectives.objective_id`/`.okr_set_id`/`.status`/`.progress`), every reference to "OKR-E003's progress-calc service" (exact export name unknown), and the exact KR lifecycle-status gating for `recordCheckIn` (§7.1's `KR_NOT_ACTIVE` guard) are **best-effort projections from `04_OKR_IMPLEMENTATION_PLAN.md` §4.5/§4.6**, not verified against landed code. **This is the single largest re-verification item for whoever implements this design** — larger than the standard "re-read the prior epic" caveat OKR-E002 gave OKR-E001, because here there is no frozen document at all to re-read, only the plan's own aspirational YAML.
2. **Are OKR-E001/E002 actually landed?** `EXECUTION_LEDGER.md`'s own section headers (§14-§38) show every KPI/ROI epic's implementation-and-acceptance entry but **no equivalent OKR-E001 or OKR-E002 entry**, and `atomicWrite.ts`'s `EVENT_TYPE_CONSUMER_GROUPS` map contains only the single pre-existing `'okr_set.published'` placeholder — none of E001's or E002's own newly-defined event types (`okr_program.created`, `okr_cycle.activated`, `okr_set.approved`, etc.) appear there. Both signals point the same direction: **the OKR domain may still be design-only**. The Integration Owner should confirm actual code state before greenlighting this epic's implementation — this draft proceeds on the assumption the P11/E002-column handoff is honored regardless of landing order, but "frozen design" is not "landed code."
3. **`attention_state` derivation thresholds.** Plan §5.4 is explicit that "No universal fixed 70/40 thresholds. The policy version defines status suggestions, trajectory, clamping, overachievement, and roll-up" — but `okr_vnext_programs`' actual landed DDL (per OKR-E001 §4) has no field carrying such a threshold (no `attention_progress_variance_threshold` or equivalent). §7.3's heuristic is a **named, explicit placeholder**, not a policy-sourced calculation — a genuine product/Founder decision is needed on whether (a) a new nullable Program-policy field should be added now (an ALTER on a possibly-already-landed `okr_vnext_programs` — costly if E001 is in fact landed, per open question 2) or (b) hardcoded fallback constants are acceptable for MVP with the field reserved for a later epic, mirroring `reflection_required_for_close`'s own "reserve now, decide later" precedent.
4. **Does a check-in ever need to change the KR's or Objective's or Set's *status* field (not just progress/confidence)?** Plan §4.6 gives KR a `status` field with values including `at_risk`/`off_track`/`achieved`/`not_achieved` — §7.1 step 5 writes `system_suggested_status` computed from geometry, but whether this OVERWRITES the KR's authoritative `status` field automatically, or merely populates a *suggestion* that the owner must separately confirm (matching `owner_declared_status` vs `system_suggested_status` being two DISTINCT columns on the checkin row itself, plan §4.7), is not resolved by any AC. This draft's default assumption (§7.1 step 5's `UPDATE ... status=$5`) writes the **system-suggested** status directly — worth an explicit product decision on whether that should instead require the owner's `owner_declared_status` to be the one written through, with `system_suggested_status` staying purely advisory and displayed but never auto-applied. Flagged, not resolved.
5. **Deep correction chains.** §4.2 notes KPI's `kpiRepository.ts` "current row" query uses a simple `NOT EXISTS` rule (not a recursive walk) because KPI's correction chains are expected to stay shallow; ROI-E004 needed a full `WITH RECURSIVE` walk specifically for D10's self-verification-denial (a different question than "what's current"). Since this epic has no self-verification check (D12), the simpler `NOT EXISTS` form should suffice for `listCheckIns`' "current" view — but if check-in correction chains in practice get deep (e.g., a KR corrected many times within one window during a live meeting), this should be re-benchmarked, not assumed.
6. **Does `okr_vnext_checkins.evidence_refs` need a typed link to anything**, mirroring ROI-E004 D12's explicit "no typed KPI-evidence link, free-text JSONB, flag as possible future need" decision? Same answer applies here by direct analogy — no AC asks for it, free-text `evidence_refs JSONB` (matching the DDL in §6) is sufficient, typed linking is out of scope, named as a backlog item.
7. **`support_requested`/`blocker` on a check-in — does this epic need to write a row into OKR-E006's (also unbuilt) `okr_vnext_support_requests` table**, or is capturing the free-text on the checkin row itself sufficient for E004's own scope? This draft's position (§5 D4's neighbor discussion, "out of scope for E004, left for OKR-E006 to consume") assumes E006 will read `okr_vnext_checkins.support_requested`/`.blocker` directly (no FK needed either direction, consistent with D09) — but this cross-epic boundary is not confirmed by any AC and should be restated explicitly to whoever designs OKR-E006, the same way OKR-E002 D14's `resolveScopeVisibility` gap was restated forward rather than silently assumed resolved.
8. **`generateCadenceOccurrences`'s return shape** (§8.2) currently only returns a count (`{ created: number; skippedExisting: number }` per OKR-E001's own design doc §6.6) — this epic's obligation-seeding function needs the actual new row ids, which may require either a small additive change to that return type (still consistent with the P11 handoff's letter, which only promises no table ALTER) or a re-query by `generated_at >= callTimeStart`. Worth resolving directly against E001's actual landed signature before implementation, not guessed here.

---

## Status: DRAFT COMPLETE

All required reading done (EPIC_LEDGER_LIVE.md AC table verbatim, OKR_E001_DESIGN.md, OKR_E002_DESIGN.md, 04_OKR_IMPLEMENTATION_PLAN.md relevant sections, EXECUTION_LEDGER.md section survey + ROI-E004 full read, kpiMeasurementCommands.ts full, kpiRepository.ts relevant section, roiActualEntryCommands.ts full, platform/obligations.ts full, plus supporting reads of roiForecastVersionCommands.ts/roiActualSnapshotCommands.ts for the pointer-update pattern, resourceTypes.ts, atomicWrite.ts header, rvn_kpi_core.sql migration). Design decisions D1-D14 resolved with rationale, full DDL sketch, command layer, attention/escalation/missed-cadence mechanism, AC-012 isolation service, visibility, API surface, file list, DoD, and 8 explicit open questions for the Integration Owner — largest being OKR-E003's unfrozen status and whether OKR-E001/E002 have actually landed.
