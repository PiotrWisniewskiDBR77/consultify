# Virtual Workers Superadmin Control Plane v8

> Status: Canonical target model
> Owner: Product + Engineering
> Scope: canonical target model for `Superadmin -> Virtual Workers`, including registry, profiles, knowledge, tools, memory, channels, evals, rollout and audit
> Authority: Highest for target control-plane behavior of virtual workers

---

## 1. Purpose

`Virtual Workers` is the canonical control plane for branded assistants and worker personas in `consultify`.

It is not:

- the execution agent product,
- the full RAG governance package,
- or a generic prompt editor.

It is:

- the registry of workers,
- the control surface for worker identity and policy,
- the assignment surface for governed knowledge,
- the operator cockpit for conversations, topics, channels and quality,
- the release surface for worker changes.

---

## 2. Primary object model

### 2.1 Worker

Each worker must have:

- identity: `id`, `slug`, `name`
- role
- surface
- status
- description
- default locale
- channel capabilities
- owner metadata

### 2.2 Worker profile

Each worker may have many versions of:

- persona
- tone
- system prompt
- priority rules
- boundaries
- memory policy
- channel policy
- retrieval policy
- CTA policy

Only one profile version is active at a time.

### 2.3 Knowledge assignment

Worker knowledge is not only `product_slug + weight`.

The canonical target is:

- pill assignment
- section assignment
- usage mode
- priority
- language policy
- fallback policy
- freshness / status visibility

### 2.4 Conversation intelligence

Each conversation should expose:

- channel
- locale
- duration
- message count
- primary topic
- subtopics
- intent
- products discussed
- outcome
- fallback reason
- quality flags

### 2.5 Audit and release

Every meaningful worker change must leave:

- who changed it
- what changed
- why
- from which version
- to which version
- whether it passed evaluation
- how it was rolled out

---

## 3. Canonical module families

`Superadmin -> Virtual Workers` should expose these package families:

1. `Registry`
2. `Profile`
3. `Knowledge`
4. `Channels`
5. `Memory`
6. `Conversations`
7. `Analytics`
8. `Insights`
9. `Evaluations`
10. `Release`
11. `Audit`

---

## 4. Registry family

Registry owns:

- worker list
- role
- surface
- status
- locale default
- ownership
- activation state

Required operator actions:

- create worker
- activate / disable
- change scope/surface
- inspect active profile
- inspect release state

`Anna` must be represented here as the canonical public sales/education worker.

---

## 5. Profile family

Profile owns:

- persona
- tone
- system prompt
- boundaries
- priority rules
- prompt history and versions

Target rule:

`raw prompt text is editable, but prompt text is not the only worker control surface`

So profile must be complemented by first-class policy fields rather than hidden in prompt prose only.

---

## 6. Knowledge family

### 6.1 Canonical knowledge object

The control plane should adopt `Knowledge Pill` as the operator-facing knowledge unit.

Each pill should have:

- `pill_id`
- `product_slug`
- `title`
- `version`
- `language`
- `status`
- `summary`
- structured sections
- evidence links
- editorial owner
- release state

### 6.2 Canonical pill sections

Recommended sections:

- identity
- buyer_fit
- problems_solved
- value_proposition
- capabilities
- limits
- cross_product_relations
- security_and_trust
- objection_handling
- cta_guidance
- faq
- disallowed_claims
- evidence_links

### 6.3 Knowledge assignment modes

For each worker assignment, the operator should choose:

- `full_pill`
- `selected_sections`
- `retrieval_only`
- `fallback_only`

This is especially important for `Anna`, where the operator may want:

- full `Consultify` pill
- selective `Vector` and `DBR77` sections
- restricted cross-sell logic

### 6.4 Required operator controls

The Knowledge family must support:

- assign pill
- assign section subset
- change priority
- preview injected context
- inspect usage frequency
- inspect knowledge gaps
- detect stale / unused pills

---

## 7. Memory family

Memory for virtual workers must be explicit and policy-driven.

Canonical layers:

- `turn history`
- `session summary memory`
- `retrieval working set`
- `forbidden memory zones`

