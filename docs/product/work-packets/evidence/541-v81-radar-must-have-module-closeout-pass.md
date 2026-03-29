# 541 - V8.1 Radar must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Radar` / Home V2 shell must-have closure for the current wave

## Scope truth

- `Radar` already had:
  - actionable hero focus (`AIPulseCore`)
  - orchestrated block contract
  - existing shell error branch
- The remaining must-have gap was shell honesty:
  - the empty/error branch degraded to plain text
  - `useHomeData` surfaced raw error strings directly
  - the user had no obvious retry path

## Problem before closeout

- `useHomeData` stored raw `error.message` from load failures.
- `HomeView` rendered a plain red text line when no blocks were available.
- That left the user with a weak contract for a core decision surface:
  - no explicit recovery action
  - no clear reassurance that the day itself was not empty

## What landed

### 1. Product-safe Radar error copy

- `src/components/MyWork/Home/useHomeData.ts`
  - now stores a product-safe default error message instead of raw runtime copy
  - now exposes `refresh()`

### 2. Retryable Radar unavailable state

- `src/components/MyWork/Home/HomeView.tsx`
  - replaces the plain text failure view with `EmptyStateInline`
  - tells the user this does not mean the day is empty
  - adds a visible retry action wired to `refresh()`

## Automated verification

Passed:

- `npx vitest run tests/components/MyWork/HomeView.outputs.test.tsx tests/components/MyWork/AIPulseCore.actionable-priority.test.tsx`

Coverage includes:

- existing actionable-priority Radar contract remains intact
- HomeView still orchestrates blocks and actions correctly
- Radar unavailable state is explicit, retryable, and user-safe

## Manual acceptance checklist

- Open `Radar` normally and confirm the main home screen still renders the expected blocks.
- Simulate a home-data load failure and confirm the user sees:
  - a visible unavailable state
  - retry action
  - wording that does not imply the day is empty
- Retry from the error state and confirm the screen attempts reload.

## Residual risk

- This closeout covers the Radar shell contract, not deeper freshness/quality semantics of every upstream data block.
- It does not claim all upstream signals are equally mature; it closes the user-facing degraded-state honesty gap.

## Status

- `Radar` no longer falls back to a weak plain-text error surface.
- `Radar` no longer exposes raw load-copy as the main degraded-state contract.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
