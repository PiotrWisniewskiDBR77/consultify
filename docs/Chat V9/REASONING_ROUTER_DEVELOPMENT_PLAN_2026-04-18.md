# Chat V10 / REASONING — development plan (2026-04-18)

> **Scope note:** this plan is **design-phase** only. It documents the 25
> tickets `V10-RSN-001..025` that implement the Reasoning Router block of
> Chat V10. **No ticket here is shipped yet.** The block defines how every
> user turn is classified, scoped, planned, executed, grounded, self-checked,
> and presented — with a `TrustBundle` that binds the answer to its
> evidence.
>
> Authoritative input: [`DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md`](./DEEP_RESEARCH_REASONING_REQUIREMENTS_2026-04-18.md)
> (R-REASON-1..25). Master plan: [`CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`](./CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md).

> **Cross-refs**
> - Kill-switches & incident response → [`CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md`](./CHAT_V9_OPERATIONS_RUNBOOK_2026-04-18.md)
> - Adding a new workload class → [`CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md`](./CHAT_V9_CONTRIBUTOR_GUIDE_2026-04-18.md)
> - Telemetry payloads → [`CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md`](./CHAT_V9_TELEMETRY_CONTRACT_2026-04-18.md)

## Block summary

Reasoning is the **cognitive spine** of Chat V10. Every other block
(Artifact, Agent Runtime, Research, Connectors, Learning, Outcome,
Onboarding) reads its output. The reasoning router takes a user turn
through a 7-step pipeline — intent classification, scope resolution, plan
formulation, execution, grounding, self-check, presentation — and emits a
`TrustBundle` that every downstream consumer (MutationProposal,
ExecutionProposal, research report, KPI snapshot) can bind to.

**Seven workload classes** (routing targets):
`fast_chat` · `grounded_chat` · `reasoning_on_workspace` · `decision_review` · `artifact_build` · `deep_research` · `background_agent`

**Seven pipeline steps** (per-turn):
1. **Intent classification** — which workload class.
2. **Scope resolution** — which entities, sources, artifacts in context.
3. **Plan formulation** — multi-step plan with budget.
4. **Reasoning execution** — LLM calls, tool calls, retrieval.
5. **Grounding & citation** — every claim bound to source.
6. **Self-check** — evidence coverage, hedging calibration, hallucination filter.
7. **Presentation** — answer format, citations panel, `TrustBundle`.

**MVP focus (Wave A):** fast_chat + grounded_chat + reasoning_on_workspace workload classes end-to-end with TrustBundle emission. Decision-review, artifact-build, deep-research, background-agent land in Wave B. Plan formulation + budget enforcement are shared primitives used across Waves.

## Backlog

