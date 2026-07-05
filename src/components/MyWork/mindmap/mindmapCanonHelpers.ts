/**
 * P12 Mindmap Canon Helpers (frontend mirror)
 *
 * Pure functions copied from server/src/services/v8/mindmapCanon.ts
 * for use in the React frontend. These must stay in sync with the
 * server canon — any change there should be reflected here.
 */

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
 * Priority: parent -> nearest sibling -> root -> null.
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
 * Root at h1, children indented with dashes, depth = indent level.
 */
export function exportToMarkdown(
  nodes: ReadonlyArray<{ id: string; label?: string; parentId?: string | null }>
): string {
  const childrenMap = new Map<string | null, (typeof nodes)[number][]>();
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

export const P12_CALM_LOOP_RULES = {
  selectionAfterCreate: 'New node is selected and scrolled into view immediately after creation',
  selectionAfterMove: 'Moved/reparented node retains selection; viewport adjusts if needed',
  anchorAfterDelete:
    'After delete, selection anchors to parent; if parent deleted, nearest sibling; if none, root',
  cycleDetection:
    'Reparent to own descendant is blocked with explicit user-facing error; no silent reorder',
  collapsePreservesData:
    'Collapse hides subtree visually but never deletes data; expand restores full subtree',
  collapseStateVisible:
    'Collapsed state is indicated by a visual cue (chevron/badge) on the parent node',
  renameInPlace:
    'Rename activates inline editing on the selected node; Escape cancels, Enter confirms',
  rootConstraint:
    'A mindmap always has exactly one root; create_root is only valid on an empty canvas',
} as const;

export const P12_DEGRADED_SCENARIOS = [
  { scenario: 'Graph data fails to load', posture: 'Empty canvas with retry prompt' },
  { scenario: 'Concurrent edit conflict', posture: 'Conflict marker; editing paused' },
  { scenario: 'AI service unavailable', posture: 'AI button disabled with tooltip' },
  { scenario: 'Export fails', posture: 'Toast error; partial export not offered' },
  { scenario: 'Undo stack corrupted or empty', posture: 'Undo/redo buttons disabled' },
  { scenario: 'Cycle detected during reparent', posture: 'Operation blocked; error toast' },
  { scenario: 'Permission denied', posture: 'All mutation controls disabled; view-only badge' },
  {
    scenario: 'Graph exceeds size limit (>500 nodes)',
    posture: 'Warning banner; creation blocked',
  },
  { scenario: 'WebSocket disconnected', posture: 'Offline badge; local edits queued' },
] as const;

export const MAX_MINDMAP_NODES = 500;

/**
 * Anti-wipe guard predicate for the persistence/sync path.
 *
 * A mind map always contains at least the root node (root and branch nodes are
 * non-deletable — see useMindMapNodes.deleteSelected), so a save payload of 0
 * nodes is NEVER a legitimate user state. When we previously held a non-empty
 * graph, an empty payload is always a defect (crashed hydration transform,
 * remount race, or a bug feeding empty runtime nodes) and MUST NOT be persisted
 * — doing so silently destroys the user's map (regression class of 26a2a896ef).
 *
 * @param nextNodeCount        node count about to be synced
 * @param lastKnownNodeCount   last node count we accepted as legitimate
 * @returns true → BLOCK the sync (empty-wipe detected)
 */
export function isEmptyWipe(nextNodeCount: number, lastKnownNodeCount: number): boolean {
  return nextNodeCount === 0 && lastKnownNodeCount > 0;
}
