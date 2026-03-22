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

---

## 4. Circuit-breaker doctrine

External calls should support:

- open state
- half-open state
- closed state

Operator surfaces must expose when a connector is degraded because of breaker policy.

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
