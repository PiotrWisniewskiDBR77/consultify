/**
 * IdeaWorkspaceGraph validators — V5-IDEA-10
 * Canonical schema per docs/product/IDEA_WORKSPACE_V5_SSOT.md §18
 *
 * Schema version history:
 *   v2 — V3/V4 graph model (nodes, edges, extensions, preferredTool)
 *   v3 — V5 SuperCanvas model (adds system, artifactLinks, surfaceState,
 *         knowledgeRefs, outputLinks, IdeaStage, IdeaWorkspaceDocument)
 */

import { z } from 'zod';

// ── V5 §18.3: Node system enum ─────────────────────────────────────────────
export const NodeSystemEnum = z.enum([
  'mindmap',
  'whiteboard',
  'process_flow',
  'table',
  'knowledge',
  'system',
]);

export const NodeKindEnum = z.enum([
  // mind map
  'topic',
  'subtopic',
  'hypothesis',
  'option',
  'risk',
  'action',
  'decision_point',
  // whiteboard
  'sticky',
  'text',
  'shape',
  'frame',
  'image',
  'drawing',
  // process / system flow
  'step',
  'decision',
  'document',
  'data',
  'system_block',
  'handoff',
  'lane',
  'vsm_object',
  // table
  'table_block',
  'row',
  'column',
  'view_def',
  // knowledge
  'knowledge_card',
  'note_card',
  'evidence_card',
  'linked_artifact_card',
  // system objects
  'pinned_idea_card',
  'ai_proposal_block',
  'output_block',
  // legacy compat
  'note',
  'artifact_ref',
  'link',
  'cluster',
  'outcome',
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

export const PreferredToolEnum = z.enum(['mindmap', 'process_flow', 'table', 'whiteboard']);

// ── V5 §9.3: Idea stage model ──────────────────────────────────────────────
export const IdeaStageEnum = z.enum([
  'spark',
  'framing',
  'exploring',
  'structuring',
  'validating',
  'ready_to_convert',
  'converted',
]);

/** Closed wire set accepted by the legacy Idea record route and the V5 workspace.
 * This validates representation only; it deliberately does not invent maturity
 * thresholds or decide which business gate authorizes a transition. */
export const GovernedIdeaStageEnum = z.enum([
  'seed',
  'idea',
  'spark',
  'explore',
  'incubating',
  'shaping',
  'ready',
  'promoted',
  'framing',
  'exploring',
  'structuring',
  'validating',
  'validated',
  'ready_to_convert',
  'converted',
]);

export const IdeaMaturityAttestationSchema = z.object({
  criterionId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9_.:-]+$/),
  met: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

// ── V5 §18.3: Artifact link on a workspace object ──────────────────────────
export const ArtifactLinkRoleEnum = z.enum(['context', 'source', 'output', 'evidence', 'related']);

export const ArtifactLinkSchema = z.object({
  artifactRef: z.object({ type: z.string(), id: z.string() }),
  artifactIndex: z.string().optional(),
  label: z.string().optional(),
  linkRole: ArtifactLinkRoleEnum.optional(),
  pinned: z.boolean().optional(),
});

// ── V5-IDEA-32: Workspace object attachment contract ────────────────────────
export const WorkspaceObjectTypeEnum = z.enum([
  'node',
  'sticky',
  'cluster',
  'frame',
  'step',
  'lane',
  'vsm_block',
  'table',
  'row',
  'knowledge_card',
  'idea_card',
]);

export const WorkspaceObjectRefSchema = z.object({
  workspaceType: z.literal('idea_workspace'),
  workspaceId: z.string(),
  objectType: WorkspaceObjectTypeEnum,
  objectId: z.string(),
});

export type WorkspaceObjectRef = z.infer<typeof WorkspaceObjectRefSchema>;

export const ObjectAttachmentSchema = z.object({
  objectRef: WorkspaceObjectRefSchema,
  artifactLink: ArtifactLinkSchema,
  attachedAt: z.string().optional(),
  attachedBy: z.string().optional(),
});

export type ObjectAttachment = z.infer<typeof ObjectAttachmentSchema>;

// ── Node schema (V5-extended, backward-compatible) ──────────────────────────
export const CanonicalNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: NodeKindEnum,
    system: NodeSystemEnum.optional(),
    label: z.string().optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    parentId: z.string().optional(),
    artifactRef: z
      .object({
        type: z.string(),
        id: z.string(),
      })
      .optional(),
    artifactLinks: z.array(ArtifactLinkSchema).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    style: z.record(z.string(), z.unknown()).optional(),
    aiMeta: z.record(z.string(), z.unknown()).optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

// ── Edge schema ─────────────────────────────────────────────────────────────
export const CanonicalEdgeSchema = z
  .object({
    id: z.string().min(1),
    fromNodeId: z.string(),
    toNodeId: z.string(),
    relationType: RelationTypeEnum.optional(),
    label: z.string().optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
    source: z.string().optional(),
    target: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

// ── Graph schema (v2/v3 compatible) ─────────────────────────────────────────
export const IdeaWorkspaceGraphSchema = z.object({
  nodes: z.array(CanonicalNodeSchema),
  edges: z.array(CanonicalEdgeSchema),
  extensions: z.record(z.string(), z.unknown()).optional(),
  preferredTool: PreferredToolEnum.nullable().optional(),
  schemaVersion: z.number().optional().default(3),
});

// ── V5 §18.2: Full workspace document (superset of graph) ──────────────────
export const SurfaceStateSchema = z
  .object({
    viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
    focusMode: z.enum(['full', 'system', 'object']).optional(),
    focusSystem: NodeSystemEnum.optional(),
    focusObjectId: z.string().optional(),
  })
  .optional();

export const IdeaWorkspaceDocumentSchema = z.object({
  ideaId: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  stage: IdeaStageEnum.optional(),
  preferredSystem: PreferredToolEnum.nullable().optional(),
  nodes: z.array(CanonicalNodeSchema),
  edges: z.array(CanonicalEdgeSchema),
  extensions: z.record(z.string(), z.unknown()).optional(),
  surfaceState: SurfaceStateSchema,
  selectionState: z.record(z.string(), z.unknown()).optional(),
  knowledgeRefs: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
        label: z.string().optional(),
      })
    )
    .optional(),
  outputLinks: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
        label: z.string().optional(),
        linkRole: ArtifactLinkRoleEnum.optional(),
      })
    )
    .optional(),
  schemaVersion: z.number().optional().default(3),
});

