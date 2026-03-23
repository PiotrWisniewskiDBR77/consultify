# V8 Program — Wave 1 Decision Log

> Status: Active
> Authority: Source-of-truth chat decisions
> Date: 2026-03-23
> Scope: binding decisions for Wave 1 escalation items from packets WP-W1-AI-01, WP-W1-MP-01, WP-W1-PMSYNC-01

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

## Additional implementation rules

- If these decisions require a wave-order change, escalate separately.
- If the object-level sync enum after cross-check requires a new canonical doc or update to an existing doc, propose a minimal change, not a new parallel document.

---

## Related packets

- `WP-W1-AI-01_CONTEXT_IDENTITY_BASELINE.md`
- `WP-W1-MP-01_MULTIPLAYER_PLATFORM_BASELINE.md`
- `WP-W1-PMSYNC-01_PM_SYNC_PLATFORM_TRUTH.md`
