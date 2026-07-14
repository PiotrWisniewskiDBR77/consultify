import type { Edge, Node } from 'reactflow';

import i18n from '@/i18n';
import type { ArtifactLink } from '@/utils/artifactLinks';

export interface MindMapEvidenceLink {
  id: string;
  type: 'url' | 'artifact' | 'note';
  title: string;
  url?: string;
  artifactId?: string;
  addedAt?: string;
}

export interface MindMapAIHistoryEntry {
  timestamp: string;
  prompt: string;
  resultSummary: string;
}

export interface MindMapNodeStyle {
  shape?: string;
  branchKey?: string;
  priority?: number;
  color?: string;
  fillOpacity?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  bold?: boolean;
  semanticType?: 'topic' | 'hypothesis' | 'risk' | 'action' | 'decision' | 'option' | 'subtopic';
  locked?: boolean;
  branchTheme?: string;
  autoLayout?: boolean;
}

export interface MindMapNodeSemanticFields {
  notes?: string;
  status?: string;
  context?: string;
  goal?: string;
  rationale?: string;
  riskNote?: string;
  semanticType?: string;
  tags?: string[];
  evidenceLinks?: MindMapEvidenceLink[];
  artifactLinks?: ArtifactLink[];
  aiExpansionHistory?: MindMapAIHistoryEntry[];
}

const VALID_NODE_TYPES = [
  'center',
  'branch',
  'idea',
  'knowledgeCard',
  'noteCard',
  'evidenceCard',
] as const;

function getNodeDepth(nodeId: string, edges: Array<{ source: string; target: string }>): number {
  let depth = 0;
  let current = nodeId;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const parentEdge = edges.find((edge) => edge.target === current);
    if (!parentEdge) break;
    current = parentEdge.source;
    depth += 1;
  }
  return depth;
}

export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    )
  );
}

export function getNodeArtifactLinks(node: Node | null | undefined): ArtifactLink[] {
  if (!node) return [];
  if (Array.isArray(node.data?.artifactLinks)) return node.data.artifactLinks as ArtifactLink[];
  if (Array.isArray((node as any).artifactLinks))
    return (node as any).artifactLinks as ArtifactLink[];
  return [];
}

const DEPTH_HYDRATION_FIELDS = [
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
] as const;

function hydrateDepthFields(node: any): Record<string, unknown> {
  const data = node?.data || {};
  const payload = node?.payload || {};
  const result: Record<string, unknown> = {};
  for (const field of DEPTH_HYDRATION_FIELDS) {
    const val = data[field] ?? payload[field];
    if (val != null) result[field] = val;
  }
  return result;
}

export function normalizeMindMapNodes(
  nodes: any[],
  edges: Edge[],
  ideaTitle: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for call-site compatibility (molochs pass this positionally)
  isPolish: boolean
): Node[] {
  return nodes.map((node: any) => {
    const inferredType = VALID_NODE_TYPES.includes(node?.type)
      ? node.type
      : node?.id === 'root'
        ? 'center'
        : node?.id?.startsWith?.('branch-')
          ? 'branch'
          : 'idea';
    const mergedArtifactLinks = Array.isArray(node?.data?.artifactLinks)
      ? node.data.artifactLinks
      : Array.isArray(node?.artifactLinks)
        ? node.artifactLinks
        : Array.isArray(node?.payload?.artifactLinks)
          ? node.payload.artifactLinks
          : undefined;

    const depthFields = hydrateDepthFields(node);

    return {
      ...node,
      type: inferredType,
      data: {
        ...(node?.data || {}),
        ...depthFields,
        label:
          node?.id === 'root'
            ? ideaTitle || i18n.t('mindmap.nodeModel.myIdea')
            : (node?.data?.label ?? ''),
        hint: node?.id === 'root' ? i18n.t('mindmap.nodeModel.clickToEdit') : node?.data?.hint,
        branchKey: node?.data?.branchKey || 'uncategorized',
        _depth: getNodeDepth(node.id, edges),
        tags: sanitizeTags(depthFields.tags ?? node?.data?.tags),
        ...(mergedArtifactLinks ? { artifactLinks: mergedArtifactLinks } : {}),
      },
    };
  });
}

