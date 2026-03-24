# Chat v8 - Prompt system and composition

> Status: Draft v8
> Cel: Zdefiniowac jedna kanoniczna prawde dla prompt pipeline w `Chat v8`: skad biora sie instrukcje, jak sa skladane, jaka jest kolejnosc, jakie sa precedence rules i jakie zmiany sa potrzebne, by chat byl leader-grade.

---

## 1. Po co istnieje ten dokument

Jakosc chatu nie zalezy tylko od modelu i UI.
Zalezy wprost od:
- tego, jak skladany jest system prompt,
- jakie warstwy context sa dopinane,
- jak dzialaja memory, retrieval i co-thinkers,
- czy precedence rules sa jednoznaczne,
- czy runtime potrafi powiedziec, jaki prompt naprawde wyprodukowal odpowiedz.

Do tej pory ta wiedza byla rozproszona miedzy:
- `Chat v8` product docs,
- `AI_LLM_OPERATING_SYSTEM_V3.md`,
- `AI_PROMPT_GOVERNANCE_AUDIT_2026-03-07.md`,
- runtime kod `AIPipeline`, `ai.routes`, `promptAssembler`.

Ten dokument zamyka te warstwy dla chatu.

---

## 2. Prompt SSOT layers

### 2.1 Product-level prompt contract

Product docs definiuja:
- jakie source classes i response classes sa dozwolone,
- jakie modes i privacy semantics istnieja,
- jakie zachowania AI sa dozwolone lub zabronione,
- jak user powinien rozumiec quality, trust i action semantics.

To jest warstwa:
- `CHAT_V8_SSOT.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`

### 2.2 Runtime prompt contract

Runtime docs i kod definiuja:
- jak system prompt jest skladany w praktyce,
- jakie bloki sa dynamicznie dopinane,
- jaka jest kolejnosc skladania,
- kiedy system fail-soft fallbackuje,
- jaka traceability jest zachowywana.

To jest warstwa:
- `docs/product/modules/ai/AI_PROMPT_GOVERNANCE_AUDIT_2026-03-07.md`
- `docs/product/modules/ai/AI_LLM_OPERATING_SYSTEM_V3.md`
- `server/src/services/ai/AIPipeline.ts`
- `server/src/services/ai/promptAssembler.ts`
- `server/src/routes/ai.routes.ts`

### 2.3 Rule

`Chat v8` musi miec spiety produktowy i runtime prompt contract.
Nie moze byc tak, ze UX obiecuje jeden model pracy promptow, a runtime skleja je inaczej.

---

## 3. Canonical chat prompt pipeline

For canonical chat runtime, prompt composition should be understood as:

`prompt registry base -> runtime context sections -> mode/persona/retrieval addons -> adaptive/learning modifiers -> history -> sanitized user prompt`

### 3.1 Base prompt registry

Canonical base prompt should come from prompt registry and assembler:
- `promptKey`
- prompt version
- optional blocks
- org learned instructions
- language directive

Canonical owner:
- `promptAssembler`

### 3.2 Runtime context sections

Then runtime builds context-rich system sections from:
- organization context,
- project/business context,
- execution context,
- user memory,
- custom instructions,
- org memory,
- selected entity / screen context,
- optional knowledge and benchmark sections.

Canonical owner:
- `AIPipeline.buildSystemPrompt`
- `AIContextBuilder`

### 3.3 Mode and persona addons

Then runtime may add:
- co-thinker persona prompt,
- deep research rules,
- web search instructions,
- response style,
- private mode constraints,
- other mode-level behavior.

Canonical owner:
- `ai.routes.ts`
- `coThinkerService`
- `AIPipeline.buildBehavioralInstructions`

### 3.4 Retrieval addons

Then runtime may add retrieval-backed instructions and evidence payloads from:
- attachments,
- URL-ingested content,
- help docs,
- web search,
- deep research prelude.

Canonical owner:
- `ai.routes.ts`
- retrieval helpers and research services

### 3.5 Adaptive and learning modifiers

Then runtime may apply:
- adaptive style preferences,
- learned org instructions,
- feedback-derived enhancements.

Canonical owner:
- `adaptiveResponseService`
- `learningSystem`

### 3.6 Final user turn

Then conversation history is appended and final user message is:
- scanned,
- sanitized for injection/PII rules where applicable,
- passed as the last message.

Canonical owner:
- `AIPipeline.buildPrompt`

---

## 4. Precedence rules

### 4.1 Non-negotiable order

The following precedence order should be treated as canonical for chat:

1. Governance and safety constraints
2. Canonical prompt registry base
3. Context and memory layers
4. Mode/persona directives
5. Retrieval and evidence addons
6. Adaptive/learning modifiers
7. User message and history

### 4.2 Why this matters

If retrieval, persona or client-provided system text can silently outweigh governance and core prompt intent, the system becomes hard to reason about and hard to trust.

### 4.3 v8 design rule

`Chat v8` should not rely on large client-side persona prompts as a competing second base persona.
Client-side prompt input should be reduced to:
- short overrides,
- mode hints,
- structured request metadata,
- not a parallel full consultant manifesto.

---

## 5. Canonical prompt layers for chat

### 5.1 Base persona layer

What the assistant fundamentally is.

Rules:
- one canonical owner,
- versioned,
- traceable,
- no duplicate persona definitions across client and server.

