# Prompt Learning Eval And Improvement Runtime v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical runtime for teaching the application, collecting feedback, extracting patterns, evaluating prompt quality and improving the AI system over time

---

## 1. Why this document exists

Prompt management alone is not enough.

If Consultify wants to become better over time, it must have a governed answer to:

- how feedback is collected
- how the app learns
- how prompt quality is measured
- how improvements are approved

This document defines that lifecycle.

---

## 2. Core decision

The application should learn through a governed improvement loop.

Rule:

`the system may learn continuously, but it may only change governed behavior through controlled promotion`

---

## 3. Canonical improvement loop

The canonical loop is:

`feedback -> pattern detection -> suggestion -> review -> eval -> release -> runtime observation`

Each step should remain distinguishable.

The loop should never collapse into:

`feedback -> silent prompt mutation`

---

## 4. Feedback doctrine

The system should support feedback such as:

- positive feedback
- negative feedback
- correction
- qualitative comment
- structured quality score

Feedback should be usable at multiple scopes:

- message
- conversation
- organization
- use-case family

---

## 5. Pattern extraction doctrine

The system should extract stable improvement patterns such as:

- factual error
- completeness gap
- tone issue
- formatting issue
- scope misunderstanding
- instruction weakness

Pattern extraction should produce:

- frequency
- confidence
- source scope
- candidate improvement area

Rule:

`patterns are diagnostic signals, not automatically trusted truth`

---

## 6. Instruction suggestion doctrine

The learning system may propose:

- org-specific learned instructions
- quality reminders
- scoped behavioral modifiers

But suggestions should remain:

- reviewable
- approvable
- traceable

This is critical because otherwise local feedback could destabilize the system.

---

## 7. Evaluation doctrine

Every important prompt change should be evaluated through:

- benchmark scenarios
- golden conversation sets
- targeted regression suites
- purpose-specific eval datasets

Eval should answer:

- is behavior better
- is behavior safer
- did cost or latency regress
- did language or scope drift

> V8 Decision W2-8 applied — 2026-03-23
>
> Eval gate thresholds are defined per purpose family, not as one global number. Minimum purpose families: conversational, governed proposal/action, retrieval-grounded answer, artifact generation/editing, background/automation. Product rule: trust and correctness thresholds get stricter as business impact rises; cost/latency tolerance may vary by purpose.

> V8 Decision W2-9 applied — 2026-03-23
>
> Hard gate vs soft gate policy is per preset. High-risk and externally consequential presets use hard gates (failing eval blocks the release). Lower-risk exploratory presets may use soft gates with monitoring (failing eval produces a warning that an operator can override). Rule: gate strictness follows preset risk and output consequence.

> V8 Decision W2-10 applied — 2026-03-23
>
> Eval depth is tiered by change type. Minimum tiers: minor wording/config tweak, block-level prompt edit, routing/policy/model change, base rewrite or structural runtime change. Deeper change → deeper eval before rollout.

---

## 8. Golden-set doctrine

Consultify should maintain canonical golden sets for major use-case families.

Examples:

- transformation advisory chat
- PM and execution support
- finance analysis guidance
- interview and discovery support
- report and presentation support

Rule:

`great prompts are improved against stable scenarios, not only operator intuition`

---

## 9. Quality rubric doctrine

Prompt quality should be measured with stable rubrics including:

- consultative usefulness
- correctness and evidence honesty
- scope and privacy compliance
- clarity and structure
- transformation relevance
- multilingual stability

This is important because prompt tuning by taste alone is not enough.

---

## 10. Approval doctrine

A suggested improvement should only become governed runtime behavior when:

- reviewed by the right owner
- evaluated if critical
- bundled with the release artifact

Rule:

`teaching the app requires promotion discipline, not only accumulation of suggestions`

---

## 11. Runtime observation doctrine

After release, the system should observe:

- quality trend
- feedback trend
- regression indicators
- prompt-specific cost and latency impact
- failure or degraded-mode frequency

This turns improvement into a real operating loop.

---

## 12. Organization-specific learning doctrine

Consultify should support organization-specific learning.

But that learning must stay:

- bounded
- explainable
- policy-filtered
- non-authoritative relative to governance and safety layers

Rule:

`organization learning personalizes behavior, but cannot replace core assistant truth`

---

## 13. Human-in-the-loop doctrine

Human review is essential in:

- approving instruction suggestions
- judging ambiguous feedback clusters
- reviewing eval deltas
- deciding whether a change is general or org-specific

This is especially important for a transformation platform, where poor advice can have real organizational cost.

---

## 14. Completion criteria

This layer is complete when:

- feedback is systematically captured
- patterns become visible
- suggestions are reviewable
- critical prompt changes are evaluated
- released changes are observed after activation
- learning does not bypass governance

---

## 15. Related canonical docs

- `PROMPT_OPERATING_SYSTEM_V8_SSOT.md`
- `PROMPT_REGISTRY_COMPOSITION_AND_RELEASE_RUNTIME_V8.md`
- `CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
- `REPORTS_AND_PRESENTATIONS_AUTONOMY_EVAL_AND_PROOF_SYSTEM_V8.md`
