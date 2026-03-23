# WP-W2-AI-03 — Prompt OS Runtime Discipline Analysis

> Status: Completed
> Packet: WP-W2-AI-03
> Wave: 2 — AI runtime hardening
> Priority: P1
> Date: 2026-03-23
> Canonical inputs read:
> - `PROMPT_OPERATING_SYSTEM_V8_SSOT.md`
> - `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md`
> - `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md`
> - `PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md`
> - `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md`
> Supporting anchors:
> - `WP-W1-TRUST-01_TRUST_AUDIT_OBSERVABILITY_BASELINE.md` (trust vocabulary, provenance ledger, support trace, observability baseline)
> - `WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md` (ContextSnapshot, identity chain, drift model)
> - `DECISION_LOG_WAVE_1.md` — Decisions 23, 25, 26

---

## 1. Prompt composition model

### 1.1 Canonical composition layers

`PROMPT_OPERATING_SYSTEM_V8_SSOT.md` §8 defines eight ordered layers that compose the final prompt:

1. Governance and safety constraints
2. Canonical base prompt
3. Runtime presets and parameters
4. Context and memory layers
5. Mode and persona modifiers
6. Retrieval and evidence layers
7. Adaptive and learned modifiers
8. Final user message and history

`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §4 refines the assembly inputs:

1. Base prompt template (from registry)
2. Selected prompt blocks
3. Org-level learned instructions
4. Language policy
5. Runtime context sections
6. Mode and evidence modifiers

### 1.2 Composition ownership

The canonical owners are (`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §5):

| Component | Owner |
|---|---|
| Registry and versions | Prompt registry routes |
| Prompt assembly | `promptAssembler` |
| Runtime context injection | Pipeline and context builders |
| Model execution path | Model router and runtime pipeline |

### 1.3 Block doctrine