For `Anna`, rules are:

- no cross-session identity memory
- no tenant/private memory
- yes to session-only continuity
- yes to structured topic and goal memory inside one public session

Required controls:

- history window size
- summary enabled/disabled
- summary refresh cadence
- topic carry-forward policy
- language carry-forward policy

---

## 8. Channels family

Channels are first-class worker controls.

Each worker may define:

- enabled channels
- voice enabled
- channel-specific tone constraints
- response-shape differences
- fallback policy
- channel-specific safety limits

Canonical rule:

`different channels may differ in transport, but they must still share one worker identity, one profile authority and one memory doctrine`

For `Anna`, `text` and `voice` must remain one worker, not two partially divergent runtimes.

---

## 9. Conversations family

Conversations family is the operator browser for worker sessions.

Required list fields:

- start time
- duration
- message count
- channel
- locale
- primary topic
- intent
- outcome
- fallback reason

Required detail fields:

- transcript
- topic summary
- products discussed
- knowledge sources used
- pill sections used
- quality flags
- answer uncertainty markers

---

## 10. Analytics family

Analytics must support both:

- operational KPIs
- learning KPIs

Operational KPIs:

- total conversations
- total messages
- average duration
- average messages per conversation
- channel distribution
- outcome distribution

Learning KPIs:

- top topics
- top intents
- top products discussed
- top knowledge gaps
- fallback rate by topic
- top used pills
- top used pill sections
- repeat-question rate
- voice/text parity indicators

---

## 11. Insights family

Insights are not generic notes.

They should be generated from conversation intelligence and mapped to action.

Canonical insight types:

- `knowledge_gap`
- `weak_answer_pattern`
- `channel_drift`
- `prompt_regression_risk`
- `missing_pill_section`
- `high_fallback_topic`
- `cta_dropoff_topic`

Each insight should link to:

- evidence
- affected worker
- topic/product
- suggested remediation
- review status

---

## 12. Evaluations family

Every important worker should have:

- benchmark conversation set
- known-safe answers
- known refusal cases
- product-coverage checks
- continuity checks
- channel parity checks

`Anna` must be the first worker with a proper eval suite because she is public-facing and sales-critical.

---

## 13. Release family

Worker changes should follow:

`draft -> evaluate -> approve -> activate -> observe -> rollback if needed`

Release should cover:

- profile changes
- knowledge-pill changes
- channel changes
- memory policy changes

---

## 14. Audit family

Every operator action in the worker control plane must be traceable.

Audit should preserve:

- actor
- timestamp
- object changed
- old value
- new value
- reason
- evaluation state
- rollout target

---

## 15. Anna-specific target state

`Anna` should become the reference implementation of the package.

The target operator posture for `Anna` is:

- controlled from `Superadmin -> Virtual Workers`
- product knowledge managed through full knowledge pills
- explicit control over whole-pill vs section-limited usage
- visible conversation themes, lengths and outcomes
- one text/voice worker doctrine
- privacy-first conversation intelligence
- benchmarked and releasable profile changes

---

## 16. Boundary rule against neighboring packages

### 16.1 Against `Knowledge RAG v8`

`Virtual Workers` consumes governed knowledge.

It does not replace the RAG ownership package.

### 16.2 Against `Execution Agent`

`Virtual Workers` owns persona workers and control-plane operations.

It does not become the execution-agent package by accident.

### 16.3 Against `Anna LP contract`

`ANNA_LP_ASSISTANT_CONTRACT_V8.md` defines Anna's public behavior and safety boundary.

This document defines how that worker is operated and governed in Superadmin.

---

## 17. Related canonical docs

- `ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- `VIRTUAL_WORKERS_SUPERADMIN_V8_READINESS_AUDIT.md`
- `VIRTUAL_WORKERS_SUPERADMIN_BENCHMARK_V8.md`
- `VIRTUAL_WORKERS_CONVERSATION_INTELLIGENCE_AND_PRIVACY_ANALYTICS_V8.md`
- `VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
- `SUPERADMIN_V8_SSOT.md`
