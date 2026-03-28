import type { AIProposal, CanvasToolType } from './ideaSelectionTypes';

type RuntimeNode = Record<string, any>;
type RuntimeEdge = Record<string, any>;

export interface ApplyAIProposalRuntimeInput {
  proposals: AIProposal[];
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
  extensions: Record<string, unknown>;
  activeTool: CanvasToolType;
}

export interface ApplyAIProposalRuntimeResult {
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
  extensions: Record<string, unknown>;
  nextTool: CanvasToolType | null;
  focusObjectId: string | null;
}

function mergeExtensionValue(existing: unknown, next: unknown): unknown {
  if (
    existing &&
    next &&
    typeof existing === 'object' &&
    typeof next === 'object' &&
    !Array.isArray(existing) &&
    !Array.isArray(next)
  ) {
    return {
      ...(existing as Record<string, unknown>),
      ...(next as Record<string, unknown>),
    };
  }
  return next;
}

function normalizeAddNode(node: Record<string, any>): RuntimeNode {
  const data =
    node?.data && typeof node.data === 'object' && !Array.isArray(node.data)
      ? { ...node.data }
      : {};
  const parentId = node?.parentNode || node?.parentId || data.parentId;
  const normalized: RuntimeNode = {
    id: node.id,
    type: node.type || 'idea',
    data: { label: node.label, ...data },
    position: node.position || { x: 0, y: 0 },
  };
  if (node?.style) normalized.style = node.style;
  if (parentId) {
    normalized.parentNode = parentId;
    normalized.parentId = parentId;
    normalized.data = { ...normalized.data, parentId };
  }
  return normalized;
}

function createTableNodesFromRows(
  table: Record<string, any>,
  existingNodes: RuntimeNode[]
): RuntimeNode[] {
  const generatedRows = Array.isArray(table.generatedRowNodes) ? table.generatedRowNodes : [];
  if (generatedRows.length > 0) {
    const existingIds = new Set(existingNodes.map((node) => String(node?.id)));
    return generatedRows
      .filter((node: any) => node?.id && !existingIds.has(String(node.id)))
      .map((node: any) => normalizeAddNode(node));
  }

  const rows = Array.isArray(table.rows) ? table.rows : [];
  return rows.map((row: any, index: number) => {
    const cells = row?.cells && typeof row.cells === 'object' ? row.cells : {};
    const label =
      String(cells.title || cells.label || cells.name || Object.values(cells)[0] || '').trim() ||
      `Row ${index + 1}`;
    return {
      id: `table-row-${Date.now()}-${index}`,
      type: 'idea',
      position: { x: 120 + (index % 2) * 240, y: 120 + Math.floor(index / 2) * 160 },
      data: {
        label,
        ...cells,
        ...(row?.sourceNodeId ? { sourceNodeId: row.sourceNodeId } : {}),
      },
    };
  });
}

export function applyAIProposalRuntime({
  proposals,
  nodes: sourceNodes,
  edges: sourceEdges,
  extensions: sourceExtensions,
  activeTool,
}: ApplyAIProposalRuntimeInput): ApplyAIProposalRuntimeResult {
  let nodes = [...sourceNodes];
  let edges = [...sourceEdges];
  const extensions = { ...sourceExtensions };
  let nextTool: CanvasToolType | null = null;
  let focusObjectId: string | null = null;

  for (const proposal of proposals) {
    const patch = proposal.patch;
    if (!patch) continue;

    if (patch.removeNodeIds?.length) {
      const removeSet = new Set(patch.removeNodeIds.map((id) => String(id)));
      nodes = nodes.filter((node) => !removeSet.has(String(node?.id)));
    }
    if (patch.removeEdgeIds?.length) {
      const removeSet = new Set(patch.removeEdgeIds.map((id) => String(id)));
      edges = edges.filter((edge) => !removeSet.has(String(edge?.id)));
    }
    if (patch.addNodes?.length) {
      for (const node of patch.addNodes) {
        nodes.push(normalizeAddNode(node as Record<string, any>));
      }
    }
    if (patch.addEdges?.length) {
      for (const edge of patch.addEdges) {
        edges.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'default',
          data: { label: edge.label, ...(edge.data || {}) },
        });
      }
    }
    if (patch.updateNodes?.length) {
      for (const update of patch.updateNodes) {
        nodes = nodes.map((node) =>
          String(node?.id) === update.id
            ? {
                ...node,
                data: { ...(node.data || {}), ...(update.data || {}) },
              }
            : node
        );
      }
    }
    if (patch.moveNodes?.length) {
      for (const move of patch.moveNodes) {
        const hasParentOverride = Object.prototype.hasOwnProperty.call(move, 'parentId');
        nodes = nodes.map((node) => {
          if (String(node?.id) !== String(move.nodeId)) return node;
          const nextNode: RuntimeNode = {
            ...node,
            position: move.position || node.position,
            data: { ...(node.data || {}) },
          };
          if (hasParentOverride) {
            if (move.parentId) {
              nextNode.parentNode = move.parentId;
              nextNode.parentId = move.parentId;
              nextNode.data.parentId = move.parentId;
            } else {
              delete nextNode.parentNode;
              delete nextNode.parentId;
              delete nextNode.data.parentId;
            }
          }
          return nextNode;
        });
      }
    }
    if (
      patch.extensions &&
      typeof patch.extensions === 'object' &&
      !Array.isArray(patch.extensions)
    ) {
      for (const [key, value] of Object.entries(patch.extensions)) {
        const mergedValue = mergeExtensionValue(extensions[key], value);
        extensions[key] = mergedValue;
        if (key === 'table' && mergedValue && typeof mergedValue === 'object') {
          const tableValue = mergedValue as Record<string, any>;
          const generatedNodes = createTableNodesFromRows(tableValue, nodes);
          if (generatedNodes.length > 0) {
            nodes = [...nodes, ...generatedNodes];
            const generatedIds = generatedNodes.map((node) => node.id);
            extensions[key] = {
              ...tableValue,
              generatedRowNodes: generatedNodes,
              generatedRowIds: generatedIds,
              viewLayout: tableValue.viewLayout || 'table',
            };
          }
        }
      }
    }

    if (proposal.targetTool && proposal.targetTool !== activeTool) {
      nextTool = proposal.targetTool;
    }
    if (proposal.focusNodeId) {
      focusObjectId = proposal.focusNodeId;
    }
  }

  return {
    nodes,
    edges,
    extensions,
    nextTool,
    focusObjectId,
  };
}
