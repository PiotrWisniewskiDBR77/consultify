/**
 * Selection contract for Idea Workspace (V3 SSOT §3.4.2).
 *
 * Shared across all 4 canvas tools. The selection state drives
 * the Tools panel content (properties, quick actions, convert).
 */

export type CanvasToolType = 'mindmap' | 'process_flow' | 'table' | 'whiteboard';
export const IDEA_GRAPH_UPDATE_EVENT = 'idea-workspace-graph-update';
export const IDEA_GRAPH_SAVE_EVENT = 'idea-graph-save-requested';
export const IDEA_WORKSPACE_INSERT_EVENT = 'idea-workspace-insert';

export type SelectionKind = 'none' | 'node' | 'edge' | 'lane' | 'row';

export interface IdeaWorkspaceSelection {
  type: SelectionKind;
  count: number;
  ids: string[];
  primaryId?: string;
  meta?: {
    nodeType?: string;
    shape?: string;
    laneId?: string;
    label?: string;
    description?: string;
    owner?: string;
    duration?: string;
    durationUnit?: string;
    cost?: string;
    fteCount?: string;
    status?: string;
    tags?: string[];
    artifactRef?: string;
    attachments?: Array<{ id: string; name: string; type: string; url?: string; size?: number; createdAt?: number }>;
  };
}

export const EMPTY_SELECTION: IdeaWorkspaceSelection = {
  type: 'none',
  count: 0,
  ids: [],
};

export interface IdeaWorkspaceInsertItem {
  text?: string;
  label?: string;
  type?: string;
  anchorNodeId?: string;
  parentId?: string;
  position?: { x: number; y: number };
  color?: string;
}

export interface IdeaWorkspaceInsertDetail {
  ideaId?: string;
  items?: IdeaWorkspaceInsertItem[];
  anchorNodeId?: string;
  parentId?: string;
  position?: { x: number; y: number };
  nodeType?: string;
  label?: string;
  text?: string;
  color?: string;
}

export interface AIProposal {
  id: string;
  type: 'graph_patch' | 'view_patch';
  rationale: string;
  confidence: number;
  patch: {
    addNodes?: Array<{ id: string; label: string; type?: string; position?: { x: number; y: number }; data?: Record<string, unknown> }>;
    addEdges?: Array<{ id: string; source: string; target: string; label?: string; data?: Record<string, unknown> }>;
    removeNodeIds?: string[];
    removeEdgeIds?: string[];
    updateNodes?: Array<{ id: string; data: Record<string, unknown> }>;
    moveNodes?: Array<{
      nodeId: string;
      parentId?: string;
      position?: { x: number; y: number };
    }>;
    extensions?: Record<string, unknown>;
  };
  status: 'pending' | 'accepted' | 'rejected';
}

export interface AIProposalBatch {
  id: string;
  tool: string;
  generatorType: string;
  proposals: AIProposal[];
  createdAt: number;
}
