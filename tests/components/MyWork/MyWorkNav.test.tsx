/**
 * MyWorkNav — M02-P01 (Shell/Nav) reconciliation tests.
 *
 * Covers the two open findings this packet closes:
 *   M02-010 — accessible-name gap on the level-1 (group) tablist and on
 *             locked tabs.
 *   M02-017 — locked-group activation gap: a group chip must land on the
 *             group's first UNLOCKED tab, not blindly on `items[0]`.
 *
 * Plus baseline coverage: grouping, roving keyboard focus, deep-link-style
 * "activeTabId drives activeGroup" derivation.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyWorkNav, type MyWorkNavTab, type NavGroup } from '@/components/MyWork/MyWorkNav';

const GROUP_LABELS: Record<NavGroup, string> = {
  queues: 'Work queues',
  knowledge: 'Knowledge',
  automation: 'Automation',
  oversight: 'Oversight',
};

const ACTIVE_CLASS = 'chip-active';
const INACTIVE_CLASS = 'chip-inactive';

function baseTabs(): MyWorkNavTab[] {
  return [
    { id: 'inbox', label: 'Inbox', icon: <span />, navGroup: 'queues' },
    { id: 'tasks', label: 'Tasks', icon: <span />, navGroup: 'queues' },
    { id: 'decisions', label: 'Decisions', icon: <span />, navGroup: 'queues' },
    { id: 'calendar', label: 'Calendar', icon: <span />, navGroup: 'queues' },
    { id: 'ideas', label: 'Ideas', icon: <span />, navGroup: 'knowledge' },
    { id: 'notebook', label: 'Notebook', icon: <span />, navGroup: 'knowledge' },
    { id: 'agent', label: 'Run agent', icon: <span />, navGroup: 'automation' },
    { id: 'manager', label: 'Manager', icon: <span />, navGroup: 'oversight' },
  ];
}

function renderNav(overrides: Partial<React.ComponentProps<typeof MyWorkNav>> = {}) {
  const onSelectTab = vi.fn();
  const onBlockedTab = vi.fn();
  const props: React.ComponentProps<typeof MyWorkNav> = {
    tabs: baseTabs(),
    activeTabId: 'inbox',
    groupLabels: GROUP_LABELS,
    groupsAriaLabel: 'My Work navigation groups',
    onSelectTab,
    onBlockedTab,
    activeChipClassName: ACTIVE_CLASS,
    inactiveChipClassName: INACTIVE_CLASS,
    ...overrides,
  };
  render(<MyWorkNav {...props} />);
  return { onSelectTab, onBlockedTab };
}

describe('MyWorkNav — grouping', () => {
  it('renders one group chip per non-empty group, in the fixed order', () => {
    renderNav();
    const groupRow = screen.getByTestId('mywork-nav-groups');
    const groupButtons = within(groupRow).getAllByRole('tab');
    expect(groupButtons.map((btn) => btn.textContent)).toEqual([
      'Work queues',
      'Knowledge',
      'Automation',
      'Oversight',
    ]);
  });

  it('shows only the active group tabs in level 2, and marks the active one', () => {
    renderNav({ activeTabId: 'tasks' });
    const tabRow = screen.getByTestId('mywork-nav-tabs');
    const tabButtons = within(tabRow).getAllByRole('tab');
    expect(tabButtons.map((btn) => btn.getAttribute('data-testid'))).toEqual([
      'mywork-tab-inbox',
      'mywork-tab-tasks',
      'mywork-tab-decisions',
      'mywork-tab-calendar',
    ]);
    expect(screen.getByTestId('mywork-tab-tasks')).toHaveAttribute('aria-selected', 'true');
  });

  it('derives the active group from the active tab (never stored separately)', () => {
    renderNav({ activeTabId: 'notebook' });
    // Knowledge group chip should be the selected one, and its tabs shown.
    expect(screen.getByTestId('mywork-group-knowledge')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('mywork-tab-notebook')).toBeInTheDocument();
    expect(screen.queryByTestId('mywork-tab-inbox')).not.toBeInTheDocument();
  });
});

describe('MyWorkNav — M02-010 accessible names', () => {
  it('gives the level-1 (group) tablist a real accessible name', () => {
    renderNav();
    const groupRow = screen.getByTestId('mywork-nav-groups');
    expect(groupRow).toHaveAttribute('aria-label', 'My Work navigation groups');
  });

  it('gives the level-2 tablist an accessible name matching the active group', () => {
    renderNav({ activeTabId: 'ideas' });
    const tabRow = screen.getByTestId('mywork-nav-tabs');
    expect(tabRow).toHaveAttribute('aria-label', 'Knowledge');
  });

  it('marks a locked tab aria-disabled and gives it a descriptive accessible name', () => {
    const tabs = baseTabs();
    tabs[4] = { ...tabs[4], isLocked: true, lockedReason: 'Pilot access required' };
    renderNav({ tabs, activeTabId: 'ideas' });
    const lockedTab = screen.getByTestId('mywork-tab-ideas');
    expect(lockedTab).toHaveAttribute('aria-disabled', 'true');
    expect(lockedTab).toHaveAttribute('aria-label', 'Ideas — Pilot access required');
  });

  it('does not mark unlocked tabs aria-disabled', () => {
    renderNav();
    const tab = screen.getByTestId('mywork-tab-inbox');
    expect(tab).not.toHaveAttribute('aria-disabled');
  });
});

describe('MyWorkNav — M02-017 locked-group activation', () => {
  it('clicking a group whose first tab is locked lands on the first UNLOCKED tab', () => {
    const tabs = baseTabs();
    // Lock "ideas" (the first tab of the "knowledge" group) — "notebook" stays open.
    tabs[4] = { ...tabs[4], isLocked: true, lockedReason: 'Pilot access required' };
    const { onSelectTab, onBlockedTab } = renderNav({ tabs, activeTabId: 'inbox' });

    fireEvent.click(screen.getByTestId('mywork-group-knowledge'));

    expect(onSelectTab).toHaveBeenCalledWith('notebook');
    expect(onBlockedTab).not.toHaveBeenCalled();
  });

  it('falls back to the blocked callback only when every tab in the group is locked', () => {
    const tabs = baseTabs();
    tabs[4] = { ...tabs[4], isLocked: true, lockedReason: 'Pilot access required' };
    tabs[5] = { ...tabs[5], isLocked: true, lockedReason: 'Pilot access required' };
    const { onSelectTab, onBlockedTab } = renderNav({ tabs, activeTabId: 'inbox' });

    fireEvent.click(screen.getByTestId('mywork-group-knowledge'));

    expect(onSelectTab).not.toHaveBeenCalled();
    expect(onBlockedTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'ideas' }));
  });

  it('clicking a locked tab directly still blocks (single-tab lock, pre-existing behavior)', () => {
    const tabs = baseTabs();
    tabs[4] = { ...tabs[4], isLocked: true, lockedReason: 'Pilot access required' };
    const { onSelectTab, onBlockedTab } = renderNav({ tabs, activeTabId: 'notebook' });

    fireEvent.click(screen.getByTestId('mywork-tab-ideas'));

    expect(onSelectTab).not.toHaveBeenCalled();
    expect(onBlockedTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'ideas' }));
  });
});

describe('MyWorkNav — keyboard roving focus', () => {
  it('ArrowRight moves focus across group chips and activates on landing', () => {
    renderNav({ activeTabId: 'inbox' });
    const groupRow = screen.getByTestId('mywork-nav-groups');
    const first = screen.getByTestId('mywork-group-queues');
    first.focus();
    fireEvent.keyDown(groupRow, { key: 'ArrowRight' });
    expect(screen.getByTestId('mywork-group-knowledge')).toHaveFocus();
  });

  it('Home/End jump to the first/last tab in the active group row', () => {
    renderNav({ activeTabId: 'tasks' });
    const tabRow = screen.getByTestId('mywork-nav-tabs');
    const tasksTab = screen.getByTestId('mywork-tab-tasks');
    tasksTab.focus();
    fireEvent.keyDown(tabRow, { key: 'End' });
    expect(screen.getByTestId('mywork-tab-calendar')).toHaveFocus();
    fireEvent.keyDown(tabRow, { key: 'Home' });
    expect(screen.getByTestId('mywork-tab-inbox')).toHaveFocus();
  });
});

describe('MyWorkNav — empty state', () => {
  it('renders nothing when no tabs are passed', () => {
    const { container } = render(
      <MyWorkNav
        tabs={[]}
        activeTabId="inbox"
        groupLabels={GROUP_LABELS}
        groupsAriaLabel="My Work navigation groups"
        onSelectTab={vi.fn()}
        activeChipClassName={ACTIVE_CLASS}
        inactiveChipClassName={INACTIVE_CLASS}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
