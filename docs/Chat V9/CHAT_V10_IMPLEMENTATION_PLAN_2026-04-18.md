# Chat V10 Implementation Plan — Master Skeleton (2026-04-18)

> **Status:** skeleton / plan-of-plans. Created 2026-04-18.
> **Scope:** converts all 8 authoritative deep-research documents (206 requirements)
> into a single, numbered implementation backbone — blocks, tickets, flags,
> telemetry event families, CI invariants, and per-block dev plan stubs.
> **Authoritative inputs (must be read first):**
>
> 1. `DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md` (R-REASON-1..25)
> 2. `DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md` (R-LEARN-1..18)
> 3. `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md` (R-AGENT-1..29)
> 4. `DEEP_RESEARCH_DEEP_RESEARCH_REPORTING_2026-04-18.md` (R-RESEARCH-1..30)
> 5. `DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md` (R-ARTIFACT-1..31)
> 6. `DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md` (R-CONNECT-1..24)
> 7. `DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md` (R-OUTCOME-1..24)
> 8. `DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md` (R-ONBOARD-1..25)
>
> **Not in scope for this skeleton:** per-ticket acceptance criteria in full
> prose (those go into per-block dev plans — see §7). This document exists to
> fix the **taxonomy** so downstream work cannot drift.

---

## Table of contents

