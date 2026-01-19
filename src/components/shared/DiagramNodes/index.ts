/**
 * Shared Diagram Node Components
 *
 * React Flow node types for diagrams across the application.
 * Used by: Discovery Canvas, AI Chat Artifacts, Strategic Diagrams
 */

import { DecisionNode } from './DecisionNode';
import { MindmapNode } from './MindmapNode';
// Process & Flow nodes
import { ProcessStepNode } from './ProcessStepNode';
import { StartEndNode } from './StartEndNode';
// Text & Annotations
import { TextNode } from './TextNode';

export { DecisionNode } from './DecisionNode';
export { MindmapNode } from './MindmapNode';
export { ProcessStepNode } from './ProcessStepNode';
export { StartEndNode } from './StartEndNode';
export { TextNode } from './TextNode';

// Node types map for React Flow
export const diagramNodeTypes = {
  processStep: ProcessStepNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
  mindmap: MindmapNode,
  textNode: TextNode,
};

// Re-export types
export type { DecisionData } from './DecisionNode';
export type { MindmapNodeData } from './MindmapNode';
export type { ProcessStepData } from './ProcessStepNode';
export type { StartEndData } from './StartEndNode';
export type { TextNodeData } from './TextNode';
