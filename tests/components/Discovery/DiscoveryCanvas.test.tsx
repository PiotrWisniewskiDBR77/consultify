/**
 * DiscoveryCanvas Tests
 *
 * Tests for the Discovery Canvas component that renders pain points,
 * insights, and recommendations as nodes on a React Flow canvas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock the store before importing the component
const mockNodes = [
  {
    id: 'pain-1',
    type: 'painPoint',
    position: { x: 100, y: 100 },
    data: {
      text: 'Manual approval process takes 3 days',
      severity: 4,
      area: 'operations',
      source: 'user',
    },
  },
  {
    id: 'insight-1',
    type: 'insight',
    position: { x: 300, y: 100 },
    data: {
      text: 'Automation could reduce time by 80%',
      linkedPainIds: ['pain-1'],
      source: 'ai',
    },
  },
];

const mockEdges = [
  {
    id: 'edge-1',
    source: 'pain-1',
    target: 'insight-1',
    type: 'smoothstep',
  },
];

const mockDiscoveryStore = {
  nodes: mockNodes,
  edges: mockEdges,
  addEdge: vi.fn(),
  removeNode: vi.fn(),
  moveNode: vi.fn(),
  autoLayout: vi.fn(),
  saveVersion: vi.fn(() => 1),
  getNodesInCategory: vi.fn(() => []),
};

vi.mock('../../../src/store/useDiscoveryStore', () => ({
  useDiscoveryStore: () => mockDiscoveryStore,
}));

// Mock React Flow
vi.mock('reactflow', () => ({
  ReactFlow: ({ children, nodes, edges }: any) => (
    <div data-testid="react-flow">
      <div data-testid="nodes-count">{nodes?.length || 0}</div>
      <div data-testid="edges-count">{edges?.length || 0}</div>
      {children}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getNodes: vi.fn(() => []),
  }),
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  BackgroundVariant: {
    Dots: 'dots',
    Lines: 'lines',
    Cross: 'cross',
  },
  applyNodeChanges: vi.fn(),
  addEdge: vi.fn(),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

// Import after mocks
import { DiscoveryCanvas } from '../../../src/components/Discovery/DiscoveryCanvas';

describe('DiscoveryCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store mock
    mockDiscoveryStore.nodes = mockNodes;
    mockDiscoveryStore.edges = mockEdges;
  });

  it('renders without crashing', () => {
    render(<DiscoveryCanvas />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('displays correct number of nodes', () => {
    render(<DiscoveryCanvas />);
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('2');
  });

  it('displays correct number of edges', () => {
    render(<DiscoveryCanvas />);
    expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
  });

  it('renders canvas controls', () => {
    render(<DiscoveryCanvas />);
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('renders minimap', () => {
    render(<DiscoveryCanvas />);
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('renders with empty nodes array', () => {
    mockDiscoveryStore.nodes = [];
    mockDiscoveryStore.edges = [];
    render(<DiscoveryCanvas />);
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('0');
  });
});
