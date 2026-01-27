/**
 * Discovery Consultant Components
 *
 * AI-powered sales discovery with live canvas visualization.
 */

// Main components
export { DiscoveryCanvas } from './DiscoveryCanvas';
export { DiscoveryConsultantView } from './DiscoveryConsultantView'; // Legacy - use InterviewHub
export { DiscoveryFooterActions } from './DiscoveryFooterActions';
export { DiscoveryHeader } from './DiscoveryHeader';
export { DiscoveryToolsHub } from './DiscoveryToolsHub';
export { InterviewHub } from './InterviewHub'; // New ModuleHub pattern
export { ProjectConversionModal } from './ProjectConversionModal';
export { RecommendationPanel } from './RecommendationPanel';

// Node components
export * from './nodes';

// Hooks
export { useAutoLayout } from './hooks/useAutoLayout';
export { useDiscoverySync } from './hooks/useDiscoverySync';

// AI Configuration
export { DISCOVERY_SYSTEM_PROMPT, DISCOVERY_WELCOME_MESSAGE } from './ai/discoveryPrompts';

// Types re-export
export type {
  ClientContext,
  DiscoveryEdge,
  DiscoveryNode,
  DiscoveryPhase,
  DiscoveryRecommendations,
  DiscoverySession,
  TransformationType,
} from '@/types/discovery';
