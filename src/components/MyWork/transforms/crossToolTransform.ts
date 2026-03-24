/**
 * crossToolTransform — Mapping functions between workspace tool data formats.
 *
 * Used when converting selected items from one tool to another via
 * `xform_to_*_execute` events dispatched by IdeaMapWorkspace.
 */
import type { Edge, Node } from 'reactflow';

import type { CanvasToolType } from '../ideaSelectionTypes';

export interface TransformInput {
  sourceTool: CanvasToolType;
  nodes: Node[];
  edges: Edge[];
  selectedIds: string[];
}

export interface TransformTrace {
  sourceNodeId: string;
  sourceTool: CanvasToolType;
  sourceBranchKey?: string;
  sourceStatus?: string;
  sourceTags?: string[];
  evidenceCount: number;
  artifactLinkCount: number;
}

export interface MindMapOutput {
  nodes: Node[];
  edges: Edge[];
}

export interface TableOutput {
  rows: Array<{
    id: string;
    label: string;
    type: string;
    sourceType: string;
    data: Record<string, unknown>;
  }>;
}

export interface WhiteboardOutput {
  nodes: Node[];
}

export interface ProcessFlowOutput {
  nodes: Node[];
  edges: Edge[];
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getSelectedNodes(input: TransformInput): Node[] {
  const idSet = new Set(input.selectedIds);
  return input.nodes.filter((n) => idSet.has(n.id));
}

function buildTrace(node: Node, sourceTool: CanvasToolType): TransformTrace {
  return {
    sourceNodeId: node.id,
    sourceTool,
    sourceBranchKey: typeof node.data?.branchKey === 'string' ? node.data.branchKey : undefined,
    sourceStatus: typeof node.data?.status === 'string' ? node.data.status : undefined,
    sourceTags: Array.isArray(node.data?.tags) ? node.data.tags.map((tag: any) => String(tag)) : [],
    evidenceCount: Array.isArray(node.data?.evidenceLinks) ? node.data.evidenceLinks.length : 0,
    artifactLinkCount: Array.isArray(node.data?.artifactLinks) ? node.data.artifactLinks.length : 0,
  };
}

/**
 * Convert selected items to Mind Map branches.
 * Each source node becomes a child of the root node.
 */
export function toMindMap(input: TransformInput): MindMapOutput {
  const selected = getSelectedNodes(input);
  if (selected.length === 0) return { nodes: [], edges: [] };

  const newNodes: Node[] = selected.map((n, i) => ({
    id: `xf-mm-${uid()}`,
    type: 'idea',
    position: { x: 250, y: 80 + i * 70 },
    data: {
      label: n.data?.label || `Item ${i + 1}`,
      branchKey: 'options',
      sourceType: `xform_${input.sourceTool}`,
      priority: 50,
      sourceTrace: buildTrace(n, input.sourceTool),
      artifactLinks: Array.isArray(n.data?.artifactLinks) ? n.data.artifactLinks : [],
      tags: Array.isArray(n.data?.tags) ? n.data.tags : [],
    },
  }));

  const newEdges: Edge[] = newNodes.map((n) => ({
    id: `xf-edge-${uid()}`,
    source: 'root',
    target: n.id,
    type: 'smoothstep',
    animated: true,
    data: { userCreated: true },
  }));

  return { nodes: newNodes, edges: newEdges };
}

/**
 * Convert selected items to Table rows.
 * Each source node becomes a row with mapped properties.
 */
export function toTable(input: TransformInput): TableOutput {
  const selected = getSelectedNodes(input);
  return {
    rows: selected.map((n) => ({
      id: `xf-row-${uid()}`,
      label: n.data?.label || '',
      type: n.type || 'default',
      sourceType: `xform_${input.sourceTool}`,
      data: {
        status: n.data?.status || 'backlog',
        priority: n.data?.priority,
        notes: n.data?.notes || n.data?.description || '',
        sourceNodeId: n.id,
        sourceTool: input.sourceTool,
        sourceTrace: buildTrace(n, input.sourceTool),
        artifactLinks: Array.isArray(n.data?.artifactLinks) ? n.data.artifactLinks : [],
        tags: Array.isArray(n.data?.tags) ? n.data.tags : [],
      },
    })),
  };
}

/**
 * Convert selected items to Whiteboard sticky notes in a grid layout.
 */
export function toWhiteboard(input: TransformInput): WhiteboardOutput {
  const selected = getSelectedNodes(input);
  const COLS = 4;
  const GAP_X = 200;
  const GAP_Y = 180;
  const START_X = 100;
  const START_Y = 100;

  const colors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

  const newNodes: Node[] = selected.map((n, i) => ({
    id: `xf-wb-${uid()}`,
    type: 'stickyNode',
    position: {
      x: START_X + (i % COLS) * GAP_X,
      y: START_Y + Math.floor(i / COLS) * GAP_Y,
    },
    data: {
      label: n.data?.label || `Item ${i + 1}`,
      color: colors[i % colors.length],
      sourceType: `xform_${input.sourceTool}`,
      sourceTrace: buildTrace(n, input.sourceTool),
      artifactLinks: Array.isArray(n.data?.artifactLinks) ? n.data.artifactLinks : [],
    },
  }));

  return { nodes: newNodes };
}

/**
 * Convert selected items to Process Flow action/decision nodes in a lane.
 */
export function toProcessFlow(input: TransformInput): ProcessFlowOutput {
  const selected = getSelectedNodes(input);
  const LANE_ID = 'lane-default';
  const START_X = 150;
  const GAP = 220;

  const newNodes: Node[] = [];
  const newEdges: Edge[] = [];

  if (selected.length > 0) {
    const startNode: Node = {
      id: `xf-pf-start-${uid()}`,
      type: 'flowNode',
      position: { x: START_X, y: 80 },
      data: {
        label: 'Start',
        shape: 'start',
        laneId: LANE_ID,
        laneColor: '#3b82f6',
      },
    };
    newNodes.push(startNode);

    selected.forEach((n, i) => {
      const nodeId = `xf-pf-${uid()}`;
      const isDecision = n.data?.shape === 'decision' || n.type === 'decision';
      newNodes.push({
        id: nodeId,
        type: 'flowNode',
        position: { x: START_X + (i + 1) * GAP, y: 80 },
        data: {
          label: n.data?.label || `Step ${i + 1}`,
          shape: isDecision ? 'decision' : 'action',
          laneId: LANE_ID,
          laneColor: '#3b82f6',
          sourceType: `xform_${input.sourceTool}`,
          sourceTrace: buildTrace(n, input.sourceTool),
          artifactLinks: Array.isArray(n.data?.artifactLinks) ? n.data.artifactLinks : [],
          tags: Array.isArray(n.data?.tags) ? n.data.tags : [],
        },
      });

      const prevId = i === 0 ? startNode.id : newNodes[newNodes.length - 2].id;
      newEdges.push({
        id: `xf-pf-edge-${uid()}`,
        source: prevId,
        target: nodeId,
        type: 'flowEdge',
        data: {},
      });
    });

    const endNode: Node = {
      id: `xf-pf-end-${uid()}`,
      type: 'flowNode',
      position: {
        x: START_X + (selected.length + 1) * GAP,
        y: 80,
      },
      data: {
        label: 'End',
        shape: 'end',
        laneId: LANE_ID,
        laneColor: '#3b82f6',
      },
    };
    newNodes.push(endNode);
    newEdges.push({
      id: `xf-pf-edge-end-${uid()}`,
      source: newNodes[newNodes.length - 2].id,
      target: endNode.id,
      type: 'flowEdge',
      data: {},
    });
  }

  return { nodes: newNodes, edges: newEdges };
}

/**
 * Dispatch the appropriate transform based on target tool.
 */
export function transformSelection(
  input: TransformInput,
  targetTool: CanvasToolType
):
  | { type: 'mindmap'; data: MindMapOutput }
  | { type: 'table'; data: TableOutput }
  | { type: 'whiteboard'; data: WhiteboardOutput }
  | { type: 'process_flow'; data: ProcessFlowOutput }
  | null {
  if (input.selectedIds.length === 0) return null;

  switch (targetTool) {
    case 'mindmap':
      return { type: 'mindmap', data: toMindMap(input) };
    case 'table':
      return { type: 'table', data: toTable(input) };
    case 'whiteboard':
      return { type: 'whiteboard', data: toWhiteboard(input) };
    case 'process_flow':
      return { type: 'process_flow', data: toProcessFlow(input) };
    default:
      return null;
  }
}
