# Chat v8 - Prompt mastery gap matrix

> Status: Draft v8
> Cel: Zdefiniowac, czego jeszcze brakuje w prompt layer, aby `Chat v8` osiagnal poziom master-grade: jedna prompt truth, leader-grade trust, eval-driven improvement i operacyjna kontrola regresji.

---

## 1. Po co istnieje ten dokument

`CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md` opisuje:
- jak prompt stack powinien byc skladany,
- jaka ma byc kolejnosc,
- jakie sa precedence rules.

`CHAT_V8_PROMPT_CONTENT_AND_QUALITY.md` opisuje:
- jak ma wygladac dobra tresc promptow,
- jak unikac duplikacji,
- jak oceniac prompt text quality.

Ten dokument domyka trzecia warstwe:
- jakie master-level capabilities sa jeszcze brakujace,
- ktore z nich sa krytyczne,
- jakie jest ryzyko pozostawienia ich niedomknietych,
- jaki powinien byc target implementation state.

To nie jest ogolne memo.
To jest kanoniczna mapa brakow dla prompt operating system w `Chat v8`.

---

## 2. Co znaczy master-level prompt system

Prompt system na poziomie master nie oznacza tylko "lepszych promptow".
Oznacza system, w ktorym:

- istnieje jedna realna prompt truth,
- runtime zachowuje sie zgodnie z dokumentacja,
- kazda istotna zmiana promptu jest mierzalna,
- eksperymenty sa realne, nie pozorne,
- language, scope, memory i retrieval maja jeden kontrakt,
- regresje nie przechodza niezauwazone,
- kazda odpowiedz da sie wyjasnic i przeauditowac.

---

## 3. Jak czytac te matrix

Kazdy wiersz opisuje:
- obszar prompt operating system,
- target mastery state,
- obecny stan,
- glowny gap,
- priorytet,
- dlaczego to ma znaczenie.

Priorytety:
- `P0` - blocker dla trusted master-grade chat
- `P1` - bardzo wazne dla leader parity i stabilnej poprawy jakosci
- `P2` - wzmacnia excellence i operacyjna dojrzalosc

---

## 4. Mastery gap matrix

