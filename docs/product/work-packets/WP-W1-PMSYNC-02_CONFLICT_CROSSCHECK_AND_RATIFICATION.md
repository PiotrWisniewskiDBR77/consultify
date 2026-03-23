# WP-W1-PMSYNC-02 — Conflict Vocabulary Cross-Check and Sync Status Ratification

> Packet: WP-W1-PMSYNC-02
> Wave: 1 — Shared platform truth
> Status: completed
> Produced by: worker agent (bounded)
> Binding decisions: Decision 7, Decision 8, Decision 9 (DECISION_LOG_WAVE_1.md)
> Primary validation input: CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md (highest authority per DOCUMENTATION_REGISTRY.md)

---

## 1. Cross-check: WP-W1-PMSYNC-01 conflict classes vs CONNECTOR_SYNC_MODES doc

### 1.1 Side-by-side comparison

WP-W1-PMSYNC-01 §4.1 defines 7 conflict classes sourced from `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §11. `CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md` §4 defines 7 conflict classes as the platform-wide canon. The two sets overlap but use **different naming** and **different granularity**.

| # | CONNECTOR_SYNC_MODES (§4) — canonical | WP-W1-PMSYNC-01 (§4.1) — from TASK_SYNC doc | Match | Notes |
|---|---|---|---|---|
| 1 | `simultaneous_edit` | `concurrent_edit_conflict` | **Semantic match, naming divergence** | Same concept. SYNC_MODES uses shorter name; PMSYNC-01 appends `_conflict` suffix. |
| 2 | `schema_mismatch` | `status_model_conflict` | **Partial overlap** | SYNC_MODES is broader (any schema mismatch); PMSYNC-01 narrows to status model only. Status model conflict is a subset of schema mismatch. |
| 3 | `missing_mapping` | `identity_or_mapping_conflict` | **Partial overlap** | SYNC_MODES focuses on missing mapping; PMSYNC-01 merges identity ambiguity and mapping into one class. |
| 4 | `permission_conflict` | `permission_or_scope_conflict` | **Semantic match, naming divergence** | Same concept. PMSYNC-01 adds "scope" for clarity. |
| 5 | `deleted_remote_object` | `deleted_or_missing_target_conflict` | **Partial overlap** | SYNC_MODES covers remote deletion only; PMSYNC-01 covers both remote and local deletion in one class. |
| 6 | `deleted_local_object` | (merged into `deleted_or_missing_target_conflict`) | **Absorbed** | SYNC_MODES has separate classes for remote vs local deletion; PMSYNC-01 merges them. |
| 7 | `identity_ambiguity` | (merged into `identity_or_mapping_conflict`) | **Absorbed** | SYNC_MODES has a dedicated class; PMSYNC-01 merges it with missing_mapping. |
| — | *(not present)* | `field_authority_conflict` | **Gap in SYNC_MODES** | PMSYNC-01 adds this from TASK_SYNC doc. Not in SYNC_MODES canon. |
| — | *(not present)* | `stale_snapshot_conflict` | **Gap in SYNC_MODES** | PMSYNC-01 adds this from TASK_SYNC doc. Not in SYNC_MODES canon. |

### 1.2 Summary of findings

| Finding type | Count | Detail |
|---|---|---|
| Naming divergences (same concept) | 2 | `simultaneous_edit` vs `concurrent_edit_conflict`; `permission_conflict` vs `permission_or_scope_conflict` |
| Granularity differences (SYNC_MODES more granular) | 3 | `schema_mismatch` vs `status_model_conflict`; `deleted_remote_object` + `deleted_local_object` vs merged `deleted_or_missing_target_conflict`; `identity_ambiguity` + `missing_mapping` vs merged `identity_or_mapping_conflict` |
| Classes present in PMSYNC-01 but absent from SYNC_MODES | 2 | `field_authority_conflict`, `stale_snapshot_conflict` |
| Classes present in SYNC_MODES but absent from PMSYNC-01 | 0 | All SYNC_MODES classes are covered (some merged) |

### 1.3 Field authority model cross-check

CONNECTOR_SYNC_MODES §3 defines 4 field authority types:

- `consultify_authoritative`
- `external_authoritative`
- `last_writer_with_guardrails`
- `manual_resolution_required`

WP-W1-PMSYNC-01 §3.2 references `field_authority_map` as a per-field source-of-truth declaration but does not enumerate the authority types. The TASK_SYNC doc §10 references authority concepts (local priority, external status, single-owner) but does not use the canonical enum from SYNC_MODES.

**Gap:** The field authority enum from CONNECTOR_SYNC_MODES §3 is not referenced in WP-W1-PMSYNC-01. It should be.

### 1.4 Resolution paths cross-check

| CONNECTOR_SYNC_MODES §6 — canonical | WP-W1-PMSYNC-01 §4.4 | Match |
|---|---|---|
| accept local as source of truth | `auto_resolve_by_authority` (partial) | Covered as one mode of auto-resolve |
| accept external as source of truth | `auto_resolve_by_authority` (partial) | Covered as one mode of auto-resolve |
| merge using explicit field selection | `manual_review` (partial) | Covered under manual review; merge is a resolution action within review |
| remap identity | `remap` | **Direct match** |
| dismiss after audit note | `dismiss` | **Direct match** |
| *(not present)* | `replay_after_fix` | **Gap in SYNC_MODES** — PMSYNC-01 adds replay as a resolution path |
| *(not present)* | `escalate` | **Gap in SYNC_MODES** — PMSYNC-01 adds escalation path |

### 1.5 Sync modes cross-check

CONNECTOR_SYNC_MODES §2 defines 6 canonical sync modes. WP-W1-PMSYNC-01 §3.2 references `sync_direction` with 4 values. Mapping:

| CONNECTOR_SYNC_MODES §2 | WP-W1-PMSYNC-01 `sync_direction` | Notes |
|---|---|---|
| `import_once` | — | Not represented as a direction; it is a mode. Could map to `import` for a single-run case. |
| `push_only` | `publish` | Semantic match. |
| `pull_only` | `import` | Semantic match. |
| `bi_directional` | `bidirectional` | Semantic match, minor spelling difference. |
| `publish_then_link` | — | Not represented. Hybrid mode not in PMSYNC-01. |
| `mirror_with_refresh` | `mirror_local_authority` | Partial match. SYNC_MODES does not specify authority direction; PMSYNC-01 specifies local authority. |

**Gap:** `import_once` and `publish_then_link` are not represented in the per-object `sync_direction` enum. These are valid sync modes but may not apply as ongoing per-object directions (they are one-shot or transitional). This is acceptable for the per-object model but should be noted.

---

## 2. Recommended conflict vocabulary corrections

Based on the cross-check, the following corrections should be applied to the WP-W1-PMSYNC-01 conflict vocabulary before it is promoted to canonical status.

### 2.1 Naming alignment

The canonical source is CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md. Where naming diverges, the SYNC_MODES name takes precedence as it is the highest authority per the registry. However, the PMSYNC-01 names are more descriptive and PM-context-aware. The recommended approach is:

**Rule:** Use the SYNC_MODES names as the canonical identifiers. Where PMSYNC-01 introduced more descriptive names, add them as aliases in the PM context but do not replace the canonical names.

| Canonical name (from SYNC_MODES) | PM alias (from PMSYNC-01) | Action |
|---|---|---|
| `simultaneous_edit` | `concurrent_edit_conflict` | **Adopt `simultaneous_edit`** as canonical. `concurrent_edit_conflict` becomes a PM-context alias. |
| `permission_conflict` | `permission_or_scope_conflict` | **Adopt `permission_conflict`** as canonical. `permission_or_scope_conflict` becomes a PM-context alias. |

### 2.2 Granularity alignment

Where PMSYNC-01 merged classes that SYNC_MODES keeps separate, the canonical granularity from SYNC_MODES should be preserved:

| SYNC_MODES classes | PMSYNC-01 merged class | Recommendation |
|---|---|---|
| `deleted_remote_object` + `deleted_local_object` | `deleted_or_missing_target_conflict` | **Restore two separate classes.** The distinction matters for resolution routing: remote deletion requires external investigation; local deletion requires local audit. |
| `identity_ambiguity` + `missing_mapping` | `identity_or_mapping_conflict` | **Restore two separate classes.** Identity ambiguity (object exists but identity is unclear) and missing mapping (no mapping defined) have different resolution paths: remap vs configure. |
| `schema_mismatch` (broad) vs `status_model_conflict` (narrow) | — | **Keep both.** `schema_mismatch` is the canonical class from SYNC_MODES. `status_model_conflict` is a PM-specific subtype. Add `status_model_conflict` as a subtype of `schema_mismatch` in the PM context. |

### 2.3 Additions to SYNC_MODES canon

Two classes from PMSYNC-01 are absent from CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md and should be proposed as additions:

| Class | Justification | Proposed action |
|---|---|---|
| `field_authority_conflict` | Directly tied to the field authority model in SYNC_MODES §3. When both sides update a field with declared authority and diverge, this is a distinct conflict type not covered by `simultaneous_edit` alone (which does not reference authority declarations). | **Propose addition** to SYNC_MODES §4 as a new canonical class. |
| `stale_snapshot_conflict` | Occurs when a sync batch runs against outdated data. This is operationally distinct from `simultaneous_edit` (which implies real-time concurrent edits). Stale snapshot is a batch/timing issue. | **Propose addition** to SYNC_MODES §4 as a new canonical class. |

### 2.4 Additions to SYNC_MODES resolution paths

Two resolution paths from PMSYNC-01 are absent from CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §6:

| Path | Justification | Proposed action |
|---|---|---|
| `replay_after_fix` | TASK_SYNC doc §11 defines replay doctrine. Replay is a first-class resolution path, not just an operational action. | **Propose addition** to SYNC_MODES §6. |
| `escalate` | Cross-team or platform-level conflicts need an explicit escalation path. Currently implied but not named. | **Propose addition** to SYNC_MODES §6. |

### 2.5 Field authority enum reference

WP-W1-PMSYNC-01 §3.2 should explicitly reference the canonical field authority enum from CONNECTOR_SYNC_MODES §3:

- `consultify_authoritative`
- `external_authoritative`
- `last_writer_with_guardrails`
- `manual_resolution_required`

This ensures the `field_authority_map` property in the per-object model uses the canonical vocabulary.

### 2.6 Corrected canonical conflict vocabulary

After applying all corrections, the unified conflict vocabulary for the PM sync domain is:

| # | Canonical class | Source | PM subtype (if any) | Severity default |
|---|---|---|---|---|
| 1 | `simultaneous_edit` | SYNC_MODES §4 | — | `degraded` |
| 2 | `schema_mismatch` | SYNC_MODES §4 | `status_model_conflict` | `degraded` |
| 3 | `missing_mapping` | SYNC_MODES §4 | — | `blocking` |
| 4 | `permission_conflict` | SYNC_MODES §4 | — | `blocking` |
| 5 | `deleted_remote_object` | SYNC_MODES §4 | — | `blocking` |
| 6 | `deleted_local_object` | SYNC_MODES §4 | — | `blocking` |
| 7 | `identity_ambiguity` | SYNC_MODES §4 | — | `blocking` |
| 8 | `field_authority_conflict` | TASK_SYNC §11 (proposed addition to SYNC_MODES) | — | `degraded` |
| 9 | `stale_snapshot_conflict` | TASK_SYNC §11 (proposed addition to SYNC_MODES) | — | `informational` |

---

## 3. Per-object sync status enum ratification proposal

### 3.1 Decision context

Decision 8 (DECISION_LOG_WAVE_1.md) mandates:

- Promote per-object sync status to canonical.
- Clear separation between connector health and object-level sync status.
- Cross-check with conflict-resolution canon required before ratification.

Decision 9 mandates that CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md is the required validation input.

### 3.2 Cross-check result

The per-object sync status enum from WP-W1-PMSYNC-01 §3.3 has been validated against CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md:

- The `conflict` state maps directly to the 9 conflict classes in the corrected vocabulary (§2.6 above).
- The `dead_letter` state aligns with TASK_SYNC §11 dead-letter doctrine (referenced but not defined in SYNC_MODES).
- The `error` state covers non-conflict failures (auth, permission, provider outage, mapping) which are distinct from the conflict classes in SYNC_MODES §4.
- No contradiction found between the per-object states and the SYNC_MODES canon.

### 3.3 Proposed canonical enum

The per-object sync status enum is ratified as follows:

| State | Meaning | Relationship to connector health |
|---|---|---|
| `synced` | Object is current; last sync succeeded within staleness threshold. | Connector must be `healthy`. |
| `syncing` | Sync operation is in progress for this object. | Connector must be `healthy` or `refreshing`. |
| `stale` | Last successful sync exceeds staleness threshold; data may be outdated. | May be caused by connector `degraded_reauth_needed`, `disconnected`, or simply elapsed time. |
| `conflict` | A conflict has been detected and awaits resolution. Conflict class from the canonical vocabulary (§2.6) must be attached. | Connector may be `healthy` (business conflict) or `degraded_reauth_needed` (auth-related). |
| `error` | Sync failed for a non-conflict reason. Error class must be attached (see §3.4). | Inherits from connector state where applicable. |
| `dead_letter` | Unrecoverable sync failure; item moved to dead-letter queue for operator inspection. | Connector state is independent; dead-letter is an object-level terminal state. |
| `not_linked` | Object exists locally but has no external sync binding. | No connector relationship. |

### 3.4 Error class enum (non-conflict failures)

Unchanged from WP-W1-PMSYNC-01 §3.5, validated as non-overlapping with conflict classes:

| Error class | Description |
|---|---|
| `auth_failure` | Parent connector auth is degraded. |
| `permission_denied` | Token valid but insufficient scope for this object/operation. |
| `provider_outage` | External system temporarily unreachable. |
| `mapping_failure` | Object or field mapping is invalid or incomplete. |
| `business_conflict` | Pointer to conflict class from §2.6. |
| `rate_limited` | Provider rate limit exceeded; retry scheduled. |
| `target_not_found` | External object has been deleted or moved. |

### 3.5 Separation doctrine

The following separation between connector health and object-level sync status is ratified:

| Layer | Enum | Source of truth |
|---|---|---|
| **Connector health** | `not_connected`, `authorizing`, `connected_unverified`, `healthy`, `refreshing`, `degraded_reauth_needed`, `revoked`, `disconnected` | CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md §8 |
| **Object sync status** | `synced`, `syncing`, `stale`, `conflict`, `error`, `dead_letter`, `not_linked` | This ratification (proposed for TASK_SYNC doc) |
| **Conflict class** | 9 classes per §2.6 | CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §4 (with 2 proposed additions) |
| **Error class** | 7 classes per §3.4 | Synthesized from OAUTH_LIFECYCLE §9 + TASK_SYNC §11 |

### 3.6 Proposed canonical home

Per Decision 8 ("not only as local synthesis") and the additional rule ("propose a minimal change, not a new parallel document"):

**Proposed update target:** `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md`

**Proposed change:** Add a new section §11A (between current §11 and §12) titled **"Per-object sync status model"** containing:

1. The 7-state enum (§3.3 above)
2. The error class enum (§3.4 above)
3. The separation doctrine table (§3.5 above)
4. A cross-reference to CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md for conflict classes
5. A cross-reference to CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md for connector health states

This keeps the per-object model in the PM sync runtime doc (its natural home) while referencing the conflict-resolution canon as the authority for conflict classes.

---

## 4. Tier D alignment proposal

### 4.1 Decision context

Decision 7 (DECISION_LOG_WAVE_1.md) mandates:

- Canonical enum includes Tier D.
- `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` must be aligned to the A-D model.

### 4.2 Current state

`PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` §3 defines three tiers (A, B, C). Tier D is absent.

`TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` §5 defines four tiers (A, B, C, D) with Tier D defined as:

> **Tier D — benchmark or future scope**
> Meaning: visible in roadmap, not yet promised as mature runtime parity.

### 4.3 Proposed minimal update to PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md

Add a new subsection `§3.4` after the existing `§3.3 Tier C`:

```markdown
### 3.4 Tier D - benchmark or future scope

