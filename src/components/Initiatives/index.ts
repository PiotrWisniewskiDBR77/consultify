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

// Canonical exports
export { InitiativeDocumentView } from './InitiativeDocumentView';
export { InitiativeDrawer } from './InitiativeDrawer';
export { InitiativesHub } from './InitiativesHub';
export { InitiativesTimelineView } from './InitiativesTimelineView';

// Legacy exports (deprecated - use InitiativeDocumentView instead)
/** @deprecated Use InitiativeDocumentView instead */
export { InitiativeDetailCard } from './InitiativeDetailCard';
/** @deprecated Use InitiativeDocumentView instead */
export { InitiativeFullView } from './InitiativeFullView';
