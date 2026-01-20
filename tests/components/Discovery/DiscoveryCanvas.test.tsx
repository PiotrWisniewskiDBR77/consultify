/**
 * DiscoveryCanvas Tests
 *
 * Tests for the Discovery Canvas component that renders pain points,
 * insights, and recommendations as nodes on a React Flow canvas.
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { DiscoveryNode, DiscoveryEdge } from '../../../src/types/discovery';

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

const mockNodes: DiscoveryNode[] = [
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockEdges: DiscoveryEdge[] = [
  {
    id: 'edge-1',
    source: 'pain-1',
    target: 'insight-1',
    type: 'smoothstep',
  },
];

describe('DiscoveryCanvas', () => {
  const defaultProps = {
    nodes: mockNodes,
    edges: mockEdges,
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
    onNodeClick: jest.fn(),
    onSaveVersion: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('displays correct number of nodes', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('2');
  });

  it('displays correct number of edges', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('edges-count')).toHaveTextContent('1');
  });

  it('renders canvas controls', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  it('renders minimap', () => {
    render(<DiscoveryCanvas {...defaultProps} />);
    expect(screen.getByTestId('minimap')).toBeInTheDocument();
  });

  it('renders with empty nodes array', () => {
    render(<DiscoveryCanvas {...defaultProps} nodes={[]} edges={[]} />);
    expect(screen.getByTestId('nodes-count')).toHaveTextContent('0');
  });
});
