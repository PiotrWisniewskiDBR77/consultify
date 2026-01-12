/**
 * Studio Node Types Export
 */

import { DecisionNode } from './DecisionNode';
import { MindmapNode } from './MindmapNode';
import { OrgUnitNode } from './OrgUnitNode';
import { ProcessStepNode } from './ProcessStepNode';
import { RACICell } from './RACICell';
import { StartEndNode } from './StartEndNode';
import { SwimLaneNode } from './SwimLaneNode';
import { TextNode } from './TextNode';

export { DecisionNode, MindmapNode, OrgUnitNode, ProcessStepNode, RACICell, StartEndNode, SwimLaneNode, TextNode };

// Node type mapping for React Flow
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
