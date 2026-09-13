# F2-1 E1b — slice 2 checkpoint V1

Status: **PARTIAL / HOLD full E1**. This slice connects the accepted Slice 1 capture → external model → finalize domain flow to the existing runtime-v1 router and canonical stores. It does not deliver the review UI, item-resolution commands, concurrent exactly-once model spend, or real-model quality evidence.

## Production path and authority

- The route is mounted at `server/src/Gateway.ts` → `/api/initiatives`, then `server/src/routes/pmo/initiatives.routes.ts` → `/runtime-v1`. The new API is therefore `/api/initiatives/runtime-v1/portfolio-analyses` and its exact-identity GET.
- Both endpoints use the inherited authenticated actor, organization membership/trial middleware, tenant-scoped readers, project-scoped `initiative.review` or `initiative.view`, and the existing governance-policy resolver. Foreign and missing reads return the same 404.
- `ENABLE_INITIATIVE_PORTFOLIO_ANALYSIS` is default OFF and accepts only the exact string `true`. While disabled, POST/GET return 404 before scenario or analysis readers run. Existing APIs are unchanged.
- Persistence remains the existing `portfolio_analysis` MaterialCommand aggregate in `ie_aggregate_state`, with existing audit/outbox/receipts. No table, migration, UoW, schema, default flag or client-side analyzer was added.

## Server-owned snapshot and model boundary

- `PostgresPortfolioConsultingAnalysisRuntimeService` obtains one PostgreSQL `clock_timestamp()` as `asOf`, reads an exact tenant scenario and its memberships, resolves the exact canonical Initiative versions through `PostgresInitiativeReader` plus `initiativeUnifiedReader`, and preserves `projectId=null`.
- The frozen snapshot includes the exact scenario payload/version, canonical Initiative facts and evidence references, Decision history including the separate DEC-479 `IN|PARKING|ARCHIVE` disposition/reason/returnCondition, running work, and the exact governed organization-context snapshot/version/hash including restricted claims.
- A DRAFT or PUBLISHED scenario may be captured. The reader does not invent an analysis-only publication gate; it instead locks and revalidates the exact frozen scenario/version in the accepted Slice 1 domain flow.
- POST accepts identifiers/versions/rubric only. Strict validation rejects caller snapshots/model provenance. Replay reuses the persisted capture snapshot so a fresh clock cannot change the idempotency fingerprint, and it rejects a different scenario/context/rubric for the same analysis identity.
- `ConfiguredPortfolioConsultingModelGateway` resolves the configured premium provider/model, disables response cache, binds provider/model/version/prompt/run/time provenance, rejects QA mock output, and tells the model to keep PARKING/ARCHIVE suppressed unless the frozen snapshot explicitly proves the return condition. Slice 1 independently proves the gateway is called outside every MaterialCommand transaction and that finalize revalidates source versions/digest under short locks.

## Evidence

- Behavioral route RED: `e1b-slice2-route-red-v1.json`, 1/3 PASS and 2/3 FAIL because POST/GET did not exist. SHA-256 `6eade8d44c89a545be6e267f5b8208da3f06fd597fcd9a8c6e94ff5b5a319a7f`.
- Final focused command: `npx vitest run server/src/domain/initiatives-execution/__tests__/portfolioConsultingAnalysis.e1b.test.ts server/src/domain/initiatives-execution/__tests__/portfolioDecisionDisposition.e1b.test.ts server/src/services/initiative/__tests__/portfolioConsultingAnalysisRuntimeService.test.ts server/src/routes/pmo/__tests__/portfolioConsultingAnalysisRuntime.routes.test.ts --reporter=json --outputFile=evidence/f2-inicjatywy-4/e1b/e1b-slice2-focused-green-final.json`.
- Final focused result: 4 files / 10 reported suites / **39/39 tests PASS**, SHA-256 `24999c322aca9d738065f2dd9eedb273d0fc504305a5377c7c181000e8e9464c`.
- Final RealPG command used the credential-safe local wrapper against the assigned `cx-codex6-pg` database and ran only `portfolioConsultingAnalysisRuntime.gateway.pg.test.ts`. Result: 1 file / 2 reported suites / **3/3 tests PASS**, SHA-256 `13dc4047697282d387e3943e4fecb9d668d48b96bd7ac2c08ba1bc2aa69c3256`.
- RealPG exercises signed JWT, actual auth/membership/effective access/governance, real PostgreSQL canonical scenario/Initiative/Decision/task/context rows, real MaterialCommand capture/finalize/readback/receipts, replay without a second model invocation, the actual ApiGateway GET mount, foreign/missing equal 404, and final zero readback across 11 owned fixture categories. Its model gateway is deliberately a stub and is not quality evidence.
- Historical `e1b-slice2-realpg-historical-fail-v1.json` remains 1/2 and is retained as failed integration evidence; it is not counted as GREEN.
- Server TypeScript: `npx tsc --noEmit -p server/tsconfig.json`, exit 0.
- Four new source/test files ESLint: exit 0, 0 errors and 12 test-harness warnings. The inherited 8k-line router remains lint-red, but base and candidate are identical by rule/count: 246 errors and 48 warnings each; Slice 2 adds no lint diagnostic. `git diff --check` exit 0.

## Real-model gate

**EVIDENCE_MISSING.** No provider call was run. The process environment has no OpenAI/OpenRouter/Gemini key, and the assigned local PostgreSQL database contains zero active provider rows with a nonempty, non-placeholder key. The configured-gateway unit test and RealPG stub prove orchestration and provenance boundaries only. They do not prove consulting quality on two materially different organization contexts.

## Open before full E1

- Real configured-model quality on two materially different organization contexts, with source-grounded outputs and privacy/cost evidence.
- A durable worker/lease or equivalent proof that two simultaneous workers cannot both spend a model call before one finalize CAS wins.
- StandardTable + StandardPreview review queue, per-item and bulk human accept/reject/edit/comment, source column and EN/PL behavior.
- Canonical portfolioDecision application for selected items, stale-analysis behavior, return-condition suppression/re-proposal behavior after source change, and complete DEC-479 UI/readback.
- I1.14–I1.18 runtime/browser acceptance and full E1.
