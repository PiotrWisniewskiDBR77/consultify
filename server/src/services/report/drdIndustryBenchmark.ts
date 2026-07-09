/**
 * DRD Report — industry benchmark overlay (P3, prepared but not yet decided) — server mirror
 *
 * Maps the engine's 7 measured report axes onto the 8-dimension (D1–D8)
 * DRD industry reference profiles (`../assessmentKnowledge/drdIndustryProfiles`)
 * and produces an ADDITIVE benchmark comparison section: company actual vs
 * {typical, leader} of the chosen industry segment, per dimension.
 *
 * Scope note: `drdReportModel.ts` builds 7 dimensions (engine axes 1–7); the
 * industry profiles are expressed on 8 dimensions (D1–D8) per DRD Canon §3.2.
 * D5 ("Technologia i infrastruktura") has NO matching engine axis today — it
 * is surfaced as `unmatchedDimensionIds`, never invented from thin air.
 *
 * HARD RULE: `actualPercent` always comes from the engine (`DrdDimension`);
 * only the {typical, leader} reference values come from the (expert-hypothesis,
 * disclaimed) industry profile.
 */

import {
  DRD_INDUSTRY_PROFILE_SOURCE,
  getDRDIndustryProfile,
  type DRDDimensionId,
  type DRDIndustryId,
} from '../assessmentKnowledge/drdIndustryProfiles.js';
import type { DrdDimension } from './drdReportModel.js';

/** Default industry when the org profile carries no DRD industry segment (P3 default = "produkcja"). */
export const DEFAULT_DRD_BENCHMARK_INDUSTRY: DRDIndustryId = 'process-manufacturing';

/**
 * Engine axis id (1–7, `drdStructure.ts`) → industry-profile dimension id (D1–D8).
 * D5 (Technologia i infrastruktura) is intentionally absent — no engine axis
 * measures it yet; see `unmatchedDimensionIds` on the built section.
 */
export const AXIS_TO_DRD_DIMENSION_ID: Record<number, DRDDimensionId> = {
  1: 'D1', // Digital Processes -> Procesy cyfrowe
  2: 'D2', // Digital Products -> Produkty cyfrowe
  3: 'D3', // Digital Business Models -> Cyfrowe modele biznesowe
  4: 'D4', // Data Management -> Dane i analityka
  5: 'D6', // Culture of Transformation -> Ludzie i kultura
  6: 'D7', // Cybersecurity -> Cyberbezpieczeństwo
  7: 'D8', // AI Maturity -> Dojrzałość AI
};

export interface DrdBenchmarkRow {
  axisId: number;
  dimensionId: DRDDimensionId;
  /** Already localized (matches the axis's own language selection). */
  name: string;
  /** Engine-exact, 0–100. */
  actualPercent: number;
  /** From the industry profile (expert hypothesis), 0–100. */
  typicalPercent: number;
  /** From the industry profile (expert hypothesis), 0–100. */
  leaderPercent: number;
  /** actualPercent - typicalPercent, percentage points. */
  deltaToTypical: number;
  /** actualPercent - leaderPercent, percentage points. */
  deltaToLeader: number;
}

export interface DrdIndustryBenchmarkSection {
  industry: DRDIndustryId;
  industryLabel: { pl: string; en: string };
  narrative: { pl: string; en: string };
  disclaimer: { pl: string; en: string };
  source: typeof DRD_INDUSTRY_PROFILE_SOURCE;
  rows: DrdBenchmarkRow[];
  /** Profile dimensions with no matching engine axis today (e.g. D5). */
  unmatchedDimensionIds: DRDDimensionId[];
}

/** DRDReferenceLevel (1–5) -> percent, matching the I–V scale used by the profiles. */
const referenceLevelToPercent = (level: number): number => Math.round((level / 5) * 100);

/**
 * Build the industry benchmark overlay for a set of report dimensions.
 * Pure function — no I/O, no invented numbers (Canon §8.1/§8.2 compliant).
 */
export function buildDrdIndustryBenchmarkSection(
  dimensions: DrdDimension[],
  industry: DRDIndustryId = DEFAULT_DRD_BENCHMARK_INDUSTRY
): DrdIndustryBenchmarkSection {
  const profile = getDRDIndustryProfile(industry);
  const matchedDimensionIds = new Set<DRDDimensionId>();

  const rows: DrdBenchmarkRow[] = dimensions
    .filter((d) => Boolean(AXIS_TO_DRD_DIMENSION_ID[d.axisId]))
    .map((d) => {
      const dimensionId = AXIS_TO_DRD_DIMENSION_ID[d.axisId];
      matchedDimensionIds.add(dimensionId);
      const benchmark = profile.dimensionBenchmarks[dimensionId];
      const typicalPercent = referenceLevelToPercent(benchmark.typical);
      const leaderPercent = referenceLevelToPercent(benchmark.leader);
      return {
        axisId: d.axisId,
        dimensionId,
        name: d.name,
        actualPercent: d.actualPercent,
        typicalPercent,
        leaderPercent,
        deltaToTypical: d.actualPercent - typicalPercent,
        deltaToLeader: d.actualPercent - leaderPercent,
      };
    })
    .sort((a, b) => a.axisId - b.axisId);

  const unmatchedDimensionIds = (
    Object.keys(profile.dimensionBenchmarks) as DRDDimensionId[]
  ).filter((id) => !matchedDimensionIds.has(id));

  return {
    industry: profile.industry,
    industryLabel: profile.label,
    narrative: profile.narrative,
    disclaimer: profile.disclaimer,
    source: profile.source,
    rows,
    unmatchedDimensionIds,
  };
}
