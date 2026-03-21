# Knowledge RAG v8 - As is

> Status: Draft v8
> Cel: Uczciwie opisac obecny runtime knowledge/RAG, wskazac, co juz istnieje, co jest wartosciowym fundamentem, a co jest dzis rozproszone, niespojnie nazwane lub niebezpieczne jako docelowy model.

---

## 1. Executive verdict

`consultify` ma juz realne fundamenty pod silny system wiedzy:
- local chunking and embeddings,
- org-scoped document uploads,
- user memory,
- org memory,
- privacy toggles,
- worker knowledge assignments,
- document-approval intent.

Ale ten runtime nie jest jeszcze jednym systemem.

Obecny stan najlepiej opisac tak:
- `retrieval exists`
- `memory exists`
- `org knowledge exists`
- `worker knowledge scoping exists`
- `governance intent exists`
- `one canonical user/org RAG architecture does not exist yet`

---

## 2. What already exists

### 2.1 User memory exists

Relevant runtime:
- `server/src/services/ai/aiMemoryService.ts`
- `server/src/routes/ai/aiMemory.routes.ts`
- `server/src/services/ai/userStyleProfileService.ts`
- `server/src/services/ai/userPrivacyService.ts`
- `server/src/services/ai/AIPipeline.ts`

What exists:
- user preferences and lightweight memory storage,
- user-editable memory keys,
- adaptive style/profile layer,
- privacy settings controlling memory read/write,
- private mode / retention hooks.

Value:
- strong foundation for `user-private RAG` and personalization.

Constraint:
- current user memory is a mix of:
  - key/value memory,
  - preference object storage,
  - style-learning profile,
  - prompt custom instructions.

It is not yet one clean canonical model.

### 2.2 Organization memory exists

Relevant runtime:
- `server/src/services/ai/organizationMemoryStore.ts`
- `server/src/services/ai/aiMemoryService.ts`
- `server/src/services/aiContextBuilder.ts`
- `server/src/services/aiMemoryManager.ts`

What exists:
- org terminology and context,
- org-wide patterns and lessons,
- applicability/usage-style pattern storage,
- org-level context injection in pipeline.

Value:
- strong foundation for `organization-shared RAG`.

Constraint:
- there are multiple org-memory models and table names in use:
  - `ai_org_memory`
  - `ai_organization_memory`
  - `organization_memory`

This is a major architectural inconsistency.

### 2.3 Organization document corpus exists

Relevant runtime:
- `server/src/services/KnowledgeService.ts`
- `server/src/routes/knowledge.routes.ts`
- `server/src/services/ragService.ts`
- `server/src/services/ai/knowledgeIndexer.ts`

What exists:
- document upload,
- chunking,
- embeddings,
- indexed chunk storage,
- org-scoped listing,
- retrieval against selected document IDs.

Important current behavior:
- knowledge upload route currently forces knowledge documents to organization scope,
- upload path explicitly sets `project_id = null`,
- files are stored under org directory.

Value:
- current product already treats durable knowledge docs mainly as org-level corpus.

Constraint:
- user-private upload corpus is not first-class in the same model.

### 2.4 Retrieval engine exists

Relevant runtime:
- `server/src/services/ragService.ts`
- `server/src/services/ai/externalRagProvider.ts`

What exists:
- vector search,
- BM25/hybrid logic,
- optional reranking,
- scoping by `organizationId`,
- scoping by `documentIds`,
- external provider abstraction.

Value:
- strong retrieval core already exists.

Constraint:
- retrieval policy is not yet one canonical ownership/security model across all scopes.

### 2.5 Worker knowledge scoping exists

Relevant runtime:
- `server/src/services/ai/virtualWorkerKnowledgeService.ts`
- `server/src/services/ai/virtualWorkerService.ts`
- `server/src/routes/virtual-workers.routes.ts`

What exists:
- per-worker knowledge assignments,
- product/doc-scoped retrieval for workers,
- weighted prioritization,
- worker-safe contextual bootstrap.

