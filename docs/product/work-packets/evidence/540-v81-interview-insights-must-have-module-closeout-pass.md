# 540 - V8.1 Interview insights must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Wnioski w Interview` must-have closure for the current wave

## Scope truth

- `Wnioski w Interview` already had a rich insight surface:
  - insight generation
  - insight viewer
  - insight hub integration
- The remaining must-have gap was trust, not breadth:
  - creator load failure could look like “there are no completed sessions”
  - hub error handling could expose raw backend payloads

## Problem before closeout

- `InsightCreatorModal` swallowed failed session/template loads into empty arrays, which could mislead the user into thinking there were no completed sessions to analyze.
- `InterviewHub` used a helper that could stringify raw backend error objects into user-visible toasts.

## What landed

### 1. Honest creator load state

- `src/components/Interview/InsightCreatorModal.tsx`
  - now tracks `loadError`
  - uses `Promise.allSettled()` for initial session/template loading
  - shows a retryable `EmptyStateInline` when generator data fails to load
  - explicitly tells the user this does not mean there are no completed sessions

### 2. Product-safe interview error copy

- `src/components/Interview/interviewErrorCopy.ts`
  - added `getSafeInterviewErrorMessage()`
  - filters out raw backend / structured payload leakage

- `src/components/Interview/InterviewHub.tsx`
  - now routes interview toasts through the shared safe error helper

## Automated verification

Passed:

- `npx vitest run tests/components/Interview/interviewErrorCopy.test.ts tests/components/Interview/InsightCreatorModal.error-state.test.tsx`

Coverage includes:

- plain safe messages are preserved
- raw backend-like payloads fall back to product-safe default copy
- insight creator shows retryable load error instead of false empty-state semantics

## Manual acceptance checklist

- Open the insight creator with completed sessions available and confirm normal loading still works.
- Simulate a creator load failure and confirm the modal shows:
  - a visible unavailable state
  - retry action
  - wording that does not imply there are no completed sessions
- Trigger an interview-hub failure and confirm the toast shows product-safe copy rather than raw JSON or backend payload fragments.

## Residual risk

- This pass closes the shell honesty around insight loading and error readback.
- It does not claim full productization of downstream insight-to-initiative workflows or deeper AI-quality governance.

## Status

- `Wnioski w Interview` no longer collapse load failures into fake “no sessions” emptiness.
- `Wnioski w Interview` no longer risk surfacing raw backend-shaped payloads to the end user.
- Current closure status: code landed, focused tests green, manual acceptance still required.
