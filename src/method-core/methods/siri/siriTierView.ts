/**
 * SIRI TIER / Prioritisation Matrix — SEPARATE VIEW wiring (A7, 2026-08-13).
 *
 * Kanon (ASSESSMENT_KB_SIRI.md §4): "Nie wolno łączyć wyboru Band z
 * priorytetyzacją w jednym formularzu." TIER is therefore never rendered
 * inside `MethodWorkspaceShell`'s Band-selection surfaces (Interview/Matrix
 * — see `siriWorkspaceView.ts`). It is a standalone screen
 * (`dev-render/screens/siri-tier.tsx`) mounted only once the session is
 * frozen, and every function below refuses to run before that.
 *
 * This module is a thin wrapper over `siriAdapter.prioritise()`
 * (`siriAdapter.ts`), which itself is a thin wrapper over the EXISTING
 * `src/services/siriPrioritisation.ts` engine (COORD-08). No formula lives
 * here — only display shaping (ranking table, focus-by-block grouping,
 * explicit calculationVersion/planningHorizon/weights for the UI to show).
 */

import type { PrioritisationResult } from '@/method-core/contracts';
import { SIRI_PRIORITISATION_AREAS, type SIRIBuildingBlock } from '@/services/siriStructure';
import type { SiriPmCalculationVersion, SiriPmPlanningHorizon } from '@/services/siriPrioritisation';
import { isSiriPmV2Enabled } from '@/utils/siriPmV2Flag';

import { SIRI_PM_PLANNING_HORIZON_WEIGHTS, siriAdapter } from './siriAdapter';

const ALL_BUILDING_BLOCKS: readonly SIRIBuildingBlock[] = ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'];

// ---------------------------------------------------------------------------
// Availability — TIER is gated on freeze, never silently computed on live data
// ---------------------------------------------------------------------------

export interface SiriTierAvailability {
  readonly available: boolean;
  readonly reason: string | null;
}

export function siriTierAvailability(sessionState: string): SiriTierAvailability {
  if (sessionState !== 'frozen') {
    return {
      available: false,
      reason:
        'TIER (Prioritisation Matrix) jest dostępny dopiero po zamrożeniu sesji (freeze) — ' +
        `Assessment Matrix i Prioritisation Matrix to dwie kolejne macierze (ASSESSMENT_KB_SIRI.md §4). ` +
        `Bieżący stan sesji: "${sessionState}".`,
    };
  }
  return { available: true, reason: null };
}

// ---------------------------------------------------------------------------
// Run + display shaping
// ---------------------------------------------------------------------------

export interface SiriTierRankedRow {
  readonly areaId: string;
  readonly areaName: string;
  readonly buildingBlock: SIRIBuildingBlock;
  readonly rank: number;
  readonly rationale: string;
  readonly isFocus: boolean;
}

export interface SiriTierFocusByBlock {
  readonly buildingBlock: SIRIBuildingBlock;
  readonly focusAreaIds: readonly string[];
}

export interface SiriTierViewResult {
  readonly calculationVersion: SiriPmCalculationVersion;
  readonly planningHorizon: SiriPmPlanningHorizon;
  readonly weights: (typeof SIRI_PM_PLANNING_HORIZON_WEIGHTS)[SiriPmPlanningHorizon];
  readonly parametersVersion: string;
  readonly ranked: readonly SiriTierRankedRow[];
  readonly focusByBlock: readonly SiriTierFocusByBlock[];
  readonly totalFocusCount: number;
}

export interface RunSiriTierInput {
  readonly frozenSnapshotId: string;
  readonly frozenUnitLevels: Readonly<Record<string, number>>;
  readonly planningHorizon: SiriPmPlanningHorizon;
  /**
   * Explicit override; omit to fall back to the `SIRI_PM_V2` flag
   * (`src/utils/siriPmV2Flag.ts`) — resolved by `siriAdapter.prioritise()`
   * itself, never duplicated/guessed here (COORD-08 "zero cichej zmiany").
   */
  readonly calculationVersion?: SiriPmCalculationVersion;
}

/**
 * Runs TIER for an already-frozen snapshot. Throws (via `siriAdapter.prioritise`)
 * if `frozenSnapshotId` is falsy — callers MUST check `siriTierAvailability`
 * first; this function does not re-derive availability from a session object.
 */
export function runSiriTier(input: RunSiriTierInput): SiriTierViewResult {
  const result: PrioritisationResult = siriAdapter.prioritise!({
    frozenUnitLevels: input.frozenUnitLevels,
    parameters: {
      sessionState: 'frozen',
      frozenSnapshotId: input.frozenSnapshotId,
      planningHorizon: input.planningHorizon,
      ...(input.calculationVersion ? { calculationVersion: input.calculationVersion } : {}),
    },
  });

  const areaById = new Map(SIRI_PRIORITISATION_AREAS.map((a) => [a.id, a]));

  const ranked: SiriTierRankedRow[] = result.rankedUnitIds.map((areaId, index) => {
    const area = areaById.get(areaId);
    const rationale = result.rationaleByUnitId[areaId] ?? '';
    return {
      areaId,
      areaName: area?.name ?? areaId,
      buildingBlock: area?.buildingBlock ?? 'PROCESS',
      rank: index + 1,
      rationale,
      isFocus: rationale.startsWith('SELECTED_FOCUS'),
    };
  });

  const focusByBlockMap = new Map<SIRIBuildingBlock, string[]>();
  for (const row of ranked) {
    if (!row.isFocus) continue;
    const list = focusByBlockMap.get(row.buildingBlock) ?? [];
    list.push(row.areaId);
    focusByBlockMap.set(row.buildingBlock, list);
  }
  // Always report all 3 blocks, even if (unexpectedly) empty — an absent key
  // must never read as "not computed" vs "computed, zero focus".
  const focusByBlock: SiriTierFocusByBlock[] = ALL_BUILDING_BLOCKS.map((buildingBlock) => ({
    buildingBlock,
    focusAreaIds: focusByBlockMap.get(buildingBlock) ?? [],
  }));

  // `PrioritisationResult.calculationVersion` is typed as a plain optional
  // `string` at the kernel-contract level (so adapters without a versioned
  // engine are unaffected) — narrow it back to the two SIRI-known literals
  // rather than silently trusting/`as`-casting an arbitrary string.
  const calculationVersion: SiriPmCalculationVersion =
    result.calculationVersion === 'siri_pm_v2' ? 'siri_pm_v2' : 'legacy_v1';

  return {
    calculationVersion,
    planningHorizon: input.planningHorizon,
    weights: SIRI_PM_PLANNING_HORIZON_WEIGHTS[input.planningHorizon],
    parametersVersion: result.parametersVersion,
    ranked,
    focusByBlock,
    totalFocusCount: ranked.filter((r) => r.isFocus).length,
  };
}

/**
 * Convenience for the UI to show "what would run right now without an
 * explicit override" — mirrors the same flag `siriAdapter.prioritise()`
 * reads, never a second implementation of the resolution order.
 */
export function siriTierActiveCalculationVersionFromFlag(): SiriPmCalculationVersion {
  return isSiriPmV2Enabled() ? 'siri_pm_v2' : 'legacy_v1';
}