### 5.2 Governance layer

What the assistant may and may not do.

Rules:
- no silent mutations,
- no fake certainty,
- no hidden violation of privacy or source honesty,
- no chain-of-thought exposure beyond allowed high-level reasoning summaries.

### 5.3 Context layer

What the assistant knows from current workspace, conversation and org context.

Rules:
- context must be policy-filtered,
- context scopes must map to product-visible source classes.

### 5.4 Retrieval layer

What the assistant knows because evidence was injected.

Rules:
- evidence-backed addons must not masquerade as generic memory,
- web, attachments and help-docs retrieval should stay distinguishable in product semantics.

### 5.5 Personalization layer

What the assistant adapts due to user/org preferences.

Rules:
- personalization cannot override governance,
- private mode may reduce or disable this layer.

### 5.6 Mode/persona layer

What the assistant does differently because of:
- `deepResearch`
- `showReasoning`
- `multiAgent`
- `coThinkerMode`
- `marketResearch`
- `responseStyle`

Rules:
- modes are modifiers, not uncontrolled new base prompts,
- each mode must have a clear behavioral diff relative to default chat.

---

## 6. Co-thinker contract

### 6.1 What it is

`coThinkerMode` is a server-authoritative persona modifier.

### 6.2 What it is not

It is not automatically proof of:
- separate agent runtime,
- guaranteed specialist reasoning quality,
- independent memory or independent governance model.

### 6.3 v8 requirement

For each named co-thinker, the docs should make clear:
- prompt source,
- behavioral intent,
- relationship to default assistant,
- mode interactions,
- quality/eval expectations.

---

## 7. Language contract

### 7.1 Current risk

Current runtime/documentation shows multiple overlapping language directives:
- assembler language policy,
- route-level "respond in user's language",
- co-thinker language hint,
- behavioral language hints,
- legacy/client persona language language.

### 7.2 Canonical v8 rule

There should be one authoritative language policy:
- respond in the language of the user message,
- use UI locale only as fallback,
- do not stack redundant language blocks unless a specific mode requires it.

### 7.3 Quality rule

Language policy must be consistent enough that:
- prompt sections do not fight each other,
- the assistant does not produce mixed-language output because the prompt did.

---

## 8. Retrieval and prompt honesty

Prompt system must not imply a stronger knowledge layer than runtime really injects.

Examples:
- project documents metadata is not the same as retrieved document evidence,
- help docs injection is not the same as universal knowledge graph grounding,
- web search snippet injection is not the same as stable evidence ledger.

`Chat v8` must document prompt-supported reality, not desired future mythology.

---

## 9. Failure modes and fallback

### 9.1 Prompt assembler failure

Fail-soft fallback can be useful for resilience, but for critical surfaces it weakens traceability.

`Chat v8` should classify fallback by severity:
- `fail-soft acceptable` for low-risk generic chat,
- `fail-closed or degrade-explicitly` for critical governed surfaces.

### 9.2 Missing retrieval

If evidence injection fails:
- system should not imply evidence-backed certainty,
- answer class should degrade honestly.

### 9.3 Token bloat

Prompt stacking without one canonical budget is a quality risk:
- cost,
- latency,
- diluted instructions,
- inconsistent behavior.

`Chat v8` should have a prompt-budget discipline even if exact limits are implementation-owned.

---

## 10. Traceability manifest

For a leader-grade governed system, each significant runtime chat response should ideally be attributable to:
- request id
- prompt key
- prompt version
- bundle or release artifact if governed
- policy version
- primary model
- fallback model if used
- active modes
- source classes used

Not every field must be user-visible.
But the system should know them.

---

## 11. Recommended changes

### 11.1 Documentation changes

- Register prompt governance and AI OS docs explicitly alongside `Chat v8` canonical suite.
- Keep `Chat v8` as product SSOT, but make prompt runtime docs authoritative for composition details.
- Add one explicit mapping between product source classes and runtime prompt layers.
- Add one prompt-content quality standard so teams can evaluate actual prompt text, not only prompt architecture.

### 11.2 Product/documentation changes

- Stop treating client-side large persona prompts as a long-term canonical pattern.
- Promote one canonical prompt composition story for full and split chat.
- Add per-co-thinker behavioral contract and evaluation expectations.
- Make prompt fallback policy explicit by surface criticality.

### 11.3 Architecture changes to target

- one prompt API truth,
- one prompt base persona truth,
- one language rule,
- one deduplicated KB injection path,
- one prompt manifest/tracing contract.

### 11.4 Content-quality changes to target

- reduce giant client-side persona overlays,
- keep base persona concise and versioned,
- ensure co-thinker prompts are modifiers, not replacement identities,
- maintain explicit prompt budget discipline,
- connect prompt edits to eval and regression review.

---

## 12. Definition of done

Prompt system and composition are complete only when:
- there is one clear prompt composition order,
- base persona ownership is unambiguous,
- memory, modes and retrieval layers are mapped to prompt layers,
- fallback behavior is explicit,
- runtime can trace which prompt/policy/model produced a response,
- product docs and runtime docs no longer contradict each other.

Related specs:
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_RUNTIME_TRUTH_MAP.md`
- `CHAT_V8_PROMPT_CONTENT_AND_QUALITY.md`
- `CHAT_V8_PROMPT_MASTERY_GAP_MATRIX.md`
