/**
 * @vitest-environment jsdom
 *
 * CB-05 — accessible context-menu contract + destructive ordering for the
 * shared node/background canvas context menu (Whiteboard + Process Flow).
 *
 * Covers:
 * - RB-042/RV-003: role="menu" on the container, role="menuitem" on every
 *   action, ArrowDown/ArrowUp/Home/End roving focus, focus enters the menu on
 *   open and returns to the trigger on close.
 * - RB-043/RV-004: the destructive group (Delete) renders LAST, after the AI
 *   action group — never mid-menu ahead of it.
 * - RB-045: the node header falls back to a localized generic label, never
 *   the literal word "Node".
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaCanvasContextMenu } from '../IdeaCanvasContextMenu';

const baseProps = {
  ideaId: 'idea-1',
  activeTool: 'whiteboard' as const,
  title: 'Test idea',
  seedText: '',
  branch: '',
  area: '',
  graphNodes: [],
  graphEdges: [],
  isAccepted: true,
  onGenerateProposal: vi.fn(),
};

describe('IdeaCanvasContextMenu — accessible menu contract', () => {
  it('renders a role="menu" container with role="menuitem" actions', () => {
    render(
      <IdeaCanvasContextMenu
        {...baseProps}
        position={{ x: 10, y: 10 }}
        target={{ nodeId: 'n1', nodeLabel: 'My sticky', nodeType: 'sticky' }}
        onClose={() => {}}
      />
    );
    const menu = screen.getByRole('menu');
    expect(menu).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBeGreaterThan(0);
  });

  it('puts the destructive group (Delete) after every non-destructive and AI action, not before', () => {
    render(
      <IdeaCanvasContextMenu
        {...baseProps}
        position={{ x: 10, y: 10 }}
        target={{ nodeId: 'n1', nodeLabel: 'My sticky', nodeType: 'sticky' }}
        onClose={() => {}}
      />
    );
    const items = screen.getAllByRole('menuitem');
    const labels = items.map((el) => el.textContent || '');
    const deleteIdx = labels.findIndex((l) => /delete|usuń/i.test(l));
    expect(deleteIdx).toBeGreaterThan(-1);
    // Every OTHER item must come before it.
    expect(deleteIdx).toBe(items.length - 1);
  });

  it('falls back to a localized generic node type label, never the literal word "Node"', () => {
    render(
      <IdeaCanvasContextMenu
        {...baseProps}
        position={{ x: 10, y: 10 }}
        target={{ nodeId: 'n1', nodeLabel: 'Mystery item', nodeType: 'some_unmapped_type' }}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText('Node')).not.toBeInTheDocument();
    expect(screen.getByText('Element')).toBeInTheDocument();
  });

  it('ArrowDown moves roving focus between menuitems', () => {
    render(
      <IdeaCanvasContextMenu
        {...baseProps}
        position={{ x: 10, y: 10 }}
        target={{ nodeId: 'n1', nodeLabel: 'My sticky', nodeType: 'sticky' }}
        onClose={() => {}}
      />
    );
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    items[0].focus();

    // Real roving tabIndex, not just imperative .focus(): exactly one
    // menuitem is ever tabindex="0" — CB-05 code review requirement.
    const onlyZero = () => items.filter((el) => el.getAttribute('tabindex') === '0');
    expect(onlyZero()).toHaveLength(1);
    expect(onlyZero()[0]).toBe(items[0]);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    expect(onlyZero()).toHaveLength(1);
    expect(onlyZero()[0]).toBe(items[1]);

    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[items.length - 1]);
    expect(onlyZero()).toHaveLength(1);
    expect(onlyZero()[0]).toBe(items[items.length - 1]);

    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('returns focus to the trigger element when the menu closes', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <IdeaCanvasContextMenu
        {...baseProps}
        position={{ x: 10, y: 10 }}
        target={{ nodeId: 'n1', nodeLabel: 'My sticky', nodeType: 'sticky' }}
        onClose={() => {}}
      />
    );
    // Menu opened → focus moved into it (next animation frame).
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).not.toBe(trigger);

    // Close the menu (position=null → unmounts) → focus should return.
    rerender(
      <IdeaCanvasContextMenu
        {...baseProps}
        position={null}
        target={{ nodeId: 'n1', nodeLabel: 'My sticky', nodeType: 'sticky' }}
        onClose={() => {}}
      />
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
