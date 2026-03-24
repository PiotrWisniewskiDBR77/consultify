# WP-W1-PMSYNC-03 — Canonical Doc Updates (Change Summary)

> Packet: WP-W1-PMSYNC-03
> Wave: 1 — Shared platform truth
> Status: completed
> Produced by: worker agent (bounded)
> Binding decisions applied: Decision 7, Decision 8, Decision 18 (DECISION_LOG_WAVE_1.md)

---

## 1. Changes applied

### 1.1 CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md (Decision 18)

**§4 — Conflict classes:**
- Added `field_authority_conflict` — both sides updated a field where authority is declared and the updates diverge; distinct from `simultaneous_edit` because it references the field authority model.
- Added `stale_snapshot_conflict` — sync attempted with an outdated snapshot; source data changed since fetch.

**§4A (new) — Conflict severity model:**
- Added 3-level severity model: `low`, `medium`, `high`.
- Each conflict instance must carry a severity level.
- Connector families must declare default severity per conflict class; operator may override within policy bounds.

**§6 — Resolution paths:**
- Added `replay_after_fix` — underlying issue fixed; replay the failed sync preserving audit lineage.
- Added `escalate` — conflict requires platform-level or cross-team decision.

**§6A (new) — Dead-letter doctrine reference:**
- Added explicit reference to dead-letter doctrine from TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md §11.
- Defined operator recovery path: inspect → classify → fix → replay/dismiss/escalate.

### 1.2 PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md (Decision 7)

**§3.4 (new) — Tier D - benchmark or future scope:**
- Added Tier D definition: visible in roadmap, not promised as mature runtime parity, no sync mode or conflict model required, honest labeling as future scope.
- Aligns the A-D model with TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md §5.4.

**§7 — Recommended sequence:**
- Added item 6: Tier D providers remain visible in roadmap but not scheduled for runtime until Tiers A-C are honest and supportable.

**§8 — Acceptance criteria:**
- Added criterion: Tier D providers are honestly labeled as future scope and do not appear as shipped connectors.

### 1.3 TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md (Decision 8)

**§11A (new) — Per-object sync status model:**
- Added canonical 7-state enum: `synced`, `syncing`, `stale`, `conflict`, `error`, `dead_letter`, `not_linked`.
- Added 7-class error enum for non-conflict failures: `auth_failure`, `permission_denied`, `provider_outage`, `mapping_failure`, `business_conflict`, `rate_limited`, `target_not_found`.
- Added separation doctrine table: connector health vs object sync status vs conflict class vs error class, with source-of-truth references.
- Cross-references CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md §4 for conflict classes and CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md §8 for connector health states.

---

## 2. What was NOT changed

- No existing sections were rewritten.
- No provider-specific content was added or modified.
- No new parallel documents were created.
- No content beyond what Decisions 7, 8, and 18 authorize was introduced.

---

## 3. Escalation items

None. All three decisions were unambiguous and the target documents had clear insertion points.

---

## 4. Source traceability

| Decision | Source analysis | Cross-check |
|---|---|---|
| Decision 7 (Tier D) | WP-W1-PMSYNC-01 §2.1, §7.1 | WP-W1-PMSYNC-02 §4 |
| Decision 8 (per-object sync status) | WP-W1-PMSYNC-01 §3.2–§3.5 | WP-W1-PMSYNC-02 §3 |
| Decision 18 (SYNC_MODES update) | WP-W1-PMSYNC-01 §4.1–§4.4 | WP-W1-PMSYNC-02 §1–§2 |
