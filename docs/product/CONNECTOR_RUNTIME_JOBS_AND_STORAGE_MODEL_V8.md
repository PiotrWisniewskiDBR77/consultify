# Connector Runtime Jobs And Storage Model v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: implementation-grade queue, worker, job, dead-letter, retention and storage model for connector runtime

---

## 1. Why this document exists

The benchmark shows that mature sync products treat runtime jobs as first-class objects.

---

## 2. Canonical runtime objects

The runtime should define:

- `ConnectorJob`
- `ConnectorJobAttempt`
- `WebhookIngressRecord`
- `DeadLetterRecord`
- `ReplayRequest`

---

## 3. Job lifecycle

Canonical lifecycle:

`queued -> running -> succeeded | failed | dead_lettered | cancelled`

---

## 4. Attempt model

Every retryable job should preserve:

- attempt number
- start time
- end time
- error class
- retriable flag

---

## 5. Dead-letter model

Dead-letter records should preserve:

- original payload ref
- original job ref
- reason
- replay eligibility
- operator note

---

## 6. Retention model

The runtime should define retention separately for:

- hot run history
- dead-letter records
- payload blobs
- operator audit notes

---

## 7. Related canonical docs

- `CONNECTOR_EVENT_CATALOG_V8.md`
- `CONNECTOR_EDGE_RELIABILITY_AND_GATEWAY_POLICY_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
- `CONNECTOR_DB_SCHEMA_AND_MIGRATION_CONTRACT_V8.md`
