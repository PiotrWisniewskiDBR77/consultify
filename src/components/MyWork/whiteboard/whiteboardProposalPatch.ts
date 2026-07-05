/**
 * whiteboardProposalPatch — pure helpers for applying accepted AI proposal
 * patches (AIProposal.patch) to the whiteboard canvas.
 *
 * Whiteboard formatters (server ideaAIGeneratorService) emit patches with only
 * addNodes / addEdges / extensions / moveNodes keys (contract pinned in
 * tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts);
 * wb_name_clusters additionally emits updateNodes. These helpers keep that
 * apply-side logic testable without mounting the whiteboard component.
 * Only ever invoked for ACCEPTED proposals (whiteboardCanon AC-05: no silent apply).
 */

export type WbNodeKind =
  | 'sticky'
  | 'text'
  | 'group'
  | 'shape_rectangle'
  | 'shape_circle'
  | 'shape_diamond'
  | 'shape_hexagon'
  | 'frame'
  | 'image'
  | 'link'
  | 'kpi_badge'
  | 'score'
  | 'progress'
  | 'summary';

export const WB_NODE_KINDS: WbNodeKind[] = [
  'sticky',
  'text',
  'group',
  'shape_rectangle',
  'shape_circle',
  'shape_diamond',
  'shape_hexagon',
  'frame',
  'image',
  'link',
  'kpi_badge',
  'score',
  'progress',
  'summary',
];

export function isWbNodeKind(value: unknown): value is WbNodeKind {
  return typeof value === 'string' && WB_NODE_KINDS.includes(value as WbNodeKind);
}

/**
 * AI proposal patches carry runtime node types (backend formatters emit
 * 'stickyNote' / 'frameNode' / …; cross-tool patches emit 'idea' / 'branch' / 'leaf').
 * Normalize them to a WbNodeKind so accepted proposals render as real whiteboard
 * elements instead of falling through to the React Flow default node.
 */
const PROPOSAL_NODE_KIND_MAP: Record<string, WbNodeKind> = {
  stickyNote: 'sticky',
  textBlock: 'text',
  frameNode: 'frame',
  imageNode: 'image',
  linkNode: 'link',
  kpiBadge: 'kpi_badge',
  scoreNode: 'score',
  progressNode: 'progress',
  summaryCard: 'summary',
  // Cross-tool previews (wb_to_map_branches / wb_to_table) land as stickies on
  // the whiteboard — no tool switching; the proposal's resultSummary points on.
  idea: 'sticky',
  branch: 'sticky',
  leaf: 'sticky',
};

export function toWbNodeKind(value: unknown): WbNodeKind {
  if (isWbNodeKind(value)) return value;
  if (typeof value === 'string' && PROPOSAL_NODE_KIND_MAP[value]) {
    return PROPOSAL_NODE_KIND_MAP[value];
  }
  return 'sticky';
}

export interface ProposalEdgeInput {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

export interface ResolvedProposalEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

/**
 * Resolves proposal edges against the canvas: proposal node ids are remapped to
 * the freshly created canvas ids (idMap); endpoints that already exist on the
 * canvas pass through; edges with unresolvable endpoints are dropped.
 */
export function resolveProposalEdges(
  addEdges: ProposalEdgeInput[],
  idMap: Map<string, string>,
  existingIds: Set<string>,
  ts: number = Date.now()
): ResolvedProposalEdge[] {
  return addEdges
    .map((edge, index) => {
      const source =
        idMap.get(String(edge.source)) ||
        (existingIds.has(String(edge.source)) ? String(edge.source) : null);
      const target =
        idMap.get(String(edge.target)) ||
        (existingIds.has(String(edge.target)) ? String(edge.target) : null);
      if (!source || !target) return null;
      return {
        id: `wb-edge-${ts}-${index}`,
        source,
        target,
        ...(edge.label ? { label: edge.label } : {}),
      };
    })
    .filter((edge): edge is ResolvedProposalEdge => edge !== null);
}

interface NodeLike {
  id: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

/** wb_name_clusters: merge proposal data into existing nodes (keeps callbacks). */
export function applyProposalNodeUpdates<T extends NodeLike>(
  nodes: T[],
  updateNodes: Array<{ id: string; data: Record<string, unknown> }>
): T[] {
  if (!updateNodes.length) return nodes;
  const updates = new Map(updateNodes.map((u) => [String(u.id), u.data || {}]));
  return nodes.map((node) =>
    updates.has(node.id) ? { ...node, data: { ...node.data, ...updates.get(node.id) } } : node
  );
}

/** whiteboard_organize: reposition existing nodes from patch.moveNodes. */
export function applyProposalNodeMoves<T extends NodeLike>(
  nodes: T[],
  moveNodes: Array<{ nodeId: string; position?: { x: number; y: number } }>
): T[] {
  const moves = new Map(
    moveNodes
      .filter((m) => m.position)
      .map((m) => [String(m.nodeId), m.position as { x: number; y: number }])
  );
  if (!moves.size) return nodes;
  return nodes.map((node) =>
    moves.has(node.id) ? { ...node, position: moves.get(node.id)! } : node
  );
}
