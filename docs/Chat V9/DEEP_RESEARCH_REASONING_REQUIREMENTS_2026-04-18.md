# Reasoning Requirements — Consultify Chat

> **Status:** source research input, captured 2026-04-18. Do not edit in place.
> **Scope:** answers the Reasoning / workload-router / trust-bundle deep research
> prompt (Prompt 2 of the first research batch). Complements the
> Artifact/Connectors/ROI/Onboarding research document dated 2026-04-18.
> **Next step:** this document will be turned into a numbered implementation plan
> (tickets + flags + tests + CI invariants) in a follow-up pass.

---

## Workload classes

The class system below is a product contract, not a mirror of any single vendor. The latency bands are set so that ordinary executive chat stays in conversational flow, while heavier work shows progress early and moves to long-running execution only when needed. That approach is now visible across public product surfaces: basic chat vs deeper reasoning vs deep research in Atlassian Rovo, fast vs Pro Search vs Deep Research in Perplexity, long-running/background research in OpenAI, tiered agents in Palantir, and Instant/Thinking/Agent/Agent Swarm plus 24/7 Claw in Kimi. Classical UX guidance still matters here: users tolerate about 1 second without losing flow, and anything above about 10 seconds needs explicit progress and interruption affordances.

| Workload class | Primary business use | TTFT target p50 / p95 | Total latency target p50 / p95 | Effective active context | Allowed tools | Allowed model tiers | Escalation rule | Default budget per call | User-visible badge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fast_chat` | Clarify, explain, rewrite, answer simple non-critical questions | 300ms / 800ms | 2.5s / 8s | 24k active, 48k hard cap | calculator, time, memory_read | fast default, mid fallback | Escalate if org-specific evidence is required, ambiguity score > 0.45, or current-facts detection = true | 12k tokens, estimated cost cap $0.03 | Quick Answer |
| `grounded_chat` | Factual answer with explicit sources | 450ms / 1000ms | 6s / 15s | 48k active, 96k hard cap | retrieval, source_fetch, web_search, calculator | fast or mid | Escalate if >8 evidence items needed, material source conflict, or answer requires synthesis across sources | 30k tokens, up to 5 searches, $0.10 | Grounded Answer |
| `reasoning_on_workspace` | Analyse attachments, workspace docs, board packs, operating data | 700ms / 1500ms | 15s / 45s | 120k active, 160k hard cap | retrieval, file_parse, structured_query, safe_code_exec, calculator, memory_read | mid default, frontier allowed | Escalate if confidence < 0.78, unresolved source conflict, or external evidence becomes necessary | 90k tokens, 1 sandbox run, $0.35 | Workspace Analysis |
| `decision_review` | CFO/CISO-grade option comparison, risk review, recommendation memo | 900ms / 1800ms | 20s / 60s | 160k active, 220k hard cap | retrieval, web_search, safe_code_exec, calculator, policy_lookup | frontier default, mid+frontier two-pass allowed | Escalate to `deep_research` if confidence < 0.85, action safety < 0.90, or breadth requires open-web research | 140k tokens, up to 10 searches, $0.75 | Decision Review |
| `artifact_build` | Draft memo, transformation plan, policy draft, budget model, workshop output | 800ms / 1600ms | 25s / 75s | 180k active, 240k hard cap | retrieval, safe_code_exec, doc_builder, table_builder, template_engine | mid or frontier | Escalate if evidence coverage < 0.90 or artifact requires fresh external research | 160k tokens, 1 artifact render, $0.90 | Draft Artifact |
| `deep_research` | Exhaustive workspace + web synthesis, defensible report | 1000ms / 2000ms for first status event | 240s / 720s in foreground, otherwise offload | 220k live active per step, state externalised | web_search, url_fetch, retrieval, file_parse, safe_code_exec, citation_graph | frontier research models, mid allowed only by policy exception | Auto-offload to `background_agent` if predicted completion > 90s or search breadth > 20 queries | 300k tokens, up to 25 searches, $4 foreground / $8 async | Deep Research |
| `background_agent` | Long-running autonomous research or execution prep with checkpoints | 250ms / 700ms acknowledgement; first progress event ≤ 2s p95 | 15m / 60m job completion | 250k live active per step, mandatory external state | Same as `deep_research` plus approved action connectors | frontier planner, mid executors, fast subagents allowed | Insert approval checkpoint before any write/high-impact action; abort at job cap | 1M total tokens, up to 100 tool calls, $10 default job cap | Background Job |

Illustrative vendor mapping for the three model tiers is straightforward from public documentation: OpenAI exposes GPT-5.4, GPT-5.4 mini, GPT-5.4 nano, GPT-5.4 pro, and dedicated deep-research models; Anthropic exposes Opus, Sonnet, and Haiku; Google exposes Pro, Flash, and Flash-Lite with controllable thinking; Perplexity separates Sonar, Sonar Pro/Pro Search, and Sonar Deep Research; Kimi separates Instant, Thinking, Agent, and Agent Swarm.

---

## Reasoning pipeline steps

Public systems are converging on the same control surfaces: explicit reasoning effort or summaries in OpenAI, summarised or omitted thinking and progress updates in Anthropic, thinking levels in Google, and routing metadata plus streaming reasoning steps in Perplexity. Consultify should implement these as contracted steps rather than ad hoc orchestration.

Pipeline (prose form):

1. **User turn received.**
2. **Intent + criticality classification** — primary + secondary intent, criticality level.
3. **Scope resolution** — allowed sources, precedence order, model-prior permission.
4. **Route workload class** — one of the seven classes above.
5. **Branch:**
   - **Simple path:** single-pass execution → grounding + citations → self-check gate → if pass, present in response class; else clarify, escalate, or fail gracefully.
   - **Complex path:** plan formulation → reasoning execution → grounding + citations → self-check gate → if pass, present in response class; else clarify, escalate, or fail gracefully.

### Per-step contract

| Step | Required output | Cheap path when TTFT matters | Tightened path for CFO/CISO-grade acceptance |
| --- | --- | --- | --- |
| **Intent classification** | Classify one primary intent and one secondary intent from: `clarify`, `ask_knowledge`, `locate_evidence`, `summarise_material`, `analyse_workspace`, `compare_decisions`, `evaluate_risk`, `propose_action`, `create_artifact`, `run_research`, `take_action`, `audit_answer`. Also assign criticality = `low / medium / high / critical`. | Keep classifier fast; default to more conservative class on ambiguity. | Critical recall ≥ 0.98 on finance/security/compliance prompts; uncertain = escalate. |
| **Scope resolution** | Resolve allowed knowledge scopes: attachments, workspace, org_memory, system_record, approved_web, model_prior. Persist precedence order and whether model_prior is allowed. | Allow model_prior only for generic, non-current, non-org-specific questions. | Disallow model_prior as primary support for org-specific or time-sensitive answers. Force source-of-record resolution before generation. |
| **Plan formulation** | Select `plan_depth = 0 / 1 / 2`. Depth 0 = single pass; depth 1 = ordered micro-plan; depth 2 = explicit multi-step plan with checkpoints. | plan_depth 0 for clear bounded asks. | plan_depth 2 mandatory for `decision_review`, `deep_research`, `background_agent`. |
| **Reasoning execution** | Select one pattern: `single_shot`, `cot_internal`, `self_consistency`, `tree_search`, `expert_panel`, `reflection`. | `single_shot` or `cot_internal` for clear, bounded asks. | `self_consistency` for numerical or classification outputs with one correct answer; `tree_search` for scenario branching or option architecture; `expert_panel` only for board-level trade-offs and only as P2/v2 due compute overhead; `reflection` mandatory before emission for all non-trivial critical answers. |
| **Grounding + citation** | Produce claim-to-evidence mapping at sentence or clause level. Classify support strength as `direct / derived / contextual`. | End-of-answer citation block acceptable for `fast_chat`/`grounded_chat` low-stakes turns. | Sentence-level claim map required for `decision_review`, `artifact_build`, `deep_research`; unsupported claim count = 0. |
| **Self-check** | Run deterministic and model-based checks: completeness, contradiction, unsupported claims, citation coverage, policy/approval requirements, confidence calibration. | For `fast_chat`, only run schema and safety checks. | For critical turns, fail closed on missing evidence, unresolved conflict, or low confidence. |
| **Presentation** | Map output to one `response_class`: `general`, `grounded`, `decision_memo`, `proposal`, `action_request`, `artifact`, `research_report`, `clarification_required`, `insufficient_evidence`, `partial`. | `general` or `grounded` for fast/simple work. | `decision_memo`, `proposal`, `research_report`, `clarification_required`, or `insufficient_evidence` for critical work; never respond with plain `general` for board-grade recommendations. |

The reasoning-pattern selection above should be explicit because the underlying literature is explicit: chain-of-thought improves complex reasoning, self-consistency improves answer stability where multiple reasoning paths can converge on one answer, tree-of-thought helps search over branches, reflection improves tool-using agents, and multi-agent debate can improve factuality and reasoning on some tasks but is expensive enough that it should be reserved for high-value cases rather than made default.

Raw chain-of-thought should remain internal. The user-facing surface should expose a concise reasoning summary, route rationale, evidence, confidence, and limitations. That aligns much better with public production patterns than exposing raw hidden reasoning: OpenAI makes reasoning summaries opt-in, while Anthropic summarises or omits thinking and instead supports user-facing progress updates in agentic traces.

---

## Trust bundle schema

The trust surface must justify **why this answer, from which evidence, at what confidence, at what cost, and with which controls**. That is consistent with public patterns from OpenAI reasoning summaries and trace data, Anthropic summarised thinking and telemetry, Perplexity response metadata and citations, Palantir provenance and audit logging, and Atlassian Rovo source-linked answers.

```ts
type WorkloadClass =
  | "fast_chat"
  | "grounded_chat"
  | "reasoning_on_workspace"
  | "decision_review"
  | "artifact_build"
  | "deep_research"
  | "background_agent";

