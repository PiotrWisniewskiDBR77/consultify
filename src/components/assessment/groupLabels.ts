/**
 * Group (dimension/axis) LABEL resolution for every Output-derived assessment
 * surface — report document, presentation deck, and anything else that has to
 * print WHICH dimension a frozen number belongs to.
 *
 * ★ WHY THIS LIVES HERE AND NOT IN THE KERNEL (read before "simplifying"):
 * `ReportGroupResult.groupName` is produced by `groupResultsFrom()` in
 * `src/method-core/outputs/reportSnapshot.ts`, which sets `groupName: groupId`
 * — it echoes the RAW aggregation key (`axis-1`, a SIRI pillar id, an audit
 * clause prefix). That is not a bug in the kernel: `src/method-core/outputs/`
 * is deliberately methodology-agnostic and must not import a specific
 * methodology's dictionary. `resolveDrdAxisName` reads `@/services/drdStructure`
 * (a UI-layer service) through the licence-gated `drdLabels.ts` boundary;
 * pulling that into the kernel would invert the layering AND drag
 * licence-restricted DRD content into a module every method pack shares.
 * `reportSnapshot.test.ts` additionally pins `buildReportSnapshot.length === 2`
 * as a canon guard against extra parameters on that signature.
 *
 * So names are resolved ONE layer up — in the view-model builders that already
 * know the Output's own pinned `methodPackId`/`methodPackVersion`. This is not
 * a violation of buildPresentationDeck's "zero przeliczania w komponencie"
 * rule: that rule is about NUMBERS (no new average/ratio/score). A label is a
 * static dictionary lookup, and it happens in the BUILDER, never in the slide.
 *
 * ★ HONEST DEGRADE: unknown pack, version mismatch, or unknown group id all
 * return `null`, and every caller falls back to the raw id. A wrong name on a
 * board-facing deck is worse than a raw id.
 */
import { resolveDrdAxisName } from './report/drdLabels';

/**
 * Resolves one `aggregation.byGroup` key to a human-readable dimension name,
 * dispatching on the Output's OWN pinned method pack. Returns `null` when the
 * name cannot be established with certainty — never a guess.
 *
 * Method packs other than DRD (SIRI pillars, audit clause groups) have no
 * structural-label dictionary wired yet, so they resolve to `null` and render
 * their raw group id, exactly as they do today. Adding one is a new branch
 * here — no change to the kernel or to any consumer.
 */
export function resolveGroupName(
  methodPackId: string,
  methodPackVersion: string,
  groupId: string
): string | null {
  return resolveDrdAxisName(methodPackId, methodPackVersion, groupId);
}

/**
 * Convenience wrapper for the common "name or raw id" call, so consumers do
 * not each re-invent the fallback.
 */
export function groupNameOrId(
  methodPackId: string,
  methodPackVersion: string,
  groupId: string
): string {
  return resolveGroupName(methodPackId, methodPackVersion, groupId) ?? groupId;
}
