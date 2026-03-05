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

export const IdeaWorkspaceNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  label: z.string().optional(),
  kind: NodeKindEnum.optional(),
  data: z.record(z.unknown()).optional(),
  artifactRef: z
    .object({
      type: z.string(),
      id: z.string(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  extensions: z.record(z.unknown()).optional(),
});

export const IdeaWorkspaceEdgeSchema = z.object({
  id: z.string().min(1),
  fromNodeId: z.string().optional(),
  toNodeId: z.string().optional(),
  source: z.string().optional(),
  target: z.string().optional(),
  relationType: z.string().optional(),
  label: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  extensions: z.record(z.unknown()).optional(),
});

export const IdeaWorkspaceGraphSchema = z.object({
  nodes: z.array(IdeaWorkspaceNodeSchema),
  edges: z.array(IdeaWorkspaceEdgeSchema),
  extensions: z.record(z.unknown()).optional(),
  preferredTool: z.string().nullable().optional(),
});

export type IdeaWorkspaceNode = z.infer<typeof IdeaWorkspaceNodeSchema>;
export type IdeaWorkspaceEdge = z.infer<typeof IdeaWorkspaceEdgeSchema>;
export type IdeaWorkspaceGraph = z.infer<typeof IdeaWorkspaceGraphSchema>;

/**
 * Normalize edge from ReactFlow format (source/target) to canonical (fromNodeId/toNodeId)
 */
export function normalizeGraphForStorage(graph: {
  nodes?: unknown[];
  edges?: unknown[];
  extensions?: Record<string, unknown>;
  preferredTool?: string | null;
}): IdeaWorkspaceGraph {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const normalizedEdges = edges.map((e: any) => ({
    id: e.id || `e-${e.source}-${e.target}`,
    fromNodeId: e.fromNodeId ?? e.source,
    toNodeId: e.toNodeId ?? e.target,
    source: e.source,
    target: e.target,
    relationType: e.relationType,
    label: e.label,
    data: e.data,
    extensions: e.extensions,
  }));
  const normalizedNodes = nodes.map((n: any) => ({
    id: n.id,
    title: n.title ?? n.data?.label,
    label: n.label ?? n.data?.label,
    kind: n.kind ?? n.data?.kind,
    data: n.data,
    artifactRef: n.artifactRef ?? n.data?.artifactRef,
    tags: n.tags ?? n.data?.tags,
    category: n.category ?? n.data?.category,
    extensions: n.extensions ?? n.data?.extensions ?? {},
  }));
  return IdeaWorkspaceGraphSchema.parse({
    nodes: normalizedNodes,
    edges: normalizedEdges,
    extensions: graph.extensions ?? {},
    preferredTool: graph.preferredTool ?? null,
  });
}
