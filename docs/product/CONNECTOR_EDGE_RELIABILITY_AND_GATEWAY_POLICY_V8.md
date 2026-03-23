# Connector Edge Reliability And Gateway Policy v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical timeout, retry, circuit-breaker, ingress-limit, backpressure and edge-SLO policy for connector and webhook runtime

---

## 1. Why this document exists

The benchmark clearly shows that edge reliability must be a product doctrine, not an implementation afterthought.

---

## 2. Reliability controls

The connector edge should standardize:

- timeouts
- retries
- rate limits
- circuit breakers
- ingress validation
- backpressure handling

---

## 3. Retry classes

Canonical retry classes:

- `safe_retry`
- `retry_with_backoff`
- `do_not_retry`
- `dead_letter_after_threshold`

### 3.1 Retry policy shape

> V8 Decision W5-5 applied — 2026-03-23

The canonical retry policy shape defines the structure that every connector family must configure. Exact numeric values remain per-connector-family configuration; the platform canonicalizes the policy dimensions:

- **max attempt classes** — each retry class defines its own max attempt count
- **backoff family** — exponential, linear or fixed; with configurable base delay and multiplier
- **jitter support** — mandatory randomization to prevent thundering herd
- **escalation handoff** — defines the transition from retry exhaustion to dead-letter or operator escalation

Rule: `common retry doctrine, family-specific tuning`

---

## 4. Circuit-breaker doctrine

External calls should support:

- open state
- half-open state
- closed state

Operator surfaces must expose when a connector is degraded because of breaker policy.

### 4.1 Structured provider health model

> V8 Decision W5-8 applied — 2026-03-23

Provider health must be decomposed into minimum dimensions, not reduced to a single aggregate status:

| Health dimension | What it measures |
|---|---|
| **Auth health** | Token validity, refresh success rate, scope integrity |
| **Transport health** | HTTP error rate, latency percentiles, rate-limit pressure |
| **Schema health** | Schema drift detection, mapping validity, field compatibility |
| **Sync freshness** | Time since last successful sync, staleness breach rate |
| **Replay / dead-letter pressure** | Dead-letter queue depth, unresolved item age, replay backlog |

Rule: `provider health must be decomposed, not reduced to one vague status light`

---

## 5. Dead-letter doctrine

If runtime cannot safely process an event or job, it must support:

- dead-letter record
- reason
- payload reference
- replay path

---

## 6. Related canonical docs

- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_EVENT_CATALOG_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
- `CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`
