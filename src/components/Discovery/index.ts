/**
 * Discovery Consultant Components
 *
 * AI-powered sales discovery with live canvas visualization.
 */

// Main components
export { DiscoveryCanvas } from './DiscoveryCanvas';
export { DiscoveryConsultantView } from './DiscoveryConsultantView';
export { RecommendationPanel } from './RecommendationPanel';
export { DiscoveryFooterActions } from './DiscoveryFooterActions';
export { DiscoveryHeader } from './DiscoveryHeader';
export { ProjectConversionModal } from './ProjectConversionModal';

// Node components
export * from './nodes';

// Hooks
export { useDiscoverySync } from './hooks/useDiscoverySync';
export { useAutoLayout } from './hooks/useAutoLayout';

// AI Configuration
export { DISCOVERY_SYSTEM_PROMPT, DISCOVERY_WELCOME_MESSAGE } from './ai/discoveryPrompts';

// Types re-export
export type {
  DiscoveryNode,
  DiscoveryEdge,
  DiscoverySession,
  DiscoveryPhase,
  TransformationType,
  ClientContext,
  DiscoveryRecommendations,
} from '@/types/discovery';
