# Chat V10 / ROI & OUTCOME LIFECYCLE — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 24
> tickets `V10-OUT-001..024` that implement the ROI & Outcome Lifecycle
> block of Chat V10. **No ticket here is shipped yet.**
>
> Authoritative input: [`DEEP_RESEARCH_ROI_LIFECYCLE_REQUIREMENTS_2026-04-18.md`](./DEEP_RESEARCH_ROI_LIFECYCLE_REQUIREMENTS_2026-04-18.md)
> (R-OUTCOME-1..24). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & outcome incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding an outcome signal → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

ROI / Outcome is how Chat V10 proves it is **worth the spend**. The block
turns product usage into auditable outcomes: time saved, decisions shipped,
revenue / margin influence, risk avoided. It defines:

- **OutcomeSignal** — typed events capturing user-confirmed or
  system-observed value (not vanity metrics).
- **OutcomeRecord** — durable per-activity record with lineage back to the
  originating chat turn / artifact / mission.
- **AttributionPolicy** — how we attribute outcomes (conservative by
  default, never double-count).
- **ROI dashboards** — per-team, per-persona, per-workload, per-tenant.
- **CFO narrative export** — machine-readable pack for finance reviews.
- **Integrity guarantees** — never-invent-metrics, never-inflate, admin
  audit.

Outcome is **the feedback loop** that tells leadership the product paid
for itself and tells Learning which paths convert.