| ID | Requirement | Priority | Effort | Risk | Wave | Status |
|---|---|---|---|---|---|---|
| [V10-RSN-001](#v10-rsn-001) | R-REASON-1: workload class registry + router | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-002](#v10-rsn-002) | R-REASON-2: intent classifier (model + heuristic fallback) | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-003](#v10-rsn-003) | R-REASON-3: scope resolver (entities / sources / artifacts) | P0 | 2 d | medium | A | 📐 design |
| [V10-RSN-004](#v10-rsn-004) | R-REASON-4: plan formulator + budget attachment | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSN-005](#v10-rsn-005) | R-REASON-5: tool-call registry (typed, ACL-aware) | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSN-006](#v10-rsn-006) | R-REASON-6: retrieval layer (workspace + connectors + research) | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-007](#v10-rsn-007) | R-REASON-7: reasoning execution loop with step checkpoints | P0 | 2 d | medium | A | 📐 design |
| [V10-RSN-008](#v10-rsn-008) | R-REASON-8: claim extraction from draft answer | P0 | 1.5 d | high | A | 📐 design |
| [V10-RSN-009](#v10-rsn-009) | R-REASON-9: citation binder (claim → source span) | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-010](#v10-rsn-010) | R-REASON-10: evidence coverage scorer | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSN-011](#v10-rsn-011) | R-REASON-11: hedging calibration (certain/likely/plausible/speculative) | P0 | 1 d | medium | A | 📐 design |
| [V10-RSN-012](#v10-rsn-012) | R-REASON-12: hallucination filter (veto un-bound claims) | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-013](#v10-rsn-013) | R-REASON-13: TrustBundle schema + emitter | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-014](#v10-rsn-014) | R-REASON-14: TrustBundle hash (SHA-256 over canonical form) | P0 | 1 d | medium | A | 📐 design |
| [V10-RSN-015](#v10-rsn-015) | R-REASON-15: workload class `fast_chat` | P0 | 1 d | low | A | 📐 design |
| [V10-RSN-016](#v10-rsn-016) | R-REASON-16: workload class `grounded_chat` | P0 | 1.5 d | medium | A | 📐 design |
| [V10-RSN-017](#v10-rsn-017) | R-REASON-17: workload class `reasoning_on_workspace` | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-018](#v10-rsn-018) | R-REASON-18: workload class `decision_review` | P0 | 2 d | high | B | 📐 design |
| [V10-RSN-019](#v10-rsn-019) | R-REASON-19: workload class `artifact_build` | P0 | 1.5 d | medium | B | 📐 design |
| [V10-RSN-020](#v10-rsn-020) | R-REASON-20: workload class `deep_research` (stub → delegates to Research block) | P0 | 1 d | medium | B | 📐 design |
| [V10-RSN-021](#v10-rsn-021) | R-REASON-21: workload class `background_agent` (stub → delegates to Agent Runtime) | P0 | 1 d | medium | B | 📐 design |
| [V10-RSN-022](#v10-rsn-022) | R-REASON-22: presentation layer (answer + citations + trust panel) | P0 | 2 d | low | A | 📐 design |
| [V10-RSN-023](#v10-rsn-023) | R-REASON-23: reasoning telemetry (per-step, per-class) | P0 | 1.5 d | low | A | 📐 design |
| [V10-RSN-024](#v10-rsn-024) | R-REASON-24: edge-case matrix handlers (empty scope, low coverage, tool failure, OOM) | P0 | 2 d | high | A | 📐 design |
| [V10-RSN-025](#v10-rsn-025) | R-REASON-25: reasoning quality dashboard (coverage / hedging / veto rate) | P1 | 1.5 d | low | B | 📐 design |

**Totals:** 25 tickets (24 × P0, 1 × P1). Estimated effort ≈40 engineer-days.

**Proposed flag namespace:** `ff.reasoning_*`.

---

<a id="v10-rsn-001"></a>

## V10-RSN-001 — workload class registry + router

**Requirement:** R-REASON-1 (P0) — every turn routes to exactly one workload class.

**Design.** Registry in `src/services/reasoning/workloadRegistry.ts`:

```ts
export type WorkloadClass =
  | "fast_chat"
  | "grounded_chat"
  | "reasoning_on_workspace"
  | "decision_review"
  | "artifact_build"
  | "deep_research"
  | "background_agent";

export type WorkloadSpec = {
  class: WorkloadClass;
  budget: BudgetBudget;            // from V10-AGT-007
  allowedTools: ToolId[];
  requiresGrounding: boolean;      // forces citation layer
  minEvidenceCoverage: number;     // 0..1
  defaultHedging: HedgingLevel;
};

export const WORKLOAD_REGISTRY: Record<WorkloadClass, WorkloadSpec>;
```

Router selects exactly one class per turn; downstream pipeline reads from the selected spec, never branches on class name.

**Acceptance criteria.**
- Registry has exactly 7 entries.
- CI invariant 43 asserts no class is referenced in code without a registry entry.
- Router emits `reasoning.workload_routed` telemetry with selected class + reason.

**Test strategy.**
- Unit: registry completeness; router decision table (20 canonical turns → expected class).

**Cross-refs.** V10-RSN-002 (classifier), V10-RSN-015..021 (per-class executors).

---

<a id="v10-rsn-002"></a>

## V10-RSN-002 — intent classifier

**Requirement:** R-REASON-2 (P0) — classify the user turn into a workload class.

**Design.** Two-stage classifier:

1. **Heuristic pre-filter** — short turns (<15 tokens, no entity refs) → `fast_chat`. Explicit slash-commands → direct mapping. Explicit deep-research CTA → `deep_research`.
2. **Model classifier** — small LLM (or dedicated fine-tune) that emits one of 7 classes + confidence. Low confidence (<0.6) → fallback to `grounded_chat` (safest default).

Classifier output: `{ class, confidence, reason }`. Reason surfaces in UI ("routed to grounded chat because you referenced finance/Q4").

**Acceptance criteria.**
- Classifier latency P90 ≤ 150 ms.
- Confidence ≥ 0.6 on ≥90% of turns in internal dogfood.
- Low-confidence turns fall back to `grounded_chat` deterministically.

**Test strategy.**
- Unit: heuristic pre-filter table (30 canonical short turns).
- Offline: classifier accuracy against labelled set ≥ 85%.

**Cross-refs.** V10-RSN-001.

---

<a id="v10-rsn-003"></a>

## V10-RSN-003 — scope resolver

**Requirement:** R-REASON-3 (P0) — resolve the set of entities, sources, artifacts the turn operates on.

**Design.** Scope resolver takes the user turn + conversation state + active artifact + selection and produces a `Scope`:

```ts
export type Scope = {
  entities: EntityRef[];        // tasks, projects, people
  sources: SourceRef[];         // connector-backed docs
  artifacts: ArtifactRef[];     // currently open, referenced, or implied
  timeRange?: TimeRange;
  acls: ACLSet;                 // union of ACLs for all sources
};
```

Explicit resolution of ambiguous scope ("this task", "the Q4 report") against conversation history. If ambiguous with ≥2 candidates, router asks for clarification rather than guessing.

**Acceptance criteria.**
- Scope output is pure (deterministic given same input).
- Ambiguous scope with multiple candidates triggers clarification UI, not a guess.
- ACL union is correct (tested against connector ACL tests).

**Test strategy.**
- Unit: scope resolution table — 30 turns × expected scope.
- Chaos: referenced artifact deleted → scope has orphan ref, UI shows "artifact not found".

**Cross-refs.** V10-CON-014 (ACL propagation).

---

<a id="v10-rsn-004"></a>

## V10-RSN-004 — plan formulator + budget attachment

**Requirement:** R-REASON-4 (P0) — complex turns produce a multi-step plan with attached budget.

**Design.** For `reasoning_on_workspace`, `decision_review`, `artifact_build`, `deep_research`, the router emits a `Plan`:

```ts
export type Plan = {
  steps: PlanStep[];
  budget: BudgetBudget;           // from V10-AGT-007
  checkpointCadence: "per_step" | "every_60s";
  approvalBarriers: number[];     // step ordinals that require human approval
};
```

User sees the plan before execution (collapsible in fast paths, explicit in deep research). Plan execution uses Agent Runtime's Run Ledger (V10-AGT-014).

**Acceptance criteria.**
- Plans ≥2 steps are always surfaced to the user before execution.
- Budget attached on every plan; execution halts on overrun.

**Test strategy.**
- Unit: plan formulator for 10 canonical turns.

**Cross-refs.** V10-AGT-007, V10-AGT-014.

---

<a id="v10-rsn-005"></a>

## V10-RSN-005 — tool-call registry

**Requirement:** R-REASON-5 (P0) — tools are typed, ACL-aware, budget-aware.

**Design.** Registry in `src/services/reasoning/toolRegistry.ts`:

```ts
export type ToolSpec = {
  id: ToolId;
  jsonSchema: JSONSchema;
  requiredAcls: ACLClaim[];
  costEstimateMs: number;
  severity: Severity;            // what severity does invoking this imply
  sideEffects: boolean;
};
```

Every tool invocation emits a span; failure is handled per severity (retry for S0/S1; escalate for S3+).

**Acceptance criteria.**
- Tools without registry entry cannot be invoked.
- ACL check runs before tool call; missing ACL → tool call rejected with typed error.

**Cross-refs.** V10-AGT-003, V10-CON-009.

---

<a id="v10-rsn-006"></a>

## V10-RSN-006 — retrieval layer

**Requirement:** R-REASON-6 (P0) — retrieve from workspace, connectors, or research sources.

**Design.** Unified retrieval interface `retrieveSources(scope, query, policy)`:

- Workspace artifacts (via ArtifactStore search)
- Connector sources (via Connectors block federated search)
- Research sources (via Deep Research block's evidence graph)
- Policy: `private_only` | `private_plus_curated_web` | `private_plus_open_web`

Returns ranked source list with provenance + ACL verified.

**Acceptance criteria.**
- Retrieval respects scope ACLs — never returns source user cannot access.
- Policy `private_only` never hits web sources.

**Cross-refs.** V10-ART-022, V10-CON-013, V10-RSR-*.

---

<a id="v10-rsn-007"></a>

## V10-RSN-007 — execution loop + checkpoints

**Requirement:** R-REASON-7 (P0) — reasoning loop writes checkpoints per step.

**Design.** Loop iterates over plan steps; each step calls LLM / tool; result written to checkpoint. Interrupts (V10-AGT-024) pause the loop; resume reads last checkpoint.

**Acceptance criteria.**
- Every step has ≥1 checkpoint.
- Resume produces identical final state.

**Cross-refs.** V10-AGT-016.

---

<a id="v10-rsn-008"></a>

## V10-RSN-008 — claim extraction

**Requirement:** R-REASON-8 (P0) — extract factual claims from draft answer.

**Design.** After execution, a secondary pass extracts claims from the draft:

```ts
export type Claim = {
  id: ClaimId;
  text: string;
  span: Span;                    // position in draft
  kind: "fact" | "opinion" | "instruction" | "recommendation";
  requiresCitation: boolean;
};
```

Model-based extractor with structured output; fallback to rule-based for low-complexity turns.

**Acceptance criteria.**
- Extractor produces ≥90% claim recall on labelled set.
- Non-factual content (greetings, instructions) is correctly tagged as non-factual.

**Cross-refs.** V10-RSN-009, V10-RSN-012.

---

<a id="v10-rsn-009"></a>

## V10-RSN-009 — citation binder

**Requirement:** R-REASON-9 (P0) — every factual claim binds to a source span.

**Design.** For each extracted claim where `requiresCitation === true`, binder searches retrieved sources for matching span; on match, attaches `{ sourceId, spanStart, spanEnd, confidence }`. On miss, the claim is flagged for the hallucination filter (V10-RSN-012).

**Acceptance criteria.**
- Binding precision ≥ 95% (false-positive binds rare).
- Unbound factual claims never ship without hedging or veto.

**Cross-refs.** V10-RSN-008, V10-RSN-012.

---

<a id="v10-rsn-010"></a>

## V10-RSN-010 — evidence coverage scorer

**Requirement:** R-REASON-10 (P0) — score how well the draft is grounded in evidence.

**Design.** `coverage = boundClaims / totalFactualClaims`. Per-workload threshold:

| Workload | Minimum coverage |
|---|---|
| `fast_chat` | N/A (no grounding requirement) |
| `grounded_chat` | 0.70 |
| `reasoning_on_workspace` | 0.80 |
| `decision_review` | 0.90 |
| `artifact_build` | 0.85 |
| `deep_research` | 0.95 |

Below threshold → veto or scaffold fallback (V10-ONB-021).

**Acceptance criteria.**
- Coverage computed on every ground-requiring turn.
- Threshold miss → draft marked `BlockedDraft`.

**Cross-refs.** V10-ONB-021, V10-RSN-012.

---

<a id="v10-rsn-011"></a>

## V10-RSN-011 — hedging calibration

**Requirement:** R-REASON-11 (P0) — claims carry typed hedging.

**Design.** Four levels: `certain` | `likely` | `plausible` | `speculative`. Calibration driven by:
- Citation confidence
- Source freshness
- Source diversity
- Workload class defaults

UI renders hedging inline (e.g. italicised "likely" prefix or footnote marker).

**Acceptance criteria.**
- No claim ships without a hedging level.
- Hedging distribution is surfaced in reasoning quality dashboard.

**Cross-refs.** V10-ART-020 (research_report hedging field).

---

<a id="v10-rsn-012"></a>

## V10-RSN-012 — hallucination filter

**Requirement:** R-REASON-12 (P0) — veto unbound factual claims.

**Design.** Pre-presentation filter:
- Claim `requiresCitation && !citationBound` → either:
  - Remove claim from draft (if non-essential), or
  - Replace with hedged placeholder + honest "no source found" marker, or
  - Veto entire draft → scaffold fallback.

Filter logs veto rate to reasoning quality dashboard (V10-RSN-025).

**Acceptance criteria.**
- Unbound factual claims never reach presentation.
- Veto rate visible in dashboard.

**Cross-refs.** V10-RSN-009, V10-RSN-025.

---

<a id="v10-rsn-013"></a>

## V10-RSN-013 — TrustBundle schema + emitter

**Requirement:** R-REASON-13 (P0) — every answer carries a TrustBundle.

**Design.** Schema in `src/models/reasoning/TrustBundle.ts`:

```ts
export type TrustBundle = {
  id: TrustBundleId;
  tenantId: TenantId;
  correlationId: string;
  workloadClass: WorkloadClass;
  coverage: number;                 // 0..1
  citations: Citation[];
  claims: Claim[];
  vetoedClaims: Claim[];
  hedgingDistribution: Record<HedgingLevel, number>;
  sourcesUsed: SourceRef[];
  toolsUsed: ToolId[];
  budgetUsed: BudgetUsage;
  stepSpans: OtelSpanRef[];         // trace of pipeline steps
  hash: string;                     // SHA-256 over canonical form (V10-RSN-014)
  createdAt: Timestamp;
};
```

Emitted at end of pipeline; consumed by MutationProposal, ExecutionProposal, research report, onboarding approval gate.

**Acceptance criteria.**
- Every ground-requiring turn emits a TrustBundle.
- Consumers verify hash before binding.

**Cross-refs.** V10-ART-007 (MutationProposal), V10-AGT-001 (ExecutionProposalV1), V10-ONB-013 (approval gate).

---

<a id="v10-rsn-014"></a>

## V10-RSN-014 — TrustBundle hash

**Requirement:** R-REASON-14 (P0) — tamper-evident binding.

**Design.** SHA-256 over canonical JSON form (sorted keys, fixed whitespace). Hash is recomputed by consumers to verify no tampering between emission and use.

**Acceptance criteria.**
- Hash is deterministic — same bundle → same hash.
- Tampered bundle fails verification.

**Cross-refs.** V10-RSN-013.

---

<a id="v10-rsn-015"></a>

## V10-RSN-015 — fast_chat

**Requirement:** R-REASON-15 (P0) — lightweight no-grounding path.

**Design.** Used for greetings, navigation questions, trivial summaries. Skips scope resolution, retrieval, grounding. No TrustBundle (or empty). Budget: 2s wall, 0.01 USD.

**Acceptance criteria.**
- Latency P90 ≤ 500 ms.
- Never invoked for turns referencing entities.

**Cross-refs.** V10-RSN-002.

---

<a id="v10-rsn-016"></a>

## V10-RSN-016 — grounded_chat

**Requirement:** R-REASON-16 (P0) — baseline grounded path.

**Design.** Default workload when classifier is uncertain. Retrieves from workspace + connectors; citation binding required; coverage ≥ 0.70. No artifact mutations.

**Acceptance criteria.**
- Coverage ≥ 0.70 in ≥95% of turns.
- Latency P90 ≤ 3s.

**Cross-refs.** V10-RSN-010.

---

<a id="v10-rsn-017"></a>

## V10-RSN-017 — reasoning_on_workspace

**Requirement:** R-REASON-17 (P0) — multi-step analysis grounded in workspace.

**Design.** For turns that operate on specific workspace entities (artifacts, tasks, projects) with multi-step analysis. Produces plan (V10-RSN-004) + executes with checkpoints (V10-RSN-007). Coverage ≥ 0.80.

**Cross-refs.** V10-RSN-004.

---

<a id="v10-rsn-018"></a>

## V10-RSN-018 — decision_review

**Requirement:** R-REASON-18 (P0) — executive decision assistance.

**Design.** Wave B. Takes decision document / options set; produces pros/cons, risk, recommendation. Coverage ≥ 0.90; hedging default `likely`. Output is a `decision_doc` artifact (V10-ART-019).

**Cross-refs.** V10-ART-019.

---

<a id="v10-rsn-019"></a>

## V10-RSN-019 — artifact_build

**Requirement:** R-REASON-19 (P0) — produces an artifact as the primary output.

**Design.** Wave B. Takes user objective + scope; generates artifact (slide_deck, memo, spreadsheet, etc.) wrapped in a MutationProposal (V10-ART-007). Coverage ≥ 0.85.

**Cross-refs.** V10-ART-007, V10-ART-016..020.

---

<a id="v10-rsn-020"></a>

## V10-RSN-020 — deep_research (stub)

**Requirement:** R-REASON-20 (P0) — router delegates to Research block.

**Design.** Router recognises deep-research intent and hands off to Research block (V10-RSR-*); reasoning router is not the executor, only the dispatcher.

**Cross-refs.** V10-RSR-*.

---

<a id="v10-rsn-021"></a>

## V10-RSN-021 — background_agent (stub)

**Requirement:** R-REASON-21 (P0) — router delegates to Agent Runtime scheduler.

**Design.** Router recognises scheduled / long-running intent and hands off to Agent Runtime's ScheduleRegistry (V10-AGT-022).

**Cross-refs.** V10-AGT-022.

---

<a id="v10-rsn-022"></a>

## V10-RSN-022 — presentation layer

**Requirement:** R-REASON-22 (P0) — answer + citations + trust panel.

**Design.** Component tree in `src/components/reasoning/`:
- `AnswerView` — formatted answer with inline citation markers
- `CitationPanel` — expandable list of sources with spans highlighted
- `TrustPanel` — coverage meter, hedging breakdown, tools used, budget used

Trust panel is one-click accessible on every answer.

**Cross-refs.** V10-ONB-012 (provenance panel reuses this surface).

---

<a id="v10-rsn-023"></a>

## V10-RSN-023 — reasoning telemetry

**Requirement:** R-REASON-23 (P0) — per-step, per-class observability.

**Design.** Events in the `reasoning.*` family:

`reasoning.turn_started`, `reasoning.workload_routed`, `reasoning.scope_resolved`, `reasoning.plan_formulated`, `reasoning.execution_completed`, `reasoning.claims_extracted`, `reasoning.citations_bound`, `reasoning.coverage_scored`, `reasoning.draft_vetoed`, `reasoning.hedging_calibrated`, `reasoning.trust_bundle_emitted`, `reasoning.turn_completed`.

Required properties: `workload_class`, `coverage`, `hedging_level`, `tools_used_count`, `budget_used_ms`, `budget_used_usd`, `veto_reason?`.

**Cross-refs.** V10-RSN-025.

---

<a id="v10-rsn-024"></a>

## V10-RSN-024 — edge-case matrix

**Requirement:** R-REASON-24 (P0) — degrade gracefully under adverse conditions.

**Design.** Matrix covers:
- Empty scope → ask clarification
- Low coverage → scaffold fallback or ask user for more sources
- Tool failure → retry once, then escalate or degrade
- LLM timeout → partial answer with explicit "truncated" marker
- OOM / rate limit → queue with backoff
- Hostile user input → safety filter + canned refusal
- Evidence contradiction → explicit "sources disagree" presentation
- Source freshness violation (e.g. source older than time range) → flag in hedging

Each path has a deterministic handler; no silent failures.

**Cross-refs.** V10-ONB-021, V10-AGT-015 (retry), V10-LRN-*.

---

<a id="v10-rsn-025"></a>

## V10-RSN-025 — reasoning quality dashboard

**Requirement:** R-REASON-25 (P1) — observability for reasoning outputs.

**Design.** Admin dashboard with per-workload breakdowns: coverage distribution, hedging distribution, veto rate, tool-call failure rate, claim-binding precision. Tracked over time.

**Cross-refs.** V10-RSN-023.

---

## Test strategy (aggregate)

- 25 tickets × unit (≥60 unit tests)
- Per-workload E2E (7 scenarios) — fast_chat, grounded_chat, reasoning_on_workspace green in Wave A
- Offline evaluation set: labelled turns → classifier accuracy, claim extraction recall, citation binding precision
- Chaos: edge-case matrix — 8 scenarios each with expected degradation

**Pre-release gate.** Wave A: fast_chat + grounded_chat + reasoning_on_workspace green, coverage ≥ target on ≥95% of labelled turns, veto rate < 5%, TrustBundle hash verification works across all downstream consumers.

## MVP exit criteria (Wave A)

1. Workload registry has all 7 entries; router passes 20/20 canonical turns.
2. `fast_chat`, `grounded_chat`, `reasoning_on_workspace` end-to-end green.
3. TrustBundle emitted for all ground-requiring turns with stable hash.
4. Coverage scorer + hedging calibration + hallucination filter all active.
5. Downstream consumers (V10-ART-007, V10-AGT-001, V10-ONB-013) bind to TrustBundle hash successfully.
6. Reasoning telemetry contract extended with the 12 `reasoning.*` events.
7. CI invariant 43 (workload registry completeness) green.

## Rollout order

1. **Routing** (V10-RSN-001 → 002 → 003) — registry, classifier, scope.
2. **Planning + tools** (V10-RSN-004 → 005 → 006) — plan formulator, tool registry, retrieval.
3. **Execution** (V10-RSN-007) — loop + checkpoints.
4. **Grounding** (V10-RSN-008 → 009 → 010 → 011 → 012) — claims, citations, coverage, hedging, filter.
5. **TrustBundle** (V10-RSN-013 → 014) — schema + hash.
6. **Workload classes** (V10-RSN-015 → 016 → 017) — Wave A three.
7. **Presentation + telemetry** (V10-RSN-022 → 023) — UI + events.
8. **Edge cases** (V10-RSN-024) — degradation handlers.
9. **Wave B** — V10-RSN-018, 019, 020, 021, 025.

## Cross-refs to sibling dev plans

| Depends on | What's needed |
|---|---|
| `AGENT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | BudgetBudget, Run Ledger, CheckpointStore, interrupt verbs |
| `ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md` | ArtifactStore search, MutationProposal (artifact_build target) |
| `ENTERPRISE_INTEGRATIONS_DEVELOPMENT_PLAN_2026-04-18.md` | Federated retrieval + ACL propagation |
| `DEEP_RESEARCH_DEVELOPMENT_PLAN_2026-04-18.md` | deep_research delegation target |
| `FEEDBACK_SELF_LEARNING_DEVELOPMENT_PLAN_2026-04-18.md` | Veto / low-coverage feedback signals |
| `ONBOARDING_ACTIVATION_DEVELOPMENT_PLAN_2026-04-18.md` | Citation-validation fallback consumes coverage scorer |

Reasoning is the **spine** — together with Artifact Runtime, it forms the foundation every other block depends on.

## Flags to register at implementation time

25 flags (`ff.reasoning_*`). Key Wave A:

- `ff.reasoning_workload_registry` (V10-RSN-001) — **on-by-construction**
- `ff.reasoning_intent_classifier` (V10-RSN-002)
- `ff.reasoning_scope_resolver` (V10-RSN-003)
- `ff.reasoning_plan_formulator` (V10-RSN-004)
- `ff.reasoning_tool_registry` (V10-RSN-005)
- `ff.reasoning_retrieval` (V10-RSN-006)
- `ff.reasoning_execution_loop` (V10-RSN-007)
- `ff.reasoning_claim_extraction` (V10-RSN-008)
- `ff.reasoning_citation_binder` (V10-RSN-009)
- `ff.reasoning_coverage_scorer` (V10-RSN-010)
- `ff.reasoning_hedging_calibration` (V10-RSN-011)
- `ff.reasoning_hallucination_filter` (V10-RSN-012) — **on-by-construction**
- `ff.reasoning_trust_bundle` (V10-RSN-013) — **on-by-construction**
- `ff.reasoning_trust_bundle_hash` (V10-RSN-014) — **on-by-construction**
- `ff.reasoning_class_fast_chat` (V10-RSN-015)
- `ff.reasoning_class_grounded_chat` (V10-RSN-016)
- `ff.reasoning_class_workspace` (V10-RSN-017)
- `ff.reasoning_presentation_layer` (V10-RSN-022)
- `ff.reasoning_telemetry_full` (V10-RSN-023)
- `ff.reasoning_edge_case_matrix` (V10-RSN-024) — **on-by-construction**

Wave B: `ff.reasoning_class_decision_review`, `ff.reasoning_class_artifact_build`, `ff.reasoning_class_deep_research`, `ff.reasoning_class_background_agent`, `ff.reasoning_quality_dashboard`.

Safety flags on-by-construction: workload registry, hallucination filter, TrustBundle + hash, edge-case matrix.