Blocks are reusable modifiers organized into canonical families: role, behavior, output, constraint, context, task (`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §6).

Canonical rule: `blocks are composable modifiers, not shadow base prompts`. A block must never silently replace the base identity.

### 1.4 Composition discipline assessment

The composition model is well-defined in doctrine but requires runtime enforcement of two properties:

1. **Layer precedence stability.** The eight-layer order from §8 of the SSOT must be enforced by the assembler as a hard contract, not as a guideline. If any surface injects content outside the defined order, the trace record must flag it as a composition violation.
2. **Language policy singularity.** `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §7 requires language policy to be resolved once. Multiple layers must not reassert language independently. The assembler must resolve language before block injection and reject conflicting language directives from downstream layers.

### 1.5 Relationship to ContextSnapshot

Per WP-W1-AI-01, every important AI interaction captures a `ContextSnapshot`. The prompt composition runtime must consume the snapshot's `effective_scope_ref`, `resolved_role_ref`, `consumer_class`, and `privacy_mode` fields to select the correct blocks, presets, and memory profile. The composition is not self-contained — it depends on the identity chain established by the context baseline.

---

## 2. Release bundle model

### 2.1 Bundle contents

`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §8 defines the release bundle as the atomic change unit:

| Field | Description |
|---|---|
| `prompt_key` | Which prompt template is affected |
| `prompt_version` | Specific version being activated |
| `primary_model` | Model selected for this prompt |
| `fallback_model` | Fallback model if primary is unavailable |
| `policy_version` | Governance policy version in effect |
| `evaluation_state` | Whether eval gates have been passed |
| `target_environment` | Where the bundle activates (canary, staging, production) |

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 extends the bundle with operational metadata:

| Field | Description |
|---|---|
| `release_bundle_id` | Unique identifier |
| `change_scope` | What changed (prompt, model, policy, routing) |
| `eval_scorecard_ref` | Link to the evaluation scorecard |
| `canary_policy_ref` | Link to the canary rollout policy |
| `rollback_plan_ref` | Link to the rollback plan |
| `affected_orgs_count` | How many tenants are affected |
| `affected_purposes[]` | Which AI purposes are affected |
| `status` | Current lifecycle state |
| `promoted_at` | When promoted to production |
| `rolled_back_at` | When rolled back (if applicable) |

### 2.2 Atomicity rule

Canonical rule from `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §8: `prompt, model, fallback and policy should activate together`.

This means a prompt change must never ship without its corresponding model mapping, fallback chain, and policy version. Partial activation — e.g., updating a prompt version while leaving the model mapping unchanged from a previous bundle — is a governed exception, not a default path.

### 2.3 Release lifecycle

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4 defines the canonical lifecycle:

```
change proposal → offline eval → release bundle → canary rollout → monitor → promote or rollback → org impact audit
```

This lifecycle applies to all significant prompt changes. Minor wording adjustments to non-critical surfaces may follow a lighter path, but the bundle structure must still exist for traceability.

### 2.4 Relationship to learning pipeline

`PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md` §10 requires that a suggested improvement only becomes governed runtime behavior when: (a) reviewed by the right owner, (b) evaluated if critical, (c) bundled with the release artifact. This means the learning system's output feeds into the release bundle model — it does not bypass it.

---

## 3. Eval gates

### 3.1 What must pass before a prompt change ships

`PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md` §7 defines the evaluation doctrine:

Every important prompt change must be evaluated through:

- Benchmark scenarios
- Golden conversation sets
- Targeted regression suites
- Purpose-specific eval datasets

Eval must answer four questions:

1. Is behavior better?
2. Is behavior safer?
3. Did cost or latency regress?
4. Did language or scope drift?

### 3.2 Quality rubric

`PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md` §9 defines the quality rubric:

- Consultative usefulness
- Correctness and evidence honesty
- Scope and privacy compliance
- Clarity and structure
- Transformation relevance
- Multilingual stability

### 3.3 Eval gate enforcement

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 requires eval gates with explicit thresholds for: quality, latency, cost, citation/trust, and failure rate.

`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §9 requires activation to validate:

1. Prompt version exists
2. Referenced models exist
3. Policy version exists
4. Eval gate passed where required

### 3.4 Trust class integration (Decision 23)

Per `DECISION_LOG_WAVE_1.md` Decision 23: trust is assigned by runtime contract, not by model self-report alone. This has a direct implication for eval gates: the eval scorecard must include trust-class distribution metrics (from WP-W1-TRUST-01 §1). If a prompt change causes a regression in `grounded_fact` percentage or an increase in `degraded` output ratio, the eval gate must flag it.

### 3.5 Golden-set doctrine

`PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md` §8 requires canonical golden sets for major use-case families:

- Transformation advisory chat
- PM and execution support
- Finance analysis guidance
- Interview and discovery support
- Report and presentation support

Rule: `great prompts are improved against stable scenarios, not only operator intuition`.

### 3.6 Eval gate gap

The canonical docs define what eval gates must check but do not yet define:

- **Threshold values** — what constitutes a passing score for quality, latency, cost, and trust metrics.
- **Gate severity** — whether a failing eval gate blocks the release (hard gate) or produces a warning (soft gate).
- **Eval scope by change type** — whether a minor block edit requires the same eval depth as a base prompt rewrite.

These are implementation-time decisions but must be resolved before the first governed prompt release ships.

---

## 4. Rollback path

### 4.1 Rollback doctrine

`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §10 defines rollback as restoring the previous governed release state:

Rollback must restore:

- Prompt version
- Model mapping
- Fallback mapping
- Policy association

Canonical rule: `rollback should restore the previous governed release state, not only a prompt row`.

### 4.2 Rollback triggers

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 requires rollback triggers and an operator authority model. Combined with the observability baseline from WP-W1-TRUST-01 §6.2, rollback should be triggered when:

| Signal | Threshold | Action |
|---|---|---|
| Trust degradation rate | `degraded` outputs exceed threshold post-release | Operator-initiated rollback |
| Fallback rate spike | Model fallback rate increases significantly after release | Investigate; rollback if model mapping is the cause |
| Quality regression | Eval scorecard shows regression against golden sets | Automatic canary halt; operator decision to rollback |
| Cost regression | Per-interaction cost exceeds budget ceiling for the affected purpose | Operator-initiated rollback |
| Schema failure rate | Structured output validation failures increase | Rollback if output contracts are broken |

### 4.3 Rollback mechanics

Rollback is an activation of the previous release bundle. The system must:

1. Identify the last known-good bundle for the affected `prompt_key`.
2. Re-activate that bundle atomically (prompt version + model + fallback + policy).
3. Record the rollback event with `rolled_back_at` timestamp and reason.
4. Emit an operator signal so the rollback is visible in the release timeline.
5. Retain the rolled-back bundle for post-mortem analysis (do not delete).

### 4.4 Rollback scope

Rollback applies per `prompt_key`, not globally. A regression in the `finance_analyst` preset does not require rolling back the `consultative_chat` preset. However, if a release bundle contains changes to multiple prompt keys (a coordinated release), the operator must have the option to rollback the entire bundle or individual keys.

### 4.5 Rollback and canary

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 defines canary dimensions: organization, purpose, workload class, provider, surface. During canary rollout, rollback means reverting the canary population to the previous bundle — not promoting the canary to full production. The canary policy must define automatic rollback triggers (e.g., trust degradation rate > X% in the canary population).

---

## 5. Runtime controls (presets, output contracts, memory profiles)

### 5.1 Runtime presets

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §5 defines named presets as productized runtime contracts:

| Preset | Task family |
|---|---|
| `consultative_chat` | Advisory conversation |
| `deep_research` | Research and analysis |
| `execution_copilot` | Guided execution support |
| `finance_analyst` | Financial analysis |
| `report_builder` | Report generation |
| `interview_facilitator` | Interview and discovery |
| `knowledge_guide` | Knowledge base assistance |

Each preset defines: intended task family, response shape defaults, evidence expectations, allowed tools, preferred memory profile, routing expectations, degraded-mode semantics.

Rule: `presets are productized runtime contracts, not only saved prompt variants`.

### 5.2 Runtime parameters

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §6 defines canonical parameter families:

- Response style (concise / executive / analyst / coach)
- Answer depth
- Language
- Source scope
- Web search mode
- Reasoning visibility policy
- Private mode
- Action permission mode (advisory-only / proposal-only / tool-capable)
- Artifact mode
- Schema or output mode

Rule: `if the application can enforce a behavior directly, it should not rely only on prompt persuasion`.

### 5.3 Output contracts

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §7 defines canonical output classes:

- `FreeTextAnswer`
- `StructuredJson`
- `ProposalList`
- `ActionPlan`
- `EvidencePack`
- `DecisionBrief`
- `ArtifactDraft`
- `ToolCallPlan`

Each output contract defines: expected shape, validation rule, fallback behavior when schema fails, rendering expectation in the UI, audit and trace expectation.

Rule: `structured output should be first-class behavior for capabilities that feed system actions, reviews or downstream artifacts`.

### 5.4 Memory profiles

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §8 defines four canonical memory profile families:

| Profile | Use case | Key property |
|---|---|---|
| Session | Temporary context, short working continuity | Ephemeral; no cross-session persistence |
| Summary | Long conversations under token pressure | Compressed retention of prior discussion |
| Persistent | Organization patterns, stable user preferences | Durable; survives session boundaries |
| Restricted | Private mode, sensitive workflows | Compliance-safe; limited read/write/summarize |

Each profile defines: what can be read, what can be written, what can be summarized, retention semantics, review or deletion semantics.

Rule: `memory should be selected intentionally per run class, not only opportunistically appended`.

### 5.5 Preset–bundle coupling

A release bundle activates a prompt version, but the runtime behavior also depends on the preset and its associated parameters, output contract, and memory profile. The release bundle must declare which presets are affected by the change. If a prompt change alters the behavior of the `finance_analyst` preset, the bundle's `affected_purposes[]` must include it so that eval gates and canary policies target the right population.

---

## 6. Observability (prompt version → output tracing)

### 6.1 Prompt trace record

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §14 defines the `PromptTraceRecord` as the universal provenance object for every important AI run:

| Field | Description |
|---|---|
| `prompt_key` | Which prompt template was used |
| `prompt_version` | Which version was active |
| `release_bundle_id` | Which bundle activated this version |
| `preset_id` | Which runtime preset was active |
| `runtime_parameters` | Parameter values in effect |
| `memory_profile` | Which memory profile was selected |
| `evidence_and_tool_policy` | Which evidence/tool policy applied |
| `model_and_fallback_chain` | Which model was used, with fallback chain |
| `output_contract` | Which output contract was declared |
| `degraded_mode_state` | Whether degraded conditions applied |
| `evaluation_class` | If relevant, which eval class applies |

### 6.2 Integration with WP-W1-TRUST-01 support trace

The `PromptTraceRecord` is a component of the unified `SupportTrace` defined in WP-W1-TRUST-01 §4.2. The support trace joins context, retrieval, execution, routing, and trust traces. The prompt trace record adds the prompt-specific dimension: which prompt version, which preset, which parameters produced this output.

Together, these records allow an operator to answer: "For output X, which prompt version was active, which release bundle activated it, which model executed it, and what trust class was assigned?"

### 6.3 Observability families

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §15 defines the observability families:

- Quality trend by prompt release
- Quality trend by preset
- Schema success or failure rate
- Fallback frequency
- Degraded-mode frequency
- Memory profile usage
- Source class usage
- Cost and latency by prompt-runtime class
- Tool-policy denial and approval events

### 6.4 Operator questions

Operators must be able to answer:

- Which runtime shape is unstable?
- Which releases increased cost?
- Which presets regress quality?
- Where is schema compliance weak?
- Where does memory or retrieval policy cause failure?

### 6.5 Release-to-output tracing (Decision 25 compliance)

Per `DECISION_LOG_WAVE_1.md` Decision 25: `brief explanation for users, full trace for operators`.

- **User-visible:** Whether a fallback model was used; whether degraded conditions applied; high-level reason for routing choice. Users do not see prompt version identifiers, internal policy weights, or raw routing heuristics.
- **Operator-visible:** Full `PromptTraceRecord` + `RoutingExplanation` (from WP-W1-TRUST-01 §4.3) + `ProvenanceLedgerEntry`. Operators can trace any output back to the exact release bundle, prompt version, model, and policy that produced it.

### 6.6 Release comparison

Per `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 and WP-W1-TRUST-01 §6.5: when a release bundle changes routing or prompt behavior, the observability layer must support before/after comparison of trust metrics, quality trends, cost, and latency. This is the mechanism that makes eval gates meaningful in production — not just in offline evaluation.

---

## 7. Degraded-state handling

### 7.1 Degraded-state doctrine

`PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §16 defines explicit degraded states:

| Degraded state | Description |
|---|---|
| Prompt registry unavailable | Cannot resolve prompt template or version |
| Schema enforcement unavailable | Cannot validate output against contract |
| Retrieval unavailable | Cannot fetch evidence for grounding |
| Memory unavailable | Cannot load memory profile |
| Web search unavailable | Cannot perform external search |
| Selected model unavailable | Primary model is down |
| Fallback chain exhausted | All models in the fallback chain failed |

Each degraded state must define: whether fail-soft is allowed, how the assistant should speak, what trace record is written, what operator signal is emitted, whether the answer is advisory-only, partial, or blocked.

### 7.2 Fail-soft vs. fail-closed

`PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §12 distinguishes:

- **Fail-soft:** Non-critical assistance may degrade to safe fallback behavior (e.g., a general chat answer without retrieval grounding).
- **Fail-closed:** High-trust or policy-sensitive flows require explicit degraded state instead of silent fallback (e.g., a financial analysis that cannot access the required data sources).

Rule: `resilience must not erase traceability or governance semantics`.

### 7.3 Decision 26: voice_transcript_partial

Per `DECISION_LOG_WAVE_1.md` Decision 26: `voice_transcript_partial` is an explicit degraded condition.

When Teresa (voice) produces a partial transcript:

1. The user must see that transcript/understanding may be incomplete.
2. If any AI output relies on the partial transcript, the trust/degraded signaling must show this explicitly.
3. The `PromptTraceRecord` must record `degraded_mode_state = voice_transcript_partial`.
4. The trust class for claims derived from the partial transcript must be `degraded` (per WP-W1-TRUST-01 §1.2).

This aligns with WP-W1-TRUST-01 §8.4, which recommended adding `voice_transcript_partial` as a degraded condition. Decision 26 ratifies this recommendation.

### 7.4 Degraded-state observability

Per `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §15, degraded-mode frequency is a first-class observability metric. Operators must be able to:

- Track degraded-mode frequency by prompt release, preset, and time window.
- Correlate degraded-mode spikes with release events (did a new bundle cause more degradation?).
- Distinguish between infrastructure-caused degradation (model down, retrieval timeout) and prompt-caused degradation (schema failures, composition errors).

### 7.5 Degraded-state honesty rule

Rule from §16: `degradation should preserve honesty and explainability, not create hidden silent behavior changes`.

This means: if the system falls back to a simpler prompt (e.g., skipping learned instructions because the learning service is unavailable), the trace record must capture this. The user may not need to see every internal fallback, but the operator must be able to reconstruct exactly which composition layers were active and which were skipped.

---

## 8. Downstream dependency map

### 8.1 What this analysis provides to later work

| Downstream capability | Dependency on this analysis | Consequence if missing |
|---|---|---|
| **Prompt OS implementation (engineering)** | This analysis proves the composition → release → eval → rollback → observe loop is coherent across canonical docs. Engineering can implement against a validated architecture. | Engineering implements against fragmented docs; risk of inconsistent composition and release paths. |
| **Wave 2 — AI retrieval hardening** | Retrieval presets and source-control policies (§5) are coupled with prompt presets. The retrieval layer must know which preset is active to apply the correct evidence policy. | Retrieval and prompt runtime evolve independently; evidence policy mismatches at runtime. |
| **Wave 3 — Background and scheduled runtime** | Background jobs must use the same release bundle and preset model. A background `report_builder` run must activate the same prompt version as an interactive one. | Background AI operates on stale or untracked prompt versions. |
| **Wave 5 — AI release bundles (closure)** | This analysis defines the bundle contents, eval gate requirements, rollback mechanics, and canary policy that Wave 5 must operationalize into production tooling. | Wave 5 must re-derive the release model from scratch. |
| **Wave 6 — Trust contract closure** | Trust metrics from the eval gates (§3.4) and degraded-state handling (§7) feed into the trust contract. The trust vocabulary from WP-W1-TRUST-01 is consumed by the prompt trace record. | Trust contract cannot reference prompt-level quality or degradation signals. |
| **Full learning/improvement pipeline (later wave)** | The learning pipeline's output (approved suggestions) feeds into the release bundle model (§2.4). This analysis confirms the integration point. | Learning suggestions bypass release governance. |
| **Surface-specific prompt content authoring** | Authors must understand the composition model (§1) and block doctrine to write prompts that compose correctly within the governed system. | Authors write prompts that conflict with composition order or bypass governance layers. |

### 8.2 What this analysis depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **WP-W1-AI-01 — ContextSnapshot baseline** | `ContextSnapshot` object model consumed by composition runtime; identity chain for trace binding | Completed |
| **WP-W1-TRUST-01 — Trust, audit and observability baseline** | Trust vocabulary, provenance ledger, support trace model, observability baseline consumed by eval gates and prompt trace records | Completed |
| **DECISION_LOG_WAVE_1.md** — Decisions 23, 25, 26 | Trust class = hybrid (Decision 23); brief explanation for users, full trace for operators (Decision 25); voice_transcript_partial = degraded condition (Decision 26) | Ratified |

---

## 9. Open questions and conflicts

### 9.1 Eval gate thresholds undefined

The canonical docs define what eval gates must check (quality, latency, cost, trust, failure rate) but do not define passing thresholds. Without thresholds, the eval gate is a checklist, not a gate.

**Recommendation:** Define initial thresholds per purpose family (e.g., `consultative_chat` quality score ≥ 0.8, latency p95 ≤ 3s, trust degradation rate ≤ 5%). Thresholds should be tunable per release but must have a platform-wide floor.

**Escalation required:** Product must define the initial threshold values before the first governed prompt release.

### 9.2 Hard gate vs. soft gate distinction

It is unclear whether a failing eval gate blocks the release (hard gate) or produces a warning that an operator can override (soft gate).

**Recommendation:** Default to hard gate for critical surfaces (execution, finance, compliance-related outputs). Allow soft gate with operator override for non-critical surfaces (general chat, knowledge guide). The gate severity should be declared per preset, not globally.

### 9.3 Eval scope by change type

A minor wording change to a non-critical block should not require the same eval depth as a base prompt rewrite or a model swap. The canonical docs do not define a tiered eval policy.

**Recommendation:** Define three eval tiers:
- **Tier 1 (full eval):** Base prompt changes, model swaps, policy changes, changes affecting critical surfaces.
- **Tier 2 (targeted eval):** Block changes, learned instruction additions, preset parameter adjustments.
- **Tier 3 (smoke test):** Minor wording changes to non-critical blocks, metadata-only changes.

### 9.4 Canary population selection

`AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4.1 lists canary dimensions (org, purpose, workload class, provider, surface) but does not define how the canary population is selected or what percentage constitutes a safe canary.

**Recommendation:** Defer canary population policy to Wave 5 implementation, but require that the release bundle model supports canary targeting from day one (the `canary_policy_ref` and `target_environment` fields are already defined).

### 9.5 Multi-key coordinated release rollback

§4.4 of this analysis notes that a coordinated release (multiple prompt keys changed together) needs both per-key and whole-bundle rollback. The canonical docs do not define the coordination model.

**Recommendation:** A coordinated release should be modeled as a parent `AIReleaseBundle` containing child bundles per prompt key. Rollback of the parent rolls back all children. Rollback of a child is allowed only if the parent bundle's integrity is not compromised (i.e., the remaining children are still valid together).

### 9.6 No conflicts detected between canonical docs

The following pairs were checked for conflicts and found consistent:

- `PROMPT_OPERATING_SYSTEM_V8_SSOT.md` §8 (composition layers) ↔ `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §4 (composition inputs): The SSOT defines the abstract layer model; the registry doc defines the concrete assembly inputs. The registry doc's six inputs map cleanly into the SSOT's eight layers. No contradiction.
- `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §8 (release bundle) ↔ `AI_OPERATIONS_AND_RELEASE_ARCHITECTURE_V8.md` §4 (release lifecycle): The registry doc defines the bundle contents; the ops doc defines the lifecycle and operational metadata. Complementary, not conflicting.
- `PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md` §10 (approval doctrine) ↔ `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md` §9 (activation doctrine): Both require that changes flow through review and eval before activation. The learning doc adds the learning-specific path (suggestion → review → eval → bundle). Aligned.
- `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §14 (trace record) ↔ WP-W1-TRUST-01 §4.2 (support trace): The prompt trace record is a component of the unified support trace. No overlap or contradiction.
- Decision 23 (trust = hybrid) ↔ `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §2 (behavior enforced by runtime contracts): Consistent — both require runtime enforcement over model self-report.
- Decision 25 (brief for users, full for operators) ↔ `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §15 (observability families): The observability families are operator-grade. User-facing explanation is a separate, simpler layer. No conflict.
- Decision 26 (voice_transcript_partial) ↔ `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md` §16 (degraded states): Decision 26 adds a specific degraded condition to the existing degraded-state taxonomy. Compatible extension, not a conflict.

---

## 10. Packet output

- **Status:** completed
- **Completed:**
  - Prompt composition model with eight canonical layers, ownership map, block doctrine, and composition discipline assessment
  - Release bundle model with atomic contents, operational metadata, lifecycle, and learning pipeline integration
  - Eval gates with quality rubric, golden-set doctrine, trust-class integration (Decision 23), and gap identification for thresholds and gate severity
  - Rollback path with doctrine, triggers, mechanics, scope rules, and canary rollback semantics
  - Runtime controls covering seven named presets, ten parameter families, eight output contract classes, four memory profile families, and preset–bundle coupling
  - Observability model with `PromptTraceRecord` fields, integration with WP-W1-TRUST-01 support trace, nine observability families, and Decision 25 compliance (user vs. operator visibility)
  - Degraded-state handling with seven degraded states, fail-soft vs. fail-closed distinction, Decision 26 compliance (voice_transcript_partial), and degraded-state observability
  - Downstream dependency map (seven downstream consumers, three upstream dependencies)
  - Open questions and conflict analysis (5 open questions, 0 conflicts between canonical docs)
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Eval gate thresholds (§9.1) must be defined before the first governed prompt release ships
  - Hard gate vs. soft gate distinction (§9.2) needs a product decision per preset
  - Multi-key coordinated release rollback model (§9.5) needs engineering validation
- **Questions requiring escalation:**
  1. What are the initial eval gate threshold values for quality, latency, cost, and trust metrics per purpose family? (§9.1)
  2. Should failing eval gates be hard blocks or soft warnings with operator override, and should this vary by preset? (§9.2)
  3. Should eval depth be tiered by change type (base prompt vs. block edit vs. minor wording)? (§9.3)
  4. What canary population percentage and selection criteria should be used for prompt releases? (§9.4)
  5. How should coordinated multi-key releases be modeled for atomic rollback? (§9.5)
