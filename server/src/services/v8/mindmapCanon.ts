/**
 * P12 Mindmap Canon
 * Frozen acceptance checklist + calm interaction rules from §2.3.10
 *
 * Canonical source for mindmap node operations, selection/focus rules,
 * collapse/expand state, undo/redo posture, export formats,
 * AI co-building contract, and degraded posture scenarios.
 *
 * Infrastructure consumed:
 *   - toolCollaborationAdapter.ts (ToolName = 'mind_map')
 *   - multiplayerHardening.ts (Surface = 'mindmap')
 *   - ideaWorkspaceGraph.validators.ts (NodeKindEnum mindmap kinds)
 */

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Node operations (P0 canonical set)
// ────────────────────────────────────────────────────────────────

export const P12_NODE_OPERATIONS = [
  'create_root',
  'add_child',
  'add_sibling',
  'rename',
  'move',
  'delete',
  'collapse',
  'expand',
] as const;

export type MindmapNodeOperation = (typeof P12_NODE_OPERATIONS)[number];

export const P12_NODE_KINDS = [
  'topic',
  'subtopic',
  'hypothesis',
  'option',
  'risk',
  'action',
  'decision_point',
] as const;

export type MindmapNodeKind = (typeof P12_NODE_KINDS)[number];

// ────────────────────────────────────────────────────────────────
// §2.3.10 — CALM loop rules (selection, focus, cycle detection)
// ────────────────────────────────────────────────────────────────

