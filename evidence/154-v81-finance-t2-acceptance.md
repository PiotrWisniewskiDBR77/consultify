# V8.1 Finance T2 Acceptance

Date: 2026-03-26
Lane: `Finance`
Taxonomy: `T2`
Tranche: `Tranche 2`
Decision: `accepted`

## Acceptance basis

The bounded active `T2` packet for `Finance` is accepted as complete.

Accepted closure points:

1. routed finance entry authority is coherent around `/finance`, with `/economics` reduced to a compatibility alias
2. the governed finance runtime strip and dashboard continuity remain present on the live finance hub
3. active finance analysis and investment lists now follow a governed V8-first analyses seam with compatibility-only fallback
4. active analysis preview ratios and dedicated `FinancialAnalysisWorkspace` reads now follow governed V8-first seams
5. active analysis creation and deletion now follow governed V8-first seams across the live create and row-action entry points
6. the bounded analysis-to-initiative flow now follows governed V8-first continuity for both proposal discovery and acceptance
7. active operator mutations now follow governed V8-first seams for `run` and `approve`

## Evidence chain

- `docs/product/work-packets/T2_FINANCE_CHARTER.md`
- `evidence/144-v81-finance-split-brain-map.md`
- `evidence/145-v81-finance-entry-route-shell-parity.md`
- `evidence/146-v81-finance-analyses-list-read-seam.md`
- `evidence/147-v81-finance-analysis-ratios-preview-seam.md`
- `evidence/148-v81-finance-analysis-workspace-v8-read-seam.md`
- `evidence/149-v81-finance-initiative-proposals-v8-read-seam.md`
- `evidence/150-v81-finance-initiative-create-accept-v8-seam.md`
- `evidence/151-v81-finance-analysis-operator-mutations-v8-seam.md`
- `evidence/152-v81-finance-analysis-create-v8-seam.md`
- `evidence/153-v81-finance-analysis-delete-v8-seam.md`

## Verification basis

Passed:

- `tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx`
- `tests/components/Economics/useFinanceData.v8-analyses.test.tsx`
- `tests/components/Economics/useFinanceSelection.v8-analysis-ratios.test.tsx`
- `tests/components/Benefits/FinancialAnalysisWorkspace.v8-read-seam.test.tsx`
- `tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx`
- `tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx`
- `tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx`
- `tests/components/Economics/CreateAnalysisModal.v8-create.test.tsx`
- `tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx`
- `tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx`
- `tests/unit/services/v8-finance-api.test.ts`
- `server/src/routes/v8/__tests__/finance.routes.test.ts`

Verification command:

`npx vitest run tests/components/Economics/FinanceHub.v8-runtime-strip.test.tsx tests/components/Economics/useFinanceData.v8-analyses.test.tsx tests/components/Economics/useFinanceSelection.v8-analysis-ratios.test.tsx tests/components/Benefits/FinancialAnalysisWorkspace.v8-read-seam.test.tsx tests/components/Finance/ExportToOutputDialog.v8-proposals.test.tsx tests/components/Economics/useFinanceRowActions.v8-analysis-mutations.test.tsx tests/components/Economics/FinancePreviewPanel.v8-analysis-mutations.test.tsx tests/components/Economics/CreateAnalysisModal.v8-create.test.tsx tests/components/Economics/useFinanceRowActions.v8-analysis-create.test.tsx tests/components/Economics/useFinanceRowActions.v8-analysis-delete.test.tsx tests/unit/services/v8-finance-api.test.ts server/src/routes/v8/__tests__/finance.routes.test.ts`

## Residual note

Legacy-backed statements, models, budgets, valuations, import submissions, and broader finance mutation
breadth still exist in the repository, but they are no longer treated as blockers for this bounded `T2`
finance-lane acceptance. They are broader parity work, not absence of a working bounded V8-first
finance lane.
