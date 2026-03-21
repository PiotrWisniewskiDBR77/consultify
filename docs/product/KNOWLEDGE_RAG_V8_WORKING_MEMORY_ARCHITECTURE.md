# Knowledge RAG v8 - Working Memory Architecture

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Zdefiniowac docelowa architekture `short-term memory` dla `consultify` tak, aby AI moglo efektywnie pracowac na duzej liczbie dokumentow organizacji bez wrzucania calego corpus do promptu.

---

## 1. Why this document exists

`KNOWLEDGE_RAG_V8_SSOT.md` definiuje ownership, scope i governance wiedzy.

Ten dokument dopowiada brakujaca warstwe:

- jak ma wygladac `working memory`,
- jak system ma pracowac na duzych corpora dokumentow,
- jak ma utrzymywac wysoka efektywnosc bez context bloat,
- jak ma rozdzielac `run state` od `durable knowledge`.

To jest dokument o `short-term memory`, ale w `consultify` canonical term brzmi:

`working memory`

bo chodzi nie o "pelna historie rozmowy", tylko o `aktywny stan pracy`.

---

## 2. Nadrzedna decyzja

W `consultify` short-term memory NIE jest:

- pelnym chat logiem,
- drugim dokument store,
- ukrytym dumpem calego retrieval context,
- nieograniczonym zlepkiem message history, tool outputs i attachment text.

W `consultify` short-term memory JEST:

- `run-scoped working memory`,
- budzetowanym zbiorem aktywnego kontekstu,
- warstwa `task state`,
- mechanizmem `select -> compact -> carry forward`,
- mostem miedzy retrieval a execution.

Najwazniejsza zasada:

`large knowledge corpus stays in retrieval/storage layers; working memory keeps only the active subset needed for the current run step`

---

## 3. Problem we must solve

`consultify` nie buduje prostego chatbota.

Budujemy system, w ktorym AI ma:

- pracowac na dokumentach usera i organizacji,
- obslugiwac dlugie watki i wieloetapowe execution runs,
- przechodzic miedzy artefaktami aplikacji,
- utrzymywac auditability i source honesty,
- nie gubic celu mimo wielu issue i wielu dokumentow.

Bez osobnej architektury `working memory` system wpada w trzy bledy:

- `context flood`: prompt puchnie od starych tur i tool payloads,
- `retrieval blur`: do promptu trafia za duzo chunkow zbyt slabo zwiazanych z aktualnym krokiem,
- `state loss`: system nie umie zachowac tego, co faktycznie jest aktywnym stanem pracy.

---

## 4. Architectural principles

### 4.1 Active, not exhaustive

Working memory trzyma tylko to, co jest aktywne dla biezacego celu.

### 4.2 Run-scoped, not tenant-scoped

Working memory jest przypisana do:

- `thread`,
- `run`,
- `issue branch`,
- `active artifact context`.

Nie istnieje jedna wspolna short memory dla calej organizacji.

### 4.3 Retrieval-fed, not retrieval-replacing

Working memory nie zastepuje RAG.

RAG dostarcza kandydatow.
Working memory wybiera i utrzymuje tylko aktywny zestaw roboczy.

### 4.4 Compaction after every meaningful step

Po kazdym kroku system powinien:

- zachowac to, co nadal aktywne,
- skompresowac to, co juz wykonane,
- wyrzucic to, co stale albo redundantne.

### 4.5 Issue-based organization

Przy duzych zadaniach kontekst nie moze byc jedna plaska lista.

System musi utrzymywac:

- `active issue cards`,
- `current goal`,
- `current plan step`,
- `open questions`,
- `pinned evidence`.

### 4.6 Resume and handoff first

Working memory ma byc projektowana tak, aby:

- run mogl byc wznowiony,
- inny agent lub operator mogl przejac zadanie,
- system nie musial odtwarzac calej historii od zera.

### 4.7 Policy-aware before assembly

Do working memory moze wejsc tylko kontekst dozwolony przez:

- tenant boundary,
- scope policy,
- document visibility,
- sensitivity rules,
- consumer-specific permissions.

---

## 5. Canonical object model

## 5.1 Run

Jednostka aktywnej pracy AI.

Contains:

- `run_id`
- `consumer_type`
- `thread_id`
- `organization_id`
- `user_id`
- `task_type`
- `active_artifact_refs`
- `status`

## 5.2 Working memory state

Glowny obiekt runtime:

- `goal_state`
- `active_issue_cards`
- `active_document_set`
- `tool_state_digest`
- `evidence_pins`
- `open_questions`
- `constraints`
- `handoff_summary`

## 5.3 Active issue card

Minimalna jednostka poznawcza dla jednego sub-problemu.

Contains:

- `issue_id`
- `issue_label`
- `current_status`
- `current_hypothesis`
- `needed_evidence`
- `resolved_facts`
- `open_risks`
- `next_action`

## 5.4 Active document set

Zestaw dokumentow i chunkow aktywnie trzymanych w pamieci roboczej.

