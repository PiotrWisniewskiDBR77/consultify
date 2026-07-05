/**
 * B4 — whiteboard node emoji reactions.
 *
 * Covers the acceptance criteria for the (previously-dead) `reactionsEnabled`
 * flag now being live:
 *   1. adding a reaction updates the count and renders the pill;
 *   2. toggling the same reaction again by the same user removes it
 *      (toggle semantics = per (user,emoji): click adds, click again removes);
 *   3. reactions render nothing at all when `enabled` is false.
 *
 * The component is driven purely by props (reactions + toggle callback) exactly
 * as IdeaWhiteboardTool wires them onto node.data, so re-rendering with the
 * callback's new reactions array simulates the persisted setNodes round-trip.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WhiteboardNodeReactions } from '@/components/MyWork/whiteboard/nodes/WhiteboardNodeReactions';
import {
  summarizeReactions,
  toggleReaction,
  type WhiteboardReactionEntry,
} from '@/components/MyWork/whiteboard/whiteboardReactions';

const ME = 'user-me';
const OTHER = 'user-other';

describe('whiteboardReactions toggle semantics', () => {
  it('adds an entry when the user has not reacted with that emoji', () => {
    const next = toggleReaction([], '👍', ME);
    expect(next).toEqual([{ emoji: '👍', userId: ME }]);
  });

  it('removes only the same user + same emoji on repeat toggle', () => {
    const start: WhiteboardReactionEntry[] = [
      { emoji: '👍', userId: ME },
      { emoji: '👍', userId: OTHER },
      { emoji: '❤️', userId: ME },
    ];
    const next = toggleReaction(start, '👍', ME);
    expect(next).toEqual([
      { emoji: '👍', userId: OTHER },
      { emoji: '❤️', userId: ME },
    ]);
  });

  it('lets one user hold multiple distinct emoji on the same node', () => {
    let list: unknown = [];
    list = toggleReaction(list, '👍', ME);
    list = toggleReaction(list, '💡', ME);
    expect(summarizeReactions(list, ME).map((s) => s.emoji)).toEqual(['👍', '💡']);
  });

  it('summarizes counts per emoji and flags the current user', () => {
    const reactions: WhiteboardReactionEntry[] = [
      { emoji: '👍', userId: ME },
      { emoji: '👍', userId: OTHER },
      { emoji: '❓', userId: OTHER },
    ];
    const summary = summarizeReactions(reactions, ME);
    expect(summary).toEqual([
      { emoji: '👍', count: 2, reactedByMe: true },
      { emoji: '❓', count: 1, reactedByMe: false },
    ]);
  });
});

describe('WhiteboardNodeReactions component', () => {
  it('renders nothing when reactionsEnabled is false', () => {
    const { container } = render(
      <WhiteboardNodeReactions
        reactions={[{ emoji: '👍', userId: OTHER }]}
        currentUserId={ME}
        enabled={false}
        selected
        onToggle={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('wb-node-reactions')).toBeNull();
  });

  it('renders existing reaction pills with counts when enabled', () => {
    render(
      <WhiteboardNodeReactions
        reactions={[
          { emoji: '👍', userId: ME },
          { emoji: '👍', userId: OTHER },
        ]}
        currentUserId={ME}
        enabled
        onToggle={vi.fn()}
      />
    );
    const pill = screen.getByTestId('wb-reaction-pill-👍');
    expect(pill.textContent).toContain('👍');
    expect(pill.textContent).toContain('2');
    // No pills for emoji nobody used.
    expect(screen.queryByTestId('wb-reaction-pill-❤️')).toBeNull();
  });

  it('adds a reaction: opening the tray and clicking an emoji fires onToggle, count appears on re-render', () => {
    const onToggle = vi.fn();
    let reactions: unknown = [];
    const view = render(
      <WhiteboardNodeReactions
        reactions={reactions}
        currentUserId={ME}
        enabled
        selected
        onToggle={(emoji) => {
          reactions = toggleReaction(reactions, emoji, ME);
          onToggle(emoji);
        }}
      />
    );

    // No pills yet.
    expect(screen.queryByTestId('wb-reaction-pill-👍')).toBeNull();

    // Open tray (affordance is visible because selected), then react 👍.
    fireEvent.click(screen.getByTestId('wb-reaction-toggle'));
    fireEvent.click(screen.getByTestId('wb-reaction-add-👍'));
    expect(onToggle).toHaveBeenCalledWith('👍');

    // Re-render with the new persisted reactions (simulates setNodes round-trip).
    view.rerender(
      <WhiteboardNodeReactions
        reactions={reactions}
        currentUserId={ME}
        enabled
        selected
        onToggle={vi.fn()}
      />
    );
    const pill = screen.getByTestId('wb-reaction-pill-👍');
    expect(pill.textContent).toContain('1');
  });

  it('toggles off: clicking an own pill removes it (count → 0, pill gone)', () => {
    let reactions: unknown = [{ emoji: '👍', userId: ME }];
    const view = render(
      <WhiteboardNodeReactions
        reactions={reactions}
        currentUserId={ME}
        enabled
        onToggle={(emoji) => {
          reactions = toggleReaction(reactions, emoji, ME);
        }}
      />
    );

    // Click the existing own pill → remove.
    fireEvent.click(screen.getByTestId('wb-reaction-pill-👍'));

    view.rerender(
      <WhiteboardNodeReactions
        reactions={reactions}
        currentUserId={ME}
        enabled
        onToggle={vi.fn()}
      />
    );
    expect(screen.queryByTestId('wb-reaction-pill-👍')).toBeNull();
  });
});
