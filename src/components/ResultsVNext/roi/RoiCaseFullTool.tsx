/**
 * RoiCaseFullTool — the ROI Case FULL TOOL, klasa L (task brief D03: "pełne
 * narzędzie ROI jest klasy L. Nie wciskaj w klasę S, nie buduj wielkiego
 * edytora w podglądzie."). Organizes the whole ~15-sub-resource-group ROI
 * Case surface into the FOUR REQUIRED phases:
 *
 *   Build Case → Decision → Realize Value → Learn
 *
 * Thin dispatcher: owns ONLY the `phase` state and hands off to one
 * phase-specific workspace component, each of which owns its own Menu 2
 * sub-view tabs (following the proven, already-shipped
 * `RoiCaseModelWorkspace` pattern) plus the shared phase-chip Menu 3 strip
 * from `RoiCasePhaseNav.tsx`:
 *
 *   - Build Case    → `RoiCaseModelWorkspace` (baseline/policy, assumptions,
 *                      cost lines, benefit lines [+ KPI evidence links],
 *                      scenarios [+ overrides], calculation runs)
 *   - Decision      → `RoiCaseDecisionWorkspace` (approval snapshots,
 *                      compare). Lifecycle TRANSITIONS themselves
 *                      (submit/approve/reject/...) stay in
 *                      `ResultsRoiHub.tsx`'s row-menu kebab — one real
 *                      implementation, not a second copy in this phase.
 *   - Realize Value → `RoiCaseRealizeValueWorkspace` (forecast versions,
 *                      actuals [+corrections/verify/dispute], actual
 *                      snapshots, variances [+causes], benefits realization)
 *   - Learn         → `RoiCaseLearnWorkspace` (PIR [+schedule/draft/Teresa
 *                      disposition], finance links, finance
 *                      reconciliations)
 *
 * PLACEMENT (unchanged from the original `RoiCaseModelWorkspace` decision,
 * RN_G2_UI_SCOPE.md §G Open Question #2 stays unresolved — a real
 * `/results/roi/cases/:roiCaseId` route would silently pre-decide klasa
 * S-vs-L for the whole program): a case-scoped sub-view of the existing
 * `/results/roi` route, switched by local state in `ResultsRoiHub.tsx`
 * (`fullToolCase`), NOT a new route.
 *
 * KPI evidence links (nested under a benefit line) and scenario overrides
 * (nested under a scenario) are deliberately NOT separate phases/tabs — both
 * are genuinely scoped to ONE parent row, surfaced via that row's
 * `StandardPreview.relations` block + a "Manage" action, per
 * `roiCaseFullToolPresenters.tsx`'s `buildRoiScenarioPreview`/benefit-line
 * preview — not a 17th top-level tab for a resource with no independent
 * existence.
 */
import React, { useState } from 'react';

import type { RoiCaseListItem } from './roiApi';
import { RoiCaseModelWorkspace } from './RoiCaseModelWorkspace';
import { RoiCaseDecisionWorkspace } from './RoiCaseDecisionWorkspace';
import { RoiCaseRealizeValueWorkspace } from './RoiCaseRealizeValueWorkspace';
import { RoiCaseLearnWorkspace } from './RoiCaseLearnWorkspace';
import type { RoiCasePhase } from './RoiCasePhaseNav';

export interface RoiCaseFullToolProps {
  roiCase: RoiCaseListItem;
  isPolish: boolean;
  onBack: () => void;
  /** Optional — lets a caller (e.g. the dev-render harness) force the
   * initial phase via a URL param instead of always starting on Build
   * Case, without adding a route. */
  initialPhase?: RoiCasePhase;
}

export const RoiCaseFullTool: React.FC<RoiCaseFullToolProps> = ({ roiCase, isPolish, onBack, initialPhase = 'build' }) => {
  const [phase, setPhase] = useState<RoiCasePhase>(initialPhase);

  if (phase === 'decision') {
    return <RoiCaseDecisionWorkspace roiCase={roiCase} isPolish={isPolish} onBack={onBack} phase={phase} onPhaseChange={setPhase} />;
  }
  if (phase === 'realize') {
    return <RoiCaseRealizeValueWorkspace roiCase={roiCase} isPolish={isPolish} onBack={onBack} phase={phase} onPhaseChange={setPhase} />;
  }
  if (phase === 'learn') {
    return <RoiCaseLearnWorkspace roiCase={roiCase} isPolish={isPolish} onBack={onBack} phase={phase} onPhaseChange={setPhase} />;
  }
  return <RoiCaseModelWorkspace roiCase={roiCase} isPolish={isPolish} onBack={onBack} phase={phase} onPhaseChange={setPhase} />;
};

export default RoiCaseFullTool;
