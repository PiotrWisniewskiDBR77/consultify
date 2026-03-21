# Knowledge RAG v8 - SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Cel: Kanoniczna strategia zarzadzania wiedza i retrieval w `consultify`, z osobnym modelem dla `user-private knowledge` i `organization-shared knowledge`, przy twardym zachowaniu tenant isolation i bezpiecznego przeplywu wiedzy.

---

## 1. Decyzja nadrzedna

`RAG management` w `consultify` nie jest agentem.

To jest osobna warstwa systemu odpowiedzialna za:
- ownership wiedzy,
- ingestion i indexing,
- retrieval scope,
- privacy i permissions,
- promotion wiedzy miedzy warstwami,
- audit i retention.

Ta warstwa ma obslugiwac wielu konsumentow:
- chat,
- execution agent,
- virtual workers,
- deep research,
- future copilots i specialized tools.

---

## 1.1 Cross-cutting parity architecture

`Knowledge RAG v8` pozostaje kanonicznym SSOT dla ownership, scope i governance wiedzy.

Przekrojowe warstwy delegowane do pakietu `AI Leader Parity Architecture v8`:

- `docs/product/AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`
- `docs/product/AI_IDENTITY_ROLES_AND_SCOPE_ARCHITECTURE_V8.md`
- `docs/product/AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
- `docs/product/AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

This document still owns:

- knowledge scopes,
- ownership model,
- retrieval policy order,
- promotion and org/private separation.

Current hardening expectation:

- `Knowledge RAG v8` should treat parity docs as the canonical home for enterprise search, identity/scope, memory lifecycle and output trust,
- benchmark and gap status must not mark those topics as closed until parity details are sufficiently hardened,
- no new retrieval path should introduce its own local connector, freshness or provenance rules.

---

## 2. Problem, ktory rozwiazujemy

`consultify` musi umiec jednoczesnie:
- pamietac preferencje i prywatna wiedze usera,
- udostepniac wspolna wiedze organizacji wielu userom,
- nie mieszac prywatnej wiedzy jednego usera z wiedza innych userow,
- nigdy nie mieszac wiedzy tenantow miedzy organizacjami,
- efektywnie wybierac najlepszy retrieval scope dla danego tasku.

To wymaga osobnych metod dla:
- `user-private RAG`
- `organization-shared RAG`

oraz jasnej reguly dla przeplywu wiedzy miedzy tymi warstwami.

---

## 3. Canonical source scopes

`Knowledge RAG v8` rozroznia piec kanonicznych scope'ow:

### 3.1 Session scope

Ephemeral sources for one conversation/run:
- current chat history,
- current attachments,
- temporary URL ingest,
- run-local evidence packs.

Rules:
- not shared to other users by default,
- may expire quickly,
- may be excluded by private mode or retention policy.
- assembled as `working memory`, not as full raw history dump.

### 3.2 User-private scope

Private knowledge owned by one user:
- personal instructions,
- user preferences,
- personal notes and uploads,
- user-curated private knowledge snippets,
- personal working memory.

Rules:
- readable only by this user and bounded system processes,
- never directly retrievable by another user,
- may be promoted upward only through explicit action.

### 3.3 Organization-shared scope

Shared knowledge available inside one organization:
- organization documents,
- policies,
- terminology,
- templates,
- best practices,
- patterns extracted from org work,
- approved shared knowledge libraries.

Rules:
- tenant isolation is mandatory,
- read depends on org membership and permission,
- this is the only canonical path for safe cross-user knowledge sharing inside one org.

### 3.4 System scope

Platform-owned shared knowledge:
- methodology docs,
- core docs,
- help docs,
- product knowledge shipped by the platform.

Rules:
- never contaminated by tenant data,
- reused across all orgs only when intentionally global.

### 3.5 External scope

Non-persisted or separately governed external sources:
- web search,
- external RAG providers,
- connector-loaded documents.

Rules:
- must stay distinguishable from internal memory,
- cannot silently become org or user memory.

---

## 4. Canonical rule for knowledge sharing

### 4.1 Within one organization

Safe knowledge sharing between users must happen through:
- `organization-shared scope`, or
- explicit shared artifact surfaces later built on top of org governance.

It must NOT happen through:
- direct retrieval from another user's private memory,
- hidden reuse of another user's attachments,
- implicit leakage through worker assignments.

### 4.2 Across organizations

Raw knowledge, embeddings, chunks, user memory and org memory are never shared across tenants.

Cross-org sharing is allowed only for:
- platform-owned system knowledge,
- explicitly anonymized and approved benchmark products,
- manually curated global datasets with separate governance.

Default rule:

`no tenant-to-tenant retrieval ever`

---

## 5. Canonical ownership model

Each knowledge object must have:
- `scope_type`: `session | user_private | organization | system | external`
- `owner_type`: `user | organization | platform | connector | run`
- `owner_id`
- `organization_id?`
- `visibility`
- `sensitivity`
- `retention_policy`
- `promotion_state`

This metadata is mandatory for:
- documents,
- chunks,
- vector records,
- memory entries,
- retrieval logs.

---

## 6. Separate methods for user and organization RAG

## 6.1 User-private RAG method

Purpose:
- personalize,
- remember private working context,
- support user-specific drafting and reasoning.

Allowed content:
- personal preferences,
- personal custom instructions,
- private uploads and notes,
- user-owned saved insights.

Read rules:
- only for the same user,
- disabled or reduced by private mode / privacy settings,
- never used to answer another user's query.

Write rules:
- explicit user writes are first-class,
- inferred writes must respect privacy settings,
- session data does not become durable user memory without policy-allowed write path.

