# 530 - V8.1 Finance must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Finanse` / `FinanceHub` must-have closure

## Problem before closeout

- Finance still exposed two route truths: canonical navigation preferred `/finance`, while cross-module handoffs still linked to `/economics`.
- `FinanceHub` consumed `tab` from the URL only on entry; in-module tab changes did not write state back to the URL, so refresh/share lost context.
- `Results -> Finance` handoff opened the valuation area without passing any initiative context.
- `budgets` and `valuations` were split-brain flows:
  - reads could come from V8,
  - create/delete still lived on legacy economics routes.
- The finance runtime strip disappeared completely when `V8FinanceApi.getDashboard()` failed, so users could not tell “no data” from “dashboard unavailable”.
- Full finance document fallback still exposed raw `JSON.stringify(...)` instead of an honest product state.

## What landed

### 1. Canonical route and URL contract

- `src/components/Economics/FinanceHub.tsx`
  - canonicalizes `/economics` to `ROUTES.FINANCE`,
  - keeps `tab` synchronized with the URL during normal navigation,
  - preserves finance deep-link context while migrating the alias.

### 2. Honest `Results -> Finance` handoff

- `src/components/Results/ResultsSummaryView.tsx`
  - finance CTA now links to `ROUTES.FINANCE`,
  - passes `tab=valuation`,
  - passes initiative context (`initiativeId`, `initiativeName`) into the finance route contract.
- `src/components/Economics/FinanceHub.tsx`
  - consumes `initiativeName` and uses it as entry search context when relevant.

### 3. Single-family truth for budgets and valuations

- `src/components/Economics/hooks/useFinanceData.ts`
  - budgets now read from the same legacy economics family as budget writes,
  - valuations now read from the same legacy economics family as valuation writes.
- This removes the user-facing mismatch where list/readback could drift from create/delete because the list came from a different API family than the mutation path.

### 4. Runtime strip remains visible in degraded mode

- `src/components/Economics/FinanceHub.tsx`
  - finance runtime strip is now always rendered,
  - when the V8 finance dashboard is unavailable, chips stay visible with `—` markers instead of disappearing.

### 5. Honest unsupported full-view fallback

- `src/components/Economics/FinanceHub.tsx`
  - removed raw JSON fallback from full-view document mode,
  - replaced it with a normal inline empty/unsupported state and a clear return-to-list action.

## Automated verification

Passed:

- `npx vitest run tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx tests/components/Economics/useFinanceData.v8-analyses.test.tsx`

Coverage includes:

- governed finance runtime strip remains visible across tabs,
- degraded runtime strip still renders with unavailable markers,
- `/economics` deep links canonicalize to `/finance`,
- active finance tab writes back to the URL,
- import-complete statement lookup still uses the governed V8 seam first,
- budgets and valuations now stay on a single API family for list/readback truth.

## Manual acceptance checklist

- Open a legacy finance alias URL like `/economics?tab=valuation` and confirm it resolves to `/finance?tab=valuation`.
- Switch tabs inside Finance and confirm the URL changes with the active tab.
- From `Results`, click the `Finanse` action on an initiative and confirm Finance opens on valuation with preserved route context.
- In Finance, verify runtime chips remain visible even if the dashboard request fails; values should show `—`, not disappear.
- Open an unsupported finance document kind and confirm the user sees a normal empty/unsupported state instead of raw JSON.
- Create/delete a budget and valuation and confirm the list reflects the same source family used by the mutation flow.

## Residual risk

- Finance still has deeper backend parity gaps for budget/valuation V8 mutations and some pack delete/detail operations; this closeout intentionally avoids pretending that parity already exists.
- Initiative context in `Results -> Finance` is currently a route/search contract, not a full initiative-linked valuation creation workflow.
- Statement/model/analysis seams remain partially V8-first with legacy fallbacks; this closeout focused on the user-visible finance truth mismatches that were highest risk in the must-have tranche.

## Status

- `Finanse` now has a coherent route truth, honest cross-module entry, clearer degraded runtime behavior, and a non-split read/write truth for budgets and valuations.
- Current closure status: code landed, focused tests green, manual acceptance still required.
