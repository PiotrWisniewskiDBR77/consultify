/**
 * resolveKeyboardContextMenuTarget — CB-05/RB-042/RV-003.
 *
 * Pure resolution logic for the Shift+F10 / "ContextMenu" key context-menu
 * invocation: given the canvas container and the currently-focused element,
 * decides whether a node, an edge, or the background should open, and where
 * to anchor it. Extracted out of IdeaWhiteboardTool.tsx's keydown listener
 * so the exact same logic that runs in production is what the tests below
 * exercise — no risk of the test harness quietly drifting from the real
 * wiring.
 */
export type KeyboardContextMenuTarget =
  | { kind: 'node'; nodeId: string; rect: DOMRect }
  | { kind: 'edge'; edgeId: string; rect: DOMRect }
  | { kind: 'background'; rect: DOMRect }
  | null;

export function isContextMenuKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey'>): boolean {
  return e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
}

export function resolveKeyboardContextMenuTarget(
  container: HTMLElement,
  active: HTMLElement | null
): KeyboardContextMenuTarget {
  if (!active || !container.contains(active)) return null;

  const nodeEl = active.closest<HTMLElement>('.react-flow__node[data-id]');
  if (nodeEl) {
    const nodeId = nodeEl.getAttribute('data-id');
    if (!nodeId) return null;
    return { kind: 'node', nodeId, rect: nodeEl.getBoundingClientRect() };
  }

  const edgeEl = active.closest<HTMLElement>('.react-flow__edge[data-testid^="rf__edge-"]');
  if (edgeEl) {
    const edgeId = edgeEl.getAttribute('data-testid')?.replace(/^rf__edge-/, '');
    if (!edgeId) return null;
    return { kind: 'edge', edgeId, rect: edgeEl.getBoundingClientRect() };
  }

  // Background: focus is somewhere in the canvas but not on a node/edge
  // (e.g. the pane itself, or the container's own region wrapper).
  if (active.classList.contains('react-flow__pane') || active === container) {
    return { kind: 'background', rect: container.getBoundingClientRect() };
  }

  return null;
}