Promotion rule:
- private user knowledge may be promoted to org scope only through explicit user or admin flow with review.

## 6.2 Organization-shared RAG method

Purpose:
- ground answers in shared org truth,
- support cross-user continuity,
- power execution, governance, templates and reusable standards.

Allowed content:
- org documents and files,
- approved policies and standards,
- org terminology,
- org memory patterns,
- shared templates,
- approved promoted knowledge from users or projects.

Read rules:
- only inside the tenant,
- gated by role, project, sensitivity and document visibility,
- can be used by chat, execution agent and workers if permission allows.

Write rules:
- org uploads and curated docs are explicit,
- derived patterns may be auto-generated but must remain auditable,
- high-sensitivity or shared knowledge changes may require admin review.

Cross-user rule:
- if a second user can use it, it must already live in org scope or another explicitly shared scope governed by org policy.

---

## 7. Canonical lifecycle

For every knowledge object:

`ingest -> classify -> assign scope -> apply policy -> chunk -> embed -> index -> retrieve -> cite/log -> retain/archive/delete`

Additional transition:

`promote or demote`

Promotion examples:
- user note -> approved org playbook
- project lessons -> org memory pattern
- temporary attachment -> durable org document

Demotion examples:
- revoke org visibility
- archive stale knowledge
- remove sensitive content from active retrieval

---

## 8. Retrieval policy

Retrieval must be policy-first, not vector-first.

Canonical sequence:

1. infer task type
2. determine allowed scopes
3. pre-filter candidates by scope, tenant and ACL
4. retrieve per scope
5. merge and rerank
6. log actual used sources

### 8.1 Why pre-filter matters

Security must not depend on "retrieve everything, filter later".

The system should:
- filter by `organization_id`, `user_id`, `scope_type`, `visibility`, `sensitivity` before or at candidate generation,
- only then run semantic ranking and reranking.

### 8.2 Scope priority by task type

Default guidance:

| Task type | Priority scopes |
|---|---|
| Personal drafting | session -> user_private -> organization -> system |
| Org process / execution | organization -> project/artifact context -> system -> user_private when explicitly relevant |
| Virtual worker branded answers | assigned organization/system knowledge only |
| Deep research | approved retrieval plan across session/org/system/external |

### 8.3 Private mode

Private mode should primarily affect:
- read from user-private durable memory,
- write to user-private durable memory,
- optional use of org memory according to documented product contract.

Private mode must not be hand-wavy.
Its exact behavior has to be explicit in product and runtime docs.

---

## 9. Security and governance rules

### 9.1 Tenant isolation

Non-negotiable:
- one org can never retrieve another org's private/shared knowledge,
- vectors and chunks inherit tenant identity,
- logs must preserve tenant boundaries.

### 9.2 User privacy

Non-negotiable:
- one user's private memory is never another user's retrieval source,
- admin access, if any, must be explicit and auditable,
- deletion/export semantics need owner and policy.

### 9.3 Sensitivity

Every org-shared document should support at least:
- `allowed`
- `requires_approval`
- `blocked`

and sensitivity such as:
- `public`
- `internal`
- `confidential`

### 9.4 Worker safety

Virtual workers can consume only:
- org-safe assigned corpora,
- system corpora,
- never arbitrary user-private memory.

---

## 10. Canonical storage architecture

`Knowledge RAG v8` should converge toward one storage model:

### 10.1 Document registry

One canonical document registry for all retrievable corpora with:
- scope,
- owner,
- tenant,
- visibility,
- sensitivity,
- source type,
- retention state,
- indexing status.

### 10.2 Chunk and embedding store

Chunks and embeddings inherit metadata from parent document/memory object.

### 10.3 Memory stores

Memory remains separate by semantics:
- `user memory store`
- `organization memory store`

but retrieval should go through one policy-aware gateway.

### 10.4 Retrieval gateway

All consumers should use one orchestrated retrieval service that:
- understands scopes,
- enforces policy,
- merges results,
- logs usage.

---

## 11. Product surfaces this strategy supports

- `Chat v8`
- `Execution Agent`
- `Virtual Workers`
- `Deep Research`
- future knowledge-aware module copilots

The knowledge layer is shared.
The consumer behavior is not.

---

## 12. Explicit anti-patterns

Do not:
- let another user read my private memory because we share an org,
- treat user personalization as org knowledge,
- treat org documents as globally reusable by default,
- run retrieval before scope filtering,
- let worker assignments bypass doc governance,
- create parallel document registries for each AI feature,
- mix `memory`, `document corpus` and `temporary attachment context` into one vague blob.

---

## 13. Definition of done

`Knowledge RAG v8` is complete when:
- user-private and organization-shared methods are distinct,
- safe cross-user sharing happens only through governed shared scope,
- cross-org leakage is structurally blocked,
- retrieval is policy-aware before ranking,
- promotion and retention rules are explicit,
- chat, execution agent and workers consume one governed knowledge layer.

Related docs:
- `KNOWLEDGE_RAG_V8_BENCHMARK.md`
- `KNOWLEDGE_RAG_V8_AS_IS.md`
- `KNOWLEDGE_RAG_V8_GAP_MATRIX.md`
- `KNOWLEDGE_RAG_V8_IMPLEMENTATION_PLAN.md`
- `KNOWLEDGE_RAG_V8_WORKING_MEMORY_ARCHITECTURE.md`
- `AGENT_EXECUTION_DOMAIN_MAP_V8.md`
- `CHAT_V8_ATTACHMENTS_AND_RETRIEVAL.md`
- `CHAT_V8_MEMORY_AND_PERSONALIZATION.md`
- `CHAT_V8_AI_GOVERNANCE.md`
