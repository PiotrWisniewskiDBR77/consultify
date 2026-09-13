# F2-1 E1b — slice 2 checkpoint V2

Status: **PARTIAL / HOLD full E1**. V2 retains the accepted Slice 2 route/snapshot orchestration and closes the V1 independent-review privacy blocker. V1 checkpoint and evidence remain unchanged as the historical HOLD.

## Privacy correction

- The model is no longer given the privileged `includeRestricted:true` organization-context snapshot. Both capture and finalize revalidation use the standard `OrganizationContextService.getSnapshotVersion(organizationId, version)` read, whose binding contract filters claims with `visibilityScope='restricted'` and their source references.
- The persisted `portfolio_analysis` snapshot, request digest, model input, generated result, MaterialCommand audit, outbox and receipts therefore contain only the ordinary visible context. POST and GET can return the persisted analysis to their existing `initiative.review`/`initiative.view` audiences without exposing restricted bytes.
- This is source exclusion, not claimed semantic redaction. The model cannot summarize the restricted fixture because it never receives it. V2 does not invent a restricted-context capability or a privileged analysis-result route.
- Full context remains in the immutable organization-context snapshot store under its existing policy. Public claims and public source references remain available to the analysis.

## Matched RED → GREEN

- `e1b-slice2-privacy-red-v1.json`: the exact V1 privileged read was temporarily restored against the new behavior tests. Result **7/9 PASS, 2/9 FAIL**: capture included the restricted claim and finalize reopened both public and restricted claims. SHA-256 `2f1d942b4f2906f56d48e9b4a7dd029d9a2a99eeacf89a48f4b17cab1251c08a`.
- The production correction removes `includeRestricted:true` from both reads. Unit behavior proves capture and finalize see the same public projection, retain the public claim/source reference, and exclude the restricted marker.
- Final focused command: `npx vitest run server/src/domain/initiatives-execution/__tests__/portfolioConsultingAnalysis.e1b.test.ts server/src/domain/initiatives-execution/__tests__/portfolioDecisionDisposition.e1b.test.ts server/src/services/initiative/__tests__/portfolioConsultingAnalysisRuntimeService.test.ts server/src/routes/pmo/__tests__/portfolioConsultingAnalysisRuntime.routes.test.ts --reporter=json --outputFile=evidence/f2-inicjatywy-4/e1b/e1b-slice2-focused-green-v2.json`.
- Final focused result: 4 files / 10 reported suites / **40/40 PASS**, SHA-256 `57ead83d8fe8c12c85028e4419f9013bccfc08765a18bdf80446a795a18d3718`.

## Signed-JWT RealPG proof

- Final result: 1 file / 2 reported suites / **3/3 PASS**, SHA-256 `8d48fabf2b43592b3054c0b560d288f90669ced1100293580c846452b1e1ac5f`.
- The fixture stores one public and one restricted governed-context claim plus matching source references. An ADMIN performs capture; the model spy receives the public marker and never the restricted marker.
- POST, persisted aggregate, ADMIN GET, actual ApiGateway GET and a lower-privilege same-project `BUSINESS_OWNER` holding `initiative.view` retain the public marker and exclude the restricted marker.
- The test scans the analysis aggregate, audit payloads, outbox payloads and command-receipt responses and proves the restricted marker is absent. Foreign and missing reads remain the same 404.
- Cleanup remains an independent third test and proves zero rows across all 11 owned fixture categories.
- The model remains a stub. This proves the data boundary, authorization, orchestration and persistence; it is not consulting-quality evidence.

## Other final gates

- Server TypeScript: `npx tsc --noEmit -p server/tsconfig.json`, exit 0.
- Four new source/test files ESLint: exit 0, 0 errors and 12 test-harness warnings. The production router is unchanged from V1 and retains exact base/candidate parity: 246 inherited errors and 48 warnings, zero added diagnostics.
- `git diff --check`: exit 0.
- No schema, migration, UoW, UI, E2 or default-flag change.

## Remaining boundaries

- Real configured-model quality on two materially different organization contexts remains **EVIDENCE_MISSING**: no provider credential is available in the process or assigned local database.
- Concurrent exactly-once model spend remains unproved.
- Review queue, StandardTable/StandardPreview, per-item/bulk human decisions, canonical portfolioDecision application and I1.14–I1.18 runtime/browser acceptance remain open.
- Full E1 remains **HOLD**.