Value:
- strong evidence that knowledge consumers can be scoped.

Constraint:
- this is consumer-level scoping, not canonical knowledge governance.

---

## 3. Current structural problems

## 3.1 Storage and naming fragmentation

Current runtime uses multiple overlapping names:
- `knowledge_docs`
- `knowledge_documents`
- `ai_org_memory`
- `ai_organization_memory`
- `organization_memory`

This means the platform currently has:
- more than one semantic storage model,
- unclear source of truth,
- risk that governance and retrieval do not apply to the same objects.

## 3.2 Document governance is not aligned to document storage

Relevant runtime:
- `server/src/services/ai/documentGovernance.ts`

Problem:
- governance code targets `knowledge_documents`,
- document upload/listing runtime centers around `knowledge_docs`.

Interpretation:
- governance intent exists,
- canonical enforcement path is not yet structurally aligned.

## 3.3 User-private knowledge is under-modeled

Today the platform has:
- user memory,
- user style profile,
- private mode semantics,

but does not yet have one explicit first-class `user-private document corpus` parallel to org corpus.

## 3.4 Cross-user sharing model is implicit, not explicit

Today:
- org docs can be used across users in the same tenant,
- user memory is per-user,

but there is no one canonical doctrine saying:
- what can move from user to org,
- what remains private forever,
- what a shared-within-org intermediate state looks like.

## 3.5 Retrieval policy is partly scope-aware, but not one gateway

Scope signals exist in many places:
- `organizationId`
- `documentIds`
- private mode
- document approval
- worker assignment

But they are not yet unified in one policy-first retrieval gateway.

---

## 4. Useful current patterns to keep

### 4.1 Privacy gating before memory use

`AIPipeline` already distinguishes:
- `memoryEnabled`
- `privateMode`
- `retentionMode`
- `memoryReadAllowed`

This is the right foundation for user-private retrieval control.

### 4.2 Org-level durable knowledge docs

`knowledge.routes.ts` already treats durable uploads as organization-scoped.

This is a good default for shared corpora.

### 4.3 Document-level approval idea

`documentGovernance.ts` already models:
- `allowed`
- `requires_approval`
- `blocked`

This is the right semantic direction even if storage alignment is not finished.

### 4.4 Consumer-specific scoping

Virtual workers already show a strong principle:
- consumer surfaces should not query the whole world,
- they should retrieve from assigned corpora.

This principle should become universal.

---

## 5. Current-state interpretation by scope

### 5.1 Session scope

Status:
- exists in chat attachments and conversation context,
- not unified with durable knowledge lifecycle.

### 5.2 User-private scope

Status:
- exists for memory and personalization,
- weak or missing as first-class private document corpus.

### 5.3 Organization-shared scope

Status:
- strongest existing knowledge scope,
- already used for uploads, org memory and context building.

### 5.4 System scope

Status:
- exists via methodology/core docs and indexers,
- uses partly different storage model from app knowledge.

### 5.5 External scope

Status:
- abstraction exists,
- governance and unification with other scopes are still partial.

---

## 6. Security assessment of the current state

### Strengths

- org scoping exists in multiple places,
- user privacy toggles exist,
- memory deletion/export direction exists,
- worker knowledge can be scoped,
- document approval concept exists.

### Risks

- fragmented schemas can create silent bypasses,
- private vs shared semantics are not uniformly encoded,
- governance and document storage may point at different tables,
- cross-user sharing doctrine is not explicitly frozen,
- some consumers may be safer than the overall platform contract.

---

## 7. Strategic conclusion

`consultify` does not need greenfield RAG architecture.

It already has:
- retrieval engine,
- org corpus,
- user memory,
- org memory,
- privacy controls,
- worker scoped retrieval.

But it urgently needs unification around:
- one ownership model,
- one document registry,
- one user-vs-org doctrine,
- one policy-first retrieval gateway,
- one explicit promotion path from private to shared knowledge.

That is the real as-is conclusion.

Related docs:
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
