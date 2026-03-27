# V8.1 Evidence - broader `Finance` parity split-brain map

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Finance` parity
Status: `active`

## Why this lane is now active

broader `Results / KPI / ROI` parity has now reduced the smallest honest visible results residuals into a bounded accepted state.

What remains next is no longer one more small finance analysis fix. It is broader parity expansion across visible Finance statements, models, valuations, budgets, and wider legacy-backed finance workflows that still sit outside the accepted bounded finance seam.

## Current split-brain

The broader finance product surface still mixes truth across accepted bounded V8-first analyses continuity and wider live legacy-backed finance behavior:

1. `evidence/154-v81-finance-t2-acceptance.md` closed the bounded finance chain for route authority, governed runtime strip continuity, analyses list/detail continuity, analysis creation/deletion, initiative proposals/accept, and bounded analysis operator mutations
2. that accepted packet chain explicitly left `statements`, `models`, `budgets`, `valuations`, import submissions, and wider finance mutation breadth as residual work rather than blockers for the bounded `T2` lane
3. the repository still shows active broader finance surfaces in `src/components/Economics/hooks/useFinanceData.ts` where:
   - `loadStatements()` reads legacy `/api/finance-statements/packs`
   - `loadModels()` reads legacy `/api/financial-modeling/models`
   - `loadValuations()` reads legacy `/api/economics/valuations`
   - `loadBudgets()` reads legacy `/api/economics/budgets`
4. the same hook already proves the bounded seam pattern on `loadAnalyses()`, which prefers `V8FinanceApi.getAnalyses()` and falls back to legacy only for compatibility statuses

This creates a visible broader split-brain:

1. the live Finance hub has governed V8 runtime truth and V8-first continuity for analyses,
2. but sibling Finance tabs still default directly to legacy contracts for statements, models, budgets, and valuations,
3. so broader `Finance` parity is not yet reconciled as one promoted lane.

## Smallest honest first packet

The first bounded packet is:

`broader Finance parity split-brain map`

It is the smallest honest packet because it:

1. names the broader finance residual instead of pretending one obvious models-only or budgets-only bug remains
2. preserves the already accepted bounded `Finance` lane as done work
3. avoids silently broadening into a whole finance-platform rewrite without explicit promotion
4. prepares the next real bounded packet only after the broader residual is explicit

## Likely next bounded seam

The strongest next bounded candidate now looks like:

`visible finance models list/read continuity on a governed V8-first seam`

Why this candidate leads:

1. `useFinanceData()` loads models for the default `models` tab and the shared `prediction` surface, so it is a real live read seam rather than a dormant backend-only gap
2. `src/services/api/v8/finance.ts` and `server/src/routes/v8/finance.routes.ts` already provide the V8 bridge pattern for finance analyses, so adding one bounded list/read seam is honest and mechanically aligned with the accepted finance stack
3. models list/read continuity is narrower and more honest than trying to absorb statements plus budgets plus valuations plus mutations into one first packet

## Explicitly not this packet

This split-brain map does not activate:

1. a full finance hub rewrite in one go
2. all finance reads and writes at once
3. reopening the accepted bounded `Finance` lane
4. a broad statements/models/budgets/valuations convergence rewrite framed as one more parity fix