- [1. Canonical block taxonomy (`ChatV10Block`)](#sec-1-block-taxonomy)
- [2. Ticket numbering scheme](#sec-2-ticket-scheme)
- [3. Requirement → ticket backlog (summary table)](#sec-3-backlog)
- [4. Feature flag registry diff](#sec-4-flag-registry)
- [5. Telemetry contract extensions](#sec-5-telemetry)
- [6. CI invariants to add](#sec-6-ci-invariants)
- [7. Per-block dev plan stubs](#sec-7-dev-plan-stubs)
- [8. Sequencing and wave plan](#sec-8-waves)
- [9. MVP exit criteria (aggregated)](#sec-9-mvp-exit)
- [10. Open decisions](#sec-10-open-decisions)

---

<a id="sec-1-block-taxonomy"></a>

## 1. Canonical block taxonomy (`ChatV10Block`)

Chat V9 introduced `ChatV9Block` as a union of high-level product blocks (`navigation`, `voice`, `trust`, `admin`, `input`). V10 extends the surface area by a full order of magnitude; the block taxonomy must therefore be refactored rather than patched.

### 1.1 Decision

Introduce a new TypeScript union **`ChatV10Block`** alongside (not replacing) `ChatV9Block`. Keep V9 flags valid until each V9 block is fully subsumed by its V10 successor. Every `R-*` ID in the backlog resolves to exactly one V10 block.

```ts
// consultify/src/utils/chatV10FeatureFlags.ts (NEW FILE — to be created)
export type ChatV10Block =
  | "reasoning"          // R-REASON-*
  | "learning"           // R-LEARN-*
  | "agent_runtime"      // R-AGENT-*
  | "research"           // R-RESEARCH-*
  | "artifact"           // R-ARTIFACT-*
  | "connectors"         // R-CONNECT-*
  | "outcome"            // R-OUTCOME-*
  | "onboarding";        // R-ONBOARD-*
```

### 1.2 Block summary

| Block | Req prefix | Count (P0 / P1 / P2) | Owner domain | Primary dev plan |
| --- | --- | --- | --- | --- |
| `reasoning` | R-REASON- | 25 (20 / 4 / 1) | Model routing, intent classification, plan depth, trust bundle assembly | `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` |
| `learning` | R-LEARN- | 18 (14 / 4 / 0) | Feedback capture, memory layers, platform learning loop, consent | `FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md` |
| `agent_runtime` | R-AGENT- | 29 (22 / 6 / 1) | ExecutionProposalV1, Run Ledger, severity S0–S4, schedules, swarm | `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` |
| `research` | R-RESEARCH- | 30 (23 / 6 / 1) | Decision brief → scope → evidence graph → report artifact | `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` |
| `artifact` | R-ARTIFACT- | 31 (24 / 6 / 1) | Unified Artifact model, MutationProposal, CRDT, export integrity | `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` |
| `connectors` | R-CONNECT- | 24 (19 / 4 / 1) | Trust-preserving integration fabric, ACL-aware retrieval, residency | `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` |
| `outcome` | R-OUTCOME- | 24 (19 / 4 / 1) | Initiative entity, KPI model, ROI calculation, investor-grade reporting | `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` |
| `onboarding` | R-ONBOARD- | 25 (24 / 1 / 0) | Persona-aware first-run, 5-minute SLA, trust-first disclosure, bootstrap | `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` |
| **Totals** | — | **206 (165 / 35 / 6)** | — | 8 new dev plans |

> Per-requirement priority counts are **approximations** until the per-block
> dev plans are authored in full; the exact splits live inside each deep
> research document and are the source of truth.

### 1.3 Migration rules

- Every `R-*` ticket must carry `block: ChatV10Block` in its metadata.
- Every feature flag added in V10 must declare `block` as one of the eight values above; the existing CI invariant "every flag resolves to a known block" in `chatV9FeatureFlags.test.ts` is extended to also accept V10 blocks.
- V9 blocks (`navigation`, `voice`, `trust`, `admin`, `input`) remain valid for existing V9 flags. They do **not** accept new V10 requirements.
- Any requirement that looks like it could span two blocks is resolved by **primary surface** (e.g. "first export requires manifest" lives in `artifact` even though `onboarding` consumes it — onboarding tickets reference `R-ARTIFACT-24`, they do not duplicate it).

---

<a id="sec-2-ticket-scheme"></a>

## 2. Ticket numbering scheme

### 2.1 Two layers

1. **Requirement IDs (`R-*`)** — authoritative in research docs. Immutable.
2. **Ticket IDs (`V10-<block>-<nnn>`)** — in backlog / PRs / flag specDocs. Human-readable. One-to-one with requirements at MVP time; one-to-many allowed after MVP for sub-work.

### 2.2 Format

`V10-<BLOCK_CODE>-<3-digit sequence>`

| Block | Code | Range |
| --- | --- | --- |
| `reasoning` | `RSN` | V10-RSN-001..025 |
| `learning` | `LRN` | V10-LRN-001..018 |
| `agent_runtime` | `AGT` | V10-AGT-001..029 |
| `research` | `RSR` | V10-RSR-001..030 |
| `artifact` | `ART` | V10-ART-001..031 |
| `connectors` | `CON` | V10-CON-001..024 |
| `outcome` | `OUT` | V10-OUT-001..024 |
| `onboarding` | `ONB` | V10-ONB-001..025 |

Reserved sequence range 500+ per block for post-MVP sub-tickets.

### 2.3 Mapping rule

At MVP, ticket `V10-RSN-007` ≡ requirement `R-REASON-7`. The per-block dev plan (§7) contains the bijection table; CI invariant 14 (§6) enforces it.

---

<a id="sec-3-backlog"></a>

## 3. Requirement → ticket backlog (summary table)

**Note:** full backlog lives in each per-block dev plan. This table is the index only.

| Block | Ticket range | Requirement range | Status at MVP cut | Dev plan link |
| --- | --- | --- | --- | --- |
| reasoning | V10-RSN-001..025 | R-REASON-1..25 | Draft | `#sec-7-dev-plan-stubs-reasoning` |
| learning | V10-LRN-001..018 | R-LEARN-1..18 | Draft | `#sec-7-dev-plan-stubs-learning` |
| agent_runtime | V10-AGT-001..029 | R-AGENT-1..29 | Draft | `#sec-7-dev-plan-stubs-agent_runtime` |
| research | V10-RSR-001..030 | R-RESEARCH-1..30 | Draft | `#sec-7-dev-plan-stubs-research` |
| artifact | V10-ART-001..031 | R-ARTIFACT-1..31 | Draft | `#sec-7-dev-plan-stubs-artifact` |
| connectors | V10-CON-001..024 | R-CONNECT-1..24 | Draft | `#sec-7-dev-plan-stubs-connectors` |
| outcome | V10-OUT-001..024 | R-OUTCOME-1..24 | Draft | `#sec-7-dev-plan-stubs-outcome` |
| onboarding | V10-ONB-001..025 | R-ONBOARD-1..25 | Draft | `#sec-7-dev-plan-stubs-onboarding` |

### 3.1 Retired tickets from old combined doc

The superseded `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` contained 4 × 8 = 32 high-level R-* placeholders. They are **retired** and must not be re-ticketed.

| Old range | Retired because | Replacement authority |
| --- | --- | --- |
| Old R-ARTIFACT-1..8 | Superseded | `DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md` R-ARTIFACT-1..31 |
| Old R-CONNECT-1..8 | Superseded | `DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md` R-CONNECT-1..24 |
| Old R-OUTCOME-1..8 | Superseded | `DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md` R-OUTCOME-1..24 |
| Old R-ONBOARD-1..8 | Superseded | `DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md` R-ONBOARD-1..25 |
| Old R-AGENT-1..20 (truncated doc) | Superseded | `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md` R-AGENT-1..29 |

CI invariant 20 (§6) guards against accidental re-ticketing.

---

<a id="sec-4-flag-registry"></a>

## 4. Feature flag registry diff

The full flag list is maintained in `consultify/src/utils/chatV9FeatureFlags.ts`. V10 will add approximately **180 new flags**. This section enumerates namespaces only; exact flag strings are fixed in each per-block dev plan and validated by CI invariant 15.

### 4.1 Flag namespace per block

| Block | Namespace | Approx. flag count | Notes |
| --- | --- | --- | --- |
| reasoning | `ff.reasoning_*` | ~22 | One flag per major step (router, intent_class, plan_depth, self_check, trust_bundle, etc.) |
| learning | `ff.learning_*` | ~16 | Memory layers are gated individually; consent flags separate from capability flags |
| agent_runtime | `ff.agent_*` | ~28 | Includes severity-band flags (`ff.agent_severity_s3_gate`), schedule flags, swarm flag |
| research | `ff.research_*` | ~26 | Includes per-stage flags of the 4-stage pipeline + session-as-entity flags |
| artifact | `ff.artifact_*` | ~27 | Per ArtifactType flag (`ff.artifact_slide_deck`, `ff.artifact_spreadsheet`) + mutation flags + CRDT flag |
| connectors | `ff.connector_*` | ~22 | One flag per P0 connector + fabric-level flags (`ff.connector_acl_enforcement`, `ff.connector_residency_gate`) |
| outcome | `ff.outcome_*` | ~22 | Initiative lifecycle flags + KPI flags + investor-report flags |
| onboarding | `ff.onboard_*` | ~25 | Already drafted in onboarding doc §Next step |
| **Total** | — | **~188** | To be finalised per per-block dev plans |

### 4.2 Required fields on every V10 flag

Every flag in `chatV10FeatureFlags.ts` MUST declare the current Chat V9 fields plus two new ones:

```ts
type ChatV10Flag = ChatV9Flag & {
  requirementId: `R-${string}-${number}`;     // e.g. "R-REASON-7"
  ticketId: `V10-${string}-${number}`;        // e.g. "V10-RSN-007"
};
```

CI invariant 15 (§6) enforces that every flag's `requirementId` resolves to an existing row in exactly one of the 8 research documents, and that every `ticketId` is unique across the whole registry.

### 4.3 Default-off policy

Every V10 flag defaults to **off** in production until:
- its per-block dev plan has acceptance criteria met in staging, and
- CI invariant 18 (MVP exit criteria) passes for the relevant ticket.

Exception: onboarding flags default-off but `ff.onboard_trust_first_banner` and `ff.onboard_conservative_defaults` are **on-by-construction** for any new tenant (R-ONBOARD-5, R-ONBOARD-19). CI invariant 23 enforces this asymmetry.

---

<a id="sec-5-telemetry"></a>

## 5. Telemetry contract extensions

The current `CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md` defines one `FunnelEventName` union and Index/detailed sections per event. V10 adds **8 new event families** with approximately **120 new events**.

### 5.1 New event families

| Family | Approx. count | Primary purpose | Source doc §Telemetry |
| --- | --- | --- | --- |
| `reasoning.*` | ~15 | Intent classification, plan formulation, execution mode, self-check outcomes, trust bundle integrity | Reasoning doc §"mandatory telemetry event families" |
| `feedback.*` + `learning.*` | ~18 | 8 feedback signal types, consent events, memory mutations, platform-loop stage transitions | Learning doc §Unified Feedback Event Schema |
| `agent.*` | ~20 | ExecutionProposal lifecycle, severity transitions, Run Ledger events, user interrupt verbs, schedule triggers | Agent Runtime doc §Operator observability |
| `research.*` | ~16 | Scope contract events, subquery decomposition, evidence map updates, confirmation gate, export | Research doc §Failure handling + §Research session schema |
| `artifact.*` | ~14 | Artifact lifecycle, MutationProposal events, ReviewState transitions, export manifest events | Artifact doc §Governance |
| `connector.*` | ~15 | OAuth lifecycle, ACL sync, indexing progress, freshness SLO breach, residency events | Connectors doc §Data ingestion + §Admin |
| `outcome.*` | ~12 | Initiative lifecycle state changes, KPI snapshots, ROI calculation events, investor report generation | Outcome doc §Lifecycle + §Investor Reporting |
| `onboard.*` | ~22 | Full onboarding funnel — already enumerated in onboarding doc §Telemetry | Onboarding doc §Onboarding telemetry |
| **Total** | **~132** | — | — |

### 5.2 Mandatory property set per family

Each family extends the base V9 property set with family-specific required properties.

| Family | Required properties (in addition to base set) |
| --- | --- |
| `reasoning.*` | `workload_class`, `plan_depth`, `reasoning_mode`, `evidence_coverage`, `self_check_verdict`, `trust_bundle_hash` |
| `feedback.*` / `learning.*` | `signal_type`, `memory_layer`, `consent_level`, `anonymization_verdict`, `learning_stage` |
| `agent.*` | `severity`, `approval_mode`, `message_type`, `run_id`, `checkpoint_id`, `expected_version_verdict`, `interrupt_verb` |
| `research.*` | `session_id`, `subquery_id`, `source_class`, `cost_estimate`, `cost_actual`, `freshness_state`, `evidence_completeness` |
| `artifact.*` | `artifact_id`, `artifact_type`, `artifact_version`, `review_state`, `data_classification`, `mutation_id`, `manifest_hash` |
| `connector.*` | `connector_id`, `trust_mode`, `scope_set_hash`, `acl_inheritance_verdict`, `residency_region`, `freshness_age_seconds` |
| `outcome.*` | `initiative_id`, `kpi_id`, `lifecycle_state`, `baseline_hash`, `value_capture_phase`, `investor_report_manifest` |
| `onboard.*` | `persona`, `source_type`, `data_classification`, `trust_mode`, `residency_region`, `seconds_since_start`, `artifact_type`, `citation_count`, `validation_status`, `approval_required`, `aha_reached` |

### 5.3 Contract file update plan

The single `CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md` will be **renamed** `CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md` once all families above are added. Per-block dev plans contribute events via pull requests that each extend the contract index + detailed sections for one family. CI invariant 11 (index ↔ detailed bijection) already enforces consistency.

---

<a id="sec-6-ci-invariants"></a>

## 6. CI invariants to add

V9 currently enforces 30 invariants in `consultify/src/utils/__tests__/chatV9FeatureFlags.test.ts`. V10 adds **17 new invariants**, bringing the total to 47. Existing invariants remain valid.

### 6.1 New invariants (numbered 31–47)

| # | Invariant | Rationale |
| --- | --- | --- |
| 31 | Every `R-<BLOCK>-<n>` ID in any research doc resolves to exactly one flag in the registry with matching `requirementId`. | Prevents research→code drift. |
| 32 | Every flag `ticketId` matches the V10 ticket numbering regex `^V10-(RSN|LRN|AGT|RSR|ART|CON|OUT|ONB)-\d{3}$`. | Fixes taxonomy. |
| 33 | Every flag's `block` value is one of the eight `ChatV10Block` strings. | Guards block union. |
| 34 | For each family `reasoning|feedback|learning|agent|research|artifact|connector|outcome|onboard`, every event listed in the telemetry contract Index has a detailed section and vice versa. | Telemetry bijection per family. |
| 35 | Every event carries the mandatory property set defined for its family (see §5.2). | Schema completeness. |
| 36 | Every severity level `S0..S4` from Agent Runtime doc has exactly one configured default approval policy, undo window, audit retention, and UI treatment. | Prevents severity drift. |
| 37 | Every ArtifactType in `R-ARTIFACT-*` has a corresponding flag, a canonical schema file path, and a MutationProposal op set. | No ghost artifact types. |
| 38 | Every P0 connector in `R-CONNECT-*` has a flag, a trust-mode declaration, an ACL sync strategy, and a residency region. | No ghost connectors. |
| 39 | Every persona (`Partner`, `CFO`, `CEO`, `COO`, `CISO`, `TransformationOfficer`) has: persona route, primary connector, primary artifact type, KPI threshold row, and at least one dev plan cross-ref. | Onboarding path completeness. |
| 40 | `ff.onboard_conservative_defaults` default value is `true` for any new tenant record (R-ONBOARD-19). | Safe defaults are not toggleable off globally. |
| 41 | No `R-*` ID in the superseded combined doc (`DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md`) is referenced from any flag, ticket, or dev plan. | Prevents regressive ticketing. |
| 42 | Every `R-AGENT-*` mutation-related requirement is reachable only through `MutationProposal`; a lint rule forbids direct write imports outside proposal paths. | Agent→Artifact contract. |
| 43 | Every `R-OUTCOME-*` KPI calculation path has a deterministic snapshot function with golden-file regression test. | Finance-grade ROI integrity. |
| 44 | Every `R-RESEARCH-*` report artefact references exactly one `ArtifactType=research_report` with a citation-binding integrity check. | Research→Artifact contract. |
| 45 | Every `R-LEARN-*` memory mutation is gated by an explicit consent event `feedback.consent_granted` within the same session. | Consent-before-persistence. |
| 46 | Every `R-REASON-*` workload class has a routing policy entry and a latency budget in the router config; no orphans. | Router completeness. |
| 47 | Every dev plan linked from §7 exists on disk, has the required heading skeleton, and has at least one HTML anchor matching its ticket IDs. | Dev plan discoverability. |

### 6.2 Test file layout

```text
consultify/src/utils/__tests__/
├── chatV9FeatureFlags.test.ts        # existing, keeps invariants 1..30
└── chatV10FeatureFlags.test.ts       # NEW — invariants 31..47
```

Invariants 31–47 run against the same registry but read from the new V10-specific fields and from all 8 research documents. The two suites share helpers (`toWords`, `normalise`, `SUFFIX_EXAMPLES`, `NON_RESOLVER_FILES`) via a small shared test-utils module.

---

<a id="sec-7-dev-plan-stubs"></a>

## 7. Per-block dev plan stubs

Each stub below is the skeleton the eventual full dev plan must satisfy. Full dev plans are authored in follow-up passes — one per block, one PR each.

> Skeleton contract for every V10 dev plan:
> 1. **Block summary** (1 paragraph) — links to its authoritative research doc.
> 2. **Ticket bijection table** — `V10-<code>-<nnn>` ↔ `R-<BLOCK>-<n>` ↔ flag ↔ HTML anchor.
> 3. **Per-ticket acceptance criteria** (1–5 bullet points each, testable).
> 4. **Test strategy** — unit, integration, contract, Playwright/QA, CI invariants added.
> 5. **Failure modes and graceful degradation**.
> 6. **Cross-refs to sibling dev plans**.
> 7. **MVP exit criteria for this block**.
> 8. **Rollout order** (per-ticket) — which ticket unblocks which.

### <a id="sec-7-dev-plan-stubs-reasoning"></a>7.1 `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 25 tickets `V10-RSN-001..025`.
- **Authoritative input:** `DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`.
- **Core contracts to build:** 7 workload classes (`fast_chat`, `grounded_chat`, `reasoning_on_workspace`, `decision_review`, `artifact_build`, `deep_research`, `background_agent`), TrustBundle TypeScript type, Reasoning pipeline (intent → scope → plan depth → execution → grounding → self-check → presentation).
- **Dependencies:** none upstream — this is the spine.
- **Dependents:** everything (`agent_runtime`, `research`, `artifact`, `onboarding`).
- **First 14 days:** workload class router + TrustBundle v0 + `reasoning.*` telemetry.

### <a id="sec-7-dev-plan-stubs-learning"></a>7.2 `FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 18 tickets `V10-LRN-001..018`.
- **Authoritative input:** `DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md`.
- **Core contracts:** Unified Feedback Event Schema, 8 signal types, 4 memory layers (`Conversation`, `User`, `Organisation`, `Learned`), 5-stage platform learning loop, anonymization gate, prompt registry with rollback.
- **Dependencies:** `reasoning` (for event attribution), `onboarding` (for consent surface).
- **Dependents:** everything long-term — this is how the system improves.
- **First 14 days:** Session + User memory layer + thumbs/stars UX + explicit consent + rollback.

### <a id="sec-7-dev-plan-stubs-agent_runtime"></a>7.3 `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 29 tickets `V10-AGT-001..029`.
- **Authoritative input:** `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md`.
- **Core contracts:** `ExecutionProposalV1`, S0–S4 severity ladder, Run Ledger (QueueExecutor, CheckpointStore, ArtifactStore, ScheduleRegistry, TraceCollector, NotificationBroker), Swarm contract, 9 user interrupt verbs.
- **Dependencies:** `reasoning` (workload classification), `artifact` (MutationProposal as ActionEnvelope sibling), `connectors` (for side effects).
- **Dependents:** `research` (long sessions as ledger runs), `outcome` (scheduled reports).
- **First 14 days:** S0–S2 envelope + approval gate + ledger skeleton + atomic bundle executor.

### <a id="sec-7-dev-plan-stubs-research"></a>7.4 `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 30 tickets `V10-RSR-001..030`.
- **Authoritative input:** `DEEP_RESEARCH_DEEP_RESEARCH_REPORTING_2026-04-18.md`.
- **Core contracts:** Decision Brief, Scope Contract, Outline with Evidence Budgets, Subquery Decomposition, Evidence Map, Gap Detection, Confirmation Gate, 4-stage retrieval pipeline, canonical `research_report` object with typed content blocks.
- **Dependencies:** `reasoning` (plan depth), `connectors` (source-class policy), `artifact` (report as first-class artifact), `agent_runtime` (long-running sessions).
- **Dependents:** `outcome` (investor-grade reporting consumes research artefacts).
- **First 14 days:** Decision Brief + Scope Contract + Confirmation Gate + cost cap surfacing.

### <a id="sec-7-dev-plan-stubs-artifact"></a>7.5 `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 31 tickets `V10-ART-001..031`.
- **Authoritative input:** `DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md`.
- **Core contracts:** Unified `Artifact` interface, `ArtifactType`, `ReviewState`, `DataClassification`, `MutationProposal` two-layer patch contract (`json_patch`, `replace_text`, `move_block`, `update_cell_formula`, `update_chart_binding`), CRDT real-time layer (post-MVP), export manifest + SHA-256.
- **Dependencies:** `reasoning` (TrustBundle for provenance).
- **Dependents:** `agent_runtime`, `research`, `onboarding`, `outcome` — all high-value flows emit artifacts.
- **First 14 days:** `slide_deck` end-to-end (create → mutate → approve → export → manifest).

### <a id="sec-7-dev-plan-stubs-connectors"></a>7.6 `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 24 tickets `V10-CON-001..024`.
- **Authoritative input:** `DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md`.
- **Core contracts:** 4 hard non-negotiables (ZERO ACL leak, ZERO silent storage, minimal scopes, residency), P0/P1/P2 connector catalogue, trust modes, ACL sync strategy, freshness SLOs.
- **Dependencies:** `reasoning` (source class routing), `onboarding` (first-connector nudge).
- **Dependents:** everything that touches customer data.
- **First 14 days:** Secure upload + SharePoint P0 + OAuth validation handshake + ACL inheritance banner.

### <a id="sec-7-dev-plan-stubs-outcome"></a>7.7 `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 24 tickets `V10-OUT-001..024`.
- **Authoritative input:** `DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md`.
- **Core contracts:** First-class `Initiative` entity, strict lifecycle state machine, KPI model (baseline stability), ROI calculation framework, proof generation, investor-grade reporting, SOX-defensible audit.
- **Dependencies:** `reasoning` (decision review), `artifact` (investor pack as artifact), `research` (evidence base).
- **Dependents:** this is the moat — differentiator becomes measurable here.
- **First 14 days:** Initiative entity + lifecycle state machine + baseline snapshot + first KPI dashboard.

### <a id="sec-7-dev-plan-stubs-onboarding"></a>7.8 `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md`

- **Scope:** 25 tickets `V10-ONB-001..025`.
- **Authoritative input:** `DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md`.
- **Core contracts:** Persona-aware first-run, 5-minute SLA (median ≤240s, P90 ≤300s), trust-first disclosure matrix, workspace bootstrap protocol, conservative defaults (Internal / 30d / memory off), 6 persona paths.
- **Dependencies:** EVERY other block — onboarding is the binding layer.
- **Dependents:** `outcome` activation KPI feeds ROI dashboard.
- **First 14 days:** CFO path end-to-end (variance memo + approval + export + SHA-256); Partner and CISO paths follow.

---

<a id="sec-8-waves"></a>

## 8. Sequencing and wave plan

### 8.1 Principle

The 206 requirements cannot ship concurrently. Three waves, each ~14 days internal dogfood + ~14 days enterprise pilot.

### 8.2 Wave A — Spine (days 1–28)

Foundation that every later ticket depends on. Nothing enterprise-facing ships without this.

| Block | Tickets shipped | Why this wave |
| --- | --- | --- |
| reasoning | Workload router + TrustBundle v0 + `reasoning.*` telemetry (≈8 tickets) | Every downstream block reads TrustBundle |
| artifact | Unified Artifact model + MutationProposal v0 + `slide_deck` type (≈10 tickets) | No approval = no enterprise trust |
| connectors | Trust modes declaration + Secure upload + SharePoint P0 (≈6 tickets) | Needed for CFO onboarding path |
| agent_runtime | ExecutionProposalV1 + S0–S2 severity + approval gate (≈10 tickets) | Governs every mutation |
| learning | Consent surface + Session memory layer only (≈4 tickets) | Everything that captures signal needs consent first |
| onboarding | Trust banner + persona picker + conservative defaults + CFO workspace bootstrap (≈8 tickets) | Wave A customer proof |

**Wave A exit = CFO onboarding path activates end-to-end in internal dogfood with median ≤180s.**

### 8.3 Wave B — Enterprise surface (days 29–56)

Extends Wave A to the full enterprise buyer set.

| Block | Tickets shipped | Why this wave |
| --- | --- | --- |
| connectors | Remaining P0 connectors + ACL enforcement + freshness SLOs (≈12 tickets) | Needed for Partner / CEO / Transformation paths |
| research | Decision Brief + Scope Contract + Confirmation Gate + 4-stage retrieval (≈12 tickets) | Makes deep research safe |
| outcome | Initiative entity + lifecycle + baseline snapshot + first KPI dashboard (≈10 tickets) | ROI differentiator |
| artifact | Remaining types (`spreadsheet`, `decision_doc`, `research_report`) + manifest + SHA-256 (≈12 tickets) | Finance-grade exports |
| agent_runtime | S3–S4 severity + Run Ledger persistence + ScheduleDefinitionV1 (≈10 tickets) | Long-running + scheduled work |
| onboarding | Partner + CISO + CEO + COO + Transformation paths (≈12 tickets) | 5 of 6 persona paths live |
| learning | User + Organisation memory + platform loop stages 1–3 (≈8 tickets) | System starts to improve |
| reasoning | Plan depth + self-check + full pipeline (≈10 tickets) | Depth over speed |

**Wave B exit = all 6 persona paths activated; ROI dashboard live for internal consulting ops; investor-grade export for one artifact type.**

### 8.4 Wave C — Hardening + moat (days 57+)

Durability, scale, differentiation.

| Block | Tickets shipped | Why this wave |
| --- | --- | --- |
| artifact | CRDT real-time collaboration (≈4 tickets) | Competitive parity |
| outcome | Investor-grade reporting + SOX-defensible audit (≈8 tickets) | Commercial guarantees |
| research | Parallelism + reusable artefact emission + what-if analysis (≈10 tickets) | Scale + reuse |
| agent_runtime | Swarm contract + fan-out/fan-in (≈6 tickets) | Multi-agent consulting |
| learning | Platform loop stages 4–5 + prompt registry + rollback (≈4 tickets) | Safe self-improvement |
| connectors | P1/P2 connectors (≈6 tickets) | Long-tail buyer requests |

### 8.5 Wave gate invariants

Before any wave ships:
- All CI invariants 1–47 green.
- MVP exit criteria for every block in that wave met (§9).
- No V9 feature flag removed without evidence that its successor is live.
- `CHAT_V10_TELEMETRY_CONTRACT` index ↔ detailed bijection intact.

---

<a id="sec-9-mvp-exit"></a>

## 9. MVP exit criteria (aggregated)

Aggregates the "14-day MVP exit criteria" sections from each research doc into one release gate. Wave A ships only if **all** of these are true.

| Source | Criterion | Measurement |
| --- | --- | --- |
| Reasoning | Workload router classifies test corpus with ≥90% P0 accuracy | Golden-file test over 100 labelled cases |
| Reasoning | TrustBundle emitted on every reasoning output | 100% of `reasoning.*` events carry `trust_bundle_hash` |
| Learning | Consent granted before every memory write | 0 learning events without preceding `feedback.consent_granted` in session |
| Agent Runtime | Every mutation wrapped in ExecutionProposal | 0 direct-write imports outside proposal paths (CI invariant 42) |
| Agent Runtime | S0–S2 severity gates enforce correct approval mode | Golden-scenario tests per severity |
| Agent Runtime | Run Ledger replay recovers state after crash | Crash test recovers ≥99% of in-flight runs |
| Artifact | `slide_deck` end-to-end (create → mutate → approve → export → manifest + SHA-256) | E2E Playwright test green |
| Artifact | Export manifest always includes version lineage and hash | 100% of exports have manifest; no orphan exports |
| Connectors | Trust mode + scopes + ACL + residency visible before OAuth | 100% of OAuth flows gated on disclosure |
| Connectors | OAuth fallback triggers after 20s | Chaos test forces timeout; fallback renders |
| Outcome | Initiative lifecycle state machine rejects invalid transitions | 100% coverage of state transition test matrix |
| Outcome | Baseline snapshot deterministic | Golden-file test equal hash twice |
| Research | Decision Brief + Scope Contract + Confirmation Gate before any research run | 100% of research runs gated |
| Research | Research session resumable | Abandon + resume test recovers session |
| Onboarding | CFO median time-to-first-artifact ≤180s internal dogfood | P50 measurement over ≥20 guided sessions |
| Onboarding | CFO end-to-end activation ≥55% | Metric from onboarding funnel |
| Onboarding | 100% CFO exports include manifest + lineage + SHA-256 | Telemetry assertion |
| Onboarding | 0 silent write-backs anywhere in onboarding | CI invariant 42 green |
| Onboarding | Resume ≥95% | Chaos test batch |
| Onboarding | Partner path ≤240s | P50 measurement |
| Onboarding | CISO path always admin-first | 100% of route tests |
| Cross-cutting | All 47 CI invariants green | CI green |
| Cross-cutting | Telemetry index↔detailed bijection | Invariant 34 green |

---

<a id="sec-10-open-decisions"></a>

## 10. Resolved decisions (2026-04-18, CTO call)

All 8 pre-flight decisions + 2 surfaced-during-dev-plan-authoring
decisions are resolved. Dev plans may proceed to implementation without
further blocking. Resolutions below are the binding defaults; a decision
can only be re-opened with a documented ADR and sign-off by CTO +
product lead.

Each row links to the durable ADR in
[`./adr/`](./adr/README.md). The ADR carries the full context, options
considered, consequences, and execution notes. The table below is the
at-a-glance summary; the ADR is the source of truth under refactor.

| # | Decision | Resolution | Rationale | ADR |
| --- | --- | --- | --- | --- |
| D-1 | `ChatV10Block` vs extending `ChatV9Block` | **New union `ChatV10Block`**; V9 block enum preserved for V9 flags until subsumed | Clean lifecycle split; deprecation path per block instead of heterogeneous union | [`ADR-V10-001`](./adr/ADR-V10-001-chatv10block-union.md) |
| D-2 | Flag registry split | **New file `chatV10FeatureFlags.ts`**; shared helpers factored into `chatFlagsShared.ts` | ~188 V10 + ~50 V9 flags in one file = unreviewable diffs + slow tests; split is structural | [`ADR-V10-002`](./adr/ADR-V10-002-flag-registry-split.md) |
| D-3 | Telemetry contract | **Rename `CHAT_V9_TELEMETRY_CONTRACT` → `CHAT_V10_TELEMETRY_CONTRACT`** in-place; extend with new families | Families don't collide; single source of truth; git history continuity | [`ADR-V10-003`](./adr/ADR-V10-003-telemetry-contract-rename.md) |
| D-4 | CRDT vendor | **Deferred to Wave C; design leans Yjs**; dev plan keeps vendor abstraction | Yjs has larger ecosystem + enterprise track record; decision locked at Wave C start, not at MVP | [`ADR-V10-004`](./adr/ADR-V10-004-crdt-vendor-deferral.md) |
| D-5 | Initiative storage | **Postgres** with row-level-security per tenant; dedicated schema, not ArtifactStore | Finance-grade entity ≠ artifact semantics; ACID + RLS needed for SOX; dedicated service = overkill at MVP | [`ADR-V10-005`](./adr/ADR-V10-005-initiative-postgres.md) |
| D-6 | Run Ledger backing store | **Postgres + event log**; reuse existing Postgres footprint; no Temporal | Scales to ~1k runs/min which covers Wave A+B; re-evaluate at Wave C if scale demands; Temporal = new infra + DSL + ops burden | [`ADR-V10-006`](./adr/ADR-V10-006-run-ledger-postgres.md) |
| D-7 | Onboarding telemetry residency | **Same region as artifact** per tenant; no global telemetry bucket | Telemetry is PII (persona, interaction, user IDs); split residency = GDPR/SOC2/ISO compliance hole | [`ADR-V10-007`](./adr/ADR-V10-007-onboarding-telemetry-residency.md) |
| D-8 | CFO variance memo default tone | **Investor-grade auditor** is default; "friendlier" is opt-in | Scaling tone down from investor-grade is cosmetic; scaling up requires reconciliation evidence — asymmetric cost | [`ADR-V10-008`](./adr/ADR-V10-008-cfo-variance-tone.md) |
| D-9 | Write-scope connectors wave | **Wave C for all write scopes** (post, create ticket, send email, etc.); no write scope in Wave A/B | Write is the largest blast radius; must be preceded by full ExecutionProposal + approval + audit maturity from Wave A/B | [`ADR-V10-009`](./adr/ADR-V10-009-connector-write-scope-wave-c.md) |
| D-10 | Memory pack scope granularity | **Per-tenant only at MVP**; per-user pack deferred to post-MVP epic | Per-user pack creates compliance surface (right-to-forget per user, residency per user) that tenant-level avoids | [`ADR-V10-010`](./adr/ADR-V10-010-memory-pack-per-tenant-mvp.md) |

### 10.1 ADR log pointer

Any reversal of D-1..D-10 must land a separate ADR in
[`./adr/`](./adr/README.md) (format `ADR-V10-<nnn>-<slug>.md`,
auto-numbered from the current max) and update the row above with a
`Superseded by ADR-V10-<nnn>` note. Dev plans referencing a resolved
decision no longer carry a "blocked-by D-n" tag; they carry a
resolution pointer instead. CI invariants parse both the table above
and the ADR folder to enforce a bijection (see
`chatV10FeatureFlags.test.ts` · `ADR ↔ master-plan bijection`
describe block).

---

## Appendix A — Deep research document index (for easy cross-ref)

| # | Document | Requirements | Role |
| --- | --- | --- | --- |
| 1 | `DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md` | R-REASON-1..25 | Spine |
| 2 | `DEEP_RESEARCH_FEEDBACK_SELF_LEARNING_2026-04-18.md` | R-LEARN-1..18 | Learning loop |
| 3 | `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_FULL_2026-04-18.md` | R-AGENT-1..29 | Execution backbone |
| 4 | `DEEP_RESEARCH_DEEP_RESEARCH_REPORTING_2026-04-18.md` | R-RESEARCH-1..30 | Research product |
| 5 | `DEEP_RESEARCH_ARTIFACT_RUNTIME_DETAILED_2026-04-18.md` | R-ARTIFACT-1..31 | Output backbone |
| 6 | `DEEP_RESEARCH_ENTERPRISE_INTEGRATIONS_DETAILED_2026-04-18.md` | R-CONNECT-1..24 | Data boundary |
| 7 | `DEEP_RESEARCH_ROI_LIFECYCLE_DETAILED_2026-04-18.md` | R-OUTCOME-1..24 | Moat |
| 8 | `DEEP_RESEARCH_ONBOARDING_ACTIVATION_DETAILED_2026-04-18.md` | R-ONBOARD-1..25 | Binding layer |

## Appendix B — Superseded documents (do not reference)

| Document | Why retired |
| --- | --- |
| `DEEP_RESEARCH_ARTIFACT_CONNECTORS_ROI_ONBOARDING_2026-04-18.md` | 4 sections replaced by documents 5, 6, 7, 8 |
| `DEEP_RESEARCH_AGENTIC_CHAT_RUNTIME_2026-04-18.md` | Truncated; replaced by document 3 |

## Appendix C — Total counts

- **Requirements (authoritative):** 206 (165 × P0, 35 × P1, 6 × P2).
- **Tickets to author:** 206 at MVP (bijection); expansion allowed post-MVP in 500+ sequence range.
- **Feature flags to register:** ~188.
- **Telemetry events to add:** ~132 across 8 families.
- **CI invariants to add:** 17 (31..47); total after add: 47.
- **Dev plans to author:** 8.
- **Waves:** 3 (Spine / Enterprise / Hardening).
