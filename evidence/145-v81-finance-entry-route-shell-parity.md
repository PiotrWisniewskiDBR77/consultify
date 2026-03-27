# V8.1 Finance Entry Route Shell Parity

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Status: `done`

## Goal

Make `/finance` the canonical finance route authority while preserving `/economics` as a compatibility
alias, so the live finance module has one consistent shell entry path.

## What changed

1. Route authority
   - updated `src/routes/routeConfig.ts`
   - `AppView.ECONOMICS` now resolves canonically to `/finance`
   - `getAppViewFromPath()` now maps both `/finance` and `/economics` to the finance module

2. Shell protection
   - updated `src/components/RouterSync.tsx`
   - unauthenticated access to `/finance` is now protected like the other governed module entries

3. Chat navigation
   - updated `src/services/chatNavigator.ts`
   - economics/finance navigation now targets the canonical `/finance` route

4. Regression coverage
   - updated `tests/unit/routes/routeConfig.test.ts`
   - updated `tests/navigation/routeMapping.test.ts`
   - updated `tests/components/RouterSync.idea-artifact.test.tsx`
   - added `tests/unit/services/chatNavigator.test.ts`

## Why this matters

This closes the smallest high-value split-brain in the finance lane:

- operators now have one canonical finance entry path
- shell routing and chat-driven navigation no longer disagree on `/finance` vs `/economics`
- deeper finance runtime and mutation packets can now build on a single route authority

## Verification

`npx vitest run tests/unit/routes/routeConfig.test.ts tests/navigation/routeMapping.test.ts tests/components/RouterSync.idea-artifact.test.tsx tests/unit/services/chatNavigator.test.ts`
