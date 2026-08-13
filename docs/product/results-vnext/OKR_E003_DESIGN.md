# OKR-E003 Objectives & Key Results — FROZEN DESIGN

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
Program: Consultify "Results Next" — OKR domain, third epic.
Worktree: `consultify-results-vnext-g0-20260809` @ `codex/results-vnext-g0-20260809`.

Sections 0–17 below are the design draft as researched, accepted in full.
The Integration Owner rulings on §16's ten open questions are in §-IO
immediately below and **override** any contrary provisional wording later in
this document.

---

## §-IO. Integration Owner rulings (resolve §16's open questions)

| §16 item | Ruling | Rationale |
|---|---|---|
| **1. `maintain_range` / `binary` progress formulas are unspecified** | **`binary`: achieved = 1.0, not achieved = 0.0.** That is the definition of binary, not an invention — ship it. **`maintain_range`: in-range = 1.0, out-of-range = 0.0**, with the out-of-range magnitude recorded in a separate diagnostic field (`out_of_range_distance`), never folded into `progress`. **Reject the draft's proposed linear-falloff formula.** | A falloff needs an arbitrary slope parameter (falloff over what — the range width? a multiple of it?) that no source specifies; that free parameter is precisely what makes it a fabrication rather than a formula. "Maintain" is constraint satisfaction, not a gradient. Binary satisfaction has no free parameter, so it invents nothing. Recording the distance separately keeps the real information available for review without smuggling a made-up gradient into a number that feeds review decisions. |
| **2. Overachievement / clamping policy** | **Store the raw unclamped ratio** as designed. Do not clamp in the engine. | Matches this program's honest-data philosophy: the engine records what happened; presentation decides how to display it. Clamping at write time destroys information irreversibly; clamping at read time is always still possible. |
| **3. `kr_min_required` — per-Objective or Set-wide?** | **Per-Objective**, as the draft chose. | OKR-E002's forward-declared comment says "per-Objective" explicitly; the E003 AC prose merely omits the qualifier. A specific statement beats a silent omission. |
| **4. `reach` ↔ "percentage direct" label reconciliation** | **Confirmed equivalent.** | Matching arithmetic, no fifth enum value to map the prose label onto. |
| **5. Mixed confidence models within one Objective** | **Return `not_calculable`**, as proposed. Additionally: the implementer must NOT add a schema constraint forcing homogeneity — the heterogeneity is a real possible state and silently forbidding it would hide the gap rather than surface it. | Honest-missing over a fabricated cross-scale comparison. |
| **6. Company/BU/team Set special-casing for the ≥2-KR rule** | **No special-casing.** The rule applies identically across all four scope types. | E002's F-004-AC-02 states the four scope types share one contract; carving out an exception with no AC behind it would break that guarantee. |
| **7. KR→KPI neutral source binding — build now or defer?** | **Defer, as the draft chose.** Do not build `okr_vnext_key_result_source_bindings` in this epic. | The plan's own non-goals explicitly exclude automatic KPI-to-KR synchronization in MVP, and no E003 AC names a KPI binding. The draft correctly noted my original brief suggested mirroring ROI's pattern — but a brief's suggestion is not a requirement, and the draft's own research (that the AC table is silent) is the better evidence. Building it now would be speculative scope. **When a later epic does build it, the draft's §16-7 shape is correct and must use plain TEXT columns with no FK** (see the D09 correction below). |
| **8. Auto-cascade on Objective cancellation** | **No cascade**, as designed. An active KR under a cancelled Objective is permitted and must be covered by an explicit test. | Cascades are the legacy pattern this program is unwinding. If a cascade is ever wanted it should be an explicit, named command, not an invisible side effect. |
| **9. Status-suggestion thresholds** | **Owner-declared only in E003.** No automatic status-suggestion engine, no `ALTER TABLE okr_vnext_programs` for threshold policy in this epic. | None of E003's five ACs mention `status` at all; `system_suggested_status` appears in the plan's `OKRCheckIn` YAML, which is OKR-E004's territory. |
| **10. `GET /sets/:setId/objectives` — additive or duplicative?** | **Re-verify against OKR-E002's landed `okrSetRepository.ts` before implementing.** If `getOkrSet` already returns nested Objectives/KRs, drop the separate list route; if not, keep it. | Cannot be resolved from documents alone — E002's code doesn't exist yet. This is a build-time verification step, not a judgment call. |

**One correction the draft itself surfaced and I am ratifying as binding**:
the draft found that ROI-E002's `rvn_roi_benefit_evidence_links` — which my
own brief named as "very likely the pattern to mirror" — actually uses a
**real FK** to `rvn_kpi_definitions`. That is acceptable under ROI's softer
coupling rule but would violate D09's "no FK/roll-up inheritance" for OKR.
Any future OKR→KPI binding must use plain `TEXT` columns with **no foreign
key**. Catching this rather than copying the precedent blindly is exactly
the kind of check the design-review step exists for.

---

## 0. Source of truth — verbatim AC table from `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` §OKR-E003

> Wypełnione przez agenta `aa3fc90c059b0bf01` — 2026-08-09.

### OKR-E003 Objectives & KRs

| Pole | OKR-F-007-AC-01 | OKR-F-008-AC-01 | OKR-F-008-AC-02 | OKR-F-009-AC-01 | OKR-F-009-AC-02 |
|---|---|---|---|---|---|
| Decision ID | D08 | D08 | D08 | D08 | D08, D15 |
| Requirement | Objective wspiera `ambition_type: committed\|aspirational\|standard`; Advisor rekomenduje 1–3, nie narzuca sztywnego max. | KR wspiera numeric/percentage/currency/binary (MVP); milestone/custom ukryte dopóki niedokończone. | Polityka wymaga ≥2 KR przed submission; draft może tymczasowo mieć mniej. | Silnik progresu implementuje 5 geometrii; degenerate/brak danych → `not_calculable`, nigdy fabrykowane zero. | Każda wyliczona wartość progress/confidence przechowuje politykę/wersję kalkulacji i powód. |
| Aggregate/owner | Objective | KeyResult | KeyResult | Progress calc service (per KR) | Progress/confidence calc service |
| Command/query/API | `POST .../sets/:id/objectives`, `PATCH .../objectives/:id` | `POST .../objectives/:id/key-results`, `PATCH .../key-results/:id` | j.w. + `POST .../sets/:id/submit` (walidacja liczby KR) | wewnętrzne (brak osobnego route) | j.w. |
| Schema/migration/constraint | `okr_vnext_objectives` | `okr_vnext_key_results` (measurement_type enum) | `okr_vnext_key_results`, policy `kr_min_required` | `okr_vnext_key_results.progress` + calc policy/version | j.w. |
| Roles/visibility | Objective Owner, Set Owner | KR Owner, Objective Owner | KR Owner | Viewer, Contributor | Auditor (read-only policy trace) |
| Status | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED | NOT_IMPLEMENTED |

**Reading notes on the table (binding):**
- 5 ACs total: OKR-F-007-AC-01 (Objective ambition_type), OKR-F-008-AC-01 (KR measurement_type enum, MVP subset), OKR-F-008-AC-02 (≥2 KR submission policy — this is the exact check that must WRAP `isOkrSetReadyForSubmissionEligible`), OKR-F-009-AC-01 (5 progress geometries, `not_calculable` sentinel, no fabricated zero), OKR-F-009-AC-02 (progress/confidence calc must persist policy/version + reason — an audit trail requirement, argues for **persisted** calc records, not purely live/ephemeral compute — see §5).
- All Decision IDs are D08 (materialized-state / command-driven aggregate pattern) plus D15 on OKR-F-009-AC-02 — need to confirm D15's definition (likely from `07_EPIC_AND_TRACEABILITY_LEDGER.md` or `EXECUTION_LEDGER.md`; check during D-decision cross-reference pass).
- Table does NOT mention KPI/neutral-source-binding explicitly — that requirement comes from the D09 violation inventory in `EXECUTION_LEDGER.md` §3.4/3.6 (task instructions point C) and must be reconciled: is a KPI-as-datasource binding actually in scope for E003, or is it OKR-E004 (check-ins, which DOES explicitly reference D09 in its own AC table above, OKR-F-012-AC-01)? This needs resolution — see Open Questions §J.

---

## 1. Recap of frozen precedent (OKR-E001, OKR-E002) — what E003 must slot into

### 1.1 Domain shape so far
```
OKRProgram (E001)  — org-wide policy container: draft|active|suspended|retired
└─ OKRCycle (E001) — time-boxed window: planned|drafting|active|review|closed|cancelled
   └─ OKRSet (E002) — materialized Cycle × scope_type/scope_id × owner, own lifecycle:
                       not_required|required|draft|submitted|changes_requested|
                       approved|active|review|closed|cancelled
      └─ Objective (E003, THIS EPIC)
         └─ KeyResult (E003, THIS EPIC)
```

### 1.2 Program policy fields on `okr_vnext_programs` directly relevant to E003 (already landed in E001 DDL)
- `objective_min_recommended INT NULL`, `objective_max_recommended INT NULL` — Advisor 1–3 recommendation surface (OKR-F-007-AC-01: "Advisor rekomenduje 1–3, nie narzuca sztywnego max" — so these are advisory bounds only, never a hard CHECK on `okr_vnext_objectives` row count).
- `kr_min_required INT NOT NULL DEFAULT 2` — this is the literal `kr_min_required` policy field the E003 AC table's own Schema/constraint cell names for OKR-F-008-AC-02 ("policy `kr_min_required`"). It already exists on the Program row — E003 does not invent a new column, it reads this one.
- `kr_max_recommended INT NULL` — advisory only, same posture as objective bounds.
- `scoring_model TEXT DEFAULT 'zero_to_one' CHECK (IN ('zero_to_one','percentage','categories','custom'))` — governs KR/Objective scoring; E003's progress engine (OKR-F-009-AC-01) must key off this.
- `objective_rollup_model TEXT DEFAULT 'none' CHECK (IN ('equal_average','weighted_average','manual','none'))` — governs whether/how Objective score rolls up from its KRs. Directly answers task-instruction (D): rollup model is a Program-level policy E003 must honor, and `'none'` is a legitimate value (no rollup at all).
- `confidence_enabled BOOLEAN DEFAULT true`, `confidence_model TEXT DEFAULT 'high_medium_low' CHECK (IN ('high_medium_low','numeric','custom'))` — KR-level confidence input shape.
- `objective_confidence_model TEXT DEFAULT 'lowest_kr' CHECK (IN ('lowest_kr','owner_selected','custom'))` — governs how Objective confidence is derived from its KRs' confidence (an explicit non-'none' analogue for confidence rollup — Objective confidence rolls up by default; scoring/progress rollup can be `'none'`).
- `committed_vs_aspirational_enabled BOOLEAN DEFAULT true` — gates whether Objective's `ambition_type` distinction is actually exposed/enforced (OKR-F-007-AC-01 names `committed|aspirational|standard`; when this flag is `false`, presumably every Objective is just `'standard'` — needs a design decision, see §2).
- Policy snapshot mechanism: `okr_vnext_program_policy_versions.snapshot JSONB`, pinned onto each Cycle via `okr_vnext_cycles.policy_version_id` (never updated after Cycle creation). **E003 must resolve scoring/rollup/kr_min_required policy via the Cycle's pinned `policy_version_id` snapshot, not by re-reading the live `okr_vnext_programs` row** — otherwise OKR-F-001-AC-01's non-reinterpretation guarantee (already proven for Cycle-level fields) would silently break for Objective/KR-level fields. This is a design inference, stated explicitly, not literal in any AC — flagged in Open Questions.

### 1.3 Set fields on `okr_vnext_sets` directly relevant to E003 (already landed in E002 DDL, "reserved for E003/E004")
- `overall_progress NUMERIC NULL` — reserved, zero E001/E002 writer.
- `overall_confidence TEXT NULL CHECK (IN ('high','medium','low','numeric'))` — reserved, zero E001/E002 writer.
- `attention_state TEXT DEFAULT 'none' CHECK (IN ('none','watch','action_required','escalated'))` — reserved, zero E001/E002 writer.
- `last_checkin_at`, `next_checkin_due_at TIMESTAMPTZ NULL` — reserved, zero E001/E002 writer.
- E002's own DDL comment: *"Reserved for OKR-E003/E004 rollups — NOT populated, NOT read, by any E002 command."* This is the literal text this design must resolve: **does E003 populate `overall_progress`/`overall_confidence`, or does E004 (check-ins)?** Given `last_checkin_at`/`next_checkin_due_at` are unambiguously check-in-cadence fields (E004's business), but `overall_progress`/`overall_confidence`/`attention_state` are *aggregates of KR state* which E003 creates the KRs for — this needs a firm call. See §5 (Decision D-E3-ROLLUP-OWNER).

