# Knowledge RAG v8 - Implementation plan

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Precyzyjna strategia wdrozenia knowledge/RAG w `consultify` tak, aby user-private knowledge i organization-shared knowledge byly oddzielone, a jednoczesnie efektywnie wykorzystywane przez chat, execution agent i workerow.

---

## 1. Strategic intent

Nie budujemy "kolejnego uploadu plikow do AI".

Budujemy jedna warstwe `Knowledge/RAG` dla calej aplikacji, w ktorej:
- prywatna wiedza usera pozostaje prywatna,
- wiedza wspolna organizacji jest wspolna i governowana,
- workerzy i agenci konsumuje knowledge przez policy-aware gateway,
- short-term memory jest `run-scoped working memory`, a nie drugim dokument store,
- tenant isolation jest twarde strukturalnie, nie tylko umowne.

---

## 2. Core product decisions

### 2.1 No direct user-to-user retrieval

Wiedza usera A nie jest retrieval source dla usera B tylko dlatego, ze sa w tej samej organizacji.

Bezpieczna wspolpraca ma isc przez:
- org-shared corpus,
- lub przyszly explicit shared space zbudowany na tej samej governance.

### 2.2 Org corpus is the canonical shared layer

Jesli cos ma byc dostepne dla wielu userow w jednej organizacji, powinno trafic do org-governed corpus.

### 2.3 Personalization is not the same as private knowledge corpus

Musimy rozdzielic:
- lightweight memory/preferences,
- private durable documents and notes,
- org-shared knowledge,
- system knowledge.

### 2.4 Retrieval must be policy-first

Security and scope selection happen before ranking and prompt assembly.

---

## 3. Target architecture

### 3.1 Canonical layers

`consumer surface -> working memory orchestrator -> retrieval policy gateway -> scope-specific retrievers -> reranker -> source ledger -> prompt/context assembler`

### 3.2 Canonical data domains

The system should converge to:

- `KnowledgeObjectRegistry`
- `KnowledgeChunkStore`
- `UserPrivateMemoryStore`
- `OrganizationKnowledgeStore`
- `WorkingMemoryOrchestrator`
- `RunStateLedger`
- `IssueSummaryStore`
- `RetrievalPolicyGateway`
- `KnowledgePromotionWorkflow`
- `KnowledgeUsageAudit`

### 3.3 Consumer model

Consumers do not own knowledge architecture.

They only declare:
- task type,
- active artifact context,
- allowed scope budget,
- need for approval-sensitive sources.

---

## 4. Workstreams

## 4.1 Workstream A - Canonical ownership and schema unification

Goal:
- remove semantic fragmentation.

Scope:
- unify `knowledge_docs` vs `knowledge_documents`,
- unify `ai_org_memory` / `ai_organization_memory` / `organization_memory` roles,
- define one canonical registry schema,
- define one canonical chunk metadata model.

Deliverables:
- storage truth map,
- canonical registry schema,
- migration strategy,
- compatibility mapping for legacy tables.

Acceptance criteria:
- every retrievable object has one canonical ownership record,
- governance and retrieval point to the same document identity,
- table naming ambiguity is removed from architecture docs.

## 4.2 Workstream B - User-private knowledge method

Goal:
- create explicit user-private knowledge model.

Scope:
- separate user preferences from user private corpus,
- define private uploads / notes / saved knowledge entries,
- align with private mode and retention settings,
- add delete/export boundaries.

Deliverables:
- `user-private` object model,
- explicit write/read rules,
- privacy-aware storage and deletion flows,
- UX contract for managing private knowledge.

Acceptance criteria:
- user-private corpus is first-class,
- another user cannot retrieve from it,
- personalization and private knowledge are documented separately.

## 4.3 Workstream C - Organization-shared knowledge method

Goal:
- make org knowledge the canonical cross-user knowledge layer.

Scope:
- org document library,
- org memory patterns,
- terminology and standards,
- document visibility/sensitivity,
- admin and curator workflows.

Deliverables:
- org corpus management model,
- visibility/sensitivity contract,
- promotion intake path,
- usage audit requirements.

Acceptance criteria:
- org-shared knowledge is the only default cross-user retrieval source,
- tenant isolation is structurally encoded,
- admin governance is explicit.

## 4.4 Workstream D - Knowledge promotion workflow

Goal:
- control movement from private knowledge to shared knowledge.

Scope:
- user -> org promotion,
- project/artifact -> org pattern extraction,
- review/approval for promotion,
- provenance preservation.

Deliverables:
- promotion state machine,
- approval rules,
- provenance model,
- audit log contract.

Acceptance criteria:
- private knowledge never becomes shared silently,
- org patterns keep source traceability,
- promotion is reviewable and reversible where possible.

## 4.5 Workstream E - Retrieval policy gateway

Goal:
- create one governed retrieval entrypoint for all AI consumers.

Scope:
- pre-filtering by tenant, user, scope, visibility and sensitivity,
- per-task scope budgeting,
- merge/rerank logic,
- document approval handling,
- retrieval usage logging.

