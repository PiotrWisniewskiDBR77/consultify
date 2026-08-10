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
