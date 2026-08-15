/**
 * @vitest-environment jsdom
 *
 * M16/5.3 + 5.4 — DriverPlannerPanel: driver tree renders, leaf changes drive the
 * what-if result in real-time, and an empty tree degrades to a quiet empty state.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import DriverPlannerPanel, {
  collectLeaves,
  evalTree,
  type DriverNode,
} from '../../src/components/Economics/panels/DriverPlannerPanel';

describe('DriverPlannerPanel — pure helpers', () => {
  const tree: DriverNode = {
    id: 'revenue',
    label: 'Przychód',
    op: 'multiply',
    children: [
      { id: 'customers', label: 'Klienci', value: 100 },
      { id: 'arpu', label: 'ARPU', value: 10 },
    ],
  };

  it('collectLeaves returns leaves in stable order', () => {
    expect(collectLeaves(tree).map((l) => l.id)).toEqual(['customers', 'arpu']);
  });

  it('evalTree multiplies leaves (Przychód = Klienci × ARPU)', () => {
    expect(evalTree(tree)).toBe(1000);
  });

  it('evalTree honors leaf overrides', () => {
    expect(evalTree(tree, { customers: 200, arpu: 10 })).toBe(2000);
  });

  it('evalTree returns null on a non-finite leaf (fail-soft)', () => {
    const bad: DriverNode = { id: 'r', label: 'R', children: [{ id: 'x', label: 'X' }] };
    expect(evalTree(bad)).toBeNull();
  });
});

describe('DriverPlannerPanel — render', () => {
  it('renders header, driver tree and what-if result for a selected real model', () => {
    const tree: DriverNode = {
      id: 'revenue',
      label: 'Przychód',
      op: 'multiply',
      children: [
        { id: 'customers', label: 'Klienci', value: 1200 },
        { id: 'arpu', label: 'ARPU', value: 240 },
      ],
    };
    render(<DriverPlannerPanel driverTree={tree} />);

    expect(screen.getByTestId('driver-planner-panel')).toBeTruthy();
    expect(screen.getByText('Driver-based planning + what-if')).toBeTruthy();
    expect(screen.getByTestId('driver-tree-viz')).toBeTruthy();

    // default example: 1200 × 240 = 288 000
    const result = screen.getByTestId('whatif-result');
    expect(within(result).getByTestId('whatif-value').textContent).toContain('288');
  });

  it('updates the what-if result when a leaf driver changes', async () => {
    const user = userEvent.setup();
    const tree: DriverNode = {
      id: 'revenue',
      label: 'Przychód',
      op: 'multiply',
      children: [
        { id: 'customers', label: 'Klienci', value: 100, min: 0, max: 1000, step: 1 },
        { id: 'arpu', label: 'ARPU', value: 10, min: 0, max: 100, step: 1 },
      ],
    };
    render(<DriverPlannerPanel driverTree={tree} />);

    const value = within(screen.getByTestId('whatif-result')).getByTestId('whatif-value');
    expect(value.textContent).toContain('1'); // 100 × 10 = 1000 → "1 tys."

    // change Klienci from 100 → 300 via the number input
    const input = screen.getByLabelText('Klienci') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '300');

    // 300 × 10 = 3000 → "3 tys."; delta vs base shown
    expect(value.textContent).toContain('3');
    expect(screen.getByTestId('whatif-delta').textContent).toContain('+');
  });

  it('renders an empty state for a tree with no usable drivers', () => {
    const empty: DriverNode = { id: 'r', label: 'R' }; // leaf with no value → eval null
    render(<DriverPlannerPanel driverTree={empty} />);

    expect(screen.getByTestId('driver-planner-empty-leaves')).toBeTruthy();
    expect(screen.queryByTestId('driver-tree-viz')).toBeNull();
  });
});