### 1.4 The two forward-declared extension points E003 must honor exactly
1. **`isOkrSetReadyForSubmissionEligible(setRow)`** in `okrSetCommands.ts` (E002 §4.4, quoted verbatim above) — E002's own doc says: *"OKR-E003 is expected to layer its ≥2-KR-per-Objective check on top, e.g.: `isOkrSetReadyForSubmissionEligible(s) && hasSufficientKeyResultCoverage(s)` — do not replace this function's body when E003 lands; wrap it."* E003 must add a **new** function, not edit the existing one, and `submitOkrSetForApproval`'s call site must be updated to call both.
2. **`buildOkrSetApprovalSnapshotPayload(client, currentRow)`** in `okrSetCommands.ts` (E002 §4.5 step 3) — currently returns Set fields + `objectives: []` (D8). E003 must populate this array with the actual Objective+KR content at approval time, without touching the immutability contract of `okr_vnext_approved_snapshots` (still an INSERT-only table, `REVOKE UPDATE/DELETE`).

### 1.5 Precedent patterns already proven twice in this program (KPI/ROI) that E003 should reuse, not reinvent
- **SAVEPOINT dedupe pattern** (`createRoiCase`, reused verbatim by `createOkrSet`) — for any uniqueness constraint hit inside `applyMutation`.
- **`computeStateHash`** (`kpiDefinitionCommands.ts`) — content-hash for immutable snapshots, fixed key order.
- **Two-step visibility-policy lookup** (`getActiveVisibilityPolicy` then a second query by `policy_id` for `visibility_mode`) — `createKpiDraft`/`createOkrSet`'s pattern.
- **`::text` cast requirement** on every join against `rvn_platform_resource_visibility.resource_id` — "missed 7 times in one KPI epic," explicitly called out again in E002 §5 and its DoD checklist.
- **Generic guarded-transition helper** (`runOkrCycleLifecycleTransition`, `runOkrSetLifecycleTransition`, mirroring `runRoiCaseLifecycleTransition`) for simple status-only transitions; hand-written `executeAtomicCommand` for transitions with side-effect fields (like `recordOkrSetMaterialChange`).
- **Neutral source binding — ROI-E002's `rvn_roi_benefit_evidence_links`** — named directly by the task instructions as the likely pattern for KR→KPI references; must be read from actual code (§4 below), not assumed from memory.

## 2. Ground truth from `04_OKR_IMPLEMENTATION_PLAN.md` (the richest source for Objective/KR modelling)

### 2.1 Objective YAML shape (plan §4.5, lines 197-216)
```yaml
Objective:
  id: uuid
  okr_set_id: uuid
  owner_user_id: uuid
  title: string
  description: text | null
  rationale: text | null
  ambition_type: committed | aspirational | standard
  status: draft | submitted | approved | active | at_risk | completed | cancelled | closed
  progress: decimal | null
  confidence: high | medium | low | numeric | null
  sort_order: integer
  version: integer
  approved_at: datetime | null
```
"The Advisor recommends 1–3 Objectives. It warns above policy recommendations but does not impose an arbitrary technical maximum." — confirms §1.2's reading: `objective_min_recommended`/`objective_max_recommended` are advisory-only, no CHECK constraint on Objective count per Set.

### 2.2 KeyResult YAML shape (plan §4.6, lines 218-246)
```yaml
KeyResult:
  id: uuid
  objective_id: uuid
  owner_user_id: uuid
  title: string
  description: text | null
  measurement_type: numeric | percentage | currency | binary | milestone | custom
  unit: string | null
  currency: string | null
  baseline_value: decimal | null
  target_value: decimal | null
  start_value: decimal | null
  current_value: decimal | null
  direction: increase | decrease | reach | maintain_range | binary
  range_min: decimal | null
  range_max: decimal | null
  progress: decimal | null
  confidence: high | medium | low | numeric | null
  status: not_started | on_track | at_risk | off_track | achieved | not_achieved | cancelled
  source_type: manual | import | connector | mcp | calculated
  source_reference: string | null
  weight: decimal | null
  version: integer
```
"MVP supports numeric, percentage, currency, and binary. Milestone/custom may exist in schema but must be hidden unless fully implemented." — matches OKR-F-008-AC-01 verbatim ("KR wspiera numeric/percentage/currency/binary (MVP); milestone/custom ukryte dopóki niedokończone"). **Confirms the CHECK constraint must allow all 6 values (schema-permissive) but application/UI layer gates milestone/custom as hidden/unavailable in MVP** — same "reserve the enum slot, gate at command/UI layer" discipline used for `reflection_required_for_close` etc.

"The initial Program policy requires at least two KRs before submission; draft may temporarily contain fewer." — confirms `kr_min_required` (already on `okr_vnext_programs`, default 2) is genuinely a *policy* value, not a hard-coded constant — directly resolves plan §20 open-evidence item #4 ("whether two KRs is a hard submission rule for every Program or only the initial default policy") — **it's the latter, already schema-proven by E001's DDL**.

**Important field-name reconciliation needed**: plan's KeyResult YAML has NO `kpi_id` field at all — no KPI/source reference beyond the generic `source_type`/`source_reference: string | null`. This is the plan's own neutral-source-binding shape: `source_reference` is a bare string, not a FK. Confirms task instruction (C)'s framing: any KPI binding must be exactly this — typed/pinned, no FK-driven rollup. `source_type: manual|import|connector|mcp|calculated` is the enum that would carry a `'kpi'`-sourced value, but plan doesn't literally enumerate `'kpi'` as a source_type value — needs a design decision (§ Open Questions) on whether to extend this enum or use a fully separate side-table modelled on `rvn_roi_benefit_evidence_links`.

### 2.3 Progress geometries — literal formulas (plan §5.4, lines 316-343)
```text
increase: (current - baseline) / (target - baseline)
decrease: (baseline - current) / (baseline - target)
binary: 0 or 100%
percentage direct: configured direct value or baseline-to-target
maintain range: policy-defined in-range evaluation
```
These are the **5 geometries** OKR-F-009-AC-01 names ("Silnik progresu implementuje 5 geometrii"). Mapped to KeyResult's `direction` enum (`increase | decrease | reach | maintain_range | binary`) — note `direction` has 5 values but the plan's geometry list uses different labels (`reach` vs `percentage direct`); this needs literal reconciliation at implementation time — flagged as Open Question, not guessed here.

"Degenerate/missing inputs yield `not_calculable`, not fabricated zero." — literal source of OKR-F-009-AC-01's `not_calculable` sentinel requirement. Degenerate cases explicitly include (inferred from formula shape, not stated as an enumerated list in the plan): `target == baseline` (division by zero in increase/decrease), missing `current_value`, missing `baseline_value`/`target_value` for numeric/percentage/currency types, and for `maintain_range`, missing `range_min`/`range_max`.

"Objective progress uses Program policy. Confidence is never blindly averaged. Every calculated value stores calculation policy/version and reason." — this is the literal source of OKR-F-009-AC-02 ("Każda wyliczona wartość progress/confidence przechowuje politykę/wersję kalkulacji i powód"), AND it directly says Objective-level confidence is a *deliberate, non-trivial* rollup (matches `objective_confidence_model` CHECK options `lowest_kr|owner_selected|custom` — none of which is a plain average) — "never blindly averaged" rules out `equal_average`-style confidence rollup even though `objective_rollup_model` (progress) does permit `equal_average`/`weighted_average`.

