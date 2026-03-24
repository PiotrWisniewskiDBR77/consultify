# Prompt Registry Composition And Release Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime for prompt registry, prompt composition, release bundles, activation, rollback and traceability

---

## 1. Why this document exists

Consultify already has:

- prompt CRUD
- prompt versions
- prompt blocks
- prompt assembler
- release primitives

This document closes the runtime contract:

- how prompts are composed
- how they are released
- how they are traced

---

## 2. Core decision

The registry and release layer is the canonical runtime owner of prompt truth.

Rule:

`all critical prompt changes should flow through one governed system of record`

---

## 3. Canonical registry model

The registry should support:

- `PromptTemplate`
- `PromptVersion`
- `PromptBlock`
- `PromptCategory`
- `PromptVariables`
- `PromptActivationState`

The registry is where prompt assets live.

It is not where final runtime behavior is fully defined alone.

That behavior emerges when registry assets are composed with runtime context.

---

## 4. Canonical composition runtime

The final prompt should be assembled from:

1. base prompt template
2. selected prompt blocks
3. org-level learned instructions
4. language policy
5. runtime context sections
6. mode and evidence modifiers

The exact runtime order must remain explicit and stable.

Rule:

`composition order is part of product truth, not an implementation accident`

---

## 5. Canonical composition owners

The runtime owners should be understood as:

- registry and versions -> prompt registry routes
- prompt assembly -> `promptAssembler`
- runtime context injection -> pipeline and context builders
- model execution path -> model router and runtime pipeline

This owner map matters because cross-layer ambiguity creates regression risk.

---

## 6. Prompt block doctrine

Blocks should be treated as reusable modifiers.

Canonical block families may include:

- role
- behavior
- output
- constraint
- context
- task

Blocks should never silently replace the base identity.

Rule:

`blocks are composable modifiers, not shadow base prompts`

---

## 7. Language policy doctrine

Language control should come from one explicit policy.

The runtime may use:

- preferred language
- conversation language
- supported-language fallback

But the final rule should be singular and regression-tested.

Rule:

`language policy must be resolved once, not reasserted inconsistently by many layers`

---

## 8. Release bundle doctrine

Critical prompt changes should publish through a release bundle containing:

- prompt key
- prompt version
- primary model
- fallback model
- policy version
- evaluation state
- target environment

This is the release truth.

Rule:

`prompt, model, fallback and policy should activate together`

> V8 Decision W2-11 applied — 2026-03-23
>
> Exact canary percentages and cohort math are deferred to a later wave. However, the release bundle architecture must support from day one: org-scoped targeting, purpose-family targeting, preset/version targeting, and fast rollback. Canary must be selectable, observable, and reversible.

---

## 9. Activation doctrine

Activation should be atomic for critical surfaces.

Publish should validate:

- prompt version exists
- referenced models exist
- policy version exists
- eval gate passed where required

After activation, runtime must be able to say:

- which prompt version was used
- which bundle activated it
- which model and policy applied

---

## 10. Rollback doctrine

Rollback should not mean manually changing multiple independent settings.

It should restore:

- prompt version
- model mapping
- fallback mapping
- policy association

Rule:

`rollback should restore the previous governed release state, not only a prompt row`

> V8 Decision W2-12 applied — 2026-03-23
>
> Multi-key coordinated rollback is a required capability. Rollback must work at the coordinated release-bundle level, not only per single prompt key. Model, prompt, policy, and runtime-config changes must be rollback-aware as one release family where coupled. A coordinated release should be modeled as a parent bundle containing child bundles per prompt key; rollback of the parent rolls back all children.

---

## 11. Traceability doctrine

Every critical AI response should be traceable to:

- prompt key
- prompt version
- release bundle
- policy version
- selected model
- relevant mode or modifiers

This is required for:

- debugging
- support
- audits
- rollback confidence

---

## 12. Failure doctrine

The runtime should define where fail-soft is acceptable and where fail-closed is required.

Important examples:

- non-critical assistance may degrade to safe fallback behavior
- high-trust or policy-sensitive flows may require explicit degraded state instead

Rule:

`resilience must not erase traceability or governance semantics`

---

## 13. Completion criteria

This layer is complete when:

- one registry truth exists
- composition order is stable and documented
- release bundles are atomic for critical flows
- rollback restores full governed state
- runtime response provenance is available

---

## 14. Related canonical docs

- `PROMPT_OPERATING_SYSTEM_V8_SSOT.md`
- `PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md`
- `AI_PROMPT_GOVERNANCE_AUDIT_2026-03-07.md`
