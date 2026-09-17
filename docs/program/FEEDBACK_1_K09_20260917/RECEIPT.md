# FEEDBACK-1 K-09 — Dynamic SWOT AI Draft

Status: **READY FOR CTO REVIEW**

- Base: `be57c5dae677844a224d78d874d3ab52444a882d`
- Branch: `codex/feedback-1-k09-dynamic-swot-20260917`
- Scope: FEEDBACK-1 W120 position 4, DEC-498 continuation.

## Behavior

The existing DEC-498 guard already handled a stream that ended without a usable result. This package closes the two remaining paths behind the tester symptom:

1. Every visible progress field, including the real Properties panel, shows `Generating…` while a full Dynamic SWOT draft is running instead of presenting session completion `0%` as AI progress.
2. A Dynamic SWOT stream with no fresh visible activity for 30 seconds is aborted into an explicit retryable error. Fresh content from the current attempt resets the inactivity window. The existing 90-second total limit remains in place.
3. The 30-second watchdog is scoped to `dynamic-swot`; other tools keep the existing 90-second behavior.
4. Cancel, unmount, silent end, invalid result, success, and timeout paths clear both timers and preserve the user's input.

## Evidence

- Focused behavior: 2 files / **17 PASS**, `--retry=0`, one worker.
- Mutations:
  - changing the inactivity window from 30 to 90 seconds makes the 30-second silent-stream test RED;
  - restoring the Properties value to `${progress}%` makes the mounted `ToolDocumentView` test RED.
- Exact lock: `@types/node 22.19.3`.
- Front TSC: base **152**, candidate **152**; the only hit in a changed product file is the pre-existing `ToolDocumentView.tsx` ArtifactType diagnostic outside the changed hunk.
- Server TSC: **0 / RC=0**.
- Guards: language PASS without growth; flag Docker guard 196/208, missing 0; list canon 346=346; artifact crimson 8=8; new `as any` 0; `git diff --check` PASS.
- Independent final reviews: UI **ACCEPT P0=0/P1=0/P2=0**; backend/timer lifecycle **ACCEPT P0=0/P1=0/P2=0**.

No migration, new flag, staging write, deploy, Railway change, protected-ref push, or screenshot.
