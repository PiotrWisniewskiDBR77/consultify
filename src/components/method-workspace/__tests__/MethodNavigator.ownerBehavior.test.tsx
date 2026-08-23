/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MethodNavigator } from '../MethodNavigator';
import type { MethodNavigatorNode } from '../types';

const node = (
  unitId: string,
  name: string,
  parentId: string | null,
  order: number
): MethodNavigatorNode => ({
  unitId,
  name,
  parentId,
  order,
  currentLevel: null,
  targetLevel: null,
  evidenceState: 'missing',
  gap: null,
  openQuestionCount: 0,
});

const nodes = [
  node('axis-1', 'Digital Processes', null, 1),
  node('1A', 'Sales Processes', 'axis-1', 1),
  node('1B', 'Marketing Processes', 'axis-1', 2),
  node('axis-2', 'Digital Products', null, 2),
  node('2A', 'Digital Products', 'axis-2', 1),
  node('2B', 'Community Products', 'axis-2', 2),
];

describe('MethodNavigator — owner-approved compact axis navigation', () => {
  it('expands only the root containing the active area', () => {
    render(<MethodNavigator nodes={nodes} activeUnitId="1A" onSelect={vi.fn()} />);

    const roots = screen.getAllByRole('treeitem').filter((item) => item.getAttribute('aria-expanded') !== null);
    expect(roots).toHaveLength(2);
    expect(within(roots[0]).getByText('Digital Processes')).toBeInTheDocument();
    expect(roots[0]).toHaveAttribute('aria-expanded', 'true');
    expect(roots[1]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Sales Processes')).toBeInTheDocument();
    expect(screen.queryByText('Community Products')).not.toBeInTheDocument();
  });

  it('behaves as a root accordion and keeps one axis list open at a time', () => {
    render(<MethodNavigator nodes={nodes} activeUnitId="1A" onSelect={vi.fn()} />);

    fireEvent.click(screen.getByText('Digital Products'));

    expect(screen.queryByText('Sales Processes')).not.toBeInTheDocument();
    expect(screen.getByText('Community Products')).toBeInTheDocument();
  });

  it('moves the expanded context when the active area changes', () => {
    const { rerender } = render(<MethodNavigator nodes={nodes} activeUnitId="1A" onSelect={vi.fn()} />);

    rerender(<MethodNavigator nodes={nodes} activeUnitId="2B" onSelect={vi.fn()} />);

    expect(screen.queryByText('Sales Processes')).not.toBeInTheDocument();
    expect(screen.getByText('Community Products')).toBeInTheDocument();
  });
});
