# Connector Design Runtime And Promotion Model v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical design-time assets, runtime deployments, review, promote, rollback lifecycle and drift model for connector packages

---

## 1. Why this document exists

Mature sync platforms separate design from runtime.

This document defines how connector assets should move from idea to active runtime.

---

## 2. Design-time assets

Connector package assets may include:

- provider definition
- auth profile
- mapping profile
- sync definition
- webhook contract
- retry policy
- support notes

---

## 3. Runtime deployment objects

Runtime should track:

- installation
- environment
- active version
- health state
- drift state

---

## 4. Promotion lifecycle

Canonical lifecycle:

`draft -> reviewed -> approved -> promoted -> active -> deprecated -> retired`

---

## 5. Rollback doctrine

Rollback should preserve:

- previous active version
- rollback reason
- operator
- impacted installations

---

## 6. Drift doctrine

Drift should be detectable across:

- schema version
- mapping version
- auth requirements
- runtime policy

---

## 7. Related canonical docs

- `CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CONNECTOR_DB_SCHEMA_AND_MIGRATION_CONTRACT_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