Examples given (illustrate why 4 concepts — progress/confidence/status/attention — must be stored, never merged):
- progress 45%, expected 40%, confidence low → attention required despite acceptable progress;
- progress 30%, expected 50%, confidence high → at risk, but manager may validate recovery route;
- missing check-in → stale/attention, never synthetic 0% progress.
"No universal fixed 70/40 thresholds. The policy version defines status suggestions, trajectory, clamping, overachievement, and roll-up." — reinforces: status-suggestion thresholds are Program-policy-driven, not hard-coded — the design must add these as additional Program policy fields if not already present in the E001 DDL (checked: E001's DDL does NOT have explicit status-threshold columns — only `scoring_model`/`objective_rollup_model`/`confidence_model`/`objective_confidence_model`. This is a genuine schema gap E003 likely needs to close — see Open Questions).

### 2.4 D09 / non-goals confirmation (plan §2 item 1, §10, §19, §18 risk table)
- Binding decision #1 (plan §2, line 33): "**Independent domain.** OKR has no required structural parent or inheritance from KPI, ROI, Initiative, project, or task."
- Schema constraints (plan §10, lines 603-613): "no foreign key to KPI, ROI, Initiative, project, or task; **optional external references use typed reference records, not structural ownership**."
- Non-goals (plan §19, lines 921-935): "required Objective/KR links to Initiative, KPI, ROI, task, or project" is explicitly OUT; "automatic KPI-to-KR synchronization in MVP" is explicitly OUT.
- Risk table (plan §18, line 917): "Cross-domain coupling: OKR becomes KPI/PMO child → mitigation: no structural foreign keys; typed optional context only."
**This confirms task instruction (C) is correctly scoped to E003**: even though the E003 AC table itself doesn't literally mention KPI, the plan's binding decisions and non-goals make clear that if/when a KR references a KPI as a data source, it MUST be a typed, optional, non-structural reference — never a FK, never auto-sync. Whether E003 actually BUILDS this binding (vs. reserving the slot for a later epic) is still an open call — see §6/Open Questions.

### 2.5 API contract — literal Objective/KR/check-in routes (plan §9, lines 543-559)
```text
POST   /api/vnext/results/okr/sets/:setId/objectives
PATCH  /api/vnext/results/okr/objectives/:objectiveId
DELETE /api/vnext/results/okr/objectives/:objectiveId
POST   /api/vnext/results/okr/objectives/:objectiveId/key-results
PATCH  /api/vnext/results/okr/key-results/:keyResultId
DELETE /api/vnext/results/okr/key-results/:keyResultId
GET    /api/vnext/results/okr/key-results/:keyResultId/check-ins        (E004)
POST   /api/vnext/results/okr/key-results/:keyResultId/check-ins        (E004)
POST   /api/vnext/results/okr/objectives/:objectiveId/alignments        (E005)
DELETE /api/vnext/results/okr/alignments/:alignmentId                   (E005)
POST   /api/vnext/results/okr/sets/:setId/final-score                   (E007)
POST   /api/vnext/results/okr/objectives/:objectiveId/reflection        (E007)
GET    /api/vnext/results/okr/sets/:setId/history
```
Note the plan's route list literally includes `DELETE` for both Objectives and KRs — the E003 AC table's own Command/API cell only names `POST`/`PATCH` (create/update) — DELETE needs a design call (hard delete vs. soft-cancel status transition; the KeyResult status enum already has `cancelled`, suggesting DELETE at the route layer should map to a cancel-transition command, not a literal SQL DELETE, consistent with this program's "no destructive delete, only status transition" pattern used everywhere else — ROI cases, KPI definitions, OKR Cycles/Sets all use cancel/status enums, never DELETE). This is a design decision, not literal in the AC table — see §6.

### 2.6 Events (plan §11, lines 619-646)
`aggregate_type` enum includes `objective | key_result` explicitly. "Required events include ... Objective/KR changes, material revision, ..." — confirms Objective/KR mutations need audit events, consistent with `atomicWrite.ts`'s existing event-envelope pattern used by E001/E002.

### 2.7 Roles (plan §7.1) relevant to E003
"Objective Owner", "KR Owner", "Contributor", "Viewer", "Auditor (read-only)" — matches the E003 AC table's Roles/visibility column exactly (Objective Owner/Set Owner; KR Owner/Objective Owner; Viewer/Contributor; Auditor). No new role invented beyond what's already in the plan's canonical list — good sign there's no fabricated-role risk here.

---

## 3. Decision-ID cross-reference (master Founder decisions D01-D15, `01_RESULTS_MASTER_IMPLEMENTATION_PLAN.md` §2, verbatim)

The AC table's Decision IDs (D08, D09, D15 — none per-epic-renumbered the way ROI's design docs do) resolve against the **master** Founder decision list, quoted verbatim:

| ID | Decyzja | Konsekwencja implementacyjna |
|---|---|---|
| D08 | OKR Set jest materializowany | Set = Cycle + scope/team + owner |
| D09 | OKR niezależny od KPI/ROI/Initiative | tylko jawne referencje kontekstowe lub neutralny source binding |
| D15 | Teresa od pierwszego etapu | AI jest warstwą organizacyjną, nie późnym dodatkiem |

OKR-F-009-AC-02 cites "D08, D15" — D15's presence (Teresa-from-day-one) is not a mistake: the plan's Teresa safety contract (§12) requires "each factual statement cites authorized aggregate/event/evidence references," so a progress/confidence calculation's stored policy-version+reason is exactly the substrate Teresa's check-in assistance/quality-review will later cite. E003 is building the audit trail D15 will consume, not itself building Teresa.

D09 is not cited anywhere in the E003 AC table's own Decision ID row — but §2.4 above (plan §2/§10/§19/§18 quotes) proves it is still binding on E003 by way of the master plan's cross-cutting schema constraints, independent of which AC table cites it per-row. This is the resolution of the Open Question flagged in §0's reading notes.

## 4. D09 violation inventory — verbatim from `EXECUTION_LEDGER.md` §3.4 (the AS-IS pattern E003 must NOT reproduce)

> ### 3.4 OKR — AS-IS kod (istnieje, nietrywialny, ale D09 częściowo naruszone)
>
> 4 tabele już na żywej bazie demo/prod (`914_okr_management.sql` + RES-009): `okr_cycles`
> (Cycle = osobna encja, kwartalny, opcjonalnie dept/team-scoped), `okr_objectives`
> (z `parent_id` cascade rollup), `okr_key_results` (z `kpi_id`+`kpi_definition_version_id`
> FK), `okr_check_ins` (z deterministycznym `seq` tie-breaker). **Brak `okr_sets` i
> `okr_programs`**...
>
> **Istniejące naruszenia D09 (OKR niezależny od KPI/ROI/Initiative) do odizolowania
> przy budowie nowego `/results/okr`:**
> 1. Schema: `okr_key_results.kpi_id` FK→`initiative_kpis`, `kpi_definition_version_id`
>    FK→`kpi_definition_versions` — twarde FK, mimo że nie napędza już scoringu.
> 2. Serwis: `getSuggestedValueForKeyResult` czyta `kpi_time_series` bezpośrednio;
>    `okrService.ts` importuje `kpiDefinitionService.js` — cross-domain import.
> 3. UI: `OkrKeyResultModal.tsx` dropdown "Related KPI" z `V8ResultsApi.getKpiCatalog()`.
> 4. Brak nawet rozdzielenia EKRANÓW — OKR/KPI/ROI żyją w jednym pliku/module dziś.
>
> **Dobra wiadomość**: scoring jest już manual-only (git: `bfadffdd4a` wprowadził
> auto-score z KPI, `aa26ba4067` to cofnął, `0ce5488184` udokumentował w samej
> migracji jako "superseded to informational-only")...

**Correction to the task instructions' framing**: task instruction (C) says "legacy `okr_key_results.kpi_id` has a live FK to `initiative_kpis`" — the ledger's actual text says the FK target is `initiative_kpis` (confirmed also in OKR-E001 design §0: *"`okr_key_results.kpi_id TEXT` has a live FK to `initiative_kpis`"*), not `kpi_*`/`rvn_kpi_definitions` directly. Two separate legacy KPI concepts exist in this codebase (`initiative_kpis` — Initiative-scoped legacy KPI, vs. `rvn_kpi_definitions` — the vNext KPI domain built in KPI-E001..E007). **A future OKR-vNext KR→KPI binding, if built, should point at `rvn_kpi_definitions`/`rvn_kpi_definition_versions` (the vNext KPI aggregate), never at legacy `initiative_kpis`** — mirroring ROI-E002's own choice of `rvn_kpi_definitions` as the pinned target.

Also confirmed: **items 1-3 of this inventory are explicitly assigned as check-in-suggestion-service work in `EPIC_LEDGER_LIVE.md`'s own OKR-E004 row (OKR-F-012-AC-01, "izolujący AC"), not E003's**: *"Sugerowana wartość check-in NIE CZYTA `kpi_time_series` bezpośrednio ani nie importuje `kpiDefinitionService.js`"* with Schema/constraint cell literally reading **"BRAK FK z `okr_vnext_*` do `kpi_*`"** and Command/API cell reading *"wewnętrzny — typed optional reference, NIE strukturalny odczyt."* **This is the decisive resolution of §0's flagged Open Question: the isolation fix for D09 violations #2 (cross-domain import) and #3 (UI KPI dropdown) is explicitly OKR-E004's job (check-in suggestion service), not OKR-E003's.**

E003's own responsibility, narrower but real: **E003 must not itself introduce a NEW D09 violation while building KeyResult's `source_type`/`source_reference` fields** (plan §4.6). Since the plan's own KeyResult YAML already models `source_type: manual|import|connector|mcp|calculated` + `source_reference: string|null` as a bare, untyped string with zero FK, the safest, most literal reading of the ledger is: **`okr_vnext_key_results` in E003 gets `source_type`/`source_reference` exactly as the plan specifies — a nullable TEXT reference, no FK to anything — and that alone satisfies D09 for this epic.** A fully typed, pinned, ROI-E002-style `OkrKeyResultKpiSourceBinding` side-table (mirroring `rvn_roi_benefit_evidence_links`) is a natural richer alternative but is **not textually required by any OKR-E003 AC** — see Decision D-E3-KPI-BINDING in §6 and Open Questions §J for the two build-now-vs-defer options, argued both ways.

## 5. ROI-E002's `rvn_roi_benefit_evidence_links` — the neutral-source-binding precedent, read from actual code

File: `server/migrations/20260816_rvn_roi_economic_model.sql` (lines 279-304), `server/src/services/resultsVnext/roi/roiBenefitEvidenceLinkCommands.ts` (`addBenefitEvidenceLink`, `removeBenefitEvidenceLink`, `flagEvidenceLinkFreshnessCheck`), `roiEconomicModelRepository.ts` (`listBenefitEvidenceLinks` hydration).

```sql
CREATE TABLE IF NOT EXISTS rvn_roi_benefit_evidence_links (
  link_id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_line_id                     UUID NOT NULL REFERENCES rvn_roi_benefit_lines(benefit_line_id),
  case_id                             UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                     TEXT NOT NULL,

  kpi_id                              UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  pinned_kpi_definition_version_id    UUID NOT NULL REFERENCES rvn_kpi_definition_versions(definition_version_id),

  expected_unit                       TEXT NULL,
  purpose                             TEXT NOT NULL CHECK (purpose IN ('primary_evidence','supporting')),

  linked_by                           TEXT NOT NULL,
  linked_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
  freshness_checked_at                TIMESTAMPTZ NULL,
  dispute_status                      TEXT NOT NULL DEFAULT 'none' CHECK (dispute_status IN ('none','stale','disputed')),
  notes                               TEXT NULL,

  row_version                         INT NOT NULL DEFAULT 1,
  created_by                          TEXT NOT NULL,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Sharp discrepancy that must NOT be silently copied**: `rvn_roi_benefit_evidence_links.kpi_id` IS a real `REFERENCES rvn_kpi_definitions(kpi_id)` foreign key — a genuine structural FK. That is acceptable for ROI because ROI has no D09-equivalent "zero FK to KPI" rule — the master plan's own line (`EXECUTION_LEDGER.md` §3.5) says ROI treats "KPI jako opcjonalna ewidencja (nie parent)," a softer constraint than OKR's literal "**no foreign key to KPI**...period" (OKR-E001 design §0, direct quote) and plan §10's "no foreign key to KPI, ROI, Initiative, project, or task" (stated as a general OKR schema constraint). **An OKR analogue of this table must therefore drop the FK on the KPI-pointing column(s) — store `kpi_id`/`pinned_kpi_definition_version_id` as plain nullable TEXT (or UUID-typed-but-unreferenced) columns, validated for organization-scoped existence at command time only (same existence-check pattern `addBenefitEvidenceLink` already runs), never enforced by the database.** This is the one substantive adaptation needed when mirroring the ROI pattern for OKR — everything else (typed columns, `purpose` enum, `linked_by`/`linked_at`, no auto-propagation, hydration-only-at-read-time) transfers directly.

Command-layer pattern worth reusing verbatim (comment from the file, ROI-E002 §, Decision D14):
> "`addBenefitEvidenceLink` validates that `kpiId`/`pinnedKpiDefinitionVersionId` exist and share the case's `organization_id` — an ORGANIZATION-scoped existence check only, NOT a KPI-visibility check on the linker... only a repository read that HYDRATES the link into display-ready KPI content must pass through KPI's own visibility scope."

Freshness/staleness is **never stored as a live-updating flag** — `isStale` is computed read-time-only inside `listBenefitEvidenceLinks`'s hydration path (`roiEconomicModelRepository.ts`):
```typescript
isStale: kpiRow ? row.pinned_kpi_definition_version_id !== kpiRow.current_definition_version_id : null,
```
i.e., compare the link's pinned version id against the KPI's *current* version id at read time; `null` when hydration was skipped or the viewer lacks KPI visibility. `flagEvidenceLinkFreshnessCheck` (added later, ROI-E007) is a pure human-acknowledgment command — `freshness_checked_at=now()` and nothing else, verified by "a dedicated static source-text test" that the command body never writes to any `rvn_kpi_*` table. **This exact no-write-back guarantee is the concrete mechanism satisfying "no auto-scoring, no auto-propagation" for any OKR KR→KPI binding**, should E003 (or a later epic) build one.

## 6. Other precedent code read directly (child-row and platform primitives)

**`roiCostLineCommands.ts`** (`server/src/services/resultsVnext/roi/roiCostLineCommands.ts`, full file read) — the closest structural analogue to Objective/KeyResult as list-items under a parent aggregate:
- `addCostLine`/`updateCostLine`/`removeCostLine` (soft-delete via `deleted_at`/`deleted_by`, never a SQL `DELETE`) — **this is the concrete precedent for how OKR-E003's own `DELETE /objectives/:id` and `DELETE /key-results/:id` routes (named literally in the plan's API contract §9) should be implemented: as a status/soft-delete transition, not a literal row delete** — matches this program's universal "no destructive delete, only status transition" convention (ROI cases, KPI definitions, OKR Cycles/Sets all use cancel/status enums).
- Parent-status guard pattern: `assertCaseEditableForUpdate(client, caseId, organizationId, opName)` — `SELECT status FROM <parent> WHERE id=$1 AND organization_id=$2 FOR UPDATE`, throws a domain-specific `NotEditableError` if the parent is in a non-editable status. **Direct template for E003's own `assertSetEditableForUpdate`** — Objectives/KRs should only be mutable while their owning `okr_vnext_sets.status` is in an editable set (almost certainly `draft`/`changes_requested`, mirroring `updateOkrSetDraft`'s own guard from E002 §4.2 — content edits are draft-gated there too).
- **Critical event-authoring pattern**: even though `addCostLine`/`updateCostLine`/`removeCostLine` mutate a *child* row (`rvn_roi_cost_lines`), every event they emit uses `aggregateType: 'roi_case'` and `aggregateId: caseId` — **the PARENT's identity, not the child row's own id**. E003 must do the same: Objective/KeyResult events use `aggregateType: 'okr_set'`, `aggregateId: setId` (or arguably `'okr_objective'`/`aggregateId: objectiveId` for KR-level events — needs a decision, see D-E3-8 below), never `'okr_objective'`/`objectiveId` as a peer aggregate type unless a new `RVN_RESOURCE_TYPES`-style registration is made.
- `frozen_at` immutability guard (`RoiCostLineFrozenError`) — a per-row freeze mechanism separate from parent status; not obviously needed for Objective/KR (no analogous "line freeze" concept named in any OKR AC) — noted but not adopted without AC backing.

**`atomicWrite.ts`** (`server/src/services/resultsVnext/platform/atomicWrite.ts`, signatures read directly, lines 347-474): `executeAtomicCreate<TResult>` for new rows (no CAS), `executeAtomicCommand<TAggregateRow,TResult>` for CAS'd mutations of an existing row (`loadForUpdate`/`getCurrentVersion`/`applyMutation`/`buildEvent`, `expectedVersion` precondition, idempotency via `ON CONFLICT (organization_id, idempotency_key) DO NOTHING` on `rvn_platform_events`). `AtomicCommandOutcome<TResult>` returns `{outcome:'applied'|'duplicate', eventId, resultingVersion, result}`. E003's Objective/KeyResult commands use these two primitives exactly as ROI's cost/benefit-line commands do — no new platform primitive needed for E003's own CRUD.

**`kpiDefinitionCommands.ts`** (`server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts`, header + `computeStateHash`, lines 1-90): `computeStateHash(state)` = `sha256(JSON.stringify(state))`, reused verbatim across KPI/ROI for event `stateHash` and (in E002) for `okr_vnext_approved_snapshots.content_hash`. Confirms E003's own approval-snapshot extension (§9 below) should reuse this same function, not write a new hash routine. Definition+version pairing pattern (`createKpiDraft` creates both a definition row and its v1 version row atomically) is NOT directly needed for Objective/KeyResult, since the E003 AC table's own `version: integer` field on both entities (plan §4.5/§4.6) is a plain optimistic-concurrency counter (`row_version`-CAS style), not a KPI-style append-only version-history table — no AC asks for full Objective/KeyResult edit history the way `okr_vnext_set_versions` provides for Set-level material changes.

**`visibilityScopedQuery.ts`** (`server/src/services/resultsVnext/platform/visibilityScopedQuery.ts`, lines 1-125 read directly): `buildVisibilityScopedCte({userId, organizationId, resourceType})` returns `{sql, values}` for a `WITH rvn_visible_resources(resource_type, resource_id) AS (...)` CTE; callers `INNER JOIN rvn_visible_resources vr ON vr.resource_type = '<type>' AND vr.resource_id = <table>.<pk>`. `VISIBILITY_CTE_PARAM_COUNT = 3`. **Confirmed directly in code**: `resource_id` in `rvn_platform_resource_visibility`/the CTE is compared against the caller's PK column with no cast shown in the illustrative example — meaning callers are individually responsible for supplying a `::text`-cast join predicate when their own PK is UUID-typed (matching E002 §5's explicit warning: *"`rvn_platform_resource_visibility.resource_id` is TEXT; `okr_vnext_sets.set_id` is UUID — every join casts `::text`."*). This is NOT enforced by `visibilityScopedQuery.ts` itself — it is a per-repository discipline, confirmed by reading the module's own code, not merely inherited by assumption.

**Critical re-verification finding (per task instructions)**: `ls server/src/services/resultsVnext/okr/` in this worktree returns **"No such file or directory"** and `server/migrations/` contains no `okr_vnext_*` migration file yet — **OKR-E001 and OKR-E002's code has NOT landed in this worktree as of this design's drafting (only their frozen design docs have)**. Every exact signature this design cites from E001/E002 (`isOkrSetReadyForSubmissionEligible`, `buildOkrSetApprovalSnapshotPayload`, `runOkrCycleLifecycleTransition`, table/column names) is taken from their **frozen design documents**, not from running code, and — exactly as E002's own doc demanded of itself toward E001 — **must be re-verified against actual landed E001/E002 code before E003 implementation begins.** This is the single most important "flag for re-verification" item in this whole design.

---

## 7. Design decisions (D-E3-1 through D-E3-12)

| # | Question | Decision | Rationale |
|---|---|---|---|
| D-E3-1 | Table names? | `okr_vnext_objectives`, `okr_vnext_key_results` — exactly as literally named in the E003 AC table's own Schema/constraint cells. | Not a judgment call — the ledger names both tables verbatim. |
| D-E3-2 | Objective/KeyResult column shape? | Adopt plan §4.5/§4.6 YAML almost verbatim, adapted to this program's naming conventions (`snake_case` columns, explicit `organization_id`, `row_version` not bare `version`, `created_by`/`created_at`/`updated_by`/`updated_at` audit quad matching every other E001/E002 table). See full DDL §8. | The plan doc is this program's own richest, most literal ground truth for these two entities — deviating from its field list without an AC-backed reason would be inventing scope, the same discipline OKR-E001/E002 applied to every other table. |
| D-E3-3 | Does `ambition_type` (committed\|aspirational\|standard) get a hard CHECK, and how does `committed_vs_aspirational_enabled=false` interact with it? | CHECK allows all 3 values always (schema-permissive). When the Program's active policy has `committed_vs_aspirational_enabled=false`, `createObjective`/`updateObjective` **reject** `committed`/`aspirational` at the command layer (`OkrObjectiveValidationError('AMBITION_TYPE_DISABLED', ...)`) — only `standard` is accepted. | OKR-F-007-AC-01 requires the column/enum to exist; the plan's `committed_vs_aspirational_enabled` flag (E001 DDL) must have SOME enforcement point or it is dead schema — command-layer gating is the same "reserve the enum, gate at command layer" pattern used for `measurement_type`'s milestone/custom values (D-E3-4) and matches this program's convention of enforcing policy flags in commands, not via a conditional CHECK constraint (Postgres CHECKs cannot reference another table's row). |
| D-E3-4 | Does `measurement_type` CHECK allow milestone/custom, and how are they kept "hidden until fully implemented"? | CHECK allows all 6 values (`numeric,percentage,currency,binary,milestone,custom`) — schema-permissive, matching the plan's explicit "may exist in schema but must be hidden" instruction. `createKeyResult`/`updateKeyResult` **reject** `milestone`/`custom` at the command layer (`OkrKeyResultValidationError('MEASUREMENT_TYPE_NOT_IMPLEMENTED', ...)`) until a later epic implements their progress-calculation geometry. | Literal reading of OKR-F-008-AC-01: "KR wspiera numeric/percentage/currency/binary (MVP); milestone/custom ukryte dopóki niedokończone" — "ukryte" (hidden) at the UI layer alone would leave a command-layer hole (a direct API call could still create a `milestone` KR with a progress engine that doesn't know how to score it); rejecting at the command layer closes that hole and is the more defensible reading of "MVP supports X" as a hard boundary, not just a UI suggestion. |
| D-E3-5 | Is `kr_min_required` (≥2 KR) enforced per-Objective, or as a Set-wide total? | **Per-Objective** — every Objective on the Set must have at least `kr_min_required` non-cancelled KRs before the Set can submit. | E002's own forward-declaration (§4.4, quoted verbatim in §1.4 above) names the extension explicitly as `hasSufficientKeyResultCoverage` checking "≥2-KR-**per-Objective**" — this is the literal wording E002's frozen, already-reviewed doc uses to describe what E003 is expected to build, taken as binding even though the E003 AC table's own prose ("Polityka wymaga ≥2 KR przed submission") is ambiguous in isolation. Flagged as needing final confirmation against the Founder's actual intent — see Open Questions §13. |
| D-E3-6 | Progress-calculation policy source: live re-read of `okr_vnext_programs`, or the Cycle's pinned `policy_version_id` snapshot? | **The Cycle's pinned policy snapshot** (`okr_vnext_program_policy_versions.snapshot`, reached via `okr_vnext_sets.cycle_id → okr_vnext_cycles.policy_version_id`). | Consistent with OKR-F-001-AC-01's non-reinterpretation guarantee, already proven at the Cycle level by E001; extending live-policy-reads into Objective/KR scoring would silently reopen the exact class of bug D08/AC-01 exists to prevent — a Program republish must never change how an already-open Cycle's Objectives are scored. Not literal in any E003 AC text — a design inference stated explicitly, not guessed silently. |
| D-E3-7 | Progress engine: pure function or DB-coupled service? | **Pure, DB-free function package** (`okrProgressEngine.ts`), same discipline as ROI's engine ("MUSI być pure domain package (bez UI/DB/network)", `EXECUTION_LEDGER.md` §3.5) and KPI's target-geometry evaluator. Takes a plain `{measurementType, direction, baselineValue, targetValue, startValue, currentValue, rangeMin, rangeMax}` input plus the resolved policy snapshot, returns `{progress: number \| 'not_calculable', reason?: string}`. Called from inside `createKeyResult`/`updateKeyResult`'s `applyMutation` (same transaction, same pinned client) to compute-and-persist `progress` synchronously on write — never a background job for MVP (no async recompute pipeline named by any AC). | OKR-F-009-AC-01 requires 5 geometries with a `not_calculable` sentinel — a known-answer-testable pure function is the only way to make that a crisp, unit-testable claim, mirroring ROI's own "known-answer suite" discipline (`EXECUTION_LEDGER.md` §3.5). |
| D-E3-8 | Event aggregate identity for Objective/KeyResult mutations? | `aggregateType: 'okr_set'`, `aggregateId: setId` for BOTH Objective and KeyResult events (not `'okr_objective'`/`objectiveId`). | Direct precedent: `roiCostLineCommands.ts`/`roiBenefitLineCommands.ts` use the PARENT Case's identity for every child-line event, never the line's own id as a peer aggregate. `okr_vnext_objectives`/`okr_vnext_key_results` are child rows of the Set aggregate exactly the way cost/benefit lines are child rows of the Case aggregate — same shape, same answer. Avoids needing new `RVN_RESOURCE_TYPES`/`CanonicalObjectTypeValues` entries for `'okr_objective'`/`'okr_key_result'` (§10 below). |
| D-E3-9 | Set-level rollup fields (`overall_progress`/`overall_confidence`/`attention_state`/`last_checkin_at`/`next_checkin_due_at`) — E003's job or E004's? | **E004's job, all five fields, deferred whole.** E003 populates and persists `progress`/`confidence` on `okr_vnext_objectives` and `okr_vnext_key_results` themselves (KR-level computed by the progress engine per D-E3-7; Objective-level rolled up from its own KRs per the Program's `objective_rollup_model`/`objective_confidence_model`, computed and persisted in the same transaction whenever a child KR's progress/confidence changes) — but does **not** write anything to `okr_vnext_sets`. | The E003 AC table's own Aggregate/owner column never names "OKRSet" for any of its 5 ACs — only "Objective," "KeyResult," and "Progress calc service (per KR)"/"Progress/confidence calc service." `attention_state` structurally requires check-in freshness signal (`last_checkin_at`/`next_checkin_due_at`) that literally does not exist until OKR-E004 builds check-ins — computing a meaningful `attention_state` before any check-in has ever happened would be premature. Splitting "compute 3 of 5 reserved fields now, defer 2" has no AC textual support for exactly that split; deferring the whole group to the epic whose own AC table (OKR-F-011-AC-01) explicitly names `attention_state`/status as its concern is the more defensible, literal reading. |
| D-E3-10 | Objective-confidence rollup formula, concretely? | Implement all three `objective_confidence_model` branches: `lowest_kr` (the numerically-worst confidence among the Objective's non-cancelled KRs, using an explicit `high > medium > low` / numeric ordering — never averaged, per plan §5.4's literal "Confidence is never blindly averaged"), `owner_selected` (Objective Owner sets it directly via `updateObjective`, ignoring KR confidence entirely), `custom` (not implemented in E003 — reject with `OkrObjectiveValidationError('CONFIDENCE_MODEL_NOT_IMPLEMENTED', ...)` if a Program's active policy specifies `custom`, same "schema-permissive, command-layer-gated" pattern as D-E3-3/D-E3-4). | Plan §5.4 explicitly forbids blind averaging; the Program policy CHECK already enumerates exactly these 3 values (E001 DDL) — E003 must give each a real behavior or explicitly refuse the unimplemented one, never silently average as a fallback for `custom`. |
| D-E3-11 | KR→KPI neutral source binding — build now, or reserve the slot? | **Reserve the slot only; do not build the typed binding table in E003.** `okr_vnext_key_results` gets `source_type TEXT NOT NULL DEFAULT 'manual' CHECK (IN ('manual','import','connector','mcp','calculated'))` and `source_reference TEXT NULL` exactly per the plan's YAML — a bare, FK-less, informational string. No `okr_vnext_key_result_kpi_source_bindings` table (the ROI-E002-style typed/pinned side-table) is built in this epic. | No OKR-E003 AC literally requires a KPI-binding mechanism (confirmed by direct read of all 5 ACs — none mention KPI/source binding). The plan's own non-goals (§19) list "automatic KPI-to-KR synchronization in MVP" as explicitly OUT. Building the richer typed-binding table now would be scope not textually requested by this epic's ACs — the same "don't fabricate scope" discipline OKR-E002 applied to `okr_vnext_population_rules` (D2, deferred with zero behavior). If a future epic (E004 check-ins, or a dedicated "OKR-KPI evidence" epic) needs it, ROI-E002's `rvn_roi_benefit_evidence_links` is the exact template to adapt — **with the FK dropped** on the KPI-pointing column(s), per §5's sharp-discrepancy note above, since D09's "zero FK to KPI" is stricter than ROI's own "KPI as optional evidence" rule. Stated as a real, load-bearing design choice, not silently absent — see Open Questions §13 for the argument the other way. |
| D-E3-12 | `sort_order` (Objective) — assigned how, and is there a re-order command? | Server-assigns `sort_order = COALESCE(MAX(sort_order),0)+1` scoped to the Set at `createObjective` time (same "append at the end" default ROI's line-items and KPI's definitions use nowhere explicitly but is the only sane default with zero AC guidance). A dedicated `PATCH .../objectives/:id/reorder` is **not built** — no AC or plan section asks for drag-reorder; `PATCH .../objectives/:objectiveId` can still adjust `sort_order` directly as a plain field edit if a caller wants to, without a bespoke reorder endpoint. | No AC or plan-doc line mentions reordering; a dedicated reorder command would be fabricated scope. Plain field PATCH is sufficient and matches the generality of `updateOkrSetDraft`'s own plain-CAS-update shape. |

---

## 8. Schema (full DDL)

Migration file: `server/migrations/20260824_rvn_okr_objective_key_result.sql` (next in the OKR migration sequence after E001's `20260822_...` and E002's `20260823_...` — **re-verify these exact filenames/dates against what actually landed before picking the next one**, per §6's re-verification finding).

```sql
-- ============================================================
-- okr_vnext_objectives — root aggregate #4 (child of okr_vnext_sets).
-- Plan §4.5 YAML, adapted to this program's column/audit conventions.
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_objectives (
  objective_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id                      UUID NOT NULL REFERENCES okr_vnext_sets(set_id),
  organization_id              TEXT NOT NULL,

  owner_user_id                 TEXT NOT NULL,
  title                          TEXT NOT NULL,
  description                     TEXT NULL,
  rationale                        TEXT NULL,

  -- D-E3-3: schema-permissive, command-layer-gated by
  -- Program.committed_vs_aspirational_enabled.
  ambition_type                     TEXT NOT NULL DEFAULT 'standard'
                                      CHECK (ambition_type IN ('committed','aspirational','standard')),

  -- Plan §4.5's own status enum, verbatim.
  status                              TEXT NOT NULL DEFAULT 'draft'
                                       CHECK (status IN (
                                         'draft','submitted','approved','active',
                                         'at_risk','completed','cancelled','closed'
                                       )),

  -- D-E3-9: computed/persisted BY E003 (rolled up from this Objective's own
  -- KRs), never by a Set-level process. NULL = not yet calculable (no KRs,
  -- or all KRs individually not_calculable).
  progress                             NUMERIC NULL,
  progress_calc_policy_version_id      UUID NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  progress_calc_reason                 TEXT NULL,

  -- D-E3-10: rolled up per objective_confidence_model (lowest_kr/owner_selected).
  confidence                            TEXT NULL CHECK (confidence IN ('high','medium','low','numeric')),
  confidence_numeric_value              NUMERIC NULL,  -- populated only when confidence='numeric'
  confidence_calc_policy_version_id     UUID NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  confidence_calc_reason                TEXT NULL,

  sort_order                             INT NOT NULL DEFAULT 0,

  row_version                             INT NOT NULL DEFAULT 1,
  created_by                              TEXT NOT NULL,
  created_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                              TEXT NULL,
  updated_at                              TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at                             TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_objectives_org_set
  ON okr_vnext_objectives(organization_id, set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_objectives_org_owner
  ON okr_vnext_objectives(organization_id, owner_user_id);

-- ============================================================
-- okr_vnext_key_results — root aggregate #5 (child of okr_vnext_objectives).
-- Plan §4.6 YAML, adapted. D09: NO FK on any KPI-pointing column (D-E3-11).
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_vnext_key_results (
  key_result_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id                  UUID NOT NULL REFERENCES okr_vnext_objectives(objective_id),
  set_id                         UUID NOT NULL REFERENCES okr_vnext_sets(set_id),  -- denormalized for cheap Set-scoped queries, mirrors okr_vnext_objectives.set_id
  organization_id                 TEXT NOT NULL,

  owner_user_id                    TEXT NOT NULL,
  title                             TEXT NOT NULL,
  description                        TEXT NULL,

  -- D-E3-4: schema allows all 6, command layer rejects milestone/custom
  -- until a later epic implements their geometry.
  measurement_type                    TEXT NOT NULL
                                       CHECK (measurement_type IN (
                                         'numeric','percentage','currency','binary','milestone','custom'
                                       )),
  unit                                 TEXT NULL,
  currency                             TEXT NULL,  -- required at command layer when measurement_type='currency'

  baseline_value                        NUMERIC NULL,
  target_value                          NUMERIC NULL,
  start_value                           NUMERIC NULL,
  current_value                         NUMERIC NULL,

  -- Plan §4.6's 5-value enum — the 5 geometries of OKR-F-009-AC-01.
  direction                              TEXT NOT NULL
                                         CHECK (direction IN ('increase','decrease','reach','maintain_range','binary')),
  range_min                              NUMERIC NULL,  -- required at command layer when direction='maintain_range'
  range_max                              NUMERIC NULL,

  -- D-E3-7: computed/persisted synchronously on every write by the pure
  -- progress engine. 'not_calculable' stored as NULL progress +
  -- non-null progress_calc_reason explaining why (never a fabricated 0).
  progress                                NUMERIC NULL,
  progress_calc_policy_version_id         UUID NOT NULL REFERENCES okr_vnext_program_policy_versions(policy_version_id),
  progress_calc_reason                    TEXT NULL,  -- non-null exactly when progress IS NULL (not_calculable) or on any recompute

  confidence                               TEXT NULL CHECK (confidence IN ('high','medium','low','numeric')),
  confidence_numeric_value                 NUMERIC NULL,

  status                                    TEXT NOT NULL DEFAULT 'not_started'
                                             CHECK (status IN (
                                               'not_started','on_track','at_risk','off_track',
                                               'achieved','not_achieved','cancelled'
                                             )),

  -- D-E3-11: neutral, FK-less, informational-only. D09 compliance.
  source_type                                TEXT NOT NULL DEFAULT 'manual'
                                               CHECK (source_type IN ('manual','import','connector','mcp','calculated')),
  source_reference                           TEXT NULL,  -- opaque string; NEVER a live FK to kpi_*/rvn_kpi_*/initiative_kpis

  weight                                      NUMERIC NULL,  -- for future weighted_average objective_rollup_model

  row_version                                 INT NOT NULL DEFAULT 1,
  created_by                                  TEXT NOT NULL,
  created_at                                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                                  TEXT NULL,
  updated_at                                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cross-field sanity, not full business-rule validation (that's the
  -- command layer's job — this CHECK exists only to catch obviously
  -- malformed rows, same restraint OKR-E001 P9 used for Cycle timestamps).
  CHECK (
    (direction <> 'maintain_range') OR (range_min IS NOT NULL AND range_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_okr_vnext_key_results_org_objective
  ON okr_vnext_key_results(organization_id, objective_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_key_results_org_set
  ON okr_vnext_key_results(organization_id, set_id);
CREATE INDEX IF NOT EXISTS idx_okr_vnext_key_results_org_owner
  ON okr_vnext_key_results(organization_id, owner_user_id);

-- ============================================================
-- No new RVN_RESOURCE_TYPES / rvn_platform_resource_visibility rows for
-- Objective/KeyResult (D-E3-8, §10 below) — visibility inherits via set_id.
-- No REVOKE UPDATE/DELETE on either table — both are ordinarily-mutable
-- aggregates (row_version-CAS), unlike okr_vnext_approved_snapshots.
-- ============================================================
```

**Migration-ordering note**: this migration ALTERs nothing on `okr_vnext_programs`/`okr_vnext_cycles`/`okr_vnext_sets` — purely additive, two new tables, both referencing tables E001/E002 already created. If Open Question §13's "status-suggestion threshold policy fields" gap is confirmed real and in-scope, a **separate** `ALTER TABLE okr_vnext_programs ADD COLUMN ...` migration would be needed — not folded into this one, to keep this epic's migration purely additive-new-tables like every prior epic's first migration.

---

## 9. Progress-calculation engine (`okrProgressEngine.ts`) — pure, DB-free

Per D-E3-7. Location: `server/src/services/resultsVnext/okr/okrProgressEngine.ts`, imported (never re-implemented) by `okrKeyResultCommands.ts` and `okrObjectiveCommands.ts`.

### 9.1 KR-level geometry table (literal formulas from plan §5.4, mapped onto the `direction` enum)

| `direction` | Applies to `measurement_type` | Formula | Degenerate → `not_calculable` when |
|---|---|---|---|
| `increase` | numeric, percentage, currency | `(current - baseline) / (target - baseline)` | `target == baseline` (div-by-zero); `current`/`baseline`/`target` any NULL |
| `decrease` | numeric, percentage, currency | `(baseline - current) / (baseline - target)` | `baseline == target`; any of the three NULL |
| `reach` | numeric, percentage, currency (no baseline semantics) | `current / target` | `target == 0`; `current`/`target` NULL |
| `maintain_range` | numeric, percentage, currency | Policy-defined in-range evaluation — **plan §5.4 literally says "maintain range: policy-defined in-range evaluation" with no formula given.** MVP interpretation proposed here (NOT literal AC text — flagged Open Question): `progress = 100` if `range_min <= current <= range_max`, else a linear falloff outside the range clamped to `[0,100]` using the nearer range boundary as the reference point, e.g. below range: `max(0, 100 - ((range_min - current) / (range_min)) * 100)` — **this exact falloff formula is a guess, not sourced from any doc**, and must be confirmed by the Founder before implementation, not silently shipped. | `range_min`/`range_max`/`current` any NULL |
| `binary` | binary | `100` if `current_value` truthy/equals a policy-defined "achieved" sentinel (e.g. `1`/`'true'`/`'achieved'`), `0` otherwise | `current_value` NULL, or not interpretable as a boolean under the policy's sentinel convention (itself unspecified by any doc — Open Question) |

**Reconciliation note (stated explicitly, not silently resolved)**: the plan's own prose list of "5 geometries" (`increase, decrease, binary, percentage direct, maintain range`) uses the label **"percentage direct"** where the `direction` enum (also plan §4.6) uses **"reach."** This document treats them as the same geometry (`reach` = "percentage direct: configured direct value or baseline-to-target") because no other 5th enum value exists to map it to and the arithmetic (`current/target`, no baseline required) matches "direct value" more than any baseline-relative formula — but this is an inference, not a literal same-sentence confirmation anywhere in the source docs. **Do not treat this mapping as settled without Founder/Integration-Owner confirmation** — see Open Questions §13, flagged there as the single highest-risk ambiguity in this whole design (a wrong scoring formula is silent product damage, same class of risk as ROI's NPV formula).

### 9.2 Overachievement / clamping

Plan §5.4: "The policy version defines status suggestions, trajectory, clamping, overachievement, and roll-up." **No concrete clamping/overachievement rule exists in any doc** (e.g., does 120% attainment on an `increase` KR clamp to 100% progress, or display as 120%?). E001's DDL has no policy column for this. Proposed for this design (Open Question, not silently decided): store the raw computed ratio **unclamped** in `progress` (so 120% is stored as `120`, permitting genuine overachievement display), and let UI/status-suggestion logic (not built in E003) decide how to visually treat >100%. Reason: clamping at write time would destroy information a later epic (E006 support/decisions, E007 review) might need to distinguish "hit target exactly" from "blew past target" — reversible decisions (don't clamp) are safer than irreversible ones (clamp and lose the real number) when the policy is genuinely undefined.

### 9.3 Engine signature

```typescript
export interface KeyResultProgressInput {
  measurementType: 'numeric' | 'percentage' | 'currency' | 'binary' | 'milestone' | 'custom';
  direction: 'increase' | 'decrease' | 'reach' | 'maintain_range' | 'binary';
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
}

export interface ProgressCalcResult {
  progress: number | null;        // null = not_calculable
  reason: string | null;          // non-null when progress is null, OR always populated with the formula used (audit trail, OKR-F-009-AC-02)
}

/** Pure, DB-free, deterministic. Never throws — degenerate inputs return
 * {progress: null, reason: 'not_calculable: <specific cause>'}, never a
 * fabricated 0 (OKR-F-009-AC-01's literal requirement). */
export function calculateKeyResultProgress(input: KeyResultProgressInput): ProgressCalcResult;

export interface ObjectiveRollupInput {
  keyResultProgresses: Array<{ progress: number | null; weight: number | null }>;
  rollupModel: 'equal_average' | 'weighted_average' | 'manual' | 'none';
}

/** 'none' → always {progress: null, reason: 'rollup_model_none'} — a
 * legitimate policy choice (Objective progress simply isn't rolled up).
 * 'manual' → always {progress: null, reason: 'rollup_model_manual_owner_sets_directly'}
 * (Objective Owner sets progress via updateObjective, engine defers).
 * 'equal_average'/'weighted_average' → skip not_calculable KRs; if ALL KRs
 * are not_calculable, result is itself not_calculable, never treated as 0. */
export function calculateObjectiveProgressRollup(input: ObjectiveRollupInput): ProgressCalcResult;

export interface ObjectiveConfidenceRollupInput {
  keyResultConfidences: Array<{ confidence: 'high' | 'medium' | 'low' | 'numeric' | null; confidenceNumericValue: number | null }>;
  confidenceModel: 'lowest_kr' | 'owner_selected' | 'custom';
  ownerSelectedValue?: { confidence: 'high' | 'medium' | 'low' | 'numeric'; confidenceNumericValue: number | null } | null;
}

/** 'lowest_kr' orders high > medium > low (numeric compared on its own
 * scale, never mixed-compared against the categorical scale — if KRs use
 * mixed confidence models within one Objective, result is not_calculable,
 * flagged as a genuine open modelling question, see §13). NEVER averages
 * (plan §5.4 literal prohibition). */
export function calculateObjectiveConfidenceRollup(input: ObjectiveConfidenceRollupInput): { confidence: string | null; confidenceNumericValue: number | null; reason: string | null };
```

Every call site persists `progress_calc_policy_version_id` (the Cycle's pinned policy version, per D-E3-6) and `progress_calc_reason` alongside the numeric result — this is the literal mechanism satisfying OKR-F-009-AC-02 ("Każda wyliczona wartość progress/confidence przechowuje politykę/wersję kalkulacji i powód").

---

## 10. Command layer (`server/src/services/resultsVnext/okr/`)

### 10.1 `assertSetEditableForUpdate` (shared helper, `okrObjectiveCommands.ts`)

Mirrors `roiCostLineCommands.ts`'s `assertCaseEditableForUpdate` exactly:
```typescript
async function assertSetEditableForUpdate(client: PoolClient, setId: string, organizationId: string, op: string): Promise<OkrSetRow> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  const row = result.rows[0];
  if (!row) throw new Error(`[${op}] set ${setId} not found`);
  if (!['draft', 'changes_requested'].includes(row.status)) {
    throw new OkrObjectiveSetNotEditableError(setId, row.status);
  }
  return row;
}
```
Guard scope decision (not independently AC-backed, inferred from E002 §4.2's identical `updateOkrSetDraft` guard): Objective/KR content is editable only while the Set itself is `draft`/`changes_requested` — matching Set-level content edits exactly. **Once a Set is `approved`/`active`, adding/editing Objectives/KRs is out of scope for E003** — that would be a "material change to an active Set" (E002's `recordOkrSetMaterialChange`, field-scoped to `title`/`owner_user_id`/`reviewer_user_id` only, does NOT cover Objective/KR content). This is a genuine scope gap between E002 and E003 — flagged in Open Questions §13 (an Active Set's Objectives/KRs are effectively frozen until some later epic adds an Objective/KR-scoped material-change path).

### 10.2 `createObjective` — `executeAtomicCreate`

`assertSetEditableForUpdate`; policy lookup for `committed_vs_aspirational_enabled` (via the Set's Cycle's pinned policy snapshot, D-E3-6) to gate `ambitionType`; `sort_order` server-assigned (D-E3-12); INSERT; event `okr_objective.created` (`aggregateType:'okr_set'`, `aggregateId: setId`, per D-E3-8).

### 10.3 `updateObjective` — `executeAtomicCommand`

CAS on `okr_vnext_objectives.row_version`. `assertSetEditableForUpdate` on the parent Set (loaded via the Objective's own `set_id`). Same `ambition_type` gating as create. If `objective_confidence_model='owner_selected'` and the caller supplies `confidence`, this command is the one place that value is written directly (D-E3-10) — otherwise `confidence` is engine-computed and this field is rejected as a direct edit input (`OkrObjectiveValidationError('CONFIDENCE_NOT_OWNER_EDITABLE', ...)`).

### 10.4 `cancelObjective` (maps the plan's `DELETE /objectives/:objectiveId`, per §6's soft-delete precedent)

`runOkrObjectiveLifecycleTransition`-style guarded transition to `status='cancelled'`, `fromStatuses: ['draft','submitted','approved','active','at_risk']`. Cascades: when an Objective is cancelled, its own KRs are NOT automatically cancelled (no AC or plan text asks for cascade — cascading cancel would be a design addition needing its own justification; left as a caller responsibility / Open Question §13, not silently auto-cascaded, since **auto-cascade is exactly the AS-IS legacy mistake this program is built to avoid** — legacy `okr_objectives.parent_id` cascade rollup is explicitly named as "what cannot become the vNext foundation," plan §3.2).

### 10.5 `createKeyResult` — `executeAtomicCreate`

`assertSetEditableForUpdate` (via the Objective's `set_id`); `measurementType` gate (D-E3-4, rejects milestone/custom); cross-field validation (`currency` required iff `measurementType='currency'`; `rangeMin`/`rangeMax` required iff `direction='maintain_range'`); resolve the Cycle's pinned policy snapshot (D-E3-6); call `calculateKeyResultProgress` (§9.3) synchronously, persist `progress`/`progress_calc_policy_version_id`/`progress_calc_reason`; INSERT; **then, in the same transaction**, recompute and persist the parent Objective's rolled-up `progress`/`confidence` (calls `calculateObjectiveProgressRollup`/`calculateObjectiveConfidenceRollup` over ALL the Objective's current KRs, not just the new one) — this keeps Objective-level fields always consistent with their KR children without a separate async recompute step. Two events emitted in one transaction: `okr_key_result.created` and `okr_objective.progress_recalculated` (both `aggregateType:'okr_set'`/`aggregateId:setId`).

### 10.6 `updateKeyResult` — `executeAtomicCommand`

CAS on `okr_vnext_key_results.row_version`. Same `assertSetEditableForUpdate`/measurement-type gate. Any change to `currentValue`/`baselineValue`/`targetValue`/`rangeMin`/`rangeMax`/`direction` triggers a progress recompute (same synchronous engine call + Objective-rollup cascade as create). A change to `confidence`/`confidenceNumericValue` (KR-level, owner-declared input — **not** engine-computed at the KR level, only at Objective level per D-E3-10) also triggers the Objective-level confidence-rollup recompute.

### 10.7 `cancelKeyResult` (maps `DELETE /key-results/:keyResultId`)

Guarded transition to `status='cancelled'`. **After cancelling, recompute the parent Objective's progress/confidence rollup** (a cancelled KR is excluded from `calculateObjectiveProgressRollup`'s input array, per §9.3's "skip not_calculable KRs" note — cancelled KRs are filtered out before that function is even called, not passed in as `not_calculable`). **Also recompute `hasSufficientKeyResultCoverage`'s cached state is NOT stored anywhere** — coverage is evaluated fresh at submission time only (§11 below), so cancelling a KR below the `kr_min_required` threshold on an already-`draft` Set is not itself blocked (the Set is still a draft; the block only bites at `submitOkrSetForApproval`).

---

## 11. Submission-guard extension (E) — wrapping `isOkrSetReadyForSubmissionEligible` exactly

Per E002 §4.4's forward declaration (quoted verbatim in §1.4): *"OKR-E003 is expected to layer its ≥2-KR-per-Objective check on top... do not replace this function's body when E003 lands; wrap it."*

**New function**, `server/src/services/resultsVnext/okr/okrObjectiveCommands.ts` (co-located with Objective commands, imported into `okrSetCommands.ts` — NOT added to `okrSetCommands.ts` itself, keeping E002's file untouched except for its `submitOkrSetForApproval` call site, per D-E3-1's "don't touch what you don't own" discipline):

```typescript
export interface KeyResultCoverageCheck {
  eligible: boolean;
  reason?: string;
  details?: {
    totalObjectives: number;
    objectivesBelowMinimum: Array<{ objectiveId: string; title: string; krCount: number; required: number }>;
  };
}

/**
 * OKR-F-008-AC-02: every non-cancelled Objective on the Set must have at
 * least `krMinRequired` non-cancelled KeyResults before the Set may submit.
 * D-E3-5: enforced per-Objective, not as a Set-wide total — per E002's own
 * forward-declaration wording.
 *
 * MUST be called on the SAME pinned client/transaction submitOkrSetForApproval
 * already holds (it runs inside that command's applyMutation) — this is a
 * query-backed check, unlike isOkrSetReadyForSubmissionEligible's pure
 * synchronous row check, because Objectives/KRs did not exist as columns on
 * setRow when E002 designed that function's signature.
 */
export async function hasSufficientKeyResultCoverage(
  client: PoolClient,
  setId: string,
  organizationId: string,
  krMinRequired: number
): Promise<KeyResultCoverageCheck> {
  const result = await client.query<{ objective_id: string; title: string; kr_count: string }>(
    `SELECT o.objective_id, o.title, COUNT(kr.key_result_id) AS kr_count
       FROM okr_vnext_objectives o
       LEFT JOIN okr_vnext_key_results kr
              ON kr.objective_id = o.objective_id AND kr.status <> 'cancelled'
      WHERE o.set_id = $1 AND o.organization_id = $2 AND o.status <> 'cancelled'
      GROUP BY o.objective_id, o.title`,
    [setId, organizationId]
  );

  if (result.rows.length === 0) {
    return { eligible: false, reason: 'no_objectives', details: { totalObjectives: 0, objectivesBelowMinimum: [] } };
  }

  const objectivesBelowMinimum = result.rows
    .filter((r) => Number(r.kr_count) < krMinRequired)
    .map((r) => ({ objectiveId: r.objective_id, title: r.title, krCount: Number(r.kr_count), required: krMinRequired }));

  if (objectivesBelowMinimum.length > 0) {
    return {
      eligible: false,
      reason: 'insufficient_key_results',
      details: { totalObjectives: result.rows.length, objectivesBelowMinimum },
    };
  }
  return { eligible: true };
}
```

**Call-site change required in `okrSetCommands.ts`'s `submitOkrSetForApproval`** (E002 §4.4) — the ONE line E003 is licensed to touch in E002's own file:
```typescript
// BEFORE (E002, as frozen):
const eligibility = isOkrSetReadyForSubmissionEligible(currentRow);
if (!eligibility.eligible) {
  throw new OkrSetNotReadyForSubmissionError(setId, eligibility.reason);
}

// AFTER (E003 lands, wraps not replaces):
const reviewerEligibility = isOkrSetReadyForSubmissionEligible(currentRow);
if (!reviewerEligibility.eligible) {
  throw new OkrSetNotReadyForSubmissionError(setId, reviewerEligibility.reason);
}
const krCoverage = await hasSufficientKeyResultCoverage(client, setId, organizationId, policySnapshot.krMinRequired);
if (!krCoverage.eligible) {
  throw new OkrSetNotReadyForSubmissionError(setId, krCoverage.reason, krCoverage.details);
}
```
`isOkrSetReadyForSubmissionEligible`'s own body is untouched — exactly the "wrap, never replace" instruction. `OkrSetNotReadyForSubmissionError`'s constructor needs a third optional `details` param added (a backward-compatible signature widening, not a breaking change to E002's existing call). `policySnapshot.krMinRequired` is read from the Cycle's pinned policy snapshot (D-E3-6), requiring `submitOkrSetForApproval` to additionally join/fetch `okr_vnext_cycles.policy_version_id → okr_vnext_program_policy_versions.snapshot` inside its own transaction — a small addition to E002's command, stated explicitly as a required E002-file touch-point, not hidden.

---

## 12. Approval-snapshot extension (F) — populating `buildOkrSetApprovalSnapshotPayload`'s `objectives: []`

Per E002 §4.5 step 3 (`approveOkrSet`): `buildOkrSetApprovalSnapshotPayload(client, currentRow)` currently returns Set fields + `objectives: []` (D8, a deliberate empty placeholder). E003 must populate this array with a full point-in-time reconstruction of every Objective and its KRs — an **immutable reconstruction**, matching the plan's own `OKRApprovedSnapshot` definition (§4.8: "immutable reconstruction of approved Set version").

**New function**, again in `okrObjectiveCommands.ts` (or a dedicated `okrApprovalSnapshotAssembly.ts` if the file grows unwieldy — file-organization detail, not a design decision):

```typescript
export interface ObjectiveSnapshotPayload {
  objectiveId: string;
  title: string;
  description: string | null;
  rationale: string | null;
  ambitionType: 'committed' | 'aspirational' | 'standard';
  ownerUserId: string;
  sortOrder: number;
  progress: number | null;
  progressCalcReason: string | null;
  confidence: string | null;
  keyResults: Array<{
    keyResultId: string;
    title: string;
    description: string | null;
    measurementType: string;
    unit: string | null;
    currency: string | null;
    baselineValue: number | null;
    targetValue: number | null;
    startValue: number | null;
    currentValue: number | null;
    direction: string;
    rangeMin: number | null;
    rangeMax: number | null;
    progress: number | null;
    progressCalcReason: string | null;
    confidence: string | null;
    sourceType: string;
    sourceReference: string | null;
    weight: number | null;
  }>;
}

/**
 * Called from INSIDE approveOkrSet's applyMutation (E002 §4.5 step 3), same
 * pinned client, same transaction as the snapshot INSERT — this function
 * only READS okr_vnext_objectives/okr_vnext_key_results, never writes.
 * Excludes cancelled Objectives/KRs (a cancelled item was never really
 * "approved content" — matches hasSufficientKeyResultCoverage's own
 * cancelled-exclusion, §11).
 */
export async function buildObjectivesSnapshotFragment(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<ObjectiveSnapshotPayload[]>
```

**Call-site change in `okrSetCommands.ts`'s `approveOkrSet`** (E002 §4.5 step 3) — the second and only other line E003 touches in E002's file:
```typescript
// BEFORE (E002, as frozen, D8 placeholder):
async function buildOkrSetApprovalSnapshotPayload(client: PoolClient, currentRow: OkrSetRow) {
  return { ...setFields(currentRow), objectives: [] };
}

// AFTER (E003 lands):
async function buildOkrSetApprovalSnapshotPayload(client: PoolClient, currentRow: OkrSetRow) {
  const objectives = await buildObjectivesSnapshotFragment(client, currentRow.set_id, currentRow.organization_id);
  return { ...setFields(currentRow), objectives };
}
```
The immutability contract E002 already established is untouched: `content_hash = computeStateHash(payload)` (E002 §4.5 step 4) now hashes real content instead of an empty array — this is the FIRST approval where the hash becomes meaningful, exactly as expected; `okr_vnext_approved_snapshots` stays `REVOKE UPDATE/DELETE`, INSERT-only. **No new table needed for the snapshot itself** — `snapshot_payload JSONB` (E002 DDL) already has room for the populated `objectives` array; this is purely a payload-richness change, not a schema change to E002's own tables.

**Re-approval note**: if a Set is later re-submitted after `changes_requested` and re-approved, `buildObjectivesSnapshotFragment` re-reads the Objectives/KRs' CURRENT state at that second approval's transaction time (not a diff against the first snapshot) — each approval is an independent full reconstruction, `sequence_number`-ordered (E002 D5), matching ROI's own "Approved v2.0 alongside v1.0, both available, never overwritten" precedent (`EXECUTION_LEDGER.md` §3.5).

---

## 13. Visibility (G)

**No new `resource_type`.** Objectives and KeyResults are NOT independently-ABAC'd resources — they inherit visibility entirely through `set_id` (Objective) / `set_id`+`objective_id` (KeyResult), exactly as task instruction (G) anticipated and exactly as E002 §5 already established for `okr_vnext_approved_snapshots`/`okr_vnext_set_versions` ("carry no visibility row of their own — inherit via `set_id`"). `RVN_RESOURCE_TYPES` and `CanonicalObjectTypeValues` gain **zero** new entries in E003 (contrast E001, which added `'okr_program'`/`'okr_cycle'`, and confirm E002 added none for Sets' children either — same posture continues).

**Repository pattern**: `okrObjectiveRepository.ts`'s `listObjectivesForSet`/`getObjective`/`listKeyResultsForObjective`/`getKeyResult` all go through `wrapWithVisibilityScope({resourceType: 'okr_set'})` (or `buildVisibilityScopedCte` directly) joined against `okr_vnext_sets.set_id` — the query authorizes on the SET's visibility row, then joins DOWN to Objectives/KRs:

```sql
WITH rvn_visible_resources(resource_type, resource_id) AS ( ... )   -- buildVisibilityScopedCte({resourceType:'okr_set', ...})
SELECT o.*, kr_agg.key_results
  FROM okr_vnext_objectives o
  INNER JOIN rvn_visible_resources vr
          ON vr.resource_type = 'okr_set' AND vr.resource_id = o.set_id::text   -- MANDATORY ::text cast
  LEFT JOIN LATERAL (...) kr_agg ON true
 WHERE o.organization_id = $1 AND o.set_id = $2
 ORDER BY o.sort_order
```

**The mandatory `::text` cast, stated for the third time across E001/E002/E003 designs because it is this program's single most-repeated real bug ("missed 7 times in one KPI epic")**: `rvn_platform_resource_visibility.resource_id` is `TEXT`; `okr_vnext_sets.set_id` (the join target here, since Objectives/KRs authorize through their Set) is `UUID`. Every join predicate in `okrObjectiveRepository.ts`/`okrKeyResultRepository.ts` must read `vr.resource_id = o.set_id::text`, never a bare `vr.resource_id = o.set_id`. A dedicated realDB test (`okrObjectiveVisibilityJoin.realdb.test.ts`, §15 file list) must assert this explicitly, the same DoD-checklist item E002 itself carries forward.

**Write-side visibility**: `createObjective`/`createKeyResult`/etc. do NOT create any `rvn_platform_resource_visibility` row of their own (there is nothing new to authorize — the Set's existing row already covers them). No `getActiveVisibilityPolicy`/fail-closed lookup needed in E003's create commands, unlike E002's `createOkrSet` — this is a real, structural simplification versus E002, not an oversight.

**Auditor read-only policy trace (OKR-F-009-AC-02's Roles/visibility cell)**: "Auditor (read-only policy trace)" — the design must expose `progress_calc_policy_version_id`/`progress_calc_reason`/`confidence_calc_policy_version_id`/`confidence_calc_reason` on read endpoints for a role with an Auditor-equivalent capability. No new RBAC role is invented — reuses whatever generic "Auditor read-only" capability KPI-E001/E002 or ROI-E00x already established (needs re-verification against actual landed code per §6's standing caveat; if no such capability exists yet anywhere in the platform, that is itself a cross-cutting gap outside E003's file ownership to fix, flagged forward like E002's D13 flagged the `resolveScopeVisibility` gap).

---

## 14. API surface (H) — extends `server/src/routes/resultsVnext/okr.routes.ts`

Literal routes from the plan's own API contract (§9, lines 546-551), scoped down to only what E003's 5 ACs actually cover (check-ins/alignment/reflection/history rows excluded — those belong to E004/E005/E007):

| Method | Path | Command/Repository | Auth |
|---|---|---|---|
| `POST` | `/sets/:setId/objectives` | `createObjective` | Set Owner, Objective Owner (per AC Roles cell) |
| `GET` | `/sets/:setId/objectives` | `listObjectivesForSet` (with nested KRs) | ABAC via Set visibility |
| `GET` | `/objectives/:objectiveId` | `getObjective` | ABAC via Set visibility |
| `PATCH` | `/objectives/:objectiveId` | `updateObjective` | Objective Owner, Set Owner |
| `DELETE` | `/objectives/:objectiveId` | `cancelObjective` (soft, §10.4) | Objective Owner, Set Owner |
| `POST` | `/objectives/:objectiveId/key-results` | `createKeyResult` | KR Owner, Objective Owner |
| `GET` | `/key-results/:keyResultId` | `getKeyResult` | ABAC via Set visibility |
| `PATCH` | `/key-results/:keyResultId` | `updateKeyResult` | KR Owner, Objective Owner |
| `DELETE` | `/key-results/:keyResultId` | `cancelKeyResult` (soft, §10.7) | KR Owner, Objective Owner |

Error mapping (extends E001/E002's table): `AtomicWriteConflictError`→409, `AtomicWriteAggregateNotFoundError`→404, `OkrObjectiveSetNotEditableError`→409, `OkrObjectiveValidationError`→409 (carries `.code`: `AMBITION_TYPE_DISABLED`, `MEASUREMENT_TYPE_NOT_IMPLEMENTED`, `CONFIDENCE_NOT_OWNER_EDITABLE`, `CONFIDENCE_MODEL_NOT_IMPLEMENTED`), `OkrKeyResultValidationError`→409, `OkrSetNotReadyForSubmissionError`→409 (now carrying the richer `details` from §11), Zod→400, ACL failure→403, unknown→500.

**No `/sets/:setId/objectives` list route is literally named in the plan's own API-contract section** — the plan shows only `POST .../objectives`/`PATCH .../objectives/:id`/`DELETE .../objectives/:id`, no `GET .../objectives`. This design adds `GET /sets/:setId/objectives` and `GET /objectives/:objectiveId`/`GET /key-results/:keyResultId` as reasonable, undisputed reads a working UI needs (E001/E002 also both added `GET` list/detail routes beyond their own AC tables' literal Command/API cells, e.g. E001's `GET /programs`, `GET /cycles`) — stated as a design addition matching established precedent, not silently invented.

**Mount-order note** (same class of bug fixed twice in KPI, restated a third time): `GET /objectives/:objectiveId` and `GET /key-results/:keyResultId` are single dynamic segments at the router's top level (not nested under `/sets/:setId/...`) — any future literal-path route under `/objectives/*` or `/key-results/*` must mount before these two.

---

## 15. File list (I)

**New:**
- `server/migrations/20260824_rvn_okr_objective_key_result.sql` (filename pending re-verification of E001/E002's actual landed migration filenames, §6)
- `server/src/services/resultsVnext/okr/okrObjectiveTypes.ts`
- `server/src/services/resultsVnext/okr/okrKeyResultTypes.ts`
- `server/src/services/resultsVnext/okr/okrProgressEngine.ts` (`calculateKeyResultProgress`, `calculateObjectiveProgressRollup`, `calculateObjectiveConfidenceRollup` — pure, DB-free)
- `server/src/services/resultsVnext/okr/okrObjectiveCommands.ts` (`createObjective`, `updateObjective`, `cancelObjective`, `runOkrObjectiveLifecycleTransition`, `hasSufficientKeyResultCoverage`, `buildObjectivesSnapshotFragment`, `assertSetEditableForUpdate`, `OkrObjectiveValidationError`, `OkrObjectiveSetNotEditableError`)
- `server/src/services/resultsVnext/okr/okrKeyResultCommands.ts` (`createKeyResult`, `updateKeyResult`, `cancelKeyResult`, `runOkrKeyResultLifecycleTransition`, `OkrKeyResultValidationError`)
- `server/src/services/resultsVnext/okr/okrObjectiveRepository.ts` (`listObjectivesForSet`, `getObjective`, `getKeyResult` — visibility-scoped via Set)
- `tests/resultsVnext/okr/okrProgressEngine.test.ts` (pure unit / known-answer suite: all 5 geometries × degenerate cases, mirrors ROI's known-answer discipline — NOT a realDB test, no DB needed for a pure function)
- `tests/resultsVnext/okr/okrObjectiveCreate.realdb.test.ts` (ambition_type gating both branches, sort_order assignment, Set-editability guard)
- `tests/resultsVnext/okr/okrKeyResultCreate.realdb.test.ts` (measurement_type gating both branches, cross-field validation, progress computed+persisted on create, Objective rollup cascade)
- `tests/resultsVnext/okr/okrKeyResultCoverage.realdb.test.ts` (literal OKR-F-008-AC-02 proof: submit blocked below `kr_min_required` per-Objective, allowed at/above; wraps not replaces `isOkrSetReadyForSubmissionEligible`)
- `tests/resultsVnext/okr/okrApprovalSnapshotObjectives.realdb.test.ts` (literal D8-closure proof: approved snapshot's `objectives` array is populated and content-hash-stable; cancelled Objectives/KRs excluded; re-approval produces an independent v2 snapshot)
- `tests/resultsVnext/okr/okrObjectiveVisibilityJoin.realdb.test.ts` (`::text` cast verified on the Set-inherited join, all visibility modes)
- `tests/resultsVnext/okr/okrObjectiveLifecycle.realdb.test.ts` (cancel guard, no auto-cascade to KRs)
- `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` (extended)

**Changed:**
- `server/src/routes/resultsVnext/okr.routes.ts` — 9 new routes (§14)
- `server/src/services/resultsVnext/okr/okrSetCommands.ts` — **exactly two call-site edits**: `submitOkrSetForApproval` wraps `isOkrSetReadyForSubmissionEligible` with `hasSufficientKeyResultCoverage` (§11); `buildOkrSetApprovalSnapshotPayload` populates `objectives` via `buildObjectivesSnapshotFragment` (§12). `OkrSetNotReadyForSubmissionError`'s constructor gains an optional third `details` param.
- `server/src/services/resultsVnext/platform/atomicWrite.ts` — new events: `okr_objective.created`, `okr_objective.updated`, `okr_objective.cancelled`, `okr_objective.progress_recalculated`, `okr_key_result.created`, `okr_key_result.updated`, `okr_key_result.cancelled`, all `aggregateType:'okr_set'` (D-E3-8), all → `['mywork_projection']`
- `server/src/validators/resultsVnextOkr.validators.ts` — new Objective/KeyResult schemas
- `docs/product/results-vnext/EPIC_LEDGER_LIVE.md` / `EXECUTION_LEDGER.md` — closure entry, restating the geometry-formula ambiguities (§9.1's `maintain_range`/`binary` sentinel guesses) and the D-E3-11 KPI-binding-deferred decision explicitly, not silently dropped — same discipline E002's DoD required for D13/D17

**Read-only reference:** `roiCostLineCommands.ts`/`roiBenefitLineCommands.ts` (child-row add/update/remove + parent-status guard + parent-identity events), `roiBenefitEvidenceLinkCommands.ts` (neutral source binding, if/when built), `kpiDefinitionCommands.ts` (`computeStateHash`), `atomicWrite.ts`, `visibilityScopedQuery.ts`, `visibilityResolver.ts`, OKR-E001's `okrCycleCommands.ts`, OKR-E002's `okrSetCommands.ts` — **all must be re-read for exact current signatures at implementation time**, per §6's standing re-verification finding (E001/E002 code was NOT yet landed in this worktree as of this design's drafting).

---

## 16. Open questions (J) — genuine ambiguity, not guessed away

Ranked roughly by risk (highest first, per task instructions' emphasis that a wrong scoring formula is real product risk):

1. **[HIGHEST RISK] `maintain_range` and `binary` progress formulas are genuinely unspecified.** Plan §5.4 gives literal formulas for `increase`/`decrease`/`reach`("percentage direct") but only says "maintain range: policy-defined in-range evaluation" with zero concrete formula, and doesn't spell out `binary`'s "achieved" sentinel convention at all. §9.1/§9.2 of this design PROPOSE formulas (linear falloff outside range; truthy-current-value = achieved) — **these are inventions, not sourced from any doc, and must not be silently implemented as if they were specified.** The Integration Owner must either (a) confirm these proposed formulas explicitly, (b) supply the real policy-defined formulas from a source this research didn't find, or (c) route this to the Founder as an `EVIDENCE_NEEDED` item before freezing, exactly as plan §20 already does for 10 other open items. Shipping a wrong formula here is the same class of risk plan `EXECUTION_LEDGER.md` §3.5 flags for ROI's NPV/rounding-policy gap.
2. **Overachievement/clamping policy** (plan §5.4: "the policy version defines... clamping, overachievement... roll-up") has no concrete rule anywhere and no policy column exists on `okr_vnext_programs` (E001's DDL) to carry one. §9.2 proposes storing the raw unclamped ratio and deferring clamping to a later epic's display layer — needs confirmation; if wrong, could misrepresent Objective health at the exact review-cycle KPI-F-009-AC-02 exists to make trustworthy.
3. **`kr_min_required` enforcement granularity — per-Objective (this design's D-E3-5) or Set-wide total?** E002's own forward-declared comment says "per-Objective" explicitly; the E003 AC's own prose ("Polityka wymaga ≥2 KR przed submission") doesn't repeat that qualifier and could be read as a Set-wide count. This design follows E002's more specific wording as the stronger signal, but the two source texts are not perfectly aligned — worth an explicit one-line confirmation from whoever owns both docs.
4. **Geometry-label reconciliation** (`reach` enum value ↔ "percentage direct" prose label) — treated as the same geometry in this design (§9.1) on the strength of "no 5th value to map it to" plus matching arithmetic, but never literally stated as equivalent in either source document. Low probability of being wrong, but should be a one-line confirmation, not a silent assumption carried into implementation.
5. **Cross-Objective mixed confidence models** — if `confidence_model='high_medium_low'` for one KR and `'numeric'` for a sibling KR within the same Objective (both are valid per-Program settings, but nothing stops per-KR heterogeneity since KRs don't independently declare a confidence model, they just have a `confidence` field typed to allow either shape), `calculateObjectiveConfidenceRollup`'s `lowest_kr` ordering has no defined cross-scale comparison. §9.3 proposes returning `not_calculable` in that case — reasonable but unconfirmed; worth checking whether the Program policy is actually meant to make ALL KRs org-wide use one consistent confidence shape (in which case this scenario is definitionally impossible and the whole question is moot — but nothing in the schema enforces that).
6. **Does `hasSufficientKeyResultCoverage` also need company/BU/team Set special-casing?** E002 F-004-AC-02 establishes company/BU/team/individual Sets "share the same domain contract" — this design assumes the ≥2-KR-per-Objective rule applies identically across all four scope types with no exception, which is the most literal reading, but a company-level Set with many Objectives owned by many different people might have a materially different practical submission workflow the AC table doesn't address. Flagged, not resolved.
7. **KR→KPI neutral source binding — build now or defer (D-E3-11)?** This design defers building the typed side-table, reasoning that no AC requires it and the plan's non-goals explicitly exclude "automatic KPI-to-KR synchronization in MVP." The counter-argument, not fully rebutted: task instruction (C) was written with enough specificity (naming `rvn_roi_benefit_evidence_links` as "very likely the pattern to mirror") that whoever commissioned this design may have already decided this SHOULD be built now, and the AC table's silence on KPI is itself the ambiguity to resolve, not evidence of exclusion. If the Integration Owner wants it built now: the table is `okr_vnext_key_result_source_bindings` (`key_result_id` FK to `okr_vnext_key_results`, `source_type` matching the KR's own enum, `source_kpi_id TEXT NULL` / `source_kpi_definition_version_id TEXT NULL` — **both plain TEXT, no FK**, per §5's sharp-discrepancy correction — `purpose`, `linked_by`, `linked_at`, `notes`, mirroring `rvn_roi_benefit_evidence_links`' shape minus the FK).
8. **Auto-cascade on Objective cancellation** (§10.4) — this design explicitly does NOT cascade-cancel child KRs when an Objective is cancelled, citing the program's aversion to legacy's cascade pattern. But an orphaned "active" KR under a "cancelled" Objective is a slightly odd state with no AC guidance either way — confirm this is acceptable, or that a cascade (as an explicit, stated, non-legacy-style command-level cascade, not a DB trigger) is actually wanted.
9. **Status-suggestion threshold policy fields** — plan §5.4 says "No universal fixed 70/40 thresholds. The policy version defines status suggestions, trajectory..." but `okr_vnext_programs` (E001's landed DDL) has no columns for this (only `scoring_model`/`objective_rollup_model`/`confidence_model`/`objective_confidence_model`). E003's own `status` field on both Objective/KeyResult (draft/on_track/at_risk/etc.) needs SOME source of truth for how it gets suggested — is `status` purely owner-declared in E003 (no automatic suggestion until a later epic), or does E003 need a companion `ALTER TABLE okr_vnext_programs ADD COLUMN status_threshold_policy JSONB` migration? This design defaults to **owner-declared only for E003** (no automatic status-suggestion engine built this epic — matches the AC table's own silence on `status` entirely; none of the 5 E003 ACs mention KR/Objective `status` at all, only `progress`/`confidence`), leaving automatic suggestion to whichever later epic's AC actually names it (plausibly E004, since "system_suggested_status" appears explicitly in the plan's `OKRCheckIn` YAML §4.7, not anywhere in Objective/KeyResult's own YAML). Flagged as the resolution, not a silent gap.
10. **Does `okrObjectiveRepository.ts` need a `GET /sets/:setId/objectives` route at all in E003**, or does `getOkrSet` (E002) already return nested Objectives/KRs inline, making a separate list route redundant? E002's design doesn't show `getOkrSet`'s exact response shape (only that it exists) — needs re-verification against E002's actual landed `okrSetRepository.ts` before deciding whether §14's `GET /sets/:setId/objectives` route is additive or duplicative.

---

## 17. Definition of done

- [ ] All 9 new endpoints (§14) work against a real org with a real approved Program+Cycle+Set
- [ ] `tsc --noEmit` clean on the whole repo
- [ ] `okrProgressEngine.ts`'s known-answer test suite covers all 5 geometries' happy path AND every degenerate case named in §9.1's table, proving `not_calculable` is returned (never a fabricated 0) — literal OKR-F-009-AC-01 proof
- [ ] Every calculated progress/confidence value's `*_calc_policy_version_id`/`*_calc_reason` columns are populated and provably point at the Cycle's PINNED policy snapshot, not a live re-read — literal OKR-F-009-AC-02 proof
- [ ] `hasSufficientKeyResultCoverage` verified: submission blocked when any non-cancelled Objective has fewer than `kr_min_required` non-cancelled KRs, allowed at/above threshold — literal OKR-F-008-AC-02 proof; `isOkrSetReadyForSubmissionEligible`'s own body provably untouched (diff review, not just a passing test)
- [ ] `ambition_type`/`measurement_type` command-layer gating verified both branches (policy-enabled/disabled, MVP-supported/not-yet-implemented) — literal OKR-F-007-AC-01/OKR-F-008-AC-01 proof
- [ ] Approved snapshot's `objectives` array populated, content-hash stable, cancelled items excluded, re-approval produces an independent sequence-numbered snapshot never overwriting the prior one — literal D8-closure proof
- [ ] `::text` cast verified against real Postgres on the Set-inherited Objective/KeyResult visibility join
- [ ] Confirmed: `okr_vnext_key_results.source_type`/`source_reference` carry zero FK to any KPI/Initiative/ROI table — literal D09 compliance proof, direct schema inspection, not just a design-doc claim
- [ ] Confirmed: no cascade-cancel from Objective to KeyResult (explicit test asserting a KR survives its parent Objective's cancellation in an active/at_risk state)
- [ ] Full existing KPI + ROI + OKR-E001 + OKR-E002 test suites still green — before/after evidence, not a claimed number
- [ ] `EXECUTION_LEDGER.md` closure entry + `EPIC_LEDGER_LIVE.md` OKR-E003 rows updated, explicitly restating Open Questions §16 items 1-2 (the two proposed-but-unconfirmed progress formulas) and item 7 (KPI-binding-deferred) as still-open, not silently resolved by having shipped something
- [ ] **Before implementation starts**: OKR-E001 and OKR-E002's actual landed code re-verified against every signature/table/column name this design cites from their frozen docs (§6's standing finding — as of this design's drafting, neither epic's code existed yet in this worktree)

---

*End of design draft. Status: COMPLETE — ready for Integration Owner review and freeze.*
