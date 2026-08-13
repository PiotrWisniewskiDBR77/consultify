/**
 * @vitest-environment jsdom
 *
 * MethodNavigator had no dedicated test file before this — it was only
 * exercised indirectly (with an empty `nodes: []`) through
 * MethodWorkspaceShell.test.tsx. Added alongside a structural a11y fix
 * (2026-08-13, S6 dark/a11y sweep): `role="treeitem"` had been placed on an
 * inner <div> instead of the <li> itself, which axe-core flags as critical
 * (`aria-required-children`/`aria-required-parent`/`listitem`) because a
 * `<ul role="tree">` must own treeitem/group children directly. These tests
 * pin the corrected DOM shape and the accessible-name/event-propagation
 * behavior that came with the restructure.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MethodNavigator } from '../MethodNavigator';
import type { MethodNavigatorNode } from '../types';

const NODES: MethodNavigatorNode[] = [
  {
    unitId: 'axis-1',
    name: 'Strategia i governance',
    parentId: null,
    order: 1,
    currentLevel: null,
    targetLevel: null,
    evidenceState: 'complete',
    gap: null,
    openQuestionCount: 0,
  },
  {
    unitId: 'unit-1',
    name: 'Governance danych',
    parentId: 'axis-1',
    order: 1,
    currentLevel: 2,
    targetLevel: 4,
    evidenceState: 'weak',
    gap: 2,
    openQuestionCount: 3,
  },
  {
    unitId: 'unit-2',
    name: 'Mapa drogowa',
    parentId: 'axis-1',
    order: 2,
    currentLevel: 1,
    targetLevel: 3,
    evidenceState: 'missing',
    gap: 2,
    openQuestionCount: 0,
  },
];

describe('MethodNavigator', () => {
  it('renders a structurally valid ARIA tree: role="treeitem" lives on the <li>, nested <ul role="group"> sits inside its parent treeitem', () => {
    render(<MethodNavigator nodes={NODES} activeUnitId={null} onSelect={vi.fn()} />);

    const tree = screen.getByRole('tree');
    // Every DIRECT child of the tree/group must itself carry role="treeitem"
    // (an axe `aria-required-children` requirement) — i.e. it must be the
    // <li>, not a <div> buried inside it.
    const directChildren = Array.from(tree.children);
    expect(directChildren.length).toBeGreaterThan(0);
    for (const child of directChildren) {
      expect(child.tagName).toBe('LI');
      expect(child.getAttribute('role')).toBe('treeitem');
    }

    const parentItem = screen.getByRole('treeitem', { name: 'Strategia i governance' });
    const nestedGroup = parentItem.querySelector(':scope > ul[role="group"]');
    expect(nestedGroup).not.toBeNull(); // group nested INSIDE the treeitem, not a sibling
  });

  it('leaf nodes expose an accessible name carrying level, evidence, and open-question count — never color alone', () => {
    render(<MethodNavigator nodes={NODES} activeUnitId={null} onSelect={vi.fn()} />);
    expect(
      screen.getByRole('treeitem', { name: 'Governance danych, poziom 2 z 4, evidence weak, 3 otwartych pytań' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('treeitem', { name: 'Mapa drogowa, poziom 1 z 3, evidence missing' })
    ).toBeInTheDocument();
  });

  it('clicking a leaf calls onSelect with its unitId', () => {
    const onSelect = vi.fn();
    render(<MethodNavigator nodes={NODES} activeUnitId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /^Governance danych,/ }));
    expect(onSelect).toHaveBeenCalledWith('unit-1');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('Enter/Space activates a focused treeitem the same as a click', () => {
    const onSelect = vi.fn();
    render(<MethodNavigator nodes={NODES} activeUnitId={null} onSelect={onSelect} />);
    const leaf = screen.getByRole('treeitem', { name: /^Mapa drogowa,/ });
    fireEvent.keyDown(leaf, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('unit-2');
  });

  it('collapsing/expanding a parent toggles aria-expanded and does NOT call onSelect (parents are not leaves)', () => {
    const onSelect = vi.fn();
    render(<MethodNavigator nodes={NODES} activeUnitId={null} onSelect={onSelect} />);
    const parent = screen.getByRole('treeitem', { name: 'Strategia i governance' });
    expect(parent).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(parent);
    expect(parent).toHaveAttribute('aria-expanded', 'false');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking a nested child does not bubble up and re-toggle the ancestor treeitem (regression: role moved from a div onto the <li>, which nests inside its ancestor <li> and would otherwise double-fire the ancestor onClick)', () => {
    const onSelect = vi.fn();
    render(<MethodNavigator nodes={NODES} activeUnitId={null} onSelect={onSelect} />);
    const parent = screen.getByRole('treeitem', { name: 'Strategia i governance' });
    expect(parent).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('treeitem', { name: /^Governance danych,/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('unit-1');
    // The ancestor's own expand/collapse state must be untouched by a click
    // deep inside its subtree.
    expect(parent).toHaveAttribute('aria-expanded', 'true');
  });

  it('the active unit is marked aria-selected, and only that one', () => {
    render(<MethodNavigator nodes={NODES} activeUnitId="unit-2" onSelect={vi.fn()} />);
    expect(screen.getByRole('treeitem', { name: /^Mapa drogowa,/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('treeitem', { name: /^Governance danych,/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows an explicit empty state when the Method Pack has not supplied any structure yet', () => {
    render(<MethodNavigator nodes={[]} activeUnitId={null} onSelect={vi.fn()} />);
    expect(screen.getByTestId('method-navigator-empty')).toBeInTheDocument();
  });
});
