import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeGraphExplorer } from '@/components/Organization/KnowledgeGraphExplorer';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    kgGetStats: vi.fn(),
    kgSearchEntities: vi.fn(),
    kgGetEntityRelations: vi.fn(),
    kgTraverse: vi.fn(),
    kgGetProvenance: vi.fn(),
  },
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

// dagre layout is irrelevant to smoke assertions.
vi.mock('dagre', () => ({
  default: {
    graphlib: { Graph: class { setDefaultEdgeLabel() {} setGraph() {} setNode() {} setEdge() {} node() { return { x: 0, y: 0 }; } } },
    layout: () => {},
  },
}));

// Lightweight ReactFlow stub so the graph canvas renders deterministically.
vi.mock('reactflow', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="reactflow">{children}</div>
  );
  return {
    __esModule: true,
    default: Passthrough,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    useNodesState: () => [[], vi.fn(), vi.fn()],
    useEdgesState: () => [[], vi.fn(), vi.fn()],
  };
});
vi.mock('reactflow/dist/style.css', () => ({}));

describe('KnowledgeGraphExplorer (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search input', async () => {
    vi.mocked(Api.kgGetStats).mockResolvedValue({
      totalEntities: 10,
      totalRelations: 4,
      entityTypes: {},
      avgConfidence: 0.8,
      staleEntities: 0,
      redactedEntities: 0,
    });

    render(<KnowledgeGraphExplorer />);

    expect(
      screen.getByPlaceholderText(/Search knowledge graph entities/i)
    ).toBeInTheDocument();
  });

  it('dispatches Api.kgSearchEntities when searching', async () => {
    vi.mocked(Api.kgGetStats).mockResolvedValue({
      totalEntities: 10,
      totalRelations: 4,
      entityTypes: {},
      avgConfidence: 0.8,
      staleEntities: 0,
      redactedEntities: 0,
    });
    vi.mocked(Api.kgSearchEntities).mockResolvedValue([]);

    render(<KnowledgeGraphExplorer />);

    const input = screen.getByPlaceholderText(/Search knowledge graph entities/i);
    fireEvent.change(input, { target: { value: 'atelier' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(Api.kgSearchEntities).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'atelier' })
      );
    });
  });

  it('shows the onboarding empty state when stats report 0 entities', async () => {
    vi.mocked(Api.kgGetStats).mockResolvedValue({
      totalEntities: 0,
      totalRelations: 0,
      entityTypes: {},
      avgConfidence: 0,
      staleEntities: 0,
      redactedEntities: 0,
    });

    render(<KnowledgeGraphExplorer />);

    await waitFor(() => {
      expect(screen.getByText(/Your knowledge graph is empty/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /Set up your org profile/i })
    ).toBeInTheDocument();
  });
});
