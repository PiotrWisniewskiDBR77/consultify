# Connector Sync Modes And Conflict Resolution v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: canonical sync modes, field authority model, direction semantics, conflict classes and conflict-resolution policy for external integrations

---

## 1. Why this document exists

One of the biggest current gaps is that sync direction and conflict handling are not yet first-class product concepts.

This document defines:

- sync modes
- field authority
- conflict classes
- operator and user resolution rules

---

## 2. Canonical sync modes

The platform should use only these canonical sync modes:

- `import_once`
- `push_only`
- `pull_only`
- `bi_directional`
- `publish_then_link`
- `mirror_with_refresh`

Additional execution modifiers:

- `manual`
- `scheduled`
- `event_driven`

Rule:

`mode and modifier must both be visible in UI and operator surfaces`

---

## 3. Field authority model

Each syncable object must define authority by field or field group:

- `consultify_authoritative`
- `external_authoritative`
- `last_writer_with_guardrails`
- `manual_resolution_required`

This is especially required for:

- status
- due date
- assignee
- title
- comments
- publish path

---

## 4. Conflict classes

Canonical conflict classes:

- `simultaneous_edit`
- `schema_mismatch`
- `missing_mapping`
- `permission_conflict`
- `deleted_remote_object`
- `deleted_local_object`
- `identity_ambiguity`
- `field_authority_conflict` — both sides updated a field where authority is declared and the updates diverge; distinct from `simultaneous_edit` because it references the field authority model (§3)
- `stale_snapshot_conflict` — sync attempted with an outdated snapshot; source data changed since fetch; operationally distinct from real-time concurrent edits

> Added per Decision 18 (DECISION_LOG_WAVE_1.md). Source: TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md §11, cross-checked in WP-W1-PMSYNC-02.

---

## 4A. Conflict severity model

Every conflict instance must carry a severity level:

| Severity | Meaning | Example classes |
|---|---|---|
| `low` | Conflict logged; auto-resolved by declared authority rules or accepted as non-critical divergence | `stale_snapshot_conflict` with clear winner |
| `medium` | Sync continues for non-conflicting fields; conflicting field frozen at last-known-good until resolution | `field_authority_conflict`, `simultaneous_edit` |
| `high` | Sync for this object is halted until resolution | `identity_ambiguity`, `deleted_remote_object`, `deleted_local_object`, `missing_mapping` |

Rule:

`every connector family must declare default severity per conflict class; operator may override within policy bounds`

> Added per Decision 18 (DECISION_LOG_WAVE_1.md).

---

## 5. Conflict policy

Every connector family must define:

- which conflict classes it can create
- whether they auto-resolve
- whether they create a blocking state
- who can resolve them

Rule:

`if a conflict changes business meaning, it must be visible and durable`

---

## 6. Resolution paths

Allowed resolution paths:

- accept local as source of truth
- accept external as source of truth
- merge using explicit field selection
- remap identity
- dismiss after audit note
- `replay_after_fix` — underlying issue fixed (auth, permission, mapping); replay the failed sync preserving audit lineage to the original attempt
- `escalate` — conflict requires platform-level or cross-team decision; routes to designated escalation owner

> `replay_after_fix` and `escalate` added per Decision 18 (DECISION_LOG_WAVE_1.md). Source: WP-W1-PMSYNC-01 §4.4, cross-checked in WP-W1-PMSYNC-02.

All resolutions must be logged.

---

## 6A. Dead-letter doctrine reference

Unrecoverable sync conflicts and errors must follow the dead-letter doctrine defined in `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11:

- unrecoverable sync items move to explicit `dead_letter` state
- dead-letter items remain visible to operators and support
- dead-letter items may be dismissed, remapped, replayed or escalated
- operator recovery path: inspect → classify root cause → fix underlying issue → `replay_after_fix` or `dismiss` or `escalate`

Rule:

`dead-letter is a terminal conflict state for the current sync attempt, not a permanent discard; operator must have a recovery path`

> Added per Decision 18 (DECISION_LOG_WAVE_1.md).

---

## 7. Family-specific notes

### 7.1 Calendars

Must define authority for:

- date
- time
- attendees
- cancellation

### 7.2 Communication

Must define authority for:

- channel binding
- delivery state
- callback action state

### 7.3 PM systems

Must define authority for:

- status
- assignee
- due date
- comments

### 7.4 Cloud files

Must define authority for:

- file path
- file version
- share link
- mirror timestamp

---

## 8. Related canonical docs

- `CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
- `CONNECTOR_EVENT_CATALOG_V8.md`
- `CONNECTOR_OPERATOR_AND_SUPPORT_SURFACES_V8.md`
- `EXTERNAL_OBJECT_LINEAGE_AND_PROVENANCE_V8.md`
