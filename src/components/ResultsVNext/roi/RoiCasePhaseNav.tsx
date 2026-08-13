/**
 * RoiCasePhaseNav — shared phase-chip builder for the ROI Case FULL TOOL.
 *
 * Task brief requires organizing the tool as FOUR phases (Build Case →
 * Decision → Realize Value → Learn) — this is the ONE place that builds
 * that navigation as `StandardModuleBar` Menu 3 `chips`
 * (`chips`/`activeChip`/`onChipChange`, TRIADA-documented "silent filter
 * chips, counts always shown incl. 0"), reused identically by all four
 * phase-workspace components (`RoiCaseModelWorkspace` = Build Case,
 * `RoiCaseDecisionWorkspace`, `RoiCaseRealizeValueWorkspace`,
 * `RoiCaseLearnWorkspace`) so the phase strip never drifts between them.
 *
 * Menu 2 (`tabs`) in every phase-workspace is the SUB-VIEW selector within
 * that phase (settings/assumptions/cost-lines/... for Build Case, etc.) —
 * already the proven, shipped pattern from the original
 * `RoiCaseModelWorkspace`. Menu 3 here is therefore the higher-level phase
 * switcher, not a data filter — chip `count` is deliberately NOT a business
 * metric (never fabricated to look like one): it is the honest, fixed,
 * always-correct number of sub-view tabs that phase owns (Build Case=6,
 * Decision=2, Realize Value=5, Learn=3), a structural fact, not invented
 * data. D14 applies: this is a small, undecided-by-any-doc visual choice —
 * used the closest sanctioned Standard affordance (chips) and moved on.
 */
import type { StandardCounterChip } from '@/components/standard';

export type RoiCasePhase = 'build' | 'decision' | 'realize' | 'learn';

export const ROI_PHASE_SUBVIEW_COUNT: Record<RoiCasePhase, number> = {
  build: 6,
  decision: 2,
  realize: 5,
  learn: 3,
};

export const ROI_PHASE_LABELS: Record<RoiCasePhase, { pl: string; en: string }> = {
  build: { pl: 'Budowa sprawy', en: 'Build Case' },
  decision: { pl: 'Decyzja', en: 'Decision' },
  realize: { pl: 'Realizacja wartości', en: 'Realize Value' },
  learn: { pl: 'Wnioski', en: 'Learn' },
};

export function buildRoiCasePhaseChips(isPolish: boolean): StandardCounterChip[] {
  return (['build', 'decision', 'realize', 'learn'] as const).map((phase) => ({
    id: phase,
    label: isPolish ? ROI_PHASE_LABELS[phase].pl : ROI_PHASE_LABELS[phase].en,
    count: ROI_PHASE_SUBVIEW_COUNT[phase],
  }));
}
