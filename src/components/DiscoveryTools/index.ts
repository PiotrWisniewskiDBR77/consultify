/**
 * DiscoveryTools - Main exports
 *
 * Strategic analysis tools components.
 */

// Main components
export { ToolWorkspace } from './ToolWorkspace';
export { ToolHeader } from './ToolHeader';
export { ToolCanvas } from './ToolCanvas';
export { ToolActionBar } from './ToolActionBar';

// Initiative & Report components
export { InitiativeComposer } from './InitiativeComposer';
export { ReportView } from './ReportView';

// Steps
export { ContextStep, SummaryStep } from './steps';

// Visualizations
export { SWOTMatrix, PorterRadar } from './visualizations';

// Tool-specific components
export { SWOTQuadrantStep, SWOTCorrelationsStep } from './tools/DynamicSWOT';
export { ForceStep } from './tools/MarketForces';

// Common utilities
export {
  ToolErrorBoundary,
  withErrorBoundary,
  Skeleton,
  ToolWorkspaceSkeleton,
  SWOTMatrixSkeleton,
  PorterRadarSkeleton,
} from './common';

// AI prompts
export { getSystemPrompt, getStepQuestion } from './ai';