export function collectDescendantIds(nodeId: string, edges: Edge[]): string[] {
  const children = edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
  const all: string[] = [];
  for (const childId of children) {
    all.push(childId);
    all.push(...collectDescendantIds(childId, edges));
  }
  return all;
}

export function copyNodeStyle(node: Node | null | undefined): MindMapNodeStyle {
  if (!node) return {};
  const d = node.data;
  return {
    shape: typeof d?.shape === 'string' ? d.shape : undefined,
    branchKey: typeof d?.branchKey === 'string' ? d.branchKey : undefined,
    priority: typeof d?.priority === 'number' ? d.priority : undefined,
    color: typeof d?.color === 'string' ? d.color : undefined,
    fillOpacity: typeof d?.fillOpacity === 'number' ? d.fillOpacity : undefined,
    lineStyle: (['solid', 'dashed', 'dotted'] as const).includes(d?.lineStyle)
      ? d.lineStyle
      : undefined,
    fontSize: typeof d?.fontSize === 'number' ? d.fontSize : undefined,
    bold: typeof d?.bold === 'boolean' ? d.bold : undefined,
    semanticType:
      typeof d?.semanticType === 'string'
        ? (d.semanticType as MindMapNodeStyle['semanticType'])
        : undefined,
    locked: typeof d?.locked === 'boolean' ? d.locked : undefined,
    branchTheme: typeof d?.branchTheme === 'string' ? d.branchTheme : undefined,
    autoLayout: typeof d?.autoLayout === 'boolean' ? d.autoLayout : undefined,
  };
}

export function applyNodeStyle(node: Node, style: MindMapNodeStyle): Node {
  const patch: Record<string, unknown> = {};
  if (style.shape) patch.shape = style.shape;
  if (style.branchKey) patch.branchKey = style.branchKey;
  if (typeof style.priority === 'number') patch.priority = style.priority;
  if (style.color !== undefined) patch.color = style.color;
  if (typeof style.fillOpacity === 'number') patch.fillOpacity = style.fillOpacity;
  if (style.lineStyle) patch.lineStyle = style.lineStyle;
  if (typeof style.fontSize === 'number') patch.fontSize = style.fontSize;
  if (typeof style.bold === 'boolean') patch.bold = style.bold;
  if (style.semanticType) patch.semanticType = style.semanticType;
  if (typeof style.locked === 'boolean') patch.locked = style.locked;
  if (style.branchTheme) patch.branchTheme = style.branchTheme;
  if (typeof style.autoLayout === 'boolean') patch.autoLayout = style.autoLayout;
  return { ...node, data: { ...node.data, ...patch } };
}

/**
 * M06 Fala 3.2 — multi-select toolbar: apply the same style patch to every
 * node whose id is in `nodeIds`, leaving all other nodes referentially
 * unchanged (so callers can cheaply detect "nothing changed").
 * Pure function — no side effects, easy to unit-test in isolation from the
 * 6400-LOC IdeaRecommendationMap component.
 */
export function applyStyleToNodes(
  nodes: Node[],
  nodeIds: string[] | Set<string>,
  style: MindMapNodeStyle
): Node[] {
  const ids = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
  if (ids.size === 0) return nodes;
  return nodes.map((node) => (ids.has(node.id) ? applyNodeStyle(node, style) : node));
}

export function appendAIHistoryEntry(
  history: MindMapAIHistoryEntry[] | undefined,
  entry: MindMapAIHistoryEntry
): MindMapAIHistoryEntry[] {
  const next = Array.isArray(history) ? [...history, entry] : [entry];
  return next.slice(-12);
}
