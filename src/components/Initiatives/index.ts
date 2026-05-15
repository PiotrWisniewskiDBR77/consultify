/**
 * Initiatives Module Exports
 * Named exports only - no default re-export to avoid bundler issues
 *
 * CANONICAL COMPONENTS:
 * - InitiativesHub: Main initiatives list/grid view
 * - InitiativeDrawer: Quick-review side panel (50% width)
 * - InitiativeDocumentView: Full initiative view for DynamicTabs
 *
 * LEGACY (deprecated, will be removed):
 * - InitiativeDetailCard
 * - InitiativeFullView
 */

// V3-F01 — Initiative level templates
export type { InitiativeLevel, InitiativeLevelTemplate } from './templates';
export {
  getInitiativeLevelTemplate,
  INITIATIVE_LEVEL_TEMPLATES,
  InitiativeLevelPill,
  InitiativeLevelSelector,
} from './templates';

// V3-F02 — Portfolio Analysis
export { PortfolioAnalysisView } from './Analysis';

// Canonical exports
export { InitiativeDocumentView } from './InitiativeDocumentView';
export { InitiativeDrawer } from './InitiativeDrawer';
export { InitiativesHub } from './InitiativesHub';
export { InitiativesTimelineView } from './InitiativesTimelineView';

// Legacy exports removed (P11 contract §2.7 — InitiativeDocumentView is the canonical full view).
// InitiativeDetailCard and InitiativeFullView are deprecated and no longer exported.
// If you need these, import directly from the file (not recommended).