| Area | Target mastery state | As-is | Gap | Priority | Why it matters |
|---|---|---|---|---|---|
| Base identity ownership | One canonical base identity across chat surfaces | Registry base exists, but fallback persona and client overlays still shape behavior | Competing assistant identities | P0 | Biggest source of tone drift and hard-to-debug quality variance |
| Language policy | One authoritative language contract | Assembler, route and behavioral blocks all instruct language differently | Conflicting language rules | P0 | Mixed-language output and hidden instruction conflicts erode quality fast |
| Scope control truth | User-visible source controls actually gate retrieval/context | Some controls behave like prompt hints more than hard runtime scope controls | Scope semantics not fully enforced in data path | P0 | Leader-grade trust requires honest scope, not only helpful wording |
| Source-grounding contract | One answer honesty model for grounded vs ungrounded answers | Partial source transparency across surfaces | No universal answer class and evidence honesty contract at runtime | P0 | Users must understand when answer is grounded, general, limited or uncertain |
| Memory safety | Memory and personalization respect one clear privacy contract | Multiple memory channels and some fail-open behavior | Memory precedence and failure semantics not strict enough | P0 | Enterprise trust breaks when memory use is ambiguous |
| Prompt API truth | One mutation path for prompts | Canonical stack exists, but legacy path still exists in audit | Dual prompt governance surface | P0 | Diffuse governance makes controlled change unreliable |
| Release artifact truth | Prompt + model + fallback + policy publish as one governed artifact | Release bundle primitives exist, activation still not fully atomic | Non-atomic publish risk | P0 | Partial activation creates invisible regressions |
| Runtime traceability | Every response maps cleanly to prompt, version, bundle, policy and mode | Prompt metadata exists, but not one full response-level truth contract everywhere | Traceability incomplete | P0 | Without this, support, QA and rollback stay slower than they should be |
| Eval gating | Prompt changes require eval and regression pass before activation | Eval harness exists, but not yet visibly mandatory for all critical chat changes | Evals are infrastructure, not universal policy | P1 | Master systems do not rely on manual judgment alone |
| Golden chat suites | Frozen representative conversation datasets exist for main chat | Eval harness supports datasets, but main chat regression suite is not product-operating default | Missing canonical chat golden sets | P1 | Prompt edits need stable comparison targets |
| Experiment execution | A/B experiments deterministically assign traffic in real runtime | Experiment APIs and service exist | Runtime experiment wiring not proven as canonical | P1 | Experimentation without deterministic execution is misleading |
| Cross-surface convergence | Full chat, split chat and adjacent AI surfaces share one prompt spine | Multiple surfaces still carry bespoke prompt layers | Surface-level prompt fragmentation | P1 | Users experience one AI product, not isolated prompt islands |
| Co-thinker rigor | Co-thinkers act as evaluated modifiers, not second personas | Co-thinker library exists, but mostly via prompt text | Behavioral diff and eval rigor still partial | P1 | Premium personas need measurable behavioral value |
| Prompt budget discipline | Token budget and salience are governed per prompt layer | Content quality guidance exists, but no hard operating budget contract | Prompt stack can still overgrow | P1 | Too many instructions dilute model focus and increase cost |
| Failure transparency | Degraded retrieval/memory/prompt states become explicit product states | Some failures are logged best-effort and fail-soft | User-visible degraded mode semantics incomplete | P1 | Honest failure handling is part of premium trust |
| Prompt review workflow | Prompt edits are tied to owner, rationale and eval delta | Prompt registry versioning exists | Review workflow is not yet visibly enforced end-to-end | P1 | Great prompt systems are managed like code and policy, not copywriting |
| Quality rubrics | Prompt quality is measured through stable rubrics | Content checklist exists; behavioral quality rubric is still loose | No unified rubric for consultative quality | P2 | Prevents prompt tuning by taste or vibe |
| Cost and latency discipline | Prompt changes automatically surface token and latency regressions | Usage logs and finops exist | Prompt version SLO view not formalized | P2 | Better prompts must remain operationally sustainable |
| Support and incident handling | Prompt regressions have one rollback/runbook model | Governance docs identify controls, but one prompt-incident playbook is not explicit | Ops workflow not fully productized | P2 | Excellence requires fast, repeatable recovery |

---

## 5. Most important P0 gaps

### 5.1 One assistant identity

The system cannot be master-grade while:
- prompt registry defines one identity,
- fallback persona defines another,
- client surfaces inject another large persona.

Master target:
- one server-authoritative base identity,
- clearly scoped modifiers only,
- no large client-side parallel persona definitions for canonical chat.

### 5.2 One language truth

The system cannot be master-grade while multiple layers disagree on whether the model should follow:
- UI locale,
- user message language,
- per-mode language hints.

Master target:
- one primary language rule,
- one explicit fallback rule,
- one regression suite for multilingual and language-switch scenarios.

### 5.3 Honest scope and source control

The system cannot be master-grade while source controls are partly user promise and partly soft prompt wording.

Master target:
- scope controls govern actual retrieval/context assembly,
- answer metadata reflects real evidence classes,
- the assistant never implies grounding it did not have.

### 5.4 Fail-safe trust behavior

The system cannot be master-grade while privacy, prompt assembly or retrieval failures degrade silently without strong product semantics.

Master target:
- explicit degraded states,
- mode-specific fail-open vs fail-closed rules,
- enterprise-safe defaults for sensitive flows.

### 5.5 Governed release activation

The system cannot be master-grade while prompt publish is not one fully governed runtime activation artifact.

Master target:
- one release object,
- one activation step,
- one response-level trace back to the release artifact.

---

## 6. What is already strong

The repo already has unusually strong foundations:
- prompt assembler,
- prompt registry and versions,
- eval harness primitives,
- release bundle primitives,
- product docs for prompt composition and prompt text quality.

This means the problem is no longer lack of capability.
The problem is finishing convergence from:
- `good architecture`
to
- `master operating system`.

---

## 7. Required changes by system layer

### 7.1 Prompt architecture

