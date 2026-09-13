# F2-1 E1b — slice 1 checkpoint V3

Status: **PARTIAL / HOLD full E1**. This slice establishes a durable two-phase domain contract for consulting analysis and the DEC-479 disposition record. It does not expose an HTTP route, build the production unified-reader snapshot, configure a production model, or render the review queue.

## Delivered contract

- `portfolio_analysis` remains a MaterialCommand aggregate in existing `ie_aggregate_state`; no table, migration, flag default, or client-side analyzer was added.
- `capturePortfolioConsultingAnalysis` validates the runtime-v1 shape, tenant, canonical evidence-reference form and exact full payloads, then uses a short MaterialCommand transaction to lock and compare the Portfolio Scenario, canonical Initiatives, Decision history and running-work rows. It persists aggregate version 1 with status `CAPTURED`, immutable snapshot bytes and their request digest.
- The governed organization-context version is read through a tenant-scoped immutable-snapshot reader and compared byte-for-byte plus content hash. No `FOR SHARE` or MaterialCommand UoW extension remains; the context row is immutable by its existing contract.
- `runCapturedPortfolioConsultingAnalysis` reads the persisted capture and calls the model gateway outside every MaterialCommand transaction. The gateway receives only the persisted rubric, request digest and snapshot.
- Private `finalizePortfolioConsultingAnalysis` is not an exported caller seam. It runs a second short MaterialCommand transaction, revalidates the exact capture digest and all current source payloads/versions, validates gateway provenance/output, and CAS-writes aggregate version 2 with status `PENDING_REVIEW`, audit, outbox and receipt.
- Source drift between capture and finalize fails with named HTTP-409 domain rule `PORTFOLIO_ANALYSIS_SOURCE_CONFLICT` and writes no review aggregate/audit/receipt. A failed gateway leaves the capture unchanged and retryable. A persisted `PENDING_REVIEW` result returns without another model call.
- Output is strict ordered Observation → Recommendation → Decision. Items carry criterion, affected unique Initiative IDs, rationale, exact frozen field/source reference, confidence, alternatives, missing data and Decision-only proposed `IN|PARKING|ARCHIVE` disposition.
- DEC-479 disposition remains separate from lifecycle and human decision status. `decidePortfolio` verifies the exact pending analysis version/asOf/scenario/item/Initiative and stores reason, return condition, actor/time, source anchor and frozen analysis input. A rejected/archive decision keeps Initiative lifecycle at `READY_FOR_DECISION`; compatibility callers without the structured disposition retain existing behavior.

## Evidence

- Binding behavior RED: `portfolio-decision-disposition-red-v1.json` — 0/1 PASS; the prior writer had no structured disposition and stored raw `REJECTED` as Initiative disposition.
- Final focused command: `npx vitest run server/src/domain/initiatives-execution/__tests__/portfolioDecisionDisposition.e1b.test.ts server/src/domain/initiatives-execution/__tests__/portfolioConsultingAnalysis.e1b.test.ts --reporter=json --outputFile=evidence/f2-inicjatywy-4/e1b/e1b-domain-green-v3-final.json`.
- Final focused result: 2 test files, 26/26 tests PASS. This includes full-payload drift at unchanged versions, malformed sources/arrays/evidence refs, tenant context, model-outside-transaction, failed-model retryability, persisted-finalize no-repeat, and source-conflict zero-write behavior.
- Scoped ESLint over four source/test files: 0 errors, 25 explicit test-harness `any` warnings.
- Server TypeScript: `npx tsc -p server/tsconfig.json --noEmit --pretty false`, exit 0.

## Open before full E1

- Production snapshot builder/reader and authenticated tenant-authorized routes. This slice validates a complete server-supplied snapshot but does not yet make an HTTP body authoritative.
- Configured real-model execution and quality evidence for two materially different organization contexts. Current two-context proof uses a mock gateway and proves input separation only.
- A durable worker/lease preventing two simultaneous workers from both spending a model call before one finalize CAS wins. Saved `PENDING_REVIEW` retry is proven; concurrent exactly-once model invocation is not.
- Legacy-only Initiative version/provenance handling. Slice 1 deliberately accepts only exact canonical Initiative aggregates.
- Item-resolution commands, selected-only and bulk acceptance, comments/manual override, stale behavior after review starts, suppression/re-proposal rules.
- StandardTable + StandardPreview review queue, source column, EN/PL copy and Plan/Capacity navigation.
- Full route/schema/UI enforcement and ApiGateway/JWT/PostgreSQL readback. The focused domain tests do not prove runtime reachability.
- I1.14–I1.18 real-model/runtime acceptance and full E1.