export type CanonicalNode = z.infer<typeof CanonicalNodeSchema>;
export type CanonicalEdge = z.infer<typeof CanonicalEdgeSchema>;
export type IdeaWorkspaceGraph = z.infer<typeof IdeaWorkspaceGraphSchema>;
export type IdeaWorkspaceDocument = z.infer<typeof IdeaWorkspaceDocumentSchema>;
export type ArtifactLink = z.infer<typeof ArtifactLinkSchema>;
export type IdeaStage = z.infer<typeof IdeaStageEnum>;
export type NodeSystem = z.infer<typeof NodeSystemEnum>;

// --- Legacy compat aliases (referenced by existing code) ---
export const IdeaWorkspaceNodeSchema = CanonicalNodeSchema;
export const IdeaWorkspaceEdgeSchema = CanonicalEdgeSchema;
export type IdeaWorkspaceNode = CanonicalNode;
export type IdeaWorkspaceEdge = CanonicalEdge;

export function normalizeNodeForStorage(node: any): CanonicalNode {
  const kind = node.kind ?? node.type ?? node.data?.kind ?? node.data?.type ?? 'topic';
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

  const system = node.system ?? node.data?.system;
  if (system && NodeSystemEnum.safeParse(system).success) result.system = system;

  const resolvedArtifactLinks =
    Array.isArray(node.artifactLinks) && node.artifactLinks.length > 0
      ? node.artifactLinks
      : Array.isArray(node.data?.artifactLinks) && node.data.artifactLinks.length > 0
        ? node.data.artifactLinks
        : null;
  if (resolvedArtifactLinks) {
    result.artifactLinks = resolvedArtifactLinks;
  }
  // V5-IDEA-18: Preserve depth model fields in payload
  const DEPTH_FIELDS = [
    'notes',
    'context',
    'goal',
    'rationale',
    'riskNote',
    'evidenceLinks',
    'semanticType',
    'status',
    'tags',
    'aiExpansionHistory',
  ];
  const dataPayload: Record<string, unknown> = {};
  const src = node.data || node;
  for (const f of DEPTH_FIELDS) {
    if (src[f] != null) dataPayload[f] = src[f];
  }
  const mergedPayload = {
    ...(node.payload && typeof node.payload === 'object' ? node.payload : {}),
    ...dataPayload,
  };
  if (Object.keys(mergedPayload).length > 0) result.payload = mergedPayload;

  if (node.style && typeof node.style === 'object') result.style = node.style;
  if (node.aiMeta && typeof node.aiMeta === 'object') result.aiMeta = node.aiMeta;
  if (node.extensions && typeof node.extensions === 'object') result.extensions = node.extensions;
  if (node.metadata && typeof node.metadata === 'object') result.metadata = node.metadata;

  // Preserve ReactFlow-specific fields for frontend round-trip
  if (node.data && typeof node.data === 'object') result.data = node.data;
  if (node.type && typeof node.type === 'string') result.type = node.type;
  if (typeof node.selected === 'boolean') result.selected = false;
  if (typeof node.dragging === 'boolean') result.dragging = false;

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
    // Preserve ReactFlow fields for frontend round-trip
    source: String(fromNodeId),
    target: String(toNodeId),
  };
  if (relationType && RelationTypeEnum.safeParse(relationType).success) {
    result.relationType = relationType;
  }
  // Preserve ReactFlow edge type (e.g. 'gradient', 'labeled') separately from relationType
  const rfType = edge.type;
  if (typeof rfType === 'string' && !RelationTypeEnum.safeParse(rfType).success) {
    result.type = rfType;
  }
  if (edge.label) result.label = edge.label;
  if (edge.extensions && typeof edge.extensions === 'object') result.extensions = edge.extensions;
  if (edge.data && typeof edge.data === 'object') result.data = edge.data;
  if (edge.style && typeof edge.style === 'object') result.style = edge.style;
  if (typeof edge.animated === 'boolean') result.animated = edge.animated;
  if (edge.sourceHandle) result.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle) result.targetHandle = edge.targetHandle;

  return result as CanonicalEdge;
}

