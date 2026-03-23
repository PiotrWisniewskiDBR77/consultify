# V8 Program — Wave 2 Decision Log

> Status: Active
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 2 escalation items from packets WP-W2-AI-01, WP-W2-AI-02, WP-W2-AI-03

---

## Chat-Execution integration

### Decision W2-1 — Intent classification

- Hybrid approach.
- System uses LLM classification first.
- Borderline cases require user confirmation.
- Safe rule: clear conversational ask → stay in chat; clear governed work request → enter execution/proposal path; ambiguous ask → ask user whether this should become governed work.

### Decision W2-2 — ChatActionProposal vs ActionProposal unification

- Wave 2 = facade alignment (one user-visible proposal family).
- Wave 3 = full merge target (one canonical underlying proposal model).
- Do not block Wave 2 on full data-model unification.

### Decision W2-3 — Proposal rendering in chat

- Use a dedicated `messageType` for governed proposals.
- Do not hide governed proposals only inside a generic `actions` field.
- `actions` may still carry lightweight conversational actions.
- Governed proposal objects render as explicit first-class proposal messages.

---

## Knowledge-Retrieval integration

### Decision W2-4 — `working_memory_context_ref`

- Ratified as part of the retrieval request contract.
- Must be explicit, not inferred only from conversation state.
- Rule: retrieval should know both scope and active working-memory context.

### Decision W2-5 — ACL staleness scope

- ACL staleness windows (Decision 10) apply to connector-backed external sources.
- They do not apply the same way to internal memory stores.
- Internal memory uses its own freshness/governance checks, not connector ACL lag semantics.

### Decision W2-6 — Compacted memory promotion

- Compacted working memory can be promoted, but not as silent durable truth.
- Must go through governed promotion as derived knowledge.
- Raw source material remains stronger evidence class.
- Rule: compacted memory may become durable only with provenance and promotion workflow; no direct promotion as if it were original source evidence.

### Decision W2-7 — Budget hint protocol

- Wave 2 baseline: advisory `budget_hint` is sufficient.
- Architecturally leave room for stronger protocol later.
- Rule: start lightweight, preserve upgrade path.

---

## Prompt OS runtime discipline

### Decision W2-8 — Eval gate threshold values

- Thresholds per purpose family, not one global number.
- Minimum purpose families: conversational, governed proposal/action, retrieval-grounded answer, artifact generation/editing, background/automation.
- Product rule: trust and correctness thresholds get stricter as business impact rises; cost/latency tolerance may vary by purpose.

### Decision W2-9 — Hard gate vs soft gate policy

- Per preset.
- High-risk and externally consequential presets use hard gates.
- Lower-risk exploratory presets may use soft gates with monitoring.
- Rule: gate strictness follows preset risk and output consequence.

### Decision W2-10 — Eval depth tiering

- By change type.
- Minimum tiers: minor wording/config tweak, block-level prompt edit, routing/policy/model change, base rewrite or structural runtime change.
- Deeper change → deeper eval before rollout.

### Decision W2-11 — Canary population

- Exact percentage and cohort math deferred to later wave.
- Architecture must support: org-scoped targeting, purpose-family targeting, preset/version targeting, fast rollback.
- Product decision: canary must be selectable, observable, and reversible.

### Decision W2-12 — Multi-key coordinated release rollback

- Required capability; engineering validation needed.
- Rollback must work at coordinated release-bundle level, not only per single key.
- Model/prompt/policy/runtime-config changes must be rollback-aware as one release family where coupled.
- Exact implementation strategy validated later.

---

## Wave 2 closure

Wave 2 is formally closed as of 2026-03-23 with 3 completed packets and 12 binding decisions.

---

## Related packets

- `WP-W2-AI-01_CHAT_EXECUTION_INTEGRATION.md`
- `WP-W2-AI-02_KNOWLEDGE_RETRIEVAL_INTEGRATION.md`
- `WP-W2-AI-03_PROMPT_OS_RUNTIME_DISCIPLINE.md`
