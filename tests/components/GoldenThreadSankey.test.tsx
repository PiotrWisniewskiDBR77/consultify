/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  GoldenThreadSankey,
  type GoldenThreadLink,
  type GoldenThreadNode,
} from '../../src/components/Economics/charts/GoldenThreadSankey';

// 4-column golden thread: initiative -> KPI -> finance line -> value.
const NODES: GoldenThreadNode[] = [
  { id: 'init-1', label: 'Inicjatywa A', column: 0 },
  { id: 'init-2', label: 'Inicjatywa B', column: 0 },
  { id: 'kpi-1', label: 'KPI Churn', column: 1 },
  { id: 'kpi-2', label: 'KPI NPS', column: 1 },
  { id: 'line-1', label: 'Przychód', column: 2 },
  { id: 'val-1', label: 'Wartość 1.2M', column: 3 },
  // Orphan: a KPI nobody linked to/from (zerwana nić).
  { id: 'orphan-kpi', label: 'Unlinked 86', column: 1 },
];

const LINKS: GoldenThreadLink[] = [
  { source: 'init-1', target: 'kpi-1', value: 50 },
  { source: 'init-2', target: 'kpi-2', value: 30 },
  { source: 'kpi-1', target: 'line-1', value: 50 },
  { source: 'kpi-2', target: 'line-1', value: 30 },
  { source: 'line-1', target: 'val-1', value: 80 },
];

describe('GoldenThreadSankey', () => {
  it('renders the root container with testid', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    expect(screen.getByTestId('golden-thread-sankey')).toBeInTheDocument();
  });

  it('renders all nodes across columns (non-orphans as gt-node)', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    const nodeEls = screen.getAllByTestId('gt-node');
    // 6 fully-wired nodes (7 total minus 1 orphan).
    expect(nodeEls).toHaveLength(6);
    // Columns 0..3 are all represented.
    const columns = new Set(nodeEls.map((el) => el.getAttribute('data-column')));
    expect(columns).toEqual(new Set(['0', '1', '2', '3']));
  });

  it('renders one link per provided link entry', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    expect(screen.getAllByTestId('gt-link')).toHaveLength(LINKS.length);
  });

  it('detects and highlights orphan nodes (zerwana nić)', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    const orphans = screen.getAllByTestId('gt-orphan');
    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toHaveAttribute('data-node-id', 'orphan-kpi');
    expect(orphans[0]).toHaveAttribute('data-orphan', 'true');

    // Orphan count surfaced on the container for consumers.
    expect(screen.getByTestId('golden-thread-sankey')).toHaveAttribute('data-orphan-count', '1');

    // Orphan rect uses a highlight stroke (amber/rose), not the column color.
    const rect = orphans[0].querySelector('rect');
    expect(rect).not.toBeNull();
    const stroke = rect!.getAttribute('stroke');
    expect(['#f59e0b', '#f43f5e']).toContain(stroke);
    expect(rect!.getAttribute('stroke-dasharray')).toBe('4 2');
  });

  it('treats a node with no incoming AND no outgoing links as an isolated orphan', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    const orphan = screen.getByTestId('gt-orphan');
    // Isolated orphan gets the rose (negative) stroke per canon §1.
    const rect = orphan.querySelector('rect');
    expect(rect!.getAttribute('stroke')).toBe('#f43f5e');
  });

  it('fires onSelect with the node id on click', () => {
    const onSelect = vi.fn();
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} onSelect={onSelect} />);
    const node = screen
      .getAllByTestId('gt-node')
      .find((el) => el.getAttribute('data-node-id') === 'kpi-1');
    expect(node).toBeDefined();
    fireEvent.click(node!);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('kpi-1');
  });

  it('fires onSelect when clicking an orphan node too', () => {
    const onSelect = vi.fn();
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('gt-orphan'));
    expect(onSelect).toHaveBeenCalledWith('orphan-kpi');
  });

  it('shows a tooltip with label + value on node hover', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    expect(screen.queryByTestId('gt-tooltip')).toBeNull();
    fireEvent.mouseEnter(screen.getByTestId('gt-orphan'));
    const tip = screen.getByTestId('gt-tooltip');
    expect(tip).toHaveTextContent('Unlinked 86');
    fireEvent.mouseLeave(screen.getByTestId('gt-orphan'));
    expect(screen.queryByTestId('gt-tooltip')).toBeNull();
  });

  it('does not throw when onSelect is omitted', () => {
    render(<GoldenThreadSankey nodes={NODES} links={LINKS} />);
    expect(() => fireEvent.click(screen.getAllByTestId('gt-node')[0])).not.toThrow();
  });

  it('renders an empty state when there are no nodes', () => {
    render(<GoldenThreadSankey nodes={[]} links={[]} />);
    const root = screen.getByTestId('golden-thread-sankey');
    expect(root).toHaveAttribute('data-empty', 'true');
    expect(root).toHaveTextContent(/Brak danych/i);
    expect(screen.queryByTestId('gt-node')).toBeNull();
  });
});
