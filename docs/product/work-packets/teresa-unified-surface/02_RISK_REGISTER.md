# 02 — Phase 1 Risk Register

Source SSOT §10. This register expands each risk with: trigger, blast radius, owner, mitigation, residual, and rollback. Risks are tracked across Phase 1 and revisited at the Phase 1 → Phase 2 gate.

Severity scale: `S1` (project-stopping), `S2` (sprint-stopping), `S3` (recoverable in-sprint).

## R1 — Phase 1 must precede Phase 2 (sequencing)

- **Severity:** S1
- **Trigger:** A parallel agent removes a module-local prompt or `AgentPanel` input before Phase 1 is live.
- **Blast radius:** Deck / document / sheet generation breaks because Teresa cannot yet route the user's free-form text to the module pipeline. End-user impact is total in the affected module.
- **Owner:** Product (sequencing) + Engineering manager (PR review).
- **Mitigation:**
  - SSOT §11 (Handoff) gate is in place with explicit DON'Ts.
  - Adjacent SSOT gates added in `TBL-FU-3_*` and `PREZENTACJE_V8_AI_GOVERNANCE.md`.
  - Code review checklist in SSOT §11.4 lists the rejection criteria.
  - Phase 1 task packet §2 (Non-Goals) explicitly forbids removal in this packet.
- **Residual risk:** Low if the gates are honored; medium if a new agent joins without reading the SSOT. Reduced further by adding the SSOT-read receipt to PR template.
- **Rollback:** Revert the offending PR. No data implications.

## R2 — Provider mount placement

- **Severity:** S2
- **Trigger:** `ChatSurfaceContext` provider mounted too low (e.g., inside an artifact view) so navigating away from that view unmounts Teresa's context source.
- **Blast radius:** Teresa "forgets" which module is active mid-conversation; suggestions disappear or reflect a stale module. UX confusion; no data loss.
- **Owner:** Frontend.
- **Mitigation:**
  - Mount only in `MainLayout` and verify with the cross-route E2E (E2 in matrix).
  - Component test that swapping routes does not re-mount the provider.
- **Residual risk:** Low.
- **Rollback:** Move the provider one level up; redeploy.

## R3 — Feature flag drift / partial enable

- **Severity:** S2
- **Trigger:** A subsystem starts reading `ChatSurfaceContext` even when the flag is OFF, or a separate sub-flag is introduced for "just the badge" vs "just the chips".
- **Blast radius:** Inconsistent UI between users; QA cannot reproduce; rollback becomes ambiguous.
- **Owner:** Frontend.
- **Mitigation:**
  - One flag governs the entire Phase 1 surface (`teresaUnifiedSurfaceBinding`).
  - Lint rule: any read of `ChatSurfaceContext` outside the binding folder must be guarded by the flag (or the file lives in the binding folder which is itself flag-gated at the composition root).
- **Residual risk:** Low.
- **Rollback:** Toggle the flag OFF.

## R4 — i18n debt (raw keys leak to UI)

- **Severity:** S3
- **Trigger:** A module publishes a `labelKey` that exists in PL but not in EN (or vice versa).
- **Blast radius:** UI shows the raw key string; brand damage but no functional regression.
- **Owner:** i18n + Frontend.
- **Mitigation:**
  - CI gate F1 in matrix: `check-binding-keys.ts` blocks merge.
  - Locale fixtures used in component tests (B5 in matrix).
- **Residual risk:** Very low after CI gate is in place.
- **Rollback:** Fix locale file; redeploy.

## R5 — Cleanup correctness (stale suggestions)

- **Severity:** S3
- **Trigger:** A module forgets to clear context on unmount, or clears it after a delay; a different module loads and briefly sees the previous module's suggestions.
- **Blast radius:** UX flicker; in the worst case, a user clicks an out-of-context chip and an intent fires against a stale `artifactId`.
- **Owner:** Frontend.
- **Mitigation:**
  - Unit test A2 enforces one-tick cleanup.
  - `intentDispatcher` re-validates the active artifact id before invoking `onIntent`; mismatch → reject + audit.
