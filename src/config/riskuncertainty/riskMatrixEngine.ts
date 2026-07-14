/**
 * Risk & Uncertainty — 2x2 probability x impact matrix + response map (OXFORD O3).
 *
 * Pattern mirror of src/config/portfolio/portfolioMatrixEngine.ts. Where Portfolio
 * classifies elements into a value x feasibility quadrant, Risk & Uncertainty
 * classifies each accepted risk into the canonical probability x impact 2x2 and
 * attaches the classic response strategy the grid implies:
 *
 *   HIGH prob x HIGH impact -> "act-now"     -> mitigate (avoid when extreme)
 *   LOW  prob x HIGH impact -> "contingency" -> transfer (insure / hedge / contract)
 *   HIGH prob x LOW  impact -> "manage"      -> mitigate (reduce likelihood, absorb)
 *   LOW  prob x LOW  impact -> "accept"      -> accept  (monitor lightly)
 *
 * The strategy the engine attaches is a DEFAULT the grid dictates, not a decree:
 * the consultant chooses, but a risk that lands in "act-now" and is left on
 * "accept" is a visible, defensible contradiction. The scoring is reused from the
 * synthesis engine (moveValidator.rankRisks) so there is ONE source of exposure
 * truth — the matrix never re-scores.
 *
 * Pure, deterministic, bilingual (PL/EN). No colors, no UI — data only.
 */

import type { RiskResponseStrategy } from '@/components/shared/NModeSections/RaidCanvas';
import type { RiskUncertaintyData } from '@/store/useToolStore';

import type { Bilingual } from './deepeningLadder';
import { rankRisks, type RiskExposure } from './moveValidator';

export type RiskMatrixZone = 'act-now' | 'contingency' | 'manage' | 'accept';

export const RISK_MATRIX_ZONES: RiskMatrixZone[] = ['act-now', 'contingency', 'manage', 'accept'];

export interface RiskZoneMeta {
  titleEn: string;
  titlePl: string;
  /** The stance the grid implies for this cell. */
  stanceEn: string;
  stancePl: string;
  /** The default response the canonical grid attaches to this cell. */
  defaultStrategy: RiskResponseStrategy;
  /** Sort priority when nothing else separates two risks (lower = more urgent). */
  order: number;
}

export const RISK_ZONE_META: Record<RiskMatrixZone, RiskZoneMeta> = {
  'act-now': {
    titleEn: 'Act now',
    titlePl: 'Działaj teraz',
    stanceEn:
      'Likely AND damaging — the plan cannot carry it unmanaged; mitigate now, avoid if extreme.',
    stancePl:
      'Prawdopodobne I dotkliwe — plan tego nie udźwignie bez reakcji; łagodź teraz, unikaj gdy skrajne.',
    defaultStrategy: 'mitigate',
    order: 0,
  },
  contingency: {
    titleEn: 'Contingency',
    titlePl: 'Plan awaryjny',
    stanceEn:
      'Rare but severe — you cannot cut the odds much, so transfer or cap the impact (insure, hedge, contract) and pre-arm a response.',
    stancePl:
      'Rzadkie, lecz ciężkie — szans nie zetniesz, więc przenieś lub ogranicz skutek (ubezpieczenie, hedge, umowa) i przygotuj reakcję z góry.',
    defaultStrategy: 'transfer',
    order: 1,
  },
  manage: {
    titleEn: 'Manage',
    titlePl: 'Zarządzaj',
    stanceEn:
      'Frequent but minor — routine operational control; reduce the likelihood, absorb the rest.',
    stancePl:
      'Częste, lecz drobne — rutynowa kontrola operacyjna; obniż prawdopodobieństwo, resztę zaabsorbuj.',
    defaultStrategy: 'mitigate',
    order: 2,
  },
  accept: {
    titleEn: 'Accept',
    titlePl: 'Zaakceptuj',
    stanceEn:
      'Unlikely and light — accept it consciously and monitor; spending on it starves the real risks.',
    stancePl:
      'Mało prawdopodobne i lekkie — zaakceptuj świadomie i monitoruj; wydatek na nie głodzi realne ryzyka.',
    defaultStrategy: 'accept',
    order: 3,
  },
};

