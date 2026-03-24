# AI Memory Lifecycle Architecture v8

> Status: Draft v8
> Owner: Product + Engineering
> Cel: zdefiniowac kanoniczny model cyklu zycia pamieci AI: `capture`, `working state`, `promotion`, `freshness`, `retention` i `deletion`.

---

## 1. Why this matters for Consultify

Pamiec AI jest wartoscia tylko wtedy, gdy pozostaje:

- trafna,
- aktualna,
- bezpieczna,
- i usuwalna wtedy, kiedy wymaga tego polityka albo user.

Bez cyklu zycia pamieci system popada w:

- context rot,
- stale recommendations,
- niekontrolowany wzrost kosztu,
- i ryzyko governance.

---

## 2. Leader patterns

Imported patterns:

- short-term memory should be bounded and task-scoped,
- durable memory should not silently absorb all session state,
- teams need clear private vs shared memory boundaries,
- freshness and deletion are part of reliability, not only compliance.

---

## 3. Current V8 coverage

Strong inputs:

- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
- `KNOWLEDGE_RAG_V8_GAP_MATRIX.md`

Current gap:

- brak jednego dokumentu, ktory normatywnie spina working memory, durable memory, freshness, retention cascade i deletion semantics.

---

## 4. Canonical target architecture

Canonical lifecycle:

`capture -> classify -> use in working state -> decide durability -> promote or expire -> refresh or archive -> delete and cascade`

Required memory layers:

- `ephemeral session memory`
- `working memory`
- `user-private durable memory`
- `organization durable knowledge`
- `archived memory`

Required control objects:

- `MemoryRetentionPolicy`
- `FreshnessState`
- `PromotionDecision`
- `DeletionCascadeRecord`

## 4.1 Leader-grade hardening requirements

This architecture must also define:

- TTL and refresh expectations per memory layer,
- compaction and summarization rules for working memory,
- promotion thresholds from ephemeral state into durable knowledge,
- delete cascade from source object to chunk, embedding, summary and citation trace,
- operator visibility into stale or policy-blocked memory.

---

## 5. Contracts and boundaries

`Knowledge RAG v8` owns scope and retrieval governance.

`Working Memory Architecture v8` owns bounded active context behavior.

This document owns:

- the lifecycle between ephemeral and durable layers,
- freshness expectations,
- retention and deletion doctrine across layers.

---

## 6. Risks and failure modes

- transient context silently becomes durable memory,
- deleted source remains retrievable through stale chunks,
- working memory grows without compaction,
- archived content still influences live answers,
- users cannot tell what the system remembers and why.

---

## 7. Implementation implications

- define one memory state machine across layers,
- enforce delete cascade from source to chunks, embeddings and derived summaries,
- attach freshness status to retrievable knowledge,
- standardize promotion from private or session state into governed durable knowledge.

---

## 8. Acceptance criteria

- Memory layers have distinct creation, use and deletion rules.
- Deletion cascades to derived retrieval artifacts.
- Freshness can be inspected for retrievable knowledge.
- Working memory remains bounded and compactable.
- Users and operators can distinguish ephemeral, private and shared memory behavior.

---

## 9. Related canonical docs

- `docs/product/CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `docs/product/KNOWLEDGE_RAG_V8_SSOT.md`
- `docs/product/KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
- `docs/product/KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
- `docs/product/AI_LEADER_PARITY_ARCHITECTURE_V8.md`