Providers:

- (future PM or ALM tools not yet committed to runtime parity)

Required depth:

- visible in roadmap and connector catalog
- not promised as mature runtime parity
- no sync mode, conflict model or operator surface required
- honest labeling as future scope on all surfaces
```

Additionally, update `§7 Recommended sequence` to append:

```markdown
6. Tier D providers remain visible in roadmap but are not scheduled for runtime implementation until Tiers A-C are honest and supportable
```

Additionally, update `§8 Acceptance criteria` to append:

```markdown
- Tier D providers are honestly labeled as future scope and do not appear as shipped connectors
```

### 4.4 No other document changes required

`TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` already includes Tier D and requires no update for this decision.

---

## 5. Open questions and conflicts

### 5.1 No inter-document conflicts found

The cross-check between CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md and TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md reveals **naming divergences and granularity differences but no true contradictions**. Both documents describe compatible models at different levels of specificity.

### 5.2 Proposed additions require SYNC_MODES doc update

Two conflict classes (`field_authority_conflict`, `stale_snapshot_conflict`) and two resolution paths (`replay_after_fix`, `escalate`) are proposed as additions to CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md. These additions are consistent with the existing doc's intent but require explicit ratification by the doc owner.

**Escalation item:** The SYNC_MODES doc owner must approve the addition of 2 conflict classes and 2 resolution paths before they become canonical.

### 5.3 Severity model not present in SYNC_MODES canon

WP-W1-PMSYNC-01 §4.3 introduced a 3-level severity model (`blocking`, `degraded`, `informational`). CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §5 defines conflict policy requirements (auto-resolve, blocking state, who can resolve) but does not define an explicit severity enum.

**Assessment:** The severity model is consistent with SYNC_MODES §5 policy requirements but is an addition, not a contradiction. It should be proposed as an addition to SYNC_MODES §5 alongside the conflict class additions.

### 5.4 Dead-letter doctrine scope

TASK_SYNC §11 defines dead-letter doctrine. CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md does not mention dead-letter. This is a gap in the SYNC_MODES doc, not a conflict. Dead-letter is a downstream state of unresolvable conflicts and belongs in the conflict-resolution canon.

**Escalation item:** Propose adding dead-letter doctrine reference to SYNC_MODES doc as part of the conflict class additions.

---

## 6. Packet output

- **Status:** completed
- **Completed:**
  - Cross-check of WP-W1-PMSYNC-01 conflict vocabulary against CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md (9 classes compared, gaps and naming divergences identified)
  - Corrected canonical conflict vocabulary (9 unified classes with source attribution)
  - Per-object sync status enum ratification proposal (7 states, 7 error classes, separation doctrine, proposed canonical home in TASK_SYNC doc)
  - Tier D alignment proposal for PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md (minimal §3.4 addition)
  - Field authority enum gap identified and correction proposed
  - Resolution paths cross-checked (2 additions proposed for SYNC_MODES doc)
- **Remaining:**
  - None within packet scope
- **Blockers or risks:**
  - Proposed additions to CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md (2 conflict classes, 2 resolution paths, severity model, dead-letter reference) require doc owner approval before they become canonical (low risk — all additions are consistent with existing doctrine)
  - Actual file updates to canonical docs are proposals only; this packet does not modify canonical docs directly (by design — no new product doctrine)
- **Questions requiring escalation:**
  1. Should `field_authority_conflict` and `stale_snapshot_conflict` be added to CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §4? (Recommended: yes — they fill genuine gaps)
  2. Should `replay_after_fix` and `escalate` be added to CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §6? (Recommended: yes — replay is already doctrinal in TASK_SYNC)
  3. Should the 3-level severity model (`blocking`, `degraded`, `informational`) be added to CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §5? (Recommended: yes — it operationalizes the existing policy requirements)
  4. Should dead-letter doctrine be referenced in CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md? (Recommended: yes — dead-letter is a terminal conflict state)