/** Probability/impact 1..5; midpoint 3 splits high vs low. Configurable. */
export const AXIS_MIDPOINT = 3;

/** Extreme exposure (of 25) at which the "act-now" default escalates to avoidance. */
export const AVOID_EXPOSURE_THRESHOLD = 20;

/**
 * Classify a probability x impact pair into the 2x2 zone. A score at exactly the
 * midpoint counts as HIGH (a risk on the fence is treated as the more serious of
 * the two — bias toward attention, never away from it).
 */
export function classifyRiskZone(
  probability: number,
  impact: number,
  midpoint = AXIS_MIDPOINT
): RiskMatrixZone {
  const highProb = probability >= midpoint;
  const highImpact = impact >= midpoint;
  if (highProb && highImpact) return 'act-now';
  if (!highProb && highImpact) return 'contingency';
  if (highProb && !highImpact) return 'manage';
  return 'accept';
}

/**
 * The response the grid recommends for a risk, given its zone and exposure. The
 * "act-now" cell escalates from mitigate to AVOID once exposure is extreme — you
 * do not manage a near-certain catastrophe, you remove its source.
 */
export function recommendedStrategy(zone: RiskMatrixZone, exposure: number): RiskResponseStrategy {
  if (zone === 'act-now' && exposure >= AVOID_EXPOSURE_THRESHOLD) return 'avoid';
  return RISK_ZONE_META[zone].defaultStrategy;
}

export type ExposureBand = 'critical' | 'high' | 'medium' | 'low';

/** Collapse a 1..25 exposure into a 4-band severity used for ordering/labels. */
export function exposureBand(exposure: number): ExposureBand {
  if (exposure >= 15) return 'critical';
  if (exposure >= 8) return 'high';
  if (exposure >= 4) return 'medium';
  return 'low';
}

export interface ClassifiedRisk extends RiskExposure {
  zone: RiskMatrixZone;
  band: ExposureBand;
  /** The response the grid recommends (default; the consultant may override). */
  recommendedStrategy: RiskResponseStrategy;
  /** true when this risk sits in "act-now"/"contingency" but has no full response. */
  responseGap: boolean;
}

export interface RiskMatrixCells {
  'act-now': ClassifiedRisk[];
  contingency: ClassifiedRisk[];
  manage: ClassifiedRisk[];
  accept: ClassifiedRisk[];
}

export interface RiskResponseMapEntry {
  riskId: string;
  title: string;
  zone: RiskMatrixZone;
  probability: number;
  impact: number;
  exposure: number;
  band: ExposureBand;
  recommendedStrategy: RiskResponseStrategy;
  /** true when the recommended strategy is not yet backed by a full response. */
  responseGap: boolean;
  stance: Bilingual;
}

export interface RiskMatrix {
  /** Every accepted risk classified into the 2x2, ranked by weighted exposure. */
  ranked: ClassifiedRisk[];
  cells: RiskMatrixCells;
  /** One response recommendation per risk (the "mapa reakcji"). */
  responseMap: RiskResponseMapEntry[];
  /** Count of risks in act-now/contingency lacking a full response. */
  responseGapCount: number;
  rationale: Bilingual;
}

const emptyCells = (): RiskMatrixCells => ({
  'act-now': [],
  contingency: [],
  manage: [],
  accept: [],
});

/**
 * Build the full risk matrix from a session. Reuses rankRisks so exposure math
 * is identical to the ranking and conclusion prompt — the matrix classifies, it
 * never re-scores. Ranked highest weighted exposure first.
 */
