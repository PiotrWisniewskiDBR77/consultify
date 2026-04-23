# Chat V10 / DEEP RESEARCH — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 30
> tickets `V10-RSR-001..030` that implement the Deep Research & Reporting
> block of Chat V10. **No ticket here is shipped yet.**
>
> Authoritative input: [`DEEP_RESEARCH_DEEP_SEARCH_REPORTING_REQUIREMENTS_2026-04-18.md`](./DEEP_RESEARCH_DEEP_SEARCH_REPORTING_REQUIREMENTS_2026-04-18.md)
> (R-RESEARCH-1..30). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & research incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a research source → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Deep Research is how Chat V10 **investigates a question end-to-end** with
audit-grade evidence. It turns a user question into a scoped
**ResearchMission**, runs a multi-step plan across private + curated web
sources, builds an **EvidenceGraph**, validates every claim against its
sources, and emits a **research_report** artifact (V10-ART-020) bound to a
TrustBundle (V10-RSN-013).

Key differentiators from `grounded_chat`:

- **Multi-step, long-running** (minutes, not seconds)
- **Private-first retrieval** (V10-CON-010) then curated / open web
- **Evidence graph** rather than flat citations
- **Claim-level validation** with explicit disagreement handling
- **Cost cap + budget enforcement** (V10-AGT-007)
- **Scheduled watches** that re-run the same mission on a cadence

