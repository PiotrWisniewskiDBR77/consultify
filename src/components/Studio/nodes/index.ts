/**
 * Studio Node Types Export
 *
 * NOTE: These are Studio-specific variants of the diagram nodes.
 * Shared versions live in components/shared/DiagramNodes/ and are used by
 * Discovery Canvas + AI Chat Artifacts.
 *
 * Key differences preventing consolidation:
 *   - Styling: Studio uses dark-slate-canvas; shared uses light/dark theming
 *   - TextNode data shape: Studio uses `label` + color; shared uses `text` + typography
 *   - React Flow keys: Studio uses `mindmapNode`; shared uses `mindmap`
 *
 * Consolidation would require a theming prop or wrapper pattern
 * to share the core logic while varying appearance per surface.
 */

import { DecisionNode } from './DecisionNode';
import { MindmapNode } from './MindmapNode';
import { OrgUnitNode } from './OrgUnitNode';
import { ProcessStepNode } from './ProcessStepNode';
import { RACICell } from './RACICell';
import { StartEndNode } from './StartEndNode';
import { SwimLaneNode } from './SwimLaneNode';
import { TextNode } from './TextNode';

export {
  DecisionNode,
  MindmapNode,
  OrgUnitNode,
  ProcessStepNode,
  RACICell,
  StartEndNode,
  SwimLaneNode,
  TextNode,
};

/**
 * @deprecated Currently unused — StudioCanvas defines its own nodeTypes inline.
 * Remove after confirming no external consumers.
 */
export const nodeTypes = {
  processStep: ProcessStepNode,
  decision: DecisionNode,
  startEnd: StartEndNode,
  textNode: TextNode,
  mindmapNode: MindmapNode,
  raciCell: RACICell,
  orgUnit: OrgUnitNode,
  swimlane: SwimLaneNode,
};

// Node type definitions for TypeScript
export type StudioNodeType = keyof typeof nodeTypes;
