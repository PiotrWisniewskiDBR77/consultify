import type { Edge, Node } from 'reactflow';

import type { WorkspacePanelKey } from '@/components/shared/WorkspacePanelStrip';

export type { WorkspacePanelKey };

export type WorkspaceSelection =
  | { kind: 'none' }
  | {
      kind: 'node';
      id: string;
      label?: string;
      meta?: Record<string, unknown>;
    }
  | {
      kind: 'edge';
      id: string;
      label?: string;
      meta?: Record<string, unknown>;
    };

export type WorkspaceAiProposalStatus = 'pending' | 'applied' | 'rejected';

export type WorkspaceAiProposal<TPayload = unknown> = {
  id: string;
  createdAt: number;
  title: string;
  rationale?: string | null;
  confidence?: number | null;
  source: 'mindmap_expand' | 'mindmap_assist' | 'processflow_generate' | 'whiteboard_cluster' | 'table_enrich' | 'user';
  status: WorkspaceAiProposalStatus;
  payload: TPayload;
};

export type MindmapGraphPatch = {
  add: { nodes: Node[]; edges: Edge[] };
  remove?: { nodeIds: string[]; edgeIds: string[] } | null;
  reorder?: { note?: string; order?: string[] } | null;
};

export type MindmapViewPatch = {
  // Keep this independent from React Flow public type exports (Viewport is not stable across versions).
  viewport?: { x: number; y: number; zoom: number } | null;
};