**MVP focus (Wave A):** one-shot research missions against workspace +
curated web, evidence graph, claim validation, research_report artifact,
cost caps, resume. Wave B: scheduled watches, cross-mission memory,
disagreement reconciliation UI, comparative research modes.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-RSR-001](#v10-rsr-001) | R-RESEARCH-1: `ResearchMissionV1` schema | P0 | 2 d | medium | A | 📐 design |
| [V10-RSR-002](#v10-rsr-002) | R-RESEARCH-2: mission scoping UI (question → objectives → policies) | P0 | 2 d | medium | A | 📐 design |
| [V10-RSR-003](#v10-rsr-003) | R-RESEARCH-3: retrieval policy (`private_only` / `private_plus_curated` / `private_plus_open_web`) | P0 | 1.5 d | high | A | 📐 design |
| [V10-RSR-004](#v10-rsr-004) | R-RESEARCH-4: source allow-list / block-list per tenant | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSR-005](#v10-rsr-005) | R-RESEARCH-5: mission plan formulator (sub-questions, budget) | P0 | 2 d | medium | A | 📐 design |
| [V10-RSR-006](#v10-rsr-006) | R-RESEARCH-6: budget + cost cap (wall, USD, token) | P0 | 2 d | high | A | 📐 design |
| [V10-RSR-007](#v10-rsr-007) | R-RESEARCH-7: research executor (queue + checkpoints + resume) | P0 | 2.5 d | high | A | 📐 design |
| [V10-RSR-008](#v10-rsr-008) | R-RESEARCH-8: source fetcher (pluggable per provider) | P0 | 2 d | medium | A | 📐 design |
| [V10-RSR-009](#v10-rsr-009) | R-RESEARCH-9: curated web source provider (allow-listed search) | P0 | 2 d | medium | A | 📐 design |
| [V10-RSR-010](#v10-rsr-010) | R-RESEARCH-10: content extractor (HTML → clean text with span offsets) | P0 | 2 d | medium | A | 📐 design |
| [V10-RSR-011](#v10-rsr-011) | R-RESEARCH-11: dedup + near-duplicate detection | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSR-012](#v10-rsr-012) | R-RESEARCH-12: `EvidenceGraphV1` schema + store | P0 | 2.5 d | high | A | 📐 design |
| [V10-RSR-013](#v10-rsr-013) | R-RESEARCH-13: claim node + source edge (spans + confidence) | P0 | 2 d | high | A | 📐 design |
| [V10-RSR-014](#v10-rsr-014) | R-RESEARCH-14: support / contradict edges between sources | P0 | 2 d | high | A | 📐 design |
| [V10-RSR-015](#v10-rsr-015) | R-RESEARCH-15: synthesis step (graph → draft report) | P0 | 2.5 d | high | A | 📐 design |
| [V10-RSR-016](#v10-rsr-016) | R-RESEARCH-16: claim validator (post-synthesis, against graph) | P0 | 2 d | high | A | 📐 design |
| [V10-RSR-017](#v10-rsr-017) | R-RESEARCH-17: disagreement presentation (sources disagree) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSR-018](#v10-rsr-018) | R-RESEARCH-18: hedging calibration (reuse V10-RSN-011) | P0 | 0.5 d | low | A | 📐 design |
| [V10-RSR-019](#v10-rsr-019) | R-RESEARCH-19: `research_report` artifact wrapper (V10-ART-020) | P0 | 1.5 d | low | A | 📐 design |
| [V10-RSR-020](#v10-rsr-020) | R-RESEARCH-20: TrustBundle for mission (reuse V10-RSN-013) | P0 | 1 d | medium | A | 📐 design |
| [V10-RSR-021](#v10-rsr-021) | R-RESEARCH-21: mission interrupt verbs (pause / stop / narrow / expand) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSR-022](#v10-rsr-022) | R-RESEARCH-22: mission resume from checkpoint | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSR-023](#v10-rsr-023) | R-RESEARCH-23: mission audit log (every source access) | P0 | 1 d | medium | A | 📐 design |
| [V10-RSR-024](#v10-rsr-024) | R-RESEARCH-24: research telemetry (per-step, per-source) | P0 | 1.5 d | low | A | 📐 design |
| [V10-RSR-025](#v10-rsr-025) | R-RESEARCH-25: research cost dashboard (per-tenant spend) | P0 | 1.5 d | low | A | 📐 design |
| [V10-RSR-026](#v10-rsr-026) | R-RESEARCH-26: scheduled watches (`ScheduleDefinitionV1` from V10-AGT-022) | P0 | 2 d | medium | B | 📐 design |
| [V10-RSR-027](#v10-rsr-027) | R-RESEARCH-27: watch delta report (what changed since last run) | P0 | 2 d | medium | B | 📐 design |
| [V10-RSR-028](#v10-rsr-028) | R-RESEARCH-28: cross-mission memory (not training — pointers) | P1 | 1.5 d | medium | B | 📐 design |
| [V10-RSR-029](#v10-rsr-029) | R-RESEARCH-29: comparative mission mode (A vs B) | P1 | 2 d | medium | B | 📐 design |
| [V10-RSR-030](#v10-rsr-030) | R-RESEARCH-30: research quality dashboard (coverage / disagreement / veto) | P1 | 1.5 d | low | B | 📐 design |

**Totals:** 30 tickets (27 × P0, 3 × P1). Estimated effort ≈55 engineer-days.

**Proposed flag namespace:** `ff.research_*`.

---

<a id="v10-rsr-001"></a>

## V10-RSR-001 — `ResearchMissionV1`

**Requirement:** R-RESEARCH-1 (P0) — mission is the unit of deep research.

**Design.** Schema in `src/models/research/ResearchMission.ts`:

```ts
export type ResearchMissionV1 = {
  id: MissionId;
  tenantId: TenantId;
  userId: UserId;
  correlationId: string;
  question: string;                      // original user question
  objectives: ResearchObjective[];       // derived sub-questions
  policy: RetrievalPolicy;               // V10-RSR-003
  allowList?: SourceAllowList;           // V10-RSR-004
  budget: BudgetBudgetV1;                // V10-AGT-007
  timeRange?: TimeRange;
  freshness: FreshnessPolicy;
  state: MissionState;                   // "scoping" | "planning" | "running" | "synthesising" | "validating" | "completed" | "paused" | "stopped" | "failed"
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expectedVersion: number;               // optimistic concurrency
};
```

Missions are **first-class artifacts**; they can be resumed, paused, re-run.

**Acceptance criteria.**
- Missions persist across server restart (recoverable from Run Ledger).
- State machine is closed — transitions validated in CI.

**Cross-refs.** V10-AGT-014 (Run Ledger).

---

<a id="v10-rsr-002"></a>

## V10-RSR-002 — mission scoping UI

**Requirement:** R-RESEARCH-2 (P0) — user reviews objectives + policies before execution.

**Design.** Scoping wizard: user question → proposed objectives (editable) → retrieval policy (V10-RSR-003) → budget (V10-RSR-006) → "Start". User can override any step. Default policy = `private_plus_curated`.

**Acceptance criteria.**
- Mission never starts without explicit user confirmation.
- Policy change after start requires mission restart (cannot be silently widened mid-mission).

**Cross-refs.** V10-RSR-003, V10-RSR-006.

---

<a id="v10-rsr-003"></a>

## V10-RSR-003 — retrieval policy

**Requirement:** R-RESEARCH-3 (P0) — explicit scope of source universe.

**Design.** Enum:

```ts
export type RetrievalPolicy =
  | "private_only"            // workspace + connectors only
  | "private_plus_curated"    // + tenant-approved curated web sources
  | "private_plus_open_web";  // + open web (requires admin opt-in)
```

Policy is **immutable per mission**. Changing policy requires a new mission. Admin can disable `open_web` at tenant level.

**Acceptance criteria.**
- CI asserts `open_web` is unreachable without admin opt-in flag.
- Policy `private_only` never hits any external endpoint.

**Cross-refs.** V10-CON-010, V10-RSR-009.

---

<a id="v10-rsr-004"></a>

## V10-RSR-004 — source allow / block list

**Requirement:** R-RESEARCH-4 (P0) — tenant governance over sources.

**Design.** Per-tenant allow / block lists (domains, specific URLs). Applied as a filter on every fetch. Block list takes precedence over allow list.

**Cross-refs.** V10-RSR-008.

---

<a id="v10-rsr-005"></a>

## V10-RSR-005 — mission plan formulator

**Requirement:** R-RESEARCH-5 (P0) — derive sub-questions + plan.

**Design.** LLM + heuristics produce `ResearchPlan { steps[], budgetAllocation }`. Steps are typed: `retrieve`, `extract`, `dedup`, `graph_update`, `synthesise`, `validate`. Plan is surfaced in the scoping UI for review.

**Acceptance criteria.**
- Plan ≥2 steps always visible to user before start.
- Budget allocation sums to mission budget.

**Cross-refs.** V10-RSR-002, V10-RSR-006.

---

<a id="v10-rsr-006"></a>

## V10-RSR-006 — budget + cost cap

**Requirement:** R-RESEARCH-6 (P0) — hard caps enforced per mission.

**Design.** Extends `BudgetBudgetV1` (V10-AGT-007) with per-source cost tracking. Per-tenant admin caps (daily USD, max mission USD). On cap hit, mission is paused + surfaced for user decision (continue with more budget / stop / reduce scope).

**Acceptance criteria.**
- No mission ever exceeds its cap — enforced at fetch time.
- Cap hit never loses work — checkpoint + resume available.

**Cross-refs.** V10-AGT-007, V10-RSR-025.

---

<a id="v10-rsr-007"></a>

## V10-RSR-007 — research executor

**Requirement:** R-RESEARCH-7 (P0) — durable multi-step executor.

**Design.** Reuses Agent Runtime's QueueExecutor (V10-AGT-015) + Run Ledger (V10-AGT-014) + CheckpointStore (V10-AGT-016). Each mission step writes a checkpoint with its output. Resume loads last checkpoint.

**Cross-refs.** V10-AGT-014..016.

---

<a id="v10-rsr-008"></a>

## V10-RSR-008 — source fetcher

**Requirement:** R-RESEARCH-8 (P0) — pluggable per provider.

**Design.** `SourceFetcher` interface:

```ts
export interface SourceFetcher {
  id: FetcherId;
  canFetch(ref: SourceRef): boolean;
  fetch(ref: SourceRef, session: ConnectorSession): Promise<SourceContent>;
}
```

Fetchers: workspace artifacts (V10-ART-022), connectors (V10-CON-010), curated web (V10-RSR-009). Registry in `src/services/research/fetchers.ts`. Rate-limited + retry per fetcher.

---

<a id="v10-rsr-009"></a>

## V10-RSR-009 — curated web source provider

**Requirement:** R-RESEARCH-9 (P0) — allow-listed web search.

**Design.** Curated-web provider calls a vetted search API (per tenant) restricted to allow-list (V10-RSR-004). Every call logged; no open-web crawling outside allow-list in `private_plus_curated` mode.

**Cross-refs.** V10-RSR-003.

---

<a id="v10-rsr-010"></a>

## V10-RSR-010 — content extractor

**Requirement:** R-RESEARCH-10 (P0) — HTML → clean text with span offsets.

**Design.** Extractor normalises HTML (readability pipeline) into `ExtractedContent { text, paragraphs[], spans[], metadata }`. Spans carry original-HTML offsets so citations can deep-link to the exact fragment.

**Acceptance criteria.**
- Extraction preserves paragraph structure.
- Span offsets round-trip (re-extraction yields same spans).

**Cross-refs.** V10-RSR-013.

---

<a id="v10-rsr-011"></a>

## V10-RSR-011 — dedup + near-duplicate

**Requirement:** R-RESEARCH-11 (P0) — avoid counting the same fact 5× from syndication.

**Design.** MinHash / SimHash per paragraph; near-duplicate clusters collapse into one graph node with a `syndicatedFrom[]` provenance list.

**Cross-refs.** V10-RSR-012.

---

<a id="v10-rsr-012"></a>

## V10-RSR-012 — `EvidenceGraphV1`

**Requirement:** R-RESEARCH-12 (P0) — graph of claims + sources + relations.

**Design.** Schema:

```ts
export type EvidenceGraphV1 = {
  id: GraphId;
  missionId: MissionId;
  nodes: GraphNode[];              // sources + claims
  edges: GraphEdge[];              // cites / supports / contradicts / syndicates
  stats: GraphStats;
  createdAt: Timestamp;
  expectedVersion: number;
};
```

Append-only within a mission; every change is recorded.

**Cross-refs.** V10-RSR-013, V10-RSR-014.

---

<a id="v10-rsr-013"></a>

## V10-RSR-013 — claim node + source edge

**Requirement:** R-RESEARCH-13 (P0) — each claim binds to source spans with confidence.

**Design.** `ClaimNode { id, text, kind, requiresCitation }` + `CitesEdge { claimId, sourceId, span, confidence, extractor }`. Confidence from the extractor; low-confidence edges trigger re-extraction.

**Cross-refs.** V10-RSN-008, V10-RSN-009.

---

<a id="v10-rsr-014"></a>

## V10-RSR-014 — support / contradict edges

**Requirement:** R-RESEARCH-14 (P0) — explicit reconciliation between sources.

**Design.** Pairwise analysis step between sources touching the same claim classifies edges as `supports` / `contradicts` / `neutral`. Contradictions surface in UI (V10-RSR-017), never hidden.

**Acceptance criteria.**
- Contradicted claims never ship as `certain`.
- Contradictions recorded with both source spans.

**Cross-refs.** V10-RSR-017.

---

<a id="v10-rsr-015"></a>

## V10-RSR-015 — synthesis

**Requirement:** R-RESEARCH-15 (P0) — graph → draft report.

**Design.** Synthesis LLM call takes the graph + mission objectives + policy; produces a sectioned draft (executive summary, key findings, evidence, disagreements, open questions, limitations). Draft is not shipped directly — it passes through validation (V10-RSR-016).

**Cross-refs.** V10-RSR-016, V10-ART-020.

---

<a id="v10-rsr-016"></a>

## V10-RSR-016 — claim validator

**Requirement:** R-RESEARCH-16 (P0) — validate every synthesised claim against graph.

**Design.** Every factual claim in the draft is re-extracted (reuses V10-RSN-008) and matched against graph citations. Unbound claims are handled per V10-RSN-012 (removed / hedged / vetoed). Coverage ≥ 0.95 required for `research_report`.

**Cross-refs.** V10-RSN-008..012.

---

<a id="v10-rsr-017"></a>

## V10-RSR-017 — disagreement presentation

**Requirement:** R-RESEARCH-17 (P0) — "sources disagree" is a first-class UI state.

**Design.** Any claim with contradicting edges surfaces in a dedicated "Disagreements" section of the report with both positions + citations. Never collapsed to a single "likely" statement without exposing the disagreement.

**Cross-refs.** V10-RSR-014.

---

<a id="v10-rsr-018"></a>

## V10-RSR-018 — hedging calibration

**Requirement:** R-RESEARCH-18 (P0) — reuse reasoning hedging.

**Design.** Uses V10-RSN-011 directly. Default hedging for research claims is stricter: `certain` only with ≥2 high-confidence independent sources.

**Cross-refs.** V10-RSN-011.

---

<a id="v10-rsr-019"></a>

## V10-RSR-019 — `research_report` artifact

**Requirement:** R-RESEARCH-19 (P0) — report is a typed artifact.

**Design.** Wraps final validated report as an `Artifact` (V10-ART-001) of type `research_report` (V10-ART-020). Carries ReviewState, version, Lineage back to mission, EvidenceGraph reference, TrustBundle hash.

**Cross-refs.** V10-ART-001, V10-ART-020.

---

<a id="v10-rsr-020"></a>

## V10-RSR-020 — mission TrustBundle

**Requirement:** R-RESEARCH-20 (P0) — TrustBundle for the whole mission.

**Design.** Emits a TrustBundle (V10-RSN-013) with:
- `workloadClass: "deep_research"`
- coverage, hedging distribution
- full source list with freshness
- tools used, budget used
- EvidenceGraph hash

**Cross-refs.** V10-RSN-013.

---

<a id="v10-rsr-021"></a>

## V10-RSR-021 — mission interrupt verbs

**Requirement:** R-RESEARCH-21 (P0) — pause / stop / narrow / expand.

**Design.** Verbs:
- `pause` — freeze mission; checkpoint stored.
- `stop` — terminate; partial report available.
- `narrow` — reduce scope / sources / time range; restart from checkpoint.
- `expand` — add objectives or policy — requires fresh approval + cost recompute.

Reuses V10-AGT-024 interrupt model.

**Cross-refs.** V10-AGT-024.

---

<a id="v10-rsr-022"></a>

## V10-RSR-022 — mission resume

**Requirement:** R-RESEARCH-22 (P0) — resume from checkpoint.

**Design.** Resume loads latest checkpoint from Run Ledger and continues. Resumed missions carry a `resumedAt` marker in the report.

**Cross-refs.** V10-AGT-016.

---

<a id="v10-rsr-023"></a>

## V10-RSR-023 — mission audit log

**Requirement:** R-RESEARCH-23 (P0) — every source access logged.

**Design.** Per-mission audit log: fetch URL, timestamp, status, bytes, cost. Immutable; exportable by admin.

**Cross-refs.** V10-RSR-024.

---

<a id="v10-rsr-024"></a>

## V10-RSR-024 — research telemetry

**Requirement:** R-RESEARCH-24 (P0) — per-step, per-source observability.

**Design.** Events (`research.*`): `mission_scoped`, `mission_planned`, `mission_started`, `step_started`, `step_completed`, `source_fetched`, `source_blocked`, `graph_updated`, `disagreement_detected`, `draft_synthesised`, `draft_validated`, `draft_vetoed`, `mission_paused`, `mission_resumed`, `mission_completed`, `mission_failed`, `budget_breached`.

---

<a id="v10-rsr-025"></a>

## V10-RSR-025 — cost dashboard

**Requirement:** R-RESEARCH-25 (P0) — per-tenant research spend.

**Design.** Admin dashboard: daily USD, per-user spend, top missions by cost, cap-hit frequency. Exportable.

**Cross-refs.** V10-RSR-006.

---

<a id="v10-rsr-026"></a>

## V10-RSR-026 — scheduled watches

**Requirement:** R-RESEARCH-26 (P0) — missions run on a cadence.

**Design.** Wave B. Uses `ScheduleDefinitionV1` (V10-AGT-022). Each run is a new mission with same scope; produces a delta report (V10-RSR-027). Tenant admin opt-in.

**Cross-refs.** V10-AGT-022, V10-RSR-027.

---

<a id="v10-rsr-027"></a>

## V10-RSR-027 — watch delta report

**Requirement:** R-RESEARCH-27 (P0) — "what changed since last run".

**Design.** Compares new evidence graph against previous run's graph; highlights new / removed / changed claims. Included in scheduled watch output.

**Cross-refs.** V10-RSR-012.

---

<a id="v10-rsr-028"></a>

## V10-RSR-028 — cross-mission memory

**Requirement:** R-RESEARCH-28 (P1) — pointers, not training data.

**Design.** Wave B. Mission-level memory stores pointers to previous relevant missions (e.g. "this question extends mission M-37"). No customer content is persisted in the memory layer — only pointers + short summaries. Opt-in per tenant; full delete on revocation.

**Cross-refs.** V10-LRN-006.

---

<a id="v10-rsr-029"></a>

## V10-RSR-029 — comparative mission mode

**Requirement:** R-RESEARCH-29 (P1) — A vs B research.

**Design.** Wave B. Two mission scopes run with shared budget; synthesis produces a comparison matrix; disagreements between branches explicitly surfaced.

---

<a id="v10-rsr-030"></a>

## V10-RSR-030 — research quality dashboard

**Requirement:** R-RESEARCH-30 (P1) — observability for research outputs.

**Design.** Wave B. Per-tenant: coverage distribution, disagreement rate, veto rate, budget utilisation, freshness breach rate.

---

## Test strategy (aggregate)

- Unit: 30 tickets × ~3 tests (~90 tests).
- Integration: end-to-end mission against fixture workspace + mock curated web → deterministic evidence graph.
- Chaos: fetcher failure mid-mission → resume; budget exhaustion → checkpoint + pause; contradicting sources → disagreement surfaced.
- Security: `private_only` mission fuzz → 0 external requests; allow-list enforcement under adversarial URLs.
- Offline: labelled mission set → coverage ≥ 0.95, precision ≥ 0.95, veto rate < 5%.

**Pre-release gate.** Wave A: end-to-end mission green with `private_plus_curated`; cost cap enforces; resume works; research_report + TrustBundle bind correctly.

## MVP exit criteria (Wave A)

1. `ResearchMissionV1` + scoping UI + plan formulator + budget caps live.
2. Retrieval policies enforced; source allow / block list works.
3. `EvidenceGraphV1` with claim / support / contradict edges.
4. Synthesis → claim validator → disagreement presentation.
5. `research_report` artifact wrapper + TrustBundle bound.
6. Interrupts + resume from checkpoint working.
7. Mission audit log + telemetry contract extended with 17 `research.*` events.
8. Cost dashboard live.

## Rollout order

1. **Mission shape** (V10-RSR-001 → 002 → 003 → 004) — schema + scoping + policy + lists.
2. **Planning + budget** (V10-RSR-005 → 006) — plan formulator + cost cap.
3. **Executor** (V10-RSR-007) — reuse Agent Runtime primitives.
4. **Fetch + extract + dedup** (V10-RSR-008 → 009 → 010 → 011).
5. **Graph** (V10-RSR-012 → 013 → 014).
6. **Synthesis + validation** (V10-RSR-015 → 016 → 017 → 018).
7. **Artifact + trust** (V10-RSR-019 → 020).
8. **Interrupts + audit** (V10-RSR-021 → 022 → 023).
9. **Observability** (V10-RSR-024 → 025).
10. **Wave B** — V10-RSR-026..030.

## Cross-refs to sibling dev plans

| Depends on | What's needed |
|---|---|
| `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` | Claim extraction, citation binder, hedging, TrustBundle, filter |
| `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | Run Ledger, CheckpointStore, QueueExecutor, interrupts, budget, schedules |
| `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | research_report artifact type, MutationProposal for saving, lineage |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | Private-first retrieval, SourceRef, ACL propagation |
| `FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md` | Outcome signals from report acceptance / re-runs |
| `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` | Research cost caps during onboarding (V10-ONB-017) |
| `ROI_LIFECYCLE_DEVELOPMENT_PLAN_2026-04-18.md` | Research as a tracked ROI activity |

Research is the **highest-cost** block per turn — every ticket exists to
keep cost deterministic and evidence auditable.

## Flags to register at implementation time

30 flags (`ff.research_*`). Key Wave A:

- `ff.research_mission_v1` (V10-RSR-001) — **on-by-construction**
- `ff.research_scoping_ui` (V10-RSR-002)
- `ff.research_policy_enum` (V10-RSR-003) — **on-by-construction**
- `ff.research_source_lists` (V10-RSR-004) — **on-by-construction**
- `ff.research_plan_formulator` (V10-RSR-005)
- `ff.research_budget_caps` (V10-RSR-006) — **on-by-construction**
- `ff.research_executor` (V10-RSR-007)
- `ff.research_source_fetcher` (V10-RSR-008)
- `ff.research_curated_web` (V10-RSR-009)
- `ff.research_content_extractor` (V10-RSR-010)
- `ff.research_dedup` (V10-RSR-011)
- `ff.research_evidence_graph_v1` (V10-RSR-012)
- `ff.research_claim_edges` (V10-RSR-013)
- `ff.research_support_contradict_edges` (V10-RSR-014) — **on-by-construction**
- `ff.research_synthesis` (V10-RSR-015)
- `ff.research_claim_validator` (V10-RSR-016) — **on-by-construction**
- `ff.research_disagreement_ui` (V10-RSR-017) — **on-by-construction**
- `ff.research_hedging_reuse` (V10-RSR-018)
- `ff.research_report_artifact` (V10-RSR-019)
- `ff.research_trust_bundle` (V10-RSR-020) — **on-by-construction**
- `ff.research_interrupts` (V10-RSR-021) — **on-by-construction**
- `ff.research_resume` (V10-RSR-022)
- `ff.research_audit_log` (V10-RSR-023) — **on-by-construction**
- `ff.research_telemetry_full` (V10-RSR-024)
- `ff.research_cost_dashboard` (V10-RSR-025)

Wave B: `ff.research_scheduled_watches`, `ff.research_watch_delta`, `ff.research_cross_mission_memory`, `ff.research_comparative_mode`, `ff.research_quality_dashboard`.

Safety flags on-by-construction: mission schema, policy enum, source lists, budget caps, support/contradict edges, claim validator, disagreement UI, TrustBundle, interrupts, audit log.
