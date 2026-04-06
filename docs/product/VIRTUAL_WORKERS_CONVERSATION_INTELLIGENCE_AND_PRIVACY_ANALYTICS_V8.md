# Virtual Workers Conversation Intelligence And Privacy Analytics v8

> Status: Canonical analytics contract
> Owner: Product + Engineering
> Scope: canonical privacy-first analytics contract for aggregated topic, duration, channel, outcome and knowledge-gap reporting across virtual worker conversations
> Authority: Highest for virtual worker conversation intelligence and transcript-light analytics semantics

---

## 1. Purpose

`Virtual Workers` needs more than transcript storage.

Operators need to understand:

- how many conversations happened
- how long they lasted
- what they were about
- whether the worker answered well
- where knowledge was missing
- how text and voice differ

But this must happen without turning the system into uncontrolled long-term transcript surveillance.

So the rule is:

`prefer structured conversation intelligence and aggregates over unlimited raw transcript dependency`

---

## 2. Canonical analytics principles

- privacy first
- topic first
- aggregate before transcript
- durable metrics, bounded raw data
- operator usefulness without hidden overcollection
- one shared vocabulary across workers and channels

---

## 3. Canonical conversation intelligence model

Every conversation should be able to produce:

- `primary_topic`
- `subtopics[]`
- `intent`
- `products_discussed[]`
- `outcome`
- `fallback_reason?`
- `message_count`
- `duration_seconds`
- `channel`
- `locale`
- `knowledge_sources_used[]`
- `knowledge_gaps[]`
- `continuity_flags[]`

This model is canonical for:

- worker analytics dashboards
- insights generation
- release evaluation
- operator review

---

## 4. Privacy posture

### 4.1 Default stance

Transcript retention should be bounded and justified.

The durable analytics layer should rely primarily on:

- structured summaries
- topic extraction
- event counters
- source usage metadata
- quality/gap flags

### 4.2 Sensitive handling

The system should avoid making full-text retention the only route to operator understanding.

For public workers like `Anna`, the preferred long-lived records are:

- summary
- topic
- duration
- channel
- products discussed
- sources used
- outcome
- fallback/gap flags

### 4.3 Anna-specific posture

Because `Anna` is public-facing:

- topic analytics are allowed and useful
- durable aggregate reporting is required
- private identity memory is forbidden
- transcript-light analytics should be the default operating posture

---

## 5. Topic intelligence

### 5.1 Canonical fields

Topics should be extracted into:

- `primary_topic`
- `secondary_topics`
- `topic_family`
- `topic_confidence`

Recommended initial topic families for `Anna`:

- product_overview
- buyer_fit
- capabilities
- integrations
- pricing_request
- security_and_compliance
- deployment
- implementation_and_onboarding
- roi_and_business_case
- demo_or_trial
- contact_handoff
- cross_product_relationship
- unsupported_scope

### 5.2 Topic extraction method

Use a two-layer approach:

- fast heuristic classification for low-cost baseline
- LLM enrichment for summary and disambiguation where useful

Canonical rule:

`topic extraction should enrich operator visibility, not become an expensive always-on black box`

---

## 6. Intent model

Every conversation should attempt to classify intent:

- learn
- evaluate_fit
- pricing
- security_compliance
- get_started
- talk_to_human
- compare_products
- troubleshoot_public_info
- unknown

Intent should be visible in:

- conversation list
- analytics
- insight generation
- CTA conversion reporting

---

## 7. Outcome model

Canonical outcomes:

- `question_answered`
- `demo_requested`
- `trial_started`
- `escalated`
- `abandoned`
- `unknown`

Outcome should remain worker-agnostic, but `Anna` may extend analytics with:

- `contact_clicked`
- `cta_started`
- `fallback_used`

These may remain event-layer facts while still mapping back to canonical conversation outcomes.

---

## 8. Knowledge-gap analytics

Operators should see not only what the worker used, but where the worker struggled.

Canonical gap signals:

- repeated uncertainty around one topic
- repeated fallback for one topic
- repeated use of generic fallback sources
- repeated operator or human handoff after one topic
- repeated cross-product confusion
- missing pill section for a high-frequency topic

Knowledge gaps should be grouped by:

- worker
- product
- topic
- language
- channel

---

## 9. Channel analytics

The system should compare:

- text volume vs voice volume
- average duration by channel
- fallback rate by channel
- topic distribution by channel
- outcome distribution by channel
- continuity issues by channel

Canonical rule:

`channel analytics exist to keep one worker coherent across surfaces, not to justify divergent hidden behavior`

---

## 10. Dashboard requirements

The worker analytics dashboard should expose:

### 10.1 Core KPIs

- total conversations
- total messages
- average duration
- average messages per conversation
- channel distribution
- outcome distribution

### 10.2 Conversation intelligence

- top topics
- top intents
- top products discussed
- top fallback reasons
- top knowledge gaps
- top used knowledge sources
- top used knowledge-pill sections

### 10.3 Learning loop

- unanswered-topic trend
- fallback trend
- repeat-topic trend
- text vs voice parity indicators
- conversion by topic and intent

---

## 11. Conversation browser requirements

List view should show:

- timestamp
- duration
- message count
- channel
- locale
- primary topic
- intent
- outcome

Detail view should show:

- transcript
- structured session summary
- products discussed
- used sources
- used pill sections
- gap flags
- fallback flags

---

## 12. Insights requirements

Insights generation should consume conversation intelligence to produce:

- topic-level gaps
- high-frequency fallbacks
- weak-answer clusters
- channel parity issues
- missing-pill recommendations
- CTA dropoff patterns

The insight engine should avoid vague summaries detached from evidence.

---

## 13. Anna-specific operator requirements

For `Anna`, operators explicitly want to know:

- how many conversations occurred
- what the main themes were
- how long they lasted
- which products were discussed
- where she lacked product knowledge

Therefore `Anna` must expose:

- topic-aware conversation lists
- aggregated topic reporting
- duration reporting
- intent and outcome reporting
- knowledge-gap reporting
- pill/source usage reporting

---

## 14. Retention doctrine

Recommended retention split:

- short-lived raw transcript access for support and review
- longer-lived structured conversation summaries
- durable aggregated analytics and insights

This keeps operators effective without making raw transcript retention the primary analytics strategy.

---

## 15. Related canonical docs

- `VIRTUAL_WORKERS_SUPERADMIN_CONTROL_PLANE_V8.md`
- `VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
- `ANNA_LP_ASSISTANT_CONTRACT_V8.md`
- `KNOWLEDGE_RAG_V8_SSOT.md`
- `AI_MEMORY_LIFECYCLE_ARCHITECTURE_V8.md`
- `AI_OUTPUT_TRUST_ARCHITECTURE_V8.md`
