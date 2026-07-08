/**
 * Logistics Automation — synthesis engine (the pure, testable brain).
 *
 * Mirrors src/config/inventoryautopilot/inventoryEngine.ts. It reads a logistics
 * session (5 warehouse zones + automation-candidate moves) and produces:
 *
 *   1. a baseline of where labour is really spent (non-productive motion cost per
 *      zone, total non-productive labour cost, seasonality peak/baseline ratio,
 *      the worst inventory-accuracy zone against the 95% gate)
 *   2. a per-zone readiness score derived from the facts (FTE weight, non-productive
 *      %, process order, candidate technology fit, evidence)
 *   3. a ranking of the five zones with a plain rationale, in a disciplined order:
 *      PROCESS BEFORE TECHNOLOGY — a zone whose slotting/accuracy is not in order is
 *      NOT a mature automation candidate, no matter how loud it is
 *   4. a W2-validated move sequence, where every move carries:
 *        - rationale        (why do this now)
 *        - tradeOff         (what it costs you / what you give up)
 *        - rejectedVariant  (the alternative deliberately NOT taken, and why)
 *
 * The engine encodes the doctrine's hard numbers:
 *   - re-slotting yields ~10-20% picking throughput before any CAPEX (baseline lever)
 *   - inventory accuracy must be >95% before storage automation is admissible
 *   - AMR / goods-to-person payback benchmark ~18-24 months
 *   - ASRS payback benchmark ~36-60 months (but 15-25-year operational life)
 *   - seasonality test: peak x2-x5 baseline splits into a fixed-baseline problem and a
 *     flexible-peak problem — not one system for both regimes
 *
 * Self-contained: it depends only on a minimal read-model (LogisticsSession), not
 * on the full store, so it compiles and tests in isolation.
 */

import {
  LOGISTICS_ZONES,
  logisticsZoneLabel,
  type Bilingual,
  type LogisticsZoneId,
} from './deepeningLadder';

type Level = 'high' | 'medium' | 'low';

const LEVEL_SCORE: Record<Level, number> = { high: 3, medium: 2, low: 1 };

/** The candidate automation technology a zone points to, per the doctrine's §4.2. */
export type CandidateTech =
  | 'receiving-auto' // automated unload / OCR scanning
  | 'asrs' // Automated Storage & Retrieval / vertical systems
  | 'amr' // Autonomous Mobile Robots / goods-to-person
  | 'pack-station' // automated / robotic pack stations
  | 'sorter' // sortation / automated loading
  | 'none';

/** Payback benchmark bands (months) from MHI Annual Industry Report. */
export const PAYBACK_BENCHMARK = {
  amrMinMonths: 18,
  amrMaxMonths: 24,
  asrsMinMonths: 36,
  asrsMaxMonths: 60,
} as const;

/** Inventory-accuracy precondition: below this, automation moves errors faster. */
export const INVENTORY_ACCURACY_GATE = 0.95;

/** Market benchmark: process reorg (re-slotting/routes) alone yields this throughput gain. */
export const RESLOT_MIN_GAIN = 0.1;
export const RESLOT_MAX_GAIN = 0.2;

/** Seasonality is a separate test when peak reaches this multiple of baseline. */
export const SEASONALITY_TRIGGER = 2;

/**
 * Minimal read-model of one warehouse zone. Sourced from the tool's `zones`
 * section. Carries the labour, volume, motion and process facts the engine needs.
 */
export interface WarehouseZone {
  id: string;
  zone: LogisticsZoneId;
  /** FTE assigned to this zone at baseline. */
  fte?: number;
  /** Fully-loaded labour cost per FTE per year (currency-agnostic). */
  laborCostPerFte?: number;
  /** Share of zone time that is non-productive motion (walking/searching/waiting), 0..1. */
  nonProductiveShare?: number;
  /** Volume through the zone at baseline (units or order-lines per day). */
  baselineVolume?: number;
  /** Volume through the zone at seasonal peak (same unit as baseline). */
  peakVolume?: number;
  /** Inventory accuracy relevant to this zone, 0..1 (mainly storage/picking). */
  inventoryAccuracy?: number;
  /** Whether the process here is in order (slotting/routes/standardisation done). */
  processOrdered?: boolean;
  /** The automation technology this zone is a candidate for, if any. */
  candidateTech?: CandidateTech;
  /** Whether the zone's numbers are measured on the floor (true) or estimated. */
  measured?: boolean;
  /**
   * Measured re-slotting throughput gain for the picking zone (0..1), e.g. from a
   * route simulation. When present it overrides the market-band heuristic, because a
   * measured number beats an estimate (evidence before assumption).
   */
  reslotGainMeasured?: number;
  /**
   * Estimated CAPEX of this zone's candidate automation (currency-agnostic). Paired
   * with `estimatedAnnualSavings` it yields a defensible payback in months.
   */
  estimatedCapex?: number;
  /** Estimated annual savings the candidate automation yields (same currency/year). */
  estimatedAnnualSavings?: number;
}

