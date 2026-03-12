# Statement Ready Contract

## Purpose
`statement-ready` is the canonical quality gate for financial statements in Finance.

Only `statement-ready` statements may seed:
- financial models
- financial analyses
- downstream valuation flows that depend on trusted statement data

## Business States
- `ready`: passed the full quality gate and can be used downstream
- `recoverable`: recognized financial data exists, but recovery is still required
- `rejected`: did not meet the minimum recognition contract
- `pending`: still in ingestion pipeline

## Required Conditions For `ready`
- detected statement type is one of `P&L`, `BS`, `CF`
- document reached mapping stage or confirmation stage
- at least one eligible financial line exists
- all eligible financial lines are mapped to canonical lines
- validation has no hard failures
- non-financial rows are explicitly excluded from the eligible set
- readiness summary and reason codes are persisted

## Recovery Rules
A statement is `recoverable` when:
- financial lines were recognized, but mapping coverage is incomplete
- validation has warnings only
- document profile is supported, but extraction or mapping needs another pass

## Rejection Rules
A statement is `rejected` when:
- no eligible financial lines remain after filtering
- statement type is unsupported or unusable
- extraction fails to produce trustworthy structured rows

## Backend SSOT
Primary implementation anchors:
- `server/src/services/financialStatementService.ts`
- `server/src/routes/finance-statements.routes.ts`
- `server/src/services/financialModelingService.ts`
- `server/src/services/financialAnalysisService.ts`

## Frontend SSOT
Primary UI anchors:
- `src/components/Economics/financeTypes.ts`
- `src/components/Economics/hooks/useFinanceData.ts`
- `src/components/Finance/FinancialStatementImportWizard.tsx`
- `src/components/Finance/FinancialStatementWorkspace.tsx`

## Non-Negotiables
- `confirmed` must never bypass readiness
- UI and backend must use the same readiness contract
- recoverable and rejected imports must stay outside downstream creation flows
- each import attempt must leave a durable audit trail
