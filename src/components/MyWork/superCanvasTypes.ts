/**
 * SuperCanvas types — V5-IDEA-14
 *
 * Defines the unified type system for object-family coexistence on one canvas.
 * Per V5 SSOT §4.3: "The same idea may include, on one shared SuperCanvas,
 * a mind map on the left, workshop sticky clusters in the center,
 * a process flow below, a table block on the right."
 *
 * Per V5 SSOT §7: "The SuperCanvas is one shared spatial workspace
 * containing heterogeneous but compatible objects."
 */

export type ObjectFamily =
  | 'mindmap'
  | 'whiteboard'
  | 'process_flow'
  | 'table'
  | 'knowledge'
  | 'system';

export const OBJECT_FAMILY_LABELS: Record<ObjectFamily, { en: string; pl: string }> = {
  mindmap: { en: 'Recommendation map', pl: 'Mapa rekomendacji' },
  whiteboard: { en: 'Whiteboard', pl: 'Tablica' },
  process_flow: { en: 'Process Flow', pl: 'Przepływ procesu' },
  table: { en: 'Table', pl: 'Tabela' },
  knowledge: { en: 'Knowledge', pl: 'Wiedza' },
  system: { en: 'System', pl: 'System' },
};

export const OBJECT_FAMILY_ICONS: Record<ObjectFamily, string> = {
  mindmap: 'GitBranch',
  whiteboard: 'StickyNote',
  process_flow: 'Workflow',
  table: 'Table2',
  knowledge: 'BookOpen',
  system: 'Settings',
};

export const OBJECT_FAMILY_COLORS: Record<ObjectFamily, string> = {
  mindmap: 'text-amber-500',
  whiteboard: 'text-violet-500',
  process_flow: 'text-sky-500',
  table: 'text-emerald-500',
  knowledge: 'text-indigo-500',
  system: 'text-slate-500',
};

/**
 * Maps ReactFlow node.type to its owning object family.
 * Used to determine which family a node belongs to when rendering
 * mixed families on the SuperCanvas.
 */
export const NODE_TYPE_TO_FAMILY: Record<string, ObjectFamily> = {
  // Mind Map
  center: 'mindmap',
  branch: 'mindmap',
  idea: 'mindmap',

  // Whiteboard
  stickyNote: 'whiteboard',
  textBlock: 'whiteboard',
  groupNode: 'whiteboard',
  shapeNode: 'whiteboard',
  frameNode: 'whiteboard',
  imageNode: 'whiteboard',
  linkNode: 'whiteboard',
  iconNode: 'whiteboard',
  areaNode: 'whiteboard',
  tableBlockNode: 'whiteboard',
  themeCard: 'whiteboard',
  outcomeCard: 'whiteboard',
  decisionCard: 'whiteboard',
  actionCard: 'whiteboard',
  summaryCard: 'whiteboard',
  kpiBadge: 'whiteboard',
  scoreNode: 'whiteboard',
  progressNode: 'whiteboard',

  // Process Flow
  flowNode: 'process_flow',

  // Knowledge
  knowledgeCard: 'knowledge',
  noteCard: 'knowledge',
  evidenceCard: 'knowledge',

  // System
  pinnedIdeaCard: 'system',
  aiProposalBlock: 'system',
  outputBlock: 'system',
};

/**
 * Infer the object family of a node from its ReactFlow type and/or
 * the V5 `system` field on node data.
 */
export function getNodeFamily(node: { type?: string; data?: { system?: string } }): ObjectFamily {
  if (node.data?.system && node.data.system in OBJECT_FAMILY_LABELS) {
    return node.data.system as ObjectFamily;
  }
  if (node.type && node.type in NODE_TYPE_TO_FAMILY) {
    return NODE_TYPE_TO_FAMILY[node.type];
  }
  return 'mindmap';
}

/**
 * Filter nodes to only show specific object families.
 * Pass `null` or empty set to show all families (full SuperCanvas mode).
 */
export function filterNodesByFamily<T extends { type?: string; data?: { system?: string } }>(
  nodes: T[],
  visibleFamilies: Set<ObjectFamily> | null
): T[] {
  if (!visibleFamilies || visibleFamilies.size === 0) return nodes;
  return nodes.filter((n) => visibleFamilies.has(getNodeFamily(n)));
}

/**
 * Count nodes per object family.
 */
export function countNodesByFamily(
  nodes: Array<{ type?: string; data?: { system?: string } }>
): Record<ObjectFamily, number> {
  const counts: Record<ObjectFamily, number> = {
    mindmap: 0,
    whiteboard: 0,
    process_flow: 0,
    table: 0,
    knowledge: 0,
    system: 0,
  };
  for (const node of nodes) {
    const family = getNodeFamily(node);
    counts[family]++;
  }
  return counts;
}

export interface SuperCanvasViewState {
  visibleFamilies: ObjectFamily[] | null;
  focusMode: 'full' | 'system' | 'object';
  focusSystem?: ObjectFamily;
  focusObjectId?: string;
}

export const DEFAULT_SUPERCANVAS_VIEW: SuperCanvasViewState = {
  visibleFamilies: null,
  focusMode: 'full',
};