- **Residual risk:** Low.
- **Rollback:** Patch the cleanup bug; flag stays ON.

## R6 — ACL drift (hidden privilege escalation)

- **Severity:** S1 if exploitable; S2 if cosmetic.
- **Trigger:** A user without module access can register a binding (because the gate is checked only at view mount, not at hook call), or `intentDispatcher` honors a capability that ACL would otherwise deny.
- **Blast radius:** Teresa would surface module operations that the current user is not permitted to perform; potential silent privilege escalation if the underlying API doesn't re-check.
- **Owner:** Sec + Frontend.
- **Mitigation:**
  - `useTeresaModuleBinding` calls `KimiModuleGate.check(moduleKey, actor)` at registration; deny → no-op + dev warning.
  - `intentDispatcher` re-checks at dispatch time (defense in depth).
  - Backend re-checks at request time; this is the ultimate guard regardless of UI behavior. Phase 1 does not weaken backend checks.
- **Residual risk:** Low. UI is hardened; backend remains the source of truth.
- **Rollback:** Toggle the flag OFF; the surface disappears entirely.

## R7 — Audit log volume

- **Severity:** S3
- **Trigger:** `intentDispatcher` emits an audit record for every dispatch including denied ones; chip-button-mashing inflates the log.
- **Blast radius:** Storage cost / signal-to-noise.
- **Owner:** Frontend / Sec.
- **Mitigation:**
  - Per-actor + per-intent rate limiter at the dispatcher; a denied burst collapses to one record with a count.
  - Sampling configurable via flag; default keep all in Phase 1 because volumes are low.
- **Residual risk:** Low.
- **Rollback:** Tune rate limits; no UI rollback needed.

## R8 — Antygravity P2 prioritization collision

- **Severity:** S2 (project schedule)
- **Trigger:** Phase 1 kick-off coincides with a regression sprint from Antygravity test reports landing as P0/P1 on Prezentacje.
- **Blast radius:** Frontend bandwidth contention; Phase 1 either ships rushed or the regression sprint slips.
- **Owner:** Product.
- **Mitigation:**
  - Phase 1 stays in `PLANNED` until Antygravity P2 backlog is reviewed.
  - Decision recorded in `03_DECISIONS_REQUIRED.md` (timing).
  - Phase 1 is small (binding only); if it must defer, the SSOT freeze is still valid and prevents new debt accumulating.
- **Residual risk:** Schedule, not technical.
- **Rollback:** Defer Phase 1; SSOT remains the gate against new module-local chats.

## R9 — Token / context bloat (Phase 2+ concern, listed for visibility)

- **Severity:** S3 (Phase 2+ horizon)
- **Trigger:** A single continuous Teresa thread spanning many artifacts inflates the system prompt token count.
- **Blast radius:** Cost; latency; quality degradation on long threads.
- **Owner:** AI runtime.
- **Mitigation (Phase 1):** Phase 1 does not change thread persistence or system prompt assembly. Captured here so Phase 2 inherits the risk register row already opened.
- **Residual risk:** Will be re-evaluated at Phase 2.

## R10 — Voice routing untouched but adjacent

- **Severity:** S3
- **Trigger:** `TeresaVoiceContext` is the sole owner of microphone access today. A module accidentally opens a voice session.
- **Blast radius:** Conflicting microphone capture; degraded UX.
- **Owner:** AI runtime / Frontend.
- **Mitigation:** Phase 1 task packet §2 forbids voice changes. Lint rule in SSOT §11 list keeps voice scope locked.
- **Residual risk:** Low. Out of Phase 1 scope.

## Summary

- S1 risks: R1, R6 (conditional). Both are governance-mitigated; technical mitigations are layered.
- S2 risks: R2, R3, R8. Each has a binary mitigation (correct mount / single flag / scheduling decision).
- S3 risks: R4, R5, R7, R9, R10. Standard hygiene.

Phase 1 is intentionally small precisely so the risk surface stays this short. Anything that would expand Phase 1 must add a row here first.
