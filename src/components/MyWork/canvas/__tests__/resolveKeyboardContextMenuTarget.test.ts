/**
 * @vitest-environment jsdom
 *
 * CB-05/RB-042/RV-003 — pure resolution logic for the Shift+F10/"ContextMenu"
 * keyboard invocation. This is the exact function IdeaWhiteboardTool.tsx
 * calls from its keydown listener (imported, not reimplemented), so these
 * tests exercise the real production logic.
 */
import { describe, expect, it } from 'vitest';

import {
  isContextMenuKey,
  resolveKeyboardContextMenuTarget,
} from '../resolveKeyboardContextMenuTarget';

describe('isContextMenuKey', () => {
  it('recognizes the Windows "ContextMenu" key', () => {
    expect(isContextMenuKey({ key: 'ContextMenu', shiftKey: false })).toBe(true);
  });
  it('recognizes Shift+F10', () => {
    expect(isContextMenuKey({ key: 'F10', shiftKey: true })).toBe(true);
  });
  it('rejects plain F10 (no Shift)', () => {
    expect(isContextMenuKey({ key: 'F10', shiftKey: false })).toBe(false);
  });
  it('rejects unrelated keys', () => {
    expect(isContextMenuKey({ key: 'Enter', shiftKey: false })).toBe(false);
  });
});

function makeContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('resolveKeyboardContextMenuTarget', () => {
  it('resolves a node scope when focus is inside a .react-flow__node', () => {
    const container = makeContainer();
    container.innerHTML = `
      <div class="react-flow__pane" tabindex="0">
        <div class="react-flow__node" data-id="node-1" tabindex="0">
          <button class="inner-label">Sticky</button>
        </div>
      </div>
    `;
    const inner = container.querySelector('.inner-label') as HTMLElement;
    const result = resolveKeyboardContextMenuTarget(container, inner);
    expect(result?.kind).toBe('node');
    expect(result && result.kind === 'node' && result.nodeId).toBe('node-1');
    container.remove();
  });

  it('resolves an edge scope when focus is inside a .react-flow__edge', () => {
    const container = makeContainer();
    container.innerHTML = `
      <div class="react-flow__pane" tabindex="0">
        <g class="react-flow__edge" data-testid="rf__edge-e1-e2" tabindex="0"></g>
      </div>
    `;
    const edgeEl = container.querySelector('.react-flow__edge') as HTMLElement;
    const result = resolveKeyboardContextMenuTarget(container, edgeEl);
    expect(result?.kind).toBe('edge');
    expect(result && result.kind === 'edge' && result.edgeId).toBe('e1-e2');
    container.remove();
  });

  it('resolves a background scope when focus is on the pane itself', () => {
    const container = makeContainer();
    container.innerHTML = `<div class="react-flow__pane" tabindex="0"></div>`;
    const pane = container.querySelector('.react-flow__pane') as HTMLElement;
    const result = resolveKeyboardContextMenuTarget(container, pane);
    expect(result?.kind).toBe('background');
    container.remove();
  });

  it('resolves a background scope when focus is on the container region itself', () => {
    const container = makeContainer();
    const result = resolveKeyboardContextMenuTarget(container, container);
    expect(result?.kind).toBe('background');
    container.remove();
  });

  it('returns null when focus is outside the container entirely', () => {
    const container = makeContainer();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const result = resolveKeyboardContextMenuTarget(container, outside);
    expect(result).toBeNull();
    container.remove();
    outside.remove();
  });

  it('returns null when nothing is focused (null activeElement)', () => {
    const container = makeContainer();
    expect(resolveKeyboardContextMenuTarget(container, null)).toBeNull();
    container.remove();
  });
});
