/**
 * TLS-CATALOG-001 — governed MVP-runtime truth (owner decision, frozen).
 *
 * Source of the decision: `CLAUDE.md` (repo root) §"FINISZ 8 NARZĘDZI" /
 * the closure task brief for TLS-CATALOG-001, restating the owner's frozen
 * MVP scope decision:
 *
 *   "Tools MVP is Dynamic SWOT. Every other tool requires a separate
 *    packet, provenance and rights, and must be hidden or explicitly
 *    marked UNAVAILABLE."
 *
 * This module is the SINGLE machine-readable statement of that decision.
 * It intentionally has NO production callers — it does not gate anything
 * by itself. It exists so a test can compare it against the REAL runtime
 * gate (`ACTIVE_KNOWN_TOOL_TYPES` in
 * `server/src/services/KnownToolsService.ts`, out of this lane's edit
 * scope — see `mvpGateGovernance.redByDesign.test.ts`) and FAIL LOUDLY when
 * they diverge, instead of leaving a silent policy violation undetectable.
 *
 * Do NOT add tool types here without a corresponding owner-approved packet
 * + provenance + rights record (see `docs/program/evidence/closure/a/
 * TLS-CATALOG-001/CATALOG_INVENTORY.md`). Adding an entry here without one
 * would just move the lie from KnownToolsService.ts into this file.
 */
export const APPROVED_MVP_TOOL_TYPES: ReadonlySet<string> = new Set<string>(['dynamic-swot']);

/** Convenience predicate — avoids call sites re-deriving Set membership. */
export function isApprovedMvpToolType(toolType: string): boolean {
  return APPROVED_MVP_TOOL_TYPES.has(String(toolType || '').trim().toLowerCase());
}
