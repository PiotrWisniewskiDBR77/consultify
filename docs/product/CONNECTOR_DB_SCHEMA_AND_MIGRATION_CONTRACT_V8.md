# Connector DB Schema And Migration Contract v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: implementation-grade canonical table, key, index and migration contract for converging current sync schema into the V8 backend model

---

## 1. Why this document exists

The repo already has multiple integration-related schema paths.

V8 needs one migration contract for converging them safely.

---

## 2. Canonical table families

The schema should converge around these families:

- provider catalog tables
- installation and credential tables
- mapping and sync-definition tables
- runtime job and attempt tables
- webhook ingress and event tables
- external object mirror tables
- conflict and support tables

---

## 3. Migration doctrine

Migration should be:

- additive first
- backfill-aware
- dual-read where needed
- cutover-driven
- reversible where practical

---

## 4. Key rules

The schema should preserve:

- stable foreign-key direction
- org isolation
- optional user scope where justified
- event and run correlation
- external identity uniqueness

---

## 5. Indexing priorities

Priority indexes should support:

- provider and installation lookup
- run history by installation
- external object lookup
- conflict lookup
- replay lookup

---

## 6. Related canonical docs

- `CONNECTOR_BACKEND_DOMAIN_MODEL_V8.md`
- `CONNECTOR_RUNTIME_JOBS_AND_STORAGE_MODEL_V8.md`
- `CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
- `CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
