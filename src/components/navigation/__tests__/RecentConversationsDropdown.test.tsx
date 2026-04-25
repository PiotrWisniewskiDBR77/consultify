/**
 * Chat V9 / NAV-M3-lite — component tests for
 * `RecentConversationsDropdown`.
 *
 * The dropdown is a pure presentation layer: parent owns the
 * entries array + open state + selection callback. These tests
 * pin the UI contract (trigger visibility, open/close via click
 * / Escape / outside-click, menuitem behaviour, focus move on
 * open) without mocking stores or flag resolvers.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecentConversationEntry } from '../../../utils/buildRecentConversationsList';
import { RecentConversationsDropdown } from '../RecentConversationsDropdown';

function entry(
  id: string,
  label: string,
  overrides: Partial<RecentConversationEntry> = {}
): RecentConversationEntry {
  return {
    id,
    label,
    fullTitle: label,
    truncated: false,
    pinned: false,
    ...overrides,
  };
}

describe('RecentConversationsDropdown', () => {
  beforeEach(() => {
    // rAF polyfill works under Vitest + JSDOM.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when the entries array is empty', () => {
    const { container } = render(
      <RecentConversationsDropdown
        entries={[]}
        open={false}
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the trigger with aria-haspopup and the entries count in the aria-label', () => {
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A'), entry('b', 'B')]}
        open={false}
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );

    const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-label')).toBe('Recent conversations (2)');
  });

  it('does not render the menu when `open` is false', () => {
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A')]}
        open={false}
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );

    expect(screen.queryByTestId('workspace-breadcrumb-recents-menu')).toBeNull();
  });

  it('renders the menu and the full entry list when `open` is true', () => {
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'Alpha'), entry('b', 'Beta'), entry('c', 'Gamma')]}
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );

    const menu = screen.getByTestId('workspace-breadcrumb-recents-menu');
    expect(menu.getAttribute('role')).toBe('menu');

    expect(screen.getByTestId('workspace-breadcrumb-recent-0').textContent).toContain('Alpha');
    expect(screen.getByTestId('workspace-breadcrumb-recent-1').textContent).toContain('Beta');
    expect(screen.getByTestId('workspace-breadcrumb-recent-2').textContent).toContain('Gamma');
  });

  it('clicking the trigger calls onOpenChange with the inverse of `open`', () => {
    const onOpenChange = vi.fn();
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A')]}
        open={false}
        onOpenChange={onOpenChange}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('clicking a menuitem calls onSelect with the entry id and closes the menu', () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'Alpha'), entry('b', 'Beta')]}
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('workspace-breadcrumb-recent-1'));

    expect(onSelect).toHaveBeenCalledWith('b');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('surfaces the full title as a tooltip only for truncated entries', () => {
    render(
      <RecentConversationsDropdown
        entries={[
          entry('a', 'Short'),
          entry('b', 'Truncat…', { truncated: true, fullTitle: 'Truncated original title' }),
        ]}
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );

    const short = screen.getByTestId('workspace-breadcrumb-recent-0');
    const truncated = screen.getByTestId('workspace-breadcrumb-recent-1');

    expect(short.getAttribute('title')).toBeNull();
    expect(truncated.getAttribute('title')).toBe('Truncated original title');
  });

  it('closes on Escape when open', () => {
    const onOpenChange = vi.fn();
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A')]}
        open
        onOpenChange={onOpenChange}
        onSelect={() => {}}
      />
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ignores Escape when already closed (no extra onOpenChange calls)', () => {
    const onOpenChange = vi.fn();
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A')]}
        open={false}
        onOpenChange={onOpenChange}
        onSelect={() => {}}
      />
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes on outside mousedown', () => {
    const onOpenChange = vi.fn();
    render(
      <div>
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={onOpenChange}
          onSelect={() => {}}
        />
        <button type="button" data-testid="outside">
          outside
        </button>
      </div>
    );

    act(() => {
      fireEvent.mouseDown(screen.getByTestId('outside'));
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when the mousedown lands inside the menu', () => {
    const onOpenChange = vi.fn();
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'Alpha')]}
        open
        onOpenChange={onOpenChange}
        onSelect={() => {}}
      />
    );

    act(() => {
      fireEvent.mouseDown(screen.getByTestId('workspace-breadcrumb-recents-menu'));
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('appends className to the wrapper when provided', () => {
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A')]}
        open={false}
        onOpenChange={() => {}}
        onSelect={() => {}}
        className="custom-class"
      />
    );

    const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
    const wrapper = trigger.parentElement;
    expect(wrapper?.className).toContain('custom-class');
    expect(wrapper?.className).toContain('relative inline-flex');
  });

  it('reflects aria-expanded when open is true', () => {
    render(
      <RecentConversationsDropdown
        entries={[entry('a', 'A')]}
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );

    const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  // -------------------------------------------------------------
  // NAV-M3-lite+ · pin glyph rendering
  // -------------------------------------------------------------
  describe('pinned entries', () => {
    it('renders the pin glyph and data-pinned="true" for pinned rows', () => {
      render(
        <RecentConversationsDropdown
          entries={[
            entry('p', 'Pinned', { pinned: true, fullTitle: 'Pinned thread' }),
            entry('u', 'Unpinned'),
          ]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
        />
      );

      const pinned = screen.getByTestId('workspace-breadcrumb-recent-0');
      const unpinned = screen.getByTestId('workspace-breadcrumb-recent-1');

      expect(pinned.getAttribute('data-pinned')).toBe('true');
      expect(unpinned.getAttribute('data-pinned')).toBe('false');

      expect(screen.getByTestId('workspace-breadcrumb-recent-0-pin')).toBeTruthy();
      expect(screen.queryByTestId('workspace-breadcrumb-recent-1-pin')).toBeNull();
    });

    it('exposes an aria-label with the full title for pinned rows', () => {
      render(
        <RecentConversationsDropdown
          entries={[
            entry('p', 'Quarter plan…', {
              pinned: true,
              truncated: true,
              fullTitle: 'Quarter planning for 2026 GTM ramp',
            }),
          ]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
        />
      );

      const pinned = screen.getByTestId('workspace-breadcrumb-recent-0');
      expect(pinned.getAttribute('aria-label')).toBe('Pinned: Quarter planning for 2026 GTM ramp');
    });

    it('does not set aria-label on unpinned rows (falls back to visible label)', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('u', 'Unpinned')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
        />
      );

      const unpinned = screen.getByTestId('workspace-breadcrumb-recent-0');
      expect(unpinned.getAttribute('aria-label')).toBeNull();
    });

    it('pinned click still fires onSelect + closes the menu', () => {
      const onSelect = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('p', 'Pinned', { pinned: true })]}
          open
          onOpenChange={onOpenChange}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recent-0'));
      expect(onSelect).toHaveBeenCalledWith('p');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // -------------------------------------------------------------
  // NAV-M3-lite++ · "View all" footer row
  // -------------------------------------------------------------
  describe('View all footer', () => {
    it('does not render the footer when onViewAll is not provided', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
        />
      );

      expect(screen.queryByTestId('workspace-breadcrumb-recents-footer')).toBeNull();
      expect(screen.queryByTestId('workspace-breadcrumb-recents-view-all')).toBeNull();
    });

    it('renders the footer with the default label when onViewAll is provided', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
          onViewAll={() => {}}
        />
      );

      const footerBtn = screen.getByTestId('workspace-breadcrumb-recents-view-all');
      expect(footerBtn.textContent).toBe('View all conversations');
      expect(screen.getByTestId('workspace-breadcrumb-recents-footer')).toBeTruthy();
    });

    it('respects a custom viewAllLabel', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
          onViewAll={() => {}}
          viewAllLabel="Browse all threads"
        />
      );

      expect(screen.getByTestId('workspace-breadcrumb-recents-view-all').textContent).toBe(
        'Browse all threads'
      );
    });

    it('clicking the footer calls onViewAll and closes the popover', () => {
      const onViewAll = vi.fn();
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          onViewAll={onViewAll}
        />
      );

      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-view-all'));
      expect(onViewAll).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('the footer row is NOT a menuitem (keeps aria-semantics clean)', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
          onViewAll={() => {}}
        />
      );

      const footerBtn = screen.getByTestId('workspace-breadcrumb-recents-view-all');
      expect(footerBtn.getAttribute('role')).toBeNull();
    });

    it('the footer renders after the last menuitem in DOM order', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A'), entry('b', 'B')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
          onViewAll={() => {}}
        />
      );

      const lastItem = screen.getByTestId('workspace-breadcrumb-recent-1');
      const footer = screen.getByTestId('workspace-breadcrumb-recents-footer');

      expect(
        lastItem.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('a missing onViewAll handler at click time is a no-op (defensive)', () => {
      // Smoke-test the defensive `typeof onViewAll !== 'function'`
      // guard by rendering the footer once, then re-rendering
      // with `onViewAll` dropped. React removes the footer, but
      // the guard still protects against stale refs in practice.
      const { rerender } = render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
          onViewAll={() => {}}
        />
      );

      expect(screen.getByTestId('workspace-breadcrumb-recents-view-all')).toBeTruthy();

      rerender(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open
          onOpenChange={() => {}}
          onSelect={() => {}}
        />
      );

      expect(screen.queryByTestId('workspace-breadcrumb-recents-view-all')).toBeNull();
    });
  });

  // ---------- NAV-M3-lite^3 — roving arrow-key navigation ---------
  describe('NAV-M3-lite^3 · arrow-key navigation', () => {
    function renderRing(opts: { arrowKeysEnabled?: boolean; count?: number } = {}) {
      const entries = Array.from({ length: opts.count ?? 4 }).map((_, i) =>
        entry(`id-${i}`, `Label ${i}`)
      );
      const utils = render(
        <RecentConversationsDropdown
          entries={entries}
          open
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
          isArrowKeysEnabled={() => opts.arrowKeysEnabled ?? true}
        />
      );
      // Auto-focus defer lands via rAF; advance fake timers so the
      // first menuitem actually gains focus before assertions.
      act(() => {
        vi.advanceTimersByTime(32);
      });
      const items = entries.map((_, i) =>
        screen.getByTestId(`workspace-breadcrumb-recent-${i}`)
      ) as HTMLButtonElement[];
      return { ...utils, items, entries };
    }

    it('ArrowDown moves focus to the next menuitem', () => {
      const { items } = renderRing({ count: 3 });
      items[0].focus();
      fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[1]);
    });

    it('ArrowUp moves focus to the previous menuitem', () => {
      const { items } = renderRing({ count: 3 });
      items[1].focus();
      fireEvent.keyDown(items[1], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[0]);
    });

    it('ArrowDown on the last menuitem wraps to the first', () => {
      const { items } = renderRing({ count: 3 });
      items[2].focus();
      fireEvent.keyDown(items[2], { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[0]);
    });

    it('ArrowUp on the first menuitem wraps to the last', () => {
      const { items } = renderRing({ count: 3 });
      items[0].focus();
      fireEvent.keyDown(items[0], { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[2]);
    });

    it('Home jumps focus to the first menuitem', () => {
      const { items } = renderRing({ count: 4 });
      items[3].focus();
      fireEvent.keyDown(items[3], { key: 'Home' });
      expect(document.activeElement).toBe(items[0]);
    });

    it('End jumps focus to the last menuitem', () => {
      const { items } = renderRing({ count: 4 });
      items[0].focus();
      fireEvent.keyDown(items[0], { key: 'End' });
      expect(document.activeElement).toBe(items[3]);
    });

    it('Tab closes the popover via onOpenChange(false)', () => {
      const entries = [entry('a', 'A'), entry('b', 'B')];
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={entries}
          open
          onOpenChange={onOpenChange}
          onSelect={vi.fn()}
          isArrowKeysEnabled={() => true}
        />
      );
      const item = screen.getByTestId('workspace-breadcrumb-recent-0');
      fireEvent.keyDown(item, { key: 'Tab' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('does NOT preventDefault on Enter/Space — native click activates the item', () => {
      const entries = [entry('a', 'Alpha')];
      const onSelect = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={entries}
          open
          onOpenChange={vi.fn()}
          onSelect={onSelect}
          isArrowKeysEnabled={() => true}
        />
      );
      const item = screen.getByTestId('workspace-breadcrumb-recent-0');
      // Enter on a focused button fires a synthetic click in real
      // browsers. JSDOM does not emulate that path, so we assert
      // on the handler pass-through instead: firing keydown
      // Enter must not preventDefault, and firing click still
      // invokes the handler wired to the button.
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      item.dispatchEvent(keyEvent);
      expect(keyEvent.defaultPrevented).toBe(false);
      fireEvent.click(item);
      expect(onSelect).toHaveBeenCalledWith('a');
    });

    it('ignores arrow keys entirely when the kill-switch is OFF', () => {
      const { items } = renderRing({ count: 3, arrowKeysEnabled: false });
      items[0].focus();
      fireEvent.keyDown(items[0], { key: 'ArrowDown' });
      // Flag OFF = handler returns early; focus stays on item 0.
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(items[0], { key: 'End' });
      expect(document.activeElement).toBe(items[0]);
    });

    it('calls preventDefault for Arrow/Home/End so page scroll does not hijack the popover', () => {
      const entries = [entry('a', 'A'), entry('b', 'B'), entry('c', 'C')];
      render(
        <RecentConversationsDropdown
          entries={entries}
          open
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
          isArrowKeysEnabled={() => true}
        />
      );
      const item = screen.getByTestId('workspace-breadcrumb-recent-0');
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End'] as const) {
        const evt = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        item.dispatchEvent(evt);
        expect(evt.defaultPrevented).toBe(true);
      }
    });

    it('other keys (letters, PageDown) are ignored — no focus move, no preventDefault', () => {
      const entries = [entry('a', 'A'), entry('b', 'B')];
      render(
        <RecentConversationsDropdown
          entries={entries}
          open
          onOpenChange={vi.fn()}
          onSelect={vi.fn()}
          isArrowKeysEnabled={() => true}
        />
      );
      const first = screen.getByTestId('workspace-breadcrumb-recent-0') as HTMLButtonElement;
      first.focus();
      for (const key of ['a', 'PageDown', 'PageUp', ' '] as const) {
        const evt = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        first.dispatchEvent(evt);
        expect(evt.defaultPrevented).toBe(false);
      }
      expect(document.activeElement).toBe(first);
    });
  });

  // ---------------------------------------------------------------
  // NAV-M3.4 — trigger-level ArrowDown APG shortcut.
  // ---------------------------------------------------------------
  describe('NAV-M3.4 trigger ArrowDown', () => {
    it('advertises the shortcut via aria-keyshortcuts when ON', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={() => {}}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
          // NAV-M3.5 has its own describe block; scope this
          // assertion strictly to NAV-M3.4 so the advertised
          // string reads as a single shortcut.
          isTriggerArrowUpEnabled={() => false}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      expect(trigger.getAttribute('aria-keyshortcuts')).toBe('ArrowDown');
      expect(trigger.getAttribute('data-trigger-arrow')).toBe('true');
    });

    it('omits aria-keyshortcuts when the kill-switch is OFF', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={() => {}}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => false}
          // NAV-M3.5 has its own describe block; scope this
          // assertion strictly to NAV-M3.4 so no other trigger-
          // level shortcut bleeds into the advertised string.
          isTriggerArrowUpEnabled={() => false}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      expect(trigger.hasAttribute('aria-keyshortcuts')).toBe(false);
      expect(trigger.getAttribute('data-trigger-arrow')).toBe('false');
    });

    it('pressing ArrowDown on the focused trigger opens the popover when closed', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'Alpha')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      trigger.focus();
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(evt);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      // And the default page-scroll is suppressed.
      expect(evt.defaultPrevented).toBe(true);
    });

    it('ignores ArrowDown on the trigger when the popover is already open', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={true}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(evt);
      // Handler bails early when already open; parent never sees
      // a redundant open-request.
      expect(onOpenChange).not.toHaveBeenCalled();
      // And the native scroll is not suppressed — nothing to do.
      expect(evt.defaultPrevented).toBe(false);
    });

    it('ignores ArrowDown entirely when the kill-switch is OFF', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => false}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(evt);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(evt.defaultPrevented).toBe(false);
    });

    it('ignores unrelated keys (ArrowUp, Tab, Enter, Escape, letter) on the trigger', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
          // NAV-M3.5 lives in its own test block; scope this case
          // strictly to NAV-M3.4 by turning the sibling flag OFF.
          isTriggerArrowUpEnabled={() => false}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      for (const key of ['ArrowUp', 'Tab', 'Escape', 'a', 'PageDown'] as const) {
        const evt = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });
        trigger.dispatchEvent(evt);
        // Native button activation and Escape propagation stay
        // intact — the handler never preventsDefault for keys
        // outside its APG scope.
        expect(evt.defaultPrevented).toBe(false);
      }
      // Only Enter / Space activate the button natively; neither
      // of them flows through this handler at all.
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('native click still opens the popover when the kill-switch is OFF', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => false}
        />
      );
      fireEvent.click(screen.getByTestId('workspace-breadcrumb-recents-trigger'));
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('open-effect still auto-focuses the first menuitem when ArrowDown opens the popover', () => {
      // Parent pattern: `open` is the controlled prop. Simulate
      // the parent flipping `open` from false to true after the
      // handler reports back.
      const Harness: React.FC = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <RecentConversationsDropdown
            entries={[entry('a', 'A'), entry('b', 'B')]}
            open={open}
            onOpenChange={setOpen}
            onSelect={() => {}}
            isTriggerArrowEnabled={() => true}
          />
        );
      };
      render(<Harness />);
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      // rAF is faked; advance so the open-effect's focus call runs.
      act(() => {
        vi.advanceTimersByTime(32);
      });
      const first = screen.getByTestId('workspace-breadcrumb-recent-0');
      expect(document.activeElement).toBe(first);
    });
  });

  // ---------------------------------------------------------------
  // NAV-M3.5 — trigger-level ArrowUp APG shortcut.
  // ---------------------------------------------------------------
  describe('NAV-M3.5 trigger ArrowUp', () => {
    it('combines ArrowUp into aria-keyshortcuts when both trigger flags are ON', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={() => {}}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
          isTriggerArrowUpEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      expect(trigger.getAttribute('aria-keyshortcuts')).toBe('ArrowDown ArrowUp');
      expect(trigger.getAttribute('data-trigger-arrow')).toBe('true');
      expect(trigger.getAttribute('data-trigger-arrow-up')).toBe('true');
    });

    it('advertises only ArrowUp when NAV-M3.4 is OFF and NAV-M3.5 is ON', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={() => {}}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => false}
          isTriggerArrowUpEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      expect(trigger.getAttribute('aria-keyshortcuts')).toBe('ArrowUp');
      expect(trigger.getAttribute('data-trigger-arrow')).toBe('false');
      expect(trigger.getAttribute('data-trigger-arrow-up')).toBe('true');
    });

    it('omits aria-keyshortcuts entirely when both trigger flags are OFF', () => {
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={() => {}}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => false}
          isTriggerArrowUpEnabled={() => false}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      expect(trigger.hasAttribute('aria-keyshortcuts')).toBe(false);
      expect(trigger.getAttribute('data-trigger-arrow-up')).toBe('false');
    });

    it('pressing ArrowUp on the focused trigger opens the popover when closed', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A'), entry('b', 'B')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
          isTriggerArrowUpEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      trigger.focus();
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(evt);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(evt.defaultPrevented).toBe(true);
    });

    it('ignores ArrowUp on the trigger when the popover is already open', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={true}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
          isTriggerArrowUpEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(evt);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(evt.defaultPrevented).toBe(false);
    });

    it('ignores ArrowUp entirely when the NAV-M3.5 kill-switch is OFF', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => true}
          isTriggerArrowUpEnabled={() => false}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      const evt = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(evt);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(evt.defaultPrevented).toBe(false);
    });

    it('ArrowDown and ArrowUp are independent: NAV-M3.5 ON, NAV-M3.4 OFF opens via ArrowUp only', () => {
      const onOpenChange = vi.fn();
      render(
        <RecentConversationsDropdown
          entries={[entry('a', 'A')]}
          open={false}
          onOpenChange={onOpenChange}
          onSelect={() => {}}
          isTriggerArrowEnabled={() => false}
          isTriggerArrowUpEnabled={() => true}
        />
      );
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      const down = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(down);
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(down.defaultPrevented).toBe(false);

      const up = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        bubbles: true,
        cancelable: true,
      });
      trigger.dispatchEvent(up);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(up.defaultPrevented).toBe(true);
    });

    it('open-effect auto-focuses the LAST menuitem when ArrowUp opens the popover', () => {
      const Harness: React.FC = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <RecentConversationsDropdown
            entries={[entry('a', 'A'), entry('b', 'B'), entry('c', 'C')]}
            open={open}
            onOpenChange={setOpen}
            onSelect={() => {}}
            isTriggerArrowEnabled={() => true}
            isTriggerArrowUpEnabled={() => true}
          />
        );
      };
      render(<Harness />);
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowUp' });
      act(() => {
        vi.advanceTimersByTime(32);
      });
      const last = screen.getByTestId('workspace-breadcrumb-recent-2');
      expect(document.activeElement).toBe(last);
    });

    it('open-via-ArrowDown still focuses first — the two shortcuts do not interfere', () => {
      const Harness: React.FC = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <RecentConversationsDropdown
            entries={[entry('a', 'A'), entry('b', 'B'), entry('c', 'C')]}
            open={open}
            onOpenChange={setOpen}
            onSelect={() => {}}
            isTriggerArrowEnabled={() => true}
            isTriggerArrowUpEnabled={() => true}
          />
        );
      };
      render(<Harness />);
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      act(() => {
        vi.advanceTimersByTime(32);
      });
      const first = screen.getByTestId('workspace-breadcrumb-recent-0');
      expect(document.activeElement).toBe(first);
    });

    it('a subsequent click-open after an ArrowUp-open falls back to first-item focus (marker is reset)', () => {
      // Regression guard — the focus-target marker must reset to
      // 'first' after the effect runs so the next open (any
      // path) does not unexpectedly land on the last item.
      const Harness: React.FC = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <RecentConversationsDropdown
            entries={[entry('a', 'A'), entry('b', 'B'), entry('c', 'C')]}
            open={open}
            onOpenChange={setOpen}
            onSelect={() => {}}
            isTriggerArrowEnabled={() => true}
            isTriggerArrowUpEnabled={() => true}
          />
        );
      };
      render(<Harness />);
      const trigger = screen.getByTestId('workspace-breadcrumb-recents-trigger');
      trigger.focus();
      // First: open via ArrowUp → last.
      fireEvent.keyDown(trigger, { key: 'ArrowUp' });
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(document.activeElement).toBe(screen.getByTestId('workspace-breadcrumb-recent-2'));
      // Close via Escape, then re-open via native click.
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.click(trigger);
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(document.activeElement).toBe(screen.getByTestId('workspace-breadcrumb-recent-0'));
    });
  });
});
