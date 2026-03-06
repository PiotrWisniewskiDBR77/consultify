/**
 * IdeaWorkspaceGraph validators — V4-IDEA-01
 * Canonical schema per docs/product/IDEA_WORKSPACE_V3_SSOT.md
 */

import { z } from 'zod';

export const NodeKindEnum = z.enum([
  'topic',
  'step',
  'decision',
  'note',
  'artifact_ref',
  'sticky',
  'text',
  'shape',
  'frame',
  'image',
  'link',
  'cluster', // V4-IDEA-05: Workshop cluster (groups of stickies)
  'outcome', // V4-IDEA-05: Synthesized outcome from cluster
]);

export const RelationTypeEnum = z.enum([
  'depends_on',
  'supports',
  'blocks',
  'causes',
  'flow',
  'relation',
  'dependency',
]);

export const PreferredToolEnum = z.enum([
  'mindmap',
  'process_flow',
  'table',
  'whiteboard',
]);

export const CanonicalNodeSchema = z.object({
  id: z.string().min(1),
  kind: NodeKindEnum,
  label: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  parentId: z.string().optional(),
  artifactRef: z
    .object({
      type: z.string(),
      id: z.string(),
    })
    .optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const CanonicalEdgeSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  relationType: RelationTypeEnum.optional(),
  label: z.string().optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
});

export const IdeaWorkspaceGraphSchema = z.object({
  nodes: z.array(CanonicalNodeSchema),
  edges: z.array(CanonicalEdgeSchema),
  extensions: z.record(z.string(), z.unknown()).optional(),
  preferredTool: PreferredToolEnum.nullable().optional(),
  schemaVersion: z.number().optional().default(2),
});

export type CanonicalNode = z.infer<typeof CanonicalNodeSchema>;
export type CanonicalEdge = z.infer<typeof CanonicalEdgeSchema>;
export type IdeaWorkspaceGraph = z.infer<typeof IdeaWorkspaceGraphSchema>;

// --- Legacy compat aliases (referenced by existing code) ---
export const IdeaWorkspaceNodeSchema = CanonicalNodeSchema;
export const IdeaWorkspaceEdgeSchema = CanonicalEdgeSchema;
export type IdeaWorkspaceNode = CanonicalNode;
export type IdeaWorkspaceEdge = CanonicalEdge;

export function normalizeNodeForStorage(node: any): CanonicalNode {
  const kind =
    node.kind ?? node.type ?? node.data?.kind ?? node.data?.type ?? 'topic';
  const label = node.label ?? node.data?.label ?? node.data?.title ?? '';
  const artifactRef = node.artifactRef ?? node.data?.artifactRef ?? undefined;

  let position: { x: number; y: number } | undefined;
  if (node.position && typeof node.position.x === 'number') {
    position = { x: node.position.x, y: node.position.y };
  } else if (typeof node.x === 'number' && typeof node.y === 'number') {
    position = { x: node.x, y: node.y };
  }

  const result: any = { id: String(node.id) };
  result.kind = NodeKindEnum.safeParse(kind).success ? kind : 'topic';
  if (label) result.label = label;
  if (position) result.position = position;
  if (node.parentId) result.parentId = String(node.parentId);
  if (artifactRef) result.artifactRef = artifactRef;
  if (node.extensions && typeof node.extensions === 'object') result.extensions = node.extensions;
  if (node.metadata && typeof node.metadata === 'object') result.metadata = node.metadata;

  return result as CanonicalNode;
}

export function normalizeEdgeForStorage(edge: any): CanonicalEdge {
  const fromNodeId = edge.fromNodeId ?? edge.source ?? edge.sourceId;
  const toNodeId = edge.toNodeId ?? edge.target ?? edge.targetId;
  const relationType = edge.relationType ?? edge.type ?? undefined;

  const result: any = {
    id: String(edge.id || `e-${fromNodeId}-${toNodeId}`),
    fromNodeId: String(fromNodeId),
    toNodeId: String(toNodeId),
  };
  if (relationType && RelationTypeEnum.safeParse(relationType).success) {
    result.relationType = relationType;
  }
  if (edge.label) result.label = edge.label;
  if (edge.extensions && typeof edge.extensions === 'object') result.extensions = edge.extensions;

  return result as CanonicalEdge;
}

export function validateAndNormalizeGraph(graph: {
  nodes: any[];
  edges: any[];
  extensions?: any;
  preferredTool?: string | null;
}): { valid: boolean; normalized: IdeaWorkspaceGraph; errors?: string[] } {
  const errors: string[] = [];

  const normalizedNodes = (Array.isArray(graph.nodes) ? graph.nodes : []).map(
    (n: any, i: number) => {
      try {
        return normalizeNodeForStorage(n);
      } catch (err: any) {
        errors.push(`node[${i}]: ${err?.message || 'invalid'}`);
        return null;
      }
    }
  ).filter(Boolean) as CanonicalNode[];

  const normalizedEdges = (Array.isArray(graph.edges) ? graph.edges : []).map(
    (e: any, i: number) => {
      try {
        return normalizeEdgeForStorage(e);
      } catch (err: any) {
        errors.push(`edge[${i}]: ${err?.message || 'invalid'}`);
        return null;
      }
    }
  ).filter(Boolean) as CanonicalEdge[];

  const preferredToolRaw = graph.preferredTool ?? null;
  const preferredTool = PreferredToolEnum.safeParse(preferredToolRaw).success
    ? (preferredToolRaw as z.infer<typeof PreferredToolEnum>)
    : null;

  const extensions =
    graph.extensions && typeof graph.extensions === 'object' && !Array.isArray(graph.extensions)
      ? graph.extensions
      : {};

  const result = IdeaWorkspaceGraphSchema.safeParse({
    nodes: normalizedNodes,
    edges: normalizedEdges,
    extensions,
    preferredTool,
    schemaVersion: 2,
  });

  if (!result.success) {
    const zodErrors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return {
      valid: false,
      normalized: { nodes: [], edges: [], extensions: {}, preferredTool: null, schemaVersion: 2 },
      errors: [...errors, ...zodErrors],
    };
  }

  if (errors.length > 0) {
    return { valid: true, normalized: result.data, errors };
  }

  return { valid: true, normalized: result.data };
}

/**
 * @deprecated Use validateAndNormalizeGraph instead. Kept for backward compatibility.
 */
export function normalizeGraphForStorage(graph: {
  nodes?: unknown[];
  edges?: unknown[];
  extensions?: Record<string, unknown>;
  preferredTool?: string | null;
}): IdeaWorkspaceGraph {
  const { normalized, errors } = validateAndNormalizeGraph({
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    extensions: graph.extensions ?? {},
    preferredTool: graph.preferredTool ?? null,
  });
  if (errors?.length) {
    const zodErr = new z.ZodError(
      errors.map((msg) => ({
        code: 'custom' as const,
        path: [],
        message: msg,
      }))
    );
    throw zodErr;
  }
  return normalized;
}