Deliverables:
- gateway contract,
- scope-resolution rules,
- retrieval audit ledger,
- consumer integration guidelines.

Acceptance criteria:
- consumers do not bypass policy by querying storage directly,
- scope filtering happens before semantic ranking,
- used/blocked sources are auditable.

## 4.6 Workstream F - Consumer integration

Goal:
- connect the shared knowledge layer to real product surfaces.

Initial consumers:
- `Chat v8`
- `Execution Agent`
- `Virtual Workers`
- `Deep Research`

Deliverables:
- consumer-specific retrieval presets,
- allowed scope matrices,
- source transparency rules,
- prompt/context contracts.

Acceptance criteria:
- same knowledge object can be safely reused by multiple consumers,
- each consumer remains bounded by its own allowed scopes,
- worker assignments become overlays, not separate governance.

---

## 5. Canonical method for user-private knowledge

### 5.1 What belongs here

- explicit personal instructions,
- personal preferences,
- private uploads,
- private notes,
- user-saved reusable snippets,
- optional personal working memory.

### 5.2 Who can read it

- the same user,
- tightly bounded system processes acting on behalf of that user,
- nobody else by default.

### 5.3 When it is used

- personal drafting,
- recurring user formatting/style,
- user-specific workflows,
- optional assistance in execution runs when user context is relevant.

### 5.4 What it must not do

- become shared knowledge by accident,
- influence another user's answers,
- masquerade as org policy.

---

## 6. Canonical method for organization-shared knowledge

### 6.1 What belongs here

- company docs,
- standards,
- policies,
- templates,
- org memory patterns,
- approved lessons and best practices,
- promoted knowledge from users/projects.

### 6.2 Who can read it

- users in the same tenant with matching permissions,
- approved workers/agents acting within the same tenant scope.

### 6.3 When it is used

- org-grounded chat,
- execution runs,
- shared workflows,
- worker personas,
- deep research with internal grounding.

### 6.4 What it must not do

- cross tenant boundaries,
- override role-based restrictions,
- silently include confidential docs without governance.

---

## 7. Rules for knowledge exchange inside one organization

### Rule 1

Private user memory is not a team knowledge base.

### Rule 2

If multiple users should benefit from it, it must be promoted to an org-governed shared layer.

### Rule 3

Worker assignments never expand access beyond what the underlying knowledge object allows.

### Rule 4

Project-specific shared knowledge can exist as a visibility slice of org knowledge, but still under org governance.

---

## 8. Rules for knowledge exchange between organizations

### Rule 1

No raw doc, chunk, embedding, user memory or org memory crosses tenant boundary.

### Rule 2

Global reuse is allowed only for platform-owned or explicitly anonymized and curated knowledge.

### Rule 3

Benchmarks or aggregate learning must be de-identified and stored in a separate global dataset, never as accidental spillover from tenant corpora.

---

## 9. Delivery waves

### Wave 1 - Freeze doctrine

Ship:
- canonical scope model,
- canonical ownership model,
- canonical storage truth map,
- explicit rule: no direct user-to-user retrieval.

### Wave 2 - Unify storage

Ship:
- one canonical document registry,
- one chunk metadata model,
- mapped legacy compatibility layer,
- governance aligned to actual document table.

### Wave 3 - Build user-private method

Ship:
- explicit private knowledge corpus,
- privacy-aware CRUD,
- retention/deletion/export boundaries,
- clear UX control model.

### Wave 4 - Harden org-shared method

Ship:
- org corpus governance,
- visibility and sensitivity controls,
- promotion workflow,
- admin/curator tooling.

### Wave 5 - Central retrieval gateway

Ship:
- scope-aware retrieval gateway,
- audit logs,
- consumer presets,
- blocked/approved source handling.

### Wave 6 - Consumer adoption

Ship:
- Chat v8 integration,
- Execution Agent integration,
- Virtual Worker alignment,
- Deep Research alignment.

---

## 10. Priority order

1. Freeze doctrine and ownership model.
2. Unify storage and governance schema.
3. Separate user-private corpus from user personalization.
4. Build org-governed promotion path.
5. Move all consumers behind one retrieval gateway.
6. Harden audit, retention and admin controls.

---

## 11. Non-negotiable implementation rules

- No new AI surface may create its own private knowledge schema without mapping to the canonical model.
- No consumer may bypass retrieval policy gateway for durable corpora.
- No cross-user retrieval from private memory.
- No cross-tenant retrieval from org knowledge.
- No silent promotion from private to shared knowledge.
- No governance model that depends on post-hoc filtering only.

---

## 12. Definition of done

This strategy is implemented when:
- user-private and organization-shared knowledge are structurally separate,
- org-sharing no longer depends on accidental reuse of user memory,
- tenant isolation is enforced in storage and retrieval,
- knowledge promotion has provenance and review,
- all major AI consumers use one governed retrieval layer,
- security and efficiency are both properties of the architecture, not best effort.

Related docs:
- `AGENT_AND_KNOWLEDGE_V8_MASTER_PLAN.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `KNOWLEDGE_RAG_V8_AS_IS.md`
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
- `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