type ResponseClass =
  | "general"
  | "grounded"
  | "decision_memo"
  | "proposal"
  | "action_request"
  | "artifact"
  | "research_report"
  | "clarification_required"
  | "insufficient_evidence"
  | "partial";

type IntentClass =
  | "clarify"
  | "ask_knowledge"
  | "locate_evidence"
  | "summarise_material"
  | "analyse_workspace"
  | "compare_decisions"
  | "evaluate_risk"
  | "propose_action"
  | "create_artifact"
  | "run_research"
  | "take_action"
  | "audit_answer";

type Criticality = "low" | "medium" | "high" | "critical";
type ModelTier = "fast" | "mid" | "frontier";
type ReasoningMode =
  | "single_shot"
  | "cot_internal"
  | "self_consistency"
  | "tree_search"
  | "expert_panel"
  | "reflection";

type ScopeSource =
  | "attachments"
  | "workspace"
  | "system_record"
  | "org_memory"
  | "approved_web"
  | "model_prior"
  | "tool_output";

type SupportStrength = "direct" | "derived" | "contextual";
type ConfidenceBand = "low" | "medium" | "high" | "withheld";
type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
type MemoryMode = "enabled" | "disabled_private_mode" | "disabled_policy";
type GroundingState = "grounded" | "partially_grounded" | "ungrounded";
type GateStatus = "passed" | "failed" | "bypassed_by_policy";
type FailureMode =
  | "none"
  | "insufficient_evidence"
  | "source_conflict"
  | "model_timeout"
  | "tool_failure"
  | "permission_denied"
  | "interrupted"
  | "policy_block";

