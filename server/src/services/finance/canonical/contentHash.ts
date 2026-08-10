/**
 * Finance v3 canonical — the ONE `content_semantic_hash` primitive.
 *
 * W10-D01 fix (`docs/validation/finance-v3/generated/gate-d/W10_COLD_REOPEN_report.md`
 * section 7): before this file existed, `autosaveService.ts`'s
 * `canonicalPayloadHash()` and `financeImportService.ts`'s `batchContentHash()`
 * independently re-implemented the identical `sha256(JSON.stringify(x))`
 * expression. Every other place in this codebase that produces a
 * `content_semantic_hash` (`baselineComputeService.ts`,
 * `predictionComputeService.ts`, `valuationComputeService.ts`,
 * `kpiComputeService.ts`, `statementReconciliationService.ts`,
 * `artifactVersionService.createArtifact()`) inlined the same expression a
 * SEVENTH time. Two divergent implementations of "the same hash" is strictly
 * worse than the NULL this fixes — a silent algorithm drift would be
 * undetectable by any equality check. This module is the single canonical
 * definition; every call site above imports it instead of inlining its own
 * `createHash('sha256')...` line.
 *
 * Deliberately NOT the "domain-value hash derived from `finance_stmt_lines`
 * rows" that `autosaveService.ts`'s original doc comment describes as
 * out-of-scope (AP-00 ADR section 6.2) — this hashes whatever canonical
 * payload the caller already computed (an operation stack, an applied
 * operations batch, an engine's own output rows). That is a deliberately
 * narrower contract: "did the working revision's content change" and "which
 * exact answer does this row correspond to", not "prove per-cell provenance".
 */

import { createHash } from 'node:crypto';

/** Deterministic sha256 hex digest of `JSON.stringify(payload)`. The one and only `content_semantic_hash` algorithm in this codebase. */
export function canonicalPayloadHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * W2-PINSEMANTICS fix (`docs/validation/finance-v3/generated/gate-d/W2_PIN_SEMANTICS_report.md`).
 *
 * The canonical hash of a working revision that has never had a single real
 * edit applied — the exact payload `artifactVersionService.createArtifact()`
 * stamps onto `revision_seq=1` (D01's fix for the "NULL hash on approved
 * artifacts" defect: without this, the real production transition chain
 * submit -> review -> approve can reach APPROVED with `content_semantic_hash`
 * still NULL, since it never requires a `checkpointOperationStack()` call in
 * between — see `canonicalServices.pg.test.ts`'s "the full T2->T4 transition
 * chain..." test).
 *
 * Exported ONLY for tests/documentation purposes — do NOT use this constant
 * for an identity comparison to detect "no real content yet" anywhere
 * (`computePinning.ts` tried exactly that and it was wrong: this same value
 * is also what a genuine, intentional `EXPLICIT_SAVE` checkpoint produces
 * when its `unsavedOperationStack` happens to be empty — e.g. the user saves
 * after undoing every change back to a no-op — which IS real, pinnable
 * content per `concurrencyMatrix.pg.test.ts`'s A4 test. The hash function
 * only ever sees the operation-stack payload, never WHO wrote the row or
 * WHY, so content-hash equality cannot carry that distinction.
 * `computePinning.ts` instead checks the structural fact "is this the
 * `createArtifact()` birth row" — see that file's own comment.
 */
export const EMPTY_WORKING_REVISION_CONTENT_HASH: string = canonicalPayloadHash({ unsavedOperationStack: [] });
