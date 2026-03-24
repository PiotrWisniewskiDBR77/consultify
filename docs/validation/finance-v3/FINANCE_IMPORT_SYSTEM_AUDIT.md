# Finance Import System Audit

## Scope
Audit of the current `upload -> detect -> extract -> map -> validate -> confirm` pipeline for financial statement ingestion and normalization.

Primary implementation anchors:
- `server/src/routes/finance-statements.routes.ts`
- `server/src/services/financialStatementService.ts`
- `server/src/services/openAIFinancialExtractionService.ts`
- `src/components/Finance/FinancialStatementImportWizard.tsx`
- `src/components/Finance/FinancialStatementWorkspace.tsx`

## Executive Verdict
The current system is operational but not yet trustworthy enough for CFO-grade financial ingestion.

The biggest issue is not the lack of stages or audit tables. The system already persists ingest runs, source artifacts, candidate rows, mapping candidates, validations, versions, and repair sessions. The real problem is that the core extraction and mapping still behave heuristically, while the existing test gate is too weak to expose exact defects.

Bootstrap exact-output corpus result:
- total fixtures: `6`
- passed: `0`
- failed: `6`
- extraction failures: `6`
- mapping failures: `2`

## Current Flow
1. `POST /upload`
   Creates a draft statement, detects type/profile, stores raw text, starts ingest run, and records upload artifacts.
2. `POST /:id/detect`
   Recomputes metadata and allows manual section selection.
3. `POST /:id/extract`
   Extracts candidate rows from source text or AI-assisted extraction and persists extracted sections plus candidate rows.
4. `POST /:id/map`
   Produces canonical suggestions and persists mapping candidates.
5. `PUT /:id/values`
   Saves confirmed values, validation ledger, evidence, versions, and readiness state.
6. `POST /:id/confirm`
   Gates final confirmation on `statement-ready`.

## Hard Findings

### 1. Exact extraction is currently unreliable
Bootstrap corpus inspection surfaced numeric corruption in multiple statement families.

Observed examples:
- `Current Assets 2025` extracted as `450202` instead of `450`
- `Cash and cash equivalents 2025` extracted as `210202` instead of `210`
- `Operating cash flow 2025` extracted as `420202` instead of `420`
- `EBITDA 2025` extracted as `920202` instead of `920`

This indicates a period-column binding/parsing defect in the extraction layer, not just a UI issue.

### 2. Mapping quality is still fragile for Polish cash flow
In the bootstrap corpus:
- `Przepływy pieniężne netto z działalności operacyjnej 2025` was mapped to investing cash flow
- investing and financing rows were left unmapped

This is a core taxonomy/solver weakness, not a recoverable labeling inconvenience.

### 3. The existing benchmark is threshold-based, not truth-based
Current benchmark only checks:
- expected statement type
- expected document class
- minimum extracted row count
- minimum mapped row count

That means obviously wrong outputs can still pass if they produce enough rows.

Current benchmark anchor:
- `server/scripts/benchmark-statement-ready.ts`

### 4. The main unit coverage is far too thin
Current directly relevant unit coverage is concentrated in:
- `tests/unit/backend/services/financialStatementService.test.ts`
- `tests/unit/backend/services/financialStatementPackService.test.ts`

The core ingestion risks are mostly untested:
- exact detection
- exact extraction
- period selection
- numeric parsing
- exact canonical mapping
- failure-mode classification

### 5. Frontend still under-surfaces backend diagnostics
The import wizard and recovery UI do not elevate the full backend audit surface strongly enough.

Examples:
- extraction warnings and strategy are not treated as first-class review signals
- review surfaces can under-show or simplify evidence
- users can move into correction/recovery without fully seeing where extraction certainty collapsed

## Failure Mode Matrix

| Failure mode | Severity | Current evidence |
|---|---:|---|
| Numeric value corruption during extraction | Critical | Present across BS, CF, P&L bootstrap cases |
| Missing line capture | High | `Revenue 2025` missing in `pl-basic.json` bootstrap case |
| Wrong canonical mapping for Polish CF | Critical | Operating CF mapped to investing CF |
| Threshold benchmark hides bad results | Critical | Existing benchmark accepts wrong values if counts are high enough |
| Frontend trust surface weaker than backend artifacts | High | Wizard/workspace do not foreground all extraction risk signals |
| Client-driven mapping state drift risk | High | `/:id/map` still depends on client-supplied lines |

## Choke Points

### Backend
- `server/src/routes/finance-statements.routes.ts`
  - `/upload`
  - `/:id/detect`
  - `/:id/extract`
  - `/:id/map`
  - `/:id/values`
- `server/src/services/financialStatementService.ts`
  - `detectStatementType()`
  - `resolveStatementColumnSelection()`
  - `extractFinancialLines()`
  - `autoMapLines()`
  - `resolveDuplicateSuggestedMappings()`
  - `evaluateStatementReadiness()`

### Frontend
- `src/components/Finance/FinancialStatementImportWizard.tsx`
- `src/components/Finance/FinancialStatementMappingEditor.tsx`
- `src/components/Finance/FinancialStatementWorkspace.tsx`

## Audit Conclusion
The outer architecture is worth preserving:
- audit artifacts exist
- readiness contract exists
- downstream gating exists
- repair states exist

The extraction and mapping core is not yet trustworthy enough to certify. The next step cannot be another ad hoc patch series. It must be:
1. exact-output audit gate,
2. architecture decision,
3. controlled remediation or rebuild of the core extraction/mapping engine.
