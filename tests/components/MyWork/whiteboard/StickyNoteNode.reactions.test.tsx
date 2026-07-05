/**
 * B4 — StickyNoteNode wiring for emoji reactions.
 *
 * Exercises the real node component (not just the presentational
 * WhiteboardNodeReactions piece) the way IdeaWhiteboardTool actually wires it:
 * reactions/reactionsEnabled/currentUserId/onToggleReaction all arrive via
 * `data`, exactly as injected during hydrate/createNode. Mirrors the reactflow
 * mocking convention used by tests/unit/mywork/processflow-nodes.test.tsx
 * (mock Handle/Position, render the node directly with id/data/selected).
 */
/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

import { StickyNoteNode } from '../../../../src/components/MyWork/whiteboard/nodes/StickyNoteNode';

const ME = 'user-me';

function baseData(overrides: Record<string, unknown> = {}) {
  return {
    label: 'Idea',
    currentUserId: ME,
    reactionsEnabled: true,
    reactions: [] as Array<{ emoji: string; userId: string }>,
    ...overrides,
  };
}

describe('StickyNoteNode — reactions wiring (B4)', () => {
  it('does not render the reaction affordance/pills when reactionsEnabled is false', () => {
    render(
      <StickyNoteNode
        id="n1"
        selected
        data={baseData({
          reactionsEnabled: false,
          reactions: [{ emoji: '👍', userId: 'someone-else' }],
          onToggleReaction: vi.fn(),
        })}
      />
    );
    expect(screen.queryByTestId('wb-node-reactions')).toBeNull();
    expect(screen.queryByTestId('wb-reaction-pill-👍')).toBeNull();
  });

  it('does not render reactions when there is no active facilitation session (flag absent)', () => {
    render(
      <StickyNoteNode
        id="n1"
        selected
        data={baseData({ reactionsEnabled: undefined, onToggleReaction: vi.fn() })}
      />
    );
    expect(screen.queryByTestId('wb-node-reactions')).toBeNull();
  });

  it('adding a reaction: clicking the tray emoji calls onToggleReaction(nodeId, emoji) and the pill appears on the next render', () => {
    const onToggleReaction = vi.fn();
    const data = baseData({ onToggleReaction });

    const { rerender } = render(<StickyNoteNode id="node-42" selected data={data} />);

    fireEvent.click(screen.getByTestId('wb-reaction-toggle'));
    fireEvent.click(screen.getByTestId('wb-reaction-add-👍'));

    expect(onToggleReaction).toHaveBeenCalledWith('node-42', '👍');

    // Simulate the persisted round-trip: setNodes wrote the new reactions array
    // back onto node.data, IdeaWhiteboardTool re-renders StickyNoteNode with it.
    rerender(
      <StickyNoteNode
        id="node-42"
        selected
        data={{ ...data, reactions: [{ emoji: '👍', userId: ME }] }}
      />
    );

    const pill = screen.getByTestId('wb-reaction-pill-👍');
    expect(pill.textContent).toContain('👍');
    expect(pill.textContent).toContain('1');
  });

  it('toggling the same reaction again (same user) removes it', () => {
    const onToggleReaction = vi.fn();
    const data = baseData({
      reactions: [{ emoji: '👍', userId: ME }],
      onToggleReaction,
    });

    const { rerender } = render(<StickyNoteNode id="node-42" selected data={data} />);

    // Own pill is visible with count 1.
    expect(screen.getByTestId('wb-reaction-pill-👍').textContent).toContain('1');

    fireEvent.click(screen.getByTestId('wb-reaction-pill-👍'));
    expect(onToggleReaction).toHaveBeenCalledWith('node-42', '👍');

    // Simulate the persisted round-trip after the toggle removed the user's entry.
    rerender(<StickyNoteNode id="node-42" selected data={{ ...data, reactions: [] }} />);
    expect(screen.queryByTestId('wb-reaction-pill-👍')).toBeNull();
  });

  it('renders pills for reactions from other users even when reactionsEnabled is true and node is not selected', () => {
    render(
      <StickyNoteNode
        id="node-7"
        selected={false}
        data={baseData({
          reactions: [
            { emoji: '❤️', userId: 'someone-else' },
            { emoji: '❤️', userId: 'another-one' },
          ],
          onToggleReaction: vi.fn(),
        })}
      />
    );
    const pill = screen.getByTestId('wb-reaction-pill-❤️');
    expect(pill.textContent).toContain('❤️');
    expect(pill.textContent).toContain('2');
  });
});