Contains:

- `document_refs`
- `selected_chunk_refs`
- `why_selected`
- `last_used_at`
- `eviction_priority`

## 5.5 Tool state digest

Skompresowany stan wynikow narzedzi.

Contains:

- `tool_name`
- `action_performed`
- `result_summary`
- `important_ids`
- `important_deltas`
- `raw_payload_ref`

Raw payload NIE powinien byc stale trzymany w prompt context.

## 5.6 Evidence pin

Jawnie przypiety dowod, ktory ma wysokie znaczenie dla biezacego runu.

Contains:

- `source_ref`
- `quote_or_fact`
- `relevance_reason`
- `confidence`

## 5.7 Handoff pack

Minimalny zestaw do wznowienia pracy bez replay calej historii.

Contains:

- `current_goal`
- `where_we_are`
- `what_is_done`
- `what_is_blocked`
- `what_sources_matter`
- `what_to_do_next`

---

## 6. Target architecture

### 6.1 Canonical layers

`consumer surface -> working memory orchestrator -> retrieval policy gateway -> scope-specific retrievers -> reranker -> working set selector -> prompt/context assembler -> model/tool loop -> compaction pipeline -> run state ledger`

### 6.2 Main components

#### A. Run State Ledger

Persistent store for:

- run metadata,
- branch state,
- issue cards,
- handoff summaries,
- context assembly decisions.

Purpose:
- resume,
- audit,
- replay of state transitions,
- operator visibility.

#### B. Working Memory Orchestrator

Canonical owner of runtime memory assembly.

Responsibilities:

- load current run state,
- request retrieval with scope budget,
- decide what stays active,
- evict stale items,
- trigger summary/compaction,
- hand prompt-ready context to assembler.

#### C. Retrieval Policy Gateway

Reused from `Knowledge RAG v8`.

Responsibilities:

- resolve allowed scopes,
- pre-filter by tenant and ACL,
- retrieve candidates,
- log source usage eligibility.

#### D. Working Set Selector

Selects the minimal active subset from retrieved candidates.

Responsibilities:

- score by task relevance,
- prefer currently active artifact family,
- avoid repeated chunk injection,
- keep only top evidence needed now.

#### E. Issue Summary Engine

Maintains structured mini-summaries per issue/subtask.

Responsibilities:

- compress resolved turns,
- preserve commitments and constraints,
- isolate issue-specific state,
- support pause/resume and branching.

#### F. Tool Result Compactor

Turns verbose tool outputs into durable runtime digests.

Responsibilities:

- extract IDs, status, deltas and blockers,
- keep reference to raw output outside prompt,
- prevent payload explosion in subsequent turns.

#### G. Document Working Set Manager

Manages active documents for current run step.

Responsibilities:

- pin currently relevant docs,
- expire stale docs,
- replace broad corpus with focused doc slices,
- keep provenance to exact chunks/pages.

#### H. Handoff and Resume Builder

Produces stable resumable state.

Responsibilities:

- create run summary after major step,
- produce branch-specific handoff pack,
- allow execution agent / chat / operator takeover.

#### I. Prompt and Context Assembler

Final context builder for model call.

Responsibilities:

- assemble only bounded working context,
- merge policy, run state, active evidence and instructions,
- keep source transparency metadata.

---

## 7. Canonical context budget model

Working memory must use explicit budget slices.

Suggested target model:

| Slice | Target share | Purpose |
|---|---:|---|
| System and policy instructions | 10-15% | Safety, governance, role, permissions |
| Goal and plan state | 10-15% | What the run is doing now |
| Active issue cards | 15-20% | Sub-problems, blockers, next actions |
| Active evidence and doc chunks | 30-40% | Only the most relevant source material |
| Tool state digests | 10-15% | Results of executed actions without raw payload bloat |
| Handoff / session summary | 5-10% | Condensed continuity |
| Free headroom | 10-15% | For model reasoning and fresh outputs |

Rules:

- no single slice should silently consume the whole budget,
- raw tool payloads should not live in repeated turns,
- large attachments should become summaries plus pinned evidence,
- if evidence budget overflows, router/selector must narrow scope instead of expanding prompt size.

---

## 8. Lifecycle

## 8.1 Intake

System records:

- user intent,
- consumer type,
- active artifact context,
- preliminary task type.

## 8.2 Scope resolution

System asks `Retrieval Policy Gateway`:

- what scopes are allowed,
- which visibility constraints apply,
- whether user-private, org or system knowledge can be used.

## 8.3 Candidate retrieval

System retrieves candidate evidence from allowed scopes only.

At this stage there can still be many candidates.

## 8.4 Working set assembly

`Working Set Selector` narrows candidates to:

- active documents,
- pinned chunks,
- active issue summaries,
- current goal state.

## 8.5 Execute and compact

After each major model/tool step:

- save result digest,
- update issue cards,
- refresh active document set,
- compress old turns into structured summaries.

## 8.6 Branch or switch issue

If the run changes sub-problem:

- close or park current issue card,
- open a new issue card,
- keep only branch-relevant context active.

## 8.7 Handoff / resume

On pause, approval wait, escalation or long inactivity:

- produce `handoff pack`,
- persist resumable state,
- drop non-essential live context.

## 8.8 Close

On completion:

- finalize run summary,
- keep provenance and audit,
- optionally emit durable facts to governed memory stores only through explicit write policies.

---

## 9. How we handle large organization corpora

### 9.1 Router before overload

For broad org knowledge, the first decision should often be:

`which vertical or library should answer this`

not:

`which 200 chunks should go into the prompt`

### 9.2 Active document family

Per issue, system should prefer one active family at a time, for example:

- legal/policy,
- delivery standards,
- financial docs,
- project materials,
- initiative history.

Mixing too many families in one step lowers precision.

### 9.3 Pinned evidence over repeated retrieval flood

If a chunk is repeatedly useful, it should become:

- `evidence_pin`,
- or part of issue summary,

instead of being rediscovered and reinjected every turn.

### 9.4 Hierarchical compression for large docs

For very large docs:

- chunk,
- summarize chunk groups,
- create section summaries,
- keep exact quotes only for currently active evidence.

### 9.5 Eviction rules

Document context should be evicted when:

- it has not been used for several steps,
- the run changed issue branch,
- a better source superseded it,
- it no longer fits the active budget.

Eviction should keep provenance, not erase auditability.

---

## 10. Consumer presets

## 10.1 Chat

Primary need:

- continuity,
- active issue tracking,
- lightweight source-grounded assistance.

Default memory bias:

- more recent turns,
- active attachments,
- concise issue summaries,
- bounded org/user retrieval.

## 10.2 Execution Agent

Primary need:

- plan state,
- artifact deltas,
- tool result digests,
- approval status,
- pinned evidence tied to actions.

Default memory bias:

- stateful run memory over conversational history,
- stronger tool compaction,
- stricter evidence pinning,
- explicit next-step and blocker tracking.

## 10.3 Virtual Workers

Primary need:

- consistent persona behavior,
- narrow assigned knowledge vertical,
- low drift.

Default memory bias:

- minimal working memory,
- assigned corpus only,
- limited branch complexity.

## 10.4 Deep Research

Primary need:

- long-running evidence synthesis,
- many candidate sources,
- explicit notebook-like state.

Default memory bias:

- stronger issue cards,
- evidence ledger,
- multi-stage summary tree,
- more powerful handoff packs.

---

## 11. Write rules

### 11.1 What may enter working memory automatically

- latest user request,
- current run goal,
- allowed retrieved evidence,
- active attachments,
- tool result digests,
- issue summaries,
- approval state.

### 11.2 What must not become durable memory automatically

- whole conversation dumps,
- raw tool outputs,
- temporary failed hypotheses,
- another user's private context,
- org knowledge derived from private knowledge without promotion flow.

### 11.3 What may be emitted to durable stores

Only through policy-aware write paths:

- approved promoted knowledge,
- curated org patterns,
- explicit user-saved knowledge,
- auditable derived facts.

Working memory is not itself the durable memory layer.

---

## 12. Failure modes and anti-patterns

Do not:

- treat "last 50 messages" as a memory strategy,
- keep whole PDF text in live prompt context,
- re-inject raw tool JSON every turn,
- mix unrelated issue branches in one context pack,
- let retrieval decide memory shape without task-state orchestration,
- let working memory silently become durable memory,
- assume bigger context window removes the need for compaction,
- build one generic memory blob shared by chat, execution and workers.

---

## 13. What this means for `consultify`

`consultify` should implement the following canonical runtime additions:

- `WorkingMemoryOrchestrator`
- `RunStateLedger`
- `IssueSummaryStore`
- `DocumentWorkingSetStore`
- `ToolDigestStore`
- `HandoffPackBuilder`

And it should reuse, not duplicate:

- `RetrievalPolicyGateway`
- scope model from `KNOWLEDGE_RAG_V8_SSOT.md`
- promotion rules from `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- source transparency rules from `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`

This architecture fits the purpose of the app because `consultify` is:

- artifact-native,
- org-governed,
- execution-oriented,
- multi-consumer,
- audit-sensitive.

Therefore it needs:

- small but high-value working memory,
- large but governed retrieval layer,
- explicit bridge between the two.

---

## 14. Definition of done

`Working memory architecture` is complete when:

- short-term memory is formally separated from durable knowledge stores,
- every consumer uses a bounded run-scoped working memory model,
- tool payloads are compacted into digests,
- issue summaries and handoff packs exist,
- active document set is explicit and evictable,
- retrieval feeds working memory instead of replacing it,
- resume, branch and audit are first-class behaviors,
- large organization corpora no longer require prompt flooding to stay effective.

Related docs:

- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_AS_IS.md`
- `KNOWLEDGE_RAG_V8_BENCHMARK.md`
- `KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
- `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `AGENT_EXECUTION_V8_SSOT.md`
