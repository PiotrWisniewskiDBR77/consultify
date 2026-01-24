/**
 * PainPointNode Tests
 *
 * Tests for the PainPointNode component that renders pain points
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
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

// Import after mocks
import { PainPointNode } from '../../../../src/components/Discovery/nodes/PainPointNode';

describe('PainPointNode', () => {
  const defaultProps = {
    id: 'pain-1',
    type: 'painPoint',
    data: {
      text: 'Manual approval process takes 3 days',
      severity: 4 as const,
      area: 'operations' as const,
      source: 'user' as const,
    },
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
  };

  it('renders without crashing', () => {
    render(<PainPointNode {...defaultProps} />);
    expect(screen.getByText('Manual approval process takes 3 days')).toBeInTheDocument();
  });

  it('displays the pain point text', () => {
    render(<PainPointNode {...defaultProps} />);
    expect(screen.getByText('Manual approval process takes 3 days')).toBeInTheDocument();
  });

  it('shows severity indicators', () => {
    const { container } = render(<PainPointNode {...defaultProps} />);
    // Severity 4 should show 4 dots
    const dots = container.querySelectorAll('.bg-red-400, .bg-orange-400, .bg-slate-300');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('applies selected styles when selected', () => {
    const { container } = render(<PainPointNode {...defaultProps} selected={true} />);
    // Should have ring classes when selected
    expect(container.firstChild).toHaveClass('ring-2');
  });

  it('renders handles for connections', () => {
    render(<PainPointNode {...defaultProps} />);
    expect(screen.getByTestId('handle-target-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-source-right')).toBeInTheDocument();
  });

  it('displays area badge', () => {
    render(<PainPointNode {...defaultProps} />);
    expect(screen.getByText('operations')).toBeInTheDocument();
  });

  it('handles different severity levels', () => {
    const lowSeverityProps = {
      ...defaultProps,
      data: { ...defaultProps.data, severity: 1 as const },
    };
    const { container } = render(<PainPointNode {...lowSeverityProps} />);
    // Should render with severity styling
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles different pain areas', () => {
    const strategicProps = {
      ...defaultProps,
      data: { ...defaultProps.data, area: 'strategy' as const },
    };
    render(<PainPointNode {...strategicProps} />);
    expect(screen.getByText('strategy')).toBeInTheDocument();
  });
});
