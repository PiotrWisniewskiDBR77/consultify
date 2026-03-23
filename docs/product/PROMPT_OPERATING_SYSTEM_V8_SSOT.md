# Prompt Operating System v8 SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical product and runtime truth for how prompts are managed, composed, learned, evaluated and released across Consultify

---

## 1. Why this document exists

Consultify already has many AI building blocks:

- prompt registry
- prompt assembler
- model router
- learning system
- eval harness
- product docs for chat prompting

But those pieces need one platform-level source of truth.

This document defines that truth.

---

## 2. Core decision

Prompting in Consultify is not a feature of one chat surface.

It is:

`the platform operating system for AI behavior control and AI improvement`

Important rule:

`Prompt OS governs how the application thinks, speaks, scopes, learns and evolves`

---

## 3. Product mission

Prompt OS exists to:

- make AI behavior controllable
- keep assistant identity stable
- ensure prompt changes are safe and measurable
- let the application learn over time
- provide one explainable runtime contract across the platform

---

## 4. What Prompt OS includes

The Prompt OS includes:

- prompt registry
- prompt versions
- prompt blocks
- prompt composition runtime
- runtime presets and parameters
- mode and modifier rules
- output contracts
- memory profiles
- source and tool control doctrine
- adversarial prompt defense doctrine
- prompt-plus-model release bundles
- evaluation and regression gates
- learning and improvement system
- runtime traceability
- runtime observability
- prompt governance and ownership

---

## 5. What Prompt OS is not

Prompt OS is not:

- only a prompt editor
- only a prompt library
- only a chat persona
- only a set of admin screens

---

## 6. Canonical surface model

The Prompt OS spans four layers:

## 6.1 Registry layer

Stores and versions prompts, blocks and metadata.

## 6.2 Runtime layer

Assembles prompts into real runtime behavior using:

- base prompts
- blocks
- context
- evidence
- personalization
- learning modifiers

## 6.3 Learning and eval layer

Improves the system through:

- feedback
- pattern extraction
- suggestions
- evals
- regression review

> V8 Decision W2-8 applied — 2026-03-23
>
> Eval gate thresholds are defined per purpose family, not as one global number. Minimum purpose families: conversational, governed proposal/action, retrieval-grounded answer, artifact generation/editing, background/automation. Trust and correctness thresholds get stricter as business impact rises; cost/latency tolerance may vary by purpose.

## 6.4 Governance and release layer

Controls:

- who changes prompts
- how prompts are reviewed
- how bundles are published
- how rollback works

---

## 7. Canonical prompt object model

The system should conceptually support:

- `PromptTemplate`
- `PromptVersion`
- `PromptBlock`
- `PromptModifier`
- `RuntimePreset`
- `RuntimeParameters`
- `OutputContract`
- `MemoryProfile`
- `PromptReleaseBundle`
- `PromptExperiment`
- `PromptEvaluationSet`
- `PromptEvaluationRun`
- `PromptLearningPattern`
- `InstructionSuggestion`
- `PromptTraceRecord`

---

## 8. Canonical prompt layers

The canonical prompt runtime is composed from:

1. governance and safety constraints
2. canonical base prompt
3. runtime presets and parameters
4. context and memory layers
5. mode and persona modifiers
6. retrieval and evidence layers
7. adaptive and learned modifiers
8. final user message and history

Rule:

`every prompt layer must have one clearly understood owner and precedence`

---

## 9. Canonical learning doctrine

The application should learn through governed steps:

- collect feedback
- identify patterns
- generate suggestions
- review suggestions
- apply approved instructions
- evaluate impact

Rule:

`the app should learn through controlled improvement, not uncontrolled drift`

---

## 10. Canonical release doctrine

A critical AI change should publish as one governed release artifact containing:

- prompt key
- prompt version
- model selection
- fallback
- policy version
- evaluation state
- activation metadata

Rule:

`prompt release is not complete unless runtime can trace back to the governed artifact`

---

## 11. Canonical identity doctrine

Consultify must have:

- one canonical base assistant identity
- scoped modifiers for mode or co-thinker behavior
- no uncontrolled competing prompt identities across surfaces

This matters because assistant drift destroys trust quickly.

---

## 12. Canonical quality doctrine

Prompt quality should be judged on:

- behavioral consistency
- consultative usefulness
- trustworthiness
- scope honesty
- source honesty
- multilingual stability
- operational efficiency

Rule:

`prompt quality is behavioral and operational, not only stylistic`

---

## 13. Relationship to models and routing

Prompt OS and Model OS are distinct but coupled.

Prompt OS defines:

- behavior
- instructions
- identity
- scope

Model routing defines:

- which model executes the task
- fallback chain
- provider selection
- purpose mapping

Release truth must combine them.

---

## 14. Relationship to product modules

Prompt OS should govern behavior across:

- chat
- report generation
- presentations
- finance AI
- results AI
- agentic workflows
- partner enablement AI

It should also define the runtime control doctrine shared by those surfaces for:

- output shaping
- memory selection
- evidence and tool permissions
- source filtering and retrieval controls
- degraded-state honesty
- trace and observability semantics

This is important because users experience one Consultify AI ecosystem, not isolated prompt stacks.

---

## 15. Completion criteria

The Prompt OS is mature when:

- prompts are managed as governed assets
- runtime composition is explainable
- learning is controlled
- releases are atomic and traceable
- prompt quality is evaluated systematically
- surfaces share one prompt spine

---

## 16. Related canonical docs

- `PROMPT_OPERATING_SYSTEM_V8_BENCHMARK.md`
- `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md`
- `PROMPT_RUNTIME_CONTROL_OUTPUT_MEMORY_AND_OBSERVABILITY_RUNTIME_V8.md`
- `PROMPT_LEARNING_EVAL_AND_IMPROVEMENT_RUNTIME_V8.md`
- `PROMPT_PLATFORM_GOVERNANCE_AND_SURFACE_OWNERSHIP_RUNTIME_V8.md`
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