export const P12_CALM_LOOP_RULES = {
  selectionAfterCreate: 'New node is selected and scrolled into view immediately after creation',
  selectionAfterMove: 'Moved/reparented node retains selection; viewport adjusts if needed',
  anchorAfterDelete: 'After delete, selection anchors to parent; if parent deleted, nearest sibling; if none, root',
  cycleDetection: 'Reparent to own descendant is blocked with explicit user-facing error; no silent reorder',
  collapsePreservesData: 'Collapse hides subtree visually but never deletes data; expand restores full subtree',
  collapseStateVisible: 'Collapsed state is indicated by a visual cue (chevron/badge) on the parent node',
  renameInPlace: 'Rename activates inline editing on the selected node; Escape cancels, Enter confirms',
  rootConstraint: 'A mindmap always has exactly one root; create_root is only valid on an empty canvas',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Export formats
// ────────────────────────────────────────────────────────────────

export const P12_EXPORT_FORMATS = ['json', 'markdown'] as const;

export type MindmapExportFormat = (typeof P12_EXPORT_FORMATS)[number];

export const P12_EXPORT_RULES = {
  json: 'Full graph serialization preserving hierarchy (parentId), node kinds, labels, positions, and metadata',
  markdown: 'Indented markdown outline: root at h1, children indented with dashes, depth = indent level',
  hierarchyPreserved: 'Both formats must preserve parent-child relationships without data loss',
  roundTrip: 'JSON export → import must produce identical graph (idempotent round-trip)',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — AI co-building contract
// ────────────────────────────────────────────────────────────────

export const P12_AI_COBUILDING_RULES = {
  previewDiff: 'AI-generated changes are shown as a visual diff overlay before application',
  explicitAcceptReject: 'User must explicitly accept or reject the AI proposal; no silent apply',
  undoableAsOneStep: 'Accepted AI proposal is recorded as a single undo step (atomic batch)',
  proposalVisibility: 'AI proposal starts as personal_draft per W4-7; shared only on explicit share',
  noSilentEdits: 'AI cannot modify the graph without going through the preview→accept flow',
  scopeBounded: 'AI proposals are bounded to the current subtree context; no cross-tree mutations',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Undo/Redo posture
// ────────────────────────────────────────────────────────────────

export const P12_UNDO_REDO_RULES = {
  allOperationsUndoable: 'Every P12_NODE_OPERATION is undoable/redoable',
  batchAI: 'AI accept is one undo step; AI reject does not push to undo stack',
  stackLimit: 'Undo stack depth is bounded (implementation-defined, minimum 50)',
  crossSessionPersist: 'Undo stack is NOT persisted across sessions (session-local only)',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Degraded posture (8+ scenarios)
// ────────────────────────────────────────────────────────────────

export const P12_DEGRADED_SCENARIOS: ReadonlyArray<{
  scenario: string;
  posture: string;
  recovery: string;
}> = [
  {
    scenario: 'Graph data fails to load (network/DB error)',
    posture: 'Empty canvas with retry prompt; no stale data shown',
    recovery: 'Retry button; exponential backoff; show last-known snapshot if available',
  },
  {
    scenario: 'Concurrent edit conflict (multiplayer)',
    posture: 'Conflict marker on affected nodes; editing paused on conflicting subtree',
    recovery: 'Manual merge or accept-theirs/accept-mine per node',
  },
  {
    scenario: 'AI service unavailable',
    posture: 'AI co-building button disabled with tooltip; manual editing unaffected',
    recovery: 'Automatic retry on service recovery; no degradation of core operations',
  },
  {
    scenario: 'Export fails (serialization error)',
    posture: 'Toast error with specific format; partial export not offered',
    recovery: 'Retry; if structural issue, suggest JSON export as fallback',
  },
  {
    scenario: 'Undo stack corrupted or empty',
    posture: 'Undo/redo buttons disabled; no silent data loss',
    recovery: 'Stack reset on next operation; version history as fallback',
  },
  {
    scenario: 'Cycle detected during reparent',
    posture: 'Operation blocked; node returns to original position; error toast',
    recovery: 'User selects a valid (non-descendant) target',
  },
  {
    scenario: 'Permission denied (read-only or locked artifact)',
    posture: 'All mutation controls disabled; view-only mode with explicit badge',
    recovery: 'Request access or wait for lock release',
  },
  {
    scenario: 'Graph exceeds size limit (>500 nodes)',
    posture: 'Warning banner; new node creation blocked; existing operations allowed',
    recovery: 'Archive or split subtrees; increase limit via admin setting',
  },
  {
    scenario: 'WebSocket disconnected (presence lost)',
    posture: 'Presence indicators stale; local edits queued; "offline" badge shown',
    recovery: 'Reconnect with queue-and-merge per offline policy',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.10 — Acceptance checklist (10 items)
// ────────────────────────────────────────────────────────────────

export const P12_ACCEPTANCE_CHECKLIST: ReadonlyArray<{
  id: string;
  requirement: string;
  testable: boolean;
}> = [
  { id: 'P12-AC-01', requirement: 'Create root + child + sibling via UI; graph state correct', testable: true },
  { id: 'P12-AC-02', requirement: 'New node selected and visible (scrolled into view) after creation', testable: true },
  { id: 'P12-AC-03', requirement: 'Move/reparent keeps selection on moved node', testable: true },
  { id: 'P12-AC-04', requirement: 'Collapse/expand subtree; collapsed state visually indicated', testable: true },
  { id: 'P12-AC-05', requirement: 'Collapse does not delete data; expand restores full subtree', testable: true },
  { id: 'P12-AC-06', requirement: 'Delete node deletes subtree; selection anchors to parent/sibling', testable: true },
  { id: 'P12-AC-07', requirement: 'Invalid reparent (cycle) blocked with user-facing error', testable: true },
  { id: 'P12-AC-08', requirement: 'Undo/redo works for all node operations', testable: true },
  { id: 'P12-AC-09', requirement: 'Export JSON/Markdown preserves hierarchy without data loss', testable: true },
  { id: 'P12-AC-10', requirement: 'AI co-building: preview diff shown, explicit accept/reject, undoable as one step', testable: true },
] as const;

// ────────────────────────────────────────────────────────────────
// Ownership boundary
// ────────────────────────────────────────────────────────────────

export const P12_OWNERSHIP = {
  owner: 'Mindmap Surface (IdeaWorkspace mindmap system)',
  consumers: ['IdeaWorkspace SuperCanvas', 'AI Co-building Pipeline', 'Export Service'],
  infrastructure: [
    'toolCollaborationAdapter.ts (mind_map)',
    'multiplayerHardening.ts (mindmap surface)',
    'ideaWorkspaceGraph.validators.ts (mindmap node kinds)',
    'ideaAIGeneratorService.ts (AI proposals)',
  ],
} as const;

// ────────────────────────────────────────────────────────────────
// Helpers — cycle detection
// ────────────────────────────────────────────────────────────────

/**
 * Detect if reparenting `nodeId` under `newParentId` would create a cycle.
 * Returns true if the move is INVALID (cycle detected).
 */
export function wouldCreateCycle(
  nodeId: string,
  newParentId: string,
  parentMap: ReadonlyMap<string, string | null>
): boolean {
  if (nodeId === newParentId) return true;
  let current: string | null | undefined = newParentId;
  const visited = new Set<string>();
  while (current != null) {
    if (current === nodeId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentMap.get(current) ?? null;
  }
  return false;
}

/**
 * Determine selection anchor after deleting a node.
 * Priority: parent → nearest sibling → root → null.
 */
export function resolveDeleteAnchor(
  deletedNodeId: string,
  parentId: string | null,
  siblingIds: readonly string[],
  rootId: string | null
): string | null {
  if (parentId && parentId !== deletedNodeId) return parentId;
  const sibling = siblingIds.find((id) => id !== deletedNodeId);
  if (sibling) return sibling;
  if (rootId && rootId !== deletedNodeId) return rootId;
  return null;
}

/**
 * Export mindmap graph as indented markdown.
 * Each level is indented with 2 spaces + dash prefix.
 */
export function exportToMarkdown(
  nodes: ReadonlyArray<{ id: string; label?: string; parentId?: string | null }>
): string {
  const childrenMap = new Map<string | null, typeof nodes[number][]>();
  for (const node of nodes) {
    const pid = node.parentId ?? null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(node);
  }

  const lines: string[] = [];

  function walk(parentId: string | null, depth: number): void {
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      const label = child.label || '(untitled)';
      if (depth === 0) {
        lines.push(`# ${label}`);
      } else {
        const indent = '  '.repeat(depth - 1);
        lines.push(`${indent}- ${label}`);
      }
      walk(child.id, depth + 1);
    }
  }

  walk(null, 0);
  return lines.join('\n');
}
