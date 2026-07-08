/**
 * Logistics Automation — config layer barrel.
 *
 * SSOT for the warehouse & logistics-automation methodology content and its
 * deterministic synthesis engine. Cloned from the Inventory Autopilot config
 * pattern (src/config/inventoryautopilot):
 *   - deepeningLadder.ts    : per-zone depth staircase + partner-grade proposal bank (PL/EN)
 *   - logisticsEngine.ts    : baseline + scoring + payback classification + W2 move sequencing
 *   - conclusionPrompts.ts  : AI prompt builders grounded in the engine output
 *
 * Self-contained: the engine reads a minimal LogisticsSession, and this barrel
 * offers a defensive adapter from the store's OperationalToolData sections so
 * callers never have to reach into section internals.
 */

import {
  LOGISTICS_DEEPENING_LADDER,
  LOGISTICS_LADDER_RUNG_ORDER,
  LOGISTICS_ZONES,
  type LadderRung,
  type LogisticsZoneId,
} from './deepeningLadder';
import type {
  AutomationMoveItem,
  CandidateTech,
  LogisticsSession,
  WarehouseZone,
} from './logisticsEngine';

export * from './deepeningLadder';
export * from './logisticsEngine';
export * from './conclusionPrompts';

/** A ladder rung with strings resolved to a single language. */
export interface LocalizedRung {
  id: LadderRung['id'];
  depth: LadderRung['depth'];
  label: string;
  question: string;
  rationale: string;
}

/** Resolve a zone's deepening ladder to one language, preserving rung order. */
export function localizeLadder(zone: LogisticsZoneId, isPolish: boolean): LocalizedRung[] {
  const rungs = LOGISTICS_DEEPENING_LADDER[zone];
  return LOGISTICS_LADDER_RUNG_ORDER.map((rungId) => {
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
// Adapter: OperationalToolData sections -> LogisticsSession (defensive, store-agnostic)
// ---------------------------------------------------------------------------

const asZoneId = (raw: unknown): LogisticsZoneId | undefined =>
  LOGISTICS_ZONES.includes(raw as LogisticsZoneId) ? (raw as LogisticsZoneId) : undefined;

const CANDIDATE_TECHS: CandidateTech[] = [
  'receiving-auto',
  'asrs',
  'amr',
  'pack-station',
  'sorter',
  'none',
];

const asCandidateTech = (raw: unknown): CandidateTech | undefined =>
  CANDIDATE_TECHS.includes(raw as CandidateTech) ? (raw as CandidateTech) : undefined;

const asNumber = (raw: unknown): number | undefined =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;

/** Read a 0..1 share, accepting either a fraction (0.58) or a percentage (58). */
const asShare = (raw: unknown): number | undefined => {
  const n = asNumber(raw);
  if (n === undefined) return undefined;
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, n);
};

const truthy = (raw: unknown): boolean =>
  raw === true || (typeof raw === 'string' && /true|yes|done|ordered|1/i.test(raw));

/**
 * Extract a LogisticsSession from the operational tool's `sections`. Reads
 * `zones` (or `areas`) and `moves` (or `candidates`) defensively; unknown zone
 * ids or techs fall back to undefined rather than throwing.
 *
 * Convention on OperationalItem for zones: `category` carries the zone id
 * (receiving/storage/picking/packing/shipping); numeric fields carry FTE, labour
 * cost, baseline/peak volume, inventory accuracy and the non-productive share;
 * `threshold` may carry the candidate technology; a `processOrdered` flag marks a
 * process already in order. For moves: `category` carries the zone; impact/effort/
 * evidence carry the scoring facts; `processFirst` marks a no-CAPEX move.
 */
export function toLogisticsSession(
  sections: Record<string, unknown[]> | undefined
): LogisticsSession {
  const rawZones = ((sections?.['zones'] || sections?.['areas'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;
  const rawMoves = ((sections?.['moves'] || sections?.['candidates'] || []) as unknown[]) as Array<
    Record<string, unknown>
  >;

  const zones: WarehouseZone[] = rawZones
    .map((item, idx) => {
      const zone = asZoneId(item.zone) ?? asZoneId(item.category);
      if (!zone) return null;
      const fte = asNumber(item.fte);
      const nonProductiveShare = asShare(item.nonProductiveShare);
      return {
        id: String(item.id ?? `zone-${idx}`),
        zone,
        fte,
        laborCostPerFte: asNumber(item.laborCostPerFte) ?? asNumber(item.laborCost),
        nonProductiveShare,
        baselineVolume: asNumber(item.baselineVolume),
        peakVolume: asNumber(item.peakVolume),
        inventoryAccuracy: asShare(item.inventoryAccuracy),
        processOrdered: truthy(item.processOrdered),
        candidateTech: asCandidateTech(item.candidateTech) ?? asCandidateTech(item.threshold),
        measured: fte !== undefined || nonProductiveShare !== undefined,
        reslotGainMeasured: asShare(item.reslotGainMeasured),
        estimatedCapex: asNumber(item.estimatedCapex),
        estimatedAnnualSavings: asNumber(item.estimatedAnnualSavings),
      } as WarehouseZone;
    })
    .filter((z): z is WarehouseZone => z !== null);

  const moves: AutomationMoveItem[] = rawMoves.map((item, idx) => ({
    id: String(item.id ?? `move-${idx}`),
    zone: asZoneId(item.zone) ?? asZoneId(item.category),
    impact: (item.impact as AutomationMoveItem['impact']) ?? undefined,
    effort: (item.effort as AutomationMoveItem['effort']) ?? undefined,
    processFirst: truthy(item.processFirst),
    evidence: Array.isArray(item.evidence) ? (item.evidence as string[]) : [],
  }));

  return { zones, moves };
}
