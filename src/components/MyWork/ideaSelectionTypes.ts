/**
 * Selection contract for Idea Workspace (V3 SSOT §3.4.2).
 *
 * Shared across all 4 canvas tools. The selection state drives
 * the Tools panel content (properties, quick actions, convert).
 */

export type CanvasToolType = 'mindmap' | 'process_flow' | 'table' | 'whiteboard';
export type CanvasBgPattern = 'dots' | 'grid' | 'lines' | 'blank';
export type MindMapInteractionMode = 'select' | 'pan' | 'connect';
export type MapStructureType =
  | 'mindmap'
  | 'org_chart'
  | 'tree_right'
  | 'fishbone'
  | 'timeline'
  | 'semantic';
export const IDEA_GRAPH_UPDATE_EVENT = 'idea-workspace-graph-update';
export const IDEA_GRAPH_SAVE_EVENT = 'idea-graph-save-requested';
export const IDEA_WORKSPACE_INSERT_EVENT = 'idea-workspace-insert';
export const IDEA_WORKSPACE_THEME_EVENT = 'idea-workspace-theme';
export const IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT = 'idea-workspace-flow-semantic';
export const IDEA_WORKSPACE_GOVERNANCE_EVENT = 'idea-workspace-governance';
export const IDEA_WORKSPACE_IMPORT_EVENT = 'idea-workspace-import-graph';

export type SelectionKind = 'none' | 'node' | 'edge' | 'lane' | 'row';

export interface IdeaWorkspaceSelection {
  type: SelectionKind;
  count: number;
  ids: string[];
  primaryId?: string;
  meta?: {
    nodeType?: string;
    shape?: string;
    color?: string;
    laneId?: string;
    laneName?: string;
    /** Real table column values for the selected row (FIX-3: IdeaElementInspector "Kolumna" tool section). */
    columns?: Array<{ key: string; label: string; value: unknown }>;
    label?: string;
    description?: string;
    owner?: string;
    semanticType?: string;
    duration?: string;
    durationUnit?: string;
    cost?: string;
    fteCount?: string;
    status?: string;
    tags?: string[];
    artifactRef?: string;
    attachments?: Array<{
      id: string;
      name: string;
      type: string;
      url?: string;
      size?: number;
      createdAt?: number;
    }>;
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
  data?: Record<string, unknown>;
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

export type CanvasGovernanceStatus = 'draft' | 'in_review' | 'approved' | 'changes_requested';

export interface CanvasGovernanceUpdate {
  status: CanvasGovernanceStatus;
  note?: string;
  actor?: string;
}

export interface CanvasGovernanceEntry {
  id: string;
  status: CanvasGovernanceStatus;
  note?: string;
  actor?: string;
  createdAt: string;
}

export interface AIProposalCitation {
  label: string;
  kind?: 'artifact' | 'node' | 'document' | 'note';
  ref?: string;
}

export interface CanvasAIReplayEntry {
  id: string;
  tool: string;
  generatorType: string;
  proposalIds: string[];
  rationale: string[];
  citations: AIProposalCitation[];
  acceptedAt: string;
}

export interface IdeaWorkspaceImportPayload {
  ideaId?: string;
  sourceFormat: 'drawio_xml' | 'bpmn_xml' | 'diagram_package';
  title?: string;
  nodes: any[];
  edges: any[];
  extensions?: Record<string, unknown>;
  mappingReport?: string[];
}

export interface AIProposal {
  id: string;
  type: 'graph_patch' | 'view_patch';
  rationale: string;
  confidence: number;
  citations?: AIProposalCitation[];
  maturity?: 'real' | 'partial' | 'scaffold' | 'missing' | 'out_of_scope';
  generatorStatus?: 'real' | 'partial' | 'cross-tool';
  targetTool?: CanvasToolType;
  focusNodeId?: string;
  resultSummary?: string;
  patch: {
    addNodes?: Array<{
      id: string;
      label: string;
      type?: string;
      position?: { x: number; y: number };
      data?: Record<string, unknown>;
    }>;
    addEdges?: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
      data?: Record<string, unknown>;
    }>;
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