export function buildRiskMatrix(data: RiskUncertaintyData, midpoint = AXIS_MIDPOINT): RiskMatrix {
  const ranking = rankRisks(data);
  const order = new Map(ranking.orderedRiskIds.map((id, i) => [id, i]));

  const ranked: ClassifiedRisk[] = [...ranking.risks]
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((r) => {
      const zone = classifyRiskZone(r.probability, r.impact, midpoint);
      const urgentZone = zone === 'act-now' || zone === 'contingency';
      return {
        ...r,
        zone,
        band: exposureBand(r.exposure),
        recommendedStrategy: recommendedStrategy(zone, r.exposure),
        responseGap: urgentZone && !r.responseReady,
      };
    });

  const cells = emptyCells();
  ranked.forEach((r) => cells[r.zone].push(r));

  const responseMap: RiskResponseMapEntry[] = ranked.map((r) => ({
    riskId: r.id,
    title: r.title,
    zone: r.zone,
    probability: r.probability,
    impact: r.impact,
    exposure: r.exposure,
    band: r.band,
    recommendedStrategy: r.recommendedStrategy,
    responseGap: r.responseGap,
    stance: { pl: RISK_ZONE_META[r.zone].stancePl, en: RISK_ZONE_META[r.zone].stanceEn },
  }));

  const responseGapCount = ranked.filter((r) => r.responseGap).length;

  const top = ranked[0];
  const rationale: Bilingual =
    ranked.length === 0
      ? {
          pl: 'Brak zaakceptowanych ryzyk do rozłożenia na macierzy — dodaj co najmniej jedno ryzyko z prawdopodobieństwem i wpływem.',
          en: 'No accepted risks to place on the matrix — add at least one risk with a probability and impact.',
        }
      : {
          pl: `Najgroźniejsze ryzyko „${top.title}" ląduje w strefie „${RISK_ZONE_META[top.zone].titlePl}" (P${top.probability}×I${top.impact}=${top.exposure}/25) → domyślna reakcja: ${top.recommendedStrategy}. ${responseGapCount} ryzyk w strefach pilnych bez pełnej reakcji.`,
          en: `The gravest risk "${top.title}" lands in the "${RISK_ZONE_META[top.zone].titleEn}" zone (P${top.probability}×I${top.impact}=${top.exposure}/25) -> default response: ${top.recommendedStrategy}. ${responseGapCount} risk(s) in urgent zones without a full response.`,
        };

  return { ranked, cells, responseMap, responseGapCount, rationale };
}

/** Prompt block teaching the model the 2x2 zone + response contract (PL/EN aware). */
export function buildRiskMatrixPromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `Silnik klasyfikuje KAŻDE ryzyko na macierzy 2×2 prawdopodobieństwo×wpływ DETERMINISTYCZNIE — narrację dokładasz na wierzchu, nie zmieniasz strefy ani reakcji domyślnej.
- "act-now" (wysokie P × wysoki wpływ) → domyślnie ŁAGODŹ (unikaj przy skrajnej ekspozycji ≥${AVOID_EXPOSURE_THRESHOLD}/25).
- "contingency" (niskie P × wysoki wpływ) → domyślnie PRZENIEŚ (ubezpieczenie/hedge/umowa) + gotowy plan awaryjny.
- "manage" (wysokie P × niski wpływ) → domyślnie ŁAGODŹ operacyjnie (obniż prawdopodobieństwo, resztę zaabsorbuj).
- "accept" (niskie P × niski wpływ) → domyślnie ZAAKCEPTUJ i monitoruj; nie przepalaj na to zasobów.
Reakcja domyślna to punkt startu, nie wyrok — ale ryzyko w „act-now" pozostawione na „accept" to widoczna sprzeczność do obrony.`;
  }
  return `The engine classifies EVERY risk on the 2x2 probability x impact matrix DETERMINISTICALLY — you narrate on top, you do not change the zone or the default response.
- "act-now" (high P x high impact) -> default MITIGATE (AVOID at extreme exposure >= ${AVOID_EXPOSURE_THRESHOLD}/25).
- "contingency" (low P x high impact) -> default TRANSFER (insurance/hedge/contract) + a pre-armed contingency plan.
- "manage" (high P x low impact) -> default MITIGATE operationally (cut the likelihood, absorb the rest).
- "accept" (low P x low impact) -> default ACCEPT and monitor; do not burn resources on it.
The default response is a starting point, not a verdict — but a risk in "act-now" left on "accept" is a visible contradiction you must defend.`;
}