type TrustBundle = {
  version: "1.0";
  message_id: string;
  conversation_id: string;
  trace_id: string;
  parent_trace_id?: string;
  created_at: string; // ISO-8601

  workload_class: WorkloadClass;
  response_class: ResponseClass;
  primary_intent: IntentClass;
  secondary_intent?: IntentClass;
  criticality: Criticality;

  badge: {
    label: string;
    grounding: GroundingState;
    confidence_band: ConfidenceBand;
    in_progress: boolean;
  };

  routing: {
    selected_model_tier: ModelTier;
    selected_model_family: string;
    selected_model_id: string;
    reasoning_mode: ReasoningMode;
    reasoning_effort: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
    escalated_from?: WorkloadClass;
    escalation_reasons: string[];
    plan_depth: 0 | 1 | 2;
  };

  scope: {
    allowed_sources: ScopeSource[];
    used_sources: ScopeSource[];
    source_precedence: ScopeSource[];
    model_prior_allowed: boolean;
    memory_mode: MemoryMode;
    memory_items_read: number;
    private_mode: boolean;
  };

  evidence: {
    citation_required: boolean;
    citation_coverage_ratio: number; // 0..1
    unsupported_claim_count: number;
    claim_map: Array<{
      claim_id: string;
      sentence_index: number;
      support_ids: string[];
      support_strength: SupportStrength;
    }>;
    sources: Array<{
      source_id: string;
      source_type: ScopeSource;
      title: string;
      locator: string; // file id, URL, object id, chunk id
      freshness_at_use?: string; // ISO-8601
      canonicality: "canonical" | "non_canonical" | "unknown";
    }>;
    conflicts: Array<{
      field: string;
      source_ids: string[];
      severity: "minor" | "material";
      resolution: "workspace_wins" | "web_wins" | "unresolved";
    }>;
  };

  confidence: {
    overall: number; // 0..1
    band: ConfidenceBand;
    factuality: number; // 0..1
    completeness: number; // 0..1
    recommendation_strength: number; // 0..1
    action_safety: number; // 0..1
    reasons: string[];
  };

  quality_gate: {
    status: GateStatus;
    checks_run: string[];
    failed_checks: string[];
    judge_version?: string;
    blocked_emission: boolean;
  };

  execution: {
    ttft_ms: number;
    total_latency_ms: number;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens?: number;
    tool_calls: Array<{
      tool_name: string;
      calls: number;
      success_count: number;
      failure_count: number;
      latency_ms: number;
    }>;
    estimated_cost_usd: number;
    actual_cost_usd?: number;
  };

  approvals: {
    required: boolean;
    reasons: string[];
    status: ApprovalStatus;
    checkpoint_ids: string[];
  };

  limitations: string[];
  failure_mode: FailureMode;

  operator_only: {
    prompt_stack_hash: string;
    policy_stack_ids: string[];
    retrieval_snapshot_id?: string;
    trace_export_id?: string;
    correlation_id: string;
    tenant_id: string;
    raw_event_count: number;
    pii_handling: "masked" | "restricted";
  };
};
```

Progressive disclosure should be strict. The **badge** shows only class, grounding state, and confidence band. The **panel** shows route, evidence summary, cost band, tools used, limitations, and approval status. The **full trace** is operator-only.

The operator support view must add what an auditor actually needs to answer the classic questions of accountability: who triggered the action, what the system did, when it did it, where it acted, which sources it used, which guards fired, which approvals were required, and which exact model/tool route produced the answer.

### Mandatory telemetry event families

- `reasoning.request_received`
- `reasoning.intent_classified`
- `reasoning.scope_resolved`
- `reasoning.route_selected`
- `reasoning.route_escalated`
- `reasoning.plan_created`
- `reasoning.execution_started`
- `reasoning.tool_called`
- `reasoning.evidence_attached`
- `reasoning.conflict_detected`
- `reasoning.quality_gate_passed`
- `reasoning.quality_gate_failed`
- `reasoning.approval_requested`
- `reasoning.approval_resolved`
- `reasoning.stream_started`
- `reasoning.partial_emitted`
- `reasoning.completed`
- `reasoning.cancelled`
- `reasoning.failed`

---

## Edge-case matrix

| Situation | Requirement | UI / UX handling | SLA | Telemetry |
| --- | --- | --- | --- | --- |
| No sources found for an org-memory or workspace-specific question | Never answer from model prior as if it were org truth | Render `insufficient_evidence` with plain language: "I can't substantiate this from your workspace/org sources." Offer buttons: search approved web, upload source, ask a narrower question | Detect before final answer emission; render within 2s p95 from retrieval completion | `reasoning.insufficient_evidence` |
| Workspace data conflicts with web data | Apply source-of-record rule, do not silently merge | Show a conflict banner in the trust panel and a short inline note in the answer. For material conflict on a critical turn, output options and unresolved conflict, not a single definitive recommendation | 100% of material conflicts flagged before final token | `reasoning.conflict_detected` |
| Model timeout or long dependency stall mid-stream | Emit labelled partial output, not silent truncation | Convert response to `partial`, keep completed sections, add "missing due to timeout", and expose retry / continue in background | Partial state emitted within 2s p95 of timeout detection | `reasoning.partial_emitted`, `reasoning.failed` |
| User changes topic while reasoning is running | Interrupt cleanly and suppress stale tokens | Cancel the prior run, mark it cancelled in operator trace, and immediately route the new turn. Never allow the old response to continue streaming into the UI | Cancellation acknowledgement within 500ms p95; stale token leakage = 0 | `reasoning.cancelled`, `reasoning.request_received` |
| Co-thinker persona conflicts with base governance or evidence policy | Governance prompt always wins | Persona effects are limited to tone, structure, and question framing. If blocked, show nothing user-visible unless the answer itself is affected; record block in operator view | Precedence evaluation on 100% of requests before first model token | `reasoning.persona_blocked` |
| Low-confidence answer on a critical question | Clarify or downgrade, never bluff | If `overall_confidence < 0.75`, `action_safety < 0.90`, or `citation_coverage_ratio < 0.90`, render `clarification_required` or `insufficient_evidence`, not a definitive answer | 100% compliance on critical eval set | `reasoning.clarification_required` |
| Connector permission denied / source inaccessible | Be explicit that access is missing | Tell the user which source class was unavailable, exclude it from evidence coverage, and do not imply the source was checked successfully | Surface within 1s p95 of connector failure | `reasoning.permission_denied` |
| Citation target missing or broken at render time | Never render dead evidence as valid support | Replace the citation chip with "evidence unavailable", preserve the answer only if still above coverage threshold; otherwise downgrade to `partial` or `insufficient_evidence` | Dead citation render rate < 0.1% over rolling 30 days | `reasoning.citation_render_failed` |

---

## Numbered requirements

**R-REASON-1 — Workload router contract**
Type: **P0**
Acceptance criteria: Route classification, model-tier selection, and tool-allowance resolution complete within 75ms p95 server-side; route record persisted before first visible token/status event; route result appended to the trust bundle on 100% of non-trivial turns.
Test strategy: 10k-turn replay benchmark; latency instrumentation; trace audit across sampled production traffic.
Risk if not implemented: One-model-for-all behaviour causes avoidable latency, cost blowouts, and inconsistent answer quality.

**R-REASON-2 — Class SLO enforcement**
Type: **P0**
Acceptance criteria: Each workload class meets the latency targets in the workload table on a rolling 30-day window; breaches generate an alert within 5 minutes; SLO dashboard slices by tenant, class, model tier, and tool mix.
Test strategy: Synthetic load test, canary traffic, and production SLI monitoring.
Risk if not implemented: CEO-grade users experience chat as sluggish; deeper classes silently become unusable in production.

**R-REASON-3 — Escalation controller**
Type: **P0**
Acceptance criteria: Router escalates when confidence, source breadth, or conflict thresholds are violated; no silent de-escalation after evidence need is detected; escalation reason stored as structured enum array.
Test strategy: Route-fixture suite covering 500+ labelled prompts with expected route transitions.
Risk if not implemented: Critical questions receive shallow treatment while trivial questions over-consume premium compute.

**R-REASON-4 — Budget estimator and hard caps**
Type: **P0**
Acceptance criteria: Pre-run token-and-cost estimate lands within ±20% on p95; runtime abort or checkpoint triggers at 110% of class budget unless background approval exists; trust bundle shows estimated and actual cost for all non-trivial messages.
Test strategy: Offline replay versus billable usage; chaos tests around tool-call explosions.
Risk if not implemented: CFO-facing product becomes economically non-defensible.

**R-REASON-5 — Intent taxonomy classifier**
Type: **P0**
Acceptance criteria: Every turn receives exactly one primary and at most one secondary intent from the approved enum; macro-F1 on labelled eval set ≥ 0.92; uncertain classifications default to the safer, more rigorous class.
Test strategy: Labelled enterprise-consulting prompt set; weekly drift re-evaluation.
Risk if not implemented: Good orchestration becomes impossible because the system does not understand the business ask.

**R-REASON-6 — Criticality classifier**
Type: **P0**
Acceptance criteria: `critical` recall ≥ 0.98 on finance, security, compliance, irreversible action, and board-recommendation prompts; false negatives < 1% on red-team critical set; criticality stored in trust bundle and operator trace.
Test strategy: Curated CFO/CISO eval pack; adversarial prompt set.
Risk if not implemented: High-stakes answers bypass the controls they most need.

**R-REASON-7 — Scope resolver and precedence policy**
Type: **P0**
Acceptance criteria: Resolver outputs allowed scopes, used scopes, source precedence, and whether model prior is allowed; explicit attachment > workspace canonical > system record > org memory > approved web > model prior; `private_mode=true` disables memory injection on 100% of turns.
Test strategy: Unit tests on precedence matrix; regression tests with private mode on/off.
Risk if not implemented: Hallucinations and audit disputes become routine.

**R-REASON-8 — Plan-depth selector**
Type: **P1**
Acceptance criteria: `plan_depth=0|1|2` selected explicitly for every non-trivial turn; depth 2 mandatory for `decision_review`, `deep_research`, and `background_agent`; plan stored in trace before first tool call.
Test strategy: Replay tests on route/plan combinations; span inspection in traces.
Risk if not implemented: Complex tasks collapse into improvised one-pass answers.

**R-REASON-9 — Reasoning-pattern selector**
Type: **P1**
Acceptance criteria: Engine selects one of `single_shot`, `cot_internal`, `self_consistency`, `tree_search`, `expert_panel`, `reflection`; self-consistency runs at least 3 candidates when selected; expert-panel mode is disabled by default and flagged P2/v2 until ROI is proven.
Test strategy: Prompt-pattern routing eval; cost/performance A/B tests by task family.
Risk if not implemented: The product either over-thinks everything or uses the wrong reasoning shape for the task.

**R-REASON-10 — Response-class contract**
Type: **P0**
Acceptance criteria: Every emitted answer belongs to exactly one approved `response_class`; each class maps to a fixed rendering template; `action_request` cannot expose executable parameters or approval CTA until approval prerequisites are satisfied.
Test strategy: UI contract tests and snapshot tests per class.
Risk if not implemented: Users cannot tell whether they are reading a casual answer, a defended recommendation, or an actionable instruction.

**R-REASON-11 — Citation coverage contract**
Type: **P0**
Acceptance criteria: `grounded_chat`, `reasoning_on_workspace`, `decision_review`, `artifact_build`, and `deep_research` require `citation_coverage_ratio >= 0.90`; unsupported factual claim count = 0 for all critical turns; citations map to sentence or clause level, not end-of-answer dumps.
Test strategy: Claim extraction grader plus retrieval verifier on a held-out corpus.
Risk if not implemented: "Citations" become decorative rather than evidentiary.

**R-REASON-12 — Unsupported-claim and conflict blocker**
Type: **P0**
Acceptance criteria: Any material unsupported claim or unresolved material source conflict blocks definitive answer emission for critical turns; answer must downgrade to `clarification_required`, `insufficient_evidence`, or options-with-assumptions mode.
Test strategy: Synthetic adversarial prompts with missing or contradictory evidence.
Risk if not implemented: The product manufactures certainty exactly where it should not.

**R-REASON-13 — Confidence model**
Type: **P0**
Acceptance criteria: Confidence scores emitted for `overall`, `factuality`, `completeness`, `recommendation_strength`, and `action_safety`; confidence bands derive from fixed thresholds (high >= 0.85, medium 0.70–0.84, low < 0.70); calibration error within ±0.10 on validation buckets.
Test strategy: Reliability diagrams and threshold validation against rated human judgements.
Risk if not implemented: Any visible confidence number is meaningless and erodes trust.

**R-REASON-14 — Self-check gate**
Type: **P0**
Acceptance criteria: All non-trivial P0/P1 turns run deterministic checks plus a judge/verifier pass before final emission; critical turns fail closed on missing evidence, contradiction, or blocked approvals; gate result written to trust bundle and trace.
Test strategy: Gate-failure simulations; judge agreement analysis; regression suite.
Risk if not implemented: Errors that are cheap to catch become expensive to defend.

**R-REASON-15 — Mandatory clarification for critical low confidence**
Type: **P0**
Acceptance criteria: If a critical turn falls below confidence or coverage thresholds, the system asks at most 3 targeted clarification questions instead of answering definitively; clarification TTFT < 1s p95; if the user declines, answer must remain assumption-bounded.
Test strategy: Red-team prompts that omit key variables; UI-flow tests.
Risk if not implemented: CFO/CISO users are forced to spot missing assumptions themselves.

**R-REASON-16 — Trust bundle generation**
Type: **P0**
Acceptance criteria: 100% of non-trivial messages generate a valid trust bundle conforming to the schema; final bundle available within 100ms p95 after answer completion; schema validation failures < 0.1% over 30 days.
Test strategy: Runtime schema enforcement; backfill scan across production samples.
Risk if not implemented: There is no machine-readable accountability layer.

**R-REASON-17 — Progressive disclosure UX**
Type: **P0**
Acceptance criteria: All non-trivial answers display a badge with class, grounding, and confidence band; trust panel opens in ≤300ms p95; main answer stream remains readable without requiring the panel.
Test strategy: UI latency tests; usability sessions with executives and operators.
Risk if not implemented: Either the answer becomes cluttered or the trust story disappears.

**R-REASON-18 — Operator and auditor view**
Type: **P0**
Acceptance criteria: Support surface includes trace id, prompt-stack hash, route decisions, model ids, tool spans, source ids, confidence, approval history, and failure mode; export to JSON/CSV available in ≤2 clicks; role-based masking enforced for sensitive fields.
Test strategy: Operator workflow test; access-control review; export verification.
Risk if not implemented: Support, audit, and compliance teams cannot reconstruct what happened.

**R-REASON-19 — Telemetry taxonomy**
Type: **P0**
Acceptance criteria: Mandatory telemetry events emitted with conversation id, trace id, correlation id, tenant id, and sequence number; event loss < 0.1%; event schema versioned and backward compatible for one minor version.
Test strategy: Event-contract tests; drop-rate monitoring; replay validation.
Risk if not implemented: You cannot manage quality, cost, or failures systematically.

**R-REASON-20 — Tool governance and approval checkpoints**
Type: **P0**
Acceptance criteria: Tool allowlists are class-specific and policy-controlled; write/high-impact actions require explicit approval checkpoints; no end-user can attach arbitrary unvetted skills or connectors to production runs.
Test strategy: Permission boundary tests; approval-gate bypass attempts; red-team connector abuse.
Risk if not implemented: Prompt injection and accidental actioning become enterprise-grade incidents.

**R-REASON-21 — Context compaction and state externalisation**
Type: **P1**
Acceptance criteria: Context compaction triggers automatically at 70% of active window; long-running jobs must externalise state and provenance between steps; no foreground turn exceeds its hard context cap without compaction or background offload.
Test strategy: Long-conversation soak tests; state-continuity regression tests.
Risk if not implemented: Long sessions decay in quality, latency, and cost simultaneously.

**R-REASON-22 — Memory transparency and private mode**
Type: **P1**
Acceptance criteria: Trust bundle exposes memory mode and memory items read; private mode prevents both memory read and write on 100% of turns; memory writes require tenant policy allow + user eligibility.
Test strategy: Policy toggling tests; privacy audit; trace inspections.
Risk if not implemented: Users cannot know when prior memory shaped an answer.

**R-REASON-23 — Partial answer and interrupt handling**
Type: **P0**
Acceptance criteria: On timeout/tool failure, emit `partial` with completed sections, missing sections, and retry id within 2s p95 of failure detection; new user turns cancel old runs within 500ms p95; stale token leakage = 0.
Test strategy: Chaos testing for network/model/tool failures; cancellation race-condition tests.
Risk if not implemented: The chat feels unreliable and unsafe under pressure.

**R-REASON-24 — Background job contract**
Type: **P1**
Acceptance criteria: Background jobs acknowledge in ≤700ms p95, show first progress event in ≤2s p95, emit heartbeat at least every 30 seconds, and support resume/cancel semantics; default hard cap = 60 minutes or $10, whichever comes first, unless tenant policy overrides.
Test strategy: Background-job lifecycle tests, resume-after-drop tests, cancellation tests.
Risk if not implemented: Long-running work becomes operationally fragile and opaque.

**R-REASON-25 — Prompt precedence and persona isolation**
Type: **P0**
Acceptance criteria: Prompt-precedence order is deterministic, logged, and versioned; persona layers may modify tone/structure only and may not override governance, approvals, evidence policy, or source precedence; blocked persona instructions are counted and logged.
Test strategy: Prompt-stack unit tests; collision regression set; red-team persona override attempts.
Risk if not implemented: Co-thinker behaviour becomes non-deterministic and can undermine governance.

---

## Benchmark matrix

The matrix below compares Consultify's target requirements with public product patterns. It is not a scorecard of "best vendor"; it is a calibration aid for gaps that now have visible, productised equivalents in the market.

| Our requirement area | OpenAI | Anthropic | Perplexity | KIMI | Palantir |
| --- | --- | --- | --- | --- | --- |
| Tiered workload ladder | GPT-5.4, mini, nano, pro, plus dedicated deep-research models create a clear speed/intelligence ladder. | Opus, Sonnet, and Haiku are documented with capability and latency trade-offs. | Sonar, Sonar Pro/Pro Search, and Sonar Deep Research split quick search from multi-step search and exhaustive research. | Instant, Thinking, Agent, and Agent Swarm are distinct modes, with Claw covering always-on agents. | AIP explicitly documents Tier 1 ad-hoc analysis through Tier 4 automated agents. |
| Reasoning-effort control | GPT-5.4 supports `reasoning.effort` from none to xhigh; summaries are opt-in. | Claude uses adaptive/extended thinking, with formal effort calibration and token budgets. | Sonar Deep Research exposes `reasoning_effort = low / medium / high`. | Thinking / Agent / Agent Swarm act as escalating reasoning effort tiers. | Tiered agents provide the analogue: manual → automated, with human oversight expected at higher tiers. |
| Async and long-running work | Deep research may take tens of minutes; background mode and resumable streaming are first-class. | Routines run on managed cloud infrastructure; long agentic traces expose progress updates. | Sonar Deep Research has an async API with 7-day TTL. | Kimi Claw offers cloud deployment, 24/7 uptime, and Agent Swarm parallelism. | Tier 4 automated agents are explicitly the autonomous/automated tier. |
| Source attribution and citations | Reasoning summaries and standard traces exist, but Consultify must add sentence-grade evidence mapping itself. | Thinking can be summarised or omitted; public docs emphasise user-facing progress rather than raw reasoning exposure. | API responses include citations, search results, search metadata, and cost metadata. | Agent Swarm publicly showcases long-form outputs with formatted citations and references. | Provenance view shows each step and verifies grounding in actual data. |
| Traceability and audit | Tracing captures generations, tools, handoffs, guardrails, and custom events; trace grading adds structured labels. | OTel monitoring exports metrics, logs/events, and optional traces. | Classification decisions and cost/search metadata are exposed in response metadata. | Public docs emphasise outputs and modes more than detailed enterprise audit traces. | Audit logs answer who/what/when/where, and provenance explains how the agent reached conclusions. |
| Tool governance and approval discipline | Skills are treated as privileged code/instructions and should not be arbitrarily user-selectable; sensitive actions require approval. | Enterprise Skills docs explicitly focus on governance, security review, and vetting at scale. | Pro Search tools are system-managed and not user-registered, reducing arbitrary tool sprawl. | Kimi Claw exposes a large skill ecosystem, which reinforces the need for an internal allowlist rather than open end-user attachment. | Palantir stresses human oversight workflows and approval processes for critical decisions. |
| Context and state management | OpenAI provides compaction to preserve state while reducing context size. | Anthropic publicly discusses context engineering and long-run context efficiency. | Search context size, reasoning tokens, and query counts are surfaced in billing/usage, but compaction is not the public pattern. | Kimi frames the answer in terms of multi-agent decomposition and parallel execution rather than explicit compaction. | Provenance + ontology context provide structured state, but public docs focus more on grounded execution than compaction mechanics. |
| Parallel and multi-agent execution | Public docs emphasise agents, tools, tracing, and specialist collaboration, but not large public subagent swarms as a primary product metaphor. | Advisor tool pairs a fast executor with a stronger advisor mid-generation; subagents and routines exist in public docs. | Public pattern is classifier + tool orchestration rather than explicit multi-agent teams. | Agent Swarm is the clearest public reference: up to 100 sub-agents, 1,500 tool calls, and 4.5× faster than sequential execution. | Public tiering goes from ad-hoc through automated agents, not explicit swarm orchestration. |

---

## Top 3 things to do in the first 14 days

1. **Implement the router, criticality classifier, and class SLOs first.**
   Do not start with "better prompts". Start with the control plane that decides what class of work this is, how much reasoning it deserves, which tools are allowed, and when to escalate. The strongest public products now separate quick/simple work from deeper reasoning and from long-running research, rather than pretending one mode can satisfy every need.

2. **Implement the trust bundle and progressive disclosure second.**
   Your commercial promise is not "a smart chat"; it is "an execution system with visible accountability". Ship the badge, trust panel, operator trace, and cost/confidence/evidence schema before you optimise prose style. Public systems already expose summaries, source links, metadata, provenance, and traceability; Consultify needs a stricter, more structured version of that for board-grade work.

3. **Implement fail-closed behaviour for critical unknowns third.**
   If a CFO/CISO-level answer is missing evidence, in conflict, or low confidence, the system must clarify, downgrade, or stop. That is the main line between "useful demo" and "defensible enterprise system". Human oversight, approval checkpoints, tool governance, and explicit source-of-record rules belong in the first wave, not in v2.

---

## Requirements inventory (flat list)

Use this as the ticket seed when we turn this document into a plan.

| ID | Priority | One-liner |
| --- | --- | --- |
| R-REASON-1 | P0 | Workload router contract (p95 ≤ 75ms, route persisted, bundled) |
| R-REASON-2 | P0 | Class SLO enforcement with alerts + tenant/class/tier dashboards |
| R-REASON-3 | P0 | Escalation controller (no silent de-escalation, structured reasons) |
| R-REASON-4 | P0 | Budget estimator + hard caps (±20% p95, abort at 110%) |
| R-REASON-5 | P0 | Intent taxonomy classifier (macro-F1 ≥ 0.92, 12-class enum) |
| R-REASON-6 | P0 | Criticality classifier (critical recall ≥ 0.98 on CFO/CISO set) |
| R-REASON-7 | P0 | Scope resolver + precedence (attachment > workspace > … > prior) |
| R-REASON-8 | P1 | Plan-depth selector (depth 2 mandatory for critical classes) |
| R-REASON-9 | P1 | Reasoning-pattern selector (single_shot ↔ reflection; expert_panel V2) |
| R-REASON-10 | P0 | Response-class contract (10 classes, fixed templates) |
| R-REASON-11 | P0 | Citation coverage ≥ 0.90, sentence-level claim map |
| R-REASON-12 | P0 | Unsupported-claim + conflict blocker (fail closed on critical) |
| R-REASON-13 | P0 | Confidence model (5 scores, calibrated bands) |
| R-REASON-14 | P0 | Self-check gate (deterministic + judge, trust-bundle audit) |
| R-REASON-15 | P0 | Mandatory clarification for critical low-confidence |
| R-REASON-16 | P0 | Trust bundle generation (schema v1.0, 100% coverage, ≤100ms p95) |
| R-REASON-17 | P0 | Progressive disclosure UX (badge / panel / trace) |
| R-REASON-18 | P0 | Operator + auditor view (export, RBAC masking) |
| R-REASON-19 | P0 | Telemetry taxonomy (19 mandatory events, versioned schema) |
| R-REASON-20 | P0 | Tool governance + approval checkpoints (class-scoped allowlists) |
| R-REASON-21 | P1 | Context compaction @ 70% + state externalisation |
| R-REASON-22 | P1 | Memory transparency + private_mode (100% turn coverage) |
| R-REASON-23 | P0 | Partial-answer + interrupt handling (2s p95, 500ms cancel) |
| R-REASON-24 | P1 | Background job contract (ack/heartbeat/resume, default $10/60m cap) |
| R-REASON-25 | P0 | Prompt precedence + persona isolation (governance wins) |

**Totals:** 25 requirements — 19 × P0, 6 × P1, 0 × P2 (expert_panel is P2 *within* R-REASON-9 rather than a separate row).

---

## What this document is NOT

- Not a ticket backlog (the next pass converts `R-REASON-*` into tickets, flags, tests, CI invariants).
- Not a model-vendor recommendation (model tiers are contractual roles; vendor mapping is illustrative).
- Not a prompt-engineering guide (this layer is orchestration + control plane, not copy tuning).
- Not a replacement for the Trust/Voice/Admin/Navigation/Input plans already in `Chat V9/` — it is the reasoning spine they all assume.

## Next step

Turn this document into the Reasoning / Router implementation plan alongside Artifact / Connectors / ROI / Onboarding:
1. Assign each `R-REASON-*` a ticket ID and block (likely new block `reasoning` in `ChatV9Block` union, or a dedicated `ChatV10Block`).
2. Register feature flags per requirement (`ff.reasoning_router`, `ff.reasoning_trust_bundle`, `ff.reasoning_critical_fail_closed`, etc.).
3. Draft `REASONING_ROUTER_DEVELOPMENT_PLAN_2026-04-18.md` with per-ticket acceptance + test strategy.
4. Extend `CHAT_V9_TELEMETRY_CONTRACT` with the 19 mandatory `reasoning.*` event families + trust-bundle schema v1.0.
5. Add CI invariants in `chatV9FeatureFlags.test.ts`:
   - every `R-REASON-*` → flag in registry,
   - every `reasoning.*` event → section in telemetry contract,
   - every `WorkloadClass` / `ResponseClass` / `IntentClass` enum value used in code matches the TypeScript union in the trust bundle schema.
