# Virtual Workers Superadmin Implementation Plan v8

> Status: Canonical phased implementation plan
> Owner: Product + Engineering
> Scope: phased implementation plan for evolving the current `Virtual Workers` module into a leader-grade superadmin control plane
> Authority: Highest for implementation sequencing of the virtual workers control-plane package

---

## 1. Strategic intent

The goal is not to keep adding isolated worker screens.

The goal is to make `Superadmin -> Virtual Workers` the real operating system for assistants like `Anna`, with one governed path for:

- worker identity
- profile and prompt policy
- knowledge assignment
- conversation intelligence
- analytics and insights
- release and audit

---

## 2. Program principles

- one canonical control plane
- one honest worker model
- one knowledge governance story
- one memory policy story
- one conversation intelligence model
- one text/voice worker doctrine
- one release and rollback posture

---

## 3. Current baseline

Already present:

- worker CRUD
- profile versioning
- knowledge assignments with weight
- conversation logging
- message logging
- worker analytics
- worker insights
- Anna public integration through the worker stack

Main limitations:

- knowledge is too shallow and slug-weight based
- memory is too recent-turn dependent
- conversation intelligence lacks topics and structured summaries
- voice/text still need one shared runtime doctrine
- no worker eval/release pipeline

---

## 4. Delivery waves

### Wave A - Canon restoration and data-model hardening

Goal:

- restore the full package authority chain and prepare the schema for richer worker governance

Deliverables:

- canonical docs package restored
- schema extensions for conversation intelligence
- schema extensions for knowledge-pill governance
- schema extensions for worker policy fields

Backend focus:

- extend `virtual_worker_conversations`
- extend `virtual_worker_messages`
- add `knowledge_pills` and related section/version tables
- add `virtual_worker_policy` or equivalent profile-enrichment fields

Definition of done:

- source of truth exists
- schema supports topics, summaries, pill usage and policy controls

### Wave B - Knowledge-pill system

Goal:

- move from weighted product slugs to governed knowledge pills

Deliverables:

- pill library
- pill sections
- section-level assignment
- usage modes: full vs selected vs retrieval-only vs fallback-only
- runtime context preview

UI focus:

- evolve `KnowledgeAssignmentPanel` into:
  - assigned knowledge
  - pill library
  - section controls
  - preview

Definition of done:

- operator can decide whether Anna uses the whole pill or only selected sections

### Wave C - Session memory and shared runtime

Goal:

- stop Anna from relying almost only on recent raw turns

Deliverables:

- session-summary memory object
- topic carry-forward
- user-goal carry-forward
- text/voice shared runtime doctrine

Backend focus:

- add conversation summary builder
- inject session summary into runtime prompts
- unify text/voice worker memory semantics

Definition of done:

- longer Anna sessions stay coherent without depending only on `slice(-8)`

### Wave D - Conversation intelligence

Goal:

- give operators durable visibility into what conversations were about

Deliverables:

- primary topic
- subtopics
- intent
- products discussed
- fallback reason
- knowledge gaps
- transcript-light summaries

UI focus:

- enrich `ConversationBrowser`
- enrich `WorkerAnalyticsDashboard`
- add topic and intent filters

Definition of done:

- operator can see how many conversations occurred, their themes and their duration

### Wave E - Anna operator cockpit

Goal:

- make `Anna` a complete first-class worker in `Virtual Workers`

Deliverables:

- profile controls for memory, channel and retrieval policy
- Anna-specific analytics
- source usage reporting
- knowledge-gap reporting
- CTA and topic conversion views

Definition of done:

- `Anna` can be operated from Superadmin without code-first prompt surgery for normal tuning work

### Wave F - Worker eval and release

Goal:

- make worker changes releasable and regression-safe

Deliverables:

- benchmark conversation sets
- worker eval runner
- pre-activation check
- canary activation
- rollback posture

Definition of done:

- profile or pill changes for Anna can be tested and released safely

---

## 5. Concrete implementation backlog

### 5.1 Database

Add / extend:

- `knowledge_pills`
- `knowledge_pill_sections`
- `knowledge_pill_versions`
- `virtual_worker_conversation_summaries`
- `virtual_worker_conversation_topics`
- `virtual_worker_evaluations`

Extend `virtual_worker_conversations` with:

- `primary_topic`
- `intent`
- `products_discussed`
- `fallback_reason`
- `summary`
- `quality_flags`

Extend `virtual_worker_messages` with:

- `retrieval_query`
- `used_pill_ids`
- `used_pill_sections`
- `answer_confidence`
- `response_mode`

### 5.2 Backend services

Create or extend:

- worker knowledge-pill service
- worker context preview service
- conversation topic extraction service
- session summary memory service
- worker evaluation service
- worker release service

### 5.3 API

Add or extend endpoints under `/api/virtual-workers/:id/*`:

- `/knowledge/pills`
- `/knowledge/preview`
- `/memory-policy`
- `/channels`
- `/evaluations`
- `/release`
- richer `/conversations`
- richer `/analytics`

### 5.4 SuperAdmin UI

Upgrade:

- `WorkerProfileEditor`
- `KnowledgeAssignmentPanel`
- `ConversationBrowser`
- `WorkerAnalyticsDashboard`
- `InsightsPanel`

Add new views if needed:

- `MemoryPolicyPanel`
- `ChannelsPanel`
- `EvaluationPanel`
- `ReleasePanel`

---

## 6. Anna-first implementation slice

The first worker to fully productize should be `Anna`.

Anna-first slice includes:

1. full `Consultify` pill
2. curated `Vector`, `DBR77`, `IRIS`, `Digital Twin`, `IIoT`, `Marketplace` pills
3. whole-pill vs section-limited controls
4. session-summary memory
5. topic and duration analytics
6. text/voice parity work

Reason:

`Anna` is public, operator-visible and already connected to the worker stack, so she is the best proving ground for the package.

---

## 7. Suggested engineering order

1. migrations and schema extensions
2. backend conversation intelligence write path
3. richer conversation list/detail API
4. analytics API enrichment
5. knowledge-pill backend
6. `KnowledgeAssignmentPanel` rewrite
7. `ConversationBrowser` rewrite
8. `WorkerAnalyticsDashboard` rewrite
9. memory/channel policy controls
10. eval and release layer

---

## 8. Definition of done for the full package

`Virtual Workers` reaches the intended v8 state when:

- missing canonical docs are restored and aligned
- Anna is fully controllable from `Virtual Workers`
- operators can choose whole-pill vs section-level knowledge usage
- operators can see conversation count, themes and duration
- topic and gap analytics are first-class
- text and voice behave as one worker doctrine
- worker changes are evaluable and releasable

---

## 9. Dependencies

- `ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
- `SUPERADMIN_V8_SSOT.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`

---

## 10. Recommended next execution packet

The smallest honest first implementation packet after restoring package canon is:

`Anna knowledge-pill and conversation-intelligence foundation`

That packet should include:

- schema support for topics and summaries
- richer conversation analytics for Anna
- first-class knowledge-pill objects
- section-level assignment controls for Anna

This is the first packet that materially changes operator value, not only documentation completeness.
