/**
 * Layout Definitions — barrel export + registry
 * 15 immutable layouts, 1:1 mapped to intents.
 */
import type {
  DesignTokens,
  LayoutResult,
  SlideIntent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';
import { AppendixLayout } from './AppendixLayout.js';
import { ComparisonLayout } from './ComparisonLayout.js';
import { CoverLayout } from './CoverLayout.js';
import { ExecutiveSummaryLayout } from './ExecutiveSummaryLayout.js';
import { HeatmapLayout } from './HeatmapLayout.js';
import { InitiativePortfolioLayout } from './InitiativePortfolioLayout.js';
import { KeyMessagesLayout } from './KeyMessagesLayout.js';
import { KpiDashboardLayout } from './KpiDashboardLayout.js';
import { NextStepsLayout } from './NextStepsLayout.js';
import { PrioritizationMatrixLayout } from './PrioritizationMatrixLayout.js';
import { ProblemCauseImpactLayout } from './ProblemCauseImpactLayout.js';
import { RecommendationSingleLayout } from './RecommendationSingleLayout.js';
import { RecommendationStackLayout } from './RecommendationStackLayout.js';
import { RiskMitigationLayout } from './RiskMitigationLayout.js';
import { RoadmapLayout } from './RoadmapLayout.js';
import { SectionIntroLayout } from './SectionIntroLayout.js';
import { SingleInsightLayout } from './SingleInsightLayout.js';

// ================================================================
// LAYOUT REGISTRY — intent → layout function (immutable mapping)
// ================================================================

type LayoutFn = (
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
) => LayoutResult;

const LAYOUT_REGISTRY: Record<SlideIntent, LayoutFn> = {
  cover: CoverLayout,
  executive_summary: ExecutiveSummaryLayout,
  section_intro: SectionIntroLayout,
  key_messages: KeyMessagesLayout,
  performance_overview: KpiDashboardLayout,
  single_insight: SingleInsightLayout,
  comparison: ComparisonLayout,
  assessment: HeatmapLayout,
  root_cause: ProblemCauseImpactLayout,
  recommendation_single: RecommendationSingleLayout,
  recommendation_portfolio: RecommendationStackLayout,
  initiative_portfolio: InitiativePortfolioLayout,
  prioritization_matrix: PrioritizationMatrixLayout,
  roadmap: RoadmapLayout,
  risk_management: RiskMitigationLayout,
  next_steps: NextStepsLayout,
  appendix: AppendixLayout,
};

/**
 * Resolve layout for a given intent.
 * Throws if intent is unknown (quality gate).
 */
export function resolveLayout(intent: SlideIntent): LayoutFn {
  const layout = LAYOUT_REGISTRY[intent];
  if (!layout) {
    throw new Error(`[LayoutRegistry] Unknown intent: "${intent}". No layout defined.`);
  }
  return layout;
}

export { LAYOUT_REGISTRY };

// Re-export individual layouts
export { AppendixLayout } from './AppendixLayout.js';
export { ComparisonLayout } from './ComparisonLayout.js';
export { CoverLayout } from './CoverLayout.js';
export { ExecutiveSummaryLayout } from './ExecutiveSummaryLayout.js';
export { HeatmapLayout } from './HeatmapLayout.js';
export { InitiativePortfolioLayout } from './InitiativePortfolioLayout.js';
export { KeyMessagesLayout } from './KeyMessagesLayout.js';
export { KpiDashboardLayout } from './KpiDashboardLayout.js';
export { NextStepsLayout } from './NextStepsLayout.js';
export { PrioritizationMatrixLayout } from './PrioritizationMatrixLayout.js';
export { ProblemCauseImpactLayout } from './ProblemCauseImpactLayout.js';
export { RecommendationSingleLayout } from './RecommendationSingleLayout.js';
export { RecommendationStackLayout } from './RecommendationStackLayout.js';
export { RiskMitigationLayout } from './RiskMitigationLayout.js';
export { RoadmapLayout } from './RoadmapLayout.js';
export { SectionIntroLayout } from './SectionIntroLayout.js';
export { SingleInsightLayout } from './SingleInsightLayout.js';