**MVP focus (Wave A):** time-saved outcomes from activation / proposal
acceptance, KPI-accept outcomes from onboarding, per-team ROI dashboard,
CFO export. Wave B: revenue / margin attribution, risk-avoided outcomes,
benchmark comparisons.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-OUT-001](#v10-out-001) | R-OUTCOME-1: `OutcomeSignalV1` schema | P0 | 1.5 d | medium | A | 📐 design |
| [V10-OUT-002](#v10-out-002) | R-OUTCOME-2: `OutcomeRecordV1` schema (durable) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-OUT-003](#v10-out-003) | R-OUTCOME-3: outcome taxonomy (time_saved / decision_shipped / revenue / margin / risk_avoided / quality) | P0 | 1 d | medium | A | 📐 design |
| [V10-OUT-004](#v10-out-004) | R-OUTCOME-4: `AttributionPolicyV1` (conservative defaults) | P0 | 2 d | high | A | 📐 design |
| [V10-OUT-005](#v10-out-005) | R-OUTCOME-5: lineage binding (turn → proposal → artifact → outcome) | P0 | 2 d | high | A | 📐 design |
| [V10-OUT-006](#v10-out-006) | R-OUTCOME-6: time-saved calibration model (persona × activity) | P0 | 2 d | high | A | 📐 design |
| [V10-OUT-007](#v10-out-007) | R-OUTCOME-7: user confirmation surface (inline one-click "this saved me ~Xh") | P0 | 1.5 d | low | A | 📐 design |
| [V10-OUT-008](#v10-out-008) | R-OUTCOME-8: passive outcome emission (from accepted proposals, shipped artifacts) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-OUT-009](#v10-out-009) | R-OUTCOME-9: decision-shipped detector (decision_doc reaches `approved`) | P0 | 1 d | medium | A | 📐 design |
| [V10-OUT-010](#v10-out-010) | R-OUTCOME-10: KPI-accept outcome (from onboarding / KPI proposal acceptance) | P0 | 1 d | low | A | 📐 design |
| [V10-OUT-011](#v10-out-011) | R-OUTCOME-11: double-count guard (same activity never attributed twice) | P0 | 1.5 d | high | A | 📐 design |
| [V10-OUT-012](#v10-out-012) | R-OUTCOME-12: revert / undo → outcome reversal | P0 | 1.5 d | high | A | 📐 design |
| [V10-OUT-013](#v10-out-013) | R-OUTCOME-13: per-team ROI dashboard | P0 | 2 d | low | A | 📐 design |
| [V10-OUT-014](#v10-out-014) | R-OUTCOME-14: per-persona breakdown | P0 | 1 d | low | A | 📐 design |
| [V10-OUT-015](#v10-out-015) | R-OUTCOME-15: per-workload breakdown (fast / grounded / workspace / research / artifact / decision / agent) | P0 | 1 d | low | A | 📐 design |
| [V10-OUT-016](#v10-out-016) | R-OUTCOME-16: CFO narrative export (structured JSON + PDF summary) | P0 | 2 d | medium | A | 📐 design |
| [V10-OUT-017](#v10-out-017) | R-OUTCOME-17: outcome audit log (admin-exportable) | P0 | 1 d | medium | A | 📐 design |
| [V10-OUT-018](#v10-out-018) | R-OUTCOME-18: outcome telemetry events | P0 | 1.5 d | low | A | 📐 design |
| [V10-OUT-019](#v10-out-019) | R-OUTCOME-19: never-invent-metric invariant (CI) | P0 | 1 d | high | A | 📐 design |
| [V10-OUT-020](#v10-out-020) | R-OUTCOME-20: admin overrides (redact / reassign) with audit trail | P0 | 1.5 d | medium | A | 📐 design |
| [V10-OUT-021](#v10-out-021) | R-OUTCOME-21: revenue / margin attribution (CRM connector) | P1 | 2.5 d | high | B | 📐 design |
| [V10-OUT-022](#v10-out-022) | R-OUTCOME-22: risk-avoided outcomes (from decision_review) | P1 | 2 d | medium | B | 📐 design |
| [V10-OUT-023](#v10-out-023) | R-OUTCOME-23: benchmarking vs cohort (anonymised, opt-in) | P1 | 2 d | medium | B | 📐 design |
| [V10-OUT-024](#v10-out-024) | R-OUTCOME-24: outcome quality dashboard (confirmation rate, reversal rate) | P1 | 1.5 d | low | B | 📐 design |

**Totals:** 24 tickets (20 × P0, 4 × P1). Estimated effort ≈38 engineer-days.

**Proposed flag namespace:** `ff.outcome_*`.

---

<a id="v10-out-001"></a>

## V10-OUT-001 — `OutcomeSignalV1`

**Requirement:** R-OUTCOME-1 (P0) — typed signal for an observed outcome candidate.

**Design.** Schema:

```ts
export type OutcomeSignalV1 = {
  id: SignalId;
  tenantId: TenantId;
  userId: UserId;
  correlationId: string;                  // chat turn
  source: OutcomeSource;                  // "activation" | "proposal_accept" | "artifact_ship" | "decision_ship" | "kpi_accept" | "user_confirmation" | "connector_event"
  kind: OutcomeKind;                      // V10-OUT-003
  magnitude: OutcomeMagnitude;            // typed units (hours, USD, count)
  confidence: "low" | "medium" | "high";
  evidence: OutcomeEvidence;              // lineage refs
  emittedAt: Timestamp;
};
```

Signals are candidates; only after policy check (V10-OUT-004) and dedup (V10-OUT-011) do they become records (V10-OUT-002).

**Cross-refs.** V10-OUT-002, V10-OUT-004.

---

<a id="v10-out-002"></a>

## V10-OUT-002 — `OutcomeRecordV1`

**Requirement:** R-OUTCOME-2 (P0) — durable outcome record.

**Design.** Schema:

```ts
export type OutcomeRecordV1 = {
  id: OutcomeId;
  tenantId: TenantId;
  signalIds: SignalId[];                 // contributing signals
  kind: OutcomeKind;
  magnitude: OutcomeMagnitude;
  attribution: AttributionResult;        // V10-OUT-004
  lineage: Lineage;                      // V10-OUT-005
  state: "proposed" | "confirmed" | "reversed" | "redacted";
  expectedVersion: number;               // optimistic concurrency
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

Records are append-only; state transitions produce new versions.

**Cross-refs.** V10-OUT-005, V10-OUT-012.

---

<a id="v10-out-003"></a>

## V10-OUT-003 — outcome taxonomy

**Requirement:** R-OUTCOME-3 (P0) — closed set of kinds.

**Design.** Enum:

```ts
export type OutcomeKind =
  | "time_saved"
  | "decision_shipped"
  | "revenue_influenced"     // Wave B
  | "margin_influenced"      // Wave B
  | "risk_avoided"           // Wave B
  | "quality_improved";
```

Each has required magnitude unit + confidence rules. CI invariant 45 enforces no outcome lands without a taxonomy entry.

**Cross-refs.** V10-OUT-019.

---

<a id="v10-out-004"></a>

## V10-OUT-004 — `AttributionPolicyV1`

**Requirement:** R-OUTCOME-4 (P0) — conservative attribution.

**Design.** Policy:

```ts
export type AttributionPolicyV1 = {
  conservativeByDefault: true;           // invariant
  maxTimeSavedPerActivityHours: number;  // cap per activity
  requireUserConfirmationAbove: number;  // h threshold for confirmation
  passiveDecayPerDay: number;            // 0..1 — unconfirmed signals decay
  doubleCountPolicy: "first_wins" | "highest_confidence_wins";
};
```

Policy is per-tenant with sane defaults; never widens silently. Admin changes are audit-logged.

**Cross-refs.** V10-OUT-011, V10-OUT-020.

---

<a id="v10-out-005"></a>

## V10-OUT-005 — lineage binding

**Requirement:** R-OUTCOME-5 (P0) — every outcome traces to its origin.

**Design.** `Lineage { turnIds[], proposalIds[], artifactIds[], missionIds[], userActionIds[] }`. Lineage is immutable; admin audit (V10-OUT-017) exports full chain.

**Cross-refs.** V10-OUT-017.

---

<a id="v10-out-006"></a>

## V10-OUT-006 — time-saved calibration

**Requirement:** R-OUTCOME-6 (P0) — per-persona × per-activity baselines.

**Design.** Baseline table: `{ persona, activity } → (median human minutes, confidence)`. Tunable per tenant via admin (with audit). Defaults derived from customer research; never exceeded without user confirmation.

Example (illustrative):
- `analyst × kpi_proposal_accept` → 12 min baseline
- `founder × activation_complete` → 45 min baseline
- `analyst × decision_doc_shipped` → 90 min baseline

**Acceptance criteria.**
- No time-saved signal exceeds baseline × 1.5 without user confirmation.
- Baseline changes logged with admin identity + reason.

**Cross-refs.** V10-OUT-007, V10-OUT-020.

---

<a id="v10-out-007"></a>

## V10-OUT-007 — user confirmation surface

**Requirement:** R-OUTCOME-7 (P0) — one-click confirm.

**Design.** After an activity ships, inline prompt: "≈Xh saved — confirm?" with thumbs + correction slider. Confirmation raises outcome confidence to `high` and locks magnitude against decay.

**Acceptance criteria.**
- Prompt non-blocking; no confirmation required for shipping.
- Confirmation action records a signal with `source: user_confirmation`.

**Cross-refs.** V10-OUT-008.

---

<a id="v10-out-008"></a>

## V10-OUT-008 — passive outcome emission

**Requirement:** R-OUTCOME-8 (P0) — silent emission for high-signal events.

**Design.** Listeners emit signals on: proposal accept (V10-ART-011), artifact ship (V10-ART-026), activation complete (V10-ONB-007), mission completion (V10-RSR-001). Signals carry `confidence: medium` pending user confirmation.

**Cross-refs.** V10-OUT-007.

---

<a id="v10-out-009"></a>

## V10-OUT-009 — decision-shipped detector

**Requirement:** R-OUTCOME-9 (P0) — `decision_doc` artifact reaches `approved`.

**Design.** Hook on ReviewState transition to `approved` for `decision_doc` (V10-ART-019) emits `decision_shipped` signal with lineage.

**Cross-refs.** V10-ART-019.

---

<a id="v10-out-010"></a>

## V10-OUT-010 — KPI-accept outcome

**Requirement:** R-OUTCOME-10 (P0) — onboarding KPI proposal acceptance.

**Design.** Listener on V10-ONB-013 (approval gate) and V10-ART-011 (partial acceptance) emits `time_saved` signal with lineage to originating question.

**Cross-refs.** V10-ONB-013.

---

<a id="v10-out-011"></a>

## V10-OUT-011 — double-count guard

**Requirement:** R-OUTCOME-11 (P0) — one activity → at most one outcome record.

**Design.** Dedup key = `(tenantId, artifactId || proposalId || decisionId, kind)`. Second signal against same key merges into existing record (picks higher confidence magnitude per policy V10-OUT-004).

**Acceptance criteria.**
- Fuzz test: 100 duplicate signals → exactly 1 record.

**Cross-refs.** V10-OUT-004.

---

<a id="v10-out-012"></a>

## V10-OUT-012 — reversal

**Requirement:** R-OUTCOME-12 (P0) — undo / revert nullifies outcome.

**Design.** Listeners on V10-AGT-008 (undo), V10-ART-015 (revert), V10-ONB-005 (onboarding reset) flip outcome state to `reversed` and exclude from totals. Audit log records the reversal + cause.

**Cross-refs.** V10-AGT-008, V10-ART-015.

---

<a id="v10-out-013"></a>

## V10-OUT-013 — per-team ROI dashboard

**Requirement:** R-OUTCOME-13 (P0) — primary customer-facing surface.

**Design.** Dashboard per team with: total hours saved, decisions shipped, confirmation rate, reversal rate, top activities, per-persona breakdown, trend. Data reads from OutcomeRecord store; never from free-form metrics.

**Acceptance criteria.**
- Dashboard loads in ≤2s for a 1000-record tenant.
- Every number links back to its records (drill-down).

**Cross-refs.** V10-OUT-014, V10-OUT-015.

---

<a id="v10-out-014"></a>

## V10-OUT-014 — per-persona breakdown

**Requirement:** R-OUTCOME-14 (P0) — analyst / founder / operator / advisor cuts.

**Design.** Aggregate by persona; compare baseline utilisation vs observed. Readable at a glance.

---

<a id="v10-out-015"></a>

## V10-OUT-015 — per-workload breakdown

**Requirement:** R-OUTCOME-15 (P0) — per workload class impact.

**Design.** Aggregate by `workloadClass` (from TrustBundle). Shows which workload classes deliver value for this tenant — feeds Learning (V10-LRN-005).

**Cross-refs.** V10-RSN-013, V10-LRN-005.

---

<a id="v10-out-016"></a>

## V10-OUT-016 — CFO narrative export

**Requirement:** R-OUTCOME-16 (P0) — machine-readable pack for finance.

**Design.** Export (JSON + PDF):
- Period coverage
- Total outcomes by kind
- Confirmation rate + reversal rate
- Attribution policy in effect
- Top activities + lineage samples
- Caveats (conservative defaults, baselines used)

PDF summary is 1–2 pages, readable without product knowledge. JSON is the source of truth.

**Acceptance criteria.**
- Export deterministic for a given period + tenant.
- Contains explicit "conservative defaults used" disclaimer.

**Cross-refs.** V10-OUT-017.

---

<a id="v10-out-017"></a>

## V10-OUT-017 — outcome audit log

**Requirement:** R-OUTCOME-17 (P0) — admin exportable.

**Design.** Every outcome state transition (create / confirm / reverse / redact / reassign) logs with actor + reason + before/after. Export as JSON Lines; tamper-evident checksum.

**Cross-refs.** V10-OUT-020.

---

<a id="v10-out-018"></a>

## V10-OUT-018 — outcome telemetry

**Requirement:** R-OUTCOME-18 (P0) — observability.

**Design.** Events (`outcome.*`): `signal_emitted`, `signal_rejected`, `record_created`, `record_confirmed`, `record_reversed`, `record_redacted`, `record_reassigned`, `dashboard_viewed`, `cfo_export_generated`.

---

<a id="v10-out-019"></a>

## V10-OUT-019 — never-invent-metric invariant

**Requirement:** R-OUTCOME-19 (P0) — no ad-hoc metrics.

**Design.** CI invariant 46 asserts no product UI surfaces a number that isn't backed by an `OutcomeRecord` or a TrustBundle-bound value. No marketing-style derived metrics in the app.

**Acceptance criteria.**
- CI grep / AST check: UI number renders must route through documented stores.

---

<a id="v10-out-020"></a>

## V10-OUT-020 — admin overrides

**Requirement:** R-OUTCOME-20 (P0) — redact / reassign with audit.

**Design.** Admin can:
- Redact (remove from totals + dashboards; preserve lineage).
- Reassign (change attributed team / user) with mandatory reason.
- Adjust baseline (V10-OUT-006) with mandatory reason.

Every action logged (V10-OUT-017) with admin identity, reason, before/after.

**Cross-refs.** V10-OUT-006, V10-OUT-017.

---

<a id="v10-out-021"></a>

## V10-OUT-021 — revenue / margin attribution

**Requirement:** R-OUTCOME-21 (P1) — CRM connector integration.

**Design.** Wave B. Binds decision_doc / research_report / artifact to CRM opportunity stage transitions (via connector). Attribution is **influence**, never **causation** — reports "AI-influenced" metrics with explicit caveat.

**Cross-refs.** V10-CON-* (CRM connector, Wave B).

---

<a id="v10-out-022"></a>

## V10-OUT-022 — risk-avoided outcomes

**Requirement:** R-OUTCOME-22 (P1) — from decision_review.

**Design.** Wave B. When a decision_review artifact flags a risk and the team adopts the mitigation, emits `risk_avoided` signal. Magnitude is qualitative + narrative; no fake dollar figures.

**Cross-refs.** V10-RSN-018.

---

<a id="v10-out-023"></a>

## V10-OUT-023 — cohort benchmarking

**Requirement:** R-OUTCOME-23 (P1) — anonymised cohort comparisons.

**Design.** Wave B. Opt-in. Tenant sees its percentile vs anonymised cohort on confirmation rate, reversal rate, top activities. Never exposes other tenants' data.

---

<a id="v10-out-024"></a>

## V10-OUT-024 — outcome quality dashboard

**Requirement:** R-OUTCOME-24 (P1) — self-observability.

**Design.** Wave B. Internal dashboard: confirmation rate trend, reversal rate trend, attribution policy drift, CFO export frequency. Drives roadmap of outcome block itself.

---

## Test strategy (aggregate)

- Unit: 24 tickets × ~3 tests (~70 tests).
- Integration: end-to-end from onboarding → proposal accept → signal → record → dashboard → CFO export.
- Chaos: duplicate signals, late reversal, baseline change, admin redact, connector outage.
- Compliance: CFO export schema validation; audit log tamper-evident check; conservative-defaults disclaimer present.
- Integrity: every UI number backed by a store query (V10-OUT-019 invariant).

**Pre-release gate.** Wave A: 10 canonical activities end-to-end produce correct totals; double-count guard holds under fuzz; reversal flips totals deterministically; CFO export deterministic.

## MVP exit criteria (Wave A)

1. `OutcomeSignalV1` + `OutcomeRecordV1` + taxonomy live.
2. AttributionPolicyV1 enforced; conservative defaults on for new tenants.
3. Lineage binding from turn → artifact → outcome unbroken across all sources.
4. Time-saved calibration + user confirmation surface + passive emission working.
5. Double-count guard + reversal semantics correct.
6. Per-team + per-persona + per-workload dashboards live.
7. CFO narrative export (JSON + PDF) deterministic.
8. Audit log + admin override paths live.
9. Telemetry contract extended with 9 `outcome.*` events.
10. CI invariant 46 (never-invent-metric) green.

## Rollout order

1. **Schema + taxonomy + policy** (V10-OUT-001 → 002 → 003 → 004) — shape.
2. **Lineage + calibration** (V10-OUT-005 → 006) — provenance and baselines.
3. **Emission** (V10-OUT-007 → 008 → 009 → 010) — confirmation + passive + detectors.
4. **Integrity** (V10-OUT-011 → 012 → 019) — dedup + reversal + invariant.
5. **Surfaces** (V10-OUT-013 → 014 → 015 → 016) — dashboards + export.
6. **Audit + admin** (V10-OUT-017 → 018 → 020) — audit log + telemetry + overrides.
7. **Wave B** — V10-OUT-021..024.

## Cross-refs to sibling dev plans

| Depends on | What's needed |
|---|---|
| `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` | Activation + KPI-accept emission hooks |
| `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | ReviewState transitions → decision-shipped detector |
| `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | ExecutionProposal accept → proposal-accept emission; undo → reversal |
| `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` | TrustBundle workload class → per-workload breakdown |
| `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` | Mission completion → outcome emission |
| `FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md` | Outcome signals feed learning (V10-LRN-005) |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | CRM / PM connectors for Wave B revenue / margin attribution |

ROI / Outcome is the **only** block allowed to surface monetary or
time-value numbers — every other block defers to it, and it defers to
conservative defaults.

## Flags to register at implementation time

24 flags (`ff.outcome_*`). Key Wave A:

- `ff.outcome_signal_v1` (V10-OUT-001) — **on-by-construction**
- `ff.outcome_record_v1` (V10-OUT-002) — **on-by-construction**
- `ff.outcome_taxonomy` (V10-OUT-003) — **on-by-construction**
- `ff.outcome_attribution_policy` (V10-OUT-004) — **on-by-construction**
- `ff.outcome_lineage` (V10-OUT-005) — **on-by-construction**
- `ff.outcome_time_saved_calibration` (V10-OUT-006)
- `ff.outcome_user_confirmation` (V10-OUT-007)
- `ff.outcome_passive_emission` (V10-OUT-008)
- `ff.outcome_decision_shipped` (V10-OUT-009)
- `ff.outcome_kpi_accept` (V10-OUT-010)
- `ff.outcome_double_count_guard` (V10-OUT-011) — **on-by-construction**
- `ff.outcome_reversal` (V10-OUT-012) — **on-by-construction**
- `ff.outcome_team_dashboard` (V10-OUT-013)
- `ff.outcome_persona_breakdown` (V10-OUT-014)
- `ff.outcome_workload_breakdown` (V10-OUT-015)
- `ff.outcome_cfo_export` (V10-OUT-016)
- `ff.outcome_audit_log` (V10-OUT-017) — **on-by-construction**
- `ff.outcome_telemetry_full` (V10-OUT-018)
- `ff.outcome_never_invent_metric` (V10-OUT-019) — **on-by-construction**
- `ff.outcome_admin_overrides` (V10-OUT-020)

Wave B: `ff.outcome_revenue_margin`, `ff.outcome_risk_avoided`, `ff.outcome_cohort_benchmarking`, `ff.outcome_quality_dashboard`.

Safety flags on-by-construction: signal + record schemas, taxonomy, attribution policy, lineage, double-count guard, reversal, audit log, never-invent-metric invariant.
