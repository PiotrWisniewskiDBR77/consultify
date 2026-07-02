/**
 * Menu3DropdownChip — S1-U1 Command Row absorption primitive.
 *
 * Covers the key behaviours the owner directive depends on:
 * - chip trigger opens a portaled menu (folders/recents live IN the Menu 3
 *   line, not as extra rows),
 * - selecting an item fires the action and closes the menu,
 * - Escape / outside click close the menu,
 * - active state + badge count render on the trigger.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Folder } from 'lucide-react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  Menu3DropdownChip,
  type Menu3DropdownItem,
} from '@/components/shared/Menu3DropdownChip';

function buildItems(overrides?: Partial<Menu3DropdownItem>[]) {
  const onAll = vi.fn();
  const onDbr = vi.fn();
  const items: Menu3DropdownItem[] = [
    { id: 'all', label: 'All ideas', active: true, onSelect: onAll },
    { id: 'dbr77', label: 'DBR77', icon: <Folder size={14} />, onSelect: onDbr },
    ...((overrides as Menu3DropdownItem[]) || []),
  ];
  return { items, onAll, onDbr };
}

describe('Menu3DropdownChip', () => {
  it('renders a collapsed chip and opens the menu on click', () => {
    const { items } = buildItems();
    render(
      <Menu3DropdownChip label="Folder" items={items} data-testid="folder-chip" />
    );

    const trigger = screen.getByTestId('folder-chip');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Menu content is not in the DOM until opened.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /DBR77/ })).toBeInTheDocument();
  });

  it('fires the item action and closes the menu on selection', () => {
    const { items, onDbr } = buildItems();
    render(<Menu3DropdownChip label="Folder" items={items} data-testid="folder-chip" />);

    fireEvent.click(screen.getByTestId('folder-chip'));
    fireEvent.click(screen.getByRole('menuitem', { name: /DBR77/ }));

    expect(onDbr).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and on outside click', () => {
    const { items } = buildItems();
    render(
      <div>
        <button type="button">outside</button>
        <Menu3DropdownChip label="Folder" items={items} data-testid="folder-chip" />
      </div>
    );

    fireEvent.click(screen.getByTestId('folder-chip'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('folder-chip'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows badge count and disabled items do not fire', () => {
    const onDisabled = vi.fn();
    const { items } = buildItems([
      { id: 'locked', label: 'Locked folder', disabled: true, onSelect: onDisabled },
    ]);
    render(
      <Menu3DropdownChip
        label="Folder"
        badgeCount={7}
        active
        items={items}
        data-testid="folder-chip"
      />
    );

    expect(screen.getByTestId('folder-chip')).toHaveTextContent('7');

    fireEvent.click(screen.getByTestId('folder-chip'));
    const locked = screen.getByRole('menuitem', { name: /Locked folder/ });
    expect(locked).toBeDisabled();
    fireEvent.click(locked);
    expect(onDisabled).not.toHaveBeenCalled();
  });

  it('renders the footer after a divider and passes close()', () => {
    const { items } = buildItems();
    render(
      <Menu3DropdownChip
        label="Folder"
        items={items}
        data-testid="folder-chip"
        footer={(close) => (
          <button type="button" onClick={close}>
            New folder…
          </button>
        )}
      />
    );

    fireEvent.click(screen.getByTestId('folder-chip'));
    fireEvent.click(screen.getByText('New folder…'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
