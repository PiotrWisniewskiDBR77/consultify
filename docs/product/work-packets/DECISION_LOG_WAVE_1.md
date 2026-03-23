# V8 Program — Wave 1 Decision Log

> Status: Active
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 1 escalation items from all Wave 1 packets

---

## AI runtime spine

### Decision 1 — Conversation vs Project authority on drift

- Active run preserves `originating project context` as the canonical execution context.
- Chat surface may show the user's current navigation but must label it as drift, not as new run truth.
- UX rule: show `run started in project X, current navigation is project Y`.
- Project change during a run does not automatically rebind the run; user must choose `continue in original context` or `start/rebind new run`.

### Decision 2 — Snapshot granularity for retrieval-only

- Retrieval that feeds an answer, run, or support trace requires a full `ContextSnapshot`.
- A lighter `RetrievalScopeToken` is allowed only for non-interactive, retrieval-only platform jobs (indexing, refresh, precomputation).
- Rule: `user-visible or run-visible retrieval => full ContextSnapshot`.

### Decision 3 — Snapshot retention policy for Wave 1

- Minimum baseline for Wave 1: `30 days`.
- This is an operational baseline before a full policy engine.
- If a snapshot is associated with an approved mutation, an important auditable run, or a sync incident, long-term durability goes through audit/event lineage, not through infinite snapshot retention.

### Decision 4 — Virtual worker context

- No separate `WorkerContextSnapshot` model for Wave 1.
- Wave 1 uses one `ContextSnapshot` family.
- Worker-specific projection may be added later as a derivative or wrapper, not as a separate canonical model at this stage.
- Deeper worker specialization deferred to a later phase without splitting the snapshot family now.

---

## Multiplayer baseline

### Decision 5 — AI actor presence in rooms

- AI is visible as an explicit, non-human collaborator only when performing room-visible work.
- Canonical presence type: `ai_agent`.
- UX: distinct AI avatar/badge, never impersonating a human.
- Background AI not performing visible room work must not appear as an active collaborator.

### Decision 6 — Multi-tab / multi-device presence

- Top-level UX: `one user = one avatar`.
- Runtime may store multiple session endpoints per user.
- UI may show expanded session detail only on drill-down.
- Default: no duplicate avatars for one user across multiple tabs.

---

## PM sync platform truth

### Decision 7 — Tier D in provider depth enum

- Canonical enum includes `Tier D`.
- Reason: `TASK_SYNC_AND_EXTERNAL_WORK_INTEROPERABILITY_RUNTIME_V8.md` defines 4 tiers; Tier D is needed for honest roadmap/future-scope labeling.
- `PM_CONNECTOR_PARITY_AND_PROVIDER_DEPTH_V8.md` must be aligned to the A-D model.

### Decision 8 — Per-object sync status model

- Promote to canonical.
- Clear separation required between connector health/status and object-level sync status.
- Object-level enum must be ratified in PM sync canon, not only as local synthesis.
- Cross-check with conflict-resolution canon required before ratification.

### Decision 9 — Cross-check with CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md

- Mandatory addition to validation before implementation.
- Treat as required validation input for PM sync packets.
- Not required as primary product doc for provider depth, but mandatory for status/conflict model.

---

## AI retrieval

### Decision 10 — ACL staleness window

- Three sensitivity levels with maximum ACL refresh lag:
  - `high sensitivity`: `0-5 min`
  - `medium sensitivity`: `<= 15 min`
  - `low sensitivity`: `<= 60 min`
- If a connector does not meet the window for a given sensitivity class, the result must be treated as `stale_acl` / degraded, not as fully trusted retrieval.
- Rule: the higher the sensitivity, the closer to runtime-check, not cache-only.

### Decision 11 — Custom search presets

- Org admin may create custom presets, but only as tenant-scoped extensions.
- Platform-defined presets remain the canonical baseline.
- Admin may: clone a platform preset, override fields allowed by policy, create a custom preset within permitted scope/tool/source policy.
- Admin may not: bypass ACL, change trust vocabulary, change core source-governance semantics.

### Decision 12 — Web search in governed pipeline

- Web search is treated as a separate `external scope` path, not as a regular enterprise pseudo-connector.
- Must be visible as a separate external source with its own trust and freshness semantics.
- May be wrapped in connector-like runtime, but the product must not pretend it is the same governance class as tenant connectors.

---

## Execution spine (continued)

### Decision 13 — Review expiration threshold

- Default for `waiting_for_review`: `72h`.
- After expiration, state transitions to `review_expired`.
- Run is not auto-cancelled; it remains resumable or re-plannable depending on policy.
- Shorter SLAs may exist later per workload/risk class, but Wave 1 baseline = `72h`.

### Decision 14 — Re-planning after rejection

- Re-planning creates a new plan version within the same run.
- A new run is created only when context boundary, target scope, or execution intent changes fundamentally.
- Canonical rule: `same objective + same effective context => same run, new plan version`.

### Decision 15 — Batched approval granularity

- Default: mixed mode.
- Reviewer may reject or accept items individually within a batch.
- System may offer quick action `approve all / reject all` as a UX shortcut, not as a canonical model constraint.
- Reason: all-or-nothing is too rigid for real proposal bundles.

---

## Multiplayer version / replay (continued)

### Decision 16 — Snapshot compaction policy

- Wave 1 / early production baseline: retain full event stream, create periodic snapshots, compact old intermediate snapshots without destroying replay/audit truth.
- Exact numeric thresholds not closed yet without engineering + ops alignment.
- Product decision now: replay and audit fidelity wins over storage neatness. Compaction cannot destroy restore points required for support and review.

### Decision 17 — Restore UX during active collaboration

- Restore during active collaboration requires an explicit confirmation dialog.
- Restore must not be silent.
- Displaced editors must see an explicit state transition: object restored, local editing state is stale, rejoin / refresh / compare.
- Rule: restore is a room-visible event, not a local action.

---

## PM sync cross-check (continued)

### Decision 18 — SYNC_MODES doc update

- Update existing canonical sync/conflict docs (not a new parallel document).
- Add conflict classes: `field_authority_conflict`, `stale_snapshot_conflict`.
- Add resolution paths: `replay_after_fix`, `escalate`.
- Introduce 3-level severity model: `low`, `medium`, `high`.
- Add explicit reference to dead-letter doctrine and operator recovery path.

---

## Additional implementation rules

- If these decisions require a wave-order change, escalate separately.
- If the object-level sync enum after cross-check requires a new canonical doc or update to an existing doc, propose a minimal change, not a new parallel document.

---

## Related packets

- `WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md`
- `WP-W1-AI-02_GOVERNED_RETRIEVAL_BASELINE.md`
- `WP-W1-AI-03_EXECUTION_PROPOSAL_APPROVAL_SPINE.md`
- `WP-W1-MP-01_MULTIPLAYER_PLATFORM_BASELINE.md`
- `WP-W1-MP-02_VERSION_REPLAY_AUDIT_SPINE.md`
- `WP-W1-PMSYNC-01_PM_SYNC_PLATFORM_TRUTH.md`
- `WP-W1-PMSYNC-02_CONFLICT_CROSSCHECK_AND_RATIFICATION.md`