Required target changes:
- deprecate prompt identity ownership outside canonical server path,
- freeze one exact precedence model,
- classify every prompt source as `base`, `modifier`, `evidence`, `personalization`, or `legacy`.

### 7.2 Runtime behavior

Required target changes:
- enforce scope controls in retrieval/context path,
- unify memory precedence,
- unify language selection,
- surface degraded mode signals,
- stamp every answer with full runtime prompt provenance.

### 7.3 Governance and rollout

Required target changes:
- one prompt mutation path,
- atomic publish of prompt/model/fallback/policy,
- bundle enforcement for all critical chat surfaces,
- mandatory eval gate before activation.

### 7.4 Quality operations

Required target changes:
- canonical golden-set suite for main chat,
- behavioral prompt rubrics,
- regression review workflow,
- version-aware cost and latency monitoring.

### 7.5 Product surfaces

Required target changes:
- reduce bespoke prompt overlays in non-canonical shells,
- align full chat, split chat and workspace AI surfaces to one prompt spine,
- define co-thinker behavior as measurable deltas, not only narrative personas.

---

## 8. Recommended execution order

### Fala 1 - Prompt truth hardening

Cel:
- one identity,
- one language rule,
- one prompt API truth.

Definition of done:
- client-side parallel persona overlays are classified and reduced,
- one canonical language policy is documented and enforced,
- legacy prompt mutation path is neutralized or reclassified.

### Fala 2 - Trust and scope hardening

Cel:
- source honesty,
- retrieval scope truth,
- memory/privacy predictability.

Definition of done:
- scope controls map to real runtime filtering behavior,
- grounded vs ungrounded answer semantics are explicit,
- memory failure modes are documented and product-visible where required.

### Fala 3 - Eval and release hardening

Cel:
- changes become governed by evidence, not intuition.

Definition of done:
- golden chat suites exist,
- eval gate is required for critical prompt changes,
- release activation carries prompt/model/policy/bundle truth together.

### Fala 4 - Excellence and optimization

Cel:
- experimentation, prompt budgets, ops excellence.

Definition of done:
- A/B runtime assignment is canonical,
- prompt quality rubrics are formalized,
- prompt version cost and latency regressions are monitored,
- rollback and incident workflow is explicit.

---

## 9. Acceptance criteria for prompt mastery

Prompt mastery can be considered achieved only when:

1. Every canonical chat response can be traced to:
   - `prompt_key`
   - `prompt_version`
   - release artifact
   - model selection
   - policy version
   - applied modes
   - actual source classes

2. User-visible source controls map to real retrieval/context behavior.

3. There is one authoritative language rule and it passes multilingual regression scenarios.

4. There is one authoritative base identity and all co-thinker or mode prompts act as scoped modifiers.

5. Critical prompt changes cannot be activated without governed evaluation.

6. Prompt regressions can be detected, attributed and rolled back without guesswork.

7. Prompt text quality is measured behaviorally, not only reviewed stylistically.

---

## 10. Anti-patterns that must be removed

- large client-side persona prompts shaping canonical chat,
- conflicting language rules in multiple layers,
- source controls that do not really constrain data,
- co-thinkers behaving like replacement assistant identities,
- silent fail-soft fallback in trust-sensitive cases,
- prompt experiments that exist in admin but not in deterministic runtime,
- prompt tuning based on preference instead of eval deltas,
- missing response-level provenance for prompt and policy state.

---

## 11. Strategic conclusion

`Chat v8` is already beyond basic prompt maturity.

What still blocks master-level quality is not lack of prompts, but lack of total convergence between:
- prompt content,
- runtime assembly,
- retrieval truth,
- privacy semantics,
- evaluation discipline,
- and governed rollout.

The path to mastery is therefore:
- reduce parallel prompt worlds,
- harden truth contracts,
- make evaluation mandatory,
- and make every answer operationally explainable.

Related specs:
- `CHAT_V8_PROMPT_SYSTEM_AND_COMPOSITION.md`
- `CHAT_V8_PROMPT_CONTENT_AND_QUALITY.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MODES_AND_SCOPE_MODEL.md`
- `CHAT_V8_AI_GOVERNANCE.md`
- `CHAT_V8_IMPLEMENTATION_PLAN.md`
