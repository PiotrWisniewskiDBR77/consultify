# OKR-E007 Review & Learning — FROZEN DESIGN

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

Status: drafting. Source branch/worktree: `consultify-results-vnext-g0-20260809` @ `codex/results-vnext-g0-20260809`.
Verify against landed code before freeze (E003-E006 may be draft-only; check `server/src/services/resultsVnext/okr/` for actual state at review time).

## §0 SOURCE: EPIC_LEDGER_LIVE.md — OKR-E007 Review & Learning (VERBATIM)

File: `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` lines 85-95.

| Pole | OKR-F-021-AC-01 | OKR-F-022-AC-01 | OKR-F-023-AC-01 | OKR-F-024-AC-01 |
|---|---|---|---|---|
| Decision ID | D11 | D11 | D08 | D01, D08 |
| Requirement | `OKRReflection` (co zadziałało/nie/dlaczego/nauka/zmiana/dyspozycja); `reflection_required_for_close` = przełącznik polityki (EVIDENCE_NEEDED #3). | Manager review, gdy wymagany, nie może być wykonany przez autora (self-review denial, D11). | Carry-forward tworzy draft na nowy cykl z widoczną linią rodowodu do zamkniętego Set; nigdy nie nadpisuje zatwierdzonego snapshotu. | `GET .../sets/:id/history` rekonstruuje historię z `OKRAuditEvent`+`OKRMaterialChange`, wystarczające do cold-reopen. |
| Aggregate/owner | OKRReflection | OKRReview (reviewer≠author) | OKRSet (carry-forward target) | OKRAuditEvent/OKRMaterialChange (append-only) |
| Command/query/API | `POST .../sets/:id/final-score`, `POST .../objectives/:id/reflection` | brak dedykowanej trasy poza approve/request-changes z rolą reviewer≠author | `POST .../sets/:id/carry-forward` | `GET .../sets/:id/history` |
| Schema/migration/constraint | `okr_vnext_reflections` | `okr_vnext_reviews` (reviewer≠author constraint) | nowy `id` + `carried_from_set_id` | `okr_vnext_events` (append-only envelope) |
| Roles/visibility | Set/Objective Owner, Manager | Manager (≠author) | Set Owner, Program Admin | Auditor (read-only), Set Owner |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

Note: only 4 ACs listed (OKR-F-021 through OKR-F-024), each with exactly one AC-01 (no AC-02 variants) — unlike some other epics. This is the FULL governing table; everything below must trace back to these 4 rows.

## §0.5 CRITICAL GROUND-TRUTH FINDING — state of landed code (verified by direct repo read, 2026-08-10)

Before any design content: the task brief says "E001/E002 designed; E003-E006 may be in draft." Direct verification in the
worktree shows this is optimistic. As of this design:

- `ls docs/product/results-vnext/` → only `OKR_E001_DESIGN.md` and `OKR_E002_DESIGN.md` exist. **`OKR_E003_DESIGN.md`
  through `OKR_E007_DESIGN.md` do not exist as files at all** — not even in draft.
- `find server/src/services/resultsVnext/okr` → **directory does not exist**. Zero OKR command/repository code has
  landed anywhere in this worktree.
- `git log --oneline -15` confirms: the two most recent OKR-related commits are `6bd0ad192e
  docs(results-vnext): freeze OKR-E002 Materialized Set design` and `5fe1b647fd docs(results-vnext): freeze OKR-E001
  Program & Cycle design` — **docs only**, no `feat(okr-e00x)` commits exist for any OKR epic, unlike ROI (which has
  landed code through E007) and KPI (fully landed).
- `okr_vnext_*` tables do not exist in any migration file yet — only `OKR_E001_DESIGN.md`/`OKR_E002_DESIGN.md` §DDL
  sections describe them (as *intended*, not-yet-applied migrations).

**Consequence for this design**: OKR-E007 is being designed on top of two FROZEN-BUT-UNIMPLEMENTED prior designs, and
on domain content (Objectives/KRs from E003, check-ins from E004, alignment from E005, support/decisions from E006)
that has **no design document at all**, only the prose sketch in `04_OKR_IMPLEMENTATION_PLAN.md` §4.5-§4.8. Every
cross-reference to `okr_vnext_programs`/`okr_vnext_cycles`/`okr_vnext_sets` column names, `runOkrCycleLifecycleTransition`/
`runOkrSetLifecycleTransition` signatures, `isOkrSetReadyForSubmissionEligible`, `okr_vnext_objectives`/
`okr_vnext_key_results` shapes, etc. in this document is sourced from the **frozen design prose**, not verified running
code — and for E003-E006, from the **implementation plan's prose sketch only**, one level less grounded than E001/E002's
own designs were when E002 was written (E002 at least had E001's *frozen doc* to re-verify against). **The Integration
Owner must treat every Objective/KeyResult schema reference below as provisional** pending an actual `OKR_E003_DESIGN.md`,
and must re-verify every E001/E002 cross-reference against landed code (not just their frozen docs) before this design is
implemented — the same standing requirement `OKR_E002_DESIGN.md`'s own header states for its dependency on E001.

**Sequencing implication, stated plainly**: literally building OKR-E007 before E001-E006 have landed code is not
possible — this document is a design artifact for the Integration Owner to freeze and queue, not a package ready for a
worker to implement today. Four epics' worth of schema (Objective, KeyResult, CheckIn, Alignment, Support/Decision) must
land first. Where this design depends on a specific column/table from E003-E006 that does not yet exist in any design
doc, it is flagged explicitly with a recommendation for what that future epic's design should reserve, mirroring this
program's own "reserve now, avoid ALTER later" discipline.

---

## §1. Epic boundary (from the AC table + plan §4.8/§5.3/§9)

OKR-E007 is the OKR domain's terminal-lifecycle epic — the direct analogue of ROI-E006 (PIR & Learning), closing a
Set's life exactly as ROI-E006 closes a Case's: `active → review → closed`, plus the OKR-specific `carry-forward`
mechanism ROI/KPI have no analogue for (a Case/Definition simply ends; an OKR Set's unfinished intent is meant to
continue into the next Cycle).

**In scope** (traced to the 4 ACs):
1. Final scoring of every Objective/KR under a Set at cycle end, frozen (OKR-F-021).
2. `OKRReflection` narrative capture, gated by `reflection_required_for_close` (OKR-F-021).
3. Manager review (and, per Program policy, self-review), gated by `manager_review_required`/`self_review_required`,
   with reviewer≠author denial (OKR-F-022).
4. Carry-forward: closed Set → draft Set in a new Cycle, with visible lineage (OKR-F-023).
5. `GET .../sets/:id/history` — full audit reconstruction sufficient for cold-reopen (OKR-F-024).
6. The Set's own `review → closed` transition, and (a genuine gap this epic must close, found by direct code
   inspection — see Decision D9 below) a guard on the Cycle's `review → closed` transition so a Cycle cannot close
   while its Sets are still open.

**Out of scope, explicitly**: the live progress/confidence calculation engine (E003), check-in cadence and MyWork
completion (E004), alignment graph (E005), support requests/Decisions (E006), Teresa's actual review/reflection
generation call (E008 — this epic ships only the receiving shape and disposition gate, mirroring ROI-E006 D13's
"contract with initially zero real caller" pattern toward ROI-E008), and any cross-cycle searchable "lessons library"
(see Decision D7 below — checked against the ACs, not assumed).

---

## §2. Decisions

Following this program's standing decision-table discipline (every non-obvious judgment call stated, sourced,
reasoned — never silently guessed).

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Is "final score" the same value as E003/E004's live `progress`, or a distinct concept? | **Distinct.** `progress` (E003 §5.4) is the continuously-live, backward-looking numeric attainment computed by the KR-geometry engine — E007 never recomputes it. "Final score" is a **one-time, frozen transform of the Objective's already-computed `progress` under the Program's `scoring_model`**, captured once at cycle-end. `objective_rollup_model` (KR→Objective progress rollup) is read literally as **E003's concern, not E007's** — E007 only ever reads the already-rolled-up `objective.progress`, never recomputes a KR→Objective aggregation itself. | The plan doc names `scoring_model` and `objective_rollup_model` as two *separate* Program fields (§4.2); conflating them would silently duplicate E003's rollup logic in a second place — exactly the "two parallel roll-up mechanisms" class of bug D08/OKR-F-016 exists to prevent for Alignment. The AC's own phrase "final score... under the Program's `scoring_model`" names only one of the two fields. |
| D2 | What does `scoring_model` concretely compute? | `zero_to_one`/`percentage`: pass `objective.progress` through unchanged (already a 0-1-ish decimal per §5.4's geometries) or ×100 for percentage — **no re-clamping invented here**, whatever clamping/overachievement policy E003's engine already applied to `progress` is preserved as-is. `categories`: **not implementable now — no source doc anywhere defines category bucket boundaries.** `custom`: stub, persists the raw progress with a `scoringModelUnsupported: true` marker, same posture E003 §4.6 gives unfinished KR measurement types (reserved, not fabricated). | Inventing bucket thresholds (e.g., "<30%=off track") for `categories` would be exactly the kind of fabricated business rule this program's decision-table discipline exists to prevent — flagged as a genuine **EVIDENCE_NEEDED**, not guessed. See §9. |
| D3 | Grain of `okr_vnext_reflections`? | **One row per Objective** (`objective_id` unique), holding BOTH the frozen final-score fields (written by the Set-level `finalScoreOkrSet` command) AND the narrative fields (written by the per-Objective `recordObjectiveReflection` command) — matching the ledger's own single Aggregate/Schema cell for what are structurally two different write paths over one entity. `final_score_payload` embeds a **frozen array of that Objective's KR-level progress/confidence/weight at scoring time** (pointer-plus-frozen-copy, not a second live join) — direct structural reuse of `RoiPirReviewSnapshotPayload`'s own shape (`ROI_E006_DESIGN.md` D8). | The ledger names ONE aggregate (`OKRReflection`) and ONE schema table for an AC whose Command/API cell lists TWO distinct routes (`final-score`, `reflection`) — the natural reading is one row, two writers, not two tables. |
| D4 | Two-stage freeze, like ROI-E006's PIR? | **Yes — identical shape.** `okr_vnext_reflections.status: draft \| finalized`. Facts (which Objective, who/when scored) are frozen from creation; narrative + score fields are freely re-editable while `status='draft'`; `closeOkrSet` is the ONLY writer that flips `status='finalized'`, protected by a DB trigger mirroring `rvn_roi_pir_protect_frozen`. | Direct precedent, `ROI_E006_DESIGN.md` §3's two-stage trigger — this epic's structural closest match, per the task's own framing. No reason to diverge; the same "frozen facts vs. editable-until-finalize narrative" split applies identically. |
| D5 | `okr_vnext_reviews` grain and lifecycle? | **One row per `(set_id, review_type)`**, `review_type IN ('self','manager')`, reused/updated across draft→submitted→(approved\|changes_requested) — mirroring `okr_vnext_sets`' OWN submit/approve/request-changes cycle from E002, not an append-only snapshot log. `comments` is a `JSONB` array of `{level:'set'\|'objective'\|'key_result', targetId, text, createdAt}` entries, satisfying plan §4.8's "comments at Set/Objective/KR level" without three separate FK columns or one row per KR. | An append-only log (like `okr_vnext_approved_snapshots`) is the wrong shape here — a review can legitimately cycle through changes-requested→resubmit multiple times before a cycle-end deadline, and nothing in the ACs asks for a full history of every intermediate manager comment (that lives in `okr_vnext_events` instead, satisfying OKR-F-024 for free). |
| D6 (terminology hazard — must be named explicitly) | `self_review_required` (Program policy: owner must submit their own self-assessment) vs. "self-review denial" (OKR-F-022's maker-checker: a MANAGER review cannot be performed by the Set's own author) use overlapping English words for **two unrelated concepts.** | **Never name an error class `SelfReviewDenied*`.** The maker-checker error is `OkrManagerReviewSelfApprovalDeniedError` — thrown when `actorUserId === review.submitted_by` (or the Set's `owner_user_id`/`created_by`, mirroring E002 D10's dual check) on a `review_type='manager'` review. `self_review_required`'s own gate is a plain existence/completeness check (`review_type='self'` row exists with `status='submitted'`) — no denial logic applies to it at all, because the Program is *asking* the owner to review themselves; requiring otherwise would defeat the feature. | Found by re-reading the AC's Polish text literally ("Manager review... nie może być wykonany przez autora") against the Program's field name `self_review_required` — these are not the same mechanism, and a careless implementer could easily wire the wrong flag to the wrong guard. Naming the error class after the field it is NOT gating is a cheap, durable safeguard. |
| D7 | Does OKR-E007 need a cross-cycle "lessons library" (ROI-E006 D12's named, deliberately-deferred gap)? | **No — checked, not assumed.** None of the 4 OKR-E007 ACs (re-quoted in §0) mention a cross-Set/cross-cycle searchable learning artifact. `next_cycle_change` (one of the narrative fields, plan §4.8) is scoped to feeding **this Objective's own carry-forward**, not a searchable corpus. Portfolio/organizational rollup of reflections is not named anywhere in OKR-E007's ACs either (contrast ROI-E006's own AC-05, which explicitly required portfolio metrics — OKR-E007 has no equivalent AC). | This is the literal instance of the task's own instruction to check rather than copy ROI's deferral — the check comes back the same answer for a different, valid reason: ROI-E006 deferred a KB that its own D12 flagged as speculative; OKR-E007 simply never had an AC asking for one in the first place. Both conclusions are "no," reached independently — restated so the Integration Owner doesn't mistake this for an unreflective copy-paste. |
| D8 | Does carry-forward auto-copy Objective/KR *content* into the new draft Set? | **No — Set-level lineage only.** `carryForwardOkrSet` creates an EMPTY draft Set (`carried_from_set_id` pointer, same `scope_type`/`scope_id`/`owner_user_id`/`reviewer_user_id` as the source) in the target Cycle. It does **not** copy Objectives/KRs. Content re-drafting is the literal job already reserved for `POST .../advisor/reflection` ("reflection and next-cycle draft synthesis", plan §12) — OKR-E008's Teresa proposes a patch INTO this draft using the closed Set + its Reflections' `next_cycle_change` fields as grounded context, requiring explicit human accept per Teresa's non-autonomous contract. | Matches this program's repeated "no fabricated scope beyond the AC" discipline (OKR-E002 D2's identical refusal to auto-scaffold). The AC's own text only says "creates a draft... with visible lineage" — it does not say "copies Objectives." Auto-copying stale/failed Objective content into a fresh cycle without any human judgment in between would also be a product footgun, not just an unbacked feature. |
| D9 (real gap found by direct code read) | What gates a Cycle's `review → closed` transition so it cannot close while Sets are still open? | **Nothing, today.** `OKR_E001_DESIGN.md` §6.5's `runOkrCycleLifecycleTransition` calls for `okr_cycle.closed` carry no `guard:` argument (contrast the generic helper's own `spec.guard` slot, confirmed to exist and be used by ROI's `markReadyForReview` in the landed `runRoiCaseLifecycleTransition`/`roiCaseCommands.ts:817-908`, which OKR's helper is described as mirroring). **OKR-E007 must add one.** New guard, wired into E001's OWN transition call site for `okr_cycle.closed` (a "Changed" file in this epic, exactly as E001's `atomicWrite.ts` and ROI-E006's `roiOrgPerspectiveRepository.ts` were extended by later epics): `SELECT set_id FROM okr_vnext_sets WHERE cycle_id=$1 AND status NOT IN ('closed','cancelled','not_required')` — any row found throws `OkrCycleHasOpenSetsError(cycleId, openSetIds)` before the UPDATE. | Found by re-reading E001's own §6.5 code sketch line by line against the generic-guard shape ROI-E006 already demonstrates working — this is exactly the class of silent gap the task's "flag anything needing re-verification against landed code" instruction exists to catch. Not fabricated: the plan's own lifecycle diagram (§5.2/§5.3) draws Cycle and Set as two independent state machines with no described coupling — but "the org's whole OKR Cycle closes while three teams' Sets are still `active`" is a foreseeable data-integrity hole, the same class of gap E001 §6.5 itself called out when it added `cancel` unprompted. |
| D10 | Self-close denial on `closeOkrSet` itself (ROI-E006 D6's own precedent)? | **No separate check — and this is a genuine, reasoned divergence from ROI.** ROI-E006 needed its own `RoiPirSelfCloseDeniedError` because the ROI domain has **no** Program-level "manager review required" policy at all; PIR closure was the Case's only consequential terminal act with zero built-in maker-checker anywhere upstream. OKR already has `manager_review_required` (Program policy, default `true`) feeding a real maker-checker gate (`OkrManagerReviewSelfApprovalDeniedError`, D6 above) directly into the close gate (D11 below) — when that policy is on, self-closing is already structurally blocked (you cannot close without an `approved` manager review that, by construction, was not self-authored). When the policy is off, the Program has explicitly opted out of that protection for this org, and inventing a parallel un-opt-outable check would silently override the Program's own configured policy. | This is exactly the "note where OKR genuinely differs" instruction — the two domains solve the same underlying risk (self-serve closure of a consequential terminal record) through different existing mechanisms, and copying ROI's mechanism onto OKR would be redundant at best and policy-contradicting at worst. |
| D11 | `closeOkrSet` gate — exact order and content | See §4.5 below. Reads the Cycle's **pinned** `policy_version_id` snapshot (not the Program's live current values) for `manager_review_required`/`self_review_required`/`reflection_required_for_close` — directly inherited from OKR-E001's entire reason for pinning policy at Cycle creation (OKR-F-001-AC-01: a policy change must never reinterpret an in-flight Cycle). | Missing this would be a direct, silent violation of E001's own founding AC — a Program Admin flipping `reflection_required_for_close` mid-cycle must not retroactively change what's required to close a Set already active under the prior policy. |
| D12 | New `RVN_RESOURCE_TYPES`/event `aggregate_type` entries for reflection/review? | **No.** Every event this epic writes uses `aggregateType: 'okr_set'`, `aggregateId: setId` — even though the mutated row is `okr_vnext_reflections`/`okr_vnext_reviews`, not `okr_vnext_sets` itself. | **Confirmed by direct code read of the landed `roiPirCommands.ts`**: every one of its 6 commands (including ones that only touch `rvn_roi_post_investment_reviews`, never `rvn_roi_cases`) still emits `aggregateType: 'roi_case'`, `aggregateId: caseId`. This is the actual, already-proven convention for a child-of-aggregate write — not an inference from prose. Reusing it means zero new `RVN_RESOURCE_TYPES` entries and a trivially simple history query (D13). |
| D13 | `GET .../sets/:id/history` implementation, given D12 | Given every Set-scoped event (Set, Reflection, Review, and — by the same convention E003/E004/E005/E006 should also follow — Objective/KR/CheckIn/Alignment/Support events) carries `aggregate_type='okr_set'`/`aggregate_id=setId`, the read model is a single, simple query: `SELECT * FROM rvn_platform_events WHERE organization_id=$1 AND aggregate_type='okr_set' AND aggregate_id=$2 ORDER BY sequence ASC` (paginated, keyset on `sequence`), **UNION**-merged in application code with `okr_vnext_set_versions` (E002's `OKRMaterialChange`) ordered by `requested_at`. Gated by the SAME visibility check as `getOkrSet` (if you cannot see the Set, you cannot see its history) — checked once up front, not per-event. | Literal reading of OKR-F-024-AC-01's Schema cell: "`OKRAuditEvent`+`OKRMaterialChange`" names exactly these two sources. **Flagged dependency**: this only works cleanly if E003-E006 (not yet designed) also emit `aggregate_type='okr_set'` for their own child-entity events, mirroring D12 — stated here as an explicit requirement for whoever designs those epics, not assumed silently. |
| D14 | `okr_vnext_events` (ledger's literal table name) vs. the real platform table | **The ledger's Schema cell names `okr_vnext_events`; the real, already-landed table (RN-G1, confirmed by direct read of `20260809_rvn_platform_events_outbox.sql`) is the shared `rvn_platform_events`** — one table across KPI/ROI/OKR, not a domain-specific one. No new table is created by this epic for events. | Same class of doc-vs-platform naming drift E001 §4 already flagged for `visibility_default`'s enum spelling (`OPEN_ORGANIZATION` in the plan prose vs. `OPEN_ORG` in the real `visibilityResolver.ts` enum) — restated here so a future implementer does not go looking for (or worse, create) a nonexistent `okr_vnext_events` table. |
| D15 | Where does `carried_from_set_id` live, given E002 hasn't landed? | **New nullable column on `okr_vnext_sets`, added by THIS epic's own migration** (`ALTER TABLE okr_vnext_sets ADD COLUMN carried_from_set_id UUID NULL REFERENCES okr_vnext_sets(set_id)`), not a retroactive edit to `OKR_E002_DESIGN.md`'s own frozen DDL. | Two live options exist (amend E002's still-unimplemented frozen doc directly, or ALTER later): amending a doc the Integration Owner already froze is not this epic's call to make unilaterally, and if E002 lands before E007 is implemented, the ALTER is genuinely additive/harmless (new nullable column, zero data impact, zero backfill) — so there is no real cost to choosing the safe, non-presumptuous path. **Flagged for the Integration Owner**: if preferred, retroactively add this column to `OKR_E002_DESIGN.md` §3 instead before E002 implementation begins, closing the gap for free — either path is fine, this doc does not decide it unilaterally. |
| D16 | Where does `carried_from_objective_id` live? | **Cannot be specified here — E003 does not exist as a design yet.** Recorded as a forward requirement (§9) for whichever session designs `OKR_E003_DESIGN.md`: reserve a nullable `carried_from_objective_id UUID REFERENCES okr_vnext_objectives(objective_id)` on `okr_vnext_objectives` at E003's own creation time, avoiding a future ALTER on a live table — mirroring this exact same "reserve now" discipline used for `response_policy_id`/`submitted_by`/`teresa_draft_*` elsewhere in the program. | A carried-forward Objective in the new Set is a **NEW row, not the same Objective moved between Sets** — `okr_set_id` is Objective's parent FK (plan §4.5); moving a live Objective's `okr_set_id` to a different Set after the original Set closed would corrupt the closed Set's already-immutable `okr_vnext_approved_snapshots.snapshot_payload` (which embeds the Objective by reference at approval time, per E002 D8) and its historical progress trail. Identity is the new Objective row; provenance is the pointer. This directly answers the task's own "is a carried-forward Objective the same Objective or a new one?" question. |
| D17 | `carryForwardOkrSet` implementation shape | **Thin wrapper around E002's existing `createOkrSet`**, passing through `scopeType`/`scopeId`/`ownerUserId`/`reviewerUserId`/`title` copied from the source (closed) Set, plus `carriedFromSetId`. Reuses `createOkrSet`'s existing SAVEPOINT-based duplicate-tuple handling (E002 §4.1) verbatim rather than reimplementing it. Guard: source Set `status='closed'`; target Cycle `status IN ('planned','drafting')` (same eligibility window a fresh `createOkrSet` call would require); caller supplies the target `cycleId` explicitly — no auto-guessing "the next cycle" (matches the plan's own "transitions are explicit commands, never UI-derived date guesses" ethos, extended here to Cycle *selection*, not just Cycle *transitions*). | Direct precedent for "wrap, don't reimplement": OKR-E002 D7 did the identical thing for `isOkrSetReadyForSubmissionEligible`, explicitly built as an extension point for E003 to wrap. `createOkrSet` already has 100% of the mechanics `carryForwardOkrSet` needs (visibility-policy lookup, ACL grants, obligation creation, dedupe) — reimplementing them would violate this program's own established DRY discipline. |

---

## §3. Schema (full DDL sketch)

Migration file: `server/migrations/<date>_rvn_okr_review_reflection.sql`. **Sequenced strictly after** whichever
migration lands `okr_vnext_objectives`/`okr_vnext_key_results` (E003 — does not exist yet, see §0.5).

```sql
-- ============================================================
-- okr_vnext_reflections — OKRReflection. One row per Objective (D3).
-- Facts frozen from creation; narrative+score editable while draft;
-- finalized only by closeOkrSet (D4, two-stage freeze mirroring
-- rvn_roi_pir_protect_frozen).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_reflections (
  reflection_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                        UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  objective_id                  UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),  -- E003 dependency
  organization_id                TEXT NOT NULL,

  status                         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),

  -- Final score (D1/D2) — written by finalScoreOkrSet, Set-level batch command.
  final_score                    NUMERIC NULL,
  -- D2: 'zero_to_one'|'percentage' computed; 'categories' NOT computed today
  -- (EVIDENCE_NEEDED, §9) — final_score stays NULL, scoring_model_unsupported=true;
  -- 'custom' likewise stubbed.
  scoring_model_unsupported       BOOLEAN NOT NULL DEFAULT false,
  -- Frozen pointer-plus-copy of this Objective's KRs at scoring time (D3),
  -- shape: [{ keyResultId, progress, confidence, weight }].
  final_score_payload             JSONB NULL,
  scoring_policy_version_id        UUID NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  scored_by                        TEXT NULL,
  scored_at                        TIMESTAMPTZ NULL,

  -- Narrative (OKRReflection proper) — written by recordObjectiveReflection.
  -- "co zadziałało/nie/dlaczego/nauka/zmiana/dyspozycja" (plan §4.8, AC-021).
  what_worked                      TEXT NULL,
  what_did_not_work                TEXT NULL,
  why                              TEXT NULL,
  learning                         TEXT NULL,
  next_cycle_change                TEXT NULL,
  -- "dyspozycja" — the Objective's own fate going into the next cycle.
  disposition                      TEXT NULL CHECK (disposition IN ('complete','carry_forward','drop','redefine')),

  finalized_by                     TEXT NULL,
  finalized_at                     TIMESTAMPTZ NULL,

  row_version                      INT NOT NULL DEFAULT 1,
  created_by                       TEXT NOT NULL,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                       TEXT NULL,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_reflections_objective
  ON okr_vnext_reflections(objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_reflections_set
  ON okr_vnext_reflections(organization_id, set_id);

CREATE OR REPLACE FUNCTION okr_vnext_reflection_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    IF NEW.final_score IS DISTINCT FROM OLD.final_score
       OR NEW.final_score_payload IS DISTINCT FROM OLD.final_score_payload
       OR NEW.what_worked IS DISTINCT FROM OLD.what_worked
       OR NEW.what_did_not_work IS DISTINCT FROM OLD.what_did_not_work
       OR NEW.why IS DISTINCT FROM OLD.why
       OR NEW.learning IS DISTINCT FROM OLD.learning
       OR NEW.next_cycle_change IS DISTINCT FROM OLD.next_cycle_change
       OR NEW.disposition IS DISTINCT FROM OLD.disposition
    THEN
      RAISE EXCEPTION 'okr_vnext_reflections: reflection % is finalized', OLD.reflection_id
        USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_okr_vnext_reflection_protect_frozen ON okr_vnext_reflections;
CREATE TRIGGER trg_okr_vnext_reflection_protect_frozen
  BEFORE UPDATE ON okr_vnext_reflections
  FOR EACH ROW EXECUTE FUNCTION okr_vnext_reflection_protect_frozen();

-- ============================================================
-- okr_vnext_reviews — OKRReview. One row per (set_id, review_type) (D5).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_reviews (
  review_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                        UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id                TEXT NOT NULL,

  review_type                    TEXT NOT NULL CHECK (review_type IN ('self','manager')),
  reviewer_user_id                TEXT NOT NULL,

  status                          TEXT NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft','submitted','approved','changes_requested')),

  outcome                         TEXT NULL,
  -- [{ level: 'set'|'objective'|'key_result', targetId, text, createdAt }]
  comments                         JSONB NOT NULL DEFAULT '[]',
  -- Set.current_version at submission time — plan §4.8's "submitted version".
  reviewed_set_version              INT NULL,

  submitted_by                     TEXT NULL,
  submitted_at                     TIMESTAMPTZ NULL,
  decided_by                       TEXT NULL,
  decided_at                       TIMESTAMPTZ NULL,

  row_version                      INT NOT NULL DEFAULT 1,
  created_by                       TEXT NOT NULL,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                       TEXT NULL,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_okr_vnext_reviews_set_type
  ON okr_vnext_reviews(set_id, review_type);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_reviews_set
  ON okr_vnext_reviews(organization_id, set_id);

-- ============================================================
-- okr_vnext_sets — carry-forward lineage (D15). Additive ALTER — safe
-- regardless of whether OKR-E002 has landed by the time this epic
-- implements (new nullable column, zero backfill).
-- ============================================================
ALTER TABLE okr_vnext_sets
  ADD COLUMN IF NOT EXISTS carried_from_set_id UUID NULL REFERENCES okr_vnext_sets(set_id);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_sets_carried_from
  ON okr_vnext_sets(carried_from_set_id) WHERE carried_from_set_id IS NOT NULL;
```

No `okr_vnext_events` table (D14) — history reads `rvn_platform_events` (already exists, RN-G1) and
`okr_vnext_set_versions` (already reserved by E002).

---

## §4. Command layer (`server/src/services/resultsVnext/okr/`)

**Before implementing, re-read the actual landed state** of `okrSetCommands.ts`, `okrCycleCommands.ts`,
`okrRepository.ts`/`okrSetRepository.ts`, `platform/obligations.ts`, `platform/atomicWrite.ts`,
`kpiDefinitionCommands.ts` (`computeStateHash`) — this design describes their *intended* shape from two frozen docs,
not verified running code (§0.5).

### 4.1 `finalScoreOkrSet` — new, `okrReflectionCommands.ts` (OKR-F-021, D1-D3)

Set-level batch command. `executeAtomicCommand`, CAS on the Set's `row_version`.

```typescript
export interface FinalScoreOkrSetInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export interface FinalScoreOkrSetResult {
  set: OkrSet;
  scoredObjectives: Array<{ objectiveId: string; finalScore: number | null; scoringModelUnsupported: boolean }>;
}

export async function finalScoreOkrSet(
  input: FinalScoreOkrSetInput
): Promise<AtomicCommandOutcome<FinalScoreOkrSetResult>>
```

`applyMutation`:
1. Guard `status === 'review'` → else `OkrSetValidationError('NOT_IN_REVIEW', ...)`.
2. Load the Cycle row, then the pinned `okr_vnext_program_policy_versions.snapshot` via `cycle.policy_version_id`
   (D11) — extract `scoring_model`.
3. `SELECT * FROM okr_vnext_objectives WHERE okr_set_id=$1 AND status <> 'cancelled'` (no row lock needed beyond the
   Set's own — Objectives are read-only inputs here, E003's own commands own their write path).
4. For each Objective: load its KRs, build `finalScorePayload` (KR id/progress/confidence/weight snapshot),
   `applyOkrScoringModel(objective.progress, scoringModel)` → `{ score, unsupported }` (D2).
5. `INSERT INTO okr_vnext_reflections (...) ON CONFLICT (objective_id) DO UPDATE SET final_score=…,
   final_score_payload=…, scoring_model_unsupported=…, scoring_policy_version_id=…, scored_by=…, scored_at=now(),
   row_version=row_version+1, … WHERE okr_vnext_reflections.status='draft'` — an attempt against an already-
   `finalized` row hits the protect-frozen trigger and fails loudly (should be unreachable: `status='review'`
   guard at step 1 means the Set hasn't closed yet, so no reflection can be finalized).
6. No Set-row field changes beyond `row_version`/`updated_at` (an event-worthy no-op mutation, matching the
   platform's existing convention of always bumping `row_version` on a successful command even when the aggregate's
   own visible fields don't change — confirm against `executeAtomicCommand`'s actual CAS mechanics at
   implementation time).

`applyOkrScoringModel(rawProgress: number | null, scoringModel: string): { score: number | null; unsupported: boolean }`
— exported helper (D2): `zero_to_one`/`percentage` pass through (× 100 for percentage); `categories`/`custom` return
`{ score: null, unsupported: true }`.

Event `okr_set.final_scored` → `aggregateType: 'okr_set'`, `aggregateId: setId` (D12) → `['mywork_projection']`.

### 4.2 `recordObjectiveReflection` — new, `okrReflectionCommands.ts` (OKR-F-021)

```typescript
export interface RecordObjectiveReflectionInput {
  objectiveId: string;
  setId: string;
  organizationId: string;
  expectedVersion: number;  // okr_vnext_reflections' own row_version
  whatWorked?: string | null;
  whatDidNotWork?: string | null;
  why?: string | null;
  learning?: string | null;
  nextCycleChange?: string | null;
  disposition?: 'complete' | 'carry_forward' | 'drop' | 'redefine' | null;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  reason?: string | null;
}
```

`executeAtomicCommand`, CAS on the reflection row's own `row_version` (child-aggregate-CAS'd-independently shape,
matching `updateRoiPostInvestmentReviewDraft`). Upserts a `status='draft'` row keyed on `objective_id` if none
exists yet (an owner may reflect before `finalScoreOkrSet` has run). Guard: parent Set `status IN ('active',
'review')` — reflecting is allowed once an Objective is substantively done, not only after the whole Set enters
Review (real usage: an owner finishing a KR early shouldn't have to wait for the cycle boundary). Guard: reflection
row `status === 'draft'` (once finalized by `closeOkrSet`, no further edits — protect-frozen trigger backs this).
Authorized writer: Objective Owner or Set Owner (plan §4.8's Roles cell: "Set/Objective Owner, Manager").

Event `okr_set.objective_reflection_recorded` → `aggregateType: 'okr_set'`, `aggregateId: setId` → `['mywork_projection']`.

### 4.3 Manager/self review — new, `okrReviewCommands.ts` (OKR-F-022, D5/D6)

```typescript
export class OkrManagerReviewSelfApprovalDeniedError extends Error {
  code = 'MANAGER_REVIEW_SELF_APPROVAL_DENIED';
  constructor(setId: string, actorUserId: string) { /* … */ }
}
```

Five commands, all `executeAtomicCommand` CAS'd on `okr_vnext_reviews`' own `row_version`, upserting the one
`(set_id, review_type)` row (D5):

- `submitOkrSetSelfReview(setId, ...)` — guard `actorUserId === set.owner_user_id` (plain validation error if not —
  this is an eligibility check, not a maker-checker denial, D6). `review_type='self'` row → `status='submitted'`,
  `reviewed_set_version = set.current_version`.
- `submitOkrSetForManagerReview(setId, ...)` — owner-initiated (mirrors E002's `submitOkrSetForApproval`).
  `review_type='manager'` row → `status='submitted'`, `reviewer_user_id = set.reviewer_user_id` (reused from E002,
  not a new field), `createObligation('manager_review_okr_set', assignee=set.reviewer_user_id)`.
- `approveOkrSetManagerReview(setId, ...)` — **self-approval denial FIRST, before any write** (D6):
  `if (actorUserId === review.submitted_by || actorUserId === set.owner_user_id || actorUserId ===
  set.created_by) throw new OkrManagerReviewSelfApprovalDeniedError(setId, actorUserId)`. Guard `status==='submitted'`.
  → `status='approved'`, `outcome`, `comments`, `decided_by`/`decided_at`.
- `requestChangesOnOkrSetManagerReview(setId, ...)` — no self-check (declining isn't the conflict D6 guards
  against, matches E002's `requestChangesOnOkrSet` having none either). → `status='changes_requested'`.
- `recordOkrSetReviewComment(setId, reviewType, comment, ...)` — appends one entry to the `comments` JSONB array
  without changing `status` (lets a manager leave running KR-level notes before a final decision).

**Resolved ambiguity, stated explicitly**: the ledger's own Command/API cell for OKR-F-022-AC-01 reads "brak
dedykowanej trasy poza approve/request-changes z rolą reviewer≠author" ("no dedicated route beyond approve/
request-changes with reviewer≠author role"). Read LITERALLY as "reuse E002's exact `/sets/:id/approve` route,"
this would conflate the Set's initial-submission approval (E002, pre-Active) with its cycle-end review (E007,
Active→Review→Closed) — two structurally distinct lifecycle moments the Set's OWN status machine already keeps
separate (`Draft→Submitted→Approved→Active→Review→Closed`, plan §5.3). Read instead as "the reviewer≠author
maker-checker PATTERN mirrors E002's, no new denial mechanism invented" — consistent with the ledger's own
Aggregate cell naming a NEW aggregate (`OKRReview`) and Schema cell naming a NEW table (`okr_vnext_reviews`) for
this AC — this design takes the second reading. **Flagged for the Integration Owner to confirm before freeze.**

### 4.4 `openOkrSetReview` — extends `okrSetCommands.ts` (E002's file)

Generic transition via E002's existing `runOkrSetLifecycleTransition` helper:

```typescript
runOkrSetLifecycleTransition({
  eventType: 'okr_set.review_opened',
  fromStatuses: ['active'],
  toStatus: 'review',
}, input);
```

Called explicitly (Set Owner/Program Admin), **and** by a new cascading scheduler function (§4.6) when the parent
Cycle transitions to `review` — never implicitly inferred from the Cycle's own state alone (matches D08's core
discipline: Cycle transitions never substitute for a Set's own explicit command).

### 4.5 `closeOkrSet` — extends `okrSetCommands.ts` (OKR-F-021/022, D9-D11)

Hand-written `executeAtomicCommand` (complex multi-gate logic, mirrors `closeRoiCase`'s exact-step-ordering
discipline). CAS on the Set's `row_version`.

```typescript
export interface CloseOkrSetInput {
  setId: string;
  organizationId: string;
  expectedVersion: number;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  reason?: string | null;
}
```

`applyMutation`, exact order:
1. Guard `status === 'review'` → else `OkrSetValidationError('NOT_IN_REVIEW', ...)`.
2. Load Cycle → pinned policy snapshot (via `cycle.policy_version_id`, D11) → extract
   `manager_review_required`/`self_review_required`/`reflection_required_for_close`.
3. If `manager_review_required`: `SELECT * FROM okr_vnext_reviews WHERE set_id=$1 AND review_type='manager'`; missing
   or `status !== 'approved'` → `OkrSetManagerReviewRequiredError` (409).
4. If `self_review_required`: `SELECT * FROM okr_vnext_reviews WHERE set_id=$1 AND review_type='self'`; missing or
   `status !== 'submitted'` → `OkrSetSelfReviewRequiredError` (409).
5. If `reflection_required_for_close`: for every non-cancelled Objective under the Set, its `okr_vnext_reflections`
   row must exist with `final_score IS NOT NULL OR scoring_model_unsupported` AND all six narrative fields
   non-null; any Objective failing this → `OkrSetReflectionRequiredError(setId, missingObjectiveIds)` (409, lists
   every offending Objective, not just the first).
6. Finalize, in the SAME transaction: `UPDATE okr_vnext_reflections SET status='finalized', finalized_by=$1,
   finalized_at=now(), row_version=row_version+1 WHERE set_id=$2 AND status='draft'` (all Objectives at once, even
   if `reflection_required_for_close=false` and some rows are incomplete — an incomplete-but-existing reflection
   still finalizes, its NULL fields simply stay NULL forever, matching D4's "frozen from whatever state it was in
   at close").
7. `UPDATE okr_vnext_sets SET status='closed', ... WHERE set_id=$1`.

**No self-close denial on `closeOkrSet` itself** (D10 — deliberate divergence from ROI-E006's `RoiPirSelfCloseDeniedError`,
reasoned above).

Event `okr_set.closed` → `aggregateType: 'okr_set'`, `aggregateId: setId` → `['mywork_projection']`.

### 4.6 `okrCycleCommands.ts` (E001's file) — Changed: guard on `okr_cycle.closed` (D9)

```typescript
runOkrCycleLifecycleTransition({
  eventType: 'okr_cycle.closed',
  fromStatuses: ['review'],
  toStatus: 'closed',
  guard: async (client, cycleRow) => {
    const openSets = await client.query<{ set_id: string }>(
      `SELECT set_id FROM okr_vnext_sets WHERE cycle_id = $1 AND status NOT IN ('closed','cancelled','not_required')`,
      [cycleRow.cycle_id]
    );
    if (openSets.rows.length > 0) {
      throw new OkrCycleHasOpenSetsError(cycleRow.cycle_id, openSets.rows.map((r) => r.set_id));
    }
  },
}, input);
```

New `okrCycleScheduler.ts` (E001's file) — Changed: `cascadeOkrSetsToReview(organizationId, cycleId)`, called
alongside (not instead of) the Cycle's own `review_open_at`-driven transition — for every `status='active'` Set
under the Cycle, calls `openOkrSetReview` (§4.4) as a service actor (`actorUserId=null`,
`actorEffectiveRole='system:okr_cycle_scheduler'`, matching E001 P10's established convention). Idempotent by
construction (CAS-guarded `fromStatuses` rejects harmlessly on a second run).

### 4.7 `carryForwardOkrSet` — new, `okrCarryForwardCommands.ts` (OKR-F-023, D8/D15-D17)

```typescript
export interface CarryForwardOkrSetInput {
  sourceSetId: string;
  targetCycleId: string;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  reason?: string | null;
}

export interface CarryForwardOkrSetResult {
  sourceSet: OkrSet;
  carriedSet: OkrSet;
  created: boolean;  // false = a Set already exists for the target tuple (E002 D3's dedupe)
}

export async function carryForwardOkrSet(
  input: CarryForwardOkrSetInput
): Promise<CarryForwardOkrSetResult>
```

Not `executeAtomicCommand` directly — a thin orchestration wrapper (D17):
1. `SELECT * FROM okr_vnext_sets WHERE set_id=$1` (no lock needed — read-only source), guard `status==='closed'` →
   else `OkrSetValidationError('SOURCE_NOT_CLOSED', ...)`.
2. `SELECT * FROM okr_vnext_cycles WHERE cycle_id=$1`, guard `status IN ('planned','drafting')` → else
   `OkrCycleValidationError` (reused from E001, cross-domain but same file's own error class already fits).
3. Call E002's `createOkrSet({ ..., cycleId: targetCycleId, scopeType: source.scope_type, scopeId: source.scope_id,
   ownerUserId: source.owner_user_id, reviewerUserId: source.reviewer_user_id, title: source.title,
   carriedFromSetId: sourceSetId, ... })` — **`createOkrSet`'s own signature needs one new optional field,
   `carriedFromSetId?: string | null`, written into the INSERT** (a small, explicit, stated extension of an
   E002 function, not a silent one).
4. Event emission is `createOkrSet`'s own (`okr_set.created`) — `carryForwardOkrSet` adds no separate event of its
   own beyond what the wrapped call already produces, avoiding a duplicate audit entry for one user action.

### 4.8 `getOkrSetHistory` — new, `okrSetHistoryRepository.ts` (OKR-F-024, D12-D14)

```typescript
export async function getOkrSetHistory(params: {
  userId: string;
  organizationId: string;
  setId: string;
  cursor?: string;  // keyset pagination on rvn_platform_events.sequence
  limit?: number;
}): Promise<{ entries: OkrSetHistoryEntry[]; nextCursor: string | null }>
```

1. Authorization: reuse `getOkrSet`'s own visibility check (if the caller cannot see the Set, return 404/empty, not
   a filtered/redacted history — matches plan §7.4's "unauthorized records are absent, not redacted").
2. `SELECT * FROM rvn_platform_events WHERE organization_id=$1 AND aggregate_type='okr_set' AND aggregate_id=$2
   AND sequence > $cursor ORDER BY sequence ASC LIMIT $limit`.
3. `SELECT * FROM okr_vnext_set_versions WHERE set_id=$1 ORDER BY version_number ASC` (E002's `OKRMaterialChange`,
   small enough per Set to not need its own pagination in practice — flagged if that assumption proves wrong at
   scale).
4. Merge both lists by timestamp in application code into one `OkrSetHistoryEntry[]` (discriminated union:
   `{kind:'event', ...} | {kind:'material_change', ...}`).

---

## §5. Visibility

No new `resource_type` (mirrors ROI-E006 D11's identical reasoning): `okr_vnext_reflections`/`okr_vnext_reviews`
inherit visibility exclusively via `set_id`, joined against `rvn_platform_resource_visibility` with
`resource_type='okr_set'`. **Mandatory `::text` cast** on every such join (`rvn_platform_resource_visibility.resource_id`
is `TEXT`; `okr_vnext_sets.set_id` is `UUID`) — this exact cast has already been the single most-repeated real bug
in this program (missed 7 times in one KPI epic per `OKR_E002_DESIGN.md` §5's own restated warning). Write a
dedicated `okrReflectionVisibilityJoin.realdb.test.ts` proving the join is load-bearing (an outsider with zero ACL
grant on a `PRIVATE`-mode Set sees zero reflection/review rows despite the rows genuinely existing) — same sanity-
check shape as `roiPirVisibilityJoin.realdb.test.ts`.

`okr_vnext_reviews.comments` and `okr_vnext_reflections`' narrative fields carry no independent, finer-grained
visibility of their own beyond the Set's — no AC in this epic calls for hiding a specific comment/reflection field
from someone who can already see the Set.

---

## §6. API surface (`server/src/routes/resultsVnext/okr.routes.ts`, extended)

| Method | Path | Command/Repository |
|---|---|---|
| `POST` | `/sets/:setId/open-review` | `openOkrSetReview` |
| `POST` | `/sets/:setId/final-score` | `finalScoreOkrSet` |
| `POST` | `/objectives/:objectiveId/reflection` | `recordObjectiveReflection` |
| `POST` | `/sets/:setId/reviews/self/submit` | `submitOkrSetSelfReview` |
| `POST` | `/sets/:setId/reviews/manager/submit` | `submitOkrSetForManagerReview` |
| `POST` | `/sets/:setId/reviews/manager/approve` | `approveOkrSetManagerReview` |
| `POST` | `/sets/:setId/reviews/manager/request-changes` | `requestChangesOnOkrSetManagerReview` |
| `POST` | `/sets/:setId/reviews/:reviewType/comments` | `recordOkrSetReviewComment` |
| `GET` | `/sets/:setId/reviews` | `listOkrSetReviews` |
| `POST` | `/sets/:setId/close` | `closeOkrSet` |
| `POST` | `/sets/:setId/carry-forward` | `carryForwardOkrSet` |
| `GET` | `/sets/:setId/history` | `getOkrSetHistory` |

Error mapping additions to the existing `handleOkrRouteError` (mirrors `handleRoiRouteError`'s incremental-branch
pattern): `OkrManagerReviewSelfApprovalDeniedError`→403; `OkrSetManagerReviewRequiredError`→409;
`OkrSetSelfReviewRequiredError`→409; `OkrSetReflectionRequiredError`→409 (carries `missingObjectiveIds`);
`OkrCycleHasOpenSetsError`→409; `OkrSetValidationError`('NOT_IN_REVIEW'/'SOURCE_NOT_CLOSED')→409, Zod→400,
unknown→500.

**Mount-order note**: `/objectives/:objectiveId/reflection` is a new literal path segment under `/objectives/` —
verify it does not collide with any dynamic `/objectives/:objectiveId` PATCH/DELETE mount order E003 introduces
(same class of bug fixed twice in KPI, restated once per OKR epic so far).

---

## §7. File list (backend only)

**New:**
- `server/migrations/<date>_rvn_okr_review_reflection.sql`
- `server/src/services/resultsVnext/okr/okrReflectionTypes.ts`
- `server/src/services/resultsVnext/okr/okrReflectionCommands.ts` (`finalScoreOkrSet`, `recordObjectiveReflection`, `applyOkrScoringModel`, `OkrSetReflectionRequiredError`)
- `server/src/services/resultsVnext/okr/okrReviewTypes.ts`
- `server/src/services/resultsVnext/okr/okrReviewCommands.ts` (5 commands §4.3, `OkrManagerReviewSelfApprovalDeniedError`, `OkrSetManagerReviewRequiredError`, `OkrSetSelfReviewRequiredError`)
- `server/src/services/resultsVnext/okr/okrCarryForwardCommands.ts` (`carryForwardOkrSet`)
- `server/src/services/resultsVnext/okr/okrSetHistoryRepository.ts` (`getOkrSetHistory`)
- `server/src/validators/resultsVnextOkrReview.validators.ts`
- `tests/resultsVnext/okr/okrFinalScore.realdb.test.ts` — scoring-model dispatch (zero_to_one/percentage computed, categories/custom stubbed), upsert-not-duplicate on rerun, guard `status='review'`.
- `tests/resultsVnext/okr/okrReflectionLifecycle.realdb.test.ts` — draft edit while draft, protect-frozen trigger rejects raw UPDATE post-finalize, `reflection_required_for_close` completeness gate lists every offending Objective.
- `tests/resultsVnext/okr/okrManagerReview.realdb.test.ts` — self-approval denial (both `submitted_by` and `owner_user_id` branches, D6), approve/request-changes cycle, self-review's inverse eligibility check.
- `tests/resultsVnext/okr/okrSetClose.realdb.test.ts` — all three close gates (manager review / self review / reflection completeness) independently, D10's *absence* of a self-close check proven by a same-actor close succeeding when `manager_review_required=false`.
- `tests/resultsVnext/okr/okrCycleCloseGuard.realdb.test.ts` — D9's new guard: Cycle close rejected with open Sets, succeeds once all closed/cancelled.
- `tests/resultsVnext/okr/okrCarryForward.realdb.test.ts` — lineage pointer correctness, dedupe-tuple reuse via `createOkrSet`, source-not-closed / target-cycle-not-eligible guards.
- `tests/resultsVnext/okr/okrSetHistory.realdb.test.ts` — OKR-F-024 proof: merged event+material-change timeline, visibility-gated (outsider sees nothing), pagination.
- `tests/resultsVnext/okr/okrReflectionVisibilityJoin.realdb.test.ts` — `::text` cast sanity-check (§5).
- `server/src/routes/resultsVnext/__tests__/okrReview.routes.test.ts`

**Changed:**
- `server/src/services/resultsVnext/okr/okrSetCommands.ts` — add `openOkrSetReview`, `closeOkrSet`; extend `createOkrSet`'s input with optional `carriedFromSetId`.
- `server/src/services/resultsVnext/okr/okrCycleCommands.ts` — add `guard` to the `okr_cycle.closed` transition spec (D9); new `OkrCycleHasOpenSetsError`.
- `server/src/services/resultsVnext/okr/okrCycleScheduler.ts` — add `cascadeOkrSetsToReview`.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new event types: `okr_set.final_scored`, `okr_set.objective_reflection_recorded`, `okr_set.review_opened`, `okr_set.review_submitted` (×2 for self/manager), `okr_set.review_approved`, `okr_set.review_changes_requested`, `okr_set.review_comment_recorded`, `okr_set.closed`, `okr_cycle.closed` (guard added, event key unchanged) — all → `['mywork_projection']`.
- `server/src/routes/resultsVnext/okr.routes.ts` — 11 new routes.
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry (once implemented), restating D2's `categories`/`custom` scoring-model gap, D7's confirmed-no-lessons-library, D9's Cycle-close-guard fix, D15/D16's column-placement notes explicitly.

**Read-only reference:** `roiPirCommands.ts`/`roiPirTypes.ts` (closest structural precedent, read in full for this
design), `roiCaseCommands.ts` (`runRoiCaseLifecycleTransition`'s `guard` slot), `kpiDefinitionCommands.ts`
(`computeStateHash`), `platform/obligations.ts`, `okrProgramCommands.ts`/`okrCycleCommands.ts`/`okrSetCommands.ts`
(E001/E002, once landed) — **all must be re-read for exact current signatures at implementation time** (§0.5).

**Blocking dependency, stated plainly**: this epic cannot be implemented until `OKR_E003_DESIGN.md` exists and
lands `okr_vnext_objectives`/`okr_vnext_key_results` with a `progress` column this epic can read, and until
OKR-E001/E002's own code (not just their frozen docs) is on the branch.

---

## §8. Definition of done

- [ ] `OKR_E003_DESIGN.md` exists and its landed `okr_vnext_objectives`/`okr_vnext_key_results` schema matches what
      this design assumes (`progress`, `status`, `okr_set_id`) — re-verified, not assumed from the plan doc prose.
- [ ] OKR-E001/E002 code (not just their frozen designs) is landed and re-verified against this design's cross-references.
- [ ] All new commands work against real prior E001-E006 data (once those exist).
- [ ] OKR-F-021 proven: `finalScoreOkrSet` freezes correctly per `scoring_model`; `categories`/`custom` correctly
      marked unsupported rather than fabricated; `reflection_required_for_close` gate proven both ON and OFF.
- [ ] OKR-F-022 proven: manager-review self-approval denial (both `submitted_by`/`owner_user_id` branches);
      self-review's inverse "must be the owner" eligibility check; `manager_review_required`/`self_review_required`
      independently gate `closeOkrSet`.
- [ ] OKR-F-023 proven: carry-forward creates lineage-pointing draft Set, source-not-closed guard, dedupe-tuple
      reuse via `createOkrSet`, zero Objective/KR content copied (D8).
- [ ] OKR-F-024 proven: `GET .../sets/:id/history` reconstructs a merged event+material-change timeline sufficient
      to answer "what did this Set look like at time T," visibility-gated.
- [ ] D9's new Cycle-close guard proven: rejects while any Set is open, succeeds once all closed/cancelled.
- [ ] `::text` cast verified against real Postgres on the reflection/review visibility join.
- [ ] `tsc --noEmit` clean on the whole repo.
- [ ] Full existing KPI + ROI + OKR-E001..E006 test suites still green — before/after evidence, not a claimed number.
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E007 rows updated, restating every backlog
      item from §9 explicitly, not silently dropped.

---

## §9. Open questions / EVIDENCE_NEEDED (carried forward + new)

1. **Carried forward verbatim from `OKR_E001_DESIGN.md` §2's own closing note**: `reflection_required_for_close`
   defaults to `false` (fail-safe) pending a Founder decision — plan §20's EVIDENCE_NEEDED #3. This epic is the
   FIRST one that actually *enforces* this flag (E001 only stored it) — restating it here is not redundant, it is
   the point at which the open question stops being purely theoretical and starts gating real Set closures.
2. **New — `scoring_model: 'categories'` bucket boundaries** (D2): no source doc anywhere in this program defines
   what numeric ranges of `progress` map to which category label. Cannot be implemented without a product decision;
   `final_score` stays `NULL`/`scoring_model_unsupported=true` for any Program configured with `categories` until
   this is resolved — same posture E003's plan gives unfinished `milestone`/`custom` KR measurement types.
3. **New — `scoring_model: 'custom'`**: by definition unspecifiable without knowing what "custom" means for a given
   org; stubbed identically to `categories` above. Out of scope for this or any epic until a concrete custom-scoring
   product requirement exists.
4. **New — E003 must reserve `carried_from_objective_id`** (D16): whoever designs `OKR_E003_DESIGN.md` should add a
   nullable `carried_from_objective_id UUID REFERENCES okr_vnext_objectives(objective_id)` to `okr_vnext_objectives`
   at creation time, avoiding a future ALTER on a live table once E007 (or a Teresa-assisted re-draft flow) needs
   to record Objective-level carry-forward provenance.
5. **New — `carried_from_set_id` placement** (D15): Integration Owner's choice — amend `OKR_E002_DESIGN.md` §3
   directly to reserve the column before E002 implementation, or accept this epic's own additive `ALTER TABLE`.
   Either is safe; this document does not decide it unilaterally.
6. **New — the ledger's literal Command/API cell for OKR-F-022** ("brak dedykowanej trasy poza approve/request-
   changes z rolą reviewer≠author") is read in this design as "same maker-checker PATTERN as E002, new table/
   routes" rather than "literally reuse E002's `/sets/:id/approve` route for cycle-end review too" (§4.3). Flagged
   for the Integration Owner to confirm this reading before freeze — the alternative reading would collapse two
   structurally distinct lifecycle moments (initial submission vs. cycle-end review) into one status pair, which
   this design believes is wrong but did not originate the ambiguity.
7. **New — does `closeOkrSet` cascade Objective/KeyResult status to a terminal value** (e.g., `'closed'`,
   `'achieved'`/`'not_achieved'`)? This design deliberately does NOT specify this (see D-adjacent reasoning in §4.5):
   inventing a numeric threshold for KR achieved/not-achieved without AC or Program-policy backing would be exactly
   the fabricated-business-rule error this program's discipline exists to prevent. Left to E003 (or a future
   product decision) — flagged, not silently assumed either way.
8. **Sequencing**: this design cannot be implemented today (§0.5/§7) — OKR-E003 through E006 do not exist even as
   design documents, and OKR-E001/E002 have zero landed code. The Integration Owner should treat this document as
   queued, not ready, and prioritize landing E001→E006 first.