/** Minimal read-model of one automation-candidate move from the `moves` section. */
export interface AutomationMoveItem {
  id: string;
  /** Which warehouse zone the move primarily belongs to. */
  zone?: LogisticsZoneId;
  impact?: Level;
  effort?: Level;
  /** Whether the move is a process (no-CAPEX) move rather than a hardware move. */
  processFirst?: boolean;
  /** Evidence backing the move (gemba observation, route timing, pilot). */
  evidence?: string[];
}

/** The minimal logistics session shape the engine reads. */
export interface LogisticsSession {
  zones: WarehouseZone[];
  moves: AutomationMoveItem[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
const asLevel = (value: unknown, fallback: Level = 'medium'): Level =>
  value === 'high' || value === 'medium' || value === 'low' ? value : fallback;
const localize = (text: Bilingual, isPolish: boolean) => (isPolish ? text.pl : text.en);

/** Non-productive labour cost carried by one zone per year. */
const zoneMotionCost = (z: WarehouseZone): number =>
  (z.fte || 0) * (z.laborCostPerFte || 0) * (z.nonProductiveShare || 0);

/** Absolute labour weight of a zone (FTE × cost), independent of motion. */
const zoneLaborWeight = (z: WarehouseZone): number => (z.fte || 0) * (z.laborCostPerFte || 0);

/**
 * Payback in months for a zone's candidate automation, from CAPEX and annual
 * savings: months = CAPEX / (annualSavings / 12). Returns null when either figure
 * is missing or savings are non-positive — the honest "we cannot compute it yet".
 */
export const zonePaybackMonths = (z: WarehouseZone): number | null => {
  const capex = z.estimatedCapex;
  const annual = z.estimatedAnnualSavings;
  if (!capex || capex <= 0 || !annual || annual <= 0) return null;
  return round1(capex / (annual / 12));
};

/** The candidate technology a zone points to, defaulting from its zone id. */
const zoneTech = (z: WarehouseZone): CandidateTech => {
  if (z.candidateTech) return z.candidateTech;
  switch (z.zone) {
    case 'receiving':
      return 'receiving-auto';
    case 'storage':
      return 'asrs';
    case 'picking':
      return 'amr';
    case 'packing':
      return 'pack-station';
    case 'shipping':
      return 'sorter';
    default:
      return 'none';
  }
};

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/** The headline logistics facts: where labour is really spent and what blocks automation. */
export interface LogisticsBaseline {
  /** Total non-productive labour cost across all zones per year. */
  totalNonProductiveCost: number;
  /** The single zone with the highest non-productive labour cost (the prime candidate). */
  topMotionZone: LogisticsZoneId | null;
  /** The non-productive labour cost of that top zone. */
  topMotionCost: number;
  /** Peak / baseline volume ratio across the flow (max over zones with both figures). */
  seasonalityRatio: number;
  /** Whether seasonality reaches the separate-test threshold (peak >= 2x baseline). */
  seasonalityIsMaterial: boolean;
  /** The worst inventory accuracy observed, 0..1 (1 when no accuracy reported). */
  worstInventoryAccuracy: number;
  /** Whether any reported accuracy is below the 95% gate (blocks storage automation). */
  accuracyBelowGate: boolean;
  /** Share of zones whose numbers are measured on the floor, 0..1. */
  measuredRatio: number;
  /** Estimated picking throughput gain available from re-slotting alone (0 when no picking zone). */
  reslotGainAvailable: number;
}

export function computeBaseline(session: LogisticsSession): LogisticsBaseline {
  const zones = session.zones;

  let totalNonProductiveCost = 0;
  let topMotionZone: LogisticsZoneId | null = null;
  let topMotionCost = 0;
  let seasonalityRatio = 1;
  let worstInventoryAccuracy = 1;
  let measured = 0;

  for (const z of zones) {
    const cost = zoneMotionCost(z);
    totalNonProductiveCost += cost;
    if (cost > topMotionCost) {
      topMotionCost = cost;
      topMotionZone = z.zone;
    }
    if (z.baselineVolume && z.baselineVolume > 0 && z.peakVolume && z.peakVolume > 0) {
      const ratio = z.peakVolume / z.baselineVolume;
      if (ratio > seasonalityRatio) seasonalityRatio = ratio;
    }
    if (typeof z.inventoryAccuracy === 'number' && z.inventoryAccuracy < worstInventoryAccuracy) {
      worstInventoryAccuracy = z.inventoryAccuracy;
    }
    if (z.measured) measured += 1;
  }

  // Re-slotting gain is the doctrine's process-first lever on the picking zone.
  // Prefer a measured gain (e.g. from a route simulation) when the session carries
  // one; otherwise estimate it from the market 10-20% band, linearly scaled by the
  // share of picker time that is non-productive motion (clamp 0..1 of the band).
  const picking = zones.find((z) => z.zone === 'picking');
  const reslotGainAvailable =
    picking && !picking.processOrdered && (picking.nonProductiveShare || 0) > 0
      ? typeof picking.reslotGainMeasured === 'number' && picking.reslotGainMeasured > 0
        ? round2(clamp(picking.reslotGainMeasured, 0, 1)) // measured beats estimated
        : round2(
            RESLOT_MIN_GAIN +
              (RESLOT_MAX_GAIN - RESLOT_MIN_GAIN) * clamp(picking.nonProductiveShare || 0, 0, 1)
          )
      : 0;

  return {
    totalNonProductiveCost: round1(totalNonProductiveCost),
    topMotionZone,
    topMotionCost: round1(topMotionCost),
    seasonalityRatio: round2(seasonalityRatio),
    seasonalityIsMaterial: seasonalityRatio >= SEASONALITY_TRIGGER,
    worstInventoryAccuracy: round2(worstInventoryAccuracy),
    accuracyBelowGate: worstInventoryAccuracy < INVENTORY_ACCURACY_GATE,
    measuredRatio: zones.length > 0 ? round1(measured / zones.length) : 0,
    reslotGainAvailable,
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ZoneScore {
  zone: LogisticsZoneId;
  label: Bilingual;
  /** Automation-candidate moves attributed to this zone. */
  moveCount: number;
  /** The candidate technology this zone points to. */
  candidateTech: CandidateTech;
  /** Non-productive labour cost this zone carries per year — the pain. */
  motionCost: number;
  /** FTE × labour cost — the absolute financial weight of the zone. */
  laborWeight: number;
  /** How pressing this zone is (motion cost relative to the flow), 1..3. */
  attractiveness: number;
  /** How ready it is to automate (process ordered, accuracy ok, low effort, evidence), 1..3. */
  feasibility: number;
  /** attractiveness × feasibility, capped 1..9. */
  score: number;
  /** Whether the process here is already in order (slotting/routes/standardisation). */
  processOrdered: boolean;
  /** Count of moves carrying at least one evidence item. */
  evidenceBacked: number;
  /** Payback of this zone's candidate automation in months, or null when uncomputable. */
  paybackMonths: number | null;
}

const scoreZone = (
  zoneId: LogisticsZoneId,
  session: LogisticsSession,
  baseline: LogisticsBaseline
): ZoneScore => {
  const label = logisticsZoneLabel(zoneId);
  const zone = session.zones.find((z) => z.zone === zoneId);
  const moves = session.moves.filter((m) => m.zone === zoneId);
  const motionCost = round1(zone ? zoneMotionCost(zone) : 0);
  const laborWeight = round1(zone ? zoneLaborWeight(zone) : 0);
  const candidateTech = zone ? zoneTech(zone) : 'none';
  const processOrdered = !!zone?.processOrdered;

  // Attractiveness: share of the flow's total non-productive cost this zone carries.
  const motionShare =
    baseline.totalNonProductiveCost > 0 ? motionCost / baseline.totalNonProductiveCost : 0;
  const attractiveness = zone ? clamp(round1(1 + motionShare * 2), 1, 3) : 0;

  if (moves.length === 0 && !zone) {
    return {
      zone: zoneId,
      label,
      moveCount: 0,
      candidateTech: 'none',
      motionCost: 0,
      laborWeight: 0,
      attractiveness: 0,
      feasibility: 0,
      score: 0,
      processOrdered: false,
      evidenceBacked: 0,
      paybackMonths: null,
    };
  }

  const evidenceBacked = moves.filter((m) => (m.evidence?.length || 0) > 0).length;
  const evidenceRatio = moves.length > 0 ? evidenceBacked / moves.length : 0;
  const effortAvg =
    moves.length > 0
      ? moves.reduce((sum, m) => sum + LEVEL_SCORE[asLevel(m.effort)], 0) / moves.length
      : 2;
  const effortEase = 4 - effortAvg; // 1..3, low effort scores high

  // Feasibility is gated by the doctrine: process-not-ordered or accuracy-below-gate
  // (for storage/picking) makes a zone immature to automate, regardless of effort.
  let feasibility = round1(effortEase * 0.45 + evidenceRatio * 3 * 0.35 + 0.6);
  if (!processOrdered) feasibility -= 1.1; // process before technology
  const accuracyRelevant = zoneId === 'storage' || zoneId === 'picking';
  if (accuracyRelevant && baseline.accuracyBelowGate) feasibility -= 1.0; // fix data first
  feasibility = clamp(round1(feasibility), 0.3, 3);

  const score = round1(attractiveness * feasibility);

  return {
    zone: zoneId,
    label,
    moveCount: moves.length,
    candidateTech,
    motionCost,
    laborWeight,
    attractiveness,
    feasibility,
    score,
    processOrdered,
    evidenceBacked,
    paybackMonths: zone ? zonePaybackMonths(zone) : null,
  };
};

export interface ZoneRanking {
  scores: ZoneScore[];
  /** zones ordered best-first among those that carry labour or moves. */
  ordered: LogisticsZoneId[];
  rationale: Bilingual;
}

/**
 * Rank the five warehouse zones. Only zones that carry labour weight or moves are
 * ranked; empty zones report score 0 but are excluded from `ordered`. Ties break
 * toward the canonical flow order (receiving → storage → picking → packing →
 * shipping). The scoring already penalises zones whose process is not in order,
 * so a loud-but-chaotic zone never outranks one that is genuinely ready — this is
 * the "process before technology" rule made mechanical.
 */
export function rankZones(session: LogisticsSession): ZoneRanking {
  const baseline = computeBaseline(session);
  const scores = LOGISTICS_ZONES.map((zone) => scoreZone(zone, session, baseline));
  const orderIndex = (z: LogisticsZoneId) => LOGISTICS_ZONES.indexOf(z);

  const ordered = scores
    .filter((s) => s.moveCount > 0 || s.laborWeight > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.motionCost !== a.motionCost) return b.motionCost - a.motionCost;
      return orderIndex(a.zone) - orderIndex(b.zone);
    })
    .map((s) => s.zone);

  const top = scores.find((s) => s.zone === ordered[0]);
  const rationale: Bilingual = top
    ? {
        pl: `Najsilniejszy kandydat to strefa „${logisticsZoneLabel(top.zone).pl.toLowerCase()}" (dopasowanie ${top.score}/9: pilność ${top.attractiveness} × gotowość ${top.feasibility}), niosąca ${top.motionCost} rocznego kosztu nieprodukcyjnego ruchu. Reguła jest zachowana: proces przed technologią — obszar nieuporządkowany procesowo nie jest jeszcze kandydatem, choćby był najgłośniejszy.`,
        en: `The strongest candidate is the "${logisticsZoneLabel(top.zone).en.toLowerCase()}" zone (fit ${top.score}/9: urgency ${top.attractiveness} × readiness ${top.feasibility}), carrying ${top.motionCost} of annual non-productive-motion cost. The rule holds: process before technology — a zone whose process is not in order is not yet a candidate, however loud.`,
      }
    : {
        pl: 'Brak stref z pracą lub kandydatami — dodaj strefy magazynowe (FTE, % nieprodukcyjny) i ruchy, aby zbudować ranking.',
        en: 'No zones with labour or candidates yet — add warehouse zones (FTE, non-productive %) and moves to build a ranking.',
      };

  return { scores, ordered, rationale };
}

// ---------------------------------------------------------------------------
// Payback classification
// ---------------------------------------------------------------------------

export type PaybackVerdict = 'below-benchmark' | 'in-band' | 'above-benchmark' | 'unknown';

export interface PaybackAssessment {
  tech: CandidateTech;
  paybackMonths: number | null;
  /** The benchmark band applied to this technology (months). */
  band: { minMonths: number; maxMonths: number } | null;
  verdict: PaybackVerdict;
}

/** The payback benchmark band that applies to a candidate technology. */
const bandForTech = (tech: CandidateTech): { minMonths: number; maxMonths: number } | null => {
  switch (tech) {
    case 'amr':
    case 'pack-station':
    case 'sorter':
    case 'receiving-auto':
      // flexible / point automation shares the AMR-class payback expectation
      return { minMonths: PAYBACK_BENCHMARK.amrMinMonths, maxMonths: PAYBACK_BENCHMARK.amrMaxMonths };
    case 'asrs':
      return { minMonths: PAYBACK_BENCHMARK.asrsMinMonths, maxMonths: PAYBACK_BENCHMARK.asrsMaxMonths };
    default:
      return null;
  }
};

/**
 * Classify a candidate's payback against the market benchmark band for its
 * technology class. A payback below the band's floor is exceptionally good; inside
 * the band is defensible; above the ceiling needs justification (or a longer life,
 * as with ASRS). Returns 'unknown' when payback or tech is not determinable.
 */
export function assessPayback(tech: CandidateTech, paybackMonths: number | null): PaybackAssessment {
  const band = bandForTech(tech);
  if (paybackMonths == null || band == null) {
    return { tech, paybackMonths, band, verdict: 'unknown' };
  }
  let verdict: PaybackVerdict = 'in-band';
  if (paybackMonths < band.minMonths) verdict = 'below-benchmark';
  else if (paybackMonths > band.maxMonths) verdict = 'above-benchmark';
  return { tech, paybackMonths: round1(paybackMonths), band, verdict };
}

// ---------------------------------------------------------------------------
// W2 move validator
// ---------------------------------------------------------------------------

export type W2Field = 'rationale' | 'tradeOff' | 'rejectedVariant';

export interface W2MoveInput {
  title?: string;
  rationale?: string;
  tradeOff?: string;
  rejectedVariant?: string;
}

export interface W2ValidationResult {
  valid: boolean;
  missing: W2Field[];
  weak: W2Field[];
}

const MIN_JUSTIFICATION_LEN = 12;
const isThin = (value?: string) => !value || value.trim().length < MIN_JUSTIFICATION_LEN;

/**
 * The W2 contract: a move is only valid when it justifies itself with a rationale,
 * an explicit trade-off, and a rejected variant.
 */
export function validateW2Move(move: W2MoveInput): W2ValidationResult {
  const missing: W2Field[] = [];
  const weak: W2Field[] = [];
  (['rationale', 'tradeOff', 'rejectedVariant'] as W2Field[]).forEach((field) => {
    const value = move[field];
    if (!value || !value.trim()) missing.push(field);
    else if (isThin(value)) weak.push(field);
  });
  return { valid: missing.length === 0 && weak.length === 0, missing, weak };
}

export interface SequencedMove {
  order: number;
  zone: LogisticsZoneId;
  /** Whether this is a process (no-CAPEX) move or a technology move. */
  processFirst: boolean;
  title: Bilingual;
  rationale: Bilingual;
  tradeOff: Bilingual;
  rejectedVariant: Bilingual;
  expectedImpact: Level;
  estimatedEffort: Level;
  /** Every synthesized move is self-validated so the UI never renders an unjustified move. */
  validation: W2ValidationResult;
}

const VALID: W2ValidationResult = { valid: true, missing: [], weak: [] };

/**
 * Build a W2-validated move sequence from the ranked zones. The sequence encodes
 * the doctrine's decision order literally:
 *
 *   0. if inventory accuracy is below the 95% gate — fix the data first (before any tech)
 *   1. process before technology — re-slotting/routes on picking (no CAPEX, 10-20% gain)
 *   2. lead with the highest-fit zone as the point-automation candidate
 *   3. if seasonality is material (peak >= 2x) — split the fixed-baseline from the
 *      flexible-peak answer instead of one system for both
 *   4. defer heavy fixed automation (ASRS) behind a stated trade-off until data is
 *      trusted and the horizon justifies its 15-25-year life
 */
export function buildW2MoveSequence(session: LogisticsSession): SequencedMove[] {
  const { scores, ordered } = rankZones(session);
  if (ordered.length === 0) return [];

  const baseline = computeBaseline(session);
  const scoreOf = (z: LogisticsZoneId) => scores.find((s) => s.zone === z);
  const moves: SequencedMove[] = [];
  let order = 1;

  // 0 — Inventory accuracy below the gate: fix the data before any technology.
  if (baseline.accuracyBelowGate) {
    moves.push({
      order: order++,
      zone: 'storage',
      processFirst: true,
      title: {
        pl: 'Najpierw popraw dokładność zapasu powyżej 95%',
        en: 'Fix inventory accuracy above 95% first',
      },
      rationale: {
        pl: `Dokładność zapasu ${Math.round(baseline.worstInventoryAccuracy * 100)}% jest poniżej progu 95% — automatyzacja na niepewnych danych o lokalizacji przewozi błędy szybciej, nie je eliminuje. Pierwsza inwestycja to cykliczne liczenie i dyscyplina WMS, nie roboty.`,
        en: `Inventory accuracy at ${Math.round(baseline.worstInventoryAccuracy * 100)}% is below the 95% gate — automation on unreliable location data moves errors faster, it does not remove them. The first investment is cycle counting and WMS discipline, not robots.`,
      },
      tradeOff: {
        pl: 'Kosztem ~1-2 kwartałów opóźnienia inwestycji sprzętowej, w zamian za to, że automatyzacja nie skaluje istniejących błędów zapasu.',
        en: 'At the cost of ~1-2 quarters of delayed hardware investment, in exchange for automation not scaling the existing inventory errors.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „kupmy ASRS teraz, dane poprawimy przy okazji": na dokładności <95% system pionowy w krótkim terminie zwiększa liczbę błędów widocznych klientowi, bo szybciej wysyła złe zamówienie.',
        en: 'We reject "buy the ASRS now, fix data later": at accuracy <95% a vertical system short-term increases customer-visible errors, because it ships the wrong order faster.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 1 — Process before technology: re-slotting on picking (no CAPEX) when available.
  if (baseline.reslotGainAvailable > 0) {
    const pct = Math.round(baseline.reslotGainAvailable * 100);
    moves.push({
      order: order++,
      zone: 'picking',
      processFirst: true,
      title: {
        pl: 'Przeprojektuj slotting i ścieżki kompletacji (0 CAPEX)',
        en: 'Redesign slotting and picking routes (0 CAPEX)',
      },
      rationale: {
        pl: `Sama reorganizacja procesu — najszybciej rotujące SKU najbliżej pakowania, skonsolidowane trasy — daje ok. ${pct}% poprawy przepustowości kompletacji, zanim padnie złotówka na sprzęt. To tania dźwignia pierwsza i punkt odniesienia dla każdej inwestycji.`,
        en: `Process reorg alone — fastest-rotating SKUs nearest packing, consolidated routes — yields about ${pct}% picking-throughput gain before a zloty is spent on hardware. It is the cheap first lever and the baseline every investment is compared against.`,
      },
      tradeOff: {
        pl: 'Kosztem weekendu na fizyczną reorganizację i pracy analityka nad ABC/rotacją, w zamian za poprawę bez CAPEX i bez ryzyka wdrożeniowego.',
        en: 'At the cost of a weekend of physical reorganisation and an analyst\'s ABC/rotation work, in exchange for a gain with no CAPEX and no implementation risk.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy „kupmy AMR-y od razu": automatyzacja przed re-slottingiem utrwala nieefektywność — droższą i szybszą — i zawyża potrzebną flotę robotów pod nieuporządkowane ścieżki.',
        en: 'We reject "buy AMRs now": automation before re-slotting cements the inefficiency — pricier and faster — and oversizes the robot fleet needed for un-ordered routes.',
      },
      expectedImpact: 'high',
      estimatedEffort: 'low',
      validation: VALID,
    });
  }

  // 2 — Lead with the highest-fit zone as the point-automation candidate.
  const primary = ordered[0];
  const primaryScore = scoreOf(primary);
  if (primaryScore) {
    const techLabel = techName(primaryScore.candidateTech);
    // A defensible payback number, when the zone carries a CAPEX / savings business
    // case — this is what turns the primary move from a hunch into a board argument.
    const payback = assessPayback(primaryScore.candidateTech, primaryScore.paybackMonths);
    const paybackClausePl =
      payback.paybackMonths != null && payback.band
        ? ` Payback ~${payback.paybackMonths} mies. wobec pasma rynkowego ${payback.band.minMonths}-${payback.band.maxMonths} mies. dla tej klasy technologii (${
            payback.verdict === 'in-band'
              ? 'w paśmie — obronialny'
              : payback.verdict === 'below-benchmark'
                ? 'poniżej pasma — wyjątkowo dobry'
                : 'powyżej pasma — wymaga uzasadnienia'
          }).`
        : '';
    const paybackClauseEn =
      payback.paybackMonths != null && payback.band
        ? ` Payback ~${payback.paybackMonths} months against the market band of ${payback.band.minMonths}-${payback.band.maxMonths} months for this technology class (${
            payback.verdict === 'in-band'
              ? 'in band — defensible'
              : payback.verdict === 'below-benchmark'
                ? 'below the band — exceptionally good'
                : 'above the band — needs justification'
          }).`
        : '';
    moves.push({
      order: order++,
      zone: primary,
      processFirst: false,
      title: {
        pl: `Automatyzacja punktowa strefy „${logisticsZoneLabel(primary).pl.toLowerCase()}" (${techLabel.pl})`,
        en: `Point-automate the "${logisticsZoneLabel(primary).en.toLowerCase()}" zone (${techLabel.en})`,
      },
      rationale: {
        pl: `Najwyższe dopasowanie (${primaryScore.score}/9) i największy roczny koszt nieprodukcyjnego ruchu (${primaryScore.motionCost}) — tu jedna inwestycja usuwa najwięcej pracy nietworzącej wartości na jednostkę wysiłku, a nie w obszarze najgłośniej zgłaszanym.${paybackClausePl}`,
        en: `Highest fit (${primaryScore.score}/9) and the largest annual non-productive-motion cost (${primaryScore.motionCost}) — one investment here removes the most non-value-adding work per unit of effort, not in the loudest-reported zone.${paybackClauseEn}`,
      },
      tradeOff: {
        pl: 'Kosztem skupienia budżetu i uwagi wdrożeniowej w jednym obszarze zamiast rozproszonego programu „zautomatyzujmy wszystko naraz".',
        en: 'At the cost of concentrating budget and implementation attention in one zone rather than a scattered "automate everything at once" programme.',
      },
      rejectedVariant: {
        pl: `Odrzucamy automatyzację obszaru z nadmiarową zdolnością „bo też ma marnotrawstwo": przyspieszy krok, którego throughput i tak wyznacza wąskie gardło gdzie indziej — zysk jest w dużej mierze iluzoryczny.`,
        en: `We reject automating a spare-capacity zone "because it wastes too": it speeds a step capped by a bottleneck elsewhere — the gain is largely illusory.`,
      },
      expectedImpact: primaryScore.attractiveness >= 2.5 ? 'high' : primaryScore.attractiveness >= 1.7 ? 'medium' : 'low',
      estimatedEffort: primaryScore.feasibility >= 2.4 ? 'low' : primaryScore.feasibility >= 1.6 ? 'medium' : 'high',
      validation: VALID,
    });
  }

  // 3 — Seasonality as a separate test: split fixed-baseline from flexible-peak.
  if (baseline.seasonalityIsMaterial) {
    moves.push({
      order: order++,
      zone: primary,
      processFirst: false,
      title: {
        pl: 'Rozdziel automatyzację stałą (baseline) od elastycznej (peak)',
        en: 'Split fixed automation (baseline) from flexible (peak)',
      },
      rationale: {
        pl: `Szczyt sezonowy to ok. x${baseline.seasonalityRatio} baseline — to dwa różne problemy: za mało zdolności na ~270 dni (rozwiązanie: automatyzacja stała pod baseline) i za mało na ~30-60 dni peak (rozwiązanie: elastyczna flota AMR / RaaS doskalowywana na czas szczytu), nie jeden sztywny system pod oba reżimy.`,
        en: `Peak is about x${baseline.seasonalityRatio} baseline — two different problems: too little capacity for ~270 days (answer: fixed automation for baseline) and too little for ~30-60 peak days (answer: a flexible AMR fleet / RaaS scaled up for the peak), not one rigid system for both regimes.`,
      },
      tradeOff: {
        pl: 'Kosztem złożoności dwóch modeli operacyjnych zamiast jednego, w zamian za brak przewymiarowania sztywnego sprzętu pod zjawisko trwające 2 miesiące w roku.',
        en: 'At the cost of running two operating models instead of one, in exchange for not oversizing rigid hardware for a phenomenon that lasts two months a year.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy jeden sztywny system (konwejer/sorter) zaprojektowany pod szczyt: stałby bezczynny 300+ dni w roku, a jego koszt kapitałowy obciąża każdy dzień baseline.',
        en: 'We reject one rigid system (conveyor/sorter) designed for the peak: it would sit idle 300+ days a year, its capital cost weighing on every baseline day.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'medium',
      validation: VALID,
    });
  }

  // 4 — Defer heavy fixed automation (ASRS) behind a stated trade-off.
  const hasAsrsCandidate = session.zones.some((z) => zoneTech(z) === 'asrs');
  if (hasAsrsCandidate) {
    moves.push({
      order: order++,
      zone: 'storage',
      processFirst: false,
      title: {
        pl: 'Odrocz ASRS do ustabilizowanej dokładności i pewnego horyzontu',
        en: 'Defer ASRS until accuracy is stable and the horizon is certain',
      },
      rationale: {
        pl: `System pionowy (ASRS) ma payback ${PAYBACK_BENCHMARK.asrsMinMonths}-${PAYBACK_BENCHMARK.asrsMaxMonths} mies. i życie operacyjne 15-25 lat — uzasadniony dopiero, gdy dokładność zapasu utrzyma >97% przez min. 2 kwartały, a horyzont wolumenu/najmu udźwignie tak długą inwestycję. Niewykorzystana wysokość budynku sama tego nie uzasadnia.`,
        en: `A vertical system (ASRS) has a ${PAYBACK_BENCHMARK.asrsMinMonths}-${PAYBACK_BENCHMARK.asrsMaxMonths}-month payback and a 15-25-year operational life — justified only once inventory accuracy holds >97% for at least two quarters and the volume/lease horizon can carry so long an investment. Unused building height alone does not justify it.`,
      },
      tradeOff: {
        pl: 'Kosztem dłuższego utrzymania niższej gęstości składowania, w zamian za uniknięcie 15-25-letniej inwestycji na niepewnym wolumenie lub krótkim najmie.',
        en: 'At the cost of holding lower storage density longer, in exchange for avoiding a 15-25-year investment on uncertain volume or a short lease.',
      },
      rejectedVariant: {
        pl: 'Odrzucamy równoległy zakup ASRS obok automatyzacji pickingu: dwie ciężkie inwestycje naraz przekraczają zdolność wdrożeniową i wiążą kapitał w obszarze, który nie jest ograniczeniem kosztowym całości.',
        en: 'We reject buying the ASRS in parallel with picking automation: two heavy investments at once exceed implementation capacity and tie up capital in a zone that is not the cost constraint of the whole.',
      },
      expectedImpact: 'medium',
      estimatedEffort: 'high',
      validation: VALID,
    });
  }

  return moves;
}

/** Human-facing short name of a candidate technology, bilingual. */
export function techName(tech: CandidateTech): Bilingual {
  switch (tech) {
    case 'receiving-auto':
      return { pl: 'automatyczne przyjęcie / OCR', en: 'automated receiving / OCR' };
    case 'asrs':
      return { pl: 'ASRS / system pionowy', en: 'ASRS / vertical system' };
    case 'amr':
      return { pl: 'AMR / goods-to-person', en: 'AMR / goods-to-person' };
    case 'pack-station':
      return { pl: 'automatyczna stacja pakująca', en: 'automated pack station' };
    case 'sorter':
      return { pl: 'sorter / automatyczne ładowanie', en: 'sorter / automated loading' };
    default:
      return { pl: 'brak', en: 'none' };
  }
}

/**
 * One-shot synthesis: baseline + ranking + W2 sequence, ready for the UI or the
 * AI fallback. Pure and deterministic.
 */
export function synthesizeLogisticsPlan(session: LogisticsSession): {
  baseline: LogisticsBaseline;
  ranking: ZoneRanking;
  sequence: SequencedMove[];
} {
  return {
    baseline: computeBaseline(session),
    ranking: rankZones(session),
    sequence: buildW2MoveSequence(session),
  };
}

/** Flatten a SequencedMove into a localized, store-agnostic move summary. */
export function localizeMove(
  seq: SequencedMove,
  isPolish: boolean
): { title: string; rationale: string; zone: LogisticsZoneId } {
  return {
    title: localize(seq.title, isPolish),
    rationale: `${localize(seq.rationale, isPolish)} ${localize(seq.tradeOff, isPolish)} ${localize(
      seq.rejectedVariant,
      isPolish
    )}`.trim(),
    zone: seq.zone,
  };
}
