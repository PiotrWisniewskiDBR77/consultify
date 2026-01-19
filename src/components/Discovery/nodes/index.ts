/**
 * Discovery Canvas Node Components
 *
 * React Flow custom nodes for Discovery Consultant canvas.
 * Includes both Discovery-specific nodes and shared diagram nodes.
 */

// Discovery-specific nodes
// Shared diagram nodes (from Studio integration)
import {
  DecisionNode,
  MindmapNode,
  ProcessStepNode,
  StartEndNode,
  TextNode,
} from '@/components/shared/DiagramNodes';

import { AssessmentNode } from './AssessmentNode';
import { InitiativeNode } from './InitiativeNode';
import { InsightNode } from './InsightNode';
import { OpportunityNode } from './OpportunityNode';
import { PainPointNode } from './PainPointNode';
import { QuoteNode } from './QuoteNode';
import { RecommendationNode } from './RecommendationNode';
import { ToolNode } from './ToolNode';

// Re-export Discovery nodes
export { AssessmentNode } from './AssessmentNode';
export { InitiativeNode } from './InitiativeNode';
export { InsightNode } from './InsightNode';
export { OpportunityNode } from './OpportunityNode';
export { PainPointNode } from './PainPointNode';
export { QuoteNode } from './QuoteNode';
export { RecommendationNode } from './RecommendationNode';
export { ToolNode } from './ToolNode';

// Re-export shared diagram nodes
export {
  DecisionNode,
  MindmapNode,
  ProcessStepNode,
  StartEndNode,
  TextNode,
} from '@/components/shared/DiagramNodes';

// Combined node types map for React Flow
export const discoveryNodeTypes = {
  // Discovery-specific nodes
  painPoint: PainPointNode,
  insight: InsightNode,
  opportunity: OpportunityNode,
  quote: QuoteNode,
  recommendation: RecommendationNode,
  tool: ToolNode,
  assessment: AssessmentNode,
  initiative: InitiativeNode,

  // Diagram nodes (from Studio integration)
  processStep: ProcessStepNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
  mindmap: MindmapNode,
  textNode: TextNode,
};
