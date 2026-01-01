/**
 * Studio Node Types Export
 */

export { ProcessStepNode } from './ProcessStepNode';
export { DecisionNode } from './DecisionNode';
export { StartEndNode } from './StartEndNode';
export { TextNode } from './TextNode';
export { MindmapNode } from './MindmapNode';
export { RACICell } from './RACICell';
export { OrgUnitNode } from './OrgUnitNode';
export { SwimLaneNode } from './SwimLaneNode';

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

