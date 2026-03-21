# AI Operations And Release Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model `AI ops`, `eval-driven release`, `rollout`, `rollback`, `deprecation` i `supportability` dla warstwy AI.

---

## 1. Why this matters for Consultify

Najlepsze systemy AI nie sa stabilne dlatego, ze maja jeden dobry prompt albo jeden dobry model.
Sa stabilne dlatego, ze zmiany AI sa zarzadzane jak produkcyjny system operacyjny:

- mierzone,
- porownywane,
- rolloutowane,
- cofane,
- i widoczne dla operatorow.

---

## 2. Leader patterns

Imported patterns:

- vendor model docs emphasize deprecations, pricing shifts and capability drift,
- modern agent stacks rely on evals, release bundles and operational visibility,
- workload class and routing decisions must be reviewed as a system, not ad hoc.

Key lesson:

`AI change management` must be first-class architecture.

---

## 3. Current V8 coverage

Current inputs already exist in:

- `AI_LLM_MODEL_MANAGEMENT_V8.md`
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
- `CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
- `docs/product/modules/ai/AI_PROMPT_GOVERNANCE_AUDIT_2026-03-07.md`

Current gap:

- brak jednego dokumentu, ktory laczy model releases, prompt releases, evals, canary, rollback, org impact i operator workflows.

---

## 4. Canonical target architecture

Canonical release lifecycle:

`change proposal -> offline eval -> release bundle -> canary rollout -> monitor -> promote or rollback -> org impact audit`

Required control objects:

- `AIReleaseBundle`
- `EvalScorecard`
- `CanaryPolicy`
- `RollbackPlan`
- `DeprecationNotice`
- `OrgImpactReport`

Canonical rule:

`no significant routing, prompt or model change should become default production behavior without eval evidence and rollback semantics`

## 4.1 Leader-grade hardening requirements

To reach production-grade AI operations, this architecture must also define:

- release bundle contents for model, prompt, policy, workload class and feature flags,
- eval gates with explicit thresholds for quality, latency, cost, citation/trust and failure rate,
- canary dimensions by organization, purpose, workload class, provider and surface,
- rollback triggers and operator authority model,
- deprecation lifecycle from notice through replacement mapping to org migration completion,
- release observability tied to support-visible run traces.

Minimum release metadata should include:

- `release_bundle_id`
- `change_scope`
- `eval_scorecard_ref`
- `canary_policy_ref`
- `rollback_plan_ref`
- `affected_orgs_count`
- `affected_purposes[]`
- `status`
- `promoted_at`
- `rolled_back_at?`

---

## 5. Contracts and boundaries

`AI_LLM_MODEL_MANAGEMENT_V8` owns:

- routing logic and execution-profile direction.

Prompt governance docs own:

- prompt assembly and content quality rules.

This document owns:

- release control across models, prompts, policies and workload classes,
- operator workflow for rollout and rollback,
- support contract for understanding AI behavior changes over time.

---

## 6. Risks and failure modes

Main risks:

- routing change silently harms quality or cost,
- model deprecation breaks org coverage,
- prompt change shifts output style without traceability,
- operators detect regressions too late,
- support cannot tell which release bundle produced a bad output.

---

## 7. Implementation implications

The platform should add:

- one shared release artifact for model, prompt and policy changes,
- one eval gate that covers quality, trust, latency and cost,
- canary rollout by org, purpose, workload class or consumer class,
- rollback rules with fast restore path,
- deprecation mapping from old capability to replacement path,
- support-visible release trace attached to runs and outputs.

---

## 8. Acceptance criteria

- AI changes can be tied to a release bundle and eval scorecard.
- Operators can canary and rollback major AI changes.
- Org impact can be inspected before removing or replacing capabilities.
- Support can trace outputs back to routing, prompt and release state.
- AI ops uses one canonical vocabulary across chat, execution and other consumers.

---

## 9. Related canonical docs

- `docs/product/AI_LLM_MODEL_MANAGEMENT_V8.md`
- `docs/product/CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
- `docs/product/CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
- `docs/product/modules/ai/AI_PROMPT_GOVERNANCE_AUDIT_2026-03-07.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
