# Finance Import Remediation Program

## Objective
Restore trust in financial statement ingestion by replacing heuristic correctness with measurable, auditable quality.

## Workstreams

### WS1. Exact-output quality gate
Deliverables:
- exact corpus manifest
- strict corpus audit script
- operator-facing automation commands
- failure-mode summary for every fixture

Initial anchors:
- `server/scripts/fixtures/statement-ready-corpus.v1.json`
- `server/scripts/audit-statement-import-corpus.ts`

### WS2. Structured extraction engine
Deliverables:
- explicit period-column binding
- exact numeric token selection
- row segmentation that does not blend labels with period tokens
- stable extraction objects with provenance fields

Primary implementation targets:
- `server/src/services/financialStatementService.ts`
- `server/src/services/openAIFinancialExtractionService.ts`

### WS3. Deterministic mapping engine
Deliverables:
- structured candidate generation
- constrained solver with section and subtotal awareness
- document-family overrides as first-class rules
- hard diffing against the corpus

Primary implementation targets:
- `server/src/services/financialStatementService.ts`
- template/document-family services and migrations

### WS4. Review workbench
Deliverables:
- extraction warnings shown before mapping
- selected section and selected period exposed as authoritative context
- mapping rationale visible to reviewer
- non-financial exclusions reviewable
- exact blockers displayed before confirm

Primary UI targets:
- `src/components/Finance/FinancialStatementImportWizard.tsx`
- `src/components/Finance/FinancialStatementMappingEditor.tsx`
- `src/components/Finance/FinancialStatementWorkspace.tsx`

### WS5. Server-owned import state
Deliverables:
- server becomes authoritative for extracted rows and mapping candidates
- mapping and value operations reference persisted candidate state, not reconstructed client payloads
- drift between UI payload and backend evidence is eliminated

Primary route target:
- `server/src/routes/finance-statements.routes.ts`

## Execution Order
1. Lock the exact-output gate.
2. Repair numeric extraction correctness.
3. Repair section/period binding.
4. Repair canonical mapping solver.
5. Upgrade review UI to surface the true evidence.
6. Harden server ownership of import state.

## Release Phases

### Phase A. Stabilization
Goal:
- no more hidden hard failures
- exact gate exposes truth

### Phase B. Core correctness
Goal:
- extract the right numbers
- map the right canonical lines

### Phase C. Review-grade usability
Goal:
- reviewers understand exactly what the engine did and why

### Phase D. Certification
Goal:
- finance import changes are blocked unless corpus and release gate pass

## Exit Criteria
- corpus strict mode passes for bootstrap suite
- real redacted corpus reaches target pass rate
- no unexpected `5xx` in import flow
- `ready` becomes a trustworthy status, not a workflow milestone