export function validateAndNormalizeGraph(graph: {
  nodes: any[];
  edges: any[];
  extensions?: any;
  preferredTool?: string | null;
}): { valid: boolean; normalized: IdeaWorkspaceGraph; errors?: string[] } {
  const errors: string[] = [];

  const normalizedNodes = (Array.isArray(graph.nodes) ? graph.nodes : [])
    .map((n: any, i: number) => {
      try {
        return normalizeNodeForStorage(n);
      } catch (err: any) {
        errors.push(`node[${i}]: ${err?.message || 'invalid'}`);
        return null;
      }
    })
    .filter(Boolean) as CanonicalNode[];

  const normalizedEdges = (Array.isArray(graph.edges) ? graph.edges : [])
    .map((e: any, i: number) => {
      try {
        return normalizeEdgeForStorage(e);
      } catch (err: any) {
        errors.push(`edge[${i}]: ${err?.message || 'invalid'}`);
        return null;
      }
    })
    .filter(Boolean) as CanonicalEdge[];

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
    schemaVersion: 3,
  });

  if (!result.success) {
    const zodErrors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return {
      valid: false,
      normalized: { nodes: [], edges: [], extensions: {}, preferredTool: null, schemaVersion: 3 },
      errors: [...errors, ...zodErrors],
    };
  }

  if (errors.length > 0) {
    return { valid: true, normalized: result.data, errors };
  }

  return { valid: true, normalized: result.data };
}

// ── V5-IDEA-11: Compatibility adapter (v2 → v3) ────────────────────────────

const KIND_TO_SYSTEM: Record<string, z.infer<typeof NodeSystemEnum>> = {
  topic: 'mindmap',
  subtopic: 'mindmap',
  hypothesis: 'mindmap',
  option: 'mindmap',
  risk: 'mindmap',
  action: 'mindmap',
  decision_point: 'mindmap',
  sticky: 'whiteboard',
  text: 'whiteboard',
  shape: 'whiteboard',
  frame: 'whiteboard',
  image: 'whiteboard',
  drawing: 'whiteboard',
  cluster: 'whiteboard',
  outcome: 'whiteboard',
  step: 'process_flow',
  decision: 'process_flow',
  document: 'process_flow',
  data: 'process_flow',
  system_block: 'process_flow',
  handoff: 'process_flow',
  lane: 'process_flow',
  vsm_object: 'process_flow',
  table_block: 'table',
  row: 'table',
  column: 'table',
  view_def: 'table',
  knowledge_card: 'knowledge',
  note_card: 'knowledge',
  evidence_card: 'knowledge',
  linked_artifact_card: 'knowledge',
  note: 'knowledge',
  artifact_ref: 'knowledge',
  link: 'knowledge',
  pinned_idea_card: 'system',
  ai_proposal_block: 'system',
  output_block: 'system',
};

function inferSystemFromKind(kind: string): z.infer<typeof NodeSystemEnum> {
  return KIND_TO_SYSTEM[kind] || 'mindmap';
}

/**
 * Upgrade a v2 graph to v3 by inferring `system` on each node.
 * No-data-loss: all existing fields are preserved; only `system` and
 * `schemaVersion` are added/upgraded.
 */
export function upgradeGraphV2toV3(graph: IdeaWorkspaceGraph): IdeaWorkspaceGraph {
  const version = graph.schemaVersion ?? 2;
  if (version >= 3) return graph;

  const upgradedNodes = graph.nodes.map((node) => {
    if (node.system) return node;
    return { ...node, system: inferSystemFromKind(node.kind) };
  });

  return {
    ...graph,
    nodes: upgradedNodes,
    schemaVersion: 3,
  };
}

/**
 * Ensure a graph is at the latest schema version. Currently handles v2→v3.
 * Safe to call on already-upgraded graphs (idempotent).
 */
export function ensureLatestSchema(graph: IdeaWorkspaceGraph): IdeaWorkspaceGraph {
  return upgradeGraphV2toV3(graph);
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
