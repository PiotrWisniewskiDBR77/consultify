export type MindmapIntent =
  | 'blank_canvas'
  | 'expanding_branch'
  | 'editing_node'
  | 'reorganizing'
  | 'filling_template'
  | 'gap_analysis'
  | 'reviewing';

export interface SidekickContext {
  intent: MindmapIntent;
  promptHint: string;
  promptHintPl: string;
  suggestedActions: string[];
  focusNodeId?: string;
  focusBranchKey?: string;
}

/**
 * Payload dispatched on `idea-mindmap-sidekick-context` (window CustomEvent).
 * Extends the pure `SidekickContext` (intent/prompt-hint, computed by
 * `detectMindmapIntent`) with the minimal entity handle needed by chat
 * consumers to build/reuse an entity-scoped conversation — M06 Fala 2 §2.1.
 *
 * Decision: carry `ideaId`/`ideaTitle` only, NOT the serialized graph. The
 * graph still flows exclusively through `ideaMapToMarkdown` at the
 * "Discuss with Teresa" call site (IdeaMapWorkspace.handleDiscussWithTeresa).
 * Duplicating the graph into this high-frequency event (fires on every
 * node/edge/selection change) would be wasteful; entity-context consumers
 * only need to know WHICH idea is active, not its full contents.
 */
export interface SidekickContextEventDetail extends SidekickContext {
  ideaId?: string;
  ideaTitle?: string;
}

interface DetectParams {
  nodes: Array<{ id: string; data: any; type?: string }>;
  edges: Array<{ source: string; target: string }>;
  selectedNodeIds: string[];
  isEditing: boolean;
  hasTemplate: boolean;
  activeTool: string;
}

const PLACEHOLDER_RE = /^\[.*\]$|^\.{3}$|^$/;

function isBranchNode(nodeId: string, edges: Array<{ source: string; target: string }>): boolean {
  return edges.some((e) => e.source === nodeId);
}

export function detectMindmapIntent(params: DetectParams): SidekickContext {
  const { nodes, edges, selectedNodeIds, isEditing, hasTemplate } = params;

  const ideaNodes = nodes.filter((n) => n.type !== 'branchLabel' && n.type !== 'stickyNote');
  const nodeCount = ideaNodes.length;

  // 1. blank_canvas
  if (nodeCount <= 1) {
    return {
      intent: 'blank_canvas',
      promptHint: 'Help me brainstorm about this idea',
      promptHintPl: 'Pomóż mi przeprowadzić burzę mózgów',
      suggestedActions: ['mm_ai_expand', 'mm_ai_suggest'],
    };
  }

  // 2. editing_node
  if (isEditing && selectedNodeIds.length === 1) {
    const node = nodes.find((n) => n.id === selectedNodeIds[0]);
    return {
      intent: 'editing_node',
      promptHint: 'Help me refine this thought',
      promptHintPl: 'Pomóż mi doprecyzować tę myśl',
      suggestedActions: ['mm_ai_deepen', 'mm_ai_expand_node'],
      focusNodeId: selectedNodeIds[0],
      focusBranchKey: node?.data?.branchKey,
    };
  }

  // 3. expanding_branch
  if (selectedNodeIds.length === 1) {
    const node = nodes.find((n) => n.id === selectedNodeIds[0]);
    if (node && isBranchNode(node.id, edges)) {
      return {
        intent: 'expanding_branch',
        promptHint: 'Expand this branch with more ideas',
        promptHintPl: 'Rozwiń tę gałąź o więcej pomysłów',
        suggestedActions: ['mm_ai_expand_node', 'mm_ai_deepen', 'mm_ai_what_if'],
        focusNodeId: node.id,
        focusBranchKey: node.data?.branchKey,
      };
    }
  }

  // 4. filling_template
  if (hasTemplate) {
    const emptyCount = ideaNodes.filter(
      (n) => !n.data?.label || PLACEHOLDER_RE.test(String(n.data.label).trim())
    ).length;
    if (emptyCount >= 3 || emptyCount > nodeCount * 0.3) {
      return {
        intent: 'filling_template',
        promptHint: 'Help me fill in the template',
        promptHintPl: 'Pomóż mi wypełnić szablon',
        suggestedActions: ['mm_ai_expand', 'mm_ai_suggest'],
      };
    }
  }

  // 5. gap_analysis — map has content but some branches are thin
  if (nodeCount > 10) {
    const roots = edges.reduce<Record<string, number>>((acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + 1;
      return acc;
    }, {});
    const branchSizes = Object.values(roots);
    const hasThinBranch = branchSizes.some((c) => c <= 1);
    if (hasThinBranch) {
      return {
        intent: 'gap_analysis',
        promptHint: 'Find gaps in my thinking',
        promptHintPl: 'Znajdź luki w moim myśleniu',
        suggestedActions: ['mm_ai_gap_analysis', 'mm_ai_suggest', 'mm_ai_expand'],
      };
    }
  }

  // 6. reorganizing — multiple nodes selected
  if (selectedNodeIds.length > 3) {
    return {
      intent: 'reorganizing',
      promptHint: 'Help me reorganize these nodes',
      promptHintPl: 'Pomóż mi przeorganizować te węzły',
      suggestedActions: ['mm_ai_cluster', 'mm_ai_auto_connect'],
    };
  }

  // 7. reviewing — default
  return {
    intent: 'reviewing',
    promptHint: 'Review my map and suggest improvements',
    promptHintPl: 'Przejrzyj moją mapę i zasugeruj ulepszenia',
    suggestedActions: ['mm_ai_gap_analysis', 'mm_ai_summarize', 'mm_ai_cluster'],
  };
}
