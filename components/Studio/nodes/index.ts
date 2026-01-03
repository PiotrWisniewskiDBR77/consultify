/**
 * Studio Node Types Export
 */

import { ProcessStepNode } from './ProcessStepNode';
import { DecisionNode } from './DecisionNode';
import { StartEndNode } from './StartEndNode';
import { TextNode } from './TextNode';
import { MindmapNode } from './MindmapNode';
import { RACICell } from './RACICell';
import { OrgUnitNode } from './OrgUnitNode';
import { SwimLaneNode } from './SwimLaneNode';

export { 
    ProcessStepNode, 
    DecisionNode, 
    StartEndNode, 
    TextNode, 
    MindmapNode, 
    RACICell, 
    OrgUnitNode, 
    SwimLaneNode 
};

// Node type mapping for React Flow
export const nodeTypes = {
    processStep: ProcessStepNode,
    decision: DecisionNode,
    startEnd: StartEndNode,
    textNode: TextNode,
    mindmapNode: MindmapNode,
    raciCell: RACICell,
    orgUnit: OrgUnitNode,
    swimlane: SwimLaneNode
};

// Node type definitions for TypeScript
export type StudioNodeType = keyof typeof nodeTypes;








