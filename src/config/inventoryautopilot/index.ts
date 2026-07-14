/**
 * Inventory Autopilot — config layer barrel.
 *
 * SSOT for the inventory-optimization methodology content and its deterministic
 * synthesis engine. Cloned from the SMED config pattern (src/config/smedplanner):
 *   - deepeningLadder.ts   : per-lever depth staircase + partner-grade proposal bank (PL/EN)
 *   - inventoryEngine.ts   : baseline + scoring + W2 move sequencing (rationale/trade-off/rejected variant)
 *   - conclusionPrompts.ts : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal InventorySession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  INVENTORY_DEEPENING_LADDER,
  INVENTORY_LADDER_RUNG_ORDER,
  type InventoryLeverId,
  type LadderRung,
} from './deepeningLadder';
import type {
  InventorySession,
  PolicyMoveItem,
  SkuSegment,
  ValueClass,
  VariabilityClass,
} from './inventoryEngine';

export * from './conclusionPrompts';
export * from './deepeningLadder';
export * from './inventoryEngine';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a lever's deepening ladder to one language, preserving rung order. */
export function localizeLadder(lever: InventoryLeverId, isPolish: boolean): LocalizedRung[] {
  const rungs = INVENTORY_DEEPENING_LADDER[lever];
  return INVENTORY_LADDER_RUNG_ORDER.map((rungId) => {
    const rung = rungs.find((r) => r.id === rungId)!;
    return {
      id: rung.id,
      depth: rung.depth,
      label: isPolish ? rung.label.pl : rung.label.en,
      question: isPolish ? rung.question.pl : rung.question.en,
      rationale: isPolish ? rung.rationale.pl : rung.rationale.en,
    };
  });
}

// ---------------------------------------------------------------------------
// Adapter: OperationalToolData sections -> InventorySession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asValueClass = (raw: unknown): ValueClass =>
  raw === 'A' || raw === 'B' || raw === 'C' ? raw : 'C';

const asVariabilityClass = (raw: unknown): VariabilityClass =>
  raw === 'X' || raw === 'Y' || raw === 'Z' ? raw : 'Z';

const asLever = (raw: unknown): InventoryLeverId | undefined =>
  raw === 'classify' || raw === 'service' || raw === 'replenish' || raw === 'deadstock'
    ? raw
    : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|dead|below|1/i.test(raw));

/**
 * Extract an InventorySession from the operational tool's `sections`. Reads
 * `skus` (or `segments`) and `moves` (or `policies`) defensively; unknown
 * categories fall back to sane defaults (class C, variability Z) rather than
 * throwing.
 *
 * Convention on OperationalItem for SKU segments: `category` carries the ABC
 * value class; `threshold` carries the XYZ variability class; `target` carries
 * stock value and `frequency`/numeric fields the annual turnover; a `dead` /
 * `belowService` flag (or `owner` text hint) marks exposure. For moves:
 * `category` carries the lever; impact/effort/evidence carry the scoring facts.
 */
export function toInventorySession(
  sections: Record<string, unknown[]> | undefined
): InventorySession {
  const rawSegments = (sections?.['skus'] || sections?.['segments'] || []) as unknown[] as Array<
    Record<string, unknown>
  >;
  const rawMoves = (sections?.['moves'] || sections?.['policies'] || []) as unknown[] as Array<
    Record<string, unknown>
  >;

  const segments: SkuSegment[] = rawSegments.map((item, idx) => ({
    id: String(item.id ?? `seg-${idx}`),
    valueClass: asValueClass(item.category),
    variabilityClass: asVariabilityClass(item.threshold),
    stockValue: asNumber(item.stockValue) ?? asNumber(item.target),
    annualTurnover: asNumber(item.annualTurnover),
    belowService: truthy(item.belowService),
    dead: truthy(item.dead),
    measured: asNumber(item.stockValue) !== undefined || asNumber(item.target) !== undefined,
  }));

  const moves: PolicyMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    lever: asLever(item.category),
    impact: (item.impact as PolicyMoveItem['impact']) ?? undefined,
    effort: (item.effort as PolicyMoveItem['effort']) ?? undefined,
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { segments, moves };
}
