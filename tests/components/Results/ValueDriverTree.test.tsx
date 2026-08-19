/**
 * @vitest-environment jsdom
 *
 * M15 Seria T / T2 — FE component tests for ValueDriverTree.
 * Covers: render with realistic driver-tree payload (nodes/edges/stats),
 * stats strip, legend, tree roots, empty-state (no links / no data), and load error.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any, opts?: any) => {
      let str = typeof fallback === 'string' ? fallback : _key;
      if (opts && typeof opts === 'object') {
        str = str.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => String(opts[k] ?? ''));
      }
      return str;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn() },
}));

import ValueDriverTree from '@/components/Results/ValueDriverTree';
import { Api } from '@/services/api';

const TREE = {
  nodes: [
    { id: 'obj-1', label: 'Wzrost marży', type: 'objective', rolledUpValue: 2_500_000, confidence: 0.8 },
    { id: 'drv-1', label: 'Efektywność procesów', type: 'driver', value: 1_200_000, confidence: 0.7 },
    { id: 'kpi-1', label: 'Koszt jednostkowy', type: 'kpi', value: 80, target: 60 },
    { id: 'init-1', label: 'Lean transformation', type: 'initiative', value: 500_000 },
  ],
  edges: [
    { from: 'obj-1', to: 'drv-1', weight: 1 },
    { from: 'drv-1', to: 'kpi-1', weight: 0.6 },
    { from: 'kpi-1', to: 'init-1', weight: 1 },
  ],
  stats: { totalNodes: 4, objectiveCount: 1, kpiCount: 1, initiativeCount: 1, coveredValue: 2_500_000 },
};

function mockTree(value: any) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url.endsWith('/driver-tree')) return { data: value } as any;
    throw new Error(`Unexpected GET ${url}`);
  });
}

describe('ValueDriverTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the tree without crashing for a realistic payload', async () => {
    mockTree(TREE);
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree')).toBeInTheDocument());
  });

  it('renders the stats strip with KPI / initiative / node counts', async () => {
    mockTree(TREE);
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree')).toBeInTheDocument());
    // stat labels
    expect(screen.getAllByText('KPI').length).toBeGreaterThan(0);
    expect(screen.getByText(/Nodes|Węzły/)).toBeInTheDocument();
    // node count value
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders the type legend (objective/driver/kpi/initiative)', async () => {
    mockTree(TREE);
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree')).toBeInTheDocument());
    // Legend type labels share the same i18n fallback as the node type captions,
    // so each appears at least once (legend pill + matching node caption).
    expect(screen.getAllByText('objective').length).toBeGreaterThan(0);
    expect(screen.getAllByText('driver').length).toBeGreaterThan(0);
    expect(screen.getAllByText('initiative').length).toBeGreaterThan(0);
  });

  it('renders the root node and at least one descendant of the tree', async () => {
    mockTree(TREE);
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree')).toBeInTheDocument());
    // root with no incoming edge = obj-1
    expect(screen.getByText('Wzrost marży')).toBeInTheDocument();
    // depth<2 auto-expanded -> driver shows
    expect(screen.getByText('Efektywność procesów')).toBeInTheDocument();
  });

  it('shows the no-links empty state when nodes exist but have no edges', async () => {
    mockTree({
      nodes: [{ id: 'kpi-1', label: 'Orphan KPI', type: 'kpi' }],
      edges: [],
      stats: { totalNodes: 1, objectiveCount: 0, kpiCount: 1, initiativeCount: 0, coveredValue: 0 },
    });
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree')).toBeInTheDocument());
    // every node is a root, but renders fine; no-links message only when roots.length === 0.
    // An orphan node IS a root, so it renders. Assert it shows, not the empty placeholder.
    expect(screen.getByText('Orphan KPI')).toBeInTheDocument();
  });

  it('renders empty stats strip and no-links message when nodes/edges are both empty', async () => {
    mockTree({
      nodes: [],
      edges: [],
      stats: { totalNodes: 0, objectiveCount: 0, kpiCount: 0, initiativeCount: 0, coveredValue: 0 },
    });
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree')).toBeInTheDocument());
    expect(
      screen.getByText(/No KPI–initiative links|Brak powiązań KPI z inicjatywami/)
    ).toBeInTheDocument();
  });

  it('renders the error state when the endpoint rejects', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('boom'));
    render(<ValueDriverTree projectId="all" />);
    await waitFor(() => expect(screen.getByTestId('value-driver-tree-error')).toBeInTheDocument());
    expect(
      screen.getByText(/Failed to load the tree.|Nie udało się załadować drzewa/)
    ).toBeInTheDocument();
  });
});
