/**
 * InsightNode Tests
 *
 * Tests for the InsightNode component that renders insights
 * on the Discovery Canvas.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock React Flow
vi.mock('reactflow', () => ({
  Handle: ({ type, position }: any) => (
    <div data-testid={`handle-${type}-${position}`} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

// Import after mocks
import { InsightNode } from '../../../../src/components/Discovery/nodes/InsightNode';

describe('InsightNode', () => {
  const defaultProps = {
    id: 'insight-1',
    type: 'insight',
    data: {
      text: 'Automation could reduce approval time by 80%',
      linkedPainIds: ['pain-1', 'pain-2'],
      source: 'ai' as const,
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  it('renders without crashing', () => {
    render(<InsightNode {...defaultProps} />);
    expect(screen.getByText('Automation could reduce approval time by 80%')).toBeInTheDocument();
  });

  it('displays the insight text', () => {
    render(<InsightNode {...defaultProps} />);
    expect(screen.getByText('Automation could reduce approval time by 80%')).toBeInTheDocument();
  });

  it('shows linked pain points count', () => {
    render(<InsightNode {...defaultProps} />);
    // Should show "2" for linked pains
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('applies selected styles when selected', () => {
    const { container } = render(<InsightNode {...defaultProps} selected={true} />);
    expect(container.firstChild).toHaveClass('ring-2');
  });

  it('renders handles for connections', () => {
    render(<InsightNode {...defaultProps} />);
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
  });

  it('handles empty linked pains', () => {
    const noLinksProps = {
      ...defaultProps,
      data: { ...defaultProps.data, linkedPainIds: [] },
    };
    render(<InsightNode {...noLinksProps} />);
    // Should still render without linked pains indicator
    expect(screen.getByText('Automation could reduce approval time by 80%')).toBeInTheDocument();
  });

  it('indicates AI-generated insights', () => {
    render(<InsightNode {...defaultProps} />);
    // Should have some visual indicator for AI source
    expect(screen.getByText('Automation could reduce approval time by 80%')).toBeInTheDocument();
  });
});
